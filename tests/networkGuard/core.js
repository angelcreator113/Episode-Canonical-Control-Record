'use strict';

/**
 * Jest network guard: core (Stage 1, report-only in the Jest wiring).
 *
 * Intercepts every way a test process can open an outbound connection or
 * resolve a name, and classifies the destination:
 *   - net.Socket.prototype.connect: the one point every TCP/TLS client goes
 *     through (net, tls, http, https, http2, axios, pg, ws, and Node's
 *     built-in fetch via undici). Both call shapes are handled: an options
 *     object (or port/host/path arguments) and the normalized [options, cb]
 *     array that net.createConnection passes;
 *   - http/https request and get: earlier detection and better attribution
 *     (http.get does not call the exported http.request, so both are hooked);
 *   - globalThis.fetch: attribution for fetch;
 *   - dns: lookup, lookupService, resolve* and reverse, callback and promise
 *     APIs, module functions and Resolver classes.
 *
 * Allowed without review: loopback (127.0.0.0/8, ::1, IPv4-mapped loopback,
 * the name "localhost") and Unix sockets / named pipes. 0.0.0.0 and :: are
 * NOT treated as loopback. Hosts from environment variables (database URLs
 * and the like) are not trusted automatically: a non-loopback host must be
 * listed in the reviewed allowlist (tests/networkGuard/allowlist.json),
 * which refuses paid AI providers outright.
 *
 * Modes: 'report' records and lets the call proceed (behaviour unchanged);
 * 'enforce' records and fails the call with ERR_TEST_NETWORK_BLOCKED before
 * any DNS lookup or packet. The Jest wiring uses 'report' in Stage 1;
 * 'enforce' exists for the guard's own self-tests and for Stage 3.
 *
 * The hooks are plain assignments (not jest.spyOn), so jest.restoreAllMocks()
 * cannot remove them. Their state lives on the real `net` module object,
 * which every test file in a worker shares, so a new test file reconfigures
 * the same hooks instead of wrapping them twice.
 */

const net = require('net');
const http = require('http');
const https = require('https');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

const MARK = Symbol.for('jestNetworkGuard.hook');
const STATE = Symbol.for('jestNetworkGuard.state');
const BLOCKED_CODE = 'ERR_TEST_NETWORK_BLOCKED';

// Paid AI and media providers: never allowed, even by a reviewed allowlist entry.
const FORBIDDEN_ALLOWLIST = /(^|\.)(anthropic\.com|claude\.ai|claude\.com|fal\.ai|fal\.run|fal\.media|openai\.com|replicate\.com|replicate\.delivery|elevenlabs\.io|runwayml\.com|stability\.ai|generativelanguage\.googleapis\.com|api\.together\.xyz|api\.groq\.com|api\.mistral\.ai|api\.cohere\.ai)$/;

// ── Host classification (pure) ───────────────────────────────────────────

/** Expand an IPv6 literal to eight 16-bit groups; null when it is not one. */
function expandIPv6(addr) {
  if (net.isIPv6(addr) !== true) return null;
  let s = addr;
  let tail = [];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const o = v4[1].split('.').map(Number);
    tail = [((o[0] << 8) | o[1]), ((o[2] << 8) | o[3])];
    s = s.slice(0, -v4[1].length).replace(/:$/, '');
    if (s === '') s = '::';
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  const [head, rest] = s.includes('::') ? s.split('::') : [s, null];
  const h = head ? head.split(':').filter((x) => x !== '').map((x) => parseInt(x, 16)) : [];
  const r = rest ? rest.split(':').filter((x) => x !== '').map((x) => parseInt(x, 16)) : [];
  const fill = 8 - h.length - r.length - tail.length;
  if (rest === null && fill !== 0) return null;
  if (fill < 0) return null;
  return [...h, ...Array(fill).fill(0), ...r, ...tail];
}

