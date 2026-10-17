'use strict';

/**
 * Event-triggered posting (Task #2970; The Pulse spec §7 "when an event or
 * scene happens, the engine decides who would post (attended, closeness to
 * Lala, temperament: oversharer vs lurker) and drafts posts and comment
 * threads"; docs/reads/2026-10-12-pulse-posting-read.md §6: an event
 * happens when its episode is completed).
 *
 *   whoPosts(db, { showId, episodeId })
 *     candidates: the show's posting characters with a Voice Profile, not
 *     hidden from Lala at the episode's After (pulseVoices.eligible); each scored from attending (the episode's
 *     event guests, and Lala), closeness to Lala (her relationships in
 *     social_profile_relationships, moved by the closeness ledger,
 *     pulseCloseness, Task #2983) and temperament (the voice's habit).
 *     A small seeded jitter per episode and character keeps a re-run
 *     picking the same people. Lurkers never post.
 *     → { posters, pool, order, about, eventId }; pool is everyone else
 *   commentersFor(db, { showId, episodeId, posterProfileId, exclude })
 *     who comments on one poster's post (Task #3072; Evoni, 2026-10-13:
 *     reactions shaped by the relationship to the poster, not to Lala):
 *     closeness to the poster (their social_profile_relationships type,
 *     moved by the closeness ledger at the moment), attending and
 *     temperament; the line is checked without the jitter, so who comments
 *     is stable and the jitter only orders them.
 *   enqueueForEpisode(db, { showId, episodeId, manual })
 *     queues one `event` job for the posters (BATCH_MAX a job), at the
 *     episode's After; once per episode (a job skipped by the cap does not
 *     count, Task #3049); at completion only while PULSE_ENGINE_ENABLED is
 *     on, from Admin › Engine (manual) whatever the switch. Never calls AI.
 *   episodesWithoutPosts(db, showId)
 *     completed episodes with no event posts queued, for Admin › Engine.
 *   episodesWithDraftEvents(db, showId)   (Character Consistency Engine
 *     step 6b; Evoni, 2026-10-16: "button per episode")
 *     episodes not completed yet whose event is attached, with no event
 *     posts queued: their posts can be drafted now (enqueueForEpisode with
 *     early), so they exist before the script. An early job's drafts always
 *     wait in Review ('event_draft'), whatever the gate says: the event is
 *     not live until its episode is completed. Completion does not queue them
 *     again (one event job per episode).
 *   registerHandlers()
 *     event   → pulseDrafter.draftPostsAndRoute: one request drafts every
 *               poster's post (Task #3032), each gated on its own; then one
 *               `comment` job per new post for its poster's commenters
 *               (commentersFor; the episode's posters never comment; a
 *               job queued before #3072 keeps its commenters list)
 *     comment → pulseDrafter.draftCommentsAndRoute: one request drafts the
 *               post's replies
 *   A job queued before #3032 names one character (character_id) and runs
 *   as a batch of one.
 */

const crypto = require('crypto');

const MAX_POSTERS = 4;
const MAX_COMMENTERS = 3;
const POST_LINE = 0.55;        // a score this high posts (attended, or close and outgoing)
const COMMENT_LINE = 0.3;      // a score this high comments
const JITTER = 0.1;

// How close each kind of relationship to Lala makes a character to her story (0–1).
const CLOSENESS = {
  bestie: 1, couple: 1, family: 0.9, situationship: 0.8, feud: 0.8, collab: 0.7, rival: 0.7,
  baby_daddy: 0.7, baby_mama: 0.7, mentor: 0.6, management: 0.6, ex: 0.6, shade: 0.6, copycat: 0.4, secret_link: 0.3,
  // From the Relationship Map (Evoni, 2026-10-13, Task #3115).
  former_friends: 0.4, orbit: 0.2,
};
const TEMPERAMENT = { oversharer: 1, regular: 0.6, lurker: 0.2 };

/** A stable 0–1 number for a seed: the same episode and character always get the same jitter. */
function seeded(seed) {
  return parseInt(crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) / 0xffffffff;
}

