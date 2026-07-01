/**
 * Integration tests — Pickup generation.
 *
 * Covers:
 *  - Date-range validation on POST /api/pickups/generate (#5)
 *  - Biweekly schedule only generates every other week (#4)
 *  - Weekly schedule generates every week (sanity check)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector, createSchedule, createPickup,
} from '../helpers.js';

let officialToken;
let zone, collector;

beforeAll(async () => {
  await truncateTables();

  const official     = await createUser({ role: 'official' });
  const collectorUser = await createUser({ role: 'collector' });
  officialToken = makeToken({ id: official.id, role: 'official' });

  zone      = await createZone();
  collector = await createCollector(collectorUser.id);
});
afterAll(closePool);

// ── Date-range validation (#5) ────────────────────────────────────────────────

describe('POST /api/pickups/generate — date range validation (#5)', () => {
  it('rejects an invalid ISO date for "from"', async () => {
    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: 'not-a-date', to: '2024-01-07' });
    expect(res.status).toBe(400);
  });

  it('rejects when "to" is before "from"', async () => {
    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: '2024-01-14', to: '2024-01-07' });
    expect(res.status).toBe(400);
  });

  it('rejects a span greater than 90 days', async () => {
    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: '2024-01-01', to: '2025-01-01' }); // > 365 days
    expect(res.status).toBe(400);
  });

  it('accepts valid from/to within 90 days and returns created count', async () => {
    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: '2024-01-01', to: '2024-01-07' });
    expect(res.status).toBe(200);
    expect(typeof res.body.created).toBe('number');
  });

  it('accepts no body (defaults to current week)', async () => {
    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({});
    expect(res.status).toBe(200);
  });

  it('rejects a resident token', async () => {
    const resident      = await createUser({ role: 'resident' });
    const residentToken = makeToken({ id: resident.id, role: 'resident' });

    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ── Biweekly schedule generation (#4) ────────────────────────────────────────

describe('Biweekly schedule — only generates on alternating weeks (#4)', () => {
  /**
   * Strategy: create a schedule with frequency='biweekly' anchored to a known
   * Monday (2024-01-01 = week 0, active).  Generate over 4 weeks and assert
   * only 2 pickups are created (weeks 0 and 2; weeks 1 and 3 are skipped).
   *
   * The schedule's day_of_week = 1 (Monday) so each Mon in the range is a candidate.
   */
  it('creates pickups on even weeks, skips odd weeks', async () => {
    // Use a fresh zone/collector so previous generate runs don't interfere
    const collectorUser2 = await createUser({ role: 'collector' });
    const zone2          = await createZone({ name: `BiweeklyZone_${Date.now()}` });
    const collector2     = await createCollector(collectorUser2.id, { license_no: `BW-${Date.now()}` });

    // Anchor: schedule created at 2024-01-01 (a Monday)
    // We manually set created_at so weeksBetween uses a known anchor
    const { rows } = await (await import('../../src/config/db.js')).default.query(
      `INSERT INTO schedules
         (zone_id, collector_id, day_of_week, start_time, frequency, created_at)
       VALUES ($1, $2, 1, '08:00', 'biweekly', '2024-01-01T00:00:00Z')
       RETURNING *`,
      [zone2.id, collector2.id]
    );
    const biweeklySched = rows[0];

    // Generate over 4 weeks: Mon 1 Jan, Mon 8 Jan, Mon 15 Jan, Mon 22 Jan
    // Weeks 0 and 2 (from anchor) are active → should create 2 pickups
    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: '2024-01-01', to: '2024-01-28' });

    expect(res.status).toBe(200);

    // Count pickups for this specific schedule
    const { rows: pickupRows } = await (await import('../../src/config/db.js')).default.query(
      'SELECT * FROM pickups WHERE schedule_id = $1 ORDER BY scheduled_date',
      [biweeklySched.id]
    );

    // Weeks 0 (2024-01-01) and 2 (2024-01-15) = 2 pickups
    // scheduled_date now comes back as a raw 'YYYY-MM-DD' string (see db.js type parser).
    expect(pickupRows).toHaveLength(2);
    expect(pickupRows[0].scheduled_date).toBe('2024-01-01');
    expect(pickupRows[1].scheduled_date).toBe('2024-01-15');
  });
});

