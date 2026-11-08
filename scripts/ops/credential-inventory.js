#!/usr/bin/env node
'use strict';

/**
 * Read-only credential inventory (AI gateway G3, slice S-1).
 *
 * Reports WHERE credential-like variables live on a host, who can read each
 * file, and whether copies hold the same value as the live source, without
 * ever printing a value. Design: AI_Gateway_G3_S1_Design_2026-11-08.md.
 *
 *   node scripts/ops/credential-inventory.js --app-dir <dir> --home <dir>
 *        [--users a,b,c] [--json] [--no-readers]
 *
 * Guarantees:
 *   - Reads only: <app-dir>/.env*, <home>/.episode-*.env, <home>/.pm2/dump.pm2(.bak),
 *     <home>/.aws/credentials, and /etc/passwd + /etc/group (to name owners).
 *     <home>/.ssh/*, .git-credentials, .npmrc, .docker/config.json and .netrc
 *     are never opened (existence, mode and owner only).
 *   - Values are compared as HMAC-SHA256 digests under a random key made for
 *     this run and held in memory only. No value, digest, prefix or suffix is
 *     ever printed or returned.
 *   - Errors are reported by code or name only. Parser messages are never
 *     printed: JSON.parse messages quote part of their input.
 *   - Every report passes a guard before it is written. If any 6-character
 *     piece of any value read appears in it, nothing is printed and the exit
 *     code is 3.
 *   - No file writes, temporary files, network, or environment reads. Child
 *     processes only when run as root, and only `sudo -n -u <user> test -r
 *     <path>`, `id -nG <user>` and `sudo -n -l -U <user>`.
 *
 * Exit codes: 0 complete; 2 complete, some sources unreadable or too large;
 * 3 guard tripped (nothing printed); 1 usage or unexpected error.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const VERSION = 1;
const MAX_BYTES = 1024 * 1024;
const GUARD_MIN = 6;
const CREDENTIAL_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASS$|CREDENTIAL|PRIVATE|DATABASE_URL|_DSN$)/;
const USER_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,31}\$?$/;
const DEFAULT_USERS = ['ubuntu', 'ssm-user', 'www-data', 'nobody'];
const NOT_OPENED_FILES = ['.git-credentials', '.npmrc', '.docker/config.json', '.netrc'];
const LEGEND = 'labels: L = same as live (.env; AWS: ~/.aws/credentials [default]); Hn = other value; P = placeholder/empty';
const USAGE = 'usage: credential-inventory.js --app-dir <dir> --home <dir> [--users a,b] [--json] [--no-readers]';
const GUARD_MESSAGE = 'REDACTION_GUARD_TRIPPED: output withheld';
// Fixed wording of the report and JSON keys: never secret, removed before the guard scans.
const FIXED_TEXT = [
  LEGEND, 'credential-inventory', 'host-user', 'app-dir', '== sources', 'readers:', 'not checked', 'needs root',
  'others not checked', 'symlink', 'unreadable', 'too large', 'skipped (not a regular file)', 'same labels as',
  'profiles:', '== not opened (existence only)', '== summary by variable (sources holding each label)',
  '== host facts', '(not collected: needs root and readers)', 'NOPASSWD:ALL', 'limited', 'groups=', 'sudo=',
  'version', 'hostUser', 'appDir', 'sources', 'notOpened', 'summary', 'hostFacts', 'exitCode', 'modified',
  'readers', 'status', 'profiles', 'labels', 'owner',
];

/** Error code or name only; never a message (messages can quote input). */
function errLabel(err) {
  const v = (err && (err.code || err.name)) || 'Error';
  return /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(String(v)) ? String(v) : 'Error';
}

function isPlaceholder(value) {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  if (v.length < 8) return true;
  if (v.includes('${')) return true;
  if (/(your|here|example|changeme|placeholder|xxx)/i.test(v)) return true;
  if (/^(.)\1+$/.test(v)) return true;
  return false;
}

function parseEnvText(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.length >= 2 && v.endsWith(q)) v = v.slice(1, -1);
    else if (v.includes(' #')) v = v.slice(0, v.indexOf(' #')).trim();
    out.set(m[1], v);
  }
  return out;
}

