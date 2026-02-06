import api from './api';

/**
 * Footage Service
 * Handles raw footage upload and scene management
 */
const footageService = {
  /**
   * Upload raw video footage
   * @param {File} file - Video file
   * @param {string} episodeId - Episode ID
   * @returns {Promise<Object>}
   */
  async uploadFootage(file, episodeId) {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('episodeId', episodeId);
    formData.append('filename', file.name);

    const response = await api.post('/footage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Progress tracking (optional)
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Upload progress: ${percentCompleted}%`);
      },
    });

    return response.data;
  },

  /**
   * Get all scenes for an episode
   * @param {string} episodeId - Episode ID
   * @returns {Promise<Object>}
   */
  async getScenes(episodeId) {
    const response = await api.get(`/footage/scenes/${episodeId}`);
    return response.data;
  },

  /**
   * Delete a scene
   * @param {string} sceneId - Scene ID
   * @returns {Promise<Object>}
   */
  async deleteScene(sceneId) {
    const response = await api.delete(`/footage/scenes/${sceneId}`);
    return response.data;
  },
};

export default footageService;
