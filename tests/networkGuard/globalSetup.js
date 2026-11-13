'use strict';

/**
 * Jest `globalSetup` for the network guard: clears the previous run's report,
 * refuses NETWORK_GUARD=off in CI, handles proxy settings (Stage 3a: refused
 * in CI; removed and recorded by name locally, before any worker starts),
 * refuses a non-loopback test database in CI, creates this run's event
 * directory and writes a start marker. The workers learn the directory and
 * run id through the environment, which they inherit from this process.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const proxyEnv = require('./proxyEnv');
const registry = require('./registry');

function isCI(env) {
  return Boolean((env.CI && env.CI !== 'false' && env.CI !== '0') || env.GITHUB_ACTIONS === 'true');
}

function prepare({ rootDir, env = process.env, execArgv = process.execArgv }) {
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
  // Proxy settings: names only, never values.
  const proxyFound = proxyEnv.findProxySettings(env, execArgv);
  if (proxyFound.length && isCI(env)) {
    throw new Error(`Proxy settings are not allowed in CI test runs (Jest network guard): ${proxyFound.join(', ')}`);
  }
  const { removed, unremovable } = proxyEnv.sanitize(env, execArgv);
  if (unremovable.length) {
    throw new Error(`The Jest network guard cannot remove ${unremovable.join(', ')} (Node passes it to every worker); run without it.`);
  }
  if (isCI(env)) {
    const problems = registry.ciEndpointProblems(env);
    if (problems.length) throw new Error(`Jest network guard: ${problems.join('; ')}`);
  }
  const runId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const runDir = path.join(base, `run-${runId}`);
  fs.mkdirSync(runDir);
  const mode = requested === 'off' ? 'off' : 'report';
  fs.writeFileSync(path.join(base, 'start.json'), `${JSON.stringify({ runId, startedAt: new Date().toISOString(), mode, requestedMode: requested, ci: isCI(env), proxy: { removed } }, null, 2)}\n`);
  env.NETWORK_GUARD_RUN_DIR = runDir;
  env.NETWORK_GUARD_RUN_ID = runId;
  env.NETWORK_GUARD_ROOT = rootDir;
  return { runId, runDir, base, mode, proxyRemoved: removed };
}

module.exports = async function networkGuardGlobalSetup(globalConfig) {
  prepare({ rootDir: globalConfig.rootDir });
};
module.exports.prepare = prepare;
module.exports.isCI = isCI;
