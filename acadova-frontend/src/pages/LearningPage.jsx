import ExternalResourceLink from '../components/common/ExternalResourceLink';
import ResourceRow from '../components/learning/ResourceRow';
import { learningAccessLabel, resourceSource } from '../utils/learningPresentation';
import LearningNavigation from '../components/learning/LearningNavigation';
import AssessmentCard from '../components/learning/AssessmentCard';
import ModuleAssessmentEntry from '../components/learning/ModuleAssessmentEntry';
import LearningProgress from '../components/learning/LearningProgress';
import ModuleCurriculum from '../components/learning/ModuleCurriculum';
import '../components/learning/learningWorkspace.css';
import { useConfirm } from '../context/confirmAccess';
import { useToast } from '../context/toastAccess';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, FileText, Link2, Search } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  const navigate = useNavigate();
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
  const [topicProgress, setTopicProgress] = useState(null);
  const [moduleProgress, setModuleProgress] = useState(null);
  const [progressError, setProgressError] = useState('');
  const [progressRefresh, setProgressRefresh] = useState(0);
  const [completing, setCompleting] = useState(false);
  const completionPending = useRef(false);
  const routeIdentity = `${topicId}:${moduleId}:${resourceId}`;
  const activeRoute = useRef(routeIdentity);
  useLayoutEffect(() => { activeRoute.current = routeIdentity; }, [routeIdentity]);
  const [content, setContent] = useState(null);
  const lessonIndex = Math.min(Math.max(0, Number.parseInt(lessonQuery, 10) || 0),
    Math.max(0, (content?.resources || []).length - 1));
  const [resume] = useState(() => readLearningResume(userId));
  const [submission, setSubmission] = useState(emptySubmission);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const mutationPending = useRef(false);
  const [submissionSent, setSubmissionSent] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const section = searchParams.get('view') === 'contribute' ? 'contribute' : 'library';
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
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (!active) return; setTopicProgress(null); setModuleProgress(null); setProgressError('');
    if (topicId && !continueQuery) Promise.all([
      learningService.topicProgress(topicId), moduleId && !resourceId ? learningService.moduleProgress(moduleId) : null,
    ]).then(([topicResult, moduleResult]) => {
      if (active) { setTopicProgress(topicResult.data); setModuleProgress(moduleResult?.data || null); }
    }).catch(() => { if (active) setProgressError('Progress could not be loaded. Please retry.'); });
    });
    return () => { active = false; };
  }, [topicId, moduleId, resourceId, continueQuery, progressRefresh]);
  const completeLesson = async () => {
    const lesson = content?.resources?.[lessonIndex];
    if (completionPending.current || !lesson || lesson.locked || content.locked) return;
    const route = routeIdentity;
    completionPending.current = true; setCompleting(true); setProgressError('');
    try {
      await learningService.completeLesson(content.id, lesson.id);
      if (activeRoute.current === route) { setProgressRefresh((value) => value + 1); toast('success', 'Lesson completion saved.'); }
    } catch (err) { if (activeRoute.current === route) setProgressError(err.message || 'Completion could not be saved. Please try again.'); }
    finally { completionPending.current = false; setCompleting(false); }
  };
  const navigateLearning = (values) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value != null) next.set(key, String(value));
    setSearchParams(next);
  };
  const openTopic = (id) => navigateLearning({ topic: id });
  const openResource = (id) => navigateLearning({ topic: topic.id, resource: id });
  const openModule = (item, index = 0) => {
    navigateLearning({ topic: topic.id, module: item.id, lesson: index });
    saveLearningResume(userId, { topicId: topic.id, moduleId: item.id,
      lessonIndex: index, moduleTitle: item.title });
  };
  const selectLesson = (index) => {
    navigateLearning({ topic: topic.id, module: content.id, lesson: index });
    saveLearningResume(userId, { topicId: topic.id, moduleId: content.id,
      lessonIndex: index, moduleTitle: content.title });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (mutationPending.current) return;
    mutationPending.current = true; setWorking(true); setError(''); setSubmissionError(''); setSubmissionSent(false);
    const body = { topic: submission.topic, title: submission.title,
      description: submission.description, resourceType: submission.resourceType,
      ...(submission.resourceType === 'text' ? { textContent: submission.textContent }
        : { externalUrl: submission.externalUrl }) };
    try { await learningService.submit(body); toast('success', 'Resource submitted for review.');
      setSubmission(emptySubmission); setSubmissionSent(true); }
    catch (err) { setSubmissionError(err.message || 'Resource could not be submitted. Your draft is still here.'); toast('error', err.message || 'Resource could not be submitted.'); }
    finally { mutationPending.current = false; setWorking(false); }
  };
  const unlock = async () => {
    if (mutationPending.current) return;
    if (!content?.locked || !await confirm(`Unlock ${content.title} for ${content.creditCost} credits?`, { title: 'Unlock learning content', label: 'Unlock', destructive: false })) return;
    if (mutationPending.current) return;
    mutationPending.current = true;
    const unlockRoute = routeIdentity;
    setWorking(true); setError('');
    try {
      const module = !content.resourceType;
      await (module ? learningService.unlockModule(content.id) : learningService.unlockResource(content.id));
      await refreshUser();
      const [detail, updatedTopic] = await Promise.all([
        module ? learningService.module(content.id) : learningService.resource(content.id),
        learningService.topic(topic.id),
      ]);
      if (activeRoute.current === unlockRoute) { setContent(detail.data); setTopic(updatedTopic.data); toast('success', 'Learning content unlocked.'); }
    } catch (err) { toast('error', err.message?.includes('credits')
      ? 'You need more Acadova Credits. Pass a qualifying assessment or teach a verified session to earn credits.'
      : 'Content could not be unlocked right now. Please try again.'); }
    finally { mutationPending.current = false; setWorking(false); }
  };
  const resourceBody = (item) => item.resourceType === 'text'
    ? <div className="learning-reading-text"><p style={{ whiteSpace: 'pre-wrap' }}>{item.textContent}</p></div>
     : <div className="learning-external-resource"><Link2 size={32} aria-hidden="true" /><h3>Study the external resource</h3><p>Open the material in a new tab, then return here to continue learning.</p><p className="learning-item-meta">External learning resource{resourceSource(item.externalUrl) && <> · {resourceSource(item.externalUrl)}</>}</p>
      <ExternalResourceLink href={item.externalUrl} primary /></div>;

  return <div className={`learning-page learning-redesign${content && !content.resourceType ? ' is-module-workspace' : ''}`}>
    <header className="learning-page-header">
      {section === 'library' && topic && <nav className="learning-breadcrumbs" aria-label="Learning breadcrumb"><ol>
        <li><button type="button" className="text-action" onClick={() => navigateLearning({})}>Learning</button></li>
        {content && <li><button type="button" className="text-action" onClick={() => openTopic(topic.id)}>{learningTopicTitle(topic)}</button></li>}
        <li aria-current="page">{content?.title || learningTopicTitle(topic)}</li>
      </ol></nav>}
      <span className="learning-eyebrow"><BookOpen size={16} aria-hidden="true" />{section === 'contribute' ? 'Community contributions' : content ? content.resourceType ? 'Learning resource' : 'Self-paced module' : topic ? 'Learning topic' : 'Self-paced learning'}</span>
      <h1>{section === 'contribute' ? 'Share a resource' : content?.title || (topic ? learningTopicTitle(topic) : 'Learning')}</h1>
      <p>{section === 'contribute' ? 'Submit teaching material for staff review before publication.' : content ? content.description : topic ? topic.description : 'Browse approved topics, study free resources, and take assessments.'}</p>
      {section === 'library' && topic && !content && <p className="learning-item-meta">{topic.modules.length} {topic.modules.length === 1 ? 'module' : 'modules'} · {topic.resources.length} {topic.resources.length === 1 ? 'resource' : 'resources'}{topic.assessments.length > 0 && <a className="text-link" href="#topic-assessments">Check your learning ({topic.assessments.length})</a>}</p>}
    </header>
    <Alert type="danger" message={error} />
    {progressError && <div role="alert"><p>{progressError}</p><button className="btn btn-secondary btn-sm" type="button" onClick={() => setProgressRefresh((value) => value + 1)}>Retry progress</button></div>}
    <LearningNavigation disabled={working} onNavigate={async (event, to) => {
      if (!dirty || !to.startsWith('/assessments') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (await confirm('Your resource draft will be discarded. Continue to Assessments?', { title: 'Leave this resource draft?', label: 'Continue', cancelLabel: 'Keep editing' })) navigate(to);
    }} />
    {working && <p role="status">Loading learning content...</p>}
    {loading ? <LoadingSpinner text="Loading topics..." /> : <>
      <section id="learning-panel-library" aria-labelledby="learning-tab-library" hidden={section !== 'library'}>
      {!topic && topicsAvailable && topics.length > 0 && <div className="learning-library-toolbar"><div><h2>Explore learning topics</h2><p>Choose a subject to find modules, resources, and assessments.</p></div>
        <label className="learning-search-field"><span className="sr-only">Search published topics</span><Search size={18} aria-hidden="true" /><input type="search" value={topicQuery} maxLength={80} placeholder="Search learning topics" onChange={(event) => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set('q', event.target.value); else next.delete('q'); setSearchParams(next, { replace: true }); }} /></label>
      </div>}
      {topic && !content && topicProgress && <div className="card learning-topic-progress"><LearningProgress progress={topicProgress} label="Topic progress" />
        <p>{topicProgress.completedModules} of {topicProgress.publishedModules} published modules completed; {topicProgress.passedAssessments} of {topicProgress.assessmentRequirements} attached assessments passed</p>
        {(topic.modules.find((item) => item.id === resume?.moduleId) || topic.modules.find((item) => !topicProgress.modules.find((row) => row.module === item.id)?.complete)) && <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={() => {
          const item = topic.modules.find((item) => item.id === resume?.moduleId) || topic.modules.find((item) => !topicProgress.modules.find((row) => row.module === item.id)?.complete);
          openModule(item, item.id === resume?.moduleId ? resume.lessonIndex : 0);
        }}>Continue Learning</button>}
      </div>}
      {topic && !content && <nav className="learning-topic-nav" aria-label="Topic sections"><a href="#learning-modules-heading">Modules</a>{topic.resources.length > 0 && <a href="#learning-resources-heading">Resources</a>}{topic.assessments.length > 0 && <a href="#topic-assessments">Assessments</a>}</nav>}
      {!topic && topicQuery && <div className="learning-search-summary"><p role="status">{matchingTopics.length} {matchingTopics.length === 1 ? 'published topic matches' : 'published topics match'} “{topicQuery}”.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('q'); setSearchParams(next); }}>Clear search</button></div>}
      {!topic ? <div className="assessment-list learning-topic-results">{!topicsAvailable ? <div className="card"><h2>Learning topics could not be loaded.</h2><p>Refresh to try again, or find a peer to learn with.</p><Link className="btn btn-primary" to="/tutors">Find a Tutor</Link></div> : topics.length === 0 ? <div className="card"><h2>No learning topics are available yet.</h2><p>You can still learn with a peer while staff prepare topics.</p><Link className="btn btn-primary" to="/tutors">Find a Tutor</Link></div>
        : matchingTopics.length === 0 ? <div className="card"><h2>No matching learning topics</h2><p>Try a shorter subject or clear the search to browse all published topics.</p><Link className="btn btn-secondary" to={discoveryQueryError('tutors', topicQuery) ? '/tutors' : discoveryDestination('tutors', topicQuery)}>Find a Tutor instead</Link></div>
        : matchingTopics.map((item) => <article className="card learning-destination-card" key={item.id}><span className="learning-topic-symbol"><BookOpen size={24} aria-hidden="true" /></span><span className="learning-eyebrow">Published topic</span><h2><button type="button" className="learning-card-action" disabled={working} aria-label={`Explore topic: ${learningTopicTitle(item)}`} onClick={() => openTopic(item.id)}>{learningTopicTitle(item)}</button></h2><p>{item.description}</p>
          <span className="learning-card-hint" aria-hidden="true"><ArrowRight size={18} /></span>
        </article>)}</div> : <>
        {content && <section className="learning-content-detail" aria-label={content.resourceType ? 'Resource detail' : 'Module content'}>
          <p className="learning-item-meta"><span className="learning-access">{learningAccessLabel(content)}{content.resourceType && content.creditCost === 0 ? ' resource' : ''}</span></p>
          {content.locked ? <div className="card learning-unlock"><p>Unlock this {content.resourceType ? 'resource' : 'module'} to study its content.</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={unlock}>Unlock for {content.creditCost} credits</button></div>
            : content.resourceType ? resourceBody(content)
              : <><LearningProgress progress={moduleProgress} label="Module progress" /><p className="learning-item-meta">{content.resources?.length || 0} learning resources</p>
                  {content.unavailableResourceCount > 0 && <Alert type="warning" message="Some resources in this module are no longer available. The remaining published resources are shown below." />}
                  {(content.resources || []).length === 0 ? <p>This module doesn't have learning materials yet.</p>
                    : <div className="learning-module-layout">
                      <ModuleCurriculum resources={content.resources} assessment={content.assessment} lessonIndex={lessonIndex} working={working || completing} progress={moduleProgress} onSelect={selectLesson} />
                      <section className="learning-current-resource" aria-label="Current resource">
                        <div className="learning-lesson-toolbar"><p className="learning-lesson-position">Lesson {lessonIndex + 1} of {content.resources.length}</p><span className="learning-item-meta">{content.resources[lessonIndex]?.resourceType === 'text' ? <><FileText size={16} aria-hidden="true" />Reading lesson</> : <><Link2 size={16} aria-hidden="true" />External resource</>}</span></div>
                        <h2>{content.resources[lessonIndex]?.title}</h2>
                        <p>{content.resources[lessonIndex]?.description}</p>
                        {content.resources[lessonIndex]?.locked
                          ? <><p>This resource requires {content.resources[lessonIndex].creditCost} credits.</p>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={working}
                              onClick={() => openResource(content.resources[lessonIndex].id)}>
                              View unlock options</button></>
                          : resourceBody(content.resources[lessonIndex])}
                        {!content.resources[lessonIndex]?.locked && <div className="learning-completion-control">
                          <button type="button" className="btn btn-primary btn-sm" disabled={working || completing || !moduleProgress || Boolean(moduleProgress.lessons.find((row) => row.resource === content.resources[lessonIndex].id)?.completed)} onClick={completeLesson}>
                            {completing ? 'Saving completion...' : moduleProgress?.lessons.find((row) => row.resource === content.resources[lessonIndex].id)?.completed ? 'Completed' : 'Mark as Complete'}
                          </button><p className="form-hint">{content.resources[lessonIndex]?.resourceType === 'url' ? 'You acknowledge studying this external resource. Acadova does not verify external activity.' : 'Record that you studied this lesson.'} Lesson completion does not award credits.</p>
                          <span className="sr-only" role="status">{completing ? 'Saving lesson completion' : moduleProgress?.lessons.find((row) => row.resource === content.resources[lessonIndex].id)?.completed ? 'Lesson completion recorded' : ''}</span>
                        </div>}
                        <div className="learning-lesson-actions">
                          <button type="button" className="btn btn-secondary btn-sm" disabled={working || completing || lessonIndex === 0}
                            onClick={() => selectLesson(lessonIndex - 1)}>Previous resource</button>
                          {lessonIndex >= content.resources.length - 1 && content.assessment
                            ? <a className="btn btn-primary btn-sm" href="#learning-assessment-heading">Continue to assessment</a>
                            : <button type="button" className="btn btn-primary btn-sm"
                              disabled={working || completing || lessonIndex >= content.resources.length - 1}
                              onClick={() => selectLesson(lessonIndex + 1)}>Next resource</button>}
                        </div>
                      </section>
                    </div>}
                  {moduleProgress?.assessment && <p className="learning-assessment-achievement" role="status">Attached assessment: {moduleProgress.assessment.passed ? 'Passed - requirement completed' : 'No qualifying pass recorded'}</p>}
                  {content.assessment && <ModuleAssessmentEntry key={content.assessment} assessmentId={content.assessment}
                    topicName={learningTopicTitle(topic)} context={{ topicId: topic.id, moduleId: content.id, lessonIndex }} />}</>}
        </section>}
        {!content && <>
          <section className="learning-topic-section" aria-labelledby="learning-modules-heading"><h2 id="learning-modules-heading">Modules</h2>
            <p>Choose a structured unit to study its resources in order.</p>
            {topic.modules.length ? <div className="learning-module-list">{topic.modules.map((item, index) => <article className="card learning-module-summary learning-destination-card" key={item.id}>
              <div><span className="learning-curriculum-label">Module {index + 1}</span><h3><button type="button" className="learning-card-action" disabled={working} aria-label={`Open module: ${item.title}`} onClick={() => openModule(item)}>{item.title}</button></h3><p>{item.description}</p><div className="learning-item-meta">
                {Array.isArray(item.resources) && <span>{item.resources.length} learning resources</span>}
                {item.assessment && <span>Assessment included</span>}<LearningProgress progress={topicProgress?.modules.find((row) => row.module === item.id)} label="Module progress" />
                {learningAccessLabel(item) && <span className="learning-access">{learningAccessLabel(item)}</span>}</div></div>
              <span className="learning-card-hint" aria-hidden="true"><ArrowRight size={18} /></span>
            </article>)}</div> : <p>No modules are available yet. Explore the resources below.</p>}
          </section>
          {topic.resources.length > 0 && <section className="learning-topic-section" aria-labelledby="learning-resources-heading"><h2 id="learning-resources-heading">Topic resources</h2>
            <p>Browse the available resources individually.</p><div className="learning-resource-list">{topic.resources.map((item) =>
              <ResourceRow key={item.id} resource={item} disabled={working} onOpen={() => openResource(item.id)} />
            )}</div></section>}
          {topic.assessments.length > 0 && <section className="learning-topic-section" id="topic-assessments" aria-labelledby="learning-topic-assessments-heading"><h2 id="learning-topic-assessments-heading">Check your learning</h2>
            <p>These published assessments are linked to this topic. Review the material first, or take an assessment directly. A first passing result can earn credits once per assessment.</p>
            <div className="learning-topic-assessment-list">{topic.assessments.map((item) => <AssessmentCard key={item.id} assessment={item} topicName={learningTopicTitle(topic)} context={{ topicId: topic.id }} headingLevel="h3" />)}</div>
          </section>}
        </>}
      </>}
      </section>
      <section id="learning-panel-contribute" aria-labelledby="learning-tab-contribute" hidden={section !== 'contribute'} className="learning-contribution">{topics.length ? <form className="card" data-unsaved={dirty} onSubmit={submit}><h2>Share a resource</h2>
        <p>Share a text lesson or an HTTPS resource with other Students. A Moderator reviews your submission before it appears in Learning.</p>
        <ol className="contribution-steps" aria-label="Resource review process"><li>Submit your resource</li><li>Moderator reviews it</li><li>Approved material is published</li></ol>
        {submissionSent && <p className="alert alert-success" role="status">Your resource is awaiting review. You'll receive an in-app notification when it is published or returned with feedback.</p>}
        <Alert type="danger" message={submissionError} />
        <label className="form-label" htmlFor="learning-topic">Published topic</label>
        <select id="learning-topic" className="form-input" required value={submission.topic} onChange={(event) => setSubmission({ ...submission, topic: event.target.value })}>
          <option value="" disabled hidden>Choose a topic</option>{topics.map((item) => <option key={item.id} value={item.id}>{learningTopicTitle(item)}</option>)}
        </select>
        <p className="form-hint">Choose the subject that best fits your resource.</p>
        <label className="form-label" htmlFor="learning-title">Resource title</label>
        <input id="learning-title" className="form-input" required minLength={3} maxLength={120} placeholder="e.g. Understanding Python variables" value={submission.title} onChange={(event) => setSubmission({ ...submission, title: event.target.value })} />
        <label className="form-label" htmlFor="learning-description">Description</label>
        <textarea id="learning-description" className="form-input" required minLength={3} maxLength={500} rows={3} placeholder="What will another Student learn from this material?" value={submission.description} onChange={(event) => setSubmission({ ...submission, description: event.target.value })} />
        <label className="form-label" htmlFor="learning-type">Resource type</label>
        <select id="learning-type" className="form-input" value={submission.resourceType} onChange={(event) => setSubmission({ ...submission, resourceType: event.target.value })}>
          <option value="text">Text</option><option value="url">HTTPS link</option>
        </select>
        {submission.resourceType === 'text' ? <><label className="form-label" htmlFor="learning-text">Lesson content</label>
          <textarea id="learning-text" className="form-input" required rows={8} maxLength={10000} placeholder="Explain the idea, include an example, and suggest something to practice." value={submission.textContent} onChange={(event) => setSubmission({ ...submission, textContent: event.target.value })} /></>
          : <><label className="form-label" htmlFor="learning-url">HTTPS URL</label>
            <input id="learning-url" className="form-input" type="url" required placeholder="https://example.com/learning-resource" maxLength={1000} value={submission.externalUrl} onChange={(event) => setSubmission({ ...submission, externalUrl: event.target.value })} /><p className="form-hint">Use an accessible HTTPS link. Students will open it in a new tab.</p></>}
        <p className="form-hint">Submitting does not publish the resource or award credits. If changes are needed, use the review feedback to submit a corrected resource.</p>
        <button type="submit" className="btn btn-primary" disabled={working || !topics.length}>{working ? 'Submitting...' : 'Submit for review'}</button>
      </form> : <p>Resource contributions will open when staff publish a topic. <Link to="/tutors">Find a Tutor</Link></p>}</section>
    </>}
  </div>;
};

export default LearningPage;
