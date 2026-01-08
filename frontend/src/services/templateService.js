/**
 * Template Service
 * Handles all API communication for template management
 */

class TemplateService {
  constructor() {
    this.baseURL = '/api/v1/templates';
    this.token = localStorage.getItem('authToken');
  }

  /**
   * Get authorization headers
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    };
  }

  /**
   * List all templates
   */
  async getTemplates() {
    try {
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
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
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
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
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update template (admin only)
   */
  async updateTemplate(id, templateData) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete template (admin only)
   */
  async deleteTemplate(id) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
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