/**
 * Normalize a host: trim, lowercase, drop a trailing dot, square brackets and
 * an IPv6 zone id, and turn an IPv4-mapped IPv6 address into plain IPv4.
 */
function normalizeHost(host) {
  if (host === undefined || host === null) return null;
  let h = String(host).trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  h = h.replace(/%.*$/, '');
  if (h.endsWith('.') && h.length > 1) h = h.slice(0, -1);
  const groups = expandIPv6(h);
  if (groups) {
    if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
      return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    }
    return groups.map((g) => g.toString(16)).join(':');
  }
  return h;
}

/** True for loopback only: 127.0.0.0/8, ::1 and the name "localhost". Never 0.0.0.0 or ::. */
function isLoopback(host) {
  const h = normalizeHost(host);
  if (!h) return false;
  if (h === 'localhost') return true;
  if (net.isIPv4(h)) return h.split('.')[0] === '127';
  return h === '0:0:0:0:0:0:0:1';
}

/** The destination of a Socket#connect call, from either call shape. */
function connectTarget(args) {
  let a = args;
  if (Array.isArray(a[0])) a = a[0]; // net.createConnection's normalized [options, cb]
  const first = a[0];
  if (first && typeof first === 'object') {
    if (first.path) return { path: String(first.path) };
    return { host: first.host || first.hostname || 'localhost', port: first.port };
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) return { path: first };
  return { host: typeof a[1] === 'string' ? a[1] : 'localhost', port: first };
}

/** The destination of an http(s).request/get call. */
function requestTarget(args, defaultPort) {
  let url = null;
  let opts = null;
  for (const a of args) {
    if (typeof a === 'string') { try { url = new URL(a); } catch (err) { url = null; } } else if (a instanceof URL) url = a;
    else if (a && typeof a === 'object' && !opts) opts = a;
  }
  if (opts && opts.socketPath) return { path: String(opts.socketPath) };
  const rawHost = (opts && (opts.hostname || opts.host)) || (url && url.hostname) || 'localhost';
  const host = String(rawHost).replace(/:\d+$/, '').replace(/^\[(.*)\]$/, '$1');
  return { host, port: (opts && opts.port) || (url && url.port) || defaultPort };
}

/** A fetch() destination. */
function fetchTarget(input) {
  try {
    const u = new URL(typeof input === 'string' ? input : (input && (input.url || input.href)) || String(input));
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'file:') return { local: true };
    return { host: u.hostname.replace(/^\[(.*)\]$/, '$1'), port: u.port };
  } catch (err) {
    return { host: null };
  }
}

/** Load and validate the reviewed allowlist. Throws on a malformed file or a paid provider. */
function loadAllowlist(file = path.join(__dirname, 'allowlist.json')) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || !Array.isArray(data.hosts)) throw new Error('networkGuard allowlist: "hosts" must be an array');
  const hosts = new Set();
  for (const entry of data.hosts) {
    if (!entry || typeof entry !== 'object' || typeof entry.host !== 'string' || typeof entry.reason !== 'string' || !Array.isArray(entry.files)) {
      throw new Error('networkGuard allowlist: each entry needs { host, reason, files }');
    }
    const h = normalizeHost(entry.host);
    if (!h || h === '0.0.0.0' || h === '0:0:0:0:0:0:0:0' || h.includes('*')) throw new Error(`networkGuard allowlist: "${entry.host}" is not an exact host`);
    if (FORBIDDEN_ALLOWLIST.test(h)) throw new Error(`networkGuard allowlist: "${entry.host}" is a paid provider and can never be allowed`);
    hosts.add(h);
  }
  return hosts;
}

/** allowed | blocked, for a target. */
function classify(target, allowHosts = new Set()) {
  if (!target) return { allowed: false, host: null };
  if (target.local) return { allowed: true, host: null };
  if (target.path) return { allowed: true, host: null, path: target.path };
  const host = normalizeHost(target.host);
  if (isLoopback(host)) return { allowed: true, host };
  if (host && allowHosts.has(host)) return { allowed: true, host, allowlisted: true };
  return { allowed: false, host, port: target.port };
}

