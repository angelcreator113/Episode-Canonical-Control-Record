'use strict';

/**
 * Scheduled world moments (automation step 4; Evoni, 2026-10-18: "start the
 * scheduled world moments": city events, press coverage and trends appear
 * on a schedule, so the world moves without her starting each one).
 *
 * The calendar is the show's, in shows.metadata.world_moments (no new
 * table): what each DREAM city holds and how often, which outlets publish
 * and on what day, the trend day, the award shows, the automatic switch,
 * and a log of what was drafted (so nothing is drafted twice). A show with
 * nothing saved uses the defaults below, written from each city's culture
 * (utils/feedCities DREAM_CITY_CULTURE). Evoni edits any of it.
 *
 *   Kinds of moment
 *     city_event   a city's weekly or monthly event: a world_events DRAFT
 *                  (status 'draft', never confirmed here), named and placed
 *                  from the calendar; no AI. Its posts come the usual way.
 *     award_show   the Culture page's award shows (cultureCanon AWARD_SHOWS,
 *                  Evoni's saved list or the page's) on the first Saturday
 *                  of their month: a world_events draft; no AI.
 *     press        each outlet's weekly piece (routes/press.js characters;
 *                  their beat from PRESS_COVERAGE_MAP): a Pulse draft in the
 *                  writer's voice about the week's events in that beat,
 *                  their own judgement; skipped when nothing in the beat
 *                  happened that week.
 *     trend        each city's trend moves one stage a week through the
 *                  Culture page's stages (fashion; beauty for Radiance Row):
 *                  a Pulse draft by a creator in that city. The cycle's
 *                  hashtag carries from its first post to the rest.
 *   Press and trend posts are queued as `moment` jobs (services/pulseQueue)
 *   and drafted by the posting engine's worker, never in a request: one
 *   automated request each (pulseRequests), every AI call through
 *   aiCostTracker. Each goes through the gate (pulseGate) as other posts do:
 *   flagged, it waits in Review; passing, it is scheduled at the time the
 *   story suggests (postRelease.suggestReleaseTime, the poster's posting
 *   schedule included) on or after its day, never published at once. They
 *   never state a new fact about a brand or a person: only what is listed
 *   happened.
 *
 *   planFromCalendar(calendar, { from, days, awardShows, trendStages, drafted })
 *     the moments due in the window, in date order, each with its key;
 *     pure (no database), the same calendar always gives the same plan
 *   planMoments(db, { showId, from, days })   the show's plan, with what
 *     was already drafted marked
 *   draftMoments(db, { showId, keys, now, max })   turns chosen moments
 *     into records (events now; posts queued); skips drafted ones
 *   runScheduled(db, showId, now)   the automatic run: only while
 *     WORLD_MOMENTS_ENABLED is 'true' AND the show's switch is on, and
 *     while today's AI spend is under the budget; drafts what is due in
 *     the next LEAD_DAYS, at most MAX_PER_RUN
 *   tick(db, now) / startScheduler(db)   every TICK_MS, each show whose
 *     switch is on; startScheduler starts nothing unless the env flag is on
 */

const { DREAM_CITY_CULTURE, DREAM_CITY_KEYS, feedCity } = require('../utils/feedCities');
const { DREAM_CITIES } = require('../utils/lalaHome');

const LEAD_DAYS = 7;           // the automatic run drafts what falls in the next week
const MAX_PER_RUN = 8;         // and never more than this at once
const MAX_DRAFT = 20;          // "Draft these" at most at once
const MAX_DAYS = 31;           // the longest window a plan covers
const LOG_MAX = 300;           // drafted moments remembered
const TICK_MS = 6 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

class MomentsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const cityName = (key) => DREAM_CITIES.find((c) => c.toLowerCase().replace(/\s+/g, '_') === key) || key;

