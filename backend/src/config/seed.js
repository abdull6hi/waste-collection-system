/**
 * Idempotent demo seed.
 * Run: node --env-file=.env src/config/seed.js
 * Safe to run multiple times — all inserts check for existing rows first.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from './db.js';
import { currentWeekRange } from '../utils/dates.js';

const SALT_ROUNDS = 12;

async function hash(pw) { return bcrypt.hash(pw, SALT_ROUNDS); }

async function upsertUser(client, { name, email, password, role }) {
  const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows.length) return existing.rows[0].id;
  const pw_hash = await hash(password);
  const res = await client.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, email, pw_hash, role]
  );
  return res.rows[0].id;
}

async function upsertZone(client, { name, description, assignedCollectorId }) {
  const existing = await client.query('SELECT id FROM zones WHERE name=$1', [name]);
  if (existing.rows.length) {
    // update assigned_collector_id in case it changed
    await client.query('UPDATE zones SET assigned_collector_id=$1 WHERE id=$2', [assignedCollectorId, existing.rows[0].id]);
    return existing.rows[0].id;
  }
  const res = await client.query(
    'INSERT INTO zones (name, description, assigned_collector_id) VALUES ($1,$2,$3) RETURNING id',
    [name, description, assignedCollectorId]
  );
  return res.rows[0].id;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* ── 1. Users ─────────────────────────────────────────────── */
    const officialId = await upsertUser(client, { name: 'Grace Mwangi', email: 'official@demo.ke', password: 'Official1!', role: 'official' });
    const ecocleanUserId = await upsertUser(client, { name: 'EcoClean Kenya', email: 'ecoclean@demo.ke', password: 'Collector1!', role: 'collector' });
    const greenpickUserId = await upsertUser(client, { name: 'GreenPick Ltd', email: 'greenpick@demo.ke', password: 'Collector2!', role: 'collector' });
    const naiwastUserId = await upsertUser(client, { name: 'NairobiWaste Co', email: 'naiwaste@demo.ke', password: 'Collector3!', role: 'collector' });
    const residentId = await upsertUser(client, { name: 'Amina Ouma', email: 'resident@demo.ke', password: 'Resident1!', role: 'resident' });

    /* ── 2. Collector profiles ────────────────────────────────── */
    async function upsertCollector(userId, company, license, phone) {
      const ex = await client.query(
        'SELECT id FROM collectors WHERE user_id=$1 OR license_no=$2',
        [userId, license]
      );
      if (ex.rows.length) {
        await client.query(
          'UPDATE collectors SET user_id=$1, company_name=$2, contact_phone=$3, active=true WHERE id=$4',
          [userId, company, phone, ex.rows[0].id]
        );
        return ex.rows[0].id;
      }
      const r = await client.query(
        'INSERT INTO collectors (user_id, company_name, license_no, contact_phone, active) VALUES ($1,$2,$3,$4,true) RETURNING id',
        [userId, company, license, phone]
      );
      return r.rows[0].id;
    }

    const cId1 = await upsertCollector(ecocleanUserId,  'EcoClean Kenya',  'NCC-2024-001', '+254 700 111 001');
    const cId2 = await upsertCollector(greenpickUserId, 'GreenPick Ltd',   'NCC-2024-002', '+254 700 111 002');
    const cId3 = await upsertCollector(naiwastUserId,   'NairobiWaste Co', 'NCC-2024-003', '+254 700 111 003');

    /* ── 3. Zones ─────────────────────────────────────────────── */
    const zId1 = await upsertZone(client, { name: 'Westlands North', description: 'Upper Westlands residential area', assignedCollectorId: cId1 });
    const zId2 = await upsertZone(client, { name: 'Karen Township',  description: 'Karen and surrounds',             assignedCollectorId: cId2 });
    const zId3 = await upsertZone(client, { name: 'Langata East',    description: 'Langata near Nairobi West',       assignedCollectorId: cId3 });
    const zId4 = await upsertZone(client, { name: 'South B Central', description: 'South B main estates',           assignedCollectorId: null });

    /* Assign resident to zone 1 */
    await client.query('UPDATE users SET zone_id=$1 WHERE id=$2', [zId1, residentId]);

    /* ── 4. Schedules ─────────────────────────────────────────── */
    const schedDefs = [
      { zone_id: zId1, collector_id: cId1, day_of_week: 1, start_time: '07:00', frequency: 'weekly' },
      { zone_id: zId1, collector_id: cId1, day_of_week: 4, start_time: '07:00', frequency: 'weekly' },
      { zone_id: zId2, collector_id: cId2, day_of_week: 2, start_time: '08:00', frequency: 'weekly' },
      { zone_id: zId3, collector_id: cId3, day_of_week: 3, start_time: '08:30', frequency: 'biweekly' },
      { zone_id: zId4, collector_id: cId2, day_of_week: 5, start_time: '09:00', frequency: 'weekly' },
    ];

    const schedIds = [];
    for (const sd of schedDefs) {
      const ex = await client.query(
        'SELECT id FROM schedules WHERE zone_id=$1 AND collector_id=$2 AND day_of_week=$3',
        [sd.zone_id, sd.collector_id, sd.day_of_week]
      );
      if (ex.rows.length) { schedIds.push(ex.rows[0].id); continue; }
      const r = await client.query(
        'INSERT INTO schedules (zone_id, collector_id, day_of_week, start_time, frequency) VALUES ($1,$2,$3,$4,$5::schedule_frequency) RETURNING id',
        [sd.zone_id, sd.collector_id, sd.day_of_week, sd.start_time, sd.frequency]
      );
      schedIds.push(r.rows[0].id);
    }

    /* ── 5. Pickups for current week ──────────────────────────── */
    // Use the shared UTC week-range util (consistent with pickup.controller.js)
    const { from: weekFrom } = currentWeekRange();
    const mon = new Date(weekFrom + 'T00:00:00Z');

    function weekDate(offset) {
      const d = new Date(mon);
      d.setUTCDate(mon.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    }

    const pickupDefs = [
      { zone_id: zId1, collector_id: cId1, date: weekDate(0), status: 'completed', completed_at: new Date(mon.getTime() + 4 * 3600_000).toISOString(), notes: null },
      { zone_id: zId1, collector_id: cId1, date: weekDate(3), status: 'pending',   completed_at: null, notes: null },
      { zone_id: zId2, collector_id: cId2, date: weekDate(1), status: 'completed', completed_at: new Date(mon.getTime() + 28 * 3600_000).toISOString(), notes: null },
      { zone_id: zId3, collector_id: cId3, date: weekDate(2), status: 'missed',    completed_at: null, notes: 'Truck breakdown on Mombasa Road' },
      { zone_id: zId4, collector_id: cId2, date: weekDate(4), status: 'pending',   completed_at: null, notes: null },
    ];

    for (const p of pickupDefs) {
      const ex = await client.query(
        'SELECT id FROM pickups WHERE zone_id=$1 AND collector_id=$2 AND scheduled_date=$3::date',
        [p.zone_id, p.collector_id, p.date]
      );
      if (ex.rows.length) continue;
      await client.query(
        'INSERT INTO pickups (zone_id, collector_id, scheduled_date, status, completed_at, notes) VALUES ($1,$2,$3::date,$4::pickup_status,$5::timestamptz,$6)',
        [p.zone_id, p.collector_id, p.date, p.status, p.completed_at, p.notes]
      );
    }

    /* ── 6. Complaints ────────────────────────────────────────── */
    const complaintDefs = [
      { zone_id: zId1, category: 'missed_pickup',    description: 'Garbage not collected on Monday as scheduled.',                        status: 'open',        assigned: cId1, ref: 'COMP-DEMO-001' },
      { zone_id: zId2, category: 'overflowing_bin',  description: 'Communal bin at Karen Shopping Centre overflowing since Friday.',      status: 'in_progress', assigned: cId2, ref: 'COMP-DEMO-002' },
      { zone_id: zId3, category: 'illegal_dumping',  description: 'Large pile of construction waste dumped near Langata Rd junction.',    status: 'open',        assigned: cId3, ref: 'COMP-DEMO-003' },
      { zone_id: zId4, category: 'damaged_equipment',description: 'Collection truck leaking oil on South B avenue.',                       status: 'resolved',    assigned: cId2, ref: 'COMP-DEMO-004' },
      { zone_id: zId1, category: 'other',            description: 'Collector workers were rude to residents.',                             status: 'closed',      assigned: cId1, ref: 'COMP-DEMO-005' },
      { zone_id: zId2, category: 'missed_pickup',    description: 'No collection for three consecutive Wednesdays.',                       status: 'open',        assigned: null, ref: 'COMP-DEMO-006' },
    ];

    for (const c of complaintDefs) {
      const ex = await client.query('SELECT id FROM complaints WHERE reference_no=$1', [c.ref]);
      if (ex.rows.length) continue;
      await client.query(
        'INSERT INTO complaints (resident_id, zone_id, category, description, status, reference_no, assigned_collector_id) VALUES ($1,$2,$3::complaint_category,$4,$5::complaint_status,$6,$7)',
        [residentId, c.zone_id, c.category, c.description, c.status, c.ref, c.assigned]
      );
    }

    /* ── 7. Demo report ───────────────────────────────────────── */
    const monthAgo   = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const periodStart = monthAgo.toISOString().slice(0, 10);
    const periodEnd   = new Date().toISOString().slice(0, 10);

    const exReport = await client.query(
      'SELECT id FROM reports WHERE generated_by=$1 AND period_start=$2::date AND period_end=$3::date',
      [officialId, periodStart, periodEnd]
    );
    if (!exReport.rows.length) {
      const summary = {
        period:     { from: periodStart, to: periodEnd },
        generatedAt: new Date().toISOString(),
        pickups:    { overall: { total: 5, completed: 2, missed: 1, pending: 2, completionRate: 0.4 }, byCollector: [], byZone: [] },
        complaints: { overall: { total: 6, open: 3, in_progress: 1, resolved: 1, closed: 1, avg_resolution_hours: null }, byZone: [] },
      };
      await client.query(
        'INSERT INTO reports (generated_by, period_start, period_end, summary_json) VALUES ($1,$2::date,$3::date,$4::jsonb)',
        [officialId, periodStart, periodEnd, JSON.stringify(summary)]
      );
    }

    await client.query('COMMIT');

    console.log('');
    console.log('✓ Demo seed complete.');
    console.log('');
    console.log('Credentials:');
    console.log('  Official  │ official@demo.ke   │ Official1!');
    console.log('  Collector │ ecoclean@demo.ke   │ Collector1!');
    console.log('  Collector │ greenpick@demo.ke  │ Collector2!');
    console.log('  Collector │ naiwaste@demo.ke   │ Collector3!');
    console.log('  Resident  │ resident@demo.ke   │ Resident1!');
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
