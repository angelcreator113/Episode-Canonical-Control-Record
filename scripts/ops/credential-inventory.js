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
 *   - Every report passes a fail-closed guard over the exact text to be
 *     written. Every nonempty value of a credential-like variable is guarded,
 *     placeholders included; `${NAME}` references are cut out and the literal
 *     pieces around them stay guarded. A hit means nothing is printed and the
 *     exit code is 3. Nothing is exempted for matching a path, name, label or
 *     the report's own wording. Matching (case-sensitive; raw, NFC and NFD):
 *       - 6+ characters: the value, or any 6-character piece of it;
 *       - 1-5 characters: the value as a standalone token (no Unicode letter,
 *         digit or underscore directly before or after it). A short value
 *         embedded inside a longer word is NOT detected (known limitation);
 *         an edge that is punctuation, or a combining mark beside the match,
 *         counts as standalone (fails closed).
 *   - Report integrity: every file-system-derived string in the text report
 *     is escaped. Backslash becomes \\; any character outside printable
 *     ASCII 0x21-0x7E (space, control characters, non-ASCII, Unicode format
 *     controls) becomes \u{HEX}. No name can add a line or pose as a field.
 *     JSON output escapes every non-ASCII character as \uXXXX.
 *   - Template files (.env.example, .env.sample, .env.template and any .env.*
 *     name ending in .example, .sample or .template) are their own class: never
 *     live; only explicit placeholder forms (empty, ${NAME}, <name>, a run of
 *     one mask character x X * #, "...", or a fixed placeholder word as the
 *     whole value) are left out of the guard and labelled P. Every other value
 *     in a template is guarded, labelled, and flagged "!" (potentially real).
 *   - Symlinks: a source is read only if its resolved path is itself an
 *     inventory source. The report shows where a link resolves (a name inside
 *     the app directory, ~/<path> inside home, "(outside inventoried
 *     directories)" or "(dangling)"), never the raw link text.
 *   - Credential-like names are detected case-insensitively.
 *   - Error identifiers come from a strict allowlist (Node errno codes and
 *     built-in error names); anything else is reported as "Error".
 *   - Only names that cannot carry a secret are printed: variables matching
 *     ^[A-Z][A-Z0-9_]{0,63}$, pm2 apps and AWS profiles matching
 *     ^[a-z0-9][a-z0-9._-]{0,63}$. Others are counted (variables) or renamed
 *     (appN, profileN); rejected app and profile names are guarded, and the
 *     values of rejected variables are guarded.
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
const CREDENTIAL_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASS$|CREDENTIAL|PRIVATE|DATABASE_URL|_DSN$)/i;
const USER_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,31}\$?$/;
const DEFAULT_USERS = ['ubuntu', 'ssm-user', 'www-data', 'nobody'];
const NOT_OPENED_FILES = ['.git-credentials', '.npmrc', '.docker/config.json', '.netrc'];
const LEGEND = 'labels: L = same as live (.env; AWS: ~/.aws/credentials [default]); Hn = other value; P = placeholder/empty;'
  + ' ! = template value that is not an explicit placeholder (potentially real); [template] = never live';
const USAGE = 'usage: credential-inventory.js --app-dir <dir> --home <dir> [--users a,b] [--json] [--no-readers]';
const GUARD_MESSAGE = 'REDACTION_GUARD_TRIPPED: output withheld';
const VAR_PRINTABLE = /^[A-Z][A-Z0-9_]{0,63}$/;
const NAME_PRINTABLE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const TEMPLATE_REF = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/g;
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const ALNUM = /[\p{L}\p{N}]/u;
const TEMPLATE_FILE = /^\.env(?:\.[A-Za-z0-9_-]+)*\.(?:example|sample|template)$/;
const PLACEHOLDER_WORDS = new Set(['changeme', 'change_me', 'change-me', 'replaceme', 'replace_me', 'replace-me',
  'placeholder', 'redacted', 'todo', 'tbd', 'none', 'null', 'example']);
