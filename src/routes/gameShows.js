const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');

/**
 * Get episode phases
 * GET /api/v1/episodes/:episodeId/phases
 */
router.get('/:episodeId/phases', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    const phases = await db.EpisodePhase.findAll({
      where: { episode_id: episodeId },
      order: [['start_time', 'ASC']],
      include: [
        {
          model: db.LayoutTemplate,
          as: 'layoutTemplate'
        }
      ]
    });

    res.json({ success: true, data: phases });

  } catch (error) {
    console.error('Failed to get phases:', error);
    res.status(500).json({ error: 'Failed to load phases' });
  }
});

/**
 * Create phases in bulk
 * POST /api/v1/episodes/:episodeId/phases/bulk
 */
router.post('/:episodeId/phases/bulk', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { phases } = req.body;
    
    // Calculate start/end times based on order
    let currentTime = 0;
    const phasesWithTiming = phases.map((phase, idx) => {
      const duration = phase.duration || 60; // default 60s per phase
      const start = currentTime;
      const end = currentTime + duration;
      currentTime = end;
      
      return {
        episode_id: episodeId,
        phase_name: phase.phase_name,
        start_time: start,
        end_time: end,
        layout_template_id: phase.layout_template_id,
        active_characters: phase.active_characters || {},
        phase_config: phase.phase_config || {}
      };
    });
    
    const created = await db.EpisodePhase.bulkCreate(phasesWithTiming);

    res.json({ success: true, data: created });

  } catch (error) {
    console.error('Failed to create phases:', error);
    res.status(500).json({ error: 'Failed to create phases' });
  }
});

/**
 * Get layout templates for show
 * GET /api/v1/shows/:showId/layouts
 */
router.get('/:showId/layouts', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    
    const layouts = await db.LayoutTemplate.findAll({
      where: { show_id: showId }
    });

    res.json({ success: true, data: layouts });

  } catch (error) {
    console.error('Failed to get layouts:', error);
    res.status(500).json({ error: 'Failed to load layouts' });
  }
});

/**
 * Create layout template
 * POST /api/v1/shows/:showId/layouts
 */
router.post('/:showId/layouts', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { name, layout_type, regions, transition_in, transition_out } = req.body;
    
    const layout = await db.LayoutTemplate.create({
      show_id: showId,
      name,
      layout_type,
      regions,
      transition_in,
      transition_out
    });

    res.json({ success: true, data: layout });

  } catch (error) {
    console.error('Failed to create layout:', error);
    res.status(500).json({ error: 'Failed to create layout' });
  }
});

/**
 * Get interactive elements for episode
 * GET /api/v1/episodes/:episodeId/interactive
 */
router.get('/:episodeId/interactive', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    const elements = await db.InteractiveElement.findAll({
      where: { episode_id: episodeId },
      order: [['appears_at', 'ASC']]
    });

    res.json({ success: true, data: elements });

  } catch (error) {
    console.error('Failed to get interactive elements:', error);
    res.status(500).json({ error: 'Failed to load elements' });
  }
});

/**
 * Add interactive element
 * POST /api/v1/episodes/:episodeId/interactive
 */
router.post('/:episodeId/interactive', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const elementData = req.body;
    
    const element = await db.InteractiveElement.create({
      episode_id: episodeId,
      ...elementData
    });

    res.json({ success: true, data: element });

  } catch (error) {
    console.error('Failed to create interactive element:', error);
    res.status(500).json({ error: 'Failed to create element' });
  }
});

module.exports = router;
