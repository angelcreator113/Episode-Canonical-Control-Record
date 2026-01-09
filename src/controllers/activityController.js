/**
 * Activity Controller - REST API for Activity Logs
 * Phase 3A: Real-time Notifications System
 *
 * Endpoints:
 * GET /api/v1/activity/feed - Get user's activity feed
 * GET /api/v1/activity/resource/:type/:id - Get resource activity
 * GET /api/v1/activity/team - Get team activity (admin)
 * GET /api/v1/activity/stats - Get activity statistics (admin)
 * GET /api/v1/activity/search - Search activity logs
 * GET /api/v1/activity/dashboard-stats - Dashboard statistics (admin)
 */

const express = require('express');
const router = express.Router();
const ActivityService = require('../services/ActivityService');
const logger = require('../services/Logger');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * GET /api/v1/activity/feed
 * Get user's activity feed with optional filtering
 */
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, actionType, resourceType, startDate, endDate } = req.query;

    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    const activities = await ActivityService.getActivityFeed(req.user.userId, {
      limit: limitNum,
      offset: offsetNum,
      actionType,
      resourceType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    res.json({
      status: 'success',
      data: {
        activities,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get activity feed', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get activity feed',
    });
  }
});

/**
 * GET /api/v1/activity/resource/:type/:id
 * Get all activities for a specific resource
 */
router.get('/resource/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!type || !id) {
      return res.status(400).json({
        status: 'error',
        message: 'Resource type and ID required',
      });
    }

    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    const activities = await ActivityService.getResourceActivity(type, id, {
      limit: limitNum,
      offset: offsetNum,
    });

    res.json({
      status: 'success',
      data: {
        resourceType: type,
        resourceId: id,
        activities,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get resource activity', {
      error: error.message,
      resourceType: req.params.type,
      resourceId: req.params.id,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get resource activity',
    });
  }
});

/**
 * GET /api/v1/activity/team
 * Get all team activities (admin only)
 */
router.get('/team', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { limit = 100, offset = 0, actionType, startDate, endDate } = req.query;

    const limitNum = Math.min(parseInt(limit) || 100, 500);
    const offsetNum = parseInt(offset) || 0;

    const activities = await ActivityService.getTeamActivity({
      limit: limitNum,
      offset: offsetNum,
      actionType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    res.json({
      status: 'success',
      data: {
        activities,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get team activity', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get team activity',
    });
  }
});

/**
 * GET /api/v1/activity/stats
 * Get activity statistics (admin only)
 */
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await ActivityService.getActivityStats(start, end);

    res.json({
      status: 'success',
      data: {
        period: {
          startDate: start,
          endDate: end,
        },
        stats,
      },
    });
  } catch (error) {
    logger.error('Failed to get activity statistics', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get activity statistics',
    });
  }
});

/**
 * GET /api/v1/activity/search
 * Search activity logs with full-text search
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query required (q parameter)',
      });
    }

    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    const results = await ActivityService.searchActivityLogs(q, {
      limit: limitNum,
      offset: offsetNum,
      userId: req.user.userId,
    });

    res.json({
      status: 'success',
      data: {
        query: q,
        results,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          resultCount: results.length,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to search activity logs', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to search activity logs',
    });
  }
});

/**
 * GET /api/v1/activity/dashboard-stats
 * Get dashboard statistics for admin (admin only)
 */
router.get('/dashboard-stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const daysNum = Math.min(parseInt(days) || 7, 90);
    const stats = await ActivityService.getDashboardStats(daysNum);

    res.json({
      status: 'success',
      data: {
        period: {
          days: daysNum,
          startDate: new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
        dailyStats: stats,
      },
    });
  } catch (error) {
    logger.error('Failed to get dashboard statistics', {
      error: error.message,
      userId: req.user.userId,
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get dashboard statistics',
    });
  }
});

module.exports = router;
