'use strict';

/**
 * Jest network guard: core (report-only in the Jest wiring; Stage 3a adds the
 * endpoint policy, still report-only).
 *
 * Intercepts every way a test process can open an outbound connection or
 * resolve a name, and classifies the destination:
 *   - net.Socket.prototype.connect: the one point every TCP/TLS client goes
 *     through (net, tls, http, https, http2, axios, pg, ws, and Node's
 *     built-in fetch via undici). Both call shapes are handled: an options
 *     object (or port/host/path arguments) and the normalized [options, cb]
 *     array that net.createConnection passes;
 *   - http/https request and get: the destination a request names, before
 *     any agent or proxy runs (a proxied request's absolute-form path names
 *     the real destination);
 *   - globalThis.fetch;
 *   - dns: lookup, lookupService, resolve* and reverse, callback and promise
 *     APIs, module functions and Resolver classes;
 *   - dgram (UDP): Socket#send and Socket#connect;
 *   - net.Server#listen: tracked, never trusted by itself (see registry.js).
 *
 * Policy (Stage 3a):
 *   - a non-loopback destination is an "attempt" (the reviewed allowlist is
 *     empty; paid providers can never be listed);
 *   - a loopback TCP/UDP destination is allowed only when its port is in the
 *     endpoint registry (tests/networkGuard/endpoints.json, registry.js);
 *     otherwise it is a "loopback-unregistered" finding;
 *   - a Unix socket is allowed only at an exact registered path; otherwise it
 *     is a "unix-unregistered" finding;
 *   - a name that resolves to a non-loopback address where a loopback one was
 *     expected is a "post-lookup-nonloopback" finding (and, for localhost, a
 *     "localhost-resolution-mismatch").
 * Loopback means 127.0.0.0/8, ::1 and the exact name "localhost". 0.0.0.0, ::
 * and numeric shortcuts such as 127.1 or 2130706433 are not loopback.
 *
 * Modes: 'report' records and lets the call proceed (behaviour unchanged);
 * 'enforce' blocks attempts with ERR_TEST_NETWORK_BLOCKED before any DNS
 * lookup or packet. The Jest wiring uses 'report'. Findings are never
 * blocked in Stage 3a. Inside a canary scope (canary.js), every attempt and
 * finding is blocked in every mode: canaries prove the guard, they never
 * reach anything.
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
const dgram = require('dgram');
const { AsyncLocalStorage } = require('async_hooks');
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

/**
 * A name the system resolver would read as an IPv4 address although Node does
 * not treat it as one (127.1, 0x7f.1, 2130706433, 0177.0.0.1). Such names are
 * never loopback here: they go to DNS, where the guard records them.
 */
function isNoncanonicalIpName(host) {
  const h = normalizeHost(host);
  if (!h || net.isIP(h)) return false;
  return /^(0x[0-9a-f]+|[0-9]+)(\.(0x[0-9a-f]+|[0-9]+)){0,3}$/i.test(h);
}

