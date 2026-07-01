import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client, { extractError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/api/auth/login', form);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      const msg = extractError(err, 'Login failed');
      setError(msg);
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
        <h1 style={styles.title}>Sign in</h1>
        <p style={styles.sub}>Welcome back — sign in to your account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="login-email">Email address
            <input
              id="login-email"
              type="email" name="email" required autoComplete="email"
              value={form.email} onChange={handleChange}
              style={styles.input}
              placeholder="you@example.com"
            />
          </label>

          <label style={styles.label} htmlFor="login-password">Password
            <input
              id="login-password"
              type="password" name="password" required autoComplete="current-password"
              value={form.password} onChange={handleChange}
              style={styles.input}
              placeholder="••••••••"
            />
          </label>

          {error && <p role="alert" style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/register" style={styles.link}>Create one</Link>
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
    padding: '1rem',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #f9fafb 60%, #eff6ff 100%)',
    fontFamily: "'Poppins', system-ui, sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '1.25rem',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 40px rgb(0 0 0 / 0.08)',
    borderTop: '4px solid #16a34a',
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
    transition: 'border-color 150ms',
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
    transition: 'background 150ms',
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
};
