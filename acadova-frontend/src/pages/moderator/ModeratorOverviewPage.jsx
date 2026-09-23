import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import moderationService from '../../services/moderationService';
import Alert from '../../components/common/Alert';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatCard from '../../components/common/StatCard';

export const ModeratorOverviewPage = () => {
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await moderationService.getRatings();
      setReviews(response.data || []);
    } catch (err) { setReviews(null); setError(err.message || 'Moderation data could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { Promise.resolve().then(load); }, []);
  const hidden = reviews?.filter((review) => review.isHidden === true).length;
  return <div className="staff-page"><header className="staff-page-header"><div><span className="staff-eyebrow"><ShieldCheck size={17} /> Community trust tools</span><h1>Moderator overview</h1><p>Review visibility in the recent moderation queue.</p></div></header><Alert type="danger" message={error} />{loading ? <LoadingSpinner text="Loading moderation overview..." size={34} /> : reviews === null ? <EmptyState icon={ShieldCheck} title="Moderation data unavailable" description="Review data could not be loaded." actionText="Retry" onAction={load} /> : <><div className="stat-grid staff-overview-grid"><StatCard title="Visible reviews" value={reviews.length - hidden} icon={Eye} color="var(--acadova-success)" /><StatCard title="Hidden reviews" value={hidden} icon={EyeOff} color="var(--acadova-primary)" /></div><p className="staff-data-note">Counts reflect the most recent reviews returned by the moderation service.</p><Link to="/moderator/reviews" className="btn btn-primary staff-overview-link">Review moderation <span aria-hidden="true">→</span></Link></>}</div>;
};

export default ModeratorOverviewPage;
