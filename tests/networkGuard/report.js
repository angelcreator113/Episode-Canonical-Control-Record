'use strict';

/**
 * Jest network guard: report building and verification (pure).
 *
 * buildReport turns the run's event lines into a report. Its `status` is:
 *   complete    every executed test file has a heartbeat (with every hook in
 *               place) and a file-end whose count matches its recorded
 *               events, the start marker matches this run, and no line
 *               was unreadable. A file in which Jest skipped every test
 *               never runs afterAll, so it has no file-end; it is exempt
 *               from that one check only when the reporter lists it in
 *               allSkippedFiles (Jest: skipped, no failure, no exec error).
 *               It still needs its heartbeat and hooks, and any attempt it
 *               made (its module body still runs) is still counted;
 *   incomplete  any of that is missing, a hook was found removed during a
 *               test, proxy settings reached a test file, the endpoint
 *               registry failed to load, or the Jest configuration does not
 *               wire the guard: the counts cannot be trusted, so they must
 *               never be read as "zero attempts";
 *   disabled    the guard was switched off (NETWORK_GUARD=off).
 *
 * Events are kept apart:
 *   attempts   unexpected calls to non-loopback destinations;
 *   findings   Stage 3a endpoint and transport findings (report-only), by kind;
 *   canary     the canary file's deliberate, always-blocked calls, checked
 *              against canary-manifest.json and the canary witness record.
 *
 * verifyReport is what CI runs after the tests: a missing report, a missing
 * or mismatched start marker, an unfinalized or incomplete report, a failed
 * canary verification, or a disabled guard in CI all fail it. Recorded
 * attempts and findings do not fail it (report-only); they are listed.
 */

const BLOCKED_CODE = 'ERR_TEST_NETWORK_BLOCKED';

const REQUIRED_HOOKS = [
  'net.Socket.prototype.connect', 'net.Server.prototype.listen', 'http.request', 'http.get', 'https.request', 'https.get',
  'dns.lookup', 'dns.promises.lookup', 'dns.Resolver.prototype.resolve4', 'dns.promises.Resolver.prototype.resolve4',
  'dgram.Socket.prototype.send', 'dgram.Socket.prototype.connect',
];

const FINDING_KINDS = [
  'loopback-unregistered', 'unix-unregistered', 'post-lookup-nonloopback', 'localhost-resolution-mismatch', 'noncanonical-ip-name',
];

function isCI(env = {}) {
  return Boolean((env.CI && env.CI !== 'false' && env.CI !== '0') || env.GITHUB_ACTIONS === 'true');
}

