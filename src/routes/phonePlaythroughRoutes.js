/**
 * phonePlaythroughRoutes — reader-facing, episode-scoped playable phone runtime.
 *
 * Mounted under `/api/v1/episodes/:episodeId/phone-state`. All routes require an
 * authenticated user (Cognito Bearer token via `requireAuth` middleware) so
 * playthroughs can't leak across sessions.
 *
 * The server runs the SAME phoneRuntime evaluator the editor preview uses, so a
 * condition that unlocks a zone in preview unlocks it the same way for real
 * readers. Only difference: here the writer persists to the DB.
 *
 * Routes:
 *   GET    /            — current state row (creates if missing)
 *   POST   /tap         — apply a zone's actions; returns new state + effects
 *   PUT    /screen      — remember the screen the player is on (Back, Home
 *                         and icon taps change it without /tap), so a reopened
 *                         play-through resumes there (Evoni, 2026-10-07); a
 *                         mission this visit completes fires its rewards
 *   POST   /reset       — clear flags + visited + completion
 *   POST   /complete    — mark the playthrough complete (also triggered by
 *                         `complete_episode` action via /tap)
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
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

  // Fail soft when the playthrough table hasn't been migrated yet.
  if (!models.PhonePlaythroughState) {
    return { error: 'phone playthrough not yet available on this environment' };
  }

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

// Find the tapped zone (phone audit, 2026-10-07). The client names the screen
// it is on (screen_asset_id); that screen is searched first, so two screens
// with a zone of the same id can't swap taps. Then the show-wide screens and
// this episode's own (persistent home icons live on the home screen) — never
// another episode's override.
async function loadScreenZone(models, { showId, episodeId, zoneId, screenAssetId = null }) {
  const [rows] = await models.sequelize.query(
    `SELECT id, metadata::text AS metadata_text
     FROM assets
     WHERE show_id = :showId AND deleted_at IS NULL AND asset_type = 'UI_OVERLAY'
       AND (episode_id IS NULL OR episode_id = :episodeId)`,
    { replacements: { showId, episodeId } }
  );
  const ordered = [...(rows || [])].sort((a, b) => (b.id === screenAssetId) - (a.id === screenAssetId));
  for (const row of ordered) {
    let meta = {};
    try { meta = JSON.parse(row.metadata_text || '{}'); } catch (parseErr) {
      console.error(`[phonePlaythroughRoutes] screen ${row.id} metadata is not JSON, skipped:`, parseErr.message);
    }
    const links = meta.screen_links || [];
    const match = links.find(l => l.id === zoneId);
    if (match) return { zone: match, screenAssetId: row.id };
  }
  return { zone: null };
}

const VISITED_CAP = 200;

function addVisited(visited, screenId) {
  const next = [...(visited || [])];
  if (screenId && !next.includes(screenId)) {
    next.push(screenId);
    if (next.length > VISITED_CAP) next.splice(0, next.length - VISITED_CAP);
  }
  return next;
}

// Fire the rewards of every mission the state just completed. Mutates
// `state` (flags, completed ids, completed_at) and `effects`; returns the
// missions that completed. Fails open: a mission error never fails the tap
// or the screen change that triggered it.
async function runMissionRewards(models, { state, showId, episodeId, effects }) {
  try {
    const [missionRows] = await models.sequelize.query(
      `SELECT id, name, description, start_condition, objectives, reward_actions, is_active, episode_id
       FROM phone_missions
       WHERE show_id = :showId AND deleted_at IS NULL
         AND (episode_id = :episodeId OR episode_id IS NULL)`,
      // Read outside the lock's transaction: a failed read (no table on an
      // old database) must not abort the transaction that saves the tap.
      { replacements: { showId, episodeId } }
    );
    const nextFlags = { ...(state.state_flags || {}) };
    const missionCtx = { state: nextFlags, visitedScreens: new Set(state.visited_screens || []) };
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
      state.completed_mission_ids = [...(state.completed_mission_ids || []), ...rewardResult.newlyCompletedIds];
    }
    // Navigate prefers the zone's own navigate; rewards only override if the
    // zone didn't set one (e.g. set_state zone triggers mission → navigate reward).
    if (!effects.navigate && rewardResult.effects.navigate) effects.navigate = rewardResult.effects.navigate;
    if (rewardResult.effects.toasts.length) effects.toasts.push(...rewardResult.effects.toasts);
    if (rewardResult.effects.completeEpisode) effects.completeEpisode = true;
    state.state_flags = nextFlags;
    return rewardResult.newlyCompletedMissions;
  } catch (missionErr) {
    console.warn('[phonePlaythroughRoutes] mission reward eval skipped:', missionErr.message);
    return [];
  }
}

// Run `fn` on the state row locked for this request, so two taps at once
// take turns instead of the second overwriting the first's flags.
async function withLockedState(models, state, fn) {
  return models.sequelize.transaction(async (transaction) => {
    const locked = await models.PhonePlaythroughState.findByPk(state.id, { transaction, lock: transaction.LOCK.UPDATE });
    return fn(locked, transaction);
  });
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
router.get('/', requireAuth, async (req, res) => {
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
router.post('/tap', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { zone_id } = req.body || {};
    if (!zone_id) return res.status(400).json({ success: false, error: 'zone_id is required' });

    const { state: initialState, showId, error } = await loadOrCreateState(models, {
      userId: req.user.id,
      episodeId: req.params.episodeId,
    });
    if (error) return res.status(404).json({ success: false, error });

    const screenAssetId = typeof req.body.screen_asset_id === 'string' ? req.body.screen_asset_id : null;
    const { zone } = await loadScreenZone(models, { showId, episodeId: req.params.episodeId, zoneId: zone_id, screenAssetId });
    if (!zone) return res.status(404).json({ success: false, error: 'zone not found on any screen in this show' });

    const result = await withLockedState(models, initialState, async (state, transaction) => {
      // Enforce visibility server-side too. A client that tries to tap a zone that
      // SHOULDN'T be visible (condition returns false) gets 403 — can't exploit.
      const visitedSet = new Set(state.visited_screens || []);
      const evalCtx = { state: state.state_flags || {}, visitedScreens: visitedSet };
      if (!runtime.evaluate(zone.conditions, evalCtx)) return { locked: true };

      // Build a writer that stages mutations; we apply them in one DB write below.
      const nextFlags = { ...(state.state_flags || {}) };
      let episodeNowComplete = false;
      const writer = {
        setState: (key, value) => { nextFlags[key] = value; },
        markEpisodeComplete: () => { episodeNowComplete = true; },
      };

      const actions = runtime.actionsForZone(zone);
      const effects = runtime.applyActions(actions, evalCtx, writer);

      // The *target* of a navigate counts as visited. Zone-action mutations
      // apply first so mission evaluation sees the new state; missions only
      // fire rewards on the transition from incomplete → complete.
      state.state_flags = nextFlags;
      state.visited_screens = addVisited(state.visited_screens, effects.navigate);
      const newlyCompletedMissions = await runMissionRewards(models, {
        state, showId, episodeId: req.params.episodeId, effects,
      });

      if (effects.navigate) state.last_screen_id = effects.navigate;
      if (episodeNowComplete && !state.completed_at) state.completed_at = new Date();
      await state.save({ transaction });
      return { state, effects, newlyCompletedMissions };
    });
    if (result.locked) return res.status(403).json({ success: false, error: 'zone is currently locked' });
    const { state, effects, newlyCompletedMissions } = result;

    return res.json({ success: true, state: serializeState(state), effects, newly_completed_missions: newlyCompletedMissions });
  } catch (err) {
    console.error('[phonePlaythroughRoutes] tap error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/episodes/:episodeId/phone-state/screen  { screen_id }
router.put('/screen', requireAuth, async (req, res) => {
  try {
    const screenId = typeof req.body?.screen_id === 'string' ? req.body.screen_id.trim() : '';
    if (!screenId || screenId.length > 255) return res.status(400).json({ success: false, error: 'screen_id is required' });
    const models = require('../models');
    const { state: initialState, showId, error } = await loadOrCreateState(models, {
      userId: req.user.id,
      episodeId: req.params.episodeId,
    });
    if (error) return res.status(404).json({ success: false, error });
    // Landing on a screen can finish a "visited" mission, so its rewards
    // fire here as they do on a tap (phone audit, 2026-10-07).
    const effects = { navigate: null, toasts: [], completeEpisode: false };
    const { state, newlyCompletedMissions } = await withLockedState(models, initialState, async (locked, transaction) => {
      locked.last_screen_id = screenId;
      locked.visited_screens = addVisited(locked.visited_screens, screenId);
      const done = await runMissionRewards(models, {
        state: locked, showId, episodeId: req.params.episodeId, effects,
      });
      await locked.save({ transaction });
      return { state: locked, newlyCompletedMissions: done };
    });
    return res.json({ success: true, state: serializeState(state), effects, newly_completed_missions: newlyCompletedMissions });
  } catch (err) {
    console.error('[phonePlaythroughRoutes] screen error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/episodes/:episodeId/phone-state/reset
router.post('/reset', requireAuth, async (req, res) => {
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
router.post('/complete', requireAuth, async (req, res) => {
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
