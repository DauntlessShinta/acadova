import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import learningService from '../services/learningService';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { readLearningResume, saveLearningResume } from '../utils/learningResume';

const emptySubmission = { topic: '', title: '', description: '', resourceType: 'text', textContent: '', externalUrl: '' };

export const LearningPage = () => {
  const { user, refreshUser } = useAuth();
  const userId = user?._id || user?.id;
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [resume] = useState(() => readLearningResume(userId));
  const [submission, setSubmission] = useState(emptySubmission);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    learningService.topics().then((response) => setTopics(response.data || []))
      .catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('continue') || !resume) return;
    let active = true;
    Promise.all([learningService.topic(resume.topicId), learningService.module(resume.moduleId)])
      .then(([topicResult, moduleResult]) => {
        if (!active) return;
        setTopic(topicResult.data);
        setContent(moduleResult.data);
        setLessonIndex(Math.min(resume.lessonIndex, Math.max(0, (moduleResult.data.resources || []).length - 1)));
      }).catch(() => { if (active) setError('Your saved module is unavailable. Browse current learning topics instead.'); });
    return () => { active = false; };
  }, [resume]);
  const load = async (request) => {
    setWorking(true); setError(''); setContent(null);
    try { const response = await request(); setContent(response.data); return response.data; }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  const openTopic = async (id) => {
    setWorking(true); setError(''); setContent(null);
    try { const response = await learningService.topic(id); setTopic(response.data); }
    catch (err) { setError(err.message); }
    finally { setWorking(false); }
  };
  const openModule = async (item) => {
    const module = await load(() => learningService.module(item.id));
    if (!module) return;
    setLessonIndex(0);
    saveLearningResume(userId, { topicId: topic.id, moduleId: item.id,
      lessonIndex: 0, moduleTitle: item.title });
  };
  const selectLesson = (index) => {
    setLessonIndex(index);
    saveLearningResume(userId, { topicId: topic.id, moduleId: content.id,
      lessonIndex: index, moduleTitle: content.title });
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
  const unlock = async () => {
    if (!content?.locked || !window.confirm(`Unlock ${content.title} for ${content.creditCost} credits?`)) return;
    setWorking(true); setError('');
    try {
      const module = !content.resourceType;
      await (module ? learningService.unlockModule(content.id) : learningService.unlockResource(content.id));
      await refreshUser();
      const [detail, updatedTopic] = await Promise.all([
        module ? learningService.module(content.id) : learningService.resource(content.id),
        learningService.topic(topic.id),
      ]);
      setContent(detail.data); setTopic(updatedTopic.data);
    } catch (err) { setError(err.message?.includes('credits')
      ? 'You need more Acadova Credits. Pass a qualifying assessment or teach a verified session to earn credits.'
      : 'Content could not be unlocked right now. Please try again.'); }
    finally { setWorking(false); }
  };
  const resourceBody = (item) => item.resourceType === 'text'
    ? <p style={{ whiteSpace: 'pre-wrap' }}>{item.textContent}</p>
    : <a href={item.externalUrl} target="_blank" rel="noopener noreferrer">Open HTTPS resource</a>;

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
          {content.locked ? <><p>{content.creditCost} credits</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={working} onClick={unlock}>Unlock</button></>
            : content.resourceType ? <>{content.unlocked && <p>Unlocked</p>}{resourceBody(content)}</>
              : <><p>{content.unlocked ? 'Unlocked module' : 'Free module'} · {content.resources?.length || 0} lessons
                {content.assessment ? ' · 1 assessment' : ''}</p>
                  {(content.resources || []).length === 0 ? <p>This module doesn't have learning materials yet.</p>
                    : <div className="learning-lesson-layout">
                      <ol className="learning-lesson-list" aria-label="Lessons">
                        {content.resources.map((item, index) => <li key={item.id}>
                          <button type="button" className={lessonIndex === index ? 'is-current' : ''}
                            aria-current={lessonIndex === index ? 'step' : undefined}
                            onClick={() => selectLesson(index)}>{index + 1}. {item.title}</button>
                        </li>)}
                      </ol>
                      <section className="learning-lesson card" aria-label="Current lesson">
                        <h4>{content.resources[lessonIndex]?.title}</h4>
                        <p>{content.resources[lessonIndex]?.description}</p>
                        {content.resources[lessonIndex]?.locked
                          ? <><p>This lesson requires {content.resources[lessonIndex].creditCost} credits.</p>
                            <button type="button" className="btn btn-secondary btn-sm"
                              onClick={() => load(() => learningService.resource(content.resources[lessonIndex].id))}>
                              View unlock options</button></>
                          : resourceBody(content.resources[lessonIndex])}
                        <div className="learning-lesson-actions">
                          <button type="button" className="btn btn-secondary btn-sm" disabled={lessonIndex === 0}
                            onClick={() => selectLesson(lessonIndex - 1)}>Previous lesson</button>
                          <button type="button" className="btn btn-primary btn-sm"
                            disabled={lessonIndex >= content.resources.length - 1}
                            onClick={() => selectLesson(lessonIndex + 1)}>Next lesson</button>
                        </div>
                      </section>
                    </div>}
                  {content.assessment && <Link className="btn btn-primary btn-sm"
                    to={'/assessments?open=' + content.assessment}>Take final assessment</Link>}</>}
        </article>}
        {!content && <><h3>Resources</h3><div className="assessment-list">{topic.resources.map((item) => <article className="card" key={item.id}>
          <h4>{item.title}</h4><p>{item.description}</p><p>{item.unlocked ? 'Unlocked' : item.locked ? `${item.creditCost} credits` : 'Free'}</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={working} onClick={() => load(() => learningService.resource(item.id))}>View resource</button>
        </article>)}</div><h3>Modules</h3><div className="assessment-list">{topic.modules.map((item) => <article className="card" key={item.id}>
          <h4>{item.title}</h4><p>{item.description}</p><p>{item.unlocked ? 'Unlocked' : item.locked ? `${item.creditCost} credits` : 'Free'}</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={working}
            onClick={() => openModule(item)}>Open module</button>
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
