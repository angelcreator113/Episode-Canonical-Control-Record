'use strict';

/**
 * Jest `setupFilesAfterEnv` entry (listed first): attributes attempts to the
 * running test, and writes a heartbeat when the test file starts and a
 * file-end record (with this file's event count) when it finishes. The
 * reporter uses them to prove every test file was instrumented and no event
 * was lost; a missing heartbeat or file-end makes the run "incomplete",
 * never "zero attempts".
 *
 * Stage 3a: the heartbeat also records proxy settings that reached this file
 * (names only) and the endpoint registry's diagnostics, and every test is
 * checked before and after it runs: a hook found missing is a "tamper"
 * record (the run is incomplete) and is put back.
 */

const path = require('path');
const core = require('./core');

const state = core.getState();
const root = process.env.NETWORK_GUARD_ROOT || process.cwd();
const testPath = path.relative(root, expect.getState().testPath || '') || '(unknown)';
const write = state.writeLine || (() => false);

state.context = { testPath, testName: null };
state.fileCounts[testPath] = 0;

write({
  type: 'heartbeat', testPath, pid: process.pid, mode: state.jestMode || 'unknown', requestedMode: state.requestedMode || null,
  hooks: core.hookStatus(), reinstalled: (state.lastInstall && state.lastInstall.reinstalled) || [],
  proxyFound: state.proxyFound || [], registry: state.registryDiagnostics || null, at: Date.now(),
});

function checkHooks(phase) {
  if (state.jestMode === 'off') return;
  const status = core.hookStatus();
  // fetch is excluded: tests legitimately replace global.fetch with a mock, and a
  // real fetch still connects through the socket hook. It is checked at file start.
  const missing = Object.keys(status).filter((k) => k !== 'fetch' && status[k] !== true);
  if (!missing.length) return;
  write({ type: 'tamper', testPath, testName: state.context.testName, phase, hooks: missing, pid: process.pid, at: Date.now() });
  core.install({ mode: 'report' });
}

beforeEach(() => {
  state.context.testName = expect.getState().currentTestName || null;
  checkHooks('before');
});
afterEach(() => {
  checkHooks('after');
  state.context.testName = null;
});
afterAll(() => {
  write({
    type: 'file-end', testPath, pid: process.pid, events: state.fileCounts[testPath] || 0,
    hooks: core.hookStatus(), sinkErrors: state.sinkErrors || 0, at: Date.now(),
  });
});
