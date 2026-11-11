const crypto = require('crypto');
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

// What an entry may hold, whoever calls (Evoni, 2026-11-11): bounded, and
// with nothing that looks like a credential.
/** A text longer than this is recorded by its length and SHA-256, not copied into the entry. */
const LONG_TEXT = 2000;
/** A list longer than this keeps its first items and the count of the rest. */
const MAX_ITEMS = 50;
/** An object keeps at most this many keys. */
const MAX_KEYS = 60;
/** Nesting deeper than this is replaced by a marker. */
const MAX_DEPTH = 6;
/** before, after and meta are each replaced by a marker past this many characters of JSON. */
const MAX_SECTION = 20000;
/** Keys whose values are never recorded. */
const SENSITIVE_KEY = /pass(word|wd)?$|passphrase|secret|token|authori[sz]ation|api[_-]?key|access[_-]?key|private[_-]?key|credential|cookie|signature|presigned|session[_-]?id/i;
const REMOVED = '[removed]';

/** A long text as an entry keeps it: its length and digest, never its words. */
const digestOf = (text) => ({ long_text: true, length: text.length, sha256: crypto.createHash('sha256').update(text).digest('hex') });

/** A value cut to what an entry may hold: long texts digested, lists and objects bounded, credential-like keys removed. */
function limited(value, depth = 0) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.length > LONG_TEXT ? digestOf(value) : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[nested]';
  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_ITEMS).map((item) => limited(item, depth + 1));
    return value.length > MAX_ITEMS ? [...kept, { more_items: value.length - MAX_ITEMS }] : kept;
  }
  const plain = typeof value.toJSON === 'function' ? value.toJSON() : value;
  const entries = Object.entries(plain);
  const out = {};
  for (const [key, inner] of entries.slice(0, MAX_KEYS)) {
    out[key] = SENSITIVE_KEY.test(key) && inner !== null && inner !== undefined ? REMOVED : limited(inner, depth + 1);
  }
  if (entries.length > MAX_KEYS) out.more_keys = entries.length - MAX_KEYS;
  return out;
}

/** One of before / after / meta, bounded as a whole. */
function section(value) {
  const kept = limited(value);
  const size = JSON.stringify(kept).length;
  if (size <= MAX_SECTION) return kept;
  return { too_large: true, characters: size, keys: kept && typeof kept === 'object' && !Array.isArray(kept) ? Object.keys(kept).slice(0, MAX_KEYS) : [] };
}

/**
 * { before?, after?, meta? } from a logAction options object; null when
 * empty. Every part passes through the limits above, so no caller can put a
 * script, an unbounded list or a credential-like field into the trail.
 */
function changesFrom(options = {}) {
  const changes = {};
  if (options.oldValues !== null && options.oldValues !== undefined) changes.before = section(options.oldValues);
  if (options.newValues !== null && options.newValues !== undefined) changes.after = section(options.newValues);
  const meta = Object.fromEntries(Object.entries(options).filter(([k, v]) => !NOT_STORED.has(k) && v !== undefined));
  if (Object.keys(meta).length) changes.meta = section(meta);
  return Object.keys(changes).length ? changes : null;
}

/**
 * What an entry says about an episode when it is created or deleted:
 * enough to identify it and its state, and never its script or the rest of
 * the row (Evoni, 2026-11-11).
 */
function episodeSummary(row = {}) {
  const e = row && typeof row.toJSON === 'function' ? row.toJSON() : row || {};
  const script = typeof e.script_content === 'string' ? e.script_content : '';
  return {
    id: e.id ?? null,
    show_id: e.show_id ?? null,
    title: e.title ?? null,
    episode_number: e.episode_number ?? null,
    season_number: e.season_number ?? null,
    status: e.status ?? null,
    air_date: e.air_date ?? null,
    categories: Array.isArray(e.categories) ? e.categories : null,
    has_script: script.trim().length > 0,
    script_length: script.length,
  };
}

/** The named keys of a row, and nothing else: an explicit allowlist for an entry. */
function only(row, keys) {
  const plain = row && typeof row.toJSON === 'function' ? row.toJSON() : row || {};
  return Object.fromEntries(keys.filter((key) => plain[key] !== undefined).map((key) => [key, plain[key]]));
}

/** Fields that change on every save and say nothing about what was edited. */
const NOT_A_CHANGE = new Set(['updated_at', 'updatedAt']);

const comparable = (value) => JSON.stringify(value === undefined ? null : value);

/** A value as an entry keeps it: itself, or for a long text its length and digest. */
function recorded(value) {
  if (typeof value === 'string' && value.length > LONG_TEXT) return digestOf(value);
  return value === undefined ? null : value;
}

/**
 * What an update changed: only the fields whose value differs between the
 * row before and the row after, each with its before and after value.
 * Unchanged fields are left out, so an edit to a title does not copy the
 * episode's script into the audit trail. A long text (a script) that did
 * change is recorded by length and SHA-256 on both sides: enough to say that
 * it changed, when, by whom and to which exact text, without storing it
 * twice (the script's own versions hold the words).
 *
 * Returns { oldValues, newValues, changedFields }, ready for logAction;
 * oldValues and newValues are null when nothing changed.
 */
function fieldChanges(before = {}, after = {}) {
  const was = before || {};
  const is = after || {};
  const changedFields = [...new Set([...Object.keys(was), ...Object.keys(is)])]
    .filter((field) => !NOT_A_CHANGE.has(field) && comparable(was[field]) !== comparable(is[field]))
    .sort();
  if (!changedFields.length) return { oldValues: null, newValues: null, changedFields };
  return {
    oldValues: Object.fromEntries(changedFields.map((field) => [field, recorded(was[field])])),
    newValues: Object.fromEntries(changedFields.map((field) => [field, recorded(is[field])])),
    changedFields,
  };
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
  fieldChanges,
  episodeSummary,
  only,
  limited,
  LONG_TEXT,
};
