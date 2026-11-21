'use strict';

/**
 * Jest `setupFiles` entry: installs the network guard in this worker before
 * each test file (so it is back after a worker is recycled), activates the
 * endpoint registry, and removes proxy settings from this test file's
 * environment (recording, by name only, any that reached it: globalSetup
 * should already have removed them before the workers started). The guard is
 * report-only: attempts and findings are recorded and the call proceeds
 * unchanged. NETWORK_GUARD=off disables it locally; globalSetup refuses that
 * in CI.
 */

const fs = require('fs');
const path = require('path');
const core = require('./core');
const registry = require('./registry');
const proxyEnv = require('./proxyEnv');

const requested = String(process.env.NETWORK_GUARD || 'report').toLowerCase();
const mode = requested === 'off' ? 'off' : 'report'; // Stages 1 to 3a: report-only, whatever else is requested
const runDir = process.env.NETWORK_GUARD_RUN_DIR || null;
const state = core.getState();

function writeLine(obj) {
  if (!runDir) return false;
  try {
    fs.appendFileSync(path.join(runDir, `events-${process.pid}.jsonl`), `${JSON.stringify(obj)}\n`);
    return true;
  } catch (err) {
    state.sinkErrors = (state.sinkErrors || 0) + 1;
    process.stderr.write(`[networkGuard] could not write to the run directory: ${err.message}\n`);
    return false;
  }
}

// Proxy settings that reached this test file (names only), then removed from its environment.
state.proxyFound = proxyEnv.findProxySettings(process.env, process.execArgv);
proxyEnv.sanitize(process.env, []);

state.writeLine = writeLine;
// Built in this test file's environment, so Jest maps it with this file's
// source maps (see core.captureStack).
state.captureStack = () => new Error().stack;
state.runDir = runDir;
state.requestedMode = requested;
state.jestMode = mode;
state.context = { testPath: null, testName: '(setup)' };
try {
  state.registryDiagnostics = registry.activate({ env: process.env });
} catch (err) {
  state.registryDiagnostics = { error: err.message };
  process.stderr.write(`[networkGuard] endpoint registry: ${err.message}\n`);
}
state.lastInstall = mode === 'off' ? { reinstalled: [], status: core.hookStatus() }
  : core.install({ mode: 'report', allowHosts: core.loadAllowlist(), sink: writeLine });
