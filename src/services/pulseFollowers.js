'use strict';

/**
 * The follower ledger (Task #2952; The Pulse spec §8; Evoni, 2026-10-12;
 * docs/reads/2026-10-12-pulse-numbers-read.md). Followers are canon per Feed
 * profile and show, and change only through a ledger row with a cause.
 *
 *   estimateStart(profile)       a starting count from follower_count_approx
 *                                ("47k", "1.2M", "3,400"), else the tier's
 *                                middle, else null
 *   proposeStarts(db, showId)    one starting row per LalaVerse profile that
 *                                has none: other characters' accepted at
 *                                once, Lala's left proposed for Evoni
 *   countAt(db, showId, id, at)  the latest accepted count at or before a
 *                                story order (no `at`: the latest), else null
 *   countsAt(db, showId, at)     every profile's count at that moment
 *   decide(db, row, …)           accept, or adjust (to a count, or by a
 *                                change) with a reason; an accepted episode
 *                                change also writes Lala's Decision Log row
 *   override(db, …)              an accepted change with a reason, now
 *   proposeEpisodeChange(db, …)  Lala's change for a completed episode,
 *                                proposed once (Task #2956); from its result
 *                                only since Task #3086 (its posts count
 *                                through their own rows)
 *   proposeFromPost(db, numbers) a published post's change once its numbers
 *                                lock (Task #3086)
 *   proposeFromDeliverable(db, …) Lala's change when an event deliverable is
 *                                approved (Task #3086)
 *
 * Follower causes (Evoni, 2026-10-13, Task #3086): published original posts,
 * fulfilled (approved) event deliverables and accepted episode outcomes
 * propose changes. Drafts, teasers, invitations and merely attending never
 * do. Every proposed change waits in Review with its source, story time,
 * reason and amount, and each source is applied once (a unique index). An
 * accepted change moves followers only, never Influence.
 */

// The middle of each follower tier (social_profiles.follower_tier): a starting count only.
// Kept as is: the stored 4-tier follower_tier stays for generation and scoring; The Pulse shows six audience tiers worked out from the canon count (services/pulseAudience.js; Evoni, 2026-10-12, Task #3033).
// Each lands in its matching count tier (Evoni, 2026-10-13, Task #3068): micro starts at 25,000, the
// middle of Micro (10,000–49,999), not 5,000 (Nano). Only starting counts proposed from then on change;
// accepted counts stay as they are.
const TIER_MIDDLE = { micro: 25000, mid: 50000, macro: 500000, mega: 5000000 };
const MULTIPLIER = { k: 1e3, m: 1e6, b: 1e9 };
const CAUSES = ['start', 'episode', 'post', 'event', 'override'];

/** "47k" → 47000, "1.2M" → 1200000, "~3,400 followers" → 3400; null when unreadable. */
function parseApprox(text) {
  if (typeof text !== 'string') return null;
  const m = /([\d][\d,]*(?:\.\d+)?)\s*([kmb])?/i.exec(text.replace(/\s+/g, ' '));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const value = Math.round(n * (m[2] ? MULTIPLIER[m[2].toLowerCase()] : 1));
  return value > 0 ? value : null;
}

/** { count, from } for a profile's starting count, or null when nothing says. */
function estimateStart(profile) {
  const parsed = parseApprox(profile?.follower_count_approx);
  if (parsed) return { count: parsed, from: `estimate "${profile.follower_count_approx}"` };
  const middle = TIER_MIDDLE[profile?.follower_tier];
  if (middle) return { count: middle, from: `the middle of the ${profile.follower_tier} tier` };
  return null;
}

