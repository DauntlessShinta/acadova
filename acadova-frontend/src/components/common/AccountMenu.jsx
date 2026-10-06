import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/confirmAccess';

export default function AccountMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    if (root.current?.closest('.staff-sidebar')) {
      root.current.querySelector('.account-actions')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const close = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (event.type === 'pointerdown' && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const signOut = async () => {
    const unsaved = Boolean(document.querySelector('[data-unsaved="true"]'));
    if (!await confirm("You'll need to sign in again to continue using your account."
      + (unsaved ? '\nYour unsaved changes will be discarded.' : ''),
    { title: 'Sign out of Acadova?', label: 'Sign out', cancelLabel: 'Stay signed in' })) return;
    setOpen(false); logout(); navigate('/login', { replace: true });
  };
  return <div className={`account-menu${compact ? ' account-menu-compact' : ''}`} ref={root}>
    <button ref={trigger} type="button" className="account-trigger" aria-expanded={open} aria-controls={id}
      aria-label={`Account menu for ${user?.name || 'Your account'}`} onClick={() => setOpen(!open)}><span className="account-avatar" aria-hidden="true">{user?.name?.charAt(0) || 'A'}</span>
      <span><strong>{user?.name || 'Your account'}</strong><small>{user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Student'}</small></span>
      <ChevronDown size={16} aria-hidden="true" /></button>
    {open && <div id={id} className="account-actions">
      {compact && <p className="account-menu-identity"><strong>{user?.name}</strong><small>{user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Student'}</small></p>}
      {user?.role === 'student' && <Link to="/profile" onClick={() => setOpen(false)}><User size={17} aria-hidden="true" />Profile</Link>}
      <button type="button" onClick={signOut}><LogOut size={17} aria-hidden="true" />Sign out</button>
    </div>}
  </div>;
}
