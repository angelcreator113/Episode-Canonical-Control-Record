/**
 * EventScheduleContinuity — Schedule & continuity, in The Event section
 * (continuity PR 1; Evoni, 2026-11-13). When the event runs, and who at it
 * is at another event whose time overlaps or leaves too little time to get
 * there. Warnings only: nothing here blocks a save, Mark ready or Start
 * Episode, and nothing is approved here.
 *
 * It can save three optional values, through the event PUT, into the
 * event's existing canon_consequences.automation: event_end_time,
 * event_end_date (for an event a day or longer) and utc_offset_minutes
 * (asked only for a venue outside the DREAM cities). The date and start
 * time are edited in their own rows above, as before.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, Pencil } from 'lucide-react';
import { scheduleSentence, offsetWords, conflictLabel } from '../../lib/eventSchedule';
import './EventFlow.css';

export default function EventScheduleContinuity({ showId, flow, event, used, putEvent, load, setToast }) {
  const part = flow?.schedule;
  const auto = event?.canon_consequences?.automation || {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endTime, setEndTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [offsetHours, setOffsetHours] = useState('');
  if (!part) return null;

  const { schedule, conflicts = [], place } = part;
  const outside = Boolean(place?.city) && !place.dream;
  const firm = conflicts.filter((c) => !c.provisional);
  const soft = conflicts.filter((c) => c.provisional);
  const sentence = scheduleSentence(schedule);
  const offsetText = offsetWords(schedule.offset_minutes);
  const notes = (part.lines || []).filter((l) => l.field === 'date' || l.kind === 'verify' || l.kind === 'provisional');

  const open = () => {
    setEndTime(typeof auto.event_end_time === 'string' ? auto.event_end_time : '');
    setEndDate(typeof auto.event_end_date === 'string' ? auto.event_end_date : '');
    setOffsetHours(auto.utc_offset_minutes === undefined || auto.utc_offset_minutes === null ? '' : String(Number(auto.utc_offset_minutes) / 60));
    setEditing(true);
  };

  const save = async (values) => {
    if (used || saving) return;
    setSaving(true);
    try {
      // null removes a key (mergeCanonConsequences); the rest of automation is kept.
      await putEvent({ canon_consequences: { automation: values } });
      setToast('Schedule saved');
      setEditing(false);
      await load();
    } catch (err) {
      console.error('[EventScheduleContinuity] saving the schedule failed:', err);
      setToast(err.response?.data?.error || err.message || 'Failed to save the schedule');
    } finally {
      setSaving(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const hours = offsetHours === '' ? null : Number(offsetHours);
    if (hours !== null && (!Number.isFinite(hours) || !Number.isInteger(hours * 60) || hours < -12 || hours > 14)) {
      setToast('The offset is a number of hours between −12 and 14');
      return;
    }
    save({
      event_end_time: endTime || null,
      event_end_date: endDate || null,
      ...(outside || auto.utc_offset_minutes !== undefined ? { utc_offset_minutes: hours === null ? null : hours * 60 } : {}),
    });
  };

  return (
    <div className="esc" data-testid="schedule-continuity">
      <div className="esc-head">
        <h3 className="esc-title"><CalendarClock size={14} aria-hidden="true" /> Schedule &amp; continuity</h3>
        {!used && !editing && (
          <button type="button" className="epp-inline-link" onClick={open} data-testid="schedule-edit"><Pencil size={12} aria-hidden="true" /> End time</button>
        )}
      </div>

      <p className="esc-when" data-testid="schedule-when">
        {sentence || 'When it runs is not known yet.'}
        {schedule.end_suggested && <span className="esc-tag" data-testid="schedule-suggested">suggested end</span>}
        {schedule.provisional && <span className="esc-tag" data-testid="schedule-provisional">suggested date</span>}
        {offsetText && <span className="esc-tag" data-testid="schedule-offset">{offsetText}</span>}
      </p>

      {!used && !editing && schedule.end_suggested && (
        <button type="button" className="eff-chip" onClick={() => save({ event_end_time: schedule.end_time })} disabled={saving} data-testid="schedule-use-suggested">
          <Check size={12} aria-hidden="true" /> Use {schedule.end_time} as the end (three hours)
        </button>
      )}

      {editing && (
        <form className="esc-form" onSubmit={submit} noValidate data-testid="schedule-form">
          <label className="esc-field">Ends at
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="schedule-end-time" />
          </label>
          <label className="esc-field">End date <span className="esc-optional">only for an event a day or longer</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="schedule-end-date" />
          </label>
          {(outside || auto.utc_offset_minutes !== undefined) && (
            <label className="esc-field">Hours ahead of DREAM cities time <span className="esc-optional">behind is negative</span>
              <input type="number" step="0.25" min="-12" max="14" value={offsetHours} onChange={(e) => setOffsetHours(e.target.value)} data-testid="schedule-offset-hours" />
            </label>
          )}
          <div className="esc-actions">
            <button type="submit" className="epp-btn epp-btn-small" disabled={saving} data-testid="schedule-save">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="epp-btn epp-btn-small" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}

      {notes.filter((l) => l.kind === 'verify' && l.field === 'date').map((l, i) => (
        <p key={`v-${i}`} className="eff-warn" data-testid="schedule-verify"><AlertTriangle size={13} aria-hidden="true" /> {l.text}</p>
      ))}
      {outside && !schedule.offset_set && (
        <p className="eff-warn" data-testid="schedule-offset-missing"><AlertTriangle size={13} aria-hidden="true" /> {place.city} is outside the DREAM cities and no time offset is saved, so its times are read as DREAM cities time.</p>
      )}

      {firm.length === 0 && soft.length === 0 && !part.unchecked && schedule.verifiable && (
        <p className="esc-clear" data-testid="schedule-clear">No one at this event is in two places.</p>
      )}
      {firm.length > 0 && (
        <ul className="esc-list" data-testid="schedule-conflicts">
          {firm.map((c, i) => (
            <li key={`${c.person.key}-${c.other.id}-${i}`} className={`esc-row is-${c.kind === 'unverified' ? 'verify' : c.severity}`} data-testid={`schedule-conflict-${c.severity}`}>
              <span className="esc-chip">{conflictLabel(c)}</span>
              <span className="esc-text">{c.text} <Link className="epp-inline-link" to={`/shows/${showId}/events/${c.other.id}`}>Open {c.other.name}</Link></span>
            </li>
          ))}
        </ul>
      )}
      {soft.length > 0 && (
        <p className="esc-soft" data-testid="schedule-provisional-count">
          {soft.length} possible {soft.length === 1 ? 'overlap depends' : 'overlaps depend'} on a suggested date: {[...new Set(soft.map((c) => c.other.name))].slice(0, 3).join(', ')}{new Set(soft.map((c) => c.other.name)).size > 3 ? '…' : ''}.
        </p>
      )}
      {part.unchecked > 0 && (
        <p className="eff-warn" data-testid="schedule-unchecked"><AlertTriangle size={13} aria-hidden="true" /> {part.unchecked} other {part.unchecked === 1 ? 'event shares' : 'events share'} someone with this one but {part.unchecked === 1 ? 'has' : 'have'} no readable date, so {part.unchecked === 1 ? 'it was' : 'they were'} not checked.</p>
      )}
    </div>
  );
}
