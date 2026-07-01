/**
 * Integration tests — Resource ownership (#8).
 *
 * Covers:
 *  - Collector A cannot update Collector B's pickup
 *  - Resident can only see their own complaint
 *  - Collector can only update a complaint assigned to them
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector, createPickup,
} from '../helpers.js';
import pool from '../../src/config/db.js';

let collectorToken_A, collectorToken_B, residentToken, officialToken;
let collector_A, collector_B;
let zone;

beforeAll(async () => {
  await truncateTables();

  const official      = await createUser({ role: 'official' });
  const resident      = await createUser({ role: 'resident' });
  const collectorUserA = await createUser({ role: 'collector' });
  const collectorUserB = await createUser({ role: 'collector' });

  officialToken   = makeToken({ id: official.id,       role: 'official' });
  residentToken   = makeToken({ id: resident.id,       role: 'resident' });
  collectorToken_A = makeToken({ id: collectorUserA.id, role: 'collector' });
  collectorToken_B = makeToken({ id: collectorUserB.id, role: 'collector' });

  zone        = await createZone();
  collector_A = await createCollector(collectorUserA.id, { license_no: `LA-${Date.now()}` });
  collector_B = await createCollector(collectorUserB.id, { license_no: `LB-${Date.now()}` });

  // Assign zone to collector A for complaint routing
  await pool.query('UPDATE zones SET assigned_collector_id = $1 WHERE id = $2', [collector_A.id, zone.id]);
});
afterAll(closePool);

// ── Pickup ownership ──────────────────────────────────────────────────────────

describe('PATCH /api/pickups/:id/status — collector can only update their own pickup (#8)', () => {
  let pickup_for_A;

  beforeAll(async () => {
    const today = new Date().toISOString().slice(0, 10);
    pickup_for_A = await createPickup({
      zone_id:        zone.id,
      collector_id:   collector_A.id,
      scheduled_date: today,
    });
  });

  it('allows Collector A to update their own pickup', async () => {
    const res = await request(app)
      .patch(`/api/pickups/${pickup_for_A.id}/status`)
      .set('Authorization', `Bearer ${collectorToken_A}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.pickup.status).toBe('completed');
  });

  it("rejects Collector B trying to update Collector A's pickup (403)", async () => {
    // Reset status first
    await pool.query("UPDATE pickups SET status = 'pending' WHERE id = $1", [pickup_for_A.id]);

    const res = await request(app)
      .patch(`/api/pickups/${pickup_for_A.id}/status`)
      .set('Authorization', `Bearer ${collectorToken_B}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(403);
  });
});

// ── Complaint ownership ───────────────────────────────────────────────────────

describe('GET /api/complaints/:id — residents can only see their own complaint (#8)', () => {
  let complaintId;
  let residentUser;

  beforeAll(async () => {
    residentUser = await createUser({ role: 'resident', email: `res2_${Date.now()}@test.local` });
    const { rows } = await pool.query(
      `INSERT INTO complaints (resident_id, zone_id, category, description, assigned_collector_id)
       VALUES ($1, $2, 'other', 'Test complaint', $3) RETURNING id`,
      [residentUser.id, zone.id, collector_A.id]
    );
    complaintId = rows[0].id;
  });

  it('allows the owning resident to see their complaint', async () => {
    const token = makeToken({ id: residentUser.id, role: 'resident' });
    const res   = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blocks a different resident from seeing the complaint (403)', async () => {
    // residentToken belongs to a different resident (created in beforeAll above)
    const res = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${residentToken}`);
    expect(res.status).toBe(403);
  });

  it('allows the assigned collector to see the complaint', async () => {
    const res = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${collectorToken_A}`);
    expect(res.status).toBe(200);
  });

  it('blocks an unassigned collector (403)', async () => {
    const res = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${collectorToken_B}`);
    expect(res.status).toBe(403);
  });

  it('allows an official to see any complaint', async () => {
    const res = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${officialToken}`);
    expect(res.status).toBe(200);
  });
});
