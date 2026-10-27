'use strict';

/**
 * The episode script's revision token (architecture A1c R1, Evoni,
 * 2026-10-27; docs/reads/2026-10-27-a1c-r1-spec.md): an opaque hash of the
 * stored script text and its line-identity record. A client sends back the
 * revision it loaded; a write against any other revision is refused
 * (services/scriptSave.js), so an older page never overwrites a newer
 * script. The text and the identity record, not updated_at: a title or
 * teaser edit is not a script change, and the same text with other
 * identities is. It never contains a line key.
 *
 * Pure; no I/O.
 */

const crypto = require('crypto');

const PREFIX = 'sr1-';

// JSON with object keys in a fixed order, so the same record always gives
// the same revision whatever order its fields were written in.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** The revision of a script (null and '' are the same empty script). */
function scriptRevision(text, lineKeys = null) {
  const body = typeof text === 'string' ? text : '';
  const keys = lineKeys == null ? 'unkeyed' : stableStringify(lineKeys);
  return PREFIX + crypto.createHash('sha256').update(`v1\n${body}\n${keys}`).digest('hex').slice(0, 40);
}

const isRevision = (value) => typeof value === 'string' && /^sr1-[0-9a-f]{40}$/.test(value);

module.exports = { scriptRevision, isRevision };