function sameIds(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

/** Check the canary events against the manifest and the independent witness record. */
function verifyCanary({ manifest, manifestError, witness, events = [], executedFiles = [], fileResults = {} }) {
  const issues = [];
  if (manifestError || !manifest) {
    issues.push(`canary manifest unreadable: ${manifestError || 'missing'}`);
    return { ok: false, issues, expected: [], observed: {} };
  }
  const file = manifest.file;
  const ids = manifest.canaries.map((c) => c.id);
  const observed = {};
  for (const e of events) observed[e.canary] = (observed[e.canary] || 0) + 1;
  if (!executedFiles.includes(file)) issues.push(`canary file ${file} did not run`);
  const fr = fileResults[file];
  if (!fr) issues.push('no test results for the canary file');
  else if (fr.suiteSkipped || fr.skipped > 0 || fr.failed > 0 || fr.passed !== ids.length + 2) {
    issues.push(`canary file skipped, failed or changed: ${fr.passed} passed, ${fr.failed} failed, ${fr.skipped} skipped (expected ${ids.length + 2} passed: one per canary, the SDK-version check and the witness check)`);
  }
  for (const c of manifest.canaries) {
    const evs = events.filter((e) => e.canary === c.id);
    if (evs.length !== c.events) issues.push(`canary ${c.id}: ${evs.length} event(s), expected ${c.events}`);
    for (const e of evs) {
      if (e.testPath !== file) issues.push(`canary ${c.id}: event from ${e.testPath}`);
      if (e.action !== 'blocked') issues.push(`canary ${c.id}: an event was not blocked`);
      if (!c.transports.includes(e.transport)) issues.push(`canary ${c.id}: unexpected transport ${e.transport}`);
      if (c.host !== undefined && e.host !== c.host) issues.push(`canary ${c.id}: unexpected destination ${e.host}`);
      if (c.kind === 'witness-unix' && (e.kind !== 'unix-unregistered' || !e.path)) issues.push(`canary ${c.id}: not a Unix-socket finding`);
    }
  }
  const unknown = Object.keys(observed).filter((id) => !ids.includes(id));
  if (unknown.length) issues.push(`events from canaries not in the manifest: ${unknown.join(', ')}`);
  if (!witness) issues.push('canary witness record missing');
  else {
    if (witness.file !== file) issues.push('canary witness record is for another file');
    if (witness.connections !== 0 || witness.datagrams !== 0 || witness.unixConnections !== 0) {
      issues.push(`something reached a canary witness: ${witness.connections} TCP, ${witness.datagrams} UDP, ${witness.unixConnections} Unix`);
    }
    const seen = Array.isArray(witness.observed) ? witness.observed : [];
    if (!sameIds(seen.map((o) => o.id), ids)) issues.push('the witness record does not list exactly the manifest canaries');
    if (seen.some((o) => o.code !== BLOCKED_CODE)) issues.push('a canary outcome was not ERR_TEST_NETWORK_BLOCKED');
  }
  return { ok: issues.length === 0, issues, expected: manifest.canaries.map((c) => ({ id: c.id, events: c.events })), observed };
}

function targetOf(e) {
  if (e.path) return e.path;
  if (e.address) return `${e.host || '?'} -> ${e.address}${e.port ? `:${e.port}` : ''}`;
  return `${e.host || '?'}${e.port ? `:${e.port}` : ''}`;
}

function buildReport({
  start, envRunId, runDirExists, lines = [], malformedLines = 0, executedFiles = [], allSkippedFiles = [], finishedAt = new Date().toISOString(),
  fileResults = {}, environment = null, configProblems = [], canaryManifest = null, canaryManifestError = null, canaryWitness = null,
}) {
  const heartbeats = new Map();
  const fileEnds = new Map();
  const events = [];
  const tampers = [];
  for (const l of lines) {
    if (l.type === 'heartbeat') heartbeats.set(l.testPath, l);
    else if (l.type === 'file-end') fileEnds.set(l.testPath, l);
    else if (l.type === 'attempt' || l.type === 'finding') events.push(l);
    else if (l.type === 'tamper') tampers.push(l);
  }
  const canaryEvents = events.filter((e) => e.canary);
  const attempts = events.filter((e) => !e.canary && e.type === 'attempt');
  const findingEvents = events.filter((e) => !e.canary && e.type === 'finding');

  const issues = [];
  if (!start) issues.push('start marker missing (globalSetup did not run)');
  else if (envRunId !== undefined && start.runId !== envRunId) issues.push(`run id mismatch: start marker ${start.runId}, this run ${envRunId}`);
  if (!runDirExists) issues.push('event directory missing');
  if (malformedLines > 0) issues.push(`${malformedLines} unreadable event line(s)`);
  for (const p of configProblems) issues.push(`Jest configuration: ${p}`);

  const disabled = (start && start.mode === 'off') || [...heartbeats.values()].some((h) => h.mode === 'off');
  const missingHeartbeats = [];
  const missingHooks = [];
  const missingFileEnds = [];
  const lostEvents = [];
  const lateAttempts = [];
  const reinstalled = [];
  const allSkipped = [];
  const proxyReached = [];
  const registryErrors = [];
  const skippedSet = new Set(allSkippedFiles);
  for (const f of executedFiles) {
    const hb = heartbeats.get(f);
    if (!hb) { missingHeartbeats.push(f); continue; }
    if (hb.mode !== 'off') {
      const absent = [...REQUIRED_HOOKS, ...(hb.hooks && 'fetch' in hb.hooks ? ['fetch'] : [])].filter((k) => !hb.hooks || hb.hooks[k] !== true);
      if (absent.length) missingHooks.push({ file: f, hooks: absent });
      if (hb.registry && hb.registry.error) registryErrors.push({ file: f, error: hb.registry.error });
    }
    if (Array.isArray(hb.proxyFound) && hb.proxyFound.length) proxyReached.push({ file: f, names: hb.proxyFound });
    if (hb.reinstalled && hb.reinstalled.length) reinstalled.push({ file: f, hooks: hb.reinstalled });
    const end = fileEnds.get(f);
    if (!end) {
      if (skippedSet.has(f)) allSkipped.push(f);
      else missingFileEnds.push(f);
      continue;
    }
    const recorded = events.filter((a) => a.testPath === f).length;
    if (recorded < end.events) lostEvents.push({ file: f, counted: end.events, recorded });
    else if (recorded > end.events) lateAttempts.push({ file: f, afterFileEnd: recorded - end.events });
    if (end.sinkErrors) lostEvents.push({ file: f, sinkErrors: end.sinkErrors });
  }
  if (missingHeartbeats.length) issues.push(`${missingHeartbeats.length} test file(s) with no heartbeat (not instrumented)`);
  if (missingHooks.length) issues.push(`${missingHooks.length} test file(s) ran with a hook missing`);
  if (missingFileEnds.length) issues.push(`${missingFileEnds.length} test file(s) with no file-end record`);
  if (lostEvents.length) issues.push(`${lostEvents.length} test file(s) lost attempt records`);
  if (reinstalled.length) issues.push(`${reinstalled.length} test file(s) found a hook removed and put it back`);
  if (tampers.length) issues.push(`${tampers.length} test(s) found a hook removed during the test`);
  if (proxyReached.length) issues.push(`proxy settings reached ${proxyReached.length} test file(s): ${[...new Set(proxyReached.flatMap((p) => p.names))].join(', ')}`);
  if (registryErrors.length) issues.push(`the endpoint registry failed to load in ${registryErrors.length} test file(s)`);

  const byHost = new Map();
  for (const a of attempts) {
    const key = a.host || '(unknown host)';
    if (!byHost.has(key)) byHost.set(key, { host: key, count: 0, transports: new Set(), files: new Set(), tests: new Set(), frames: a.frames || [] });
    const h = byHost.get(key);
    h.count += 1;
    h.transports.add(a.transport);
    h.files.add(a.testPath || '(no test file)');
    if (a.testName) h.tests.add(a.testName);
  }
  const hosts = [...byHost.values()].sort((x, y) => y.count - x.count).map((h) => ({
    host: h.host, count: h.count, transports: [...h.transports].sort(), files: [...h.files].sort(), tests: [...h.tests].slice(0, 5), frames: h.frames,
  }));

  const findings = {};
  for (const k of FINDING_KINDS) findings[k] = { count: 0, files: [], transports: [], targets: [], frames: [] };
  const add = (kind, e) => {
    const f = findings[kind];
    f.count += 1;
    if (!f.files.includes(e.testPath || '(no test file)')) f.files.push(e.testPath || '(no test file)');
    if (!f.transports.includes(e.transport)) f.transports.push(e.transport);
    const t = targetOf(e);
    if (f.targets.length < 20 && !f.targets.includes(t)) f.targets.push(t);
    if (!f.frames.length && e.frames && e.frames.length) f.frames = e.frames;
  };
  for (const e of findingEvents) if (findings[e.kind]) add(e.kind, e);
  for (const a of attempts) if (a.noncanonicalIp) add('noncanonical-ip-name', a);
  for (const k of FINDING_KINDS) findings[k].files.sort();

  const compat = {};
  for (const hb of heartbeats.values()) {
    if (!hb.registry || hb.registry.error) continue;
    for (const [id, d] of Object.entries(hb.registry)) {
      const key = JSON.stringify(d);
      compat[id] = compat[id] || {};
      compat[id][key] = (compat[id][key] || 0) + 1;
    }
  }
  const compatibility = Object.fromEntries(Object.entries(compat).map(([id, m]) => [id, Object.entries(m).map(([k, n]) => ({ ...JSON.parse(k), files: n }))]));

  const canary = disabled ? { ok: true, issues: [], skipped: 'guard disabled', expected: [], observed: {} }
    : verifyCanary({ manifest: canaryManifest, manifestError: canaryManifestError, witness: canaryWitness, events: canaryEvents, executedFiles, fileResults });

  return {
    schema: 2,
    runId: start ? start.runId : null,
    mode: disabled ? 'off' : (start ? start.mode : 'unknown'),
    startedAt: start ? start.startedAt : null,
    finishedAt,
    finalized: true,
    status: issues.length ? 'incomplete' : (disabled ? 'disabled' : 'complete'),
    issues,
    executedFiles: executedFiles.length,
    instrumentedFiles: executedFiles.length - missingHeartbeats.length,
    details: { missingHeartbeats, missingHooks, missingFileEnds, lostEvents, lateAttempts, reinstalled, allSkipped, tampers, proxyReached, registryErrors },
    attempts: { total: attempts.length, hosts },
    findings,
    canary,
    proxy: { removedAtStart: (start && start.proxy && start.proxy.removed) || [], reachedFiles: proxyReached.length },
    compatibility,
    environment,
    files: fileResults,
  };
}

function verifyReport({ start, report, env = {} }) {
  const problems = [];
  if (!report) problems.push('network guard report missing: the test run did not finish, or the reporter did not run');
  if (!start) problems.push('network guard start marker missing: globalSetup did not run');
  if (report && report.finalized !== true) problems.push('network guard report was not finalized');
  if (report && start && report.runId !== start.runId) problems.push(`network guard report is stale: report run ${report.runId}, this run ${start.runId}`);
  if (report && report.status === 'incomplete') problems.push(`network guard report is incomplete: ${report.issues.join('; ')}`);
  if (report && report.status === 'disabled' && isCI(env)) problems.push('the network guard was disabled in CI');
  if (report && !['complete', 'incomplete', 'disabled'].includes(report.status)) problems.push(`unknown report status "${report.status}"`);
  if (report && report.status !== 'disabled' && (!report.canary || report.canary.ok !== true)) {
    problems.push(`network guard canary verification failed: ${report.canary ? report.canary.issues.join('; ') : 'no canary section'}`);
  }
  return { ok: problems.length === 0, problems };
}

function renderSummary(report, verdict) {
  const out = ['## Jest network guard (report-only)', ''];
  if (!report) {
    out.push('**No report.** The run did not finish or the reporter did not run, so the attempt count is unknown.');
  } else {
    const trusted = report.status === 'complete';
    out.push(`- Status: **${report.status}** (${report.instrumentedFiles}/${report.executedFiles} test files instrumented)`);
    out.push(`- Mode: ${report.mode}`);
    const skipped = (report.details && report.details.allSkipped) || [];
    if (skipped.length) out.push(`- Files where every test was skipped (no file-end expected): ${skipped.map((f) => `\`${f}\``).join(', ')}`);
    out.push(`- Unexpected external attempts: **${trusted ? report.attempts.total : `${report.attempts.total} (count not trustworthy: run incomplete)`}**`);
    if (report.canary) {
      const exp = (report.canary.expected || []).reduce((n, c) => n + c.events, 0);
      const obs = Object.values(report.canary.observed || {}).reduce((n, c) => n + c, 0);
      out.push(`- Canaries: **${report.canary.ok ? 'verified' : 'FAILED'}** (${(report.canary.expected || []).length} canaries, ${obs}/${exp} blocked events)`);
    }
    if (report.proxy) out.push(`- Proxy settings removed at start: ${report.proxy.removedAtStart.length ? report.proxy.removedAtStart.map((n) => `\`${n}\``).join(', ') : 'none'}`);
    if (report.issues.length) out.push('', '**Integrity issues:**', ...report.issues.map((i) => `- ${i}`));
    if (report.canary && report.canary.issues && report.canary.issues.length) out.push('', '**Canary issues:**', ...report.canary.issues.map((i) => `- ${i}`));
    if (report.attempts.hosts.length) {
      out.push('', '| Host | Attempts | Transports | Files | First app frame |', '|---|---|---|---|---|');
      for (const h of report.attempts.hosts) out.push(`| \`${h.host}\` | ${h.count} | ${h.transports.join(', ')} | ${h.files.join('<br>')} | ${(h.frames[0] || '').replace(/\|/g, '\\|')} |`);
    }
    if (report.findings) {
      out.push('', '**Findings (report-only):**', '', '| Kind | Count | Files | Targets |', '|---|---|---|---|');
      for (const [kind, f] of Object.entries(report.findings)) {
        out.push(`| ${kind} | ${f.count} | ${f.files.length ? f.files.slice(0, 10).map((x) => `\`${x}\``).join('<br>') + (f.files.length > 10 ? `<br>… ${f.files.length - 10} more` : '') : ''} | ${f.targets.slice(0, 5).map((x) => `\`${x}\``).join(', ')} |`);
      }
    }
  }
  if (verdict) out.push('', verdict.ok ? 'Verification: **passed**' : `Verification: **FAILED**\n${verdict.problems.map((p) => `- ${p}`).join('\n')}`);
  return `${out.join('\n')}\n`;
}

module.exports = { REQUIRED_HOOKS, FINDING_KINDS, isCI, verifyCanary, buildReport, verifyReport, renderSummary };
