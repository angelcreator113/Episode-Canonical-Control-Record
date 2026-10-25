'use strict';

/**
 * The show's release schedule (Evoni, 2026-10-25: "the show releases weekly,
 * Sundays at 10:00 AM", then "I still want to be able to change and edit
 * when I actually start releasing").
 *
 * Stored in shows.distribution_defaults.release_schedule (JSONB; no
 * migration), written only by its own route (routes/releaseScheduleRoutes):
 *   {
 *     day:           'sun' … 'sat'   the release day
 *     time:          'HH:MM'         in Evoni's own time
 *     cadence:       'weekly'
 *     first_release: 'YYYY-MM-DD' | null   when releasing starts; null is
 *                    "not releasing yet": dates are previews, nothing warns
 *     paused:        boolean         no schedule dates, the schedule kept
 *     platforms:     ['youtube']     the platforms the schedule times (Evoni,
 *                    2026-10-25: "we only want the YouTube the main show on
 *                    that schedule at the moment"); the episode's release
 *                    date is theirs. Other platforms keep their own times:
 *                    nothing here reads or writes a platform's scheduled_time
 *     tz_offset:     minutes, the browser's getTimezoneOffset at save
 *     tz:            the browser's IANA zone at save, or null
 *     updated_at
 *   }
 * No schedule (null) changes nothing: only hand-set air dates show.
 *
 * Schedule dates are computed on read and never written. The only stored
 * date is episodes.air_date, and a stored air_date is always hand-set: it
 * wins, it never moves when the schedule changes, and clearing it ("Back to
 * the schedule") hands the episode back to the schedule. So changing the
 * day, time or first release date moves every schedule date and no other.
 *
 * Episode N takes the Nth release day on or after the start (first_release,
 * or for a preview the season's start, else today), skipping a release day
 * within three days of a hand-set date (Evoni sets Episode 5 a week late to
 * skip a holiday and the rest follow it) and never landing on or before the
 * episode before it.
 *
 * Time zones: the release time is a wall-clock time in Evoni's zone
 * ("10:00 her time stays 10:00 across DST"). Dates and times are shown as
 * stored, never converted. The instant (for "releases in 2 days" and
 * overdue) is that wall time in `tz` when the browser gave one, so a
 * schedule saved in October still means 10:00 after the clocks change in
 * November; without `tz` it falls back to the fixed `tz_offset` (as
 * postingSchedule does), which can be an hour off across a DST change.
 *
 *   normalize(raw)                  a valid schedule, or a ScheduleError (400)
 *   scheduleState(schedule)         'unset' | 'paused' | 'preview' | 'active'
 *   computeDates({ schedule, episodes, slotCount, baseDate, now })
 *                                   { state, numbers: { [n]: entry }, byEpisode: { [id]: entry } }
 *   moves(before, after, episodes)  the schedule dates a change moves
 *   zonedInstant(date, time, schedule), todayIn(now, schedule)
 */

