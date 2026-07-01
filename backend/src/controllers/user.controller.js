// Handles resident-specific, self-service, and admin user actions.
import bcrypt from 'bcrypt';
import * as UserModel from '../models/user.model.js';
import * as CollectorModel from '../models/collector.model.js';

export async function setMyZone(req, res) {
  const { zone_id } = req.body;
  const user = await UserModel.setZone(req.user.id, zone_id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({ user });
}

export async function updateMyProfile(req, res) {
  const { name, email, contact_phone } = req.body;
  const user = await UserModel.updateProfile(req.user.id, { name, email });
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
