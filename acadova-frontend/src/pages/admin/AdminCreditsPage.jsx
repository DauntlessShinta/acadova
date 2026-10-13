import { useConfirm } from '../../context/confirmAccess';
import { useToast } from '../../context/toastAccess';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const fields = [
  ['startingCreditGrant', 'Starting credit grant'],
  ['tutoringSessionCost', 'Tutoring Session cost'],
  ['assessmentReward', 'Assessment pass reward'],
];

export const AdminCreditsPage = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [rules, setRules] = useState(null);
  const [draft, setDraft] = useState({});
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchError, setStudentSearchError] = useState('');
  const studentSearchVersion = useRef({ value: 0 });
  const [activity, setActivity] = useState([]);
  const [activityType, setActivityType] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [direction, setDirection] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adjustmentError, setAdjustmentError] = useState('');
  const [error, setError] = useState('');
  const mutationPending = useRef(false);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [ruleResponse, userResponse, activityResponse] = await Promise.all([
        api.get('/api/admin/credits/rules'), api.get('/api/admin/users?role=student'), api.get('/api/admin/credits/activity'),
      ]);
      setRules(ruleResponse.data);
      setDraft(ruleResponse.data);
      setStudents(userResponse.data.filter((user) => user.role === 'student'));
      setActivity(activityResponse.data);
    } catch (err) { setError(err.message || 'Credit administration could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { Promise.resolve().then(load); }, []);
  useEffect(() => {
    const ticket = ++studentSearchVersion.current.value;
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ role: 'student', ...(studentSearch.trim() ? { q: studentSearch.trim() } : {}) });
        const response = await api.get('/api/admin/users?' + query);
        if (ticket !== studentSearchVersion.current.value) return;
        setStudents(current => [...response.data, ...current.filter(row => row._id === targetStudentId && !response.data.some(found => found._id === row._id))]);
        setStudentSearchError('');
      } catch { if (ticket === studentSearchVersion.current.value) setStudentSearchError('Student search is unavailable. Try again.'); }
    }, 250);
    const state = studentSearchVersion.current; return () => { clearTimeout(timer); state.value++; };
  }, [studentSearch, targetStudentId]);

  const target = useMemo(() => students.find((student) => student._id === targetStudentId),
    [students, targetStudentId]);
  const numericAmount = Number(amount);
  const visibleActivity = useMemo(() => activity.filter(row => {
    const participant = key => row[key + 'Name'] || students.find(student => student._id === row[key])?.name || '';
    const query = activitySearch.trim().toLowerCase();
    return (activityType === 'all' || row.type === activityType) && (!query
      || [row.type, row.adjustmentReason, row.adjustmentDirection, participant('fromUser'), participant('toUser'), row.adjustmentTargetName].some(value => value?.toLowerCase().includes(query)));
  }), [activity, activityType, activitySearch, students]);
  const projected = target && Number.isSafeInteger(numericAmount)
    ? target.credits + (direction === 'credit' ? numericAmount : -numericAmount) : null;

  const saveRules = async (event) => {
    event.preventDefault();
    if (mutationPending.current) return;
    if (!await confirm('Save these credit rules? Future qualifying activity will use the new values.', { title: 'Save credit rules', label: 'Save rules', destructive: false })) return;
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true); setError('');
    try {
      const response = await api.patch('/api/admin/credits/rules', {
        startingCreditGrant: Number(draft.startingCreditGrant),
        tutoringSessionCost: Number(draft.tutoringSessionCost),
        assessmentReward: Number(draft.assessmentReward), expectedVersion: rules.version,
      });
      setRules(response.data); setDraft(response.data);
      toast('success', 'Credit rules saved. New events use these values; history is unchanged.');
    } catch (err) { toast('error', err.message || 'Rules could not be saved. Reload if another Admin edited them.'); }
    finally { mutationPending.current = false; setBusy(false); }
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();
    if (mutationPending.current) return;
    if (!target || !Number.isSafeInteger(numericAmount) || numericAmount < 1 || numericAmount > 1000
      || projected < 0 || reason.trim().length < 10) {
      setAdjustmentError('Select a Student and enter a valid amount and reason. Debits cannot make balances negative.');
      return;
    }
    mutationPending.current = true;
    setBusy(true); setAdjustmentError('');
    try {
      const currentStudents = (await api.get('/api/admin/users?' + new URLSearchParams({ role: 'student', id: targetStudentId }))).data;
      setStudents(current => current.map(row => currentStudents.find(fresh => fresh._id === row._id) || row));
      const currentTarget = currentStudents.find((student) => student._id === targetStudentId);
      if (!currentTarget) throw new Error('Student is no longer available. Reload and choose another account.');
      const currentProjected = currentTarget.credits + (direction === 'credit' ? numericAmount : -numericAmount);
      if (currentProjected < 0) throw new Error('This debit would make the current balance negative.');
      if (!await confirm(`${direction === 'credit' ? 'Credit' : 'Debit'} ${numericAmount} credits ${direction === 'credit' ? 'to' : 'from'} ${currentTarget.name}? Balance: ${currentTarget.credits} → ${currentProjected}. Reason: ${reason.trim()}`,
        { title: 'Adjust credit balance', label: 'Apply adjustment' })) return;
      const response = await api.post('/api/admin/credits/adjustments', {
        targetStudentId, direction, amount: numericAmount, reason: reason.trim(), reference,
      });
      setStudents((current) => current.map((student) => student._id === targetStudentId
        ? { ...student, credits: response.data.balance } : student));
      toast('success', response.repeated ? 'Adjustment was already applied; no duplicate credit movement.'
        : 'Credit adjustment recorded.');
      setReference(crypto.randomUUID()); setAmount(''); setReason('');
      try { const recent = await api.get('/api/admin/credits/activity'); setActivity(recent.data); }
      catch { /* The committed adjustment remains successful; activity can be refreshed later. */ }
    } catch (err) { toast('error', err.message || 'Adjustment failed. Retrying keeps the same reference.'); }
    finally { mutationPending.current = false; setBusy(false); }
  };

  if (loading) return <LoadingSpinner text="Loading credit administration..." size={34} />;
  if (!rules && error) return <div className="staff-page"><h1>Credit administration</h1><Alert type="danger" message={error} /><p>Credit administration is unavailable.</p><button type="button" className="btn btn-secondary" onClick={load}>Retry</button></div>;
  return <div className="staff-page">
    <header className="staff-page-header"><div><span className="staff-eyebrow">Administration / Credits</span><h1>Credit administration</h1><p>Manage rules for new activity and make documented Student balance corrections.</p></div></header>
    <Alert type="danger" message={error} onClose={() => setError('')} />
    <div className="grid-2 admin-credit-grid">
      <section className="card"><h2>Credit rules</h2><p>Changes apply only to future activity.</p><form onSubmit={saveRules}>
        {fields.map(([key, label]) => <div className="form-group" key={key}><label className="form-label" htmlFor={key}>{label}</label><input className="form-input" id={key} type="number" min="1" max="1000" step="1" required value={draft[key] ?? ''} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></div>)}
        <button className="btn btn-primary" disabled={busy || !rules}>Save credit rules</button>
      </form></section>
      <section className="card"><h2>Student balance correction</h2>
        <label className="form-label">Find a Student by name or email<input type="search" className="form-input" maxLength={80} value={studentSearch} onChange={event => setStudentSearch(event.target.value)} /></label>
        <p className="form-hint">Up to 25 matching accounts. Search to find another Student; your selected account remains available.</p>
        <p className="form-error" role="alert">{studentSearchError}</p>
        {!students.length && <p>No Student accounts are available for a balance correction.</p>}
        <fieldset className="prerequisite-fields" disabled={!students.length}><form onSubmit={submitAdjustment}>
        <div className="form-group"><label className="form-label" htmlFor="targetStudent">Target Student</label><select className="form-select" id="targetStudent" required value={targetStudentId} onChange={(event) => setTargetStudentId(event.target.value)}><option value="" disabled hidden>Select a Student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} ({student.email})</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="direction">Direction</label><select className="form-select" id="direction" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="credit">Credit</option><option value="debit">Debit</option></select></div>
        <div className="form-group"><label className="form-label" htmlFor="amount">Amount</label><input className="form-input" id="amount" type="number" min="1" max="1000" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="reason">Reason shown to Student (10–500 characters; no private notes)</label><textarea className="form-input" id="reason" minLength="10" maxLength="500" required value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        <p>Current balance: <strong>{target?.credits ?? '—'}</strong> · Projected balance: <strong>{projected ?? '—'}</strong></p>
        <p className="form-error" role="alert">{adjustmentError}</p>
        <button className="btn btn-primary" disabled={busy || !target || projected === null || projected < 0}>Confirm adjustment</button>
      </form></fieldset></section>
    </div>
    <section className="card"><h2>Recent credit activity</h2><div className="staff-filter-bar"><label>Event type<select className="form-select" value={activityType} onChange={event => setActivityType(event.target.value)}><option value="all">All events</option>{['session_payment', 'assessment_reward', 'initial_grant', 'learning_unlock', 'admin_adjustment'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label>Search loaded activity<input className="form-input" type="search" maxLength={80} value={activitySearch} onChange={event => setActivitySearch(event.target.value)} placeholder="Student, direction or reason" /></label><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActivityType('all'); setActivitySearch(''); }}>Clear filters</button></div><p className="form-hint" role="status">{visibleActivity.length} of {activity.length} loaded recent events. Use Analytics for period-wide aggregates.</p><div className="status-list">{visibleActivity.map((row) => <div key={row._id}><span>{row.type.replaceAll('_', ' ')} · {row.adjustmentDirection || ''} {row.adjustmentReason || ''}<small> {row.fromUser ? `From ${row.fromUserName || students.find((item) => item._id === row.fromUser)?.name || 'Unavailable account'} · ` : ''}{row.toUser ? `To ${row.toUserName || students.find((item) => item._id === row.toUser)?.name || 'Unavailable account'} · ` : ''}{row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Time unavailable'}</small></span><strong className="tabular">{row.amount}</strong></div>)}</div>{visibleActivity.length === 0 && <p>{activity.length ? 'No loaded credit events match your filters.' : 'No recorded credit events yet.'}</p>}</section>
  </div>;
};

export default AdminCreditsPage;