const DAYS = Object.freeze(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const CADENCE_DAYS = Object.freeze({ weekly: 7 });
const PLATFORMS = Object.freeze(['youtube', 'tiktok', 'instagram', 'facebook']);
const DEFAULT_PLATFORMS = Object.freeze(['youtube']);
const DEFAULT_SCHEDULE = Object.freeze({ day: 'sun', time: '10:00', cadence: 'weekly', first_release: null, paused: false, platforms: DEFAULT_PLATFORMS });
const DAY_MS = 24 * 60 * 60 * 1000;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
// A release day this close to a hand-set date is that week's release.
const TAKEN_WITHIN_DAYS = 3;

class ScheduleError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ── Calendar days as 'YYYY-MM-DD', counted in UTC so no zone shifts them ──
const toUtc = (iso) => { const [, y, m, d] = ISO.exec(iso); return Date.UTC(Number(y), Number(m) - 1, Number(d)); };
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
const isDay = (v) => typeof v === 'string' && ISO.test(v) && fromUtc(toUtc(v)) === v;
const addDays = (iso, n) => fromUtc(toUtc(iso) + n * DAY_MS);
const diffDays = (a, b) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
const dayOf = (iso) => DAYS[new Date(toUtc(iso)).getUTCDay()];
/** The first `day` on or after `iso`. */
const onOrAfter = (iso, day) => addDays(iso, (DAYS.indexOf(day) - DAYS.indexOf(dayOf(iso)) + 7) % 7);

const validZone = (tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (err) {
    console.error('[releaseSchedule] not a time zone:', tz, err.message);
    return false;
  }
};

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ScheduleError('A release schedule is { day, time, cadence, first_release }.');
  const day = String(raw.day || '').toLowerCase().slice(0, 3);
  if (!DAYS.includes(day)) throw new ScheduleError(`day: one of ${DAYS.join(', ')}.`);
  const time = String(raw.time || '');
  if (!HHMM.test(time)) throw new ScheduleError('time: "HH:MM", 24-hour.');
  const cadence = raw.cadence == null ? 'weekly' : String(raw.cadence);
  if (!CADENCE_DAYS[cadence]) throw new ScheduleError(`cadence: ${Object.keys(CADENCE_DAYS).join(' or ')}.`);
  const firstRelease = raw.first_release == null || raw.first_release === '' ? null : String(raw.first_release);
  if (firstRelease !== null && !isDay(firstRelease)) throw new ScheduleError('first_release: a date as YYYY-MM-DD, or empty for not releasing yet.');
  if (raw.paused != null && typeof raw.paused !== 'boolean') throw new ScheduleError('paused: true or false.');
  const tzOffset = raw.tz_offset == null ? 0 : Number(raw.tz_offset);
  if (!Number.isInteger(tzOffset) || tzOffset < -840 || tzOffset > 840) throw new ScheduleError('tz_offset: whole minutes from -840 to 840.');
  const tz = raw.tz == null || raw.tz === '' ? null : String(raw.tz);
  if (tz !== null && !validZone(tz)) throw new ScheduleError('tz: a time zone name such as America/New_York.');
  let platforms = raw.platforms == null ? [...DEFAULT_PLATFORMS] : raw.platforms;
  if (!Array.isArray(platforms) || !platforms.length || platforms.some((p) => !PLATFORMS.includes(p))) {
    throw new ScheduleError(`platforms: one or more of ${PLATFORMS.join(', ')}.`);
  }
  platforms = PLATFORMS.filter((p) => platforms.includes(p));
  return { day, time, cadence, first_release: firstRelease, paused: Boolean(raw.paused), platforms, tz_offset: tzOffset, tz, updated_at: new Date().toISOString() };
}

/** A stored schedule read leniently: anything that does not normalize is no schedule. */
function readStored(raw) {
  if (!raw) return null;
  try { return normalize(raw); } catch (err) {
    console.error('[releaseSchedule] the stored schedule is not valid, so there is none:', err.message);
    return null;
  }
}

const scheduleState = (s) => (!s ? 'unset' : s.paused ? 'paused' : s.first_release ? 'active' : 'preview');

// ── Time zones ────────────────────────────────────────────────────────────
/** Minutes to add to the zone's wall time to reach UTC at `ms` (getTimezoneOffset's sign). */
function zoneOffsetAt(ms, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return Math.round((ms - wall) / 60000);
}

/** The instant of `date` at `time` in Evoni's zone (the schedule's tz, else its fixed tz_offset). */
function zonedInstant(date, time, schedule) {
  const [h, m] = HHMM.test(time || '') ? time.split(':').map(Number) : [0, 0];
  const wall = toUtc(date) + (h * 60 + m) * 60000;
  if (schedule?.tz) {
    let offset = zoneOffsetAt(wall, schedule.tz);
    const again = zoneOffsetAt(wall + offset * 60000, schedule.tz);
    if (again !== offset) offset = again;
    return new Date(wall + offset * 60000);
  }
  return new Date(wall + (schedule?.tz_offset || 0) * 60000);
}

/** Today's date in Evoni's zone. */
function todayIn(now, schedule) {
  const ms = new Date(now).getTime();
  const offset = schedule?.tz ? zoneOffsetAt(ms, schedule.tz) : (schedule?.tz_offset || 0);
  return fromUtc(ms - offset * 60000);
}

// ── The dates ─────────────────────────────────────────────────────────────
/** An air_date as its calendar day (the column holds the day at UTC midnight). */
function dayFromAirDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return isDay(s) ? s : null;
}

const releasable = (ep) => ep && ep.status !== 'archived';

/**
 * Each episode's release date. episodes: [{ id, episode_number, air_date,
 * status }]; slotCount: the season's slots, so an empty slot has a date too.
 * An entry is { number, episode_id, date, time, source: 'hand'|'schedule'|'preview' }.
 */