// Each city's recurring events, from its culture line (DREAM_CITY_CULTURE).
const DEFAULT_CITY_EVENTS = Object.freeze({
  dazzle_district: [
    { id: 'runway_thursday', label: 'Runway Thursday', every: 'week', weekday: 4, category: 'fashion', format: 'showcase' },
    { id: 'couture_preview', label: 'Couture Preview', every: 'month', weekday: 6, week_of_month: 2, category: 'luxury_prestige', format: 'preview' },
  ],
  radiance_row: [
    { id: 'glow_market', label: 'Glow Market', every: 'week', weekday: 6, category: 'beauty_wellness', format: 'pop_up' },
    { id: 'lab_launch_night', label: 'Lab Launch Night', every: 'month', weekday: 3, week_of_month: 1, category: 'beauty_wellness', format: 'brand_launch' },
  ],
  echo_park: [
    { id: 'midnight_set', label: 'Midnight Set', every: 'week', weekday: 5, category: 'arts_entertainment', format: 'concert' },
    { id: 'creator_house_showcase', label: 'Creator House Showcase', every: 'month', weekday: 6, week_of_month: 3, category: 'creator_brand', format: 'showcase' },
  ],
  ascent_tower: [
    { id: 'demo_night', label: 'Demo Night', every: 'week', weekday: 3, category: 'creator_brand', format: 'showcase' },
    { id: 'founders_panel', label: 'Founders Panel', every: 'month', weekday: 2, week_of_month: 2, category: 'creator_brand', format: 'panel' },
  ],
  maverick_harbor: [
    { id: 'harbor_collab_meetup', label: 'Harbor Collab Meetup', every: 'week', weekday: 0, category: 'community_local', format: 'meetup' },
    { id: 'underground_gallery_night', label: 'Underground Gallery Night', every: 'month', weekday: 5, week_of_month: 4, category: 'arts_entertainment', format: 'gallery_opening' },
  ],
});

// The four writers (routes/press.js), each on their own day.
const DEFAULT_PRESS = Object.freeze({
  reyna_voss: { on: true, weekday: 1 },
  taye_okafor: { on: true, weekday: 3 },
  solene_beaumont: { on: true, weekday: 5 },
  asha_brennan: { on: true, weekday: 0 },
});
const PRESS_NAMES = Object.freeze({
  reyna_voss: { name: 'Reyna Voss', publication: 'The Real Rate' },
  solene_beaumont: { name: 'Solène Beaumont', publication: 'Undressed' },
  taye_okafor: { name: 'Taye Okafor', publication: 'First Look' },
  asha_brennan: { name: 'Asha Brennan', publication: 'The Cost of Wanting More' },
});

// An event's category, as the press map's beats (fashion, beauty, lifestyle).
const BEAT_OF_CATEGORY = Object.freeze({
  fashion: 'fashion', luxury_prestige: 'fashion',
  beauty_wellness: 'beauty', fitness: 'beauty',
});
const beatOf = (category) => BEAT_OF_CATEGORY[category] || 'lifestyle';

function pressCoverageMap() {
  return require('../routes/wardrobeBrands').PRESS_COVERAGE_MAP || {};
}

/** The beats a writer covers, from PRESS_COVERAGE_MAP. */
function beatsOf(slug) {
  return Object.entries(pressCoverageMap()).filter(([, slugs]) => slugs.includes(slug)).map(([beat]) => beat);
}

const trendLaneOf = (city) => (city === 'radiance_row' ? 'beauty' : 'fashion');

function defaultCalendar() {
  return {
    auto_enabled: false,
    cities: JSON.parse(JSON.stringify(DEFAULT_CITY_EVENTS)),
    press: JSON.parse(JSON.stringify(DEFAULT_PRESS)),
    trends: { on: true, weekday: 2 },
    award_shows: { on: true },
  };
}

/** The saved calendar with the defaults filled in. */
function withDefaults(saved) {
  const d = defaultCalendar();
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    auto_enabled: typeof s.auto_enabled === 'boolean' ? s.auto_enabled : d.auto_enabled,
    cities: Object.fromEntries(DREAM_CITY_KEYS.map((k) => [k, Array.isArray(s.cities?.[k]) ? s.cities[k] : d.cities[k]])),
    press: Object.fromEntries(Object.keys(DEFAULT_PRESS).map((k) => [k, { ...d.press[k], ...(s.press?.[k] || {}) }])),
    trends: { ...d.trends, ...(s.trends || {}) },
    award_shows: { ...d.award_shows, ...(s.award_shows || {}) },
    drafted: Array.isArray(s.drafted) ? s.drafted : [],
  };
}

