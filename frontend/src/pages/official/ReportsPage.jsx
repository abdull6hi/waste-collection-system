import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import toast                   from 'react-hot-toast';
import * as ReportAPI          from '../../api/reports.js';
import { extractError }        from '../../api/client.js';

function fmt(v) {
  if (v === null || v === undefined) return '—';
  return v;
}

function pct(rate) {
  if (rate === null || rate === undefined) return '0.0%';
  return (rate * 100).toFixed(1) + '%';
}

function fmtHrs(h) {
  if (h === null || h === undefined) return '—';
  return `${h} hrs`;
}

const CATEGORY_LABELS = {
  missed_pickup:     'Missed Pickup',
  illegal_dumping:   'Illegal Dumping',
  overflowing_bin:   'Overflowing Bin',
  damaged_equipment: 'Damaged Equipment',
  other:             'Other',
};

function today() { return new Date().toISOString().slice(0, 10); }
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const navigate = useNavigate();

  const [from,       setFrom]       = useState(monthAgo());
  const [to,         setTo]         = useState(today());
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');
  const [report,     setReport]     = useState(null);   // most recently generated/loaded
  const [history,    setHistory]    = useState([]);
  const [histLoading,setHistLoading]= useState(true);
  const [histError,  setHistError]  = useState('');

  async function loadHistory() {
    setHistLoading(true); setHistError('');
    try {
      const res = await ReportAPI.list();
      setHistory(res.data.reports);
    } catch (err) {
      setHistError(extractError(err, 'Failed to load report history'));
    } finally { setHistLoading(false); }
  }

  useEffect(() => { loadHistory(); }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    setGenError('');
    setGenerating(true);
    try {
      const res = await ReportAPI.generate({ from, to });
      setReport(res.data.report);
      toast.success('Report generated');
      await loadHistory();
    } catch (err) {
      setGenError(extractError(err, 'Failed to generate report'));
    } finally { setGenerating(false); }
  }

  async function handleLoadFromHistory(id) {
    try {
      const res = await ReportAPI.getOne(id);
      setReport(res.data.report);
    } catch {
      // silently ignore
    }
  }

  async function handleDownload(id, r) {
    const periodFrom = r?.summary_json?.period?.from || r?.period_start;
    const periodTo   = r?.summary_json?.period?.to   || r?.period_end;
    const name = `nema-report-${periodFrom}_to_${periodTo}.csv`;
    await ReportAPI.downloadCsv(id, name);
  }

  const summary = report?.summary_json;

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Reports</h1>
          <p style={s.sub}>Generate NEMA performance reports for a date range</p>
        </div>
      </div>

      {/* Generate form */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>Generate new report</h2>
        <form onSubmit={handleGenerate} style={s.genForm}>
          <label style={s.fl}>
            From
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={s.fi} required />
          </label>
          <label style={s.fl}>
            To
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={s.fi} required />
          </label>
          <button type="submit" disabled={generating} style={s.genBtn}>
            {generating ? 'Generating…' : 'Generate report'}
          </button>
        </form>
        {genError && <p style={s.errMsg}>{genError}</p>}
      </div>

      {/* Report results */}
      {summary && (
        <div style={s.section}>
          <div style={s.resultHeader}>
            <div>
              <h2 style={s.sectionTitle}>
                Report: {summary.period.from} — {summary.period.to}
              </h2>
              <p style={{ ...s.sub, marginTop: '0.1rem' }}>
                Generated {new Date(summary.generatedAt).toLocaleString()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => handleDownload(report.id, report)} style={s.outlineBtn}>
                Download CSV
              </button>
              <button onClick={() => navigate(`/reports/${report.id}/print`)} style={s.outlineBtn}>
                View printable report
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div style={s.cards}>
            <StatCard
              label="Completion rate"
              value={pct(summary.pickups.overall.completionRate)}
              sub={`${summary.pickups.overall.completed}/${summary.pickups.overall.total} pickups`}
              color="#15803d"
            />
            <StatCard
              label="Total complaints"
              value={fmt(summary.complaints.overall.total)}
              sub={`${fmt(summary.complaints.overall.open)} open`}
              color="#d97706"
            />
            <StatCard
              label="Complaints resolved"
              value={fmt(summary.complaints.overall.resolved)}
              sub={`of ${summary.complaints.overall.total} total`}
              color="#2563eb"
            />
            <StatCard
              label="Avg resolution time"
              value={fmtHrs(summary.complaints.overall.avg_resolution_hours)}
              sub="over resolved complaints"
              color="#7c3aed"
            />
          </div>

          {/* By-collector table */}
          <h3 style={s.tableTitle}>Collector performance</h3>
          {summary.pickups.byCollector.length === 0 ? (
            <p style={s.muted}>No pickup data for this period.</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Collector', 'Scheduled', 'Completed', 'Missed', 'Completion rate'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.pickups.byCollector.map(r => (
                    <tr key={r.collector_id} style={s.tr}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{r.company_name}</td>
                      <td style={s.td}>{r.total}</td>
                      <td style={s.td}>{r.completed}</td>
                      <td style={s.td}>{r.missed}</td>
                      <td style={s.td}>
                        <span style={{ ...s.rateBadge, background: rateColor(r.completionRate).bg, color: rateColor(r.completionRate).fg }}>
                          {pct(r.completionRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* By-zone table */}
          <h3 style={s.tableTitle}>Zone performance</h3>
          {summary.pickups.byZone.length === 0 ? (
            <p style={s.muted}>No zone data for this period.</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Zone', 'Scheduled', 'Completed', 'Missed', 'Completion rate', 'Complaints', 'Resolved', 'Avg resolution'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.pickups.byZone.map(zp => {
                    const zc = summary.complaints.byZone.find(z => z.zone_id === zp.zone_id) ?? {};
                    return (
                      <tr key={zp.zone_id} style={s.tr}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{zp.zone_name}</td>
                        <td style={s.td}>{zp.total}</td>
                        <td style={s.td}>{zp.completed}</td>
                        <td style={s.td}>{zp.missed}</td>
                        <td style={s.td}>
                          <span style={{ ...s.rateBadge, background: rateColor(zp.completionRate).bg, color: rateColor(zp.completionRate).fg }}>
                            {pct(zp.completionRate)}
                          </span>
                        </td>
                        <td style={s.td}>{fmt(zc.total ?? 0)}</td>
                        <td style={s.td}>{fmt(zc.resolved ?? 0)}</td>
                        <td style={s.td}>{fmtHrs(zc.avg_resolution_hours)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Report history */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Report history</h2>
        {histError && <p style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{histError}</p>}
        {histLoading ? (
          <p style={s.muted}>Loading…</p>
        ) : history.length === 0 ? (
          <div style={s.empty}>No reports generated yet.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Period', 'Generated by', 'Generated on', 'Actions'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} style={s.tr}>
                    <td style={s.td}>
                      {new Date(r.period_start).toLocaleDateString()} — {new Date(r.period_end).toLocaleDateString()}
                    </td>
                    <td style={s.td}>{r.generated_by_name}</td>
                    <td style={s.td}>{new Date(r.created_at).toLocaleString()}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => handleLoadFromHistory(r.id)} style={s.actionBtn}>
                          Re-open
                        </button>
                        <button onClick={() => handleDownload(r.id, r)} style={{ ...s.actionBtn, borderColor: '#bfdbfe', color: '#2563eb' }}>
                          CSV
                        </button>
                        <button onClick={() => navigate(`/reports/${r.id}/print`)} style={{ ...s.actionBtn, borderColor: '#d8b4fe', color: '#7c3aed' }}>
                          Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={s.statCard}>
      <p style={{ ...s.statValue, color }}>{value}</p>
      <p style={s.statLabel}>{label}</p>
      <p style={s.statSub}>{sub}</p>
    </div>
  );
}

function rateColor(rate) {
  if (rate >= 0.8) return { bg: '#f0fdf4', fg: '#15803d' };
  if (rate >= 0.5) return { bg: '#fffbeb', fg: '#d97706' };
  return { bg: '#fef2f2', fg: '#dc2626' };
}

const s = {
  page:        { padding: '2rem 2.5rem', maxWidth: '1200px' },
  topBar:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  title:       { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:         { color: '#6b7280', fontSize: '0.875rem' },
  card:        { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle:   { fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' },
  genForm:     { display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' },
  fl:          { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 500, color: '#374151' },
  fi:          { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff' },
  genBtn:      { padding: '0.55rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.55rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  errMsg:      { color: '#dc2626', fontSize: '0.85rem', marginTop: '0.75rem' },
  section:     { marginBottom: '2rem' },
  resultHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' },
  sectionTitle:{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' },
  cards:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  statCard:    { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.25rem' },
  statValue:   { fontSize: '2rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.25rem' },
  statLabel:   { fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.1rem' },
  statSub:     { fontSize: '0.75rem', color: '#9ca3af' },
  tableTitle:  { fontSize: '0.9rem', fontWeight: 600, color: '#374151', marginBottom: '0.6rem', marginTop: '1.25rem' },
  tableWrap:   { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'auto', marginBottom: '1rem' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr:          { borderBottom: '1px solid #f3f4f6' },
  td:          { padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151', verticalAlign: 'middle' },
  rateBadge:   { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
  muted:       { color: '#9ca3af', fontSize: '0.875rem' },
  empty:       { padding: '2rem', textAlign: 'center', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: '0.875rem', color: '#9ca3af', fontSize: '0.9rem' },
  outlineBtn:  { padding: '0.5rem 1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', color: '#374151', fontWeight: 500 },
  actionBtn:   { padding: '0.3rem 0.7rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', color: '#374151' },
};