function parseAwsText(text) {
  const profiles = [];
  const vars = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]{1,64})\]\s*$/.exec(line);
    if (section) { current = section[1].trim(); profiles.push(current); continue; }
    const kv = /^\s*(aws_access_key_id|aws_secret_access_key|aws_session_token)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!kv || current === null) continue;
    const group = kv[1].toUpperCase();
    vars.set(current === 'default' ? group : `${group}[${current}]`, { group, value: kv[2] });
  }
  return { profiles, vars };
}

function pm2AppVars(app) {
  const merged = new Map();
  const add = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if ((typeof v === 'string' || typeof v === 'number') && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) merged.set(k, String(v));
    }
  };
  add(app);
  add(app && app.pm2_env && app.pm2_env.env);
  add(app && app.env);
  return merged;
}

function loadAccounts(readFile) {
  const parse = (file) => {
    const map = new Map();
    try {
      for (const line of readFile(file, 'utf8').split('\n')) {
        const f = line.split(':');
        if (f.length >= 3 && USER_NAME.test(f[0])) map.set(Number(f[2]), f[0]);
      }
    } catch (err) {
      map.set('error', errLabel(err));
    }
    return map;
  };
  return { users: parse('/etc/passwd'), groups: parse('/etc/group') };
}

function collect(options = {}) {
  const appDir = path.resolve(options.appDir || '/home/ubuntu/episode-metadata');
  const home = path.resolve(options.home || '/home/ubuntu');
  const users = options.users || DEFAULT_USERS;
  const hooks = options.hooks || {};
  const spawn = options.spawnSync || ((...a) => childProcess.spawnSync(...a));
  const isRoot = options.isRoot !== undefined ? options.isRoot : (typeof process.getuid === 'function' && process.getuid() === 0);
  const readers = options.readers !== false;
  const readFile = (p, enc) => fs.readFileSync(p, enc);
  const accounts = loadAccounts(readFile);
  const ownerOf = (st) => `${accounts.users.get(st.uid) || st.uid}:${accounts.groups.get(st.gid) || st.gid}`;

  const hmacKey = crypto.randomBytes(32);
  const digest = (v) => crypto.createHmac('sha256', hmacKey).update(v).digest('hex');
  const guardValues = new Set();
  const safe = new Set([appDir, home, ...users, ...FIXED_TEXT]);
  let partial = false;

  let hostUser;
  try { hostUser = os.userInfo().username; } catch (err) { hostUser = `uid-${typeof process.getuid === 'function' ? process.getuid() : '?'}`; }
  safe.add(hostUser);

  const probeReaders = (file) => {
    if (!readers) return 'not checked';
    if (options.readersProbe) return ['root', ...users.filter((u) => options.readersProbe(u, file))].join(' ');
    if (isRoot) {
      const ok = users.filter((u) => {
        const r = spawn('sudo', ['-n', '-u', u, 'test', '-r', file], { stdio: 'ignore', timeout: 5000 });
        return r && r.status === 0;
      });
      return ['root', ...ok].join(' ');
    }
    let self = false;
    try { fs.accessSync(file, fs.constants.R_OK); self = true; } catch (err) { self = false; }
    return `${self ? `self(${hostUser})` : 'not self'}; others not checked (needs root)`;
  };

  // Collect sources. Each: { name, file, kind, meta, status, vars: Map(display -> {group, value}) }.
  const sources = [];
  const describe = (name, file) => {
    const src = { name, file, status: 'ok', vars: new Map(), extra: null };
    safe.add(name); safe.add(file);
    try {
      const lst = fs.lstatSync(file);
      if (lst.isSymbolicLink()) { src.symlink = fs.readlinkSync(file); safe.add(src.symlink); }
      const st = fs.statSync(file);
      src.mode = (st.mode & 0o777).toString(8);
      src.owner = ownerOf(st);
      src.modified = st.mtime.toISOString().slice(0, 10);
      safe.add(src.owner); safe.add(src.modified);
      if (!st.isFile()) { src.status = 'skipped (not a regular file)'; return src; }
      if (st.size > MAX_BYTES) { src.status = 'too large'; partial = true; return src; }
      src.readers = probeReaders(file);
    } catch (err) {
      src.status = `unreadable (${errLabel(err)})`; partial = true;
    }
    return src;
  };
  const readText = (src, kind) => {
    if (src.status !== 'ok') return null;
    try {
      if (hooks.beforeParse) hooks.beforeParse(kind, src.file);
      return readFile(src.file, 'utf8');
    } catch (err) {
      src.status = `unreadable (${errLabel(err)})`; partial = true;
      return null;
    }
  };
  const keepCredentialVars = (src, map) => {
    for (const [k, v] of map) if (CREDENTIAL_NAME.test(k)) src.vars.set(k, { group: k, value: v });
  };

  // App-dir .env files.
  let appEntries = [];
  try { appEntries = fs.readdirSync(appDir).filter((f) => f.startsWith('.env')); } catch (err) { partial = true; }
  for (const f of appEntries) {
    const src = describe(f, path.join(appDir, f));
    src.live = f === '.env';
    const text = readText(src, 'env');
    if (text !== null) {
      try { keepCredentialVars(src, parseEnvText(text)); } catch (err) { src.status = `unreadable (${errLabel(err)})`; partial = true; }
    }
    sources.push(src);
  }
  // Home: ~/.episode-*.env
  let homeEntries = [];
  try { homeEntries = fs.readdirSync(home).filter((f) => /^\.episode-.*\.env$/.test(f)); } catch (err) { partial = true; }
  for (const f of homeEntries) {
    const src = describe(`~/${f}`, path.join(home, f));
    const text = readText(src, 'env');
    if (text !== null) {
      try { keepCredentialVars(src, parseEnvText(text)); } catch (err) { src.status = `unreadable (${errLabel(err)})`; partial = true; }
    }
    sources.push(src);
  }
  // pm2 saved configuration: one source per app.
  for (const f of ['dump.pm2', 'dump.pm2.bak']) {
    const file = path.join(home, '.pm2', f);
    if (!fs.existsSync(file)) continue;
    const base = describe(f, file);
    const text = readText(base, 'pm2');
    if (text === null) { sources.push(base); continue; }
    let apps;
    try {
      apps = JSON.parse(text);
      if (!Array.isArray(apps)) throw new TypeError('not an array');
    } catch (err) {
      base.status = `unreadable (${errLabel(err)})`; partial = true; sources.push(base); continue;
    }
    apps.forEach((app, i) => {
      const appName = app && typeof app.name === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(app.name) ? app.name : `app${i + 1}`;
      const src = { ...base, name: `${f} [${appName}]`, vars: new Map() };
      safe.add(src.name); safe.add(appName);
      keepCredentialVars(src, pm2AppVars(app));
      sources.push(src);
    });
  }
  // ~/.aws/credentials (live source for AWS keys).
  const awsFile = path.join(home, '.aws', 'credentials');
  if (fs.existsSync(awsFile)) {
    const src = describe('~/.aws/credentials', awsFile);
    src.liveAws = true;
    const text = readText(src, 'aws');
    if (text !== null) {
      try {
        const parsed = parseAwsText(text);
        src.extra = { profiles: parsed.profiles.filter((p) => /^[A-Za-z0-9_.-]{1,64}$/.test(p)) };
        src.extra.profiles.forEach((p) => safe.add(p));
        src.vars = parsed.vars;
      } catch (err) { src.status = `unreadable (${errLabel(err)})`; partial = true; }
    }
    sources.push(src);
  }

  // Order: live sources first, then by name. Assign labels per variable group.
  const order = (s) => (s.live ? 0 : s.liveAws ? 1 : 2);
  sources.sort((a, b) => order(a) - order(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const labelsByGroup = new Map();
  const groupMap = (g) => { if (!labelsByGroup.has(g)) labelsByGroup.set(g, new Map()); return labelsByGroup.get(g); };
  for (const s of sources) {
    for (const [display, { group, value }] of s.vars) {
      if (isPlaceholder(value)) continue;
      guardValues.add(value);
      if ((s.live && !group.startsWith('AWS_')) || (s.liveAws && display === group)) {
        const m = groupMap(group);
        const d = digest(value);
        if (!m.has(d) && ![...m.values()].includes('L')) m.set(d, 'L');
      }
    }
  }
  for (const s of sources) {
    s.labels = {};
    for (const [display, { group, value }] of s.vars) {
      let label;
      if (isPlaceholder(value)) label = 'P';
      else {
        const m = groupMap(group);
        const d = digest(value);
        if (!m.has(d)) m.set(d, `H${[...m.values()].filter((l) => l !== 'L').length + 1}`);
        label = m.get(d);
      }
      s.labels[display] = label;
      safe.add(display);
    }
    delete s.vars; // values and digests go no further
    safe.add(s.status);
  }

  // Never-opened paths: existence, mode, owner.
  const notOpened = [];
  const noteFile = (rel) => {
    const file = path.join(home, rel);
    try {
      const st = fs.lstatSync(file);
      const entry = { name: `~/${rel}`, mode: (st.mode & 0o777).toString(8), owner: ownerOf(st).split(':')[0] };
      safe.add(entry.name); safe.add(entry.owner);
      notOpened.push(entry);
    } catch (err) { /* absent: nothing to report */ }
  };
  try {
    for (const f of fs.readdirSync(path.join(home, '.ssh')).sort()) noteFile(path.join('.ssh', f));
  } catch (err) { /* no ~/.ssh */ }
  NOT_OPENED_FILES.forEach(noteFile);

  // Host facts (root only).
  const hostFacts = [];
  if (readers && isRoot) {
    for (const u of users) {
      const id = spawn('id', ['-nG', u], { encoding: 'utf8', timeout: 5000 });
      const groups = id && id.status === 0
        ? String(id.stdout || '').trim().split(/\s+/).filter((g) => USER_NAME.test(g)) : [];
      const s = spawn('sudo', ['-n', '-l', '-U', u], { encoding: 'utf8', timeout: 5000 });
      const out = String((s && s.stdout) || '');
      const sudo = /NOPASSWD:\s*ALL/.test(out) ? 'NOPASSWD:ALL'
        : /\(ALL(\s*:\s*ALL)?\)\s*ALL/.test(out) ? 'ALL'
          : /may run the following/.test(out) ? 'limited' : 'none';
      groups.forEach((g) => safe.add(g));
      hostFacts.push({ user: u, groups: groups.length ? groups : ['unknown'], sudo });
    }
  }

  // Summary: number of sources holding each label, per variable.
  const summary = {};
  for (const s of sources) {
    for (const [display, label] of Object.entries(s.labels)) {
      const name = display.replace(/\[.*\]$/, '');
      summary[name] = summary[name] || {};
      summary[name][label] = (summary[name][label] || 0) + 1;
    }
  }

  const result = {
    version: VERSION,
    hostUser,
    run: new Date().toISOString(),
    appDir,
    home,
    sources: sources.map((s) => ({
      name: s.name, file: s.file, mode: s.mode || null, owner: s.owner || null, modified: s.modified || null,
      symlink: s.symlink || null, readers: s.readers || null, status: s.status,
      profiles: s.extra ? s.extra.profiles : undefined, labels: s.labels,
    })),
    notOpened,
    summary,
    hostFacts: readers && isRoot ? hostFacts : null,
    exitCode: partial ? 2 : 0,
  };
  safe.add(result.run);
  return { result, guardValues, safe };
}

/** Public API: the report object only (no values, no digests). */
function inventory(options = {}) {
  return collect(options).result;
}

function formatText(r) {
  const lines = [];
  lines.push(`credential-inventory v${r.version}  host-user=${r.hostUser}  run=${r.run}`);
  lines.push(`app-dir=${r.appDir}  home=${r.home}`);
  lines.push(LEGEND, '', '== sources');
  const seen = new Map();
  for (const s of r.sources) {
    const meta = s.mode ? `${s.mode} ${s.owner} ${s.modified}` : '';
    const link = s.symlink ? `  symlink -> ${s.symlink}` : '';
    const tail = s.status === 'ok' ? `  readers: ${s.readers}` : `  ${s.status}`;
    lines.push(`${s.name.padEnd(36)}${meta}${link}${tail}`);
    const labelText = Object.keys(s.labels).sort().map((k) => `${k}=${s.labels[k]}`).join(' ');
    const body = (s.profiles ? `profiles: ${s.profiles.join(' ')}   ` : '') + labelText;
    if (!body) continue;
    if (!s.profiles && seen.has(body)) lines.push(`  (same labels as ${seen.get(body)})`);
    else { lines.push(`  ${body}`); if (!s.profiles) seen.set(body, s.name); }
  }
  lines.push('', '== not opened (existence only)');
  lines.push(r.notOpened.length ? r.notOpened.map((e) => `${e.name} ${e.mode} ${e.owner}`).join('  ') : '(none)');
  lines.push('', '== summary by variable (sources holding each label)');
  for (const name of Object.keys(r.summary).sort()) {
    const counts = r.summary[name];
    const order = Object.keys(counts).sort((a, b) => {
      const rank = (l) => (l === 'L' ? 0 : l === 'P' ? 1e6 : Number(l.slice(1)));
      return rank(a) - rank(b);
    });
    lines.push(`${name.padEnd(28)}${order.map((l) => `${l}: ${counts[l]}`).join('   ')}`);
  }
  lines.push('', '== host facts');
  if (r.hostFacts) r.hostFacts.forEach((h) => lines.push(`${h.user}: groups=${h.groups.join(',')}  sudo=${h.sudo}`));
  else lines.push('(not collected: needs root and readers)');
  lines.push(`exit ${r.exitCode}`);
  return `${lines.join('\n')}\n`;
}

/** True when any GUARD_MIN-character piece of any value appears in text. */
function leaks(text, values, safe) {
  let scan = text;
  // Remove known non-secret strings (paths, names, dates) so a value that
  // happens to share them cannot trip the guard; the report is unchanged.
  for (const s of [...safe].filter((x) => typeof x === 'string' && x.length >= GUARD_MIN).sort((a, b) => b.length - a.length)) {
    scan = scan.split(s).join(' ');
  }
  if (/\b[0-9a-f]{64}\b/i.test(scan)) return true;
  for (const v of values) {
    if (v.length < GUARD_MIN) continue;
    for (let i = 0; i + GUARD_MIN <= v.length; i += 1) {
      if (scan.includes(v.slice(i, i + GUARD_MIN))) return true;
    }
  }
  return false;
}

function parseArgs(argv) {
  const opts = { json: false, readers: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--no-readers') opts.readers = false;
    else if (a === '--app-dir' || a === '--home' || a === '--users') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return null;
      i += 1;
      if (a === '--app-dir') opts.appDir = v;
      else if (a === '--home') opts.home = v;
      else {
        opts.users = v.split(',').filter(Boolean);
        if (!opts.users.length || !opts.users.every((u) => USER_NAME.test(u))) return null;
      }
    } else return null; // unknown option: not echoed back
  }
  return opts.appDir && opts.home ? opts : null;
}

/** Programmatic entry. Returns { code, stdout, stderr }; never throws. */
function run(argv, extra = {}) {
  try {
    const opts = parseArgs(argv);
    if (!opts) return { code: 1, stdout: '', stderr: `${USAGE}\n` };
    const { result, guardValues, safe } = collect({ ...opts, ...extra });
    let text = opts.json ? `${JSON.stringify(result, null, 2)}\n` : formatText(result);
    if (extra.hooks && extra.hooks.beforeGuard) text = extra.hooks.beforeGuard(text);
    if (leaks(text, guardValues, safe)) return { code: 3, stdout: '', stderr: `${GUARD_MESSAGE}\n` };
    return { code: result.exitCode, stdout: text, stderr: '' };
  } catch (err) {
    return { code: 1, stdout: '', stderr: `ERROR ${errLabel(err)}\n` };
  }
}

if (require.main === module) {
  const out = run(process.argv.slice(2));
  if (out.stdout) process.stdout.write(out.stdout);
  if (out.stderr) process.stderr.write(out.stderr);
  process.exitCode = out.code;
}

module.exports = { run, inventory, formatText, isPlaceholder, parseEnvText, parseAwsText, errLabel, leaks, GUARD_MESSAGE };
