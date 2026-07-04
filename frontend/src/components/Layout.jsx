import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ProfileMenu from './ProfileMenu.jsx';

const NAV = {
  official: [
    { to: '/dashboard',   label: 'Dashboard' },
    { to: '/collectors',  label: 'Collectors' },
    { to: '/zones',       label: 'Zones' },
    { to: '/schedules',   label: 'Schedules' },
    { to: '/tracking',    label: 'Tracking' },
    { to: '/complaints',  label: 'Complaints' },
    { to: '/reports',     label: 'Reports' },
  ],
  collector: [
    { to: '/dashboard',   label: 'Dashboard' },
    { to: '/my-pickups',  label: 'My Pickups' },
    { to: '/my-residents', label: 'My Residents' },
  ],
  resident: [
    { to: '/dashboard',   label: 'Dashboard' },
  ],
};

export default function Layout({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const links = NAV[user?.role] ?? [];

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .layout-sidebar {
            position: fixed !important;
            left: 0; top: 0; bottom: 0;
            transform: translateX(-100%);
            transition: transform 200ms ease;
            z-index: 200;
          }
          .layout-sidebar.open {
            transform: translateX(0);
            box-shadow: 4px 0 24px rgb(0 0 0 / 0.12);
          }
          .layout-overlay {
            display: block !important;
          }
          .layout-hamburger {
            display: flex !important;
          }
          .layout-main {
            padding-left: 0 !important;
          }
          .layout-topbar {
            display: none !important;
          }
        }
        .layout-overlay { display: none; position: fixed; inset: 0; background: rgb(0 0 0/0.35); z-index: 199; }
        .layout-hamburger { display: none; align-items: center; padding: 0.75rem 1rem; background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; gap: 0.75rem; }
      `}</style>

      <div style={s.shell}>
        {/* Mobile overlay */}
        {open && <div className="layout-overlay" onClick={() => setOpen(false)} />}

        {/* Mobile top bar */}
        <div className="layout-hamburger">
          <button onClick={() => setOpen(o => !o)} style={s.hamburgerBtn} aria-label="Toggle navigation">
            <span style={s.hbar} /><span style={s.hbar} /><span style={s.hbar} />
          </button>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#15803d', flex: 1 }}>♻ WasteCoord</span>
          <ProfileMenu />
        </div>

        {/* Sidebar */}
        <aside className={`layout-sidebar${open ? ' open' : ''}`} style={s.sidebar}>
          <div style={s.brand}>
            <span style={s.brandIcon}>♻</span>
            <span style={s.brandText}>WasteCoord</span>
          </div>

          <nav style={s.nav} aria-label="Main navigation">
            {links.map(({ to, label }) => (
              <NavLink
                key={to} to={to}
                onClick={() => setOpen(false)}
                style={({ isActive }) => ({ ...s.navLink, ...(isActive ? s.navLinkActive : {}) })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={s.userBlock}>
            <p style={s.userName}>{user?.name}</p>
            <p style={s.userRole}>{user?.role}</p>
          </div>
        </aside>

        {/* Main column: top header + page content */}
        <div style={s.mainCol}>
          {/* Desktop top header */}
          <header className="layout-topbar" style={s.topbar}>
            <span style={s.topbarBrand}>♻ WasteCoord</span>
            <ProfileMenu />
          </header>

          <main className="layout-main" style={s.main}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

const s = {
  shell: {
    display: 'flex', minHeight: '100vh',
    fontFamily: "'Poppins', system-ui, sans-serif",
    background: '#f9fafb',
  },
  sidebar: {
    width: '220px', minHeight: '100vh',
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column',
    padding: '1.5rem 1rem',
    position: 'sticky', top: 0, height: '100vh',
    flexShrink: 0, overflowY: 'auto',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    marginBottom: '2rem', padding: '0 0.5rem',
  },
  brandIcon: { fontSize: '1.5rem' },
  brandText: { fontWeight: 700, fontSize: '1rem', color: '#15803d' },
  nav: { display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 },
  navLink: {
    display: 'block', padding: '0.55rem 0.75rem',
    borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 500,
    color: '#374151', textDecoration: 'none',
    transition: 'background 150ms, color 150ms',
  },
  navLinkActive: { background: '#f0fdf4', color: '#15803d', fontWeight: 600 },
  userBlock: {
    borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem',
  },
  userName: { fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: '0.1rem' },
  userRole: {
    fontSize: '0.75rem', color: '#6b7280', textTransform: 'capitalize',
  },
  mainCol: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 2rem',
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    position: 'sticky', top: 0, zIndex: 10,
  },
  topbarBrand: { fontWeight: 700, fontSize: '0.95rem', color: '#15803d' },
  main: { flex: 1, overflowY: 'auto', minWidth: 0 },
  hamburgerBtn: {
    display: 'flex', flexDirection: 'column', gap: '4px',
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
  },
  hbar: {
    display: 'block', width: '22px', height: '2px',
    background: '#374151', borderRadius: '2px',
  },
};
