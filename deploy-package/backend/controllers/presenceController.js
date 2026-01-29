/**
 * Presence Controller - REST API for User Presence/Status
 * Phase 3A: Real-time Notifications System
 *
 * Endpoints:
 * GET /api/v1/presence/online-users - Get all online users
 * GET /api/v1/presence/status - Get current user's status
 * POST /api/v1/presence/status - Update user's status
 * GET /api/v1/presence/resource-viewers/:type/:id - Get who's viewing resource
 * GET /api/v1/presence/stats - Get presence statistics (admin)
 */

const express = require('express');
const router = express.Router();
const PresenceService = require('../services/PresenceService');
const logger = require('../services/Logger');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * GET /api/v1/presence/online-users
 * Get all currently online users
 */
router.get('/online-users', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const limitNum = Math.min(parseInt(limit) || 100, 500);
    const offsetNum = parseInt(offset) || 0;

    const users = await PresenceService.getOnlineUsers({
      limit: limitNum,
      offset: offsetNum,
    });

    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          count: users.length,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get online users', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get online users',
    });
  }
});

/**
 * GET /api/v1/presence/status
 * Get current user's presence status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = await PresenceService.getUserStatus(req.user.userId);

    res.json({
      status: 'success',
      data: {
        userId: req.user.userId,
        presence: status,
      },
    });
  } catch (error) {
    logger.error('Failed to get user status', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user status',
    });
  }
});

/**
 * POST /api/v1/presence/status
 * Update current user's presence status
 */
router.post('/status', authenticateToken, async (req, res) => {
  try {
    const { status: newStatus, customStatus = null } = req.body;

    if (!newStatus || !['online', 'away', 'offline', 'dnd'].includes(newStatus)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid status required: online, away, offline, or dnd',
      });
    }

    const updated = await PresenceService.updateUserStatus(req.user.userId, {
      status: newStatus,
      customStatus,
      lastActivity: new Date(),
    });

    logger.info('User status updated', {
      userId: req.user.userId,
      newStatus,
    });

    res.json({
      status: 'success',
      data: {
        userId: req.user.userId,
        presence: updated,
      },
    });
  } catch (error) {
    logger.error('Failed to update user status', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user status',
    });
  }
});

/**
 * GET /api/v1/presence/resource-viewers/:type/:id
 * Get all users currently viewing a specific resource
 */
router.get('/resource-viewers/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!type || !id) {
      return res.status(400).json({
        status: 'error',
        message: 'Resource type and ID required',
      });
    }

    const viewers = await PresenceService.getResourceViewers(type, id);

    res.json({
      status: 'success',
      data: {
        resourceType: type,
        resourceId: id,
        viewers,
        viewerCount: viewers.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get resource viewers', {
      error: error.message,
      resourceType: req.params.type,
      resourceId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get resource viewers',
    });
  }
});

/**
 * GET /api/v1/presence/stats
 * Get presence statistics (admin only)
 */
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const stats = await PresenceService.getPresenceStats();

    res.json({
      status: 'success',
      data: {
        stats,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to get presence statistics', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get presence statistics',
    });
  }
});

module.exports = router;
