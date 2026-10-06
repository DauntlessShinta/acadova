import ExternalResourceLink from '../components/common/ExternalResourceLink';
import ResourceRow from '../components/learning/ResourceRow';
import { learningAccessLabel, resourceSource } from '../utils/learningPresentation';
import WorkflowTabs from '../components/common/WorkflowTabs';
import { useConfirm } from '../context/confirmAccess';
import { useToast } from '../context/toastAccess';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { discoveryDestination, discoveryQueryError, filterLearningTopics, learningTopicTitle } from '../utils/discoverySearch';
import learningService from '../services/learningService';
import Alert from '../components/common/Alert';
import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { readLearningResume, saveLearningResume } from '../utils/learningResume';

const emptySubmission = { topic: '', title: '', description: '', resourceType: 'text', textContent: '', externalUrl: '' };

export const LearningPage = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const topicId = searchParams.get('topic');
  const moduleId = searchParams.get('module');
  const resourceId = searchParams.get('resource');
  const lessonQuery = searchParams.get('lesson');
  const continueQuery = searchParams.has('continue');
  const topicQuery = searchParams.get('q') || '';
  const userId = user?._id || user?.id;
  const [topics, setTopics] = useState([]);
  const [topicsAvailable, setTopicsAvailable] = useState(false);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const lessonIndex = Math.min(Math.max(0, Number.parseInt(lessonQuery, 10) || 0),
    Math.max(0, (content?.resources || []).length - 1));
  const [resume] = useState(() => readLearningResume(userId));
  const [submission, setSubmission] = useState(emptySubmission);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const section = searchParams.get('view') === 'contribute' ? 'contribute' : 'library';
  const setSection = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'contribute') next.set('view', value); else next.delete('view');
    setSearchParams(next);
  };
  const [error, setError] = useState('');
  const dirty = JSON.stringify(submission) !== JSON.stringify(emptySubmission);
  useUnsavedChanges(dirty);
  const matchingTopics = filterLearningTopics(topics, topicQuery);
  useEffect(() => {
    learningService.topics().then((response) => { setTopics(response.data || []); setTopicsAvailable(true); })
      .catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!continueQuery) return;
    const next = new URLSearchParams();
    if (resume) {
      next.set('topic', resume.topicId); next.set('module', resume.moduleId);
      next.set('lesson', String(resume.lessonIndex));
    }
    setSearchParams(next, { replace: true });
  }, [continueQuery, resume, setSearchParams]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
    if (!active) return;
    setTopic(null); setContent(null); setError('');
    if (!topicId || continueQuery) { setWorking(false); return; }
    setWorking(true);
    await Promise.all([learningService.topic(topicId), resourceId ? learningService.resource(resourceId)
      : moduleId ? learningService.module(moduleId) : Promise.resolve(null)])
      .then(([topicResult, detail]) => {
        if (!active) return;
        if (detail && String(detail.data.topic) !== String(topicId)) throw new Error('This content belongs to another topic.');
        setTopic(topicResult.data); setContent(detail?.data || null);
      }).catch((err) => { if (active) setError(err.message || 'This learning view is unavailable. Browse current topics instead.'); })
      .finally(() => { if (active) setWorking(false); });
    });
    return () => { active = false; };
  }, [topicId, moduleId, resourceId, continueQuery]);
  const navigateLearning = (values) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value != null) next.set(key, String(value));
    setSearchParams(next);
  };
  const openTopic = (id) => navigateLearning({ topic: id });
  const openResource = (id) => navigateLearning({ topic: topic.id, resource: id });
  const openModule = (item) => {
    navigateLearning({ topic: topic.id, module: item.id, lesson: 0 });
    saveLearningResume(userId, { topicId: topic.id, moduleId: item.id,
      lessonIndex: 0, moduleTitle: item.title });
  };
  const selectLesson = (index) => {
    navigateLearning({ topic: topic.id, module: content.id, lesson: index });
    saveLearningResume(userId, { topicId: topic.id, moduleId: content.id,
      lessonIndex: index, moduleTitle: content.title });
  };
  const submit = async (event) => {
    event.preventDefault(); setWorking(true); setError('');
    const body = { topic: submission.topic, title: submission.title,
      description: submission.description, resourceType: submission.resourceType,
      ...(submission.resourceType === 'text' ? { textContent: submission.textContent }
        : { externalUrl: submission.externalUrl }) };
    try { await learningService.submit(body); toast('success', 'Resource submitted for staff review.');
      setSubmission(emptySubmission); }
    catch (err) { toast('error', err.message || 'Resource could not be submitted.'); }
    finally { setWorking(false); }
  };
  const unlock = async () => {
    if (!content?.locked || !await confirm(`Unlock ${content.title} for ${content.creditCost} credits?`, { title: 'Unlock learning content', label: 'Unlock', destructive: false })) return;
    setWorking(true); setError('');
    try {
      const module = !content.resourceType;
      await (module ? learningService.unlockModule(content.id) : learningService.unlockResource(content.id));
      await refreshUser();
      const [detail, updatedTopic] = await Promise.all([
        module ? learningService.module(content.id) : learningService.resource(content.id),
        learningService.topic(topic.id),
      ]);
      setContent(detail.data); setTopic(updatedTopic.data); toast('success', 'Learning content unlocked.');
    } catch (err) { toast('error', err.message?.includes('credits')
      ? 'You need more Acadova Credits. Pass a qualifying assessment or teach a verified session to earn credits.'
      : 'Content could not be unlocked right now. Please try again.'); }
    finally { setWorking(false); }
  };
  const resourceBody = (item) => item.resourceType === 'text'
    ? <p style={{ whiteSpace: 'pre-wrap' }}>{item.textContent}</p>
     : <div className="learning-external-resource"><p className="learning-item-meta">External learning resource{resourceSource(item.externalUrl) && <> · {resourceSource(item.externalUrl)}</>}</p>
      <ExternalResourceLink href={item.externalUrl} primary /></div>;

  return <div className="learning-page">
    <header className="learning-page-header">
      {section === 'library' && topic && <nav className="learning-breadcrumbs" aria-label="Learning breadcrumb"><ol>
        <li><button type="button" className="text-action" onClick={() => navigateLearning({})}>Learning</button></li>
        {content && <li><button type="button" className="text-action" onClick={() => openTopic(topic.id)}>{learningTopicTitle(topic)}</button></li>}
        <li aria-current="page">{content?.title || learningTopicTitle(topic)}</li>
      </ol></nav>}
      <h1>{section === 'contribute' ? 'Share a resource' : content?.title || (topic ? learningTopicTitle(topic) : 'Learning')}</h1>
      <p>{section === 'contribute' ? 'Submit teaching material for staff review before publication.' : content ? content.description : topic ? topic.description : 'Browse approved topics, study free resources, and take assessments.'}</p>
      {section === 'library' && topic && !content && <p className="learning-item-meta">{topic.modules.length} {topic.modules.length === 1 ? 'module' : 'modules'} · {topic.resources.length} {topic.resources.length === 1 ? 'resource' : 'resources'}</p>}
    </header>
    <Alert type="danger" message={error} />
    {working && <p role="status">Loading learning content...</p>}
    {loading ? <LoadingSpinner text="Loading topics..." /> : <>
      <WorkflowTabs id="learning" tabs={[['library', 'Browse learning'], ['contribute', 'Share a resource']]} active={section} onChange={setSection} />
      <section role="tabpanel" id="learning-panel-library" aria-labelledby="learning-tab-library" hidden={section !== 'library'}>
      {!topic && topicQuery && <div className="learning-search-summary"><p role="status">{matchingTopics.length} {matchingTopics.length === 1 ? 'published topic matches' : 'published topics match'} “{topicQuery}”.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('q'); setSearchParams(next); }}>Clear search</button></div>}
      {!topic ? <div className="assessment-list learning-topic-results">{!topicsAvailable ? <div className="card"><h2>Learning topics could not be loaded.</h2><p>Refresh to try again, or find a peer to learn with.</p><Link className="btn btn-primary" to="/tutors">Find a Tutor</Link></div> : topics.length === 0 ? <div className="card"><h2>No learning topics are available yet.</h2><p>You can still learn with a peer while staff prepare topics.</p><Link className="btn btn-primary" to="/tutors">Find a Tutor</Link></div>
        : matchingTopics.length === 0 ? <div className="card"><h2>No matching learning topics</h2><p>Try a shorter subject or clear the search to browse all published topics.</p><Link className="btn btn-secondary" to={discoveryQueryError('tutors', topicQuery) ? '/tutors' : discoveryDestination('tutors', topicQuery)}>Find a Tutor instead</Link></div>
        : matchingTopics.map((item) => <article className="card" key={item.id}><h2>{learningTopicTitle(item)}</h2><p>{item.description}</p>
          <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => openTopic(item.id)}>Explore topic</button>
        </article>)}</div> : <>
        {content && <section className="learning-content-detail" aria-label={content.resourceType ? 'Resource detail' : 'Module content'}>
          <p className="learning-item-meta"><span className="learning-access">{learningAccessLabel(content)}{content.resourceType && content.creditCost === 0 ? ' resource' : ''}</span></p>
          {content.locked ? <div className="card learning-unlock"><p>Unlock this {content.resourceType ? 'resource' : 'module'} to study its content.</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={unlock}>Unlock for {content.creditCost} credits</button></div>
            : content.resourceType ? resourceBody(content)
              : <><p className="learning-item-meta">{content.resources?.length || 0} learning resources</p>
                  {content.unavailableResourceCount > 0 && <Alert type="warning" message="Some resources in this module are no longer available. The remaining published resources are shown below." />}
                  {(content.resources || []).length === 0 ? <p>This module doesn't have learning materials yet.</p>
                    : <div className="learning-module-layout">
                      <section aria-labelledby="learning-study-heading"><h2 id="learning-study-heading">Study</h2>
                        <ol className="learning-resource-order">
                          {content.resources.map((item, index) => <li key={item.id}>
                            <ResourceRow resource={item} selected={lessonIndex === index} disabled={working} onOpen={() => selectLesson(index)} />
                          </li>)}
                        </ol>
                      </section>
                      <section className="learning-current-resource" aria-label="Current resource">
                        <h2>{content.resources[lessonIndex]?.title}</h2>
                        <p>{content.resources[lessonIndex]?.description}</p>
                        {content.resources[lessonIndex]?.locked
                          ? <><p>This resource requires {content.resources[lessonIndex].creditCost} credits.</p>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={working}
                              onClick={() => openResource(content.resources[lessonIndex].id)}>
                              View unlock options</button></>
                          : resourceBody(content.resources[lessonIndex])}
                        <div className="learning-lesson-actions">
                          <button type="button" className="btn btn-secondary btn-sm" disabled={lessonIndex === 0}
                            onClick={() => selectLesson(lessonIndex - 1)}>Previous resource</button>
                          <button type="button" className="btn btn-primary btn-sm"
                            disabled={lessonIndex >= content.resources.length - 1}
                            onClick={() => selectLesson(lessonIndex + 1)}>Next resource</button>
                        </div>
                      </section>
                    </div>}
                  {content.assessment && <section className="learning-assessment" aria-labelledby="learning-assessment-heading">
                    <h2 id="learning-assessment-heading">Check your learning</h2><p>Assessment</p>
                    <Link className="btn btn-primary btn-sm" to={'/assessments?open=' + content.assessment}>Take assessment</Link>
                  </section>}</>}
        </section>}
        {!content && <>
          <section className="learning-topic-section" aria-labelledby="learning-modules-heading"><h2 id="learning-modules-heading">Modules</h2>
            <p>Choose a structured unit to study its resources in order.</p>
            {topic.modules.length ? <div className="learning-module-list">{topic.modules.map((item) => <article className="card learning-module-summary" key={item.id}>
              <div><h3>{item.title}</h3><p>{item.description}</p><div className="learning-item-meta">
                {Array.isArray(item.resources) && <span>{item.resources.length} learning resources</span>}
                {learningAccessLabel(item) && <span className="learning-access">{learningAccessLabel(item)}</span>}</div></div>
              <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => openModule(item)}>Open module</button>
            </article>)}</div> : <p>No modules are available yet. Explore the resources below.</p>}
          </section>
          {topic.resources.length > 0 && <section className="learning-topic-section" aria-labelledby="learning-resources-heading"><h2 id="learning-resources-heading">Topic resources</h2>
            <p>Browse the available resources individually.</p><div className="learning-resource-list">{topic.resources.map((item) =>
              <ResourceRow key={item.id} resource={item} disabled={working} onOpen={() => openResource(item.id)} />
            )}</div></section>}
          {topic.assessments.length > 0 && <section className="learning-topic-section" aria-labelledby="learning-topic-assessments-heading"><h2 id="learning-topic-assessments-heading">Topic assessments</h2>
            {topic.assessments.map((item) => <p key={item.id}><Link to={`/assessments?open=${item.id}`}>{item.title}</Link> · {item.questionCount} questions</p>)}
          </section>}
        </>}
      </>}
      </section>
      <section role="tabpanel" id="learning-panel-contribute" aria-labelledby="learning-tab-contribute" hidden={section !== 'contribute'} className="learning-contribution">{topics.length ? <form className="card" data-unsaved={dirty} onSubmit={submit}><h2>Share a resource</h2>
        <p>Any Student can contribute teaching material. Staff review it before publication.</p>
        <label className="form-label" htmlFor="learning-topic">Topic</label>
        <select id="learning-topic" className="form-input" required value={submission.topic} onChange={(event) => setSubmission({ ...submission, topic: event.target.value })}>
          <option value="">Choose a topic</option>{topics.map((item) => <option key={item.id} value={item.id}>{learningTopicTitle(item)}</option>)}
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
      </form> : <p>Resource contributions will open when staff publish a topic. <Link to="/tutors">Find a Tutor</Link></p>}</section>
    </>}
  </div>;
};

export default LearningPage;
