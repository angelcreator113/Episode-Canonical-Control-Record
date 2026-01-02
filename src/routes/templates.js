/**
 * Thumbnail Template Routes
 * GET /api/v1/templates - List all templates
 * GET /api/v1/templates/:id - Get template by ID
 */

const express = require('express');
const CompositionService = require('../services/CompositionService');

const router = express.Router();

/**
 * GET /api/v1/templates
 * Get all available templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = await CompositionService.getTemplates();

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
    const template = await CompositionService.getTemplate(id);

    res.json({
      status: 'SUCCESS',
      data: template,
    });
  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to get template',
      message: error.message,
    });
  }
});

module.exports = router;
