'use strict';

/**
 * Jest reporter for the network guard. When the run completes it reads the
 * run's event lines, checks every executed test file was instrumented, and
 * writes tmp/network-guard/report.json and summary.md (atomically). If this
 * reporter does not run, there is no report, and the CI verify step fails.
 */

const fs = require('fs');
const path = require('path');
const { buildReport, renderSummary } = require('./report');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
}

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

class NetworkGuardReporter {
  constructor(globalConfig) {
    this.rootDir = globalConfig.rootDir;
  }

  onRunComplete(_contexts, results) {
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
      const executedFiles = results.testResults.map((r) => path.relative(this.rootDir, r.testFilePath));
      // Files in which Jest skipped every test: afterAll never runs there, so
      // they have no file-end. Only a clean all-skipped result qualifies; a
      // file that failed to load or failed a test is never exempt.
      const allSkippedFiles = results.testResults
        .filter((r) => r.skipped === true && !r.testExecError && r.numFailingTests === 0 && r.numPassingTests === 0)
        .map((r) => path.relative(this.rootDir, r.testFilePath));
      const report = buildReport({ start, envRunId: process.env.NETWORK_GUARD_RUN_ID, runDirExists, lines, malformedLines, executedFiles, allSkippedFiles });
      fs.mkdirSync(base, { recursive: true });
      writeAtomic(path.join(base, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      writeAtomic(path.join(base, 'summary.md'), renderSummary(report));
      const n = report.attempts.total;
      process.stderr.write(`\n[network guard] ${report.status}: ${report.instrumentedFiles}/${report.executedFiles} files instrumented; `
        + `${n} external attempt(s)${report.attempts.hosts.length ? ` to ${report.attempts.hosts.map((h) => h.host).join(', ')}` : ''} `
        + `(report-only). Report: tmp/network-guard/report.json\n`);
      if (report.issues.length) process.stderr.write(`[network guard] integrity issues: ${report.issues.join('; ')}\n`);
    } catch (err) {
      process.stderr.write(`[network guard] could not write the report: ${err.message}\n`);
    }
  }
}

module.exports = NetworkGuardReporter;
