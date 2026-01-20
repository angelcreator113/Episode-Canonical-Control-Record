/**
 * API Configuration
 * Uses environment variables for flexible deployment
 */

// Get API base URL from environment or use relative URL for production
export const API_BASE_URL = import.meta.env.VITE_API_BASE || '';
export const API_URL = `${API_BASE_URL}/api/v1`;

// Helper function to build full URLs
export const getApiUrl = (path) => {
  const base = API_BASE_URL || '';
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${apiPath}`;
};

export default API_URL;
