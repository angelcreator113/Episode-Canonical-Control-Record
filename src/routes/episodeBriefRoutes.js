'use strict';

/**
 * Episode Brief + Scene Planner Routes
 * Mount at: /api/v1/episode-brief
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const models = require('../models');
const { EpisodeBrief, ScenePlan, Episode, SceneSet } = models;
const { generateScenePlan, getScenePlanForScriptGenerator } = require('../services/scenePlannerService');
const { scriptOverwriteBlocked, scriptOverwriteRefusalBody } = require('../utils/scriptOverwriteGuard');
const { missingFeedMomentBeats, retryMissingFeedMoments } = require('../services/feedMomentSaveService');
const { selectInjectedRules } = require('../services/brainRules');

const SHOW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET / CREATE BRIEF ────────────────────────────────────────────────────────

router.get('/:episodeId', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;

    let brief = await EpisodeBrief.findOne({
      where: { episode_id: episodeId, deleted_at: null },
    });

    if (!brief) {
      const episode = await Episode.findByPk(episodeId);
      if (!episode) return res.status(404).json({ error: 'Episode not found' });

      brief = await EpisodeBrief.create({
        episode_id: episodeId,
        show_id: episode.show_id,
        status: 'draft',
      });
    }

    return res.json({ data: brief });
  } catch (err) {
    console.error('[EpisodeBrief] GET error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── UPDATE BRIEF ──────────────────────────────────────────────────────────────

router.put('/:episodeId', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) return res.status(404).json({ error: 'Brief not found. GET first to auto-create.' });

    if (brief.status === 'locked') {
      return res.status(409).json({ error: 'Brief is locked. Unlock before editing.' });
    }

    // Terms lock (§8(x) D4; Task #2230): the brief's event is the episode's
    // source event (§8(w) P2). Once set it cannot be changed or cleared here.
    if (req.body.event_id !== undefined && brief.event_id
        && String(req.body.event_id ?? '') !== String(brief.event_id)) {
      return res.status(409).json({
        error: "This episode was started from an event, so its source event can't change. Its terms and episode link are locked.",
        code: 'EVENT_TERMS_LOCKED',
        fields: ['event_id'],
      });
    }

    const updatable = [
      'arc_number', 'position_in_arc', 'episode_archetype',
      'narrative_purpose', 'designed_intent', 'allowed_outcomes',
      'forward_hook', 'lala_state_snapshot', 'event_id', 'event_difficulty',
    ];

    const updates = {};
    for (const field of updatable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    await brief.update(updates);
    return res.json({ data: brief });
  } catch (err) {
    console.error('[EpisodeBrief] PUT error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── MUST COVER: HER MARKS ─────────────────────────────────────────────────────
// PUT /:episodeId/cover-marks { key, covered: true | false | null, beat? }
// The Script tab's "Mark covered" / "Not covered" on a must-cover item
// (Evoni, 2026-10-24: "smarter matching + manual override"). Kept on the
// brief as event_metadata.cover_marks[key] = { covered, beat?, at, by }
// (utils/coverMatch coverKey, withMark); covered: null takes the mark back.
// Only that key of event_metadata is written, in a transaction with the row
// locked; no migration: event_metadata is an existing JSONB column. A locked
// brief still takes marks: they say what the script does, not the brief.
const COVER_KEY = /^(?:goal:[a-z0-9_]{1,80}:[a-z0-9-]{0,200}|carried:[A-Za-z0-9-]{1,64}|hook|opportunity)$/;
router.put('/:episodeId/cover-marks', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { key, covered = null, beat = null } = req.body || {};
    if (!SHOW_ID_RE.test(String(episodeId))) return res.status(400).json({ error: 'episodeId must be a UUID' });
    if (typeof key !== 'string' || !COVER_KEY.test(key)) return res.status(400).json({ error: 'key must be a must-cover item key (goal:…, carried:…, hook or opportunity)' });
    if (covered !== null && typeof covered !== 'boolean') return res.status(400).json({ error: 'covered must be true, false or null' });
    if (beat !== null && (!Number.isInteger(beat) || beat < 1 || beat > 14)) return res.status(400).json({ error: 'beat must be 1-14' });
    const { sequelize } = models;
    const marks = await sequelize.transaction(async (transaction) => {
      const [brief] = await sequelize.query(
        'SELECT id, event_metadata FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction });
      if (!brief) return null;
      let meta = brief.event_metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch (err) { console.error('[EpisodeBrief] event_metadata unreadable:', err.message); meta = {}; }
      }
      const current = meta && typeof meta.cover_marks === 'object' && meta.cover_marks && !Array.isArray(meta.cover_marks) ? meta.cover_marks : {};
      const next = { ...current };
      if (covered === null) delete next[key];
      else next[key] = { covered, ...(covered && beat !== null ? { beat } : {}), at: new Date().toISOString(), by: req.user?.id ?? req.user?.sub ?? null };
      await sequelize.query(
        `UPDATE episode_briefs
            SET event_metadata = jsonb_set(COALESCE(event_metadata, '{}'::jsonb), '{cover_marks}', CAST(:marks AS jsonb)), updated_at = NOW()
          WHERE id = :id`,
        { replacements: { marks: JSON.stringify(next), id: brief.id }, transaction });
      return next;
    });
    if (!marks) return res.status(404).json({ error: 'Brief not found. GET first to auto-create.' });
    return res.json({ data: { cover_marks: marks } });
  } catch (err) {
    console.error('[EpisodeBrief] cover marks PUT error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK BRIEF ────────────────────────────────────────────────────────────────

router.post('/:episodeId/lock', requireAuth, async (req, res) => {
  try {
    const brief = await EpisodeBrief.findOne({ where: { episode_id: req.params.episodeId } });
    if (!brief) return res.status(404).json({ error: 'Brief not found' });

    await brief.update({ status: 'locked' });
    return res.json({ data: brief, message: 'Brief locked.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GENERATE SCENE PLAN (AI) ──────────────────────────────────────────────────

router.post('/:episodeId/generate-plan', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { episodeId } = req.params;

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) {
      return res.status(400).json({
        error: 'Create and fill out the Episode Brief before generating a plan.',
      });
    }

    const episode = await Episode.findByPk(episodeId);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    console.log(`[ScenePlanner] Generating plan for episode: ${episodeId}`);

    const plan = await generateScenePlan(episodeId, episode.show_id, brief.toJSON(), { save: true });

    return res.json({
      success: true,
      message: `Scene plan generated — ${plan.length} beats mapped.`,
      data: plan,
    });
  } catch (err) {
    console.error('[ScenePlanner] generate error:', err);
    // A refused budget is a 429 with its code, not a 500 (eighth audit).
    if (err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429) return res.status(429).json({ error: err.message, code: 'AI_BUDGET_EXCEEDED' });
    return res.status(500).json({ error: err.message });
  }
});

// ── GET SCENE PLAN ────────────────────────────────────────────────────────────

router.get('/:episodeId/plan', requireAuth, async (req, res) => {
  try {
    let feedMomentMissing = null;
    let feedMomentCheckError = null;
    try {
      feedMomentMissing = await missingFeedMomentBeats(models, req.params.episodeId);
    } catch (checkErr) {
      console.error('[ScenePlanner] feed moment check failed:', checkErr.message);
      feedMomentCheckError = checkErr.message;
    }

    const plans = await ScenePlan.findAll({
      where: { episode_id: req.params.episodeId, deleted_at: null },
      order: [['beat_number', 'ASC']],
      include: [{
        model: SceneSet,
        as: 'sceneSet',
        attributes: ['id', 'name', 'scene_type', 'script_context', 'base_still_url'],
        required: false,
      }],
    });

    // Audit GATE-01 (2026-10-03): exact coverage of the 14 canonical beats,
    // the one result every readiness surface reads.
    const { beatPlanCoverage } = require('../utils/beatPlanCoverage');
    const coverage = beatPlanCoverage(plans);

    // L4 (§8(hh), Q19): each beat's angle and what is missing ("<Kind>
    // angle missing — Upload image / Generate angle"). A failed read leaves
    // the plan without it.
    // L5, Q21: how many beats have their image; flagged, never blocking.
    let data = plans;
    let readiness = null;
    try {
      const { planWithAngles, planReadiness } = require('../services/planLocationsService');
      data = await planWithAngles(models.sequelize, plans.map((p) => p.toJSON()));
      readiness = planReadiness(data);
      // L12a: each beat's scene row, brought up to date ("Open in Studio").
      const { syncBeatScenesQuietly, beatSceneIds } = require('../services/beatScenesService');
      await syncBeatScenesQuietly(models.sequelize, req.params.episodeId, 'GET plan');
      const sceneIds = await beatSceneIds(models.sequelize, req.params.episodeId);
      data = data.map((b) => ({ ...b, scene_id: sceneIds.get(b.id) || null }));
    } catch (angleErr) {
      console.error('[ScenePlanner] beat angle status failed:', angleErr.message);
    }

    return res.json({
      data,
      count: plans.length,
      coverage,
      readiness,
      feed_moment_missing: feedMomentMissing,
      ...(feedMomentCheckError ? { feed_moment_check_error: feedMomentCheckError } : {}),
    });
  } catch (err) {
    console.error('[ScenePlanner] plan read failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── PRODUCTION COVERAGE ───────────────────────────────────────────────────────
// §8(o) item 2 (episode creation step 8): per canonical beat, the four
// indicators (Environment, JustAWoman clip, Lala clip, Interface), what each
// requires and what is met, and the first required thing still missing.
// Reads only (productionCoverageService).

router.get('/:episodeId/production-coverage', requireAuth, async (req, res) => {
  try {
    const { loadCoverage } = require('../services/productionCoverageService');
    const coverage = await loadCoverage(models, req.params.episodeId);
    return res.json({ success: true, data: coverage });
  } catch (err) {
    console.error('[ProductionCoverage] read failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PERFORMANCE CLIPS ─────────────────────────────────────────────────────────
// The clip home agreed with episode creation step 8 (§8(o) item 2): one
// JustAWoman or Lala clip per canonical beat (episode_performance_clips,
// performanceClipsService). PUT attaches or replaces the beat's clip for a
// performer; DELETE removes it (soft).

router.get('/:episodeId/performance-clips', requireAuth, async (req, res) => {
  try {
    const { listClips } = require('../services/performanceClipsService');
    return res.json({ success: true, data: await listClips(models.sequelize, req.params.episodeId) });
  } catch (err) {
    console.error('[PerformanceClips] list failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:episodeId/performance-clips', requireAuth, async (req, res) => {
  try {
    const { attachClip } = require('../services/performanceClipsService');
    const result = await attachClip(models.sequelize, req.params.episodeId, req.body || {});
    return res.status(result.replaced ? 200 : 201).json({ success: true, data: result.clip, replaced: result.replaced });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    console.error('[PerformanceClips] attach failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:episodeId/performance-clips/:clipId', requireAuth, async (req, res) => {
  try {
    const { removeClip } = require('../services/performanceClipsService');
    const removed = await removeClip(models.sequelize, req.params.episodeId, req.params.clipId);
    if (!removed) return res.status(404).json({ success: false, error: 'Clip not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[PerformanceClips] remove failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── RETRY UNSAVED FEED MOMENTS ───────────────────────────────────────────────
// Re-runs the feed moment save for the beats the plan reports in
// feed_moment_missing, and only those (§8(w) P5, Task #2220). Template-built,
// no AI call.

router.post('/:episodeId/feed-moments/retry', requireAuth, async (req, res) => {
  try {
    const result = await retryMissingFeedMoments(models, req.params.episodeId);
    const feedMomentMissing = await missingFeedMomentBeats(models, req.params.episodeId);
    return res.json({ success: true, data: result, feed_moment_missing: feedMomentMissing });
  } catch (err) {
    console.error('[ScenePlanner] feed moment retry error:', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

// ── UPDATE SINGLE BEAT ────────────────────────────────────────────────────────

router.put('/:episodeId/plan/:beatNumber', requireAuth, async (req, res) => {
  try {
    const { episodeId, beatNumber } = req.params;

    const plan = await ScenePlan.findOne({
      where: { episode_id: episodeId, beat_number: parseInt(beatNumber, 10) },
    });
    if (!plan) return res.status(404).json({ error: 'Beat not found in plan' });
    if (plan.locked) return res.status(409).json({ error: 'Beat is locked. Unlock first.' });

    const updatable = ['scene_set_id', 'angle_label', 'shot_type', 'emotional_intent', 'transition_in', 'director_note'];
    const updates = { ai_suggested: false };
    for (const field of updatable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // L11 (§8(hh)): a set or angle Evoni chose in the beat editor marks the
    // beat "Chosen by you"; chosen: false hands it back to the plan.
    if (req.body.chosen === true && (req.body.scene_set_id !== undefined || req.body.angle_label !== undefined)) {
      updates.chosen_by_user = true;
    } else if (req.body.chosen === false) {
      updates.chosen_by_user = false;
    }

    let location = null;
    if (updates.scene_set_id) {
      const sceneSet = await SceneSet.findByPk(updates.scene_set_id);
      if (!sceneSet) return res.status(404).json({ error: 'Scene set not found' });
      updates.scene_context = sceneSet.script_context || sceneSet.canonical_description?.slice(0, 400);
      // L11: a set not yet linked to the episode joins its locations.
      const { linkBeatSet, EpisodeLocationsError } = require('../services/episodeLocationsService');
      try {
        location = await linkBeatSet(models.sequelize, { episodeId, sceneSetId: updates.scene_set_id });
      } catch (linkErr) {
        if (linkErr instanceof EpisodeLocationsError) {
          return res.status(linkErr.status).json({ error: linkErr.message, code: linkErr.code });
        }
        throw linkErr;
      }
    }

    await plan.update(updates);
    // L12a: the beat's scene row follows the beat.
    const { syncBeatScenesQuietly } = require('../services/beatScenesService');
    await syncBeatScenesQuietly(models.sequelize, episodeId, 'beat save');
    return res.json({ data: plan, ...(location ? { location } : {}) });
  } catch (err) {
    console.error('[ScenePlanner] beat update failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── DRESSED ANGLES (L10, §8(hh)) ─────────────────────────────────────────────
// "When an event has a dressed look, its episode's angles at that venue are
// made from the dressed look instead of the plain approved base." A beat at
// a set the episode's event has a finished look on makes its angle here:
//   POST .../dressed-angles/:angleId/brief     the brief and its cost (read only, S2)
//   POST .../dressed-angles/:angleId/generate  one Kontext edit of the look (202)
//   POST .../dressed-angles/:angleId/upload    an uploaded image is the dressed angle
// Without a look they answer 409 NO_LOOK, and the plain angle routes apply.

// A refused file is a 400 or 413 with its reason, not a 500 (audit, 2026-10-15).
const dressedUpload = require('../middleware/uploadOrRefuse').uploadOrRefuse(require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
}).fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 1 }]), { label: 'Dressed angle upload' });
// A malformed episode or angle id is a 400, not a database cast error (500).
const { validateUUIDParam } = require('../middleware/requestValidation');
const dressedIds = [validateUUIDParam('episodeId'), validateUUIDParam('angleId')];

function dressedError(res, err, label) {
  const { DressedAngleError } = require('../services/dressedAngleService');
  if (err instanceof DressedAngleError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  console.error(`[DressedAngle] ${label} failed:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

// S8 (Evoni, 2026-10-02; §8(dd), answer 2): "Dressed angles move onto the
// look in the panel." GET .../dressed-angles?scene_set_id= — the episode's
// look on that set and each of the set's angles with its dressed version:
// { look: { id, image_url } | null, angles: [{ id, label, name, kind,
// still_image_url, dressed: { status, image_url, error } | null }] }.
router.get('/:episodeId/dressed-angles', validateUUIDParam('episodeId'), requireAuth, async (req, res) => {
  try {
    const setId = req.query.scene_set_id;
    if (!setId || !/^[0-9a-f-]{36}$/i.test(String(setId))) return res.status(400).json({ success: false, error: 'scene_set_id is required' });
    const { episodeLooks, lookAngles } = require('../services/dressedAngleService');
    const look = (await episodeLooks(models.sequelize, req.params.episodeId)).get(setId) || null;
    if (!look) return res.json({ success: true, data: { look: null, angles: [] } });
    const dressed = await lookAngles(models.sequelize, [look.id]);
    const [angles] = await models.sequelize.query(
      `SELECT id, angle_label, angle_name, angle_kind, still_image_url FROM scene_angles
        WHERE scene_set_id = :setId AND deleted_at IS NULL ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
      { replacements: { setId } });
    return res.json({
      success: true,
      data: {
        look: { id: look.id, image_url: look.image_url },
        angles: angles.map((a) => {
          const d = dressed.get(`${look.id}:${a.id}`);
          return {
            id: a.id, label: a.angle_label, name: a.angle_name, kind: a.angle_kind || null, still_image_url: a.still_image_url || null,
            dressed: d ? { status: d.status, image_url: d.image_url || null, error: d.error || null } : null,
          };
        }),
      },
    });
  } catch (err) {
    return dressedError(res, err, 'list');
  }
});

router.post('/:episodeId/dressed-angles/:angleId/brief', ...dressedIds, requireAuth, async (req, res) => {
  try {
    const { dressedAngleBrief } = require('../services/dressedAngleService');
    const data = await dressedAngleBrief(models.sequelize, {
      episodeId: req.params.episodeId, angleId: req.params.angleId, overrides: req.body?.overrides,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return dressedError(res, err, 'brief');
  }
});

router.post('/:episodeId/dressed-angles/:angleId/generate', ...dressedIds, requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { startDressedAngle } = require('../services/dressedAngleService');
    const { result, run } = await startDressedAngle(models.sequelize, {
      episodeId: req.params.episodeId, angleId: req.params.angleId, overrides: req.body?.overrides,
    });
    res.status(202).json({ success: true, data: result });
    await run();
  } catch (err) {
    if (res.headersSent) {
      console.error('[DressedAngle] generate failed after answering:', err);
      return undefined;
    }
    return dressedError(res, err, 'generate');
  }
});

router.post('/:episodeId/dressed-angles/:angleId/upload', ...dressedIds, requireAuth, dressedUpload, async (req, res) => {
  try {
    const file = [...(req.files?.images || []), ...(req.files?.image || [])][0];
    if (!file) return res.status(400).json({ success: false, error: 'No image file provided' });
    const { saveUploadedDressedAngle, episodeLooks } = require('../services/dressedAngleService');
    const [[angle]] = await models.sequelize.query(
      'SELECT id, scene_set_id FROM scene_angles WHERE id = :id AND deleted_at IS NULL',
      { replacements: { id: req.params.angleId } });
    if (!angle) return res.status(404).json({ success: false, error: 'Angle not found', code: 'ANGLE_NOT_FOUND' });
    const look = (await episodeLooks(models.sequelize, req.params.episodeId)).get(angle.scene_set_id);
    if (!look) {
      return res.status(409).json({ success: false, error: "This episode's event has no finished look on this set; the plain angle is used", code: 'NO_LOOK' });
    }
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `scene-sets/${angle.scene_set_id}/looks/${look.id}/angles/${angle.id}/still-${Date.now()}.${ext}`;
    await new S3Client({ region }).send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: 'max-age=31536000',
    }));
    const data = await saveUploadedDressedAngle(models.sequelize, {
      episodeId: req.params.episodeId, angleId: angle.id, imageUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return dressedError(res, err, 'upload');
  }
});

// ── LOCK BEAT (toggle) ────────────────────────────────────────────────────────

router.post('/:episodeId/plan/:beatNumber/lock', requireAuth, async (req, res) => {
  try {
    const plan = await ScenePlan.findOne({
      where: { episode_id: req.params.episodeId, beat_number: parseInt(req.params.beatNumber, 10) },
    });
    if (!plan) return res.status(404).json({ error: 'Beat not found' });

    await plan.update({ locked: !plan.locked });
    return res.json({ data: plan, message: plan.locked ? 'Beat locked.' : 'Beat unlocked.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK ALL BEATS ────────────────────────────────────────────────────────────

router.post('/:episodeId/plan/lock-all', requireAuth, async (req, res) => {
  try {
    await ScenePlan.update({ locked: true }, { where: { episode_id: req.params.episodeId } });
    return res.json({ success: true, message: 'All beats locked — ready for script generation.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── RESUME SETUP (audit STATE-01) ─────────────────────────────────────────────
// Makes the scene-plan beats a partly initialised episode is missing and
// records the outcome on episodes.setup_status. Never a second episode.
router.post('/:episodeId/setup/resume', requireAuth, async (req, res) => {
  try {
    const { resumeEpisodeSetup } = require('../services/episodeGeneratorService');
    const result = await resumeEpisodeSetup(models, req.params.episodeId);
    if (!result) return res.status(404).json({ success: false, error: 'Episode not found' });
    const step = result.scene_plan;
    return res.json({
      success: result.setup_status.complete,
      ...(result.setup_status.complete ? {} : { error: `Setup is still incomplete: ${step.missing.length} beat${step.missing.length !== 1 ? 's' : ''} missing (${step.missing.join(', ')})`, code: 'SETUP_INCOMPLETE' }),
      data: result,
    });
  } catch (err) {
    console.error('[EpisodeBrief] POST /:episodeId/setup/resume error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GENERATE GROUNDED SCRIPT ──────────────────────────────────────────────────

router.post('/:episodeId/generate-script', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    if (!showId) {
      return res.status(400).json({ error: 'showId is required in request body' });
    }
    // A show id, as Regenerate one beat checks (Script page re-audit, 2026-10-19).
    if (!SHOW_ID_RE.test(String(showId))) return res.status(400).json({ error: 'showId must be a show id (UUID)' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) {
      return res.status(400).json({ error: 'Episode Brief not found. Create the Brief first.' });
    }

    const episodeForGuard = await Episode.findByPk(episodeId);
    // Script tab re-audit (2026-10-15): a brief can outlive its episode (a
    // deleted episode keeps its brief and its row, deleted_at set); nothing
    // is written for it.
    if (!episodeForGuard || episodeForGuard.deleted_at) return res.status(404).json({ error: 'Episode not found' });
    // The episode's own show: another show's overlays, phone and coins were
    // read into the prompt (Script page re-audit, 2026-10-19).
    if (episodeForGuard.show_id && String(episodeForGuard.show_id) !== String(showId)) {
      return res.status(400).json({ error: 'showId is not this episode\'s show' });
    }
    if (scriptOverwriteBlocked(episodeForGuard?.script_content, req.body)) {
      console.warn(`[ScriptGen] Refused overwrite for episode ${episodeId}: existing script_content present, no confirmOverwrite flag.`);
      return res.status(409).json(scriptOverwriteRefusalBody());
    }

    console.log(`[ScriptGen] Generating grounded script for episode: ${episodeId}`);

    const { generateGroundedScript } = require('../services/groundedScriptGeneratorService');
    const models = require('../models');
    // Locked beats (utils/scriptBeatLocks.js): Regenerate rewrites only the
    // unlocked beats; each locked one comes back word for word. The writer
    // reads the locked beats so the new ones fit around them (Evoni,
    // 2026-10-09: "If I regenerate does the script read the previous?").
    const { scriptKeepingLocks, splitScriptBeats, normalizeLockedBeats, withNumberedHeader } = require('../utils/scriptBeatLocks');
    const lockedNumbers = normalizeLockedBeats(episodeForGuard?.script_locked_beats);
    const lockedBeats = lockedNumbers.length
      ? splitScriptBeats(episodeForGuard?.script_content).beats.filter((b, i, all) => lockedNumbers.includes(b.number) && all.findIndex((x) => x.number === b.number) === i)
        // With its number written in, so the writer reads it as that beat
        // and not by its place (re-audit 2: it was saved twice).
        .map((b) => ({ ...b, text: withNumberedHeader(b.text, b.number) }))
      : [];
    // The writer returns the script with its coverage (utils/scriptCoverage.js).
    // A first draft with too few beats (a refusal, an empty reply) is not
    // saved over the script (Script tab re-audit, 2026-10-15). 422, not 502:
    // the page waits out a 502 as a timed-out gateway.
    let written;
    try {
      written = await generateGroundedScript(episodeId, showId, models, { lockedBeats });
    } catch (genErr) {
      if (genErr.code !== 'DRAFT_INCOMPLETE') throw genErr;
      console.error(`[ScriptGen] Episode ${episodeId}: ${genErr.message}`);
      return res.status(422).json({ success: false, saved: false, code: 'SCRIPT_DRAFT_INCOMPLETE', error: genErr.message });
    }
    const generated = typeof written === 'string' ? written : written?.script || '';
    // Writing the script takes minutes, and the page can approve a beat or
    // save while it runs (Script tab audit, 2026-10-15). The locks kept are
    // the episode's as they are now, not as they were when the request came
    // in, so a beat approved during the writing keeps its approved words.
    // A failed read keeps the paid script: it falls back to the first read.
    const current = (await Episode.findByPk(episodeId).catch((readErr) => {
      console.error('[ScriptGen] Could not re-read the episode before saving:', readErr.message);
      return null;
    })) || episodeForGuard;
    let locks = scriptKeepingLocks(current, generated);
    let script = locks.script;

    // Audit GATE-03 (2026-10-03): saving is part of success. A script that
    // was generated but not saved comes back saying so (success false,
    // saved false, the script kept), so the caller keeps the draft and
    // retries the save, never the paid generation.
    let saved = false;
    let saveError = null;
    try {
      if (!current) {
        saveError = 'Episode not found';
      } else {
        // History audit H11 (2026-10-24): the row is read again locked
        // (SELECT ... FOR UPDATE) with the kept version and the update in one
        // transaction, so a save or lock landing now can't lose a version;
        // the locks kept are the episode's as it is at this moment.
        await models.sequelize.transaction(async (transaction) => {
          const episode = (await Episode.findByPk(episodeId, { transaction, lock: transaction.LOCK.UPDATE })) || current;
          locks = scriptKeepingLocks(episode, generated);
          script = locks.script;
          // Version history: the script Regenerate replaces is kept first.
          const { snapshotScript } = require('../services/scriptVersions');
          await snapshotScript(models, episode, { source: 'generate', userId: req.user?.id, next: script, transaction });
          await episode.update({ script_content: script }, { transaction });
        });
        saved = true;
      }
    } catch (saveErr) {
      console.error('[ScriptGen] Could not save to episode:', saveErr.message);
      saveError = saveErr.message;
    }

    // §8(j) (episode creation step 7): every canonical beat keeps its number.
    // The script is saved as written either way; beats lists what was found
    // and missing names any canonical beat whose header did not come back.
    const { splitCanonicalBeats } = require('../utils/canonicalScriptBeats');
    const check = splitCanonicalBeats(script);
    if (!check.complete) {
      console.warn(`[ScriptGen] Episode ${episodeId}: canonical beats incomplete (missing ${check.missing.join(', ') || 'none'}; unknown ${check.unknown.join(', ') || 'none'}; out of order ${check.outOfOrder}).`);
    }
    const body = {
      success: saved, saved, script, episodeId,
      locked_kept: locks.kept,
      beats: check.beats.map(({ number, name }) => ({ number, name })),
      beat_check: { complete: check.complete, missing: check.missing, unknown: check.unknown, out_of_order: check.outOfOrder },
    };
    // What the saved script still does not cover, read again after the
    // locked beats went back, and the beats the writer rewrote to cover it.
    if (written && typeof written === 'object' && written.facts) {
      const { scriptCoverage } = require('../utils/scriptCoverage');
      body.coverage = {
        missing: scriptCoverage(script, written.facts).missing.map(({ kind, label, target }) => ({ kind, label, target })),
        fixed_beats: written.coverage?.fixed_beats || [],
        // Phone steps added before taps the phone couldn't make (utils/phonePaths.js).
        phone_steps: written.coverage?.phone_steps || 0,
        // The show's rules fixed after writing (utils/scriptShowRules.js).
        voice_clicks: written.coverage?.voice_clicks || 0,
        reveal_fixed: !!written.coverage?.reveal_fixed,
        // Each costing piece's coin line, added after its wear cue (utils/scriptMoney.js).
        coin_lines: written.coverage?.coin_lines || 0,
        // What code mended that the fix pass used to pay for (utils/scriptAutoFixes.js; Script page audit 3, 2026-10-19).
        auto_fixed: written.coverage?.auto_fixed || 0,
        // Story layers with nothing to draw on (utils/storyLayers.js).
        story_gaps: written.coverage?.story_gaps || [],
      };
    }
    if (!saved) {
      body.code = 'SCRIPT_GENERATED_NOT_SAVED';
      body.error = `The script was generated but could not be saved: ${saveError}`;
    }
    return res.json(body);
  } catch (err) {
    console.error('[ScriptGen] Error:', err.message);
    // A refused budget is a 429 with its code, not a 500 (Script page audit, 2026-10-19).
    if (err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429) return res.status(429).json({ error: err.message, code: 'AI_BUDGET_EXCEEDED' });
    return res.status(500).json({ error: err.message });
  }
});

// ── REGENERATE ONE BEAT ───────────────────────────────────────────────────────
// Evoni, 2026-10-09 (Task #2785): "what if I only want to regenerate a line
// or a beat?" The grounded prompt writes one beat again against the script
// as the page has it. Nothing is saved: the page puts the beat in place and
// Save keeps it, as with a rewritten line. A locked beat is refused.

router.post('/:episodeId/regenerate-beat', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId, script } = req.body;
    const beatNumber = Number(req.body.beatNumber);
    if (!showId || !SHOW_ID_RE.test(String(showId))) return res.status(400).json({ error: 'showId must be a show id (UUID)' });
    if (!Number.isInteger(beatNumber) || beatNumber < 1 || beatNumber > 14) return res.status(400).json({ error: 'beatNumber must be 1-14' });
    if (typeof script !== 'string' || script.length > 100000) return res.status(400).json({ error: 'script must be the script text (at most 100000 characters)' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) return res.status(400).json({ error: 'Episode Brief not found. Create the Brief first.' });
    const episode = await Episode.findByPk(episodeId);
    // A deleted episode keeps its row (deleted_at set); nothing is written for it.
    if (!episode || episode.deleted_at) return res.status(404).json({ error: 'Episode not found' });
    // The episode's own show, as Generate script checks (Script page audit 3,
    // 2026-10-19): another show's phone, overlays and coins were read into
    // the prompt.
    if (episode.show_id && String(episode.show_id) !== String(showId)) {
      return res.status(400).json({ error: 'showId is not this episode\'s show' });
    }
    const { normalizeLockedBeats } = require('../utils/scriptBeatLocks');
    if (normalizeLockedBeats(episode.script_locked_beats).includes(beatNumber)) {
      return res.status(409).json({ error: `Beat ${beatNumber} is locked. Unlock it to regenerate it.`, code: 'BEAT_LOCKED' });
    }

    const { generateGroundedBeat } = require('../services/groundedScriptGeneratorService');
    const models = require('../models');
    // Ask for a change (Script tab audit, 2026-10-15): optional, a string only, at most 300 characters.
    const instruction = typeof req.body.instruction === 'string' ? req.body.instruction.trim().slice(0, 300) : '';
    const beat = await generateGroundedBeat(episodeId, showId, models, { beatNumber, currentScript: script, instruction });
    if (!beat) return res.status(502).json({ error: 'The writer did not send back this beat; try again.' });
    return res.json({ success: true, beatNumber, beat });
  } catch (err) {
    console.error('[RegenerateBeat] Error:', err.message);
    // A refused budget is a 429 with its code, not a 500 (Script page audit, 2026-10-19).
    if (err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429) return res.status(429).json({ error: err.message, code: 'AI_BUDGET_EXCEEDED' });
    return res.status(500).json({ error: err.message });
  }
});

// ── REWRITE SINGLE LINE (with Show Brain voice DNA) ───────────────────────────

// Three versions of the line, each from its own angle (Evoni, 2026-10-25:
// "When I ask the script to rewrite it's basically writing the same
// thing."): Tighter, Punchier and New angle, in strict JSON, with a
// direction chip and her note when she gives them, her other lines as the
// voice to write in, and a must-differ rule the route checks
// (utils/rewriteLineVersions). On Sonnet, as the writing routes are
// (CLAUDE.md); the call goes through the SDK aiCostTracker patches, so it is
// logged and budget-gated like every other.
const MODELS = ['claude-sonnet-4-6'];
const REWRITE_MAX_TOKENS = 700;

/** One call, two attempts; a refused budget or a rate limit is not tried again. */
async function askRewrite(client, prompt) {
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await client.messages.create({ model, max_tokens: REWRITE_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] });
        return (response?.content || []).filter((b) => b && (b.type === 'text' || b.type === undefined) && typeof b.text === 'string').map((b) => b.text).join('').trim();
      } catch (modelErr) {
        console.error(`[RewriteLine] ${model} attempt ${attempt} failed:`, modelErr.message);
        if (modelErr?.code === 'AI_BUDGET_EXCEEDED' || modelErr?.status === 429 || (model === MODELS[MODELS.length - 1] && attempt === 2)) throw modelErr;
      }
    }
  }
  throw new Error('No model answered');
}

