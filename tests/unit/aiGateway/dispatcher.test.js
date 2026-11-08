'use strict';

const { createDispatcher } = require('../../../src/aiGateway/dispatcher');
const { createReferenceLedger } = require('../../../src/aiGateway/memoryLedger');
const { createBodyIntake } = require('../../../src/aiGateway/bodyReader');
const { resolveOperation } = require('../../../src/aiGateway/operationCatalog');
const { sha256Hex } = require('../../../src/aiGateway/canonical');
const {
  makeClock, makeRng, microYield, makeSafety, anthropicCall, deterministicBytes, createMemSpoolStore, sourceOf, DAY,
} = require('./_harness');

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

function build({ yieldFn, forwardImpl, seed = 1 } = {}) {
  const clock = makeClock();
  const safety = makeSafety(clock);
  const ledger = createReferenceLedger({
    clock, caps: { dailyMicros: 1e12, imageDailyMicros: 1e12 }, readSafety: safety.read,
    randomBytes: deterministicBytes(seed), yieldFn,
  });
  const forwardCalls = [];
  const acks = [];
  const forward = (args) => {
    forwardCalls.push(args.status ? { status: true } : { id: args.permit.id, headers: args.headers });
    return forwardImpl ? forwardImpl(args) : Promise.resolve({ status: 200, resultPresent: true });
  };
  const dispatcher = createDispatcher({
    ledger, bodyIntake: createBodyIntake({ spoolStore: createMemSpoolStore() }),
    readSafety: safety.read, forward, clock, ackSink: (a) => acks.push(a),
  });
  safety.ackVersion = () => dispatcher.appliedVersion();
  return { clock, safety, ledger, dispatcher, forwardCalls, acks };
}

function boot(ctx) {
  ctx.dispatcher.onSafetyChange(); // boot: unacknowledged -> applied as stopped, version recorded
  ctx.dispatcher.onSafetyChange(); // acknowledged + released -> released
}

async function authorized(ctx, opts) {
  const call = anthropicCall(opts);
  const a = await ctx.ledger.authorize(call.authorizeInput);
  if (!a.ok) throw new Error(`authorize failed: ${a.code}`);
  return { ...a, call, req: (over) => call.request(a.permit, a.secret, over) };
}

describe('dispatcher: boot and normal flow', () => {
  test('stopped at boot until a safety state has been read and applied', async () => {
    const ctx = build();
    expect(ctx.dispatcher.stopApplied()).toBe(true);
    const r = await ctx.dispatcher.handleSubmission({ permitId: 'x' });
    expect(r).toEqual({ forwarded: false, code: 'STOPPED' });
    expect(ctx.forwardCalls).toHaveLength(0);
  });

  test('the exact request is forwarded once, without caller credentials, and its outcome recorded', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    const r = await ctx.dispatcher.handleSubmission(a.req());
    expect(r.forwarded).toBe(true);
    expect(r.outcome.phase).toBe('provider_succeeded');
    expect(ctx.forwardCalls).toHaveLength(1);
    expect(ctx.forwardCalls[0].headers).toEqual({ 'content-type': 'application/json', 'anthropic-version': '2023-06-01' });
    expect(ctx.ledger.rows()[0].phase).toBe('provider_succeeded');
  });

  test('a tampered body, wrong secret or reused permit never reaches forward', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    const tampered = Buffer.from(a.call.raw);
    tampered[5] ^= 1;
    expect((await ctx.dispatcher.handleSubmission(a.req({ body: sourceOf(tampered) }))).code).toBe('BODY_HASH_MISMATCH');
    const b = await authorized(ctx, { logicalKey: 'k2' });
    expect((await ctx.dispatcher.handleSubmission(b.req({ secret: '0'.repeat(64) }))).code).toBe('PERMIT_SECRET_MISMATCH');
    const c = await authorized(ctx, { logicalKey: 'k3' });
    expect((await ctx.dispatcher.handleSubmission(c.req())).forwarded).toBe(true);
    expect((await ctx.dispatcher.handleSubmission(c.req())).code).toBe('PERMIT_USED');
    expect(ctx.forwardCalls).toHaveLength(1);
    // refused requests are recorded as never sent
    const phases = ctx.ledger.rows().map((r) => r.phase);
    expect(phases).toEqual(['not_sent', 'not_sent', 'provider_succeeded']);
  });
});

