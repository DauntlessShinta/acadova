import { useConfirm } from '../../context/confirmAccess';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, Users } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [available, setAvailable] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await analyticsService.getAdminUsers();
      setUsers(response.data || []);
      setAvailable(true);
    } catch (err) {
      setAvailable(false);
      setError(err.message || 'User data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { Promise.resolve().then(load); }, []);

  const filtered = useMemo(() => users.filter((account) => {
    const query = search.trim().toLowerCase();
    return (role === 'all' || account.role === role)
      && (!query || [account.name, account.email].some((value) => value?.toLowerCase().includes(query)));
  }), [users, search, role]);

  const changeRole = async (account) => {
    if (account.role === 'admin') return;
    const nextRole = account.role === 'moderator' ? 'student' : 'moderator';
    const prompt = nextRole === 'moderator'
      ? `Promote ${account.name} to Moderator? They will gain review moderation access.`
      : `Return ${account.name} to Student? They will lose review moderation access.`;
    if (!await confirm(prompt, { title: 'Change account role', label: nextRole === 'moderator' ? 'Promote to Moderator' : 'Remove Moderator role', destructive: nextRole !== 'moderator' })) return;
    try {
      setUpdatingId(account._id);
      setError('');
      const response = await analyticsService.updateUserRole(account._id, nextRole);
      setUsers((current) => current.map((item) => item._id === account._id ? response.data : item));
      toast('success', nextRole === 'moderator' ? 'User promoted to Moderator.' : 'Moderator returned to Student.');
    } catch (err) {
      toast('error', err.message || 'User role could not be updated.');
    } finally {
      setUpdatingId('');
    }
  };

  const changeStatus = async (account) => {
    if (account.role === 'admin') return;
    const suspended = Boolean(account.suspendedAt);
    let reason;
    if (suspended) {
      if (!await confirm(`Reactivate ${account.name}? Their existing login can access the app again.`, { title: 'Reactivate user', label: 'Reactivate', destructive: false })) return;
    } else {
      reason = await confirm(`Suspend ${account.name}? Existing tokens will lose access immediately.`,
        { title: 'Suspend user', label: 'Suspend user', input: true, minLength: 10, maxLength: 500 });
      if (!reason) return;
    }
    try {
      setUpdatingId(account._id); setError('');
      const response = await analyticsService.updateUserStatus(account._id,
        suspended ? 'active' : 'suspended', reason);
      setUsers((current) => current.map((item) => item._id === account._id ? response.data : item));
      toast('success', suspended ? 'Account reactivated.' : 'Account suspended.');
    } catch (err) { toast('error', err.message || 'Account status could not be updated.'); }
    finally { setUpdatingId(''); }
  };

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Users</span><h1>User management</h1><p>Manage Moderator access and account status while protecting Administrator accounts.</p></div></header>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="card staff-filter-bar">
        <label className="admin-search"><span className="sr-only">Search users by name or email</span><Search size={16} /><input type="search" className="form-input" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="staff-filter-select">Role <select className="form-select" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option><option value="student">Students</option><option value="moderator">Moderators</option><option value="admin">Administrators</option></select></label>
      </div>
      {loading ? <LoadingSpinner text="Loading users..." size={34} /> : !available ? <EmptyState icon={Users} title="User directory unavailable" description="User data could not be loaded." actionText="Retry" onAction={load} /> : filtered.length === 0 ? <EmptyState icon={Search} title="No users match your filters" description="Try a different name, email address, or role." /> : (
        <div className="table-responsive"><table className="table admin-user-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Status</th><th>Security</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
          {filtered.map((account) => <tr key={account._id}><td><strong>{account.name}</strong></td><td className="admin-user-email">{account.email}</td><td><Badge status={account.role}>{account.role === 'admin' ? 'Administrator' : account.role === 'moderator' ? 'Moderator' : 'Student'}</Badge></td><td>{account.emailVerified === false ? 'No' : account.emailVerified === true ? 'Yes' : 'Legacy / unknown'}</td><td>{account.suspendedAt ? 'Suspended' : 'Active'}</td><td><span>{account.failedLoginAttempts || 0} recent failures</span><br /><span>{account.loginCooldownUntil && new Date(account.loginCooldownUntil) > new Date() ? `Cooldown until ${new Date(account.loginCooldownUntil).toLocaleString()}` : 'No active cooldown'}</span></td><td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'Unavailable'}</td><td>{account.role === 'admin' ? <span className="protected-label"><ShieldCheck size={14} /> Protected</span> : <div className="session-dispute-actions"><button type="button" className={`btn btn-sm ${account.role === 'moderator' ? 'btn-secondary' : 'btn-primary'}`} disabled={updatingId === account._id} onClick={() => changeRole(account)}>{updatingId === account._id ? 'Updating...' : account.role === 'moderator' ? 'Return to Student' : 'Promote to Moderator'}</button><button type="button" className="btn btn-secondary btn-sm" disabled={updatingId === account._id} onClick={() => changeStatus(account)}>{account.suspendedAt ? 'Reactivate' : 'Suspend'}</button></div>}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
};

export default AdminUsersPage;
