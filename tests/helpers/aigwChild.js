'use strict';

/**
 * A separate OS process for the AI gateway G2 concurrency tests
 * (tests/integration/aigwConcurrency.integration.test.js). Each process
 * opens its own connections as the given roles, waits for a shared start
 * time, runs one scenario and prints one JSON line. Errors are reported by
 * SQLSTATE so the parent can assert on deadlocks (40P01), lock timeouts
 * (55P03) and anything unexpected. Only ever pointed at a throwaway test
 * database.
 */

const crypto = require('crypto');
const { Client } = require('pg');

const spec = JSON.parse(process.argv[2]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function payload({ key, attempt = 1, est = 1000, operation = 'anthropic.messages', day = spec.day, ttlMs = 30000 }) {
  const multipart = operation === 'removebg';
  return {
    secret_hash: crypto.randomBytes(32).toString('hex'),
    caller_class: 'worker',
    caller_instance: `child-${process.pid}`,
    provider: multipart ? 'removebg' : 'anthropic',
    operation,
    body_kind: multipart ? 'multipart' : 'json',
    model: 'm',
    logical_key: key,
    attempt,
    estimate_micros: est,
    reservation_day: day,
    ttl_ms: ttlMs,
    body_sha256: 'e'.repeat(64),
    body_bytes: 10,
    billing_fields: multipart ? null : { model: 'm' },
    billing_fields_canonical: multipart ? null : '{"model":"m"}',
  };
}

async function main() {
  const clients = {};
  for (const [kind, url] of Object.entries(spec.urls)) {
    clients[kind] = new Client({ connectionString: url });
    await clients[kind].connect();
  }
  const errors = {};
  const noteError = (err) => { errors[err.code || err.message] = (errors[err.code || err.message] || 0) + 1; };
  const fn = async (kind, sql, params) => {
    const { rows } = await clients[kind].query(sql, params);
    return rows[0].r;
  };
  const out = { pid: process.pid, results: [], errors };
  const r = rng(spec.seed || 1);
  const wait = spec.startAt - Date.now();
  if (wait > 0) await sleep(wait);
  const deadline = Date.now() + (spec.durationMs || 0);

  try {
    switch (spec.scenario) {
      case 'authorize':
        for (const p of spec.payloads) {
          try {
            out.results.push(await fn('caller', 'SELECT public.aigw_authorize($1::jsonb) AS r', [JSON.stringify(payload(p))]));
          } catch (err) { noteError(err); }
        }
        break;
      case 'dispatch':
        for (const id of spec.ids) {
          try {
            out.results.push(await fn('gateway', 'SELECT public.aigw_dispatch($1::uuid, $2, $3) AS r', [id, 'anthropic.messages', `gw-${process.pid}`]));
          } catch (err) { noteError(err); }
        }
        break;
      case 'stopper': {
        await sleep(Math.floor(r() * spec.maxDelayMs));
        out.results.push(await fn('admin', 'SELECT public.aigw_stop($1, $2) AS r', ['evoni', 'concurrency stop']));
        break;
      }
      case 'flow': {
        // authorize -> dispatch -> an outcome, repeatedly, until the deadline or the count
        let i = 0;
        while ((spec.count && i < spec.count) || (!spec.count && Date.now() < deadline)) {
          i += 1;
          const key = `${spec.prefix}-${process.pid}-${i}`;
          const operation = r() < 0.3 ? 'removebg' : 'anthropic.messages';
          try {
            const a = await fn('caller', 'SELECT public.aigw_authorize($1::jsonb) AS r', [JSON.stringify(payload({ key, operation, est: 100, ttlMs: spec.ttlMs || 30000 }))]);
            out.results.push({ step: 'authorize', ok: a.ok, code: a.code || null });
            if (!a.ok) continue;
            if (r() < 0.1) {
              const ab = await fn('caller', 'SELECT public.aigw_abandon_authorized($1::uuid, $2) AS r', [a.permit_id, 'caller_gave_up']);
              out.results.push({ step: 'abandon', ok: ab.ok, code: ab.code || null });
              continue;
            }
            if (spec.dispatchDelayMs) await sleep(Math.floor(r() * spec.dispatchDelayMs));
            const d = await fn('gateway', 'SELECT public.aigw_dispatch($1::uuid, $2, $3) AS r', [a.permit_id, operation, `gw-${process.pid}`]);
            out.results.push({ step: 'dispatch', ok: d.ok, code: d.code || null, id: a.permit_id, version: d.dispatch_version || null });
            if (!d.ok) continue;
            const x = r();
            if (x < 0.15) continue; // the outcome is lost: the sweep must make it unknown
            const phase = x < 0.25 ? 'unknown' : x < 0.5 ? 'accepted' : x < 0.8 ? 'succeeded' : 'failed_confirmed';
            const o = await fn('gateway', 'SELECT public.aigw_record_outcome($1::uuid, $2::jsonb) AS r', [a.permit_id, JSON.stringify({
              phase, billed: phase === 'succeeded' ? 'yes' : phase === 'failed_confirmed' ? 'no' : null, instance: `gw-${process.pid}`,
              task_id: phase === 'accepted' ? `t-${a.permit_id}` : null,
            })]);
            out.results.push({ step: 'outcome', ok: o.ok, code: o.code || null });
          } catch (err) { noteError(err); }
        }
        break;
      }
      case 'sweeper':
        while (Date.now() < deadline) {
          try {
            const s = await fn('gateway', "SELECT public.aigw_sweep(make_interval(secs => $1::double precision / 1000), 50) AS r", [spec.timeoutMs]);
            out.results.push({ step: 'sweep', expired: s.expired_not_sent, unknown: s.dispatching_unknown });
          } catch (err) { noteError(err); }
          await sleep(spec.everyMs || 20);
        }
        break;
      case 'reconciler':
        while (Date.now() < deadline) {
          try {
            const { rows } = await clients.inspector.query("SELECT id FROM public.aigw_permits WHERE phase = 'unknown' ORDER BY random() LIMIT 3");
            for (const row of rows) {
              const to = r() < 0.5 ? 'failed_confirmed' : 'succeeded';
              const res = await fn('admin', 'SELECT public.aigw_reconcile($1::uuid, $2::jsonb) AS r', [row.id, JSON.stringify({
                to, method: 'provider_status_read', evidence: { status: to }, billed: to === 'succeeded' ? 'yes' : 'no', reason: 'concurrency test', actor: 'evoni',
              })]);
              out.results.push({ step: 'reconcile', ok: res.ok, code: res.code || null });
            }
          } catch (err) { noteError(err); }
          await sleep(15);
        }
        break;
      case 'toggler':
        while (Date.now() < deadline) {
          try {
            const x = r();
            if (x < 0.35) {
              out.results.push({ step: 'stop', ...(await fn('admin', 'SELECT public.aigw_stop($1, $2) AS r', ['evoni', 'toggle'])) });
            } else if (x < 0.7) {
              const challengeId = crypto.randomUUID();
              const nonceHash = crypto.createHash('sha256').update(challengeId).digest('hex');
              const q = await fn('admin', 'SELECT public.aigw_request_resume($1::jsonb) AS r', [JSON.stringify({ actor: 'evoni', reason: 'toggle', challenge_id: challengeId, nonce_hash: nonceHash, ttl_seconds: 60 })]);
              if (q.ok) {
                const c = await fn('admin', 'SELECT public.aigw_confirm_resume($1::jsonb) AS r', [JSON.stringify({ actor: 'evoni', challenge_id: challengeId, nonce_hash: nonceHash, target_version: q.target_version })]);
                out.results.push({ step: 'resume', ok: c.ok, code: c.code || null });
              }
            } else {
              const svc = r() < 0.5 ? 'images' : 'writing';
              out.results.push({ step: 'pause', ...(await fn('admin', 'SELECT public.aigw_set_pause($1, $2, $3, $4) AS r', [svc, r() < 0.5, 'evoni', 'toggle'])) });
            }
            const ctl = await fn('gateway', 'SELECT public.aigw_read_control() AS r', []);
            await fn('gateway', 'SELECT public.aigw_gateway_ack($1::jsonb) AS r', [JSON.stringify({ version: ctl.version, effective: ctl.global_state, instance: 'gw-toggle' })]);
          } catch (err) { noteError(err); }
          await sleep(spec.everyMs || 10);
        }
        break;
      default:
        throw new Error(`unknown scenario ${spec.scenario}`);
    }
  } finally {
    await Promise.all(Object.values(clients).map((c) => c.end().catch(() => {})));
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ fatal: err.message, code: err.code || null })}\n`);
  process.exitCode = 1;
});
