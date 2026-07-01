/**
 * Integration tests — Collector data exposure (#6).
 *
 * Officials get the full row (license_no, contact_phone).
 * Residents and collectors get a trimmed public view with no PII.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createCollector,
} from '../helpers.js';

let officialToken, residentToken, collectorToken;
let collector;

beforeAll(async () => {
  await truncateTables();

  const official     = await createUser({ role: 'official' });
  const resident     = await createUser({ role: 'resident' });
  const collectorUser = await createUser({ role: 'collector' });

  officialToken  = makeToken({ id: official.id,     role: 'official' });
  residentToken  = makeToken({ id: resident.id,     role: 'resident' });
  collectorToken = makeToken({ id: collectorUser.id, role: 'collector' });

  collector = await createCollector(collectorUser.id, {
    license_no:   'LIC-TEST-001',
    contact_phone: '+254 700 000 001',
  });
});
afterAll(closePool);

describe('GET /api/collectors — role-based projection (#6)', () => {
  it('returns license_no, license_expiry, and contact_phone to an official', async () => {
    const res = await request(app)
      .get('/api/collectors')
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    const c = res.body.collectors.find(x => x.id === collector.id);
    expect(c).toBeDefined();
    expect(c.license_no).toBeDefined();
    expect(c.contact_phone).toBeDefined();
    expect(c).toHaveProperty('license_expiry');
  });

  it('does NOT expose license_no or contact_phone to a resident', async () => {
    const res = await request(app)
      .get('/api/collectors')
      .set('Authorization', `Bearer ${residentToken}`);

    expect(res.status).toBe(200);
    for (const c of res.body.collectors) {
      expect(c).not.toHaveProperty('license_no');
      expect(c).not.toHaveProperty('contact_phone');
    }
  });

  it('does NOT expose license_no or contact_phone to a collector', async () => {
    const res = await request(app)
      .get('/api/collectors')
      .set('Authorization', `Bearer ${collectorToken}`);

    expect(res.status).toBe(200);
    for (const c of res.body.collectors) {
      expect(c).not.toHaveProperty('license_no');
      expect(c).not.toHaveProperty('contact_phone');
    }
  });
});

describe('GET /api/collectors/:id — role-based projection (#6)', () => {
  it('returns license_no and contact_phone to an official', async () => {
    const res = await request(app)
      .get(`/api/collectors/${collector.id}`)
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    expect(res.body.collector.license_no).toBeDefined();
    expect(res.body.collector.contact_phone).toBeDefined();
  });

  it('does NOT expose PII to a resident', async () => {
    const res = await request(app)
      .get(`/api/collectors/${collector.id}`)
      .set('Authorization', `Bearer ${residentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.collector).not.toHaveProperty('license_no');
    expect(res.body.collector).not.toHaveProperty('contact_phone');
    expect(res.body.collector).not.toHaveProperty('license_expiry');
  });
});

describe('POST /api/collectors — official registers a collector with licence expiry (TC-06)', () => {
  it('creates a collector record with name, licence number, and expiry, returned to officials', async () => {
    const res = await request(app)
      .post('/api/collectors')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({
        name: 'New Collector Contact',
        email: `newcollector_${Date.now()}@test.local`,
        password: 'Password1!',
        company_name: 'Fresh Start Waste Ltd',
        license_no: `TC06-${Date.now()}`,
        license_expiry: '2027-06-30',
      });

    expect(res.status).toBe(201);
    expect(res.body.collector.license_expiry).toBe('2027-06-30');

    // Round-trips back to officials via the list endpoint
    const listRes = await request(app)
      .get('/api/collectors')
      .set('Authorization', `Bearer ${officialToken}`);
    const created = listRes.body.collectors.find(c => c.id === res.body.collector.id);
    expect(created.license_expiry).toBe('2027-06-30');
  });

  it('existing collectors with no expiry set still load without error (null-safe)', async () => {
    const res = await request(app)
      .get(`/api/collectors/${collector.id}`)
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    expect(res.body.collector.license_expiry).toBeNull();
  });
});
