/**
 * Integration tests — multiple approved collectors per zone + resident choice.
 *
 * Security focus: THE INVARIANT (a resident's collector must be approved+active
 * for their zone) is enforced on every mutation path, approvals are official-only,
 * the public list leaks no PII, removal cascades, and complaint routing is
 * server-side only. Every attack case must fail closed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector,
} from '../helpers.js';

let officialToken;
let zone, otherZone, collectorA, collectorB, inactiveCollector;

async function registerResident(zoneId, extra = {}) {
  return request(app).post('/api/auth/register').send({
    name: 'Res Test',
    email: `res_${Date.now()}_${Math.random().toString(36).slice(2)}@t.local`,
    password: 'Password1!',
    zone_id: zoneId,
    contact_phone: '+254700000000',
    ...extra,
  });
}

beforeAll(async () => {
  await truncateTables();
  const official = await createUser({ role: 'official' });
  officialToken  = makeToken({ id: official.id, role: 'official' });

  zone      = await createZone({ name: 'ZC Zone' });
  otherZone = await createZone({ name: 'ZC Other Zone' });

  const uA = await createUser({ role: 'collector' });
  const uB = await createUser({ role: 'collector' });
  const uC = await createUser({ role: 'collector' });
  collectorA        = await createCollector(uA.id, { company_name: 'Alpha Co', license_no: `ZCA-${Date.now()}` });
  collectorB        = await createCollector(uB.id, { company_name: 'Beta Co',  license_no: `ZCB-${Date.now()}` });
  inactiveCollector = await createCollector(uC.id, { company_name: 'Dead Co',  license_no: `ZCD-${Date.now()}`, active: false });

  // Approve A and B for the zone (via the official endpoint).
  for (const c of [collectorA, collectorB]) {
    await request(app).post(`/api/zones/${zone.id}/collectors`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: c.id });
  }
});
afterAll(closePool);

describe('Approved-collector management (official-only)', () => {
  it('lists both approved collectors', async () => {
    const res = await request(app).get(`/api/zones/${zone.id}/collectors`)
      .set('Authorization', `Bearer ${officialToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.collectors.map(c => c.id).sort();
    expect(ids).toEqual([collectorA.id, collectorB.id].sort());
  });

  it('public list returns id + company_name ONLY (no PII), active only', async () => {
    const res = await request(app).get(`/api/zones/${zone.id}/collectors/public`);
    expect(res.status).toBe(200);
    for (const c of res.body.collectors) {
      expect(Object.keys(c).sort()).toEqual(['company_name', 'id']);
    }
    // Serialized body carries no PII field names.
    expect(JSON.stringify(res.body)).not.toMatch(/license|licence|contact|phone|email|active/i);
  });

  it('rejects a non-official approving (403)', async () => {
    const resToken = makeToken({ id: 999001, role: 'resident' });
    const res = await request(app).post(`/api/zones/${zone.id}/collectors`)
      .set('Authorization', `Bearer ${resToken}`).send({ collector_id: collectorA.id });
    expect(res.status).toBe(403);
  });

  it('rejects a non-official listing the full approved set (403)', async () => {
    const colToken = makeToken({ id: 999002, role: 'collector' });
    const res = await request(app).get(`/api/zones/${zone.id}/collectors`)
      .set('Authorization', `Bearer ${colToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a non-official removing (403)', async () => {
    const resToken = makeToken({ id: 999003, role: 'resident' });
    const res = await request(app).delete(`/api/zones/${zone.id}/collectors/${collectorA.id}`)
      .set('Authorization', `Bearer ${resToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Registration — collector choice validation', () => {
  it('accepts an approved+active collector and persists it', async () => {
    const res = await registerResident(zone.id, { collector_id: collectorA.id });
    expect(res.status).toBe(201);
    expect(res.body.user.collector_id).toBe(collectorA.id);
  });

  it('rejects an UNAPPROVED collector (400), account not created with it', async () => {
    // collectorB is approved for `zone`, so use a collector approved nowhere: create fresh.
    const uX = await createUser({ role: 'collector' });
    const cX = await createCollector(uX.id, { license_no: `ZCX-${Date.now()}` });
    const res = await registerResident(zone.id, { collector_id: cX.id });
    expect(res.status).toBe(400);
  });

  it('rejects an approved-but-INACTIVE collector (400)', async () => {
    await request(app).post(`/api/zones/${zone.id}/collectors`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: inactiveCollector.id });
    const res = await registerResident(zone.id, { collector_id: inactiveCollector.id });
    expect(res.status).toBe(400);
  });

  it('omitting collector_id auto-assigns an eligible collector for the zone', async () => {
    const res = await registerResident(zone.id);
    expect(res.status).toBe(201);
    // zone has A and B approved+active → one is auto-assigned (never left null here).
    expect([collectorA.id, collectorB.id]).toContain(res.body.user.collector_id);
  });

  it('auto-assign prefers the zone default when one is set', async () => {
    await request(app).patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: collectorB.id });
    const res = await registerResident(zone.id);
    expect(res.body.user.collector_id).toBe(collectorB.id);
    // reset default back to A for the routing/removal tests below
    await request(app).patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: collectorA.id });
  });

  it('auto-assign leaves collector_id null when the zone has no eligible collector', async () => {
    const emptyZone = await createZone({ name: `ZC Empty ${Date.now()}` });
    const res = await registerResident(emptyZone.id);
    expect(res.status).toBe(201);
    expect(res.body.user.collector_id).toBeNull();
  });
});

describe('Profile — collector choice + zone-change safety', () => {
  it('sets an approved collector (200) and rejects an unapproved one (400)', async () => {
    const reg = await registerResident(zone.id);
    const token = reg.body.token;
    const { name, email } = reg.body.user;

    const ok = await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, collector_id: collectorB.id });
    expect(ok.status).toBe(200);
    expect(ok.body.user.collector_id).toBe(collectorB.id);

    // collectorA is NOT approved for otherZone; try to point at a collector not
    // approved for the current zone via a freshly-created unapproved collector.
    const uY = await createUser({ role: 'collector' });
    const cY = await createCollector(uY.id, { license_no: `ZCY-${Date.now()}` });
    const bad = await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, collector_id: cY.id });
    expect(bad.status).toBe(400);

    // Unchanged — still B.
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.collector_id).toBe(collectorB.id);
  });

  it('clears collector_id when the resident changes zone', async () => {
    const reg = await registerResident(zone.id, { collector_id: collectorA.id });
    const token = reg.body.token;
    const { name, email } = reg.body.user;
    expect(reg.body.user.collector_id).toBe(collectorA.id);

    const res = await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, zone_id: otherZone.id });
    expect(res.status).toBe(200);
    expect(res.body.user.zone_id).toBe(otherZone.id);
    expect(res.body.user.collector_id).toBeNull();
  });

  it('PATCH /me/zone also clears collector_id', async () => {
    const reg = await registerResident(zone.id, { collector_id: collectorA.id });
    const token = reg.body.token;
    const res = await request(app).patch('/api/users/me/zone')
      .set('Authorization', `Bearer ${token}`).send({ zone_id: otherZone.id });
    expect(res.status).toBe(200);
    expect(res.body.user.collector_id).toBeNull();
  });
});

describe('Removal — referential integrity & default protection', () => {
  it('removing a collector nulls collector_id for residents who chose them (one tx)', async () => {
    const reg = await registerResident(zone.id, { collector_id: collectorB.id });
    const token = reg.body.token;
    expect(reg.body.user.collector_id).toBe(collectorB.id);

    const del = await request(app).delete(`/api/zones/${zone.id}/collectors/${collectorB.id}`)
      .set('Authorization', `Bearer ${officialToken}`);
    expect(del.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.collector_id).toBeNull();

    // re-approve B for later tests
    await request(app).post(`/api/zones/${zone.id}/collectors`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: collectorB.id });
  });

  it('refuses to remove the zone default (409)', async () => {
    await request(app).patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: collectorA.id });
    const del = await request(app).delete(`/api/zones/${zone.id}/collectors/${collectorA.id}`)
      .set('Authorization', `Bearer ${officialToken}`);
    expect(del.status).toBe(409);
  });
});

describe('Complaint routing (server-side only)', () => {
  it('routes to the resident chosen collector in their own zone', async () => {
    // default is A (set above); resident chooses B.
    const reg = await registerResident(zone.id, { collector_id: collectorB.id });
    const token = reg.body.token;
    const res = await request(app).post('/api/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ zone_id: zone.id, category: 'missed_pickup', description: 'Chosen-collector routing test.' });
    expect(res.status).toBe(201);
    expect(res.body.complaint.assigned_collector_id).toBe(collectorB.id);
  });

  it('falls back to the zone default when the resident has no chosen collector', async () => {
    // Register in a zone with no eligible collector yet → auto-assign leaves null.
    const zone3 = await createZone({ name: `ZC Fallback ${Date.now()}` });
    const reg = await registerResident(zone3.id);
    expect(reg.body.user.collector_id).toBeNull();
    // Now give zone3 a default; the resident still has NO chosen collector.
    await request(app).patch(`/api/zones/${zone3.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`).send({ collector_id: collectorA.id });
    const res = await request(app).post('/api/complaints')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ zone_id: zone3.id, category: 'missed_pickup', description: 'Default routing fallback test.' });
    expect(res.status).toBe(201);
    expect(res.body.complaint.assigned_collector_id).toBe(collectorA.id); // zone default
  });
});
