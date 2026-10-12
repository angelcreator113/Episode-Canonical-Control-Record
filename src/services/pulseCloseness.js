'use strict';

/**
 * Relationship consequences (Task #2983; The Pulse spec §9 "Repeated
 * interactions (or ignored ones) adjust Relationship Map closeness by small
 * amounts, each change recorded with its cause, proposed and approved like
 * numbers"; docs/reads/2026-10-12-pulse-world-depth-read.md §2).
 * Evoni, 2026-10-12: like numbers — small changes between other characters
 * auto-accept; anything involving Lala, or a large change, waits in Review.
 *
 * Closeness is 0–1 per pair of Feed profiles in a show. A pair starts at its
 * relationship type's closeness (pulseEventPosting.CLOSENESS, in
 * social_profile_relationships either way round; 0 with no relationship) and
 * moves by its accepted rows in pulse_closeness at or before the moment.
 *
 *   closenessAt(db, showId, a, b, at)       one pair
 *   ledgerDeltas(db, showId, profileId, at) Map(other → accepted change) for
 *                                           one profile's pairs (event posting)
 *   proposeFromPost(db, postId)             when a post or a comment goes live:
 *     comment   a live comment on someone's post        NUDGE.comment
 *     mention   a live post that @mentions someone      NUDGE.mention
 *     ignored   a close tie's live post, IGNORE_AFTER   NUDGE.ignored
 *               moments old, that the other never
 *               commented on
 *     Each pair, cause and source is proposed once (a unique index).
 *   proposeLater(postId)                    the same after the response; never throws
 *   decide(row, action, { delta, reason, by })  accept | adjust | reject
 */

const NUDGE = { comment: 0.03, mention: 0.02, ignored: -0.02 };
const AUTO_STEP = 0.05;      // a change this small (or smaller) between other characters auto-accepts…
const AUTO_MOMENT = 0.15;    // …unless the pair has moved this much at one story moment
const MAX_ADJUST = 0.2;      // the largest single change Evoni may set
const CLOSE_LINE = 0.7;      // a tie this close notices being ignored (as pulseKnowledge)
const IGNORE_AFTER = 10;     // a full episode of story time without a reaction
const IGNORE_LOOKBACK = 50;  // the recent live posts checked for being ignored
const CAUSES = ['comment', 'mention', 'ignored', 'override'];

class ClosenessError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'ClosenessError'; }
}

const pairOf = (a, b) => (Number(a) < Number(b) ? [Number(a), Number(b)] : [Number(b), Number(a)]);
const clamp = (n) => Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));

/** The pair's starting closeness: its closest relationship type, or 0. */
async function baseOf(db, a, b) {
  const { CLOSENESS } = require('./pulseEventPosting');
  const [rows] = await db.sequelize.query(
    `SELECT relationship_type::text AS type FROM social_profile_relationships
      WHERE (source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a)`,
    { replacements: { a: Number(a), b: Number(b) } });
  return rows.reduce((best, r) => Math.max(best, CLOSENESS[r.type] ?? 0.3), 0);
}

/** The pair's accepted change at or before `at`. */
async function acceptedSum(db, showId, a, b, at) {
  const [x, y] = pairOf(a, b);
  const [[row]] = await db.sequelize.query(
    `SELECT COALESCE(SUM(delta), 0)::float AS sum FROM pulse_closeness
      WHERE show_id = :showId AND profile_a_id = :x AND profile_b_id = :y AND status = 'accepted'
        AND story_order <= :at AND deleted_at IS NULL`, { replacements: { showId, x, y, at } });
  return Number(row.sum) || 0;
}

async function closenessAt(db, showId, a, b, at) {
  return clamp(await baseOf(db, a, b) + await acceptedSum(db, showId, a, b, at));
}

/** Map(other profile → its pair's accepted change at or before `at`), for one profile. */
async function ledgerDeltas(db, showId, profileId, at) {
  const [rows] = await db.sequelize.query(
    `SELECT CASE WHEN profile_a_id = :id THEN profile_b_id ELSE profile_a_id END AS other, SUM(delta)::float AS sum
       FROM pulse_closeness
      WHERE show_id = :showId AND (profile_a_id = :id OR profile_b_id = :id) AND status = 'accepted'
        AND story_order <= :at AND deleted_at IS NULL
      GROUP BY 1`, { replacements: { showId, id: Number(profileId), at } });
  return new Map(rows.map((r) => [Number(r.other), Number(r.sum) || 0]));
}

