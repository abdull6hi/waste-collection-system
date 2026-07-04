import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client, { extractError } from '../../api/client.js';
import Modal from '../../components/Modal.jsx';
import * as ZoneAPI from '../../api/zones.js';

const EMPTY_FORM = { name: '', description: '' };

export default function ZonesPage() {
  const [zones, setZones]           = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assignMap, setAssignMap]   = useState({});
  const [manageZone, setManageZone] = useState(null);

  async function load() {
    setError('');
    try {
      const [zRes, cRes] = await Promise.all([
        client.get('/api/zones'),
        client.get('/api/collectors'),
      ]);
      setZones(zRes.data.zones);
      setCollectors(cRes.data.collectors.filter(c => c.active));
      const map = {};
      zRes.data.zones.forEach(z => { map[z.id] = String(z.assigned_collector_id ?? ''); });
      setAssignMap(map);
    } catch (err) {
      setError(extractError(err, 'Failed to load zones'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true); }
  function openEdit(z) { setEditTarget(z); setForm({ name: z.name, description: z.description || '' }); setFormError(''); setShowForm(true); }
  function cancel() { setShowForm(false); setEditTarget(null); }
  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault(); setFormError(''); setSubmitting(true);
    try {
      if (editTarget) {
        await client.put(`/api/zones/${editTarget.id}`, form);
        toast.success('Zone updated');
      } else {
        await client.post('/api/zones', form);
        toast.success('Zone created');
      }
      setShowForm(false); setEditTarget(null); load();
    } catch (err) {
      setFormError(extractError(err, 'Request failed'));
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this zone? This cannot be undone.')) return;
    try {
      await client.delete(`/api/zones/${id}`);
      toast.success('Zone deleted');
      load();
    } catch (err) {
      toast.error(extractError(err, 'Delete failed'));
    }
  }

  async function handleAssign(zoneId, collectorId) {
    const prev = assignMap[zoneId];
    setAssignMap(m => ({ ...m, [zoneId]: collectorId }));
    try {
      await client.patch(`/api/zones/${zoneId}/assign`, {
        collector_id: collectorId === '' ? null : Number(collectorId),
      });
      toast.success('Collector assigned');
      load();
    } catch (err) {
      setAssignMap(m => ({ ...m, [zoneId]: prev }));
      toast.error(extractError(err, 'Assignment failed'));
    }
  }

  if (loading) return <div style={s.page}><p style={{ color: '#9ca3af' }}>Loading…</p></div>;

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
          <h1 style={s.title}>Zones</h1>
          <p style={s.sub}>Manage collection zones and collector assignments</p>
        </div>
        {!showForm && <button onClick={openAdd} style={s.addBtn}>+ Add Zone</button>}
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h2 style={s.formTitle}>{editTarget ? 'Edit Zone' : 'Create New Zone'}</h2>
          <form onSubmit={handleSubmit} style={s.form}>
            <label htmlFor="zone-name" style={s.label}>Zone name *
              <input id="zone-name" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Westlands North" style={s.input} />
            </label>
            <label htmlFor="zone-desc" style={s.label}>Description
              <textarea id="zone-desc" name="description" value={form.description} onChange={handleChange} placeholder="Optional description" rows={3} style={{ ...s.input, resize: 'vertical' }} />
            </label>
            {formError && <p role="alert" style={s.error}>{formError}</p>}
            <div style={s.formActions}>
              <button type="button" onClick={cancel} style={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={s.saveBtn}>{submitting ? 'Saving…' : editTarget ? 'Save changes' : 'Create zone'}</button>
            </div>
          </form>
        </div>
      )}

      {zones.length === 0 ? (
        <div style={s.empty}>No zones created yet. Add one above.</div>
      ) : (
        <div style={{ ...s.tableWrap, overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>{['Zone', 'Description', 'Default & Approved Collectors', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.id} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{z.name}</td>
                  <td style={{ ...s.td, color: '#6b7280', maxWidth: '240px' }}>{z.description || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <select value={assignMap[z.id] ?? ''} onChange={e => handleAssign(z.id, e.target.value)} style={s.select} aria-label={`Default collector for ${z.name}`}>
                        <option value="">Unassigned</option>
                        {collectors.map(c => <option key={c.id} value={String(c.id)}>{c.company_name}</option>)}
                      </select>
                      <button onClick={() => setManageZone(z)} style={s.actionBtn}>Manage approved</button>
                    </div>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button onClick={() => openEdit(z)} style={s.actionBtn}>Edit</button>
                      <button onClick={() => handleDelete(z.id)} style={{ ...s.actionBtn, ...s.actionDelete }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manageZone && (
        <ManageCollectorsModal
          zone={manageZone}
          allCollectors={collectors}
          onClose={() => setManageZone(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/* ── Per-zone approved-collectors management ── */
function ManageCollectorsModal({ zone, allCollectors, onClose, onChanged }) {
  const [approved, setApproved] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addId, setAddId]       = useState('');
  const [busy, setBusy]         = useState(false);

  async function reload() {
    try {
      const res = await ZoneAPI.getZoneCollectors(zone.id);
      setApproved(res.data.collectors);
    } catch (err) {
      toast.error(extractError(err, 'Failed to load approved collectors'));
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [zone.id]);

  const approvedIds = new Set(approved.map(c => c.id));
  const addable = allCollectors.filter(c => !approvedIds.has(c.id));

  async function handleAdd() {
    if (!addId) return;
    setBusy(true);
    try {
      await ZoneAPI.approveZoneCollector(zone.id, Number(addId));
      toast.success('Collector approved for this zone');
      setAddId('');
      await reload();
      onChanged();
    } catch (err) {
      toast.error(extractError(err, 'Could not approve collector'));
    } finally { setBusy(false); }
  }

  async function handleRemove(c) {
    setBusy(true);
    try {
      await ZoneAPI.removeZoneCollector(zone.id, c.id);
      toast.success(`${c.company_name} removed from this zone`);
      await reload();
      onChanged();
    } catch (err) {
      toast.error(extractError(err, 'Could not remove collector'));
    } finally { setBusy(false); }
  }

  async function handleSetDefault(c) {
    setBusy(true);
    try {
      await client.patch(`/api/zones/${zone.id}/assign`, { collector_id: c.id });
      toast.success(`${c.company_name} is now the default`);
      await reload();
      onChanged();
    } catch (err) {
      toast.error(extractError(err, 'Could not set default'));
    } finally { setBusy(false); }
  }

  return (
    <Modal title={`Approved collectors — ${zone.name}`} onClose={onClose}>
      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading…</p>
      ) : (
        <>
          {approved.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1rem' }}>
              No collectors approved for this zone yet. Add one below.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {approved.map(c => (
                <li key={c.id} style={m.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{c.company_name}</span>
                    {c.is_default && <span style={{ ...m.badge, ...m.badgeGreen }}>Default</span>}
                    {!c.active && <span style={{ ...m.badge, ...m.badgeGray }}>Inactive</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {!c.is_default && (
                      <button disabled={busy} onClick={() => handleSetDefault(c)} style={m.smallBtn}>Set default</button>
                    )}
                    {c.is_default ? (
                      <button disabled title="Set another collector as default first" style={{ ...m.smallBtn, ...m.smallBtnDisabled }}>Remove</button>
                    ) : (
                      <button disabled={busy} onClick={() => handleRemove(c)} style={{ ...m.smallBtn, ...m.smallBtnDanger }}>Remove</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              Approve another collector
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={addId} onChange={e => setAddId(e.target.value)} style={{ ...s.select, flex: 1 }} disabled={busy || addable.length === 0}>
                <option value="">{addable.length ? 'Select a collector…' : 'All active collectors already approved'}</option>
                {addable.map(c => <option key={c.id} value={String(c.id)}>{c.company_name}</option>)}
              </select>
              <button onClick={handleAdd} disabled={busy || !addId} style={s.saveBtn}>Add</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

const m = {
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.55rem' },
  badge: { display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 },
  badgeGreen: { background: '#dcfce7', color: '#15803d' },
  badgeGray: { background: '#f3f4f6', color: '#6b7280' },
  smallBtn: { padding: '0.3rem 0.6rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', color: '#374151' },
  smallBtnDanger: { borderColor: '#fecaca', color: '#dc2626' },
  smallBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};

const s = {
  page:   { padding: '2rem 2.5rem', maxWidth: '1000px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' },
  title:  { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:    { color: '#6b7280', fontSize: '0.875rem' },
  addBtn: { padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.6rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
  formCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.75rem', marginBottom: '1.75rem', boxShadow: '0 2px 8px rgb(0 0 0 / 0.04)' },
  formTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#111827', marginBottom: '1.25rem' },
  form:  { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  input: { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' },
  formActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' },
  cancelBtn: { padding: '0.55rem 1.1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { padding: '0.55rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.55rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.55rem 0.85rem', color: '#dc2626', fontSize: '0.85rem' },
  errBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  empty: { marginTop: '2rem', padding: '2rem', textAlign: 'center', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: '0.875rem', color: '#9ca3af', fontSize: '0.9rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151' },
  select: { padding: '0.35rem 0.6rem', border: '1.5px solid #d1d5db', borderRadius: '0.45rem', fontSize: '0.8rem', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' },
  actions: { display: 'flex', gap: '0.5rem' },
  actionBtn: { padding: '0.3rem 0.7rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', color: '#374151' },
  actionDelete: { borderColor: '#fecaca', color: '#dc2626' },
};
