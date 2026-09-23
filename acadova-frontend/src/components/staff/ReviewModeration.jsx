import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, MessageSquare, Star, UserRound } from 'lucide-react';
import moderationService from '../../services/moderationService';
import Alert from '../common/Alert';
import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';

const filters = [
  ['all', 'All reviews'], ['visible', 'Visible'], ['hidden', 'Hidden'],
];

export const ReviewModeration = () => {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await moderationService.getRatings();
      setReviews(response.data || []);
      setAvailable(true);
    } catch (err) {
      setAvailable(false);
      setError(err.message || 'Reviews could not be loaded.');
    } finally { setLoading(false); }
  };

  useEffect(() => { Promise.resolve().then(load); }, []);

  const visible = useMemo(() => reviews.filter((review) => (
    filter === 'all' || (filter === 'hidden' ? review.isHidden === true : review.isHidden !== true)
  )), [reviews, filter]);

  const changeVisibility = async (review) => {
    const hidden = review.isHidden !== true;
    if (!window.confirm(`${hidden ? 'Hide' : 'Restore'} this review? ${hidden ? 'It will stop contributing to public reputation.' : 'It will contribute to public reputation again.'}`)) return;
    try {
      setUpdatingId(review._id);
      setError('');
      setSuccess('');
      const response = await moderationService.setRatingVisibility(review._id, hidden);
      setReviews((current) => current.map((item) => item._id === review._id ? response.data : item));
      setSuccess(hidden ? 'Review hidden.' : 'Review restored.');
    } catch (err) {
      setError(err.message || 'Review visibility could not be updated.');
    } finally { setUpdatingId(''); }
  };

  return (
    <>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />
      <div className="card moderation-filters" aria-label="Review visibility filters">{filters.map(([key, label]) => <button type="button" key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {loading ? <LoadingSpinner text="Loading reviews..." size={34} /> : !available ? <EmptyState icon={MessageSquare} title="Reviews unavailable" description="Review data could not be loaded." actionText="Retry" onAction={load} /> : visible.length === 0 ? <EmptyState icon={MessageSquare} title="No reviews in this view" description="Choose another filter or check back after students submit reviews." /> : <div className="staff-review-list">{visible.map((review) => <article className="card staff-review-card" key={review._id}>
        <div className="staff-review-header"><div><div className="staff-review-meta"><Badge variant={review.isHidden ? 'danger' : 'active'}>{review.isHidden ? 'Hidden' : 'Visible'}</Badge><span><Star size={14} fill="currentColor" /> {review.rating}/5</span><time dateTime={review.createdAt}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : 'Date unavailable'}</time></div><h2>{review.session?.subject || 'Peer learning session'}</h2><p><UserRound size={15} /> From <strong>{review.fromUser?.name || 'Deleted account'}</strong> to <strong>{review.toUser?.name || 'Deleted account'}</strong></p></div><button type="button" className={`btn btn-sm ${review.isHidden ? 'btn-primary' : 'btn-secondary'}`} disabled={updatingId === review._id} onClick={() => changeVisibility(review)}>{review.isHidden ? <Eye size={15} /> : <EyeOff size={15} />}{updatingId === review._id ? 'Updating...' : review.isHidden ? 'Restore review' : 'Hide review'}</button></div>
        <blockquote>{review.comment || 'No written comment was provided.'}</blockquote>
        {review.moderatedAt && <p className="staff-review-audit">Last moderated by {review.moderatedBy?.name || 'authorized staff'} on {new Date(review.moderatedAt).toLocaleString()}.</p>}
      </article>)}</div>}
    </>
  );
};

export default ReviewModeration;
