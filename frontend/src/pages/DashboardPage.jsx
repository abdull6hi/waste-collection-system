import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import client, { extractError } from '../api/client.js';
import * as ScheduleAPI   from '../api/schedules.js';
import * as ComplaintAPI  from '../api/complaints.js';
import { setMyZone }      from '../api/users.js';
import Modal              from '../components/Modal.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CATEGORIES = [
  { value: 'missed_pickup',    label: 'Missed Pickup' },
  { value: 'illegal_dumping',  label: 'Illegal Dumping' },
  { value: 'overflowing_bin',  label: 'Overflowing Bin' },
  { value: 'damaged_equipment',label: 'Damaged Equipment' },
  { value: 'other',            label: 'Other' },
];

const STATUS_BADGE = {
  open:        { bg: '#fffbeb', color: '#d97706' },
  in_progress: { bg: '#eff6ff', color: '#2563eb' },
  resolved:    { bg: '#f0fdf4', color: '#15803d' },
  closed:      { bg: '#f3f4f6', color: '#6b7280' },
};

/* ─── Official dashboard ─────────────────────────────────────── */
function OfficialDashboard({ user }) {
  const [stats, setStats] = useState({ collectors: '—', zones: '—', schedules: '—', openComplaints: '—' });

  useEffect(() => {
    Promise.all([
      client.get('/api/collectors'),
      client.get('/api/zones'),
      client.get('/api/schedules'),
      ComplaintAPI.openByZone(),
    ]).then(([c, z, s, comp]) => {
      const totalOpen = (comp.data.zones || []).reduce((sum, r) => sum + r.open_count, 0);
      setStats({
        collectors:    c.data.collectors.length,
        zones:         z.data.zones.length,
        schedules:     s.data.schedules.length,
        openComplaints: totalOpen,
      });
    }).catch(() => {});
  }, []);

  const cards = [
    { to: '/collectors', label: 'Collectors',       value: stats.collectors,    desc: 'registered' },
    { to: '/zones',      label: 'Zones',            value: stats.zones,         desc: 'active zones' },
    { to: '/schedules',  label: 'Schedules',        value: stats.schedules,     desc: 'routes' },
    { to: '/complaints', label: 'Open Complaints',  value: stats.openComplaints,desc: 'unresolved' },
  ];

  return (
    <>
      <div style={s.hero}>
        <h1 style={s.title}>Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p style={s.sub}>Nairobi County Waste Coordination — Admin Dashboard</p>
      </div>
      <div style={s.grid}>
        {cards.map(c => (
          <Link to={c.to} key={c.to} style={s.card}>
            <span style={s.cardValue}>{c.value}</span>
            <span style={s.cardLabel}>{c.label}</span>
            <span style={s.cardDesc}>{c.desc}</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to="/tracking"   style={s.quickLink}>View pickup tracking →</Link>
        <Link to="/schedules"  style={s.quickLink}>Manage schedules →</Link>
        <Link to="/complaints" style={s.quickLink}>Review complaints →</Link>
      </div>
    </>
  );
}

/* ─── Collector dashboard ────────────────────────────────────── */
function CollectorDashboard({ user }) {
  const [schedules,   setSchedules]   = useState([]);
  const [complaints,  setComplaints]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveNote,  setResolveNote]  = useState('');
  const [resolveErr,   setResolveErr]   = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  async function load() {
    try {
      const [sRes, cRes] = await Promise.all([
        client.get('/api/schedules/mine'),
        ComplaintAPI.listAssigned(),
      ]);
      setSchedules(sRes.data.schedules);
      setComplaints(cRes.data.complaints);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load dashboard'));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function markInProgress(id) {
    setSubmitting(true);
    try {
      await ComplaintAPI.updateStatus(id, { status: 'in_progress' });
      load();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update status'));
    } finally { setSubmitting(false); }
  }

  function openResolve(c) { setResolveModal(c); setResolveNote(''); setResolveErr(''); }
  function closeResolve() { setResolveModal(null); }

  async function submitResolve(e) {
    e.preventDefault();
    if (!resolveNote.trim()) return setResolveErr('Resolution notes are required.');
    setSubmitting(true);
    try {
      await ComplaintAPI.updateStatus(resolveModal.id, { status: 'resolved', resolution_notes: resolveNote });
      toast.success('Complaint resolved');
      closeResolve();
      load();
    } catch (err) { setResolveErr(extractError(err, 'Failed to resolve complaint')); }
    finally { setSubmitting(false); }
  }

  const openComplaints = complaints.filter(c => c.status !== 'resolved' && c.status !== 'closed');

  if (loading) return <p style={s.muted}>Loading…</p>;

  return (
    <>
      <div style={s.hero}>
        <h1 style={s.title}>Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p style={s.sub}>Your assigned collection routes, pickups, and complaints</p>
      </div>

      <div style={s.grid}>
        <div style={s.card}>
          <span style={s.cardValue}>{schedules.length}</span>
          <span style={s.cardLabel}>Assigned routes</span>
          <span style={s.cardDesc}>active schedules</span>
        </div>
        <div style={s.card}>
          <span style={s.cardValue}>{openComplaints.length}</span>
          <span style={s.cardLabel}>Open complaints</span>
          <span style={s.cardDesc}>need attention</span>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
        <Link to="/my-pickups" style={s.quickLink}>View my pickups →</Link>
      </div>

      <div style={s.section}>
        <h2 style={s.sectionTitle}>Complaints Queue</h2>
        {complaints.length === 0 ? (
          <p style={s.muted}>No complaints assigned to you.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Reference', 'Category', 'Zone', 'Description', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id} style={s.tr}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 600 }}>{c.reference_no}</td>
                    <td style={s.td}>{CATEGORIES.find(x => x.value === c.category)?.label ?? c.category}</td>
                    <td style={s.td}>{c.zone_name}</td>
                    <td style={{ ...s.td, maxWidth: '200px', color: '#6b7280' }}>{c.description}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...STATUS_BADGE[c.status] }}>{c.status.replace('_', ' ')}</span>
                    </td>
                    <td style={s.td}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={s.td}>
                      {(c.status === 'open') && (
                        <button
                          onClick={() => markInProgress(c.id)}
                          disabled={submitting}
                          style={{ ...s.actBtn, background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                        >
                          In Progress
                        </button>
                      )}
                      {(c.status === 'open' || c.status === 'in_progress') && (
                        <button
                          onClick={() => openResolve(c)}
                          style={{ ...s.actBtn, marginLeft: '0.4rem', background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                        >
                          Resolve
                        </button>
                      )}
                      {(c.status === 'resolved' || c.status === 'closed') && (
                        <span style={s.muted}>Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolveModal && (
        <Modal title={`Resolve ${resolveModal.reference_no}`} onClose={closeResolve}>
          <form onSubmit={submitResolve} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={s.label}>
              Resolution notes *
              <textarea
                value={resolveNote} onChange={e => setResolveNote(e.target.value)}
                rows={4} required placeholder="Describe how this complaint was resolved…"
                style={{ padding: '0.6rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>
            {resolveErr && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{resolveErr}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeResolve} style={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...s.cancelBtn, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>
                {submitting ? 'Saving…' : 'Mark resolved'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ─── Resident dashboard ─────────────────────────────────────── */
function ResidentDashboard({ user }) {
  const { updateUser } = useAuth();
  const [zones,       setZones]       = useState([]);
  const [schedules,   setSchedules]   = useState([]);
  const [zoneId,      setZoneId]      = useState(user?.zone_id ?? null);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');
  const [complaints,  setComplaints]  = useState([]);
  const [showReport,  setShowReport]  = useState(false);
  const [reportRef,   setReportRef]   = useState('');
  const [form,        setForm]        = useState({ zone_id: '', category: '', description: '' });
  const [formErr,     setFormErr]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    client.get('/api/zones').then(r => setZones(r.data.zones)).catch(() => {});
  }, []);

  useEffect(() => {
    if (zoneId) {
      ScheduleAPI.getByZone(zoneId)
        .then(r => setSchedules(r.data.schedules))
        .catch(() => setSchedules([]));
    }
  }, [zoneId]);

  async function loadComplaints() {
    try {
      const res = await ComplaintAPI.listMine();
      setComplaints(res.data.complaints);
    } catch {}
  }

  useEffect(() => { loadComplaints(); }, []);

  async function handleZoneSelect(e) {
    const id = Number(e.target.value);
    setSaving(true); setErr('');
    try {
      await setMyZone(id);
      setZoneId(id);
      updateUser({ ...user, zone_id: id });
    } catch { setErr('Could not save zone.'); }
    finally { setSaving(false); }
  }

  function openReport() {
    setForm({ zone_id: zoneId ? String(zoneId) : '', category: '', description: '' });
    setFormErr(''); setReportRef('');
    setShowReport(true);
  }

  async function handleReport(e) {
    e.preventDefault();
    setFormErr(''); setSubmitting(true);
    try {
      const res = await ComplaintAPI.submit({
        zone_id:     Number(form.zone_id),
        category:    form.category,
        description: form.description,
      });
      setReportRef(res.data.complaint.reference_no);
      loadComplaints();
    } catch (err) { setFormErr(extractError(err, 'Submission failed')); }
    finally { setSubmitting(false); }
  }

  return (
    <>
      <div style={s.hero}>
        <h1 style={s.title}>Welcome, {user?.name?.split(' ')[0]}</h1>
        <p style={s.sub}>Your neighbourhood waste collection schedule and complaints</p>
      </div>

      <div style={s.card2}>
        <label style={{ ...s.label, marginBottom: '0.75rem' }}>
          Your collection zone
          <select value={zoneId ?? ''} onChange={handleZoneSelect} disabled={saving} style={s.select}>
            <option value="">Select your zone…</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        {err && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{err}</p>}

        {zoneId && schedules.length === 0 && (
          <p style={s.muted}>No schedules published for this zone yet.</p>
        )}

        {schedules.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={s.schedsHeader}>Collection schedule for your zone</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {schedules.map(sc => (
                <div key={sc.id} style={s.schedRow}>
                  <span style={s.schedDay}>{DAYS[sc.day_of_week]}</span>
                  <span style={s.schedTime}>{sc.start_time?.slice(0, 5)}</span>
                  <span style={s.schedCollector}>{sc.collector_name}</span>
                  <span style={{ ...s.badge, background: '#eff6ff', color: '#2563eb' }}>{sc.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report an issue */}
      <div style={{ marginTop: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={s.sectionTitle}>My Complaints</h2>
          <button onClick={openReport} style={s.reportBtn}>+ Report an Issue</button>
        </div>

        {complaints.length === 0 ? (
          <p style={s.muted}>You have not submitted any complaints yet.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Reference', 'Category', 'Zone', 'Status', 'Date', 'Resolution'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id} style={s.tr}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 600 }}>{c.reference_no}</td>
                    <td style={s.td}>{CATEGORIES.find(x => x.value === c.category)?.label ?? c.category}</td>
                    <td style={s.td}>{c.zone_name}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...STATUS_BADGE[c.status] }}>{c.status.replace('_', ' ')}</span>
                    </td>
                    <td style={s.td}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={{ ...s.td, color: '#6b7280', fontSize: '0.8rem' }}>{c.resolution_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report modal */}
      {showReport && (
        <Modal title="Report an Issue" onClose={() => setShowReport(false)}>
          {reportRef ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <p style={{ fontWeight: 600, color: '#15803d', fontSize: '1rem', marginBottom: '0.5rem' }}>Complaint submitted!</p>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Your reference number is:</p>
              <p style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#111827', letterSpacing: '0.05em' }}>{reportRef}</p>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem' }}>Please keep this for tracking.</p>
              <button onClick={() => setShowReport(false)} style={{ ...s.reportBtn, marginTop: '1.25rem' }}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleReport} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={s.label}>
                Zone *
                <select
                  value={form.zone_id}
                  onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}
                  required style={s.select}
                >
                  <option value="">Select zone…</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>
              <label style={s.label}>
                Category *
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  required style={s.select}
                >
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label style={s.label}>
                Description *
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4} required placeholder="Describe the issue in detail…"
                  style={{ padding: '0.6rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </label>
              {formErr && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{formErr}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowReport(false)} style={s.cancelBtn}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ ...s.cancelBtn, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>
                  {submitting ? 'Submitting…' : 'Submit complaint'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

/* ─── Root ───────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div style={s.page}>
      {user?.role === 'official'  && <OfficialDashboard  user={user} />}
      {user?.role === 'collector' && <CollectorDashboard user={user} />}
      {user?.role === 'resident'  && <ResidentDashboard  user={user} />}
    </div>
  );
}

const s = {
  page:    { padding: '2rem 2.5rem', maxWidth: '1100px' },
  hero:    { marginBottom: '2rem' },
  title:   { fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginBottom: '0.35rem' },
  sub:     { color: '#6b7280', fontSize: '0.95rem' },
  grid:    { display: 'flex', gap: '1.25rem', flexWrap: 'wrap' },
  card: {
    display: 'flex', flexDirection: 'column', gap: '0.2rem',
    background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem',
    padding: '1.5rem 1.75rem', minWidth: '150px', textDecoration: 'none',
    boxShadow: '0 2px 8px rgb(0 0 0 / 0.04)',
  },
  card2: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.75rem', maxWidth: '480px' },
  cardValue:  { fontSize: '2.25rem', fontWeight: 700, color: '#15803d', lineHeight: 1 },
  cardLabel:  { fontSize: '0.95rem', fontWeight: 600, color: '#111827', marginTop: '0.25rem' },
  cardDesc:   { fontSize: '0.8rem', color: '#9ca3af' },
  quickLink:  { color: '#16a34a', fontWeight: 600, fontSize: '0.875rem' },
  label:      { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  select:     { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff' },
  muted:      { color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' },
  schedsHeader: { fontWeight: 600, fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' },
  schedRow:   { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6' },
  schedDay:   { fontWeight: 600, color: '#111827', fontSize: '0.875rem', minWidth: '80px' },
  schedTime:  { color: '#6b7280', fontSize: '0.875rem', minWidth: '48px' },
  schedCollector: { flex: 1, color: '#374151', fontSize: '0.8rem' },
  badge:      { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
  section:    { marginTop: '2rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#374151', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' },
  tableWrap:  { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'auto', marginTop: '0.75rem' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '0.75rem 1rem',
    fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap',
  },
  tr:     { borderBottom: '1px solid #f3f4f6' },
  td:     { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151', verticalAlign: 'top' },
  actBtn: { padding: '0.3rem 0.65rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  reportBtn: {
    padding: '0.55rem 1.1rem', background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: '0.6rem', fontWeight: 600, fontSize: '0.875rem',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  cancelBtn: { padding: '0.5rem 1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
};