/** A resolved address (never a name) that is loopback. */
function isLoopbackAddress(address) {
  const h = normalizeHost(address);
  return Boolean(h && net.isIP(h) && isLoopback(h));
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
  const port = (opts && opts.port) || (url && url.port) || defaultPort;
  // A request sent to a proxy names its real destination in an absolute-form
  // path (http://host/...): classify that destination, not the proxy.
  if (opts && typeof opts.path === 'string' && /^https?:\/\//i.test(opts.path)) {
    try {
      const real = new URL(opts.path);
      return { host: real.hostname.replace(/^\[(.*)\]$/, '$1'), port: real.port || (real.protocol === 'https:' ? 443 : 80), via: `${host}:${port}` };
    } catch (err) {
      return { host: null, via: `${host}:${port}` };
    }
  }
  return { host, port };
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

/**
 * The function that called `skip`, as structured call-site data (file and
 * function name), independent of any stack formatter. Used to recognise the
 * installed supertest's serverAddress() as the caller of Server#listen.
 */
function immediateCaller(skip) {
  const savedPrepare = Error.prepareStackTrace;
  const savedLimit = Error.stackTraceLimit;
  try {
    Error.prepareStackTrace = (_e, callSites) => callSites;
    Error.stackTraceLimit = 4;
    const holder = {};
    Error.captureStackTrace(holder, skip);
    const site = Array.isArray(holder.stack) ? holder.stack[0] : null;
    return site ? { file: site.getFileName(), fn: site.getFunctionName(), method: site.getMethodName() } : null;
  } catch (err) {
    return null; // no caller information: nothing is registered (fail closed)
  } finally {
    Error.prepareStackTrace = savedPrepare;
    Error.stackTraceLimit = savedLimit;
  }
}

function emptyRegistry() {
  return { tcpPorts: new Map(), servers: new Map(), paths: new Map(), supertest: { enabled: false, file: null }, diagnostics: {} };
}

function getState() {
  if (!net[STATE]) {
    Object.defineProperty(net, STATE, {
      value: {
        mode: 'report', allowHosts: new Set(), context: { testPath: null, testName: null }, sink: null, events: [], fileCounts: {}, originals: null,
        registry: emptyRegistry(),
        listeners: { ports: new Map(), paths: new Map() },
        // Canary scope: one AsyncLocalStorage per process, shared by every test file's copy of this module.
        als: new AsyncLocalStorage(),
      },
      enumerable: false,
      configurable: true,
    });
  }
  const state = net[STATE];
  if (!state.registry) state.registry = emptyRegistry();
  if (!state.listeners) state.listeners = { ports: new Map(), paths: new Map() };
  if (!state.als) state.als = new AsyncLocalStorage();
  return state;
}

/** Is this loopback port in the endpoint registry (an env-declared service, or a registered live server)? */
function portRegistered(state, port, transport) {
  if (transport !== 'socket') return false; // UDP: nothing is registered
  const p = Number(port);
  if (!Number.isInteger(p) || p <= 0) return false;
  if (state.registry.tcpPorts.has(p)) return true;
  const entry = state.registry.servers.get(p);
  if (!entry) return false;
  const live = entry.server && entry.server.listening && typeof entry.server.address === 'function';
  const addr = live ? entry.server.address() : null;
  return Boolean(addr && typeof addr === 'object' && addr.port === p);
}

/** Exact Unix-socket allowlisting: ok, or the reason it is not allowed. */
function unixDecision(state, socketPath) {
  const p = String(socketPath);
  if (p.startsWith('\0')) return { ok: false, reason: 'abstract socket' };
  if (/^\\\\[.?]\\pipe\\/i.test(p)) return { ok: false, reason: 'named pipe' };
  if (!path.isAbsolute(p) || path.resolve(p) !== p) return { ok: false, reason: 'not an absolute, normalized path' };
  if (!state.registry.paths.has(p)) return { ok: false, reason: 'not registered' };
  try {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isSocket()) return { ok: false, reason: 'not a socket (or a symlink)' };
  } catch (err) {
    return { ok: false, reason: 'missing' };
  }
  return { ok: true };
}

/**
 * Decide what a call is: null (allowed), an external attempt, or a finding.
 * Loopback ports are checked at the socket and UDP layers only, so a request
 * to a local server is decided once, where its connection is made.
 */
function decide(state, transport, target) {
  if (!target) return { type: 'attempt', host: null };
  if (target.local) return null;
  if (target.path) {
    const u = unixDecision(state, target.path);
    return u.ok ? null : { type: 'finding', kind: 'unix-unregistered', path: target.path, reason: u.reason };
  }
  const c = classify(target, state.allowHosts);
  if (!c.allowed) {
    const out = { type: 'attempt', host: c.host, port: target.port ? Number(target.port) : null };
    if (isNoncanonicalIpName(target.host)) out.noncanonicalIp = true;
    if (target.via) out.via = target.via;
    return out;
  }
  if (c.allowlisted) return null;
  if (transport === 'socket' || transport === 'udp') {
    if (!portRegistered(state, target.port, transport)) {
      return { type: 'finding', kind: 'loopback-unregistered', host: c.host, port: target.port ? Number(target.port) : null };
    }
  }
  return null;
}

function emit(state, event) {
  state.events.push(event);
  const key = state.context.testPath || '(no test file)';
  state.fileCounts[key] = (state.fileCounts[key] || 0) + 1;
  if (state.sink) state.sink(event);
}

