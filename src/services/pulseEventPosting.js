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
 *     picking the same people. Lurkers never post; they may comment.
 *     → { posters, commenters, order, about, eventId }
 *   enqueueForEpisode(db, { showId, episodeId })
 *     queues one `event` job per poster, at the episode's After; once per
 *     episode; only while PULSE_ENGINE_ENABLED is on. Never calls AI.
 *   registerHandlers()
 *     event   → pulseDrafter.draftAndRoute, then queues `comment` jobs for
 *               the commenters on the new post
 *     comment → pulseDrafter.draftCommentAndRoute
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
};
const TEMPERAMENT = { oversharer: 1, regular: 0.6, lurker: 0.2 };

/** A stable 0–1 number for a seed: the same episode and character always get the same jitter. */
function seeded(seed) {
  return parseInt(crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) / 0xffffffff;
}

/** The score: attending 0.5, closeness 0.3, temperament 0.2, plus a seeded jitter. */
function scoreOf({ attended, closeness = 0, temperament = 'regular', seed }) {
  const base = (attended ? 0.5 : 0) + 0.3 * closeness + 0.2 * (TEMPERAMENT[temperament] ?? TEMPERAMENT.regular);
  return Math.round((base + JITTER * seeded(seed)) * 1000) / 1000;
}

/** Splits scored candidates into posters and commenters (lurkers never post). */
function pick(scored) {
  const sorted = [...scored].sort((a, b) => b.score - a.score || String(a.characterId).localeCompare(String(b.characterId)));
  const posters = sorted.filter((c) => c.temperament !== 'lurker' && c.score >= POST_LINE).slice(0, MAX_POSTERS);
  const posting = new Set(posters.map((c) => c.characterId));
  const commenters = sorted.filter((c) => !posting.has(c.characterId) && c.score >= COMMENT_LINE).slice(0, MAX_COMMENTERS);
  return { posters, commenters };
}

const parse = (v) => {
  if (typeof v !== 'string') return v ?? null;
  try { return JSON.parse(v); } catch (err) { console.error('[PulseEventPosting] bad JSON:', err.message); return null; }
};
const guestIds = (list) => (Array.isArray(list) ? list : [])
  .map((g) => Number(typeof g === 'object' && g ? (g.profile_id ?? g.social_profile_id ?? g.id) : g))
  .filter(Number.isInteger);

