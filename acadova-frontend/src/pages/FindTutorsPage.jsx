import React, { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import sessionService from '../services/sessionService';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import PeerCard from '../components/student/PeerCard';
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
  'Calculus',
];

export const FindTutorsPage = () => {
  const { user, credits, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSubjectQuery = searchParams.get('subject') || '';

  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(currentSubjectQuery);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState(currentSubjectQuery || 'All');

  // Request Session Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [sessionSubject, setSessionSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [creditCost, setCreditCost] = useState(1);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchTutors = useCallback(async (subject = '') => {
    try {
      setLoading(true);
      setError('');
      const res = await userService.searchTutors(subject);
      // Backend enforcement is authoritative; this is a defensive UI boundary.
      const currentUserId = String(user?._id || user?.id || '');
      const list = (res?.data || []).filter((peer) => (
        peer.role === 'student' && String(peer._id) !== currentUserId
      ));
      setTutors(list);
    } catch (err) {
      setError(err.message || 'Failed to fetch peers');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchTutors(currentSubjectQuery);
      setSelectedSubjectFilter(currentSubjectQuery || 'All');
      setSearchQuery(currentSubjectQuery);
    });
  }, [currentSubjectQuery, fetchTutors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ subject: searchQuery.trim() });
    } else {
      setSearchParams({});
    }
  };

  const handleFilterClick = (subj) => {
    setSelectedSubjectFilter(subj);
    if (subj === 'All') {
      setSearchParams({});
    } else {
      setSearchParams({ subject: subj });
    }
  };

  const openRequestModal = (tutor) => {
    setSelectedTutor(tutor);
    setSessionSubject(tutor.skillsToTeach?.[0] || searchQuery || '');
    setCreditCost(1);
    setScheduledAt('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!sessionSubject.trim()) {
      setModalError('Please specify the subject/topic.');
      return;
    }

    if (credits < creditCost) {
      setModalError(`You have ${credits} credits, but this session requires ${creditCost} credit(s). Please earn credits by teaching first.`);
      return;
    }

    try {
      setModalSubmitting(true);
      await sessionService.createSession({
        tutorId: selectedTutor._id,
        subject: sessionSubject.trim(),
        scheduledAt: scheduledAt || undefined,
        creditAmount: creditCost,
      });

      setIsModalOpen(false);
      setSuccessMessage(`Session request sent to ${selectedTutor.name}. You can track it in Sessions.`);
      refreshUser();
    } catch (err) {
      setModalError(err.message || 'Failed to request session.');
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Peer Matching Hub
        </span>
        <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 8px' }}>
          Find Peers
        </h1>
        <p style={{ color: 'var(--ink-600)', maxWidth: '640px' }}>
          Discover students who can help with the subjects you want to learn, then request a peer session using credits.
        </p>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />

      {/* Search & Subject Chips Bar */}
      <div className="card" style={{ marginBottom: '32px', padding: '20px 24px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '40px' }}
              placeholder="Search by subject, technology, or topic (e.g. Java, React, SQL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Search size={16} /> Search Peers
          </button>
        </form>

        {/* Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Quick Filter:
          </span>
          {POPULAR_SUBJECTS.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => handleFilterClick(subj)}
              style={{
                background: selectedSubjectFilter === subj ? 'var(--navy-900)' : 'var(--bg-subtle)',
                color: selectedSubjectFilter === subj ? '#ffffff' : 'var(--ink-700)',
                border: `1px solid ${selectedSubjectFilter === subj ? 'var(--navy-900)' : 'var(--border-subtle)'}`,
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Tutor List */}
      {loading ? (
        <LoadingSpinner text="Searching for available peers..." size={36} />
      ) : error && tutors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Peer discovery unavailable"
          description="Refresh the page or try your search again."
        />
      ) : tutors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No peers found matching your query"
          description="Try a broader subject or clear the filter to browse students with teaching skills."
          actionText="View All Peers"
          onAction={() => handleFilterClick('All')}
        />
      ) : (
        <div className="grid-3">
          {tutors.map((peer) => <PeerCard key={peer._id} peer={peer} onRequest={openRequestModal} />)}
        </div>
      )}

      {/* REQUEST SESSION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Request Session with ${selectedTutor?.name || 'Peer'}`}
      >
        <form onSubmit={handleCreateSession}>
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
            <span className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)' }}>{credits} Credits</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="subject">
              Subject / Topic of Focus
            </label>
            <input
              id="subject"
              type="text"
              className="form-input"
              placeholder="e.g. React Component State, Java Recursion"
              value={sessionSubject}
              onChange={(e) => setSessionSubject(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="scheduledAt">
              Preferred Date & Time (Optional)
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              className="form-input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="creditCost">
              Credit Fee Allocated (1 or 2 Credits)
            </label>
            <select
              id="creditCost"
              className="form-select"
              value={creditCost}
              onChange={(e) => setCreditCost(Number(e.target.value))}
            >
              <option value={1}>1 Credit (Standard 30-45m session)</option>
              <option value={2}>2 Credits (Deep Dive 60-90m session)</option>
            </select>
            <span className="form-hint">
              Credits remain safely in your wallet until the tutor completes the session.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={modalSubmitting}
            >
              {modalSubmitting ? 'Sending Request...' : 'Confirm & Request Session'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FindTutorsPage;
