'use strict';

/**
 * Jest `setupFilesAfterEnv` entry (listed first): attributes attempts to the
 * running test, and writes a heartbeat when the test file starts and a
 * file-end record (with this file's attempt count) when it finishes. The
 * reporter uses them to prove every test file was instrumented and no event
 * was lost; a missing heartbeat or file-end makes the run "incomplete",
 * never "zero attempts".
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
  hooks: core.hookStatus(), reinstalled: (state.lastInstall && state.lastInstall.reinstalled) || [], at: Date.now(),
});

beforeEach(() => { state.context.testName = expect.getState().currentTestName || null; });
afterEach(() => { state.context.testName = null; });
afterAll(() => {
  write({
    type: 'file-end', testPath, pid: process.pid, events: state.fileCounts[testPath] || 0,
    hooks: core.hookStatus(), sinkErrors: state.sinkErrors || 0, at: Date.now(),
  });
});
