'use strict';

/**
 * Setting up a season (Evoni, 2026-10-24, the Season Plan's PR 1: "Set up
 * the season" form, Season 2 and on, place the episodes already made,
 * draft the whole season in one AI call, one setup checklist; "and we can
 * use the current events?" — yes, her existing events drive the setup).
 *
 *   - normaliseSetup / buildPhases: the form (title, tagline, three part
 *     names and taglines, and the split of the 24 episodes, each part at
 *     least one). arcProgressionService.seedArc seeds from it.
 *   - updateSetup: "Edit season". The split re-phases the slots that have
 *     not started; a started slot keeps its part, so a split that would move
 *     one is refused (§8(ff) Q2: "phase boundaries can shift within the 24,
 *     only across slots that haven't started"). A finished part keeps its
 *     episodes.
 *   - previewPlacement / applyPlacement: the episodes already made that are
 *     in no slot go into the open slots in episode order (their events come
 *     with them); the unused draft and ready events fill the rest, dated
 *     ones by date, undated ones by how well they fit the slot
 *     (seasonSuggestionService.scoreForSeason). Nothing is written until
 *     Save, which applies the whole list in one transaction through the
 *     slot service's own placement and pencil rules.
 *   - draftSeason: one AI call drafts every open slot's story purpose,
 *     pressure and thread (of the season or of one part). Nothing is saved:
 *     Evoni accepts drafts, which are written by
 *     seasonIntentionService.acceptDrafts. Slots she edited, and slots that
 *     have started, are never offered (draftNextSlot's rule).
 */

const Anthropic = require('@anthropic-ai/sdk');
const {
  SLOTS_PER_SEASON, PRESSURE_LEVELS, getRoadmap, roadmapOf, arcPhases, snapshotEpisode,
  placeEpisodeIn, pencilEventIn,
} = require('./seasonSlotService');
const { episodeEventIdSql } = require('../utils/episodeEventSql');
const { loadSeason } = require('./seasonLoader');
const {
  seasonAiContext, careerGoals, askModel, isBudgetRefusal, bullets, phaseLine, threadLine, goalLine, debtLines,
} = require('./seasonAiContext');

const MODELS = ['claude-sonnet-4-6'];
const PART_COUNT = 3;
const DEFAULT_SPLIT = [8, 8, 8];
const MAX_TOKENS = 4000;

// Season 1's original wording, kept as the defaults the form opens with.
const SEASON_ONE = {
  title: 'Soft Luxury Ascension',
  tagline: 'Lala earns her place in the luxury tier',
  description: 'The full 24-episode journey from nobody to uncopyable. Fashion is strategy. Reputation is currency. Legacy is built episode by episode.',
};

// What each part position carries beyond its name: the emotional arc and how
// the feed behaves. The form does not edit these; they follow the position.
const PART_DEFAULTS = [
  {
    title: 'Foundation',
    tagline: 'Prove you belong',
    emotional_arc: 'curiosity → first stumble → finding her footing',
    feed_behavior: {
      follow_bias: 'aspiration',
      event_prestige_max: 6,
      follow_emotions: ['excitement', 'anxiety', 'admiration'],
      feed_tone: 'Lala watches from the outside. Everything feels aspirational and slightly out of reach.',
    },
  },
  {
    title: 'Ascension',
    tagline: 'Climb the ladder',
    emotional_arc: 'ambition → competition → first real loss → determination',
    feed_behavior: {
      follow_bias: 'competition',
      event_prestige_max: 8,
      follow_emotions: ['competition', 'jealousy', 'motivation'],
      feed_tone: 'Lala is in the mix now. People know her name. The shade gets personal.',
    },
  },
  {
    title: 'Legacy',
    tagline: 'Become uncopyable',
    emotional_arc: 'confidence → crisis of identity → building her own room → transcendence',
    feed_behavior: {
      follow_bias: 'study',
      event_prestige_max: 10,
      follow_emotions: ['admiration', 'obsession', 'motivation'],
      feed_tone: 'Lala stops watching and starts being watched. The feed follows her.',
    },
  },
];

class SeasonSetupError extends Error {
  constructor(message, status = 400, code = 'SEASON_SETUP_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function text(value, max) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[seasonSetup] JSON parse failed; default used:', err.message);
    return fallback;
  }
}

/** The form's defaults for a season: Season 1's wording, or "Season N" after it. */
function defaultSetup(seasonNumber = 1) {
  const first = Number(seasonNumber) <= 1;
  return {
    title: first ? SEASON_ONE.title : `Season ${seasonNumber}`,
    tagline: first ? SEASON_ONE.tagline : null,
    description: first ? SEASON_ONE.description : null,
    phases: PART_DEFAULTS.map((p) => ({ title: p.title, tagline: p.tagline })),
    split: [...DEFAULT_SPLIT],
  };
}

