'use strict';
const { DataTypes } = require('sequelize');

/**
 * ActivityLog Model
 * Audit trail for compliance and security monitoring
 */
module.exports = (sequelize) => {
  const ActivityLog = sequelize.define(
    'ActivityLog',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      // User info
      userId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        comment: 'Cognito user ID',
      },

      // Action details
      actionType: {
        type: DataTypes.ENUM(
          'view',
          'create',
          'edit',
          'delete',
          'CREATE',
          'UPDATE',
          'DELETE',
          'download',
          'upload'
        ),
        allowNull: false,
        comment: 'Type of action performed',
      },
      resourceType: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        comment: 'Type of resource affected',
      },
      resourceId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
        comment: 'ID of the resource (UUID or integer)',
      },

      // Data changes
      oldValues: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Previous state of resource (for edits)',
      },
      newValues: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'New state of resource (for edits)',
      },

      // Network info
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
        validate: {
          isIP: true,
        },
        comment: 'IP address of request origin',
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'HTTP User-Agent header',
      },

      // Timestamp
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'When action was performed',
      },
    },
    {
      sequelize,
      modelName: 'ActivityLog',
      tableName: 'activity_logs',
      timestamps: false,
      underscored: true,
      indexes: [
        {
          name: 'idx_user_timestamp',
          fields: ['userId', 'timestamp'],
        },
        {
          name: 'idx_resource',
          fields: ['resourceType', 'resourceId'],
        },
        {
          name: 'idx_action_type',
          fields: ['actionType'],
        },
        {
          name: 'idx_timestamp',
          fields: ['timestamp'],
        },
      ],
    }
  );

  /**
   * Class Methods
   */

  /**
   * Log an activity
   */
  ActivityLog.logActivity = async function (
    userId,
    actionType,
    resourceType,
    resourceId,
    options = {}
  ) {
    return ActivityLog.create({
      userId,
      actionType,
      resourceType,
      resourceId,
      oldValues: options.oldValues || null,
      newValues: options.newValues || null,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
    });
  };

  /**
   * Get activity history for user
   */
  ActivityLog.getUserHistory = async function (userId, limit = 50) {
    return ActivityLog.findAll({
      where: { userId },
      order: [['timestamp', 'DESC']],
      limit,
    });
  };

  /**
   * Get activity history for resource
   */
  ActivityLog.getResourceHistory = async function (resourceType, resourceId) {
    return ActivityLog.findAll({
      where: { resourceType, resourceId },
      order: [['timestamp', 'DESC']],
    });
  };

  /**
   * Get audit trail for date range
   */
  ActivityLog.getAuditTrail = async function (startDate, endDate, filters = {}) {
    const where = {
      timestamp: {
        [sequelize.Sequelize.Op.between]: [startDate, endDate],
      },
    };

    if (filters.userId) where.userId = filters.userId;
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.resourceType) where.resourceType = filters.resourceType;

    return ActivityLog.findAll({
      where,
      order: [['timestamp', 'DESC']],
    });
  };

  /**
   * Get activity stats
   */
  ActivityLog.getStats = async function (days = 7) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const stats = await ActivityLog.sequelize.query(
      `SELECT 
        action_type,
        COUNT(*) as count
      FROM activity_logs
      WHERE timestamp >= :since_date
      GROUP BY action_type`,
      {
        replacements: { since_date: sinceDate },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    return stats;
  };

  return ActivityLog;
};
