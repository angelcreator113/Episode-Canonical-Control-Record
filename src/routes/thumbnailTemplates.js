/**
 * Thumbnail Template Routes
 * GET /api/v1/thumbnail-templates - List templates (with optional showId filter)
 * GET /api/v1/thumbnail-templates/:id - Get template by ID
 */

const express = require('express');
const { ThumbnailTemplate } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/v1/thumbnail-templates
 * List all thumbnail templates, optionally filtered by showId
 * Query params:
 *  - showId: Filter templates by show
 */
router.get('/', async (req, res) => {
  try {
    const { showId } = req.query;
    
    const whereClause = {};
    if (showId) {
      // Filter by show: either show-specific templates OR global templates (show_id IS NULL)
      whereClause[Op.or] = [
        { show_id: showId },
        { show_id: null }
      ];
    }

    const templates = await ThumbnailTemplate.findAll({
      where: whereClause,
      order: [
        ['is_active', 'DESC'], // Active templates first
        ['created_at', 'DESC'], // Then by creation date
      ],
    });

    res.json({
      status: 'SUCCESS',
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Failed to get thumbnail templates:', error);
    res.status(500).json({
      error: 'Failed to get thumbnail templates',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/thumbnail-templates/:id
 * Get a specific thumbnail template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await ThumbnailTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: `Thumbnail template with ID ${id} not found`,
      });
    }

    res.json({
      status: 'SUCCESS',
      data: template,
    });
  } catch (error) {
    console.error('Failed to get thumbnail template:', error);
    res.status(500).json({
      error: 'Failed to get thumbnail template',
      message: error.message,
    });
  }
});

module.exports = router;