/**
 * The split as three whole numbers, each at least 1, adding up to 24.
 * Absent: 8 / 8 / 8. Throws a 400 SeasonSetupError saying what is wrong.
 */
function normaliseSplit(split) {
  if (split == null) return [...DEFAULT_SPLIT];
  if (!Array.isArray(split) || split.length !== PART_COUNT) {
    throw new SeasonSetupError(`The split needs ${PART_COUNT} numbers, one for each part.`);
  }
  const nums = split.map((n) => Number(n));
  if (nums.some((n) => !Number.isInteger(n))) throw new SeasonSetupError('Each part takes a whole number of episodes.');
  if (nums.some((n) => n < 1)) throw new SeasonSetupError('Each part needs at least one episode.');
  const total = nums.reduce((a, b) => a + b, 0);
  if (total !== SLOTS_PER_SEASON) {
    throw new SeasonSetupError(`The three parts must add up to ${SLOTS_PER_SEASON} episodes; these add up to ${total}.`);
  }
  return nums;
}

/** [[1, 8], [9, 16], [17, 24]] for 8 / 8 / 8. */
function rangesOf(split) {
  let start = 1;
  return split.map((n) => {
    const range = [start, start + n - 1];
    start += n;
    return range;
  });
}

/** The part (1-3) a slot falls in under a split. */
function partOf(slotNumber, ranges) {
  const i = ranges.findIndex(([a, b]) => slotNumber >= a && slotNumber <= b);
  return i + 1;
}

// The Season page's fields (Evoni, 2026-10-25): a cover and a picture per
// part (chosen from Files, so a web address), the dates and a logline.
const SEASON_PAGE_FIELDS = ['cover_url', 'starts_on', 'ends_on', 'logline', 'description'];
const has = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * A picture's address: an http(s) URL (what Files gives), or null to clear.
 * Anything else is refused, so a typed path or a data: blob never lands.
 */
function pictureUrl(value, label) {
  const s = text(value, 2000);
  if (!s) return null;
  let url;
  try { url = new URL(s); } catch (err) {
    console.warn(`[seasonSetup] ${label} is not a web address:`, err.message);
    throw new SeasonSetupError(`${label} must be a picture chosen from Files (a web address).`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new SeasonSetupError(`${label} must be a picture chosen from Files (a web address).`);
  }
  return s;
}

/** A calendar day as YYYY-MM-DD, or null to clear. Refuses a day that does not exist. */
function seasonDay(value, label) {
  if (value == null || String(value).trim() === '') return null;
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : null;
  if (!m || Number.isNaN(d.getTime()) || d.getUTCMonth() + 1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3])) {
    throw new SeasonSetupError(`${label} must be a date (YYYY-MM-DD).`);
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** A saved DATE as YYYY-MM-DD: pg reads it as local midnight, so the local parts are the day. */
function savedDay(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
}

/** The end is not before the start (when both are set). */
function checkDateOrder(startsOn, endsOn) {
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new SeasonSetupError('The season cannot end before it starts.');
  }
}

/**
 * The Season page's fields that the body sends, checked. A field the body
 * leaves out is left out here too, so Edit season keeps what is saved.
 */
function normalisePageFields(body = {}) {
  const out = {};
  if (has(body, 'cover_url')) out.cover_url = pictureUrl(body.cover_url, 'The cover');
  if (has(body, 'starts_on')) out.starts_on = seasonDay(body.starts_on, 'The start date');
  if (has(body, 'ends_on')) out.ends_on = seasonDay(body.ends_on, 'The end date');
  if (has(body, 'logline')) out.logline = text(body.logline, 500);
  if (has(body, 'description')) out.description = text(body.description, 4000);
  checkDateOrder(out.starts_on, out.ends_on);
  return out;
}

/**
 * The form, checked: a title, three parts each with a name (a tagline is
 * optional), and the split; and the Season page's fields it sends (a cover,
 * dates, a logline, a description, a picture per part). Throws a 400
 * SeasonSetupError on what is missing or wrong.
 */
