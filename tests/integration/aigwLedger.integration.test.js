'use strict';

/**
 * AI gateway G2: the Postgres ledger on a real, throwaway database (one per
 * file, created on the local or CI test server; never production).
 *   - the shared ledger contract (tests/unit/aiGateway/ledgerConformance.js),
 *     run through the least-privilege roles: the caller authorizes, the
 *     gateway dispatches and records, the administrator stops, resumes,
 *     sets caps and reconciles;
 *   - migration behaviour: seed STOPPED with no caps; up is idempotent;
 *     down refuses while the ledger holds rows and succeeds when empty;
 *     the operations seed equals the G1 catalogue's submission operations;
 *   - guard triggers, run as the table owner: bound fields immutable, no
 *     delete or truncate, history append-only, no skipped transition, no
 *     not_sent from dispatching without proof, settled billing changed only
 *     by reconciliation, the control version never decreasing;
 *   - fail-closed authorization details; the Resume challenge; the gateway
 *     acknowledgement.
 */

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const { shouldSkip, createAigwTestDb, urlFor } = require('../helpers/aigwTestDb');
const { defineLedgerConformance, multipartInput } = require('../unit/aiGateway/ledgerConformance');
const { anthropicCall, DAY } = require('../unit/aiGateway/_harness');
const { createPgLedger, createPgAdmin, dbStateFromControl } = require('../../src/aiGateway/pgLedger');
const { withLimits } = require('../../src/aiGateway/constants');
const { OPERATIONS } = require('../../src/aiGateway/operationCatalog');
const migration = require('../../src/migrations/20261108120000-create-aigw-ledger');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function release(admin, actor = 'evoni') {
  const challengeId = crypto.randomUUID();
  const nonceHash = sha(crypto.randomBytes(16).toString('hex'));
  const r = await admin.requestResume({ actor, reason: 'test release', challengeId, nonceHash, ttlSeconds: 60 });
  if (!r.ok) throw new Error(`resume request refused: ${r.code}`);
  const c = await admin.confirmResume({ actor, reason: 'test release', challengeId, nonceHash, targetVersion: r.target_version });
  if (!c.ok) throw new Error(`resume confirm refused: ${c.code}`);
  return c.version;
}

function ledgersFor(t) {
  const ledger = createPgLedger({
    caller: t.port('caller'), gateway: t.port('gateway'), instance: 'gw-test-1', limits: withLimits({ permitTtlMs: 1000 }),
  });
  const admin = createPgAdmin({ admin: t.port('admin') });
  return { ledger, admin };
}

const d = shouldSkip ? describe.skip : describe;

