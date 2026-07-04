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
    'SELECT id, name, email, role, zone_id, collector_id, contact_phone, created_at FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

/** All users with a given role — used to fan out notifications (e.g. to officials). */
export async function findByRole(role) {
  const { rows } = await query(
    'SELECT id, name, email FROM users WHERE role = $1 ORDER BY id',
    [role]
  );
  return rows;
}

export async function create({ name, email, password_hash, role, zone_id, contact_phone, collector_id }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, zone_id, contact_phone, collector_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, role, zone_id, collector_id, contact_phone, created_at`,
    [name, email, password_hash, role, zone_id ?? null, contact_phone ?? null, collector_id ?? null]
  );
  return rows[0];
}

/**
 * Sets a resident's zone. Also clears collector_id — a chosen collector approved
 * for the OLD zone may not be approved for the new one, so we force a fresh choice
 * (invariant safety, rule #4). Same-transaction single UPDATE keeps it atomic.
 */
export async function setZone(userId, zoneId) {
  const { rows } = await query(
    `UPDATE users SET zone_id = $1, collector_id = NULL WHERE id = $2
     RETURNING id, name, email, role, zone_id, collector_id, contact_phone, created_at`,
    [zoneId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Updates the user's own profile. Only the columns present as keys in `updates`
 * are written, so an omitted field is left untouched while an explicit `null`
 * (e.g. clearing collector_id on a zone change) is honoured. name/email are
 * always supplied by the controller. Validation of collector_id/zone_id happens
 * in the controller before this is called.
 */
export async function updateProfile(id, updates) {
  const cols = [];
  const vals = [];
  let i = 1;
  for (const key of ['name', 'email', 'contact_phone', 'zone_id', 'collector_id']) {
    if (key in updates) { cols.push(`${key} = $${i++}`); vals.push(updates[key]); }
  }
  if (cols.length === 0) return findById(id);
  vals.push(id);
  const { rows } = await query(
    `UPDATE users SET ${cols.join(', ')} WHERE id = $${i}
     RETURNING id, name, email, role, zone_id, collector_id, contact_phone, created_at`,
    vals
  );
  return rows[0] ?? null;
}

/**
 * Residents who have CHOSEN this collector (users.collector_id = collectorId).
 * More privacy-scoped than the old zone-default derivation: a collector sees only
 * their own customers. Explicit projection — never exposes email/password/role.
 * Ordered by zone name then resident name for a stable, grouped UI.
 */
export async function findResidentsForCollector(collectorId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.zone_id, z.name AS zone_name
     FROM users u
     JOIN zones z ON z.id = u.zone_id
     WHERE u.role = 'resident'
       AND u.collector_id = $1
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