function normaliseSetup(body = {}) {
  const title = text(body.title, 200);
  if (!title) throw new SeasonSetupError('The season needs a title.');
  const parts = Array.isArray(body.phases) ? body.phases : [];
  if (parts.length !== PART_COUNT) throw new SeasonSetupError(`The season has ${PART_COUNT} parts; give each a name.`);
  const phases = parts.map((p, i) => {
    const name = text(p?.title, 100);
    if (!name) throw new SeasonSetupError(`Part ${i + 1} needs a name.`);
    const part = { title: name, tagline: text(p?.tagline, 300) };
    if (has(p, 'picture_url')) part.picture_url = pictureUrl(p.picture_url, `Part ${i + 1}'s picture`);
    return part;
  });
  const page = normalisePageFields(body);
  return {
    title, tagline: text(body.tagline, 300), description: null, phases, split: normaliseSplit(body.split),
    ...page,
    page_fields: Object.keys(page),
  };
}

/** The arc's phases from a setup: names, ranges, and each position's arc and feed. */
function buildPhases(setup) {
  const ranges = rangesOf(setup.split);
  const now = new Date().toISOString();
  return setup.phases.map((p, i) => ({
    phase: i + 1,
    title: p.title,
    tagline: p.tagline || null,
    ...(p.picture_url ? { picture_url: p.picture_url } : {}),
    episode_start: ranges[i][0],
    episode_end: ranges[i][1],
    status: i === 0 ? 'active' : 'upcoming',
    ...(i === 0 ? { activated_at: now, activated_by: 'auto' } : {}),
    emotional_arc: PART_DEFAULTS[i].emotional_arc,
    feed_behavior: { ...PART_DEFAULTS[i].feed_behavior },
    goal_summary: { total: 0, completed: 0, failed: 0, carried: 0 },
  }));
}

/**
 * The next season's numbers. arc_number counts every arc ever made, deleted
 * ones too, because the (show_id, arc_number) unique index does; the season
 * number counts the live ones, so a deleted season's number is used again.
 */
async function nextNumbers(sequelize, showId, transaction) {
  const [[all]] = await sequelize.query(
    'SELECT COALESCE(MAX(arc_number), 0)::int AS n FROM show_arcs WHERE show_id = :showId',
    { replacements: { showId }, transaction });
  const [[live]] = await sequelize.query(
    'SELECT COALESCE(MAX(season_number), 0)::int AS n FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL',
    { replacements: { showId }, transaction });
  return { arc_number: all.n + 1, season_number: live.n + 1 };
}

const started = (slot) => Boolean(slot.episode_id || slot.locked_at || slot.accepted_at);

/**
 * "Edit season": the title, tagline, part names and taglines, and the split.
 * Slots that have not started move to their new part. Refused (409) when the
 * split would move a started slot out of its part, or change a finished
 * part's episodes. A started episode's season snapshot takes the new names.
 */
async function updateSetup(sequelize, showId, body) {
  const setup = normaliseSetup(body);
  const ranges = rangesOf(setup.split);
  return sequelize.transaction(async (transaction) => {
    // The season in progress and its slots, locked for the edit.
    const season = await loadSeason(sequelize, showId, { transaction, lock: true });
    if (!season) throw new SeasonSetupError('This show has no season in progress to edit.', 404, 'SEASON_NOT_FOUND');
    const { arc } = season;
    const phases = arcPhases(arc);
    if (phases.length !== PART_COUNT) throw new SeasonSetupError(`This season does not have ${PART_COUNT} parts; it cannot be edited here.`, 409, 'SEASON_SPLIT_REFUSED');

    phases.forEach((p, i) => {
      if (p.status === 'completed' && (Number(p.episode_start) !== ranges[i][0] || Number(p.episode_end) !== ranges[i][1])) {
        throw new SeasonSetupError(
          `Part ${i + 1} (${p.title}) is finished, so it keeps E${p.episode_start}–E${p.episode_end}.`, 409, 'SEASON_SPLIT_REFUSED');
      }
    });

    const slots = season.slots.map((sl) => ({ ...sl, evaluation_status: sl.episode_evaluation_status }));

    const blocked = slots.filter((sl) => started(sl) && partOf(sl.slot_number, ranges) !== Number(sl.phase));
    if (blocked.length) {
      const named = blocked.slice(0, 3).map((sl) => {
        const from = phases[Number(sl.phase) - 1];
        return `E${sl.slot_number}${sl.episode_title ? ` ("${sl.episode_title}")` : ''} has started in Part ${sl.phase}${from ? ` (${from.title})` : ''}`;
      });
      const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : '';
      throw new SeasonSetupError(
        `This split would move a started episode to another part: ${named.join('; ')}${more}. A started episode keeps its part; change the split so it stays.`,
        409, 'SEASON_SPLIT_MOVES_STARTED');
    }

    const nextPhases = phases.map((p, i) => ({
      ...p,
      title: setup.phases[i].title,
      tagline: setup.phases[i].tagline,
      // A part's picture changes only when the form sends it.
      ...(has(setup.phases[i], 'picture_url') ? { picture_url: setup.phases[i].picture_url } : {}),
      episode_start: ranges[i][0],
      episode_end: ranges[i][1],
    }));
    // The Season page's fields the form sent; the rest keep what is saved.
    // The dates are checked together with the saved one the form left out.
    const sent = setup.page_fields || [];
    checkDateOrder(
      sent.includes('starts_on') ? setup.starts_on : savedDay(arc.starts_on),
      sent.includes('ends_on') ? setup.ends_on : savedDay(arc.ends_on));
    const sets = sent.map((k) => `${k} = :${k}`).join(', ');
    await sequelize.query(
      `UPDATE show_arcs SET title = :title, tagline = :tagline, phases = CAST(:phases AS jsonb),${sets ? ` ${sets},` : ''} updated_at = NOW()
        WHERE id = :id`,
      { replacements: {
        title: setup.title, tagline: setup.tagline, phases: JSON.stringify(nextPhases), id: arc.id,
        ...Object.fromEntries(sent.map((k) => [k, setup[k] ?? null])),
      }, transaction });

    let moved = 0;
    for (const sl of slots) {
      const part = partOf(sl.slot_number, ranges);
      if (!started(sl) && part !== Number(sl.phase)) {
        await sequelize.query('UPDATE season_slots SET phase = :part, updated_at = NOW() WHERE id = :id',
          { replacements: { part, id: sl.id }, transaction });
        moved += 1;
      }
    }
    // A started draft's season snapshot carries the part's name and tagline.
    for (const sl of slots.filter((s) => s.episode_id && !s.accepted_at && s.evaluation_status !== 'accepted')) {
      await snapshotEpisode(sequelize, { slotId: sl.id, episodeId: sl.episode_id, transaction });
    }
    return { arc_id: arc.id, season_number: arc.season_number || 1, moved, phases: nextPhases };
  });
}

