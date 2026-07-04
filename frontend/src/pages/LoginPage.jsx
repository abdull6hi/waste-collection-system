import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client, { extractError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [step, setStep]     = useState('credentials'); // 'credentials' | 'otp'
  const [form, setForm]     = useState({ email: '', password: '' });
  const [code, setCode]     = useState('');
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCredentials(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/api/auth/login', form);
      if (res.data.token) {
        // 2FA disabled — logged in directly.
        login(res.data.token, res.data.user);
        navigate('/dashboard');
        return;
      }
      // 2FA enabled — move to code entry.
      setInfo(res.data.message || `We've sent a verification code to ${form.email}.`);
      setStep('otp');
    } catch (err) {
      setError(extractError(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/api/auth/verify-otp', { email: form.email, code });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(extractError(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      await client.post('/api/auth/resend-otp', { email: form.email });
      toast.success('A new code has been sent');
      setInfo(`A new verification code has been sent to ${form.email}.`);
      setCode('');
    } catch (err) {
      setError(extractError(err, 'Could not resend code'));
    } finally {
      setResending(false);
    }
  }

  function backToCredentials() {
    setStep('credentials');
    setCode('');
    setError('');
    setInfo('');
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>♻</span>
          <span style={styles.logoText}>WasteCoord</span>
        </div>

        {step === 'credentials' ? (
          <>
            <h1 style={styles.title}>Sign in</h1>
            <p style={styles.sub}>Welcome back — sign in to your account</p>

            <form onSubmit={handleCredentials} style={styles.form}>
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
          </>
        ) : (
          <>
            <h1 style={styles.title}>Enter your code</h1>
            <p style={styles.sub}>
              For your security, we've emailed a 6-digit code to{' '}
              <strong style={{ color: '#374151' }}>{form.email}</strong>. Enter it below to finish signing in.
            </p>

            <form onSubmit={handleVerify} style={styles.form}>
              <label style={styles.label} htmlFor="login-code">Verification code
                <input
                  id="login-code"
                  type="text" inputMode="numeric" autoComplete="one-time-code"
                  required maxLength={6} pattern="[0-9]{6}" autoFocus
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ ...styles.input, ...styles.codeInput }}
                  placeholder="000000"
                />
              </label>

              {info && <p style={styles.info}>{info}</p>}
              {error && <p role="alert" style={styles.error}>{error}</p>}

              <button type="submit" disabled={loading || code.length !== 6} style={styles.btn}>
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>
            </form>

            <div style={styles.otpActions}>
              <button type="button" onClick={handleResend} disabled={resending} style={styles.linkBtn}>
                {resending ? 'Sending…' : 'Resend code'}
              </button>
              <button type="button" onClick={backToCredentials} style={styles.linkBtn}>
                Use a different account
              </button>
            </div>
          </>
        )}
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
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' },
  logoIcon: { fontSize: '1.8rem' },
  logoText: { fontWeight: 700, fontSize: '1.1rem', color: '#15803d' },
  title: { fontSize: '1.6rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' },
  sub:   { color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.5 },
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
  codeInput: {
    letterSpacing: '0.5em',
    textAlign: 'center',
    fontSize: '1.4rem',
    fontWeight: 600,
    paddingLeft: '0.5em', // offset the trailing letter-spacing so digits look centred
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
  info: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '0.5rem',
    padding: '0.6rem 0.85rem',
    color: '#15803d',
    fontSize: '0.85rem',
  },
  otpActions: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: '1.25rem', gap: '0.5rem',
  },
  linkBtn: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit',
  },
  footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b7280' },
  link:   { color: '#16a34a', fontWeight: 600 },
};