describe('dispatcher: Stop at each point of the sequence', () => {
  test('Stop before the request arrives: refused, permit consumed as not_sent, nothing forwarded', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    ctx.safety.stopDb();
    ctx.dispatcher.onSafetyChange();
    expect((await ctx.dispatcher.handleSubmission(a.req())).code).toBe('STOPPED');
    expect(ctx.forwardCalls).toHaveLength(0);
    expect(ctx.ledger.rows()[0].phase).toBe('not_sent');
  });

  test('Stop applied after the ledger dispatch but before forward: not forwarded, proven not_sent', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    const orig = ctx.ledger.dispatch;
    ctx.ledger.dispatch = async (...args) => {
      const r = await orig(...args);
      ctx.safety.stopDb();
      ctx.dispatcher.onSafetyChange(); // applied between T2 and the forward decision
      return r;
    };
    expect((await ctx.dispatcher.handleSubmission(a.req())).code).toBe('STOPPED_BEFORE_FORWARD');
    expect(ctx.forwardCalls).toHaveLength(0);
    expect(ctx.ledger.rows()[0].phase).toBe('not_sent');
  });

  test('database Stop not yet applied locally still blocks the forward (most restrictive wins)', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    const orig = ctx.ledger.dispatch;
    ctx.ledger.dispatch = async (...args) => { const r = await orig(...args); ctx.safety.stopDb(); return r; };
    expect((await ctx.dispatcher.handleSubmission(a.req())).code).toBe('STOPPED_BEFORE_FORWARD');
    expect(ctx.forwardCalls).toHaveLength(0);
  });

  test('a request forwarded before Stop stays in flight, appears in the acknowledgement, and is never called not_sent', async () => {
    let finish;
    const ctx = build({ forwardImpl: () => new Promise((_, reject) => { finish = reject; }) });
    boot(ctx);
    const a = await authorized(ctx);
    const p = ctx.dispatcher.handleSubmission(a.req());
    await microYield(30);
    expect(ctx.forwardCalls).toHaveLength(1);
    ctx.safety.stopDb();
    const ack = ctx.dispatcher.onSafetyChange();
    expect(ack.inflightAtApply.map((x) => x.permitId)).toEqual([a.permit.id]);
    finish(Object.assign(new Error('reset'), { code: 'ECONNRESET' }));
    const r = await p;
    expect(r.outcome.phase).toBe('unknown');
    expect(ctx.ledger.rows()[0].phase).toBe('unknown');
  });

  test('a local emergency stop blocks submissions even when the database says released', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    ctx.safety.local.stopped = true;
    ctx.dispatcher.onSafetyChange();
    expect((await ctx.dispatcher.handleSubmission(a.req())).code).toBe('STOPPED');
    expect(ctx.forwardCalls).toHaveLength(0);
  });

  test('unverified safety state (database unreadable, or the reader throws) refuses submissions', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    ctx.safety.db = { readable: false };
    expect((await ctx.dispatcher.handleSubmission(a.req())).code).toBe('STOPPED');
    const ctx2 = build();
    boot(ctx2);
    const b = await authorized(ctx2);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    ctx2.dispatcher = createDispatcher({
      ledger: ctx2.ledger, bodyIntake: createBodyIntake({ spoolStore: createMemSpoolStore() }),
      readSafety: () => { throw new Error('db down'); }, forward: () => { throw new Error('must not be called'); }, clock: ctx2.clock,
    });
    ctx2.dispatcher.onSafetyChange();
    expect((await ctx2.dispatcher.handleSubmission(b.req())).code).toBe('STOPPED');
    spy.mockRestore();
  });

  test('Resume replays nothing: refused permits stay not_sent and cannot be reused', async () => {
    const ctx = build();
    boot(ctx);
    const a = await authorized(ctx);
    ctx.safety.stopDb();
    ctx.dispatcher.onSafetyChange();
    await ctx.dispatcher.handleSubmission(a.req());
    ctx.safety.releaseDb();
    ctx.dispatcher.onSafetyChange();
    ctx.dispatcher.onSafetyChange();
    expect((await ctx.dispatcher.handleSubmission(a.req())).code).toBe('PERMIT_USED');
    expect(ctx.forwardCalls).toHaveLength(0);
    expect(ctx.ledger.rows()[0].phase).toBe('not_sent');
  });
});

