import { useConfirm } from '../../context/confirmAccess';
import { ArrowLeft, ChevronDown, Plus, Search, X, ClipboardList } from 'lucide-react';
import LearningContentTable, { LearningContentStatus } from '../../components/learning/LearningContentTable';
import WorkflowTabs from '../../components/common/WorkflowTabs';
import ExternalResourceLink from '../../components/common/ExternalResourceLink';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { staffLearningHash, staffLearningSection, staffTopicSection } from '../../utils/staffLearningNavigation';
import learningService from '../../services/learningService';
import assessmentService from '../../services/assessmentService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { moduleAssessments, moveLesson } from '../../utils/learningCurriculum';
import '../../components/learning/learning.css';
import '../../components/learning/learningWorkspace.css';
import { useToast } from '../../context/toastAccess';

export const ModeratorLearningPage = () => {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const staffBase = pathname.startsWith('/admin') ? '/admin' : '/moderator';
  const toast = useToast();
  const topicId = new URLSearchParams(search).get('topic');
  const [workspaceTopic, setWorkspaceTopic] = useState(null);
  const section = topicId ? staffTopicSection(hash) : staffLearningSection(hash);
  const currentTopicId = useRef(topicId);
  useLayoutEffect(() => { currentTopicId.current = topicId; }, [topicId]);
  const openTopic = (item, next = 'modules') => { setResourceStatus('all'); setStatusFilter('all'); navigate(`${pathname}?topic=${encodeURIComponent(item.id)}#manage-panel-${next}`); };
  const assessmentUrl = `${staffBase}/assessments${topicId ? `?topic=${encodeURIComponent(topicId)}` : ''}`;
  const setSection = (value) => navigate(`${pathname}${search}${topicId ? `#manage-panel-${value}` : staffLearningHash(value)}`);
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
  const [actionError, setActionError] = useState('');
  const [resourceStatus, setResourceStatus] = useState('submitted');
  const [editors, setEditors] = useState({ resources: false, modules: false });
  const [queries, setQueries] = useState({ topics: '', resources: '', modules: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [reviewingResource, setReviewingResource] = useState(null);
  const focusTarget = useRef(null);
  useLayoutEffect(() => {
    const control = document.getElementById(focusTarget.current);
    if (!control?.getClientRects().length) return;
    focusTarget.current = null;
    control.focus({ preventScroll: true }); control.scrollIntoView({ block: 'nearest' });
  }, [section, editors, editingTopic, editingResource, editingModule]);
  const showEditor = (kind) => {
    focusTarget.current = kind === 'topics' ? 'topic-name' : kind === 'resources' ? 'staff-resource-title' : 'module-title';
    setEditors((current) => ({ ...current, [kind]: true })); setSection(kind);
  };
  const mutationPending = useRef(false);

  const loadVersion = useRef(0);
  const load = async () => {
    if (topicId !== currentTopicId.current) return;
    const version = ++loadVersion.current;
    try {
      const [topicResult, workspace, resourceResult, moduleResult, assessmentResult] = await Promise.all([
        learningService.staffTopics(), topicId ? learningService.staffTopic(topicId) : null,
        topicId ? null : learningService.staffResources(), topicId ? null : learningService.staffModules(),
        topicId ? null : assessmentService.staffList(),
      ]);
      if (version !== loadVersion.current || topicId !== currentTopicId.current) return;
      const selected = workspace?.data;
      setWorkspaceTopic(selected || null);
      setTopics(selected && !(topicResult.data || []).some((item) => item.id === selected.id)
        ? [...(topicResult.data || []), selected] : topicResult.data || []);
      setResources(selected?.resources || resourceResult?.data || []);
      setModules(selected?.modules || moduleResult?.data || []);
      setAssessments(selected?.assessments || assessmentResult?.data || []);
      setError('');
    } catch (err) { if (version === loadVersion.current) setError(err.message); }
    finally { if (version === loadVersion.current) setLoading(false); }
  };
  useEffect(() => { let active = true; Promise.resolve().then(() => { if (!active) return; setLoading(true); setWorkspaceTopic(null); setResources([]); setModules([]); setAssessments([]);
    setEditingResource(null); setEditingModule(null); setReviewingResource(null); setEditors({ resources: false, modules: false });
    setResourceDraft({ topic: topicId || '', title: '', description: '', resourceType: 'text', textContent: '', externalUrl: '' });
    setModuleDraft({ topic: topicId || '', title: '', description: '', resources: [], assessment: '' });
    setResourceStatus(topicId ? 'all' : 'submitted'); setTopicFilter(''); setStatusFilter('all');
    void load(); }); return () => { active = false; loadVersion.current += 1; };
    // load is deliberately rerun for topic changes and explicit mutations only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);
  const act = async (operation, message) => {
    if (mutationPending.current) return false;
    if (/archived|rejected/i.test(message) && !await confirm(message.includes('rejected')
      ? 'Reject this resource with the entered feedback? The creator will be notified and can submit a corrected resource.'
      : 'Archive this content? Students will no longer be able to access it. Archived resources also disappear from published modules; existing unlock records are preserved.',
      { title: message.includes('rejected') ? 'Reject resource' : 'Archive content', label: message.includes('rejected') ? 'Reject resource' : 'Archive' })) return false;
    if (mutationPending.current) return false;
    mutationPending.current = true;
    setActionError('');
    setWorking(true);
    try { await operation(); toast('success', message); await load(); return true; }
    catch (err) { setActionError(err.message || 'Learning content could not be updated. Your draft is still here.'); toast('error', err.message || 'Learning content could not be updated.'); return false; }
    finally { mutationPending.current = false; setWorking(false); }
  };
  const hasPublishedTopic = topicId ? workspaceTopic?.status === 'published' : topics.some((item) => item.status === 'published');
  const awaitingReview = resources.filter((item) => item.reviewStatus === 'submitted').length;

  const publishContent = async (kind, item, operation, price = null) => {
    if (mutationPending.current) return;
    const cost = price === null ? '' : `\nPrice: ${price === 0 ? 'free' : price + ' credits'}.`;
    if (!await confirm(`Publish "${item.name || item.title}" for Students?${cost}\nThis content becomes available in Learning. Published content cannot be edited through the draft editor.`,
      { title: `Publish ${kind}`, label: `Publish ${kind}`, destructive: false })) return;
    await act(operation, `${kind.charAt(0).toUpperCase() + kind.slice(1)} published.`);
  };
  const priceFor = (id) => Number(prices[id] ?? 0);
  const available = resources.filter((item) => item.topic === moduleDraft.topic && item.reviewStatus === 'published');
  const availableAssessments = moduleAssessments(assessments, topics.find((item) => item.id === moduleDraft.topic));
  const resetTopic = () => { setTopicDraft({ name: '', description: '' }); setEditingTopic(null); };
  const resetResource = () => {
    setResourceDraft({ topic: topicId || '', title: '', description: '', resourceType: 'text',
      textContent: '', externalUrl: '' });
    setEditingResource(null);
  };
  const resetModule = () => {
    setModuleDraft({ topic: topicId || '', title: '', description: '', resources: [], assessment: '' });
    setEditingModule(null);
  };


  const topicName = (id) => topics.find((item) => item.id === id)?.name || 'Topic unavailable';
  const filtered = (rows, kind) => rows.filter((item) => {
    const query = (queries[kind] || '').trim().toLocaleLowerCase();
    const matchesQuery = [item.name, item.title, item.description, item.topic && topicName(item.topic)].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
    const matchesStatus = kind === 'resources' ? resourceStatus === 'all' || item.reviewStatus === resourceStatus : statusFilter === 'all' || item.status === statusFilter;
    return matchesQuery && matchesStatus && (kind === 'topics' || Boolean(topicId) || !topicFilter || item.topic === topicFilter);
  }).sort((a, b) => sortBy === 'title' ? (a.name || a.title).localeCompare(b.name || b.title)
    : (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const visibleTopics = filtered(topics, 'topics');
  const visibleResources = filtered(resources, 'resources');
  const visibleModules = filtered(modules, 'modules');
  const filters = (kind) => <div className="learning-table-filters">
    <label className="learning-search-field"><span className="sr-only">Search {kind}</span><Search size={18} aria-hidden="true" />
      <input type="search" value={queries[kind]} placeholder={`Search ${kind}`} onChange={(event) => setQueries({ ...queries, [kind]: event.target.value })} /></label>
    {kind === 'topics' ? <label className="learning-filter"><span>Status</span><select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
      <option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      : <label hidden={Boolean(topicId)} className="learning-filter"><span>Topic</span><select className="form-input" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="">All topics</option>{topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <label className="learning-filter"><span>Sort</span><select className="form-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Newest</option><option value="title">Title A–Z</option></select></label>
    {kind === 'modules' && <label className="learning-filter"><span>Status</span><select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>}
  </div>;
  const topicForm = <form id="staff-topic-editor" className="learning-staff-form" onSubmit={async (event) => { event.preventDefault();
          if (await act(() => editingTopic
            ? learningService.updateTopic(editingTopic, topicDraft) : learningService.createTopic(topicDraft),
          editingTopic ? 'Topic draft updated.' : 'Topic draft created.')) {
            resetTopic();
          } }}>
                    {editingTopic && <button type="button" className="btn btn-secondary btn-sm" onClick={resetTopic}>Cancel edit</button>}
          <label className="form-label" htmlFor="topic-name">Name</label>
          <input id="topic-name" placeholder="e.g. Python Foundations" className="form-input" required minLength={2} maxLength={80} value={topicDraft.name} onChange={(event) => setTopicDraft({ ...topicDraft, name: event.target.value })} />
          <label className="form-label" htmlFor="topic-description">Description</label>
          <textarea id="topic-description" rows={5} placeholder="Describe what Students can learn in this topic." className="form-input" required minLength={3} maxLength={500} value={topicDraft.description} onChange={(event) => setTopicDraft({ ...topicDraft, description: event.target.value })} />
          <button className="btn btn-primary" disabled={working}>{editingTopic ? 'Save draft' : 'Create draft'}</button>
        </form>;
  const resourceForm = <fieldset disabled={!hasPublishedTopic} className="prerequisite-fields"><form className="learning-staff-form" onSubmit={async (event) => {
          event.preventDefault();
          const body = { topic: resourceDraft.topic, title: resourceDraft.title,
            description: resourceDraft.description, resourceType: resourceDraft.resourceType,
            ...(resourceDraft.resourceType === 'text'
              ? (resourceDraft.textContent.trim() ? { textContent: resourceDraft.textContent } : {}) : (resourceDraft.externalUrl.trim() ? { externalUrl: resourceDraft.externalUrl } : {})) };
          if (await act(() => editingResource
            ? learningService.updateStaffResource(editingResource, body)
            : learningService.createStaffResource(body),
          editingResource ? 'Resource updated.' : 'Official resource draft created.')) { resetResource(); setResourceStatus('all'); }
        }}>
                    {editingResource && <button type="button" className="btn btn-secondary btn-sm"
            onClick={resetResource}>Cancel edit</button>}
          <label className="form-label" htmlFor="staff-resource-topic">Published topic</label>
          <select id="staff-resource-topic" className="form-input" required disabled={Boolean(topicId)} value={resourceDraft.topic}
            onChange={(event) => setResourceDraft({ ...resourceDraft, topic: event.target.value })}>
            <option value="">Choose topic</option>
            {topics.filter((item) => item.status === 'published').map((item) =>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="form-label" htmlFor="staff-resource-title">Title</label>
          <input id="staff-resource-title" placeholder="e.g. Variables and data types" className="form-input" required minLength={3} maxLength={120}
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
            <textarea id="staff-resource-text" rows={8} className="form-input" maxLength={10000}
              value={resourceDraft.textContent}
              onChange={(event) => setResourceDraft({ ...resourceDraft, textContent: event.target.value })} />
          </> : <>
            <label className="form-label" htmlFor="staff-resource-url">HTTPS URL</label>
            <input id="staff-resource-url" className="form-input" type="url" maxLength={1000}
              value={resourceDraft.externalUrl}
              onChange={(event) => setResourceDraft({ ...resourceDraft, externalUrl: event.target.value })} />
          </>}
          <button className="btn btn-primary" disabled={working}>
            {editingResource ? 'Save draft / submission' : 'Create resource draft'}</button>
        </form></fieldset>;
  const moduleForm = <fieldset disabled={!hasPublishedTopic} className="prerequisite-fields"><form onSubmit={async (event) => { event.preventDefault();
          const body = { ...moduleDraft, ...(moduleDraft.assessment ? {} : { assessment: undefined }) };
          if (await act(() => editingModule
            ? learningService.updateModule(editingModule, body) : learningService.createModule(body),
          editingModule ? 'Module draft updated.' : 'Module draft created.')) resetModule();
        }}>
                    {editingModule && <button type="button" className="btn btn-secondary btn-sm"
            onClick={resetModule}>Cancel edit</button>}
          <label className="form-label" htmlFor="module-topic">Published topic</label>
          <select id="module-topic" className="form-input" required disabled={Boolean(topicId)} value={moduleDraft.topic} onChange={(event) => setModuleDraft({ ...moduleDraft, topic: event.target.value, resources: [], assessment: '' })}>
            <option value="">Choose topic</option>{topics.filter((item) => item.status === 'published').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><label className="form-label" htmlFor="module-title">Title</label>
          <input id="module-title" placeholder="e.g. Getting started with Python" className="form-input" required minLength={3} maxLength={120} value={moduleDraft.title} onChange={(event) => setModuleDraft({ ...moduleDraft, title: event.target.value })} />
          <label className="form-label" htmlFor="module-description">Description</label>
          <textarea id="module-description" className="form-input" required minLength={3} maxLength={500} value={moduleDraft.description} onChange={(event) => setModuleDraft({ ...moduleDraft, description: event.target.value })} />
          <h3>Lesson order</h3><p className="form-hint">Add 1–20 published resources. Students see lessons in this order. Use Move up or Move down to organize them before saving.</p>
          {moduleDraft.topic && !available.length && <p>No published resources in this topic. <button type="button" className="text-action" onClick={() => setSection('resources')}>Create or review resources</button> first.</p>}
          <ol className="learning-lesson-editor">{moduleDraft.resources.map((resourceId, index) => {
            const title = available.find((item) => item.id === resourceId)?.title || 'Resource unavailable — remove before saving';
            return <li key={resourceId}><strong>{title}</strong><div className="learning-builder-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={working || index === 0} aria-label={`Move up: ${title}`}
                onClick={() => setModuleDraft((current) => ({ ...current, resources: moveLesson(current.resources, index, -1) }))}>Move up</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={working || index === moduleDraft.resources.length - 1} aria-label={`Move down: ${title}`}
                onClick={() => setModuleDraft((current) => ({ ...current, resources: moveLesson(current.resources, index, 1) }))}>Move down</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={working} aria-label={`Remove lesson: ${title}`}
                onClick={() => setModuleDraft((current) => ({ ...current, resources: current.resources.filter((id) => id !== resourceId) }))}>Remove</button>
            </div></li>;
          })}</ol>
          <div className="learning-builder-actions">{available.filter((item) => !moduleDraft.resources.includes(item.id)).map((item) => <button key={item.id} type="button" className="btn btn-secondary btn-sm" disabled={working || moduleDraft.resources.length >= 20} onClick={() => setModuleDraft((current) => ({ ...current, resources: [...current.resources, item.id] }))}>Add {item.title}</button>)}</div>
          <label className="form-label" htmlFor="module-assessment">Optional published assessment</label>
          <select id="module-assessment" className="form-input" value={moduleDraft.assessment} onChange={(event) => setModuleDraft({ ...moduleDraft, assessment: event.target.value })}>
            <option value="">None</option>{availableAssessments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          {moduleDraft.topic && !availableAssessments.length && <p className="form-hint">No published assessment for this topic. <Link to={`${staffBase}/assessments?topic=${encodeURIComponent(moduleDraft.topic)}&create=1`}>Create and publish one</Link>, then return here to attach it.</p>}
          <p className="form-hint">A module may be published without an assessment. Attach one for a study → assessment → eligible credit reward path.</p>
          <button type="submit" className="btn btn-primary" disabled={working || !moduleDraft.resources.length || !hasPublishedTopic}>
            {editingModule ? 'Save draft' : 'Create module'}</button>
        </form></fieldset>;
  const resourceReview = (item) => <article className="learning-resource-review">
          <div className="learning-submission-heading"><h3>{item.title}</h3><span className={`badge ${item.reviewStatus === 'submitted' ? 'badge-pending' : item.reviewStatus === 'published' ? 'badge-success' : item.reviewStatus === 'rejected' ? 'badge-danger' : 'badge-navy'}`}>{item.reviewStatus === 'submitted' ? 'Awaiting review' : item.reviewStatus}</span></div><p>{item.description}</p>
          <dl className="learning-submission-meta"><div><dt>Topic</dt><dd>{topics.find((topic) => topic.id === item.topic)?.name || 'Topic unavailable'}</dd></div><div><dt>Submitted by</dt><dd>{item.submitterName || item.submittedBy || 'Account unavailable'}</dd></div><div><dt>Content type</dt><dd>{item.resourceType === 'text' ? 'Text lesson' : 'HTTPS resource'}</dd></div><div><dt>Submitted</dt><dd>{item.createdAt ? <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time> : 'Not recorded'}</dd></div></dl>
          <details><summary>Preview resource content</summary>{item.resourceType === 'text' ? <p style={{ whiteSpace: 'pre-wrap' }}>{item.textContent}</p>
            : <ExternalResourceLink href={item.externalUrl}>Review external resource</ExternalResourceLink>}</details>
          {item.reviewNote && <p>Review note: {item.reviewNote}</p>}
          {['submitted', 'draft'].includes(item.reviewStatus) && <button type="button" className="btn btn-secondary btn-sm"
            disabled={working} onClick={() => {
              setEditors((current) => ({ ...current, resources: true }));
              focusTarget.current = 'staff-resource-title'; setEditingResource(item.id);
              setResourceDraft({ topic: item.topic, title: item.title, description: item.description,
                resourceType: item.resourceType, textContent: item.textContent || '',
                externalUrl: item.externalUrl || '' });
            }}>{item.reviewStatus === 'draft' ? 'Edit draft' : 'Edit submission'}</button>}
          {['submitted', 'draft'].includes(item.reviewStatus) && <><label className="form-label" htmlFor={`resource-price-${item.id}`}>Approved cost (0 = free)</label>
            <input id={`resource-price-${item.id}`} className="form-input" type="number" min="0" max="1000" step="1" value={prices[item.id] ?? 0} onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })} />
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => publishContent('resource', item, () => learningService.publishResource(item.id, priceFor(item.id)), priceFor(item.id))}>{item.reviewStatus === 'draft' ? 'Publish draft' : 'Approve & publish'}</button>
            {item.reviewStatus === 'submitted' && <>
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
            <button type="button" className="btn btn-danger btn-sm" disabled={working || (reasons[item.id] || '').trim().length < 3} onClick={() => act(() => learningService.rejectResource(item.id, reasons[item.id]), 'Resource rejected with feedback.')}>Reject with feedback</button></>}</>}
          {item.reviewStatus === 'published' && <button type="button" className="btn btn-danger btn-sm" disabled={working} onClick={() => act(() => learningService.archiveResource(item.id), 'Resource archived.')}>Archive</button>}
        </article>;

  return <div className={`staff-page learning-management-page${topicId ? ' is-topic-management' : ''}`}>
    <header className="staff-page-header">
      {topicId ? <>
        <nav className="learning-staff-breadcrumb" aria-label="Topic management breadcrumb"><ol>
          <li><Link to={`${pathname}#manage-panel-topics`}><ArrowLeft size={16} aria-hidden="true" />Learning Management</Link></li>
          <li aria-current="page">{workspaceTopic?.name || 'Topic'}</li>
        </ol></nav>
        <div className="learning-topic-heading"><h1>{workspaceTopic?.name || 'Topic Management'}</h1>
          {workspaceTopic && <LearningContentStatus status={workspaceTopic.status} />}</div>
        {workspaceTopic?.description && <p className="learning-topic-description">{workspaceTopic.description}</p>}
      </> : <div><span className="staff-eyebrow">{staffBase === '/admin' ? 'Administration' : 'Moderator'} / Learning</span>
        <h1>Learning Management</h1><p>Create a curriculum, organize lessons, and review community contributions.</p></div>}
    </header>
    {!topicId && <div className="learning-create-toolbar" aria-label="Learning authoring actions">
      <button hidden={Boolean(topicId)} id="learning-create-topics" type="button" className="btn btn-primary" disabled={loading || working || Boolean(error)} onClick={() => showEditor('topics')}><Plus size={17} aria-hidden="true" />{editingTopic ? 'Topic editor' : 'Create Topic'}</button>
      <button id="learning-create-resources" type="button" className="btn btn-secondary" disabled={loading || working || Boolean(error) || !hasPublishedTopic} onClick={() => showEditor('resources')}><Plus size={17} aria-hidden="true" />{editingResource ? 'Resource editor' : 'Create Resource'}</button>
      <button id="learning-create-modules" type="button" className="btn btn-secondary" disabled={loading || working || Boolean(error) || !hasPublishedTopic} onClick={() => showEditor('modules')}><Plus size={17} aria-hidden="true" />{editingModule ? 'Module editor' : 'Create Module'}</button>
      <Link className="btn btn-secondary" to={assessmentUrl}><ClipboardList size={17} aria-hidden="true" />Manage Assessments</Link>
    </div>}
    {!topicId && <details className="learning-authoring-guide"><summary>How to build a curriculum <ChevronDown size={16} aria-hidden="true" /></summary>
      <ol><li>Create and publish a topic.</li><li>Create or approve its lesson resources.</li><li>Create a module draft with those resources.</li>
        <li>Publish and attach a same-topic assessment, then publish the module.</li></ol>
      <p className="form-hint">Module drafts need at least one published resource. Assessment attachment is optional; eligible credits come from passing assessments.</p>
    </details>}
    <div className="learning-management-toolbar"><WorkflowTabs id="manage" tabs={topicId ? [['modules', 'Modules'], ['resources', 'Resources'], ['assessments', 'Assessments'], ['settings', 'Topic Settings']] : [['topics', 'Topics'], ['resources', 'Resources'], ['modules', 'Modules']]} active={section} onChange={setSection} /><Link hidden={Boolean(topicId)} className="learning-assessments-tab" to={assessmentUrl}>Assessments <ClipboardList size={16} aria-hidden="true" /></Link></div>
    <Alert type="danger" message={error} />
    <Alert type="danger" message={actionError} />
    {loading ? <LoadingSpinner text="Loading learning content..." /> : error ? <p className="staff-data-note">Learning management is unavailable. <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); void load(); }}>Retry</button></p> : <>
      {!topicId && <section id="manage-panel-topics" role="tabpanel" aria-labelledby="manage-tab-topics" hidden={section !== 'topics'}>
        <div className="learning-topic-management-grid">
          <section className="learning-editor-panel learning-staff-editor" aria-label="Topic editor"><h2>{editingTopic ? 'Edit topic draft' : 'Create New Topic'}</h2><p>Start with a subject and a clear learning goal. Drafts are visible only to staff.</p>{topicForm}</section>
          <section className="learning-list-panel"><div className="learning-list-heading"><h2>Existing Topics</h2><span>{visibleTopics.length} shown</span></div>{filters('topics')}
            <LearningContentTable label="Learning topics" columns={['Topic', 'Status', 'Actions']} count={visibleTopics.length} empty={topics.length ? 'No topics match these filters.' : 'No topics yet. Create your first topic using the form.'}>
              {visibleTopics.map((item) => <tr role="row" key={item.id} className="learning-management-item">
                <td role="cell" data-label="Topic"><h3><Link className="text-link" to={`${pathname}?topic=${encodeURIComponent(item.id)}#manage-panel-modules`}>{item.name}</Link></h3><p>{item.description}</p></td><td role="cell" data-label="Status"><LearningContentStatus status={item.status} /></td>
                <td role="cell" data-label="Actions"><div className="learning-row-actions">
                  {item.status === 'draft' && <><button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => { focusTarget.current = 'topic-name'; setEditingTopic(item.id); setTopicDraft({ name: item.name, description: item.description }); }}>Edit draft</button><button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => publishContent('topic', item, () => learningService.publishTopic(item.id))}>Publish</button></>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTopic(item)}>Open Topic</button>
                  {item.status === 'published' && <button type="button" className="btn btn-danger btn-sm" disabled={working} onClick={() => act(() => learningService.archiveTopic(item.id), 'Topic archived.')}>Archive</button>}
                  {item.status === 'archived' && <span className="form-hint">Read only</span>}
                </div></td>
              </tr>)}
            </LearningContentTable>
          </section>
        </div>
      </section>}
      <section id="manage-panel-resources" role="tabpanel" aria-labelledby="manage-tab-resources" hidden={section !== 'resources'}>
        {editors.resources && <section className="learning-editor-panel learning-staff-editor" aria-label="Resource editor"><div className="learning-editor-heading"><h2>{editingResource ? 'Edit resource submission' : 'Create Resource'}</h2><button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => { focusTarget.current = 'learning-create-resources'; setEditors({ ...editors, resources: false }); }}><X size={16} aria-hidden="true" />Hide editor</button></div>{resourceForm}</section>}
        <section className="learning-list-panel"><div className="learning-list-heading"><div><h2>{topicId ? 'Resources' : 'Resources & Review Queue'}</h2><p>Create official drafts and review Student contributions.</p></div>
          {topicId && hasPublishedTopic ? <button id="learning-create-resources" type="button" className="btn btn-primary" disabled={working || Boolean(error)} onClick={() => showEditor('resources')}><Plus size={17} aria-hidden="true" />{editingResource ? 'Resource editor' : 'Create Resource'}</button> : <span>{visibleResources.length} shown</span>}</div>
          <div className="learning-review-filters" role="group" aria-label="Resource review status">{[['draft', 'Official drafts'], ['submitted', `Awaiting review (${awaitingReview})`], ['published', 'Published'], ['rejected', 'Rejected'], ['archived', 'Archived'], ['all', 'All resources']].map(([value, label]) => <button type="button" key={value} className={`btn btn-sm ${resourceStatus === value ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={resourceStatus === value} onClick={() => setResourceStatus(value)}>{label}</button>)}</div>
          {filters('resources')}
          <LearningContentTable label="Learning resources" columns={['Resource', 'Topic', 'Type', 'Status', 'Actions']} count={visibleResources.length} empty={resources.length ? 'No resources match these filters.' : topicId ? hasPublishedTopic ? 'No resources have been added to this Topic yet. Use Create Resource to save an official draft. Student contributions appear here for review.' : 'No resources have been added to this Topic yet. Publish the Topic in Topic Settings before adding resources.' : 'No resources yet. Create a lesson or review a Student submission here.'}>
            {visibleResources.map((item) => <React.Fragment key={item.id}><tr role="row" className="learning-management-item">
              <td role="cell" data-label="Resource"><h3>{item.title}</h3><p>{item.description}</p><p className="form-hint">{item.creationOrigin === 'staff' ? 'Official staff resource' : item.creationOrigin === 'student' ? 'Student contribution' : 'Historical origin not recorded'}</p></td><td role="cell" data-label="Topic">{topicName(item.topic)}</td><td role="cell" data-label="Type">{item.resourceType === 'text' ? 'Text lesson' : 'HTTPS link'}</td><td role="cell" data-label="Status"><LearningContentStatus status={item.reviewStatus} /></td>
              <td role="cell" data-label="Actions"><button type="button" className="btn btn-secondary btn-sm" aria-expanded={reviewingResource === item.id} aria-controls={`resource-review-${item.id}`} onClick={() => setReviewingResource(reviewingResource === item.id ? null : item.id)}>{reviewingResource === item.id ? 'Close review' : 'Review resource'}</button></td>
            </tr><tr role="row" className="learning-review-row" hidden={reviewingResource !== item.id}><td role="cell" colSpan={5}><div id={`resource-review-${item.id}`}>{resourceReview(item)}</div></td></tr></React.Fragment>)}
          </LearningContentTable>
        </section>
        {!hasPublishedTopic && <p className="form-hint">Create and publish a topic before adding resources.</p>}
      </section>
      <section id="manage-panel-modules" role="tabpanel" aria-labelledby="manage-tab-modules" hidden={section !== 'modules'}>
        {editors.modules && <section className="learning-editor-panel learning-staff-editor" aria-label="Module editor"><div className="learning-editor-heading"><h2>{editingModule ? 'Edit module draft' : 'Create Module'}</h2><button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => { focusTarget.current = 'learning-create-modules'; setEditors({ ...editors, modules: false }); }}><X size={16} aria-hidden="true" />Hide editor</button></div>{moduleForm}</section>}
        <section className="learning-list-panel"><div className="learning-list-heading"><div><h2>{topicId ? 'Modules' : 'Learning Modules'}</h2><p>Organize published resources into a clear learning sequence.</p></div>
          {topicId && hasPublishedTopic ? <button id="learning-create-modules" type="button" className="btn btn-primary" disabled={working || Boolean(error)} onClick={() => showEditor('modules')}><Plus size={17} aria-hidden="true" />{editingModule ? 'Module editor' : 'Create Module'}</button> : <span>{visibleModules.length} shown</span>}</div>{filters('modules')}
          <LearningContentTable label="Learning modules" columns={['Module', 'Topic', 'Curriculum', 'Status', 'Actions']} count={visibleModules.length} empty={modules.length ? 'No modules match these filters.' : topicId ? hasPublishedTopic ? 'No learning modules are available in this Topic yet. Use Create Module to organize published resources into a curriculum.' : 'No learning modules are available in this Topic yet. Publish the Topic in Topic Settings before creating its curriculum.' : 'No modules yet. Use Create Module to organize approved resources.'}>
            {visibleModules.map((item) => <tr role="row" key={item.id} className="learning-management-item">
              <td role="cell" data-label="Module"><h3>{item.title}</h3><p>{item.description}</p></td><td role="cell" data-label="Topic">{topicName(item.topic)}</td>
              <td role="cell" data-label="Curriculum"><details className="learning-module-outline"><summary>{item.resources.length} {item.resources.length === 1 ? 'lesson' : 'lessons'}{item.assessment ? ' / Assessment' : ''}</summary><ol>{item.resources.map((id) => <li key={id}>{resources.find((resource) => resource.id === id)?.title || 'Resource unavailable'}</li>)}</ol><p>{item.assessment ? `Assessment: ${assessments.find((assessment) => assessment.id === item.assessment)?.title || 'Assessment unavailable'}` : 'No assessment attached.'}</p>{!item.assessment && <Link className="text-link" to={`${pathname}?topic=${encodeURIComponent(item.topic)}#manage-panel-assessments`}>Manage Topic assessments</Link>}</details></td>
              <td role="cell" data-label="Status"><LearningContentStatus status={item.status} /></td><td role="cell" data-label="Actions"><div className="learning-row-actions">
                {item.status === 'draft' && <><button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => { focusTarget.current = 'module-title'; setEditors({ ...editors, modules: true }); setEditingModule(item.id); setModuleDraft({ topic: item.topic, title: item.title, description: item.description, resources: item.resources || [], assessment: item.assessment || '' }); }}>Edit draft</button>
                  <label className="learning-publish-price" htmlFor={`module-price-${item.id}`}><span>Cost</span><input id={`module-price-${item.id}`} className="form-input" type="number" min="0" max="1000" step="1" value={prices[item.id] ?? 0} onChange={(event) => setPrices({ ...prices, [item.id]: event.target.value })} /></label>
                  <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => publishContent('module', item, () => learningService.publishModule(item.id, priceFor(item.id)), priceFor(item.id))}>Publish</button></>}
                {item.status === 'published' && <button type="button" className="btn btn-danger btn-sm" disabled={working} onClick={() => act(() => learningService.archiveModule(item.id), 'Module archived.')}>Archive</button>}
                {item.status === 'archived' && <span className="form-hint">Read only</span>}
              </div></td>
            </tr>)}
          </LearningContentTable>
        </section>
        {!hasPublishedTopic && <p className="form-hint">Create and publish a topic before adding modules.</p>}
      </section>
      {topicId && <>
        <section id="manage-panel-assessments" role="tabpanel" aria-labelledby="manage-tab-assessments" hidden={section !== 'assessments'} className="learning-list-panel">
          <div className="learning-list-heading"><div><h2>Assessments</h2><p>Assessments belong to this topic. Only explicitly attached assessments enter module progress.</p></div>
          {workspaceTopic?.status === 'published' && <Link className="btn btn-primary" to={`${assessmentUrl}&create=1`}>Create Assessment</Link>}</div>
          <LearningContentTable label="Topic assessments" columns={['Assessment', 'Topic', 'Modules', 'Status', 'Actions']} count={assessments.length} empty={hasPublishedTopic ? 'No assessments are available in this Topic yet. Use Create Assessment to prepare a draft; attach it to a Module after publication if needed.' : 'No assessments are available in this Topic yet. Publish the Topic in Topic Settings before creating an assessment.'}>
            {assessments.map((item) => <tr key={item.id} className="learning-management-item"><td data-label="Assessment"><h3>{item.title}</h3></td><td data-label="Topic">{workspaceTopic?.name}</td><td data-label="Modules">{modules.filter((module) => module.assessment === item.id).map((module) => module.title).join(', ') || 'Standalone topic assessment'}</td><td data-label="Status"><LearningContentStatus status={item.status} /></td><td data-label="Actions"><Link className="btn btn-secondary btn-sm" to={`${assessmentUrl}&open=${encodeURIComponent(item.id)}`}>Review / manage</Link></td></tr>)}
          </LearningContentTable>
        </section>
        <section id="manage-panel-settings" role="tabpanel" aria-labelledby="manage-tab-settings" hidden={section !== 'settings'} className="learning-editor-panel">
          <h2>Topic Settings</h2><p>{workspaceTopic?.description}</p>
          {workspaceTopic?.status === 'draft' && <><button className="btn btn-secondary" disabled={working} onClick={() => { setEditingTopic(workspaceTopic.id); setTopicDraft({ name: workspaceTopic.name, description: workspaceTopic.description }); }}>Edit topic draft</button>
            {editingTopic === workspaceTopic.id && topicForm}<button className="btn btn-primary" disabled={working} onClick={() => publishContent('topic', workspaceTopic, () => learningService.publishTopic(workspaceTopic.id))}>Publish Topic</button></>}
          {workspaceTopic?.status === 'published' && <button className="btn btn-danger" disabled={working} onClick={() => act(() => learningService.archiveTopic(workspaceTopic.id), 'Topic archived.')}>Archive Topic</button>}
          {workspaceTopic?.status === 'archived' && <p>Archived topic. Historical records are retained.</p>}
        </section>
      </>}
    </>}
  </div>;
};

export default ModeratorLearningPage;
