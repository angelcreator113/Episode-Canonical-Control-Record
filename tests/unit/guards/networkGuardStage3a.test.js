'use strict';

/**
 * Self-tests for the Jest network guard, Stage 3a (report-only): the endpoint
 * registry, address normalization, proxy settings, UDP, the post-lookup
 * check, tamper detection, the config fingerprint and canary verification.
 *
 * Scenarios that create findings on purpose run in a nested Jest process
 * (tests/networkGuard/fixtures/stage3a.fixture.test.js), under the
 * independent tripwire, with its own temporary root, so they never add
 * findings to this run's report. Every destination they use is local.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const GUARD_DIR = path.join(ROOT, 'tests/networkGuard');
const core = require('../../networkGuard/core');
const registry = require('../../networkGuard/registry');
const proxyEnv = require('../../networkGuard/proxyEnv');
const canaryHelper = require('../../networkGuard/canary');
const { buildReport, verifyReport, verifyCanary, canaryAbsent, renderSummary, REQUIRED_HOOKS } = require('../../networkGuard/report');
const { configProblems } = require('../../networkGuard/reporter');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ng3a-'));
const freePort = async () => {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
};

describe('address normalization and classification', () => {
  test.each([
    ['127.1', true], ['0x7f.1', true], ['2130706433', true], ['0177.0.0.1', true], ['127.0.0.1', false], ['localhost', false], ['example.com', false], ['1.2.3.4.5', false],
  ])('%s is a numeric shortcut name: %s', (h, expected) => {
    expect(core.isNoncanonicalIpName(h)).toBe(expected);
  });

  test.each([
    ['127.0.0.1', true], ['::1', true], ['::ffff:127.0.0.1', true], ['0:0:0:0:0:0:0:1', true], ['localhost', false], ['0.0.0.0', false], ['::', false],
    ['::127.0.0.1', false], ['64:ff9b::7f00:1', false], ['2002:7f00:1::', false], ['169.254.169.254', false], ['fe80::1', false],
  ])('%s is a loopback address: %s', (h, expected) => {
    expect(core.isLoopbackAddress(h)).toBe(expected);
  });

  test('numeric shortcut names are never loopback, and an attempt to one is flagged', () => {
    const state = { allowHosts: new Set(), registry: { tcpPorts: new Map(), servers: new Map(), paths: new Map() } };
    expect(core.decide(state, 'dns.lookup', { host: '127.1' })).toMatchObject({ type: 'attempt', host: '127.1', noncanonicalIp: true });
  });

  test('a proxied request is classified by its real destination (absolute-form path), with the proxy recorded', () => {
    expect(core.requestTarget([{ host: '127.0.0.1', port: 3128, path: 'http://img.test/a.png' }], 80)).toEqual({ host: 'img.test', port: 80, via: '127.0.0.1:3128' });
    expect(core.requestTarget([{ host: '127.0.0.1', port: 3128, path: 'https://api.example.invalid/x' }], 80)).toMatchObject({ host: 'api.example.invalid', port: 443 });
    expect(core.requestTarget([{ host: '127.0.0.1', port: 8080, path: '/plain' }], 80)).toEqual({ host: '127.0.0.1', port: 8080 });
  });

  test('UDP send targets: every call shape; a connected socket is decided at connect', () => {
    const v4 = { type: 'udp4' };
    expect(core.udpSendTarget(v4, [Buffer.from('x'), 53, '8.8.8.8'])).toEqual({ host: '8.8.8.8', port: 53 });
    expect(core.udpSendTarget(v4, [Buffer.from('x'), 0, 1, 53, '8.8.8.8', () => {}])).toEqual({ host: '8.8.8.8', port: 53 });
    expect(core.udpSendTarget(v4, [Buffer.from('x'), 9])).toEqual({ host: '127.0.0.1', port: 9 });
    expect(core.udpSendTarget({ type: 'udp6' }, [Buffer.from('x'), 9])).toEqual({ host: '::1', port: 9 });
    expect(core.udpSendTarget(v4, [Buffer.from('x'), () => {}])).toBeNull();
  });

  test('policy: loopback needs a registered port (TCP); UDP loopback is never registered; Unix needs an exact registered path', () => {
    const live = { listening: true, address: () => ({ port: 4100 }) };
    const state = { allowHosts: new Set(), registry: { tcpPorts: new Map([[5432, 'postgres-test']]), servers: new Map([[4100, { id: 'supertest', server: live }], [4200, { id: 'x', server: { listening: false, address: () => null } }]]), paths: new Map() } };
    expect(core.decide(state, 'socket', { host: 'localhost', port: 5432 })).toBeNull();
    expect(core.decide(state, 'socket', { host: '127.0.0.1', port: 4100 })).toBeNull();
    expect(core.decide(state, 'socket', { host: '127.0.0.1', port: 4200 })).toMatchObject({ type: 'finding', kind: 'loopback-unregistered' });
    expect(core.decide(state, 'socket', { host: '::1', port: 9 })).toMatchObject({ type: 'finding', kind: 'loopback-unregistered' });
    expect(core.decide(state, 'udp', { host: '127.0.0.1', port: 5432 })).toMatchObject({ type: 'finding', kind: 'loopback-unregistered' });
    expect(core.decide(state, 'http', { host: '127.0.0.1', port: 9 })).toBeNull(); // decided where the connection is made
    expect(core.decide(state, 'socket', { host: '0.0.0.0', port: 5432 })).toMatchObject({ type: 'attempt' });
    expect(core.decide(state, 'socket', { path: '/var/run/docker.sock' })).toMatchObject({ kind: 'unix-unregistered', reason: 'not registered' });
    expect(core.decide(state, 'socket', { path: 'relative.sock' })).toMatchObject({ reason: 'not an absolute, normalized path' });
    expect(core.decide(state, 'socket', { path: '/tmp/a/../b.sock' })).toMatchObject({ reason: 'not an absolute, normalized path' });
    expect(core.decide(state, 'socket', { path: '\0abstract' })).toMatchObject({ reason: 'abstract socket' });
  });
});

describe('endpoint registry file', () => {
  const write = (dir, data) => { const f = path.join(dir, 'endpoints.json'); fs.writeFileSync(f, JSON.stringify(data)); return f; };
  const reason = 'a reason';

  test('the shipped registry loads; Redis is disabled; nothing names a non-loopback host', () => {
    const entries = registry.loadEndpoints();
    expect(entries.map((e) => e.id).sort()).toEqual(['postgres-test', 'redis-test', 'supertest', 'test-server', 'test-socket']);
    expect(entries.find((e) => e.id === 'redis-test').enabled).toBe(false);
    expect(fs.readFileSync(path.join(GUARD_DIR, 'endpoints.json'), 'utf8')).not.toMatch(/\*/);
    expect(JSON.parse(fs.readFileSync(path.join(GUARD_DIR, 'allowlist.json'), 'utf8')).hosts).toEqual([]);
  });

  test.each([
    ['a wildcard', { endpoints: [{ id: 'a', kind: 'test-server', files: ['tests/*.js'], reason }] }, /wildcards/],
    ['an unknown kind', { endpoints: [{ id: 'a', kind: 'tcp-any', reason }] }, /unknown kind/],
    ['an unknown key', { endpoints: [{ id: 'a', kind: 'test-server', files: ['package.json'], reason, host: 'x' }] }, /unknown key/],
    ['a missing reason', { endpoints: [{ id: 'a', kind: 'test-server', files: ['package.json'] }] }, /reason/],
    ['a non-loopback default host', { endpoints: [{ id: 'a', kind: 'tcp-env-hostport', hostEnv: 'H', portEnv: 'P', defaultHost: '10.0.0.1', defaultPort: 1, reason }] }, /loopback/],
    ['0.0.0.0 as a default host', { endpoints: [{ id: 'a', kind: 'tcp-env-hostport', hostEnv: 'H', portEnv: 'P', defaultHost: '0.0.0.0', defaultPort: 1, reason }] }, /loopback/],
    ['a missing file', { endpoints: [{ id: 'a', kind: 'test-server', files: ['tests/nope.test.js'], reason }] }, /no such file/],
    ['a parent-directory file', { endpoints: [{ id: 'a', kind: 'test-server', files: ['../x.js'], reason }] }, /bad file/],
    ['a duplicate id', { endpoints: [{ id: 'a', kind: 'test-server', files: ['package.json'], reason }, { id: 'a', kind: 'test-socket', files: ['package.json'], reason }] }, /duplicate/],
    ['a bad port', { endpoints: [{ id: 'a', kind: 'tcp-env-url', env: 'X', defaultPort: 0, reason }] }, /defaultPort/],
  ])('refuses %s', (_label, data, re) => {
    expect(() => registry.loadEndpoints(write(tmpDir(), data), ROOT)).toThrow(re);
  });

  test('activation: the database is trusted only on loopback; Redis stays disabled; supertest is checked against the reviewed version', () => {
    const state = core.getState();
    const saved = { ...state.registry, tcpPorts: new Map(state.registry.tcpPorts) };
    try {
      let d = registry.activate({ env: { TEST_DATABASE_URL: 'postgresql://u:p@localhost:5999/db', REDIS_PORT: '6000' } });
      expect(d['postgres-test']).toEqual({ active: true, port: 5999 });
      expect(d['redis-test']).toEqual({ active: false, reason: 'disabled' });
      expect(d.supertest).toMatchObject({ active: true, version: '6.3.4', problem: null });
      expect([...state.registry.tcpPorts.keys()]).toEqual([5999]);
      d = registry.activate({ env: { TEST_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/db' } });
      expect(d['postgres-test']).toEqual({ active: false, reason: 'TEST_DATABASE_URL names a non-loopback host' });
      expect(JSON.stringify(d)).not.toMatch(/db\.example\.com|u:p/);
      d = registry.activate({ env: {} });
      expect(d['postgres-test'].active).toBe(false);
      expect(registry.ciEndpointProblems({ TEST_DATABASE_URL: 'postgresql://u:p@db.example.com/db' })).toHaveLength(1);
      expect(registry.ciEndpointProblems({ TEST_DATABASE_URL: 'postgresql://u:p@127.0.0.1/db' })).toEqual([]);
    } finally {
      registry.activate({ env: process.env });
      Object.assign(state.registry, { servers: saved.servers, paths: saved.paths });
    }
  });

  test('supertest compatibility: a different installed version or a changed serverAddress() disables the registrar (fail closed)', () => {
    const root = tmpDir();
    const dir = path.join(root, 'node_modules', 'supertest', 'lib');
    fs.mkdirSync(dir, { recursive: true });
    const entry = { id: 'supertest', module: 'supertest', version: '6.3.4', file: 'lib/test.js', function: 'serverAddress' };
    fs.writeFileSync(path.join(root, 'node_modules', 'supertest', 'package.json'), JSON.stringify({ version: '7.0.0' }));
    fs.writeFileSync(path.join(dir, 'test.js'), 'serverAddress(app, path) {\n this._server = app.listen(0);');
    expect(registry.supertestCompatibility(entry, root)).toMatchObject({ enabled: false, problem: 'installed supertest 7.0.0, reviewed 6.3.4' });
    fs.writeFileSync(path.join(root, 'node_modules', 'supertest', 'package.json'), JSON.stringify({ version: '6.3.4' }));
    fs.writeFileSync(path.join(dir, 'test.js'), 'serverAddress(app, path) {\n return app.url;');
    expect(registry.supertestCompatibility(entry, root)).toMatchObject({ enabled: false, problem: expect.stringMatching(/no longer starts its server/) });
    expect(registry.supertestCompatibility(entry, ROOT)).toMatchObject({ enabled: true, version: '6.3.4' });
  });

  test('the helpers refuse a test file that is not listed for them', () => {
    expect(() => registry.trustTestServer(1)).toThrow(/not listed for test-server/);
    expect(() => registry.trustTestSocket('/tmp/x.sock')).toThrow(/not listed for test-socket/);
  });
});

describe('proxy settings (names only, never values)', () => {
  test('finds and removes every proxy variable, upper and lower case, and the --use-env-proxy flag', () => {
    const env = {
      HTTP_PROXY: 'v', https_proxy: 'v', ALL_PROXY: 'v', all_proxy: 'v', NO_PROXY: 'v', no_proxy: 'v', FTP_PROXY: 'v', SOCKS_PROXY: 'v',
      npm_config_https_proxy: 'v', npm_config_proxy: 'v', npm_config_noproxy: 'v', GLOBAL_AGENT_HTTP_PROXY: 'v', NODE_USE_ENV_PROXY: '1',
      YARN_HTTPS_PROXY: 'v', NODE_OPTIONS: '--max-old-space-size=100 --use-env-proxy', PATH: '/bin', CLOUDSDK_PROXY_TYPE: 'http', CCR_AGENT_PROXY_ENABLED: '1',
    };
    const found = proxyEnv.findProxySettings(env, []);
    expect(found).toEqual(expect.arrayContaining(['HTTP_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy', 'FTP_PROXY', 'SOCKS_PROXY',
      'npm_config_https_proxy', 'npm_config_proxy', 'npm_config_noproxy', 'GLOBAL_AGENT_HTTP_PROXY', 'NODE_USE_ENV_PROXY', 'YARN_HTTPS_PROXY', 'NODE_OPTIONS:--use-env-proxy']));
    expect(found).not.toContain('PATH');
    expect(found).not.toContain('CLOUDSDK_PROXY_TYPE');
    const { removed, unremovable } = proxyEnv.sanitize(env, ['--use-env-proxy']);
    expect(removed).toEqual(found);
    expect(unremovable).toEqual(['execArgv:--use-env-proxy']);
    expect(env.NODE_OPTIONS).toBe('--max-old-space-size=100');
    expect(Object.keys(env).sort()).toEqual(['CCR_AGENT_PROXY_ENABLED', 'CLOUDSDK_PROXY_TYPE', 'NODE_OPTIONS', 'PATH']);
    expect(JSON.stringify(found)).not.toMatch(/"v"/);
  });

  test('this test file received no proxy settings (the heartbeat recorded none)', () => {
    expect(core.getState().proxyFound).toEqual([]);
    expect(proxyEnv.findProxySettings(process.env, process.execArgv)).toEqual([]);
  });
});

describe('canary verification (pure)', () => {
  const manifest = { file: 'c.test.js', canaries: [{ id: 'a', transports: ['socket'], events: 1, host: '0.0.0.0' }, { id: 'b', transports: ['fetch'], events: 2, host: '0.0.0.0' }] };
  const ev = (id, extra = {}) => ({ type: 'attempt', canary: id, testPath: 'c.test.js', action: 'blocked', transport: id === 'a' ? 'socket' : 'fetch', host: '0.0.0.0', ...extra });
  const witness = { file: 'c.test.js', connections: 0, datagrams: 0, unixConnections: 0, observed: [{ id: 'a', code: 'ERR_TEST_NETWORK_BLOCKED' }, { id: 'b', code: 'ERR_TEST_NETWORK_BLOCKED' }] };
  const base = { manifest, witness, events: [ev('a'), ev('b'), ev('b')], executedFiles: ['c.test.js'], fileResults: { 'c.test.js': { passed: 4, failed: 0, skipped: 0 } } };

  test('verified when ids, destinations, counts, results and the witness all match', () => {
    expect(verifyCanary(base)).toMatchObject({ ok: true, issues: [] });
  });

  test.each([
    ['a missing canary event', { events: [ev('a'), ev('b')] }, /b: 1 event/],
    ['an extra canary event', { events: [ev('a'), ev('b'), ev('b'), ev('b')] }, /b: 3 event/],
    ['an unknown canary', { events: [...base.events, ev('z')] }, /not in the manifest/],
    ['an unblocked canary', { events: [ev('a', { action: 'reported' }), ev('b'), ev('b')] }, /not blocked/],
    ['a wrong destination', { events: [ev('a', { host: '203.0.113.1' }), ev('b'), ev('b')] }, /unexpected destination/],
    ['a wrong transport', { events: [ev('a', { transport: 'http' }), ev('b'), ev('b')] }, /unexpected transport/],
    ['a canary event from another file', { events: [ev('a', { testPath: 'other.test.js' }), ev('b'), ev('b')] }, /event from other/],
    ['a skipped canary file', { fileResults: { 'c.test.js': { passed: 0, failed: 0, skipped: 3, suiteSkipped: true } } }, /skipped, failed or changed/],
    ['a failed canary test', { fileResults: { 'c.test.js': { passed: 3, failed: 1, skipped: 0 } } }, /skipped, failed or changed/],
    ['a canary file that did not run', { executedFiles: [] }, /did not run/],
    ['a missing witness record', { witness: null }, /witness record missing/],
    ['a connection that reached a witness', { witness: { ...witness, connections: 1 } }, /reached a canary witness/],
    ['a witness record missing a canary', { witness: { ...witness, observed: witness.observed.slice(0, 1) } }, /exactly the manifest/],
    ['an outcome that was not a block', { witness: { ...witness, observed: [witness.observed[0], { id: 'b', code: 'ECONNREFUSED' }] } }, /not ERR_TEST_NETWORK_BLOCKED/],
    ['an unreadable manifest', { manifest: null, manifestError: 'bad json' }, /manifest unreadable/],
  ])('fails on %s', (_label, over, re) => {
    const r = verifyCanary({ ...base, ...over });
    expect(r.ok).toBe(false);
    expect(r.issues.join(' ')).toMatch(re);
  });

  test('the shipped manifest names only never-leave destinations, and refuses anything else', () => {
    const m = canaryHelper.loadManifest();
    for (const c of m.canaries) expect(c.host === undefined ? c.kind : canaryHelper.NEVER_LEAVE_HOSTS.has(c.host)).toBeTruthy();
    const dir = tmpDir();
    const bad = path.join(dir, 'm.json');
    fs.writeFileSync(bad, JSON.stringify({ file: 'x', canaries: [{ id: 'x', transports: ['fetch'], events: 1, host: 'api.anthropic.com' }] }));
    expect(() => canaryHelper.loadManifest(bad)).toThrow(/not a never-leave destination/);
  });

  test('the canary helper refuses any other test file', async () => {
    await expect(canaryHelper.expectNetworkBlocked('socket-ipv4-any', async () => {})).rejects.toThrow(/only tests\/unit\/guards\/networkGuard\.canary\.test\.js/);
  });

  test('only the canary test file (and the guard itself) imports the canary helper', () => {
    const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(rel);
      return /\.js$/.test(e.name) ? [rel] : [];
    });
    const files = [...walk('src'), ...walk('tests')];
    const users = files.filter((f) => /require\(['"][^'"]*\/canary['"]\)/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(users.sort()).toEqual(['tests/networkGuard/reporter.js', 'tests/unit/guards/networkGuard.canary.test.js', 'tests/unit/guards/networkGuardStage3a.test.js'].sort());
  });
});

