'use strict';

/**
 * A Feed profile's posting schedule (Evoni, 2026-10-18: "when it comes to me
 * it comes with a schedule that makes sense for that character or brand with
 * the date and time and i just approve. i dont want to do too much thinking
 * here"). Step 1 of the automation plan; brands reuse it once they have Pulse
 * accounts.
 *
 * Stored on social_profiles.posting_schedule (migration 20261018160000):
 *   {
 *     days:      ['mon', ..., 'sun']        the days they post
 *     windows:   [{ start: 'HH:MM', end: 'HH:MM' }]  in Evoni's own time; an
 *                end at or before its start runs past midnight (22:00-01:00)
 *     per_week:  1-28                       posts in a week, at most
 *     tz_offset: minutes, as the browser's getTimezoneOffset when it was saved
 *                (her time zone, so the server can read "Tuesday morning")
 *     source:    'suggested' | 'set'        suggested until she saves her own
 *     updated_at
 *   }
 * No schedule (null) keeps every caller's behaviour from before.
 *
 *   normalize(raw)            a valid schedule or a ScheduleError (400)
 *   suggestSchedule(profile, voice)  { schedule, why }: deterministic, from
 *                             their voice's temperament (pulseVoices) and what
 *                             they are known for (society_archetype, archetype,
 *                             content_category); RULES below. No AI call.
 *   describe(schedule)        "Tue/Thu mornings" for a why line
 *   nextSlot(schedule, { after, tzOffset, taken, gapMs })  the first time at or
 *                             after `after` on an allowed day, inside a
 *                             window, `gapMs` from every one of `taken`, in a
 *                             week with room under per_week (counting
 *                             `taken`); null when none in the next 5 weeks
 *   allowsDay(schedule, at)   whether `at` falls on one of their days
 *   weekStart(at, tzOffset)   the Monday 00:00 (her time) of `at`'s week
 */

const DAYS = Object.freeze(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const WEEK_ORDER = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ROUND = 5 * MINUTE;
const MAX_WINDOWS = 4;
const SEARCH_DAYS = 35;

class ScheduleError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutesOf = (hhmm) => { const [, h, m] = hhmm.match(HHMM); return Number(h) * 60 + Number(m); };
const clampTz = (v) => (Number.isFinite(Number(v)) ? Math.max(-840, Math.min(840, Math.round(Number(v)))) : 0);

function normalize(raw, { source } = {}) {
  if (!raw || typeof raw !== 'object') throw new ScheduleError('A schedule is { days, windows, per_week }.');
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.map((d) => String(d).toLowerCase().slice(0, 3)))] : [];
  if (!days.length || days.some((d) => !DAYS.includes(d))) throw new ScheduleError(`days: one or more of ${WEEK_ORDER.join(', ')}.`);
  const windows = Array.isArray(raw.windows) ? raw.windows : [];
  if (!windows.length || windows.length > MAX_WINDOWS) throw new ScheduleError(`windows: 1 to ${MAX_WINDOWS} time windows.`);
  const clean = windows.map((w) => {
    if (!w || !HHMM.test(String(w.start)) || !HHMM.test(String(w.end))) throw new ScheduleError('Each window is { start: "HH:MM", end: "HH:MM" }.');
    if (w.start === w.end) throw new ScheduleError('A window needs an end different from its start.');
    return { start: String(w.start), end: String(w.end) };
  }).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  const perWeek = Math.trunc(Number(raw.per_week));
  if (!Number.isInteger(perWeek) || perWeek < 1 || perWeek > 28) throw new ScheduleError('per_week: a whole number from 1 to 28.');
  return {
    days: WEEK_ORDER.filter((d) => days.includes(d)),
    windows: clean,
    per_week: perWeek,
    tz_offset: clampTz(raw.tz_offset),
    source: (source || raw.source) === 'suggested' ? 'suggested' : 'set',
    updated_at: new Date().toISOString(),
  };
}

// ── Suggesting one from who they are ────────────────────────────────────────
// What they are known for decides WHEN; their temperament decides HOW OFTEN.
// The first rule whose words match their content type, archetype or category.
const RULES = Object.freeze([
  { match: /slow|wellness|mindful|cottage|homemak|baking|bread|garden|yoga|soft.?life/i,
    label: 'mornings', windows: [{ start: '07:00', end: '09:30' }], why: 'a slow, at-home creator posts in the quiet of the morning' },
  { match: /night|party|club|dj|music|festival|chaos|entertain/i,
    label: 'evenings', windows: [{ start: '20:00', end: '23:00' }], why: 'nightlife and entertainment post when the night starts' },
  { match: /fashion|style|beauty|glam|makeup|skincare|luxury|curator|aesthetic/i,
    label: 'lunchtimes and evenings', windows: [{ start: '12:00', end: '14:00' }, { start: '18:00', end: '20:00' }], why: 'fashion and beauty land at lunch and after work, when people scroll' },
  { match: /business|finance|money|entrepreneur|career|founder|tech|coach|explicitly.?paid/i,
    label: 'weekday mornings', weekdays: true, windows: [{ start: '08:00', end: '10:00' }], why: 'business and career content is read at the start of the workday' },
  { match: /food|chef|restaurant|cook|recipe/i,
    label: 'lunch and dinner', windows: [{ start: '11:30', end: '13:00' }, { start: '18:00', end: '19:30' }], why: 'food goes out when people are hungry' },
  { match: /community|peer|watcher|friend|relatable/i,
    label: 'evenings', windows: [{ start: '18:30', end: '21:00' }], why: 'a community voice posts when their people are home' },
]);
const DEFAULT_RULE = Object.freeze({ label: 'midday and evenings', windows: [{ start: '12:00', end: '13:30' }, { start: '18:00', end: '20:00' }], why: 'midday and evening are when the Feed is busiest' });