// ── Hooks ────────────────────────────────────────────────────────────────

function blockedError(host) {
  return Object.assign(new Error(`Network access blocked by the Jest network guard: ${host}`), { code: BLOCKED_CODE, host });
}

function appFrames(stack) {
  return String(stack || '').split('\n').slice(1)
    .filter((l) => /[\\/](src|tests)[\\/]/.test(l) && !/node_modules|[\\/]tests[\\/]networkGuard[\\/]/.test(l))
    .slice(0, 3)
    .map((l) => l.trim().replace(/^at\s+/, '').replace(/.*?[\\/]((?:src|tests)[\\/])/, '$1'));
}

/**
 * The stack at the attempt, mapped to source lines. The core-module hooks are
 * installed once per worker, by the first test file, so a plain `new Error()`
 * here belongs to that first file's (by then torn-down) environment: its
 * source maps don't cover later files, which showed transformed line numbers
 * (a Stage 1 finding). setup.js re-registers state.captureStack in every
 * test file, so the stack is built by the current file's Error, which Jest
 * maps with the current file's source maps.
 */
function captureStack(state) {
  if (typeof state.captureStack === 'function') {
    try { return state.captureStack(); } catch (err) { /* fall back to this realm's stack below */ }
  }
  return new Error().stack;
}

function getState() {
  if (!net[STATE]) {
    Object.defineProperty(net, STATE, {
      value: { mode: 'report', allowHosts: new Set(), context: { testPath: null, testName: null }, sink: null, events: [], fileCounts: {}, originals: null },
      enumerable: false,
      configurable: true,
    });
  }
  return net[STATE];
}

/** Record one attempt; returns true when the call must be blocked. */
function record(transport, target, extra = {}) {
  const state = getState();
  const c = classify(target, state.allowHosts);
  if (c.allowed) return false;
  const block = state.mode === 'enforce';
  const event = {
    type: 'attempt', transport, host: c.host, port: target && target.port ? Number(target.port) : null,
    action: block ? 'blocked' : 'reported', mode: state.mode,
    testPath: state.context.testPath, testName: state.context.testName,
    frames: appFrames(captureStack(state)), pid: process.pid, at: Date.now(), ...extra,
  };
  state.events.push(event);
  const key = state.context.testPath || '(no test file)';
  state.fileCounts[key] = (state.fileCounts[key] || 0) + 1;
  if (state.sink) state.sink(event);
  return block;
}

/** Copy own properties (incl. symbols such as util.promisify.custom) so wrappers behave like the original. */
function wrap(original, wrapper) {
  for (const key of Reflect.ownKeys(original)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    const d = Object.getOwnPropertyDescriptor(original, key);
    if (d) Object.defineProperty(wrapper, key, d);
  }
  Object.defineProperty(wrapper, MARK, { value: original, enumerable: false });
  return wrapper;
}

const DNS_FUNCTIONS = ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse'];

function dnsTarget(fn, args) {
  const first = args[0];
  if (fn === 'lookup' && typeof first === 'string' && net.isIP(normalizeHost(first) || '')) return { local: true }; // an IP literal: no query
  return { host: typeof first === 'string' ? first : null };
}

function hookDnsFunction(obj, fn, isPromise) {
  const original = obj[fn];
  if (typeof original !== 'function' || original[MARK]) return;
  obj[fn] = wrap(original, function guardedDns(...args) {
    const target = dnsTarget(fn, args);
    if (record(`dns.${isPromise ? 'promises.' : ''}${fn}`, target)) {
      const err = blockedError(normalizeHost(target.host));
      if (isPromise) return Promise.reject(err);
      const cb = [...args].reverse().find((a) => typeof a === 'function');
      if (cb) process.nextTick(() => cb(err));
      return undefined;
    }
    return original.apply(this, args);
  });
}

