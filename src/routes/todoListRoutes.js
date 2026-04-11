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

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch {
  optionalAuth = (req, res, next) => next();
}

router.post('/episodes/:episodeId/todo/generate', optionalAuth, async (req, res) => {
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
router.post('/episodes/:episodeId/todo/generate-career', optionalAuth, async (req, res) => {
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

router.get('/episodes/:episodeId/todo', optionalAuth, async (req, res) => {
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

router.post('/episodes/:episodeId/todo/complete/:slot', optionalAuth, async (req, res) => {
  try {
    const { episodeId, slot } = req.params;
    const { completed = true } = req.body;
    const { sequelize } = req.app.get('models') || require('../models');

    const [todoList] = await sequelize.query(
      'SELECT id, tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!todoList) return res.status(404).json({ error: 'No to-do list found' });

    const tasks = (typeof todoList.tasks === 'string'
      ? JSON.parse(todoList.tasks)
      : todoList.tasks
    ).map(t => t.slot === slot ? { ...t, completed } : t);

    await sequelize.query(
      'UPDATE episode_todo_lists SET tasks = :tasks, updated_at = NOW() WHERE id = :id',
      { replacements: { tasks: JSON.stringify(tasks), id: todoList.id } }
    );

    const completion = {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      all_required_done: tasks.filter(t => t.required).every(t => t.completed),
    };

    return res.json({ success: true, tasks, completion });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── SAVE TASK SELECTION (include/exclude tasks) ──────────────────────────────

router.post('/episodes/:episodeId/todo/save-selection', optionalAuth, async (req, res) => {
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

router.post('/episodes/:episodeId/todo/lock', optionalAuth, async (req, res) => {
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

    return res.json({ success: true, message: `Checklist locked with ${includedTasks.length} tasks`, assetUrl });
  } catch (err) {
    console.error('[TodoList] Lock error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── UNLOCK CHECKLIST ────────────────────────────────────────────────────────

router.post('/episodes/:episodeId/todo/unlock', optionalAuth, async (req, res) => {
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
router.post('/episodes/:episodeId/todo/complete-social/:slot', optionalAuth, async (req, res) => {
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
      required_total: socialTasks.filter(t => t.required).length,
      required_done: socialTasks.filter(t => t.required && t.completed).length,
      score: Math.round((socialTasks.filter(t => t.completed).length / socialTasks.length) * 10),
    };

    return res.json({ success: true, social_tasks: socialTasks, completion });
  } catch (err) {
    console.error('Complete social task error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /episodes/:episodeId/todo/social — Get social tasks with completion status
router.get('/episodes/:episodeId/todo/social', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { sequelize } = req.app.get('models') || require('../models');

    const [todoList] = await sequelize.query(
      'SELECT social_tasks, financial_summary FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!todoList) return res.json({ success: true, social_tasks: [], financial_summary: null });

    let socialTasks = todoList.social_tasks;
    if (typeof socialTasks === 'string') socialTasks = JSON.parse(socialTasks);

    let financialSummary = todoList.financial_summary;
    if (typeof financialSummary === 'string') financialSummary = JSON.parse(financialSummary);

    const completion = {
      total: (socialTasks || []).length,
      completed: (socialTasks || []).filter(t => t.completed).length,
      score: (socialTasks || []).length > 0 ? Math.round(((socialTasks || []).filter(t => t.completed).length / socialTasks.length) * 10) : 0,
    };

    return res.json({ success: true, social_tasks: socialTasks || [], financial_summary: financialSummary, completion });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
