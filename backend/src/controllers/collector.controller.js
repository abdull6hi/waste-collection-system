// Manages waste collector company accounts — creation, activation, and profile updates.
import bcrypt from 'bcrypt';
import { withTransaction } from '../config/db.js';
import * as CollectorModel from '../models/collector.model.js';

export async function getMyProfile(req, res) {
  const collector = await CollectorModel.findMine(req.user.id);
  if (!collector) return res.status(404).json({ error: { message: 'Collector record not found' } });
  res.json({ collector });
}

export async function list(req, res) {
  // Officials get the full record (license_no, contact_phone) for admin purposes.
  // Residents and collectors get a trimmed public view with no PII.
  const collectors = req.user.role === 'official'
    ? await CollectorModel.findAll()
    : await CollectorModel.findAllPublic();
  res.json({ collectors });
}

export async function getOne(req, res) {
  const id = Number(req.params.id);
  // Same role-based projection as list()
  const collector = req.user.role === 'official'
    ? await CollectorModel.findById(id)
    : await CollectorModel.findByIdPublic(id);
  if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });
  res.json({ collector });
}

export async function create(req, res) {
  const { name, email, password, company_name, license_no, license_expiry, contact_phone } = req.body;
  // Duplicate email / license_no is caught by DB unique constraints → 409 via error handler
  const result = await withTransaction(async (client) => {
    const password_hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'collector')
       RETURNING id, name, email, role, created_at`,
      [name, email, password_hash]
    );
    const { rows: [collector] } = await client.query(
      `INSERT INTO collectors (user_id, company_name, license_no, license_expiry, contact_phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.id, company_name, license_no, license_expiry || null, contact_phone ?? null]
    );
    return { ...collector, user_name: user.name, user_email: user.email };
  });
  res.status(201).json({ collector: result });
}

export async function update(req, res) {
  const { company_name, license_no, license_expiry, contact_phone, active } = req.body;
  const collector = await CollectorModel.update(Number(req.params.id), {
    company_name, license_no, license_expiry, contact_phone, active,
  });
  if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });
  res.json({ collector });
}

export async function deactivate(req, res) {
  const collector = await CollectorModel.update(Number(req.params.id), { active: false });
  if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });
  res.json({ collector });
}

export async function activate(req, res) {
  const collector = await CollectorModel.update(Number(req.params.id), { active: true });
  if (!collector) return res.status(404).json({ error: { message: 'Collector not found' } });
  res.json({ collector });
}
