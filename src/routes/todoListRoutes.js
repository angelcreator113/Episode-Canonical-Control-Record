'use strict';

/**
 * Episode To-Do List Routes
 * Mount at: /api/v1/episodes/:episodeId/todo
 *
 * POST /generate        — Generate to-do list from linked event
 * GET  /                — Get current to-do list with completion state
 * POST /complete/:slot  — Mark a slot as complete
 */

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { isSocialTaskRequired } = require('../utils/socialTaskSource');

const WARDROBE_COMPLETION_DERIVED = 'WARDROBE_COMPLETION_DERIVED';

router.post('/episodes/:episodeId/todo/generate', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    const models = req.app.get('models') || require('../models');
    const { generateEpisodeTodoList } = require('../services/todoListService');
    const result = await generateEpisodeTodoList(episodeId, showId, models);

    return res.json({
      success: true,
      message: `To-do list generated — ${result.tasks.length} tasks for "${result.eventName}"`,
      data: result,
    });
  } catch (err) {
    console.error('[TodoList] Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /episodes/:episodeId/todo/generate-career — Generate career to-do list
router.post('/episodes/:episodeId/todo/generate-career', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showId } = req.body;

    const models = req.app.get('models') || require('../models');
    const { generateCareerList } = require('../services/todoListService');
    const result = await generateCareerList(episodeId, showId, models);

    return res.json({
      success: true,
      message: `Career list generated — ${result.tasks.length} tasks for "${result.eventName}"`,
      data: result,
    });
  } catch (err) {
    console.error('[CareerList] Generate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/episodes/:episodeId/todo', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const models = req.app.get('models') || require('../models');
    const { getTodoList } = require('../services/todoListService');
    const todoList = await getTodoList(episodeId, models);

    if (!todoList) {
      return res.json({ data: null, message: 'No to-do list yet. POST /generate to create one.' });
    }

    return res.json({ data: todoList });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/episodes/:episodeId/todo/complete/:slot', requireAuth, async (req, res) => {
  try {
    const { episodeId, slot } = req.params;
    const { completed = true } = req.body;
    const { sequelize } = req.app.get('models') || require('../models');

    const [todoList] = await sequelize.query(
      'SELECT id, tasks, social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!todoList) return res.status(404).json({ error: 'No to-do list found' });

    const tasks = typeof todoList.tasks === 'string'
      ? JSON.parse(todoList.tasks)
      : todoList.tasks || [];

    const socialTasksRaw = typeof todoList.social_tasks === 'string'
      ? JSON.parse(todoList.social_tasks || '[]')
      : (todoList.social_tasks || []);
    const slotInSocial = socialTasksRaw.some(t => t.slot === slot);

    // T7 (§8(bb); Task #2307): a wardrobe task's completion comes from Lala's
    // outfit (getTodoList derives it from episode_wardrobe on every read),
    // so it has no manual toggle; one written here was silently replaced.
    // A slot on the social list is still completed here.
    if (!slotInSocial) {
      if (tasks.some(t => t.slot === slot)) {
        return res.status(409).json({
          success: false,
          code: WARDROBE_COMPLETION_DERIVED,
          error: 'A wardrobe task is complete when Lala\'s outfit fills its slot. Choose the piece in the episode\'s wardrobe instead.',
        });
      }
      return res.status(404).json({ error: `No task with slot "${slot}"` });
    }

    const updatedSocialTasks = socialTasksRaw.map(t => t.slot === slot ? { ...t, completed } : t);
    await sequelize.query(
      'UPDATE episode_todo_lists SET social_tasks = :socialTasks, updated_at = NOW() WHERE id = :id',
      { replacements: { socialTasks: JSON.stringify(updatedSocialTasks), id: todoList.id } }
    );

    const allTasks = [...tasks, ...updatedSocialTasks];
    const completion = {
      total: allTasks.length,
      completed: allTasks.filter(t => t.completed).length,
      // Wardrobe slots keep their own flag; a social task counts only when a
      // deliverable stands behind it (T1, §8(bb); Task #2292).
      all_required_done: [...tasks.filter(t => t.required), ...updatedSocialTasks.filter(isSocialTaskRequired)].every(t => t.completed),
      social_tasks_completed: updatedSocialTasks.filter(t => t.completed).length,
      social_tasks_total: updatedSocialTasks.length,
    };

    return res.json({ success: true, tasks, social_tasks: updatedSocialTasks, completion });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── SAVE TASK SELECTION (include/exclude tasks) ──────────────────────────────

router.post('/episodes/:episodeId/todo/save-selection', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array is required' });

    const { sequelize } = req.app.get('models') || require('../models');

    await sequelize.query(
      'UPDATE episode_todo_lists SET tasks = :tasks, updated_at = NOW() WHERE episode_id = :episodeId AND deleted_at IS NULL',
      { replacements: { tasks: JSON.stringify(tasks), episodeId } }
    );

    return res.json({ success: true, message: 'Task selection saved' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── LOCK CHECKLIST (finalize selection + regenerate asset) ───────────────────

router.post('/episodes/:episodeId/todo/lock', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { sequelize } = req.app.get('models') || require('../models');

    const [todoList] = await sequelize.query(
      'SELECT * FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!todoList) return res.status(404).json({ error: 'No to-do list found' });

    const tasks = typeof todoList.tasks === 'string' ? JSON.parse(todoList.tasks) : todoList.tasks;
    const includedTasks = tasks.filter(t => t.included !== false);

    if (includedTasks.length === 0) return res.status(400).json({ error: 'At least one task must be included' });

    // Get event for rendering
    const [event] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId: todoList.event_id }, type: sequelize.QueryTypes.SELECT }
    );

    // Regenerate asset with only included tasks
    const { renderTodoAsset } = require('../services/todoListService');
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { v4: uuidv4 } = require('uuid');

    const buffer = renderTodoAsset(includedTasks, event || {});

    const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const s3 = new S3Client({ region: AWS_REGION });
    const s3Key = `todo-lists/${episodeId}/${uuidv4()}-locked.png`;

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
      ContentType: 'image/png', CacheControl: 'max-age=31536000',
    }));

    const assetUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    await sequelize.query(
      `UPDATE episode_todo_lists SET status = 'locked', asset_url = :assetUrl, updated_at = NOW() WHERE episode_id = :episodeId`,
      { replacements: { assetUrl, episodeId } }
    );

    // Materialize the locked PNG as an Asset row so the rest of the
    // system (timeline placements, video composition, asset library)
    // can reference it by FK. Idempotent: skip if a wardrobe-list
    // asset for this episode already exists; refresh its URL instead.
    let assetId = null;
    try {
      const [existing] = await sequelize.query(
        `SELECT id FROM assets
          WHERE episode_id = :episodeId
            AND asset_role = 'UI.OVERLAY.WARDROBE_LIST'
            AND deleted_at IS NULL
          LIMIT 1`,
        { replacements: { episodeId } }
      );
      if (existing && existing.length) {
        assetId = existing[0].id;
        await sequelize.query(
          `UPDATE assets SET s3_url_processed = :assetUrl, updated_at = NOW() WHERE id = :id`,
          { replacements: { assetUrl, id: assetId } }
        );
      } else {
        const newAssetId = uuidv4();
        await sequelize.query(
          `INSERT INTO assets (id, asset_type, asset_role, asset_scope, episode_id, name, s3_url_processed, approval_status, created_at, updated_at)
           VALUES (:id, 'UI_OVERLAY', 'UI.OVERLAY.WARDROBE_LIST', 'EPISODE', :episodeId, :name, :assetUrl, 'approved', NOW(), NOW())`,
          { replacements: { id: newAssetId, episodeId, name: `Wardrobe Checklist — ${event?.name || 'Episode'}`, assetUrl } }
        );
        assetId = newAssetId;
      }
    } catch (assetErr) {
      // Asset creation shouldn't block the lock response — the PNG is
      // already in S3 and the todo list row is updated.
      console.warn('[TodoList] Asset row creation skipped:', assetErr.message);
    }

    // Auto-place the wardrobe checklist on the first scene so the
    // timeline knows where to render it. Same idempotent helper used
    // by approve-invitation; failures are non-blocking.
    let placementId = null;
    if (assetId) {
      try {
        const models = req.app.get('models') || require('../models');
        const { placeOverlayOnFirstScene } = require('../services/timelinePlacementService');
        const placement = await placeOverlayOnFirstScene(models, {
          episodeId,
          assetId,
          defaults: {
            duration: 8,
            zIndex: 15,
            properties: { kind: 'wardrobe_checklist', source: 'todo-lock' },
          },
        });
        placementId = placement?.id || null;
      } catch (placeErr) {
        console.warn('[TodoList] Placement skipped:', placeErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Checklist locked with ${includedTasks.length} tasks`,
      assetUrl,
      asset_id: assetId,
      placement_id: placementId,
    });
  } catch (err) {
    console.error('[TodoList] Lock error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── UNLOCK CHECKLIST ────────────────────────────────────────────────────────

router.post('/episodes/:episodeId/todo/unlock', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { sequelize } = req.app.get('models') || require('../models');

    await sequelize.query(
      `UPDATE episode_todo_lists SET status = 'generated', updated_at = NOW() WHERE episode_id = :episodeId AND deleted_at IS NULL`,
      { replacements: { episodeId } }
    );

    return res.json({ success: true, message: 'Checklist unlocked for editing' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /episodes/:episodeId/todo/complete-social/:slot — Mark a social task as complete
router.post('/episodes/:episodeId/todo/complete-social/:slot', requireAuth, async (req, res) => {
  try {
    const { episodeId, slot } = req.params;
    const { completed = true } = req.body;
    const { sequelize } = req.app.get('models') || require('../models');

    const [todoList] = await sequelize.query(
      'SELECT id, social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!todoList) return res.status(404).json({ error: 'No to-do list found' });

    let socialTasks = todoList.social_tasks;
    if (typeof socialTasks === 'string') socialTasks = JSON.parse(socialTasks);
    if (!Array.isArray(socialTasks)) return res.status(400).json({ error: 'No social tasks found' });

    socialTasks = socialTasks.map(t => t.slot === slot ? { ...t, completed } : t);

    await sequelize.query(
      'UPDATE episode_todo_lists SET social_tasks = :tasks, updated_at = NOW() WHERE id = :id',
      { replacements: { tasks: JSON.stringify(socialTasks), id: todoList.id } }
    );

    const completion = {
      total: socialTasks.length,
      completed: socialTasks.filter(t => t.completed).length,
      // T1 (§8(bb); Task #2292): only a task backed by a deliverable counts
      // as required; a stored pre-T1 required: true alone does not.
      required_total: socialTasks.filter(isSocialTaskRequired).length,
      required_done: socialTasks.filter(t => isSocialTaskRequired(t) && t.completed).length,
      score: Math.round((socialTasks.filter(t => t.completed).length / socialTasks.length) * 10),
    };

    return res.json({ success: true, social_tasks: socialTasks, completion });
  } catch (err) {
    console.error('Complete social task error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /episodes/:episodeId/todo/social — Get social tasks with completion status
router.get('/episodes/:episodeId/todo/social', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { sequelize } = req.app.get('models') || require('../models');

    const [todoList] = await sequelize.query(
      'SELECT social_tasks, financial_summary FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );

    // T4 (§8(bb); Task #2300): the Career Checklist's saved image, so the
    // view reloads it with the list. The newest live row, the one Regenerate
    // updates.
    let careerAssetUrl = null;
    try {
      const [careerAsset] = await sequelize.query(
        `SELECT s3_url_processed, s3_url_raw FROM assets
         WHERE episode_id = :episodeId AND asset_role = 'UI.OVERLAY.CAREER_LIST' AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
      );
      careerAssetUrl = careerAsset?.s3_url_processed || careerAsset?.s3_url_raw || null;
    } catch (assetErr) {
      console.error('[TodoList] career asset read failed (no image returned):', assetErr.message);
    }

    if (!todoList) return res.json({ success: true, social_tasks: [], financial_summary: null, career_asset_url: careerAssetUrl });

    let socialTasks = todoList.social_tasks;
    if (typeof socialTasks === 'string') socialTasks = JSON.parse(socialTasks);

    let financialSummary = todoList.financial_summary;
    if (typeof financialSummary === 'string') financialSummary = JSON.parse(financialSummary);

    const completion = {
      total: (socialTasks || []).length,
      completed: (socialTasks || []).filter(t => t.completed).length,
      score: (socialTasks || []).length > 0 ? Math.round(((socialTasks || []).filter(t => t.completed).length / socialTasks.length) * 10) : 0,
    };

    return res.json({ success: true, social_tasks: socialTasks || [], financial_summary: financialSummary, completion, career_asset_url: careerAssetUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
