'use strict';

/**
 * Admin › The Pulse › Growth (Task #2957; The Pulse spec §4 "Growth — Lala's
 * follower line across episodes (approved numbers solid, projection dashed),
 * best and worst posts, biggest jumps and their causes"). Read only, from
 * the follower ledger (services/pulseFollowers.js) and post numbers
 * (services/pulseNumbers.js). Evoni, 2026-10-12: Influence waits for real
 * data, so this is the count and the tier only.
 *
 *   growthOf(db, showId, { lalaProfileId })
 *     profile     Lala's Feed profile (handle, name, tier), or null
 *     start       her starting count row (any status), or null
 *     line        her accepted changes in story order, each with its count
 *     projection  proposed episode changes, each with the count it would make
 *     best, worst her five posts with the most and fewest locked likes
 *     jumps       her five biggest accepted changes (not the start), with causes
 */

const DECIDED = ['accepted', 'adjusted', 'viral', 'flop'];
const LIST = 5;

async function growthOf(db, showId, { lalaProfileId } = {}) {
  const { sequelize } = db;
  const { label } = require('./storyClock');
  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(sequelize);
  const empty = { profile: null, start: null, line: [], projection: [], best: [], worst: [], jumps: [] };
  if (!lalaId) return empty;
  const q = (sql, replacements) => sequelize.query(sql, { replacements: { showId, lalaId, ...replacements }, type: sequelize.QueryTypes.SELECT });

  const [profile] = await q(
    `SELECT id, handle, display_name, follower_tier::text AS follower_tier FROM social_profiles WHERE id = :lalaId`);
  const rows = await q(
    `SELECT pf.id, pf.story_order, pf.change, pf.count_after, pf.cause, pf.cause_id, pf.reason, pf.status, e.episode_number
       FROM pulse_followers pf LEFT JOIN episodes e ON pf.cause = 'episode' AND e.id::text = pf.cause_id
      WHERE pf.show_id = :showId AND pf.social_profile_id = :lalaId AND pf.deleted_at IS NULL
      ORDER BY pf.story_order ASC, pf.decided_at ASC NULLS LAST, pf.created_at ASC`);
  const shape = (r) => ({
    id: r.id,
    story_order: Number(r.story_order),
    label: r.cause === 'start' ? 'Start' : (label(Number(r.story_order)) || 'Start'),
    change: Number(r.change),
    count: r.count_after == null ? null : Number(r.count_after),
    cause: r.cause,
    cause_id: r.cause_id,
    episode_number: r.episode_number == null ? null : Number(r.episode_number),
    reason: r.reason,
    status: r.status,
  });
  const startRow = rows.find((r) => r.cause === 'start');
  const accepted = rows.filter((r) => r.status === 'accepted').map(shape);
  const latest = accepted.length ? accepted[accepted.length - 1].count : null;
  const projection = rows.filter((r) => r.status === 'proposed' && r.cause === 'episode').map((r) => {
    const p = shape(r);
    // The count it would make on top of the latest accepted one.
    return { ...p, count: latest == null ? null : Math.max(0, latest + p.change) };
  });
  const jumps = accepted.filter((r) => r.cause !== 'start')
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, LIST);

  const posts = (dir) => q(
    `SELECT pn.post_id, pn.final_likes, pn.final_shares, pn.status, fp.content_text, fp.image_url, fp.posted_at
       FROM pulse_post_numbers pn JOIN feed_posts fp ON fp.id = pn.post_id AND fp.deleted_at IS NULL
      WHERE pn.show_id = :showId AND pn.deleted_at IS NULL AND pn.status IN (:decided)
        AND (pn.social_profile_id = :lalaId OR (pn.social_profile_id IS NULL AND LOWER(pn.poster_handle) = 'lala'))
      ORDER BY pn.final_likes ${dir}, pn.created_at DESC LIMIT ${LIST}`, { decided: DECIDED });
  const postShape = (p) => ({
    post_id: p.post_id, likes: Number(p.final_likes), shares: Number(p.final_shares || 0), status: p.status,
    content_text: p.content_text, image_url: p.image_url, posted_at: p.posted_at,
  });

  return {
    profile: profile ? { id: Number(profile.id), handle: profile.handle, display_name: profile.display_name, follower_tier: profile.follower_tier } : null,
    start: startRow ? shape(startRow) : null,
    line: accepted,
    projection,
    best: (await posts('DESC')).map(postShape),
    worst: (await posts('ASC')).map(postShape),
    jumps,
  };
}

module.exports = { growthOf };
