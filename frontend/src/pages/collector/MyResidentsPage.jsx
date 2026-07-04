import { useEffect, useState } from 'react';
import * as CollectorAPI from '../../api/collectors.js';
import { extractError }   from '../../api/client.js';

export default function MyResidentsPage() {
  const [residents, setResidents] = useState([]);
  const [zones,     setZones]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await CollectorAPI.getMyResidents();
        if (!active) return;
        setResidents(res.data.residents);
        setZones(res.data.zones);
        setTotal(res.data.total);
      } catch (err) {
        if (active) setLoadError(extractError(err, 'Failed to load residents'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Group residents by zone for display (API already orders by zone then name).
  const byZone = zones.map(z => ({
    ...z,
    residents: residents.filter(r => r.zone_id === z.zone_id),
  }));

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  return (
    <div style={s.page}>
      <h1 style={s.title}>My Residents</h1>
      {loadError && <p style={s.error}>{loadError}</p>}
      <p style={s.sub}>Residents in the zones assigned to you</p>

      {!loadError && total > 0 && (
        <p style={s.summary}>
          <strong>{total}</strong> {total === 1 ? 'resident' : 'residents'} across{' '}
          <strong>{zones.length}</strong> {zones.length === 1 ? 'zone' : 'zones'}
        </p>
      )}

      {!loadError && total === 0 ? (
        <div style={s.emptyCard}>
          <p style={s.emptyTitle}>No residents in your assigned zones yet</p>
          <p style={s.muted}>
            When residents register in the zones assigned to you, they'll appear here.
          </p>
        </div>
      ) : (
        byZone.map(z => (
          <section key={z.zone_id} style={s.section}>
            <h2 style={s.sectionTitle}>
              {z.zone_name}
              <span style={s.zoneCount}>
                {z.count} {z.count === 1 ? 'resident' : 'residents'}
              </span>
            </h2>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>{['Resident', 'Zone'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {z.residents.map(r => (
                    <tr key={r.id} style={s.tr}>
                      <td style={s.td}>{r.name}</td>
                      <td style={s.td}>
                        <span style={s.badge}>{r.zone_name}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const s = {
  page:    { padding: '2rem 2.5rem', maxWidth: '900px' },
  title:   { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:     { color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' },
  summary: { color: '#374151', fontSize: '0.9rem', marginBottom: '2rem' },
  error:   { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  section: { marginBottom: '2.5rem' },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' },
  zoneCount: { fontSize: '0.75rem', fontWeight: 600, color: '#15803d', background: '#f0fdf4', padding: '0.2rem 0.6rem', borderRadius: '9999px' },
  muted:   { color: '#9ca3af', fontSize: '0.875rem' },
  emptyCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '2.5rem 2rem', textAlign: 'center' },
  emptyTitle: { fontWeight: 600, color: '#374151', fontSize: '0.95rem', marginBottom: '0.4rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  tr:    { borderBottom: '1px solid #f3f4f6' },
  td:    { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: '#f0fdf4', color: '#15803d' },
};
