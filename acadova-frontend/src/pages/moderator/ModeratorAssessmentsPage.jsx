import React, { useEffect, useState } from 'react';
import assessmentService from '../../services/assessmentService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const emptyQuestion = () => ({ prompt: '', options: ['', '', ''], correctIndex: 0 });
const initialDraft = () => ({ title: '', topic: '', passingScore: 60,
  questions: [emptyQuestion(), emptyQuestion(), emptyQuestion()] });

export const ModeratorAssessmentsPage = () => {
  const [draft, setDraft] = useState(initialDraft);
  const [assessments, setAssessments] = useState([]);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try { const response = await assessmentService.staffList(); setAssessments(response.data || []); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { Promise.resolve().then(load); }, []);

  const updateQuestion = (index, changes) => setDraft((current) => ({
    ...current, questions: current.questions.map((question, i) => i === index ? { ...question, ...changes } : question),
  }));
  const create = async (event) => {
    event.preventDefault(); setWorking(true); setError(''); setSuccess('');
    try {
      await assessmentService.create(draft);
      setDraft(initialDraft()); setSuccess('Draft created. Review it before publishing.'); await load();
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  const publish = async (id) => {
    if (!window.confirm('Publish this assessment for Students? Questions and answers cannot be changed afterward.')) return;
    setWorking(true); setError(''); setSuccess('');
    try { await assessmentService.publish(id); setSuccess('Assessment published.');
      setReview((current) => current?.id === id ? { ...current, status: 'published' } : current);
      await load(); }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  const reviewAssessment = async (id) => {
    setWorking(true); setError('');
    try { const response = await assessmentService.staffGet(id); setReview(response.data); }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };

  return <div className="staff-page">
    <header className="staff-page-header"><div><span className="staff-eyebrow">Moderator / Learning</span>
      <h1>Assessments</h1><p>Create a short multiple-choice assessment, then publish it for Students.</p></div></header>
    <Alert type="danger" message={error} /><Alert type="success" message={success} />
    <div className="card"><h2>Assessment drafts</h2>
      {loading ? <LoadingSpinner text="Loading assessments..." /> : assessments.length === 0
        ? <p>No assessments yet.</p> : assessments.map((item) => <div key={item.id}
          style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, padding: '12px 0' }}>
          <div><strong>{item.title}</strong><p>{item.topic} · {item.questionCount} questions · {item.status}</p></div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={working}
            onClick={() => reviewAssessment(item.id)}>Review</button>
        </div>)}
    </div>
    {review && <div className="card" style={{ marginTop: 20 }}>
      <h2>{review.title}</h2><p>{review.topic} · {review.status} · Pass at {review.passingScore}%</p>
      {review.questions.map((question, index) => <div key={index}>
        <h3>{index + 1}. {question.prompt}</h3>
        <p>Correct answer: {question.options[question.correctIndex]}</p>
        <p>Options: {question.options.join(' / ')}</p>
      </div>)}
      {review.status === 'draft' && <button type="button" className="btn btn-primary btn-sm"
        disabled={working} onClick={() => publish(review.id)}>Publish reviewed draft</button>}
    </div>}
    <form className="card" onSubmit={create} style={{ marginTop: 24 }}>
      <h2>Create a three-question draft</h2>
      <label className="form-label" htmlFor="assessment-title">Title</label>
      <input id="assessment-title" className="form-input" value={draft.title} required minLength={3} maxLength={120}
        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
      <label className="form-label" htmlFor="assessment-topic">Topic</label>
      <input id="assessment-topic" className="form-input" value={draft.topic} required minLength={2} maxLength={80}
        onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))} />
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
      </fieldset>)}
      <button type="submit" className="btn btn-primary" disabled={working}>{working ? 'Saving...' : 'Create draft'}</button>
    </form>
  </div>;
};

export default ModeratorAssessmentsPage;
