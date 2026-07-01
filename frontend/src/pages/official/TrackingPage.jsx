import { useEffect, useState } from 'react';
import * as PickupAPI from '../../api/pickups.js';
import client, { extractError } from '../../api/client.js';

function isoWeek() {
  const today = new Date();
  const dow = today.getDay();
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(today); mon.setDate(today.getDate() - daysSinceMon);
  const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

const STATUS_COLORS = {
  pending:    { bg: '#fffbeb', color: '#d97706' },
  completed:  { bg: '#f0fdf4', color: '#15803d' },
  missed:     { bg: '#fef2f2', color: '#dc2626' },
  in_progress:{ bg: '#eff6ff', color: '#2563eb' },
};

export default function TrackingPage() {
  const week = isoWeek();
  const [filters, setFilters] = useState({ from: week.from, to: week.to, zoneId: '', collectorId: '', status: '' });
  const [pickups,  setPickups]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [zones,    setZones]    = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const params = {};
      if (filters.from)        params.from        = filters.from;
      if (filters.to)          params.to          = filters.to;
      if (filters.zoneId)      params.zoneId      = filters.zoneId;
      if (filters.collectorId) params.collectorId = filters.collectorId;
      if (filters.status)      params.status      = filters.status;

      const [pRes, sRes] = await Promise.all([
        PickupAPI.getAll(params),
        PickupAPI.getStats({ from: filters.from, to: filters.to }),
      ]);
      setPickups(pRes.data.pickups);
      setStats(sRes.data);
    } catch (err) {
      setError(extractError(err, 'Failed to load pickups'));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    client.get('/api/zones').then(r => setZones(r.data.zones));
    client.get('/api/collectors').then(r => setCollectors(r.data.collectors));
  }, []);

  useEffect(() => { load(); }, [filters]);

  function ch(e) { setFilters(f => ({ ...f, [e.target.name]: e.target.value })); }

  const pct = stats ? (stats.overall.total > 0 ? Math.round(100 * stats.overall.completed / stats.overall.total) : 0) : null;

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Pickup Tracking</h1>
          <p style={s.sub}>Monitor collection activity and completion rates</p>
        </div>
      </div>

      {/* Stats card */}
      {stats && (
        <div style={s.statsCard}>
          <div style={s.statMain}>
            <span style={s.statPct}>{pct}%</span>
            <span style={s.statLabel}>completion rate</span>
            <span style={s.statSub}>{stats.overall.completed}/{stats.overall.total} pickups for {filters.from} → {filters.to}</span>
          </div>
          <div style={s.statSplit}>
            <div>
              <p style={s.splitHeader}>By Collector</p>
              {stats.byCollector.length === 0 ? <p style={s.none}>No data</p> : stats.byCollector.map(r => (
                <div key={r.collector_id} style={s.splitRow}>
                  <span style={s.splitName}>{r.company_name}</span>
                  <span style={s.splitVal}>{r.completed}/{r.total}</span>
                  <div style={s.bar}><div style={{ ...s.barFill, width: `${r.total > 0 ? Math.round(100 * r.completed / r.total) : 0}%` }} /></div>
                </div>
              ))}
            </div>
            <div>
              <p style={s.splitHeader}>By Zone</p>
              {stats.byZone.length === 0 ? <p style={s.none}>No data</p> : stats.byZone.map(r => (
                <div key={r.zone_id} style={s.splitRow}>
                  <span style={s.splitName}>{r.zone_name}</span>
                  <span style={s.splitVal}>{r.completed}/{r.total}</span>
                  <div style={s.bar}><div style={{ ...s.barFill, width: `${r.total > 0 ? Math.round(100 * r.completed / r.total) : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={s.filters}>
        <label style={s.fl}>From<input type="date" name="from" value={filters.from} onChange={ch} style={s.fi} /></label>
        <label style={s.fl}>To<input type="date" name="to" value={filters.to} onChange={ch} style={s.fi} /></label>
        <label style={s.fl}>Zone
          <select name="zoneId" value={filters.zoneId} onChange={ch} style={s.fi}>
            <option value="">All zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <label style={s.fl}>Collector
          <select name="collectorId" value={filters.collectorId} onChange={ch} style={s.fi}>
            <option value="">All collectors</option>
            {collectors.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </label>
        <label style={s.fl}>Status
          <select name="status" value={filters.status} onChange={ch} style={s.fi}>
            <option value="">All statuses</option>
            {['pending', 'completed', 'missed', 'in_progress'].map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      </div>

      {error && <p style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

      {loading ? <p style={s.muted}>Loading…</p> : pickups.length === 0 ? (
        <div style={s.empty}>No pickups match the selected filters.</div>
      ) : (
        <div style={{ ...s.tableWrap, overflowX: 'auto' }}>
          <table style={{ ...s.table, minWidth: '700px' }}>
            <thead><tr>{['Date', 'Zone', 'Collector', 'Status', 'Completed At', 'Notes'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {pickups.map(p => {
                const c = STATUS_COLORS[p.status] ?? {};
                return (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}>{p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : '—'}</td>
                    <td style={s.td}>{p.zone_name}</td>
                    <td style={s.td}>{p.collector_name}</td>
                    <td style={s.td}><span style={{ ...s.badge, background: c.bg, color: c.color }}>{p.status}</span></td>
                    <td style={s.td}>{p.completed_at ? new Date(p.completed_at).toLocaleString() : '—'}</td>
                    <td style={{ ...s.td, color: '#6b7280', maxWidth: '200px' }}>{p.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem 2.5rem', maxWidth: '1100px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  title:  { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:    { color: '#6b7280', fontSize: '0.875rem' },
  statsCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' },
  statMain:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '120px', gap: '0.2rem' },
  statPct:   { fontSize: '3rem', fontWeight: 700, color: '#15803d', lineHeight: 1 },
  statLabel: { fontSize: '0.875rem', fontWeight: 600, color: '#374151' },
  statSub:   { fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' },
  statSplit: { display: 'flex', gap: '2rem', flex: 1, flexWrap: 'wrap' },
  splitHeader: { fontWeight: 600, fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' },
  splitRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' },
  splitName: { fontSize: '0.8rem', color: '#374151', minWidth: '100px' },
  splitVal:  { fontSize: '0.8rem', color: '#6b7280', minWidth: '40px', textAlign: 'right' },
  bar:  { flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '9999px', minWidth: '60px' },
  barFill: { height: '100%', background: '#16a34a', borderRadius: '9999px', transition: 'width 300ms' },
  none: { fontSize: '0.8rem', color: '#9ca3af' },
  filters: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' },
  fl: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 500, color: '#374151' },
  fi: { padding: '0.45rem 0.7rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit', background: '#fff' },
  muted: { color: '#9ca3af', marginTop: '2rem' },
  empty: { padding: '2rem', textAlign: 'center', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: '0.875rem', color: '#9ca3af', fontSize: '0.9rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  tr:    { borderBottom: '1px solid #f3f4f6' },
  td:    { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
};