/** Record a call; returns true when it must be blocked. */
function record(transport, target, extra = {}) {
  const state = getState();
  const d = decide(state, transport, target);
  if (!d) return false;
  const scope = state.als.getStore();
  const canary = scope && scope.canary ? scope.canary : null;
  // Canary calls are always blocked. Otherwise only attempts, and only in enforce mode.
  const block = Boolean(canary) || (d.type === 'attempt' && state.mode === 'enforce');
  const event = {
    ...d, transport, action: block ? 'blocked' : 'reported', mode: state.mode,
    testPath: state.context.testPath, testName: state.context.testName,
    frames: appFrames(captureStack(state)), pid: process.pid, at: Date.now(), ...extra,
  };
  if (canary) event.canary = canary;
  emit(state, event);
  return block;
}

/** A finding about where a name resolved (report-only). */
function recordLookupFinding(state, kind, host, address, port) {
  emit(state, {
    type: 'finding', kind, transport: 'socket', host: normalizeHost(host), address, port: port ? Number(port) : null,
    action: 'reported', mode: state.mode, testPath: state.context.testPath, testName: state.context.testName,
    frames: appFrames(captureStack(state)), pid: process.pid, at: Date.now(),
  });
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

/**
 * A request that fails with `err` before any connection is made: the request
 * gets a socket that is destroyed at once, so no agent, proxy, DNS lookup or
 * packet is involved.
 */
function blockedRequest(original, thisArg, args, err) {
  let url = null;
  let opts = {};
  let cb;
  for (const a of args) {
    if (typeof a === 'function') cb = a;
    else if (typeof a === 'string' || a instanceof URL) url = a;
    else if (a && typeof a === 'object') opts = a;
  }
  const failing = () => {
    const sock = new net.Socket();
    process.nextTick(() => sock.destroy(err));
    return sock;
  };
  // agent: undefined with a createConnection function means no agent at all (agent: false would create a fresh one).
  const o = { ...opts, agent: undefined, createConnection: failing };
  return url ? original.call(thisArg, url, o, cb) : original.call(thisArg, o, cb);
}

function hookRequest(mod, fn, transport, defaultPort) {
  const original = mod[fn];
  if (typeof original !== 'function' || original[MARK]) return;
  mod[fn] = wrap(original, function guardedRequest(...args) {
    const target = requestTarget(args, defaultPort);
    if (record(transport, target, { via: target.via ? target.via : `${transport}.${fn}` })) {
      return blockedRequest(original, this, args, blockedError(normalizeHost(target.host)));
    }
    return original.apply(this, args);
  });
}

/** The destination of a dgram send (null when the socket is connected and no address is given). */
function udpSendTarget(sock, args) {
  const rest = args.slice(1).filter((a) => typeof a !== 'function');
  let port;
  let address;
  if (rest.length >= 3 && typeof rest[0] === 'number' && typeof rest[1] === 'number') {
    [, , port, address] = rest; // offset, length, port[, address]
  } else {
    [port, address] = rest;
  }
  if (port === undefined || port === null) return null; // a connected socket: decided at connect
  const fallback = sock && sock.type === 'udp6' ? '::1' : '127.0.0.1';
  return { host: typeof address === 'string' && address ? address : fallback, port };
}

/** Track a listening server (never trusted by itself; see registry.js), and recognise supertest's own server. */
function trackListener(state, server, caller) {
  const addr = server.address();
  if (!addr) return;
  if (typeof addr === 'string') {
    state.listeners.paths.set(addr, server);
  } else if (addr && typeof addr === 'object') {
    state.listeners.ports.set(addr.port, { server, address: addr.address });
    const st = state.registry.supertest;
    if (st && st.enabled && caller && caller.file === st.file && (caller.fn === 'serverAddress' || caller.method === 'serverAddress')) {
      state.registry.servers.set(addr.port, { id: 'supertest', server });
    }
  }
  server.once('close', () => {
    if (typeof addr === 'string') {
      if (state.listeners.paths.get(addr) === server) state.listeners.paths.delete(addr);
      if (state.registry.paths.has(addr)) state.registry.paths.delete(addr);
    } else if (addr && typeof addr === 'object') {
      const l = state.listeners.ports.get(addr.port);
      if (l && l.server === server) state.listeners.ports.delete(addr.port);
      const r = state.registry.servers.get(addr.port);
      if (r && r.server === server) state.registry.servers.delete(addr.port);
    }
  });
}

const HOOK_KEYS = [
  'net.Socket.prototype.connect', 'net.Server.prototype.listen', 'http.request', 'http.get', 'https.request', 'https.get',
  'dns.lookup', 'dns.promises.lookup', 'dns.Resolver.prototype.resolve4', 'dns.promises.Resolver.prototype.resolve4',
  'dgram.Socket.prototype.send', 'dgram.Socket.prototype.connect',
];

/** The hooks this module owns, with whether each is in place. */
function hookStatus(globalObj = globalThis) {
  const status = {
    'net.Socket.prototype.connect': Boolean(net.Socket.prototype.connect[MARK]),
    'net.Server.prototype.listen': Boolean(net.Server.prototype.listen[MARK]),
    'http.request': Boolean(http.request[MARK]), 'http.get': Boolean(http.get[MARK]),
    'https.request': Boolean(https.request[MARK]), 'https.get': Boolean(https.get[MARK]),
    'dns.lookup': Boolean(dns.lookup[MARK]), 'dns.promises.lookup': Boolean(dns.promises.lookup[MARK]),
    'dns.Resolver.prototype.resolve4': Boolean(dns.Resolver.prototype.resolve4[MARK]),
    'dns.promises.Resolver.prototype.resolve4': Boolean(dns.promises.Resolver.prototype.resolve4[MARK]),
    'dgram.Socket.prototype.send': Boolean(dgram.Socket.prototype.send[MARK]),
    'dgram.Socket.prototype.connect': Boolean(dgram.Socket.prototype.connect[MARK]),
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
        const err = blockedError(target.path ? target.path : normalizeHost(target.host));
        process.nextTick(() => this.destroy(err));
        return this;
      }
      // A name expected to be loopback (localhost) must also resolve to loopback.
      if (target.host && !target.path && !net.isIP(normalizeHost(target.host) || '') && isLoopback(target.host)) {
        const st = getState();
        this.once('lookup', (lookupErr, address) => {
          if (lookupErr || !address || isLoopbackAddress(address)) return;
          recordLookupFinding(st, 'post-lookup-nonloopback', target.host, address, target.port);
          if (normalizeHost(target.host) === 'localhost') recordLookupFinding(st, 'localhost-resolution-mismatch', target.host, address, target.port);
        });
      }
      return original.apply(this, args);
    });
  }
  const sproto = net.Server.prototype;
  if (!sproto.listen[MARK]) {
    const original = sproto.listen;
    sproto.listen = wrap(original, function guardedListen(...args) {
      const caller = immediateCaller(guardedListen);
      const st = getState();
      const result = original.apply(this, args);
      // A numeric bind is in place when listen() returns, before 'listening' is
      // emitted (a request may connect in between); a name-based bind is tracked
      // on 'listening'.
      let addr = null;
      try { addr = this.address(); } catch (err) { addr = null; }
      if (addr) trackListener(st, this, caller);
      else this.once('listening', () => trackListener(st, this, caller));
      return result;
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
  const uproto = dgram.Socket.prototype;
  if (!uproto.send[MARK]) {
    const original = uproto.send;
    uproto.send = wrap(original, function guardedSend(...args) {
      const target = udpSendTarget(this, args);
      if (target && record('udp', target)) {
        const err = blockedError(normalizeHost(target.host));
        const cb = [...args].reverse().find((a) => typeof a === 'function');
        process.nextTick(() => (cb ? cb(err) : this.emit('error', err)));
        return undefined;
      }
      return original.apply(this, args);
    });
  }
  if (!uproto.connect[MARK]) {
    const original = uproto.connect;
    uproto.connect = wrap(original, function guardedUdpConnect(port, address, cb) {
      const callback = typeof address === 'function' ? address : cb;
      const host = typeof address === 'string' && address ? address : (this.type === 'udp6' ? '::1' : '127.0.0.1');
      if (record('udp', { host, port })) {
        const err = blockedError(normalizeHost(host));
        process.nextTick(() => (callback ? callback(err) : this.emit('error', err)));
        return undefined;
      }
      return original.apply(this, [port, address, cb].filter((a) => a !== undefined));
    });
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
  BLOCKED_CODE, FORBIDDEN_ALLOWLIST, HOOK_KEYS,
  normalizeHost, isLoopback, isLoopbackAddress, isNoncanonicalIpName, connectTarget, requestTarget, fetchTarget, udpSendTarget,
  classify, decide, unixDecision, loadAllowlist,
  install, hookStatus, getState, record,
};