const ERRNO_CODES = new Set(Object.keys(os.constants.errno));
const ERROR_NAMES = new Set(['Error', 'TypeError', 'SyntaxError', 'RangeError', 'ReferenceError', 'URIError',
  'EvalError', 'AggregateError']);

/** Allowlisted error identifier only: a Node errno code or a built-in error name, else "Error". */
function errLabel(err) {
  const code = err && typeof err.code === 'string' ? err.code : null;
  if (code && ERRNO_CODES.has(code)) return code;
  const name = err && typeof err.name === 'string' ? err.name : null;
  if (name && ERROR_NAMES.has(name)) return name;
  return 'Error';
}

/** Narrow, explicit placeholder forms; whole-value matches only, no substring rules. */
function isExplicitPlaceholder(value) {
  const v = String(value == null ? '' : value).trim();
  if (v === '') return true;
  if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(v)) return true;
  if (/^<[A-Za-z0-9 _.-]{1,64}>$/.test(v)) return true;
  if (/^(?:x+|X+|\*+|#+|\.{3,})$/.test(v)) return true;
  return PLACEHOLDER_WORDS.has(v.toLowerCase());
}

/** Text-report escaping: backslash -> \\; anything outside 0x21-0x7E -> \u{HEX}. */
function esc(x) {
  let out = '';
  for (const ch of String(x)) {
    const cp = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (cp >= 0x21 && cp <= 0x7e) out += ch;
    else out += `\\u{${cp.toString(16).toUpperCase()}}`;
  }
  return out;
}

/** JSON escaping of every non-ASCII code unit, so the JSON is plain ASCII. */
function jsonAscii(text) {
  return text.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
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
  const orphans = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]{1,64})\]\s*$/.exec(line);
    if (section) { current = section[1].trim(); profiles.push(current); continue; }
    const kv = /^\s*(aws_access_key_id|aws_secret_access_key|aws_session_token)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!kv) continue;
    if (current === null) { orphans.push(kv[2]); continue; }
    const group = kv[1].toUpperCase();
    vars.set(current === 'default' ? group : `${group}[${current}]`, { group, profile: current, value: kv[2] });
  }
  return { profiles, vars, orphans };
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

  const realOr = (p) => { try { return fs.realpathSync(p); } catch (err) { return p; } };
  const appReal = realOr(appDir);
  const homeReal = realOr(home);
  const within = (root, p) => { const rel = path.relative(root, p); return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel); };
  const isInventoryPath = (real) => {
    const dir = path.dirname(real);
    const base = path.basename(real);
    return (dir === appReal && base.startsWith('.env'))
      || (dir === homeReal && /^\.episode-.*\.env$/.test(base))
      || real === path.join(homeReal, '.aws', 'credentials')
      || real === path.join(homeReal, '.pm2', 'dump.pm2')
      || real === path.join(homeReal, '.pm2', 'dump.pm2.bak');
  };
  const relation = (real) => {
    if (within(appReal, real)) return { where: 'app-dir', path: path.relative(appReal, real) };
    if (within(homeReal, real)) return { where: 'home', path: path.relative(homeReal, real) };
    return { where: 'outside' };
  };

  const hmacKey = crypto.randomBytes(32);
  const digest = (v) => crypto.createHmac('sha256', hmacKey).update(v).digest('hex');
  const guardValues = new Set();
  let partial = false;
  // Every nonempty value of a credential-like variable, as guarded pieces.
  const guard = (value) => {
    const v = String(value == null ? '' : value);
    if (!v) return;
    const pieces = v.includes('${') ? v.split(TEMPLATE_REF).filter((x) => ALNUM.test(x)) : [v];
    for (const x of pieces) if (x) guardValues.add(x);
  };

  let hostUser;
  try { hostUser = os.userInfo().username; } catch (err) { hostUser = `uid-${typeof process.getuid === 'function' ? process.getuid() : '?'}`; }

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
    return `${self ? `self(${esc(hostUser)})` : 'not self'}; others not checked (needs root)`;
  };

  // Collect sources. Each: { name, file, kind, meta, status, vars: Map(display -> {group, value}) }.
  const sources = [];
  const describe = (name, file) => {
    const src = { name, file, status: 'ok', vars: new Map(), extra: null };
    try {
      const lst = fs.lstatSync(file);
      const meta = (st) => {
        src.mode = (st.mode & 0o777).toString(8).padStart(3, '0');
        src.owner = ownerOf(st);
        src.modified = st.mtime.toISOString().slice(0, 10);
      };
      // Resolve before any stat or read that would follow a link.
      let real;
      try { real = fs.realpathSync(file); } catch (err) {
        meta(lst);
        if (lst.isSymbolicLink()) { src.link = { where: 'dangling' }; src.status = 'skipped (dangling link)'; return src; }
        throw err;
      }
      if (lst.isSymbolicLink()) src.link = relation(real);
      if (!isInventoryPath(real)) {
        meta(lst);
        src.status = 'skipped (resolves outside the inventory)';
        return src;
      }
      const st = fs.statSync(real);
      meta(st);
      src.real = real;
      if (!st.isFile()) { src.status = 'skipped (not a regular file)'; return src; }
      if (st.size > MAX_BYTES) { src.status = 'too large'; partial = true; return src; }
      src.readers = probeReaders(real);
    } catch (err) {
      src.status = `unreadable (${errLabel(err)})`; partial = true;
    }
    return src;
  };
  const readText = (src, kind) => {
    if (src.status !== 'ok') return null;
    try {
      if (hooks.beforeParse) hooks.beforeParse(kind, src.file);
      return readFile(src.real, 'utf8');
    } catch (err) {
      src.status = `unreadable (${errLabel(err)})`; partial = true;
      return null;
    }
  };
  const keepCredentialVars = (src, map) => {
    for (const [k, v] of map) {
      if (!CREDENTIAL_NAME.test(k)) continue;
      if (VAR_PRINTABLE.test(k)) { src.vars.set(k, { group: k, value: v }); continue; }
      // Counted, never printed. The name itself is not guarded: it shares its
      // uppercase stem (e.g. API_KEY_) with printable names and would withhold
      // every report; it is kept out of the output structurally instead.
      src.unprintable = (src.unprintable || 0) + 1;
      guard(v);
    }
  };

  // App-dir .env files.
  let appEntries = [];
  try { appEntries = fs.readdirSync(appDir).filter((f) => f.startsWith('.env')); } catch (err) { partial = true; }
  for (const f of appEntries) {
    const src = describe(f, path.join(appDir, f));
    src.live = f === '.env';
    src.template = TEMPLATE_FILE.test(f);
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
      const rawName = app && typeof app.name === 'string' ? app.name : '';
      const appName = NAME_PRINTABLE.test(rawName) ? rawName : `app${i + 1}`;
      if (appName !== rawName) guard(rawName);
      const src = { ...base, name: `${f} [${appName}]`, dump: f, app: appName, vars: new Map() };
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
        const shown = new Map();
        parsed.profiles.forEach((p, i) => {
          if (!shown.has(p)) shown.set(p, NAME_PRINTABLE.test(p) ? p : `profile${i + 1}`);
          if (shown.get(p) !== p) guard(p);
        });
        parsed.orphans.forEach(guard);
        src.extra = { profiles: [...new Set(shown.values())] };
        for (const [display, entry] of parsed.vars) {
          const name = entry.profile === 'default' ? display : `${entry.group}[${shown.get(entry.profile)}]`;
          src.vars.set(name, entry);
        }
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
      if (!(s.template && isExplicitPlaceholder(value))) guard(value);
      if (s.template || isPlaceholder(value)) continue;
      if ((s.live && !group.startsWith('AWS_')) || (s.liveAws && display === group)) {
        const m = groupMap(group);
        const d = digest(value);
        if (!m.has(d) && ![...m.values()].includes('L')) m.set(d, 'L');
      }
    }
  }
  for (const s of sources) {
    s.labels = {};
    s.flagged = [];
    for (const [display, { group, value }] of s.vars) {
      let label;
      if (s.template ? isExplicitPlaceholder(value) : isPlaceholder(value)) label = 'P';
      else {
        if (s.template) s.flagged.push(display);
        const m = groupMap(group);
        const d = digest(value);
        if (!m.has(d)) m.set(d, `H${[...m.values()].filter((l) => l !== 'L').length + 1}`);
        label = m.get(d);
      }
      s.labels[display] = label;
    }
    delete s.vars; // values and digests go no further
  }

  // Never-opened paths: existence, mode, owner.
  const notOpened = [];
  const noteFile = (rel) => {
    const file = path.join(home, rel);
    try {
      const st = fs.lstatSync(file);
      const entry = { name: `~/${rel}`, mode: (st.mode & 0o777).toString(8).padStart(3, '0'), owner: ownerOf(st).split(':')[0] };
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
      hostFacts.push({ user: u, groups: groups.length ? groups : ['unknown'], sudo });
    }
  }

  // Summary: number of sources holding each label, per variable.
  const summary = {};
  for (const s of sources) {
    for (const [display, label] of Object.entries(s.labels)) {
      const name = display.replace(/\[.*\]$/, '');
      summary[name] = summary[name] || {};
      const key = s.flagged.includes(display) ? `${label}!` : label;
      summary[name][key] = (summary[name][key] || 0) + 1;
    }
  }

  const result = {
    version: VERSION,
    hostUser,
    run: new Date().toISOString(),
    appDir,
    home,
    sources: sources.map((s) => ({
      name: s.name, dump: s.dump, app: s.app, mode: s.mode || null, owner: s.owner || null, modified: s.modified || null,
      link: s.link || null, readers: s.readers || null, status: s.status, template: Boolean(s.template),
      profiles: s.extra ? s.extra.profiles : undefined, labels: s.labels, flagged: s.flagged,
      unprintableNames: s.unprintable || 0,
    })),
    notOpened,
    summary,
    hostFacts: readers && isRoot ? hostFacts : null,
    exitCode: partial ? 2 : 0,
  };
  return { result, guardValues };
}

