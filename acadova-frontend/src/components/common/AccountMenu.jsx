import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronUp, LogOut, User } from 'lucide-react';
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
    const close = (event) => {
      if (event.type === 'keydown' && event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (event.type === 'pointerdown' && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const signOut = async () => {
    if (document.querySelector('[data-unsaved="true"]') && !await confirm('You have unsaved changes. Sign out and discard them?',
      { title: 'Unsaved changes', label: 'Discard and sign out' })) return;
    setOpen(false); logout(); navigate('/login', { replace: true });
  };
  return <div className={`account-menu${compact ? ' account-menu-compact' : ''}`} ref={root}>
    <button ref={trigger} type="button" className="account-trigger" aria-expanded={open} aria-controls={id}
      aria-label={compact ? `Account menu for ${user?.name || 'Student'}` : undefined} onClick={() => setOpen(!open)}><span className="account-avatar" aria-hidden="true">{user?.name?.charAt(0) || 'A'}</span>
      <span><strong>{user?.name || 'Your account'}</strong><small>{user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Student'}</small></span>
      <ChevronUp size={16} aria-hidden="true" /></button>
    {open && <div id={id} className="account-actions">
      {compact && <p className="account-menu-identity"><strong>{user?.name}</strong><small>Student</small></p>}
      {user?.role === 'student' && <Link to="/profile" onClick={() => setOpen(false)}><User size={17} aria-hidden="true" />Profile</Link>}
      <button type="button" onClick={signOut}><LogOut size={17} aria-hidden="true" />Sign out</button>
    </div>}
  </div>;
}