describe('report: findings, canaries and integrity (pure)', () => {
  const START = { runId: 'r1', startedAt: 't0', mode: 'report', proxy: { removed: ['HTTPS_PROXY'] } };
  const HOOKS = Object.fromEntries(REQUIRED_HOOKS.map((k) => [k, true]));
  const hb = (f, extra = {}) => ({ type: 'heartbeat', testPath: f, mode: 'report', hooks: HOOKS, reinstalled: [], proxyFound: [], registry: { supertest: { active: true } }, ...extra });
  const end = (f, events = 0) => ({ type: 'file-end', testPath: f, events });
  const manifest = { file: 'c.test.js', canaries: [{ id: 'a', transports: ['socket'], events: 1, host: '0.0.0.0' }] };
  const canaryLines = [hb('c.test.js'), { type: 'attempt', canary: 'a', testPath: 'c.test.js', action: 'blocked', transport: 'socket', host: '0.0.0.0' }, end('c.test.js', 1)];
  const base = {
    start: START, envRunId: 'r1', runDirExists: true, executedFiles: ['a.test.js', 'c.test.js'], canaryManifest: manifest,
    canaryWitness: { file: 'c.test.js', connections: 0, datagrams: 0, unixConnections: 0, observed: [{ id: 'a', code: 'ERR_TEST_NETWORK_BLOCKED' }] },
    fileResults: { 'c.test.js': { passed: 3, failed: 0, skipped: 0 } },
  };

  test('canary events are kept out of the attempts; findings are grouped by kind; both count toward the file-end', () => {
    const lines = [...canaryLines, hb('a.test.js'),
      { type: 'finding', kind: 'loopback-unregistered', transport: 'socket', host: '127.0.0.1', port: 6379, testPath: 'a.test.js' },
      { type: 'attempt', transport: 'dns.lookup', host: '127.1', noncanonicalIp: true, testPath: 'a.test.js' }, end('a.test.js', 2)];
    const r = buildReport({ ...base, lines });
    expect(r.status).toBe('complete');
    expect(r.attempts.total).toBe(1);
    expect(r.findings['loopback-unregistered']).toMatchObject({ count: 1, files: ['a.test.js'], targets: ['127.0.0.1:6379'] });
    expect(r.findings['noncanonical-ip-name'].count).toBe(1);
    expect(r.canary.ok).toBe(true);
    expect(r.proxy.removedAtStart).toEqual(['HTTPS_PROXY']);
    expect(verifyReport({ start: START, report: r })).toEqual({ ok: true, problems: [] });
  });

  test.each([
    ['a hook removed during a test', [{ type: 'tamper', testPath: 'a.test.js', hooks: ['dgram.Socket.prototype.send'] }], {}, /removed during the test/],
    ['proxy settings reaching a test file', [], { a: { proxyFound: ['HTTPS_PROXY'] } }, /proxy settings reached 1 test file/],
    ['an endpoint registry that failed to load', [], { a: { registry: { error: 'bad' } } }, /registry failed to load/],
    ['a missing Stage 3a hook', [], { a: { hooks: { ...HOOKS, 'dgram.Socket.prototype.send': false } } }, /hook missing/],
  ])('incomplete with %s', (_label, extra, hbOver, re) => {
    const lines = [...canaryLines, hb('a.test.js', hbOver.a || {}), end('a.test.js'), ...extra];
    const r = buildReport({ ...base, lines });
    expect(r.status).toBe('incomplete');
    expect(r.issues.join(' ')).toMatch(re);
    expect(verifyReport({ start: START, report: r }).ok).toBe(false);
  });

  test('a Jest configuration that does not wire the guard is reported', () => {
    const good = { setupFiles: ['/r/tests/networkGuard/setup.js'], setupFilesAfterEnv: ['/r/tests/networkGuard/afterEnv.js', '/r/tests/setup.js'], globalSetup: '/r/tests/networkGuard/globalSetup.js', testEnvironment: '/r/node_modules/jest-environment-node/build/index.js' };
    const gc = { reporters: [['default', {}], ['/r/tests/networkGuard/reporter.js', {}]] };
    expect(configProblems(gc, [{ config: good }])).toEqual([]);
    expect(configProblems({ reporters: [['default', {}]] }, [{ config: good }])).toEqual(['the guard reporter is not configured']);
    expect(configProblems(gc, [{ config: { ...good, setupFilesAfterEnv: ['/r/tests/setup.js'] } }])).toEqual(['setupFilesAfterEnv does not start with tests/networkGuard/afterEnv.js']);
    expect(configProblems(gc, [{ config: { ...good, testEnvironment: 'jsdom' } }])).toEqual(['unexpected testEnvironment jsdom']);
    const r = buildReport({ ...base, lines: [...canaryLines, hb('a.test.js'), end('a.test.js')], configProblems: ['setupFiles does not start with tests/networkGuard/setup.js'] });
    expect(r.status).toBe('incomplete');
  });

  test('a failed canary verification fails verify even when the run is complete', () => {
    const r = buildReport({ ...base, lines: [hb('c.test.js'), end('c.test.js'), hb('a.test.js'), end('a.test.js')] });
    expect(r.status).toBe('complete');
    const v = verifyReport({ start: START, report: r });
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/canary verification failed/);
  });

  describe('focused mode (a job that runs a fixed few files, without the canary file)', () => {
    const attempt = { type: 'attempt', transport: 'socket', host: '203.0.113.9', port: 443, testPath: 'a.test.js' };
    const noCanaryFile = { ...base, executedFiles: ['a.test.js'], fileResults: { 'a.test.js': { passed: 1, failed: 0, skipped: 0 } } };
    const focusedRun = (extra = []) => buildReport({ ...noCanaryFile, lines: [hb('a.test.js'), ...extra, end('a.test.js', extra.length)] });

    test('strict mode still fails a run without the canary file; focused mode accepts it and says so', () => {
      const r = focusedRun();
      expect(r.status).toBe('complete');
      expect(canaryAbsent(r)).toBe(true);
      expect(verifyReport({ start: START, report: r }).ok).toBe(false);
      expect(verifyReport({ start: START, report: r, focused: false }).problems.join(' ')).toMatch(/canary verification failed/);
      expect(verifyReport({ start: START, report: r, focused: true })).toEqual({ ok: true, problems: [] });
      const text = renderSummary(r, { ok: true, problems: [] }, { focused: true });
      expect(text).toMatch(/Canaries: \*\*not required\*\* \(focused run/);
      expect(text).not.toMatch(/Canary issues/);
      expect(renderSummary(r, { ok: false, problems: [] })).toMatch(/Canaries: \*\*FAILED\*\*/);
    });

    test('focused mode fails on an unexpected external attempt; strict mode with canaries stays report-only for attempts', () => {
      const r = focusedRun([attempt]);
      expect(r.attempts.total).toBe(1);
      const v = verifyReport({ start: START, report: r, focused: true });
      expect(v.ok).toBe(false);
      expect(v.problems).toEqual(['a focused run recorded 1 unexpected external attempt(s)']);
      const full = buildReport({ ...base, lines: [...canaryLines, hb('a.test.js'), attempt, end('a.test.js', 1)] });
      expect(verifyReport({ start: START, report: full })).toEqual({ ok: true, problems: [] });
    });

    test('focused mode waives nothing when the canary file ran: a failed or partial canary still fails', () => {
      // The canary file ran but recorded no blocked event.
      const ranNoEvents = buildReport({ ...base, lines: [hb('c.test.js'), end('c.test.js'), hb('a.test.js'), end('a.test.js')] });
      expect(canaryAbsent(ranNoEvents)).toBe(false);
      expect(verifyReport({ start: START, report: ranNoEvents, focused: true }).problems.join(' ')).toMatch(/canary verification failed/);
      // The canary file is not in the run, yet a canary event was recorded.
      const stray = buildReport({ ...noCanaryFile, lines: [hb('a.test.js'), { ...canaryLines[1], testPath: 'a.test.js' }, end('a.test.js', 1)] });
      expect(canaryAbsent(stray)).toBe(false);
      expect(verifyReport({ start: START, report: stray, focused: true }).ok).toBe(false);
    });

    test('focused mode still rejects a missing, stale, unfinalized, incomplete, disabled-in-CI or malformed report', () => {
      const good = focusedRun();
      const f = (over) => verifyReport({ start: START, report: good, focused: true, ...over });
      expect(f({ report: null }).problems.join(' ')).toMatch(/report missing/);
      expect(f({ start: null }).problems.join(' ')).toMatch(/start marker missing/);
      expect(f({ start: { ...START, runId: 'older' } }).problems.join(' ')).toMatch(/stale/);
      expect(f({ report: { ...good, finalized: false } }).problems.join(' ')).toMatch(/not finalized/);
      expect(f({ report: { ...good, status: 'weird' } }).problems.join(' ')).toMatch(/unknown report status/);
      expect(f({ report: { ...good, attempts: undefined } }).problems.join(' ')).toMatch(/no attempt count/);
      expect(f({ report: { ...good, canary: undefined } }).problems.join(' ')).toMatch(/no canary section/);
      expect(f({ report: { ...good, canary: { ok: false } } }).ok).toBe(false);
      // A file that never reported its end makes the run incomplete in both modes.
      const incomplete = buildReport({ ...noCanaryFile, lines: [hb('a.test.js')] });
      expect(incomplete.status).toBe('incomplete');
      expect(verifyReport({ start: START, report: incomplete, focused: true }).ok).toBe(false);
      const offStart = { ...START, mode: 'off' };
      const off = buildReport({ ...noCanaryFile, start: offStart, lines: [hb('a.test.js', { mode: 'off' }), end('a.test.js')] });
      expect(verifyReport({ start: offStart, report: off, env: { CI: 'true' }, focused: true }).ok).toBe(false);
    });

    test('the CLI: --focused is the only way in, any other argument is refused, and no environment variable turns it on', () => {
      const { main } = require('../../networkGuard/verify');
      const root = tmpDir();
      const dir = path.join(root, 'tmp', 'network-guard');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'start.json'), JSON.stringify(START));
      fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(focusedRun()));
      const out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const err = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        expect(main(root, {}, [])).toBe(1);
        expect(main(root, { NETWORK_GUARD_FOCUSED: 'true', FOCUSED: '1' }, [])).toBe(1);
        expect(main(root, {}, ['--focused'])).toBe(0);
        expect(main(root, {}, ['--focused', '--skip-canaries'])).toBe(1);
        expect(main(root, {}, ['--focussed'])).toBe(1);
        fs.writeFileSync(path.join(dir, 'report.json'), '{ not json');
        expect(main(root, {}, ['--focused'])).toBe(1);
      } finally {
        out.mockRestore();
        err.mockRestore();
      }
    });

    test('CI: the Tests job verifies strictly; only the PostgreSQL 17 job passes --focused', () => {
      const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/validate.yml'), 'utf8');
      const job = (from, to) => workflow.slice(workflow.indexOf(from), workflow.indexOf(to));
      const tests = job('\n  tests:', '\n  a2-constraints-pg17:');
      const a2 = job('\n  a2-constraints-pg17:', '\n  frontend-tests:');
      expect(tests.length).toBeGreaterThan(100);
      expect(a2.length).toBeGreaterThan(100);
      expect(tests).toMatch(/run: node tests\/networkGuard\/verify\.js\n/);
      expect(tests).not.toMatch(/--focused/);
      expect(a2).toMatch(/run: node tests\/networkGuard\/verify\.js --focused\n/);
      expect(workflow.match(/verify\.js --focused/g)).toHaveLength(1);
      expect(workflow.match(/networkGuard\/verify\.js/g)).toHaveLength(2);
    });
  });
});

