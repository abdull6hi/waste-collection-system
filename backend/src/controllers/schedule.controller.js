// Manages recurring collection schedules (zone + collector + day/time/frequency).
import * as ScheduleModel  from '../models/schedule.model.js';
import * as CollectorModel from '../models/collector.model.js';

export async function list(req, res) {
  const { zoneId, collectorId } = req.query;
  const schedules = await ScheduleModel.findAll({
    zoneId:      zoneId      ? Number(zoneId)      : undefined,
    collectorId: collectorId ? Number(collectorId) : undefined,
  });
  res.json({ schedules });
}

export async function getOne(req, res) {
  const schedule = await ScheduleModel.findById(Number(req.params.id));
  if (!schedule) return res.status(404).json({ error: { message: 'Schedule not found' } });
  res.json({ schedule });
}

export async function create(req, res) {
  const { zone_id, collector_id, day_of_week, start_time, frequency } = req.body;
  const schedule = await ScheduleModel.create({ zone_id, collector_id, day_of_week, start_time, frequency });
  res.status(201).json({ schedule });
}

export async function update(req, res) {
  const { zone_id, collector_id, day_of_week, start_time, frequency } = req.body;
  const schedule = await ScheduleModel.update(Number(req.params.id), {
    zone_id, collector_id, day_of_week, start_time, frequency,
  });
  if (!schedule) return res.status(404).json({ error: { message: 'Schedule not found' } });
  res.json({ schedule });
}

export async function remove(req, res) {
  const deleted = await ScheduleModel.remove(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: { message: 'Schedule not found' } });
  res.status(204).send();
}

export async function getMine(req, res) {
  const collector = await CollectorModel.findByUserId(req.user.id);
  if (!collector) return res.status(404).json({ error: { message: 'No collector profile found' } });
  const schedules = await ScheduleModel.findByCollector(collector.id);
  res.json({ schedules });
}

export async function getByZone(req, res) {
  const schedules = await ScheduleModel.findByZone(Number(req.params.zoneId));
  res.json({ schedules });
}
