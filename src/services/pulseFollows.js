'use strict';

/**
 * Who follows whom on The Pulse (Evoni, 2026-10-19: "we need a follow
 * system"; table pulse_follows, model PulseFollow).
 *
 * A follow is one way: "Maren follows Lala" says nothing about Lala
 * following Maren. Two people who follow each other are friends; there is
 * no separate befriending. Lala's friends on The Pulse are the people she
 * and they both follow (friendsOfLala).
 *
 *   follow(db, follower, followed, { source, by })   idempotent; a live follow is kept
 *   unfollow(db, follower, followed)                  soft-deletes it; true when one was live
 *   followsOf(db, id) / followersOf(db, id)           profile ids, as numbers
 *   isMutual(db, a, b)
 *   lalaProfile(db)                                   Lala's Pulse profile id (lalaFeedProfile), or null
 *   relationToLala(db, id, lalaId?)                   { follows_lala, lala_follows, friends }
 *   friendsOfLala(db, { limit, hidden })              { total, list } of mutual follows with Lala
 *   followLalaFromFeed(db, profileIds, { by })        the feed rule (below); returns how many were added
 *
 * The feed rule (Evoni, 2026-10-19): someone who came from the feed follows
 * Lala, one way; Lala does not follow them back unless Evoni says so. It runs
 * on Cross (routes/socialProfileRoutes, /:id/cross and /bulk/cross) and is
 * the helper a character maker calls for a person made from the feed.
 * Everyone else follows Lala, or is followed by her, only when Evoni sets it.
 *
 * The audience numbers stay apart (pulse_followers,
 * social_profiles.follower_count_approx): these are follows between named
 * people, not Lala's 900K.
 */

const SOURCES = Object.freeze(['auto_feed', 'evoni', 'seed_friends']);
const ids = (rows, key) => rows.map((r) => Number(r[key]));
const posInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

async function follow(db, follower, followed, { source = 'evoni', by = null } = {}) {
  if (!posInt(follower) || !posInt(followed)) throw Object.assign(new Error('A follow needs two profiles.'), { status: 400 });
  if (Number(follower) === Number(followed)) throw Object.assign(new Error('Nobody follows themselves.'), { status: 400 });
  if (!SOURCES.includes(source)) throw Object.assign(new Error(`source must be one of ${SOURCES.join(', ')}`), { status: 400 });
  const [rows] = await db.sequelize.query(
    `INSERT INTO pulse_follows (follower_profile_id, followed_profile_id, source, created_by)
     VALUES (:follower, :followed, :source, :by)
     ON CONFLICT (follower_profile_id, followed_profile_id) WHERE deleted_at IS NULL DO NOTHING
     RETURNING id`,
    { replacements: { follower: Number(follower), followed: Number(followed), source, by } });
  return { added: rows.length > 0 };
}

async function unfollow(db, follower, followed) {
  const [rows] = await db.sequelize.query(
    `UPDATE pulse_follows SET deleted_at = NOW(), updated_at = NOW()
      WHERE follower_profile_id = :follower AND followed_profile_id = :followed AND deleted_at IS NULL
      RETURNING id`,
    { replacements: { follower: Number(follower), followed: Number(followed) } });
  return rows.length > 0;
}

async function followsOf(db, profileId) {
  const [rows] = await db.sequelize.query(
    'SELECT followed_profile_id FROM pulse_follows WHERE follower_profile_id = :id AND deleted_at IS NULL',
    { replacements: { id: Number(profileId) } });
  return ids(rows, 'followed_profile_id');
}

async function followersOf(db, profileId) {
  const [rows] = await db.sequelize.query(
    'SELECT follower_profile_id FROM pulse_follows WHERE followed_profile_id = :id AND deleted_at IS NULL',
    { replacements: { id: Number(profileId) } });
  return ids(rows, 'follower_profile_id');
}

async function follows(db, a, b) {
  const [rows] = await db.sequelize.query(
    'SELECT 1 FROM pulse_follows WHERE follower_profile_id = :a AND followed_profile_id = :b AND deleted_at IS NULL LIMIT 1',
    { replacements: { a: Number(a), b: Number(b) } });
  return rows.length > 0;
}

async function isMutual(db, a, b) {
  return (await follows(db, a, b)) && (await follows(db, b, a));
}

