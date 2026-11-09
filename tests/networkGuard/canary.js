'use strict';

/**
 * Jest network guard: the canary helper (Stage 3a, decision A / D8).
 *
 * expectNetworkBlocked(id, fn) runs fn inside a canary scope. Inside it, the
 * guard blocks every attempt and finding in every mode (core.record), so a
 * canary never reaches anything; outside it, nothing changes. The helper:
 *   - works only in the canary file named in canary-manifest.json, and only
 *     for an id listed there;
 *   - requires fn to fail with ERR_TEST_NETWORK_BLOCKED (searched through
 *     .cause and AggregateError.errors), and returns that outcome so the
 *     canary file can write it to its independent witness record.
 * The reporter compares the guard's canary events with the manifest (ids,
 * destinations, exact counts) and with the witness record; any difference
 * fails verification.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const core = require('./core');

const MANIFEST = path.join(__dirname, 'canary-manifest.json');
// Destinations a canary may name: none of them can leave this machine, even
// if the guard failed (0.0.0.0 and :: connect locally; the .invalid name is
// only ever sent to a local witness proxy or resolver; 127.0.0.1 and the
// Unix socket are the canary file's own unregistered witnesses).
const NEVER_LEAVE_HOSTS = new Set(['0.0.0.0', '0:0:0:0:0:0:0:0', 'canary.invalid', '127.0.0.1', '2130706433']);
const NEVER_LEAVE_KINDS = new Set(['witness-unix']);

function loadManifest(file = MANIFEST) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!m || typeof m.file !== 'string' || !Array.isArray(m.canaries) || !m.canaries.length) throw new Error('canary manifest: needs "file" and "canaries"');
  const ids = new Set();
  for (const c of m.canaries) {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9-]+$/.test(c.id) || ids.has(c.id)) throw new Error(`canary manifest: bad or duplicate id ${JSON.stringify(c && c.id)}`);
    ids.add(c.id);
    if (!Number.isInteger(c.events) || c.events < 1) throw new Error(`canary manifest: ${c.id} needs a positive "events" count`);
    if (!Array.isArray(c.transports) || !c.transports.length) throw new Error(`canary manifest: ${c.id} needs "transports"`);
    if (c.host !== undefined && !NEVER_LEAVE_HOSTS.has(c.host)) throw new Error(`canary manifest: ${c.id} names ${c.host}, which is not a never-leave destination`);
    if (c.host === undefined && !NEVER_LEAVE_KINDS.has(c.kind)) throw new Error(`canary manifest: ${c.id} needs a never-leave host or kind`);
    if (c.sdk !== undefined && (typeof c.sdk.module !== 'string' || typeof c.sdk.version !== 'string')) throw new Error(`canary manifest: ${c.id} has a bad "sdk"`);
  }
  return m;
}

/** The error code anywhere in an error's cause chain. */
function blockedCode(err, depth = 0) {
  if (!err || depth > 6) return null;
  if (err.code === core.BLOCKED_CODE) return err.code;
  if (Array.isArray(err.errors)) for (const e of err.errors) { const c = blockedCode(e, depth + 1); if (c) return c; }
  return blockedCode(err.cause, depth + 1);
}

async function expectNetworkBlocked(id, fn) {
  const state = core.getState();
  const manifest = loadManifest();
  if (state.context.testPath !== manifest.file) throw new Error(`canary helper: only ${manifest.file} may use it`);
  if (!manifest.canaries.some((c) => c.id === id)) throw new Error(`canary helper: ${id} is not in the manifest`);
  if (!net.Socket.prototype.connect[Symbol.for('jestNetworkGuard.hook')]) throw new Error('canary helper: the network guard is not installed');
  let outcome = null;
  try {
    await state.als.run({ canary: id }, fn);
  } catch (err) {
    outcome = err;
  }
  const code = blockedCode(outcome);
  if (code !== core.BLOCKED_CODE) {
    throw new Error(`canary ${id}: expected ${core.BLOCKED_CODE}, got ${outcome ? (outcome.code || outcome.message) : 'success'}`);
  }
  return { id, code };
}

module.exports = { MANIFEST, NEVER_LEAVE_HOSTS, loadManifest, blockedCode, expectNetworkBlocked };
