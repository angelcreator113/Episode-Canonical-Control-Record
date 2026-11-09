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

// Synthetic secret-like values. About 1 in 1,000 random strings contains "xxx", "here" or "your"
// and would be labelled P by the tool's shape heuristic, making label assertions intermittent, so
// those are redrawn: fixtures must look like real values.
const rnd = (prefix) => {
  for (;;) {
    const v = prefix + crypto.randomBytes(24).toString('base64url');
    if (!inv.isPlaceholder(v)) return v;
  }
};
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

  test('T12 a symlinked .env file is reported by where it resolves, and labelled', () => {
    const out = runInv(fx);
    expect(out.stdout).toMatch(/\.env\.link\s+.*symlink -> \.\/\.env /);
    const r = inv.inventory({ appDir: fx.app, home: fx.home, readersProbe: probe, isRoot: false });
    const link = find(r, '.env.link');
    expect(link.link).toEqual({ where: 'app-dir', path: '.env' });
    expect('symlink' in link).toBe(false);
    expect(link.labels).toEqual({ ANTHROPIC_API_KEY: 'L', OPENAI_API_KEY: 'L', JWT_SECRET: 'L', DB_PASSWORD: 'L' });
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
    // JSON sources carry relative labels only, never an absolute file path.
    expect(r.sources.filter((s) => 'file' in s || path.isAbsolute(s.name)).length).toBe(0);
  });

  test('T15 source hygiene: no console, environment, network modules or extra commands; no committed fixtures', () => {
    const src = fs.readFileSync(TOOL, 'utf8');
    expect(src.includes('console.')).toBe(false);
    expect(src.includes('process.env')).toBe(false);
    expect(/require\('(net|http|https|dns|tls|dgram)'\)/.test(src)).toBe(false);
    // The guard scans the exact text: no exemption list, no scrubbing of the scan copy.
    expect(/FIXED_TEXT|safe\.add|new Set\(\[appDir|\.split\(s\)\.join/.test(src)).toBe(false);
    const commands = [...src.matchAll(/spawn\('([^']+)'/g)].map((m) => m[1]);
    expect([...new Set(commands)].sort()).toEqual(['id', 'sudo']);
    const tracked = childProcess.execFileSync('git', ['ls-files', 'tests'], { encoding: 'utf8', cwd: path.resolve(__dirname, '../../..') });
    expect(tracked.split('\n').filter((f) => /fixtures\/credential/i.test(f))).toEqual([]);
    const self = fs.readFileSync(__filename, 'utf8');
    const highEntropy = (self.match(/[A-Za-z0-9_-]{24,}/g) || []).filter((w) => /[a-z]/.test(w) && /[A-Z]/.test(w) && /[0-9]/.test(w));
    expect(highEntropy).toEqual([]);
  });
});

describe('S-1 output guard: fail closed, no exemptions', () => {
  const hex = (n) => crypto.randomBytes(n).toString('hex');
  const alnum = () => crypto.randomBytes(24).toString('base64url').replace(/[-_]/g, '');

  /** A minimal synthetic layout: one app directory and one home directory. */
  function mini({ dirName = 'app', env = '', files = {}, homeFiles = {} } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'credinv-'));
    roots.push(root);
    const app = path.join(root, dirName);
    const home = path.join(root, 'home');
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(home, { recursive: true });
    put(path.join(app, '.env'), env);
    for (const [rel, text] of Object.entries(files)) put(path.join(app, rel), text);
    for (const [rel, text] of Object.entries(homeFiles)) put(path.join(home, rel), text);
    return { root, app, home };
  }
  const runMini = (m, args = [], extra = {}) => inv.run(['--app-dir', m.app, '--home', m.home, '--no-readers', ...args],
    { isRoot: false, ...extra });
  const withheld = (out) => out.code === 3 && out.stdout === '' && out.stderr === `${inv.GUARD_MESSAGE}\n`;

  test.each([
    ['a path component', () => { const d = `zpath-${hex(4)}`; return mini({ dirName: d, env: `DB_PASSWORD=${d}\n` }); }],
    ['a file name', () => mini({ env: 'DB_PASSWORD=.env.bak\n', files: { '.env.bak': 'PORT=1\n' } })],
    ['a variable name', () => mini({ env: `ANTHROPIC_API_KEY=${rnd('')}\nDB_PASSWORD=ANTHROPIC_API_KEY\n` })],
    ['fixed report wording', () => mini({ env: 'DB_PASSWORD=readers\n' })],
    ['a pm2 app name', () => mini({ homeFiles: { '.pm2/dump.pm2': JSON.stringify([{ name: 'svc-alpha-01', ANTHROPIC_API_KEY: 'svc-alpha-01' }]) } })],
  ])('T16 a value exactly matching %s is withheld (text and JSON)', (_, make) => {
    const m = make();
    expect(withheld(runMini(m))).toBe(true);
    expect(withheld(runMini(m, ['--json']))).toBe(true);
  });

  test('T17 a shared 6-character piece is withheld at start, middle and end; 5 characters is not', () => {
    // "holder" is printed in the legend ("placeholder/empty"); hex never contains "h" or "/".
    for (const v of [`holder${hex(10)}`, `${hex(10)}holder${hex(10)}`, `${hex(10)}holder`]) {
      expect(withheld(runMini(mini({ env: `DB_PASSWORD=${v}\n` })))).toBe(true);
    }
    const five = runMini(mini({ env: `DB_PASSWORD=${hex(10)}older${hex(10)}\n` }));
    expect(five.code).toBe(0);
  });

  test('T18 short values: standalone tokens are withheld, embedded ones are a documented miss', () => {
    // 1 character: the printed label "=L".
    expect(withheld(runMini(mini({ env: `ANTHROPIC_API_KEY=${rnd('')}\nDB_PASSWORD=L\n` })))).toBe(true);
    // 3 characters: a path segment "/q7z ".
    expect(withheld(runMini(mini({ dirName: 'q7z', env: 'DB_PASSWORD=q7z\n' })))).toBe(true);
    // Embedded only ("readers", "sources"): not detected, by design.
    expect(runMini(mini({ env: 'DB_PASSWORD=ers\n' })).code).toBe(0);
    // 5 characters, never printed.
    expect(runMini(mini({ env: 'DB_PASSWORD=a1b2c\n' })).code).toBe(0);
    // Punctuation inside the value, and a punctuation edge (fails closed on that side).
    expect(withheld(runMini(mini({ dirName: 'q-7', env: 'DB_PASSWORD=q-7\n' })))).toBe(true);
    expect(withheld(runMini(mini({ dirName: 'x-ab', env: 'DB_PASSWORD=-ab\n' })))).toBe(true);
    // Punctuation-only values match anywhere.
    expect(withheld(runMini(mini({ env: 'DB_PASSWORD===\n' })))).toBe(true);
    expect(withheld(runMini(mini({ env: 'DB_PASSWORD=:\n' })))).toBe(true);
    // Unicode boundaries, directly against the guard.
    const L = (t, v) => inv.leaks(t, new Set([v]));
    expect(L('dir=\u00ab\u00e91\u00bb end', '\u00e91')).toBe(true); // guillemets are punctuation
    expect(L('dir=\u0436\u00e91 end', '\u00e91')).toBe(false); // a letter before (Cyrillic, no decomposition): embedded
    expect(L('dir=\u00f1\u00e91 end', '\u00e91')).toBe(true); // an accented letter decomposes to a mark under NFD: fails closed
    expect(L('x \u00e91\u0663 y', '\u00e91')).toBe(false); // an Arabic-Indic digit after: embedded
    expect(L('ab\u0301 x', 'ab')).toBe(true); // a combining mark beside the match fails closed
    expect(L('path/caf\u00e9 x', 'cafe\u0301')).toBe(true); // NFD value, NFC text
    expect(L('x \u{1D49C}b y', '\u{1D49C}b')).toBe(true); // astral letter, standalone
    expect(L('x a\u{1D49C}b y', '\u{1D49C}b')).toBe(false); // astral letter, embedded
    // End to end: a decomposed value against a composed directory name.
    expect(withheld(runMini(mini({ dirName: '\u00e91', env: 'DB_PASSWORD=e\u03011\n' })))).toBe(true);
  });

  test('T19 malformed input: no crash, correct status, no leak', () => {
    const v = {
      a: rnd(''), j: rnd(''), d: rnd(''), o: rnd(''), r: rnd(''), k0: rnd('AKIA'), k1: rnd('AKIA'), k2: rnd(''),
      k3: rnd('AKIA'), n: alnum(), a2: rnd(''), big: crypto.randomBytes(75000).toString('base64url'),
    };
    const env = Buffer.concat([
      Buffer.from(`ANTHROPIC_API_KEY=${v.a}\u0000\u0001bin\r\nJWT_SECRET=${v.j}\r\nDB_PASSWORD="${v.d}\n`),
      Buffer.from(`OPENAI_API_KEY=first-value-1\nOPENAI_API_KEY=${v.o}\nthis line has no equals\nFAL_KEY=${v.big}\n`),
      Buffer.from([0xff, 0xfe, 0x0a]), Buffer.from(`REPLICATE_API_TOKEN=${v.r}\n`),
    ]);
    const nested = JSON.parse(`${'['.repeat(2000)}${']'.repeat(2000)}`);
    const m = mini({
      homeFiles: {
        '.aws/credentials': `aws_access_key_id = ${v.k0}\n[prof ile!@#]\naws_access_key_id = ${v.k1}\n[${'p'.repeat(80)}]\n`
          + `aws_secret_access_key = ${v.k2}\n[default]\naws_access_key_id = ${v.k3}\n`,
        '.pm2/dump.pm2': JSON.stringify({ name: 'x', ANTHROPIC_API_KEY: v.a }),
        '.pm2/dump.pm2.bak': JSON.stringify([{ name: v.n, ANTHROPIC_API_KEY: v.a2 }, nested]),
      },
    });
    fs.writeFileSync(path.join(m.app, '.env'), env);
    const text = runMini(m);
    const json = runMini(m, ['--json']);
    expect(text.code).toBe(2);
    expect(text.stdout).toMatch(/dump\.pm2\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+unreadable \(TypeError\)/);
    expect(text.stdout).toContain('dump.pm2.bak [app1]');
    expect(text.stdout).toContain('profiles: profile1 default');
    const secrets = Object.entries(v).map(([k, x]) => (k === 'big' ? x.slice(0, 3000) : x));
    expect(leakCount(text.stdout + text.stderr, secrets)).toBe(0);
    expect(leakCount(json.stdout + json.stderr, secrets)).toBe(0);
    expect(json.code).toBe(2);
  });

  test('T20 template references are cut out; their literal pieces stay guarded', () => {
    expect(runMini(mini({ env: `ANTHROPIC_API_KEY=${rnd('')}\nDB_PASSWORD=\${DB_PASSWORD}\n` })).code).toBe(0);
    const lit = rnd('');
    const m = mini({ env: `JWT_SECRET=\${JWT_SECRET}${lit}\n` });
    expect(runMini(m).code).toBe(0);
    expect(withheld(runMini(m, [], { hooks: { beforeGuard: (t) => `${t}${lit}\n` } }))).toBe(true);
    expect(withheld(runMini(mini({ env: 'DATABASE_URL=postgresql://${DB_USER}@readers-host/db\n' })))).toBe(true);
  });

  test('T21 variable names that could carry a secret are counted, never printed', () => {
    const name = `API_KEY_${alnum()}`;
    const val = rnd('');
    const m = mini({ env: `${name}=${val}\nANTHROPIC_API_KEY=${rnd('')}\n` });
    const out = runMini(m);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('(+1 unprintable name)');
    expect(leakCount(out.stdout, [name.slice(8), val])).toBe(0);
    const r = inv.inventory({ appDir: m.app, home: m.home, readers: false, isRoot: false });
    expect(r.sources[0].unprintableNames).toBe(1);
    expect(Object.keys(r.sources[0].labels)).toEqual(['ANTHROPIC_API_KEY']);
  });

  test('T22 an exception in formatting or in the guard prints nothing to stdout', () => {
    const m = mini({ env: `ANTHROPIC_API_KEY=${rnd('')}\n` });
    const secret = rnd('');
    const inGuard = runMini(m, [], { hooks: { inGuard: () => { throw new Error(secret); } } });
    expect(inGuard).toEqual({ code: 1, stdout: '', stderr: 'ERROR Error\n' });
    const inFormat = runMini(m, [], { hooks: { beforeGuard: () => { throw new TypeError(secret); } } });
    expect(inFormat).toEqual({ code: 1, stdout: '', stderr: 'ERROR TypeError\n' });
  });
});

