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

  // View scope over the currently displayed report (client-side re-slice only).
  const [scope,    setScope]    = useState('all');      // 'all' | 'collector' | 'zone'
  const [entityId, setEntityId] = useState(null);       // selected collector_id / zone_id

  function resetScope() { setScope('all'); setEntityId(null); }

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
      resetScope();
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
      resetScope();
    } catch {
      // silently ignore
    }
  }

  async function handleDownload(id, r, activeScope) {
    const periodFrom = r?.summary_json?.period?.from || r?.period_start;
    const periodTo   = r?.summary_json?.period?.to   || r?.period_end;
    const suffix = activeScope ? `-${activeScope.scope}-${activeScope.entityId}` : '';
    const name = `nema-report-${periodFrom}_to_${periodTo}${suffix}.csv`;
    await ReportAPI.downloadCsv(id, name, activeScope);
  }

  const summary = report?.summary_json;

  // Derived scope selections (re-slice of the already-loaded summary_json).
  const collectors = summary?.pickups?.byCollector ?? [];
  const zones      = summary?.pickups?.byZone ?? [];
  const selectedCollector = scope === 'collector'
    ? collectors.find(c => c.collector_id === entityId) ?? null
    : null;
  const selectedZone = scope === 'zone'
    ? zones.find(z => z.zone_id === entityId) ?? null
    : null;
  const selectedZoneComplaints = selectedZone
    ? (summary.complaints.byZone.find(z => z.zone_id === entityId) ?? {})
    : null;
  const activeScope = scope === 'all' ? null : { scope, entityId };

  function chooseScope(next) {
    if (next === 'all') return resetScope();
    if (next === 'collector') {
      setScope('collector');
      setEntityId(prev => (collectors.find(c => c.collector_id === prev) ? prev : collectors[0]?.collector_id ?? null));
    } else if (next === 'zone') {
      setScope('zone');
      setEntityId(prev => (zones.find(z => z.zone_id === prev) ? prev : zones[0]?.zone_id ?? null));
    }
  }

  function drillTo(nextScope, id) {
    setScope(nextScope);
    setEntityId(id);
  }

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
          {/* Row-hover affordance for drill-down (resting appearance unchanged). */}
          <style>{`.rpt-click-row { cursor: pointer; } .rpt-click-row:hover { background: #f9fafb; } .rpt-name-btn:hover { text-decoration: underline; }`}</style>

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
              <button onClick={() => handleDownload(report.id, report, activeScope)} style={s.outlineBtn}>
                Download CSV{scope !== 'all' ? ' (scoped)' : ''}
              </button>
              <button onClick={() => navigate(`/reports/${report.id}/print${ReportAPI.scopeQuery(activeScope)}`)} style={s.outlineBtn}>
                View printable report
              </button>
            </div>
          </div>

          {/* Scope control */}
          <div style={s.scopeBar}>
            <div style={s.segGroup} role="group" aria-label="Report scope">
              {[
                { key: 'all',       label: 'All' },
                { key: 'collector', label: 'By collector' },
                { key: 'zone',      label: 'By zone' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => chooseScope(opt.key)}
                  aria-pressed={scope === opt.key}
                  style={{ ...s.segBtn, ...(scope === opt.key ? s.segBtnActive : {}) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scope === 'collector' && collectors.length > 0 && (
              <label style={s.entityPick}>
                <span style={s.entityPickLabel}>Collector</span>
                <select
                  value={entityId ?? ''}
                  onChange={e => setEntityId(Number(e.target.value))}
                  style={s.fi}
                >
                  {collectors.map(c => (
                    <option key={c.collector_id} value={c.collector_id}>{c.company_name}</option>
                  ))}
                </select>
              </label>
            )}
            {scope === 'zone' && zones.length > 0 && (
              <label style={s.entityPick}>
                <span style={s.entityPickLabel}>Zone</span>
                <select
                  value={entityId ?? ''}
                  onChange={e => setEntityId(Number(e.target.value))}
                  style={s.fi}
                >
                  {zones.map(z => (
                    <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>
                  ))}
                </select>
              </label>
            )}

            {scope !== 'all' && (
              <button type="button" onClick={resetScope} style={s.backLink}>
                ← Back to full report
              </button>
            )}
          </div>

          {/* ── ALL scope: full report (unchanged layout) ── */}
          {scope === 'all' && (
            <>
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
                        <tr
                          key={r.collector_id}
                          style={s.tr}
                          className="rpt-click-row"
                          onClick={() => drillTo('collector', r.collector_id)}
                        >
                          <td style={{ ...s.td, fontWeight: 600 }}>
                            <button
                              type="button"
                              className="rpt-name-btn"
                              style={s.nameBtn}
                              onClick={(e) => { e.stopPropagation(); drillTo('collector', r.collector_id); }}
                            >
                              {r.company_name}
                            </button>
                          </td>
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
                          <tr
                            key={zp.zone_id}
                            style={s.tr}
                            className="rpt-click-row"
                            onClick={() => drillTo('zone', zp.zone_id)}
                          >
                            <td style={{ ...s.td, fontWeight: 600 }}>
                              <button
                                type="button"
                                className="rpt-name-btn"
                                style={s.nameBtn}
                                onClick={(e) => { e.stopPropagation(); drillTo('zone', zp.zone_id); }}
                              >
                                {zp.zone_name}
                              </button>
                            </td>
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
            </>
          )}

          {/* ── COLLECTOR scope: focused panel (pickups only) ── */}
          {scope === 'collector' && (
            collectors.length === 0 ? (
              <p style={s.muted}>No collector data for this period.</p>
            ) : !selectedCollector ? (
              <p style={s.muted}>Select a collector to view their performance.</p>
            ) : (
              <div style={s.panel}>
                <h3 style={s.panelTitle}>Collector: {selectedCollector.company_name}</h3>
                <div style={s.cards}>
                  <StatCard label="Scheduled" value={fmt(selectedCollector.total)} sub="pickups in period" color="#374151" />
                  <StatCard label="Completed" value={fmt(selectedCollector.completed)} sub="pickups done" color="#15803d" />
                  <StatCard label="Missed" value={fmt(selectedCollector.missed)} sub="not collected" color="#dc2626" />
                  <StatCard label="Completion rate" value={pct(selectedCollector.completionRate)} sub={`${selectedCollector.completed}/${selectedCollector.total} pickups`} color="#2563eb" />
                </div>
                <p style={s.scopeNote}>Complaints are tracked per zone, not per collector.</p>
              </div>
            )
          )}

          {/* ── ZONE scope: focused panel (pickups + complaints) ── */}
          {scope === 'zone' && (
            zones.length === 0 ? (
              <p style={s.muted}>No zone data for this period.</p>
            ) : !selectedZone ? (
              <p style={s.muted}>Select a zone to view its performance.</p>
            ) : (
              <div style={s.panel}>
                <h3 style={s.panelTitle}>Zone: {selectedZone.zone_name}</h3>
                <h4 style={s.panelSub}>Pickup performance</h4>
                <div style={s.cards}>
                  <StatCard label="Scheduled" value={fmt(selectedZone.total)} sub="pickups in period" color="#374151" />
                  <StatCard label="Completed" value={fmt(selectedZone.completed)} sub="pickups done" color="#15803d" />
                  <StatCard label="Missed" value={fmt(selectedZone.missed)} sub="not collected" color="#dc2626" />
                  <StatCard label="Completion rate" value={pct(selectedZone.completionRate)} sub={`${selectedZone.completed}/${selectedZone.total} pickups`} color="#2563eb" />
                </div>
                <h4 style={s.panelSub}>Complaints</h4>
                <div style={s.cards}>
                  <StatCard label="Total complaints" value={fmt(selectedZoneComplaints.total ?? 0)} sub="in this zone" color="#d97706" />
                  <StatCard label="Resolved" value={fmt(selectedZoneComplaints.resolved ?? 0)} sub={`of ${fmt(selectedZoneComplaints.total ?? 0)} total`} color="#15803d" />
                  <StatCard label="Open" value={fmt(selectedZoneComplaints.open ?? 0)} sub="still unresolved" color="#dc2626" />
                  <StatCard label="Avg resolution" value={fmtHrs(selectedZoneComplaints.avg_resolution_hours)} sub="over resolved complaints" color="#7c3aed" />
                </div>
              </div>
            )
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
  scopeBar:    { display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  segGroup:    { display: 'inline-flex', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', overflow: 'hidden' },
  segBtn:      { padding: '0.5rem 1rem', background: '#fff', border: 'none', borderRight: '1px solid #e5e7eb', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' },
  segBtnActive:{ background: '#16a34a', color: '#fff', fontWeight: 600 },
  entityPick:  { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 500, color: '#374151' },
  entityPickLabel: { fontSize: '0.8rem', fontWeight: 500, color: '#374151' },
  backLink:    { padding: '0.5rem 0.5rem', background: 'transparent', border: 'none', color: '#16a34a', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  nameBtn:     { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', fontWeight: 600, cursor: 'pointer', textAlign: 'left' },
  panel:       { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.5rem' },
  panelTitle:  { fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' },
  panelSub:    { fontSize: '0.85rem', fontWeight: 600, color: '#374151', margin: '1rem 0 0.6rem' },
  scopeNote:   { marginTop: '1rem', color: '#9ca3af', fontSize: '0.85rem', fontStyle: 'italic' },
};
