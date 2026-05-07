const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');
const { requireAuth } = require('../middleware/auth');

/**
 * Scene Template Routes
 * Base path: /api/v1/scene-templates
 */

// GET /api/v1/scene-templates - List all templates
router.get('/', requireAuth, asyncHandler(templateController.listTemplates));

// GET /api/v1/scene-templates/:id - Get single template
router.get('/:id', validateUUIDParam('id'), requireAuth, asyncHandler(templateController.getTemplate));

// POST /api/v1/scene-templates - Create template
router.post('/', requireAuth, asyncHandler(templateController.createTemplate));

// PUT /api/v1/scene-templates/:id - Update template
router.put('/:id', validateUUIDParam('id'), requireAuth, asyncHandler(templateController.updateTemplate));

// DELETE /api/v1/scene-templates/:id - Delete template
router.delete('/:id', validateUUIDParam('id'), requireAuth, asyncHandler(templateController.deleteTemplate));

module.exports = router;
