import axios from 'axios';
import {
  refreshAccessTokenOnce, refreshEndsSession, wipeSessionAndRedirect, PASS_THROUGH_CODES, SESSION_FAIL_CODES,
} from '../utils/authSession';

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
//    request. Redirect to /login only when the refresh token itself is refused
//    (401/400, or none stored); a refresh that hits a restart (502/503/504,
//    network error) is retried for ~15 s, then this request fails and the
//    session is kept (utils/authSession; Evoni, 2026-10-23). Single-retry — never loop.
//  - AUTH_REQUIRED, AUTH_MISSING_TOKEN — no session present. Wipe creds, redirect.
//  - 401 with no code / unknown code — treated as session failure for safety.
//  - All other errors — pass through unchanged.

// The refresh (single-flight) and the session wipe live in utils/authSession,
// shared with authedFetch so the raw stream requests follow this same
// contract (Task #1902). Re-exported here for callers of this module.
export { refreshAccessTokenOnce, wipeSessionAndRedirect };

// keepSession (a request's own opt-out; Teleprompter audit 5, 2026-10-24):
// a caller holding something that exists only in this tab (an unsaved
// teleprompter take) sends `keepSession: true` in the request config. Its
// 401s never wipe the session or leave for /login: an AUTH_INVALID_TOKEN
// still tries the one refresh, and a request with a file in it is not sent
// again by itself (a 500 MB take is not uploaded twice); the error comes back
// marked `sessionExpired` (the sign-in is over: sign in in another tab, then
// retry) or `authRefreshed` (it was renewed: retry now). Every other request
// keeps the contract above unchanged.
const keepsSession = (config) => !!config?.keepSession;
const hasFile = (config) => typeof FormData !== 'undefined' && config?.data instanceof FormData;
const markAuth = (error, flags) => Object.assign(error, flags);

async function keepSessionOn401(error, code) {
  const originalConfig = error.config;
  console.warn('apiClient: sign-in refused on a keepSession request; staying on this page', code || 'no code');
  if (code !== 'AUTH_INVALID_TOKEN' || originalConfig._retried || String(originalConfig.url || '').includes('/api/v1/auth/refresh')) {
    return Promise.reject(markAuth(error, { sessionExpired: true }));
  }
  try {
    await refreshAccessTokenOnce();
  } catch (refreshError) {
    console.warn('apiClient: refresh failed on a keepSession request', refreshError?.status ?? null);
    if (refreshEndsSession(refreshError)) return Promise.reject(markAuth(error, { sessionExpired: true }));
    return Promise.reject(refreshError.cause || refreshError);
  }
  if (hasFile(originalConfig)) return Promise.reject(markAuth(error, { authRefreshed: true }));
  originalConfig._retried = true;
  return apiClient(originalConfig);
}

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

    if (status === 401 && keepsSession(originalConfig)) {
      return keepSessionOn401(error, code);
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
        await refreshAccessTokenOnce();
      } catch (refreshError) {
        // Signed out only when the refresh token itself was refused. A
        // restart (502/503/network) or a 429 keeps the session; the caller
        // gets the refresh's own error, a server problem, not a 401.
        if (refreshEndsSession(refreshError)) {
          wipeSessionAndRedirect();
          return Promise.reject(error);
        }
        console.warn('apiClient: session refresh unavailable; staying signed in', refreshError.status);
        return Promise.reject(refreshError.cause || refreshError);
      }
      originalConfig._retried = true;
      // Request interceptor re-reads localStorage and re-attaches the new token.
      return apiClient(originalConfig);
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
