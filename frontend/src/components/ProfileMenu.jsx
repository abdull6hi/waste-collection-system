import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from './Modal.jsx';
import { updateMyProfile, changeMyPassword } from '../api/users.js';
import { getMyProfile as fetchCollectorProfile } from '../api/collectors.js';
import { extractError } from '../api/client.js';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

/* ─── Edit Profile Modal ──────────────────────────────────────── */
function EditProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();

  const [name,         setName]         = useState(user?.name ?? '');
  const [email,        setEmail]        = useState(user?.email ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [collectorInfo,setCollectorInfo]= useState(null);
  const [profileErr,   setProfileErr]   = useState('');
  const [savingProfile,setSavingProfile]= useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdErr,     setPwdErr]     = useState('');
  const [savingPwd,  setSavingPwd]  = useState(false);

  useEffect(() => {
    if (user?.role === 'collector') {
      fetchCollectorProfile()
        .then(r => {
          setCollectorInfo(r.data.collector);
          setContactPhone(r.data.collector.contact_phone ?? '');
        })
        .catch(() => {});
    }
  }, [user?.role]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileErr('');
    setSavingProfile(true);
    try {
      const payload = { name: name.trim(), email: email.trim() };
      if (user?.role === 'collector') payload.contact_phone = contactPhone.trim();
      const res = await updateMyProfile(payload);
      const updated = res.data.user;
      updateUser({ ...user, ...updated });
      if (updated.contact_phone !== undefined) setContactPhone(updated.contact_phone ?? '');
      toast.success('Profile updated');
      onClose();
    } catch (err) {
      setProfileErr(extractError(err, 'Failed to update profile'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdErr('');
    if (newPwd !== confirmPwd) return setPwdErr('New passwords do not match');
    setSavingPwd(true);
    try {
      await changeMyPassword({ currentPassword: currentPwd, newPassword: newPwd });
      toast.success('Password changed');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setPwdErr(extractError(err, 'Failed to change password'));
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <Modal title="Edit Profile" onClose={onClose}>
      <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '0.25rem' }}>
        {/* ── Account section ── */}
        <form onSubmit={handleSaveProfile} style={s.formSection}>
          <h3 style={s.sectionHead}>Account</h3>

          <div style={s.readonlyField}>
            <span style={s.readonlyLabel}>Role</span>
            <span style={s.roleBadge}>{user?.role}</span>
          </div>

          <label style={s.label}>
            Name
            <input
              type="text" value={name} required maxLength={100}
              onChange={e => setName(e.target.value)}
              style={s.input}
            />
          </label>

          <label style={s.label}>
            Email
            <input
              type="email" value={email} required
              onChange={e => setEmail(e.target.value)}
              style={s.input}
            />
          </label>

          {/* Collector-specific fields */}
          {user?.role === 'collector' && (
            <>
              <label style={s.label}>
                Contact Phone
                <input
                  type="tel" value={contactPhone} maxLength={20}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+254 700 000 000"
                  style={s.input}
                />
              </label>
              {collectorInfo && (
                <div style={s.readonlyGroup}>
                  <p style={s.managedNote}>Managed by the county office</p>
                  <div style={s.readonlyField}>
                    <span style={s.readonlyLabel}>Company</span>
                    <span style={s.readonlyValue}>{collectorInfo.company_name}</span>
                  </div>
                  <div style={s.readonlyField}>
                    <span style={s.readonlyLabel}>Licence No.</span>
                    <span style={s.readonlyValue}>{collectorInfo.license_no}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Resident-specific fields */}
          {user?.role === 'resident' && (
            <div style={s.readonlyGroup}>
              <div style={s.readonlyField}>
                <span style={s.readonlyLabel}>Zone</span>
                <span style={s.readonlyValue}>
                  {user?.zone_id ? `Zone #${user.zone_id} — editable from dashboard` : 'Not set — editable from dashboard'}
                </span>
              </div>
            </div>
          )}

          {profileErr && <p style={s.err}>{profileErr}</p>}

          <button type="submit" disabled={savingProfile} style={{ ...s.btn, opacity: savingProfile ? 0.7 : 1 }}>
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.25rem 0' }} />

        {/* ── Change password section ── */}
        <form onSubmit={handleChangePassword} style={s.formSection}>
          <h3 style={s.sectionHead}>Change Password</h3>

          <label style={s.label}>
            Current password
            <input
              type="password" value={currentPwd} required
              onChange={e => setCurrentPwd(e.target.value)}
              autoComplete="current-password" style={s.input}
            />
          </label>

          <label style={s.label}>
            New password
            <input
              type="password" value={newPwd} required minLength={8}
              onChange={e => setNewPwd(e.target.value)}
              autoComplete="new-password" style={s.input}
            />
          </label>

          <label style={s.label}>
            Confirm new password
            <input
              type="password" value={confirmPwd} required
              onChange={e => setConfirmPwd(e.target.value)}
              autoComplete="new-password" style={s.input}
            />
          </label>

          {pwdErr && <p style={s.err}>{pwdErr}</p>}

          <button type="submit" disabled={savingPwd} style={{ ...s.btn, opacity: savingPwd ? 0.7 : 1 }}>
            {savingPwd ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    </Modal>
  );
}

/* ─── Profile Menu (avatar + dropdown) ───────────────────────── */
export default function ProfileMenu({ dropUp = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open,     setOpen]     = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/login');
  }

  const initials = getInitials(user?.name);

  return (
    <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Profile menu for ${user?.name}`}
        aria-haspopup="true"
        aria-expanded={open}
        style={s.avatarBtn}
      >
        {initials}
      </button>

      {open && (
        <div style={{ ...s.dropdown, ...(dropUp ? s.dropUp : s.dropDown) }}>
          <div style={s.dropHeader}>
            <p style={s.dropName}>{user?.name}</p>
            <p style={s.dropEmail}>{user?.email}</p>
            <span style={s.roleBadge}>{user?.role}</span>
          </div>
          <div style={s.dropDivider} />
          <button
            onClick={() => { setOpen(false); setShowEdit(true); }}
            style={s.dropItem}
          >
            Edit profile
          </button>
          <button onClick={handleLogout} style={{ ...s.dropItem, color: '#dc2626' }}>
            Log out
          </button>
        </div>
      )}

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
    </div>
  );
}

const s = {
  avatarBtn: {
    width: '2.25rem', height: '2.25rem',
    borderRadius: '9999px',
    background: '#16a34a', color: '#fff',
    border: 'none', cursor: 'pointer',
    fontFamily: "'Poppins', system-ui, sans-serif",
    fontSize: '0.8rem', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 150ms ease',
  },
  dropdown: {
    position: 'absolute', zIndex: 1000,
    background: '#fff', borderRadius: '0.75rem',
    boxShadow: '0 10px 25px rgb(0 0 0 / 0.12)',
    border: '1px solid #e5e7eb',
    minWidth: '200px', right: 0,
    overflow: 'hidden',
  },
  dropDown: { top: 'calc(100% + 0.5rem)' },
  dropUp:   { bottom: 'calc(100% + 0.5rem)' },
  dropHeader: {
    padding: '0.875rem 1rem 0.75rem',
  },
  dropName: { fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: '0.1rem' },
  dropEmail:{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' },
  roleBadge: {
    display: 'inline-block', padding: '0.15rem 0.55rem',
    background: '#f0fdf4', color: '#15803d',
    borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600,
    border: '1px solid #bbf7d0', textTransform: 'capitalize',
  },
  dropDivider: { height: '1px', background: '#e5e7eb' },
  dropItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '0.65rem 1rem', border: 'none',
    background: 'none', cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 500, color: '#374151',
    fontFamily: "'Poppins', system-ui, sans-serif",
    transition: 'background 120ms ease',
  },

  /* EditProfileModal styles */
  formSection: {
    display: 'flex', flexDirection: 'column', gap: '0.875rem',
    padding: '1.25rem 0',
  },
  sectionHead: {
    fontSize: '0.8rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: '0.35rem',
    fontSize: '0.875rem', fontWeight: 500, color: '#374151',
  },
  input: {
    padding: '0.6rem 0.75rem',
    border: '1.5px solid #d1d5db', borderRadius: '0.55rem',
    fontSize: '0.9rem', fontFamily: "'Poppins', system-ui, sans-serif",
    outline: 'none', background: '#fff',
  },
  readonlyGroup: {
    background: '#f9fafb', borderRadius: '0.55rem',
    border: '1px solid #e5e7eb', padding: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  readonlyField: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    flexWrap: 'wrap',
  },
  readonlyLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', minWidth: '80px' },
  readonlyValue: { fontSize: '0.875rem', color: '#374151' },
  managedNote: { fontSize: '0.72rem', color: '#9ca3af', marginBottom: '0.25rem' },
  err: { color: '#dc2626', fontSize: '0.82rem' },
  btn: {
    padding: '0.6rem 1rem',
    background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: '0.6rem',
    fontWeight: 600, fontSize: '0.875rem',
    cursor: 'pointer', fontFamily: "'Poppins', system-ui, sans-serif",
    alignSelf: 'flex-start',
  },
};
