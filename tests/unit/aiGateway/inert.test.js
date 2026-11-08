'use strict';

/**
 * G1 is inert: nothing in the application reaches it, and it reaches nothing
 * outside itself (no network, no provider SDK, no models, no environment).
 *
 * 1. Wiring: no source file outside src/aiGateway (src, scripts, lambda,
 *    frontend/src) references it.
 * 2. Behaviour, checked in a separate real Node process (outside Jest's
 *    module system): every module load is recorded, network entry points and
 *    process.env reads are trapped, and a full authorize -> dispatch ->
 *    outcome flow is run. The test asserts what actually happened.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../../..');
const GATEWAY = path.join(ROOT, 'src/aiGateway');

function listFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (/\.(c|m)?jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('G1 gateway core is inert', () => {
  test('no file outside src/aiGateway references it', () => {
    const offenders = [];
    for (const d of ['src', 'scripts', 'lambda', 'frontend/src']) {
      for (const f of listFiles(path.join(ROOT, d))) {
        if (f.startsWith(GATEWAY + path.sep)) continue;
        if (/aiGateway/.test(fs.readFileSync(f, 'utf8'))) offenders.push(path.relative(ROOT, f));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('in a real Node process: only allowed modules load; no network call; no environment read', () => {
    const probe = `
      const Module = require('module');
      const path = require('path');
      const loads = [];
      const origLoad = Module._load;
      Module._load = function (request, parent, isMain) {
        const from = parent && parent.filename ? path.relative(${JSON.stringify(GATEWAY)}, parent.filename) : '?';
        if (parent && parent.filename && parent.filename.startsWith(${JSON.stringify(GATEWAY + path.sep)})) loads.push(from + ' -> ' + request);
        return origLoad.apply(this, arguments);
      };
      const network = [];
      const trap = (name) => function () { network.push(name); throw new Error('network blocked: ' + name); };
      for (const [mod, fns] of [['net', ['connect', 'createConnection']], ['tls', ['connect']], ['http', ['request', 'get']], ['https', ['request', 'get']], ['dns', ['lookup', 'resolve']]]) {
        const m = require(mod);
        for (const fn of fns) m[fn] = trap(mod + '.' + fn);
      }
      globalThis.fetch = trap('fetch');
      const envReads = [];
      const realEnv = process.env;
      process.env = new Proxy({}, { get: (_t, k) => { if (typeof k === 'string') envReads.push(k); return undefined; }, has: (_t, k) => { envReads.push(String(k)); return false; } });

      const g = (f) => require(path.join(${JSON.stringify(GATEWAY)}, f));
      for (const f of require('fs').readdirSync(${JSON.stringify(GATEWAY)}).filter((x) => x.endsWith('.js'))) g(f);

      // a complete flow through every core module
      const { createReferenceLedger } = g('memoryLedger.js');
      const { createDispatcher } = g('dispatcher.js');
      const { createBodyIntake } = g('bodyReader.js');
      const { effectiveState } = g('stopState.js');
      const { resolveOperation } = g('operationCatalog.js');
      const { sha256Hex } = g('canonical.js');
      let now = 1762500000000;
      const clock = { now: () => now };
      let applied = null;
      const readSafety = () => ({ state: effectiveState({ db: { readable: true, state: 'RELEASED', version: 1, readAt: now, pauses: {} }, local: { readable: true, stopped: false, readAt: now }, ack: { version: applied }, now }), version: 1 });
      const ledger = createReferenceLedger({ clock, caps: { dailyMicros: 1e9, imageDailyMicros: 1e9 }, readSafety });
      let forwards = 0;
      const files = new Map();
      const spool = { create: () => ({ id: 1 }), append: () => {}, finish: () => {}, remove: () => {}, removeAll: () => {} };
      const d = createDispatcher({ ledger, bodyIntake: createBodyIntake({ spoolStore: spool }), readSafety, clock, forward: async () => { forwards += 1; return { status: 200, resultPresent: true }; }, ackSink: () => {} });
      const ackOnce = d.onSafetyChange(); applied = ackOnce.version; d.onSafetyChange();
      (async () => {
        const json = { model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [] };
        const raw = Buffer.from(JSON.stringify(json));
        const r = resolveOperation({ host: 'api.anthropic.com', method: 'POST', path: '/v1/messages' });
        const a = await ledger.authorize({ callerClass: 'api', callerInstance: 'probe', provider: 'anthropic', operation: 'anthropic.messages', model: json.model,
          job: { logicalKey: 'probe', attempt: 1 }, reservation: { estimateMicros: 1, day: 'd' }, body: { sha256: sha256Hex(raw), bytes: raw.length },
          billingFields: r.operation.billingFields(json, r.params), billingHeaders: {} });
        async function* src() { yield raw; }
        const out = await d.handleSubmission({ permitId: a.permit.id, secret: a.secret, callerClass: 'api', host: 'api.anthropic.com', method: 'POST', path: '/v1/messages', headers: { 'content-type': 'application/json' }, contentLength: raw.length, body: src() });
        process.env = realEnv;
        process.stdout.write(JSON.stringify({ loads, network, envReads, forwards, outcome: out.outcome && out.outcome.phase }));
      })().catch((e) => { process.env = realEnv; process.stdout.write(JSON.stringify({ error: e.message })); });
    `;
    const out = JSON.parse(execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8', env: { PATH: process.env.PATH } }));
    expect(out.error).toBeUndefined();
    expect(out.outcome).toBe('provider_succeeded');
    expect(out.forwards).toBe(1);   // only the injected stub was called
    expect(out.network).toEqual([]); // no real network entry point was touched
    expect(out.envReads).toEqual([]); // the gateway never reads the environment

    // the probe really observed the module graph (not an empty pass)
    expect(out.loads.length).toBeGreaterThan(10);
    expect(out.loads).toContain('dispatcher.js -> ./outcome');
    expect(out.loads).toContain('fsStores.js -> fs');
    const ALLOWED_BUILTINS = new Set(['crypto', 'fs', 'path']);
    const external = out.loads
      .map((l) => l.split(' -> ')[1])
      .filter((req) => !req.startsWith('./'));
    for (const req of external) expect(ALLOWED_BUILTINS.has(req)).toBe(true);
    // the filesystem is used only by the filesystem stores
    const fsUsers = out.loads.filter((l) => l.endsWith(' -> fs')).map((l) => l.split(' -> ')[0]);
    expect([...new Set(fsUsers)]).toEqual(['fsStores.js']);
  });
});
