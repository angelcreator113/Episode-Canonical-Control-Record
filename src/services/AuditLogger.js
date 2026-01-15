/**
 * Audit Logging Service
 * Centralized logging for all user actions
 */

const { models } = require('../models');
const { v4: _uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class AuditLogger {
  /**
   * Log an action
   */
  static async log(options = {}) {
    try {
      const {
        userId,
        username,
        action,
        resource,
        resourceId,
        _resourceName,
        changes = {},
        ipAddress,
        userAgent,
        _status = 'SUCCESS',
        _description = '',
        _metadata = {},
      } = options;

      // Store in ActivityLog for compliance
      await models.ActivityLog.create({
        userId: userId || 'unknown',
        actionType: action.toLowerCase(),
        resourceType: resource.toLowerCase(),
        resourceId: resourceId || 0,
        oldValues: changes.before || null,
        newValues: changes.after || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        timestamp: new Date(),
      }).catch((err) => {
        console.warn('ActivityLog insert failed:', err.message);
      });

      // Log to console for immediate feedback
      console.log(
        `[AUDIT] ${new Date().toISOString()} | ${action} | ${resource}${resourceId ? `/${resourceId}` : ''} | ${username || 'anonymous'}`
      );

      return true;
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit failures shouldn't block operations
      return false;
    }
  }

  /**
   * Log episode creation
   */
  static async logEpisodeCreate(episode, userId, username, req) {
    return this.log({
      userId,
      username,
      action: 'CREATE',
      resource: 'Episode',
      resourceId: episode.id,
      resourceName: episode.title,
      changes: {
        before: null,
        after: episode.dataValues,
      },
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `Created episode: ${episode.title}`,
    });
  }

  /**
   * Log episode update
   */
  static async logEpisodeUpdate(oldEpisode, newEpisode, userId, username, req) {
    const changes = {};
    for (const key in newEpisode.dataValues) {
      if (oldEpisode[key] !== newEpisode[key]) {
        changes[key] = {
          before: oldEpisode[key],
          after: newEpisode[key],
        };
      }
    }

    return this.log({
      userId,
      username,
      action: 'UPDATE',
      resource: 'Episode',
      resourceId: newEpisode.id,
      resourceName: newEpisode.title,
      changes: {
        before: oldEpisode,
        after: newEpisode.dataValues,
      },
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `Updated episode: ${newEpisode.title}`,
      metadata: { fieldsChanged: Object.keys(changes) },
    });
  }

  /**
   * Log episode deletion
   */
  static async logEpisodeDelete(episode, userId, username, req) {
    return this.log({
      userId,
      username,
      action: 'DELETE',
      resource: 'Episode',
      resourceId: episode.id,
      resourceName: episode.title,
      changes: {
        before: episode.dataValues,
        after: null,
      },
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `Deleted episode: ${episode.title}`,
    });
  }

  /**
   * Log asset upload
   */
  static async logAssetUpload(asset, userId, username, req) {
    return this.log({
      userId,
      username,
      action: 'UPLOAD',
      resource: 'Asset',
      resourceId: asset.id,
      resourceName: asset.name,
      changes: {
        before: null,
        after: asset,
      },
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `Uploaded asset: ${asset.name}`,
      metadata: { fileSize: asset.size, type: asset.type },
    });
  }

  /**
   * Log template creation
   */
  static async logTemplateCreate(template, userId, username, req) {
    return this.log({
      userId,
      username,
      action: 'CREATE',
      resource: 'Template',
      resourceId: template.id,
      resourceName: template.name,
      changes: {
        before: null,
        after: template.dataValues,
      },
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `Created template: ${template.name}`,
    });
  }

  /**
   * Log user login
   */
  static async logLogin(userId, username, req) {
    return this.log({
      userId,
      username,
      action: 'LOGIN',
      resource: 'User',
      resourceId: userId,
      resourceName: username,
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `User login: ${username}`,
    });
  }

  /**
   * Log user logout
   */
  static async logLogout(userId, username, req) {
    return this.log({
      userId,
      username,
      action: 'LOGOUT',
      resource: 'User',
      resourceId: userId,
      resourceName: username,
      ipAddress: this.getClientIP(req),
      userAgent: req?.headers['user-agent'],
      description: `User logout: ${username}`,
    });
  }

  /**
   * Get client IP address
   */
  static getClientIP(req) {
    if (!req) return null;
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Fetch audit logs with filters
   */
  static async getAuditLogs(options = {}) {
    const {
      userId = null,
      action = null,
      resource = null,
      startDate = null,
      endDate = null,
      limit = 100,
      offset = 0,
    } = options;

    const where = {};
    if (userId) where.userId = userId;
    if (action) where.actionType = action.toLowerCase();
    if (resource) where.resourceType = resource.toLowerCase();

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate);
    }

    try {
      const logs = await models.ActivityLog.findAll({
        where,
        order: [['timestamp', 'DESC']],
        limit,
        offset,
      });

      const total = await models.ActivityLog.count({ where });

      return {
        data: logs,
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditLogger;
