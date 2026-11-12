/**
 * Audit Log Routes (ADMIN only). Readers of activity_logs, the one audit
 * trail (models/ActivityLog; issue #1948): columns user_id, action,
 * resource_type, resource_id, changes, created_at.
 * GET /api/v1/audit-logs               entries, newest first; filters action
 *                                      (or actionType), resource (or
 *                                      resourceType), resourceId, userId,
 *                                      startDate, endDate
 * GET /api/v1/audit-logs/stats         counts by action, resource type, user
 * GET /api/v1/audit-logs/user/:userId  one user's entries
 */

const express = require('express');
const { Op, fn, col } = require('sequelize');
const { models } = require('../models');
const { requireAuth, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * An entry as the routes return it. The Audit Log page (/admin/audit) reads
 * actionType and timestamp, the names the old model promised; they are kept
 * beside action and createdAt so the page shows real rows unchanged.
 */
const present = (log) => {
  const entry = typeof log.get === 'function' ? log.get({ plain: true }) : log;
  return { ...entry, actionType: entry.action, timestamp: entry.createdAt };
};

/**
 * GET /api/v1/audit-logs
 * Fetch audit logs with filtering
 */
router.get('/', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { limit = 100, offset = 0, action, actionType, resource, resourceType, resourceId, userId, startDate, endDate } = req.query;
    const where = {};

    if (action || actionType) where.action = String(action || actionType).toLowerCase();
    if (resource || resourceType) where.resourceType = String(resource || resourceType).toLowerCase();
    if (resourceId) where.resourceId = String(resourceId);
    if (userId) where.userId = String(userId);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const parsedLimit = Math.min(parseInt(limit) || 100, 500);
    const parsedOffset = parseInt(offset) || 0;

    const { count: total, rows: logs } = await models.ActivityLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.json({
      status: 'SUCCESS',
      data: logs.map(present),
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/audit-logs/stats
 * Get audit log statistics
 */
router.get('/stats', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // Get stats by action type
    const actionStats = await models.ActivityLog.findAll({
      attributes: [
        'action',
        [fn('COUNT', col('id')), 'count'],
      ],
      where,
      group: ['action'],
      raw: true,
    });

    // Get stats by resource type
    const resourceStats = await models.ActivityLog.findAll({
      attributes: [
        [col('resource_type'), 'resourceType'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where,
      group: [col('resource_type')],
      raw: true,
    });

    // Get stats by user
    const userStats = await models.ActivityLog.findAll({
      attributes: [
        [col('user_id'), 'userId'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where,
      group: [col('user_id')],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 10,
      raw: true,
    });

    res.json({
      status: 'SUCCESS',
      data: {
        byAction: actionStats,
        byResource: resourceStats,
        byUser: userStats,
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit stats:', error);
    res.status(500).json({
      error: 'Failed to fetch audit statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/audit-logs/user/:userId
 * Get logs for specific user
 */
router.get('/user/:userId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const logs = await models.ActivityLog.findAll({
      where: { userId },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: Math.min(parseInt(limit), 500),
      offset: parseInt(offset),
    });

    const total = await models.ActivityLog.count({ where: { userId } });

    res.json({
      status: 'SUCCESS',
      data: logs.map(present),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Failed to fetch user audit logs:', error);
    res.status(500).json({
      error: 'Failed to fetch user audit logs',
      message: error.message,
    });
  }
});

module.exports = router;
