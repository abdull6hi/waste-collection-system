import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS = { LOADING: 'loading', OK: 'ok', ERROR: 'error' };

export default function StatusPage() {
  const { user, logout, isAuthenticated } = useAuth();
  const [status, setStatus] = useState(STATUS.LOADING);
  const [timestamp, setTimestamp] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    client.get('/api/health')
      .then(res => {
        setTimestamp(new Date(res.data.timestamp).toLocaleString());
        setStatus(STATUS.OK);
      })
      .catch(err => {
        const msg = err.response?.data?.message || err.message;
        setErrorMsg(msg);
        setStatus(STATUS.ERROR);
      });
  }, []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>♻</span>
          <span style={styles.logoText}>WasteCoord Nairobi</span>
        </div>
        <div style={styles.headerRight}>
          {isAuthenticated ? (
            <>
              <span style={styles.userChip}>
                {user?.name} · <em>{user?.role}</em>
              </span>
              <button onClick={logout} style={styles.logoutBtn}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login"    style={styles.navLink}>Sign in</Link>
              <Link to="/register" style={{ ...styles.navLink, ...styles.navLinkPrimary }}>Register</Link>
            </>
          )}
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>System Status</h1>
          <p style={styles.heroSub}>Real-time health of the waste collection platform</p>
        </div>

        <div style={styles.cardWrap}>
          {status === STATUS.LOADING && (
            <div style={{ ...styles.card, ...styles.cardLoading }}>
              <div style={styles.spinner} />
              <p style={styles.cardLabel}>Checking connection…</p>
            </div>
          )}

          {status === STATUS.OK && (
            <div style={{ ...styles.card, ...styles.cardOk }}>
              <div style={styles.iconCircle('#f0fdf4', '#16a34a')}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={styles.cardTitle}>All systems operational</h2>
              <p style={styles.cardDesc}>Database connected and responding normally.</p>
              <div style={styles.metaRow}>
                <span style={styles.badge('#dcfce7', '#15803d')}>● Live</span>
                <span style={styles.metaTs}>DB time: {timestamp}</span>
              </div>
            </div>
          )}

          {status === STATUS.ERROR && (
            <div style={{ ...styles.card, ...styles.cardError }}>
              <div style={styles.iconCircle('#fef2f2', '#dc2626')}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 style={{ ...styles.cardTitle, color: '#dc2626' }}>Database unreachable</h2>
              <p style={styles.cardDesc}>The backend could not connect to PostgreSQL.</p>
              <div style={styles.errorBox}>
                <code style={styles.errorCode}>{errorMsg}</code>
              </div>
            </div>
          )}

          <div style={styles.checks}>
            <CheckRow label="Backend API" ok={status !== STATUS.LOADING} active={status === STATUS.OK} />
            <CheckRow label="PostgreSQL"  ok={status !== STATUS.LOADING} active={status === STATUS.OK} />
            <CheckRow label="React App"   ok active />
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        <p>Nairobi County Waste Collection Coordination System · Step 1 Foundation</p>
      </footer>
    </div>
  );
}

function CheckRow({ label, ok, active }) {
  const color = !ok ? '#9ca3af' : active ? '#16a34a' : '#dc2626';
  const icon  = !ok ? '○' : active ? '✓' : '✗';
  return (
    <div style={styles.checkRow}>
      <span style={{ color, fontWeight: 600, fontSize: '1rem', minWidth: '1.2rem' }}>{icon}</span>
      <span style={{ color: '#374151', fontSize: '0.9rem' }}>{label}</span>
    </div>
  );
}

/* ── inline styles (avoids extra CSS file for a single page) ── */
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Poppins', system-ui, sans-serif",
    background: 'linear-gradient(135deg, #f0fdf4 0%, #f9fafb 50%, #eff6ff 100%)',
  },
  header: {
    padding: '1rem 2rem',
    background: '#fff',
    boxShadow: '0 1px 3px rgb(0 0 0 / 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  userChip: { fontSize: '0.85rem', color: '#6b7280' },
  logoutBtn: {
    padding: '0.35rem 0.85rem',
    background: 'transparent',
    border: '1.5px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#374151',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  navLink: { fontSize: '0.875rem', color: '#374151', fontWeight: 500 },
  navLinkPrimary: {
    background: '#16a34a', color: '#fff',
    padding: '0.35rem 0.85rem', borderRadius: '0.5rem',
    fontWeight: 600, textDecoration: 'none',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  logoIcon: { fontSize: '1.6rem' },
  logoText: { fontWeight: 700, fontSize: '1.1rem', color: '#15803d', letterSpacing: '-0.01em' },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem 1rem',
    gap: '2rem',
  },
  hero: { textAlign: 'center' },
  heroTitle: { fontSize: '2rem', fontWeight: 700, color: '#111827', marginBottom: '0.4rem' },
  heroSub: { color: '#6b7280', fontSize: '1rem' },
  cardWrap: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    boxShadow: '0 10px 25px rgb(0 0 0 / 0.07)',
    textAlign: 'center',
  },
  cardOk:      { borderTop: '4px solid #16a34a' },
  cardError:   { borderTop: '4px solid #dc2626' },
  cardLoading: { borderTop: '4px solid #d1d5db', minHeight: '180px', justifyContent: 'center' },
  cardTitle: { fontSize: '1.2rem', fontWeight: 600, color: '#111827' },
  cardDesc:  { fontSize: '0.9rem', color: '#6b7280' },
  cardLabel: { color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.5rem' },
  metaRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.25rem' },
  metaTs:  { fontSize: '0.8rem', color: '#6b7280' },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    width: '100%',
    textAlign: 'left',
  },
  errorCode: { fontSize: '0.8rem', color: '#dc2626', wordBreak: 'break-all' },
  checks: {
    background: '#fff',
    borderRadius: '0.75rem',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    boxShadow: '0 2px 8px rgb(0 0 0 / 0.05)',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #16a34a',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  footer: {
    textAlign: 'center',
    padding: '1.25rem',
    color: '#9ca3af',
    fontSize: '0.8rem',
    borderTop: '1px solid #e5e7eb',
    background: '#fff',
  },
  iconCircle: (bg, color) => ({
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px solid ${color}22`,
  }),
  badge: (bg, color) => ({
    background: bg,
    color,
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.65rem',
    borderRadius: '9999px',
  }),
};
