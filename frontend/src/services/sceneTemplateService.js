import api from './api';

const sceneTemplateService = {
  /**
   * List all scene templates
   */
  listTemplates: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.sceneType) params.append('sceneType', filters.sceneType);
    if (filters.isPublic !== undefined) params.append('isPublic', filters.isPublic);
    
    const response = await api.get(`/scene-templates?${params}`);
    return response.data;
  },

  /**
   * Get single template by ID
   */
  getTemplate: async (templateId) => {
    const response = await api.get(`/scene-templates/${templateId}`);
    return response.data;
  },

  /**
   * Create new template
   */
  createTemplate: async (templateData) => {
    const response = await api.post('/scene-templates', templateData);
    return response.data;
  },

  /**
   * Update template
   */
  updateTemplate: async (templateId, templateData) => {
    const response = await api.put(`/scene-templates/${templateId}`, templateData);
    return response.data;
  },

  /**
   * Delete template
   */
  deleteTemplate: async (templateId) => {
    const response = await api.delete(`/scene-templates/${templateId}`);
    return response.data;
  },
};

export default sceneTemplateService;