/** The posting score: attending 0.5, closeness to Lala 0.3, temperament 0.2, plus a seeded jitter. */
function scoreOf({ attended, closeness = 0, temperament = 'regular', seed }) {
  const base = (attended ? 0.5 : 0) + 0.3 * closeness + 0.2 * (TEMPERAMENT[temperament] ?? TEMPERAMENT.regular);
  return Math.round((base + JITTER * seeded(seed)) * 1000) / 1000;
}

// Shared audiences (Evoni's idea 4, 2026-10-17): a bonus on top, so a
// character with no content type scores as before.
const AUDIENCE_WEIGHT = 0.15;

/**
 * The commenting score on one poster's post (Task #3072), without jitter:
 * closeness to the poster 0.5, attending 0.3, temperament 0.2, plus up to
 * AUDIENCE_WEIGHT when their content types share an audience (or compete,
 * or are the same; services/audienceMap). A guest who barely knows the
 * poster still comments; a stranger who stayed home does not, unless an
 * oversharer whose audience overlaps the poster's.
 */
function commentScoreOf({ attended, closeness = 0, temperament = 'regular', audience = 0 }) {
  const base = (attended ? 0.3 : 0) + 0.5 * closeness + 0.2 * (TEMPERAMENT[temperament] ?? TEMPERAMENT.regular)
    + AUDIENCE_WEIGHT * audience;
  return Math.round(base * 1000) / 1000;
}

/** Splits scored candidates into posters and commenters (lurkers never post). */
function pick(scored) {
  const sorted = [...scored].sort((a, b) => b.score - a.score || String(a.characterId).localeCompare(String(b.characterId)));
  const posters = sorted.filter((c) => c.temperament !== 'lurker' && c.score >= POST_LINE).slice(0, MAX_POSTERS);
  const posting = new Set(posters.map((c) => c.characterId));
  const commenters = sorted.filter((c) => !posting.has(c.characterId) && c.score >= COMMENT_LINE).slice(0, MAX_COMMENTERS);
  return { posters, commenters };
}


/**
 * Map(other profile → closeness to `profileId`) at `order`: each pair's
 * closest relationship type in social_profile_relationships, moved by its
 * accepted closeness-ledger changes (pulseCloseness, Task #2983).
 */
async function closenessTo(db, showId, profileId, order) {
  const closeness = new Map();
  if (!profileId) return closeness;
  const [rels] = await db.sequelize.query(
    `SELECT source_profile_id, target_profile_id, relationship_type::text AS type FROM social_profile_relationships
      WHERE source_profile_id = :id OR target_profile_id = :id`, { replacements: { id: profileId } });
  for (const r of rels) {
    const other = Number(r.source_profile_id) === Number(profileId) ? Number(r.target_profile_id) : Number(r.source_profile_id);
    closeness.set(other, Math.max(closeness.get(other) || 0, CLOSENESS[r.type] ?? 0.3));
  }
  const { ledgerDeltas, clamp } = require('./pulseCloseness');
  for (const [other, delta] of await ledgerDeltas(db, showId, profileId, order)) closeness.set(other, clamp((closeness.get(other) || 0) + delta));
  return closeness;
}

