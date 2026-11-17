'use strict';
/**
 * Pulse profiles and follows (Evoni, 2026-10-19: "when I click on a
 * character's profile inside of the pulse … I don't actually get to see
 * their actual profile", and "we need a follow system";
 * services/pulseFollows.js). Mounted at /api/v1/pulse-follows.
 *
 *   GET    /profile/:handle?show_id=&at=   one person's Pulse profile: who they
 *                                          are, their audience number, and how
 *                                          they and Lala follow each other
 *                                          (requireAuth, like The Pulse's other
 *                                          reads). An ADMIN also gets their
 *                                          registry character's id.
 *   GET    /profile/:handle/media          their profile's grid extras (Evoni, 2026-10-19:
 *                                          "give each pulse profile a gallery just like a
 *                                          real social media account"): the ids of their
 *                                          pinned posts, the photos others posted with them
 *                                          in it (Tagged), and their posted camera-roll
 *                                          photos by album (Highlights). Public pictures
 *                                          only, for everyone (requireAuth).
 *   PUT    /posts/:postId/pin              pin a live post first on its poster's profile;
 *                                          at most three (requireAuth + ADMIN)
 *   DELETE /posts/:postId/pin              unpin it (requireAuth + ADMIN)
 *   PUT    /:profileId/follows-lala        they follow Lala       (requireAuth + ADMIN)
 *   DELETE /:profileId/follows-lala        they stop              (requireAuth + ADMIN)
 *   PUT    /:profileId/lala-follows        Lala follows them      (requireAuth + ADMIN)
 *   DELETE /:profileId/lala-follows        Lala stops             (requireAuth + ADMIN)
 *
 * Each write answers the profile's relation to Lala afterwards:
 * { follows_lala, lala_follows, friends }.
 */
const express = require('express');
const { requireAuth, authorize, userInGroup } = require('../middleware/auth');
const follows = require('../services/pulseFollows');

const router = express.Router();
const getModels = () => require('../models');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE_RE = /^@?[A-Za-z0-9_.-]{1,60}$/;
const byOf = (req) => String(req.user?.email || req.user?.id || 'admin').slice(0, 255);

/** A LalaVerse Pulse profile by id, never the JustAWoman record; null when there is none. */
// Handles are stored with their "@" ("@slowsift": feedScheduler, castGenerate);
// the URL carries it or not. Both sides are compared bare, case-insensitively.
const HANDLE_MATCH = "LOWER(REGEXP_REPLACE(handle, '^@+', '')) = LOWER(:handle)";
const bareHandle = (h) => String(h || '').replace(/^@+/, '');

async function pulseProfile(db, where, replacements) {
  const [[row]] = await db.sequelize.query(
    `SELECT id, handle, display_name, creator_name, public_persona, vibe_sentence, city, geographic_base,
            follower_count_approx, follower_tier
       FROM social_profiles
      WHERE ${where} AND deleted_at IS NULL AND feed_layer = 'lalaverse' AND COALESCE(is_justawoman_record, false) = false
      ORDER BY id LIMIT 1`, { replacements });
  return row || null;
}

router.get('/profile/:handle', requireAuth, async (req, res) => {
  const handle = String(req.params.handle || '');
  if (!HANDLE_RE.test(handle)) return res.status(400).json({ error: 'handle is not a Pulse handle' });
  const { show_id: showId } = req.query;
  if (showId !== undefined && (typeof showId !== 'string' || !UUID_RE.test(showId))) {
    return res.status(400).json({ error: 'show_id must be a UUID' });
  }
  try {
    const db = getModels();
    const profile = await pulseProfile(db, HANDLE_MATCH, { handle: bareHandle(handle) });
    if (!profile) return res.status(404).json({ error: 'Nobody on The Pulse has that handle.' });
    let at;
    if (showId) {
      try { at = await require('../services/storyClock').resolveAt(db, showId, req.query.at); } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        throw err;
      }
    }
    const lalaId = await follows.lalaProfile(db);
    const [[character]] = await db.sequelize.query(
      `SELECT id, portrait_url FROM registry_characters WHERE feed_profile_id = :id AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 1`, { replacements: { id: profile.id } });
    const admin = userInGroup(req.user, 'admin');
    return res.json({
      data: {
        profile: {
          id: Number(profile.id),
          handle: String(profile.handle || '').replace(/^@/, ''),
          display_name: profile.display_name || profile.creator_name || profile.handle,
          bio: profile.public_persona || profile.vibe_sentence || null,
          city: profile.city || profile.geographic_base || null,
          portrait_url: character?.portrait_url || null,
        },
        is_lala: lalaId != null && Number(lalaId) === Number(profile.id),
        // The story's audience number, as Lala's header reads hers; apart from follows.
        followers: showId ? await require('../services/lalaFeedProfile').followersOf(db, showId, profile, at) : null,
        relation: await follows.relationToLala(db, profile.id, lalaId),
        ...(admin ? { character_id: character?.id || null } : {}),
      },
    });
  } catch (err) {
    console.error('[pulseFollows] profile read failed:', err);
    return res.status(500).json({ error: 'That profile could not be read.' });
  }
});

