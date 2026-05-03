import axios from 'axios';

// Create axios instance with environment-aware base URL
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',  // Empty for production (relative URLs)
  timeout: 180000, // 3 minutes for DALL-E image generation (2 images)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ REQUEST INTERCEPTOR - Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    // Attach auth token to all requests
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Don't set Content-Type header for FormData - let browser handle it
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      console.log('📤 Uploading FormData:', {
        method: config.method.toUpperCase(),
        url: config.url,
        formDataEntries: Array.from(config.data.entries()).map(([k, v]) => [k, v instanceof File ? `[File:${v.name}]` : v])
      });
    }
    if (import.meta.env.DEV) {
      console.log('API Request (dev):', config.method.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ RESPONSE INTERCEPTOR — F-Auth-4 Path 1 contract (Track 1, fix plan v2.0 §4.6)
//
// Codes the interceptor acts on:
//  - AUTH_INVALID_FORMAT, AUTH_GROUP_REQUIRED, AUTH_ROLE_REQUIRED — pass-through (LOCKED).
//    These are integration/permission errors, NOT session failures. Surfaced inline
//    so the caller can show "you don't have access" rather than redirecting to /login.
//  - AUTH_INVALID_TOKEN — header present, verifier rejected. Attempt refresh ONCE
//    via the existing /api/v1/auth/refresh path; on success retry the original
//    request, on failure redirect to /login. Single-retry-then-redirect — never loop.
//  - AUTH_REQUIRED, AUTH_MISSING_TOKEN — no session present. Wipe creds, redirect.
//  - 401 with no code / unknown code — treated as session failure for safety.
//  - All other errors — pass through unchanged.

// Inline refresh helper avoids circular import with authService and uses bare axios
// so the refresh request itself bypasses this interceptor (no recursion risk).
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token in storage');
  const baseURL = apiClient.defaults.baseURL || '';
  const res = await axios.post(`${baseURL}/api/v1/auth/refresh`, { refreshToken });
  const newToken = res.data?.data?.accessToken;
  if (!newToken) throw new Error('No accessToken in refresh response');
  localStorage.setItem('authToken', newToken);
  return newToken;
};

const wipeSessionAndRedirect = () => {
  // Skip in DEV — keeps hot-reload from kicking devs to /login on every restart.
  if (import.meta.env.DEV) return;
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

const PASS_THROUGH_CODES = new Set([
  'AUTH_INVALID_FORMAT',
  'AUTH_GROUP_REQUIRED',
  'AUTH_ROLE_REQUIRED',
]);

const SESSION_FAIL_CODES = new Set([
  'AUTH_REQUIRED',
  'AUTH_MISSING_TOKEN',
]);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const originalConfig = error.config;

    // LOCKED pass-through — permission/format failures never trigger session-redirect.
    if (code && PASS_THROUGH_CODES.has(code)) {
      return Promise.reject(error);
    }

    if (status === 401 && code === 'AUTH_INVALID_TOKEN') {
      // Single-retry contract: if this request was already retried, redirect.
      if (!originalConfig || originalConfig._retried) {
        wipeSessionAndRedirect();
        return Promise.reject(error);
      }
      // The refresh endpoint itself returning AUTH_INVALID_TOKEN means the
      // refresh token is bad — don't loop, just redirect.
      if (originalConfig.url && originalConfig.url.includes('/api/v1/auth/refresh')) {
        wipeSessionAndRedirect();
        return Promise.reject(error);
      }
      try {
        await refreshAccessToken();
        originalConfig._retried = true;
        // Request interceptor re-reads localStorage and re-attaches the new token.
        return apiClient(originalConfig);
      } catch (_refreshError) {
        wipeSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    if (status === 401 && (!code || SESSION_FAIL_CODES.has(code))) {
      wipeSessionAndRedirect();
      return Promise.reject(error);
    }

    if (import.meta.env.DEV) {
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
