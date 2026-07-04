// Handles resident-specific, self-service, and admin user actions.
import bcrypt from 'bcrypt';
import * as UserModel from '../models/user.model.js';
import * as CollectorModel from '../models/collector.model.js';
import * as ZoneModel from '../models/zone.model.js';

export async function setMyZone(req, res) {
  const { zone_id } = req.body;
  const user = await UserModel.setZone(req.user.id, zone_id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({ user });
}

export async function updateMyProfile(req, res) {
  const { name, email, contact_phone, zone_id } = req.body;

  const zoneProvided = zone_id !== undefined && zone_id !== null && zone_id !== '';
  if (zoneProvided) {
    // Clean 400 instead of a raw FK error if the zone doesn't exist.
    const zone = await ZoneModel.findById(Number(zone_id));
    if (!zone) return res.status(400).json({ error: { message: 'Selected zone does not exist' } });
  }

  // Residents persist contact_phone + zone_id on their own users row. Collectors
  // keep contact_phone on the collectors table (handled below), so we don't write
  // those columns for them.
  const updates = { name, email };
  if (req.user.role === 'resident') {
    if (contact_phone !== undefined) updates.contact_phone = contact_phone ?? null;
    if (zoneProvided) updates.zone_id = Number(zone_id);
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
