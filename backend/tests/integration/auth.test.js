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
import pool from '../../src/config/db.js';
import { hashCode } from '../../src/models/loginCode.model.js';

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

// ── OTP 2FA ──────────────────────────────────────────────────────────────────
//
// auth.controller.js reads MFA_ENABLED ONCE at module load:
//   const MFA_ENABLED = process.env.MFA_ENABLED !== 'false';   (line 16)
// app.js (and therefore auth.controller.js) is imported once when this test
// file's `import app from '../../src/app.js'` runs, before any beforeAll/it
// executes — so that binding is frozen for the entire process using whatever
// .env.test set at process start (MFA_ENABLED=false here). Flipping
// process.env.MFA_ENABLED inside a beforeAll/afterAll would have NO effect on
// the already-evaluated constant, and login()/resendOtp() only take the OTP
// branch when MFA_ENABLED is true — so a real /login call can never be driven
// through /verify-otp in this suite without a production-code change.
//
// Instead, verify-otp's own logic (correct/wrong/expired code, single-use,
// attempt cap) is exercised against a login_codes row inserted directly via
// the DB pool, hashed the same way loginCode.model.js does (sha256 hex), so
// the plaintext code is known up front. This sidesteps the MFA_ENABLED
// question entirely for everything except the mfaRequired response shape and
// resend-otp's always-200 behavior, which are covered against the real
// /login and /resend-otp endpoints below (under the MFA_ENABLED=false path
// that's actually reachable in this env).

describe('POST /api/auth/login and /register — response shape under MFA_ENABLED=false', () => {
  it('login returns a token directly, with no mfaRequired flag', async () => {
    const email = `login_nomfa_${Date.now()}@test.local`;
    const password = 'Password1!';
    await request(app).post('/api/auth/register')
      .send({ name: 'NoMfa Login', email, password, zone_id: zoneId, contact_phone: '+254700000000' });

    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.mfaRequired).toBeUndefined();
  });

  it('register returns 201 with a token directly (no OTP round-trip)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Reg NoMfa', email: `reg_nomfa_${Date.now()}@test.local`, password: 'Password1!',
      zone_id: zoneId, contact_phone: '+254700000000',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.mfaRequired).toBeUndefined();
  });
});

describe('POST /api/auth/verify-otp', () => {
  /** Inserts a login_codes fixture row with a known plaintext code. */
  async function seedCode(userId, { code = '123456', attempts = 0, expiresInMin = 10 } = {}) {
    await pool.query(
      `INSERT INTO login_codes (user_id, code_hash, expires_at, attempts)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)`,
      [userId, hashCode(code), String(expiresInMin), attempts]
    );
  }

  it('accepts the correct code, issues a token, and is single-use', async () => {
    const user = await createUser({ role: 'resident' });
    await seedCode(user.id, { code: '111111' });

    const ok = await request(app).post('/api/auth/verify-otp').send({ email: user.email, code: '111111' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeDefined();

    // Consumed — replaying the same code now fails.
    const replay = await request(app).post('/api/auth/verify-otp').send({ email: user.email, code: '111111' });
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toBe('Invalid or expired code');
  });

  it('rejects a wrong code with the generic message', async () => {
    const user = await createUser({ role: 'resident' });
    await seedCode(user.id, { code: '222222' });

    const res = await request(app).post('/api/auth/verify-otp').send({ email: user.email, code: '999999' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid or expired code');
  });

  it('rejects an expired code', async () => {
    const user = await createUser({ role: 'resident' });
    await seedCode(user.id, { code: '333333', expiresInMin: -1 });

    const res = await request(app).post('/api/auth/verify-otp').send({ email: user.email, code: '333333' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid or expired code');
  });

  it('locks out with 429 once attempts have reached MAX_OTP_ATTEMPTS, even with the correct code', async () => {
    const user = await createUser({ role: 'resident' });
    await seedCode(user.id, { code: '444444', attempts: 5 });

    const res = await request(app).post('/api/auth/verify-otp').send({ email: user.email, code: '444444' });
    expect(res.status).toBe(429);
  });

  it('rejects an unknown email with the same generic message (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/verify-otp')
      .send({ email: `nouser_${Date.now()}@test.local`, code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid or expired code');
  });
});

describe('POST /api/auth/resend-otp', () => {
  // With MFA_ENABLED=false in this test process, resendOtp() never reaches
  // issueLoginCode() (guarded by `record && MFA_ENABLED`), so only the
  // always-200 / no-enumeration response shape is verifiable here — not that
  // a fresh code is actually issued when 2FA is on.
  it('responds 200 for an existing account', async () => {
    const user = await createUser({ role: 'resident' });
    const res = await request(app).post('/api/auth/resend-otp').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('responds 200 for a non-existent account too (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/resend-otp').send({ email: `ghost_${Date.now()}@test.local` });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('PATCH /api/users/me/password', () => {
  it('rejects the wrong current password (400) and leaves the password unchanged', async () => {
    const password = 'Password1!';
    const user = await createUser({ role: 'resident', password });
    const token = makeToken({ id: user.id, role: 'resident' });

    const res = await request(app).patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPw!', newPassword: 'NewPassword1!' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Current password is incorrect');

    // Unchanged — the original password still logs in.
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  it('changes the password on a correct current password; old password stops working, new one works', async () => {
    const password = 'Password1!';
    const user = await createUser({ role: 'resident', password });
    const token = makeToken({ id: user.id, role: 'resident' });
    const newPassword = 'BrandNewPw1!';

    const res = await request(app).patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.token).toBeDefined();
  });

  it('rejects a new password shorter than 8 characters (validation, 400)', async () => {
    const password = 'Password1!';
    const user = await createUser({ role: 'resident', password });
    const token = makeToken({ id: user.id, role: 'resident' });

    const res = await request(app).patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await request(app).patch('/api/users/me/password')
      .send({ currentPassword: 'x', newPassword: 'NewPassword1!' });
    expect(res.status).toBe(401);
  });
});
