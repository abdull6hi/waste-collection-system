/**
 * Integration tests — Zone / collector assignment (TC-08).
 *
 * Covers:
 *  - Official assigns a collector to a zone -> saved and reflected
 *  - Reassigning to a different collector works
 *  - Assigning a non-existent collector -> 404
 *  - Assigning a collector to a non-existent zone -> 404
 *  - Assigning an inactive collector -> rejected (400)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector,
} from '../helpers.js';

let officialToken;
let zone, collectorA, collectorB, inactiveCollector;

beforeAll(async () => {
  await truncateTables();

  const official = await createUser({ role: 'official' });
  officialToken  = makeToken({ id: official.id, role: 'official' });

  zone = await createZone();

  const userA = await createUser({ role: 'collector' });
  const userB = await createUser({ role: 'collector' });
  const userC = await createUser({ role: 'collector' });

  collectorA       = await createCollector(userA.id, { license_no: `ZA-${Date.now()}` });
  collectorB       = await createCollector(userB.id, { license_no: `ZB-${Date.now()}` });
  inactiveCollector = await createCollector(userC.id, { license_no: `ZC-${Date.now()}`, active: false });
});
afterAll(closePool);

describe('PATCH /api/zones/:id/assign — collector assignment (TC-08)', () => {
  it('assigns a collector to a zone — saved and reflected', async () => {
    const res = await request(app)
      .patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ collector_id: collectorA.id });

    expect(res.status).toBe(200);
    expect(res.body.zone.assigned_collector_id).toBe(collectorA.id);
  });

  it('reassigns the zone to a different collector', async () => {
    const res = await request(app)
      .patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ collector_id: collectorB.id });

    expect(res.status).toBe(200);
    expect(res.body.zone.assigned_collector_id).toBe(collectorB.id);
  });

  it('rejects assigning a non-existent collector (404)', async () => {
    const res = await request(app)
      .patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ collector_id: 999999 });

    expect(res.status).toBe(404);
  });

  it('rejects assigning a collector to a non-existent zone (404)', async () => {
    const res = await request(app)
      .patch(`/api/zones/999999/assign`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ collector_id: collectorA.id });

    expect(res.status).toBe(404);
  });

  it('rejects assigning an inactive collector (400)', async () => {
    const res = await request(app)
      .patch(`/api/zones/${zone.id}/assign`)
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ collector_id: inactiveCollector.id });

    expect(res.status).toBe(400);
  });
});
