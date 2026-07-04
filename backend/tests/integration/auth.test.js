/**
 * Integration tests — Auth & RBAC boundaries.
 *
 * Key regression: POST /api/auth/register must always create a 'resident'
 * regardless of any role field in the request body (#1).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { truncateTables, closePool, makeToken, createUser, createZone } from '../helpers.js';

// Registration requires a valid collection zone + contact phone; create one zone
// up front and reuse its id across the register/login cases.
let zoneId;
beforeAll(truncateTables);
beforeAll(async () => { zoneId = (await createZone({ name: 'Auth Test Zone' })).id; });
afterAll(closePool);

describe('POST /api/auth/register', () => {
  it('creates a resident account and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada Test', email: `ada_${Date.now()}@test.local`, password: 'Password1!', zone_id: zoneId, contact_phone: '+254700000000' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('resident');
    expect(res.body.token).toBeDefined();
  });

  it('ignores a role field in the body — still creates resident (regression #1)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sneaky User',
        email: `sneaky_${Date.now()}@test.local`,
        password: 'Password1!',
        zone_id: zoneId,
        contact_phone: '+254700000000',
        role: 'official',   // attacker-supplied — must be ignored
      });

    expect(res.status).toBe(201);
    // Server must discard the supplied role and default to 'resident'
    expect(res.body.user.role).toBe('resident');
  });

  it('rejects short passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short', email: `short_${Date.now()}@test.local`, password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects registration with a required field empty — email (TC-02)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'No Email', email: '', password: 'Password1!' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    const email = `dup_${Date.now()}@test.local`;
    await request(app).post('/api/auth/register')
      .send({ name: 'First', email, password: 'Password1!', zone_id: zoneId, contact_phone: '+254700000000' });

    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Second', email, password: 'Password1!', zone_id: zoneId, contact_phone: '+254700000000' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  let email, password;
  beforeAll(async () => {
    email = `login_${Date.now()}@test.local`;
    password = 'Password1!';
    await request(app).post('/api/auth/register').send({ name: 'Login Test', email, password, zone_id: zoneId, contact_phone: '+254700000000' });
  });

  it('returns a token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPw!' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the user for a valid token', async () => {
    const user = await createUser({ role: 'resident' });
    const token = makeToken({ id: user.id, role: user.role });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered/invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/officials — official-only endpoint (#1)', () => {
  it('allows an official to create another official', async () => {
    const official = await createUser({ role: 'official' });
    const token    = makeToken({ id: official.id, role: 'official' });

    const res = await request(app)
      .post('/api/users/officials')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Official', email: `newofficial_${Date.now()}@test.local`, password: 'Password1!' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('official');
  });

  it('rejects a resident trying to create an official', async () => {
    const resident = await createUser({ role: 'resident' });
    const token    = makeToken({ id: resident.id, role: 'resident' });

    const res = await request(app)
      .post('/api/users/officials')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rogue Official', email: `rogue_${Date.now()}@test.local`, password: 'Password1!' });

    expect(res.status).toBe(403);
  });
});
