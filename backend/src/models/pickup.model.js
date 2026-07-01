import { query } from '../config/db.js';

export async function create({ schedule_id, zone_id, collector_id, scheduled_date }) {
  const { rows } = await query(
    `INSERT INTO pickups (schedule_id, zone_id, collector_id, scheduled_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (schedule_id, scheduled_date) WHERE schedule_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [schedule_id ?? null, zone_id, collector_id, scheduled_date ?? null]
  );
  return rows[0] ?? null;
}

export async function findAll({ zoneId, collectorId, status, from, to, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (zoneId)      { params.push(zoneId);      conditions.push(`p.zone_id = $${params.length}`); }
  if (collectorId) { params.push(collectorId); conditions.push(`p.collector_id = $${params.length}`); }
  if (status)      { params.push(status);      conditions.push(`p.status = $${params.length}`); }
  if (from)        { params.push(from);        conditions.push(`p.scheduled_date >= $${params.length}`); }
  if (to)          { params.push(to);          conditions.push(`p.scheduled_date <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT p.*, z.name AS zone_name, c.company_name AS collector_name
     FROM pickups p
     JOIN zones z      ON z.id = p.zone_id
     JOIN collectors c ON c.id = p.collector_id
     ${where}
     ORDER BY p.scheduled_date DESC NULLS LAST, p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

export async function findByCollector(collectorId, { status, limit = 100 } = {}) {
  const params = [collectorId];
  const conditions = ['p.collector_id = $1'];

  if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
  params.push(limit);

  const { rows } = await query(
    `SELECT p.*, z.name AS zone_name
     FROM pickups p
     JOIN zones z ON z.id = p.zone_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.scheduled_date ASC NULLS LAST, p.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function findByZone(zoneId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT p.*, c.company_name AS collector_name
     FROM pickups p
     JOIN collectors c ON c.id = p.collector_id
     WHERE p.zone_id = $1
     ORDER BY p.scheduled_date DESC NULLS LAST, p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [zoneId, limit, offset]
  );
  return rows;
}

export async function findBySchedule(scheduleId) {
  const { rows } = await query(
    `SELECT * FROM pickups WHERE schedule_id = $1 ORDER BY scheduled_date DESC`,
    [scheduleId]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT p.*, z.name AS zone_name, c.company_name AS collector_name
     FROM pickups p
     JOIN zones z      ON z.id = p.zone_id
     JOIN collectors c ON c.id = p.collector_id
     WHERE p.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateStatus(id, { status, notes, completedAt }) {
  const { rows } = await query(
    `UPDATE pickups
     SET status       = $1,
         completed_at = $2,
         notes        = COALESCE($3, notes)
     WHERE id = $4
     RETURNING *`,
    [status, completedAt ?? null, notes ?? null, id]
  );
  return rows[0] ?? null;
}

export async function completionStats({ from, to }) {
  const byCollector = (await query(
    `SELECT c.id AS collector_id, c.company_name,
            COUNT(*) FILTER (WHERE p.status = 'completed') AS completed,
            COUNT(*) AS total
     FROM pickups p
     JOIN collectors c ON c.id = p.collector_id
     WHERE p.scheduled_date BETWEEN $1 AND $2
       AND p.scheduled_date <= CURRENT_DATE
     GROUP BY c.id, c.company_name
     ORDER BY c.company_name`,
    [from, to]
  )).rows;

  const byZone = (await query(
    `SELECT z.id AS zone_id, z.name AS zone_name,
            COUNT(*) FILTER (WHERE p.status = 'completed') AS completed,
            COUNT(*) AS total
     FROM pickups p
     JOIN zones z ON z.id = p.zone_id
     WHERE p.scheduled_date BETWEEN $1 AND $2
       AND p.scheduled_date <= CURRENT_DATE
     GROUP BY z.id, z.name
     ORDER BY z.name`,
    [from, to]
  )).rows;

  const overall = {
    completed: byCollector.reduce((s, r) => s + Number(r.completed), 0),
    total:     byCollector.reduce((s, r) => s + Number(r.total), 0),
  };

  return { overall, byCollector, byZone };
}
