/**
 * Shared test helpers — token factories, DB seed/cleanup.
 *
 * Import in test files; do NOT import app/pool at module level here because
 * env vars must be set first (via --env-file=.env.test in the test script).
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

// ── Token helpers ────────────────────────────────────────────────────────────

/** Create a signed JWT for a synthetic user object (no DB needed). */
export function makeToken({ id, role }) {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

// ── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Truncate all data tables in dependency order so foreign-key constraints
 * don't block deletion.  Keeps the schema intact.
 */
export async function truncateTables() {
  await pool.query(`
    TRUNCATE reports, complaints, pickups, schedules, zones,
             collectors, users
    RESTART IDENTITY CASCADE
  `);
}

/** Close the shared pool — call once in afterAll to avoid open-handle warnings. */
export async function closePool() {
  await pool.end();
}

/** Hash a password with the same cost factor the app uses. */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

/**
 * Insert a user row and return it.
 * @param {{ name?, email?, password?, role? }} overrides
 */
export async function createUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    email: `user_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`,
    password: 'Password1!',
    role: 'resident',
  };
  const data = { ...defaults, ...overrides };
  const password_hash = await hashPassword(data.password);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, zone_id, created_at`,
    [data.name, data.email, password_hash, data.role]
  );
  return { ...rows[0], rawPassword: data.password };
}

/**
 * Insert a zone row and return it.
 * @param {{ name?, description?, assigned_collector_id? }} overrides
 */
export async function createZone(overrides = {}) {
  const { rows } = await pool.query(
    `INSERT INTO zones (name, description, assigned_collector_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [
      overrides.name ?? `Zone ${Date.now()}`,
      overrides.description ?? 'Test zone',
      overrides.assigned_collector_id ?? null,
    ]
  );
  return rows[0];
}

/**
 * Insert a collector row for an existing user and return it.
 * @param {number} userId
 * @param {{ company_name?, license_no?, contact_phone? }} overrides
 */
export async function createCollector(userId, overrides = {}) {
  const { rows } = await pool.query(
    `INSERT INTO collectors (user_id, company_name, license_no, contact_phone, active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      userId,
      overrides.company_name ?? `Company ${Date.now()}`,
      overrides.license_no  ?? `LIC-${Date.now()}`,
      overrides.contact_phone ?? null,
      overrides.active ?? true,
    ]
  );
  return rows[0];
}

/**
 * Insert a schedule row and return it.
 * @param {{ zone_id, collector_id, day_of_week?, start_time?, frequency? }} data
 */
export async function createSchedule(data) {
  const { rows } = await pool.query(
    `INSERT INTO schedules (zone_id, collector_id, day_of_week, start_time, frequency)
     VALUES ($1, $2, $3, $4, $5::schedule_frequency)
     RETURNING *`,
    [
      data.zone_id,
      data.collector_id,
      data.day_of_week ?? 1,
      data.start_time  ?? '08:00',
      data.frequency   ?? 'weekly',
    ]
  );
  return rows[0];
}

/**
 * Insert a pickup row and return it.
 * @param {{ zone_id, collector_id, scheduled_date, schedule_id?, status? }} data
 */
export async function createPickup(data) {
  const { rows } = await pool.query(
    `INSERT INTO pickups (zone_id, collector_id, scheduled_date, schedule_id, status)
     VALUES ($1, $2, $3::date, $4, $5::pickup_status)
     RETURNING *`,
    [
      data.zone_id,
      data.collector_id,
      data.scheduled_date,
      data.schedule_id ?? null,
      data.status      ?? 'pending',
    ]
  );
  return rows[0];
}
