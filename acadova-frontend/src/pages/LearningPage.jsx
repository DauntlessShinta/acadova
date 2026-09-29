import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import learningService from '../services/learningService';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';

const emptySubmission = { topic: '', title: '', description: '', resourceType: 'text', textContent: '', externalUrl: '' };

export const LearningPage = () => {
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [submission, setSubmission] = useState(emptySubmission);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    learningService.topics().then((response) => setTopics(response.data || []))
      .catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  const load = async (request) => {
    setWorking(true); setError(''); setContent(null);
    try { const response = await request(); setContent(response.data); }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  const openTopic = async (id) => {
    setWorking(true); setError(''); setContent(null);
    try { const response = await learningService.topic(id); setTopic(response.data); }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  const submit = async (event) => {
    event.preventDefault(); setWorking(true); setError(''); setSuccess('');
    const body = { topic: submission.topic, title: submission.title,
      description: submission.description, resourceType: submission.resourceType,
      ...(submission.resourceType === 'text' ? { textContent: submission.textContent }
        : { externalUrl: submission.externalUrl }) };
    try { await learningService.submit(body); setSuccess('Resource submitted for staff review.');
      setSubmission(emptySubmission); }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };

  return <div>
    <h1>Learning</h1><p>Browse approved topics, study free resources, and take assessments.</p>
    <Alert type="danger" message={error} /><Alert type="success" message={success} />
    {loading ? <LoadingSpinner text="Loading topics..." /> : <>
      {topic && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setTopic(null); setContent(null); }}>All topics</button>}
      {!topic ? <div className="assessment-list">{topics.length === 0 ? <div className="card">No published topics yet.</div>
        : topics.map((item) => <article className="card" key={item.id}><h2>{item.name}</h2><p>{item.description}</p>
          <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => openTopic(item.id)}>Open topic</button>
        </article>)}</div> : <>
        <h2>{topic.name}</h2><p>{topic.description}</p>
        {content && <article className="card"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setContent(null)}>Back to topic</button>
          <h3>{content.title}</h3><p>{content.description}</p>
          {content.locked ? <p>{content.creditCost} credits — unlock support is coming in the next credit phase.</p>
            : content.resourceType === 'text' ? <p style={{ whiteSpace: 'pre-wrap' }}>{content.textContent}</p>
              : content.resourceType === 'url' ? <a href={content.externalUrl} target="_blank" rel="noopener noreferrer">Open HTTPS resource</a>
                : <>{(content.resources || []).map((item) => <p key={item.id}><button type="button" className="btn btn-secondary btn-sm" onClick={() => load(() => learningService.resource(item.id))}>{item.title}</button>{item.locked && ` · ${item.creditCost} credits, locked`}</p>)}
                  {content.assessment && <Link to={`/assessments?open=${content.assessment}`}>Take linked assessment</Link>}</>}
        </article>}
        {!content && <><h3>Resources</h3><div className="assessment-list">{topic.resources.map((item) => <article className="card" key={item.id}>
          <h4>{item.title}</h4><p>{item.description}</p><p>{item.locked ? `${item.creditCost} credits — unlock coming later` : 'Free'}</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => load(() => learningService.resource(item.id))}>View resource</button>
        </article>)}</div><h3>Modules</h3><div className="assessment-list">{topic.modules.map((item) => <article className="card" key={item.id}>
          <h4>{item.title}</h4><p>{item.description}</p><p>{item.locked ? `${item.creditCost} credits — unlock coming later` : 'Free'}</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => load(() => learningService.module(item.id))}>Open module</button>
        </article>)}</div><h3>Assessments</h3>{topic.assessments.length ? topic.assessments.map((item) => <p key={item.id}>
          <Link to={`/assessments?open=${item.id}`}>{item.title}</Link> · {item.questionCount} questions</p>) : <p>No linked assessments yet.</p>}</>}
      </>}
      <form className="card" onSubmit={submit} style={{ marginTop: 24 }}><h2>Share a resource</h2>
        <p>Any Student can contribute teaching material. Staff review it before publication.</p>
        <label className="form-label" htmlFor="learning-topic">Topic</label>
        <select id="learning-topic" className="form-input" required value={submission.topic} onChange={(event) => setSubmission({ ...submission, topic: event.target.value })}>
          <option value="">Choose a topic</option>{topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <label className="form-label" htmlFor="learning-title">Title</label>
        <input id="learning-title" className="form-input" required minLength={3} maxLength={120} value={submission.title} onChange={(event) => setSubmission({ ...submission, title: event.target.value })} />
        <label className="form-label" htmlFor="learning-description">Description</label>
        <textarea id="learning-description" className="form-input" required minLength={3} maxLength={500} value={submission.description} onChange={(event) => setSubmission({ ...submission, description: event.target.value })} />
        <label className="form-label" htmlFor="learning-type">Type</label>
        <select id="learning-type" className="form-input" value={submission.resourceType} onChange={(event) => setSubmission({ ...submission, resourceType: event.target.value })}>
          <option value="text">Text</option><option value="url">HTTPS link</option>
        </select>
        {submission.resourceType === 'text' ? <><label className="form-label" htmlFor="learning-text">Text</label>
          <textarea id="learning-text" className="form-input" required maxLength={10000} value={submission.textContent} onChange={(event) => setSubmission({ ...submission, textContent: event.target.value })} /></>
          : <><label className="form-label" htmlFor="learning-url">HTTPS URL</label>
            <input id="learning-url" className="form-input" type="url" required maxLength={1000} value={submission.externalUrl} onChange={(event) => setSubmission({ ...submission, externalUrl: event.target.value })} /></>}
        <button type="submit" className="btn btn-primary" disabled={working || !topics.length}>Submit for review</button>
      </form>
    </>}
  </div>;
};

export default LearningPage;
