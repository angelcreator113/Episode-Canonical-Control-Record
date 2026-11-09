'use strict';

/**
 * Jest reporter for the network guard. When the run completes it reads the
 * run's event lines, checks every executed test file was instrumented, and
 * writes tmp/network-guard/report.json and summary.md (atomically). If this
 * reporter does not run, there is no report, and the CI verify step fails.
 *
 * Stage 3a: it also records per-file passed/skipped counts (the baseline for
 * later enforcement), the environment facts that explain known differences
 * (Node version, ffmpeg/ffprobe, CI, test database), a fingerprint check of
 * the Jest configuration's guard wiring, and the canary manifest and witness
 * record for canary verification.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildReport, renderSummary, isCI } = require('./report');
const { loadManifest } = require('./canary');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
}

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function hasTool(cmd) {
  try { return spawnSync(cmd, ['-version'], { stdio: 'ignore', timeout: 10000 }).status === 0; } catch (err) { return false; }
}

const ends = (value, suffix) => typeof value === 'string' && value.replace(/\\/g, '/').endsWith(suffix);

/** Problems with how the Jest configuration wires the guard (empty when it is as reviewed). */
function configProblems(globalConfig, contexts) {
  const problems = [];
  const reporters = (globalConfig.reporters || []).map((r) => (Array.isArray(r) ? r[0] : r));
  if (!reporters.some((r) => ends(r, 'tests/networkGuard/reporter.js'))) problems.push('the guard reporter is not configured');
  const configs = [...(contexts || [])].map((c) => c && c.config).filter(Boolean);
  if (!configs.length) problems.push('no project configuration');
  for (const cfg of configs) {
    if (!ends((cfg.setupFiles || [])[0], 'tests/networkGuard/setup.js')) problems.push('setupFiles does not start with tests/networkGuard/setup.js');
    if (!ends((cfg.setupFilesAfterEnv || [])[0], 'tests/networkGuard/afterEnv.js')) problems.push('setupFilesAfterEnv does not start with tests/networkGuard/afterEnv.js');
    if (!ends(cfg.globalSetup || globalConfig.globalSetup, 'tests/networkGuard/globalSetup.js')) problems.push('globalSetup is not tests/networkGuard/globalSetup.js');
    if (!/jest-environment-node/.test(String(cfg.testEnvironment || ''))) problems.push(`unexpected testEnvironment ${cfg.testEnvironment}`);
  }
  return [...new Set(problems)];
}

class NetworkGuardReporter {
  constructor(globalConfig) {
    this.globalConfig = globalConfig;
    this.rootDir = globalConfig.rootDir;
  }

  onRunComplete(contexts, results) {
    try {
      const base = path.join(this.rootDir, 'tmp', 'network-guard');
      const start = readJson(path.join(base, 'start.json'));
      const runDir = process.env.NETWORK_GUARD_RUN_DIR;
      const runDirExists = Boolean(runDir && fs.existsSync(runDir));
      const lines = [];
      let malformedLines = 0;
      if (runDirExists) {
        for (const f of fs.readdirSync(runDir).filter((n) => n.endsWith('.jsonl'))) {
          for (const raw of fs.readFileSync(path.join(runDir, f), 'utf8').split('\n')) {
            if (!raw.trim()) continue;
            try { lines.push(JSON.parse(raw)); } catch (err) { malformedLines += 1; }
          }
        }
      }
      const rel = (r) => path.relative(this.rootDir, r.testFilePath);
      const executedFiles = results.testResults.map(rel);
      // Files in which Jest skipped every test: afterAll never runs there, so
      // they have no file-end. Only a clean all-skipped result qualifies; a
      // file that failed to load or failed a test is never exempt.
      const allSkippedFiles = results.testResults
        .filter((r) => r.skipped === true && !r.testExecError && r.numFailingTests === 0 && r.numPassingTests === 0)
        .map(rel);
      const fileResults = {};
      for (const r of results.testResults) {
        fileResults[rel(r)] = {
          passed: r.numPassingTests, failed: r.numFailingTests, skipped: r.numPendingTests + (r.numTodoTests || 0),
          suiteSkipped: r.skipped === true, execError: Boolean(r.testExecError),
        };
      }
      const environment = {
        node: process.version, platform: process.platform, ci: isCI(process.env),
        ffmpeg: hasTool('ffmpeg'), ffprobe: hasTool('ffprobe'), testDatabase: Boolean(process.env.TEST_DATABASE_URL),
        note: 'Tests gated on ffmpeg/ffprobe or a test database are skipped where these are false; compare per-file counts only between runs with the same environment.',
      };
      let canaryManifest = null;
      let canaryManifestError = null;
      try { canaryManifest = loadManifest(); } catch (err) { canaryManifestError = err.message; }
      const canaryWitness = runDirExists ? readJson(path.join(runDir, 'canary-witness.json')) : null;
      const report = buildReport({
        start, envRunId: process.env.NETWORK_GUARD_RUN_ID, runDirExists, lines, malformedLines, executedFiles, allSkippedFiles,
        fileResults, environment, configProblems: configProblems(this.globalConfig, contexts), canaryManifest, canaryManifestError, canaryWitness,
      });
      fs.mkdirSync(base, { recursive: true });
      writeAtomic(path.join(base, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      writeAtomic(path.join(base, 'summary.md'), renderSummary(report));
      const n = report.attempts.total;
      const findingCounts = Object.entries(report.findings).filter(([, f]) => f.count).map(([k, f]) => `${k} ${f.count}`);
      process.stderr.write(`\n[network guard] ${report.status}: ${report.instrumentedFiles}/${report.executedFiles} files instrumented; `
        + `${n} external attempt(s)${report.attempts.hosts.length ? ` to ${report.attempts.hosts.map((h) => h.host).join(', ')}` : ''} `
        + `(report-only). Report: tmp/network-guard/report.json\n`);
      process.stderr.write(`[network guard] canaries: ${report.canary.ok ? 'verified' : `FAILED (${report.canary.issues.join('; ')})`}; findings: ${findingCounts.length ? findingCounts.join(', ') : 'none'}\n`);
      if (report.issues.length) process.stderr.write(`[network guard] integrity issues: ${report.issues.join('; ')}\n`);
    } catch (err) {
      process.stderr.write(`[network guard] could not write the report: ${err.message}\n`);
    }
  }
}

module.exports = NetworkGuardReporter;
module.exports.configProblems = configProblems;
