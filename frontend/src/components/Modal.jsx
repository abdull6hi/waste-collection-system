import { useEffect } from 'react';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.dialog} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>{title}</h2>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">✕</button>
        </div>
        <div style={s.body}>{children}</div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgb(0 0 0 / 0.35)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#fff', borderRadius: '1rem',
    boxShadow: '0 25px 50px rgb(0 0 0 / 0.15)',
    width: '100%', maxWidth: '440px', margin: '1rem',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e5e7eb',
  },
  title: { fontSize: '1rem', fontWeight: 600, color: '#111827' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1rem',
    color: '#9ca3af', cursor: 'pointer', padding: '0.25rem',
    fontFamily: 'inherit',
  },
  body: { padding: '1.5rem' },
};
