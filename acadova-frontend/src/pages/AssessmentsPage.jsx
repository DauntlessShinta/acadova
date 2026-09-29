import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import assessmentService from '../services/assessmentService';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';

export const AssessmentsPage = () => {
  const { refreshUser } = useAuth();
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    assessmentService.list().then((response) => setList(response.data || []))
      .catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const open = async (id) => {
    setError(''); setResult(null); setWorking(true);
    try {
      const response = await assessmentService.get(id);
      setSelected(response.data);
      setAnswers(Array(response.data.questions.length).fill(null));
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (answers.some((answer) => answer === null)) {
      setError('Answer every question before submitting.'); return;
    }
    setWorking(true); setError('');
    try {
      const response = await assessmentService.submit(selected.id, answers);
      setResult(response.data);
      await refreshUser();
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };

  return <div>
    <h1>Assessments</h1>
    <p>Complete a published assessment to earn credits for learning. A passing result earns 20 credits once per assessment.</p>
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
        <p>{result.rewardIssued ? '+20 credits earned' : 'No credits awarded for this attempt.'}</p>
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
        <button type="submit" className="btn btn-primary" disabled={working}>{working ? 'Submitting...' : 'Submit answers'}</button>
      </form>}
    </div>}
  </div>;
};

export default AssessmentsPage;
