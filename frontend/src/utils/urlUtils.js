/**
 * URL Utilities
 * Helpers for normalizing and formatting URLs
 */

// Get API base URL from environment
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3002';

/**
 * Normalize a URL to ensure it points to the correct server
 * Handles both absolute URLs (http/https) and relative paths
 * 
 * @param {string} url - The URL to normalize
 * @returns {string|null} - Normalized absolute URL or null
 */
export const normalizeUrl = (url) => {
  if (!url) return null;
  
  // Already an absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Relative URL - ensure leading slash and prepend API base
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE}${path}`;
};

/**
 * Normalize thumbnail URL specifically for scene thumbnails
 * Falls back to null if no valid URL is provided
 * 
 * @param {object} scene - Scene object with thumbnailUrl or thumbnail_url
 * @returns {string|null} - Normalized thumbnail URL or null
 */
export const normalizeSceneThumbnail = (scene) => {
  if (!scene) return null;
  const url = scene.thumbnailUrl || scene.thumbnail_url;
  return normalizeUrl(url);
};

/**
 * Normalize video URL for video player
 * 
 * @param {object} scene - Scene object with videoAssetUrl or video_asset_url
 * @returns {string|null} - Normalized video URL or null
 */
export const normalizeSceneVideo = (scene) => {
  if (!scene) return null;
  const url = scene.videoAssetUrl || scene.video_asset_url;
  return normalizeUrl(url);
};
