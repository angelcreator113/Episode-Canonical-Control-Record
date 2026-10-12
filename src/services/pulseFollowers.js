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
 *                                proposed once (Task #2956)
 */

// The middle of each follower tier (social_profiles.follower_tier).
const TIER_MIDDLE = { micro: 5000, mid: 50000, macro: 500000, mega: 5000000 };
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
  if (counted === null && row.cause === 'episode') throw new LedgerError(409, "Accept Lala's starting follower count first.");
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
// episode's After by its result, plus a share of its posts' decided likes.
const EPISODE_TIER_RATE = { slay: 0.05, pass: 0.025, safe: 0.01, fail: -0.01 };
const POST_LIKES_TO_FOLLOWERS = 0.02;
const DECIDED_NUMBERS = ['accepted', 'adjusted', 'viral', 'flop'];

/**
 * The change from its factors: { change, from_result, from_posts }. The
 * result's share grows with the score (0.75× at 0, 1.25× at 100); a loss
 * never takes the count below 0.
 */
function episodeChangeFrom({ followers, tier, score, post_likes: postLikes }) {
  const base = Number(followers) || 0;
  const fromResult = Math.round(base * (EPISODE_TIER_RATE[tier] ?? 0) * (0.75 + (Number(score) || 0) / 200));
  const fromPosts = Math.round((Number(postLikes) || 0) * POST_LIKES_TO_FOLLOWERS);
  return { change: Math.max(-base, fromResult + fromPosts), from_result: fromResult, from_posts: fromPosts };
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
  const [[{ likes }]] = await sequelize.query(
    `SELECT COALESCE(SUM(pn.final_likes), 0)::int AS likes
       FROM pulse_post_numbers pn JOIN feed_posts fp ON fp.id = pn.post_id
      WHERE fp.episode_id = :episodeId AND fp.deleted_at IS NULL AND pn.deleted_at IS NULL AND pn.status IN (:decided)`,
    { replacements: { episodeId, decided: DECIDED_NUMBERS } });
  const score = episode.score == null ? null : Number(episode.score);
  const factors = { tier: episode.tier, score, followers: followers ?? 0, followers_known: followers !== null, post_likes: likes };
  const { change, from_result: fromResult, from_posts: fromPosts } = episodeChangeFrom(factors);
  Object.assign(factors, { from_result: fromResult, from_posts: fromPosts });
  try {
    return await PulseFollower.create({
      show_id: showId, social_profile_id: lalaId, story_order: storyOrder, change,
      count_after: followers === null ? null : followers + change,
      cause: 'episode', cause_id: episodeId,
      reason: `Episode ${episode.episode_number ?? '?'} ${episode.tier.toUpperCase()}: proposed from its result and its posts.`,
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

module.exports = {
  TIER_MIDDLE, CAUSES, EPISODE_TIER_RATE, POST_LIKES_TO_FOLLOWERS,
  parseApprox, estimateStart, proposeStarts, countAt, countsAt, decide, override, episodeChangeFrom, proposeEpisodeChange, LedgerError,
};
