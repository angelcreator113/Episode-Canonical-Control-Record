/**
 * Audit Log Routes
 * GET /api/v1/audit-logs - Get audit logs (admin only)
 * GET /api/v1/audit-logs/:id - Get single audit log
 */

const express = require('express');
const { models } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const AuditLogger = require('../services/AuditLogger');

const router = express.Router();

/**
 * GET /api/v1/audit-logs
 * Fetch audit logs with filtering
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, actionType, resourceType, startDate, endDate } = req.query;
    const where = {};

    if (actionType) where.actionType = actionType;
    if (resourceType) where.resourceType = resourceType;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[models.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[models.Sequelize.Op.lte] = new Date(endDate);
    }

    const parsedLimit = Math.min(parseInt(limit) || 100, 500);
    const parsedOffset = parseInt(offset) || 0;

    const { count: total, rows: logs } = await models.ActivityLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.json({
      status: 'SUCCESS',
      data: logs,
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
router.get('/stats', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[models.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[models.Sequelize.Op.lte] = new Date(endDate);
    }

    // Get stats by action type
    const actionStats = await models.ActivityLog.findAll({
      attributes: [
        'actionType',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
      ],
      where,
      group: ['actionType'],
      raw: true,
    });

    // Get stats by resource type
    const resourceStats = await models.ActivityLog.findAll({
      attributes: [
        'resourceType',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
      ],
      where,
      group: ['resourceType'],
      raw: true,
    });

    // Get stats by user
    const userStats = await models.ActivityLog.findAll({
      attributes: ['userId', [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']],
      where,
      group: ['userId'],
      order: [[models.sequelize.fn('COUNT', models.sequelize.col('id')), 'DESC']],
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
router.get('/user/:userId', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const logs = await models.ActivityLog.findAll({
      where: { userId },
      order: [['timestamp', 'DESC']],
      limit: Math.min(parseInt(limit), 500),
      offset: parseInt(offset),
    });

    const total = await models.ActivityLog.count({ where: { userId } });

    res.json({
      status: 'SUCCESS',
      data: logs,
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