// ─── Use your events and episodes ────────────────────────────────────────

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** An event's date as YYYY-MM-DD when it is a real date; null when undated or free text. */
function eventDay(value) {
  const m = String(value || '').trim().match(ISO_DATE);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() + 1 !== Number(m[2])) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

async function lalaState(sequelize, showId) {
  let state = { coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0 };
  try {
    const [[row]] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress FROM character_state
        WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
      { replacements: { showId } });
    if (row) state = { ...row };
    const { getCurrentBalance } = require('./financialTransactionService');
    state.coins = await getCurrentBalance(sequelize, showId);
  } catch (err) {
    console.error('[seasonSetup] Lala state load failed; defaults used:', err.message);
  }
  return state;
}

function activeGoals(sequelize, showId) {
  return careerGoals(sequelize, showId, { limit: 24, statuses: ['active', 'paused'] });
}

/**
 * The events that can be pencilled (getRoadmap's rule: live, unused, draft
 * or ready, in no slot of this season), with what scoreForSeason reads.
 */
async function availableEvents(sequelize, showId, arcId) {
  const [events] = await sequelize.query(
    `SELECT ev.id, ev.name, ev.status, ev.event_type, ev.event_date, ev.prestige, ev.strictness, ev.is_paid,
            ev.payment_amount, ev.cost_coins, ev.host, ev.host_brand, ev.venue_name, ev.venue_location_id, ev.format
       FROM world_events ev
      WHERE ev.show_id = :showId AND ev.deleted_at IS NULL AND ev.used_in_episode_id IS NULL
        AND COALESCE(ev.status, 'draft') IN ('draft', 'ready')
        AND NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.event_id = ev.id AND s.arc_id = :arcId AND s.deleted_at IS NULL)
      ORDER BY ev.name ASC`,
    { replacements: { showId, arcId } });
  return events;
}

/**
 * "Pencil an event" for one slot, best fit first (Evoni's review,
 * 2026-10-24, item 18): each event that can be pencilled, scored by
 * seasonSuggestionService.scoreForSeason against this slot's planned
 * pressure and career focus, Lala's state and goals, and the last three
 * episodes' events (a repeat fits less well). Each with a short reason.
 * Ties keep the name order. A SeasonSetupError 404 for a slot not in the
 * show's active season.
 */
