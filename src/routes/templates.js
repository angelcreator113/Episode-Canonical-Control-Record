/**
 * Template Management Routes - Episode Templates
 * GET /api/v1/templates - List all templates
 * GET /api/v1/templates/:id - Get template by ID
 * POST /api/v1/templates - Create new template
 * PUT /api/v1/templates/:id - Update template
 * DELETE /api/v1/templates/:id - Delete template
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { models } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/templates
 * List all available templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = await models.EpisodeTemplate.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.json({
      status: 'SUCCESS',
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Failed to get templates:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/templates/:id
 * Get template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await models.EpisodeTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      data: template,
    });
  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(500).json({
      error: 'Failed to get template',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/templates
 * Create new template
 */
router.post('/', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { name, description, defaultStatus, defaultCategories, config } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['name is required'],
      });
    }

    const template = await models.EpisodeTemplate.create({
      id: uuidv4(),
      name,
      description: description || '',
      defaultStatus: defaultStatus || 'draft',
      defaultCategories: defaultCategories || [],
      config: config || {
        episodeNumbering: 'auto',
        dateFormat: 'YYYY-MM-DD',
        thumbnailStyle: 'centered',
      },
      createdBy: req.user?.id,
      isActive: true,
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Template created successfully',
      data: template,
    });
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/templates/:id
 * Update template
 */
router.put('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, defaultStatus, defaultCategories, config, isActive } = req.body;

    const template = await models.EpisodeTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    await template.update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(defaultStatus && { defaultStatus }),
      ...(defaultCategories && { defaultCategories }),
      ...(config && { config }),
      ...(isActive !== undefined && { isActive }),
    });

    res.json({
      status: 'SUCCESS',
      message: 'Template updated successfully',
      data: template,
    });
  } catch (error) {
    console.error('Failed to update template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/templates/:id
 * Delete template
 */
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const template = await models.EpisodeTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    await template.destroy();

    res.json({
      status: 'SUCCESS',
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message,
    });
  }
});

module.exports = router;
