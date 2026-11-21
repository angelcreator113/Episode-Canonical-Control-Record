'use strict';

/**
 * Jest network guard: the reviewed endpoint registry (Stage 3a).
 *
 * A loopback TCP port or a Unix socket is allowed only when an active entry
 * in endpoints.json covers it. Opening a listener authorizes nothing: a
 * server is trusted only when
 *   - it is the server the installed supertest starts for request(app)
 *     (recognised in core.js by the exact caller of Server#listen and kept
 *     only while that server instance listens), or
 *   - a listed test file registers it explicitly with trustTestServer(), or
 *     a Unix socket by exact path with trustTestSocket().
 * Env-declared services (the test database) are active only when their host
 * is loopback. Redis stays disabled (Stage 3a decision C).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('./core');

const ROOT = path.resolve(__dirname, '..', '..');
const KINDS = {
  'tcp-env-url': ['env', 'defaultPort'],
  'tcp-env-hostport': ['hostEnv', 'portEnv', 'defaultHost', 'defaultPort'],
  supertest: ['module', 'version', 'file', 'function'],
  'test-server': ['files'],
  'test-socket': ['files'],
};
const COMMON = ['id', 'kind', 'reason', 'enabled'];

function fail(msg) {
  throw new Error(`networkGuard endpoints: ${msg}`);
}

function validPort(p) {
  return Number.isInteger(p) && p > 0 && p < 65536;
}

/** Load and validate endpoints.json. Throws on anything unexpected. */
function loadEndpoints(file = path.join(__dirname, 'endpoints.json'), root = ROOT) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('*')) fail('wildcards are not allowed');
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.endpoints)) fail('"endpoints" must be an array');
  const ids = new Set();
  for (const e of data.endpoints) {
    if (!e || typeof e !== 'object') fail('each entry must be an object');
    if (typeof e.id !== 'string' || !/^[a-z0-9-]+$/.test(e.id)) fail(`bad id ${JSON.stringify(e.id)}`);
    if (ids.has(e.id)) fail(`duplicate id ${e.id}`);
    ids.add(e.id);
    if (!KINDS[e.kind]) fail(`${e.id}: unknown kind ${JSON.stringify(e.kind)}`);
    if (typeof e.reason !== 'string' || !e.reason.trim()) fail(`${e.id}: a reason is required`);
    if (e.enabled !== undefined && typeof e.enabled !== 'boolean') fail(`${e.id}: "enabled" must be true or false`);
    for (const k of Object.keys(e)) if (!COMMON.includes(k) && !KINDS[e.kind].includes(k)) fail(`${e.id}: unknown key "${k}"`);
    for (const k of KINDS[e.kind]) if (e[k] === undefined) fail(`${e.id}: "${k}" is required`);
    if ('defaultPort' in e && !validPort(e.defaultPort)) fail(`${e.id}: bad defaultPort`);
    if ('defaultHost' in e && !(core.isLoopback(e.defaultHost) && (e.defaultHost === 'localhost' || require('net').isIP(core.normalizeHost(e.defaultHost))))) fail(`${e.id}: defaultHost must be a loopback address`);
    for (const k of ['env', 'hostEnv', 'portEnv']) if (k in e && !/^[A-Z][A-Z0-9_]*$/.test(e[k])) fail(`${e.id}: bad ${k}`);
    if (e.kind === 'test-server' || e.kind === 'test-socket') {
      if (!Array.isArray(e.files) || e.files.length === 0) fail(`${e.id}: "files" must list test files`);
      for (const f of e.files) {
        if (typeof f !== 'string' || path.isAbsolute(f) || path.normalize(f) !== f || f.includes('..')) fail(`${e.id}: bad file ${JSON.stringify(f)}`);
        if (!fs.existsSync(path.join(root, f))) fail(`${e.id}: no such file ${f}`);
      }
    }
  }
  return data.endpoints;
}

function hostOf(value) {
  try { return new URL(value); } catch (err) { return null; }
}

/** Check the installed supertest is the reviewed one; returns { enabled, file, version, problem }. */
function supertestCompatibility(entry, root = ROOT) {
  const out = { id: entry.id, module: entry.module, expectedVersion: entry.version, enabled: false, file: null, version: null, problem: null };
  try {
    const pkgFile = path.join(root, 'node_modules', entry.module, 'package.json');
    out.version = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).version;
    const file = fs.realpathSync(path.join(root, 'node_modules', entry.module, entry.file));
    out.file = file;
    if (out.version !== entry.version) {
      out.problem = `installed ${entry.module} ${out.version}, reviewed ${entry.version}`;
      return out;
    }
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes(`${entry.function}(app, path) {`) || !src.includes('this._server = app.listen(0);')) {
      out.problem = `${entry.module}/${entry.file} no longer starts its server in ${entry.function}()`;
      return out;
    }
    out.enabled = true;
  } catch (err) {
    out.problem = `${entry.module} is not installed as expected (${err.code || err.message})`;
  }
  return out;
}

/**
 * Activate the registry in this process from the environment. Idempotent:
 * the env-declared ports are recomputed; registered servers and sockets are
 * kept (they end when their server closes).
 */
