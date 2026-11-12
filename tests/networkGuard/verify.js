'use strict';

/**
 * CI step after the tests: node tests/networkGuard/verify.js
 * Fails (exit 1) when the network guard report is missing, stale,
 * unfinalized or incomplete, or when the guard was disabled in CI. In
 * Stage 1, recorded attempts do not fail it; they are listed in the summary
 * (also appended to $GITHUB_STEP_SUMMARY when set).
 *
 * node tests/networkGuard/verify.js --focused
 * For a job that runs a fixed few test files, so the canary file is not in
 * the run. It waives only the requirement that the canaries ran; a recorded
 * external attempt fails it. The flag is the only way in (no environment
 * variable), and any other argument is refused.
 */

const fs = require('fs');
const path = require('path');
const { verifyReport, renderSummary } = require('./report');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
}

function main(rootDir = path.resolve(__dirname, '..', '..'), env = process.env, argv = []) {
  const unknown = argv.filter((a) => a !== '--focused');
  if (unknown.length) {
    process.stderr.write(`verify.js: unknown argument ${JSON.stringify(unknown[0])} (only --focused is accepted)\n`);
    return 1;
  }
  const focused = argv.includes('--focused');
  const base = path.join(rootDir, 'tmp', 'network-guard');
  const start = readJson(path.join(base, 'start.json'));
  const report = readJson(path.join(base, 'report.json'));
  const verdict = verifyReport({ start, report, env, focused });
  const summary = renderSummary(report, verdict, { focused });
  process.stdout.write(summary);
  if (env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary); } catch (err) { process.stderr.write(`could not write the step summary: ${err.message}\n`); }
  }
  return verdict.ok ? 0 : 1;
}

if (require.main === module) process.exitCode = main(undefined, undefined, process.argv.slice(2));
module.exports = { main };
