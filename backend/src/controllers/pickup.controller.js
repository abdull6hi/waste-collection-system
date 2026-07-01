// Generates and tracks individual pickup instances from schedules.
import { query }          from '../config/db.js';
import * as PickupModel    from '../models/pickup.model.js';
import * as CollectorModel from '../models/collector.model.js';
import { currentWeekRange, iterateDates, weeksBetween } from '../utils/dates.js';
import { assertOwnsPickup } from '../middleware/ownership.js';

export async function generate(req, res) {
  const defaults = currentWeekRange();
  const fromStr  = req.body.from || defaults.from;
  const toStr    = req.body.to   || defaults.to;

  const { rows: schedules } = await query(
    `SELECT s.* FROM schedules s
     JOIN collectors c ON c.id = s.collector_id
     WHERE c.active = true`,
    []
  );

  const dates = iterateDates(fromStr, toStr);
  let created = 0;

  for (const sched of schedules) {
    // For biweekly schedules, use the schedule's creation date as the parity
    // anchor: even week-index = active, odd = skip. This means every other
    // week relative to when the schedule was created.
    const anchor = sched.created_at ? new Date(sched.created_at) : new Date(fromStr + 'T00:00:00Z');

    for (const { str, dow } of dates) {
      let shouldCreate;
      if (sched.frequency === 'daily') {
        shouldCreate = true;
      } else if (sched.frequency === 'weekly') {
        shouldCreate = dow === sched.day_of_week;
      } else if (sched.frequency === 'biweekly') {
        // Only create on the right day AND in an "active" week (even week-index
        // from the anchor Monday, so pickups land every other week).
        shouldCreate = dow === sched.day_of_week &&
          weeksBetween(anchor, new Date(str + 'T00:00:00Z')) % 2 === 0;
      } else {
        shouldCreate = false;
      }

      if (!shouldCreate) continue;

      const row = await PickupModel.create({
        schedule_id:    sched.id,
        zone_id:        sched.zone_id,
        collector_id:   sched.collector_id,
        scheduled_date: str,
      });
      if (row) created++;
    }
  }

  res.json({ created, from: fromStr, to: toStr });
}

export async function list(req, res) {
  const { zoneId, collectorId, status, from, to } = req.query;
  const pickups = await PickupModel.findAll({
    zoneId:      zoneId      ? Number(zoneId)      : undefined,
    collectorId: collectorId ? Number(collectorId) : undefined,
    status,
    from,
    to,
  });
  res.json({ pickups });
}

export async function listMine(req, res) {
  const collector = await CollectorModel.findByUserId(req.user.id);
  if (!collector) return res.status(404).json({ error: { message: 'No collector profile found' } });

  const [outstanding, recent, missed] = await Promise.all([
    PickupModel.findByCollector(collector.id, { status: 'pending',   limit: 50 }),
    PickupModel.findByCollector(collector.id, { status: 'completed', limit: 20 }),
    PickupModel.findByCollector(collector.id, { status: 'missed',    limit: 20 }),
  ]);

  const history = [...recent, ...missed].sort((a, b) =>
    new Date(b.scheduled_date || b.created_at) - new Date(a.scheduled_date || a.created_at)
  ).slice(0, 20);

  res.json({ outstanding, history });
}

export async function updateStatus(req, res) {
  const { status, notes } = req.body;
  const pickupId = Number(req.params.id);

  const collector = await CollectorModel.findByUserId(req.user.id);
  if (!collector) return res.status(403).json({ error: { message: 'No collector profile found' } });

  const pickup = await PickupModel.findById(pickupId);
  if (!pickup) return res.status(404).json({ error: { message: 'Pickup not found' } });

  // assertOwnsPickup throws OwnershipError (→ 403 via error middleware) if not assigned
  assertOwnsPickup(pickup, collector);

  const completedAt = status === 'completed' ? new Date() : null;
  const updated = await PickupModel.updateStatus(pickupId, { status, notes, completedAt });
  res.json({ pickup: updated });
}

export async function stats(req, res) {
  const defaults = currentWeekRange();
  const from = req.query.from || defaults.from;
  const to   = req.query.to   || defaults.to;
  const data = await PickupModel.completionStats({ from, to });
  res.json({ ...data, from, to });
}
