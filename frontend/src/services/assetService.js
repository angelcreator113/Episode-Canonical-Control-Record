/**
 * Asset Service
 * Centralized API calls for asset management
 */

import api from './api';

export const assetService = {
  // ==================== ASSET CRUD ====================
  
  /**
   * Upload new asset (image or video)
   */
  uploadAsset: async (formData) => {
    return api.post('/api/v1/assets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Get approved assets by type
   */
  getApprovedAssets: async (assetType) => {
    return api.get(`/api/v1/assets/approved/${assetType}`);
  },

  /**
   * Get all assets with optional filters
   */
  getAssets: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/v1/assets${queryString ? `?${queryString}` : ''}`;
    return api.get(url);
  },

  /**
   * Get pending assets
   */
  getPendingAssets: async () => {
    return api.get('/api/v1/assets/pending');
  },

  /**
   * Get single asset with labels
   */
  getAsset: async (assetId) => {
    return api.get(`/api/v1/assets/${assetId}`);
  },

  /**
   * Update asset metadata
   */
  updateAsset: async (assetId, updates) => {
    return api.put(`/api/v1/assets/${assetId}`, updates);
  },

  /**
   * Delete asset
   */
  deleteAsset: async (assetId) => {
    return api.delete(`/api/v1/assets/${assetId}`);
  },

  /**
   * Remove background from asset (for composer)
   */
  removeBackground: async (assetId) => {
    const res = await fetch(`/api/v1/assets/${assetId}/remove-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Background removal failed");
    return data;
  },

  // ==================== LABELS ====================

  /**
   * Get all available labels
   */
  getAllLabels: async () => {
    return api.get('/api/v1/assets/labels');
  },

  /**
   * Create new label
   */
  createLabel: async (name, color = '#6366f1', description = '') => {
    return api.post('/api/v1/assets/labels', { name, color, description });
  },

  /**
   * Add labels to asset
   */
  addLabels: async (assetId, labelIds) => {
    return api.post(`/api/v1/assets/${assetId}/labels`, { labelIds });
  },

  /**
   * Remove label from asset
   */
  removeLabel: async (assetId, labelId) => {
    return api.delete(`/api/v1/assets/${assetId}/labels/${labelId}`);
  },

  // ==================== USAGE TRACKING ====================

  /**
   * Get asset usage information
   */
  getAssetUsage: async (assetId) => {
    return api.get(`/api/v1/assets/${assetId}/usage`);
  },

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk delete assets
   */
  bulkDelete: async (assetIds) => {
    return api.post('/api/v1/assets/bulk/delete', { assetIds });
  },

  /**
   * Bulk add labels
   */
  bulkAddLabels: async (assetIds, labelIds) => {
    return api.post('/api/v1/assets/bulk/add-labels', { assetIds, labelIds });
  },

  /**
   * Bulk change asset type
   */
  bulkChangeType: async (assetIds, newType) => {
    return api.post('/api/v1/assets/bulk/change-type', { assetIds, assetType: newType });
  },

  // ==================== SEARCH ====================

  /**
   * Search assets with advanced filters
   */
  searchAssets: async (filters) => {
    return api.post('/api/v1/assets/search', filters);
  },

  // ==================== APPROVAL ====================

  /**
   * Approve asset (admin only)
   */
  approveAsset: async (assetId) => {
    return api.put(`/api/v1/assets/${assetId}/approve`);
  },

  /**
   * Reject asset (admin only)
   */
  rejectAsset: async (assetId, reason) => {
    return api.put(`/api/v1/assets/${assetId}/reject`, { reason });
  },
};

export default assetService;
