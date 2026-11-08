'use strict';

/**
 * S-1 credential inventory (scripts/ops/credential-inventory.js).
 *
 * Every credential-like value in these tests is generated at runtime from
 * random bytes and lives only in a temporary directory that is removed after
 * the run. No fixture file is committed. Assertions report counts, never the
 * values, so a failure cannot print a synthetic secret either.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const net = require('net');
const http = require('http');
const https = require('https');
const dns = require('dns');

const TOOL = path.resolve(__dirname, '../../../scripts/ops/credential-inventory.js');
const inv = require(TOOL);

const rnd = (prefix) => prefix + crypto.randomBytes(24).toString('base64url');
const roots = [];

function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** Builds a synthetic host layout. Returns { root, app, home, S, secrets }. */
function buildFixture({ badDump = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'credinv-'));
  roots.push(root);
  const app = path.join(root, 'app');
  const home = path.join(root, 'home');
  const S = {
    aLive: rnd('sk-ant-api03-'), aOld: rnd('sk-ant-api03-'), oLive: rnd('sk-proj-'), oOld: rnd('sk-proj-'),
    jLive: rnd(''), jOld: rnd(''), dLive: rnd(''), dOld1: rnd(''), dOld2: rnd(''), dMig: rnd(''),
    kLive: rnd('AKIA'), kOld: rnd('AKIA'), sLive: rnd(''), sOld: rnd(''), sshKey: rnd(''), netrc: rnd(''),
  };
  put(path.join(app, '.env'), [
    `ANTHROPIC_API_KEY=${S.aLive}`, `OPENAI_API_KEY="${S.oLive}"`, `JWT_SECRET=${S.jLive}`,
    `export DB_PASSWORD='${S.dLive}'`, 'S3_PRIMARY_BUCKET=bucket-name-not-secret', 'PORT=3000', '',
  ].join('\n'));
  put(path.join(app, '.env.bak-same'), [
    `ANTHROPIC_API_KEY=${S.aLive}`, `OPENAI_API_KEY=${S.oLive}`, `JWT_SECRET=${S.jLive}`, `DB_PASSWORD=${S.dLive}`,
  ].join('\n'));
  put(path.join(app, '.env.bak-old'), [
    `ANTHROPIC_API_KEY=${S.aOld}`, `OPENAI_API_KEY=${S.oOld}`, `JWT_SECRET=${S.jOld}`, `DB_PASSWORD=${S.dOld1}`,
    `AWS_ACCESS_KEY_ID=${S.kOld}`, `AWS_SECRET_ACCESS_KEY=${S.sOld}`,
  ].join('\n'));
  put(path.join(app, '.env.bak-older'), [
    `ANTHROPIC_API_KEY=${S.aOld}`, `JWT_SECRET=${S.jOld}`, `DB_PASSWORD=${S.dOld2}`,
  ].join('\n'));
  put(path.join(app, '.env.example'), [
    'ANTHROPIC_API_KEY=your-key-here', 'OPENAI_API_KEY=sk-ant-xxxxx', 'JWT_SECRET=changeme',
    'DB_PASSWORD=${DB_PASSWORD}', 'AWS_ACCESS_KEY_ID=',
    'DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/db',
  ].join('\n'));
  fs.symlinkSync('.env', path.join(app, '.env.link'));
  put(path.join(home, '.aws', 'credentials'), [
    '[default]', `aws_access_key_id = ${S.kLive}`, `aws_secret_access_key = ${S.sLive}`,
    '[other]', `aws_access_key_id = ${S.kOld}`, `aws_secret_access_key = ${S.sOld}`, '',
  ].join('\n'));
  const dump = badDump
    ? `[{"name":"api","env":{"ANTHROPIC_API_KEY": ${S.aLive} }}]`
    : JSON.stringify([
      { name: 'api', env: { ANTHROPIC_API_KEY: S.aLive, JWT_SECRET: S.jLive, NODE_ENV: 'production' } },
      { name: 'worker', ANTHROPIC_API_KEY: S.aOld, AWS_ACCESS_KEY_ID: S.kOld, pm2_env: { env: { AWS_SECRET_ACCESS_KEY: S.sOld } } },
    ]);
  put(path.join(home, '.pm2', 'dump.pm2'), dump);
  put(path.join(home, '.episode-migrate.env'), ['DB_USER=migrator', `DB_PASSWORD=${S.dMig}`].join('\n'));
  put(path.join(home, '.ssh', 'id_ed25519'), S.sshKey);
  put(path.join(home, '.ssh', 'id_ed25519.pub'), 'ssh-ed25519 public-part-not-secret test');
  put(path.join(home, '.netrc'), `machine example.invalid login u password ${S.netrc}`);
  return { root, app, home, S, secrets: Object.values(S) };
}

