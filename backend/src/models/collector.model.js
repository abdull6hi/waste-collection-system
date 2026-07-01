import { query } from '../config/db.js';

/** Full record including sensitive fields — for officials only. */
export async function findAll() {
  const { rows } = await query(
    `SELECT c.*, u.name AS user_name, u.email AS user_email
     FROM collectors c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.id`,
    []
  );
  return rows;
}

/** Full record including sensitive fields — for officials only. */
export async function findById(id) {
  const { rows } = await query(
    `SELECT c.*, u.name AS user_name, u.email AS user_email
     FROM collectors c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Public projection — omits license_no and contact_phone so residents and
 * collectors cannot enumerate PII via GET /api/collectors.
 */
export async function findAllPublic() {
  const { rows } = await query(
    `SELECT c.id, c.active, c.user_id, u.name AS user_name
     FROM collectors c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.id`,
    []
  );
  return rows;
}

/** Public projection for a single collector (no PII). */
export async function findByIdPublic(id) {
  const { rows } = await query(
    `SELECT c.id, c.active, c.user_id, u.name AS user_name
     FROM collectors c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findByUserId(userId) {
  const { rows } = await query(
    'SELECT * FROM collectors WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return rows[0] ?? null;
}

export async function create({ user_id, company_name, license_no, contact_phone }) {
  const { rows } = await query(
    `INSERT INTO collectors (user_id, company_name, license_no, contact_phone)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [user_id, company_name, license_no, contact_phone ?? null]
  );
  return rows[0];
}

/** Updates ONLY contact_phone for the collector identified by user_id (self-service). */
export async function updateOwnContact(userId, contactPhone) {
  const { rows } = await query(
    `UPDATE collectors SET contact_phone = $1 WHERE user_id = $2 RETURNING *`,
    [contactPhone, userId]
  );
  return rows[0] ?? null;
}

/** Returns the collector record for the given user_id (collector's own profile). */
export async function findMine(userId) {
  const { rows } = await query(
    `SELECT c.*, u.name AS user_name, u.email AS user_email
     FROM collectors c
     JOIN users u ON u.id = c.user_id
     WHERE c.user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function update(id, { company_name, license_no, license_expiry, contact_phone, active }) {
  const { rows } = await query(
    `UPDATE collectors
     SET company_name   = COALESCE($1, company_name),
         license_no     = COALESCE($2, license_no),
         license_expiry = COALESCE($3, license_expiry),
         contact_phone  = COALESCE($4, contact_phone),
         active         = COALESCE($5, active)
     WHERE id = $6
     RETURNING *`,
    [company_name ?? null, license_no ?? null, license_expiry || null, contact_phone ?? null, active ?? null, id]
  );
  return rows[0] ?? null;
}
