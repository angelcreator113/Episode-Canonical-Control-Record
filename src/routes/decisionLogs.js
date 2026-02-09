const express = require('express');
const router = express.Router();
const { DecisionLog } = require('../models');
const { optionalAuth } = require('../middleware/auth');

// Create decision log
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      episode_id,
      scene_id,
      action_type,
      entity_type,
      entity_id,
      action_data,
      context_data
    } = req.body;

    const log = await DecisionLog.create({
      episode_id,
      scene_id,
      user_id: req.user?.sub,
      action_type,
      entity_type,
      entity_id,
      action_data,
      context_data
    });

    res.status(201).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error creating decision log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get decision logs for episode (for AI analysis)
router.get('/episode/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { action_type, limit = 100 } = req.query;

    const where = { episode_id: episodeId };
    if (action_type) where.action_type = action_type;

    const logs = await DecisionLog.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching decision logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get decision logs for scene
router.get('/scene/:sceneId', optionalAuth, async (req, res) => {
  try {
    const { sceneId } = req.params;

    const logs = await DecisionLog.findAll({
      where: { scene_id: sceneId },
      order: [['timestamp', 'DESC']]
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching scene decision logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
