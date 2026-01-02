import axios from 'axios';

// Use relative path to work with Vite proxy
const apiClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