describe('Weekly schedule — generates every week (sanity check)', () => {
  it('creates one pickup per week for a weekly schedule', async () => {
    const collectorUser3 = await createUser({ role: 'collector' });
    const zone3          = await createZone({ name: `WeeklyZone_${Date.now()}` });
    const collector3     = await createCollector(collectorUser3.id, { license_no: `WK-${Date.now()}` });

    const sched = await createSchedule({
      zone_id: zone3.id, collector_id: collector3.id, day_of_week: 1, frequency: 'weekly',
    });

    const res = await request(app)
      .post('/api/pickups/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: '2024-01-01', to: '2024-01-28' });

    expect(res.status).toBe(200);

    const { rows } = await (await import('../../src/config/db.js')).default.query(
      'SELECT * FROM pickups WHERE schedule_id = $1 ORDER BY scheduled_date',
      [sched.id]
    );

    // 4 Mondays in the range = 4 pickups
    expect(rows).toHaveLength(4);
  });
});

// ── Missed pickup requires notes (TC-13) ─────────────────────────────────────

describe('PATCH /api/pickups/:id/status — missed status requires notes (TC-13)', () => {
  let collectorUser4, collectorToken4, zone4, collector4, pickup4;

  beforeAll(async () => {
    collectorUser4 = await createUser({ role: 'collector' });
    collectorToken4 = makeToken({ id: collectorUser4.id, role: 'collector' });
    zone4      = await createZone({ name: `MissedZone_${Date.now()}` });
    collector4 = await createCollector(collectorUser4.id, { license_no: `MS-${Date.now()}` });
    pickup4 = await createPickup({
      zone_id: zone4.id, collector_id: collector4.id,
      scheduled_date: new Date().toISOString().slice(0, 10),
    });
  });

  it('rejects marking a pickup missed without notes', async () => {
    const res = await request(app)
      .patch(`/api/pickups/${pickup4.id}/status`)
      .set('Authorization', `Bearer ${collectorToken4}`)
      .send({ status: 'missed' });

    expect(res.status).toBe(400);
  });

  it('records the exception when notes are provided', async () => {
    const res = await request(app)
      .patch(`/api/pickups/${pickup4.id}/status`)
      .set('Authorization', `Bearer ${collectorToken4}`)
      .send({ status: 'missed', notes: 'Truck breakdown on route.' });

    expect(res.status).toBe(200);
    expect(res.body.pickup.status).toBe('missed');
    expect(res.body.pickup.notes).toBe('Truck breakdown on route.');
  });
});

// ── Completion rate by zone (TC-14) ──────────────────────────────────────────

describe('GET /api/pickups/stats — completion rate by zone (TC-14)', () => {
  it('returns a by-zone breakdown of completed vs total pickups', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const collectorUser5 = await createUser({ role: 'collector' });
    const zone5      = await createZone({ name: `StatsZone_${Date.now()}` });
    const collector5 = await createCollector(collectorUser5.id, { license_no: `ST-${Date.now()}` });

    await createPickup({ zone_id: zone5.id, collector_id: collector5.id, scheduled_date: today, status: 'completed' });
    await createPickup({ zone_id: zone5.id, collector_id: collector5.id, scheduled_date: today, status: 'missed' });

    const res = await request(app)
      .get('/api/pickups/stats')
      .set('Authorization', `Bearer ${officialToken}`)
      .query({ from: today, to: today });

    expect(res.status).toBe(200);
    const zoneStat = res.body.byZone.find(z => z.zone_id === zone5.id);
    expect(zoneStat).toBeDefined();
    expect(Number(zoneStat.total)).toBe(2);
    expect(Number(zoneStat.completed)).toBe(1);
  });
});
