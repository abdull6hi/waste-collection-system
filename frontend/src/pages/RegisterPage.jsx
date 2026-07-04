import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client, { extractError } from '../api/client.js';
import { getPublicZones, getPublicZoneCollectors } from '../api/zones.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  // Role is always 'resident' for public registration.
  // Officials are provisioned by existing officials via the admin panel.
  // Collectors are created by officials via the Collectors management page.
  const [form, setForm]     = useState({ name: '', email: '', password: '', zone_id: '', contact_phone: '', collector_id: '' });
  const [zones, setZones]   = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [collectors, setCollectors]     = useState([]);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPublicZones()
      .then(res => setZones(res.data.zones))
      .catch(() => setZones([]))
      .finally(() => setZonesLoading(false));
  }, []);

  // Load the approved collectors for the selected zone (id + company_name only).
  useEffect(() => {
    if (!form.zone_id) { setCollectors([]); return; }
    let active = true;
    getPublicZoneCollectors(form.zone_id)
      .then(res => { if (active) setCollectors(res.data.collectors); })
      .catch(() => { if (active) setCollectors([]); });
    return () => { active = false; };
  }, [form.zone_id]);

  function handleChange(e) {
    const { name, value } = e.target;
    // Changing zone invalidates any collector choice — reset it.
    setForm(f => name === 'zone_id' ? { ...f, zone_id: value, collector_id: '' } : { ...f, [name]: value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (!form.zone_id) {
      return setError('Please select your collection zone');
    }
    if (!form.contact_phone.trim()) {
      return setError('Please enter a contact phone');
    }
    setLoading(true);
    try {
      const res = await client.post('/api/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        zone_id: Number(form.zone_id),
        contact_phone: form.contact_phone.trim(),
        ...(form.collector_id ? { collector_id: Number(form.collector_id) } : {}),
      });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(extractError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>♻</span>
          <span style={styles.logoText}>WasteCoord</span>
        </div>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.sub}>Join the Nairobi waste coordination platform as a resident</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="reg-name">Full name
            <input
              id="reg-name"
              type="text" name="name" required autoComplete="name"
              value={form.name} onChange={handleChange}
              style={styles.input} placeholder="Ada Okafor"
            />
          </label>

          <label style={styles.label} htmlFor="reg-email">Email address
            <input
              id="reg-email"
              type="email" name="email" required autoComplete="email"
              value={form.email} onChange={handleChange}
              style={styles.input} placeholder="you@example.com"
            />
          </label>

          <label style={styles.label} htmlFor="reg-password">Password
            <input
              id="reg-password"
              type="password" name="password" required autoComplete="new-password"
              value={form.password} onChange={handleChange}
              style={styles.input} placeholder="Min. 8 characters"
            />
          </label>

          <label style={styles.label} htmlFor="reg-zone">Collection zone
            <select
              id="reg-zone"
              name="zone_id" required
              value={form.zone_id} onChange={handleChange}
              style={styles.input}
              disabled={zonesLoading}
            >
              <option value="" disabled>
                {zonesLoading ? 'Loading zones…' : zones.length ? 'Select your zone…' : 'No zones available'}
              </option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>

          <label style={styles.label} htmlFor="reg-phone">Contact phone
            <input
              id="reg-phone"
              type="tel" name="contact_phone" required autoComplete="tel"
              value={form.contact_phone} onChange={handleChange}
              style={styles.input} placeholder="+254 700 000 000" maxLength={20}
            />
          </label>

          {form.zone_id && collectors.length > 0 && (
            <label style={styles.label} htmlFor="reg-collector">
              Preferred collector <span style={styles.optional}>(optional — we'll assign one for your zone if you skip this)</span>
              <select
                id="reg-collector"
                name="collector_id"
                value={form.collector_id} onChange={handleChange}
                style={styles.input}
              >
                <option value="" disabled>Select a collector…</option>
                {collectors.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </label>
          )}

          {error && <p role="alert" style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #f9fafb 60%, #eff6ff 100%)',
    fontFamily: "'Poppins', system-ui, sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '1.25rem',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 20px 40px rgb(0 0 0 / 0.08)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' },
  logoIcon: { fontSize: '1.8rem' },
  logoText: { fontWeight: 700, fontSize: '1.1rem', color: '#15803d' },
  title: { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' },
  sub:   { color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.75rem' },
  form:  { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  label: {
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
    fontSize: '0.875rem', fontWeight: 500, color: '#374151',
  },
  input: {
    padding: '0.65rem 0.9rem',
    border: '1.5px solid #d1d5db',
    borderRadius: '0.6rem',
    fontSize: '0.95rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  btn: {
    marginTop: '0.25rem',
    padding: '0.75rem',
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '0.65rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    padding: '0.6rem 0.85rem',
    color: '#dc2626',
    fontSize: '0.875rem',
  },
  footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b7280' },
  link:   { color: '#16a34a', fontWeight: 600 },
  optional: { fontWeight: 400, color: '#9ca3af', fontSize: '0.78rem' },
};
