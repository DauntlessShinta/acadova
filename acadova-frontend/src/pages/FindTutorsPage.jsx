import { useToast } from '../context/toastAccess';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import sessionService from '../services/sessionService';
import { AvailabilityGuidance } from '../components/student/WeeklyAvailability';
import { sessionRequestTimeError } from '../utils/sessionRequestTime';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import PeerCard from '../components/student/PeerCard';
import creditService from '../services/creditService';
import { useSearchDraft } from '../utils/useSearchDraft';
import { Link } from 'react-router-dom';
import {
  Search,
  GraduationCap,
  Filter,
} from 'lucide-react';

const POPULAR_SUBJECTS = [
  'All',
  'Java',
  'Web Development',
  'Python',
  'React',
  'Database',
  'Networking',
  'Algorithms',
];

export const FindTutorsPage = () => {
  const toast = useToast();
  const { user, credits, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSubjectQuery = searchParams.get('subject') || '';
  const search = useSearchDraft(searchParams, setSearchParams);

  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchQuery = search.value;
  const selectedSubjectFilter = currentSubjectQuery || 'All';

  // Request Session Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [sessionSubject, setSessionSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const submittingRef = useRef(false);
  const [requestedSession, setRequestedSession] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sessionCost, setSessionCost] = useState(null);
  const searchVersion = useRef(0);

  useEffect(() => {
    creditService.getCurrentRules().then((response) => setSessionCost(response.data.tutoringSessionCost))
      .catch(() => setSessionCost(null));
  }, []);

  const fetchTutors = useCallback(async (subject = '', q = '') => {
    const version = ++searchVersion.current;
    try {
      setLoading(true);
      setError('');
      const res = await userService.searchTutors({ subject, q });
      if (version !== searchVersion.current) return;
      // Backend enforcement is authoritative; this is a defensive UI boundary.
      const currentUserId = String(user?._id || user?.id || '');
      const list = (res?.data || []).filter((peer) => (
        peer.role === 'student' && String(peer._id) !== currentUserId
      ));
      setTutors(list);
    } catch (err) {
      if (version !== searchVersion.current) return;
      setTutors([]);
      setError(err.message || 'Failed to fetch peers');
    } finally {
      if (version === searchVersion.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
    });
    const timer = setTimeout(() => { if (active) void fetchTutors(currentSubjectQuery, searchQuery.trim()); }, 250);
    return () => { active = false; clearTimeout(timer); searchVersion.current += 1; };
  }, [currentSubjectQuery, searchQuery, fetchTutors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    search.apply();
  };

  const handleFilterClick = (subj) => {
    const next = new URLSearchParams(searchParams);
    if (subj === 'All') next.delete('subject'); else next.set('subject', subj);
    if (searchQuery.trim()) next.set('q', searchQuery.trim()); else next.delete('q');
    setSearchParams(next);
  };

  const openRequestModal = (tutor) => {
    if (submittingRef.current) return;
    setRequestedSession(null);
    setSelectedTutor(tutor);
    setSessionSubject(tutor.skillsToTeach?.[0] || '');
    setScheduledAt('');
    setRequestMessage('');
    setModalError('');
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (submittingRef.current || requestedSession) return;
    setModalError('');
    const errors = {};
    if (!selectedTutor?.skillsToTeach?.includes(sessionSubject)) errors.subject = 'Choose one of this peer\'s teaching subjects.';
    const timeError = sessionRequestTimeError(scheduledAt);
    if (timeError) errors.scheduledAt = timeError;
    if (requestMessage.trim().length > 500) errors.requestMessage = 'Your message must be 500 characters or fewer.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => document.getElementById(Object.keys(errors)[0])?.focus());
      return;
    }

    if (sessionCost !== null && credits < sessionCost) {
      setModalError('You need more Acadova Credits for this session. Pass a qualifying assessment or teach a verified session to earn credits.');
      return;
    }

    try {
      submittingRef.current = true; setModalSubmitting(true);
      const result = await sessionService.createSession({
        tutorId: selectedTutor._id,
        subject: sessionSubject.trim(),
        scheduledAt: scheduledAt || undefined,
        meetingMethod: 'online',
        requestMessage: requestMessage.trim(),
      });

      setRequestedSession(result.data);
      toast('success', `Session request sent to ${selectedTutor.name}. You can track it in Sessions.`);
      refreshUser();
    } catch (err) {
      setModalError(err.message || 'Failed to request session.');
      toast('error', err.message || 'Failed to request session.');
    } finally {
      submittingRef.current = false; setModalSubmitting(false);
    }
  };

  return (
    <div className="tutor-discovery-page">
      {/* Header */}
      <header className="student-page-header"><div>
        <span className="student-eyebrow">
          Peer tutoring
        </span>
        <h1>
          Find Tutors
        </h1>
        <p>
          Discover students who can help with the subjects you want to learn, then request a peer session using credits.
        </p>
      </div></header>

      <Alert type="danger" message={error} onClose={() => setError('')} />

      {/* Search & Subject Chips Bar */}
      <div className="card discovery-filters">
        <form onSubmit={handleSearchSubmit} className="discovery-search-form" role="search" aria-label="Find tutors">
          <div className="search-input-wrap">
            <label className="sr-only" htmlFor="tutor-search">Search tutor names or teaching subjects</label>
            <Search size={18} aria-hidden="true" />
            <input
              id="tutor-search"
              type="search"
              maxLength={80}
              className="form-input"
              placeholder="Tutor name or subject, e.g. Elizabeth or Java"
              value={searchQuery}
              onChange={(e) => { search.change(e.target.value); searchVersion.current += 1; }}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Search size={16} /> Search Tutors
          </button>
        </form>

        {/* Filter Chips */}
        <div className="discovery-subject-filters" role="group" aria-label="Filter tutors by subject">
          <span className="discovery-filter-label">
            <Filter size={14} aria-hidden="true" /> Subjects
          </span>
          {POPULAR_SUBJECTS.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => handleFilterClick(subj)}
              className="subject-filter-chip"
              aria-pressed={selectedSubjectFilter === subj}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Tutor List */}
      {loading ? (
        <LoadingSpinner text="Searching for available tutors..." size={36} />
      ) : error && tutors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Tutor discovery unavailable"
          description="Tutors could not be loaded. Try your search again."
          actionText="Retry search"
          onAction={() => fetchTutors(currentSubjectQuery, searchQuery.trim())}
        />
      ) : tutors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No tutors match your search"
          description="Try a broader subject or clear the filter to browse students with teaching skills."
          actionText="View all tutors"
          onAction={() => { search.change(''); setSearchParams({}); }}
        />
      ) : (
        <div className="student-peer-grid">
          {tutors.map((peer) => <PeerCard key={peer._id} peer={peer} onRequest={openRequestModal} />)}
        </div>
      )}

      {/* REQUEST SESSION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { if (!submittingRef.current) setIsModalOpen(false); }}
        title={`Request Session with ${selectedTutor?.name || 'Peer'}`}
      >
        {requestedSession ? <div className="session-request-success" role="status"><h2>Session request sent</h2><p>{selectedTutor?.name} will receive your proposed schedule.</p><Link className="btn btn-primary" to={`/sessions/${requestedSession._id || requestedSession.id}`}>View requested session</Link></div> : <form onSubmit={handleCreateSession} aria-busy={modalSubmitting}>
          <Alert type="danger" message={modalError} onClose={() => setModalError('')} />

          <div style={{
            background: 'var(--brass-50)',
            border: '1px solid var(--brass-300)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
          }}>
            <span style={{ color: 'var(--brass-700)' }}>Your Available Balance:</span>
            <span className="tabular" style={{ fontWeight: 700, color: 'var(--brass-700)' }}>{credits} Credits</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="subject">
              Subject / Topic of Focus
            </label>
            <select
              id="subject"
              className="form-input"
              value={sessionSubject}
              onChange={(e) => setSessionSubject(e.target.value)}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={`subject-help${fieldErrors.subject ? ' subject-error' : ''}`}
              disabled={modalSubmitting || !selectedTutor?.skillsToTeach?.length}
              required
            >
              <option value="" disabled hidden>Choose a teaching subject</option>
              {(selectedTutor?.skillsToTeach || []).map((skill, index) => <option key={`${skill}-${index}`} value={skill}>{skill}</option>)}
            </select>
            <span className="form-hint" id="subject-help">{selectedTutor?.skillsToTeach?.length ? 'Choose a subject this peer currently teaches.' : 'This peer has not listed teaching subjects yet. Find another peer or ask them to update their Profile.'}</span>
            {fieldErrors.subject && <span className="form-error" id="subject-error">{fieldErrors.subject}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="scheduledAt">
              Preferred Date & Time
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              className="form-input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              aria-invalid={Boolean(fieldErrors.scheduledAt)}
              aria-describedby={fieldErrors.scheduledAt ? 'scheduled-error' : undefined}
              required
            />
            <span className="form-hint">Enter your local date and time. Each participant sees it in their own timezone.</span>
            {fieldErrors.scheduledAt && <span className="form-error" id="scheduled-error">{fieldErrors.scheduledAt}</span>}
          </div>

          <AvailabilityGuidance availability={selectedTutor?.weeklyAvailability} selected={scheduledAt} />
          <p className="form-hint">Online session. The Tutor will add an HTTPS meeting link after accepting.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="requestMessage">Message to Tutor (Optional)</label>
            <textarea
              id="requestMessage"
              className="form-textarea"
              rows={3}
              maxLength={500}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Tell your peer what you would like help with."
              aria-invalid={Boolean(fieldErrors.requestMessage)}
              aria-describedby={fieldErrors.requestMessage ? 'request-message-error' : 'request-message-hint'}
            />
            <span className="form-hint" id="request-message-hint">Example: “I need help understanding Java arrays and loops.” · {500 - requestMessage.length} characters remaining</span>
            {fieldErrors.requestMessage && <span className="form-error" id="request-message-error">{fieldErrors.requestMessage}</span>}
          </div>

          <div className="form-group">
            <span className="form-label">Tutoring Session Cost: {sessionCost ?? 'Shown when available'} credits</span>
            <span className="form-hint">
              Credits transfer only after validated completion or an authorized staff resolution.
            </span>
            {sessionCost !== null && credits < sessionCost
              && <p><Link to="/assessments">Explore qualifying assessments</Link> to earn credits.</p>}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={modalSubmitting}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={modalSubmitting || !selectedTutor?.skillsToTeach?.length}
              aria-busy={modalSubmitting}
            >
              {modalSubmitting ? 'Sending Request...' : 'Confirm & Request Session'}
            </button>
          </div>
        </form>}
      </Modal>
    </div>
  );
};

export default FindTutorsPage;
