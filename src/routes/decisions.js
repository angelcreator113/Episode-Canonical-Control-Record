'use strict';

const express = require('express');
const router = express.Router();
const { UserDecision, DecisionPattern, Episode, Scene } = require('../models');
const { Op } = require('sequelize');

/**
 * POST /api/decisions
 * Log a user decision
 */
router.post('/', async (req, res) => {
  try {
    const {
      episode_id,
      scene_id,
      decision_type,
      decision_category,
      chosen_option,
      rejected_options,
      was_ai_suggestion,
      ai_confidence_score,
      user_rating,
      user_notes,
      context_data,
    } = req.body;

    // Validation
    if (!decision_type || !decision_category || !chosen_option) {
      return res.status(400).json({
        error: 'Missing required fields: decision_type, decision_category, chosen_option',
      });
    }

    // Create decision
    const decision = await UserDecision.create({
      episode_id,
      scene_id,
      decision_type,
      decision_category,
      chosen_option,
      rejected_options,
      was_ai_suggestion: was_ai_suggestion || false,
      ai_confidence_score,
      user_rating,
      user_notes,
      context_data,
      created_by: req.user?.id || 'system',
    });

    res.status(201).json({
      success: true,
      decision: decision.toSafeJSON(),
    });
  } catch (error) {
    console.error('Error logging decision:', error);
    res.status(500).json({
      error: 'Failed to log decision',
      details: error.message,
    });
  }
});

/**
 * GET /api/decisions
 * List decisions with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      episode_id,
      scene_id,
      decision_type,
      decision_category,
      was_ai_suggestion,
      limit = 50,
      offset = 0,
    } = req.query;

    const where = {};
    
    if (episode_id) where.episode_id = episode_id;
    if (scene_id) where.scene_id = scene_id;
    if (decision_type) where.decision_type = decision_type;
    if (decision_category) where.decision_category = decision_category;
    if (was_ai_suggestion !== undefined) {
      where.was_ai_suggestion = was_ai_suggestion === 'true';
    }

    const { count, rows: decisions } = await UserDecision.findAndCountAll({
      where,
      include: [
        {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'title'],
        },
        {
          model: Scene,
          as: 'scene',
          attributes: ['id', 'title', 'scene_type'],
        },
      ],
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      count,
      decisions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count,
      },
    });
  } catch (error) {
    console.error('Error fetching decisions:', error);
    res.status(500).json({
      error: 'Failed to fetch decisions',
      details: error.message,
    });
  }
});

/**
 * GET /api/decisions/patterns
 * List learned patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const {
      pattern_type,
      pattern_category,
      min_confidence = 0.5,
    } = req.query;

    const where = {
      confidence_score: {
        [Op.gte]: parseFloat(min_confidence),
      },
    };

    if (pattern_type) where.pattern_type = pattern_type;
    if (pattern_category) where.pattern_category = pattern_category;

    const patterns = await DecisionPattern.findAll({
      where,
      order: [['confidence_score', 'DESC']],
    });

    res.json({
      success: true,
      patterns,
    });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({
      error: 'Failed to fetch patterns',
      details: error.message,
    });
  }
});

/**
 * GET /api/decisions/episode/:episodeId/stats
 * Get decision statistics for an episode
 */
router.get('/episode/:episodeId/stats', async (req, res) => {
  try {
    const decisions = await UserDecision.findAll({
      where: { episode_id: req.params.episodeId },
    });

    const stats = {
      total: decisions.length,
      by_category: {},
      by_type: {},
      ai_suggestions: {
        total: 0,
        accepted: 0,
        rejected: 0,
      },
      avg_confidence: 0,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    decisions.forEach(decision => {
      // Count by category
      stats.by_category[decision.decision_category] = 
        (stats.by_category[decision.decision_category] || 0) + 1;
      
      // Count by type
      stats.by_type[decision.decision_type] = 
        (stats.by_type[decision.decision_type] || 0) + 1;
      
      // AI suggestion stats
      if (decision.was_ai_suggestion) {
        stats.ai_suggestions.total++;
        if (decision.user_rating && decision.user_rating >= 4) {
          stats.ai_suggestions.accepted++;
        } else if (decision.user_rating && decision.user_rating <= 2) {
          stats.ai_suggestions.rejected++;
        }
      }
      
      // Confidence
      if (decision.ai_confidence_score) {
        totalConfidence += parseFloat(decision.ai_confidence_score);
        confidenceCount++;
      }
    });

    if (confidenceCount > 0) {
      stats.avg_confidence = (totalConfidence / confidenceCount).toFixed(2);
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({
      error: 'Failed to calculate stats',
      details: error.message,
    });
  }
});

/**
 * GET /api/decisions/:id
 * Get single decision
 */
router.get('/:id', async (req, res) => {
  try {
    const decision = await UserDecision.findByPk(req.params.id, {
      include: [
        { model: Episode, as: 'episode' },
        { model: Scene, as: 'scene' },
      ],
    });

    if (!decision) {
      return res.status(404).json({
        error: 'Decision not found',
      });
    }

    res.json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error('Error fetching decision:', error);
    res.status(500).json({
      error: 'Failed to fetch decision',
      details: error.message,
    });
  }
});

module.exports = router;
