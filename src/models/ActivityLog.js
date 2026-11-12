'use strict';
const { DataTypes, Op } = require('sequelize');

/**
 * ActivityLog — the one administrative audit trail (issue #1948; design
 * docs/design/2026-11-season-planning.md §9, Option C; Evoni, 2026-11-11).
 *
 * Table activity_logs, in production's shape (migration
 * 20261111230000-converge-activity-logs):
 *   id, user_id, action, resource_type, resource_id (text: UUIDs fit),
 *   changes (JSONB), created_at (set by the database)
 *
 * ONE writer: ActivityLog.logActivity({ userId, action, resourceType,
 * resourceId, changes }, { transaction }). It throws when the entry cannot be
 * written; the caller decides whether that is fatal. Inside a transaction
 * the entry commits or rolls back with the work it records.
 *
 * Never stored: IP addresses, user agents, page views, placeholder user ids.
 */

/** Stand-ins older code used for "nobody signed in". Stored as NULL. */
const PLACEHOLDER_USERS = new Set(['anonymous', 'unknown', 'system', 'null', 'undefined', '']);

const text = (value) => (value === null || value === undefined ? null : String(value).trim());

/** The row an entry becomes, or a TypeError naming what is wrong with it. */
function normalize(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError('ActivityLog.logActivity takes one object: { userId, action, resourceType, resourceId, changes }');
  }
  const action = text(entry.action);
  const resourceType = text(entry.resourceType);
  if (!action) throw new TypeError('ActivityLog.logActivity: action is required');
  if (action.toLowerCase() === 'view') throw new TypeError('ActivityLog.logActivity: page views are not audited');
  if (!resourceType) throw new TypeError('ActivityLog.logActivity: resourceType is required');
  const user = text(entry.userId);
  const { changes = null } = entry;
  if (changes !== null && (typeof changes !== 'object' || Array.isArray(changes))) {
    throw new TypeError('ActivityLog.logActivity: changes is an object or null');
  }
  return {
    userId: user && !PLACEHOLDER_USERS.has(user.toLowerCase()) ? user : null,
    action: action.toLowerCase(),
    resourceType: resourceType.toLowerCase(),
    resourceId: text(entry.resourceId) || null,
    changes: changes && Object.keys(changes).length ? changes : null,
  };
}

module.exports = (sequelize) => {
  const ActivityLog = sequelize.define(
    'ActivityLog',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      // The signed-in user's id (Cognito sub); NULL when nobody was signed in.
      userId: { type: DataTypes.STRING(255), allowNull: true, field: 'user_id' },
      // What was done: create, edit, delete, download, retry, cancel …
      action: { type: DataTypes.STRING(100), allowNull: true },
      // What it was done to: episode, metadata, processing, file, job …
      resourceType: { type: DataTypes.STRING(100), allowNull: true, field: 'resource_type' },
      // Its id, as text: a UUID, a number, or NULL for a batch.
      resourceId: { type: DataTypes.STRING(255), allowNull: true, field: 'resource_id' },
      // { before?, after?, meta? }: what changed, and anything else worth keeping.
      changes: { type: DataTypes.JSONB, allowNull: true },
      // Set by the database (DEFAULT now()); never sent by the application.
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
    },
    {
      sequelize,
      modelName: 'ActivityLog',
      tableName: 'activity_logs',
      timestamps: false,
      underscored: true,
      indexes: [{ name: 'activity_logs_resource', fields: ['resource_type', 'resource_id'] }],
    }
  );

  /**
   * Write one audit entry. Throws when it cannot be written (a bad entry, or
   * the database refusing it). Pass { transaction } to make the entry part of
   * the caller's transaction.
   */
  ActivityLog.logActivity = async function logActivity(entry, { transaction = null } = {}) {
    const row = normalize(entry);
    return ActivityLog.create(row, {
      fields: ['userId', 'action', 'resourceType', 'resourceId', 'changes'],
      ...(transaction ? { transaction } : {}),
    });
  };

  /** One user's entries, newest first. */
  ActivityLog.getUserHistory = async function getUserHistory(userId, limit = 50) {
    return ActivityLog.findAll({ where: { userId }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit });
  };

  /** Everything recorded about one resource, newest first. */
  ActivityLog.getResourceHistory = async function getResourceHistory(resourceType, resourceId) {
    return ActivityLog.findAll({
      where: { resourceType: String(resourceType).toLowerCase(), resourceId: String(resourceId) },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
  };

  /** Entries between two dates, optionally for one user, action or resource type. */
  ActivityLog.getAuditTrail = async function getAuditTrail(startDate, endDate, filters = {}) {
    const where = { createdAt: { [Op.between]: [startDate, endDate] } };
    if (filters.userId) where.userId = filters.userId;
    if (filters.action || filters.actionType) where.action = String(filters.action || filters.actionType).toLowerCase();
    if (filters.resourceType) where.resourceType = String(filters.resourceType).toLowerCase();
    return ActivityLog.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
  };

  /** Entry counts by action over the last `days` days. */
  ActivityLog.getStats = async function getStats(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return ActivityLog.sequelize.query(
      'SELECT action, COUNT(*)::int AS count FROM activity_logs WHERE created_at >= :since GROUP BY action',
      { replacements: { since }, type: sequelize.QueryTypes.SELECT });
  };

  ActivityLog.normalizeEntry = normalize;
  return ActivityLog;
};
