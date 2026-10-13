import { useConfirm } from '../../context/confirmAccess';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSearchDraft } from '../../utils/useSearchDraft';
import { Search, ShieldCheck, Users, ChevronDown } from 'lucide-react';
import Modal from '../../components/common/Modal';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/toastAccess';

export const AdminUsersPage = () => {
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [params, setParams] = useSearchParams();
  const draft = useSearchDraft(params, setParams);
  const search = draft.value;
  const role = params.get('role') || 'all';
  const status = params.get('status') || 'all';
  const page = Number(params.get('page')) || 1;
  const [pagination, setPagination] = useState(null);
  const generation = useRef({ value: 0 });
  const query = params.toString();
  const filter = (key, value) => { const next = new URLSearchParams(params); if (value === 'all') next.delete(key); else next.set(key, value); next.delete('page'); setParams(next); };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [actionAccount, setActionAccount] = useState(null);
  const [available, setAvailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const mutationPending = useRef(false);

  const load = useCallback(async () => {
    const ticket = ++generation.current.value;
    setLoading(true);
    setError('');
    try {
      const response = await analyticsService.getAdminUsers(Object.fromEntries(new URLSearchParams(query)));
      if (ticket !== generation.current.value) return;
      setPagination(response.pagination || { total: response.data?.length || 0, pages: 1 });
      setUsers(response.data || []);
      setAvailable(true);
    } catch (err) {
      if (ticket !== generation.current.value) return;
      setAvailable(false);
      setError(err.message || 'User data could not be loaded.');
    } finally {
      if (ticket === generation.current.value) setLoading(false);
    }
  }, [query]);

  useEffect(() => { Promise.resolve().then(load); const state = generation.current; return () => { state.value++; }; }, [load, revision]);
  const filtered = users;

  const changeRole = async (account) => {
    if (account.role === 'admin' || mutationPending.current) return;
    const nextRole = account.role === 'moderator' ? 'student' : 'moderator';
    const prompt = nextRole === 'moderator'
      ? `Promote ${account.name} to Moderator? They will gain review moderation access. Active Sessions must be completed, cancelled, or resolved first.`
      : `Return ${account.name} to Student? They will lose review moderation access.`;
    if (!await confirm(prompt, { title: 'Change account role', label: nextRole === 'moderator' ? 'Promote to Moderator' : 'Remove Moderator role', destructive: nextRole !== 'moderator' })) return;
    if (mutationPending.current) return;
    mutationPending.current = true;
    try {
      setUpdatingId(account._id);
      setError('');
      const response = await analyticsService.updateUserRole(account._id, nextRole);
      setUsers((current) => current.map((item) => item._id === account._id ? response.data : item));
      setRevision(value => value + 1);
      toast('success', nextRole === 'moderator' ? 'User promoted to Moderator.' : 'Moderator returned to Student.');
    } catch (err) {
      setError(err.message || 'User role could not be updated.');
      toast('error', err.message || 'User role could not be updated.');
    } finally {
      mutationPending.current = false;
      setUpdatingId('');
    }
  };

  const changeStatus = async (account) => {
    if (account.role === 'admin' || mutationPending.current) return;
    const suspended = Boolean(account.suspendedAt);
    let reason;
    if (suspended) {
      if (!await confirm(`Reactivate ${account.name}? Their existing login can access the app again.`, { title: 'Reactivate user', label: 'Reactivate', destructive: false })) return;
    } else {
      reason = await confirm(`Suspend ${account.name}? Existing tokens will lose access immediately.`,
        { title: 'Suspend user', label: 'Suspend user', input: true, minLength: 10, maxLength: 500 });
      if (!reason) return;
    }
    if (mutationPending.current) return;
    mutationPending.current = true;
    try {
      setUpdatingId(account._id); setError('');
      const response = await analyticsService.updateUserStatus(account._id,
        suspended ? 'active' : 'suspended', reason);
      setUsers((current) => current.map((item) => item._id === account._id ? response.data : item));
      setRevision(value => value + 1);
      toast('success', suspended ? 'Account reactivated.' : 'Account suspended.');
    } catch (err) { setError(err.message || 'Account status could not be updated.'); toast('error', err.message || 'Account status could not be updated.'); }
    finally { mutationPending.current = false; setUpdatingId(''); }
  };

  return (
    <div className="staff-page user-directory-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Users</span><h1>User management</h1><p>Manage Moderator access and account status while protecting Administrator accounts.</p></div></header>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="card staff-filter-bar staff-directory-filters">
        <label className="admin-search"><span className="sr-only">Search users by name or email</span><Search size={16} /><input type="search" className="form-input" maxLength={80} placeholder="Search name or email" value={search} onChange={(event) => draft.change(event.target.value)} /></label>
        <label className="staff-filter-select">Role <select className="form-select" value={role} onChange={(event) => filter('role', event.target.value)}><option value="all">All roles</option><option value="student">Students</option><option value="moderator">Moderators</option><option value="admin">Administrators</option></select></label>
        <label className="staff-filter-select">Account status <select className="form-select" value={status} onChange={event => filter('status', event.target.value)}><option value="all">All accounts</option><option value="active">Not suspended</option><option value="suspended">Suspended</option><option value="unverified">Awaiting verification</option></select></label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setParams({}); }}>Clear filters</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading || Boolean(updatingId)} onClick={load}>Refresh directory</button>
      </div>
      {!loading && available && <p className="form-hint" role="status">{users.length} of {pagination?.total ?? users.length} matching accounts · Page {page}. Student accounts can learn and teach; Learner/Tutor are Session relationships.</p>}
      {loading ? <LoadingSpinner text="Loading users..." size={34} /> : !available ? <EmptyState icon={Users} title="User directory unavailable" description="User data could not be loaded." actionText="Retry" onAction={load} /> : filtered.length === 0 ? <EmptyState icon={Search} title="No users match your filters" description="Try a different name, email address, or role." /> : (
        <div className="table-responsive" tabIndex={0} role="region" aria-label="User directory. On narrow screens, scroll within this table for account actions."><table className="table admin-user-table"><caption className="sr-only">Accounts and authorized management actions. Expand Account details for verification, security and joining date.</caption><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
          {filtered.map((account) => <tr key={account._id}><td><strong>{account.name}</strong><details className="account-detail-disclosure"><summary>Account details<span className="sr-only"> for {account.name}</span></summary><dl>
            <dt>Verification</dt><dd>{account.emailVerified === false ? 'Awaiting verification' : account.emailVerified === true ? 'Verified' : 'Legacy / unknown'}</dd>
            <dt>Security</dt><dd>{account.failedLoginAttempts ?? 0} recent failures<br />{account.loginCooldownUntil && new Date(account.loginCooldownUntil) > new Date() ? `Cooldown until ${new Date(account.loginCooldownUntil).toLocaleString()}` : 'No active cooldown'}</dd>
            <dt>Joined</dt><dd>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'Unavailable'}</dd>
          </dl></details></td><td className="admin-user-email">{account.email}</td><td><Badge status={account.role}>{account.role === 'admin' ? 'Administrator' : account.role === 'moderator' ? 'Moderator' : 'Student'}</Badge></td><td>{account.suspendedAt ? 'Suspended' : 'Active'}</td><td>{account.role === 'admin' ? <span className="protected-label"><ShieldCheck size={14} aria-hidden="true" /> Protected</span> : ['student', 'moderator'].includes(account.role) && <button type="button" className="btn btn-secondary btn-sm user-actions-trigger" aria-haspopup="dialog" aria-label={`Actions for ${account.name}`} disabled={Boolean(updatingId)} onClick={() => setActionAccount(account)}>{updatingId === account._id ? 'Updating…' : 'Actions'}<ChevronDown size={16} aria-hidden="true" /></button>}</td></tr>)}
        </tbody></table></div>
      )}
      <div className="staff-filter-actions" aria-label="Directory pages"><button className="btn btn-secondary btn-sm" disabled={loading || page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next); }}>Previous</button><button className="btn btn-secondary btn-sm" disabled={loading || page >= (pagination?.pages || 1)} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next); }}>Next</button></div>
      <Modal isOpen={Boolean(actionAccount)} onClose={() => setActionAccount(null)} title={`Actions for ${actionAccount?.name || 'account'}`} maxWidth="420px">
        {actionAccount && <div className="user-action-choices"><p>Choose an action. Changes require confirmation and are recorded in the audit log.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setActionAccount(null); changeRole(actionAccount); }}>{actionAccount.role === 'moderator' ? 'Return to Student' : 'Promote to Moderator'}</button>
          <button type="button" className={`btn ${actionAccount.suspendedAt ? 'btn-secondary' : 'btn-danger'}`} onClick={() => { setActionAccount(null); changeStatus(actionAccount); }}>{actionAccount.suspendedAt ? 'Reactivate' : 'Suspend'}</button>
        </div>}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