const dayKey = (date) => date.toISOString().slice(0, 10);
const utcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date, n) => new Date(date.getTime() + n * 86400000);
const storyDate = (date) => `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
// Weeks since 1970-01-04 (a Sunday): the same week number everywhere.
const weekIndex = (date) => Math.floor((utcDay(date).getTime() - Date.UTC(1970, 0, 4)) / (7 * 86400000));
/** Which of its weekday this is in the month: 1 for the first. */
const nthOfMonth = (date) => Math.floor((date.getUTCDate() - 1) / 7) + 1;

const validWeekday = (n) => Number.isInteger(n) && n >= 0 && n <= 6;

/**
 * The moments due from `from` for `days` days. Pure: no database.
 * awardShows: [{ name, month, desc }], trendStages: { fashion: [names], beauty: [names] },
 * drafted: the log ([{ key, ... }]); a drafted moment is marked, not dropped.
 */
function planFromCalendar(calendar, { from, days = 7, awardShows = [], trendStages = {}, drafted = [] } = {}) {
  const cal = withDefaults(calendar);
  const start = utcDay(from || new Date());
  const asked = Number.isFinite(Number(days)) ? Math.floor(Number(days)) : 7;
  const span = Math.max(1, Math.min(MAX_DAYS, asked));
  const done = new Map((drafted || []).map((d) => [d.key, d]));
  const moments = [];
  const push = (m) => moments.push({ ...m, drafted: done.get(m.key) || null });

  for (let i = 0; i < span; i += 1) {
    const day = addDays(start, i);
    const date = dayKey(day);
    const wd = day.getUTCDay();

    for (const city of DREAM_CITY_KEYS) {
      for (const ev of cal.cities[city] || []) {
        if (!ev || ev.on === false || !validWeekday(ev.weekday) || ev.weekday !== wd) continue;
        if (ev.every === 'month' && nthOfMonth(day) !== (Number(ev.week_of_month) || 1)) continue;
        if (ev.every !== 'week' && ev.every !== 'month') continue;
        push({
          key: `city_event:${city}:${ev.id}:${date}`, kind: 'city_event', date, city, city_name: cityName(city),
          label: `${ev.label} · ${cityName(city)}`, detail: `${ev.every === 'week' ? 'Weekly' : 'Monthly'} ${String(ev.category || '').replace(/_/g, ' ')} ${String(ev.format || '').replace(/_/g, ' ')}`.trim(),
          category: ev.category || null, format: ev.format || null, every: ev.every, event_id: ev.id,
        });
      }
    }

    if (cal.award_shows.on !== false && wd === 6 && nthOfMonth(day) === 1) {
      for (const show of awardShows || []) {
        if (!show?.name || String(show.month || '').toLowerCase() !== MONTHS[day.getUTCMonth()].toLowerCase()) continue;
        push({
          key: `award_show:${String(show.name).toLowerCase().replace(/[^a-z0-9]+/g, '_')}:${day.getUTCFullYear()}`, kind: 'award_show', date,
          city: null, label: show.name, detail: show.desc || 'The award show', category: 'luxury_prestige', format: 'gala',
        });
      }
    }

    for (const [slug, p] of Object.entries(cal.press)) {
      if (!p || p.on === false || !validWeekday(p.weekday) || p.weekday !== wd) continue;
      const who = PRESS_NAMES[slug] || { name: slug, publication: '' };
      const beats = beatsOf(slug);
      push({
        key: `press:${slug}:${date}`, kind: 'press', date, city: null, press: slug,
        label: `${who.publication || who.name}: the week's piece`,
        detail: `${who.name} on the week's ${beats.length ? beats.join(' and ') : 'lifestyle'} moments, in their own judgement`,
        beats,
      });
    }

    if (cal.trends.on !== false && validWeekday(cal.trends.weekday) && cal.trends.weekday === wd) {
      for (const city of DREAM_CITY_KEYS) {
        const lane = trendLaneOf(city);
        const stages = (trendStages[lane] || []).filter(Boolean);
        if (!stages.length) continue;
        const w = weekIndex(day);
        const stageNo = (w % stages.length) + 1;
        const cycle = Math.floor(w / stages.length);
        push({
          key: `trend:${city}:${cycle}:${stageNo}`, kind: 'trend', date, city, city_name: cityName(city),
          label: `A ${lane} trend in ${cityName(city)}: ${stages[stageNo - 1]}`,
          detail: `Stage ${stageNo} of ${stages.length}`, lane, stage: stages[stageNo - 1], stage_no: stageNo, stages: stages.length, cycle,
        });
      }
    }
  }
  return { from: dayKey(start), to: dayKey(addDays(start, span - 1)), moments };
}

