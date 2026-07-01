import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as ComplaintAPI from '../../api/complaints.js';
import client, { extractError } from '../../api/client.js';
import Modal             from '../../components/Modal.jsx';

const CATEGORIES = [
  { value: 'missed_pickup',    label: 'Missed Pickup' },
  { value: 'illegal_dumping',  label: 'Illegal Dumping' },
  { value: 'overflowing_bin',  label: 'Overflowing Bin' },
  { value: 'damaged_equipment',label: 'Damaged Equipment' },
  { value: 'other',            label: 'Other' },
];

const STATUSES = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'closed',      label: 'Closed' },
];

const STATUS_BADGE = {
  open:        { bg: '#fffbeb', color: '#d97706' },
  in_progress: { bg: '#eff6ff', color: '#2563eb' },
  resolved:    { bg: '#f0fdf4', color: '#15803d' },
  closed:      { bg: '#f3f4f6', color: '#6b7280' },
};

const EMPTY_FILTERS = { status: '', zoneId: '', category: '', from: '', to: '' };

export default function ComplaintsPage() {
  const [complaints,  setComplaints]  = useState([]);
  const [zones,       setZones]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [filters,     setFilters]     = useState(EMPTY_FILTERS);
  const [detail,      setDetail]      = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [statusForm,  setStatusForm]  = useState({ status: '', resolution_notes: '' });
  const [statusErr,   setStatusErr]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  async function load(f = filters) {
    setLoading(true); setLoadError('');
    try {
      const params = {};
      if (f.status)   params.status   = f.status;
      if (f.zoneId)   params.zoneId   = f.zoneId;
      if (f.category) params.category = f.category;
      if (f.from)     params.from     = f.from;
      if (f.to)       params.to       = f.to;
      const res = await ComplaintAPI.list(params);
      setComplaints(res.data.complaints);
    } catch (err) {
      setLoadError(extractError(err, 'Failed to load complaints'));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    client.get('/api/zones').then(r => setZones(r.data.zones)).catch(() => {});
    load();
  }, []);

  function handleFilter(e) {
    const next = { ...filters, [e.target.name]: e.target.value };
    setFilters(next);
    load(next);
  }

  function clearFilters() { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS); }

  function openDetail(c) { setDetail(c); }
  function closeDetail() { setDetail(null); }

  function openStatus(c) {
    setStatusModal(c);
    setStatusForm({ status: c.status, resolution_notes: c.resolution_notes || '' });
    setStatusErr('');
  }
  function closeStatus() { setStatusModal(null); }

  async function submitStatus(e) {
    e.preventDefault();
    if (statusForm.status === 'resolved' && !statusForm.resolution_notes.trim()) {
      return setStatusErr('Resolution notes are required when resolving.');
    }
    setSubmitting(true);
    try {
      await ComplaintAPI.updateStatus(statusModal.id, {
        status:           statusForm.status,
        resolution_notes: statusForm.resolution_notes || undefined,
      });
      toast.success('Status updated');
      closeStatus();
      load();
    } catch (err) { setStatusErr(extractError(err, 'Failed to update status')); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>Complaints</h1>
          <p style={s.sub}>Review and manage citizen complaints</p>
        </div>
      </div>

      {/* Filters */}
      <div style={s.filterBar}>
        <select name="status" value={filters.status} onChange={handleFilter} style={s.filterInput}>
          <option value="">All statuses</option>
          {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
        </select>

        <select name="zoneId" value={filters.zoneId} onChange={handleFilter} style={s.filterInput}>
          <option value="">All zones</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>

        <select name="category" value={filters.category} onChange={handleFilter} style={s.filterInput}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <label style={s.dateLabel}>
          From
          <input type="date" name="from" value={filters.from} onChange={handleFilter} style={s.filterInput} />
        </label>

        <label style={s.dateLabel}>
          To
          <input type="date" name="to" value={filters.to} onChange={handleFilter} style={s.filterInput} />
        </label>

        {Object.values(filters).some(Boolean) && (
          <button onClick={clearFilters} style={s.clearBtn}>Clear</button>
        )}
      </div>

      {loadError && <p style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>{loadError}</p>}

      {loading ? (
        <p style={s.muted}>Loading…</p>
      ) : complaints.length === 0 ? (
        <div style={s.empty}>No complaints match the current filters.</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Reference', 'Resident', 'Zone', 'Category', 'Collector', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.id} style={s.tr}>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 600 }}>{c.reference_no}</td>
                  <td style={s.td}>{c.resident_name}</td>
                  <td style={s.td}>{c.zone_name}</td>
                  <td style={s.td}>{CATEGORIES.find(x => x.value === c.category)?.label ?? c.category}</td>
                  <td style={{ ...s.td, color: '#6b7280' }}>{c.collector_company || '—'}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...STATUS_BADGE[c.status] }}>{c.status.replace('_', ' ')}</span>
                  </td>
                  <td style={s.td}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => openDetail(c)} style={s.actionBtn}>View</button>
                      <button onClick={() => openStatus(c)} style={{ ...s.actionBtn, borderColor: '#bfdbfe', color: '#2563eb' }}>Update</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal title={`Complaint ${detail.reference_no}`} onClose={closeDetail}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
            <Row label="Reference"  value={<span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{detail.reference_no}</span>} />
            <Row label="Status"     value={<span style={{ ...s.badge, ...STATUS_BADGE[detail.status] }}>{detail.status.replace('_', ' ')}</span>} />
            <Row label="Resident"   value={detail.resident_name} />
            <Row label="Zone"       value={detail.zone_name} />
            <Row label="Category"   value={CATEGORIES.find(x => x.value === detail.category)?.label ?? detail.category} />
            <Row label="Collector"  value={detail.collector_company || '—'} />
            <Row label="Submitted"  value={new Date(detail.created_at).toLocaleString()} />
            {detail.resolved_at && <Row label="Resolved at" value={new Date(detail.resolved_at).toLocaleString()} />}
            <div>
              <p style={{ fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Description</p>
              <p style={{ color: '#6b7280', lineHeight: 1.6 }}>{detail.description}</p>
            </div>
            {detail.resolution_notes && (
              <div>
                <p style={{ fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Resolution notes</p>
                <p style={{ color: '#6b7280', lineHeight: 1.6 }}>{detail.resolution_notes}</p>
              </div>
            )}
            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={closeDetail} style={s.cancelBtn}>Close</button>
              <button onClick={() => { closeDetail(); openStatus(detail); }} style={{ ...s.cancelBtn, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>
                Update status
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Status update modal */}
      {statusModal && (
        <Modal title={`Update ${statusModal.reference_no}`} onClose={closeStatus}>
          <form onSubmit={submitStatus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={s.label}>
              New status *
              <select
                value={statusForm.status}
                onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
                required style={s.select}
              >
                {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </label>
            <label style={s.label}>
              Resolution notes {statusForm.status === 'resolved' ? '*' : '(optional)'}
              <textarea
                value={statusForm.resolution_notes}
                onChange={e => setStatusForm(f => ({ ...f, resolution_notes: e.target.value }))}
                rows={4} placeholder="Add resolution notes…"
                style={{ padding: '0.6rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </label>
            {statusErr && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{statusErr}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeStatus} style={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...s.cancelBtn, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: '110px' }}>{label}:</span>
      <span style={{ color: '#6b7280' }}>{value}</span>
    </div>
  );
}

const s = {
  page:    { padding: '2rem 2.5rem', maxWidth: '1200px' },
  topBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  title:   { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:     { color: '#6b7280', fontSize: '0.875rem' },
  filterBar: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' },
  filterInput: { padding: '0.55rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#374151' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 500, color: '#6b7280' },
  clearBtn: { padding: '0.55rem 0.9rem', background: 'transparent', border: '1.5px solid #fecaca', borderRadius: '0.55rem', color: '#dc2626', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
  muted:   { color: '#9ca3af', fontSize: '0.875rem' },
  empty:   { marginTop: '2rem', padding: '2rem', textAlign: 'center', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: '0.875rem', color: '#9ca3af', fontSize: '0.9rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'auto' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr:      { borderBottom: '1px solid #f3f4f6' },
  td:      { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151', verticalAlign: 'top' },
  badge:   { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
  actionBtn: { padding: '0.3rem 0.7rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', color: '#374151' },
  label:   { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
  select:  { padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff' },
  cancelBtn: { padding: '0.5rem 1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
};