async function rankEventsForSlot(sequelize, showId, slotId) {
  const roadmap = await getRoadmap(sequelize, showId);
  const slot = roadmap ? roadmap.phases.flatMap((p) => p.slots).find((s) => String(s.id) === String(slotId)) : null;
  if (!slot) throw new SeasonSetupError('That slot is not in this show\'s season.', 404, 'SEASON_SLOT_NOT_FOUND');
  const events = await availableEvents(sequelize, showId, roadmap.arc.id);
  if (!events.length) return { slot_id: slot.id, label: slot.label, events: [] };
  const { scoreForSeason, loadSeasonInputs } = require('./seasonSuggestionService');
  const state = await lalaState(sequelize, showId);
  const season = await loadSeasonInputs(sequelize, showId);
  const inputs = {
    slot: { desired_pressure: slot.intention?.desired_pressure || null, career_focus: slot.intention?.career_focus || null },
    goals: season.goals,
    recent: season.recent,
  };
  const ranked = events.map((ev, i) => {
    const fit = scoreForSeason(ev, state, inputs);
    const boost = fit.reasons.find((r) => r.kind === 'boost');
    const warn = fit.reasons.find((r) => r.kind === 'warn');
    return {
      id: ev.id, name: ev.name, status: ev.status || 'draft', score: fit.score,
      estimated_pressure: fit.estimated_pressure,
      reason: (boost || warn)?.text || 'No strong fit either way', reason_kind: boost ? 'boost' : warn ? 'warn' : 'none',
      order: i,
    };
  }).sort((a, b) => b.score - a.score || a.order - b.order).map(({ order: _order, ...ev }) => ev);
  return { slot_id: slot.id, label: slot.label, events: ranked };
}

const eventCard = (ev) => (ev ? {
  id: ev.id, name: ev.name, status: ev.status || 'draft', event_type: ev.event_type || null,
  event_date: eventDay(ev.event_date), date_text: ev.event_date || null,
} : null);

/**
 * The placement Evoni sees before Save. Open slots are the ones with no
 * episode, not locked, and no event pencilled. Returns
 * { season_number, items: [{ slot_id, label, kind, episode, event, why }],
 *   open_slots, left_over } — left_over is what did not fit.
 */
async function previewPlacement(sequelize, showId) {
  const roadmap = await getRoadmap(sequelize, showId);
  if (!roadmap) throw new SeasonSetupError('Set up the season first.', 409, 'SEASON_NOT_FOUND');
  const slots = roadmap.phases.flatMap((p) => p.slots);
  const open = slots.filter((s) => !s.locked && !s.event);
  const items = [];
  const leftOver = [];
  let next = 0;
  const take = () => (next < open.length ? open[next++] : null);
  const itemFor = (slot, fields) => ({
    slot_id: slot.id, slot_number: slot.slot_number, label: slot.label, phase: slot.phase, episode: null, event: null, ...fields,
  });

  // The episodes already made, in episode order, with their own events.
  const episodes = roadmap.unslotted_episodes || [];
  const episodeEvents = new Map();
  if (episodes.length) {
    const [rows] = await sequelize.query(
      `SELECT ep.id AS episode_id, ev.id, ev.name, ev.status, ev.event_type, ev.event_date
         FROM episodes ep
         LEFT JOIN world_events ev ON ev.id = ${episodeEventIdSql('ep.id')} AND ev.deleted_at IS NULL
        WHERE ep.id IN (:ids)`,
      { replacements: { ids: episodes.map((e) => e.id) } });
    for (const r of rows) if (r.id) episodeEvents.set(String(r.episode_id), r);
  }
  for (const ep of episodes) {
    const episode = { id: ep.id, title: ep.title, episode_number: ep.episode_number, status: ep.status, evaluation_status: ep.evaluation_status };
    const event = eventCard(episodeEvents.get(String(ep.id)));
    const slot = take();
    if (!slot) { leftOver.push({ kind: 'episode', episode, event }); continue; }
    items.push(itemFor(slot, {
      kind: 'episode', episode, event,
      why: ep.episode_number != null ? `Episode ${ep.episode_number}, in episode order` : 'In episode order',
    }));
  }

  // The unused draft and ready events not yet in this season (getRoadmap's
  // rule), less those that come with an episode above.
  const withEpisodes = new Set([...episodeEvents.values()].map((r) => String(r.id)));
  const events = await availableEvents(sequelize, showId, roadmap.arc.id);
  const candidates = events.filter((e) => !withEpisodes.has(String(e.id)));
  const dated = candidates.filter((e) => eventDay(e.event_date))
    .sort((a, b) => eventDay(a.event_date).localeCompare(eventDay(b.event_date)) || String(a.name).localeCompare(String(b.name)));
  const undated = candidates.filter((e) => !eventDay(e.event_date));

  // The last three events placed, so an undated event that repeats one's
  // host or venue fits less well (Q8's repeat rule).
  const recent = [];
  const remember = (slot, ev) => {
    recent.unshift({ label: slot.label, host: ev.host, host_brand: ev.host_brand, venue_location_id: ev.venue_location_id, venue_name: ev.venue_name });
    recent.length = Math.min(recent.length, 3);
  };

  for (const ev of dated) {
    const slot = take();
    if (!slot) { leftOver.push({ kind: 'event', episode: null, event: eventCard(ev) }); continue; }
    items.push(itemFor(slot, { kind: 'event', event: eventCard(ev), why: `Dated ${eventDay(ev.event_date)}, in date order` }));
    remember(slot, ev);
  }

  if (undated.length) {
    const { scoreForSeason } = require('./seasonSuggestionService');
    const state = await lalaState(sequelize, showId);
    const goals = await activeGoals(sequelize, showId);
    const pool = [...undated];
    while (pool.length) {
      const slot = take();
      if (!slot) break;
      const inputs = {
        slot: { desired_pressure: slot.intention?.desired_pressure || null, career_focus: slot.intention?.career_focus || null },
        goals: goals.filter((g) => g.status === 'active'),
        recent,
      };
      let best = 0;
      let bestFit = null;
      pool.forEach((ev, i) => {
        const fit = scoreForSeason(ev, state, inputs);
        if (!bestFit || fit.score > bestFit.score) { best = i; bestFit = fit; }
      });
      const [ev] = pool.splice(best, 1);
      const boosts = bestFit.reasons.filter((r) => r.kind === 'boost').map((r) => r.text);
      items.push(itemFor(slot, {
        kind: 'event', event: eventCard(ev),
        why: boosts.length ? `Undated; ${boosts[0]}` : 'Undated; the best fit left for this slot',
      }));
      remember(slot, ev);
    }
    for (const ev of pool) leftOver.push({ kind: 'event', episode: null, event: eventCard(ev) });
  }

  return {
    season_number: roadmap.season_number,
    items,
    open_slots: open.map((s) => ({ id: s.id, slot_number: s.slot_number, label: s.label, phase: s.phase })),
    left_over: leftOver,
  };
}

