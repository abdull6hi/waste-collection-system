import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import client, { extractError } from '../../api/client.js';

const EMPTY_FORM = { name: '', email: '', password: '', company_name: '', license_no: '', license_expiry: '', contact_phone: '' };

// Reads the server-computed license_status (never re-derives dates on the client).
function licenceBadge(status) {
  switch (status) {
    case 'expired':       return { label: 'Expired',       style: s.badgeRed };
    case 'expiring_soon': return { label: 'Expiring soon', style: s.badgeAmber };
    case 'valid':         return { label: 'Valid',         style: s.badgeGreen };
    default:              return { label: 'Not set',       style: s.badgeGray };
  }
}

// Sort order so expired / expiring licences surface at the top of the register.
const LICENCE_SEVERITY = { expired: 0, expiring_soon: 1, valid: 2, none: 3 };

export default function CollectorsPage() {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setError('');
    try {
      const res = await client.get('/api/collectors');
      setCollectors(res.data.collectors);
    } catch (err) {
      setError(extractError(err, 'Failed to load collectors'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true); }
  function openEdit(c) {
    setEditTarget(c);
    setForm({
      name: c.user_name, email: c.user_email, password: '',
      company_name: c.company_name, license_no: c.license_no,
      license_expiry: c.license_expiry ? c.license_expiry.slice(0, 10) : '',
      contact_phone: c.contact_phone || '',
    });
    setFormError(''); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditTarget(null); }

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(''); setSubmitting(true);
    try {
      if (editTarget) {
        await client.put(`/api/collectors/${editTarget.id}`, {
          company_name:   form.company_name,
          license_no:     form.license_no,
          license_expiry: form.license_expiry || null,
          contact_phone:  form.contact_phone,
        });
        toast.success('Collector updated');
      } else {
        await client.post('/api/collectors', form);
        toast.success('Collector registered');
      }
      setShowForm(false); setEditTarget(null); load();
    } catch (err) {
      setFormError(extractError(err, 'Request failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(c) {
    const endpoint = c.active ? 'deactivate' : 'activate';
    try {
      await client.patch(`/api/collectors/${c.id}/${endpoint}`);
      toast.success(`Collector ${c.active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(extractError(err, 'Action failed'));
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
          <h1 style={s.title}>Collectors</h1>
          <p style={s.sub}>Manage registered waste collection companies</p>
        </div>
        {!showForm && (
          <button onClick={openAdd} style={s.addBtn}>+ Add Collector</button>
        )}
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h2 style={s.formTitle}>{editTarget ? 'Edit Collector' : 'Register New Collector'}</h2>
          <form onSubmit={handleSubmit} style={s.form}>
            {!editTarget && (
              <>
                <Row>
                  <Field label="Full name"     name="name"     value={form.name}     onChange={handleChange} required placeholder="Jane Mwangi" />
                  <Field label="Email address" name="email"    value={form.email}    onChange={handleChange} required type="email" placeholder="jane@company.co.ke" />
                </Row>
                <Row>
                  <Field label="Temporary password" name="password" value={form.password} onChange={handleChange} required type="password" placeholder="Min. 8 characters" />
                </Row>
              </>
            )}
            <Row>
              <Field label="Company name" name="company_name" value={form.company_name} onChange={handleChange} required placeholder="EcoClean Ltd" />
              <Field label="License no."  name="license_no"   value={form.license_no}   onChange={handleChange} required placeholder="NCC-2024-001" />
            </Row>
            <Row>
              <Field label="License expiry" name="license_expiry" value={form.license_expiry} onChange={handleChange} type="date" />
              <Field label="Contact phone" name="contact_phone" value={form.contact_phone} onChange={handleChange} placeholder="+254 700 000 000" />
            </Row>

            {formError && <p role="alert" style={s.error}>{formError}</p>}

            <div style={s.formActions}>
              <button type="button" onClick={cancel} style={s.cancelBtn}>Cancel</button>
              <button type="submit" disabled={submitting} style={s.saveBtn}>
                {submitting ? 'Saving…' : editTarget ? 'Save changes' : 'Register collector'}
              </button>
            </div>
          </form>
        </div>
      )}

      {collectors.length === 0 ? (
        <div style={s.empty}>No collectors registered yet. Add one above.</div>
      ) : (
        <div style={{ ...s.tableWrap, overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Company', 'License No.', 'License Expiry', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...collectors]
                .sort((a, b) =>
                  (LICENCE_SEVERITY[a.license_status] ?? 3) - (LICENCE_SEVERITY[b.license_status] ?? 3)
                  || a.id - b.id)
                .map(c => {
                const badge = licenceBadge(c.license_status);
                return (
                <tr key={c.id} style={s.tr}>
                  <td style={s.td}>{c.user_name}</td>
                  <td style={s.td}>{c.user_email}</td>
                  <td style={s.td}>{c.company_name}</td>
                  <td style={s.td}>{c.license_no}</td>
                  <td style={s.td}>
                    {c.license_expiry ? new Date(c.license_expiry).toLocaleDateString() : 'Not set'}
                    <span style={{ ...s.badge, ...badge.style, marginLeft: '0.5rem' }}>{badge.label}</span>
                  </td>
                  <td style={s.td}>{c.contact_phone || '—'}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(c.active ? s.badgeGreen : s.badgeGray) }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button onClick={() => openEdit(c)} style={s.actionBtn}>Edit</button>
                      <button onClick={() => toggleActive(c)} style={{ ...s.actionBtn, ...(c.active ? s.actionDeactivate : s.actionActivate) }}>
                        {c.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
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

function Row({ children }) { return <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{children}</div>; }

function Field({ label, name, value, onChange, required, type = 'text', placeholder }) {
  const id = `field-${name}`;
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 200px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
      {label}
      <input
        id={id} type={type} name={name} value={value} onChange={onChange}
        required={required} placeholder={placeholder}
        style={{ padding: '0.6rem 0.85rem', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none' }}
      />
    </label>
  );
}

const s = {
  page:   { padding: '2rem 2.5rem', maxWidth: '1100px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' },
  title:  { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' },
  sub:    { color: '#6b7280', fontSize: '0.875rem' },
  addBtn: { padding: '0.6rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.6rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' },
  formCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '1.75rem', marginBottom: '1.75rem', boxShadow: '0 2px 8px rgb(0 0 0 / 0.04)' },
  formTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#111827', marginBottom: '1.25rem' },
  form:  { display: 'flex', flexDirection: 'column', gap: '1rem' },
  formActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' },
  cancelBtn: { padding: '0.55rem 1.1rem', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '0.55rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { padding: '0.55rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.55rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.55rem 0.85rem', color: '#dc2626', fontSize: '0.85rem' },
  errBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  empty: { marginTop: '2rem', padding: '2rem', textAlign: 'center', background: '#fff', border: '1.5px dashed #e5e7eb', borderRadius: '0.875rem', color: '#9ca3af', fontSize: '0.9rem' },
  tableWrap: { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' },
  table:  { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#374151' },
  badge: { display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 },
  badgeGreen: { background: '#dcfce7', color: '#15803d' },
  badgeGray:  { background: '#f3f4f6', color: '#6b7280' },
  badgeRed:   { background: '#fee2e2', color: '#dc2626' },
  badgeAmber: { background: '#fef3c7', color: '#b45309' },
  actions: { display: 'flex', gap: '0.5rem' },
  actionBtn: { padding: '0.3rem 0.7rem', border: '1.5px solid #e5e7eb', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', color: '#374151' },
  actionDeactivate: { borderColor: '#fecaca', color: '#dc2626' },
  actionActivate:   { borderColor: '#bbf7d0', color: '#15803d' },
};
