const { models } = require('../models');
const { ActivityLog } = models;

/**
 * Audit Logging Middleware
 * Automatically logs all user activities for compliance and security
 */

/**
 * Determine action type from HTTP method
 */
const getActionType = (method) => {
  const actionMap = {
    GET: 'view',
    POST: 'create',
    PUT: 'edit',
    PATCH: 'edit',
    DELETE: 'delete',
  };
  return actionMap[method] || 'view';
};

/**
 * Extract resource information from request
 */
const getResourceInfo = (req) => {
  const path = req.path;
  const parts = path.split('/').filter(p => p);

  // Parse route: /api/v1/{resource}/{id}/{action}
  // Examples:
  // /api/v1/episodes -> resource: episodes, id: null
  // /api/v1/episodes/123 -> resource: episodes, id: 123
  // /api/v1/episodes/123/enqueue -> resource: episodes, id: 123, action: enqueue

  let resource = 'unknown';
  let resourceId = null;
  let action = null;

  if (parts.length >= 3) {
    resource = parts[2]; // episodes, thumbnails, metadata, etc.

    if (parts.length >= 4) {
      // Check if next part is an ID (numeric) or action name
      if (/^\d+$/.test(parts[3])) {
        resourceId = parts[3];
        if (parts.length >= 5) {
          action = parts[4];
        }
      } else {
        action = parts[3];
      }
    }
  }

  return {
    resource,
    resourceId,
    action,
  };
};

/**
 * Extract change information from request/response
 */
const getChangeInfo = (req, res) => {
  const oldValues = req.body?.oldValues || null;
  const newValues = req.body?.newValues || res.locals?.responseData || null;

  // For relevant HTTP methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return {
      oldValues,
      newValues,
    };
  }

  return {
    oldValues: null,
    newValues: null,
  };
};

/**
 * Capture response data for audit logging
 */
const captureResponseData = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    res.locals.responseData = data?.data || data;
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Audit logging middleware
 * Logs user actions to activity_logs table
 */
const auditLog = async (req, res, next) => {
  // Skip non-mutation operations for now, or log all based on config
  // Current implementation logs all requests

  const originalSend = res.send;

  res.send = function(data) {
    // Log activity after response is sent
    setImmediate(() => {
      logActivity(req, res, data).catch(err => {
        console.error('Error logging activity:', err.message);
      });
    });

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Log activity to database
 */
const logActivity = async (req, res, _responseData) => {
  try {
    // Skip logging for certain paths
    const skipPaths = ['/health', '/api/v1'];
    if (skipPaths.some(p => req.path.startsWith(p))) {
      return;
    }

    // Skip logging if database not available
    if (!ActivityLog) {
      return;
    }

    const { resource, resourceId, _action } = getResourceInfo(req);
    const actionType = getActionType(req.method);
    const { oldValues, newValues } = getChangeInfo(req, res);

    // Log to database
    await ActivityLog.logActivity({
      userId: req.user?.id || 'anonymous',
      actionType,
      resourceType: resource,
      resourceId: resourceId?.toString() || 'batch',
      oldValues,
      newValues,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Audit log error:', error);
  }
};

/**
 * Activity logger service
 * Direct access to activity logging
 */
const logger = {
  /**
   * Log a user action
   */
  logAction: async (userId, actionType, resourceType, resourceId, options = {}) => {
    try {
      if (!ActivityLog) {
        return null;
      }

      return await ActivityLog.logActivity({
        userId,
        actionType,
        resourceType,
        resourceId: resourceId?.toString() || null,
        oldValues: options.oldValues || null,
        newValues: options.newValues || null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      });
    } catch (error) {
      console.error('Error logging action:', error);
      return null;
    }
  },

  /**
   * Get user activity history
   */
  getUserHistory: async (userId, options = {}) => {
    try {
      if (!ActivityLog) {
        return [];
      }

      return await ActivityLog.getUserHistory(userId, options);
    } catch (error) {
      console.error('Error fetching user history:', error);
      return [];
    }
  },

  /**
   * Get resource activity history
   */
  getResourceHistory: async (resourceType, resourceId) => {
    try {
      if (!ActivityLog) {
        return [];
      }

      return await ActivityLog.getResourceHistory(resourceType, resourceId);
    } catch (error) {
      console.error('Error fetching resource history:', error);
      return [];
    }
  },

  /**
   * Get full audit trail
   */
  getAuditTrail: async (options = {}) => {
    try {
      if (!ActivityLog) {
        return [];
      }

      return await ActivityLog.getAuditTrail(options);
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      return [];
    }
  },

  /**
   * Get activity statistics
   */
  getStats: async (timeRange = '7d') => {
    try {
      if (!ActivityLog) {
        return {};
      }

      return await ActivityLog.getStats(timeRange);
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {};
    }
  },
};

module.exports = {
  auditLog,
  captureResponseData,
  logger,
  getActionType,
  getResourceInfo,
};