function computeDates({ schedule = null, episodes = [], slotCount = 0, baseDate = null, now = new Date() } = {}) {
  const state = scheduleState(schedule);
  const live = (episodes || []).filter(releasable);
  const hand = new Map(live.map((ep) => [ep.id, dayFromAirDate(ep.air_date)]).filter(([, d]) => d));
  const withTime = state === 'active' || state === 'preview';
  const time = withTime ? schedule.time : null;
  const numbers = {};
  const byEpisode = {};
  const put = (entry) => {
    if (entry.episode_id) byEpisode[entry.episode_id] = entry;
    if (entry.number && !numbers[entry.number]) numbers[entry.number] = entry;
  };

  if (!withTime) {
    for (const ep of live) {
      const date = hand.get(ep.id);
      if (date) put({ number: ep.episode_number || null, episode_id: ep.id, date, time: null, source: 'hand' });
    }
    return { state, numbers, byEpisode };
  }

  const byNumber = new Map();
  const loose = [];
  for (const ep of live) {
    const n = Number(ep.episode_number);
    if (Number.isInteger(n) && n >= 1 && !byNumber.has(n)) byNumber.set(n, ep);
    else loose.push(ep);
  }
  const step = CADENCE_DAYS[schedule.cadence] || 7;
  const start = state === 'active' ? schedule.first_release : (isDay(baseDate) ? baseDate : todayIn(now, schedule));
  const taken = [...hand.values()];
  const source = state === 'active' ? 'schedule' : 'preview';
  const last = Math.max(0, Number(slotCount) || 0, ...byNumber.keys());

  let cursor = onOrAfter(start, schedule.day);
  let prev = null;
  for (let n = 1; n <= last; n += 1) {
    const ep = byNumber.get(n) || null;
    const set = ep ? hand.get(ep.id) : null;
    if (set) {
      put({ number: n, episode_id: ep.id, date: set, time, source: 'hand' });
      prev = set;
      continue;
    }
    let date = cursor;
    for (let guard = 0; guard < 520 && ((prev && date <= prev) || taken.some((d) => Math.abs(diffDays(d, date)) <= TAKEN_WITHIN_DAYS)); guard += 1) {
      date = addDays(date, step);
    }
    put({ number: n, episode_id: ep ? ep.id : null, date, time, source });
    cursor = addDays(date, step);
    prev = date;
  }
  // An episode with no number (or a repeated one) keeps only a hand-set date.
  for (const ep of loose) {
    const date = hand.get(ep.id);
    if (date) put({ number: null, episode_id: ep.id, date, time, source: 'hand' });
  }
  return { state, numbers, byEpisode };
}

/** Days until an entry's date, and whether it is released, overdue, soon (within 3 days) or later. Only an active schedule warns. */
function dueOf(entry, ep, { state, schedule, now }) {
  if (!entry || state !== 'active') return { days_until: null, due: null };
  const days = diffDays(todayIn(now, schedule), entry.date);
  if (ep?.status === 'published') return { days_until: days, due: 'released' };
  const at = zonedInstant(entry.date, entry.time, schedule);
  if (new Date(now).getTime() >= at.getTime()) return { days_until: days, due: 'overdue' };
  return { days_until: days, due: days <= 3 ? 'soon' : 'later' };
}

/**
 * The view the routes return: the schedule (or the suggestion when there is
 * none), its state, and one row per episode in number order.
 */
function buildView({ schedule, episodes = [], slotCount = 0, baseDate = null, now = new Date() }) {
  const computed = computeDates({ schedule, episodes, slotCount, baseDate, now });
  const { state } = computed;
  const rows = [...episodes].filter(releasable)
    .sort((a, b) => (Number(a.episode_number) || 1e9) - (Number(b.episode_number) || 1e9))
    .map((ep) => {
      const entry = computed.byEpisode[ep.id] || null;
      const at = entry && entry.time && (state === 'active' || state === 'preview') ? zonedInstant(entry.date, entry.time, schedule).toISOString() : null;
      return {
        episode_id: ep.id,
        episode_number: ep.episode_number ?? null,
        title: ep.title || null,
        status: ep.status || null,
        date: entry?.date || null,
        time: entry?.time || null,
        source: entry?.source || null,
        starts_at: at,
        ...dueOf(entry, ep, { state, schedule, now }),
      };
    });
  const slots = Object.fromEntries(Object.entries(computed.numbers).map(([n, e]) => [n, { date: e.date, time: e.time, source: e.source, episode_id: e.episode_id }]));
  return {
    schedule,
    suggestion: schedule ? null : { ...DEFAULT_SCHEDULE, platforms: [...DEFAULT_PLATFORMS] },
    state,
    preview_from: state === 'preview' ? (isDay(baseDate) ? baseDate : todayIn(now, schedule)) : null,
    episodes: rows,
    slots,
  };
}

