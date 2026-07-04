// Handles resident-specific, self-service, and admin user actions.
import bcrypt from 'bcrypt';
import * as UserModel from '../models/user.model.js';
import * as CollectorModel from '../models/collector.model.js';
import * as ZoneModel from '../models/zone.model.js';
import * as ZoneCollectorModel from '../models/zoneCollector.model.js';

export async function setMyZone(req, res) {
  const { zone_id } = req.body;
  const user = await UserModel.setZone(req.user.id, zone_id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({ user });
}

export async function updateMyProfile(req, res) {
  const { name, email, contact_phone, zone_id, collector_id } = req.body;
  const isResident = req.user.role === 'resident';

  // Fetch current state (residents) to detect zone changes and to know the
  // effective zone against which a collector choice must be validated.
  const current = isResident ? await UserModel.findById(req.user.id) : null;

  const zoneProvided = zone_id !== undefined && zone_id !== null && zone_id !== '';
  let effectiveZoneId = current?.zone_id ?? null;
  if (zoneProvided) {
    const zone = await ZoneModel.findById(Number(zone_id));
    if (!zone) return res.status(400).json({ error: { message: 'Selected zone does not exist' } });
    effectiveZoneId = Number(zone_id);
  }

  // Residents persist contact_phone + zone_id + collector_id on their own users
  // row. Collectors keep contact_phone on the collectors table (handled below).
  const updates = { name, email };
  if (isResident) {
    if (contact_phone !== undefined) updates.contact_phone = contact_phone ?? null;
    if (zoneProvided) updates.zone_id = effectiveZoneId;

    const zoneChanged = zoneProvided && Number(zone_id) !== (current?.zone_id ?? null);

    if (collector_id !== undefined) {
      if (collector_id === null || collector_id === '') {
        updates.collector_id = null;           // explicit clear
      } else {
        // THE INVARIANT — chosen collector must be approved+active for the
        // effective (possibly newly-selected) zone. Never trust the client value.
        const cid = Number(collector_id);
        const ok = effectiveZoneId != null &&
          await ZoneCollectorModel.isApprovedActive(effectiveZoneId, cid);
        if (!ok) {
          return res.status(400).json({ error: { message: 'Chosen collector is not approved for your zone' } });
        }
        updates.collector_id = cid;
      }
    } else if (zoneChanged) {
      // Zone changed without a fresh choice → clear it so it can't point at a
      // collector not approved for the new zone (rule #4).
      updates.collector_id = null;
    }
  }

  const user = await UserModel.updateProfile(req.user.id, updates);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });

  const result = { ...UserModel.sanitizeUser(user) };

  if (req.user.role === 'collector' && contact_phone !== undefined) {
    const collector = await CollectorModel.updateOwnContact(req.user.id, contact_phone ?? '');
    if (collector) result.contact_phone = collector.contact_phone;
  }

  res.json({ user: result });
}

export async function changeMyPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const hash = await UserModel.getPasswordHash(req.user.id);
  if (!hash) return res.status(404).json({ error: { message: 'User not found' } });

  const match = await bcrypt.compare(currentPassword, hash);
  if (!match) return res.status(400).json({ error: { message: 'Current password is incorrect' } });

  const newHash = await bcrypt.hash(newPassword, 12);
  await UserModel.updatePassword(req.user.id, newHash);
  res.json({ message: 'Password updated' });
}

/**
 * Official-only: create a new official account.
 * Mirrors the collector-create pattern on POST /api/collectors — only an
 * authenticated official can mint another official, so the role is never
 * accepted from an untrusted client.
 */
export async function createOfficial(req, res) {
  const { name, email, password } = req.body;
  const password_hash = await bcrypt.hash(password, 12);
  // Duplicate email caught by DB unique constraint → 409 via error handler
  const user = await UserModel.create({ name, email, password_hash, role: 'official' });
  res.status(201).json({ user });
}
