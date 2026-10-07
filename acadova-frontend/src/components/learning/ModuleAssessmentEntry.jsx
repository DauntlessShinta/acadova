import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import assessmentService from '../../services/assessmentService';
import AssessmentCard from './AssessmentCard';

export default function ModuleAssessmentEntry({ assessmentId, topicName, context }) {
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    assessmentService.get(assessmentId).then((response) => { if (active) setAssessment(response.data); })
      .catch((err) => { if (active) setError(err.message || 'This assessment is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assessmentId, attempt]);
  return <section className="learning-assessment" aria-labelledby="learning-assessment-heading">
    <h2 id="learning-assessment-heading">Check your learning</h2>
    <p>Review this module's resources, then answer the assessment questions. Review is recommended, and you can take the assessment whenever you are ready.</p>
    {loading ? <p role="status">Checking assessment availability...</p> : error ? <div className="card">
      <p role="alert">{error}</p><div className="assessment-card-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setError(''); setLoading(true); setAttempt((value) => value + 1); }}>Retry</button><Link className="btn btn-secondary btn-sm" to="/assessments">Browse assessments</Link></div>
    </div> : assessment && <AssessmentCard assessment={assessment} topicName={assessment.topic || topicName} context={context} headingLevel="h3" />}
    {!loading && !error && <p className="form-hint">A first passing result can earn credits once per assessment. Your submitted result confirms any credits awarded.</p>}
  </section>;
}
