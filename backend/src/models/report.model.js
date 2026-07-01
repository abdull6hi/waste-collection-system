import { query } from '../config/db.js';

export async function findAll({ limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT r.*, u.name AS generated_by_name
     FROM reports r
     JOIN users u ON u.id = r.generated_by
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT r.*, u.name AS generated_by_name
     FROM reports r
     JOIN users u ON u.id = r.generated_by
     WHERE r.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function create({ generatedBy, periodStart, periodEnd, summaryJson }) {
  const { rows } = await query(
    `INSERT INTO reports (generated_by, period_start, period_end, summary_json)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [generatedBy, periodStart, periodEnd, JSON.stringify(summaryJson ?? {})]
  );
  return rows[0];
}