/** Public API: the report object only (no values, no digests). */
function inventory(options = {}) {
  return collect(options).result;
}

function formatText(r) {
  const lines = [];
  lines.push(`credential-inventory v${r.version}  host-user=${esc(r.hostUser)}  run=${r.run}`);
  lines.push(`app-dir=${esc(r.appDir)}  home=${esc(r.home)}`);
  lines.push(LEGEND, '', '== sources');
  const seen = new Map();
  const shownName = (s) => (s.app ? `${esc(s.dump)} [${esc(s.app)}]` : esc(s.name));
  for (const s of r.sources) {
    const meta = s.mode ? `${s.mode} ${esc(s.owner)} ${s.modified}` : '';
    const where = s.link && ({ 'app-dir': `./${esc(s.link.path)}`, home: `~/${esc(s.link.path)}`,
      outside: '(outside inventoried directories)', dangling: '(dangling)' })[s.link.where];
    const link = where ? `  symlink -> ${where}` : '';
    const tpl = s.template ? '  [template]' : '';
    // readers and status are built by this tool from allowlisted parts (user names, error identifiers).
    const tail = s.status === 'ok' ? `  readers: ${s.readers}` : `  ${s.status}`;
    lines.push(`${shownName(s).padEnd(36)}${meta}${tpl}${link}${tail}`);
    const labelText = Object.keys(s.labels).sort()
      .map((k) => `${esc(k)}=${s.labels[k]}${s.flagged.includes(k) ? '!' : ''}`).join(' ');
    const n = s.unprintableNames;
    const extraNote = n ? `${labelText ? '  ' : ''}(+${n} unprintable name${n > 1 ? 's' : ''})` : '';
    const body = (s.profiles ? `profiles: ${s.profiles.map(esc).join(' ')}   ` : '') + labelText + extraNote;
    if (!body) continue;
    if (!s.profiles && seen.has(body)) lines.push(`  (same labels as ${seen.get(body)})`);
    else { lines.push(`  ${body}`); if (!s.profiles) seen.set(body, shownName(s)); }
  }
  lines.push('', '== not opened (existence only)');
  lines.push(r.notOpened.length ? r.notOpened.map((e) => `${esc(e.name)} ${e.mode} ${esc(e.owner)}`).join('  ') : '(none)');
  lines.push('', '== summary by variable (sources holding each label)');
  for (const name of Object.keys(r.summary).sort()) {
    const counts = r.summary[name];
    const order = Object.keys(counts).sort((a, b) => {
      const base = (l) => l.replace(/!$/, '');
      const rank = (l) => (base(l) === 'L' ? 0 : base(l) === 'P' ? 1e6 : Number(base(l).slice(1))) + (l.endsWith('!') ? 0.5 : 0);
      return rank(a) - rank(b);
    });
    lines.push(`${name.padEnd(28)}${order.map((l) => `${l}: ${counts[l]}`).join('   ')}`);
  }
  lines.push('', '== host facts');
  if (r.hostFacts) r.hostFacts.forEach((h) => lines.push(`${esc(h.user)}: groups=${h.groups.map(esc).join(',')}  sudo=${h.sudo}`));
  else lines.push('(not collected: needs root and readers)');
  lines.push(`exit ${r.exitCode}`);
  return `${lines.join('\n')}\n`;
}