function hookRequest(mod, fn, transport, defaultPort) {
  const original = mod[fn];
  if (typeof original !== 'function' || original[MARK]) return;
  mod[fn] = wrap(original, function guardedRequest(...args) {
    record(transport, requestTarget(args, defaultPort), { via: `${transport}.${fn}` }); // blocking happens at the socket
    return original.apply(this, args);
  });
}

/** The hooks this module owns, with whether each is in place. */
function hookStatus(globalObj = globalThis) {
  const status = {
    'net.Socket.prototype.connect': Boolean(net.Socket.prototype.connect[MARK]),
    'http.request': Boolean(http.request[MARK]), 'http.get': Boolean(http.get[MARK]),
    'https.request': Boolean(https.request[MARK]), 'https.get': Boolean(https.get[MARK]),
    'dns.lookup': Boolean(dns.lookup[MARK]), 'dns.promises.lookup': Boolean(dns.promises.lookup[MARK]),
    'dns.Resolver.prototype.resolve4': Boolean(dns.Resolver.prototype.resolve4[MARK]),
    'dns.promises.Resolver.prototype.resolve4': Boolean(dns.promises.Resolver.prototype.resolve4[MARK]),
  };
  if (typeof globalObj.fetch === 'function') status.fetch = Boolean(globalObj.fetch[MARK]);
  return status;
}

/**
 * Install (or re-check) every hook in this process. Idempotent: a hook that
 * is already in place is left alone; one that was removed is put back and
 * reported in the returned `reinstalled` list.
 */
function install({ mode = 'report', allowHosts, sink, globalObj = globalThis } = {}) {
  const state = getState();
  if (mode !== 'report' && mode !== 'enforce') throw new Error(`networkGuard: unknown mode "${mode}"`);
  state.mode = mode;
  if (allowHosts) state.allowHosts = allowHosts;
  if (sink !== undefined) state.sink = sink;
  const before = hookStatus(globalObj);

  const proto = net.Socket.prototype;
  if (!proto.connect[MARK]) {
    const original = proto.connect;
    proto.connect = wrap(original, function guardedConnect(...args) {
      const target = connectTarget(args);
      if (record('socket', target)) {
        const err = blockedError(normalizeHost(target.host));
        process.nextTick(() => this.destroy(err));
        return this;
      }
      return original.apply(this, args);
    });
  }
  hookRequest(http, 'request', 'http', 80);
  hookRequest(http, 'get', 'http', 80);
  hookRequest(https, 'request', 'https', 443);
  hookRequest(https, 'get', 'https', 443);
  for (const fn of DNS_FUNCTIONS) {
    hookDnsFunction(dns, fn, false);
    hookDnsFunction(dns.promises, fn, true);
    hookDnsFunction(dns.Resolver.prototype, fn, false);
    hookDnsFunction(dns.promises.Resolver.prototype, fn, true);
  }
  if (typeof globalObj.fetch === 'function' && !globalObj.fetch[MARK]) {
    const original = globalObj.fetch;
    globalObj.fetch = wrap(original, function guardedFetch(input, init) {
      const target = fetchTarget(input);
      if (record('fetch', target) && !target.local) return Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: blockedError(normalizeHost(target.host)) }));
      return original.call(this, input, init);
    });
  }
  // fetch lives on each test file's own global object, so it is fresh (unwrapped) in every new
  // file by design; a process-wide hook found missing after the first install was removed.
  const reinstalled = Object.keys(before).filter((k) => k !== 'fetch' && before[k] === false && state.installedOnce);
  state.installedOnce = true;
  return { reinstalled, status: hookStatus(globalObj) };
}

module.exports = {
  BLOCKED_CODE, FORBIDDEN_ALLOWLIST,
  normalizeHost, isLoopback, connectTarget, requestTarget, fetchTarget, classify, loadAllowlist,
  install, hookStatus, getState, record,
};
