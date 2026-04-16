/**
 * phonePlaythroughRoutes — reader-facing, episode-scoped playable phone runtime.
 *
 * Mounted under `/api/v1/episodes/:episodeId/phone-state`. All routes require an
 * authenticated user (Cognito Bearer token via `authenticate` middleware) so
 * playthroughs can't leak across sessions.
 *
 * The server runs the SAME phoneRuntime evaluator the editor preview uses, so a
 * condition that unlocks a zone in preview unlocks it the same way for real
 * readers. Only difference: here the writer persists to the DB.
 *
 * Routes:
 *   GET    /            — current state row (creates if missing)
 *   POST   /tap         — apply a zone's actions; returns new state + effects
 *   POST   /reset       — clear flags + visited + completion
 *   POST   /complete    — mark the playthrough complete (also triggered by
 *                         `complete_episode` action via /tap)
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth');
const runtime = require('../services/phoneRuntime');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadOrCreateState(models, { userId, episodeId }) {
  // Fetch the show_id once; a row without it would fail foreign-key checks
  // and we want a clear 404 if the episode doesn't exist.
  const [eps] = await models.sequelize.query(
    `SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId } }
  );
  const episode = eps?.[0];
  if (!episode) return { error: 'episode not found' };

  let state = await models.PhonePlaythroughState.findOne({
    where: { user_id: userId, episode_id: episodeId, deleted_at: null },
  });
  if (!state) {
    state = await models.PhonePlaythroughState.create({
      user_id: userId,
      episode_id: episodeId,
      show_id: episode.show_id,
      state_flags: {},
      visited_screens: [],
    });
  }
  return { state, showId: episode.show_id };
}

async function loadScreenZone(models, { showId, zoneId }) {
  // Zones live inside asset metadata.screen_links[]. Pull any asset on this show
  // that contains the zone — in practice, the client sent `screen_id` so we
  // could index faster, but scanning is fine for PR2.
  const [rows] = await models.sequelize.query(
    `SELECT id, metadata::text AS metadata_text
     FROM assets
     WHERE show_id = :showId AND deleted_at IS NULL AND category IN ('phone', 'phone_icon')`,
    { replacements: { showId } }
  );
  for (const row of rows || []) {
    let meta = {};
    try { meta = JSON.parse(row.metadata_text || '{}'); } catch { /* noop */ }
    const links = meta.screen_links || [];
    const match = links.find(l => l.id === zoneId);
    if (match) return { zone: match, screenAssetId: row.id };
  }
  return { zone: null };
}