/** The episode, its event, its guests, Lala, the moment, and who could react (Alive, approved voices); null with no episode. */
async function reactorsOf(db, { showId, episodeId }) {
  const { sequelize } = db;
  const [[episode]] = await sequelize.query(
    'SELECT id, title, episode_number FROM episodes WHERE id = :episodeId AND show_id = :showId',
    { replacements: { episodeId, showId } });
  if (!episode) return null;
  // The episode's one event, by the rule every service shares (utils/episodeEventSql; Task #1917).
  const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
  const [events] = await sequelize.query(
    `SELECT id, name, canon_consequences, source_profile_id FROM world_events
      WHERE id = ${EPISODE_EVENT_ID_SQL} AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { showId, episodeId } });
  // Its attendees: the host and the Event Package's Guests (utils/eventAttendees, Task #3082).
  const { eventAttendees } = require('../utils/eventAttendees');
  const guests = new Set(events.flatMap((ev) => [...eventAttendees(ev)]));
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(sequelize);
  // Who Lala has met by the episode's After, not by now: its guests meet her during it.
  const order = require('./storyClock').orderOf(episode.episode_number ?? 0, 'after_episode');
  // Event reactions are for Alive characters (Evoni, 2026-10-12), and only
  // approved voices post on their own (Task #3029). They reply to Lala, so
  // only those she has met: a public figure she only knows of waits (Evoni, 2026-10-16).
  const { eligible, isApproved } = require('./pulseVoices');
  const candidates = (await eligible(db, showId, { at: order, stage: 'alive', met: true })).filter((c) => isApproved(c.voice))
    .map(({ character, profile, voice }) => {
      const profileId = Number(profile.id);
      const isLala = Boolean(lalaId) && profileId === Number(lalaId);
      return {
        characterId: character.id, profileId, handle: profile.handle, isLala,
        attended: isLala || guests.has(profileId), temperament: voice.habits_json?.temperament || 'regular',
      };
    });
  return { episode, event: events[0] || null, lalaId, order, candidates };
}

async function whoPosts(db, { showId, episodeId }) {
  const r = await reactorsOf(db, { showId, episodeId });
  if (!r) return { posters: [], pool: [], order: null, about: null, eventId: null };
  // Closeness moves with interactions (Task #2983): each pair's accepted changes by then.
  const toLala = await closenessTo(db, showId, r.lalaId, r.order);
  const scored = r.candidates.map(({ isLala, ...c }) => {
    const close = isLala ? 1 : toLala.get(c.profileId) || 0;
    return { ...c, closeness: close, score: scoreOf({ attended: c.attended, closeness: close, temperament: c.temperament, seed: `${episodeId}:${c.characterId}` }) };
  });
  const { posters } = pick(scored);
  const posting = new Set(posters.map((c) => c.characterId));
  const { event, episode, order } = r;
  return {
    posters,
    pool: scored.filter((c) => !posting.has(c.characterId)),
    order,
    about: event ? `${event.name}, which just happened` : `what just happened (${episode.title || 'the latest episode'})`,
    eventId: event ? event.id : null,
  };
}

/**
 * Who comments on one poster's post (Task #3072): up to MAX_COMMENTERS of
 * the episode's reactors, not the poster and not in `exclude`, whose
 * commenting score reaches COMMENT_LINE, closest first.
 */
async function commentersFor(db, { showId, episodeId, posterProfileId, exclude = [] }) {
  const r = await reactorsOf(db, { showId, episodeId });
  if (!r) return [];
  const toPoster = await closenessTo(db, showId, posterProfileId, r.order);
  const skip = new Set(exclude);
  const pool = r.candidates.filter((c) => c.profileId !== Number(posterProfileId) && !skip.has(c.characterId));
  // How their content types relate to the poster's (never Lala's: decision c).
  const audience = await require('./audienceMap').audienceScores(db, posterProfileId, pool.map((c) => c.profileId));
  return pool
    .map((c) => {
      const closeness = toPoster.get(c.profileId) || 0;
      const shared = audience.get(c.profileId) || 0;
      const score = commentScoreOf({ attended: c.attended, closeness, temperament: c.temperament, audience: shared });
      return { characterId: c.characterId, profileId: c.profileId, handle: c.handle, closeness, audience: shared, score, rank: score + JITTER * seeded(`${episodeId}:${posterProfileId}:${c.characterId}`) };
    })
    .filter((c) => c.score >= COMMENT_LINE)
    .sort((a, b) => b.rank - a.rank || String(a.characterId).localeCompare(String(b.characterId)))
    .slice(0, MAX_COMMENTERS);
}

// An episode's event jobs that count as queued: any, except one skipped
// because the automated lane was used up (Task #3049), which can be queued again.
const EVENT_JOBS_SQL = () => `SELECT 1 FROM pulse_jobs j
  WHERE j.show_id = e.show_id AND j.kind = 'event' AND j.payload_json->>'episode_id' = e.id::text
    AND j.deleted_at IS NULL AND NOT ${require('./pulseRequests').capSkipSql('j')}`;

/**
 * Queues the episode's event posts once; never calls AI. Returns the jobs
 * queued ([] when queued before, or no one would post). At completion it
 * queues only while PULSE_ENGINE_ENABLED is on; `manual` (Admin › Engine,
 * Task #3049) queues whatever the switch, and the jobs wait for the worker.
 */
async function enqueueForEpisode(db, { showId, episodeId, manual = false, early = false }) {
  if (!manual && process.env.PULSE_ENGINE_ENABLED !== 'true') return [];
  // Event posts switched off in Admin › Engine (2026-10-17): none queued at
  // completion; the episode shows under Episodes without posts to queue by hand.
  if (!manual && !(await require('./pulseQueue').kindEnabled(db, showId, 'event'))) return [];
  const [[done]] = await db.sequelize.query(
    `SELECT COUNT(*)::int AS n FROM episodes e WHERE e.id::text = :episodeId AND e.show_id = :showId AND EXISTS (${EVENT_JOBS_SQL()})`,
    { replacements: { showId, episodeId: String(episodeId) } });
  if (done.n > 0) return [];
  const plan = await whoPosts(db, { showId, episodeId });
  const queue = require('./pulseQueue');
  const { BATCH_MAX } = require('./pulseDrafter');
  const jobs = [];
  for (let i = 0; i < plan.posters.length; i += BATCH_MAX) {
    const batch = plan.posters.slice(i, i + BATCH_MAX);
    jobs.push(await queue.enqueue(db, {
      showId, kind: 'event',
      payload: {
        episode_id: String(episodeId), event_id: plan.eventId, posters: batch.map((x) => x.characterId), moment: plan.order,
        about: plan.about, scores: batch.map((x) => x.score), posters_all: plan.posters.map((x) => x.characterId),
        ...(early ? { early: true } : {}),
        // Queued by Evoni from Engine: runs even while event posts are switched off.
        ...(manual ? { manual: true } : {}),
      },
    }));
  }
  return jobs;
}

/**
 * The show's completed episodes (evaluation accepted) with no event posts
 * queued, newest first: completed while the engine was off, or skipped by
 * the cap before Task #3049. For Admin › Engine.
 */
async function episodesWithoutPosts(db, showId, { limit = 10 } = {}) {
  const [rows] = await db.sequelize.query(
    `SELECT e.id, e.episode_number, e.title FROM episodes e
      WHERE e.show_id = :showId AND e.evaluation_status = 'accepted' AND e.deleted_at IS NULL
        AND NOT EXISTS (${EVENT_JOBS_SQL()})
      ORDER BY e.episode_number DESC NULLS LAST, e.updated_at DESC LIMIT :limit`,
    { replacements: { showId, limit } });
  return rows.map((r) => ({ id: r.id, episode_number: r.episode_number, title: r.title || null }));
}

/**
 * Episodes not completed yet (evaluation not accepted) that have an event
 * attached (utils/episodeEventSql) and no event posts queued, newest first,
 * each with its event's name: their posts can be drafted before the script
 * (step 6b). For Admin › Engine.
 */
async function episodesWithDraftEvents(db, showId, { limit = 10 } = {}) {
  const { episodeEventIdSql } = require('../utils/episodeEventSql');
  const [rows] = await db.sequelize.query(
    `SELECT e.id, e.episode_number, e.title, we.name AS event_name, we.id AS event_id,
            we.venue_name, we.event_date, we.event_time, ss.base_still_url AS image_url FROM episodes e
       JOIN world_events we ON we.id = ${episodeEventIdSql('e.id')} AND we.deleted_at IS NULL
       LEFT JOIN scene_sets ss ON ss.id = we.scene_set_id AND ss.deleted_at IS NULL
      WHERE e.show_id = :showId AND e.deleted_at IS NULL AND e.evaluation_status IS DISTINCT FROM 'accepted'
        AND NOT EXISTS (${EVENT_JOBS_SQL()})
      ORDER BY e.episode_number ASC NULLS LAST, e.updated_at DESC LIMIT :limit`,
    { replacements: { showId, limit } });
  return rows.map((r) => ({
    id: r.id, episode_number: r.episode_number, title: r.title || null, event_id: r.event_id, event_name: r.event_name || null,
    // For the card (Evoni's Engine mock, 2026-10-17): where, when, and the venue's picture.
    venue_name: r.venue_name || null, event_date: r.event_date || null, event_time: r.event_time || null, image_url: r.image_url || null,
  }));
}

/** The characters a job names: a batch (Task #3032), or the one a job queued before it named. */
const namedIn = (list, single) => (Array.isArray(list) ? list : (single ? [single] : []));

/** Splits characters into those whose voice is approved and the reasons for the rest (Task #3029). */
async function approvedOf(db, characterIds) {
  const ready = [];
  const waiting = [];
  for (const id of characterIds) {
    const blocked = await require('./pulseVoices').automationBlocker(db, id);
    if (blocked) waiting.push(blocked); else ready.push(id);
  }
  return { ready, waiting };
}

/** The queue handlers for event posts and their comments. */
async function handleEvent(db, job) {
  const p = job.payload_json || {};
  const { ready, waiting } = await approvedOf(db, namedIn(p.posters, p.character_id));
  if (!ready.length) return { skipped: waiting.join(' ') || 'No posters named.' };
  const drafter = require('./pulseDrafter');
  const { routed, failed } = await drafter.draftPostsAndRoute(db, {
    showId: job.show_id, items: ready.map((characterId) => ({ characterId })), moment: p.moment,
    context: { about: p.about, episode_id: p.episode_id || null, event_id: p.event_id || null },
    request: { kind: 'event', jobId: job.id },
    // Drafted before its episode is completed (step 6b): the event is not live yet, so every draft waits.
    alwaysReview: p.early ? ['event_draft'] : [],
  });
  // One comment job per new post: its poster's commenters' replies in one
  // request (Task #3072); the episode's posters never comment. A job queued
  // before #3072 (no posters_all) keeps the commenters it was queued with.
  const queue = require('./pulseQueue');
  const relational = Array.isArray(p.posters_all) && p.episode_id;
  // Comment posts switched off in Admin › Engine (2026-10-17): no replies queued.
  const commenting = await queue.kindEnabled(db, job.show_id, 'comment');
  for (const r of commenting ? routed : []) {
    const picked = relational
      ? (await commentersFor(db, { showId: job.show_id, episodeId: p.episode_id, posterProfileId: r.post.social_profile_id, exclude: p.posters_all }))
        .map((c) => c.characterId)
      : (Array.isArray(p.commenters) ? p.commenters : []).filter((id) => id !== r.characterId);
    const ids = picked.slice(0, drafter.BATCH_MAX);
    if (ids.length) await queue.enqueue(db, { showId: job.show_id, kind: 'comment', payload: { post_id: r.post.id, character_ids: ids, episode_id: p.episode_id || null } });
  }
  return { draftIds: routed.map((r) => r.post.id), failed: [...waiting, ...failed.map((f) => f.error)] };
}

async function handleComment(db, job) {
  const p = job.payload_json || {};
  const { ready, waiting } = await approvedOf(db, namedIn(p.character_ids, p.character_id));
  if (!ready.length) return { skipped: waiting.join(' ') || 'No commenters named.' };
  const { routed, failed } = await require('./pulseDrafter').draftCommentsAndRoute(db, { postId: p.post_id, characterIds: ready, jobId: job.id });
  return { draftIds: routed.map((r) => r.comment.id), failed: [...waiting, ...failed.map((f) => f.error)] };
}

function registerHandlers() {
  const queue = require('./pulseQueue');
  queue.register('event', handleEvent);
  queue.register('comment', handleComment);
}

module.exports = {
  CLOSENESS, TEMPERAMENT, MAX_POSTERS, MAX_COMMENTERS, POST_LINE, COMMENT_LINE,
  seeded, scoreOf, commentScoreOf, AUDIENCE_WEIGHT, pick, closenessTo, whoPosts, commentersFor, enqueueForEpisode, episodesWithoutPosts, episodesWithDraftEvents, handleEvent, handleComment, registerHandlers,
};