/**
 * Save: applies Evoni's list in one transaction. Each item is
 * { slot_id, episode_id } or { slot_id, event_id }. Episodes are placed
 * first (placeEpisode's rules: the slot locks to it and takes its event),
 * then events are pencilled (pencilEvent's rules). Any refusal undoes all.
 */
async function applyPlacement(sequelize, showId, items) {
  if (!Array.isArray(items) || !items.length) throw new SeasonSetupError('There is nothing to place.');
  const slotsSeen = new Set();
  const thingsSeen = new Set();
  for (const it of items) {
    if (!it || !it.slot_id || (!it.episode_id === !it.event_id)) {
      throw new SeasonSetupError('Each placement is a slot with one episode or one event.');
    }
    if (slotsSeen.has(it.slot_id)) throw new SeasonSetupError('Two placements are in the same slot; move one first.');
    const thing = it.episode_id ? `ep:${it.episode_id}` : `ev:${it.event_id}`;
    if (thingsSeen.has(thing)) throw new SeasonSetupError('The same episode or event is placed twice.');
    slotsSeen.add(it.slot_id);
    thingsSeen.add(thing);
  }
  return sequelize.transaction(async (transaction) => {
    const [[arc]] = await sequelize.query(
      `SELECT id FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
        ORDER BY arc_number ASC LIMIT 1`,
      { replacements: { showId }, transaction });
    if (!arc) throw new SeasonSetupError('Set up the season first.', 409, 'SEASON_NOT_FOUND');
    const [slotRows] = await sequelize.query(
      'SELECT id, slot_number, event_id FROM season_slots WHERE id IN (:ids) AND arc_id = :arcId AND deleted_at IS NULL',
      { replacements: { ids: [...slotsSeen], arcId: arc.id }, transaction });
    const byId = new Map(slotRows.map((r) => [String(r.id), r]));
    for (const it of items) {
      const row = byId.get(String(it.slot_id));
      if (!row) throw new SeasonSetupError('A slot in the list is not in this season.', 404, 'SEASON_SLOT_NOT_FOUND');
      // The preview only offers empty slots; one filled since is not overwritten.
      if (it.event_id && row.event_id && String(row.event_id) !== String(it.event_id)) {
        throw new SeasonSetupError(`E${row.slot_number} has had an event pencilled since the preview; open the preview again.`, 409, 'SEASON_SLOT_CHANGED');
      }
    }
    let episodes = 0;
    let events = 0;
    for (const it of items.filter((x) => x.episode_id)) {
      await placeEpisodeIn(sequelize, showId, it.slot_id, it.episode_id, transaction);
      episodes += 1;
    }
    for (const it of items.filter((x) => x.event_id)) {
      await pencilEventIn(sequelize, showId, it.slot_id, it.event_id, transaction);
      events += 1;
    }
    return { placed: episodes + events, episodes, events };
  });
}

