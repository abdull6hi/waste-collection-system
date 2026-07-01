import { query, withTransaction } from '../config/db.js';

export async function findAll({ status, zoneId, category, from, to, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (zoneId) {
    params.push(zoneId);
    conditions.push(`c.zone_id = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`c.category = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`c.created_at >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    conditions.push(`c.created_at < ($${params.length}::date + interval '1 day')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT c.*, u.name AS resident_name, z.name AS zone_name,
            col.company_name AS collector_company
     FROM complaints c
     JOIN users u ON u.id = c.resident_id
     JOIN zones z ON z.id = c.zone_id
     LEFT JOIN collectors col ON col.id = c.assigned_collector_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT c.*, u.name AS resident_name, z.name AS zone_name,
            col.company_name AS collector_company
     FROM complaints c
     JOIN users u ON u.id = c.resident_id
     JOIN zones z ON z.id = c.zone_id
     LEFT JOIN collectors col ON col.id = c.assigned_collector_id
     WHERE c.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findByResident(residentId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT c.*, z.name AS zone_name
     FROM complaints c
     JOIN zones z ON z.id = c.zone_id
     WHERE c.resident_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [residentId, limit, offset]
  );
  return rows;
}

export async function findByCollector(collectorId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT c.*, u.name AS resident_name, z.name AS zone_name
     FROM complaints c
     JOIN users u ON u.id = c.resident_id
     JOIN zones z ON z.id = c.zone_id
     WHERE c.assigned_collector_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [collectorId, limit, offset]
  );
  return rows;
}

export async function create({ residentId, zoneId, category, description, assignedCollectorId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO complaints (resident_id, zone_id, category, description, assigned_collector_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [residentId, zoneId, category, description, assignedCollectorId ?? null]
    );
    const id = rows[0].id;
    const year = new Date().getFullYear();
    const refNo = `CMP-${year}-${String(id).padStart(5, '0')}`;
    const { rows: final } = await client.query(
      `UPDATE complaints SET reference_no = $1 WHERE id = $2 RETURNING *`,
      [refNo, id]
    );
    return final[0];
  });
}

export async function updateStatus(id, { status, resolutionNotes, resolvedAt }) {
  const { rows } = await query(
    `UPDATE complaints
     SET status           = $1,
         resolution_notes = COALESCE($2, resolution_notes),
         resolved_at      = COALESCE($3, resolved_at)
     WHERE id = $4
     RETURNING *`,
    [status, resolutionNotes ?? null, resolvedAt ?? null, id]
  );
  return rows[0] ?? null;
}

export async function countOpenByZone() {
  const { rows } = await query(
    `SELECT z.id AS zone_id, z.name AS zone_name, COUNT(c.id)::int AS open_count
     FROM zones z
     LEFT JOIN complaints c ON c.zone_id = z.id AND c.status = 'open'
     GROUP BY z.id, z.name
     ORDER BY open_count DESC`,
    []
  );
  return rows;
}

export async function resolutionStats({ from, to }) {
  const overallRow = (await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved,
       COUNT(*) FILTER (WHERE resolved_at IS     NULL)::int AS open,
       ROUND(
         AVG(CASE WHEN resolved_at IS NOT NULL
                  THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
             END)::numeric, 1
       ) AS avg_resolution_hours
     FROM complaints
     WHERE created_at >= $1::date
       AND created_at <  ($2::date + interval '1 day')`,
    [from, to]
  )).rows[0];

  const overall = {
    total:               overallRow.total,
    resolved:            overallRow.resolved,
    open:                overallRow.open,
    avg_resolution_hours: overallRow.avg_resolution_hours !== null
      ? Number(overallRow.avg_resolution_hours) : null,
  };

  const byZone = (await query(
    `SELECT z.id AS zone_id, z.name AS zone_name,
            COUNT(c.id)::int                                          AS total,
            COUNT(c.id) FILTER (WHERE c.resolved_at IS NOT NULL)::int AS resolved,
            COUNT(c.id) FILTER (WHERE c.resolved_at IS     NULL)::int AS open,
            ROUND(
              AVG(CASE WHEN c.resolved_at IS NOT NULL
                       THEN EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600
                  END)::numeric, 1
            ) AS avg_resolution_hours
     FROM zones z
     LEFT JOIN complaints c
       ON c.zone_id = z.id
      AND c.created_at >= $1::date
      AND c.created_at <  ($2::date + interval '1 day')
     GROUP BY z.id, z.name
     ORDER BY z.name`,
    [from, to]
  )).rows.map(r => ({
    zone_id:              r.zone_id,
    zone_name:            r.zone_name,
    total:                r.total,
    resolved:             r.resolved,
    open:                 r.open,
    avg_resolution_hours: r.avg_resolution_hours !== null ? Number(r.avg_resolution_hours) : null,
  }));

  const byCategory = (await query(
    `SELECT category,
            COUNT(*)::int                                          AS total,
            COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int  AS resolved,
            COUNT(*) FILTER (WHERE resolved_at IS     NULL)::int  AS open,
            ROUND(
              AVG(CASE WHEN resolved_at IS NOT NULL
                       THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
                  END)::numeric, 1
            ) AS avg_resolution_hours
     FROM complaints
     WHERE created_at >= $1::date
       AND created_at <  ($2::date + interval '1 day')
     GROUP BY category
     ORDER BY category`,
    [from, to]
  )).rows.map(r => ({
    category:             r.category,
    total:                r.total,
    resolved:             r.resolved,
    open:                 r.open,
    avg_resolution_hours: r.avg_resolution_hours !== null ? Number(r.avg_resolution_hours) : null,
  }));

  return { overall, byZone, byCategory };
}
