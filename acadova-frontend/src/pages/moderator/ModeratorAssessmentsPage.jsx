import { useConfirm } from '../../context/confirmAccess';
import WorkflowTabs from '../../components/common/WorkflowTabs';
import React, { useEffect, useState } from 'react';
import assessmentService from '../../services/assessmentService';
import learningService from '../../services/learningService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/toastAccess';

const emptyQuestion = () => ({ prompt: '', options: ['', '', ''], correctIndex: 0 });
const initialDraft = () => ({ title: '', topic: '', passingScore: 60,
  questions: [emptyQuestion(), emptyQuestion(), emptyQuestion()] });

export const ModeratorAssessmentsPage = () => {
  const confirm = useConfirm();
  const toast = useToast();
  const [section, setSection] = useState('drafts');
  const [draft, setDraft] = useState(initialDraft);
  const [assessments, setAssessments] = useState([]);
  const [learningTopics, setLearningTopics] = useState([]);
  const [review, setReview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

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

  const updateQuestion = (index, changes) => setDraft((current) => ({
    ...current, questions: current.questions.map((question, i) => i === index ? { ...question, ...changes } : question),
  }));
  const create = async (event) => {
    event.preventDefault(); setWorking(true); setError('');
    try {
      if (editingId) await assessmentService.update(editingId, draft);
      else await assessmentService.create(draft);
      setDraft(initialDraft()); setEditingId(null);
      toast('success', editingId ? 'Draft updated. Review it before publishing.'
        : 'Draft created. Review it before publishing.'); await load();
    } catch { toast('error', 'Check each question, option, correct answer, and topic, then try again.'); }
    finally { setWorking(false); }
  };
  const publish = async (id) => {
    if (!await confirm('Publish this assessment for Students? Questions and answers cannot be changed afterward.', { title: 'Publish assessment', label: 'Publish assessment', destructive: false })) return;
    setWorking(true); setError('');
    try { await assessmentService.publish(id); toast('success', 'Assessment published.');
      setReview((current) => current?.id === id ? { ...current, status: 'published' } : current);
      await load(); }
    catch (err) { toast('error', err.message || 'Assessment could not be published.'); }
    finally { setWorking(false); }
  };
  const reviewAssessment = async (id) => {
    setWorking(true); setError('');
    try { const response = await assessmentService.staffGet(id); setReview(response.data); setSection('review'); }
    catch (err) { toast('error', err.message || 'The assessment draft could not be opened.'); }
    finally { setWorking(false); }
  };

  return <div className="staff-page">
    <header className="staff-page-header"><div><span className="staff-eyebrow">Moderator / Learning</span>
      <h1>Assessments</h1><p>Create a short multiple-choice assessment, then publish it for Students.</p></div></header>
    <Alert type="danger" message={error} />
    <WorkflowTabs id="assessment-management" tabs={[['drafts', 'Drafts'], ['builder', 'Create / edit'], ['review', 'Review']]} active={section} onChange={setSection} />
    <div role="tabpanel" id="assessment-management-panel-drafts" aria-labelledby="assessment-management-tab-drafts" hidden={section !== 'drafts'} className="card"><h2>Assessment drafts</h2>
      {loading ? <LoadingSpinner text="Loading assessments..." /> : assessments.length === 0
        ? <p>No assessments yet.</p> : assessments.map((item) => <div key={item.id}
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
          setDraft({ title: review.title, topic: review.topic, passingScore: review.passingScore,
            ...(review.learningTopic ? { learningTopic: review.learningTopic } : {}),
            questions: review.questions.map((question) => ({ ...question, options: [...question.options] })) });
          setEditingId(review.id); setSection('builder');
          setReview(null);
        }}>Edit draft</button>}
    </div>}
    </section>
    <form role="tabpanel" id="assessment-management-panel-builder" aria-labelledby="assessment-management-tab-builder" hidden={section !== 'builder'} className="card" onSubmit={create} style={{ marginTop: 24 }}>
      <h2>{editingId ? 'Edit assessment draft' : 'Create assessment draft'}</h2>
      <p>Use 3–10 questions, 2–5 options per question, and select one correct answer.</p>
      {editingId && <button type="button" className="btn btn-secondary btn-sm"
        onClick={() => { setDraft(initialDraft()); setEditingId(null); }}>Cancel edit</button>}
      <label className="form-label" htmlFor="assessment-title">Title</label>
      <input id="assessment-title" className="form-input" value={draft.title} required minLength={3} maxLength={120}
        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
      <label className="form-label" htmlFor="assessment-topic">Topic</label>
      <input id="assessment-topic" className="form-input" value={draft.topic} required minLength={2} maxLength={80}
        disabled={Boolean(draft.learningTopic)}
        onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))} />
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
      <label className="form-label" htmlFor="assessment-passing">Passing score (%)</label>
      <input id="assessment-passing" className="form-input" type="number" min="1" max="100" value={draft.passingScore}
        onChange={(event) => setDraft((current) => ({ ...current, passingScore: Number(event.target.value) }))} />
      {draft.questions.map((question, index) => <fieldset className="card" key={index} style={{ marginTop: 18 }}>
        <legend>Question {index + 1}</legend>
        <label className="form-label" htmlFor={`assessment-prompt-${index}`}>Prompt</label>
        <input id={`assessment-prompt-${index}`} className="form-input" value={question.prompt} required minLength={5} maxLength={300}
          onChange={(event) => updateQuestion(index, { prompt: event.target.value })} />
        {question.options.map((option, optionIndex) => <div key={optionIndex}>
          <label className="form-label" htmlFor={`assessment-option-${index}-${optionIndex}`}>Option {optionIndex + 1}</label>
          <input id={`assessment-option-${index}-${optionIndex}`} className="form-input" value={option} required maxLength={150}
            onChange={(event) => updateQuestion(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} />
        </div>)}
        <label className="form-label" htmlFor={`assessment-answer-${index}`}>Correct option</label>
        <select id={`assessment-answer-${index}`} className="form-input" value={question.correctIndex}
          onChange={(event) => updateQuestion(index, { correctIndex: Number(event.target.value) })}>
          {question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}
        </select>
        <div className="learning-builder-actions">
          <button type="button" className="btn btn-secondary btn-sm"
            disabled={question.options.length >= 5} onClick={() =>
              updateQuestion(index, { options: [...question.options, ''] })}>Add option</button>
          <button type="button" className="btn btn-secondary btn-sm"
            disabled={question.options.length <= 2} onClick={() =>
              updateQuestion(index, { options: question.options.slice(0, -1),
                correctIndex: Math.min(question.correctIndex, question.options.length - 2) })}>Remove last option</button>
          <button type="button" className="btn btn-danger btn-sm"
            disabled={draft.questions.length <= 3} onClick={() =>
              setDraft((current) => ({ ...current,
                questions: current.questions.filter((_, i) => i !== index) }))}>Remove question</button>
        </div>
      </fieldset>)}
      <div className="learning-builder-actions">
        <button type="button" className="btn btn-secondary"
          disabled={draft.questions.length >= 10} onClick={() =>
            setDraft((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }))}>
          Add question</button>
        <button type="submit" className="btn btn-primary" disabled={working}>
          {working ? 'Saving...' : editingId ? 'Save draft' : 'Create draft'}</button>
      </div>
    </form>
  </div>;
};

export default ModeratorAssessmentsPage;
