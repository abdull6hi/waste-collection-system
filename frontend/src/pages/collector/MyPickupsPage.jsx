import { useEffect, useState } from 'react';
import toast            from 'react-hot-toast';
import * as PickupAPI   from '../../api/pickups.js';
import * as ScheduleAPI from '../../api/schedules.js';
import { extractError } from '../../api/client.js';
import Modal            from '../../components/Modal.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_BADGE = {
  pending:    { bg: '#fffbeb', color: '#d97706' },
  completed:  { bg: '#f0fdf4', color: '#15803d' },
  missed:     { bg: '#fef2f2', color: '#dc2626' },
  in_progress:{ bg: '#eff6ff', color: '#2563eb' },
};

export default function MyPickupsPage() {
  const [outstanding, setOutstanding] = useState([]);
  const [history,     setHistory]     = useState([]);
  const [schedules,   setSchedules]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [exModal,     setExModal]     = useState(null);  // pickup id for exception modal
  const [exNote,      setExNote]      = useState('');
  const [exErr,       setExErr]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  async function load() {
    setLoadError('');
    try {
      const [mRes, sRes] = await Promise.all([
        PickupAPI.getMine(),
        ScheduleAPI.getMine(),
      ]);
      setOutstanding(mRes.data.outstanding);
      setHistory(mRes.data.history);
      setSchedules(sRes.data.schedules);
    } catch (err) {
      setLoadError(extractError(err, 'Failed to load pickups'));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function markCompleted(id) {
    setSubmitting(true);
    try {
      await PickupAPI.updateStatus(id, { status: 'completed' });
      toast.success('Pickup marked as completed');
      load();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update pickup'));
    } finally { setSubmitting(false); }
  }

  function openException(id) { setExModal(id); setExNote(''); setExErr(''); }
  function closeException()  { setExModal(null); }

  async function submitException(e) {
    e.preventDefault();
    if (!exNote.trim()) return setExErr('A note is required when logging an exception.');
    setSubmitting(true);
    try {
      await PickupAPI.updateStatus(exModal, { status: 'missed', notes: exNote });
      toast.success('Exception logged');
      closeException();
      load();
    } catch (err) { setExErr(extractError(err, 'Failed to log exception')); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  return (
    <div style={s.page}>
      <h1 style={s.title}>My Pickups</h1>
      {loadError && <p style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>{loadError}</p>}
      <p style={s.sub}>Your assigned routes, outstanding pickups, and recent history</p>

      {/* Assigned routes */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Assigned Routes</h2>
        {schedules.length === 0 ? (
          <p style={s.muted}>No schedules assigned to you yet.</p>
        ) : (
          <div style={s.routeGrid}>
            {schedules.map(sc => (
              <div key={sc.id} style={s.routeCard}>
                <p style={s.routeZone}>{sc.zone_name}</p>
                <p style={s.routeDay}>{DAYS[sc.day_of_week]} · {sc.start_time?.slice(0, 5)}</p>
                <span style={{ ...s.badge, background: '#eff6ff', color: '#2563eb' }}>{sc.frequency}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Outstanding pickups */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Outstanding Pickups</h2>
        {outstanding.length === 0 ? (
          <p style={s.muted}>No pending pickups for this period.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr>{['Date', 'Zone', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {outstanding.map(p => (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}>{p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : '—'}</td>
                    <td style={s.td}>{p.zone_name}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...STATUS_BADGE[p.status] }}>{p.status}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => markCompleted(p.id)}
                          disabled={submitting}
                          style={{ ...s.actBtn, background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                        >
                          ✓ Mark Completed
                        </button>
                        <button
                          onClick={() => openException(p.id)}
                          style={{ ...s.actBtn, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
                        >
                          ✕ Log Exception
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent history */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Recent History</h2>
        {history.length === 0 ? (
          <p style={s.muted}>No completed or missed pickups yet.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr>{['Date', 'Zone', 'Status', 'Notes'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}>{p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : '—'}</td>
                    <td style={s.td}>{p.zone_name}</td>
                    <td style={s.td}><span style={{ ...s.badge, ...STATUS_BADGE[p.status] }}>{p.status}</span></td>
                    <td style={{ ...s.td, color: '#6b7280' }}>{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Log exception modal */}
      {exModal && (
        <Modal title="Log Exception" onClose={closeException}>
          <form onSubmit={submitException} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={s.label}>
              Reason / notes *
              <textarea
                value={exNote} onChange={e => setExNote(e.target.value)}
                rows={4} required placeholder="Describe what prevented the pickup…"
                style={{ padding: '0.6rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>
            {exErr && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{exErr}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeException} style={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...s.cancelBtn, background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>
                {submitting ? 'Saving…' : 'Submit exception'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const s = {
  page:    { padding: '2rem 2.5rem', maxWidth: '900px' },
  title:   { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:     { color: '#6b7280', fontSize: '0.875rem', marginBottom: '2rem' },
  section: { marginBottom: '2.5rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' },
  routeGrid: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  routeCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem 1.25rem', minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  routeZone: { fontWeight: 600, color: '#111827', fontSize: '0.9rem' },
  routeDay:  { color: '#6b7280', fontSize: '0.8rem' },
  muted:   { color: '#9ca3af', fontSize: '0.875rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
  tr:    { borderBottom: '1px solid #f3f4f6' },
  td:    { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
  actBtn: { padding: '0.35rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.45rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  label:  { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  cancelBtn: { padding: '0.5rem 1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
};
