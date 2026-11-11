const { models } = require('../models');

/**
 * The audit call the controllers use (issue #1948; Evoni, 2026-11-11).
 *
 * logger.logAction is the ONE call per audited operation. It writes through
 * the one writer, ActivityLog.logActivity, into activity_logs. It never
 * throws: for the controllers that use it, a failed audit entry is logged
 * loudly and the request goes on. (An operation that must not happen without
 * its entry calls ActivityLog.logActivity itself, inside its transaction.)
 *
 * Not here any more: the request-logging middleware `auditLog` (never
 * mounted; it logged every request, page views included, with the caller's
 * IP address and user agent) and its helpers. Page views are not audited.
 */

/** Keep what the response sent, for handlers that read res.locals.responseData. */
const captureResponseData = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    res.locals.responseData = data?.data || data;
    return originalJson.call(this, data);
  };

  next();
};

const NOT_STORED = new Set(['oldValues', 'newValues', 'ipAddress', 'userAgent']);

/** { before?, after?, meta? } from a logAction options object; null when empty. */
function changesFrom(options = {}) {
  const changes = {};
  if (options.oldValues !== null && options.oldValues !== undefined) changes.before = options.oldValues;
  if (options.newValues !== null && options.newValues !== undefined) changes.after = options.newValues;
  const meta = Object.fromEntries(Object.entries(options).filter(([k, v]) => !NOT_STORED.has(k) && v !== undefined));
  if (Object.keys(meta).length) changes.meta = meta;
  return Object.keys(changes).length ? changes : null;
}

const logger = {
  /**
   * Record one action: (userId, action, resourceType, resourceId, { oldValues,
   * newValues, …anything else, kept under changes.meta }). Resolves to the
   * entry, or to null when it was not written; never rejects. A 'view' is
   * not an audited action and writes nothing.
   */
  logAction: async (userId, action, resourceType, resourceId, options = {}) => {
    if (String(action || '').toLowerCase() === 'view') return null;
    try {
      const { ActivityLog } = models;
      if (!ActivityLog) throw new Error('the ActivityLog model is not loaded');
      return await ActivityLog.logActivity({
        userId, action, resourceType, resourceId, changes: changesFrom(options || {}),
      });
    } catch (error) {
      console.error(`[audit] NOT RECORDED: ${action} ${resourceType} ${resourceId ?? ''}:`, error.message);
      return null;
    }
  },

  /** A user's entries, newest first ([] when they cannot be read). */
  getUserHistory: async (userId, limit) => {
    try {
      return await models.ActivityLog.getUserHistory(userId, limit);
    } catch (error) {
      console.error('[audit] user history could not be read:', error.message);
      return [];
    }
  },

  /** A resource's entries, newest first ([] when they cannot be read). */
  getResourceHistory: async (resourceType, resourceId) => {
    try {
      return await models.ActivityLog.getResourceHistory(resourceType, resourceId);
    } catch (error) {
      console.error('[audit] resource history could not be read:', error.message);
      return [];
    }
  },

  /** Entries between two dates ([] when they cannot be read). */
  getAuditTrail: async (startDate, endDate, filters) => {
    try {
      return await models.ActivityLog.getAuditTrail(startDate, endDate, filters);
    } catch (error) {
      console.error('[audit] the audit trail could not be read:', error.message);
      return [];
    }
  },

  /** Counts by action over the last `days` days ([] when they cannot be read). */
  getStats: async (days) => {
    try {
      return await models.ActivityLog.getStats(days);
    } catch (error) {
      console.error('[audit] the audit statistics could not be read:', error.message);
      return [];
    }
  },
};

module.exports = {
  captureResponseData,
  logger,
  changesFrom,
};
