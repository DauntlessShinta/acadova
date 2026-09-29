import React, { useEffect, useState } from 'react';
import learningService from '../../services/learningService';
import assessmentService from '../../services/assessmentService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export const ModeratorLearningPage = () => {
  const [topics, setTopics] = useState([]);
  const [resources, setResources] = useState([]);
  const [modules, setModules] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [topicDraft, setTopicDraft] = useState({ name: '', description: '' });
  const [moduleDraft, setModuleDraft] = useState({ topic: '', title: '', description: '', resources: [], assessment: '' });
  const [prices, setPrices] = useState({});
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const [topicResult, resourceResult, moduleResult, assessmentResult] = await Promise.all([
        learningService.staffTopics(), learningService.staffResources(), learningService.staffModules(), assessmentService.staffList(),
      ]);
      setTopics(topicResult.data || []); setResources(resourceResult.data || []);
      setModules(moduleResult.data || []); setAssessments(assessmentResult.data || []);
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { Promise.resolve().then(load); }, []);
  const act = async (operation, message) => {
    setWorking(true); setError(''); setSuccess('');
    try { await operation(); setSuccess(message); await load(); return true; }
    catch (err) { setError(err.message); return false; }
    finally { setWorking(false); }
  };
  const priceFor = (id) => Number(prices[id] ?? 0);
  const available = resources.filter((item) => item.topic === moduleDraft.topic && item.reviewStatus === 'published');

  return <div className="staff-page"><header className="staff-page-header"><div><span className="staff-eyebrow">Moderator / Learning</span>
    <h1>Learning content</h1><p>Govern topics, review Student contributions, and publish simple modules.</p></div></header>
    <Alert type="danger" message={error} /><Alert type="success" message={success} />
    {loading ? <LoadingSpinner text="Loading learning content..." /> : <>
      <section className="card"><h2>Topics</h2>{topics.map((item) => <div key={item.id} style={{ marginBottom: 14 }}>
        <strong>{item.name}</strong> · {item.status}<p>{item.description}</p>
        {item.status === 'draft' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.publishTopic(item.id), 'Topic published.')}>Publish</button>}
        {item.status === 'published' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.archiveTopic(item.id), 'Topic archived.')}>Archive</button>}
      </div>)}
        <form onSubmit={async (event) => { event.preventDefault();
          if (await act(() => learningService.createTopic(topicDraft), 'Topic draft created.')) {
            setTopicDraft({ name: '', description: '' });
          } }}>
          <h3>Create topic draft</h3><label className="form-label" htmlFor="topic-name">Name</label>
          <input id="topic-name" className="form-input" required minLength={2} maxLength={80} value={topicDraft.name} onChange={(event) => setTopicDraft({ ...topicDraft, name: event.target.value })} />
          <label className="form-label" htmlFor="topic-description">Description</label>
          <textarea id="topic-description" className="form-input" required minLength={3} maxLength={500} value={topicDraft.description} onChange={(event) => setTopicDraft({ ...topicDraft, description: event.target.value })} />
          <button className="btn btn-primary" disabled={working}>Create draft</button>
        </form>
      </section>
      <section className="card" style={{ marginTop: 20 }}><h2>Resource submissions</h2>{resources.length === 0 && <p>No submissions yet.</p>}
        {resources.map((item) => <article key={item.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 0' }}>
          <h3>{item.title}</h3><p>{item.description} · {item.reviewStatus}</p><p>Submitted by: {item.submittedBy}</p>
          {item.resourceType === 'text' ? <p style={{ whiteSpace: 'pre-wrap' }}>{item.textContent}</p>
            : <a href={item.externalUrl} target="_blank" rel="noopener noreferrer">Review external HTTPS link</a>}
          {item.reviewNote && <p>Review note: {item.reviewNote}</p>}
          {item.reviewStatus === 'submitted' && <><label className="form-label" htmlFor={`resource-price-${item.id}`}>Approved cost (0 = free)</label>
            <input id={`resource-price-${item.id}`} className="form-input" type="number" min="0" max="1000" step="1" value={prices[item.id] ?? 0} onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })} />
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => act(() => learningService.publishResource(item.id, priceFor(item.id)), 'Resource published.')}>Publish</button>
            <label className="form-label" htmlFor={`reject-${item.id}`}>Rejection reason</label>
            <input id={`reject-${item.id}`} className="form-input" maxLength={300} value={reasons[item.id] || ''} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={working || (reasons[item.id] || '').trim().length < 3} onClick={() => act(() => learningService.rejectResource(item.id, reasons[item.id]), 'Resource rejected.')}>Reject</button></>}
          {item.reviewStatus === 'published' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.archiveResource(item.id), 'Resource archived.')}>Archive</button>}
        </article>)}
      </section>
      <section className="card" style={{ marginTop: 20 }}><h2>Modules</h2>{modules.map((item) => <article key={item.id} style={{ marginBottom: 16 }}>
        <strong>{item.title}</strong> · {item.status}<p>{item.description}</p>
        {item.status === 'draft' && <><label className="form-label" htmlFor={`module-price-${item.id}`}>Approved cost (0 = free)</label>
          <input id={`module-price-${item.id}`} className="form-input" type="number" min="0" max="1000" step="1" value={prices[item.id] ?? 0} onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })} />
          <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => act(() => learningService.publishModule(item.id, priceFor(item.id)), 'Module published.')}>Publish</button></>}
        {item.status === 'published' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.archiveModule(item.id), 'Module archived.')}>Archive</button>}
      </article>)}
        <form onSubmit={async (event) => { event.preventDefault();
          if (await act(() => learningService.createModule({ ...moduleDraft,
            ...(moduleDraft.assessment ? {} : { assessment: undefined }) }), 'Module draft created.')) {
            setModuleDraft({ topic: '', title: '', description: '', resources: [], assessment: '' });
          } }}>
          <h3>Create module draft</h3><label className="form-label" htmlFor="module-topic">Published topic</label>
          <select id="module-topic" className="form-input" required value={moduleDraft.topic} onChange={(event) => setModuleDraft({ ...moduleDraft, topic: event.target.value, resources: [], assessment: '' })}>
            <option value="">Choose topic</option>{topics.filter((item) => item.status === 'published').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><label className="form-label" htmlFor="module-title">Title</label>
          <input id="module-title" className="form-input" required minLength={3} maxLength={120} value={moduleDraft.title} onChange={(event) => setModuleDraft({ ...moduleDraft, title: event.target.value })} />
          <label className="form-label" htmlFor="module-description">Description</label>
          <textarea id="module-description" className="form-input" required minLength={3} maxLength={500} value={moduleDraft.description} onChange={(event) => setModuleDraft({ ...moduleDraft, description: event.target.value })} />
          <p>Choose resources in lesson order:</p>{moduleDraft.resources.map((resourceId, index) => <p key={`${resourceId}-${index}`}>{index + 1}. {available.find((item) => item.id === resourceId)?.title}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModuleDraft({ ...moduleDraft, resources: moduleDraft.resources.filter((_, i) => i !== index) })}>Remove</button></p>)}
          {available.filter((item) => !moduleDraft.resources.includes(item.id)).map((item) => <button key={item.id} type="button" className="btn btn-secondary btn-sm" onClick={() => setModuleDraft({ ...moduleDraft, resources: [...moduleDraft.resources, item.id] })}>Add {item.title}</button>)}
          <label className="form-label" htmlFor="module-assessment">Optional published assessment</label>
          <select id="module-assessment" className="form-input" value={moduleDraft.assessment} onChange={(event) => setModuleDraft({ ...moduleDraft, assessment: event.target.value })}>
            <option value="">None</option>{assessments.filter((item) => item.status === 'published'
              && item.topic === topics.find((topic) => topic.id === moduleDraft.topic)?.name).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select><button type="submit" className="btn btn-primary" disabled={working || !moduleDraft.resources.length}>Create module</button>
        </form>
      </section>
    </>}
  </div>;
};

export default ModeratorLearningPage;
