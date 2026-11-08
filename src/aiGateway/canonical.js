'use strict';

/**
 * Deterministic encodings used by permits and logs: canonical JSON (object
 * keys sorted at every level, no whitespace) and SHA-256 hex digests.
 */

const crypto = require('crypto');

function canonicalJson(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Constant-time comparison of two hex strings of equal length. */
function hexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = { canonicalJson, sha256Hex, hexEqual };
