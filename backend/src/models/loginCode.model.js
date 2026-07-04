// Data access for one-time email login codes (2FA). Codes are stored as sha256
// hashes; the plaintext code exists only in the email and the user's submission.
import crypto from 'crypto';
import { query } from '../config/db.js';

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/** Marks any still-active code for this user as consumed (superseded). */
export async function invalidateActive(userId) {
  await query(
    `UPDATE login_codes SET consumed_at = NOW()
     WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId]
  );
}

/** Supersedes previous codes, then stores a fresh one. */
export async function create(userId, code, ttlMinutes = 10) {
  await invalidateActive(userId);
  const { rows } = await query(
    `INSERT INTO login_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)
     RETURNING id, expires_at`,
    [userId, hashCode(code), String(ttlMinutes)]
  );
  return rows[0];
}

/** The current unconsumed, unexpired code for a user, if any. */
export async function findActive(userId) {
  const { rows } = await query(
    `SELECT * FROM login_codes
     WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function incrementAttempts(id) {
  const { rows } = await query(
    `UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
    [id]
  );
  return rows[0]?.attempts ?? 0;
}

export async function consume(id) {
  await query(`UPDATE login_codes SET consumed_at = NOW() WHERE id = $1`, [id]);
}