const MAX_PINS = 3;
const HIGHLIGHT_PHOTOS = 12;
const TAGGED_LIMIT = 60;

/**
 * The story's release boundary for a profile's pictures (Evoni, 2026-11-15):
 * pinned posts, Tagged and Highlights are of posts released at the reader's
 * story moment, by the rule the feed applies (services/storyClock readerAt and
 * postOrderSql; services/pulseReveals). null means no boundary: an ADMIN who
 * named no moment. Anyone else always has one, of the show they named.
 *   sql        a condition on feed_posts aliased fp (its show, its story time)
 *   shows(id)  whether a post's pictures may show (not hidden, not a first look)
 *   listed(id) whether a post may be listed at all (not hidden)
 */
async function releaseBoundary(db, { showId, at }) {
  if (at === undefined) return null;
  const clock = require('../services/storyClock');
  const order = clock.postOrderSql('fp');
  const { lalaProfileId } = require('../services/lalaFeedProfile');
  const reveals = await require('../services/pulseReveals').revealsAt(db, showId, at, { lalaProfileId: await lalaProfileId(db.sequelize) });
  return {
    sql: `AND fp.show_id = :showId AND (${order} IS NULL OR ${order} <= ${Number(at)})`,
    listed: (postId) => reveals.stateOf('post', postId) !== 'hidden',
    shows: (postId) => reveals.stateOf('post', postId) === 'revealed' && reveals.stateOf('image', postId, 'post_photo') === 'revealed',
  };
}

