const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const db = require('../models');
const AWS = require('aws-sdk');

const sqs = new AWS.SQS();
const QUEUE_URL = process.env.ANALYSIS_QUEUE_URL;

/**
 * Trigger AI analysis for raw footage
 * POST /api/v1/raw-footage/:id/analyze
 */
router.post('/:id/analyze', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find raw footage (or create stub if doesn't exist for testing)
    let footage = await db.RawFootage?.findByPk(id);
    
    if (!footage) {
      return res.status(404).json({ error: 'Raw footage not found' });
    }

    // Create edit map record
    const editMap = await db.EditMap.create({
      episode_id: footage.episode_id,
      raw_footage_id: id,
      processing_status: 'pending',
      analysis_version: '1.0'
    });

    // Queue for processing if SQS is configured
    if (QUEUE_URL) {
      const message = {
        edit_map_id: editMap.id,
        raw_footage_id: id,
        s3_key: footage.s3_key,
        episode_id: footage.episode_id
      };

      await sqs.sendMessage({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(message)
      }).promise();
    }

    res.json({
      success: true,
      data: {
        edit_map_id: editMap.id,
        status: 'queued',
        message: 'AI analysis queued. Processing will take 2-5 minutes.',
        estimated_completion: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

  } catch (error) {
    console.error('Failed to queue analysis:', error);
    res.status(500).json({ error: 'Failed to start analysis' });
  }
});

/**
 * Get edit map for footage
 * GET /api/v1/raw-footage/:id/edit-map
 */
router.get('/:id/edit-map', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const editMap = await db.EditMap.findOne({
      where: { raw_footage_id: id },
      order: [['created_at', 'DESC']]
    });

    if (!editMap) {
      return res.status(404).json({ error: 'No edit map found' });
    }

    res.json({ success: true, data: editMap });

  } catch (error) {
    console.error('Failed to get edit map:', error);
    res.status(500).json({ error: 'Failed to load edit map' });
  }
});

/**
 * Update edit map (called by Lambda)
 * PUT /api/v1/edit-maps/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const editMap = await db.EditMap.findByPk(id);
    if (!editMap) {
      return res.status(404).json({ error: 'Edit map not found' });
    }

    await editMap.update(updates);

    res.json({ success: true, data: editMap });

  } catch (error) {
    console.error('Failed to update edit map:', error);
    res.status(500).json({ error: 'Failed to update edit map' });
  }
});

/**
 * Get character profiles for show
 * GET /api/v1/shows/:showId/characters
 */
router.get('/shows/:showId/characters', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    
    const characters = await db.CharacterProfile.findAll({
      where: { show_id: showId }
    });

    res.json({ success: true, data: characters });

  } catch (error) {
    console.error('Failed to get characters:', error);
    res.status(500).json({ error: 'Failed to load characters' });
  }
});

/**
 * Create/update character profile
 * POST /api/v1/shows/:showId/characters
 */
router.post('/shows/:showId/characters', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { character_name, editing_style } = req.body;
    
    if (!character_name) {
      return res.status(400).json({ error: 'character_name is required' });
    }

    const character = await db.CharacterProfile.create({
      show_id: showId,
      character_name,
      editing_style: editing_style || {}
    });

    res.json({ success: true, data: character });

  } catch (error) {
    console.error('Failed to create character:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

/**
 * Patch edit map status (lightweight updates)
 * PATCH /api/v1/edit-maps/:id
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const editMap = await db.EditMap.findByPk(id);
    if (!editMap) {
      return res.status(404).json({ error: 'Edit map not found' });
    }

    await editMap.update(updates);

    res.json({ success: true, data: editMap });

  } catch (error) {
    console.error('Failed to patch edit map:', error);
    res.status(500).json({ error: 'Failed to update edit map' });
  }
});

module.exports = router;
