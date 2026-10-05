import { useConfirm } from '../../context/confirmAccess';
import WorkflowTabs from '../../components/common/WorkflowTabs';
import ExternalResourceLink from '../../components/common/ExternalResourceLink';
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import learningService from '../../services/learningService';
import assessmentService from '../../services/assessmentService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/toastAccess';

export const ModeratorLearningPage = () => {
  const { pathname } = useLocation();
  const staffBase = pathname.startsWith('/admin') ? '/admin' : '/moderator';
  const toast = useToast();
  const [section, setSection] = useState('topics');
  const confirm = useConfirm();
  const [topics, setTopics] = useState([]);
  const [resources, setResources] = useState([]);
  const [modules, setModules] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [topicDraft, setTopicDraft] = useState({ name: '', description: '' });
  const [editingTopic, setEditingTopic] = useState(null);
  const [resourceDraft, setResourceDraft] = useState({ topic: '', title: '', description: '',
    resourceType: 'text', textContent: '', externalUrl: '' });
  const [editingResource, setEditingResource] = useState(null);
  const [moduleDraft, setModuleDraft] = useState({ topic: '', title: '', description: '', resources: [], assessment: '' });
  const [editingModule, setEditingModule] = useState(null);
  const [prices, setPrices] = useState({});
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

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
    if (/archived|rejected/i.test(message) && !await confirm(message.includes('rejected')
      ? 'Reject this resource with the entered feedback? The creator will be notified and can submit a corrected resource.'
      : 'Archive this content? Students will no longer be able to discover it for new learning.',
      { title: message.includes('rejected') ? 'Reject resource' : 'Archive content', label: message.includes('rejected') ? 'Reject resource' : 'Archive' })) return false;
    setWorking(true);
    try { await operation(); toast('success', message); await load(); return true; }
    catch (err) { toast('error', err.message || 'Learning content could not be updated.'); return false; }
    finally { setWorking(false); }
  };
  const hasPublishedTopic = topics.some((item) => item.status === 'published');
  const priceFor = (id) => Number(prices[id] ?? 0);
  const available = resources.filter((item) => item.topic === moduleDraft.topic && item.reviewStatus === 'published');
  const resetTopic = () => { setTopicDraft({ name: '', description: '' }); setEditingTopic(null); };
  const resetResource = () => {
    setResourceDraft({ topic: '', title: '', description: '', resourceType: 'text',
      textContent: '', externalUrl: '' });
    setEditingResource(null);
  };
  const resetModule = () => {
    setModuleDraft({ topic: '', title: '', description: '', resources: [], assessment: '' });
    setEditingModule(null);
  };

  return <div className="staff-page"><header className="staff-page-header"><div><span className="staff-eyebrow">Moderator / Learning</span>
    <h1>Learning Management</h1><p>Prepare topics, lessons, modules, and assessments without editing the database.</p></div></header>
    <WorkflowTabs id="manage" tabs={[['topics', 'Topics'], ['resources', 'Resources'], ['modules', 'Modules']]} active={section} onChange={setSection} /><Link to={`${staffBase}/assessments`}>Manage assessments</Link>
    <Alert type="danger" message={error} />
    {loading ? <LoadingSpinner text="Loading learning content..." /> : <>
      <section className="card" id="manage-panel-topics" role="tabpanel" aria-labelledby="manage-tab-topics" hidden={section !== 'topics'}><h2>Topics</h2>{!topics.length && <p>No topics yet. <a href="#topic-name">Create First Topic</a>, then publish it to enable resources and modules.</p>}{topics.map((item) => <div key={item.id} style={{ marginBottom: 14 }}>
        <strong>{item.name}</strong> · {item.status}<p>{item.description}</p>
        {item.status === 'draft' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.publishTopic(item.id), 'Topic published.')}>Publish</button>}
        {item.status === 'draft' && <button type="button" className="btn btn-secondary btn-sm" disabled={working}
          onClick={() => { setEditingTopic(item.id); setTopicDraft({ name: item.name, description: item.description }); }}>Edit draft</button>}
        {item.status === 'published' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.archiveTopic(item.id), 'Topic archived.')}>Archive</button>}
      </div>)}
        <form onSubmit={async (event) => { event.preventDefault();
          if (await act(() => editingTopic
            ? learningService.updateTopic(editingTopic, topicDraft) : learningService.createTopic(topicDraft),
          editingTopic ? 'Topic draft updated.' : 'Topic draft created.')) {
            resetTopic();
          } }}>
          <h3>{editingTopic ? 'Edit topic draft' : 'Create topic draft'}</h3>
          {editingTopic && <button type="button" className="btn btn-secondary btn-sm" onClick={resetTopic}>Cancel edit</button>}
          <label className="form-label" htmlFor="topic-name">Name</label>
          <input id="topic-name" className="form-input" required minLength={2} maxLength={80} value={topicDraft.name} onChange={(event) => setTopicDraft({ ...topicDraft, name: event.target.value })} />
          <label className="form-label" htmlFor="topic-description">Description</label>
          <textarea id="topic-description" className="form-input" required minLength={3} maxLength={500} value={topicDraft.description} onChange={(event) => setTopicDraft({ ...topicDraft, description: event.target.value })} />
          <button className="btn btn-primary" disabled={working}>{editingTopic ? 'Save draft' : 'Create draft'}</button>
        </form>
      </section>
      <section className="card" id="manage-panel-resources" role="tabpanel" aria-labelledby="manage-tab-resources" hidden={section !== 'resources'} style={{ marginTop: 20 }}>
        <h2>Resources and lessons</h2><p>Create a text lesson or HTTPS link, then review and publish it.</p>
        {resources.length === 0 && <p>No resources yet.</p>}
        {resources.map((item) => <article key={item.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 0' }}>
          <h3>{item.title}</h3><p>{item.description} · {item.reviewStatus}</p><p>Submitted by: {item.submittedBy}</p>
          {item.resourceType === 'text' ? <p style={{ whiteSpace: 'pre-wrap' }}>{item.textContent}</p>
            : <ExternalResourceLink href={item.externalUrl}>Review external resource</ExternalResourceLink>}
          {item.reviewNote && <p>Review note: {item.reviewNote}</p>}
          {item.reviewStatus === 'submitted' && <button type="button" className="btn btn-secondary btn-sm"
            disabled={working} onClick={() => {
              setEditingResource(item.id);
              setResourceDraft({ topic: item.topic, title: item.title, description: item.description,
                resourceType: item.resourceType, textContent: item.textContent || '',
                externalUrl: item.externalUrl || '' });
            }}>Edit submission</button>}
          {item.reviewStatus === 'submitted' && <><label className="form-label" htmlFor={`resource-price-${item.id}`}>Approved cost (0 = free)</label>
            <input id={`resource-price-${item.id}`} className="form-input" type="number" min="0" max="1000" step="1" value={prices[item.id] ?? 0} onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })} />
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => act(() => learningService.publishResource(item.id, priceFor(item.id)), 'Resource published.')}>Publish</button>
            <label className="form-label" htmlFor={`reason-template-${item.id}`}>Optional review note template</label>
            <select id={`reason-template-${item.id}`} className="form-select" defaultValue=""
              onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })}>
              <option value="">Write a review note</option>
              <option value="The external link is broken or inaccessible. Please submit a corrected resource.">Broken link</option>
              <option value="This resource belongs under a different topic. Please submit a corrected resource.">Incorrect topic</option>
              <option value="The explanation is incomplete. Please submit a more complete resource.">Incomplete explanation</option>
              <option value="This content does not meet Acadova community guidelines.">Guidelines concern</option>
            </select>
            <label className="form-label" htmlFor={`reject-${item.id}`}>Feedback for creator</label>
            <input id={`reject-${item.id}`} className="form-input" maxLength={300} value={reasons[item.id] || ''} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} />
            <p className="form-hint">Rejecting closes this submission. The creator receives this note and may submit a corrected resource.</p>
            <button type="button" className="btn btn-secondary btn-sm" disabled={working || (reasons[item.id] || '').trim().length < 3} onClick={() => act(() => learningService.rejectResource(item.id, reasons[item.id]), 'Resource rejected with feedback.')}>Reject with feedback</button></>}
          {item.reviewStatus === 'published' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.archiveResource(item.id), 'Resource archived.')}>Archive</button>}
        </article>)}
        {!hasPublishedTopic && <p>Create and publish a topic before adding resources.</p>}
        <fieldset disabled={!hasPublishedTopic} className="prerequisite-fields"><form className="learning-staff-form" onSubmit={async (event) => {
          event.preventDefault();
          const body = { topic: resourceDraft.topic, title: resourceDraft.title,
            description: resourceDraft.description, resourceType: resourceDraft.resourceType,
            ...(resourceDraft.resourceType === 'text'
              ? { textContent: resourceDraft.textContent } : { externalUrl: resourceDraft.externalUrl }) };
          if (await act(() => editingResource
            ? learningService.updateStaffResource(editingResource, body)
            : learningService.createStaffResource(body),
          editingResource ? 'Resource updated.' : 'Resource submitted for review.')) resetResource();
        }}>
          <h3>{editingResource ? 'Edit resource submission' : 'Create resource'}</h3>
          {editingResource && <button type="button" className="btn btn-secondary btn-sm"
            onClick={resetResource}>Cancel edit</button>}
          <label className="form-label" htmlFor="staff-resource-topic">Published topic</label>
          <select id="staff-resource-topic" className="form-input" required value={resourceDraft.topic}
            onChange={(event) => setResourceDraft({ ...resourceDraft, topic: event.target.value })}>
            <option value="">Choose topic</option>
            {topics.filter((item) => item.status === 'published').map((item) =>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="form-label" htmlFor="staff-resource-title">Title</label>
          <input id="staff-resource-title" className="form-input" required minLength={3} maxLength={120}
            value={resourceDraft.title}
            onChange={(event) => setResourceDraft({ ...resourceDraft, title: event.target.value })} />
          <label className="form-label" htmlFor="staff-resource-description">Description</label>
          <textarea id="staff-resource-description" className="form-input" required minLength={3} maxLength={500}
            value={resourceDraft.description}
            onChange={(event) => setResourceDraft({ ...resourceDraft, description: event.target.value })} />
          <label className="form-label" htmlFor="staff-resource-type">Material type</label>
          <select id="staff-resource-type" className="form-input" value={resourceDraft.resourceType}
            onChange={(event) => setResourceDraft({ ...resourceDraft, resourceType: event.target.value })}>
            <option value="text">Acadova text lesson</option><option value="url">HTTPS link or video</option>
          </select>
          {resourceDraft.resourceType === 'text' ? <>
            <label className="form-label" htmlFor="staff-resource-text">Lesson text</label>
            <textarea id="staff-resource-text" className="form-input" required maxLength={10000}
              value={resourceDraft.textContent}
              onChange={(event) => setResourceDraft({ ...resourceDraft, textContent: event.target.value })} />
          </> : <>
            <label className="form-label" htmlFor="staff-resource-url">HTTPS URL</label>
            <input id="staff-resource-url" className="form-input" type="url" required maxLength={1000}
              value={resourceDraft.externalUrl}
              onChange={(event) => setResourceDraft({ ...resourceDraft, externalUrl: event.target.value })} />
          </>}
          <button className="btn btn-primary" disabled={working}>
            {editingResource ? 'Save submission' : 'Create resource'}</button>
        </form></fieldset>
      </section>
      <section className="card" id="manage-panel-modules" role="tabpanel" aria-labelledby="manage-tab-modules" hidden={section !== 'modules'} style={{ marginTop: 20 }}><h2>Modules</h2>{modules.map((item) => <article key={item.id} style={{ marginBottom: 16 }}>
        <strong>{item.title}</strong> · {item.status}<p>{item.description}</p>
        {item.status === 'draft' && <button type="button" className="btn btn-secondary btn-sm"
          disabled={working} onClick={() => {
            setEditingModule(item.id);
            setModuleDraft({ topic: item.topic, title: item.title, description: item.description,
              resources: item.resources || [], assessment: item.assessment || '' });
          }}>Edit draft</button>}
        {item.status === 'draft' && <><label className="form-label" htmlFor={`module-price-${item.id}`}>Approved cost (0 = free)</label>
          <input id={`module-price-${item.id}`} className="form-input" type="number" min="0" max="1000" step="1" value={prices[item.id] ?? 0} onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })} />
          <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => act(() => learningService.publishModule(item.id, priceFor(item.id)), 'Module published.')}>Publish</button></>}
        {item.status === 'published' && <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => act(() => learningService.archiveModule(item.id), 'Module archived.')}>Archive</button>}
      </article>)}
        {!hasPublishedTopic && <p>Create and publish a topic before adding a module.</p>}
        <fieldset disabled={!hasPublishedTopic} className="prerequisite-fields"><form onSubmit={async (event) => { event.preventDefault();
          const body = { ...moduleDraft, ...(moduleDraft.assessment ? {} : { assessment: undefined }) };
          if (await act(() => editingModule
            ? learningService.updateModule(editingModule, body) : learningService.createModule(body),
          editingModule ? 'Module draft updated.' : 'Module draft created.')) resetModule();
        }}>
          <h3>{editingModule ? 'Edit module draft' : 'Create module draft'}</h3>
          {editingModule && <button type="button" className="btn btn-secondary btn-sm"
            onClick={resetModule}>Cancel edit</button>}
          <label className="form-label" htmlFor="module-topic">Published topic</label>
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
          </select><button type="submit" className="btn btn-primary" disabled={working || !moduleDraft.resources.length || !hasPublishedTopic}>
            {editingModule ? 'Save draft' : 'Create module'}</button>
        </form></fieldset>
      </section>
    </>}
  </div>;
};

export default ModeratorLearningPage;