router.post('/:episodeId/rewrite-line', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const rv = require('../utils/rewriteLineVersions');
    const { line, speaker: rawSpeaker, beatName, beatContext } = req.body;
    // The beat the line sits in, so the rewrite reads what is already there
    // (Evoni, 2026-10-08); at most 40 lines of 600 characters.
    const beatLines = Array.isArray(req.body.beatLines)
      ? req.body.beatLines.filter((l) => typeof l === 'string' && l.trim()).slice(0, 40).map((l) => l.slice(0, 600))
      : [];
    // The show being written (the Script tab sends it), so the rules are its
    // own and the franchise's, never another show's (wiring map fix-list
    // item 25).
    const showId = req.body.showId || null;
    if (!line || typeof line !== 'string' || !line.trim()) return res.status(400).json({ error: 'line is required' });
    if (showId !== null && !SHOW_ID_RE.test(String(showId))) return res.status(400).json({ error: 'showId must be a show id (UUID)' });
    // A direction chip, her note (at most 300 characters) and up to eight of
    // the speaker's other lines (300 characters each).
    const opts = rv.readRewriteOptions(req.body);
    if (opts.error) return res.status(400).json({ error: opts.error });
    const { direction, instruction } = opts.value;
    const voiceSamples = opts.value.voiceSamples.filter((s) => s !== line.trim() && rv.spokenWords(s) !== rv.spokenWords(line));
    const speaker = typeof rawSpeaker === 'string' && rawSpeaker.trim() ? rawSpeaker.trim().slice(0, 60) : 'Prime';
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    // Voice DNA from Show Brain: voice and character rules first, at most 12,
    // so they do not drown the line.
    const models = require('../models');
    let voiceRules = [];
    try {
      if (models.FranchiseKnowledge) {
        // The first 30 always-inject rules in the show's scope and the
        // shared order (services/brainRules).
        const { rules: laws } = await selectInjectedRules(models.FranchiseKnowledge, { showId, limit: 30 });
        voiceRules = rv.voiceRulesFor(laws);
      }
    } catch (err) { console.warn('[RewriteLine] Failed to load voice laws:', err?.message); }

    const ask = { line, speaker, beatName, beatContext, beatLines, voiceRules, voiceSamples, direction, instruction };
    const prompt = rv.buildPrompt(ask);
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let versions = rv.parseVersions(await askRewrite(client, prompt));
    if (!versions.length) return res.status(502).json({ error: 'The writer sent back no rewrite we could read; try again.' });

    // Must differ: a version reusing more than 60% of the original's words
    // is asked for once more, bolder; still too close, it is dropped.
    const close = versions.filter((v) => rv.tooClose(line, v.text));
    let retried = false;
    if (close.length) {
      retried = true;
      try {
        const again = rv.parseVersions(await askRewrite(client, rv.buildPrompt({ ...ask, retry: { angles: close.map((v) => v.angle), previous: close } })));
        versions = versions.map((v) => {
          if (!close.includes(v)) return v;
          const fresh = again.find((a) => a.angle === v.angle) || (close.length === 1 && again.length === 1 ? { ...again[0], angle: v.angle } : null);
          return fresh && !rv.tooClose(line, fresh.text) ? fresh : v;
        });
      } catch (err) {
        // The first versions stand (a refused budget included); the check below still runs.
        console.error('[RewriteLine] bolder retry failed:', err.message);
      }
    }
    const differ = versions.filter((v) => !rv.tooClose(line, v.text));
    const tooSimilar = differ.length === 0;
    const kept = tooSimilar ? versions : differ;

    return res.json({
      rewrittenLine: kept[0].text,
      original: line,
      versions: kept,
      ...(tooSimilar ? { tooSimilar: true } : {}),
      ...(direction ? { direction } : {}),
      retried,
    });
  } catch (err) {
    console.error('[RewriteLine] Error:', err.message);
    // A refused budget is a 429 with its code, not a 500 (Script page audit, 2026-10-19).
    if (err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429) return res.status(429).json({ error: err.message, code: 'AI_BUDGET_EXCEEDED' });
    return res.status(500).json({ error: err.message });
  }
});

// ── SCRIPT CONTEXT (for script generator) ─────────────────────────────────────

router.get('/:episodeId/script-context', requireAuth, async (req, res) => {
  try {
    const context = await getScenePlanForScriptGenerator(req.params.episodeId);
    // Audit GATE-01 (2026-10-03): ready means every canonical beat is
    // planned once and locked; every(locked) alone was true for no beats.
    const { beatPlanCoverage } = require('../utils/beatPlanCoverage');
    const coverage = beatPlanCoverage(context);
    const unlocked = context.filter((b) => !b.locked).length;
    const ready = coverage.complete && unlocked === 0;
    let message;
    if (!coverage.complete) message = `Beat plan incomplete: ${coverage.text}.`;
    else if (unlocked) message = `${unlocked} beats still unlocked.`;
    else message = 'All beats locked — ready for script generation.';
    return res.json({ data: context, count: context.length, coverage, ready, message });
  } catch (err) {
    console.error('[ScriptContext] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
