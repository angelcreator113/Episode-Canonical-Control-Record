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