const lalaProfile = (db) => require('./lalaFeedProfile').lalaProfileId(db.sequelize);

async function relationToLala(db, profileId, lalaId) {
  const lala = lalaId === undefined ? await lalaProfile(db) : lalaId;
  if (lala == null || Number(lala) === Number(profileId)) return { follows_lala: false, lala_follows: false, friends: false };
  const followsLala = await follows(db, profileId, lala);
  const lalaFollows = await follows(db, lala, profileId);
  return { follows_lala: followsLala, lala_follows: lalaFollows, friends: followsLala && lalaFollows };
}

/**
 * Lala's friends on The Pulse: the LalaVerse profiles she and they both
 * follow, never the JustAWoman record. `hidden`: profiles Lala has not met
 * yet at the moment read (Task #2939), left out.
 */
async function friendsOfLala(db, { lalaId, limit = 200, hidden = [] } = {}) {
  const lala = lalaId === undefined ? await lalaProfile(db) : lalaId;
  if (lala == null) return { total: 0, list: [] };
  const where = `sp.deleted_at IS NULL AND sp.feed_layer = 'lalaverse' AND COALESCE(sp.is_justawoman_record, false) = false
    AND sp.id <> :lala ${hidden.length ? 'AND sp.id NOT IN (:hidden)' : ''}
    AND EXISTS (SELECT 1 FROM pulse_follows a WHERE a.follower_profile_id = sp.id AND a.followed_profile_id = :lala AND a.deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM pulse_follows b WHERE b.follower_profile_id = :lala AND b.followed_profile_id = sp.id AND b.deleted_at IS NULL)`;
  const replacements = { lala: Number(lala), limit, hidden };
  const [list] = await db.sequelize.query(
    `SELECT sp.id, sp.handle, sp.display_name FROM social_profiles sp WHERE ${where}
      ORDER BY LOWER(COALESCE(sp.display_name, sp.handle)) LIMIT :limit`, { replacements });
  const [[count]] = await db.sequelize.query(`SELECT COUNT(*)::int AS n FROM social_profiles sp WHERE ${where}`, { replacements });
  return { total: count?.n || 0, list };
}

/**
 * The feed rule: each of these profiles, having come from the feed, follows
 * Lala (source auto_feed), one way. LalaVerse profiles only, never Lala or
 * the JustAWoman record. A failure is logged and adds nothing: crossing
 * never fails for want of a follow.
 *
 * Where they came from is their character's created_from (migration
 * 20261019200001). A profile whose character was made some other way
 * ("Make one for me", The Cast's New character, a clone, a generator)
 * did not come from the feed, even when Cross is pressed on it later: it
 * follows Lala only when Evoni says so. A character with no recorded origin
 * (made before the column) and a profile with no character count as from
 * the feed, as the crossing says.
 */
async function followLalaFromFeed(db, profileIds, { by = null } = {}) {
  const list = [...new Set((profileIds || []).filter(posInt).map(Number))];
  if (!list.length) return 0;
  try {
    const lala = await lalaProfile(db);
    if (lala == null) return 0;
    const [rows] = await db.sequelize.query(
      `INSERT INTO pulse_follows (follower_profile_id, followed_profile_id, source, created_by)
       SELECT sp.id, :lala, 'auto_feed', :by FROM social_profiles sp
        WHERE sp.id IN (:list) AND sp.id <> :lala AND sp.deleted_at IS NULL AND sp.feed_layer = 'lalaverse'
          AND COALESCE(sp.is_justawoman_record, false) = false
          AND NOT EXISTS (SELECT 1 FROM registry_characters rc
                           WHERE rc.feed_profile_id = sp.id AND rc.deleted_at IS NULL
                             AND rc.created_from IS NOT NULL AND rc.created_from <> 'feed_cross')
       ON CONFLICT (follower_profile_id, followed_profile_id) WHERE deleted_at IS NULL DO NOTHING
       RETURNING id`,
      { replacements: { lala: Number(lala), list, by } });
    return rows.length;
  } catch (err) {
    console.error('[pulseFollows] the feed rule could not add follows:', err.message);
    return 0;
  }
}

module.exports = {
  SOURCES, follow, unfollow, follows, followsOf, followersOf, isMutual,
  lalaProfile, relationToLala, friendsOfLala, followLalaFromFeed,
};
