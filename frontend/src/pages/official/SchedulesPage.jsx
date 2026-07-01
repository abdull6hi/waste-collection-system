import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as ScheduleAPI from '../../api/schedules.js';
import * as PickupAPI   from '../../api/pickups.js';
import client, { extractError } from '../../api/client.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQ = ['weekly', 'biweekly', 'daily'];
const EMPTY = { zone_id: '', collector_id: '', day_of_week: '1', start_time: '08:00', frequency: 'weekly' };

export default function SchedulesPage() {
  const [schedules,  setSchedules]  = useState([]);
  const [zones,      setZones]      = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [formErr,    setFormErr]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setError('');
    try {
      const [sRes, zRes, cRes] = await Promise.all([
        ScheduleAPI.getAll(),
        client.get('/api/zones'),
        client.get('/api/collectors'),
      ]);
      setSchedules(sRes.data.schedules);
      setZones(zRes.data.zones);
      setCollectors(cRes.data.collectors.filter(c => c.active));
    } catch (err) {
      setError(extractError(err, 'Failed to load schedules'));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openAdd()  { setEditTarget(null); setForm(EMPTY); setFormErr(''); setShowForm(true); }
  function openEdit(sc) {
    setEditTarget(sc);
    setForm({ zone_id: sc.zone_id, collector_id: sc.collector_id, day_of_week: String(sc.day_of_week), start_time: sc.start_time.slice(0, 5), frequency: sc.frequency });
    setFormErr(''); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditTarget(null); }
  function ch(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault(); setFormErr(''); setSaving(true);
    const payload = { ...form, zone_id: Number(form.zone_id), collector_id: Number(form.collector_id), day_of_week: Number(form.day_of_week) };
    try {
      if (editTarget) {
        await ScheduleAPI.update(editTarget.id, payload);
        toast.success('Schedule updated');
      } else {
        await ScheduleAPI.create(payload);
        toast.success('Schedule created');
      }
      setShowForm(false); setEditTarget(null); load();
    } catch (err) { setFormErr(extractError(err, 'Failed to save schedule')); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await ScheduleAPI.remove(id);
      toast.success('Schedule deleted');
      load();
    } catch (err) { toast.error(extractError(err, 'Delete failed')); }
  }

  async function generatePickups() {
    setGenerating(true);
    try {
      const res = await PickupAPI.generate();
      toast.success(`${res.data.created} pickup(s) created for ${res.data.from} → ${res.data.to}`);
    } catch (err) { toast.error(extractError(err, 'Failed to generate pickups')); }
    finally { setGenerating(false); }
  }

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  if (error) return (
    <div style={s.page}>
      <p style={s.errBox}>{error}</p>
      <button onClick={load} style={s.addBtn}>Retry</button>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Schedules</h1>
          <p style={s.sub}>Define recurring collection routes for zones and collectors</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={generatePickups} disabled={generating} style={s.genBtn}>
            {generating ? 'Generating…' : '⟳ Generate this week\'s pickups'}
          </button>
          {!showForm && <button onClick={openAdd} style={s.addBtn}>+ Add Schedule</button>}
        </div>
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h2 style={s.formTitle}>{editTarget ? 'Edit Schedule' : 'New Schedule'}</h2>
          <form onSubmit={submit} style={s.form}>
            <div style={s.row}>
              <label htmlFor="sched-zone" style={s.label}>Zone *
                <select id="sched-zone" name="zone_id" value={form.zone_id} onChange={ch} required style={s.select}>
                  <option value="">Select zone…</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>
              <label htmlFor="sched-collector" style={s.label}>Collector *
                <select id="sched-collector" name="collector_id" value={form.collector_id} onChange={ch} required style={s.select}>
                  <option value="">Select collector…</option>
                  {collectors.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </label>
            </div>
            <div style={s.row}>
              <label htmlFor="sched-day" style={s.label}>Day of week *
                <select id="sched-day" name="day_of_week" value={form.day_of_week} onChange={ch} required style={s.select}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </label>
              <label htmlFor="sched-time" style={s.label}>Start time *
                <input id="sched-time" type="time" name="start_time" value={form.start_time} onChange={ch} required style={s.input} />
              </label>
              <label htmlFor="sched-freq" style={s.label}>Frequency *
                <select id="sched-freq" name="frequency" value={form.frequency} onChange={ch} style={s.select}>
                  {FREQ.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </div>
            {formErr && <p role="alert" style={s.err}>{formErr}</p>}
            <div style={s.actions}>
              <button type="button" onClick={cancel} style={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create schedule'}</button>
            </div>
          </form>
        </div>
      )}

      {schedules.length === 0 ? (
        <div style={s.empty}>No schedules yet. Add one above.</div>
      ) : (
        <div style={{ ...s.tableWrap, overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr>{['Zone', 'Collector', 'Day', 'Time', 'Frequency', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {schedules.map(sc => (
                <tr key={sc.id} style={s.tr}>
                  <td style={s.td}>{sc.zone_name}</td>
                  <td style={s.td}>{sc.collector_name}</td>
                  <td style={s.td}>{DAYS[sc.day_of_week]}</td>
                  <td style={s.td}>{sc.start_time?.slice(0, 5)}</td>
                  <td style={s.td}><span style={{ ...s.badge, background: '#eff6ff', color: '#2563eb' }}>{sc.frequency}</span></td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(sc)} style={s.actBtn}>Edit</button>
                      <button onClick={() => del(sc.id)} style={{ ...s.actBtn, borderColor: '#fecaca', color: '#dc2626' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page:   { padding: '2rem 2.5rem', maxWidth: '1000px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
  title:  { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:    { color: '#6b7280', fontSize: '0.875rem' },
  addBtn: { padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.6rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
  genBtn: { padding: '0.6rem 1.1rem', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: '0.6rem', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
  formCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.75rem', marginBottom: '1.75rem', boxShadow: '0 2px 8px rgb(0 0 0/0.04)' },
  formTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#111827', marginBottom: '1.25rem' },
  form:  { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row:   { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 160px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  input: { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' },
  select: { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff' },
  actions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' },
  cancelBtn: { padding: '0.55rem 1.1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { padding: '0.55rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.55rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  err:   { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.55rem 0.85rem', color: '#dc2626', fontSize: '0.85rem' },
  errBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  empty: { marginTop: '2rem', padding: '2rem', textAlign: 'center', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: '0.875rem', color: '#9ca3af', fontSize: '0.9rem' },
  muted: { color: '#9ca3af', marginTop: '2rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '560px' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
  actBtn: { padding: '0.3rem 0.7rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', color: '#374151' },
};