// ─── Draft the season, or one part ───────────────────────────────────────

function draftPrompt({ arc, phases, slots, targets, threads, goals, debt, carried, relationships = '', partNumber }) {
  const partLine = (p) => phaseLine(p, { word: 'Part', range: true });
  const slotLine = (s) => {
    const what = s.episode
      ? `episode "${s.episode.title || 'untitled'}"${s.state === 'done' ? ' (made and accepted)' : ' (in production)'}`
      : s.event ? 'event pencilled in' : 'open';
    const ev = s.event_detail;
    const evText = ev ? `; event "${ev.name}"${ev.event_type ? ` (${ev.event_type})` : ''}${eventDay(ev.event_date) ? ` on ${eventDay(ev.event_date)}` : ''}` : '';
    const purpose = s.intention?.story_purpose ? `; purpose: ${s.intention.story_purpose}` : '';
    const mark = targets.has(s.slot_number) ? ' [DRAFT THIS]' : '';
    return `- E${s.slot_number} (Part ${s.phase}): ${what}${evText}${purpose}${mark}`;
  };
  const threadText = bullets(threads, (t) => threadLine(t, { description: true }), '- None yet.');
  const goalText = bullets(goals, (g) => goalLine(g, { status: true, range: true }), '- None set.');
  const debtText = debtLines(debt);
  return `You plan the season of "Styling Adventures with Lala", a luxury life-simulator show about Lala's fashion career.

The season: "${arc.title}"${arc.tagline ? ` — ${arc.tagline}` : ''}
Its three parts:
${phases.map(partLine).join('\n')}

Every episode slot, in order:
${slots.map(slotLine).join('\n')}

Open story threads (use only these [ids]):
${threadText}

Lala's career goals:
${goalText}

Narrative debt she carries:
${debtText}
${carried ? `\n${carried}\n` : ''}${relationships ? `\n${relationships}` : ''}
Draft ${partNumber ? `the open slots of Part ${partNumber}` : 'every open slot of the season'} marked [DRAFT THIS]. Build each part toward its name and tagline; let a slot with an event grow from that event; respect the slots already made or planned.
Return JSON only:
{
  "slots": [
    { "slot_number": 5, "story_purpose": "One sentence: what this episode is for in Lala's story (max 200 chars).", "desired_pressure": "Low|Medium|High|Peak", "story_thread_id": "an id above, or null" }
  ]
}
One entry for each slot marked [DRAFT THIS], no others. Vary the pressure across the season; follow a hard episode with room to recover; build to Peak near each part's end; do not repeat a purpose.`;
}

/**
 * The drafts that can be shown: one per target slot, with a purpose; the
 * pressure one of Low · Medium · High · Peak (else none); a thread only when
 * it is one of the show's open threads (an invented id is dropped).
 */
function cleanSeasonDraft(parsed, { targets, threads }) {
  const threadById = new Map(threads.map((t) => [String(t.id), t]));
  const seen = new Set();
  const drafts = [];
  let droppedThreads = 0;
  const list = Array.isArray(parsed?.slots) ? parsed.slots : [];
  for (const d of list) {
    const n = Number(d?.slot_number);
    const slot = targets.get(n);
    if (!slot || seen.has(n)) continue;
    const purpose = text(d.story_purpose, 300);
    if (!purpose) continue;
    seen.add(n);
    const pressure = PRESSURE_LEVELS.find((p) => p.toLowerCase() === String(d.desired_pressure || '').trim().toLowerCase()) || null;
    let threadId = d.story_thread_id ? String(d.story_thread_id) : null;
    if (threadId && !threadById.has(threadId)) { threadId = null; droppedThreads += 1; }
    drafts.push({
      slot_id: slot.id,
      slot_number: n,
      label: slot.label,
      phase: slot.phase,
      story_purpose: purpose,
      desired_pressure: pressure,
      story_thread_id: threadId,
      story_thread_title: threadId ? threadById.get(threadId).title : null,
      current_purpose: slot.intention?.story_purpose || null,
    });
  }
  drafts.sort((a, b) => a.slot_number - b.slot_number);
  return { drafts, dropped_threads: droppedThreads };
}

/**
 * One AI call drafts the open slots of the season, or of one part (phase
 * 1-3). Nothing is saved. Returns { drafts, skipped, dropped_threads }:
 * skipped names the slots in scope that were not offered (edited or
 * started).
 */