async function whoPosts(db, { showId, episodeId }) {
  const { sequelize } = db;
  const [[episode]] = await sequelize.query(
    'SELECT id, title, episode_number FROM episodes WHERE id = :episodeId AND show_id = :showId',
    { replacements: { episodeId, showId } });
  if (!episode) return { posters: [], commenters: [], order: null, about: null, eventId: null };
  // The episode's one event, by the rule every service shares (utils/episodeEventSql; Task #1917).
  const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
  const [events] = await sequelize.query(
    `SELECT id, name, canon_consequences FROM world_events
      WHERE id = ${EPISODE_EVENT_ID_SQL} AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { showId, episodeId } });
  const guests = new Set(events.flatMap((ev) => guestIds(parse(ev.canon_consequences)?.automation?.guest_profiles)));
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(sequelize);
  const closeness = new Map();
  if (lalaId) {
    const [rels] = await sequelize.query(
      `SELECT source_profile_id, target_profile_id, relationship_type::text AS type FROM social_profile_relationships
        WHERE source_profile_id = :lala OR target_profile_id = :lala`, { replacements: { lala: lalaId } });
    for (const r of rels) {
      const other = Number(r.source_profile_id) === Number(lalaId) ? Number(r.target_profile_id) : Number(r.source_profile_id);
      closeness.set(other, Math.max(closeness.get(other) || 0, CLOSENESS[r.type] ?? 0.3));
    }
  }
  // Who Lala has met by the episode's After, not by now: its guests meet her during it.
  const order = require('./storyClock').orderOf(episode.episode_number ?? 0, 'after_episode');
  // Closeness moves with interactions (Task #2983): each pair's accepted changes by then.
  if (lalaId) {
    const { ledgerDeltas, clamp } = require('./pulseCloseness');
    for (const [other, delta] of await ledgerDeltas(db, showId, lalaId, order)) closeness.set(other, clamp((closeness.get(other) || 0) + delta));
  }
  // Event reactions are for Alive characters (Evoni, 2026-10-12).
  const candidates = (await require('./pulseVoices').eligible(db, showId, { at: order, stage: 'alive' })).filter((c) => c.voice);
  const scored = candidates.map(({ character, profile, voice }) => {
    const profileId = Number(profile.id);
    const isLala = lalaId && profileId === Number(lalaId);
    const temperament = voice.habits_json?.temperament || 'regular';
    const attended = isLala || guests.has(profileId);
    const close = isLala ? 1 : closeness.get(profileId) || 0;
    return {
      characterId: character.id, profileId, handle: profile.handle, attended, closeness: close, temperament,
      score: scoreOf({ attended, closeness: close, temperament, seed: `${episodeId}:${character.id}` }),
    };
  });
  const { posters, commenters } = pick(scored);
  const event = events[0] || null;
  return {
    posters, commenters,
    order,
    about: event ? `${event.name}, which just happened` : `what just happened (${episode.title || 'the latest episode'})`,
    eventId: event ? event.id : null,
  };
}

/** Queues the episode's event posts once; never calls AI. Returns the jobs queued ([] when off or done before). */
async function enqueueForEpisode(db, { showId, episodeId }) {
  if (process.env.PULSE_ENGINE_ENABLED !== 'true') return [];
  const [[done]] = await db.sequelize.query(
    `SELECT COUNT(*)::int AS n FROM pulse_jobs
      WHERE show_id = :showId AND kind = 'event' AND payload_json->>'episode_id' = :episodeId AND deleted_at IS NULL`,
    { replacements: { showId, episodeId: String(episodeId) } });
  if (done.n > 0) return [];
  const plan = await whoPosts(db, { showId, episodeId });
  const queue = require('./pulseQueue');
  const jobs = [];
  for (const poster of plan.posters) {
    jobs.push(await queue.enqueue(db, {
      showId, kind: 'event',
      payload: {
        episode_id: String(episodeId), event_id: plan.eventId, character_id: poster.characterId, moment: plan.order,
        about: plan.about, score: poster.score, commenters: plan.commenters.map((c) => c.characterId),
      },
    }));
  }
  return jobs;
}

/** The queue handlers for event posts and their comments. */
async function handleEvent(db, job) {
  const p = job.payload_json || {};
  const { post } = await require('./pulseDrafter').draftAndRoute(db, {
    showId: job.show_id, characterId: p.character_id, moment: p.moment,
    context: { about: p.about, episode_id: p.episode_id || null, event_id: p.event_id || null },
  });
  const queue = require('./pulseQueue');
  for (const characterId of Array.isArray(p.commenters) ? p.commenters : []) {
    if (characterId === p.character_id) continue;
    await queue.enqueue(db, { showId: job.show_id, kind: 'comment', payload: { post_id: post.id, character_id: characterId, episode_id: p.episode_id || null } });
  }
  return { draftIds: [post.id] };
}

async function handleComment(db, job) {
  const p = job.payload_json || {};
  const { comment } = await require('./pulseDrafter').draftCommentAndRoute(db, { postId: p.post_id, characterId: p.character_id });
  return { draftIds: [comment.id] };
}

function registerHandlers() {
  const queue = require('./pulseQueue');
  queue.register('event', handleEvent);
  queue.register('comment', handleComment);
}

module.exports = {
  CLOSENESS, TEMPERAMENT, MAX_POSTERS, MAX_COMMENTERS, POST_LINE, COMMENT_LINE,
  seeded, scoreOf, pick, whoPosts, enqueueForEpisode, handleEvent, handleComment, registerHandlers,
};
