// Manages collection zones and their collector assignments.
import * as ZoneModel          from '../models/zone.model.js';
import * as CollectorModel     from '../models/collector.model.js';
import * as ZoneCollectorModel from '../models/zoneCollector.model.js';
import { withTransaction }     from '../config/db.js';

export async function list(req, res) {
  const zones = await ZoneModel.findAll();
  res.json({ zones });
}

/** Unauthenticated: id + name only, for the public registration dropdown. */
export async function listPublic(req, res) {
  const zones = await ZoneModel.findAllPublic();
  res.json({ zones });
}

export async function getOne(req, res) {
  const zone = await ZoneModel.findById(Number(req.params.id));
  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });
  res.json({ zone });
}

export async function create(req, res) {
  const { name, description, boundary_geojson } = req.body;
  const zone = await ZoneModel.create({ name, description, boundary_geojson });
  res.status(201).json({ zone });
}

export async function update(req, res) {
  const { name, description, boundary_geojson } = req.body;
  const zone = await ZoneModel.update(Number(req.params.id), { name, description, boundary_geojson });
  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });
  res.json({ zone });
}

export async function remove(req, res) {
  const deleted = await ZoneModel.remove(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: { message: 'Zone not found' } });
  res.status(204).send();
}

export async function assignCollector(req, res) {
  const { collector_id } = req.body;
  const zoneId = Number(req.params.id);
  const cid = (collector_id === null || collector_id === undefined) ? null : Number(collector_id);

  if (cid !== null) {
    const collector = await CollectorModel.findById(cid);
    if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });
    if (!collector.active) return res.status(400).json({ error: { message: 'Collector is not active' } });
  }

  // Set the default AND ensure it is an approved pair, atomically — upholds the
  // invariant "the default is always also in zone_collectors".
  const zone = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'UPDATE zones SET assigned_collector_id = $1 WHERE id = $2 RETURNING *',
      [cid, zoneId]
    );
    if (!rows[0]) return null;
    if (cid !== null) {
      await client.query(
        'INSERT INTO zone_collectors (zone_id, collector_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [zoneId, cid]
      );
    }
    return rows[0];
  });

  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });
  res.json({ zone });
}

/* ── Approved collectors per zone (officials manage; residents pick from public) ── */

/** Official-only: full approved list for a zone (includes active + default flags). */
export async function listCollectors(req, res) {
  const zoneId = Number(req.params.id);
  const zone = await ZoneModel.findById(zoneId);
  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });
  const collectors = await ZoneCollectorModel.listApproved(zoneId);
  res.json({ collectors });
}

/** Unauthenticated: id + company_name ONLY, for the registration/profile picker. */
export async function listCollectorsPublic(req, res) {
  const zoneId = Number(req.params.id);
  const collectors = await ZoneCollectorModel.listApprovedPublic(zoneId);
  res.json({ collectors });
}

/** Official-only: approve a collector for a zone. */
export async function approveCollector(req, res) {
  const zoneId = Number(req.params.id);
  const collectorId = Number(req.body.collector_id);

  const zone = await ZoneModel.findById(zoneId);
  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });

  const collector = await CollectorModel.findById(collectorId);
  if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });

  await ZoneCollectorModel.approve(zoneId, collectorId);
  const collectors = await ZoneCollectorModel.listApproved(zoneId);
  res.status(201).json({ collectors });
}

/** Official-only: remove a collector from a zone's approved list (transaction, rule #5). */
export async function removeCollector(req, res) {
  const zoneId = Number(req.params.id);
  const collectorId = Number(req.params.collectorId);

  const result = await ZoneCollectorModel.remove(zoneId, collectorId);
  if (result.reason === 'is_default') {
    return res.status(409).json({
      error: { message: 'This collector is the zone default. Set a different default before removing.' },
    });
  }
  if (!result.removed) {
    return res.status(404).json({ error: { message: 'Collector is not approved for this zone' } });
  }
  res.json({ ok: true, clearedResidents: result.clearedResidents });
}
