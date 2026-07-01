import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '2rem',
          background: '#f9fafb', fontFamily: "'Poppins', system-ui, sans-serif",
        }}>
          <div style={{
            background: '#fff', border: '1.5px solid #fecaca', borderRadius: '1rem',
            padding: '2.5rem 2rem', maxWidth: '420px', textAlign: 'center',
            boxShadow: '0 4px 16px rgb(0 0 0 / 0.06)',
          }}>
            <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.6rem 1.5rem', background: '#16a34a', color: '#fff',
                border: 'none', borderRadius: '0.6rem', fontWeight: 600,
                cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
