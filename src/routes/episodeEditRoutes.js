'use strict';

/**
 * Timeline C1 (Evoni, 2026-10-28; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 6, R5.6):
 * the episode's edit. Mounted at /api/v1/episodes/:episodeId/edit. Server
 * only in C1: no page calls these yet, and the legacy Timeline Editor's
 * routes and data are untouched.
 *
 *   GET    /                         the live edit: edit_revision and every live row
 *   GET    /layout?t=ms              layoutAt: the scene and the PIP at t
 *   GET    /mix                      mixPlan: commentary, dialogue, music and SFX events
 *   GET    /findings                 review readiness: blocking findings and warnings
 *   GET    /versions                 named versions;  GET /versions/:versionId  one, with its snapshot
 *   POST   /beats/:beat/mode         { prime_mode: required | gameplay_only, note }
 *   POST   /beats/:beat/duration     { duration_ms (null: draft timing), dry_run } (dry_run: what would move; no write)
 *   POST   /beats/lock               { durations?: { beat: ms } } all 14 beats' lengths, in one write
 *   POST   /dialogue                 { approval_id, association_id, anchor_kind: beat_start | edit_start, anchor_beat, offset_ms }
 *   POST   /dialogue/:itemId/move    { anchor_kind, anchor_beat, offset_ms }
 *   POST   /scene-clips              { beat_number, source_kind, source_id, source_in_ms, source_out_ms, duration_ms, position }
 *   PATCH  /scene-clips/:clipId      { source_in_ms, source_out_ms, duration_ms, position }
 *   POST   /segments                 { raw_clip_id, source_in_ms, source_out_ms, anchor_*, audio_*, layout }
 *   POST   /segments/:segmentId/move | trim-video | trim-audio | audio | layout | split | replace
 *   PUT    /pip                      { default_layout, default_visible, use_cutout }
 *   POST   /visibility               { scope: beat | range, beat_number | anchor_* and end_anchor_*, visible }
 *   POST   /items, /audio-items      timeline items and music/SFX items
 *   DELETE /scene-clips|segments|visibility|items|audio-items|dialogue/:id   (soft delete)
 *   POST   /versions                 { name };  POST /versions/:versionId/restore
 *
 * Every write sends edit_revision (409 EDIT_CHANGED when stale) and is
 * requireAuth + authorize(['ADMIN']); reads need a sign-in. Switched off
 * unless EPISODE_EDIT=on (every route then answers 404).
 */

const express = require('express');
const { requireAuth, authorize } = require('../middleware/auth');
const models = require('../models');
const edit = require('../services/episodeEditService');

const router = express.Router({ mergeParams: true });
const admin = [requireAuth, authorize(['ADMIN'])];

const enabled = () => String(process.env.EPISODE_EDIT || '').toLowerCase() === 'on';
router.use((req, res, next) => {
  if (enabled()) return next();
  return res.status(404).json({ success: false, error: 'The episode edit is not switched on', code: 'EPISODE_EDIT_OFF' });
});

const userOf = (req) => (req.user?.id ? String(req.user.id).slice(0, 255) : null);

function sendError(res, err, what) {
  if (err instanceof edit.EditError) {
    return res.status(err.status).json({ success: false, error: err.message, code: err.code, ...err.extra });
  }
  console.error(`[EpisodeEdit] ${what} failed:`, err.message);
  return res.status(500).json({ success: false, error: 'Something went wrong. Nothing was changed.' });
}

const handle = (what, fn) => async (req, res) => {
  try {
    return res.json({ success: true, data: await fn(req) });
  } catch (err) {
    return sendError(res, err, what);
  }
};

const s = () => models.sequelize;
const base = (req) => ({ episodeId: req.params.episodeId, editRevision: req.body?.edit_revision, userId: userOf(req), body: req.body || {} });

