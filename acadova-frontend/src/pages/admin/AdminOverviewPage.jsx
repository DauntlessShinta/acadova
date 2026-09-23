import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, ShieldCheck, UserCog, Users } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatCard from '../../components/common/StatCard';

export const AdminOverviewPage = () => {
  const [data, setData] = useState({ users: null, sessions: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [users, sessions] = await Promise.allSettled([
      analyticsService.getAdminUsers(),
      analyticsService.getSessionAnalytics(),
    ]);
    setData({
      users: users.status === 'fulfilled' ? users.value.data : null,
      sessions: sessions.status === 'fulfilled' ? sessions.value.data : null,
    });
    if (users.status === 'rejected' || sessions.status === 'rejected') setError('Some overview data could not be loaded.');
    setLoading(false);
  };

  useEffect(() => { Promise.resolve().then(load); }, []);

  const users = data.users;
  const counts = users ? {
    students: users.filter((account) => account.role === 'student').length,
    moderators: users.filter((account) => account.role === 'moderator').length,
  } : null;

  return (
    <div className="staff-page">
      <header className="staff-page-header">
        <div><span className="staff-eyebrow"><ShieldCheck size={17} /> Platform administration</span><h1>Acadova Administration</h1><p>Platform overview and management.</p></div>
      </header>
      <Alert type="danger" message={error} />
      {loading ? <LoadingSpinner text="Loading platform overview..." size={34} /> : (
        <>
          <div className="stat-grid admin-summary-grid">
            <StatCard title="Total Users" value={users ? users.length : 'Unavailable'} icon={Users} color="var(--acadova-primary)" />
            <StatCard title="Students" value={counts ? counts.students : 'Unavailable'} icon={BookOpen} color="var(--acadova-action)" />
            <StatCard title="Moderators" value={counts ? counts.moderators : 'Unavailable'} icon={UserCog} color="var(--acadova-primary)" />
            <StatCard title="Sessions" value={data.sessions ? data.sessions.total : 'Unavailable'} icon={Activity} color="var(--acadova-success)" />
          </div>
          <div className="staff-quick-links" aria-label="Administration sections">
            <Link className="card" to="/admin/users"><Users size={19} /> Manage users <span aria-hidden="true">→</span></Link>
            <Link className="card" to="/admin/sessions"><Activity size={19} /> View sessions <span aria-hidden="true">→</span></Link>
            <Link className="card" to="/admin/analytics"><BookOpen size={19} /> View analytics <span aria-hidden="true">→</span></Link>
          </div>
          {error && <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Retry unavailable data</button>}
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;
