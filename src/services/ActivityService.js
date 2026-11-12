/**
 * ActivityService: an in-memory activity list. NOT the audit trail.
 *
 * It keeps entries in this process's memory only; nothing here reaches
 * activity_logs. Since issue #1948 (Evoni, 2026-11-11) no audited operation
 * calls it: the audit trail is written by logger.logAction
 * (middleware/auditLog) through ActivityLog.logActivity.
 *
 * Its one remaining user is controllers/activityController
 * (/api/v1/activity), which calls methods this class does not have
 * (getActivityFeed, getTeamActivity …) and so answers 500. That route is
 * broken, has no caller in the frontend, and was left out of the #1948
 * repair on purpose.
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
    return this.activities.filter((a) => a.userId === userId);
  }

  /**
   * Get activities by resource
   */
  async getByResource(resourceType, resourceId) {
    return this.activities.filter(
      (a) => a.resourceType === resourceType && a.resourceId === resourceId
    );
  }
}

module.exports = new ActivityService();