// Temperament (pulseVoices): how often, and on how many days.
const TEMPERAMENT = Object.freeze({
  oversharer: { per_week: 10, days: WEEK_ORDER, extraEvening: true, why: 'an oversharer posts most days, sometimes twice' },
  regular: { per_week: 4, days: ['mon', 'wed', 'fri', 'sat'], why: 'a regular poster shows up a few times a week' },
  lurker: { per_week: 2, days: ['tue', 'sat'], why: 'a lurker mostly watches and posts now and then' },
});

const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

function describe(schedule) {
  if (!schedule) return '';
  const days = schedule.days.length === 7 ? 'every day' : schedule.days.length === 5 && !schedule.days.includes('sat') && !schedule.days.includes('sun')
    ? 'weekdays' : schedule.days.map((d) => DAY_LABEL[d]).join('/');
  const part = (w) => {
    const h = Math.floor(minutesOf(w.start) / 60);
    if (h < 11) return 'mornings';
    if (h < 15) return 'lunchtimes';
    if (h < 18) return 'afternoons';
    return 'evenings';
  };
  const parts = [...new Set(schedule.windows.map(part))];
  return `${days} ${parts.join(' and ')}`;
}

function suggestSchedule(profile = {}, voice = null) {
  const words = [profile?.society_archetype, profile?.archetype, profile?.content_category].filter(Boolean).join(' ');
  const rule = RULES.find((r) => r.match.test(words)) || DEFAULT_RULE;
  const temperamentKey = (voice?.habits_json?.temperament || voice?.temperament || 'regular');
  const t = TEMPERAMENT[temperamentKey] || TEMPERAMENT.regular;
  let days = rule.weekdays ? t.days.filter((d) => !['sat', 'sun'].includes(d)) : [...t.days];
  if (!days.length) days = ['tue', 'thu'];
  const windows = [...rule.windows];
  if (t.extraEvening && !windows.some((w) => minutesOf(w.start) >= 18 * 60)) windows.push({ start: '19:00', end: '21:00' });
  const schedule = normalize({ days, windows, per_week: Math.min(t.per_week, days.length * windows.length * 2), tz_offset: 0 }, { source: 'suggested' });
  const knownFor = profile?.society_archetype || profile?.archetype || profile?.content_category;
  return {
    schedule,
    why: `${describe(schedule)}: ${rule.why}${knownFor ? ` (known for ${String(knownFor).replace(/_/g, ' ')})` : ''}; ${t.why}.`,
  };
}

// ── Finding a time ──────────────────────────────────────────────────────────
// Her local calendar from a UTC instant, as postRelease does it.
const local = (date, tz) => {
  const d = new Date(date.getTime() - tz * MINUTE);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() };
};
const atLocal = (y, m, d, minutes, tz) => new Date(Date.UTC(y, m, d, 0, minutes) + tz * MINUTE);

function weekStart(at, tzOffset = 0) {
  const tz = clampTz(tzOffset);
  const p = local(at, tz);
  const back = (p.dow + 6) % 7; // days since Monday
  return atLocal(p.y, p.m, p.d - back, 0, tz);
}

function allowsDay(schedule, at, tzOffset) {
  if (!schedule) return true;
  const tz = clampTz(tzOffset ?? schedule.tz_offset);
  return schedule.days.includes(DAYS[local(at, tz).dow]);
}

function nextSlot(schedule, { after = new Date(), tzOffset, taken = [], gapMs = 0 } = {}) {
  if (!schedule) return null;
  const tz = clampTz(tzOffset ?? schedule.tz_offset);
  const busy = taken.map((x) => new Date(x)).filter((x) => !Number.isNaN(x.getTime()));
  const roundUp = (t) => new Date(Math.ceil(t.getTime() / ROUND) * ROUND);
  let from = roundUp(after);
  for (let guard = 0; guard < 400; guard += 1) {
    // The earliest window opening at or after `from` (a window that is
    // already open counts from `from`).
    const p = local(from, tz);
    let best = null;
    for (let day = -1; day <= SEARCH_DAYS && !best; day += 1) {
      const dow = DAYS[(((p.dow + day) % 7) + 7) % 7];
      if (!schedule.days.includes(dow)) continue;
      for (const w of schedule.windows) {
        const start = atLocal(p.y, p.m, p.d + day, minutesOf(w.start), tz);
        let end = atLocal(p.y, p.m, p.d + day, minutesOf(w.end), tz);
        if (end <= start) end = new Date(end.getTime() + 24 * HOUR);
        const t = start < from ? from : start;
        if (t < end && (!best || t < best)) best = t;
      }
    }
    if (!best) return null;
    // Their week's posts are counted against per_week.
    const ws = weekStart(best, tz);
    const we = new Date(ws.getTime() + 7 * 24 * HOUR);
    if (busy.filter((x) => x >= ws && x < we).length >= schedule.per_week) { from = we; continue; }
    // Kept `gapMs` from their other posts.
    const clash = gapMs > 0 ? busy.filter((x) => Math.abs(x.getTime() - best.getTime()) < gapMs) : [];
    if (clash.length) { from = roundUp(new Date(Math.max(...clash.map((x) => x.getTime())) + gapMs)); continue; }
    return best;
  }
  return null;
}

module.exports = {
  ScheduleError, normalize, suggestSchedule, describe, nextSlot, allowsDay, weekStart, RULES, TEMPERAMENT, DAYS, WEEK_ORDER,
};
