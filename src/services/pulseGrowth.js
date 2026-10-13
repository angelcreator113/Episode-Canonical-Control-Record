'use strict';

/**
 * Admin › The Pulse › Growth (Task #2957; The Pulse spec §4 "Growth — Lala's
 * follower line across episodes (approved numbers solid, projection dashed),
 * best and worst posts, biggest jumps and their causes"). Read only, from
 * the follower ledger (services/pulseFollowers.js) and post numbers
 * (services/pulseNumbers.js). The tier is worked out from the count
 * (services/pulseAudience.js, Task #3033), never the stored follower_tier,
 * and never feeds Influence. Influence (Task #3066; Evoni, 2026-10-13: shown
 * read only) is Lala's character_state stat, which episodes move; The Pulse
 * only reads it.
 *
 *   growthOf(db, showId, { lalaProfileId })
 *     profile     Lala's Feed profile (handle, name) and the tier of her
 *                 latest accepted count, or null
 *     start       her starting count row (any status), or null
 *     line        her accepted changes in story order, each with its count
 *                 and the tier at that moment
 *     projection  proposed episode changes, each with the count it would make
 *     best, worst her five posts with the most and fewest locked likes
 *     jumps       her five biggest accepted changes (not the start), with causes
 *     influence   { now, scale, by_episode: [{ episode_id, episode_number,
 *                 change, after }] } from character_state and
 *                 character_state_history (deltas_json.influence), oldest
 *                 episode first; now is null with no state
 */

const DECIDED = ['accepted', 'adjusted', 'viral', 'flop'];
const INFLUENCE_SCALE = 10;   // character_state's 0–10 stats

/**
 * Lala's Influence, read only (Task #3066): the value now, and each
 * episode's change with the value after it (the newest snapshot that
 * episode wrote, when it wrote one). Nothing here writes it.
 */
async function influenceOf(db, showId) {
  const { sequelize } = db;
  const q = (sql) => sequelize.query(sql, { replacements: { showId }, type: sequelize.QueryTypes.SELECT });
  const [state] = await q(`SELECT influence FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`);
  const rows = await q(
    `SELECT h.episode_id, e.episode_number,
            SUM(COALESCE((h.deltas_json->>'influence')::numeric, 0)) AS change,
            (ARRAY_AGG(h.state_after_json->>'influence' ORDER BY h.created_at DESC)
              FILTER (WHERE h.state_after_json IS NOT NULL AND jsonb_exists(h.state_after_json, 'influence')))[1] AS after
       FROM character_state_history h JOIN episodes e ON e.id = h.episode_id AND e.deleted_at IS NULL
      WHERE h.show_id = :showId AND h.character_key = 'lala' AND jsonb_exists(h.deltas_json, 'influence')
      GROUP BY h.episode_id, e.episode_number
      ORDER BY e.episode_number ASC NULLS LAST`);
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    now: state ? num(state.influence) : null,
    scale: INFLUENCE_SCALE,
    by_episode: rows.map((r) => ({ episode_id: r.episode_id, episode_number: num(r.episode_number), change: num(r.change) ?? 0, after: num(r.after) })),
  };
}
const LIST = 5;

async function growthOf(db, showId, { lalaProfileId } = {}) {
  const { sequelize } = db;
  const { label } = require('./storyClock');
  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(sequelize);
  const influence = await influenceOf(db, showId);
  const empty = { profile: null, start: null, line: [], projection: [], best: [], worst: [], jumps: [], influence };
  if (!lalaId) return empty;
  const q = (sql, replacements) => sequelize.query(sql, { replacements: { showId, lalaId, ...replacements }, type: sequelize.QueryTypes.SELECT });

  const [profile] = await q(
    `SELECT id, handle, display_name FROM social_profiles WHERE id = :lalaId`);
  const rows = await q(
    `SELECT pf.id, pf.story_order, pf.change, pf.count_after, pf.cause, pf.cause_id, pf.reason, pf.status, e.episode_number
       FROM pulse_followers pf LEFT JOIN episodes e ON pf.cause = 'episode' AND e.id::text = pf.cause_id
      WHERE pf.show_id = :showId AND pf.social_profile_id = :lalaId AND pf.deleted_at IS NULL
      ORDER BY pf.story_order ASC, pf.decided_at ASC NULLS LAST, pf.created_at ASC`);
  const { tierFor } = require('./pulseAudience');
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
    tier: tierFor(r.count_after),
  });
  const startRow = rows.find((r) => r.cause === 'start');
  const accepted = rows.filter((r) => r.status === 'accepted').map(shape);
  const latest = accepted.length ? accepted[accepted.length - 1].count : null;
  const projection = rows.filter((r) => r.status === 'proposed' && r.cause === 'episode').map((r) => {
    const p = shape(r);
    // The count it would make on top of the latest accepted one.
    const count = latest == null ? null : Math.max(0, latest + p.change);
    return { ...p, count, tier: tierFor(count) };
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
    profile: profile ? { id: Number(profile.id), handle: profile.handle, display_name: profile.display_name, tier: tierFor(latest) } : null,
    start: startRow ? shape(startRow) : null,
    line: accepted,
    projection,
    best: (await posts('DESC')).map(postShape),
    worst: (await posts('ASC')).map(postShape),
    jumps,
    influence,
  };
}

module.exports = { INFLUENCE_SCALE, growthOf, influenceOf };
