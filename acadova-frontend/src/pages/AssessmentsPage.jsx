import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import assessmentService from '../services/assessmentService';
import learningService from '../services/learningService';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import LearningNavigation from '../components/learning/LearningNavigation';
import AssessmentCard from '../components/learning/AssessmentCard';
import { candidateAssessmentTopic, learningReviewHref, verifiedAssessmentReview } from '../utils/assessmentLearning';
import { learningTopicTitle } from '../utils/discoverySearch';
import { useToast } from '../context/toastAccess';

export const AssessmentsPage = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openId = searchParams.get('open');
  const originTopic = searchParams.get('topic');
  const originModule = searchParams.get('module');
  const originLesson = searchParams.get('lesson');
  const { refreshUser } = useAuth();
  const [list, setList] = useState([]);
  const [topics, setTopics] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [topicNotice, setTopicNotice] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [assessmentLoading, setAssessmentLoading] = useState(Boolean(openId));
  const [assessmentError, setAssessmentError] = useState('');
  const [openAttempt, setOpenAttempt] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [working, setWorking] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const submissionPending = useRef(false);
  const viewVersion = useRef(0);
  const heading = useRef(null);
  useLayoutEffect(() => { if (selected && !assessmentLoading) heading.current?.focus({ preventScroll: true }); }, [selected, assessmentLoading]);

  useEffect(() => {
    let active = true;
    assessmentService.list().then((response) => { if (active) { setList(response.data || []); setListError(''); } })
      .catch((err) => { if (active) setListError(err.message || 'Assessments could not be loaded.'); })
      .finally(() => { if (active) setListLoading(false); });
    learningService.topics().then((response) => { if (active) { setTopics(response.data || []); setTopicNotice(''); } })
      .catch(() => { if (active) setTopicNotice('Learning topic links are unavailable. You can still take an assessment or browse Learning.'); });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    const version = ++viewVersion.current;
    Promise.resolve().then(async () => {
      if (viewVersion.current !== version) return;
      setSelected(null); setResult(null); setAnswers([]); setAnswerError(''); setAssessmentError('');
      setReview(null); setReviewNotice(''); setReviewLoading(false); setReviewingId(null);
      setAssessmentLoading(Boolean(openId));
      if (!openId) return;
      try {
        const response = await assessmentService.get(openId);
        if (viewVersion.current !== version) return;
        setSelected(response.data); setAnswers(Array(response.data.questions.length).fill(null));
      } catch (err) {
        if (viewVersion.current === version) setAssessmentError(err.message || 'This assessment is unavailable.');
      } finally {
        if (viewVersion.current === version) setAssessmentLoading(false);
      }
    });
    return () => { viewVersion.current = version + 1; };
  }, [openId, openAttempt]);

  const candidate = selected ? candidateAssessmentTopic(selected, topics) : null;
  const reviewTopicId = originTopic || candidate?.id;
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setReview(null); setReviewNotice('');
      if (!selected || !reviewTopicId) { setReviewLoading(false); return; }
      setReviewLoading(true);
      try {
        const topic = (await learningService.topic(reviewTopicId)).data;
        let module = null;
        if (originModule) {
          try { module = (await learningService.module(originModule)).data; }
          catch { /* A published topic can still be reviewed if its module is unavailable. */ }
        }
        if (!active) return;
        const context = verifiedAssessmentReview(selected.id, topic, module, originLesson);
        if (context) setReview({ context, title: context.moduleId ? module.title : learningTopicTitle(topic) });
        else setReviewNotice('A related learning topic could not be confirmed. Browse Learning for supporting material.');
      } catch {
        if (active) setReviewNotice('Related learning material could not be loaded. This assessment is still available directly.');
      } finally { if (active) setReviewLoading(false); }
    });
    return () => { active = false; };
  }, [selected, reviewTopicId, originModule, originLesson]);

  const reviewTopic = async (assessment) => {
    const topic = candidateAssessmentTopic(assessment, topics);
    if (!topic) return;
    const version = viewVersion.current;
    setReviewingId(assessment.id);
    try {
      const response = await learningService.topic(topic.id);
      if (version !== viewVersion.current) return;
      const context = verifiedAssessmentReview(assessment.id, response.data);
      if (context) navigate(learningReviewHref(context));
      else {
        toast('info', 'Browse published topics for related learning material.');
        navigate('/learning?' + new URLSearchParams({ q: assessment.topic }));
      }
    } catch {
      if (version === viewVersion.current) toast('error', 'Learning material could not be loaded. You can still take this assessment.');
    } finally { if (version === viewVersion.current) setReviewingId(null); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submissionPending.current) return;
    if (answers.some((answer) => answer === null)) {
      setAnswerError('Answer every question before submitting.');
      document.querySelector(`input[name="question-${answers.findIndex((answer) => answer === null)}"]`)?.focus();
      return;
    }
    submissionPending.current = true;
    const version = viewVersion.current;
    setWorking(true); setAnswerError('');
    try {
      const response = await assessmentService.submit(selected.id, answers);
      if (version === viewVersion.current) {
        setResult(response.data);
        toast(response.data.passed ? 'success' : 'info', response.data.passed ? 'Assessment passed. Your result is ready below.' : 'Attempt recorded. Review your result and try again when ready.');
      }
      await refreshUser();
    } catch (err) {
      if (version === viewVersion.current) toast('error', err.message || 'Your assessment could not be submitted. Please try again.');
    } finally { submissionPending.current = false; setWorking(false); }
  };

  const browseMaterials = '/learning' + (selected?.topic ? '?' + new URLSearchParams({ q: selected.topic }) : '');
  const materialActions = <div className="assessment-review-actions">
    {reviewLoading ? <p role="status">Finding related learning material...</p> : review
      ? <Link className="btn btn-secondary btn-sm" to={learningReviewHref(review.context)}>Review {review.context.moduleId ? 'module' : 'topic'}</Link>
      : <Link className="btn btn-secondary btn-sm" to={browseMaterials}>Browse learning</Link>}
    {review && <span className="learning-item-meta">{review.title}</span>}
  </div>;

  return <div className="assessments-page">
    <header className="learning-page-header">
      <nav className="learning-breadcrumbs" aria-label="Learning breadcrumb"><ol>
        <li><Link className="text-link" to="/learning">Learning</Link></li>
        <li>{openId ? <Link className="text-link" to="/assessments">Assessments</Link> : <span aria-current="page">Assessments</span>}</li>
        {openId && <li aria-current="page">{selected?.title || 'Assessment'}</li>}
      </ol></nav>
      <h1 ref={heading} tabIndex={-1}>{openId ? selected?.title || 'Assessment' : 'Assessments'}</h1>
      <p>{openId ? 'Review the related material, or answer the questions when you are ready.' : 'Check your understanding. Review a topic first or take an assessment directly.'}</p>
    </header>
    <LearningNavigation disabled={working} />
    <p className="assessment-hub-note">Assessments are free. Earn credits once per assessment, on your first pass. Your submitted result confirms the award.</p>
    {!openId ? <>
      <Alert type="warning" message={topicNotice} />
      {listLoading ? <LoadingSpinner text="Loading assessments..." /> : listError ? <>
        <Alert type="danger" message={listError} /><EmptyState title="Assessments unavailable" description="Try loading the published assessment list again." actionText="Retry" onAction={() => { setListLoading(true); setLoadAttempt((value) => value + 1); }} />
      </> : list.length === 0 ? <div className="card"><h2>No published assessments yet</h2><p>Explore Learning while staff prepare assessments.</p><Link className="btn btn-secondary" to="/learning">Browse learning</Link></div>
        : <div className="assessment-hub-list">{list.map((item) => <AssessmentCard key={item.id} assessment={item}
          onReview={candidateAssessmentTopic(item, topics) ? reviewTopic : undefined} reviewBusy={reviewingId === item.id} />)}</div>}
    </> : assessmentLoading ? <LoadingSpinner text="Loading assessment..." /> : assessmentError ? <>
      <Alert type="danger" message={assessmentError} /><div className="assessment-review-actions"><button type="button" className="btn btn-secondary" onClick={() => { setAssessmentLoading(true); setOpenAttempt((value) => value + 1); }}>Retry assessment</button><Link className="btn btn-secondary" to="/assessments">Back to assessments</Link></div>
    </> : selected && <section className="card assessment-workspace" aria-label="Assessment questions and result">
      <Link className="btn btn-secondary btn-sm" to="/assessments" aria-disabled={working || undefined} onClick={(event) => { if (working) event.preventDefault(); }}>Back to assessments</Link>
      <h2>{result ? 'Assessment result' : 'Questions'}</h2><p className="learning-item-meta">{selected.topic} · {selected.questionCount} questions · Free assessment</p>
      {materialActions}{reviewNotice && <p className="form-hint">{reviewNotice}</p>}
      {result ? <div className="assessment-result" role="status">
        <h3>{result.passed ? 'Passed' : 'Not passed yet'}</h3><p>Score: {result.score}%</p>
        <p>{result.rewardIssued ? `+${result.creditsAwarded} credits earned` : 'No credits awarded for this attempt.'}</p>
        {!result.rewardIssued && result.passed && <p>You already earned the one-time reward for this assessment.</p>}
        <div className="assessment-card-actions"><Link to="/credits" className="btn btn-secondary btn-sm">View credit wallet</Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setResult(null); setAnswerError(''); setAnswers(Array(selected.questions.length).fill(null)); }}>Try again</button></div>
      </div> : <form onSubmit={submit}>
        <p>Choose one answer for every question. Your answers are graded after you submit.</p>
        {selected.questions.map((question, index) => <fieldset className="card" key={index} disabled={working} aria-describedby={answerError && answers[index] === null ? 'assessment-answer-error' : undefined}>
          <legend><strong>{index + 1}. {question.prompt}</strong></legend>
          {question.options.map((option, optionIndex) => <label key={optionIndex} className="assessment-option">
            <input type="radio" name={`question-${index}`} checked={answers[index] === optionIndex}
              onChange={() => setAnswers((current) => current.map((answer, i) => i === index ? optionIndex : answer))} /> {option}
          </label>)}
        </fieldset>)}
        {answerError && <p id="assessment-answer-error" className="form-error" role="alert">{answerError}</p>}
        <button type="submit" className="btn btn-primary" disabled={working} aria-describedby={answerError ? 'assessment-answer-error' : undefined}>{working ? 'Submitting...' : 'Submit answers'}</button>
      </form>}
    </section>}
  </div>;
};

export default AssessmentsPage;
