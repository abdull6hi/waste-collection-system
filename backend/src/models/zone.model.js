import { query } from '../config/db.js';

export async function findAll() {
  const { rows } = await query(
    `SELECT z.*, c.company_name AS collector_name
     FROM zones z
     LEFT JOIN collectors c ON c.id = z.assigned_collector_id
     ORDER BY z.id`,
    []
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT z.*, c.company_name AS collector_name
     FROM zones z
     LEFT JOIN collectors c ON c.id = z.assigned_collector_id
     WHERE z.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function create({ name, description, boundary_geojson }) {
  const { rows } = await query(
    `INSERT INTO zones (name, description, boundary_geojson)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description ?? null, boundary_geojson ? JSON.stringify(boundary_geojson) : null]
  );
  return rows[0];
}

export async function update(id, { name, description, boundary_geojson }) {
  const { rows } = await query(
    `UPDATE zones
     SET name             = COALESCE($1, name),
         description      = COALESCE($2, description),
         boundary_geojson = COALESCE($3, boundary_geojson)
     WHERE id = $4
     RETURNING *`,
    [name ?? null, description ?? null,
     boundary_geojson ? JSON.stringify(boundary_geojson) : null, id]
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  const { rowCount } = await query('DELETE FROM zones WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function assignCollector(zoneId, collectorId) {
  const { rows } = await query(
    `UPDATE zones SET assigned_collector_id = $1 WHERE id = $2 RETURNING *`,
    [collectorId, zoneId]
  );
  return rows[0] ?? null;
}