/** Proposes starting counts; returns { created, waiting } (waiting: rows left for Evoni). */
async function proposeStarts(db, showId, { lalaProfileId = null } = {}) {
  const { sequelize, PulseFollower } = db;
  const [profiles] = await sequelize.query(
    `SELECT sp.id, sp.handle, sp.follower_count_approx, sp.follower_tier::text AS follower_tier
       FROM social_profiles sp
      WHERE sp.deleted_at IS NULL AND sp.feed_layer = 'lalaverse'
        AND COALESCE(sp.is_justawoman_record, false) = false
        AND NOT EXISTS (SELECT 1 FROM pulse_followers pf
                         WHERE pf.show_id = :showId AND pf.social_profile_id = sp.id
                           AND pf.cause = 'start' AND pf.deleted_at IS NULL)
      ORDER BY sp.id`,
    { replacements: { showId } });
  let created = 0;
  let waiting = 0;
  for (const p of profiles) {
    const est = estimateStart(p);
    if (!est) continue;
    const isLala = lalaProfileId ? Number(p.id) === Number(lalaProfileId) : String(p.handle || '').toLowerCase() === 'lala';
    await PulseFollower.create({
      show_id: showId, social_profile_id: p.id, story_order: 0, change: est.count, count_after: est.count,
      cause: 'start', reason: `Proposed from the ${est.from}.`,
      status: isLala ? 'proposed' : 'accepted', decided_by: isLala ? null : 'auto', decided_at: isLala ? null : new Date(),
    });
    created += 1;
    if (isLala) waiting += 1;
  }
  return { created, waiting };
}

const atWhere = (at) => (Number.isInteger(at) ? 'AND story_order <= :at' : '');

