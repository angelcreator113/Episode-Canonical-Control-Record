const { ThumbnailTemplate, CompositionAsset, Show } = require('../models');
const { Op } = require('sequelize');

/**
 * ThumbnailTemplateService
 * 
 * Handles CRUD operations and business logic for thumbnail templates.
 * Templates define required/optional asset roles for thumbnail generation.
 */
class ThumbnailTemplateService {
  /**
   * Get all active templates for a show (includes global templates)
   * @param {string} showId - Show UUID
   * @returns {Promise<Array>} Array of active templates
   */
  static async getActiveForShow(showId) {
    try {
      return await ThumbnailTemplate.findAll({
        where: {
          is_active: true,
          [Op.or]: [
            { show_id: showId },
            { show_id: null } // Global templates
          ]
        },
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['show_id', 'show_name']
          }
        ],
        order: [
          ['show_id', 'DESC NULLS LAST'], // Show-specific first
          ['template_name', 'ASC'],
          ['template_version', 'DESC']
        ]
      });
    } catch (error) {
      console.error('Error fetching templates for show:', error);
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }
  }

  /**
   * Get all global templates
   * @returns {Promise<Array>}
   */
  static async getGlobalTemplates() {
    try {
      return await ThumbnailTemplate.findAll({
        where: {
          is_active: true,
          show_id: null
        },
        order: [
          ['template_name', 'ASC'],
          ['template_version', 'DESC']
        ]
      });
    } catch (error) {
      console.error('Error fetching global templates:', error);
      throw new Error(`Failed to fetch global templates: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template UUID
   * @returns {Promise<Object|null>}
   */
  static async getById(templateId) {
    try {
      return await ThumbnailTemplate.findByPk(templateId, {
        include: [
          {
            model: Show,
            as: 'show',
            attributes: ['show_id', 'show_name']
          }
        ]
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      throw new Error(`Failed to fetch template: ${error.message}`);
    }
  }

  /**
   * Get latest version of a template by name
   * @param {string} templateName - Template name
   * @param {string|null} showId - Show UUID (null for global)
   * @returns {Promise<Object|null>}
   */
  static async getLatestVersion(templateName, showId = null) {
    try {
      return await ThumbnailTemplate.findOne({
        where: {
          template_name: templateName,
          is_active: true,
          show_id: showId
        },
        order: [['template_version', 'DESC']]
      });
    } catch (error) {
      console.error('Error fetching latest template version:', error);
      throw new Error(`Failed to fetch latest version: ${error.message}`);
    }
  }

  /**
   * Create a new template
   * @param {Object} templateData - Template configuration
   * @returns {Promise<Object>}
   */
  static async create(templateData) {
    try {
      // Validate required fields
      if (!templateData.template_name) {
        throw new Error('template_name is required');
      }
      if (!templateData.template_version) {
        throw new Error('template_version is required');
      }
      if (!templateData.required_roles || !Array.isArray(templateData.required_roles)) {
        throw new Error('required_roles must be an array');
      }
      if (!templateData.layout_config) {
        throw new Error('layout_config is required');
      }

      // Create template
      const template = await ThumbnailTemplate.create(templateData);
      return template;
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Update a template
   * @param {string} templateId - Template UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>}
   */
  static async update(templateId, updates) {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      await template.update(updates);
      return template;
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Deactivate a template (soft delete)
   * @param {string} templateId - Template UUID
   * @returns {Promise<boolean>}
   */
  static async deactivate(templateId) {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      await template.update({ is_active: false });
      return true;
    } catch (error) {
      console.error('Error deactivating template:', error);
      throw new Error(`Failed to deactivate template: ${error.message}`);
    }
  }

  /**
   * Delete a template permanently
   * @param {string} templateId - Template UUID
   * @returns {Promise<boolean>}
   */
  static async delete(templateId) {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      await template.destroy();
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Validate a composition against a template
   * @param {string} templateId - Template UUID
   * @param {Array} compositionAssets - Array of { asset_role, asset_id }
   * @returns {Promise<Object>} { valid: boolean, errors: [], warnings: [] }
   */
  static async validateComposition(templateId, compositionAssets) {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      return template.validateComposition(compositionAssets);
    } catch (error) {
      console.error('Error validating composition:', error);
      throw new Error(`Failed to validate composition: ${error.message}`);
    }
  }

  /**
   * Clone a template with a new version
   * @param {string} templateId - Template UUID to clone
   * @param {string} newVersion - New version string
   * @param {Object} modifications - Optional modifications to apply
   * @returns {Promise<Object>}
   */
  static async cloneAsNewVersion(templateId, newVersion, modifications = {}) {
    try {
      const original = await ThumbnailTemplate.findByPk(templateId);
      if (!original) {
        throw new Error('Template not found');
      }

      // Create new template with incremented version
      const newTemplate = await ThumbnailTemplate.create({
        show_id: original.show_id,
        template_name: original.template_name,
        template_version: newVersion,
        required_roles: modifications.required_roles || original.required_roles,
        optional_roles: modifications.optional_roles || original.optional_roles,
        layout_config: modifications.layout_config || original.layout_config,
        format_overrides: modifications.format_overrides || original.format_overrides,
        text_layers: modifications.text_layers || original.text_layers,
        is_active: true
      });

      // Optionally deactivate old version
      if (modifications.deactivateOld) {
        await original.update({ is_active: false });
      }

      return newTemplate;
    } catch (error) {
      console.error('Error cloning template:', error);
      throw new Error(`Failed to clone template: ${error.message}`);
    }
  }

  /**
   * Get all roles defined in a template (required + optional)
   * @param {string} templateId - Template UUID
   * @returns {Promise<Array>}
   */
  static async getAllRoles(templateId) {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      return template.getAllRoles();
    } catch (error) {
      console.error('Error getting template roles:', error);
      throw new Error(`Failed to get roles: ${error.message}`);
    }
  }

  /**
   * Get templates using a specific role
   * @param {string} role - Asset role (e.g., "CHAR.HOST.PRIMARY")
   * @returns {Promise<Array>}
   */
  static async getTemplatesUsingRole(role) {
    try {
      return await ThumbnailTemplate.findAll({
        where: {
          is_active: true,
          [Op.or]: [
            { required_roles: { [Op.contains]: [role] } },
            { optional_roles: { [Op.contains]: [role] } }
          ]
        }
      });
    } catch (error) {
      console.error('Error finding templates using role:', error);
      throw new Error(`Failed to find templates: ${error.message}`);
    }
  }

  /**
   * Get usage statistics for a template
   * @param {string} templateId - Template UUID
   * @returns {Promise<Object>}
   */
  static async getUsageStats(templateId) {
    try {
      const { ThumbnailComposition } = require('../models');
      
      const totalCompositions = await ThumbnailComposition.count({
        where: { template_id: templateId }
      });

      const completedCompositions = await ThumbnailComposition.count({
        where: {
          template_id: templateId,
          generation_status: 'COMPLETED'
        }
      });

      const failedCompositions = await ThumbnailComposition.count({
        where: {
          template_id: templateId,
          generation_status: 'FAILED'
        }
      });

      return {
        total: totalCompositions,
        completed: completedCompositions,
        failed: failedCompositions,
        successRate: totalCompositions > 0 
          ? ((completedCompositions / totalCompositions) * 100).toFixed(2) 
          : 0
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
  }
}

module.exports = ThumbnailTemplateService;
