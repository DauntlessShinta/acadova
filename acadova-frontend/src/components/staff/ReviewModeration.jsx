import { useConfirm } from '../../context/confirmAccess';
import { useToast } from '../../context/toastAccess';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const toast = useToast();
  const confirm = useConfirm();
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const mutationPending = useRef(false);

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
    if (mutationPending.current) return;
    const hidden = review.isHidden !== true;
    if (!await confirm(`${hidden ? 'Hide' : 'Restore'} this review? ${hidden ? 'It will stop contributing to public reputation.' : 'It will contribute to public reputation again.'}`,
      { title: hidden ? 'Hide review' : 'Restore review', label: hidden ? 'Hide review' : 'Restore review', destructive: hidden })) return;
    if (mutationPending.current) return;
    mutationPending.current = true;
    try {
      setUpdatingId(review._id);
      setError('');

      const response = await moderationService.setRatingVisibility(review._id, hidden);
      setReviews((current) => current.map((item) => item._id === review._id ? response.data : item));
      toast('success', hidden ? 'Review hidden.' : 'Review restored.');
    } catch (err) {
      toast('error', err.message || 'Review visibility could not be updated.');
    } finally { mutationPending.current = false; setUpdatingId(''); }
  };

  return (
    <>
      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="card moderation-filters" aria-label="Review visibility filters">{filters.map(([key, label]) => <button type="button" key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {loading ? <LoadingSpinner text="Loading reviews..." size={34} /> : !available ? <EmptyState icon={MessageSquare} title="Reviews unavailable" description="Review data could not be loaded." actionText="Retry" onAction={load} /> : visible.length === 0 ? <EmptyState icon={MessageSquare} title="No reviews in this view" description="Choose another filter or check back after students submit reviews." /> : <div className="staff-review-list">{visible.map((review) => <article className="card staff-review-card" key={review._id}>
        <div className="staff-review-header"><div><div className="staff-review-meta"><Badge variant={review.isHidden ? 'danger' : 'active'}>{review.isHidden ? 'Hidden' : 'Visible'}</Badge><span><Star size={14} fill="currentColor" /> {review.rating}/5</span><time dateTime={review.createdAt}>{review.createdAt ? new Date(review.createdAt).toLocaleString() : 'Date unavailable'}</time></div><h2>{review.session?.subject || 'Peer learning session'}</h2><p><UserRound size={15} /> From <strong>{review.fromUser?.name || 'Deleted account'}</strong> to <strong>{review.toUser?.name || 'Deleted account'}</strong></p></div><button type="button" className={`btn btn-sm ${review.isHidden ? 'btn-secondary' : 'btn-danger'}`} disabled={Boolean(updatingId)} onClick={() => changeVisibility(review)}>{review.isHidden ? <Eye size={15} /> : <EyeOff size={15} />}{updatingId === review._id ? 'Updating...' : review.isHidden ? 'Restore review' : 'Hide review'}</button></div>
        <blockquote>{review.comment || 'No written comment was provided.'}</blockquote>
        {review.moderatedAt && <p className="staff-review-audit">Last moderated by {review.moderatedBy?.name || 'authorized staff'} on {new Date(review.moderatedAt).toLocaleString()}.</p>}
      </article>)}</div>}
    </>
  );
};

export default ReviewModeration;