describe('dispatcher: status reads for submitted tasks', () => {
  function runwayCall(ledger) {
    const json = { model: 'gen3a_turbo', promptText: 'drift', promptImage: 'https://bucket.example/a.jpg', duration: 5 };
    const raw = Buffer.from(JSON.stringify(json));
    const resolved = resolveOperation({ host: 'api.dev.runwayml.com', method: 'POST', path: '/v1/image_to_video' });
    return ledger.authorize({
      callerClass: 'worker', callerInstance: 'w:1:b', provider: 'runway', operation: 'runway.image_to_video', model: 'gen3a_turbo',
      job: { logicalKey: 'video-1', attempt: 1 }, reservation: { estimateMicros: 500_000, day: DAY },
      body: { sha256: sha256Hex(raw), bytes: raw.length }, billingFields: resolved.operation.billingFields(json, resolved.params),
      billingHeaders: { 'x-runway-version': '2024-11-06' },
    }).then((a) => ({ a, raw }));
  }

  test('status of an accepted task passes under Stop; unknown tasks and unverified state are refused', async () => {
    const ctx = build({ forwardImpl: (args) => Promise.resolve(args.status ? { status: 200 } : { status: 200, resultPresent: true, taskId: 'task-1' }) });
    boot(ctx);
    const { a, raw } = await runwayCall(ctx.ledger);
    const r = await ctx.dispatcher.handleSubmission({
      permitId: a.permit.id, secret: a.secret, callerClass: 'worker', host: 'api.dev.runwayml.com', method: 'POST',
      path: '/v1/image_to_video', headers: { 'content-type': 'application/json', 'x-runway-version': '2024-11-06' },
      contentLength: raw.length, body: sourceOf(raw),
    });
    expect(r.outcome.phase).toBe('accepted');
    ctx.safety.stopDb();
    ctx.dispatcher.onSafetyChange();
    const status = (taskId) => ctx.dispatcher.handleStatus({ host: 'api.dev.runwayml.com', method: 'GET', path: `/v1/tasks/${taskId}` });
    expect((await status('task-1')).forwarded).toBe(true);
    expect((await status('task-999')).code).toBe('TASK_UNKNOWN');
    ctx.safety.db = { readable: false };
    expect((await status('task-1')).forwarded).toBe(true); // cached by this gateway
    expect((await status('task-2')).code).toBe('STATUS_UNVERIFIED_STATE');
    expect((await ctx.dispatcher.handleStatus({ host: 'api.anthropic.com', method: 'POST', path: '/v1/messages' })).code).toBe('NOT_A_STATUS_READ');
  });
});

describe('dispatcher: no forward after the Stop is applied (1,000 randomized interleavings)', () => {
  test('across seeds, every forward precedes the apply turn; forwarded requests are never not_sent', async () => {
    let checkedForwards = 0;
    let checkedRefusals = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const rng = makeRng(seed);
      const ctx = build({
        seed,
        yieldFn: () => microYield(Math.floor(rng() * 6)),
        forwardImpl: async () => {
          await microYield(Math.floor(rng() * 8));
          const roll = rng();
          if (roll < 0.15) throw Object.assign(new Error('reset'), { code: 'ECONNRESET' });
          if (roll < 0.25) return { status: 429 };
          return { status: 200, resultPresent: true };
        },
      });
      boot(ctx);
      const calls = await Promise.all(Array.from({ length: 6 }, (_, i) => authorized(ctx, { logicalKey: `s${seed}-${i}` })));
      let ack = null;
      const stopper = (async () => {
        await microYield(Math.floor(rng() * 60));
        ctx.safety.stopDb();
        ack = ctx.dispatcher.onSafetyChange();
      })();
      await Promise.all([...calls.map((c) => ctx.dispatcher.handleSubmission(c.req())), stopper]);

      const trace = ctx.dispatcher.trace();
      const apply = trace.find((e) => e.type === 'apply_stop' && e.version === ctx.safety.db.version);
      expect(apply).toBeDefined();
      const forwardsAfter = trace.filter((e) => e.type === 'forward' && e.n > apply.n);
      expect(forwardsAfter).toHaveLength(0);

      const forwarded = new Set(ctx.forwardCalls.map((f) => f.id));
      for (const row of ctx.ledger.rows()) {
        if (forwarded.has(row.id)) {
          expect(row.phase).not.toBe('not_sent');
          checkedForwards += 1;
        } else {
          expect(['not_sent']).toContain(row.phase);
          checkedRefusals += 1;
        }
      }
      // the acknowledgement lists only requests that really were forwarded
      for (const x of ack.inflightAtApply) expect(forwarded.has(x.permitId)).toBe(true);
    }
    expect(checkedForwards).toBeGreaterThan(0);
    expect(checkedRefusals).toBeGreaterThan(0);
  });
});
