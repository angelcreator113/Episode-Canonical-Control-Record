/**
 * Socket Controller - REST API for WebSocket Administration
 * Phase 3A: Real-time Notifications System
 *
 * Admin-only endpoints for managing real-time connections:
 * POST /api/v1/socket/broadcast - Broadcast message to all connected clients
 * POST /api/v1/socket/notify-user/:id - Send notification to specific user
 * POST /api/v1/socket/notify-room/:id - Send notification to room/group
 * POST /api/v1/socket/disconnect/:id - Force disconnect a user
 * GET /api/v1/socket/stats - Get WebSocket connection statistics
 * GET /api/v1/socket/connections - List all active connections
 */

const express = require('express');
const router = express.Router();
const SocketService = require('../services/SocketService');
const logger = require('../services/Logger');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * POST /api/v1/socket/broadcast
 * Broadcast a message to all connected clients (admin only)
 */
router.post('/broadcast', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { message, type = 'broadcast', data = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content required',
      });
    }

    const result = await SocketService.broadcastToAll({
      message,
      type,
      data,
      sentBy: req.user.userId,
      timestamp: new Date(),
    });

    logger.info('Broadcast sent by admin', {
      userId: req.user.userId,
      messageType: type,
      recipientCount: result.clientCount,
    });

    res.json({
      status: 'success',
      data: {
        message: 'Broadcast sent',
        result,
      },
    });
  } catch (error) {
    logger.error('Failed to broadcast message', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to broadcast message',
    });
  }
});

/**
 * POST /api/v1/socket/notify-user/:id
 * Send notification to a specific user via WebSocket (admin only)
 */
router.post('/notify-user/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const { message, type = 'notification', data = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content required',
      });
    }

    const result = await SocketService.notifyUser(targetUserId, {
      message,
      type,
      data,
      sentBy: req.user.userId,
      timestamp: new Date(),
    });

    if (!result.sent) {
      return res.status(404).json({
        status: 'error',
        message: 'User not connected or offline',
      });
    }

    logger.info('User notification sent by admin', {
      userId: req.user.userId,
      targetUserId,
      messageType: type,
    });

    res.json({
      status: 'success',
      data: {
        message: 'Notification sent',
        result,
      },
    });
  } catch (error) {
    logger.error('Failed to notify user', {
      error: error.message,
      userId: req.user.userId,
      targetUserId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to notify user',
    });
  }
});

/**
 * POST /api/v1/socket/notify-room/:id
 * Send notification to all users in a room/group via WebSocket (admin only)
 */
router.post('/notify-room/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { message, type = 'notification', data = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content required',
      });
    }

    const result = await SocketService.notifyRoom(roomId, {
      message,
      type,
      data,
      sentBy: req.user.userId,
      timestamp: new Date(),
    });

    logger.info('Room notification sent by admin', {
      userId: req.user.userId,
      roomId,
      messageType: type,
      recipientCount: result.clientCount,
    });

    res.json({
      status: 'success',
      data: {
        message: 'Room notification sent',
        result,
      },
    });
  } catch (error) {
    logger.error('Failed to notify room', {
      error: error.message,
      userId: req.user.userId,
      roomId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to notify room',
    });
  }
});

/**
 * POST /api/v1/socket/disconnect/:id
 * Force disconnect a specific user's WebSocket connection (admin only)
 */
router.post('/disconnect/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const { reason = 'Admin disconnection' } = req.body;

    const result = await SocketService.disconnectUser(targetUserId, reason);

    if (!result.disconnected) {
      return res.status(404).json({
        status: 'error',
        message: 'User not connected',
      });
    }

    logger.info('User forcefully disconnected by admin', {
      userId: req.user.userId,
      targetUserId,
      reason,
    });

    res.json({
      status: 'success',
      data: {
        message: 'User disconnected',
        result,
      },
    });
  } catch (error) {
    logger.error('Failed to disconnect user', {
      error: error.message,
      userId: req.user.userId,
      targetUserId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to disconnect user',
    });
  }
});

/**
 * GET /api/v1/socket/stats
 * Get WebSocket connection statistics (admin only)
 */
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const stats = await SocketService.getConnectionStats();

    res.json({
      status: 'success',
      data: {
        stats,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to get socket statistics', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get socket statistics',
    });
  }
});

/**
 * GET /api/v1/socket/connections
 * Get list of all active WebSocket connections (admin only)
 */
router.get('/connections', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { limit = 200, offset = 0 } = req.query;

    const limitNum = Math.min(parseInt(limit) || 200, 1000);
    const offsetNum = parseInt(offset) || 0;

    const connections = await SocketService.getActiveConnections({
      limit: limitNum,
      offset: offsetNum,
    });

    res.json({
      status: 'success',
      data: {
        connections,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          count: connections.length,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get active connections', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get active connections',
    });
  }
});

module.exports = router;
