import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react';
import moderationService from '../services/moderationService';
import Alert from '../components/common/Alert';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';

const filters = [
  { value: 'all', label: 'All reviews' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];

export const ModeratorDashboardPage = () => {
  const [ratings, setRatings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    moderationService.getRatings()
      .then((response) => {
        if (!active) return;
        setRatings(response?.data || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Unable to load reviews for moderation');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredRatings = useMemo(() => ratings.filter((review) => {
    if (filter === 'hidden') return review.isHidden === true;
    if (filter === 'visible') return review.isHidden !== true;
    return true;
  }), [filter, ratings]);

  const hiddenCount = ratings.filter((review) => review.isHidden === true).length;

  const refreshRatings = async () => {
    setLoading(true);
    try {
      const response = await moderationService.getRatings();
      setError('');
      setRatings(response?.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load reviews for moderation');
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityChange = async (review) => {
    const nextHidden = review.isHidden !== true;
    const action = nextHidden ? 'hide' : 'restore';
    if (!window.confirm(`Are you sure you want to ${action} this review?`)) return;

    try {
      setUpdatingId(review._id);
      setError('');
      setSuccess('');
      const response = await moderationService.setRatingVisibility(review._id, nextHidden);
      setRatings((current) => current.map((item) => (
        item._id === review._id ? response.data : item
      )));
      setSuccess(nextHidden ? 'Review hidden from reputation results.' : 'Review restored to reputation results.');
    } catch (err) {
      setError(err.message || `Unable to ${action} this review`);
    } finally {
      setUpdatingId('');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading review moderation queue..." size={36} />;
  }

  return (
    <div className="staff-dashboard moderator-dashboard">
      <header className="staff-page-header" id="overview">
        <div>
          <span className="staff-eyebrow"><ShieldCheck size={17} /> Community trust tools</span>
          <h1>Acadova Moderator</h1>
          <p>
            Review peer feedback and control whether inappropriate reviews contribute to public reputation.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={refreshRatings}>
          <RefreshCw size={15} /> Refresh reviews
        </button>
      </header>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card">
          <span style={{ color: 'var(--acadova-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Total queue</span>
          <strong className="mono" style={{ display: 'block', marginTop: 6, color: 'var(--acadova-primary)', fontSize: '1.8rem' }}>{ratings.length}</strong>
        </div>
        <div className="card">
          <span style={{ color: 'var(--acadova-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Visible reviews</span>
          <strong className="mono" style={{ display: 'block', marginTop: 6, color: 'var(--acadova-success)', fontSize: '1.8rem' }}>{ratings.length - hiddenCount}</strong>
        </div>
        <div className="card">
          <span style={{ color: 'var(--acadova-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Hidden reviews</span>
          <strong className="mono" style={{ display: 'block', marginTop: 6, color: 'var(--acadova-action)', fontSize: '1.8rem' }}>{hiddenCount}</strong>
        </div>
      </div>

      <section id="reviews" aria-labelledby="reviews-heading">
        <div className="section-heading-row moderator-section-heading">
          <div>
            <span className="section-kicker">Reviews</span>
            <h2 id="reviews-heading">Review moderation</h2>
          </div>
        </div>

        <div className="card moderation-filters" aria-label="Review visibility filters">
          {filters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`btn btn-sm ${filter === item.value ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredRatings.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews in this view"
          description="Reviews will appear here after students rate completed sessions."
        />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filteredRatings.map((review) => {
            const isHidden = review.isHidden === true;
            return (
              <article
                className="card"
                key={review._id}
                style={{
                  borderColor: isHidden ? 'var(--acadova-soft-blue)' : 'var(--border-subtle)',
                  background: isHidden ? 'var(--acadova-tint)' : '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <Badge variant={isHidden ? 'danger' : 'active'}>{isHidden ? 'Hidden' : 'Visible'}</Badge>
                      <span className="mono" style={{ color: 'var(--acadova-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                        <Star size={14} fill="currentColor" style={{ verticalAlign: '-2px' }} /> {review.rating}/5
                      </span>
                      <span style={{ color: 'var(--acadova-muted)', fontSize: '0.78rem' }}>
                        {review.createdAt ? new Date(review.createdAt).toLocaleString() : 'Date unavailable'}
                      </span>
                    </div>
                    <h2 style={{ margin: '0 0 5px', color: 'var(--acadova-primary)', fontSize: '1.05rem' }}>
                      {review.session?.subject || 'Peer learning session'}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, color: 'var(--acadova-muted)', fontSize: '0.82rem' }}>
                      <UserRound size={15} />
                      <span>From <strong>{review.fromUser?.name || 'Deleted account'}</strong></span>
                      <span aria-hidden="true">→</span>
                      <span>For <strong>{review.toUser?.name || 'Deleted account'}</strong></span>
                    </div>
                    {review.fromUser?.email && (
                      <div className="mono" style={{ marginTop: 5, color: 'var(--acadova-muted)', fontSize: '0.74rem' }}>
                        {review.fromUser.email}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`btn btn-sm ${isHidden ? 'btn-primary' : 'btn-secondary'}`}
                    disabled={updatingId === review._id}
                    onClick={() => handleVisibilityChange(review)}
                  >
                    {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                    {updatingId === review._id ? 'Updating...' : isHidden ? 'Restore review' : 'Hide review'}
                  </button>
                </div>

                <blockquote style={{ margin: '18px 0 0', padding: '14px 16px', borderLeft: '3px solid var(--acadova-action)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', color: 'var(--acadova-text)', background: '#ffffff', fontSize: '0.9rem', lineHeight: 1.65 }}>
                  {review.comment || 'No written comment was provided.'}
                </blockquote>

                {review.moderatedAt && (
                  <p style={{ margin: '12px 0 0', color: 'var(--acadova-muted)', fontSize: '0.75rem' }}>
                    Last moderated by {review.moderatedBy?.name || 'an authorized moderator'} on {new Date(review.moderatedAt).toLocaleString()}.
                  </p>
                )}
              </article>
            );
          })}
        </div>
        )}
      </section>
    </div>
  );
};

export default ModeratorDashboardPage;
