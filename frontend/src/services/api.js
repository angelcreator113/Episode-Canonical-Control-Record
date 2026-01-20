import axios from 'axios';

// Create axios instance with environment-aware base URL
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',  // Empty for production (relative URLs)
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ REQUEST INTERCEPTOR - Add token to requests
apiClient.interceptors.request.use(
  (config) => {
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

export default apiClient;
