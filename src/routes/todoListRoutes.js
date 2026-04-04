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

module.exports = router;