router.get('/', requireAuth, handle('read the edit', (req) => edit.loadEdit(s(), { episodeId: req.params.episodeId })));
router.get('/layout', requireAuth, handle('layout', (req) => edit.layoutAtTime(s(), { episodeId: req.params.episodeId, t: req.query.t })));
router.get('/mix', requireAuth, handle('mix plan', (req) => edit.mixPlanOf(s(), { episodeId: req.params.episodeId })));
router.get('/findings', requireAuth, handle('findings', (req) => edit.reviewReadiness(s(), { episodeId: req.params.episodeId })));
router.get('/versions', requireAuth, handle('list versions', (req) => edit.listVersions(s(), { episodeId: req.params.episodeId })));
router.get('/versions/:versionId', requireAuth, handle('read version', (req) => edit.getVersion(s(), { episodeId: req.params.episodeId, versionId: req.params.versionId })));

router.post('/beats/:beat/mode', ...admin, handle('beat mode', (req) => edit.setBeatMode(s(), {
  ...base(req), beatNumber: req.params.beat, primeMode: req.body?.prime_mode, note: req.body?.note,
})));

router.post('/beats/lock', ...admin, handle('lock beat timing', (req) => edit.lockBeatTiming(s(), { ...base(req), durations: req.body?.durations ?? null })));
router.post('/beats/:beat/duration', ...admin, handle('beat duration', (req) => edit.setBeatDuration(s(), {
  ...base(req), beatNumber: req.params.beat, durationMs: req.body?.duration_ms === undefined ? undefined : req.body.duration_ms, dryRun: req.body?.dry_run,
})));

router.post('/dialogue', ...admin, handle('place dialogue', (req) => edit.placeDialogue(s(), base(req))));
router.post('/dialogue/:itemId/move', ...admin, handle('move dialogue', (req) => edit.moveDialogue(s(), { ...base(req), itemId: req.params.itemId })));

router.post('/scene-clips', ...admin, handle('place scene clip', (req) => edit.placeSceneClip(s(), base(req))));
router.patch('/scene-clips/:clipId', ...admin, handle('update scene clip', (req) => edit.updateSceneClip(s(), { ...base(req), clipId: req.params.clipId })));

router.post('/segments', ...admin, handle('place segment', (req) => edit.placeSegment(s(), base(req))));
const SEGMENT_ACTIONS = {
  move: edit.moveSegment,
  'trim-video': edit.trimSegmentVideo,
  'trim-audio': edit.trimSegmentAudio,
  audio: edit.setSegmentAudio,
  layout: edit.setSegmentLayout,
  split: edit.splitSegment,
  replace: edit.replaceTake,
};
for (const [action, fn] of Object.entries(SEGMENT_ACTIONS)) {
  router.post(`/segments/:segmentId/${action}`, ...admin, handle(`segment ${action}`, (req) => fn(s(), { ...base(req), segmentId: req.params.segmentId })));
}

router.put('/pip', ...admin, handle('PIP settings', (req) => edit.setPipSettings(s(), base(req))));
router.post('/visibility', ...admin, handle('visibility rule', (req) => edit.addVisibilityRule(s(), base(req))));
router.post('/items', ...admin, handle('timeline item', (req) => edit.addItem(s(), base(req))));
router.post('/audio-items', ...admin, handle('audio item', (req) => edit.addAudioItem(s(), base(req))));

const REMOVE = { 'scene-clips': 'scene_clip', segments: 'segment', visibility: 'visibility', items: 'item', 'audio-items': 'audio_item', dialogue: 'dialogue' };
for (const [path, what] of Object.entries(REMOVE)) {
  router.delete(`/${path}/:id`, ...admin, handle(`remove ${what}`, (req) => edit.removeRow(s(), { ...base(req), what, id: req.params.id })));
}

router.post('/versions', ...admin, handle('save version', (req) => edit.createVersion(s(), { ...base(req), name: req.body?.name })));
router.post('/versions/:versionId/restore', ...admin, handle('restore version', (req) => edit.restoreVersion(s(), { ...base(req), versionId: req.params.versionId })));

module.exports = router;