d('AI gateway G2 ledger on Postgres', () => {
  jest.setTimeout(60000);

  defineLedgerConformance('Postgres (least-privilege roles)', async () => {
    const t = await createAigwTestDb({ poolMax: 3 });
    const { ledger, admin } = ledgersFor(t);
    return {
      ledger,
      release: () => release(admin),
      stop: () => admin.stop('evoni', 'test stop'),
      setCaps: ({ dailyMicros, imageDailyMicros }) => admin.setCaps({ dailyMicros, imageDailyMicros, actor: 'evoni', reason: 'test caps' }),
      expire: () => wait(1500),
      reconcile: (id, opts) => admin.reconcile(id, opts),
      close: () => t.close(),
    };
  }, { timeout: 60000 });

  describe('migration, guards and administration', () => {
    let t;
    let ledger;
    let admin;
    beforeAll(async () => {
      t = await createAigwTestDb({ poolMax: 3 });
      ({ ledger, admin } = ledgersFor(t));
    });
    afterAll(async () => { if (t) await t.close(); });

    const su = (sql, params) => t.su.query(sql, params);
    const suError = async (sql, params) => {
      try {
        await t.su.query(sql, params);
        return 'allowed';
      } catch (err) {
        return err.message;
      }
    };

    test('seed: STOPPED, version 1, no caps, no pauses, changed by the migration', async () => {
      const c = await ledger.readControl();
      expect(c).toMatchObject({
        global_state: 'STOPPED', version: 1, daily_cap_micros: null, image_daily_cap_micros: null,
        paused: { images: false, video: false, voice: false, writing: false }, changed_by: 'migration',
      });
      expect(dbStateFromControl(c)).toMatchObject({ readable: true, state: 'STOPPED', version: 1 });
      expect(dbStateFromControl(null)).toEqual({ readable: false });
    });

    test('the operations seed is exactly the G1 catalogue\'s submission operations', async () => {
      const { rows } = await su('SELECT operation, provider, service, body_kind FROM aigw_operations ORDER BY operation');
      const expected = OPERATIONS.filter((o) => o.cls === 'submission')
        .map((o) => ({ operation: o.id, provider: o.provider, service: o.service, body_kind: o.bodyKind }))
        .sort((a, b) => a.operation.localeCompare(b.operation));
      expect(rows).toEqual(expected);
    });

    test('nothing is granted by the migration itself: PUBLIC has no table or function privilege', async () => {
      const { rows: tables } = await su(`SELECT c.relname FROM pg_class c, aclexplode(c.relacl) a
        WHERE c.relname LIKE 'aigw\\_%' AND a.grantee = 0`);
      expect(tables).toEqual([]);
      const { rows: fns } = await su(`SELECT p.proname FROM pg_proc p, aclexplode(p.proacl) a
        WHERE p.proname LIKE 'aigw\\_%' AND a.grantee = 0`);
      expect(fns).toEqual([]);
      const { rows: unacl } = await su("SELECT proname FROM pg_proc WHERE proname LIKE 'aigw\\_%' AND proacl IS NULL");
      expect(unacl).toEqual([]); // NULL acl would mean the default: EXECUTE to PUBLIC
      const { rows: definers } = await su(`SELECT proname, prosecdef, proconfig FROM pg_proc
        WHERE proname LIKE 'aigw\\_%' AND prosecdef`);
      expect(definers.length).toBeGreaterThan(15);
      for (const f of definers) expect(f.proconfig).toEqual(['search_path=pg_catalog, pg_temp']);
    });

    test('up again is a no-op: same seed, same objects, version unchanged', async () => {
      const before = await ledger.readControl();
      await migration.up(t.sequelize.getQueryInterface(), Sequelize);
      const after = await ledger.readControl();
      expect(after.version).toBe(before.version);
      expect(after.global_state).toBe(before.global_state);
      const { rows } = await su('SELECT count(*)::int AS n FROM aigw_operations');
      expect(rows[0].n).toBe(9);
    });

    describe('guards (run as the owner, past the functions)', () => {
      let permitId;
      beforeAll(async () => {
        await admin.setCaps({ dailyMicros: 10_000_000, imageDailyMicros: 5_000_000, actor: 'evoni', reason: 'guard tests' });
        await release(admin);
        const a = await ledger.authorize(anthropicCall({ logicalKey: 'guard' }).authorizeInput);
        permitId = a.permit.id;
      });

      test.each([
        ['estimate', 'UPDATE aigw_permits SET estimate_micros = 0 WHERE id = $1'],
        ['body hash', `UPDATE aigw_permits SET body_sha256 = '${'b'.repeat(64)}' WHERE id = $1`],
        ['billing fields', `UPDATE aigw_permits SET billing_fields_canonical = '{}' WHERE id = $1`],
        ['expiry', "UPDATE aigw_permits SET expires_at = expires_at + interval '1 hour' WHERE id = $1"],
        ['authorized version', 'UPDATE aigw_permits SET authorized_version = 999 WHERE id = $1'],
        ['strict', 'UPDATE aigw_permits SET strict = true WHERE id = $1'],
      ])('the %s is immutable', async (_l, sql) => {
        expect(await suError(sql, [permitId])).toMatch(/bound fields are immutable/);
      });

      test('no delete, no truncate, no deleted_at', async () => {
        expect(await suError('DELETE FROM aigw_permits WHERE id = $1', [permitId])).toMatch(/append-only/);
        expect(await suError('TRUNCATE aigw_permits CASCADE')).toMatch(/append-only|not allowed/);
        // row triggers fire only on rows: these two tables already hold some
        // (the reconciliation table is checked once it has a row, below)
        for (const tbl of ['aigw_permit_events', 'aigw_audit']) {
          expect(await suError(`DELETE FROM ${tbl}`)).toMatch(/append-only/);
          expect(await suError(`UPDATE ${tbl} SET created_at = now()`)).toMatch(/append-only/);
        }
        for (const tbl of ['aigw_permit_events', 'aigw_reconciliations', 'aigw_audit']) {
          expect(await suError(`TRUNCATE ${tbl}`)).toMatch(/append-only/);
        }
        expect(await suError('DELETE FROM aigw_control')).toMatch(/not allowed/);
        expect(await suError('TRUNCATE aigw_control CASCADE')).toMatch(/not allowed|append-only/);
      });

      test('no skipped transition; no not_sent from dispatching without proof; dispatch fields only by dispatch', async () => {
        expect(await suError("UPDATE aigw_permits SET phase = 'succeeded' WHERE id = $1", [permitId])).toMatch(/illegal transition authorized -> succeeded/);
        expect(await suError("UPDATE aigw_permits SET dispatched_by = 'x' WHERE id = $1", [permitId])).toMatch(/dispatch fields/);
        expect((await ledger.dispatch(permitId, { operation: 'anthropic.messages' })).ok).toBe(true);
        expect(await suError("UPDATE aigw_permits SET phase = 'not_sent' WHERE id = $1", [permitId])).toMatch(/only with proof/);
        expect(await suError("UPDATE aigw_permits SET dispatch_version = 1 WHERE id = $1", [permitId])).toMatch(/dispatch fields/);
      });

      test('only the gateway instance that dispatched a request can attest it was never forwarded', async () => {
        const a = await ledger.authorize(anthropicCall({ logicalKey: 'other-instance' }).authorizeInput);
        await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' });
        const other = createPgLedger({ caller: t.port('caller'), gateway: t.port('gateway'), instance: 'gw-test-2' });
        expect((await other.markNotSent(a.permit.id, 'STOPPED_BEFORE_FORWARD', { provenNotForwarded: true })).code).toBe('NOT_SENT_NOT_ALLOWED');
        await expect(other.recordOutcome(a.permit.id, { phase: 'not_sent', preSendProof: true })).rejects.toMatchObject({ code: 'NOT_SENT_REQUIRES_PROOF' });
        expect((await ledger.getPermit(a.permit.id)).phase).toBe('dispatching');
        expect((await ledger.recordOutcome(a.permit.id, { phase: 'not_sent', preSendProof: true })).ok).toBe(true);
      });

      test('a permit is inserted only as authorized and unsettled', async () => {
        const { rows: [r] } = await su('SELECT * FROM aigw_permits WHERE id = $1', [permitId]);
        const cols = Object.keys(r).filter((k) => !['id', 'created_at', 'updated_at'].includes(k));
        const vals = cols.map((k) => r[k]);
        const sql = (over) => {
          const v = cols.map((k, i) => (k in over ? over[k] : vals[i]));
          return [`INSERT INTO aigw_permits (${cols.join(',')}) VALUES (${cols.map((_k, i) => `$${i + 1}`).join(',')})`, v];
        };
        expect(await suError(...sql({ logical_key: 'ins-1', phase: 'succeeded' }))).toMatch(/inserted as authorized/);
        expect(await suError(...sql({ logical_key: 'ins-2', phase: 'authorized', dispatch_version: null, dispatched_at: null, dispatched_by: null, billed: 'yes' })))
          .toMatch(/inserted as authorized/);
      });

      test('a settled permit\'s billing changes only by reconciliation (which records evidence)', async () => {
        const a = await ledger.authorize(anthropicCall({ logicalKey: 'settle', estimateMicros: 400 }).authorizeInput);
        await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' });
        await ledger.recordOutcome(a.permit.id, { phase: 'succeeded', billed: 'unknown' });
        expect(await suError("UPDATE aigw_permits SET billed = 'no' WHERE id = $1", [a.permit.id])).toMatch(/only through reconciliation/);
        expect(await ledger.exposure({ day: DAY })).toMatchObject({ uncertain: 400 });
        const r = await admin.reconcile(a.permit.id, {
          to: 'succeeded', method: 'provider_invoice', evidence: { invoice: 'INV-1', line: 3 }, billed: 'yes', confirmedMicros: 380, reason: 'invoice line', actor: 'evoni',
        });
        expect(r.ok).toBe(true);
        expect(await ledger.exposure({ day: DAY })).toMatchObject({ uncertain: 0, confirmed: 380 });
        const { rows } = await su('SELECT method, evidence, billed_before, billed_after, decided_by FROM aigw_reconciliations WHERE permit_id = $1', [a.permit.id]);
        expect(rows).toEqual([expect.objectContaining({ method: 'provider_invoice', billed_before: 'unknown', billed_after: 'yes', evidence: { invoice: 'INV-1', line: 3 } })]);
        expect(rows[0].decided_by).toMatch(/^evoni via aigw_admin_/);
        expect(await suError('DELETE FROM aigw_reconciliations')).toMatch(/append-only/);
        expect(await suError("UPDATE aigw_reconciliations SET reason = 'changed'")).toMatch(/append-only/);
        expect((await admin.reconcile(a.permit.id, { to: 'succeeded', method: 'provider_invoice', evidence: { a: 1 }, billed: 'yes', reason: '  ', actor: 'evoni' })).code).toBe('REASON_REQUIRED');
        expect((await admin.reconcile(a.permit.id, { to: 'unknown', method: 'owner_judgement', evidence: { a: 1 }, reason: 'x', actor: 'evoni' })).code).toBe('ILLEGAL_RECONCILIATION');
      });

      test('the control version never decreases', async () => {
        expect(await suError('UPDATE aigw_control SET version = 1')).toMatch(/version can only increase/);
      });

      test('every permit change is in the event history, with the database login', async () => {
        const { rows } = await su('SELECT from_phase, to_phase, cause, actor FROM aigw_permit_events WHERE permit_id = $1 ORDER BY id', [permitId]);
        expect(rows.map((r) => [r.from_phase, r.to_phase])).toEqual([[null, 'authorized'], ['authorized', 'dispatching']]);
        expect(rows[1].actor).toMatch(/^gw-test-1 via aigw_gateway_/);
      });
    });

    describe('fail-closed authorization', () => {
      test('a paused service refuses, at authorize and at dispatch', async () => {
        const a = await ledger.authorize(anthropicCall({ logicalKey: 'pause-1' }).authorizeInput);
        expect(a.ok).toBe(true);
        expect((await admin.setPause('writing', true, 'evoni', 'pause test')).ok).toBe(true);
        expect((await ledger.authorize(anthropicCall({ logicalKey: 'pause-2' }).authorizeInput)).code).toBe('SERVICE_PAUSED');
        expect((await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' })).code).toBe('STOPPED');
        expect((await admin.setPause('writing', false, 'evoni', 'unpause')).ok).toBe(true);
        expect((await admin.setPause('nonsense', true, 'evoni', 'x')).code).toBe('SERVICE_INVALID');
      });

      test('strict work is refused even with a price catalogue id; strict multipart is refused first', async () => {
        expect((await ledger.authorize(anthropicCall({ logicalKey: 'strict-1', strict: true, priceCatalogId: 7 }).authorizeInput)).code).toBe('PRICE_NOT_VERIFIED');
        expect((await ledger.authorize(multipartInput({ logicalKey: 'strict-2', strict: true }))).code).toBe('MULTIPART_FIELDS_UNVERIFIED');
      });

      test('a multipart permit is recorded as hash-bound only; a JSON one as parsed', async () => {
        const m = await ledger.authorize(multipartInput({ logicalKey: 'mp-rec' }));
        const j = await ledger.authorize(anthropicCall({ logicalKey: 'json-rec' }).authorizeInput);
        const { rows } = await su('SELECT id, billing_fields_verification FROM aigw_permits WHERE id = ANY($1::uuid[]) ORDER BY body_kind', [[m.permit.id, j.permit.id]]);
        expect(rows.map((r) => r.billing_fields_verification)).toEqual(['parsed', 'hash_bound_only']);
        // and the table itself refuses strict hash-bound-only rows
        const { rows: [c] } = await su(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'aigw_permits_strict_needs_parsed_fields'`);
        expect(c.def).toMatch(/strict AND/);
      });

      test('caps removed again refuse again; a lower cap than the exposure refuses', async () => {
        expect((await admin.setCaps({ dailyMicros: null, imageDailyMicros: null, actor: 'evoni', reason: 'remove' })).ok).toBe(true);
        expect((await ledger.authorize(anthropicCall({ logicalKey: 'cap-1' }).authorizeInput)).code).toBe('CAP_UNAVAILABLE');
        expect((await admin.setCaps({ dailyMicros: -1, imageDailyMicros: 0, actor: 'evoni', reason: 'bad' })).code).toBe('CAP_INVALID');
        expect((await admin.setCaps({ dailyMicros: 1, imageDailyMicros: 1, actor: 'evoni', reason: 'tiny' })).ok).toBe(true);
        expect((await ledger.authorize(anthropicCall({ logicalKey: 'cap-2', estimateMicros: 2 }).authorizeInput)).code).toBe('DAILY_CAP');
        await admin.setCaps({ dailyMicros: 10_000_000, imageDailyMicros: 5_000_000, actor: 'evoni', reason: 'restore' });
      });

      test('input the database cannot bind is refused: TTL out of range, unknown operation, provider mismatch', async () => {
        const raw = (p) => t.pools.caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [JSON.stringify(p)]).then((r) => r.rows[0].r);
        const base = {
          secret_hash: 'c'.repeat(64), caller_class: 'api', caller_instance: 'x', provider: 'anthropic', operation: 'anthropic.messages',
          body_kind: 'json', model: 'm', logical_key: 'raw-1', attempt: 1, estimate_micros: 1, reservation_day: DAY, ttl_ms: 500,
          body_sha256: 'd'.repeat(64), body_bytes: 1, billing_fields: { model: 'm' }, billing_fields_canonical: '{"model":"m"}',
        };
        expect((await raw(base)).code).toBe('TTL_INVALID');
        expect((await raw({ ...base, ttl_ms: 1000, operation: 'runway.task_status' })).code).toBe('NOT_A_SUBMISSION');
        expect((await raw({ ...base, ttl_ms: 1000, provider: 'openai' })).code).toBe('PROVIDER_MISMATCH');
        expect((await raw({ ...base, ttl_ms: 1000, body_kind: 'multipart' })).code).toBe('BODY_KIND_MISMATCH');
        expect((await raw({ ...base, ttl_ms: 1000, logical_key: null })).code).toBe('PERMIT_FIELDS_MISSING');
      });
    });

    describe('Stop, Resume and acknowledgement', () => {
      test('Stop raises the version and is audited; Resume needs a matching, unexpired, single-use challenge', async () => {
        const s = await admin.stop('evoni', 'audit test');
        expect(s.ok).toBe(true);
        expect((await admin.stop('evoni', '')).code).toBe('REASON_REQUIRED');
        const challengeId = crypto.randomUUID();
        const nonceHash = sha('n1');
        expect((await admin.requestResume({ actor: 'evoni', reason: 'r', challengeId, nonceHash, ttlSeconds: 5 })).code).toBe('TTL_INVALID');
        expect((await admin.requestResume({ actor: 'evoni', reason: 'r', challengeId, nonceHash: 'zz', ttlSeconds: 60 })).code).toBe('CHALLENGE_INVALID');
        const r = await admin.requestResume({ actor: 'evoni', reason: 'resume', challengeId, nonceHash, ttlSeconds: 60 });
        expect(r.ok).toBe(true);
        expect((await admin.requestResume({ actor: 'evoni', reason: 'again', challengeId, nonceHash, ttlSeconds: 60 })).code).toBe('NOT_STOPPED');
        // still refused while RESUME_PENDING
        expect((await ledger.authorize(anthropicCall({ logicalKey: 'pending-1' }).authorizeInput)).code).toBe('STOPPED');
        const ok = { actor: 'evoni', challengeId, nonceHash, targetVersion: r.target_version, reason: 'go' };
        for (const bad of [{ actor: 'someone-else' }, { nonceHash: sha('n2') }, { targetVersion: r.target_version + 1 }, { challengeId: crypto.randomUUID() }]) {
          expect((await admin.confirmResume({ ...ok, ...bad })).code).toBe('RESUME_REFUSED');
        }
        expect((await admin.confirmResume(ok)).ok).toBe(true);
        expect((await admin.confirmResume(ok)).code).toBe('RESUME_REFUSED'); // single use
        const { rows } = await su("SELECT action FROM aigw_audit WHERE action LIKE 'resume%' OR action = 'stop' ORDER BY id DESC LIMIT 7");
        expect(rows.map((x) => x.action)).toEqual(['resume_confirm_refused', 'resume_confirmed', 'resume_confirm_refused', 'resume_confirm_refused',
          'resume_confirm_refused', 'resume_confirm_refused', 'resume_requested']);
      });

      test('an expired challenge cannot be confirmed; a pending Resume can be cancelled', async () => {
        await admin.stop('evoni', 'expiry test');
        const challengeId = crypto.randomUUID();
        const nonceHash = sha('n3');
        const r = await admin.requestResume({ actor: 'evoni', reason: 'r', challengeId, nonceHash, ttlSeconds: 30 });
        await su("ALTER TABLE aigw_control DISABLE TRIGGER aigw_control_row_guard");
        await su("UPDATE aigw_control SET resume_expires_at = now() - interval '1 second'");
        await su("ALTER TABLE aigw_control ENABLE TRIGGER aigw_control_row_guard");
        expect((await admin.confirmResume({ actor: 'evoni', challengeId, nonceHash, targetVersion: r.target_version })).code).toBe('RESUME_REFUSED');
        expect((await admin.cancelResume('evoni', 'expired')).ok).toBe(true);
        expect((await ledger.readControl()).global_state).toBe('STOPPED');
        expect((await admin.cancelResume('evoni', 'again')).code).toBe('NOT_PENDING');
        await release(admin);
      });

      test('the gateway acknowledges only the current or a newer-than-recorded version', async () => {
        const c = await ledger.readControl();
        expect((await ledger.ack({ version: c.version + 1, effective: 'RELEASED' })).code).toBe('ACK_VERSION_INVALID');
        expect((await ledger.ack({ version: c.version, effective: 'RELEASED', inflightAtApply: [{ permitId: 'p' }] })).ok).toBe(true);
        expect((await ledger.ack({ version: c.version - 1, effective: 'RELEASED' })).code).toBe('ACK_VERSION_STALE');
        const after = await ledger.readControl();
        expect(after).toMatchObject({ gateway_ack_version: c.version, gateway_ack_instance: 'gw-test-1', gateway_inflight_at_ack: [{ permitId: 'p' }] });
        expect(after.version).toBe(c.version); // an acknowledgement is not a state change
      });
    });

    test('down refuses while the ledger holds rows', async () => {
      await expect(migration.down(t.sequelize.getQueryInterface(), Sequelize)).rejects.toThrow(/Refusing to drop the AI gateway ledger/);
      const { rows } = await su("SELECT count(*)::int AS n FROM pg_tables WHERE tablename LIKE 'aigw\\_%'");
      expect(rows[0].n).toBe(6);
    });
  });

  test('down on an empty ledger removes every table and function; up restores the seed', async () => {
    const t = await createAigwTestDb({ poolMax: 1, ownership: false });
    try {
      // the seed's control row is not a history row; an unused ledger may be rolled back
      await migration.down(t.sequelize.getQueryInterface(), Sequelize);
      const left = await t.su.query("SELECT (SELECT count(*) FROM pg_tables WHERE tablename LIKE 'aigw\\_%') + (SELECT count(*) FROM pg_proc WHERE proname LIKE 'aigw\\_%') AS n");
      expect(Number(left.rows[0].n)).toBe(0);
      await migration.up(t.sequelize.getQueryInterface(), Sequelize);
      const c = await t.su.query('SELECT global_state, version, daily_cap_micros FROM aigw_control');
      expect(c.rows).toEqual([{ global_state: 'STOPPED', version: '1', daily_cap_micros: null }]);
    } finally {
      await t.close();
    }
  });

  test('the helper only ever targets the test server', () => {
    expect(urlFor('x')).toMatch(/\/x$/);
    expect(process.env.TEST_DATABASE_URL || '').not.toMatch(/amazonaws\.com/);
  });
});
