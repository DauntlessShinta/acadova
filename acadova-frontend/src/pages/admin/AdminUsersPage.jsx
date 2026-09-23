import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, Users } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    if (!window.confirm(prompt)) return;
    try {
      setUpdatingId(account._id);
      setError('');
      setSuccess('');
      const response = await analyticsService.updateUserRole(account._id, nextRole);
      setUsers((current) => current.map((item) => item._id === account._id ? response.data : item));
      setSuccess(nextRole === 'moderator' ? 'User promoted to Moderator.' : 'Moderator returned to Student.');
    } catch (err) {
      setError(err.message || 'User role could not be updated.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Users</span><h1>User management</h1><p>Manage Moderator access while protecting Administrator accounts.</p></div></header>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />
      <div className="card staff-filter-bar">
        <label className="admin-search"><span className="sr-only">Search users by name or email</span><Search size={16} /><input type="search" className="form-input" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="staff-filter-select">Role <select className="form-select" value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option><option value="student">Students</option><option value="moderator">Moderators</option><option value="admin">Administrators</option></select></label>
      </div>
      {loading ? <LoadingSpinner text="Loading users..." size={34} /> : !available ? <EmptyState icon={Users} title="User directory unavailable" description="User data could not be loaded." actionText="Retry" onAction={load} /> : filtered.length === 0 ? <EmptyState icon={Search} title="No users match your filters" description="Try a different name, email address, or role." /> : (
        <div className="table-responsive"><table className="table admin-user-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead><tbody>
          {filtered.map((account) => <tr key={account._id}><td><strong>{account.name}</strong></td><td className="admin-user-email">{account.email}</td><td><Badge status={account.role}>{account.role === 'admin' ? 'Administrator' : account.role === 'moderator' ? 'Moderator' : 'Student'}</Badge></td><td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'Unavailable'}</td><td>{account.role === 'admin' ? <span className="protected-label"><ShieldCheck size={14} /> Protected</span> : <button type="button" className={`btn btn-sm ${account.role === 'moderator' ? 'btn-secondary' : 'btn-primary'}`} disabled={updatingId === account._id} onClick={() => changeRole(account)}>{updatingId === account._id ? 'Updating...' : account.role === 'moderator' ? 'Return to Student' : 'Promote to Moderator'}</button>}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
};

export default AdminUsersPage;
