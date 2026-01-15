/**
 * Notification Controller - REST API for Notifications
 * Phase 3A: Real-time Notifications System
 *
 * Endpoints:
 * POST   /api/v1/notifications - Create notification (admin)
 * GET    /api/v1/notifications - Get user's notifications
 * POST   /api/v1/notifications/:id/read - Mark as read
 * POST   /api/v1/notifications/read-all - Mark all as read
 * DELETE /api/v1/notifications/:id - Delete notification
 * GET    /api/v1/notifications/unread-count - Get unread count
 * GET    /api/v1/notifications/preferences - Get preferences
 * POST   /api/v1/notifications/preferences - Update preferences
 */

const express = require('express');
const router = express.Router();
const NotificationService = require('../services/NotificationService');
const logger = require('../services/Logger');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * POST /api/v1/notifications
 * Create and send notification (Admin only)
 */
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { type, title, message, data, recipientIds, priority, expiresInHours } = req.body;

    if (!type || !title || !recipientIds || !Array.isArray(recipientIds)) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: type, title, recipientIds (array)',
      });
    }

    const notifications = await NotificationService.createNotification(
      type,
      title,
      message,
      data,
      recipientIds,
      { priority, expiresInHours }
    );

    logger.info('Notifications created by admin', {
      adminId: req.user.userId,
      type,
      recipientCount: recipientIds.length,
    });

    res.status(201).json({
      status: 'success',
      data: {
        notificationCount: notifications.length,
        notifications,
      },
    });
  } catch (error) {
    logger.error('Failed to create notification', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to create notification',
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/notifications
 * Get user's notifications with optional filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type, onlyUnread = false } = req.query;

    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = parseInt(offset) || 0;

    const notifications = await NotificationService.getNotifications(req.user.userId, {
      limit: limitNum,
      offset: offsetNum,
      type,
      onlyUnread: onlyUnread === 'true',
    });

    const unreadCount = await NotificationService.getUnreadCount(req.user.userId);

    res.json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: unreadCount,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get notifications', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notifications',
    });
  }
});

/**
 * POST /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Notification ID required',
      });
    }

    const notification = await NotificationService.markAsRead(id);

    res.json({
      status: 'success',
      data: notification,
    });
  } catch (error) {
    logger.error('Failed to mark notification as read', {
      error: error.message,
      notificationId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read for user
 */
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user.userId);

    logger.debug('All notifications marked as read', {
      userId: req.user.userId,
      count: result.length,
    });

    res.json({
      status: 'success',
      data: {
        markedAsRead: result.length,
      },
    });
  } catch (error) {
    logger.error('Failed to mark all as read', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read',
    });
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Notification ID required',
      });
    }

    await NotificationService.deleteNotification(id);

    res.json({
      status: 'success',
      data: {
        deletedId: id,
      },
    });
  } catch (error) {
    logger.error('Failed to delete notification', {
      error: error.message,
      notificationId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification',
    });
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user.userId);

    res.json({
      status: 'success',
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    logger.error('Failed to get unread count', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get unread count',
    });
  }
});

/**
 * GET /api/v1/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = await NotificationService.getPreferences(req.user.userId);

    res.json({
      status: 'success',
      data: preferences,
    });
  } catch (error) {
    logger.error('Failed to get preferences', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get preferences',
    });
  }
});

/**
 * POST /api/v1/notifications/preferences
 * Update user's notification preferences
 */
router.post('/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = req.body;

    const updated = await NotificationService.updatePreferences(req.user.userId, preferences);

    logger.debug('Notification preferences updated', {
      userId: req.user.userId,
    });

    res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    logger.error('Failed to update preferences', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to update preferences',
    });
  }
});

module.exports = router;
