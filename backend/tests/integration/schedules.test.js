/**
 * Integration tests — Schedule management.
 *
 * Covers:
 *  - PUT /:id succeeds with a partial body (COALESCE model now reachable) (#7)
 *  - POST / requires all fields
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector, createSchedule,
} from '../helpers.js';

let officialToken, residentToken;
let zone, collector, schedule;

beforeAll(async () => {
  await truncateTables();

  const official     = await createUser({ role: 'official' });
  const collectorUser = await createUser({ role: 'collector' });
  const resident      = await createUser({ role: 'resident' });

  officialToken = makeToken({ id: official.id, role: 'official' });
  residentToken = makeToken({ id: resident.id, role: 'resident' });
  zone          = await createZone();
  collector     = await createCollector(collectorUser.id);

  schedule = await createSchedule({
    zone_id: zone.id, collector_id: collector.id,
    day_of_week: 1, start_time: '08:00', frequency: 'weekly',
  });
});
afterAll(closePool);

describe('POST /api/schedules — requires all fields', () => {
  it('rejects a request missing day_of_week', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ zone_id: zone.id, collector_id: collector.id, start_time: '09:00', frequency: 'weekly' });
    expect(res.status).toBe(400);
  });

  it('creates a schedule when all required fields are provided', async () => {
    const res = await request(app)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({
        zone_id:      zone.id,
        collector_id: collector.id,
        day_of_week:  3,
        start_time:   '09:00',
        frequency:    'weekly',
      });
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/schedules/:id — partial update now works (#7)', () => {
  it('updates only start_time and preserves other fields', async () => {
    const res = await request(app)
      .put(`/api/schedules/${schedule.id}`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ start_time: '10:30' }); // only changing one field

    expect(res.status).toBe(200);
    expect(res.body.schedule.start_time).toMatch(/^10:30/);
    // Other fields should be unchanged
    expect(res.body.schedule.day_of_week).toBe(1);
    expect(res.body.schedule.frequency).toBe('weekly');
  });

  it('updates frequency while preserving day_of_week and start_time', async () => {
    const res = await request(app)
      .put(`/api/schedules/${schedule.id}`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ frequency: 'biweekly' });

    expect(res.status).toBe(200);
    expect(res.body.schedule.frequency).toBe('biweekly');
    expect(res.body.schedule.day_of_week).toBe(1);
  });

  it('rejects an invalid frequency value', async () => {
    const res = await request(app)
      .put(`/api/schedules/${schedule.id}`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ frequency: 'monthly' }); // not a valid enum value

    expect(res.status).toBe(400);
  });
});

describe('GET /api/schedules/zone/:zoneId — published schedule for a zone (TC-11)', () => {
  it('shows the correct schedule for the zone to an authenticated resident', async () => {
    const res = await request(app)
      .get(`/api/schedules/zone/${zone.id}`)
      .set('Authorization', `Bearer ${residentToken}`);

    expect(res.status).toBe(200);
    const found = res.body.schedules.find(s => s.id === schedule.id);
    expect(found).toBeDefined();
    expect(found.day_of_week).toBe(1);
    expect(found.collector_name).toBeDefined();
  });
});