/** Proposes one change; auto-accepts a small one between other characters. Returns the row, or null (a repeat, or no change). */
async function propose(db, { showId, a, b, at, cause, sourceId = null, reason = null, lalaProfileId }) {
  if (!CAUSES.includes(cause)) throw new Error(`Unknown closeness cause: ${cause}`);
  if (Number(a) === Number(b)) return null;
  const [x, y] = pairOf(a, b);
  const { PulseCloseness } = db;
  if (sourceId && await PulseCloseness.findOne({ where: { show_id: showId, profile_a_id: x, profile_b_id: y, cause, source_id: String(sourceId) } })) return null;
  const before = await closenessAt(db, showId, x, y, at);
  const after = clamp(before + NUDGE[cause]);
  const delta = Math.round((after - before) * 1000) / 1000;
  if (delta === 0) return null;
  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const withLala = lalaId != null && (x === Number(lalaId) || y === Number(lalaId));
  const [[moved]] = await db.sequelize.query(
    `SELECT COALESCE(SUM(ABS(delta)), 0)::float AS sum FROM pulse_closeness
      WHERE show_id = :showId AND profile_a_id = :x AND profile_b_id = :y AND story_order = :at
        AND status <> 'rejected' AND deleted_at IS NULL`, { replacements: { showId, x, y, at } });
  const auto = !withLala && Math.abs(delta) <= AUTO_STEP && (Number(moved.sum) || 0) + Math.abs(delta) <= AUTO_MOMENT;
  try {
    return await PulseCloseness.create({
      show_id: showId, profile_a_id: x, profile_b_id: y, story_order: at,
      delta, closeness_after: after, cause, source_id: sourceId ? String(sourceId) : null, reason,
      status: auto ? 'accepted' : 'proposed', decided_by: auto ? 'auto' : null, decided_at: auto ? new Date() : null,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return null;   // proposed meanwhile
    throw err;
  }
}

/** The @handles in a text. */
const handlesIn = (text) => [...new Set((String(text || '').match(/@([A-Za-z0-9_.]{2,})/g) || []).map((h) => h.slice(1).replace(/\.+$/, '').toLowerCase()))];

/** Proposes the changes a live post and its live comments cause, and the ignored posts behind it. Returns the rows made. */
async function proposeFromPost(db, postId) {
  const { sequelize } = db;
  const { postOrderSql } = require('./storyClock');
  const [[post]] = await sequelize.query(
    `SELECT fp.id, fp.show_id, fp.social_profile_id, fp.content_text, fp.status, ${postOrderSql('fp')} AS story_order
       FROM feed_posts fp WHERE fp.id = :postId AND fp.deleted_at IS NULL`, { replacements: { postId } });
  if (!post || post.status !== 'live' || !post.social_profile_id || post.story_order == null) return [];
  const at = Number(post.story_order);
  const poster = Number(post.social_profile_id);
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(sequelize);
  const made = [];
  const add = async (args) => { const row = await propose(db, { showId: post.show_id, lalaProfileId, ...args }); if (row) made.push(row); };

  // Mentions: @handle in the post.
  const handles = handlesIn(post.content_text);
  if (handles.length) {
    const [mentioned] = await sequelize.query(
      'SELECT id FROM social_profiles WHERE LOWER(handle) IN (:handles) AND deleted_at IS NULL', { replacements: { handles } });
    for (const m of mentioned) await add({ a: poster, b: m.id, at, cause: 'mention', sourceId: post.id, reason: 'Mentioned in a post' });
  }

  // Comments: each live comment by another profile.
  const [comments] = await sequelize.query(
    `SELECT id, social_profile_id FROM feed_comments
      WHERE feed_post_id = :postId AND status = 'live' AND social_profile_id IS NOT NULL AND deleted_at IS NULL`, { replacements: { postId } });
  for (const cm of comments) {
    if (Number(cm.social_profile_id) !== poster) await add({ a: poster, b: cm.social_profile_id, at, cause: 'comment', sourceId: cm.id, reason: 'Commented on a post' });
  }

  // Ignored: close ties' posts a full episode old that the other never commented on.
  const [old] = await sequelize.query(
    `SELECT fp.id, fp.social_profile_id, ${postOrderSql('fp')} AS story_order FROM feed_posts fp
      WHERE fp.show_id = :showId AND fp.status = 'live' AND fp.deleted_at IS NULL AND fp.social_profile_id IS NOT NULL
        AND ${postOrderSql('fp')} <= :line
      ORDER BY ${postOrderSql('fp')} DESC LIMIT ${IGNORE_LOOKBACK}`, { replacements: { showId: post.show_id, line: at - IGNORE_AFTER } });
  for (const o of old) {
    const owner = Number(o.social_profile_id);
    const [ties] = await sequelize.query(
      `SELECT DISTINCT CASE WHEN source_profile_id = :id THEN target_profile_id ELSE source_profile_id END AS other
         FROM social_profile_relationships WHERE source_profile_id = :id OR target_profile_id = :id`, { replacements: { id: owner } });
    if (!ties.length) continue;
    const [reacted] = await sequelize.query(
      `SELECT DISTINCT social_profile_id FROM feed_comments
        WHERE feed_post_id = :id AND status = 'live' AND social_profile_id IS NOT NULL AND deleted_at IS NULL`, { replacements: { id: o.id } });
    const seen = new Set(reacted.map((r) => Number(r.social_profile_id)));
    const when = Number(o.story_order) + IGNORE_AFTER;
    for (const t of ties) {
      const other = Number(t.other);
      if (seen.has(other) || other === owner) continue;
      if (await closenessAt(db, post.show_id, owner, other, when) < CLOSE_LINE) continue;
      await add({ a: owner, b: other, at: when, cause: 'ignored', sourceId: o.id, reason: 'No reaction to a close friend\'s post' });
    }
  }
  return made;
}

/** proposeFromPost after the response: never throws, never fails the release. */
function proposeLater(postId) {
  if (!postId) return;
  setImmediate(async () => {
    try {
      await proposeFromPost(require('../models'), postId);
    } catch (err) {
      console.error('[PulseCloseness] proposing closeness changes failed:', err.message);
    }
  });
}

/** Evoni's decision on a proposed change: accept, adjust (a delta and a one-line reason) or reject. */
async function decide(row, action, { delta, reason, by } = {}) {
  if (row.status !== 'proposed') throw new ClosenessError(409, 'This change was already decided.');
  const db = require('../models');
  const now = new Date();
  if (action === 'reject') return row.update({ status: 'rejected', decided_by: by, decided_at: now, reason: reason ? String(reason).slice(0, 300) : row.reason });
  let change = Number(row.delta);
  let why = row.reason;
  if (action === 'adjust') {
    change = Number(delta);
    if (!Number.isFinite(change) || Math.abs(change) > MAX_ADJUST) throw new ClosenessError(400, `delta must be a number from -${MAX_ADJUST} to ${MAX_ADJUST}.`);
    why = String(reason || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
    if (!why) throw new ClosenessError(400, 'An adjustment needs a one-line reason.');
  } else if (action !== 'accept') {
    throw new ClosenessError(400, `Unknown decision: ${action}`);
  }
  const before = await closenessAt(db, row.show_id, row.profile_a_id, row.profile_b_id, row.story_order);
  const after = clamp(before + change);
  return row.update({ status: 'accepted', delta: Math.round((after - before) * 1000) / 1000, closeness_after: after, reason: why, decided_by: by, decided_at: now });
}

module.exports = {
  NUDGE, AUTO_STEP, AUTO_MOMENT, MAX_ADJUST, CLOSE_LINE, IGNORE_AFTER, CAUSES,
  pairOf, clamp, handlesIn, baseOf, closenessAt, ledgerDeltas, propose, proposeFromPost, proposeLater, decide, ClosenessError,
};
