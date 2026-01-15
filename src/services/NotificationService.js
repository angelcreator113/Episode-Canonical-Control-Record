/**
 * NotificationService - Safe Notification Handler
 * Handles in-app notifications with graceful fallback
 */

class NotificationService {
  constructor() {
    this.enabled = process.env.NOTIFICATIONS_ENABLED !== 'false';
    this.notifications = [];
  }

  /**
   * Create a notification
   * @param {Object} data - Notification data
   * @returns {Promise}
   */
  async create(data) {
    try {
      if (!this.enabled) {
        return Promise.resolve();
      }

      const notification = {
        id: Date.now().toString(),
        ...data,
        createdAt: new Date(),
        read: false,
      };

      this.notifications.push(notification);

      // In a real implementation, you'd save to database
      // For now, just log it
      console.log('📬 Notification created:', notification.message);

      return Promise.resolve(notification);
    } catch (error) {
      console.error('Notification error:', error);
      return Promise.resolve(); // Don't throw - we don't want to break the flow
    }
  }

  /**
   * Get notifications for a user
   */
  async getByUserId(userId) {
    return this.notifications.filter((n) => n.userId === userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
    return Promise.resolve();
  }
}

module.exports = new NotificationService();