/** The profile's accepted count at or before `at` (a story order; none: the latest), else null. */
async function countAt(db, showId, profileId, at) {
  const [[row]] = await db.sequelize.query(
    `SELECT count_after FROM pulse_followers
      WHERE show_id = :showId AND social_profile_id = :profileId AND status = 'accepted' AND deleted_at IS NULL ${atWhere(at)}
      ORDER BY story_order DESC, decided_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    { replacements: { showId, profileId, at: Number.isInteger(at) ? at : null } });
  return row ? Number(row.count_after) : null;
}

/** [{ social_profile_id, count, story_order }] for every profile with an accepted count at `at`. */
async function countsAt(db, showId, at) {
  const [rows] = await db.sequelize.query(
    `SELECT DISTINCT ON (social_profile_id) social_profile_id, count_after AS count, story_order
       FROM pulse_followers
      WHERE show_id = :showId AND status = 'accepted' AND deleted_at IS NULL ${atWhere(at)}
      ORDER BY social_profile_id, story_order DESC, decided_at DESC NULLS LAST, created_at DESC`,
    { replacements: { showId, at: Number.isInteger(at) ? at : null } });
  return rows.map((r) => ({ social_profile_id: Number(r.social_profile_id), count: Number(r.count), story_order: Number(r.story_order) }));
}

class LedgerError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/**
 * Decides a proposed row: accept as proposed, or adjust with a reason, to
 * `adjustTo` (the count after it) or by `adjustBy` (the change). The change
 * is recomputed from the count before it. An episode change needs Lala's
 * accepted count first, and once accepted also writes her
 * character_state_history row (source override, { followers: N }), so the
 * Decision Log shows it (Task #2956; Evoni, 2026-10-12).
 */
async function decide(db, row, { adjustTo = null, adjustBy = null, reason = null, by = null } = {}) {
  if (row.status !== 'proposed') throw new LedgerError(409, 'This change has already been decided.');
  const counted = row.cause === 'start' ? 0 : await countAt(db, row.show_id, row.social_profile_id, row.story_order);
  // Every change but a start needs the starting count first (Task #3086: posts and events too).
  if (counted === null && row.cause !== 'start') throw new LedgerError(409, 'Accept the starting follower count first.');
  const before = counted ?? 0;
  const adjusting = adjustTo !== null || adjustBy !== null;
  if (adjustBy !== null && !Number.isInteger(adjustBy)) throw new LedgerError(400, 'The change must be a whole number.');
  const target = adjustBy !== null ? before + adjustBy : adjustTo;
  if (adjusting) {
    if (!Number.isInteger(target) || target < 0) throw new LedgerError(400, 'The count must be a whole number, 0 or more.');
    if (typeof reason !== 'string' || !reason.trim()) throw new LedgerError(400, 'Say why in one line.');
  }
  const countAfter = adjusting ? target : (row.cause === 'start' ? row.count_after : Math.max(0, before + row.change));
  const why = adjusting ? reason.trim().slice(0, 500) : row.reason;
  await db.sequelize.transaction(async (transaction) => {
    await row.update({
      status: 'accepted', count_after: countAfter, change: countAfter - before, reason: why, decided_by: by, decided_at: new Date(),
    }, { transaction });
    if (row.cause === 'episode') await writeDecisionLog(db, row, { adjusted: adjusting, transaction });
  });
  return row;
}

/** Lala's Decision Log row for an accepted episode change: character_state_history, source override. */
async function writeDecisionLog(db, row, { adjusted, transaction }) {
  const crypto = require('crypto');
  const [[episode]] = await db.sequelize.query(
    `SELECT episode_number, evaluation_json->>'tier_final' AS tier FROM episodes WHERE id = :id`,
    { replacements: { id: row.cause_id }, transaction });
  const sign = row.change > 0 ? '+' : '';
  const notes = `Followers ${sign}${row.change.toLocaleString('en-US')} (Episode ${episode?.episode_number ?? '?'}`
    + `${episode?.tier ? ` ${episode.tier.toUpperCase()}` : ''}) | ${adjusted ? `Adjusted: ${row.reason}` : 'Accepted as proposed'}`;
  await db.sequelize.query(
    `INSERT INTO character_state_history (id, show_id, character_key, episode_id, source, deltas_json, notes, created_at)
     VALUES (:id, :showId, 'lala', :episodeId, 'override', CAST(:deltas AS jsonb), :notes, NOW())`,
    { replacements: { id: crypto.randomUUID(), showId: row.show_id, episodeId: row.cause_id, deltas: JSON.stringify({ followers: row.change }), notes }, transaction });
}

/** An accepted change with a reason, at a story moment (the present by default). */
async function override(db, { showId, profileId, change, reason, at, by = null }) {
  if (!Number.isInteger(change) || change === 0) throw new LedgerError(400, 'The change must be a whole number other than 0.');
  if (typeof reason !== 'string' || !reason.trim()) throw new LedgerError(400, 'Say why in one line.');
  const before = await countAt(db, showId, profileId, at);
  if (before === null) throw new LedgerError(409, 'This character has no accepted starting count yet.');
  const countAfter = before + change;
  if (countAfter < 0) throw new LedgerError(400, 'That would take the count below 0.');
  return db.PulseFollower.create({
    show_id: showId, social_profile_id: profileId, story_order: at, change, count_after: countAfter,
    cause: 'override', reason: reason.trim().slice(0, 500), status: 'accepted', decided_by: by, decided_at: new Date(),
  });
}

// ── The episode follower change (Task #2956) ────────────────────────────────
// Lala's change for a completed episode: a share of her followers at the
// episode's After by its result. Its posts no longer add to it: each post
// proposes its own change (Task #3086), so a like counts once.
const EPISODE_TIER_RATE = { slay: 0.05, pass: 0.025, safe: 0.01, fail: -0.01 };
const POST_LIKES_TO_FOLLOWERS = 0.02;

/**
 * The change from its factors: { change, from_result }. The result's share
 * grows with the score (0.75× at 0, 1.25× at 100); a loss never takes the
 * count below 0.
 */
function episodeChangeFrom({ followers, tier, score }) {
  const base = Number(followers) || 0;
  // `|| 0` turns a rounded -0 (a tiny fail) into 0.
  const fromResult = Math.round(base * (EPISODE_TIER_RATE[tier] ?? 0) * (0.75 + (Number(score) || 0) / 200)) || 0;
  return { change: Math.max(-base, fromResult) || 0, from_result: fromResult };
}

/**
 * Proposes Lala's follower change for a completed episode, once: an
 * existing row for the episode is returned as it is. null when Lala has no
 * Feed profile or the episode has no result.
 */
async function proposeEpisodeChange(db, { showId, episodeId, lalaProfileId } = {}) {
  const { sequelize, PulseFollower } = db;
  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(sequelize);
  if (!lalaId) return null;
  const existing = await PulseFollower.findOne({ where: { show_id: showId, social_profile_id: lalaId, cause: 'episode', cause_id: episodeId } });
  if (existing) return existing;
  const [[episode]] = await sequelize.query(
    `SELECT episode_number, evaluation_json->>'tier_final' AS tier, evaluation_json->>'score' AS score
       FROM episodes WHERE id = :episodeId AND show_id = :showId`, { replacements: { episodeId, showId } });
  if (!episode?.tier) return null;
  const storyOrder = require('./storyClock').orderOf(episode.episode_number ?? 0, 'after_episode');
  const followers = await countAt(db, showId, lalaId, storyOrder);
  const score = episode.score == null ? null : Number(episode.score);
  const factors = { tier: episode.tier, score, followers: followers ?? 0, followers_known: followers !== null };
  const { change, from_result: fromResult } = episodeChangeFrom(factors);
  factors.from_result = fromResult;
  try {
    return await PulseFollower.create({
      show_id: showId, social_profile_id: lalaId, story_order: storyOrder, change,
      count_after: followers === null ? null : followers + change,
      cause: 'episode', cause_id: episodeId,
      reason: `Episode ${episode.episode_number ?? '?'} ${episode.tier.toUpperCase()}: proposed from its result.`,
      factors_json: factors, status: 'proposed',
    });
  } catch (err) {
    // Completed twice at once: the other one made the row.
    if (err.name === 'SequelizeUniqueConstraintError') {
      return PulseFollower.findOne({ where: { show_id: showId, social_profile_id: lalaId, cause: 'episode', cause_id: episodeId } });
    }
    throw err;
  }
}

// ── Posts and event deliverables (Task #3086) ───────────────────────────────
// A post's numbers are "decided" once they lock (auto-accepted or by Evoni).
const DECIDED_NUMBERS = ['accepted', 'adjusted', 'viral', 'flop'];
// Not an authored post: these never move followers.
const NOT_ORIGINAL = ['dm_screenshot', 'notification'];
// An approved deliverable: this share of Lala's followers for each piece.
const DELIVERABLE_RATE = 0.005;
const MAX_PIECES = 5;

/** Creates a proposed row once per (profile, cause, source); an existing one is returned. */
async function proposeOnce(db, fields) {
  const { PulseFollower } = db;
  const where = { show_id: fields.show_id, social_profile_id: fields.social_profile_id, cause: fields.cause, cause_id: fields.cause_id };
  const existing = await PulseFollower.findOne({ where });
  if (existing) return existing;
  try {
    return await PulseFollower.create({ ...fields, status: 'proposed' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return PulseFollower.findOne({ where });
    throw err;
  }
}

/**
 * A published post's follower change, once its numbers lock: its likes ×
 * POST_LIKES_TO_FOLLOWERS, a gain; a post Evoni made a flop loses what it
 * would have gained. Stamped at the post's story order, or at its reveal
 * when it is a teaser or hidden then (a teaser changes nothing until it is
 * revealed). null when the post is not live, not an authored post, has no
 * poster, or is held by a reveal whose moment is not known yet.
 */
async function proposeFromPost(db, numbers) {
  if (!numbers || !DECIDED_NUMBERS.includes(numbers.status)) return null;
  const { sequelize } = db;
  const [[post]] = await sequelize.query(
    `SELECT fp.id, fp.show_id, fp.social_profile_id, fp.poster_handle, fp.content_text, fp.post_type, fp.status,
            ${require('./storyClock').postOrderSql('fp')} AS story_order
       FROM feed_posts fp WHERE fp.id = :id AND fp.deleted_at IS NULL`, { replacements: { id: numbers.post_id } });
  if (!post || post.status !== 'live' || !post.social_profile_id || NOT_ORIGINAL.includes(post.post_type)) return null;
  let storyOrder = post.story_order == null ? null : Number(post.story_order);
  const reveals = require('./pulseReveals');
  const reveal = await db.PulseReveal.findOne({ where: { show_id: post.show_id, item_type: 'post', item_id: String(post.id) } });
  if (reveal) {
    const [at] = await reveals.resolveOrders(db, [reveal]);
    if (!Number.isInteger(at)) return null;
    if (!Number.isInteger(storyOrder) || at > storyOrder) storyOrder = at;
  }
  if (!Number.isInteger(storyOrder)) return null;
  const likes = Number(numbers.final_likes) || 0;
  const gain = Math.round(likes * POST_LIKES_TO_FOLLOWERS);
  const change = numbers.status === 'flop' ? -gain : gain;
  const before = await countAt(db, post.show_id, post.social_profile_id, storyOrder);
  const snippet = String(post.content_text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return proposeOnce(db, {
    show_id: post.show_id, social_profile_id: post.social_profile_id, story_order: storyOrder, change,
    count_after: before === null ? null : Math.max(0, before + change),
    cause: 'post', cause_id: String(post.id),
    reason: numbers.status === 'flop' ? 'A post Evoni made a flop.' : `A post: ${likes.toLocaleString('en-US')} likes.`,
    factors_json: { likes, rate: POST_LIKES_TO_FOLLOWERS, numbers: numbers.status, post_text: snippet, poster_handle: post.poster_handle || null },
  });
}

/** proposeFromPost after the response; a failure is logged, never thrown. */
function proposeFromPostLater(numbers) {
  if (!numbers) return;
  setImmediate(async () => {
    try {
      await proposeFromPost(require('../models'), numbers);
    } catch (err) {
      console.error('[PulseFollowers] the post follower change could not be proposed:', err.message);
    }
  });
}

/**
 * Lala's follower change for an approved event deliverable: DELIVERABLE_RATE
 * of her followers at the episode's After for each piece (up to MAX_PIECES).
 * null without Lala, a started episode, or a starting count.
 */
async function proposeFromDeliverable(db, { showId, deliverable, lalaProfileId } = {}) {
  if (!deliverable || deliverable.status !== 'approved') return null;
  const { sequelize } = db;
  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(sequelize);
  if (!lalaId) return null;
  const [[event]] = await sequelize.query(
    `SELECT we.name, ep.episode_number FROM world_events we
       LEFT JOIN episodes ep ON ep.id = COALESCE(:episodeId, we.used_in_episode_id) AND ep.deleted_at IS NULL
      WHERE we.id = :eventId AND we.show_id = :showId`,
    { replacements: { showId, eventId: deliverable.event_id, episodeId: deliverable.episode_id || null } });
  if (!event || event.episode_number == null) return null;
  const storyOrder = require('./storyClock').orderOf(Number(event.episode_number), 'after_episode');
  const followers = await countAt(db, showId, lalaId, storyOrder);
  if (followers === null) return null;
  const pieces = Math.min(MAX_PIECES, Math.max(1, Number(deliverable.quantity) || 1));
  const change = Math.round(followers * DELIVERABLE_RATE * pieces);
  return proposeOnce(db, {
    show_id: showId, social_profile_id: lalaId, story_order: storyOrder, change, count_after: followers + change,
    cause: 'event', cause_id: String(deliverable.id),
    reason: `A deliverable for ${event.name || 'an event'} was approved.`,
    factors_json: { followers, rate: DELIVERABLE_RATE, pieces, deliverable: String(deliverable.description || '').slice(0, 120), event_name: event.name || null },
  });
}

module.exports = {
  TIER_MIDDLE, CAUSES, EPISODE_TIER_RATE, POST_LIKES_TO_FOLLOWERS, DELIVERABLE_RATE, MAX_PIECES, NOT_ORIGINAL,
  parseApprox, estimateStart, proposeStarts, countAt, countsAt, decide, override, episodeChangeFrom, proposeEpisodeChange,
  proposeFromPost, proposeFromPostLater, proposeFromDeliverable, LedgerError,
};
