'use strict';

/**
 * Shared test harness for the G1 gateway decision core: a controllable
 * clock, a seeded PRNG, request builders, an in-memory spool store and a
 * composed safety-state reader. Not a test file (not matched by testMatch).
 */

const crypto = require('crypto');
const { effectiveState } = require('../../../src/aiGateway/stopState');
const { resolveOperation } = require('../../../src/aiGateway/operationCatalog');
const { sha256Hex } = require('../../../src/aiGateway/canonical');

const T0 = 1_762_500_000_000;
const DAY = '2026-11-07';

function makeClock(start = T0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; }, set: (v) => { t = v; } };
}

// mulberry32: small deterministic PRNG for reproducible interleavings.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function microYield(n) {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
}

function deterministicBytes(seed = 1) {
  let counter = seed;
  return (n) => {
    counter += 1;
    return crypto.createHash('sha256').update(`seed-${counter}`).digest().subarray(0, n);
  };
}

async function* sourceOf(buf, chunk = 64 * 1024) {
  for (let i = 0; i < buf.length; i += chunk) yield buf.subarray(i, Math.min(buf.length, i + chunk));
}

function anthropicJson(extra = {}) {
  return {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: 'hello' }],
    ...extra,
  };
}

/** Everything needed to authorize and then send one Anthropic request. */
function anthropicCall({ json = anthropicJson(), headers = { 'anthropic-version': '2023-06-01' }, logicalKey = 'lk-1', attempt = 1, estimateMicros = 1000, strict = false, priceCatalogId } = {}) {
  const raw = Buffer.from(JSON.stringify(json));
  const resolved = resolveOperation({ host: 'api.anthropic.com', method: 'POST', path: '/v1/messages' });
  const authorizeInput = {
    callerClass: 'api',
    callerInstance: 'host-a:101:boot1',
    provider: 'anthropic',
    operation: 'anthropic.messages',
    model: json.model,
    job: { type: 'test', id: logicalKey, logicalKey, attempt },
    reservation: { estimateMicros, day: DAY, strict, priceCatalogId },
    body: { sha256: sha256Hex(raw), bytes: raw.length },
    billingFields: resolved.operation.billingFields(json, resolved.params),
    billingHeaders: { ...headers },
  };
  const request = (permit, secret, overrides = {}) => ({
    permitId: permit.id,
    secret,
    callerClass: 'api',
    host: 'api.anthropic.com',
    method: 'POST',
    path: '/v1/messages',
    headers: { 'content-type': 'application/json', 'x-api-key': 'app-dummy', ...headers },
    contentLength: raw.length,
    body: sourceOf(raw),
    ...overrides,
  });
  return { raw, json, authorizeInput, request };
}

function createMemSpoolStore() {
  const files = new Map();
  let n = 0;
  return {
    files,
    create() { const h = { id: `s${(n += 1)}` }; files.set(h.id, []); return h; },
    append(h, chunk) { if (!files.has(h.id)) throw new Error('spool removed'); files.get(h.id).push(Buffer.from(chunk)); },
    finish() {},
    openRead(h) { return Buffer.concat(files.get(h.id)); },
    remove(h) { files.delete(h.id); },
    removeAll() { files.clear(); },
    list() { return [...files.keys()]; },
  };
}

/**
 * Composed safety state: a database view, a local emergency view and the
 * dispatcher's applied version. Each read refreshes readAt unless frozen.
 */
function makeSafety(clock) {
  const s = {
    db: { readable: true, state: 'RELEASED', version: 1, readAt: clock.now(), pauses: {} },
    local: { readable: true, stopped: false, readAt: clock.now() },
    ackVersion: () => null,
    freezeReads: false,
  };
  s.read = () => {
    if (!s.freezeReads) {
      s.db.readAt = clock.now();
      s.local.readAt = clock.now();
    }
    const state = effectiveState({ db: s.db, local: s.local, ack: { version: s.ackVersion() }, now: clock.now() });
    return { state, version: s.db.version };
  };
  s.stopDb = () => { s.db.state = 'STOPPED'; s.db.version += 1; };
  s.releaseDb = () => { s.db.state = 'RELEASED'; s.db.version += 1; };
  return s;
}

module.exports = {
  T0, DAY, makeClock, makeRng, microYield, deterministicBytes, sourceOf, anthropicJson, anthropicCall,
  createMemSpoolStore, makeSafety,
};