/** Run the fixture in a nested Jest process, under the tripwire, in its own temporary root. */
function nested(mode, { files = ['stage3a.fixture.test.js'], args = [], env = {} } = {}) {
  const dir = tmpDir();
  const fixtures = path.join(dir, 'tests', 'networkGuard', 'fixtures');
  fs.mkdirSync(fixtures, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(GUARD_DIR, 'fixtures', 'stage3a.fixture.test.js'), path.join(fixtures, f));
  const outDir = path.join(dir, 'out');
  fs.mkdirSync(outDir);
  const q = JSON.stringify;
  fs.writeFileSync(path.join(dir, 'jest.config.js'), `module.exports = { rootDir: ${q(dir)}, testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/networkGuard/fixtures/*.fixture.test.js'],
    setupFiles: [${q(path.join(GUARD_DIR, 'setup.js'))}], setupFilesAfterEnv: [${q(path.join(GUARD_DIR, 'afterEnv.js'))}],
    globalSetup: ${q(path.join(GUARD_DIR, 'globalSetup.js'))}, reporters: [${q(path.join(GUARD_DIR, 'reporter.js'))}],
    cacheDirectory: ${q(path.join(dir, '.cache'))} };\n`);
  const r = spawnSync(process.execPath, ['-r', path.join(GUARD_DIR, 'probe/tripwire.js'), path.join(ROOT, 'node_modules/jest/bin/jest.js'), '--config', path.join(dir, 'jest.config.js'), ...args], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, FIXTURE: mode, FIXTURE_OUT: outDir, FIXTURE_GUARD_DIR: GUARD_DIR, FIXTURE_REPO: ROOT, ...env },
    encoding: 'utf8', timeout: 180000,
  });
  const base = path.join(dir, 'tmp', 'network-guard');
  const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (err) { return null; } };
  const outputs = {};
  for (const f of fs.readdirSync(outDir)) outputs[f.replace(/\.json$/, '')] = read(path.join(outDir, f));
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, dir, base, report: read(path.join(base, 'report.json')), start: read(path.join(base, 'start.json')), outputs };
}