async function calendarOf(db, showId) {
  const [[row]] = await db.sequelize.query(
    `SELECT metadata::jsonb -> 'world_moments' AS moments FROM shows WHERE id = :showId AND deleted_at IS NULL`, { replacements: { showId } });
  if (!row) throw new MomentsError(404, 'Show not found');
  return withDefaults(row.moments);
}

async function saveCalendar(db, showId, cal) {
  const { drafted, ...rest } = cal;
  const next = { ...rest, drafted: (drafted || []).slice(-LOG_MAX) };
  // One key: the show's other metadata is never rewritten.
  await db.sequelize.query(
    `UPDATE shows SET metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{world_moments}', CAST(:moments AS jsonb))::json,
            updated_at = NOW()
      WHERE id = :showId`, { replacements: { showId, moments: JSON.stringify(next) } });
  return next;
}

/** Validates Evoni's edits (cities, press, trends, award_shows, auto_enabled) and saves them. */
async function saveSettings(db, showId, fields = {}) {
  const cal = await calendarOf(db, showId);
  const { CATEGORY_VALUES, FORMAT_VALUES } = require('../models/WorldEvent');
  if (fields.auto_enabled !== undefined) {
    if (typeof fields.auto_enabled !== 'boolean') throw new MomentsError(400, 'auto_enabled must be true or false.');
    cal.auto_enabled = fields.auto_enabled;
  }
  if (fields.cities !== undefined) {
    if (!fields.cities || typeof fields.cities !== 'object') throw new MomentsError(400, 'cities must be an object of city: events.');
    for (const [city, events] of Object.entries(fields.cities)) {
      if (!DREAM_CITY_KEYS.includes(city)) throw new MomentsError(400, `Unknown city: ${city}.`);
      if (!Array.isArray(events)) throw new MomentsError(400, `${cityName(city)}'s events must be a list.`);
      cal.cities[city] = events.map((ev, i) => {
        const label = String(ev?.label || '').trim().slice(0, 120);
        if (!label) throw new MomentsError(400, `Each event in ${cityName(city)} needs a name.`);
        if (ev.every !== 'week' && ev.every !== 'month') throw new MomentsError(400, `${label}: every must be week or month.`);
        if (!validWeekday(ev.weekday)) throw new MomentsError(400, `${label}: weekday must be 0 (Sunday) to 6.`);
        const week = ev.every === 'month' ? Number(ev.week_of_month) || 1 : null;
        if (week !== null && (week < 1 || week > 4)) throw new MomentsError(400, `${label}: week_of_month must be 1 to 4.`);
        if (ev.category && CATEGORY_VALUES && !CATEGORY_VALUES.includes(ev.category)) throw new MomentsError(400, `${label}: unknown category.`);
        if (ev.format && FORMAT_VALUES && !FORMAT_VALUES.includes(ev.format)) throw new MomentsError(400, `${label}: unknown format.`);
        const id = String(ev.id || label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `event_${i + 1}`;
        return { id, label, every: ev.every, weekday: ev.weekday, ...(week ? { week_of_month: week } : {}), category: ev.category || null, format: ev.format || null, on: ev.on !== false };
      });
    }
  }
  if (fields.press !== undefined) {
    for (const [slug, p] of Object.entries(fields.press || {})) {
      if (!DEFAULT_PRESS[slug]) throw new MomentsError(400, `Unknown outlet: ${slug}.`);
      if (p.weekday !== undefined && !validWeekday(p.weekday)) throw new MomentsError(400, `${slug}: weekday must be 0 to 6.`);
      cal.press[slug] = { ...cal.press[slug], ...(p.weekday !== undefined ? { weekday: p.weekday } : {}), ...(p.on !== undefined ? { on: p.on !== false } : {}) };
    }
  }
  if (fields.trends !== undefined) {
    const t = fields.trends || {};
    if (t.weekday !== undefined && !validWeekday(t.weekday)) throw new MomentsError(400, 'trends.weekday must be 0 to 6.');
    cal.trends = { ...cal.trends, ...(t.weekday !== undefined ? { weekday: t.weekday } : {}), ...(t.on !== undefined ? { on: t.on !== false } : {}) };
  }
  if (fields.award_shows !== undefined) cal.award_shows = { on: fields.award_shows?.on !== false };
  return saveCalendar(db, showId, cal);
}

async function cultureInputs(db) {
  const { loadCultureList } = require('./cultureCanon');
  const names = (list) => (list || []).slice().sort((a, b) => (Number(a?.stage) || 0) - (Number(b?.stage) || 0)).map((x) => String(x?.name || '').trim()).filter(Boolean);
  return {
    awardShows: await loadCultureList(db, 'AWARD_SHOWS'),
    trendStages: { fashion: names(await loadCultureList(db, 'FASHION_TREND_STAGES')), beauty: names(await loadCultureList(db, 'BEAUTY_TREND_STAGES')) },
  };
}

/** The show's plan for the window, with what was drafted marked. */
async function planMoments(db, { showId, from = new Date(), days = 7 } = {}) {
  if (!showId) throw new MomentsError(400, 'show_id is required.');
  const cal = await calendarOf(db, showId);
  const inputs = await cultureInputs(db);
  return { ...planFromCalendar(cal, { from, days, ...inputs, drafted: cal.drafted }), auto_enabled: cal.auto_enabled };
}

/** A city or award event: a world_events draft, through the same model the Events tab creates with. */
async function createEventDraft(db, showId, m) {
  const culture = m.city ? String(DREAM_CITY_CULTURE[m.city] || '').split('. ')[0] : '';
  const description = m.kind === 'award_show'
    ? `${m.label}. ${m.detail}`
    : `${m.city_name}'s ${m.every === 'week' ? 'weekly' : 'monthly'} ${m.label.split(' · ')[0]}.${culture ? ` ${culture}.` : ''}`;
  const event = await db.WorldEvent.create({
    show_id: showId,
    name: m.label.slice(0, 200),
    event_type: 'invite',
    category: m.category || null,
    format: m.format || null,
    description,
    location_hint: m.city_name || null,
    event_date: storyDate(new Date(`${m.date}T00:00:00Z`)),
    canon_consequences: { world_moment: { key: m.key, kind: m.kind, city: m.city || null } },
    status: 'draft',
  });
  return event;
}

/**
 * Turns the chosen moments into records: events as drafts now, press and
 * trend posts queued for the posting engine. Skips what was drafted, what
 * is not in the next MAX_DAYS, and anything past `max`.
 */
async function draftMoments(db, { showId, keys, now = new Date(), max = MAX_DRAFT, by = 'evoni' } = {}) {
  if (!showId) throw new MomentsError(400, 'show_id is required.');
  if (!Array.isArray(keys) || !keys.length) throw new MomentsError(400, 'Choose the moments to draft.');
  const cal = await calendarOf(db, showId);
  const inputs = await cultureInputs(db);
  const { moments } = planFromCalendar(cal, { from: now, days: MAX_DAYS, ...inputs, drafted: cal.drafted });
  const byKey = new Map(moments.map((m) => [m.key, m]));
  const results = [];
  let made = 0;
  for (const key of [...new Set(keys)]) {
    const m = byKey.get(key);
    if (!m) { results.push({ key, status: 'skipped', why: 'Not in the calendar for the next month.' }); continue; }
    if (m.drafted) { results.push({ key, status: 'skipped', why: 'Already drafted.' }); continue; }
    if (made >= max) { results.push({ key, status: 'skipped', why: `At most ${max} at once.` }); continue; }
    try {
      let entry;
      if (m.kind === 'city_event' || m.kind === 'award_show') {
        const event = await createEventDraft(db, showId, m);
        entry = { key, kind: m.kind, label: m.label, date: m.date, ref: { type: 'world_event', id: event.id }, status: 'drafted', at: now.toISOString(), by };
      } else {
        const job = await require('./pulseQueue').enqueue(db, {
          showId, kind: 'moment',
          payload: { key, kind: m.kind, date: m.date, label: m.label, press: m.press || null, beats: m.beats || null, city: m.city || null, lane: m.lane || null, stage: m.stage || null, stage_no: m.stage_no || null, stages: m.stages || null, cycle: m.cycle ?? null },
        });
        entry = { key, kind: m.kind, label: m.label, date: m.date, ref: { type: 'pulse_job', id: job.id }, status: 'queued', at: now.toISOString(), by };
      }
      cal.drafted.push(entry);
      made += 1;
      results.push({ key, status: entry.status, ref: entry.ref });
    } catch (err) {
      console.error(`[WorldMoments] drafting ${key} failed:`, err);
      results.push({ key, status: 'failed', why: err.message });
    }
  }
  await saveCalendar(db, showId, cal);
  return { results, drafted: made };
}

/** Updates one drafted moment's log entry (the worker's result). */
async function noteDrafted(db, showId, key, fields) {
  const cal = await calendarOf(db, showId);
  const entry = cal.drafted.find((d) => d.key === key);
  if (!entry) return null;
  Object.assign(entry, fields);
  await saveCalendar(db, showId, cal);
  return entry;
}

/** The week's events in a writer's beats: names and a line each. */
async function weekInBeats(db, showId, beats, date) {
  const end = addDays(new Date(`${date}T00:00:00Z`), 1);
  const since = addDays(end, -8);
  const [rows] = await db.sequelize.query(
    `SELECT name, category, description FROM world_events
      WHERE show_id = :showId AND deleted_at IS NULL AND status <> 'archived'
        AND COALESCE(updated_at, created_at) >= :since AND COALESCE(updated_at, created_at) < :end
      ORDER BY created_at DESC LIMIT 30`, { replacements: { showId, since, end } });
  return rows.filter((r) => beats.includes(beatOf(r.category))).slice(0, 8);
}

/** A creator in the city to post the trend: an approved voice, not confidential, the same pick for the same moment. */
async function trendPoster(db, showId, city, key) {
  const voices = require('./pulseVoices');
  const { isConfidential } = require('../utils/confidentialCharacters');
  const moment = await require('./storyClock').presentOrder(db, showId);
  const approved = (await voices.eligible(db, showId, { at: moment }))
    .filter((c) => voices.isApproved(c.voice) && !isConfidential(c.character));
  if (!approved.length) return null;
  const [rows] = await db.sequelize.query('SELECT id, city FROM social_profiles WHERE id IN (:ids)',
    { replacements: { ids: approved.map((c) => c.character.feed_profile_id) } });
  const cityOf = new Map(rows.map((r) => [Number(r.id), feedCity(r.city)]));
  const candidates = approved.filter((c) => cityOf.get(Number(c.character.feed_profile_id)) === city);
  if (!candidates.length) return null;
  const crypto = require('crypto');
  const seed = (id) => crypto.createHash('sha256').update(`${key}:${id}`).digest('hex');
  return candidates.slice().sort((a, b) => (seed(a.character.id) < seed(b.character.id) ? -1 : 1))[0].character;
}

/** The `moment` job: drafts the press piece or the trend post, gates it, schedules it on or after its day. */
async function handleMoment(db, job) {
  const p = job.payload_json || {};
  const showId = job.show_id;
  let character;
  let about;
  if (p.kind === 'press') {
    const { Op } = require('sequelize');
    character = await db.RegistryCharacter.findOne({ where: { character_key: p.press, feed_profile_id: { [Op.ne]: null } }, order: [['created_at', 'DESC']] });
    if (!character || !character.feed_profile_id) {
      await noteDrafted(db, showId, p.key, { status: 'skipped', why: 'The writer has no Pulse profile yet.' });
      return { skipped: 'The writer has no Pulse profile yet.' };
    }
    const beats = Array.isArray(p.beats) && p.beats.length ? p.beats : ['lifestyle'];
    const events = await weekInBeats(db, showId, beats, p.date);
    if (!events.length) {
      await noteDrafted(db, showId, p.key, { status: 'skipped', why: `Nothing in their beat (${beats.join(', ')}) this week.` });
      return { skipped: 'Nothing in their beat this week.' };
    }
    const who = PRESS_NAMES[p.press] || {};
    about = `Your weekly piece${who.publication ? ` for ${who.publication}` : ''}, as a Pulse post: what you make of this week's ${beats.join(' and ')} moments in the LalaVerse. Your own editorial judgement: praise, question or pass over any of them. Only these happened: ${events.map((e) => `${e.name}${e.description ? ` (${String(e.description).slice(0, 140)})` : ''}`).join('; ')}. Do not invent other events, people, deals, numbers or any brand's history.`;
  } else if (p.kind === 'trend') {
    character = await trendPoster(db, showId, p.city, p.key);
    if (!character) {
      await noteDrafted(db, showId, p.key, { status: 'skipped', why: `No creator in ${cityName(p.city)} with an approved voice.` });
      return { skipped: 'No creator in the city with an approved voice.' };
    }
    const cal = await calendarOf(db, showId);
    const earlier = cal.drafted.find((d) => d.kind === 'trend' && d.key.startsWith(`trend:${p.city}:${p.cycle}:`) && d.hashtag);
    about = `A ${p.lane} trend in ${cityName(p.city)} is at its "${p.stage}" stage this week (stage ${p.stage_no} of ${p.stages}).${earlier ? ` It is the trend tagged ${earlier.hashtag}; keep that tag.` : ' Name it the way you would, with one hashtag.'} Post about it the way you would at this stage: catch it early, ride it, or be tired of it. It is a look or a habit, not a brand: do not name a brand or invent its history.`;
  } else {
    return { skipped: `Unknown moment kind: ${p.kind}` };
  }
  const blocked = await require('./pulseVoices').automationBlocker(db, character.id);
  if (blocked) {
    await noteDrafted(db, showId, p.key, { status: 'skipped', why: blocked });
    return { skipped: blocked };
  }
  const drafted = await require('./pulseDrafter').draftPost(db, {
    showId, characterId: character.id, context: { about }, request: { kind: 'moment', jobId: job.id },
  });
  const { post } = drafted;
  const gateApi = require('./pulseGate');
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const gate = await gateApi.check(db, post, { voice: drafted.voice, privateState: drafted.privateState, lalaProfileId });
  const reasons = gateApi.reviewReasons(post, gate, { lalaProfileId, revealsStory: drafted.revealsStory });
  // The poster's trust (services/pulseTrust), as for their other posts.
  const { review, released_on_trust: onTrust } = await require('./pulseTrust').trustedReview(db, post, reasons, gate);
  await post.update({ gate_json: { ...gate, review, world_moment: p.key, ...(onTrust ? { released_on_trust: onTrust } : {}), checked_at: new Date().toISOString() } });
  let scheduledAt = null;
  if (!review.length) {
    const postRelease = require('./postRelease');
    const dayStart = new Date(`${p.date}T00:00:00Z`);
    try {
      const { at } = await postRelease.suggestReleaseTime(db, post, { now: dayStart > new Date() ? dayStart : new Date() });
      await postRelease.setReleaseTime(post, { mode: 'schedule', at });
      scheduledAt = new Date(at).toISOString();
    } catch (err) {
      console.error(`[WorldMoments] no release time for ${post.id}; it waits in Review:`, err.message);
      await post.update({ gate_json: { ...post.gate_json, review: ['schedule'] } });
    }
  }
  await noteDrafted(db, showId, p.key, {
    status: scheduledAt ? 'scheduled' : 'in_review', post_id: post.id, scheduled_at: scheduledAt, hashtag: post.trending_topic || null,
  });
  return { draftIds: [post.id] };
}

function registerHandlers() {
  require('./pulseQueue').register('moment', handleMoment);
}

/** Today's AI spend is under the budget (aiCostTracker). */
async function underBudget() {
  const tracker = require('./aiCostTracker');
  const spent = await tracker.getFreshDailySpend();
  return !(Number.isFinite(tracker.DAILY_BUDGET) && spent >= tracker.DAILY_BUDGET);
}

/**
 * The automatic run for one show: nothing unless the server's
 * WORLD_MOMENTS_ENABLED is 'true' and the show's switch is on, and today's
 * AI spend is under the budget. Drafts what is due in the next LEAD_DAYS
 * and not drafted, at most MAX_PER_RUN.
 */
async function runScheduled(db, showId, now = new Date()) {
  if (process.env.WORLD_MOMENTS_ENABLED !== 'true') return { ran: false, why: 'WORLD_MOMENTS_ENABLED is off.' };
  const cal = await calendarOf(db, showId);
  if (!cal.auto_enabled) return { ran: false, why: "The show's switch is off." };
  if (!(await underBudget())) {
    console.warn(`[WorldMoments] show ${showId}: today's AI budget is used; nothing drafted.`);
    return { ran: false, why: "Today's AI budget is used." };
  }
  const inputs = await cultureInputs(db);
  const { moments } = planFromCalendar(cal, { from: now, days: LEAD_DAYS, ...inputs, drafted: cal.drafted });
  const keys = moments.filter((m) => !m.drafted).map((m) => m.key).slice(0, MAX_PER_RUN);
  if (!keys.length) return { ran: true, results: [], drafted: 0 };
  const out = await draftMoments(db, { showId, keys, now, max: MAX_PER_RUN, by: 'schedule' });
  console.log(`[WorldMoments] show ${showId}: drafted ${out.drafted} moment(s): ${out.results.map((r) => `${r.key}=${r.status}`).join(', ')}`);
  return { ran: true, ...out };
}

/** Each show whose switch is on. */
async function tick(db, now = new Date()) {
  if (process.env.WORLD_MOMENTS_ENABLED !== 'true') return [];
  const [shows] = await db.sequelize.query(
    `SELECT id FROM shows WHERE deleted_at IS NULL AND (metadata::jsonb -> 'world_moments' ->> 'auto_enabled') = 'true'`);
  const out = [];
  for (const s of shows) {
    try {
      out.push({ show_id: s.id, ...(await runScheduled(db, s.id, now)) });
    } catch (err) {
      console.error(`[WorldMoments] the run for show ${s.id} failed:`, err);
    }
  }
  return out;
}

let timer = null;

/** Starts the automatic run, only when the server sets WORLD_MOMENTS_ENABLED=true (Evoni's .env change). */
function startScheduler(db = require('../models'), { intervalMs = TICK_MS } = {}) {
  if (process.env.WORLD_MOMENTS_ENABLED !== 'true') return false;
  if (timer) return false;
  timer = setInterval(() => {
    tick(db).catch((err) => console.error('[WorldMoments] the run failed:', err));
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return true;
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  LEAD_DAYS, MAX_PER_RUN, MAX_DRAFT, MAX_DAYS, LOG_MAX, TICK_MS, DEFAULT_CITY_EVENTS, DEFAULT_PRESS, PRESS_NAMES,
  MomentsError, defaultCalendar, withDefaults, planFromCalendar, beatOf, beatsOf, weekIndex,
  calendarOf, saveSettings, planMoments, draftMoments, noteDrafted, handleMoment, registerHandlers,
  runScheduled, tick, startScheduler, stopScheduler,
};
