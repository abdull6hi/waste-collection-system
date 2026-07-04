// User model — all queries use explicit column lists to prevent password_hash leakage.
import { query } from '../config/db.js';

/** Strips password_hash before a user object is sent to any client. */
export function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash: _, ...safe } = user;
  return safe;
}

/** Returns the user row including password_hash — for login comparison only. */
export async function findByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await query(
    'SELECT id, name, email, role, zone_id, created_at FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

export async function create({ name, email, password_hash, role }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, zone_id, created_at`,
    [name, email, password_hash, role]
  );
  return rows[0];
}

export async function setZone(userId, zoneId) {
  const { rows } = await query(
    `UPDATE users SET zone_id = $1 WHERE id = $2
     RETURNING id, name, email, role, zone_id, created_at`,
    [zoneId, userId]
  );
  return rows[0] ?? null;
}

export async function updateProfile(id, { name, email }) {
  const { rows } = await query(
    `UPDATE users SET name = $1, email = $2 WHERE id = $3
     RETURNING id, name, email, role, zone_id, created_at`,
    [name, email, id]
  );
  return rows[0] ?? null;
}

/**
 * Residents in the zones assigned to a given collector, derived through
 * zones.assigned_collector_id (there is no direct collector↔resident link).
 *
 * Explicit projection only — never exposes email, password_hash, or role.
 * The users table has no phone column, so contact info is name + zone only.
 * Ordered by zone name then resident name for a stable, grouped UI.
 */
export async function findResidentsForCollector(collectorId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.zone_id, z.name AS zone_name
     FROM users u
     JOIN zones z ON z.id = u.zone_id
     WHERE u.role = 'resident'
       AND z.assigned_collector_id = $1
     ORDER BY z.name, u.name`,
    [collectorId]
  );
  return rows;
}

/** Returns password_hash for server-side verification only — never forward to client. */
export async function getPasswordHash(id) {
  const { rows } = await query(
    'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0]?.password_hash ?? null;
}

export async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
}