describe('nested runs (fixture, under the tripwire)', () => {
  jest.setTimeout(240000);

  test('registry: supertest, registered servers, the database and registered sockets are not findings; everything else is', async () => {
    const dbPort = await freePort();
    const redisPort = await freePort();
    const r = nested('registry', { env: { TEST_DATABASE_URL: `postgresql://u@127.0.0.1:${dbPort}/db`, FIXTURE_DB_PORT: String(dbPort), REDIS_PORT: String(redisPort) } });
    const o = r.outputs['stage3a.fixture.test.js'];
    expect(o).toBeTruthy();
    const s = o.steps;
    expect(s.supertest).toEqual({ ok: true, value: 'ok' });
    expect(s['supertest-concurrent']).toEqual({ ok: true, value: 20 });
    expect(s['supertest-stale']).toEqual({ ok: true, value: 0 }); // every supertest entry ended with its server
    expect(s['fake-supertest']).toEqual({ ok: true, value: 'fake' }); // report-only: it works, as a finding
    expect(s['trust-server']).toEqual({ ok: true, value: 'trusted' });
    expect(s['refuse-any-address'].error).toMatch(/not on a loopback address/);
    expect(s['refuse-unknown-port'].error).toMatch(/no server opened by this process/);
    expect(s['refuse-other-server'].error).toMatch(/different server/);
    expect(s['db-endpoint'].ok).toBe(true);
    expect(s['redis-disabled'].ok).toBe(true);
    expect(s['trust-socket']).toEqual({ ok: true, value: 'connected' });
    expect(s['unregistered-socket'].ok).toBe(true);
    expect(s['refuse-symlink'].error).toMatch(/not a socket/);
    expect(s['refuse-relative'].error).toMatch(/absolute and normalized/);
    expect(s['refuse-abstract'].error).toMatch(/abstract/);
    expect(s['refuse-symlinked-dir'].error).toMatch(/symlink/);
    expect(s['refuse-not-opened-here'].error).toMatch(/no server opened by this process/);
    const f = r.report.findings;
    const lt = f['loopback-unregistered'].targets;
    expect(lt).toEqual(expect.arrayContaining([`127.0.0.1:${o.ports.fake}`, `127.0.0.1:${o.ports.trusted}`, `127.0.0.1:${redisPort}`]));
    expect(lt.some((t) => t.endsWith(`:${dbPort}`))).toBe(false);
    expect(f['loopback-unregistered'].count).toBe(3); // fake supertest, the closed trusted server, Redis
    expect(f['unix-unregistered'].targets.sort()).toEqual([o.paths.link, o.paths.stray].sort());
    expect(f['post-lookup-nonloopback'].count).toBeGreaterThanOrEqual(1);
    expect(f['localhost-resolution-mismatch'].count).toBeGreaterThanOrEqual(1);
    expect(f['noncanonical-ip-name'].count).toBeGreaterThanOrEqual(1);
    expect(r.report.attempts.hosts.map((h) => h.host)).toEqual(['127.1']);
    expect(r.report.compatibility.supertest[0]).toMatchObject({ active: true, version: '6.3.4' });
    expect(r.report.compatibility['postgres-test'][0]).toMatchObject({ active: true, port: dbPort });
    expect(r.report.compatibility['redis-test'][0]).toMatchObject({ active: false, reason: 'disabled' });
    expect(r.report.status).toBe('complete');
  });

  const PROXY_ENV = {
    HTTP_PROXY: 'http://127.0.0.1:9/ng-marker-value', https_proxy: 'http://127.0.0.1:9/ng-marker-value', ALL_PROXY: 'socks5://127.0.0.1:9/ng-marker-value',
    no_proxy: 'ng-marker-value', npm_config_https_proxy: 'http://127.0.0.1:9/ng-marker-value', GLOBAL_AGENT_HTTP_PROXY: 'http://127.0.0.1:9/ng-marker-value',
  };
  const NAMES = Object.keys(PROXY_ENV).sort();
  const noMarker = (r) => {
    const texts = [r.stdout, r.stderr];
    if (fs.existsSync(r.base)) {
      const walk = (d) => fs.readdirSync(d).flatMap((n) => { const p = path.join(d, n); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
      for (const f of walk(r.base)) texts.push(fs.readFileSync(f, 'utf8'));
    }
    expect(texts.join('\n')).not.toMatch(/ng-marker-value/);
  };

  test.each([
    ['parallel workers, one of them reused for a second file', ['-w', '2']],
    ['runInBand (the parent process)', ['--runInBand']],
  ])('proxy settings: removed before the workers start (%s); never in a test file, a child process or the report', (_label, args) => {
    const r = nested('proxy', { files: ['p1.fixture.test.js', 'p2.fixture.test.js', 'p3.fixture.test.js'], args, env: PROXY_ENV });
    expect(r.status).toBe(0);
    expect(r.start.proxy.removed).toEqual(NAMES);
    expect(r.report.proxy).toEqual({ removedAtStart: NAMES, reachedFiles: 0 });
    for (const k of ['p1', 'p2', 'p3']) {
      expect(r.outputs[`${k}.fixture.test.js`]).toMatchObject({ sandbox: [], child: [] });
    }
    const pids = new Set(Object.values(r.outputs).map((o) => o.pid));
    if (args[0] === '-w') expect(pids.size).toBeLessThanOrEqual(2); // three files on at most two workers: a worker is reused
    else expect(pids.size).toBe(1);
    expect(r.report.status).toBe('complete');
    noMarker(r);
  });

  test('proxy settings in CI: the run is refused before any test runs, naming the variables (not their values), and no report is written', () => {
    const r = nested('proxy', { files: ['p1.fixture.test.js'], env: { ...PROXY_ENV, CI: 'true' } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Proxy settings are not allowed in CI test runs/);
    for (const n of NAMES) expect(r.stderr).toContain(n);
    expect(r.report).toBeNull();
    expect(r.outputs).toEqual({});
    noMarker(r);
  });

  test('tamper: a hook removed during a test is recorded, put back, and the run is incomplete', () => {
    const r = nested('tamper');
    const o = r.outputs['stage3a.fixture.test.js'];
    expect(o).toMatchObject({ removed: true, restored: true });
    expect(r.report.status).toBe('incomplete');
    expect(r.report.details.tampers).toEqual([expect.objectContaining({ hooks: ['dgram.Socket.prototype.send'], phase: 'after' })]);
  });
});
