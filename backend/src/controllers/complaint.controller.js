// Handles citizen complaint submission, routing, and status updates.
import * as ComplaintModel from '../models/complaint.model.js';
import * as CollectorModel from '../models/collector.model.js';
import * as ZoneModel      from '../models/zone.model.js';
import * as Notifications  from '../services/notifications.js';
import { assertOwnsComplaint } from '../middleware/ownership.js';

export async function submit(req, res) {
  const { zone_id, category, description } = req.body;

  const zone = await ZoneModel.findById(Number(zone_id));
  if (!zone) return res.status(404).json({ error: { message: 'Zone not found' } });

  const complaint = await ComplaintModel.create({
    residentId:          req.user.id,
    zoneId:              Number(zone_id),
    category,
    description,
    assignedCollectorId: zone.assigned_collector_id ?? null,
  });

  // Notify the resident, the assigned collector, and officials (fire-and-forget).
  Notifications.complaintSubmitted(complaint);

  res.status(201).json({ complaint });
}

export async function listMine(req, res) {
  const complaints = await ComplaintModel.findByResident(req.user.id);
  res.json({ complaints });
}

export async function listAssigned(req, res) {
  const collector = await CollectorModel.findByUserId(req.user.id);
  if (!collector) return res.status(404).json({ error: { message: 'No collector profile found' } });
  const complaints = await ComplaintModel.findByCollector(collector.id);
  res.json({ complaints });
}

export async function list(req, res) {
  const { status, zoneId, category, from, to } = req.query;
  const complaints = await ComplaintModel.findAll({
    status,
    zoneId:   zoneId ? Number(zoneId) : undefined,
    category,
    from,
    to,
  });
  res.json({ complaints });
}

export async function getOne(req, res) {
  const complaint = await ComplaintModel.findById(Number(req.params.id));
  if (!complaint) return res.status(404).json({ error: { message: 'Complaint not found' } });

  const { role, id: userId } = req.user;
  // Resolve the collector profile once if needed; assertOwnsComplaint throws on violation
  const collector = (role === 'collector')
    ? await CollectorModel.findByUserId(userId)
    : null;
  assertOwnsComplaint(complaint, req.user, collector);

  res.json({ complaint });
}

export async function updateStatus(req, res) {
  const { status, resolution_notes } = req.body;
  const complaintId = Number(req.params.id);
  const { role, id: userId } = req.user;

  const complaint = await ComplaintModel.findById(complaintId);
  if (!complaint) return res.status(404).json({ error: { message: 'Complaint not found' } });

  const collector = (role === 'collector')
    ? await CollectorModel.findByUserId(userId)
    : null;

  if (role === 'collector') {
    // assertOwnsComplaint throws OwnershipError (→ 403) if not assigned
    assertOwnsComplaint(complaint, req.user, collector);
    if (!['in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: { message: 'Collectors may only set status to in_progress or resolved' } });
    }
  }

  if (status === 'resolved' && !resolution_notes?.trim()) {
    return res.status(400).json({ error: { message: 'resolution_notes is required when resolving a complaint' } });
  }

  const resolvedAt = status === 'resolved' ? new Date() : null;
  const updated = await ComplaintModel.updateStatus(complaintId, {
    status,
    resolutionNotes: resolution_notes ?? null,
    resolvedAt,
  });

  // Notify the resident who filed it that their complaint changed status.
  Notifications.complaintStatusChanged(updated);

  res.json({ complaint: updated });
}

export async function openByZone(req, res) {
  const data = await ComplaintModel.countOpenByZone();
  res.json({ zones: data });
}
