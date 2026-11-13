/**
 * The Event Package's schedule and continuity warnings (continuity PR 1,
 * Evoni 2026-11-13), from the flow read's `schedule` part
 * (services/eventFlowService scheduleOfEvent). Pure; nothing is saved here.
 *
 * Once the server answers with a schedule, its warnings replace the older
 * same-day ones (clashes' 'day' and 'guest' lines), which compared dates
 * only: two events on one day are not a clash unless a person is at both
 * and the times cross. Money and every other line are as they were. A
 * server without the schedule part leaves everything as it was.
 */
import { formatEventDate } from '../utils/eventDate';

const DATE_ONLY_KINDS = ['day', 'guest'];

/** Every warning line for the page: clashes', with the schedule's in place of the date-only ones. */
export function flowWarningLines(flow) {
  const clashLines = flow?.clashes?.lines || [];
  if (!flow?.schedule) return clashLines;
  return [...clashLines.filter((l) => !DATE_ONLY_KINDS.includes(l.kind)), ...(flow.schedule.lines || [])];
}

/** The clash lines a field's hints still show: the date-only ones are the schedule block's once it is there. */
export function hintLines(flow, fields) {
  const lines = (flow?.clashes?.lines || []).filter((l) => fields.includes(l.field));
  return flow?.schedule ? lines.filter((l) => !DATE_ONLY_KINDS.includes(l.kind)) : lines;
}

const dayWords = (day) => formatEventDate(day, { style: 'short' }) || day;

/** "Sat, Mar 14 · 21:00 – 00:00, ends Sun, Mar 15", or null when the start is not known. */
export function scheduleSentence(schedule) {
  if (!schedule?.day || !schedule.start_time) return null;
  const end = schedule.end_time
    ? ` – ${schedule.end_time}${schedule.ends_another_day ? `, ends ${dayWords(schedule.end_day)}` : ''}`
    : '';
  return `${dayWords(schedule.day)} · ${schedule.start_time}${end}`;
}

/** "+6 h from DREAM cities time", or null at story time. */
export function offsetWords(minutes) {
  const n = Number(minutes) || 0;
  if (!n) return null;
  const abs = Math.abs(n);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${n > 0 ? '+' : '−'}${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''} from DREAM cities time`;
}

export const CONFLICT_LABELS = { host: 'Host conflict', lala: 'Lala', guest: 'Guest' };
export const conflictLabel = (c) => (c.kind === 'unverified' ? "Can't verify" : CONFLICT_LABELS[c.severity] || 'Guest');
