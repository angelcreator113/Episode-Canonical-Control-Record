/**
 * Show Service
 * Handles all API calls for show management
 */

const API_BASE = 'http://localhost:3002/api/v1';

export const showService = {
  /**
   * Get all shows
   */
  async getAllShows() {
    try {
      const response = await fetch(`${API_BASE}/shows`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shows: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error fetching shows:', error);
      throw error;
    }
  },

  /**
   * Get a single show by ID
   */
  async getShowById(id) {
    try {
      const response = await fetch(`${API_BASE}/shows/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch show: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching show:', error);
      throw error;
    }
  },

  /**
   * Create a new show
   */
  async createShow(showData) {
    try {
      const response = await fetch(`${API_BASE}/shows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(showData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create show');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error creating show:', error);
      throw error;
    }
  },

  /**
   * Update an existing show
   */
  async updateShow(id, showData) {
    try {
      const response = await fetch(`${API_BASE}/shows/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(showData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update show');
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error updating show:', error);
      throw error;
    }
  },

  /**
   * Delete a show
   */
  async deleteShow(id) {
    try {
      const response = await fetch(`${API_BASE}/shows/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete show');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting show:', error);
      throw error;
    }
  },
};

export default showService;
