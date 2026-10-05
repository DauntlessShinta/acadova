import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import assessmentService from '../services/assessmentService';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useToast } from '../context/toastAccess';

export const AssessmentsPage = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const openId = searchParams.get('open');
  const { refreshUser } = useAuth();
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [answerError, setAnswerError] = useState('');

  useEffect(() => {
    assessmentService.list().then((response) => setList(response.data || []))
      .catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!openId) return;
    assessmentService.get(openId).then((response) => {
      setSelected(response.data); setAnswers(Array(response.data.questions.length).fill(null));
    }).catch((err) => setError(err.message));
  }, [openId]);

  const open = async (id) => {
    setError(''); setAnswerError(''); setResult(null); setWorking(true);
    try {
      const response = await assessmentService.get(id);
      setSelected(response.data);
      setAnswers(Array(response.data.questions.length).fill(null));
    } catch (err) { toast('error', err.message || 'This assessment could not be opened.'); }
    finally { setWorking(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (answers.some((answer) => answer === null)) {
      setAnswerError('Answer every question before submitting.'); return;
    }
    setWorking(true); setError(''); setAnswerError('');
    try {
      const response = await assessmentService.submit(selected.id, answers);
      setResult(response.data);
      toast(response.data.passed ? 'success' : 'info', response.data.passed ? 'Assessment passed. Your result is ready below.' : 'Attempt recorded. Review your result and try again when ready.');
      await refreshUser();
    } catch (err) { toast('error', err.message || 'Your assessment could not be submitted. Please try again.'); }
    finally { setWorking(false); }
  };

  return <div>
    <h1>Assessments</h1>
    <p>Complete a published assessment to earn the current credit reward once per assessment.</p>
    <Alert type="danger" message={error} onClose={() => setError('')} />
    {loading ? <LoadingSpinner text="Loading assessments..." /> : list.length === 0
      ? <div className="card"><p>No published assessments are available yet.</p></div>
      : !selected && <div className="assessment-list">{list.map((item) => <article className="card" key={item.id}>
        <h2>{item.title}</h2><p>{item.topic} · {item.questionCount} questions</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => open(item.id)} disabled={working}>Open assessment</button>
      </article>)}</div>}
    {selected && <div className="card">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelected(null); setResult(null); }}>Back to assessments</button>
      <h2>{selected.title}</h2><p>{selected.topic}</p>
      {result ? <div role="status">
        <h3>{result.passed ? 'Passed' : 'Not passed yet'}</h3>
        <p>Score: {result.score}%</p>
        <p>{result.rewardIssued ? `+${result.creditsAwarded} credits earned` : 'No credits awarded for this attempt.'}</p>
        {!result.rewardIssued && result.passed && <p>You already earned the one-time reward for this assessment.</p>}
        <Link to="/credits" className="btn btn-secondary btn-sm">View credit wallet</Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setResult(null); setAnswers(Array(selected.questions.length).fill(null)); }}>Try again</button>
      </div> : <form onSubmit={submit}>
        {selected.questions.map((question, index) => <fieldset className="card" key={index} disabled={working}>
          <legend><strong>{index + 1}. {question.prompt}</strong></legend>
          {question.options.map((option, optionIndex) => <label key={optionIndex} style={{ display: 'block', margin: '10px 0' }}>
            <input type="radio" name={`question-${index}`} checked={answers[index] === optionIndex}
              onChange={() => setAnswers((current) => current.map((answer, i) => i === index ? optionIndex : answer))} /> {option}
          </label>)}
        </fieldset>)}
        {answerError && <p id="assessment-answer-error" className="form-error" role="alert">{answerError}</p>}
        <button type="submit" className="btn btn-primary" disabled={working} aria-describedby={answerError ? 'assessment-answer-error' : undefined}>{working ? 'Submitting...' : 'Submit answers'}</button>
      </form>}
    </div>}
  </div>;
};

export default AssessmentsPage;
