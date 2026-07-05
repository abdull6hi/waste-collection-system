/**
 * Integration tests — Administrative reporting module (TC-20, TC-21, TC-22).
 *
 * Covers:
 *  - Official generates a report for a zone/period -> completion rates and
 *    resolution times included (TC-20)
 *  - Exporting the generated report -> CSV with the expected structure (TC-21)
 *  - Non-official roles hitting any report endpoint -> 403 (TC-22)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  truncateTables, closePool, makeToken,
  createUser, createZone, createCollector, createPickup,
} from '../helpers.js';
import pool from '../../src/config/db.js';

let officialToken, residentToken, collectorToken;
let zone, collector;
let today;

beforeAll(async () => {
  await truncateTables();

  today = new Date().toISOString().slice(0, 10);

  const official     = await createUser({ role: 'official' });
  const resident      = await createUser({ role: 'resident' });
  const collectorUser = await createUser({ role: 'collector' });

  officialToken  = makeToken({ id: official.id,      role: 'official' });
  residentToken  = makeToken({ id: resident.id,       role: 'resident' });
  collectorToken = makeToken({ id: collectorUser.id,  role: 'collector' });

  zone      = await createZone({ name: `ReportsZone_${Date.now()}` });
  collector = await createCollector(collectorUser.id, { license_no: `RPT-${Date.now()}` });

  await createPickup({ zone_id: zone.id, collector_id: collector.id, scheduled_date: today, status: 'completed' });
  await createPickup({ zone_id: zone.id, collector_id: collector.id, scheduled_date: today, status: 'missed' });

  // A resolved complaint within the reporting period, for resolution-time stats
  await pool.query(
    `INSERT INTO complaints (resident_id, zone_id, category, description, status, resolved_at)
     VALUES ($1, $2, 'missed_pickup', 'Resolved for report stats', 'resolved', NOW())`,
    [resident.id, zone.id]
  );
});
afterAll(closePool);

describe('POST /api/reports/generate — completion rates and resolution times (TC-20)', () => {
  it('generates a report including pickup completion rates and complaint resolution times', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: today, to: today });

    expect(res.status).toBe(201);
    const summary = res.body.report.summary_json;

    expect(summary.pickups.overall.total).toBeGreaterThanOrEqual(2);
    expect(summary.pickups.overall.completed).toBeGreaterThanOrEqual(1);
    expect(typeof summary.pickups.overall.completionRate).toBe('number');

    expect(summary.complaints.overall.total).toBeGreaterThanOrEqual(1);
    expect(summary.complaints.overall.resolved).toBeGreaterThanOrEqual(1);
    expect(summary.complaints.overall.avg_resolution_hours).not.toBeNull();
  });
});

describe('GET /api/reports/:id/export.csv — export format (TC-21)', () => {
  it('exports the report as a CSV with the expected structure', async () => {
    const genRes = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: today, to: today });
    const reportId = genRes.body.report.id;

    const res = await request(app)
      .get(`/api/reports/${reportId}/export.csv`)
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('NEMA Performance Report');
    expect(res.text).toContain('Total Pickups,Completed,Missed,Completion Rate (%)');
    expect(res.text).toContain('Complaint Summary');
  });
});

describe('GET /api/reports/:id/export.csv — scoped exports', () => {
  it('collector scope: single Collector Performance section, no Zone/Overall/Complaint sections', async () => {
    const genRes = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: today, to: today });
    const reportId = genRes.body.report.id;

    const res = await request(app)
      .get(`/api/reports/${reportId}/export.csv`)
      .query({ scope: 'collector', entityId: collector.id })
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(new RegExp(`-collector-${collector.id}\\.csv"$`));
    expect(res.text).toContain('Collector Performance');
    expect(res.text).toContain('Note: Complaints are tracked per zone, not per collector.');
    expect(res.text).not.toContain('Zone Performance');
    expect(res.text).not.toContain('Overall Summary');
    expect(res.text).not.toContain('Complaint Summary');
  });

  it('zone scope: single Zone Performance section (incl. complaint stats), no Collector/Overall sections', async () => {
    const genRes = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: today, to: today });
    const reportId = genRes.body.report.id;

    const res = await request(app)
      .get(`/api/reports/${reportId}/export.csv`)
      .query({ scope: 'zone', entityId: zone.id })
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(new RegExp(`-zone-${zone.id}\\.csv"$`));
    expect(res.text).toContain('Zone Performance');
    expect(res.text).toContain('Complaints,Resolved,Avg Resolution (hrs)');
    expect(res.text).not.toContain('Collector Performance');
    expect(res.text).not.toContain('Overall Summary');
    expect(res.text).not.toContain('Complaint Summary');
  });

  it('unrecognized scope falls back to the full report (no filename suffix)', async () => {
    const genRes = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${officialToken}`)
      .send({ from: today, to: today });
    const reportId = genRes.body.report.id;

    const res = await request(app)
      .get(`/api/reports/${reportId}/export.csv`)
      .query({ scope: 'bogus', entityId: collector.id })
      .set('Authorization', `Bearer ${officialToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).not.toMatch(/-collector-|-zone-/);
    expect(res.text).toContain('Overall Summary');
    expect(res.text).toContain('Collector Performance');
    expect(res.text).toContain('Zone Performance');
    expect(res.text).toContain('Complaint Summary');
  });
});

describe('Report endpoints — restricted to officials (TC-22)', () => {
  it('rejects a resident (403)', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', `Bearer ${residentToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a collector (403)', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ from: today, to: today });
    expect(res.status).toBe(403);
  });
});
