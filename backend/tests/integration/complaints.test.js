/**
 * Integration tests — Citizen reporting module (TC-15, TC-16, TC-17, TC-18).
 *
 * Covers:
 *  - Resident submits a complaint -> reference_no generated, routed to the
 *    zone's assigned collector (TC-15)
 *  - Submission with a required field missing -> rejected (TC-16)
 *  - Resident reads back their own complaints via /mine (TC-17)
 *  - Official filters open complaints by zone + category together (TC-18)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector,
} from '../helpers.js';
import pool from '../../src/config/db.js';

let residentToken, officialToken;
let resident;
let zoneA, zoneB, collectorA;

beforeAll(async () => {
  await truncateTables();

  resident = await createUser({ role: 'resident' });
  const official = await createUser({ role: 'official' });
  const collectorUserA = await createUser({ role: 'collector' });

  residentToken = makeToken({ id: resident.id, role: 'resident' });
  officialToken = makeToken({ id: official.id, role: 'official' });

  collectorA = await createCollector(collectorUserA.id, { license_no: `CP-${Date.now()}` });
  zoneA = await createZone({ name: `ComplaintsZoneA_${Date.now()}`, assigned_collector_id: collectorA.id });
  zoneB = await createZone({ name: `ComplaintsZoneB_${Date.now()}` });
});
afterAll(closePool);

describe('POST /api/complaints — submission and routing (TC-15)', () => {
  it('creates a complaint with a generated reference number, routed to the zone collector', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ zone_id: zoneA.id, category: 'missed_pickup', description: 'Bins not collected Monday.' });

    expect(res.status).toBe(201);
    expect(res.body.complaint.reference_no).toMatch(/^CMP-\d{4}-\d{5}$/);
    expect(res.body.complaint.assigned_collector_id).toBe(collectorA.id);
    expect(res.body.complaint.status).toBe('open');
  });
});

describe('POST /api/complaints — required field missing (TC-16)', () => {
  it('rejects a submission with category omitted', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ zone_id: zoneA.id, description: 'No category provided.' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/complaints/mine — resident tracks own complaint status (TC-17)', () => {
  it("returns the resident's own complaint with its current status", async () => {
    const submitRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ zone_id: zoneA.id, category: 'overflowing_bin', description: 'Bin overflowing at junction.' });
    expect(submitRes.status).toBe(201);

    const res = await request(app)
      .get('/api/complaints/mine')
      .set('Authorization', `Bearer ${residentToken}`);

    expect(res.status).toBe(200);
    const found = res.body.complaints.find(c => c.id === submitRes.body.complaint.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('open');
  });
});

describe('GET /api/complaints — official filters by zone + category (TC-18)', () => {
  let matchId;

  beforeAll(async () => {
    // Matching row: zoneA, missed_pickup, open
    const { rows: [match] } = await pool.query(
      `INSERT INTO complaints (resident_id, zone_id, category, description, status, assigned_collector_id)
       VALUES ($1, $2, 'missed_pickup', 'Match row', 'open', $3) RETURNING id`,
      [resident.id, zoneA.id, collectorA.id]
    );
    matchId = match.id;

    // Non-matching: same zone, different category
    await pool.query(
      `INSERT INTO complaints (resident_id, zone_id, category, description, status, assigned_collector_id)
       VALUES ($1, $2, 'illegal_dumping', 'Different category', 'open', $3)`,
      [resident.id, zoneA.id, collectorA.id]
    );

    // Non-matching: different zone, same category
    await pool.query(
      `INSERT INTO complaints (resident_id, zone_id, category, description, status)
       VALUES ($1, $2, 'missed_pickup', 'Different zone', 'open')`,
      [resident.id, zoneB.id]
    );

    // Non-matching: same zone + category, but not open
    await pool.query(
      `INSERT INTO complaints (resident_id, zone_id, category, description, status, assigned_collector_id)
       VALUES ($1, $2, 'missed_pickup', 'Already resolved', 'resolved', $3)`,
      [resident.id, zoneA.id, collectorA.id]
    );
  });

  it('returns only complaints matching zone + category + open status', async () => {
    const res = await request(app)
      .get('/api/complaints')
      .set('Authorization', `Bearer ${officialToken}`)
      .query({ status: 'open', zoneId: zoneA.id, category: 'missed_pickup' });

    expect(res.status).toBe(200);
    const ids = res.body.complaints.map(c => c.id);
    expect(ids).toContain(matchId);
    for (const c of res.body.complaints) {
      expect(c.zone_id).toBe(zoneA.id);
      expect(c.category).toBe('missed_pickup');
      expect(c.status).toBe('open');
    }
  });
});