describe('S-1 final corrections: report integrity, templates, symlinks, names, errors', () => {
  const alnum = () => crypto.randomBytes(24).toString('base64url').replace(/[-_]/g, '');
  const tmpRoot = () => { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'credinv-')); roots.push(r); return r; };
  const runAt = (app, home, args = [], extra = {}) => inv.run(['--app-dir', app, '--home', home, '--no-readers', ...args],
    { isRoot: false, ...extra });
  const withheld = (out) => out.code === 3 && out.stdout === '' && out.stderr === `${inv.GUARD_MESSAGE}\n`;
  const nonPrintable = /[^\x20-\x7e\n]/;

  test('T23 file-system names are escaped: no forged lines or fields; JSON is ASCII and round-trips', () => {
    const root = tmpRoot();
    const app = path.join(root, 'app\nFORGED_HEADER readers: root');
    const home = path.join(root, 'home');
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(path.join(home, '.ssh'), { recursive: true });
    put(path.join(app, '.env'), `ANTHROPIC_API_KEY=${rnd('')}\n`);
    const names = [
      '.env.nl\nFORGED_LINE ANTHROPIC_API_KEY=L', '.env.cr\rFORGED_CR', '.env.tab\tX', '.env.bs\\x',
      '.env.rlo\u202eelpmaxe', '.env.zw\u200bx', '.env.\u00e9', '.env.sp  600 root:root 2026-01-01  readers: root',
    ];
    for (const n of names) put(path.join(app, n), 'PORT=1\n');
    put(path.join(home, '.ssh', 'k\nFORGED_SSH'), 'x');
    fs.symlinkSync('.env', path.join(app, '.env.lnk\nFORGED_LINK'));
    const out = runAt(app, home);
    expect(out.code).toBe(0);
    const lines = out.stdout.split('\n');
    expect(lines.filter((l) => l.startsWith('FORGED')).length).toBe(0);
    expect(nonPrintable.test(out.stdout)).toBe(false);
    for (const e of ['.env.nl\\u{A}FORGED_LINE\\u{20}ANTHROPIC_API_KEY=L', '.env.cr\\u{D}FORGED_CR', '.env.tab\\u{9}X',
      '.env.bs\\\\x', '.env.rlo\\u{202E}elpmaxe', '.env.zw\\u{200B}x', '.env.\\u{E9}', 'app\\u{A}FORGED_HEADER\\u{20}readers:',
      '.env.sp\\u{20}\\u{20}600\\u{20}root:root', '~/.ssh/k\\u{A}FORGED_SSH', '.env.lnk\\u{A}FORGED_LINK']) {
      expect(out.stdout).toContain(e);
    }
    // One line per source, each starting with an escaped name; no extra source-like lines.
    const section = lines.slice(lines.indexOf('== sources') + 1, lines.indexOf('== not opened (existence only)'));
    const sourceLines = section.filter((l) => l !== '' && !l.startsWith('  '));
    expect(sourceLines.length).toBe(names.length + 2); // the names, .env, and the symlink
    const json = runAt(app, home, ['--json']);
    expect([...json.stdout].some((c) => c.charCodeAt(0) > 0x7f)).toBe(false);
    const parsed = JSON.parse(json.stdout);
    const jsonNames = parsed.sources.map((s) => s.name);
    for (const n of names) expect(jsonNames).toContain(n);
  });

  test('T24 symlinks: resolved location only; nothing outside the inventory is read', () => {
    const root = tmpRoot();
    const app = path.join(root, 'app');
    const home = path.join(root, 'home');
    const outside = path.join(root, 'outside');
    for (const d of [app, path.join(home, '.ssh'), path.join(outside, 'awsdir')]) fs.mkdirSync(d, { recursive: true });
    const S = { live: rnd(''), mig: rnd(''), key: rnd(''), out: rnd(''), aws: rnd('AKIA') };
    put(path.join(app, '.env'), `ANTHROPIC_API_KEY=${S.live}\n`);
    put(path.join(home, '.episode-x.env'), `DB_PASSWORD=${S.mig}\n`);
    put(path.join(home, '.ssh', 'id_ed25519'), `PRIVATE_KEY=${S.key}\n`);
    put(path.join(outside, 'secret.env'), `ANTHROPIC_API_KEY=${S.out}\n`);
    put(path.join(outside, 'awsdir', 'credentials'), `[default]\naws_access_key_id = ${S.aws}\n`);
    fs.symlinkSync('.env', path.join(app, '.env.app'));
    fs.symlinkSync('../home/.episode-x.env', path.join(app, '.env.home'));
    fs.symlinkSync('../home/.ssh/id_ed25519', path.join(app, '.env.key'));
    fs.symlinkSync('../outside/secret.env', path.join(app, '.env.out'));
    fs.symlinkSync('nowhere\n\u202eFORGED_TARGET', path.join(app, '.env.dang'));
    fs.symlinkSync('../outside/awsdir', path.join(home, '.aws'));
    const reads = jest.spyOn(fs, 'readFileSync');
    let out;
    let json;
    try {
      out = runAt(app, home);
      json = JSON.parse(runAt(app, home, ['--json']).stdout);
      const readPaths = reads.mock.calls.map(([p]) => String(p));
      for (const forbidden of ['id_ed25519', 'secret.env', 'awsdir']) {
        expect(readPaths.filter((p) => p.includes(forbidden)).length).toBe(0);
      }
    } finally {
      reads.mockRestore();
    }
    expect(out.code).toBe(0);
    expect(out.stdout).toMatch(/\.env\.app\s+.*symlink -> \.\/\.env /);
    expect(out.stdout).toMatch(/\.env\.home\s+.*symlink -> ~\/\.episode-x\.env /);
    expect(out.stdout).toMatch(/\.env\.key\s+.*symlink -> ~\/\.ssh\/id_ed25519\s+skipped \(resolves outside the inventory\)/);
    expect(out.stdout).toMatch(/\.env\.out\s+.*symlink -> \(outside inventoried directories\)\s+skipped/);
    expect(out.stdout).toMatch(/\.env\.dang\s+.*symlink -> \(dangling\)\s+skipped \(dangling link\)/);
    expect(out.stdout).toMatch(/~\/\.aws\/credentials\s+.*skipped \(resolves outside the inventory\)/);
    expect(out.stdout).not.toContain('nowhere');
    expect(out.stdout).not.toContain('FORGED');
    expect(out.stdout).not.toContain('outside/');
    expect(leakCount(out.stdout, [S.key, S.out, S.aws, S.live, S.mig])).toBe(0);
    const byName = Object.fromEntries(json.sources.map((s) => [s.name, s]));
    expect(byName['.env.home'].link).toEqual({ where: 'home', path: '.episode-x.env' });
    expect(byName['.env.home'].labels).toEqual({ DB_PASSWORD: 'H1' });
    expect(byName['.env.out'].link).toEqual({ where: 'outside' });
    expect(byName['.env.dang'].link).toEqual({ where: 'dangling' });
  });

  test('T25 secret-bearing profile, app and variable names never reach text, JSON or errors', () => {
    const root = tmpRoot();
    const app = path.join(root, 'app');
    const home = path.join(root, 'home');
    fs.mkdirSync(app, { recursive: true });
    const S = { prof: alnum(), app: alnum(), rej: alnum(), v1: rnd(''), v2: rnd('') };
    put(path.join(app, '.env'), `ANTHROPIC_API_KEY=${rnd('')}\nApi_Key_${S.rej}=${S.v1}\nanthropic_api_key=${S.v2}\n`);
    put(path.join(home, '.aws', 'credentials'), `[${S.prof}]\naws_access_key_id = ${rnd('AKIA')}\n[default]\naws_access_key_id = ${rnd('AKIA')}\n`);
    put(path.join(home, '.pm2', 'dump.pm2'), JSON.stringify([{ name: S.app, ANTHROPIC_API_KEY: rnd('') }, { name: 'ok-app', JWT_SECRET: rnd('') }]));
    const text = runAt(app, home);
    const json = runAt(app, home, ['--json']);
    const secrets = [S.prof, S.app, S.rej, S.v1, S.v2];
    for (const o of [text, json]) {
      expect(o.code).toBe(0);
      expect(leakCount(o.stdout + o.stderr, secrets)).toBe(0);
      expect(o.stdout.includes('anthropic_api_key')).toBe(false);
    }
    const parsed = JSON.parse(json.stdout);
    expect(parsed.sources.map((s) => s.name)).toEqual(expect.arrayContaining(['dump.pm2 [app1]', 'dump.pm2 [ok-app]']));
    expect(parsed.sources.find((s) => s.name === '~/.aws/credentials').profiles).toEqual(['profile1', 'default']);
    // Error channel: an error whose code and name carry those names prints only "Error".
    const err = runAt(app, home, [], { hooks: { beforeParse: () => { const e = new Error(S.v1); e.code = S.app; e.name = S.prof; throw e; } } });
    expect(leakCount(err.stdout + err.stderr, secrets)).toBe(0);
    expect(err.stdout).toMatch(/\.env\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+unreadable \(Error\)/);
  });

  test('T26 template files: never live; only explicit placeholders unguarded; real-looking values guarded and flagged', () => {
    const live = rnd('');
    const real = rnd('');
    const make = (dirName, env, example, extra = {}) => {
      const root = tmpRoot();
      const app = path.join(root, dirName);
      const home = path.join(root, 'home');
      fs.mkdirSync(home, { recursive: true });
      if (env !== null) put(path.join(app, '.env'), env);
      put(path.join(app, '.env.example'), example);
      for (const [n, t] of Object.entries(extra)) put(path.join(app, n), t);
      return { app, home };
    };
    // Explicit placeholders in a template are labelled P, unflagged, and not guarded:
    // the app directory is literally named "changeme", which a guarded value would trip on.
    const a = make('changeme', `ANTHROPIC_API_KEY=${live}\n`, [
      'DB_PASSWORD=changeme', 'JWT_SECRET=<jwt-secret>', 'OPENAI_API_KEY=${OPENAI_API_KEY}', 'FAL_KEY=xxxxxxxx', 'RUNWAY_ML_API_KEY=',
      'REPLICATE_API_TOKEN=your-token-here', `ANTHROPIC_API_KEY=${live}`, `ELEVENLABS_API_KEY=${real}`,
    ].join('\n'), { '.env.production.template': 'JWT_SECRET=<x>\n', '.env.sample': '', '.env.local.example': '', '.env.examples': '', '.env.example.bak': '' });
    const out = runAt(a.app, a.home);
    expect(out.code).toBe(0);
    expect(out.stdout).toMatch(/\.env\.example\s+\d{3} \S+ \d{4}-\d{2}-\d{2}\s+\[template\]/);
    for (const n of ['.env.production.template', '.env.sample', '.env.local.example']) {
      expect(out.stdout).toMatch(new RegExp(`${n.replace(/\./g, '\\.')}\\s+\\d{3} \\S+ \\d{4}-\\d{2}-\\d{2}\\s+\\[template\\]`));
    }
    for (const n of ['.env.examples', '.env.example.bak']) {
      expect(out.stdout).not.toMatch(new RegExp(`${n.replace(/\./g, '\\.')}\\s+\\d{3} \\S+ \\d{4}-\\d{2}-\\d{2}\\s+\\[template\\]`));
    }
    expect(out.stdout).toContain('ANTHROPIC_API_KEY=L! DB_PASSWORD=P ELEVENLABS_API_KEY=H1! FAL_KEY=P JWT_SECRET=P OPENAI_API_KEY=P REPLICATE_API_TOKEN=H1! RUNWAY_ML_API_KEY=P');
    expect(leakCount(out.stdout, [live, real])).toBe(0);
    const r = JSON.parse(runAt(a.app, a.home, ['--json']).stdout);
    const ex = r.sources.find((s) => s.name === '.env.example');
    expect(ex.template).toBe(true);
    expect(ex.flagged.sort()).toEqual(['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'REPLICATE_API_TOKEN']);
    expect(ex.labels.ANTHROPIC_API_KEY).toBe('L');
    // The same explicit placeholder outside a template is guarded.
    expect(withheld(runAt(...Object.values(make('changeme', 'DB_PASSWORD=changeme\n', ''))))).toBe(true);
    // A broad "placeholder-looking" value in a template stays guarded.
    expect(withheld(runAt(...Object.values(make('your-token-here', null, 'REPLICATE_API_TOKEN=your-token-here\n'))))).toBe(true);
    // A real-looking template value is guarded too (forced into the report by a hook).
    const b = make('app', null, `ELEVENLABS_API_KEY=${real}\n`);
    expect(withheld(runAt(b.app, b.home, [], { hooks: { beforeGuard: (t) => `${t}${real}\n` } }))).toBe(true);
    // Templates are never live: with no .env, a template value is Hn!, not L.
    expect(runAt(b.app, b.home).stdout).toContain('ELEVENLABS_API_KEY=H1!');
    // A production-shaped DATABASE_URL example is not an explicit placeholder: it stays guarded.
    const prodShape = make('episode-metadata', null,
      'DATABASE_URL=postgresql://postgres:password@episode-metadata-db-dev.xxxxx.us-east-1.rds.amazonaws.com:5432/postgres\n');
    expect(withheld(runAt(prodShape.app, prodShape.home))).toBe(true);
  });

  test('T27 credential names are found case-insensitively; non-uppercase names are counted, never printed', () => {
    const root = tmpRoot();
    const app = path.join(root, 'app');
    const home = path.join(root, 'home');
    fs.mkdirSync(home, { recursive: true });
    const v = { lower: rnd(''), mixed: rnd(''), upper: rnd('') };
    put(path.join(app, '.env'), `anthropic_api_key=${v.lower}\nDb_Password=${v.mixed}\nANTHROPIC_API_KEY=${v.upper}\nport=3000\n`);
    const text = runAt(app, home);
    const json = runAt(app, home, ['--json']);
    expect(text.code).toBe(0);
    expect(text.stdout).toContain('ANTHROPIC_API_KEY=L  (+2 unprintable names)');
    expect(JSON.parse(json.stdout).sources[0].unprintableNames).toBe(2);
    for (const o of [text, json]) {
      expect(o.stdout.includes('anthropic_api_key') || o.stdout.includes('Db_Password')).toBe(false);
      expect(leakCount(o.stdout, Object.values(v))).toBe(0);
    }
    for (const value of [v.lower, v.mixed]) {
      expect(withheld(runAt(app, home, [], { hooks: { beforeGuard: (t) => `${t}${value}\n` } }))).toBe(true);
    }
  });

  test('T28 error identifiers come from a strict allowlist', () => {
    const secret = rnd('');
    const cases = [
      [{ code: 'EACCES' }, 'EACCES'], [{ code: 'ENOENT', name: 'Error' }, 'ENOENT'], [{ code: 'ELOOP' }, 'ELOOP'],
      [new SyntaxError('x'), 'SyntaxError'], [new TypeError('x'), 'TypeError'],
      [{ code: 'ERR_INVALID_ARG_TYPE', name: 'TypeError' }, 'TypeError'], [{ code: 'ERR_INVALID_ARG_TYPE' }, 'Error'],
      [{ code: 'EACCESX' }, 'Error'], [{ code: secret }, 'Error'], [{ name: secret }, 'Error'],
      [{ name: 'Error\nFORGED' }, 'Error'], [{ code: 12 }, 'Error'], [null, 'Error'], [undefined, 'Error'], ['EACCES', 'Error'],
    ];
    for (const [e, want] of cases) expect(inv.errLabel(e)).toBe(want);
    const root = tmpRoot();
    const app = path.join(root, 'app');
    const home = path.join(root, 'home');
    fs.mkdirSync(home, { recursive: true });
    put(path.join(app, '.env'), `ANTHROPIC_API_KEY=${rnd('')}\n`);
    const crafted = { code: `E${secret.toUpperCase()}`, name: `${secret}Error`, message: secret };
    const parse = runAt(app, home, [], { hooks: { beforeParse: () => { throw crafted; } } });
    expect(parse.code).toBe(2);
    expect(parse.stdout).toMatch(/unreadable \(Error\)/);
    expect(leakCount(parse.stdout + parse.stderr, [secret, secret.toUpperCase()])).toBe(0);
    const guardErr = runAt(app, home, [], { hooks: { inGuard: () => { throw crafted; } } });
    expect(guardErr).toEqual({ code: 1, stdout: '', stderr: 'ERROR Error\n' });
  });
});