// Serialize state in the same shape the client expects — keeps the "editor
// preview = server runtime" guarantee tight.
function serializeState(state) {
  return {
    id: state.id,
    user_id: state.user_id,
    episode_id: state.episode_id,
    show_id: state.show_id,
    state_flags: state.state_flags || {},
    visited_screens: state.visited_screens || [],
    completed_mission_ids: state.completed_mission_ids || [],
    last_screen_id: state.last_screen_id,
    started_at: state.started_at,
    updated_at: state.updated_at,
    completed_at: state.completed_at,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/v1/episodes/:episodeId/phone-state
router.get('/', authenticate, async (req, res) => {
  try {
    const models = require('../models');
    const { state, error } = await loadOrCreateState(models, {
      userId: req.user.id,
      episodeId: req.params.episodeId,
    });
    if (error) return res.status(404).json({ success: false, error });
    return res.json({ success: true, state: serializeState(state) });
  } catch (err) {
    console.error('[phonePlaythroughRoutes] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/episodes/:episodeId/phone-state/tap
// Body: { zone_id, screen_id? }
// Runs the zone's actions through the central evaluator, persists state changes,
// and returns { state, effects } so the client can navigate / show toasts.
router.post('/tap', authenticate, async (req, res) => {
  try {
    const models = require('../models');
    const { zone_id, screen_id } = req.body || {};
    if (!zone_id) return res.status(400).json({ success: false, error: 'zone_id is required' });

    const { state, showId, error } = await loadOrCreateState(models, {
      userId: req.user.id,
      episodeId: req.params.episodeId,
    });
    if (error) return res.status(404).json({ success: false, error });

    const { zone } = await loadScreenZone(models, { showId, zoneId: zone_id });
    if (!zone) return res.status(404).json({ success: false, error: 'zone not found on any screen in this show' });

    // Enforce visibility server-side too. A client that tries to tap a zone that
    // SHOULDN'T be visible (condition returns false) gets 403 — can't exploit.
    const visitedSet = new Set(state.visited_screens || []);
    const evalCtx = { state: state.state_flags || {}, visitedScreens: visitedSet };
    if (!runtime.evaluate(zone.conditions, evalCtx)) {
      return res.status(403).json({ success: false, error: 'zone is currently locked' });
    }

    // Build a writer that stages mutations; we apply them in one DB write below.
    const nextFlags = { ...(state.state_flags || {}) };
    let episodeNowComplete = false;
    const writer = {
      setState: (key, value) => { nextFlags[key] = value; },
      markEpisodeComplete: () => { episodeNowComplete = true; },
    };

    const actions = runtime.actionsForZone(zone);
    const effects = runtime.applyActions(actions, evalCtx, writer);

    // Track visited_screens: the *target* of a navigate counts as visited. If
    // the zone has an explicit screen_id param (e.g. the client already is on
    // that screen before tapping), we could also push current screen — skipped
    // for now to keep this narrow.
    const nextVisited = [...visitedSet];
    if (effects.navigate && !nextVisited.includes(effects.navigate)) {
      nextVisited.push(effects.navigate);
      if (nextVisited.length > 200) nextVisited.splice(0, nextVisited.length - 200);
    }

    // Apply zone-action mutations up-front so mission evaluation sees the new
    // state. Missions only fire rewards on the transition from incomplete →
    // complete; completed_mission_ids is the "already fired" tracker.
    state.state_flags = nextFlags;
    state.visited_screens = nextVisited;

    let newlyCompletedMissions = [];
    try {
      const [missionRows] = await models.sequelize.query(
        `SELECT id, name, description, start_condition, objectives, reward_actions, is_active, episode_id
         FROM phone_missions
         WHERE show_id = :showId AND deleted_at IS NULL
           AND (episode_id = :episodeId OR episode_id IS NULL)`,
        { replacements: { showId, episodeId: req.params.episodeId } }
      );
      const missionCtx = { state: nextFlags, visitedScreens: new Set(nextVisited) };
      const rewardWriter = {
        setState: (k, v) => { nextFlags[k] = v; },
        markEpisodeComplete: () => { if (!state.completed_at) state.completed_at = new Date(); },
      };
      const rewardResult = runtime.applyMissionRewards({
        missions: missionRows || [],
        prevCompletedIds: state.completed_mission_ids || [],
        context: missionCtx,
        writer: rewardWriter,
      });
      if (rewardResult.newlyCompletedIds.length) {
        const next = [...(state.completed_mission_ids || []), ...rewardResult.newlyCompletedIds];
        state.completed_mission_ids = next;
        newlyCompletedMissions = rewardResult.newlyCompletedMissions;
      }
      // Merge reward-triggered effects into the response effects. Navigate
      // prefers the zone's own navigate; rewards only override if the zone
      // didn't set one (e.g. set_state zone triggers mission → navigate reward).
      if (!effects.navigate && rewardResult.effects.navigate) effects.navigate = rewardResult.effects.navigate;
      if (rewardResult.effects.toasts.length) effects.toasts.push(...rewardResult.effects.toasts);
      if (rewardResult.effects.completeEpisode) effects.completeEpisode = true;

      // Reward set_state mutations may have further changed nextFlags. Re-assign.
      state.state_flags = nextFlags;
    } catch (missionErr) {
      // Fail open: if mission evaluation errors (e.g. table not yet migrated),
      // don't fail the tap — the zone's primary action has already applied.
      console.warn('[phonePlaythroughRoutes] mission reward eval skipped:', missionErr.message);
    }

    if (effects.navigate) state.last_screen_id = effects.navigate;
    if (episodeNowComplete && !state.completed_at) state.completed_at = new Date();
    await state.save();

    return res.json({ success: true, state: serializeState(state), effects, newly_completed_missions: newlyCompletedMissions });
  } catch (err) {
    console.error('[phonePlaythroughRoutes] tap error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/episodes/:episodeId/phone-state/reset
router.post('/reset', authenticate, async (req, res) => {
  try {
    const models = require('../models');
    const { state, error } = await loadOrCreateState(models, {
      userId: req.user.id,
      episodeId: req.params.episodeId,
    });
    if (error) return res.status(404).json({ success: false, error });
    state.state_flags = {};
    state.visited_screens = [];
    state.completed_mission_ids = [];
    state.last_screen_id = null;
    state.completed_at = null;
    state.started_at = new Date();
    await state.save();
    return res.json({ success: true, state: serializeState(state) });
  } catch (err) {
    console.error('[phonePlaythroughRoutes] reset error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/episodes/:episodeId/phone-state/complete
router.post('/complete', authenticate, async (req, res) => {
  try {
    const models = require('../models');
    const { state, error } = await loadOrCreateState(models, {
      userId: req.user.id,
      episodeId: req.params.episodeId,
    });
    if (error) return res.status(404).json({ success: false, error });
    if (!state.completed_at) state.completed_at = new Date();
    await state.save();
    return res.json({ success: true, state: serializeState(state) });
  } catch (err) {
    console.error('[phonePlaythroughRoutes] complete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
