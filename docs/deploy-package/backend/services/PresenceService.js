/**
 * PresenceService - User Presence Tracking
 * Tracks who is viewing what in real-time
 */

class PresenceService {
  constructor() {
    this.enabled = process.env.PRESENCE_TRACKING_ENABLED !== 'false';
    this.presenceMap = new Map();
  }

  /**
   * Set user presence on a resource
   */
  async setPresence(userId, resourceType, resourceId) {
    try {
      if (!this.enabled) {
        return Promise.resolve();
      }

      const key = `${resourceType}:${resourceId}`;

      if (!this.presenceMap.has(key)) {
        this.presenceMap.set(key, new Set());
      }

      this.presenceMap.get(key).add(userId);

      return Promise.resolve();
    } catch (error) {
      console.error('Presence error:', error);
      return Promise.resolve();
    }
  }

  /**
   * Remove user presence
   */
  async removePresence(userId, resourceType, resourceId) {
    try {
      const key = `${resourceType}:${resourceId}`;

      if (this.presenceMap.has(key)) {
        this.presenceMap.get(key).delete(userId);
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.resolve();
    }
  }

  /**
   * Get who is viewing a resource
   */
  async getPresence(resourceType, resourceId) {
    const key = `${resourceType}:${resourceId}`;
    return Array.from(this.presenceMap.get(key) || []);
  }
}

module.exports = new PresenceService();
