import { query } from '../config/db.js';

export async function findAll({ zoneId, collectorId } = {}) {
  const conditions = [];
  const params = [];

  if (zoneId)      { params.push(zoneId);      conditions.push(`s.zone_id = $${params.length}`); }
  if (collectorId) { params.push(collectorId); conditions.push(`s.collector_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT s.*, z.name AS zone_name, c.company_name AS collector_name
     FROM schedules s
     JOIN zones z      ON z.id = s.zone_id
     JOIN collectors c ON c.id = s.collector_id
     ${where}
     ORDER BY s.id`,
    params
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT s.*, z.name AS zone_name, c.company_name AS collector_name
     FROM schedules s
     JOIN zones z      ON z.id = s.zone_id
     JOIN collectors c ON c.id = s.collector_id
     WHERE s.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findByZone(zoneId) {
  const { rows } = await query(
    `SELECT s.*, c.company_name AS collector_name
     FROM schedules s
     JOIN collectors c ON c.id = s.collector_id
     WHERE s.zone_id = $1
     ORDER BY s.day_of_week, s.start_time`,
    [zoneId]
  );
  return rows;
}

export async function findByCollector(collectorId) {
  const { rows } = await query(
    `SELECT s.*, z.name AS zone_name
     FROM schedules s
     JOIN zones z ON z.id = s.zone_id
     WHERE s.collector_id = $1
     ORDER BY s.day_of_week, s.start_time`,
    [collectorId]
  );
  return rows;
}

export async function create({ zone_id, collector_id, day_of_week, start_time, frequency }) {
  const { rows } = await query(
    `INSERT INTO schedules (zone_id, collector_id, day_of_week, start_time, frequency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [zone_id, collector_id, day_of_week, start_time, frequency ?? 'weekly']
  );
  return rows[0];
}

export async function update(id, { zone_id, collector_id, day_of_week, start_time, frequency }) {
  const { rows } = await query(
    `UPDATE schedules
     SET zone_id      = COALESCE($1, zone_id),
         collector_id = COALESCE($2, collector_id),
         day_of_week  = COALESCE($3, day_of_week),
         start_time   = COALESCE($4, start_time),
         frequency    = COALESCE($5, frequency)
     WHERE id = $6
     RETURNING *`,
    [zone_id ?? null, collector_id ?? null, day_of_week ?? null, start_time ?? null, frequency ?? null, id]
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  const { rowCount } = await query('DELETE FROM schedules WHERE id = $1', [id]);
  return rowCount > 0;
}
