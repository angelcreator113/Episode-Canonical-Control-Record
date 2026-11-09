'use strict';

/**
 * Jest network guard: report building and verification (pure).
 *
 * buildReport turns the run's event lines into a report. Its `status` is:
 *   complete    every executed test file has a heartbeat (with every hook in
 *               place) and a file-end whose count matches its recorded
 *               attempts, the start marker matches this run, and no line
 *               was unreadable. A file in which Jest skipped every test
 *               never runs afterAll, so it has no file-end; it is exempt
 *               from that one check only when the reporter lists it in
 *               allSkippedFiles (Jest: skipped, no failure, no exec error).
 *               It still needs its heartbeat and hooks, and any attempt it
 *               made (its module body still runs) is still counted;
 *   incomplete  any of that is missing: the run's attempt count cannot be
 *               trusted, so it must never be read as "zero attempts";
 *   disabled    the guard was switched off (NETWORK_GUARD=off).
 *
 * verifyReport is what CI runs after the tests: a missing report, a missing
 * or mismatched start marker, an unfinalized or incomplete report, or a
 * disabled guard in CI all fail it. In Stage 1 recorded attempts do not
 * fail it (report-only); they are listed in the summary.
 */

const REQUIRED_HOOKS = [
  'net.Socket.prototype.connect', 'http.request', 'http.get', 'https.request', 'https.get',
  'dns.lookup', 'dns.promises.lookup', 'dns.Resolver.prototype.resolve4', 'dns.promises.Resolver.prototype.resolve4',
];

function isCI(env = {}) {
  return Boolean((env.CI && env.CI !== 'false' && env.CI !== '0') || env.GITHUB_ACTIONS === 'true');
}

function buildReport({ start, envRunId, runDirExists, lines = [], malformedLines = 0, executedFiles = [], allSkippedFiles = [], finishedAt = new Date().toISOString() }) {
  const heartbeats = new Map();
  const fileEnds = new Map();
  const attempts = [];
  for (const l of lines) {
    if (l.type === 'heartbeat') heartbeats.set(l.testPath, l);
    else if (l.type === 'file-end') fileEnds.set(l.testPath, l);
    else if (l.type === 'attempt') attempts.push(l);
  }

  const issues = [];
  if (!start) issues.push('start marker missing (globalSetup did not run)');
  else if (envRunId !== undefined && start.runId !== envRunId) issues.push(`run id mismatch: start marker ${start.runId}, this run ${envRunId}`);
  if (!runDirExists) issues.push('event directory missing');
  if (malformedLines > 0) issues.push(`${malformedLines} unreadable event line(s)`);

  const disabled = (start && start.mode === 'off') || [...heartbeats.values()].some((h) => h.mode === 'off');
  const missingHeartbeats = [];
  const missingHooks = [];
  const missingFileEnds = [];
  const lostEvents = [];
  const lateAttempts = [];
  const reinstalled = [];
  const allSkipped = [];
  const skippedSet = new Set(allSkippedFiles);
  for (const f of executedFiles) {
    const hb = heartbeats.get(f);
    if (!hb) { missingHeartbeats.push(f); continue; }
    if (hb.mode !== 'off') {
      const absent = [...REQUIRED_HOOKS, ...(hb.hooks && 'fetch' in hb.hooks ? ['fetch'] : [])].filter((k) => !hb.hooks || hb.hooks[k] !== true);
      if (absent.length) missingHooks.push({ file: f, hooks: absent });
    }
    if (hb.reinstalled && hb.reinstalled.length) reinstalled.push({ file: f, hooks: hb.reinstalled });
    const end = fileEnds.get(f);
    if (!end) {
      if (skippedSet.has(f)) allSkipped.push(f);
      else missingFileEnds.push(f);
      continue;
    }
    const recorded = attempts.filter((a) => a.testPath === f).length;
    if (recorded < end.events) lostEvents.push({ file: f, counted: end.events, recorded });
    else if (recorded > end.events) lateAttempts.push({ file: f, afterFileEnd: recorded - end.events });
    if (end.sinkErrors) lostEvents.push({ file: f, sinkErrors: end.sinkErrors });
  }
  if (missingHeartbeats.length) issues.push(`${missingHeartbeats.length} test file(s) with no heartbeat (not instrumented)`);
  if (missingHooks.length) issues.push(`${missingHooks.length} test file(s) ran with a hook missing`);
  if (missingFileEnds.length) issues.push(`${missingFileEnds.length} test file(s) with no file-end record`);
  if (lostEvents.length) issues.push(`${lostEvents.length} test file(s) lost attempt records`);
  if (reinstalled.length) issues.push(`${reinstalled.length} test file(s) found a hook removed and put it back`);

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

  return {
    schema: 1,
    runId: start ? start.runId : null,
    mode: disabled ? 'off' : (start ? start.mode : 'unknown'),
    startedAt: start ? start.startedAt : null,
    finishedAt,
    finalized: true,
    status: issues.length ? 'incomplete' : (disabled ? 'disabled' : 'complete'),
    issues,
    executedFiles: executedFiles.length,
    instrumentedFiles: executedFiles.length - missingHeartbeats.length,
    details: { missingHeartbeats, missingHooks, missingFileEnds, lostEvents, lateAttempts, reinstalled, allSkipped },
    attempts: { total: attempts.length, hosts },
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
  return { ok: problems.length === 0, problems };
}

function renderSummary(report, verdict) {
  const out = ['## Jest network guard (Stage 1: report-only)', ''];
  if (!report) {
    out.push('**No report.** The run did not finish or the reporter did not run, so the attempt count is unknown.');
  } else {
    out.push(`- Status: **${report.status}** (${report.instrumentedFiles}/${report.executedFiles} test files instrumented)`);
    out.push(`- Mode: ${report.mode}`);
    const skipped = (report.details && report.details.allSkipped) || [];
    if (skipped.length) out.push(`- Files where every test was skipped (no file-end expected): ${skipped.map((f) => `\`${f}\``).join(', ')}`);
    out.push(`- External attempts recorded: **${report.status === 'complete' ? report.attempts.total : `${report.attempts.total} (count not trustworthy: run incomplete)`}**`);
    if (report.issues.length) out.push('', '**Integrity issues:**', ...report.issues.map((i) => `- ${i}`));
    if (report.attempts.hosts.length) {
      out.push('', '| Host | Attempts | Transports | Files | First app frame |', '|---|---|---|---|---|');
      for (const h of report.attempts.hosts) out.push(`| \`${h.host}\` | ${h.count} | ${h.transports.join(', ')} | ${h.files.join('<br>')} | ${(h.frames[0] || '').replace(/\|/g, '\\|')} |`);
    }
  }
  if (verdict) out.push('', verdict.ok ? 'Verification: **passed**' : `Verification: **FAILED**\n${verdict.problems.map((p) => `- ${p}`).join('\n')}`);
  return `${out.join('\n')}\n`;
}

module.exports = { REQUIRED_HOOKS, isCI, buildReport, verifyReport, renderSummary };
