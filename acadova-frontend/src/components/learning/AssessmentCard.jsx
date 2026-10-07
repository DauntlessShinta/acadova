import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { assessmentHref, learningReviewHref } from '../../utils/assessmentLearning';

export default function AssessmentCard({ assessment, topicName, context, onReview, reviewBusy = false, headingLevel = 'h2' }) {
  const titleId = useId();
  const Heading = headingLevel;
  return <article className="card assessment-card" aria-labelledby={titleId}>
    <div className="assessment-card-heading"><Heading id={titleId}>{assessment.title}</Heading><span className="badge badge-info">Free assessment</span></div>
    <p className="learning-item-meta">{topicName || assessment.topic}{Number.isInteger(assessment.questionCount) && <span>{assessment.questionCount} questions</span>}</p>
    <p className="assessment-recommendation">{context?.moduleId ? "Recommended: review this module's resources first. Reviewing is optional." : onReview || context
      ? `Recommended: review ${topicName || assessment.topic || 'related learning'} materials first. Reviewing is optional.`
      : 'Review related learning materials if available, or take this assessment directly.'}</p>
    <div className="assessment-card-actions">
      {onReview && <button type="button" className="btn btn-secondary btn-sm" disabled={reviewBusy} onClick={() => onReview(assessment)}>{reviewBusy ? 'Loading topic...' : 'Review topic'}</button>}
      {!onReview && <Link className="btn btn-secondary btn-sm" to={learningReviewHrefForCard(context, assessment.topic)}>{context ? 'Review topic' : 'Browse learning'}</Link>}
      <Link className="btn btn-primary btn-sm" to={assessmentHref(assessment.id, context)} aria-label={`Take assessment: ${assessment.title}`}>Take assessment <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
  </article>;
}

function learningReviewHrefForCard(context, topic) {
  return context?.topicId ? learningReviewHref({ topicId: context.topicId })
    : '/learning' + (topic ? '?' + new URLSearchParams({ q: topic }) : '');
}
