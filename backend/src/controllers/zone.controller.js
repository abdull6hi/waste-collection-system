// Manages collection zones and their collector assignments.
import * as ZoneModel      from '../models/zone.model.js';
import * as CollectorModel from '../models/collector.model.js';

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

  if (collector_id !== null && collector_id !== undefined) {
    const collector = await CollectorModel.findById(Number(collector_id));
    if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });
    if (!collector.active) return res.status(400).json({ error: { message: 'Collector is not active' } });
  }

  const zone = await ZoneModel.assignCollector(zoneId, collector_id ?? null);
  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });
  res.json({ zone });
}
