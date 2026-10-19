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
    const profile = await pulseProfile(db, 'LOWER(handle) = LOWER(:handle)', { handle: handle.replace(/^@/, '') });
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