async function draftSeason(sequelize, showId, { phase = null, anthropic = null } = {}) {
  const partNumber = phase == null || phase === '' ? null : Number(phase);
  if (partNumber != null && !(Number.isInteger(partNumber) && partNumber >= 1 && partNumber <= PART_COUNT)) {
    throw new SeasonSetupError(`The part is 1 to ${PART_COUNT}.`);
  }
  // One read of the season: its arc (title, phases, debt) and the roadmap built from it.
  const season = await loadSeason(sequelize, showId);
  const roadmap = await roadmapOf(sequelize, season);
  if (!roadmap) throw new SeasonSetupError('Set up the season first.', 409, 'SEASON_NOT_FOUND');
  const { arc } = season;
  const phases = arcPhases(arc);
  const slots = roadmap.phases.flatMap((p) => p.slots);
  const inScope = slots.filter((s) => partNumber == null || Number(s.phase) === partNumber);
  // draftNextSlot's rule: no episode, not locked, not edited by Evoni.
  const offered = (s) => !s.episode && !s.locked && s.intention?.source !== 'edited';
  const targets = new Map(inScope.filter(offered).map((s) => [s.slot_number, s]));
  const skipped = inScope.filter((s) => !offered(s))
    .map((s) => ({ slot_number: s.slot_number, label: s.label, reason: s.episode || s.locked ? 'started' : 'edited' }));
  if (!targets.size) {
    throw new SeasonSetupError(
      `Every slot ${partNumber ? `in Part ${partNumber} ` : ''}is edited by you or has started; there is nothing to draft.`, 409, 'SEASON_NOTHING_TO_DRAFT');
  }

  const [details] = await sequelize.query(
    `SELECT s.slot_number, ev.name, ev.event_type, ev.event_date
       FROM season_slots s
       JOIN world_events ev ON ev.id = COALESCE(s.event_id, ${episodeEventIdSql('s.episode_id')}) AND ev.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL`,
    { replacements: { arcId: roadmap.arc.id } });
  const detailBySlot = new Map(details.map((d) => [d.slot_number, d]));
  const withDetail = slots.map((s) => ({ ...s, event_detail: detailBySlot.get(s.slot_number) || null }));

  // The last approved What changed record, what Lala still owes people, and
  // the confirmed relationships between the season's people (never a seed).
  const { threads, carried, relationships } = await seasonAiContext(sequelize, showId, {
    threads: { limit: 40, order: 'asc' }, carried: true, relationships: true,
  });
  const goals = await activeGoals(sequelize, showId);
  const debt = parseJson(arc?.narrative_debt, []);
  const prompt = draftPrompt({
    arc, phases, slots: withDetail, targets, threads, goals, debt: Array.isArray(debt) ? debt : [], carried, relationships, partNumber,
  });
  let message;
  try {
    message = await askModel({ api: anthropic || getClient(), models: MODELS, maxTokens: MAX_TOKENS, prompt, label: 'seasonSetup season draft' });
  } catch (err) {
    console.error('[seasonSetup] the season draft failed:', err.message);
    // A budget refusal is final: retrying would be refused the same way.
    if (isBudgetRefusal(err)) throw new SeasonSetupError(`${err.message} Nothing was drafted.`, 429, 'AI_BUDGET_EXCEEDED');
    throw new SeasonSetupError('The AI could not draft the season right now. Try again.', 502, 'SEASON_DRAFT_FAILED');
  }
  let parsed;
  try {
    const raw = String(message?.content?.[0]?.text || '').trim();
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[seasonSetup] the season draft could not be read:', err.message);
    throw new SeasonSetupError('The draft came back in a form that could not be read. Try again.', 502, 'SEASON_DRAFT_FAILED');
  }
  const { drafts, dropped_threads: droppedThreads } = cleanSeasonDraft(parsed, { targets, threads });
  if (!drafts.length) throw new SeasonSetupError('The AI drafted nothing that fits these slots. Try again.', 502, 'SEASON_DRAFT_FAILED');
  return { drafts, skipped, dropped_threads: droppedThreads, phase: partNumber };
}

module.exports = {
  MODELS,
  DEFAULT_SPLIT,
  PART_DEFAULTS,
  SEASON_ONE,
  SeasonSetupError,
  defaultSetup,
  normaliseSplit,
  normaliseSetup,
  normalisePageFields,
  pictureUrl,
  seasonDay,
  savedDay,
  SEASON_PAGE_FIELDS,
  rangesOf,
  partOf,
  buildPhases,
  nextNumbers,
  updateSetup,
  eventDay,
  previewPlacement,
  applyPlacement,
  availableEvents,
  rankEventsForSlot,
  draftPrompt,
  cleanSeasonDraft,
  draftSeason,
};