function activate({ env = process.env, root = ROOT, file } = {}) {
  const state = core.getState();
  const entries = loadEndpoints(file, root);
  const reg = state.registry;
  reg.tcpPorts = new Map();
  reg.entries = entries;
  const diagnostics = {};
  for (const e of entries) {
    const enabled = e.enabled !== false;
    if (e.kind === 'tcp-env-url') {
      const raw = env[e.env];
      const u = raw ? hostOf(raw) : null;
      if (!enabled) diagnostics[e.id] = { active: false, reason: 'disabled' };
      else if (!raw) diagnostics[e.id] = { active: false, reason: `${e.env} is not set` };
      else if (!u) diagnostics[e.id] = { active: false, reason: `${e.env} is not a URL` };
      else if (!core.isLoopback(u.hostname.replace(/^\[(.*)\]$/, '$1'))) diagnostics[e.id] = { active: false, reason: `${e.env} names a non-loopback host` };
      else {
        const port = Number(u.port || e.defaultPort);
        reg.tcpPorts.set(port, e.id);
        diagnostics[e.id] = { active: true, port };
      }
    } else if (e.kind === 'tcp-env-hostport') {
      if (!enabled) { diagnostics[e.id] = { active: false, reason: 'disabled' }; continue; }
      const host = env[e.hostEnv] || e.defaultHost;
      const port = Number(env[e.portEnv] || e.defaultPort);
      if (!core.isLoopback(host)) diagnostics[e.id] = { active: false, reason: `${e.hostEnv} names a non-loopback host` };
      else if (!validPort(port)) diagnostics[e.id] = { active: false, reason: `${e.portEnv} is not a port` };
      else { reg.tcpPorts.set(port, e.id); diagnostics[e.id] = { active: true, port }; }
    } else if (e.kind === 'supertest') {
      const compat = enabled ? supertestCompatibility(e, root) : { enabled: false, problem: 'disabled' };
      reg.supertest = { enabled: compat.enabled, file: compat.file };
      diagnostics[e.id] = { active: compat.enabled, version: compat.version, expectedVersion: e.version, problem: compat.problem };
    } else {
      diagnostics[e.id] = { active: enabled, files: e.files.length };
    }
  }
  reg.diagnostics = diagnostics;
  return diagnostics;
}

/** CI startup check: a configured test database must be on loopback. Returns problems (strings). */
function ciEndpointProblems(env = process.env, file, root = ROOT) {
  const problems = [];
  for (const e of loadEndpoints(file, root)) {
    if (e.kind !== 'tcp-env-url' || e.enabled === false || !env[e.env]) continue;
    const u = hostOf(env[e.env]);
    if (!u || !core.isLoopback(u.hostname.replace(/^\[(.*)\]$/, '$1'))) problems.push(`${e.env} must name a loopback host in CI (endpoint ${e.id})`);
  }
  return problems;
}

function entryFor(state, kind) {
  const entries = state.registry.entries || [];
  return entries.find((x) => x.kind === kind && x.enabled !== false) || null;
}

function callerFile(state, kind) {
  const entry = entryFor(state, kind);
  const file = state.context && state.context.testPath;
  if (!entry) throw new Error(`networkGuard: no active ${kind} endpoint entry`);
  if (!file || !entry.files.includes(file)) throw new Error(`networkGuard: ${file || 'this file'} is not listed for ${kind} in endpoints.json`);
  return { entry, file };
}

/**
 * Register a loopback server this test file opened (by server object or port).
 * It must be a listener opened in this process after the guard was installed,
 * bound to 127.0.0.0/8 or ::1 (not 0.0.0.0 or ::). The entry ends when the
 * server closes.
 */
function trustTestServer(serverOrPort) {
  const state = core.getState();
  const { entry, file } = callerFile(state, 'test-server');
  const port = typeof serverOrPort === 'number' ? serverOrPort
    : (serverOrPort && typeof serverOrPort.address === 'function' && serverOrPort.address() ? serverOrPort.address().port : null);
  const listener = port ? state.listeners.ports.get(port) : null;
  if (!listener) throw new Error(`networkGuard: no server opened by this process is listening on port ${port}`);
  if (typeof serverOrPort === 'object' && listener.server !== serverOrPort) throw new Error('networkGuard: that port belongs to a different server');
  if (!core.isLoopbackAddress(listener.address)) throw new Error(`networkGuard: the server listens on ${listener.address}, not on a loopback address`);
  state.registry.servers.set(port, { id: entry.id, server: listener.server, file });
  return port;
}

/**
 * Register a Unix socket this test file created, by exact path. The path must
 * be absolute and normalized, inside the system temp directory with no
 * symlinked component, be a socket (not a symlink), and be the address of a
 * server opened in this process.
 */
function trustTestSocket(socketPath) {
  const state = core.getState();
  const { entry, file } = callerFile(state, 'test-socket');
  const p = String(socketPath);
  if (p.startsWith('\0')) throw new Error('networkGuard: abstract sockets cannot be registered');
  if (!path.isAbsolute(p) || path.resolve(p) !== p) throw new Error('networkGuard: the socket path must be absolute and normalized');
  const dir = path.dirname(p);
  const tmp = fs.realpathSync(os.tmpdir());
  if (fs.realpathSync(dir) !== dir) throw new Error('networkGuard: the socket directory must not contain a symlink');
  if (!dir.startsWith(`${tmp}${path.sep}`)) throw new Error('networkGuard: test sockets must live under the system temp directory');
  const st = fs.lstatSync(p);
  if (st.isSymbolicLink() || !st.isSocket()) throw new Error('networkGuard: not a socket');
  if (!state.listeners.paths.has(p)) throw new Error('networkGuard: no server opened by this process listens on that socket');
  state.registry.paths.set(p, { id: entry.id, file });
  return p;
}

module.exports = { loadEndpoints, supertestCompatibility, activate, ciEndpointProblems, trustTestServer, trustTestSocket };
