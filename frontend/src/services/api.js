import axios from 'axios';

// Create axios instance with environment-aware base URL
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',  // Empty for production (relative URLs)
  timeout: 60000, // 60 seconds for background removal operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ REQUEST INTERCEPTOR - Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    // Don't set Content-Type header for FormData - let browser handle it
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      console.log('📤 Uploading FormData:', {
        method: config.method.toUpperCase(),
        url: config.url,
        formDataEntries: Array.from(config.data.entries()).map(([k, v]) => [k, v instanceof File ? `[File:${v.name}]` : v])
      });
      return config;
    }

    // In development, skip token to avoid expiration errors
    if (import.meta.env.DEV) {
      console.log('API Request (dev):', config.method.toUpperCase(), config.url);
      return config;
    }
    
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('API Request:', config.method.toUpperCase(), config.url); // Debug log
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ RESPONSE INTERCEPTOR - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      // Don't redirect in development to avoid breaking testing
      if (process.env.NODE_ENV !== 'development') {
        window.location.href = '/login';
      }
    }
    
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', error.response?.data || error.message);
    }
    
    return Promise.reject(error);
  }
);

// Episode API calls
export const episodeAPI = {
  getAll: (options = {}) => {
    const params = new URLSearchParams({
      page: options.page || 1,
      limit: options.limit || 10,
      status: options.status || '',
      ...options.query
    });
    return apiClient.get(`/api/v1/episodes?${params}`);
  },

  getById: (id) => {
    return apiClient.get(`/api/v1/episodes/${id}`);
  },

  create: (data) => {
    return apiClient.post('/api/v1/episodes', data);
  },

  update: (id, data) => {
    return apiClient.put(`/api/v1/episodes/${id}`, data);
  },

  delete: (id) => {
    return apiClient.delete(`/api/v1/episodes/${id}`);
  },
};

// Thumbnail API calls
export const thumbnailAPI = {
  getAll: (options = {}) => {
    const params = new URLSearchParams({
      page: options.page || 1,
      limit: options.limit || 20,
    });
    return apiClient.get(`/api/v1/thumbnails?${params}`);
  },

  getById: (id) => {
    return apiClient.get(`/api/v1/thumbnails/${id}`);
  },
};

// Metadata API calls
export const metadataAPI = {
  getAll: () => {
    return apiClient.get('/api/v1/metadata');
  },

  getByEpisodeId: (episodeId) => {
    return apiClient.get(`/api/v1/metadata/episodes/${episodeId}`);
  },
};

// Health check
export const healthCheck = () => {
  return apiClient.get('/health');
};

// ==================== Scene Composer & Timeline Editor APIs ====================

// Platform API
export const platformAPI = {
  get: (episodeId) => apiClient.get(`/api/v1/episodes/${episodeId}/platform`),
  update: (episodeId, platformData) => apiClient.put(`/api/v1/episodes/${episodeId}/platform`, platformData),
};

// Scenes API
export const sceneAPI = {
  getAll: (episodeId) => apiClient.get(`/api/v1/episodes/${episodeId}/scenes`),
  create: (episodeId, sceneData) => apiClient.post(`/api/v1/episodes/${episodeId}/scenes`, sceneData),
  update: (sceneId, sceneData) => apiClient.put(`/api/v1/scenes/${sceneId}`, sceneData),
  delete: (sceneId) => apiClient.delete(`/api/v1/scenes/${sceneId}`),
  reorder: (episodeId, scenes) => apiClient.put(`/api/v1/episodes/${episodeId}/scenes/reorder`, { scenes }),
};

// Timeline Data API
export const timelineDataAPI = {
  get: (episodeId) => apiClient.get(`/api/v1/episodes/${episodeId}/timeline-data`),
  update: (episodeId, data) => apiClient.put(`/api/v1/episodes/${episodeId}/timeline-data`, data),
};

// Unified Save API (atomic save for Scene Composer & Timeline Editor)
export const saveEpisodeData = (episodeId, data) => {
  return apiClient.post(`/api/v1/episodes/${episodeId}/save`, data);
};

// ==================== Asset System APIs ====================

// Wardrobe Defaults API
export const wardrobeDefaultsAPI = {
  getAll: (episodeId) => apiClient.get(`/api/v1/episodes/${episodeId}/wardrobe-defaults`),
  set: (episodeId, data) => apiClient.post(`/api/v1/episodes/${episodeId}/wardrobe-defaults`, data),
  remove: (episodeId, characterName) =>
    apiClient.delete(`/api/v1/episodes/${episodeId}/wardrobe-defaults/${encodeURIComponent(characterName)}`),
};

// Scene Assets API
export const sceneAssetsAPI = {
  getAll: (sceneId) => apiClient.get(`/api/v1/scenes/${sceneId}/assets`),
  add: (sceneId, data) => apiClient.post(`/api/v1/scenes/${sceneId}/assets`, data),
  remove: (sceneId, assetId, usageType) => {
    const params = usageType ? `?usageType=${encodeURIComponent(usageType)}` : '';
    return apiClient.delete(`/api/v1/scenes/${sceneId}/assets/${assetId}${params}`);
  },
};

// Wardrobe API (character outfits live here, not in assets table)
export const wardrobeAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.character) params.append('character', filters.character);
    if (filters.category) params.append('category', filters.category);
    if (filters.favorite) params.append('favorite', filters.favorite);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit || '200');
    return apiClient.get(`/api/v1/wardrobe?${params}`);
  },
  getById: (id) => apiClient.get(`/api/v1/wardrobe/${id}`),
};

// Characters API
export const characterAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.show_id) params.append('show_id', filters.show_id);
    if (filters.role) params.append('role', filters.role);
    return apiClient.get(`/api/v1/characters?${params}`);
  },
  getById: (id) => apiClient.get(`/api/v1/characters/${id}`),
};

// Assets API (for filtered queries)
export const assetsAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.show_id) params.append('show_id', filters.show_id);
    if (filters.category) params.append('category', filters.category);
    if (filters.entity_type) params.append('entity_type', filters.entity_type);
    if (filters.character_name) params.append('character_name', filters.character_name);
    if (filters.location_name) params.append('location_name', filters.location_name);
    if (filters.asset_type) params.append('asset_type', filters.asset_type);
    if (filters.asset_scope) params.append('asset_scope', filters.asset_scope);
    if (filters.include_global) params.append('include_global', 'true');
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return apiClient.get(`/api/v1/assets?${params}`);
  },
  getById: (id) => apiClient.get(`/api/v1/assets/${id}`),
};

export default apiClient;
