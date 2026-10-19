'use strict';

/**
 * Lala's profile column on the Feed page (Task #2747;
 * docs/reads/2026-10-11-feed-wiring-read.md §1). One read, each value
 * from its one owner, or null when there is none:
 *
 *   profile     Lala's Feed profile: the one her registry character links
 *               (registry_characters.feed_profile_id, utils/registryLink),
 *               else the LalaVerse profile whose handle is exactly 'lala'.
 *               The page used a text search, which could pick another
 *               "Lala…" profile.
 *   portrait    her registry character's portrait_url.
 *   home_city   the show's lala_home city (Show Settings; utils/lalaHome).
 *   career      her career tier from her reputation (character_state,
 *               utils/careerTiers): { tier, label }.
 *   followers   her canon follower count at the moment and its audience
 *               tier (pulseFollowers, pulseAudience; Task #3062), else the
 *               profile's estimate marked estimated.
 *   friends     the LalaVerse profiles she and they both follow on The
 *               Pulse (pulse_follows; Evoni, 2026-10-19), the first six and
 *               the total. They were seeded from her old friends,
 *               social_profiles.lala_relationship = 'direct' (Evoni's
 *               choice of 2026-10-11), which a server not yet migrated
 *               still reads.
 *
 * Relationship status is not here: it is her newest relationship post
 * (docs/FEED_POSTS.md rule 8), which the page reads with the posts.
 * Reads only; writes nothing.
 */

const { readLalaHome } = require('../utils/lalaHome');
const { CAREER_TIERS, careerTierFromReputation } = require('../utils/careerTiers');

const FRIENDS_SHOWN = 6;
// The Friends tab lists them all (Task #2761), up to this many.
const FRIENDS_ALL = 200;

async function one(sequelize, sql, replacements, label) {
  try {
    const [rows] = await sequelize.query(sql, { replacements });
    return rows?.[0] || null;
  } catch (err) {
    console.error(`[LalaFeedProfile] ${label} read failed:`, err.message);
    return null;
  }
}

/** Lala's registry character (her portrait and cover, her Feed link), the newest live one. */
const lalaCharacter = (sequelize) => one(sequelize,
  `SELECT id, feed_profile_id, portrait_url, cover_url FROM registry_characters
    WHERE character_key = 'lala' AND deleted_at IS NULL
    ORDER BY (feed_profile_id IS NULL), updated_at DESC LIMIT 1`, {}, 'registry character');

async function lalaProfile(sequelize, linkedId) {
  const cols = 'id, handle, display_name, follower_count_approx, relationship_status';
  if (linkedId) {
    const linked = await one(sequelize, `SELECT ${cols} FROM social_profiles WHERE id = :id AND deleted_at IS NULL`, { id: linkedId }, 'linked profile');
    if (linked) return linked;
  }
  return one(sequelize,
    `SELECT ${cols} FROM social_profiles
      WHERE deleted_at IS NULL AND feed_layer = 'lalaverse' AND LOWER(handle) = 'lala'
      ORDER BY id LIMIT 1`, {}, 'lala profile');
}

/**
 * Lala's friends: the people she and they both follow on The Pulse
 * (services/pulseFollows.friendsOfLala; Evoni, 2026-10-19). Before the
 * follows table exists (a server not yet migrated), the old list,
 * lala_relationship = 'direct', which the follows were seeded from.
 */
async function friendsOf(sequelize, ownerId, limit, hidden = []) {
  if (ownerId) {
    try {
      return await require('./pulseFollows').friendsOfLala({ sequelize }, { lalaId: ownerId, limit, hidden });
    } catch (err) {
      console.error('[LalaFeedProfile] follows could not be read; using the old friends list:', err.message);
    }
  }
  return directFriendsOf(sequelize, ownerId, limit, hidden);
}

async function directFriendsOf(sequelize, ownerId, limit, hidden = []) {
  // `hidden`: profiles Lala has not met yet at the moment read (Task #2939).
  const where = `deleted_at IS NULL AND feed_layer = 'lalaverse' AND lala_relationship = 'direct'
    AND COALESCE(is_justawoman_record, false) = false AND (CAST(:owner AS INTEGER) IS NULL OR id <> CAST(:owner AS INTEGER))
    ${hidden.length ? 'AND id NOT IN (:hidden)' : ''}`;
  try {
    const [list] = await sequelize.query(
      `SELECT id, handle, display_name FROM social_profiles WHERE ${where}
        ORDER BY LOWER(COALESCE(display_name, handle)) LIMIT :limit`, { replacements: { owner: ownerId || null, limit, hidden } });
    const [[count]] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM social_profiles WHERE ${where}`, { replacements: { owner: ownerId || null, hidden } });
    return { total: count?.n || 0, list };
  } catch (err) {
    console.error('[LalaFeedProfile] friends read failed:', err.message);
    return null;
  }
}

/**
 * Lala's follower count for The Pulse's header (Task #3062; Evoni,
 * 2026-10-13: her canon count at the moment, with her tier): her accepted
 * count at `at` in the follower ledger (pulseFollowers.countAt; no `at`, the
 * latest) and its audience tier (pulseAudience). Before her starting count
 * is accepted, the profile's free-text estimate, marked estimated. Null
 * with neither.
 */
async function followersOf(models, showId, profile, at) {
  if (!profile) return null;
  let count = null;
  try {
    count = await require('./pulseFollowers').countAt(models, showId, profile.id, Number.isInteger(at) ? at : null);
  } catch (err) {
    console.error('[LalaFeedProfile] follower count read failed:', err.message);
  }
  if (count !== null) {
    const tier = require('./pulseAudience').tierFor(count);
    return { count, tier: tier ? { key: tier.key, label: tier.label } : null, estimated: false };
  }
  return profile.follower_count_approx ? { count: null, tier: null, estimated: true, estimate: profile.follower_count_approx } : null;
}

/**
 * `allFriends`: every friend (the Friends tab), not the column's first six.
 * `at`: a story order; friends Lala has not met by then are left out (Task #2939).
 */
async function getLalaFeedProfile(models, showId, { allFriends = false, at } = {}) {
  const { sequelize } = models;
  const character = await lalaCharacter(sequelize);
  const profile = await lalaProfile(sequelize, character?.feed_profile_id);
  const show = await one(sequelize, 'SELECT metadata FROM shows WHERE id = :showId AND deleted_at IS NULL', { showId }, 'show');
  const state = await one(sequelize,
    `SELECT reputation FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`, { showId }, 'character state');
  const tier = state && state.reputation !== null && state.reputation !== undefined ? careerTierFromReputation(state.reputation) : null;
  return {
    profile,
    followers: await followersOf(models, showId, profile, at),
    portrait_url: character?.portrait_url || null,
    cover_url: character?.cover_url || null,
    home_city: readLalaHome(show?.metadata)?.city || null,
    career: tier ? { tier, label: CAREER_TIERS[tier].label } : null,
    friends: await friendsOf(sequelize, profile?.id, allFriends ? FRIENDS_ALL : FRIENDS_SHOWN,
      Number.isInteger(at) ? [...(await require('./pulseReveals').revealsAt(models, showId, at, { lalaProfileId: profile?.id })).unmetProfiles] : []),
  };
}

/** Lala's own Feed profile id (as getLalaFeedProfile finds her), or null. */
async function lalaProfileId(sequelize) {
  const character = await lalaCharacter(sequelize);
  return (await lalaProfile(sequelize, character?.feed_profile_id))?.id || null;
}

module.exports = { getLalaFeedProfile, lalaProfileId, followersOf, FRIENDS_SHOWN, FRIENDS_ALL };
