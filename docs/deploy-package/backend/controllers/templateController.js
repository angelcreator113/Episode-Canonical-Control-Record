const models = require('../models');
const { SceneTemplate } = models;

/**
 * List scene templates
 * GET /api/v1/scene-templates
 */
exports.listTemplates = async (req, res) => {
  try {
    const { sceneType, isPublic } = req.query;

    const where = {};
    if (sceneType) where.scene_type = sceneType;
    if (isPublic !== undefined) where.is_public = isPublic === 'true';

    const templates = await SceneTemplate.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('❌ Error listing templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list templates',
      message: error.message,
    });
  }
};

/**
 * Get single template
 * GET /api/v1/scene-templates/:id
 */
exports.getTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await SceneTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('❌ Error getting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template',
      message: error.message,
    });
  }
};

/**
 * Create template
 * POST /api/v1/scene-templates
 */
exports.createTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
      sceneType,
      mood,
      location,
      durationSeconds,
      structure,
      defaultSettings,
      isPublic,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required',
      });
    }

    const template = await SceneTemplate.create({
      name,
      description,
      scene_type: sceneType,
      mood,
      location,
      duration_seconds: durationSeconds,
      structure,
      default_settings: defaultSettings,
      is_public: isPublic || false,
      // created_by would come from auth middleware
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error) {
    console.error('❌ Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
      message: error.message,
    });
  }
};

/**
 * Update template
 * PUT /api/v1/scene-templates/:id
 */
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      sceneType,
      mood,
      location,
      durationSeconds,
      structure,
      defaultSettings,
      isPublic,
    } = req.body;

    const template = await SceneTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    await template.update({
      name,
      description,
      scene_type: sceneType,
      mood,
      location,
      duration_seconds: durationSeconds,
      structure,
      default_settings: defaultSettings,
      is_public: isPublic,
    });

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      message: error.message,
    });
  }
};

/**
 * Delete template
 * DELETE /api/v1/scene-templates/:id
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await SceneTemplate.findByPk(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    await template.destroy();

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
      message: error.message,
    });
  }
};

module.exports = exports;
