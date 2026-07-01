import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #f9fafb 60%, #eff6ff 100%)',
      fontFamily: "'Poppins', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: '1.25rem', padding: '3rem 2.5rem',
        maxWidth: '440px', textAlign: 'center',
        boxShadow: '0 20px 40px rgb(0 0 0 / 0.08)', borderTop: '4px solid #16a34a',
      }}>
        <p style={{ fontSize: '4rem', fontWeight: 700, color: '#16a34a', lineHeight: 1, marginBottom: '0.5rem' }}>404</p>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>Page not found</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/" style={{
          display: 'inline-block', padding: '0.65rem 1.5rem',
          background: '#16a34a', color: '#fff', borderRadius: '0.65rem',
          fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none',
        }}>
          Go home
        </Link>
      </div>
    </div>
  );
}