/** Number of 6-character windows of any secret found in text. */
function leakCount(text, secrets) {
  let hits = 0;
  for (const s of secrets) {
    for (let i = 0; i + 6 <= s.length; i += 1) if (text.includes(s.slice(i, i + 6))) hits += 1;
    const forms = [
      crypto.createHash('sha256').update(s).digest('hex'),
      Buffer.from(s).toString('base64').slice(0, 12),
      Buffer.from(s).toString('hex').slice(0, 12),
    ];
    for (const f of forms) if (text.includes(f)) hits += 1;
  }
  return hits;
}

const probe = (u) => u === 'ubuntu';
const runInv = (fx, args = [], extra = {}) => inv.run(['--app-dir', fx.app, '--home', fx.home, ...args],
  { readersProbe: probe, isRoot: false, ...extra });
const find = (result, name) => result.sources.find((s) => s.name === name);

afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  expect(roots.filter((r) => fs.existsSync(r))).toEqual([]);
});

describe('S-1 credential inventory', () => {
  let fx;
  beforeAll(() => { fx = buildFixture(); });

  test('T1 lists credential-like names per source and ignores other variables', () => {
    const out = runInv(fx);
    expect(out.code).toBe(0);
    for (const name of ['.env ', '.env.bak-old', '.env.bak-older', '.env.bak-same', '.env.example', '.env.link',
      'dump.pm2 [api]', 'dump.pm2 [worker]', '~/.aws/credentials', '~/.episode-migrate.env']) {
      expect(out.stdout).toContain(name);
    }
    expect(out.stdout).toContain('ANTHROPIC_API_KEY=L');
    for (const ignored of ['S3_PRIMARY_BUCKET', 'PORT', 'NODE_ENV', 'DB_USER']) expect(out.stdout).not.toContain(ignored);
  });

  test('T2 equality labels: L, Hn, P; missing variables omitted; stable across runs', () => {
    const r = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    expect(find(r, '.env').labels).toEqual({ ANTHROPIC_API_KEY: 'L', OPENAI_API_KEY: 'L', JWT_SECRET: 'L', DB_PASSWORD: 'L' });
    expect(find(r, '.env.bak-same').labels).toEqual({ ANTHROPIC_API_KEY: 'L', OPENAI_API_KEY: 'L', JWT_SECRET: 'L', DB_PASSWORD: 'L' });
    expect(find(r, '.env.bak-old').labels).toMatchObject({ ANTHROPIC_API_KEY: 'H1', OPENAI_API_KEY: 'H1', JWT_SECRET: 'H1', DB_PASSWORD: 'H1' });
    expect(find(r, '.env.bak-older').labels).toEqual({ ANTHROPIC_API_KEY: 'H1', JWT_SECRET: 'H1', DB_PASSWORD: 'H2' });
    expect(find(r, '~/.episode-migrate.env').labels).toEqual({ DB_PASSWORD: 'H3' });
    const again = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    expect(again.sources.map((s) => [s.name, s.labels])).toEqual(r.sources.map((s) => [s.name, s.labels]));
  });

  test('T3 AWS credentials: profiles listed, default keys are live, other values labelled', () => {
    const r = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    const aws = find(r, '~/.aws/credentials');
    expect(aws.profiles).toEqual(['default', 'other']);
    expect(aws.labels).toEqual({
      AWS_ACCESS_KEY_ID: 'L', AWS_SECRET_ACCESS_KEY: 'L', 'AWS_ACCESS_KEY_ID[other]': 'H1', 'AWS_SECRET_ACCESS_KEY[other]': 'H1',
    });
    expect(find(r, '.env.bak-old').labels).toMatchObject({ AWS_ACCESS_KEY_ID: 'H1', AWS_SECRET_ACCESS_KEY: 'H1' });
  });

  test('T4 pm2 dump: labels per app; a malformed dump containing a secret is reported without it', () => {
    const r = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    expect(find(r, 'dump.pm2 [api]').labels).toEqual({ ANTHROPIC_API_KEY: 'L', JWT_SECRET: 'L' });
    expect(find(r, 'dump.pm2 [worker]').labels).toEqual({ ANTHROPIC_API_KEY: 'H1', AWS_ACCESS_KEY_ID: 'H1', AWS_SECRET_ACCESS_KEY: 'H1' });
    const bad = buildFixture({ badDump: true });
    const out = runInv(bad);
    expect(out.code).toBe(2);
    expect(out.stdout).toMatch(/dump\.pm2\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+unreadable \(SyntaxError\)/);
    expect(leakCount(out.stdout + out.stderr, bad.secrets)).toBe(0);
  });

  test('T5 no value, piece, hash or encoding of any secret appears in text, JSON or CLI output', () => {
    const text = runInv(fx);
    const json = runInv(fx, ['--json']);
    const cli = childProcess.spawnSync(process.execPath, [TOOL, '--app-dir', fx.app, '--home', fx.home, '--no-readers'],
      { encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(cli.status).toBe(0);
    for (const o of [text.stdout + text.stderr, json.stdout + json.stderr, cli.stdout + cli.stderr]) {
      expect(leakCount(o, fx.secrets)).toBe(0);
      expect(/\b[0-9a-f]{64}\b/i.test(o)).toBe(false);
    }
    expect(JSON.parse(json.stdout).version).toBe(1);
  });

  test('T6 a parser error carrying a secret is reported by name only', () => {
    const out = runInv(fx, [], {
      hooks: { beforeParse: (kind, file) => { if (file.endsWith('.env.bak-old')) throw new Error(fx.S.aLive); } },
    });
    expect(out.code).toBe(2);
    expect(out.stdout).toMatch(/\.env\.bak-old\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+unreadable \(Error\)/);
    expect(leakCount(out.stdout + out.stderr, fx.secrets)).toBe(0);
  });

  test('T7 the output guard withholds a report that contains a value', () => {
    const out = runInv(fx, [], { hooks: { beforeGuard: (t) => `${t}${fx.S.jLive}\n` } });
    expect(out.code).toBe(3);
    expect(out.stdout).toBe('');
    expect(out.stderr).toBe(`${inv.GUARD_MESSAGE}\n`);
  });

  test('T8 no writes, no network, no child processes beyond the allowed commands', () => {
    const tmp = path.join(fx.root, 'tmp');
    fs.mkdirSync(tmp);
    const savedTmp = process.env.TMPDIR;
    process.env.TMPDIR = tmp;
    const listing = (dir) => {
      const out = [];
      const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { out.push(path.join(d, e.name)); if (e.isDirectory() && !e.isSymbolicLink()) walk(path.join(d, e.name)); } };
      walk(dir);
      return out.sort();
    };
    // The shared os.tmpdir() changes under parallel test workers, so the private TMPDIR is compared
    // and the write spies below cover every temp-file API (mkdtemp, open for write, rename).
    const before = { fixture: listing(fx.root), cwd: fs.readdirSync(process.cwd()).sort(), tmp: listing(tmp) };
    const writes = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'writeSync', 'write', 'renameSync', 'rename',
      'unlinkSync', 'unlink', 'rmSync', 'rm', 'mkdirSync', 'mkdir', 'mkdtempSync', 'mkdtemp', 'copyFileSync', 'copyFile',
      'cpSync', 'createWriteStream', 'symlinkSync', 'chmodSync', 'chownSync', 'truncateSync', 'utimesSync'];
    const spies = [
      ...writes.map((m) => jest.spyOn(fs, m)),
      ...['connect', 'createConnection'].map((m) => jest.spyOn(net, m)),
      jest.spyOn(http, 'request'), jest.spyOn(http, 'get'), jest.spyOn(https, 'request'), jest.spyOn(https, 'get'),
      jest.spyOn(dns, 'lookup'),
      ...['spawnSync', 'spawn', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].map((m) => jest.spyOn(childProcess, m)),
    ];
    const reads = jest.spyOn(fs, 'readFileSync');
    const calls = [];
    try {
      runInv(fx);
      runInv(fx, ['--json']);
      // As root with readers: only the three allowed commands, through the injected runner.
      runInv(fx, [], { readersProbe: undefined, isRoot: true, spawnSync: (cmd, args) => { calls.push([cmd, ...args]); return { status: 0, stdout: '' }; } });
      expect(spies.reduce((n, s) => n + s.mock.calls.length, 0)).toBe(0);
      const notOpened = reads.mock.calls.filter(([p]) => /\.ssh|\.netrc|\.git-credentials|\.npmrc|\.docker/.test(String(p)));
      expect(notOpened.length).toBe(0);
      const allowed = calls.every((c) => (c[0] === 'sudo' && c[1] === '-n' && c[2] === '-u' && c[4] === 'test' && c[5] === '-r' && c.length === 7)
        || (c[0] === 'id' && c[1] === '-nG' && c.length === 3)
        || (c[0] === 'sudo' && c[1] === '-n' && c[2] === '-l' && c[3] === '-U' && c.length === 5));
      expect(calls.length).toBeGreaterThan(0);
      expect(allowed).toBe(true);
    } finally {
      spies.forEach((s) => s.mockRestore());
      reads.mockRestore();
      if (savedTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = savedTmp;
    }
    expect(listing(fx.root)).toEqual(before.fixture);
    expect(fs.readdirSync(process.cwd()).sort()).toEqual(before.cwd);
    expect(listing(tmp)).toEqual(before.tmp);
  });

  test('T9 an unreadable source is reported as EACCES with exit 2', () => {
    const target = path.join(fx.app, '.env.bak-same');
    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    let spy;
    if (asRoot) {
      const real = fs.readFileSync;
      spy = jest.spyOn(fs, 'readFileSync').mockImplementation((p, ...a) => {
        if (p === target) { const e = new Error('denied'); e.code = 'EACCES'; throw e; }
        return real.call(fs, p, ...a);
      });
    } else fs.chmodSync(target, 0o000);
    try {
      const out = runInv(fx);
      expect(out.code).toBe(2);
      expect(out.stdout).toMatch(/\.env\.bak-same\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+unreadable \(EACCES\)/);
    } finally {
      if (spy) spy.mockRestore(); else fs.chmodSync(target, 0o600);
    }
  });

  test('T10 readers: probe result, non-root without a probe, and --no-readers', () => {
    expect(runInv(fx).stdout).toContain('readers: root ubuntu');
    const nonRoot = runInv(fx, [], { readersProbe: undefined, isRoot: false });
    expect(nonRoot.stdout).toContain('others not checked (needs root)');
    expect(runInv(fx, ['--no-readers']).stdout).toContain('readers: not checked');
  });

  test('T11 placeholder shapes are P; a random value is not', () => {
    for (const v of ['${DB_PASSWORD}', 'sk-ant-xxxxx', 'your-key-here', 'changeme', '', 'xxxxxxxx', 'aaaaaaaaaaaa',
      'postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/db']) {
      expect(inv.isPlaceholder(v)).toBe(true);
    }
    expect(inv.isPlaceholder(rnd('sk-ant-api03-'))).toBe(false);
  });

  test('T12 a symlinked .env file is reported with its target and labelled', () => {
    const out = runInv(fx);
    expect(out.stdout).toMatch(/\.env\.link\s+.*symlink -> \.env/);
    const r = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    expect(find(r, '.env.link').labels).toEqual({ ANTHROPIC_API_KEY: 'L', OPENAI_API_KEY: 'L', JWT_SECRET: 'L', DB_PASSWORD: 'L' });
  });

  test('T13 a file over 1 MiB is reported as too large and not read', () => {
    const big = buildFixture();
    const file = path.join(big.app, '.env.big');
    fs.writeFileSync(file, `ANTHROPIC_API_KEY=${big.S.aOld}\n${'#'.repeat(2 * 1024 * 1024)}\n`);
    const reads = jest.spyOn(fs, 'readFileSync');
    try {
      const out = runInv(big);
      expect(out.code).toBe(2);
      expect(out.stdout).toMatch(/\.env\.big\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+too large/);
      expect(reads.mock.calls.filter(([p]) => p === file).length).toBe(0);
    } finally {
      reads.mockRestore();
    }
  });

  test('T14 the exported inventory() result holds no value, digest or Buffer', () => {
    const r = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    const text = JSON.stringify(r);
    expect(/\b[0-9a-f]{64}\b/i.test(text)).toBe(false);
    expect(leakCount(text, fx.secrets)).toBe(0);
    const bad = [];
    const walk = (v, k) => {
      if (Buffer.isBuffer(v) || ['value', 'digest', 'hmac', 'secret'].includes(k)) bad.push(k);
      if (v && typeof v === 'object') for (const [ck, cv] of Object.entries(v)) walk(cv, ck);
    };
    walk(r, '');
    expect(bad).toEqual([]);
  });

  test('T15 source hygiene: no console, environment, network modules or extra commands; no committed fixtures', () => {
    const src = fs.readFileSync(TOOL, 'utf8');
    expect(src.includes('console.')).toBe(false);
    expect(src.includes('process.env')).toBe(false);
    expect(/require\('(net|http|https|dns|tls|dgram)'\)/.test(src)).toBe(false);
    const commands = [...src.matchAll(/spawn\('([^']+)'/g)].map((m) => m[1]);
    expect([...new Set(commands)].sort()).toEqual(['id', 'sudo']);
    const tracked = childProcess.execFileSync('git', ['ls-files', 'tests'], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });
    expect(tracked.split('\n').filter((f) => /fixtures\/credential/i.test(f))).toEqual([]);
    const self = fs.readFileSync(__filename, 'utf8');
    const highEntropy = (self.match(/[A-Za-z0-9_-]{24,}/g) || []).filter((w) => /[a-z]/.test(w) && /[A-Z]/.test(w) && /[0-9]/.test(w));
    expect(highEntropy).toEqual([]);
  });
});
