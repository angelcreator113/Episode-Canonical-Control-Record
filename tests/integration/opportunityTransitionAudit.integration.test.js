/**
 * Advance and Undo, recorded (Evoni's A1 ruling, 2026-11-13;
 * services/opportunityTransitionAudit, routes/opportunityRoutes).
 *
 *   POST /api/v1/opportunities/:showId/:id/advance  { to_status, from_status?, reason?, note? }
 *   POST /api/v1/opportunities/:showId/:id/undo     { from_status, reason }
 *
 * Each runs in one transaction with the row locked, writes who and why
 * beside the history keys it always wrote, and one activity_logs entry that
 * commits with it or not at all. A step to declined or cancelled, and every
 * Undo, needs a reason. A request names the status it was made from, so a
 * second click or a stale page never takes another step. STATUS_FLOW's
 * legal steps, the booking date and the payment status are as before; no
 * money is touched.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Opportunity transitions: Advance and Undo are recorded', () => {
  const show = uuid();
  const TAG = `transition-audit-${show.slice(0, 8)}`;
  const ADMIN_ID = 'test-admin-transition-audit';
  let adminToken;
  let editorToken;
  // Each test writes from its own address, so the app's 60-writes-a-minute
  // limit (app.js writeLimiter) counts each test apart.
  let ip = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.79.${ip}.1`);
  const asAdmin = (r) => from(r).set('Authorization', `Bearer ${adminToken}`);
  const asEditor = (r) => from(r).set('Authorization', `Bearer ${editorToken}`);

  const makeOpp = async (name, status, history = null) => {
    const id = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, payment_amount, created_at, updated_at)
               VALUES (:id, :show, :name, 'campaign', :status, CAST(:history AS jsonb), 1200, NOW(), NOW())`,
    { id, show, name: `${name} ${TAG}`, status, history: JSON.stringify(history || [{ status, date: new Date().toISOString() }]) });
    return id;
  };
  const advance = (id, body, as = asAdmin) => as(request(app).post(`/api/v1/opportunities/${show}/${id}/advance`)).send(body);
  const undo = (id, body, as = asAdmin) => as(request(app).post(`/api/v1/opportunities/${show}/${id}/undo`)).send(body);
  const oppRow = async (id) => (await rows('SELECT status, status_history, booking_date, payment_status, payment_amount FROM opportunities WHERE id = :id', { id }))[0];
  const auditOf = (id) => rows(`SELECT user_id, action, resource_type, resource_id, changes FROM activity_logs
                                 WHERE resource_type = 'opportunity' AND resource_id = :id ORDER BY id`, { id });
  const ledgerCount = async () => Number((await rows('SELECT COUNT(*) AS n FROM financial_transactions WHERE show_id = :show', { show }))[0].n);

  beforeAll(async () => {
    adminToken = TokenService.generateTokenPair({ id: ADMIN_ID, email: 'admin@transition-audit.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-editor-transition-audit', email: 'editor@transition-audit.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: show, name: `TA ${show.slice(0, 8)}`, slug: `ta-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    ip += 1;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show } });
    await q(`DELETE FROM activity_logs WHERE resource_type = 'opportunity' AND resource_id IN (SELECT id::text FROM opportunities WHERE show_id = :show)`).catch(() => {});
    await q('DELETE FROM opportunities WHERE show_id = :show');
    await q('DELETE FROM shows WHERE id = :show');
    await sequelize.close();
  });

  describe('Advance', () => {
    it('an ordinary step needs no reason and is recorded once: who, from, to, when, route', async () => {
      const opp = await makeOpp('Ordinary', 'offered');
      const res = await advance(opp, { to_status: 'considering' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, advanced: { from: 'offered', to: 'considering' } });
      const row = await oppRow(opp);
      expect(row.status).toBe('considering');
      const last = row.status_history.slice(-1)[0];
      expect(last).toMatchObject({ status: 'considering', from: 'offered', note: null, by: { id: ADMIN_ID }, reason: null, route: 'advance' });
      expect(Number.isNaN(Date.parse(last.date))).toBe(false);
      const entries = await auditOf(opp);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: ADMIN_ID, action: 'opportunity_status', resource_type: 'opportunity', resource_id: opp });
      expect(entries[0].changes).toEqual({ meta: {
        route: 'advance', from_status: 'offered', to_status: 'considering', reason: null, show_id: show, event_id: null, episode_id: null,
      } });
    });

    it('an optional reason on an ordinary step is kept', async () => {
      const opp = await makeOpp('Optional why', 'offered');
      expect((await advance(opp, { to_status: 'considering', reason: '  Worth a look  ' })).status).toBe(200);
      expect((await oppRow(opp)).status_history.slice(-1)[0].reason).toBe('Worth a look');
      expect((await auditOf(opp))[0].changes.meta.reason).toBe('Worth a look');
    });

    it('declining and cancelling need a reason: without one, 400 and nothing changes', async () => {
      for (const [from, to] of [['offered', 'declined'], ['negotiating', 'declined'], ['booked', 'cancelled'], ['preparing', 'cancelled']]) {
        const opp = await makeOpp(`${from} to ${to}`, from);
        for (const reason of [undefined, '', '   ']) {
          const res = await advance(opp, { to_status: to, reason });
          expect(res.status).toBe(400);
          expect(res.body.code).toBe('OPPORTUNITY_REASON_REQUIRED');
        }
        const before = await oppRow(opp);
        expect(before.status).toBe(from);
        expect(before.status_history).toHaveLength(1);
        expect(await auditOf(opp)).toHaveLength(0);

        const ok = await advance(opp, { to_status: to, reason: 'The terms changed' });
        expect(ok.status).toBe(200);
        expect((await oppRow(opp)).status_history.slice(-1)[0]).toMatchObject({ status: to, from, reason: 'The terms changed', by: { id: ADMIN_ID } });
        expect(await auditOf(opp)).toHaveLength(1);
      }
    });

    it('a reason that is not text, or is longer than 500 characters, is a 400', async () => {
      const opp = await makeOpp('Bad why', 'offered');
      for (const reason of [42, { a: 1 }, 'x'.repeat(501)]) {
        const res = await advance(opp, { to_status: 'considering', reason });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('OPPORTUNITY_REASON_INVALID');
      }
      expect((await oppRow(opp)).status).toBe('offered');
    });

    it('is an admin\'s: anyone else is refused 403 and nothing is written', async () => {
      const opp = await makeOpp('Admin only', 'offered');
      const res = await advance(opp, { to_status: 'considering' }, asEditor);
      expect(res.status).toBe(403);
      expect((await oppRow(opp)).status).toBe('offered');
      expect(await auditOf(opp)).toHaveLength(0);
    });

    it('the legal steps are STATUS_FLOW\'s, as before; booked sets the booking date and paid the payment status', async () => {
      const opp = await makeOpp('Legal steps', 'negotiating');
      const illegal = await advance(opp, { to_status: 'paid' });
      expect(illegal.status).toBe(400);
      expect(illegal.body.error).toBe('Cannot advance from "negotiating" to "paid". Allowed: booked, declined');
      expect(await auditOf(opp)).toHaveLength(0);

      for (const to of ['booked', 'preparing', 'active', 'completed', 'paid']) expect((await advance(opp, { to_status: to })).status).toBe(200);
      const row = await oppRow(opp);
      expect(row.status).toBe('paid');
      expect(row.booking_date).toBeTruthy();
      expect(row.payment_status).toBe('paid');
      expect(Number(row.payment_amount)).toBe(1200);
      expect(await auditOf(opp)).toHaveLength(5);
    });

    it('a request made from another status is refused 409 and changes nothing', async () => {
      const opp = await makeOpp('Stale page', 'negotiating');
      const res = await advance(opp, { to_status: 'considering', from_status: 'offered' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'OPPORTUNITY_STATUS_STALE', status: 'negotiating' });
      expect((await oppRow(opp)).status_history).toHaveLength(1);
      expect(await auditOf(opp)).toHaveLength(0);
      expect((await advance(opp, { to_status: 'booked', from_status: 'not-a-status' })).status).toBe(400);
    });

    it('the same request sent twice takes one step: the second is answered as done and writes nothing', async () => {
      const opp = await makeOpp('Double click', 'offered');
      const first = await advance(opp, { to_status: 'considering', from_status: 'offered' });
      expect(first.status).toBe(200);
      expect(first.body.advanced).toEqual({ from: 'offered', to: 'considering' });
      const second = await advance(opp, { to_status: 'considering', from_status: 'offered' });
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({ success: true, already: true, advanced: null });
      const row = await oppRow(opp);
      expect(row.status).toBe('considering');
      expect(row.status_history).toHaveLength(2);
      expect(await auditOf(opp)).toHaveLength(1);
    });

    it('two requests at once take the step once', async () => {
      const named = await makeOpp('At once, named', 'offered');
      const a = await Promise.all([1, 2, 3].map(() => advance(named, { to_status: 'considering', from_status: 'offered' })));
      expect(a.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(a.filter((r) => r.body.advanced).length).toBe(1);
      expect(a.filter((r) => r.body.already).length).toBe(2);
      expect((await oppRow(named)).status_history).toHaveLength(2);
      expect(await auditOf(named)).toHaveLength(1);

      // Without from_status (an older caller): the second finds the step
      // already taken and is refused as an illegal step, as before.
      const bare = await makeOpp('At once, bare', 'offered');
      const b = await Promise.all([1, 2].map(() => advance(bare, { to_status: 'considering' })));
      expect(b.map((r) => r.status).sort()).toEqual([200, 400]);
      expect((await oppRow(bare)).status_history).toHaveLength(2);
      expect(await auditOf(bare)).toHaveLength(1);
    });

    it('the entry that cannot be written takes the step with it', async () => {
      const opp = await makeOpp('No entry, no step', 'offered');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const spy = jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValueOnce(new Error('the audit trail is down'));
      const res = await advance(opp, { to_status: 'considering' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(500);
      const row = await oppRow(opp);
      expect(row.status).toBe('offered');
      expect(row.status_history).toHaveLength(1);
      expect(await auditOf(opp)).toHaveLength(0);
    });

    it('the entry holds the transition only: no payment, no note', async () => {
      const opp = await makeOpp('Only the transition', 'offered');
      await advance(opp, { to_status: 'declined', reason: 'Not a fit', note: 'a private note about the brand' });
      const entry = (await auditOf(opp))[0];
      expect(Object.keys(entry.changes)).toEqual(['meta']);
      expect(Object.keys(entry.changes.meta).sort()).toEqual(['episode_id', 'event_id', 'from_status', 'reason', 'route', 'show_id', 'to_status']);
      expect(JSON.stringify(entry.changes)).not.toMatch(/1200|payment|private note/);
      // The note stays where it always was, in the history.
      expect((await oppRow(opp)).status_history.slice(-1)[0].note).toBe('a private note about the brand');
    });
  });

  describe('Undo', () => {
    it('needs the status being undone and a reason; then goes one step back, recorded once', async () => {
      const opp = await makeOpp('Undo me', 'offered');
      await advance(opp, { to_status: 'considering' });

      expect((await undo(opp, {})).body.code).toBe('OPPORTUNITY_FROM_STATUS_REQUIRED');
      expect((await undo(opp, { from_status: 'considering' })).body.code).toBe('OPPORTUNITY_REASON_REQUIRED');
      expect((await undo(opp, { from_status: 'considering', reason: '  ' })).body.code).toBe('OPPORTUNITY_REASON_REQUIRED');
      expect((await undo(opp, { reason: 'A slip' })).status).toBe(400);
      expect((await oppRow(opp)).status).toBe('considering');
      expect(await auditOf(opp)).toHaveLength(1);

      const res = await undo(opp, { from_status: 'considering', reason: 'A slip of the hand' });
      expect(res.status).toBe(200);
      expect(res.body.undone).toEqual({ from: 'considering', to: 'offered' });
      const row = await oppRow(opp);
      expect(row.status).toBe('offered');
      // The keys Undo's own reader depends on, exactly, with who and why beside them.
      expect(row.status_history.slice(-1)[0]).toMatchObject({
        status: 'offered', note: 'Undone', undone_from: 'considering', by: { id: ADMIN_ID }, reason: 'A slip of the hand', route: 'undo',
      });
      const entries = await auditOf(opp);
      expect(entries).toHaveLength(2);
      expect(entries[1].changes).toEqual({ meta: {
        route: 'undo', from_status: 'considering', to_status: 'offered', reason: 'A slip of the hand', show_id: show, event_id: null, episode_id: null,
      } });
    });

    it('a second click never takes a second step back', async () => {
      const opp = await makeOpp('Double undo', 'offered');
      await advance(opp, { to_status: 'considering' });
      await advance(opp, { to_status: 'negotiating' });
      const body = { from_status: 'negotiating', reason: 'Too soon' };
      const first = await undo(opp, body);
      expect(first.status).toBe(200);
      const second = await undo(opp, body);
      expect(second.status).toBe(409);
      expect(second.body).toMatchObject({ code: 'OPPORTUNITY_STATUS_STALE', status: 'considering' });
      expect((await oppRow(opp)).status).toBe('considering');
      expect(await auditOf(opp)).toHaveLength(3);
    });

    it('two Undos at once take one step back', async () => {
      const opp = await makeOpp('Undo at once', 'offered');
      await advance(opp, { to_status: 'considering' });
      await advance(opp, { to_status: 'negotiating' });
      const results = await Promise.all([1, 2, 3].map(() => undo(opp, { from_status: 'negotiating', reason: 'Too soon' })));
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
      expect((await oppRow(opp)).status).toBe('considering');
      expect(await auditOf(opp)).toHaveLength(3);
    });

    it('is an admin\'s', async () => {
      const opp = await makeOpp('Undo admin only', 'offered');
      await advance(opp, { to_status: 'considering' });
      const res = await undo(opp, { from_status: 'considering', reason: 'Trying' }, asEditor);
      expect(res.status).toBe(403);
      expect((await oppRow(opp)).status).toBe('considering');
    });

    it('reopening a declined offer is an Undo, with its reason', async () => {
      const opp = await makeOpp('Reopened', 'negotiating');
      await advance(opp, { to_status: 'declined', reason: 'The fee was too low' });
      const res = await undo(opp, { from_status: 'declined', reason: 'They raised the fee' });
      expect(res.status).toBe(200);
      expect((await oppRow(opp)).status).toBe('negotiating');
      const entries = await auditOf(opp);
      expect(entries.map((e) => [e.changes.meta.route, e.changes.meta.from_status, e.changes.meta.to_status]))
        .toEqual([['advance', 'negotiating', 'declined'], ['undo', 'declined', 'negotiating']]);
    });

    it('a history written before A1 and one written after read as one history', async () => {
      // Entries as Advance, Undo and Start Episode wrote them before: no by, reason or route.
      const old = [
        { status: 'offered', date: '2026-10-01T10:00:00.000Z' },
        { status: 'considering', date: '2026-10-02T10:00:00.000Z', note: null, from: 'offered' },
        { status: 'negotiating', date: '2026-10-03T10:00:00.000Z', note: null, from: 'considering' },
        { status: 'considering', date: '2026-10-04T10:00:00.000Z', note: 'Undone', undone_from: 'negotiating' },
        { status: 'negotiating', from: 'considering', date: '2026-10-05T10:00:00.000Z', note: 'Offer decision at Start Episode: negotiate', decision: 'negotiate', event_id: uuid(), episode_id: uuid() },
      ];
      const opp = await makeOpp('Old and new', 'negotiating', old);
      expect((await advance(opp, { to_status: 'booked', from_status: 'negotiating' })).status).toBe(200);
      // New Undo over the new step, then over the old ones.
      expect((await undo(opp, { from_status: 'booked', reason: 'Not signed yet' })).body.undone).toEqual({ from: 'booked', to: 'negotiating' });
      expect((await undo(opp, { from_status: 'negotiating', reason: 'Back to thinking' })).body.undone).toEqual({ from: 'negotiating', to: 'considering' });
      expect((await undo(opp, { from_status: 'considering', reason: 'Back to the start' })).body.undone).toEqual({ from: 'considering', to: 'offered' });
      const row = await oppRow(opp);
      expect(row.status).toBe('offered');
      // The old entries are as they were: nothing is backfilled.
      expect(row.status_history.slice(0, 5)).toEqual(old);
      expect(row.status_history).toHaveLength(9);
      expect(await auditOf(opp)).toHaveLength(4);
    });

    it('the entry that cannot be written takes the Undo with it', async () => {
      const opp = await makeOpp('No entry, no undo', 'offered');
      await advance(opp, { to_status: 'considering' });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValueOnce(new Error('the audit trail is down'));
      const res = await undo(opp, { from_status: 'considering', reason: 'A slip' });
      expect(res.status).toBe(500);
      const row = await oppRow(opp);
      expect(row.status).toBe('considering');
      expect(row.status_history).toHaveLength(2);
      expect(await auditOf(opp)).toHaveLength(1);
    });
  });

  describe('who reads the reasons', () => {
    it('the list gives an admin who and why, and anyone else the history without them', async () => {
      const opp = await makeOpp('Who reads', 'offered');
      await advance(opp, { to_status: 'declined', reason: 'Kept between admins' });
      const list = (as) => as(request(app).get(`/api/v1/opportunities/${show}`));

      const forAdmin = (await list(asAdmin)).body.opportunities.find((o) => o.id === opp);
      expect(forAdmin.status_history.slice(-1)[0]).toMatchObject({ reason: 'Kept between admins', by: { id: ADMIN_ID } });

      const res = await list(asEditor);
      expect(res.status).toBe(200);
      const forEditor = res.body.opportunities.find((o) => o.id === opp);
      expect(forEditor.status).toBe('declined');
      expect(forEditor.status_history.slice(-1)[0]).toEqual(expect.objectContaining({ status: 'declined', from: 'offered', route: 'advance' }));
      expect(forEditor.status_history.slice(-1)[0]).not.toHaveProperty('reason');
      expect(forEditor.status_history.slice(-1)[0]).not.toHaveProperty('by');
      expect(JSON.stringify(res.body)).not.toContain('Kept between admins');
    });
  });

  it('no transition here books or changes any money', async () => {
    expect(await ledgerCount()).toBe(0);
  });
});
