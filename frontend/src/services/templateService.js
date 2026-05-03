/**
 * Template Service
 * Handles all API communication for template management.
 *
 * Track 4 migration: Path D inline-Bearer construction (line 18 in pre-Track-4
 * version) replaced by apiClient delegation. The previous implementation cached
 * the auth token as a class field at construction time (this.token =
 * localStorage.getItem('authToken') in the constructor) — a known staleness bug
 * (inventory v2 §8.7) where re-login mid-session left the service using the old
 * token. The bug self-resolves: apiClient's request interceptor reads
 * localStorage on every call, so this service automatically picks up the new
 * token after re-login.
 */

import apiClient from './api';

const BASE = '/api/v1/templates';

class TemplateService {
  /**
   * List all templates
   */
  async getTemplates() {
    try {
      const response = await apiClient.get(BASE);
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get single template by ID
   */
  async getTemplate(id) {
    try {
      const response = await apiClient.get(`${BASE}/${id}`);
      return response.data?.data;
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  }

  /**
   * Create new template (admin only)
   */
  async createTemplate(templateData) {
    try {
      const response = await apiClient.post(BASE, templateData);
      return response.data?.data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      console.error('Error creating template:', error);
      throw new Error(msg);
    }
  }

  /**
   * Update template (admin only)
   */
  async updateTemplate(id, templateData) {
    try {
      const response = await apiClient.put(`${BASE}/${id}`, templateData);
      return response.data?.data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      console.error('Error updating template:', error);
      throw new Error(msg);
    }
  }

  /**
   * Delete template (admin only)
   */
  async deleteTemplate(id) {
    try {
      await apiClient.delete(`${BASE}/${id}`);
      return true;
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      console.error('Error deleting template:', error);
      throw new Error(msg);
    }
  }

  /**
   * Validate template data
   */
  validateTemplate(template) {
    const errors = [];

    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.description || template.description.trim() === '') {
      errors.push('Template description is required');
    }

    if (!template.defaultStatus) {
      errors.push('Default status is required');
    }

    if (!Array.isArray(template.defaultCategories)) {
      errors.push('Default categories must be an array');
    }

    if (typeof template.config !== 'object') {
      errors.push('Config must be a valid JSON object');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Create singleton instance
const templateService = new TemplateService();

export default templateService;
