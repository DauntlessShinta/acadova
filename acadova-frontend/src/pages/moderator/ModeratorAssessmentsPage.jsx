import { useConfirm } from '../../context/confirmAccess';
import WorkflowTabs from '../../components/common/WorkflowTabs';
import { Link, useLocation } from 'react-router-dom';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import assessmentService from '../../services/assessmentService';
import learningService from '../../services/learningService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { staffLearningHash } from '../../utils/staffLearningNavigation';
import '../../components/learning/learningWorkspace.css';
import { useToast } from '../../context/toastAccess';

const emptyQuestion = () => ({ prompt: '', options: ['', '', ''], correctIndex: 0 });
const initialDraft = () => ({ title: '', topic: '', passingScore: 60,
  questions: [emptyQuestion(), emptyQuestion(), emptyQuestion()] });

export const ModeratorAssessmentsPage = () => {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const topicId = params.get('topic');
  const openId = params.get('open');
  const createRequested = params.has('create');
  const staffLabel = pathname.startsWith('/admin') ? 'Administration' : 'Moderator';
  const staffBase = pathname.startsWith('/admin') ? '/admin' : '/moderator';
  const confirm = useConfirm();
  const toast = useToast();
  const [section, setSection] = useState(createRequested ? 'builder' : openId ? 'review' : 'drafts');
  const [draft, setDraft] = useState(initialDraft);
  const [assessments, setAssessments] = useState([]);
  const [learningTopics, setLearningTopics] = useState([]);
  const [review, setReview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const mutationPending = useRef(false);
  const [questionKeys, setQuestionKeys] = useState([0, 1, 2]);
  const nextQuestionKey = useRef(3);
  const pendingFocus = useRef(null);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const input = document.getElementById(pendingFocus.current);
    pendingFocus.current = null;
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: 'nearest' });
  }, [draft]);

  const replaceDraft = (next) => {
    setQuestionKeys(next.questions.map(() => nextQuestionKey.current++));
    setDraft(next);
  };
  const addQuestion = () => {
    const key = nextQuestionKey.current++;
    setQuestionKeys((current) => [...current, key]);
    pendingFocus.current = `assessment-prompt-${draft.questions.length}`;
    setDraft((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }));
  };
  const removeQuestion = (index) => {
    setQuestionKeys((current) => current.filter((_, i) => i !== index));
    pendingFocus.current = `assessment-prompt-${Math.min(index, draft.questions.length - 2)}`;
    setDraft((current) => ({ ...current, questions: current.questions.filter((_, i) => i !== index) }));
  };

  const load = async () => {
    try { const response = await assessmentService.staffList(); setAssessments(response.data || []); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    Promise.resolve().then(load);
    learningService.staffTopics().then((response) => setLearningTopics((response.data || []).filter((item) => item.status === 'published')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true; Promise.resolve().then(() => { if (!active) return; setReview(null); setEditingId(null);
    setSection(createRequested ? 'builder' : openId ? 'review' : 'drafts');
    if (openId) assessmentService.staffGet(openId).then((response) => { if (active) setReview(response.data); })
      .catch((err) => { if (active) setError(err.message); });
    if (createRequested && topicId) learningService.staffTopic(topicId).then((response) => {
      if (active) setDraft((current) => ({ ...current, learningTopic: response.data.id, topic: response.data.name }));
    }).catch((err) => { if (active) setError(err.message); });
    });
    return () => { active = false; };
  }, [topicId, openId, createRequested]);

  const updateQuestion = (index, changes) => setDraft((current) => ({
    ...current, questions: current.questions.map((question, i) => i === index ? { ...question, ...changes } : question),
  }));
  const create = async (event) => {
    event.preventDefault();
    if (mutationPending.current) return;
    mutationPending.current = true; setWorking(true); setError('');
    try {
      if (editingId) await assessmentService.update(editingId, draft);
      else await assessmentService.create(draft);
      replaceDraft(initialDraft()); setEditingId(null);
      toast('success', editingId ? 'Draft updated. Review it before publishing.'
        : 'Draft created. Review it before publishing.'); await load();
    } catch (err) { const message = err.message || 'Check each question, option, correct answer, and topic, then try again.'; setError(message); toast('error', message); }
    finally { mutationPending.current = false; setWorking(false); }
  };
  const publish = async (id) => {
    if (mutationPending.current) return;
    if (!await confirm(`Publish "${review?.title || 'this assessment'}" for Students? Assessments are free to take. Questions and answers cannot be changed afterward.`, { title: 'Publish assessment', label: 'Publish assessment', destructive: false })) return;
    if (mutationPending.current) return;
    mutationPending.current = true; setWorking(true); setError('');
    try { await assessmentService.publish(id); toast('success', 'Assessment published.');
      setReview((current) => current?.id === id ? { ...current, status: 'published' } : current);
      await load(); }
    catch (err) { toast('error', err.message || 'Assessment could not be published.'); }
    finally { mutationPending.current = false; setWorking(false); }
  };
  const reviewAssessment = async (id) => {
    setWorking(true); setError('');
    try { const response = await assessmentService.staffGet(id); setReview(response.data); setSection('review'); }
    catch (err) { toast('error', err.message || 'The assessment draft could not be opened.'); }
    finally { setWorking(false); }
  };

  return <div className="staff-page learning-management-page learning-assessment-management">
    <header className="staff-page-header"><div><span className="staff-eyebrow">{staffLabel} / Learning</span>
      <h1>Assessments</h1><p>Create a short multiple-choice assessment, then publish it for Students.</p>
      <Link className="btn btn-secondary" to={`${staffBase}/learning${topicId ? `?topic=${encodeURIComponent(topicId)}#manage-panel-assessments` : staffLearningHash('modules')}`}>{topicId ? 'Back to Topic Assessments' : 'Return to learning modules'}</Link></div></header>
    <Alert type="danger" message={error} />
    <WorkflowTabs id="assessment-management" tabs={[['drafts', 'All assessments'], ['builder', 'Create / edit'], ['review', 'Review']]} active={section} onChange={setSection} />
    <div role="tabpanel" id="assessment-management-panel-drafts" aria-labelledby="assessment-management-tab-drafts" hidden={section !== 'drafts'} className="card"><h2>Assessment library</h2>
      {loading ? <LoadingSpinner text="Loading assessments..." /> : assessments.length === 0
        ? error ? <p>Assessment drafts are unavailable. <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Retry</button></p> : <p>No assessments yet.</p> : assessments.filter((item) => !topicId || (Object.hasOwn(item, 'learningTopic') ? item.learningTopic === topicId : item.topic === learningTopics.find((topic) => topic.id === topicId)?.name)).map((item) => <div key={item.id}
          style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, padding: '12px 0' }}>
          <div><strong>{item.title}</strong><p>{item.topic} · {item.questionCount} questions · {item.status}</p></div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={working}
            onClick={() => reviewAssessment(item.id)}>Review</button>
        </div>)}
    </div>
    <section role="tabpanel" id="assessment-management-panel-review" aria-labelledby="assessment-management-tab-review" hidden={section !== 'review'}>
    {!review && <p>Select a draft to review its questions and publishing options.</p>}
    {review && <div className="card" style={{ marginTop: 20 }}>
      <h2>{review.title}</h2><p>{review.topic} · {review.status} · Pass at {review.passingScore}%</p>
      {review.questions.map((question, index) => <div key={index}>
        <h3>{index + 1}. {question.prompt}</h3>
        <p>Correct answer: {question.options[question.correctIndex]}</p>
        <p>Options: {question.options.join(' / ')}</p>
      </div>)}
      {review.status === 'draft' && <button type="button" className="btn btn-primary btn-sm"
        disabled={working} onClick={() => publish(review.id)}>Publish reviewed draft</button>}
      {review.status === 'draft' && <button type="button" className="btn btn-secondary btn-sm"
        disabled={working} onClick={() => {
          replaceDraft({ title: review.title, topic: review.topic, passingScore: review.passingScore,
            ...(review.learningTopic ? { learningTopic: review.learningTopic } : {}),
            questions: review.questions.map((question) => ({ ...question, options: [...question.options] })) });
          setEditingId(review.id); setSection('builder');
          setReview(null);
        }}>Edit draft</button>}
    </div>}
    </section>
    <form role="tabpanel" id="assessment-management-panel-builder" aria-labelledby="assessment-management-tab-builder" hidden={section !== 'builder'} className="card assessment-editor" onSubmit={create}>
      <div className="assessment-editor-intro">
      <h2>{editingId ? 'Edit assessment draft' : 'Create assessment draft'}</h2>
      <p>Use 3–10 questions, 2–5 options per question, and select one correct answer.</p>
      {editingId && <button type="button" className="btn btn-secondary btn-sm"
        onClick={() => { replaceDraft(initialDraft()); setEditingId(null); }}>Cancel edit</button>}
      </div>
      <div className="assessment-editor-metadata">
      <div className="assessment-field">
      <label className="form-label" htmlFor="assessment-title">Title</label>
      <input id="assessment-title" className="form-input" value={draft.title} required minLength={3} maxLength={120}
        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
      </div><div className="assessment-field">
      <label className="form-label" htmlFor="assessment-topic">Topic</label>
      <input id="assessment-topic" className="form-input" value={draft.topic} required minLength={2} maxLength={80}
        disabled={Boolean(draft.learningTopic)}
        onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))} />
      </div><div className="assessment-field">
      <label className="form-label" htmlFor="assessment-learning-topic">Governed learning topic (optional)</label>
      <select id="assessment-learning-topic" className="form-input" value={draft.learningTopic || ''}
        onChange={(event) => setDraft((current) => {
          const selected = learningTopics.find((item) => item.id === event.target.value);
          const next = { ...current, topic: selected?.name || current.topic };
          if (selected) next.learningTopic = selected.id;
          else delete next.learningTopic;
          return next;
        })}>
        <option value="">Legacy topic text only</option>
        {learningTopics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p className="form-hint">Select the module's published learning topic to attach this assessment to its curriculum after publication.</p>
      </div><div className="assessment-field">
      <label className="form-label" htmlFor="assessment-passing">Passing score (%)</label>
      <input id="assessment-passing" className="form-input" type="number" min="1" max="100" value={draft.passingScore}
        onChange={(event) => setDraft((current) => ({ ...current, passingScore: Number(event.target.value) }))} />
      </div></div>
      <div className="assessment-question-list">
      {draft.questions.map((question, index) => <fieldset className="card assessment-question" key={questionKeys[index]}>
        <legend>Question {index + 1}</legend>
        <div className="assessment-question-fields">
        <div className="assessment-field">
        <label className="form-label" htmlFor={`assessment-prompt-${index}`}>Prompt</label>
        <input id={`assessment-prompt-${index}`} className="form-input" value={question.prompt} required minLength={5} maxLength={300}
          onChange={(event) => updateQuestion(index, { prompt: event.target.value })} />
        </div>
        {question.options.map((option, optionIndex) => <div className="assessment-field" key={optionIndex}>
          <label className="form-label" htmlFor={`assessment-option-${index}-${optionIndex}`}>Option {optionIndex + 1}</label>
          <input id={`assessment-option-${index}-${optionIndex}`} className="form-input" value={option} required maxLength={150}
            onChange={(event) => updateQuestion(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} />
        </div>)}
        <div className="assessment-field">
        <label className="form-label" htmlFor={`assessment-answer-${index}`}>Correct option</label>
        <select id={`assessment-answer-${index}`} className="form-input" value={question.correctIndex}
          onChange={(event) => updateQuestion(index, { correctIndex: Number(event.target.value) })}>
          {question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}
        </select>
        </div>
        <div className="learning-builder-actions">
          <button type="button" className="btn btn-secondary btn-sm"
            disabled={question.options.length >= 5} onClick={() => {
              pendingFocus.current = `assessment-option-${index}-${question.options.length}`;
              updateQuestion(index, { options: [...question.options, ''] });
            }}>Add option</button>
          <button type="button" className="btn btn-secondary btn-sm"
            disabled={question.options.length <= 2} onClick={() => {
              pendingFocus.current = `assessment-option-${index}-${question.options.length - 2}`;
              updateQuestion(index, { options: question.options.slice(0, -1),
                correctIndex: Math.min(question.correctIndex, question.options.length - 2) });
            }}>Remove last option</button>
          <button type="button" className="btn btn-danger btn-sm"
            disabled={draft.questions.length <= 3} onClick={() => removeQuestion(index)}>Remove question</button>
        </div>
        </div>
      </fieldset>)}
      </div>
      <div className="learning-builder-actions assessment-editor-actions">
        <button type="button" className="btn btn-secondary"
          disabled={draft.questions.length >= 10} onClick={addQuestion}>
          Add question</button>
        <button type="submit" className="btn btn-primary" disabled={working}>
          {working ? 'Saving...' : editingId ? 'Save draft' : 'Create draft'}</button>
      </div>
    </form>
  </div>;
};

export default ModeratorAssessmentsPage;
