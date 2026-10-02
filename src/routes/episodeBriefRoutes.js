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
    } catch (angleErr) {
      console.error('[ScenePlanner] beat angle status failed:', angleErr.message);
    }

    return res.json({
      data,
      count: plans.length,
      readiness,
      feed_moment_missing: feedMomentMissing,
      ...(feedMomentCheckError ? { feed_moment_check_error: feedMomentCheckError } : {}),
    });
  } catch (err) {
    console.error('[ScenePlanner] plan read failed:', err.message);
    return res.status(500).json({ error: err.message });
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

const dressedUpload = require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
}).fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 1 }]);

function dressedError(res, err, label) {
  const { DressedAngleError } = require('../services/dressedAngleService');
  if (err instanceof DressedAngleError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  console.error(`[DressedAngle] ${label} failed:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

router.post('/:episodeId/dressed-angles/:angleId/brief', requireAuth, async (req, res) => {
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

router.post('/:episodeId/dressed-angles/:angleId/generate', requireAuth, aiRateLimiter, async (req, res) => {
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

router.post('/:episodeId/dressed-angles/:angleId/upload', requireAuth, dressedUpload, async (req, res) => {
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

// ── GENERATE GROUNDED SCRIPT ──────────────────────────────────────────────────

router.post('/:episodeId/generate-script', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    if (!showId) {
      return res.status(400).json({ error: 'showId is required in request body' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } });
    if (!brief) {
      return res.status(400).json({ error: 'Episode Brief not found. Create the Brief first.' });
    }

    const episodeForGuard = await Episode.findByPk(episodeId);
    if (scriptOverwriteBlocked(episodeForGuard?.script_content, req.body)) {
      console.warn(`[ScriptGen] Refused overwrite for episode ${episodeId}: existing script_content present, no confirmOverwrite flag.`);
      return res.status(409).json(scriptOverwriteRefusalBody());
    }

    console.log(`[ScriptGen] Generating grounded script for episode: ${episodeId}`);

    const { generateGroundedScript } = require('../services/groundedScriptGeneratorService');
    const models = require('../models');
    const script = await generateGroundedScript(episodeId, showId, models);

    // Save script to episode
    try {
      const episode = episodeForGuard || await models.Episode.findByPk(episodeId);
      if (episode) {
        await episode.update({ script_content: script });
      }
    } catch (saveErr) {
      console.warn('[ScriptGen] Could not save to episode:', saveErr.message);
    }

    return res.json({ success: true, script, episodeId });
  } catch (err) {
    console.error('[ScriptGen] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── REWRITE SINGLE LINE (with Show Brain voice DNA) ───────────────────────────

router.post('/:episodeId/rewrite-line', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { line, speaker, beatName, beatContext, showId: _showId } = req.body;
    if (!line) return res.status(400).json({ error: 'line is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    // Load voice DNA from Show Brain
    const models = require('../models');
    let voiceLaws = '';
    try {
      if (models.FranchiseKnowledge) {
        const laws = await models.FranchiseKnowledge.findAll({
          where: { status: 'active', always_inject: true },
          attributes: ['title', 'content', 'category'], limit: 30,
        });
        // For line rewrites, prioritize voice/character rules but include all
        const voiceFirst = laws.sort((a, b) => {
          const aVoice = /voice|lala|jawihp|character/i.test(a.title) ? 0 : 1;
          const bVoice = /voice|lala|jawihp|character/i.test(b.title) ? 0 : 1;
          return aVoice - bVoice;
        });
        voiceLaws = voiceFirst
          .map(l => { try { const c = JSON.parse(l.content); return `${l.title}: ${c.summary || c.rule || ''}`; } catch { return l.title; } })
          .join('\n');
      }
    } catch (err) { console.warn('[RewriteLine] Failed to load voice laws:', err?.message); }

    const isLala = speaker === 'Lala';
    const isPrime = speaker === 'Prime' || speaker === 'Me';

    const prompt = `You are rewriting a single line of dialogue for "Styling Adventures with Lala."

${voiceLaws ? `SHOW BRAIN VOICE RULES:\n${voiceLaws}\n\n` : ''}
SPEAKER: ${speaker}
BEAT: ${beatName || 'Unknown'}
${beatContext ? `EMOTIONAL CONTEXT: ${beatContext}\n` : ''}
ORIGINAL LINE: ${line}

${isLala ? 'Rewrite as Lala — confident, short, punchy, calls people "bestie", slightly dramatic, always positive. Max 2 sentences.' : ''}
${isPrime ? 'Rewrite as JAWIHP (Prime) — warm, direct, addresses "besties", reacts naturally, community-focused.' : ''}
${!isLala && !isPrime ? `Rewrite naturally for ${speaker}.` : ''}

Return ONLY the rewritten dialogue. No speaker prefix, no quotes, no explanation.`;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] });
    const rewrittenLine = response.content[0]?.text?.trim() || line;

    return res.json({ rewrittenLine, original: line });
  } catch (err) {
    console.error('[RewriteLine] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── SCRIPT CONTEXT (for script generator) ─────────────────────────────────────

router.get('/:episodeId/script-context', requireAuth, async (req, res) => {
  try {
    const context = await getScenePlanForScriptGenerator(req.params.episodeId);
    return res.json({
      data: context,
      count: context.length,
      ready: context.every(b => b.locked),
      message: context.every(b => b.locked)
        ? 'All beats locked — ready for script generation.'
        : `${context.filter(b => !b.locked).length} beats still unlocked.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
