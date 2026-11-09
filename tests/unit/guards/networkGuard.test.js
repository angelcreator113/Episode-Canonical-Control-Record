'use strict';

/**
 * Self-tests for the Jest network guard (tests/networkGuard/, Stage 1).
 *
 * No test here reaches a non-loopback destination from this Jest worker:
 * every probe of a destination the guard must stop runs in a child process
 * under an independent blocking tripwire (tests/networkGuard/probe/), which
 * is loaded before the guard and shares no code with it. Loopback and Unix
 * socket checks run here, against servers this file starts.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const net = require('net');
const http = require('http');
const dns = require('dns');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const GUARD_DIR = path.join(ROOT, 'tests/networkGuard');
const core = require('../../networkGuard/core');
const { buildReport, verifyReport, renderSummary, REQUIRED_HOOKS } = require('../../networkGuard/report');
const { prepare, isCI } = require('../../networkGuard/globalSetup');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ng-test-'));

describe('host classification', () => {
  test.each([
    ['localhost', true], ['LOCALHOST.', true], ['127.0.0.1', true], ['127.9.8.7', true], ['::1', true], ['[::1]', true],
    ['0:0:0:0:0:0:0:1', true], ['::ffff:127.0.0.1', true], ['::ffff:7f00:1', true], ['0:0:0:0:0:ffff:7f00:0001', true],
    ['0.0.0.0', false], ['::', false], ['0:0:0:0:0:0:0:0', false], ['203.0.113.10', false], ['::ffff:203.0.113.10', false],
    ['::ffff:cb00:710a', false], ['example.invalid', false], ['img.test', false], ['localhost.example.com', false],
    ['sub.localhost', false], ['128.0.0.1', false], ['::2', false], ['', false], [null, false],
  ])('%s is loopback: %s', (host, expected) => {
    expect(core.isLoopback(host)).toBe(expected);
  });

  test('normalization: case, trailing dot, brackets, zone id, IPv4-mapped (dotted and hex)', () => {
    expect(core.normalizeHost(' Example.INVALID. ')).toBe('example.invalid');
    expect(core.normalizeHost('[fe80::1%eth0]')).toBe('fe80:0:0:0:0:0:0:1');
    expect(core.normalizeHost('::ffff:203.0.113.10')).toBe('203.0.113.10');
    expect(core.normalizeHost('::FFFF:CB00:710A')).toBe('203.0.113.10');
  });

  test('connect call shapes: options object, normalized [options, cb], (port, host), (path), port only', () => {
    expect(core.connectTarget([{ host: 'a.example', port: 1 }])).toEqual({ host: 'a.example', port: 1 });
    expect(core.connectTarget([[{ host: 'b.example', port: 2 }, () => {}]])).toEqual({ host: 'b.example', port: 2 });
    expect(core.connectTarget([443, 'c.example'])).toEqual({ host: 'c.example', port: 443 });
    expect(core.connectTarget(['/tmp/x.sock'])).toEqual({ path: '/tmp/x.sock' });
    expect(core.connectTarget([{ path: '/tmp/y.sock' }])).toEqual({ path: '/tmp/y.sock' });
    expect(core.connectTarget([5432])).toEqual({ host: 'localhost', port: 5432 });
    expect(core.connectTarget([{ port: 5432 }])).toEqual({ host: 'localhost', port: 5432 });
  });

  test('request and fetch targets', () => {
    expect(core.requestTarget(['https://img.test/a.png'], 443)).toMatchObject({ host: 'img.test' });
    expect(core.requestTarget([new URL('http://[::1]:8080/')], 80)).toMatchObject({ host: '::1' });
    expect(core.requestTarget([{ hostname: 'x.example', port: 9 }], 80)).toMatchObject({ host: 'x.example', port: 9 });
    expect(core.requestTarget([{ host: 'y.example:8443' }], 443)).toMatchObject({ host: 'y.example' });
    expect(core.requestTarget([{ socketPath: '/var/run/x.sock' }], 80)).toEqual({ path: '/var/run/x.sock' });
    expect(core.fetchTarget('data:text/plain,hi')).toEqual({ local: true });
    expect(core.fetchTarget('https://example.invalid/')).toMatchObject({ host: 'example.invalid' });
  });

  test('environment hosts are not trusted: a non-loopback database host is reported unless reviewed', () => {
    expect(core.classify({ host: 'db.internal.example', port: 5432 }).allowed).toBe(false);
    expect(core.classify({ host: 'db.internal.example' }, new Set(['db.internal.example'])).allowed).toBe(true);
    expect(core.classify({ host: '0.0.0.0', port: 80 }).allowed).toBe(false);
    expect(core.classify({ path: '/tmp/pg/.s.PGSQL.5432' }).allowed).toBe(true);
  });
});

describe('reviewed allowlist', () => {
  test('ships empty and valid', () => {
    const data = JSON.parse(fs.readFileSync(path.join(GUARD_DIR, 'allowlist.json'), 'utf8'));
    expect(data.hosts).toEqual([]);
    expect(core.loadAllowlist().size).toBe(0);
  });

  test('refuses paid providers, wildcards, unspecified addresses and malformed entries', () => {
    const write = (hosts) => { const f = path.join(tmpDir(), 'a.json'); fs.writeFileSync(f, JSON.stringify({ hosts })); return f; };
    const entry = (host) => ({ host, reason: 'r', files: ['f'] });
    for (const h of ['api.anthropic.com', 'ANTHROPIC.COM.', 'queue.fal.run', 'fal.ai', 'v3.fal.media', 'api.openai.com', 'api.replicate.com', 'api.elevenlabs.io']) {
      expect(() => core.loadAllowlist(write([entry(h)]))).toThrow(/paid provider/);
    }
    expect(() => core.loadAllowlist(write([entry('*.example.com')]))).toThrow(/exact host/);
    expect(() => core.loadAllowlist(write([entry('0.0.0.0')]))).toThrow(/exact host/);
    expect(() => core.loadAllowlist(write([{ host: 'x.example' }]))).toThrow(/needs \{ host, reason, files \}/);
    expect(core.loadAllowlist(write([entry('Internal.Example.')])).has('internal.example')).toBe(true);
  });
});

describe('report integrity: missing data is never "zero attempts"', () => {
  const START = { runId: 'r1', startedAt: 't0', mode: 'report' };
  const HOOKS = Object.fromEntries(REQUIRED_HOOKS.map((k) => [k, true]));
  const hb = (f, extra = {}) => ({ type: 'heartbeat', testPath: f, mode: 'report', hooks: HOOKS, reinstalled: [], ...extra });
  const end = (f, events = 0, extra = {}) => ({ type: 'file-end', testPath: f, events, ...extra });
  const attempt = (f, host) => ({ type: 'attempt', testPath: f, host, transport: 'https', frames: ['src/x.js:1:1'] });
  const base = { start: START, envRunId: 'r1', runDirExists: true, executedFiles: ['a.test.js', 'b.test.js'] };

  test('complete: every file instrumented, counts match; attempts are listed, not failed (report-only)', () => {
    const report = buildReport({ ...base, lines: [hb('a.test.js'), end('a.test.js', 1), attempt('a.test.js', 'img.test'), hb('b.test.js'), end('b.test.js')] });
    expect(report).toMatchObject({ status: 'complete', finalized: true, executedFiles: 2, instrumentedFiles: 2, attempts: { total: 1 } });
    expect(report.attempts.hosts[0]).toMatchObject({ host: 'img.test', count: 1, files: ['a.test.js'] });
    expect(verifyReport({ start: START, report })).toEqual({ ok: true, problems: [] });
    expect(renderSummary(report)).toMatch(/img\.test/);
  });

  test.each([
    ['a file with no heartbeat', { lines: [hb('a.test.js'), end('a.test.js')] }, /no heartbeat/],
    ['a file with no file-end', { lines: [hb('a.test.js'), end('a.test.js'), hb('b.test.js')] }, /no file-end/],
    ['a hook missing', { lines: [hb('a.test.js', { hooks: { ...HOOKS, 'dns.lookup': false } }), end('a.test.js'), hb('b.test.js'), end('b.test.js')] }, /hook missing/],
    ['lost attempt records', { lines: [hb('a.test.js'), end('a.test.js', 2), attempt('a.test.js', 'x.example'), hb('b.test.js'), end('b.test.js')] }, /lost attempt records/],
    ['a sink write error', { lines: [hb('a.test.js'), end('a.test.js', 0, { sinkErrors: 1 }), hb('b.test.js'), end('b.test.js')] }, /lost attempt records/],
    ['a hook removed and put back', { lines: [hb('a.test.js', { reinstalled: ['dns.lookup'] }), end('a.test.js'), hb('b.test.js'), end('b.test.js')] }, /removed/],
    ['fetch not hooked in a file', { lines: [hb('a.test.js', { hooks: { ...HOOKS, fetch: false } }), end('a.test.js'), hb('b.test.js'), end('b.test.js')] }, /hook missing/],
    ['no event directory', { runDirExists: false, lines: [] }, /event directory missing/],
    ['unreadable lines', { malformedLines: 1, lines: [hb('a.test.js'), end('a.test.js'), hb('b.test.js'), end('b.test.js')] }, /unreadable/],
    ['a mismatched run id', { envRunId: 'r2', lines: [hb('a.test.js'), end('a.test.js'), hb('b.test.js'), end('b.test.js')] }, /run id mismatch/],
    ['no start marker', { start: null, lines: [hb('a.test.js'), end('a.test.js'), hb('b.test.js'), end('b.test.js')] }, /start marker missing/],
  ])('incomplete with %s, and verification fails', (_label, over, issue) => {
    const report = buildReport({ ...base, ...over });
    expect(report.status).toBe('incomplete');
    expect(report.issues.join(' ')).toMatch(issue);
    const verdict = verifyReport({ start: over.start === null ? START : START, report });
    expect(verdict.ok).toBe(false);
    expect(renderSummary(report, verdict)).toMatch(/count not trustworthy/);
  });

  test('a file where Jest skipped every test needs no file-end, but only when the reporter lists it', () => {
    const lines = [hb('a.test.js'), end('a.test.js'), hb('b.test.js'), attempt('b.test.js', 'load.example')];
    const report = buildReport({ ...base, lines, allSkippedFiles: ['b.test.js'] });
    expect(report.status).toBe('complete');
    expect(report.details.allSkipped).toEqual(['b.test.js']);
    expect(report.details.missingFileEnds).toEqual([]);
    expect(report.attempts.total).toBe(1);
    expect(renderSummary(report)).toMatch(/every test was skipped.*b\.test\.js/);
    // Not listed as all-skipped: still incomplete.
    expect(buildReport({ ...base, lines, allSkippedFiles: ['a.test.js'] }).status).toBe('incomplete');
    // Listed, but no heartbeat or a hook missing: still incomplete.
    expect(buildReport({ ...base, lines: [hb('a.test.js'), end('a.test.js')], allSkippedFiles: ['b.test.js'] }).issues.join()).toMatch(/no heartbeat/);
    expect(buildReport({ ...base, lines: [hb('a.test.js'), end('a.test.js'), hb('b.test.js', { hooks: { ...HOOKS, 'http.get': false } })], allSkippedFiles: ['b.test.js'] }).issues.join()).toMatch(/hook missing/);
  });

  test('the reporter exempts only clean all-skipped files (not a file that failed to load or failed a test)', () => {
    const Reporter = require('../../networkGuard/reporter');
    const root = tmpDir();
    const base2 = path.join(root, 'tmp', 'network-guard');
    const runDir = path.join(base2, 'run-x');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(base2, 'start.json'), JSON.stringify({ runId: 'x', startedAt: 't0', mode: 'report' }));
    const files = ['skipped.test.js', 'broken.test.js', 'failed.test.js'];
    fs.writeFileSync(path.join(runDir, 'events-1.jsonl'), `${files.map((f) => JSON.stringify(hb(f))).join('\n')}\n`);
    const result = (f, over) => ({ testFilePath: path.join(root, f), skipped: true, testExecError: undefined, numFailingTests: 0, numPassingTests: 0, ...over });
    const results = { testResults: [
      result('skipped.test.js'),
      result('broken.test.js', { testExecError: { message: 'load fail' } }),
      result('failed.test.js', { numFailingTests: 1 }),
    ] };
    const saved = { dir: process.env.NETWORK_GUARD_RUN_DIR, id: process.env.NETWORK_GUARD_RUN_ID };
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      process.env.NETWORK_GUARD_RUN_DIR = runDir;
      process.env.NETWORK_GUARD_RUN_ID = 'x';
      new Reporter({ rootDir: root }).onRunComplete(null, results);
    } finally {
      spy.mockRestore();
      for (const [k, v] of [['NETWORK_GUARD_RUN_DIR', saved.dir], ['NETWORK_GUARD_RUN_ID', saved.id]]) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
    const report = JSON.parse(fs.readFileSync(path.join(base2, 'report.json'), 'utf8'));
    expect(report.details.allSkipped).toEqual(['skipped.test.js']);
    expect(report.details.missingFileEnds).toEqual(['broken.test.js', 'failed.test.js']);
    expect(report.status).toBe('incomplete');
  });

  test('late attempts after a file ended are listed, not treated as lost', () => {
    const report = buildReport({ ...base, lines: [hb('a.test.js'), end('a.test.js', 0), attempt('a.test.js', 'late.example'), hb('b.test.js'), end('b.test.js')] });
    expect(report.status).toBe('complete');
    expect(report.details.lateAttempts).toEqual([{ file: 'a.test.js', afterFileEnd: 1 }]);
  });

  test('verification fails on a missing report, a missing start marker, a stale or unfinalized report', () => {
    const good = buildReport({ ...base, lines: [hb('a.test.js'), end('a.test.js'), hb('b.test.js'), end('b.test.js')] });
    expect(verifyReport({ start: START, report: null }).problems[0]).toMatch(/report missing/);
    expect(verifyReport({ start: null, report: good }).problems.join()).toMatch(/start marker missing/);
    expect(verifyReport({ start: { ...START, runId: 'older' }, report: good }).problems.join()).toMatch(/stale/);
    expect(verifyReport({ start: START, report: { ...good, finalized: false } }).problems.join()).toMatch(/not finalized/);
    expect(renderSummary(null)).toMatch(/No report/);
  });

  test('a disabled guard is reported as disabled (never zero), and fails verification in CI', () => {
    const offStart = { ...START, mode: 'off' };
    const report = buildReport({ ...base, start: offStart, lines: [hb('a.test.js', { mode: 'off' }), end('a.test.js'), hb('b.test.js', { mode: 'off' }), end('b.test.js')] });
    expect(report.status).toBe('disabled');
    expect(verifyReport({ start: offStart, report, env: {} }).ok).toBe(true);
    expect(verifyReport({ start: offStart, report, env: { CI: 'true' } }).ok).toBe(false);
    expect(verifyReport({ start: offStart, report, env: { GITHUB_ACTIONS: 'true' } }).ok).toBe(false);
  });

  test('the CLI exits 1 with no report and writes the step summary', () => {
    const { main } = require('../../networkGuard/verify');
    const root = tmpDir();
    const summary = path.join(root, 'summary.md');
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(main(root, { GITHUB_STEP_SUMMARY: summary })).toBe(1);
    } finally {
      spy.mockRestore();
    }
    expect(fs.readFileSync(summary, 'utf8')).toMatch(/No report/);
  });
});

describe('globalSetup', () => {
  test('refuses NETWORK_GUARD=off in CI, after clearing the previous run so no stale report survives', () => {
    const root = tmpDir();
    const base = path.join(root, 'tmp', 'network-guard');
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(path.join(base, 'report.json'), '{}');
    fs.writeFileSync(path.join(base, 'start.json'), '{}');
    expect(() => prepare({ rootDir: root, env: { NETWORK_GUARD: 'off', CI: 'true' } })).toThrow(/not allowed in CI/);
    expect(fs.existsSync(path.join(base, 'report.json'))).toBe(false);
    expect(fs.existsSync(path.join(base, 'start.json'))).toBe(false);
    expect(() => prepare({ rootDir: tmpDir(), env: { NETWORK_GUARD: 'OFF', GITHUB_ACTIONS: 'true' } })).toThrow(/not allowed in CI/);
    expect(isCI({ CI: 'false' })).toBe(false);
  });

  test('clears the previous report, creates the run directory and start marker, and exports them to workers', () => {
    const root = tmpDir();
    const base = path.join(root, 'tmp', 'network-guard');
    fs.mkdirSync(path.join(base, 'run-old'), { recursive: true });
    fs.writeFileSync(path.join(base, 'report.json'), '{"stale":true}');
    const env = {};
    const r = prepare({ rootDir: root, env });
    expect(fs.existsSync(path.join(base, 'report.json'))).toBe(false);
    expect(fs.existsSync(path.join(base, 'run-old'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(base, 'start.json'), 'utf8'))).toMatchObject({ runId: r.runId, mode: 'report' });
    expect(env).toMatchObject({ NETWORK_GUARD_RUN_DIR: r.runDir, NETWORK_GUARD_RUN_ID: r.runId, NETWORK_GUARD_ROOT: root });
    expect(prepare({ rootDir: tmpDir(), env: { NETWORK_GUARD: 'enforce' } }).mode).toBe('report'); // Stage 1: report-only
  });
});

describe('the guard installed in this Jest worker', () => {
  test('every hook is in place, including fetch, and survives jest.restoreAllMocks()', () => {
    const before = core.hookStatus();
    for (const k of [...REQUIRED_HOOKS, 'fetch']) expect({ k, on: before[k] }).toEqual({ k, on: true });
    jest.spyOn(http, 'request');
    jest.restoreAllMocks();
    expect(core.hookStatus()).toEqual(before);
  });

  test('runs in report mode (Stage 1)', () => {
    expect(core.getState().mode).toBe('report');
  });

  test('a heartbeat for this file was written to the run directory', () => {
    const runDir = process.env.NETWORK_GUARD_RUN_DIR;
    expect(runDir).toBeTruthy();
    const lines = fs.readdirSync(runDir).filter((f) => f.endsWith('.jsonl'))
      .flatMap((f) => fs.readFileSync(path.join(runDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    const mine = lines.filter((l) => l.type === 'heartbeat' && l.testPath === 'tests/unit/guards/networkGuard.test.js');
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0].hooks).toEqual(expect.objectContaining(Object.fromEntries(REQUIRED_HOOKS.map((k) => [k, true]))));
  });

  test('wrapped functions keep their own properties (util.promisify(dns.lookup) still returns { address, family })', async () => {
    const r = await util.promisify(dns.lookup)('localhost');
    expect(r).toEqual(expect.objectContaining({ address: expect.any(String), family: expect.any(Number) }));
  });

  test('loopback and Unix sockets work through it and are not recorded: http, fetch, supertest', async () => {
    const before = core.getState().events.length;
    const server = http.createServer((q, s) => s.end('ok'));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
      const body = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/`, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve(d)); }).on('error', reject);
      });
      expect(body).toBe('ok');
      expect(await (await fetch(`http://localhost:${port}/`).catch(() => fetch(`http://127.0.0.1:${port}/`))).text()).toBe('ok');
      const express = require('express');
      const request = require('supertest');
      const app = express();
      app.get('/ping', (q, s) => s.json({ ok: true }));
      expect((await request(app).get('/ping')).body).toEqual({ ok: true });
    } finally {
      server.close();
    }
    const sock = path.join(tmpDir(), 's.sock');
    const unix = net.createServer((c) => c.end('u'));
    await new Promise((r) => unix.listen(sock, r));
    try {
      const got = await new Promise((resolve, reject) => {
        const c = net.connect({ path: sock }); let d = ''; c.on('data', (x) => { d += x; }); c.on('end', () => resolve(d)); c.on('error', reject);
      });
      expect(got).toBe('u');
    } finally {
      unix.close();
    }
    expect(core.getState().events.length).toBe(before);
  });
});

describe('blocked destinations, under an independent blocking tripwire (child process)', () => {
  const run = (mode) => JSON.parse(execFileSync(process.execPath, ['-r', path.join(GUARD_DIR, 'probe/tripwire.js'), path.join(GUARD_DIR, 'probe/probe.js'), mode], {
    cwd: GUARD_DIR, env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: 'utf8', timeout: 60000,
  }).trim().split('\n').pop());
  const BLOCKED_COUNT = 16;

  test('control (tripwire alone): the tripwire catches every blocked probe', () => {
    const r = run('none');
    expect(Object.keys(r.blocked)).toHaveLength(BLOCKED_COUNT);
    expect(r.tripwireAfterBlocked).toBe(BLOCKED_COUNT);
    for (const [k, v] of Object.entries(r.blocked)) expect({ k, code: v.code }).toEqual({ k, code: 'ERR_TRIPWIRE_BLOCKED' });
  });

  test('enforce: the guard blocks every probe first; nothing reaches the tripwire', () => {
    const r = run('enforce');
    expect(r.tripwireAfterBlocked).toBe(0);
    for (const [k, v] of Object.entries(r.blocked)) expect({ k, code: v.code }).toEqual({ k, code: 'ERR_TEST_NETWORK_BLOCKED' });
    const hosts = new Set(r.guardEvents.map((e) => e.host));
    for (const h of ['example.invalid', '203.0.113.10', '0.0.0.0', '0:0:0:0:0:0:0:0']) expect(hosts.has(h)).toBe(true);
    expect(r.guardEvents.every((e) => e.action === 'blocked')).toBe(true);
    const transports = new Set(r.guardEvents.map((e) => e.transport));
    for (const t of ['socket', 'http', 'https', 'fetch', 'dns.lookup', 'dns.promises.lookup', 'dns.resolve4', 'dns.promises.resolve4', 'dns.reverse']) expect({ t, seen: transports.has(t) }).toEqual({ t, seen: true });
  });

  test('report (Stage 1): the guard records every probe and lets it through; the tripwire stops it', () => {
    const r = run('report');
    expect(r.tripwireAfterBlocked).toBe(BLOCKED_COUNT);
    for (const [k, v] of Object.entries(r.blocked)) expect({ k, code: v.code }).toEqual({ k, code: 'ERR_TRIPWIRE_BLOCKED' });
    expect(r.guardEvents.every((e) => e.action === 'reported')).toBe(true);
    const recorded = new Set(r.guardEvents.map((e) => e.host));
    for (const h of ['example.invalid', '203.0.113.10', '0.0.0.0', '0:0:0:0:0:0:0:0']) expect(recorded.has(h)).toBe(true);
  });

  test.each(['none', 'enforce', 'report'])('%s: loopback, localhost and Unix sockets are allowed and not recorded', (mode) => {
    const r = run(mode);
    expect(r.allowed['http.get 127.0.0.1']).toMatchObject({ outcome: 'response', status: 200 });
    expect(r.allowed['fetch 127.0.0.1']).toMatchObject({ outcome: 'response', status: 200 });
    expect(r.allowed['dns.lookup localhost'].outcome).toBe('resolved');
    expect(r.allowed['net.connect unix socket'].outcome).toBe('connected');
    expect(r.tripwire.length).toBe(mode === 'enforce' ? 0 : BLOCKED_COUNT); // nothing more after the blocked probes
    expect(r.guardEvents.some((e) => core.isLoopback(e.host))).toBe(false);
  });
});

describe('the guard cannot be bypassed silently', () => {
  const config = require('../../../jest.config');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/validate.yml'), 'utf8');

  test('jest.config wires every part: setupFiles, setupFilesAfterEnv (first), globalSetup, reporter', () => {
    expect(config.setupFiles).toContain('<rootDir>/tests/networkGuard/setup.js');
    expect(config.setupFilesAfterEnv[0]).toBe('<rootDir>/tests/networkGuard/afterEnv.js');
    expect(config.setupFilesAfterEnv).toContain('<rootDir>/tests/setup.js');
    expect(config.globalSetup).toBe('<rootDir>/tests/networkGuard/globalSetup.js');
    expect(config.reporters).toEqual(expect.arrayContaining(['default', '<rootDir>/tests/networkGuard/reporter.js']));
  });

  test('no test script overrides the config, the setup files, the reporters or the guard mode', () => {
    for (const [name, cmd] of Object.entries(pkg.scripts).filter(([n, c]) => /\bjest\b/.test(c))) {
      expect({ name, cmd }).toEqual({ name, cmd: expect.not.stringMatching(/--config|--setupFiles|--setupFilesAfterEnv|--globalSetup|--reporters|--projects|NETWORK_GUARD\s*=\s*off/i) });
    }
  });

  test('CI runs the tests, then verifies the report and uploads it even when tests fail', () => {
    const tests = workflow.slice(workflow.indexOf('\n  tests:'), workflow.indexOf('\n  frontend-tests:'));
    expect(tests).toMatch(/run: npm test/);
    expect(tests).toMatch(/NETWORK_GUARD: report/);
    expect(tests).not.toMatch(/NETWORK_GUARD:\s*off/i);
    expect(tests).toMatch(/- name: Check the network guard report\n\s+if: always\(\)\n\s+run: node tests\/networkGuard\/verify\.js/);
    expect(tests).toMatch(/uses: actions\/upload-artifact@v4[\s\S]*path: tmp\/network-guard\/[\s\S]*if-no-files-found: error/);
    expect(workflow).not.toMatch(/NETWORK_GUARD:\s*off/i);
  });
});