router.get('/profile/:handle/media', requireAuth, async (req, res) => {
  const handle = String(req.params.handle || '');
  if (!HANDLE_RE.test(handle)) return res.status(400).json({ error: 'handle is not a Pulse handle' });
  const { show_id: showId } = req.query;
  if (showId !== undefined && (typeof showId !== 'string' || !UUID_RE.test(showId))) {
    return res.status(400).json({ error: 'show_id must be a UUID' });
  }
  try {
    const db = getModels();
    const profile = await pulseProfile(db, HANDLE_MATCH, { handle: bareHandle(handle) });
    if (!profile) return res.status(404).json({ error: 'Nobody on The Pulse has that handle.' });
    // The reader's story moment is the server's to decide, not the page's (services/storyClock readerAt).
    const admin = userInGroup(req.user, 'admin');
    // With no show there is no present to read at: nothing is shown to anyone but an ADMIN.
    if (!admin && !showId) return res.json({ data: { pinned: [], tagged: [], highlights: [] } });
    let at;
    if (showId) {
      try { at = await require('../services/storyClock').readerAt(db, showId, req.query.at, { admin }); } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        throw err;
      }
    }
    const boundary = await releaseBoundary(db, { showId, at });
    const within = boundary ? boundary.sql : '';
    const [pinRows] = await db.sequelize.query(
      `SELECT fp.id FROM feed_posts fp WHERE fp.social_profile_id = :id AND fp.pinned_at IS NOT NULL AND fp.status = 'live' AND fp.deleted_at IS NULL ${within}
        ORDER BY fp.pinned_at DESC LIMIT ${MAX_PINS}`, { replacements: { id: profile.id, showId: showId || null } });
    const pins = boundary ? pinRows.filter((p) => boundary.listed(p.id)) : pinRows;
    const [[character]] = await db.sequelize.query(
      `SELECT id FROM registry_characters WHERE feed_profile_id = :id AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
      { replacements: { id: profile.id } });
    let tagged = [];
    let highlights = [];
    if (character) {
      // Photos someone else posted with them in it: public pictures only, on live posts.
      const [rows] = await db.sequelize.query(
        `SELECT DISTINCT ON (ma.id) ma.id AS asset_id, ma.url, ma.caption, fp.id AS post_id, fp.poster_handle, fp.posted_at
           FROM media_asset_links me
           JOIN media_assets ma ON ma.id = me.asset_id AND ma.deleted_at IS NULL AND ma.status = 'approved' AND ma.visibility = 'public'
           JOIN media_asset_links lp ON lp.asset_id = ma.id AND lp.entity_type = 'post' AND lp.deleted_at IS NULL
           JOIN feed_posts fp ON fp.id::text = lp.entity_id AND fp.status = 'live' AND fp.deleted_at IS NULL
          WHERE me.entity_type = 'character' AND me.entity_id = :cid AND me.role = 'pictured' AND me.deleted_at IS NULL
            AND COALESCE(fp.social_profile_id, 0) <> :pid ${within}
          ORDER BY ma.id, fp.posted_at DESC NULLS LAST`,
        { replacements: { cid: String(character.id), pid: profile.id, showId: showId || null } });
      const taggedRows = boundary ? rows.filter((r) => boundary.shows(r.post_id)) : rows;
      tagged = taggedRows.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0)).slice(0, TAGGED_LIMIT)
        .map((r) => ({ ...r, poster_handle: String(r.poster_handle || '').replace(/^@/, '') }));
      // Highlights: their posted camera-roll photos by album (services/cameraRoll; public only).
      const roll = await require('../services/cameraRoll').rollFor(db, character.id, { audience: 'public' });
      if (roll.eligible) {
        // Within the boundary a camera-roll photo shows only once a post that carries it is released:
        // a photo has no story time of its own, so one no released post carries stays back.
        let released = null;
        if (boundary && roll.photos.length) {
          const [carried] = await db.sequelize.query(
            `SELECT lp.asset_id, fp.id AS post_id FROM media_asset_links lp
               JOIN feed_posts fp ON fp.id::text = lp.entity_id AND fp.status = 'live' AND fp.deleted_at IS NULL
              WHERE lp.entity_type = 'post' AND lp.deleted_at IS NULL AND lp.asset_id IN (:assets) ${within}
             UNION
             SELECT m.asset_id, fp.id AS post_id FROM camera_roll_moments m
               JOIN feed_posts fp ON fp.id = m.post_id AND fp.status = 'live' AND fp.deleted_at IS NULL
              WHERE m.asset_id IN (:assets) AND m.deleted_at IS NULL ${within}`,
            { replacements: { assets: roll.photos.map((p) => p.asset_id), showId: showId || null } });
          released = new Set(carried.filter((r) => boundary.shows(r.post_id)).map((r) => String(r.asset_id)));
        }
        const shown = boundary ? roll.photos.filter((p) => released && released.has(String(p.asset_id))) : roll.photos;
        highlights = roll.albums.map((a) => {
          const all = shown.filter((p) => p.album === a.key);
          const photos = all.slice(0, HIGHLIGHT_PHOTOS).map((p) => ({ asset_id: p.asset_id, url: p.url, caption: p.caption }));
          return { key: a.key, label: a.label, count: all.length, cover: photos[0]?.url || null, photos };
        }).filter((a) => a.count > 0);
      }
    }
    return res.json({ data: { pinned: pins.map((p) => p.id), tagged, highlights } });
  } catch (err) {
    console.error('[pulseFollows] profile media read failed:', err);
    return res.status(500).json({ error: 'Their photos could not be read.' });
  }
});

async function setPin(req, res, on) {
  const { postId } = req.params;
  if (!UUID_RE.test(String(postId))) return res.status(400).json({ error: 'postId must be a post id' });
  try {
    const db = getModels();
    const post = await db.FeedPost.findOne({ where: { id: postId, deleted_at: null } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (on) {
      if (post.status !== 'live') return res.status(409).json({ error: 'Only a post on The Pulse can be pinned.' });
      if (!post.pinned_at) {
        const [[row]] = await db.sequelize.query(
          `SELECT COUNT(*)::int AS n FROM feed_posts WHERE social_profile_id = :pid AND pinned_at IS NOT NULL
            AND status = 'live' AND deleted_at IS NULL AND id <> :id`, { replacements: { pid: post.social_profile_id, id: post.id } });
        if ((row?.n || 0) >= MAX_PINS) return res.status(409).json({ error: `They already have ${MAX_PINS} pinned posts. Unpin one first.` });
        await post.update({ pinned_at: new Date() });
      }
    } else if (post.pinned_at) {
      await post.update({ pinned_at: null });
    }
    return res.json({ data: { id: post.id, pinned_at: post.pinned_at } });
  } catch (err) {
    console.error(`[pulseFollows] ${on ? 'pin' : 'unpin'} failed:`, err);
    return res.status(500).json({ error: 'The pin could not be saved.' });
  }
}
router.put('/posts/:postId/pin', requireAuth, authorize(['ADMIN']), (req, res) => setPin(req, res, true));
router.delete('/posts/:postId/pin', requireAuth, authorize(['ADMIN']), (req, res) => setPin(req, res, false));

/** PUT and DELETE for one direction of following Lala. */
function lalaFollowRoutes(path, lalaIsFollower) {
  const change = (on) => async (req, res) => {
    const id = Number(req.params.profileId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'profileId must be a profile id' });
    try {
      const db = getModels();
      const profile = await pulseProfile(db, 'id = :id', { id });
      if (!profile) return res.status(404).json({ error: 'Nobody on The Pulse has that profile.' });
      const lalaId = await follows.lalaProfile(db);
      if (lalaId == null) return res.status(409).json({ error: "Lala has no Pulse profile yet." });
      if (Number(lalaId) === id) return res.status(400).json({ error: 'Lala does not follow herself.' });
      const [follower, followed] = lalaIsFollower ? [lalaId, id] : [id, lalaId];
      if (on) await follows.follow(db, follower, followed, { source: 'evoni', by: byOf(req) });
      else await follows.unfollow(db, follower, followed);
      return res.json({ data: await follows.relationToLala(db, id, lalaId) });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      console.error(`[pulseFollows] ${path} ${on ? 'follow' : 'unfollow'} failed:`, err);
      return res.status(500).json({ error: 'That follow could not be saved.' });
    }
  };
  router.put(`/:profileId/${path}`, requireAuth, authorize(['ADMIN']), change(true));
  router.delete(`/:profileId/${path}`, requireAuth, authorize(['ADMIN']), change(false));
}
lalaFollowRoutes('follows-lala', false);
lalaFollowRoutes('lala-follows', true);

module.exports = router;