const codePoints = (x) => Array.from(x);

/** True when short value v appears in text with no letter, digit or underscore beside it. */
function occursStandalone(text, v) {
  const cps = codePoints(v);
  const needLeft = WORD_CHAR.test(cps[0]);
  const needRight = WORD_CHAR.test(cps[cps.length - 1]);
  let from = 0;
  for (;;) {
    const i = text.indexOf(v, from);
    if (i < 0) return false;
    const before = codePoints(text.slice(Math.max(0, i - 2), i)).pop() || '';
    const after = codePoints(text.slice(i + v.length, i + v.length + 2))[0] || '';
    const leftOk = !needLeft || !before || !WORD_CHAR.test(before);
    const rightOk = !needRight || !after || !WORD_CHAR.test(after);
    if (leftOk && rightOk) return true;
    from = i + 1;
  }
}

/**
 * Fail-closed redaction guard over the exact text to be written. True on any
 * hit; nothing is exempted. See the header for the matching rules.
 */
function leaks(text, values, hooks = {}) {
  if (hooks.inGuard) hooks.inGuard();
  if (/\b[0-9a-f]{64}\b/i.test(text)) return true;
  const jsonForm = (v) => jsonAscii(JSON.stringify(v).slice(1, -1));
  const forms = [
    [text, (v) => v], [text.normalize('NFC'), (v) => v.normalize('NFC')], [text.normalize('NFD'), (v) => v.normalize('NFD')],
    [text, (v) => esc(v)], [text, (v) => esc(v.normalize('NFC'))], [text, (v) => esc(v.normalize('NFD'))],
    [text, (v) => jsonForm(v)], [text, (v) => jsonForm(v.normalize('NFC'))], [text, (v) => jsonForm(v.normalize('NFD'))],
  ];
  for (const raw of values) {
    for (const [t, norm] of forms) {
      const v = norm(raw);
      if (!v) continue;
      const cps = codePoints(v);
      if (cps.length < GUARD_MIN) {
        if (occursStandalone(t, v)) return true;
        continue;
      }
      if (t.includes(v)) return true;
      for (let i = 0; i + GUARD_MIN <= cps.length; i += 1) {
        if (t.includes(cps.slice(i, i + GUARD_MIN).join(''))) return true;
      }
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
    const { result, guardValues } = collect({ ...opts, ...extra });
    let text = opts.json ? `${jsonAscii(JSON.stringify(result, null, 2))}\n` : formatText(result);
    if (extra.hooks && extra.hooks.beforeGuard) text = extra.hooks.beforeGuard(text);
    if (leaks(text, guardValues, extra.hooks || {})) return { code: 3, stdout: '', stderr: `${GUARD_MESSAGE}\n` };
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

module.exports = {
  run, inventory, formatText, isPlaceholder, isExplicitPlaceholder, esc, parseEnvText, parseAwsText, errLabel, leaks,
  occursStandalone, GUARD_MESSAGE,
};
