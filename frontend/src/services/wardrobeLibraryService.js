/**
 * Wardrobe Library Service
 * Handles all API calls for the wardrobe library system
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const wardrobeLibraryService = {
  /**
   * Upload new item to library
   * @param {FormData} formData - Form data with image and metadata
   */
  async uploadToLibrary(formData) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library`, {
        method: 'POST',
        body: formData, // Don't set Content-Type, browser will set it with boundary
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload item');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error uploading item:', error);
      throw error;
    }
  },

  /**
   * Get library items with filters
   * @param {Object} filters - Filter parameters
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   */
  async getLibrary(filters = {}, page = 1, limit = 20) {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters
      });
      
      const response = await fetch(`${API_BASE}/wardrobe-library?${queryParams}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch library: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching library:', error);
      throw error;
    }
  },

  /**
   * Get single library item by ID
   */
  async getLibraryItem(id) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch item: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching item:', error);
      throw error;
    }
  },

  /**
   * Update library item
   */
  async updateLibraryItem(id, data) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update item');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  /**
   * Delete library item
   */
  async deleteLibraryItem(id) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete item');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  /**
   * Assign library item to episode
   */
  async assignToEpisode(itemId, assignmentData) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${itemId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignmentData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to assign item');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error assigning item:', error);
      throw error;
    }
  },

  /**
   * Approve wardrobe item for episode
   */
  async approveItem(episodeId, wardrobeId, data = {}) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-approval/${episodeId}/${wardrobeId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve item');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error approving item:', error);
      throw error;
    }
  },

  /**
   * Reject wardrobe item for episode
   */
  async rejectItem(episodeId, wardrobeId, data = {}) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-approval/${episodeId}/${wardrobeId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject item');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error rejecting item:', error);
      throw error;
    }
  },

  /**
   * Get usage history for item
   */
  async getUsageHistory(itemId) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${itemId}/usage`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch usage history: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching usage history:', error);
      throw error;
    }
  },

  /**
   * Get cross-show usage for item
   */
  async getCrossShowUsage(itemId) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${itemId}/usage/shows`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cross-show usage: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching cross-show usage:', error);
      throw error;
    }
  },

  /**
   * Track item view
   */
  async trackView(itemId) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${itemId}/track-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        // Don't throw error for tracking failures
        console.warn('Failed to track view');
      }
    } catch (error) {
      // Silent fail for tracking
      console.warn('Error tracking view:', error);
    }
  },

  /**
   * Track item selection
   */
  async trackSelection(itemId) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${itemId}/track-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        // Don't throw error for tracking failures
        console.warn('Failed to track selection');
      }
    } catch (error) {
      // Silent fail for tracking
      console.warn('Error tracking selection:', error);
    }
  },

  /**
   * Advanced search
   */
  async advancedSearch(searchParams) {
    try {
      const queryParams = new URLSearchParams(searchParams);
      
      const response = await fetch(`${API_BASE}/wardrobe-library/advanced-search?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to search: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error searching library:', error);
      throw error;
    }
  },

  /**
   * Get outfit set items
   */
  async getOutfitItems(setId) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${setId}/items`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch outfit items: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching outfit items:', error);
      throw error;
    }
  },

  /**
   * Add items to outfit set
   */
  async addItemsToOutfit(setId, itemIds) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${setId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add items to outfit');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error adding items to outfit:', error);
      throw error;
    }
  },

  /**
   * Remove item from outfit set
   */
  async removeItemFromOutfit(setId, itemId) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/${setId}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove item from outfit');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error removing item from outfit:', error);
      throw error;
    }
  },

  /**
   * Bulk assign items to episode
   */
  async bulkAssign(itemIds, episodeId, metadata = {}) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/bulk-assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds, episodeId, metadata }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to bulk assign items');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error bulk assigning items:', error);
      throw error;
    }
  },

  /**
   * Get library stats
   */
  async getStats() {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/stats`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch stats');
      }
      
      const result = await response.json();
      return result.data || {};
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { total: 0, items: 0, sets: 0, recentUploads: 0 };
    }
  },

  /**
   * Bulk delete items
   */
  async bulkDelete(itemIds) {
    try {
      const response = await fetch(`${API_BASE}/wardrobe-library/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete items');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error bulk deleting items:', error);
      throw error;
    }
  },
};

export default wardrobeLibraryService;
