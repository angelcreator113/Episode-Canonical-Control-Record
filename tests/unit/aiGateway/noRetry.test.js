'use strict';

/**
 * No hidden retry paths. Runtime invariants first (the property that
 * matters): for every failure class the upstream is called exactly once, the
 * permit cannot be reused, and a new attempt of an unknown request cannot even
 * be authorized. Then a syntax-tree check that no loop or timer in the
 * gateway source wraps the forward call.
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');
const { createDispatcher } = require('../../../src/aiGateway/dispatcher');
const { createReferenceLedger } = require('../../../src/aiGateway/memoryLedger');
const { createBodyIntake } = require('../../../src/aiGateway/bodyReader');
const { makeClock, makeSafety, anthropicCall, deterministicBytes, createMemSpoolStore } = require('./_harness');

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

const FAILURES = [
  ['timeout', () => Promise.reject(Object.assign(new Error('t'), { code: 'ETIMEDOUT' })), 'unknown'],
  ['reset', () => Promise.reject(Object.assign(new Error('r'), { code: 'ECONNRESET' })), 'unknown'],
  ['429', () => Promise.resolve({ status: 429 }), 'unknown'],
  ['500', () => Promise.resolve({ status: 500 }), 'unknown'],
  ['disconnect', () => Promise.reject(Object.assign(new Error('d'), { kind: 'disconnect' })), 'unknown'],
  ['2xx without result', () => Promise.resolve({ status: 200, resultPresent: false }), 'unknown'],
  ['synchronous throw', () => { throw Object.assign(new Error('boom'), { code: 'EPIPE' }); }, 'unknown'],
  ['DNS failure (provably not sent)', () => Promise.reject(Object.assign(new Error('n'), { code: 'ENOTFOUND' })), 'not_sent'],
];

describe('no automatic retry', () => {
  test.each(FAILURES)('%s: forward called exactly once; the permit cannot be reused', async (_l, impl, phase) => {
    const clock = makeClock();
    const safety = makeSafety(clock);
    const ledger = createReferenceLedger({ clock, caps: { dailyMicros: 1e12, imageDailyMicros: 1e12 }, readSafety: safety.read, randomBytes: deterministicBytes(5) });
    let calls = 0;
    const dispatcher = createDispatcher({
      ledger, bodyIntake: createBodyIntake({ spoolStore: createMemSpoolStore() }), readSafety: safety.read, clock,
      forward: (args) => { calls += 1; return impl(args); },
    });
    safety.ackVersion = () => dispatcher.appliedVersion();
    dispatcher.onSafetyChange();
    dispatcher.onSafetyChange();

    const call = anthropicCall({ logicalKey: 'L1' });
    const a = await ledger.authorize(call.authorizeInput);
    const r = await dispatcher.handleSubmission(call.request(a.permit, a.secret));
    await new Promise((res) => setImmediate(res));
    expect(calls).toBe(1);
    expect(r.outcome.phase).toBe(phase);
    expect(r.outcome.retryAllowed).toBe(phase === 'not_sent');
    expect(ledger.rows()[0].phase).toBe(phase);

    // the same permit can never be sent again
    expect((await dispatcher.handleSubmission(call.request(a.permit, a.secret))).code).toBe('PERMIT_USED');
    expect(calls).toBe(1);

    // a new attempt needs a new permit, and is allowed only after a provably
    // unsent or confirmed-failed attempt; an unknown outcome refuses outright
    const retry = await ledger.authorize(anthropicCall({ logicalKey: 'L1', attempt: 2 }).authorizeInput);
    if (phase === 'unknown') expect(retry.code).toBe('PRIOR_ATTEMPT_UNKNOWN');
    else if (phase === 'not_sent' || phase === 'failed_confirmed') expect(retry.ok).toBe(true);
    else expect(retry.code).toBe('PRIOR_ATTEMPT_NOT_RETRYABLE');
  });
});

describe('no retry construct in the gateway source (syntax tree)', () => {
  const dir = path.join(__dirname, '../../../src/aiGateway');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  const LOOPS = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);

  function walk(node, ancestors, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node, ancestors);
    for (const [k, v] of Object.entries(node)) {
      if (k === 'parent') continue;
      if (Array.isArray(v)) v.forEach((c) => walk(c, [...ancestors, node], visit));
      else if (v && typeof v.type === 'string') walk(v, [...ancestors, node], visit);
    }
  }
  const isForwardCall = (n) => n.type === 'CallExpression'
    && ((n.callee.type === 'Identifier' && n.callee.name === 'forward')
      || (n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'forward'));

  test('forward() is never called inside a loop, a timer callback or a catch block', () => {
    let sites = 0;
    for (const f of files) {
      const ast = espree.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { ecmaVersion: 2022, sourceType: 'script' });
      walk(ast, [], (node, ancestors) => {
        if (!isForwardCall(node)) return;
        sites += 1;
        expect(ancestors.some((a) => LOOPS.has(a.type))).toBe(false);
        expect(ancestors.some((a) => a.type === 'CatchClause')).toBe(false);
        expect(ancestors.some((a) => a.type === 'CallExpression' && a.callee.type === 'Identifier' && /^(setTimeout|setInterval|setImmediate)$/.test(a.callee.name))).toBe(false);
      });
    }
    // exactly two call sites: one submission, one status read
    expect(sites).toBe(2);
  });
});
