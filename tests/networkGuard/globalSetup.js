'use strict';

/**
 * Jest `globalSetup` for the network guard: refuses NETWORK_GUARD=off in CI,
 * clears the previous run's report, creates this run's event directory and
 * writes a start marker. The workers learn the directory and run id through
 * the environment, which they inherit from this process.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function isCI(env) {
  return Boolean((env.CI && env.CI !== 'false' && env.CI !== '0') || env.GITHUB_ACTIONS === 'true');
}

function prepare({ rootDir, env = process.env }) {
  const requested = String(env.NETWORK_GUARD || 'report').toLowerCase();
  const base = path.join(rootDir, 'tmp', 'network-guard');
  fs.mkdirSync(base, { recursive: true });
  // Clear the previous run first, so a refused or failed run leaves no report to be mistaken for this one.
  for (const entry of fs.readdirSync(base)) {
    if (entry === 'report.json' || entry === 'summary.md' || entry === 'start.json' || entry.startsWith('run-')) {
      fs.rmSync(path.join(base, entry), { recursive: true, force: true });
    }
  }
  if (requested === 'off' && isCI(env)) {
    throw new Error('NETWORK_GUARD=off is not allowed in CI: the Jest network guard must run.');
  }
  const runId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const runDir = path.join(base, `run-${runId}`);
  fs.mkdirSync(runDir);
  const mode = requested === 'off' ? 'off' : 'report';
  fs.writeFileSync(path.join(base, 'start.json'), `${JSON.stringify({ runId, startedAt: new Date().toISOString(), mode, requestedMode: requested, ci: isCI(env) }, null, 2)}\n`);
  env.NETWORK_GUARD_RUN_DIR = runDir;
  env.NETWORK_GUARD_RUN_ID = runId;
  env.NETWORK_GUARD_ROOT = rootDir;
  return { runId, runDir, base, mode };
}

module.exports = async function networkGuardGlobalSetup(globalConfig) {
  prepare({ rootDir: globalConfig.rootDir });
};
module.exports.prepare = prepare;
module.exports.isCI = isCI;
