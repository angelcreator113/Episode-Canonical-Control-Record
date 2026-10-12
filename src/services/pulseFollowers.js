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
 *   decide(db, row, …)           accept, or adjust to a count with a reason
 *   override(db, …)              an accepted change with a reason, now
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
 * Decides a proposed row: accept as proposed, or adjust to `count` (the count
 * after it) with a reason. The change is recomputed from the count before it.
 */
async function decide(db, row, { adjustTo = null, reason = null, by = null } = {}) {
  if (row.status !== 'proposed') throw new LedgerError(409, 'This change has already been decided.');
  const before = row.cause === 'start' ? 0 : ((await countAt(db, row.show_id, row.social_profile_id, row.story_order)) ?? 0);
  if (adjustTo !== null) {
    if (!Number.isInteger(adjustTo) || adjustTo < 0) throw new LedgerError(400, 'The count must be a whole number, 0 or more.');
    if (typeof reason !== 'string' || !reason.trim()) throw new LedgerError(400, 'Say why in one line.');
  }
  const countAfter = adjustTo !== null ? adjustTo : (row.cause === 'start' ? row.count_after : before + row.change);
  await row.update({
    status: 'accepted',
    count_after: countAfter,
    change: countAfter - before,
    reason: adjustTo !== null ? reason.trim().slice(0, 500) : row.reason,
    decided_by: by,
    decided_at: new Date(),
  });
  return row;
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

module.exports = {
  TIER_MIDDLE, CAUSES, parseApprox, estimateStart, proposeStarts, countAt, countsAt, decide, override, LedgerError,
};
