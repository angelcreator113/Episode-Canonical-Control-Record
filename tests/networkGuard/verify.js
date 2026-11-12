'use strict';

/**
 * CI step after the tests: node tests/networkGuard/verify.js
 * Fails (exit 1) when the network guard report is missing, stale,
 * unfinalized or incomplete, or when the guard was disabled in CI. In
 * Stage 1, recorded attempts do not fail it; they are listed in the summary
 * (also appended to $GITHUB_STEP_SUMMARY when set).
 */

const fs = require('fs');
const path = require('path');
const { verifyReport, renderSummary } = require('./report');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
}

function main(rootDir = path.resolve(__dirname, '..', '..'), env = process.env) {
  const base = path.join(rootDir, 'tmp', 'network-guard');
  const start = readJson(path.join(base, 'start.json'));
  const report = readJson(path.join(base, 'report.json'));
  const verdict = verifyReport({ start, report, env });
  const summary = renderSummary(report, verdict);
  process.stdout.write(summary);
  if (env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary); } catch (err) { process.stderr.write(`could not write the step summary: ${err.message}\n`); }
  }
  return verdict.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main();
module.exports = { main };
