// Approved collectors per zone (join table) + the validator that enforces
// THE INVARIANT: a resident's collector_id must be approved for their zone AND active.
import { query, withTransaction } from '../config/db.js';

/**
 * Full approved-collector list for a zone (officials only). Includes active flag
 * and whether each is the zone's current default, for the management UI.
 */
export async function listApproved(zoneId) {
  const { rows } = await query(
    `SELECT c.id, c.company_name, c.active, c.license_no,
            (z.assigned_collector_id = c.id) AS is_default
     FROM zone_collectors zc
     JOIN collectors c ON c.id = zc.collector_id
     JOIN zones z      ON z.id = zc.zone_id
     WHERE zc.zone_id = $1
     ORDER BY c.company_name`,
    [zoneId]
  );
  return rows;
}

/**
 * Public projection — id + company_name ONLY. Safe to expose unauthenticated for
 * the registration/profile collector picker. Never leaks license/phone/email.
 * Only ACTIVE collectors are offered, since an inactive one can't be chosen.
 */
export async function listApprovedPublic(zoneId) {
  const { rows } = await query(
    `SELECT c.id, c.company_name
     FROM zone_collectors zc
     JOIN collectors c ON c.id = zc.collector_id
     WHERE zc.zone_id = $1 AND c.active = true
     ORDER BY c.company_name`,
    [zoneId]
  );
  return rows;
}

/** Approve a collector for a zone (idempotent). Returns true if the pair now exists. */
export async function approve(zoneId, collectorId) {
  await query(
    `INSERT INTO zone_collectors (zone_id, collector_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [zoneId, collectorId]
  );
  return true;
}

/**
 * Chooses a collector to AUTO-ASSIGN a new resident in this zone: the zone's
 * default when it is approved+active, otherwise the first approved+active
 * collector (lowest id), otherwise null when the zone has no eligible collector.
 * Result always satisfies the invariant (approved for the zone AND active).
 */
export async function pickForZone(zoneId) {
  const { rows } = await query(
    `SELECT c.id
     FROM zone_collectors zc
     JOIN collectors c ON c.id = zc.collector_id
     JOIN zones z      ON z.id = zc.zone_id
     WHERE zc.zone_id = $1 AND c.active = true
     ORDER BY (z.assigned_collector_id = c.id) DESC, c.id
     LIMIT 1`,
    [zoneId]
  );
  return rows[0]?.id ?? null;
}

/**
 * THE VALIDATOR. True iff `collectorId` is approved for `zoneId` AND the collector
 * is active. Every path that sets users.collector_id must gate on this.
 */
export async function isApprovedActive(zoneId, collectorId) {
  const { rows } = await query(
    `SELECT 1
     FROM zone_collectors zc
     JOIN collectors c ON c.id = zc.collector_id
     WHERE zc.zone_id = $1 AND zc.collector_id = $2 AND c.active = true
     LIMIT 1`,
    [zoneId, collectorId]
  );
  return rows.length > 0;
}

/** Is this collector currently the zone's default (assigned_collector_id)? */
export async function isDefault(zoneId, collectorId) {
  const { rows } = await query(
    'SELECT 1 FROM zones WHERE id = $1 AND assigned_collector_id = $2 LIMIT 1',
    [zoneId, collectorId]
  );
  return rows.length > 0;
}

/**
 * Remove a collector from a zone's approved list, in ONE transaction:
 *  - null out users.collector_id for residents in that zone who had chosen them
 *    (referential integrity — no resident left pointing at a non-approved collector),
 *  - then delete the approval row.
 * Refuses to remove the zone's current default (caller must reassign the default
 * first), so the "default is always approved" invariant can't be broken here.
 *
 * @returns {{ removed: boolean, reason?: string, clearedResidents?: number }}
 */
export async function remove(zoneId, collectorId) {
  return withTransaction(async (client) => {
    const def = await client.query(
      'SELECT 1 FROM zones WHERE id = $1 AND assigned_collector_id = $2 LIMIT 1',
      [zoneId, collectorId]
    );
    if (def.rows.length > 0) {
      return { removed: false, reason: 'is_default' };
    }

    const cleared = await client.query(
      `UPDATE users
       SET collector_id = NULL
       WHERE role = 'resident' AND zone_id = $1 AND collector_id = $2`,
      [zoneId, collectorId]
    );

    const del = await client.query(
      'DELETE FROM zone_collectors WHERE zone_id = $1 AND collector_id = $2',
      [zoneId, collectorId]
    );

    return {
      removed: del.rowCount > 0,
      clearedResidents: cleared.rowCount,
    };
  });
}