/**
 * The schedule dates a change moves: [{ episode_id, episode_number, title,
 * from, to }] with from/to { date, time } or null. Hand-set dates never
 * move, and a released episode is out already, so it is not listed.
 */
function moves(before, after) {
  const was = new Map((before?.episodes || []).map((r) => [r.episode_id, r]));
  return (after?.episodes || []).flatMap((r) => {
    const old = was.get(r.episode_id);
    if (r.source === 'hand' || old?.source === 'hand' || r.status === 'published') return [];
    const from = old?.date ? { date: old.date, time: old.time } : null;
    const to = r.date ? { date: r.date, time: r.time } : null;
    if ((from?.date || null) === (to?.date || null) && (from?.time || null) === (to?.time || null)) return [];
    return [{ episode_id: r.episode_id, episode_number: r.episode_number, title: r.title, from, to }];
  });
}

// ── Reading and writing ───────────────────────────────────────────────────
const parseJson = (v) => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[releaseSchedule] distribution_defaults is not JSON:', err.message);
    return {};
  }
};

/** The show's defaults, its schedule, its episodes and its season (start, slot count); null when there is no such show. */
async function loadInputs(sequelize, showId) {
  const [show] = await sequelize.query(
    'SELECT id, distribution_defaults FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT });
  if (!show) return null;
  const defaults = parseJson(show.distribution_defaults);
  const episodes = await sequelize.query(
    `SELECT id, title, episode_number, status, to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS air_date
       FROM episodes WHERE show_id = :showId AND deleted_at IS NULL
      ORDER BY episode_number ASC NULLS LAST, created_at ASC`,
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT });
  let arc = null;
  try {
    [arc] = await sequelize.query(
      `SELECT a.id, to_char(a.starts_on, 'YYYY-MM-DD') AS starts_on,
              (SELECT COUNT(*)::int FROM season_slots s WHERE s.arc_id = a.id AND s.deleted_at IS NULL) AS slot_count
         FROM show_arcs a WHERE a.show_id = :showId AND a.deleted_at IS NULL
        ORDER BY (a.status = 'active') DESC, a.created_at DESC LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT });
  } catch (err) {
    console.error('[releaseSchedule] the season could not be read (dates go without it):', err.message);
  }
  return { defaults, schedule: readStored(defaults.release_schedule), episodes, baseDate: arc?.starts_on || null, slotCount: arc?.slot_count || 0 };
}

async function viewFor(sequelize, showId, { schedule: override, now } = {}) {
  const input = await loadInputs(sequelize, showId);
  if (!input) return null;
  const schedule = override === undefined ? input.schedule : override;
  return buildView({ ...input, schedule, now: now || new Date() });
}

/** Save the schedule into distribution_defaults, keeping every other key. */
async function saveSchedule(sequelize, showId, raw) {
  const schedule = normalize(raw);
  const [, meta] = await sequelize.query(
    `UPDATE shows SET distribution_defaults = COALESCE(distribution_defaults, '{}'::jsonb) || jsonb_build_object('release_schedule', CAST(:schedule AS jsonb)),
            updated_at = NOW()
      WHERE id = :showId AND deleted_at IS NULL`,
    { replacements: { schedule: JSON.stringify(schedule), showId } });
  if (!(meta?.rowCount ?? meta)) throw new ScheduleError('Show not found.', 404);
  return schedule;
}

/** Set one episode's date by hand ('YYYY-MM-DD'), or clear it (null) to hand it back to the schedule. */
async function setEpisodeDate(sequelize, showId, episodeId, day) {
  if (day !== null && !isDay(day)) throw new ScheduleError('air_date: a date as YYYY-MM-DD, or null for back to the schedule.');
  const [, meta] = await sequelize.query(
    `UPDATE episodes SET air_date = ${day === null ? 'NULL' : "(CAST(:day AS date)::timestamp AT TIME ZONE 'UTC')"}, updated_at = NOW()
      WHERE id = :episodeId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { day, episodeId, showId } });
  if (!(meta?.rowCount ?? meta)) throw new ScheduleError('Episode not found in this show.', 404);
}

module.exports = {
  DAYS,
  PLATFORMS,
  DEFAULT_SCHEDULE,
  ScheduleError,
  normalize,
  readStored,
  scheduleState,
  computeDates,
  buildView,
  moves,
  zonedInstant,
  todayIn,
  onOrAfter,
  loadInputs,
  viewFor,
  saveSchedule,
  setEpisodeDate,
};
