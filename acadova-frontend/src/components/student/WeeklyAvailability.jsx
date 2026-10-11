import React from 'react';
import { availabilityComparison, viewerTimezone, weekDays } from '../../utils/weeklyAvailability';
import { toSessionInstant, formatSessionDateTime } from '../../utils/sessionPresentation';

export function AvailabilityGuidance({ availability, selected }) {
  let instant;
  try { if (selected) instant = toSessionInstant(selected); } catch { /* The request form supplies the date validation error. */ }
  return <aside className="availability-guidance" aria-label="Tutor usual availability">
    <strong>Usual availability{availability ? ` (${availability.timezone})` : ''}</strong>
    {availability && <ul>{availability.ranges.length ? availability.ranges.map((range, i) => <li key={i}>{weekDays[range.day]} {range.start}–{range.end}</li>) : <li>No usual time ranges set.</li>}</ul>}
    <p className="form-hint">Guidance only, not a booking guarantee. Your date/time input uses {viewerTimezone()}.</p>
    {instant && <p className="form-hint">Your selected time: {formatSessionDateTime(instant)}. UTC instant: {instant}. During a repeated daylight-saving hour, the native control selects its first occurrence.</p>}
    <p role="status">{availabilityComparison(availability, instant || '').message}</p>
  </aside>;
}
export default function WeeklyAvailability({ value, onChange, disabled, error }) {
  const draft = value || { timezone: viewerTimezone(), ranges: [] };
  const change = (patch) => onChange({ ...draft, ...patch });
  const preset = (days) => change({ ranges: days.map((day) => ({ day, start: '09:00', end: '17:00' })) });
  return <fieldset className="availability-editor" disabled={disabled} aria-describedby="availability-help availability-error">
    <legend>Usual teaching availability</legend>
    <p id="availability-help" className="form-hint">Optional guidance. Editing this does not change confirmed sessions. Use 24-hour times; split overnight hours across days.</p>
    <p role="status">{value ? draft.ranges.length ? 'Availability configured; save your changes below.' : 'Timezone configured with no usual hours. Requests remain allowed.' : 'Availability not provided. Add a range or edit the timezone to configure it.'}</p>
    <label htmlFor="availability-timezone" className="form-label">Timezone</label>
    <input id="availability-timezone" className="form-input" list="availability-zones" value={draft.timezone} placeholder="Asia/Manila" onChange={(e) => change({ timezone: e.target.value })} aria-invalid={Boolean(error)} aria-describedby="availability-help availability-error" />
    <datalist id="availability-zones">{['Asia/Manila', 'UTC', 'Asia/Tokyo', 'America/New_York', 'Europe/London', 'Australia/Sydney'].map((zone) => <option key={zone} value={zone} />)}</datalist>
    <div className="study-actions"><button className="btn btn-secondary btn-sm" type="button" onClick={() => preset([1, 2, 3, 4, 5])}>Weekdays 09:00–17:00</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => preset([0, 6])}>Weekends 09:00–17:00</button></div>
    {draft.ranges.map((range, i) => <div key={i} className="availability-range">
      <label>Day<select className="form-input" value={range.day} onChange={(e) => change({ ranges: draft.ranges.map((item, index) => index === i ? { ...item, day: Number(e.target.value) } : item) })}>{weekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
      {['start', 'end'].map((key) => <label key={key}>{key === 'start' ? 'Start' : 'End'}<input className="form-input" type="time" value={range[key]} onChange={(e) => change({ ranges: draft.ranges.map((item, index) => index === i ? { ...item, [key]: e.target.value } : item) })} /></label>)}
      <button className="btn btn-secondary btn-sm" type="button" aria-label={`Remove range ${i + 1}`} onClick={() => change({ ranges: draft.ranges.filter((_, index) => index !== i) })}>Remove</button>
    </div>)}
    <div className="study-actions"><button className="btn btn-secondary btn-sm" type="button" disabled={draft.ranges.length >= 21} onClick={() => change({ ranges: [...draft.ranges, { day: 1, start: '09:00', end: '17:00' }] })}>Add time range</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => onChange(null)}>Clear availability</button></div>
    <p id="availability-error" className="form-error" role={error ? 'alert' : undefined}>{error || ''}</p>
  </fieldset>;
}
