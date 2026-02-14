/**
 * Asset URL Utilities
 * Helper functions for getting optimal asset URLs for different contexts
 */

/**
 * Get thumbnail URL for card/grid displays
 * Uses smaller thumbnail (150-400px) to improve performance and avoid layout issues
 * 
 * @param {Object} asset - Asset object
 * @returns {string|null} - Thumbnail URL or null
 */
export const getAssetThumbnailUrl = (asset) => {
  if (!asset) return null;
  
  // Priority: metadata.thumbnail_url > s3_url_processed > s3_url_raw
  return asset.metadata?.thumbnail_url || asset.s3_url_processed || asset.s3_url_raw;
};

/**
 * Get full resolution URL for preview/download
 * Uses highest quality available version
 * 
 * @param {Object} asset - Asset object
 * @param {boolean} preferProcessed - Prefer processed version (bg removed, enhanced)
 * @returns {string|null} - Full resolution URL or null
 */
export const getAssetFullUrl = (asset, preferProcessed = true) => {
  if (!asset) return null;
  
  if (preferProcessed && asset.s3_url_processed) {
    return asset.s3_url_processed;
  }
  
  // Priority: s3_url_raw (original) > s3_url_processed > metadata.thumbnail_url (last resort)
  return asset.s3_url_raw || asset.s3_url_processed || asset.metadata?.thumbnail_url;
};

/**
 * Get best available URL for video assets
 * Videos don't have thumbnails in the same way, use full URL
 * 
 * @param {Object} asset - Asset object
 * @returns {string|null} - Video URL or null
 */
export const getVideoUrl = (asset) => {
  if (!asset || asset.media_type !== 'video') return null;
  
  return asset.s3_url_processed || asset.s3_url_raw;
};

/**
 * Check if URL is valid and not a mock/placeholder
 * 
 * @param {string} url - URL to check
 * @returns {boolean} - True if valid, false if mock/missing
 */
export const isValidAssetUrl = (url) => {
  if (!url) return false;
  if (url.includes('mock-s3.dev')) return false;
  if (url.includes('undefined')) return false;
  if (url.startsWith('data:image/svg')) return false; // Placeholder SVG
  
  return true;
};

/**
 * Get display URL based on context
 * 
 * @param {Object} asset - Asset object
 * @param {string} context - 'card' | 'preview' | 'download'
 * @param {boolean} preferProcessed - Prefer processed version
 * @returns {string|null} - URL for context or null
 */
export const getAssetDisplayUrl = (asset, context = 'card', preferProcessed = true) => {
  if (!asset) return null;
  
  // Videos always use full URL
  if (asset.media_type === 'video') {
    return getVideoUrl(asset);
  }
  
  switch (context) {
    case 'card':
    case 'grid':
    case 'thumbnail':
      return getAssetThumbnailUrl(asset);
      
    case 'preview':
    case 'modal':
    case 'lightbox':
    case 'download':
      return getAssetFullUrl(asset, preferProcessed);
      
    default:
      return getAssetThumbnailUrl(asset);
  }
};

export default {
  getAssetThumbnailUrl,
  getAssetFullUrl,
  getVideoUrl,
  isValidAssetUrl,
  getAssetDisplayUrl,
};
