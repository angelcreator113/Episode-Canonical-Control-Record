/**
 * ActivityService - Safe Activity Logger
 * Logs user activities with graceful fallback
 */

class ActivityService {
  constructor() {
    this.enabled = process.env.ACTIVITY_LOGGING_ENABLED !== 'false';
    this.activities = [];
  }

  /**
   * Log an activity
   * @param {Object} data - Activity data
   * @returns {Promise}
   */
  async logActivity(data) {
    try {
      if (!this.enabled) {
        return Promise.resolve();
      }

      const activity = {
        id: Date.now().toString(),
        ...data,
        timestamp: new Date(),
      };

      this.activities.push(activity);

      console.log(`📊 Activity logged: ${data.action} on ${data.resourceType}`);

      return Promise.resolve(activity);
    } catch (error) {
      console.error('Activity logging error:', error);
      return Promise.resolve(); // Don't throw
    }
  }

  /**
   * Get activities by user
   */
  async getByUserId(userId) {
    return this.activities.filter(a => a.userId === userId);
  }

  /**
   * Get activities by resource
   */
  async getByResource(resourceType, resourceId) {
    return this.activities.filter(
      a => a.resourceType === resourceType && a.resourceId === resourceId
    );
  }
}

module.exports = new ActivityService();