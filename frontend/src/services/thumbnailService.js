/**
 * Thumbnail Service
 * API calls for thumbnail management
 */

import api from './api';

export const thumbnailService = {
  // Generate thumbnail
  generateThumbnail: async (compositionId, episodeId) => {
    return api.post('/api/v1/thumbnails/generate', {
      composition_id: compositionId,
      episode_id: episodeId,
    });
  },

  // Get thumbnail
  getThumbnail: async (id) => {
    return api.get(`/api/v1/thumbnails/${id}`);
  },

  // Delete thumbnail
  deleteThumbnail: async (id) => {
    return api.delete(`/api/v1/thumbnails/${id}`);
  },

  // Get thumbnails for episode
  getThumbnailsForEpisode: async (episodeId) => {
    return api.get(`/api/v1/episodes/${episodeId}/thumbnails`);
  },

  // Upload thumbnail image blob to episode
  uploadThumbnail: async (episodeId, blob, filename = 'thumbnail.png') => {
    const formData = new FormData();
    formData.append('thumbnail', blob, filename);
    return api.post(`/api/v1/episodes/${episodeId}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default thumbnailService;
