// ============================================================================
// The show tab's opportunities (Evoni, 2026-10-19): Undo the last step, and
// the list says which episode's beat 14 holds one. No database.
// A1 (Evoni, 2026-11-13): an Undo names the status it undoes and why, runs
// in one transaction with the row locked, and writes one audit entry.
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = '11111111-1111-4111-8111-111111111111';
const ID = '33333333-3333-4333-8333-333333333333';
const EP = '22222222-2222-4222-8222-222222222222';
const h = (status, extra = {}) => ({ status, date: '2026-10-19', ...extra });

function row(data) {
  const r = { ...data };
  r.update = jest.fn(async (u) => Object.assign(r, u));
  r.toJSON = () => { const { update, toJSON, ...rest } = r; return rest; };
  return r;
}

function app(models, { admin = true } = {}) {
  jest.resetModules();
  jest.doMock('../../../src/middleware/auth', () => ({
    requireAuth: (req, res, next) => next(),
    authorize: () => (req, res, next) => (admin ? next() : res.status(403).json({ success: false })),
    userInGroup: () => admin,
  }));
  jest.doMock('../../../src/middleware/auditLog', () => ({ logger: { logActionInTransaction: auditEntry } }));
  const a = express();
  a.use(express.json());
  a.set('models', models);
  a.use('/api/v1', require('../../../src/routes/opportunityRoutes'));
  return a;
}
const auditEntry = jest.fn(async () => ({}));
const TX = { LOCK: { UPDATE: 'UPDATE' } };
const undo = (a, from, show = SHOW, id = ID) => request(a).post(`/api/v1/opportunities/${show}/${id}/undo`)
  .send({ from_status: from, reason: 'A slip of the hand' });
const models = (opp) => ({ Opportunity: { findOne: jest.fn(async () => opp) }, sequelize: { transaction: jest.fn(async (fn) => fn(TX)) } });

beforeEach(() => { auditEntry.mockClear(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('POST /opportunities/:showId/:id/undo', () => {
  test('goes back to the status before the last step, with an Undone entry', async () => {
    const opp = row({ id: ID, status: 'completed', status_history: [h('offered'), h('active', { from: 'offered' }), h('completed', { from: 'active' })] });
    const m = models(opp);
    const res = await undo(app(m), 'completed');
    expect(res.status).toBe(200);
    expect(res.body.undone).toEqual({ from: 'completed', to: 'active' });
    expect(opp.status).toBe('active');
    expect(opp.status_history[opp.status_history.length - 1]).toMatchObject({
      status: 'active', note: 'Undone', undone_from: 'completed', reason: 'A slip of the hand', route: 'undo',
    });
    // The row is read under a lock in the transaction that writes it and its one entry.
    expect(m.Opportunity.findOne).toHaveBeenCalledWith(expect.objectContaining({ transaction: TX, lock: 'UPDATE' }));
    expect(opp.update).toHaveBeenCalledWith(expect.any(Object), { transaction: TX });
    expect(auditEntry).toHaveBeenCalledTimes(1);
    expect(auditEntry).toHaveBeenCalledWith(TX, null, 'opportunity_status', 'opportunity', ID, expect.objectContaining({
      route: 'undo', from_status: 'completed', to_status: 'active', reason: 'A slip of the hand', show_id: SHOW,
    }));
  });

  test('the status being undone and a reason are both needed; another status than the one named is stale', async () => {
    const opp = row({ id: ID, status: 'completed', status_history: [h('offered'), h('active', { from: 'offered' }), h('completed', { from: 'active' })] });
    const a = app(models(opp));
    const post = (body) => request(a).post(`/api/v1/opportunities/${SHOW}/${ID}/undo`).send(body);
    expect((await post({})).body.code).toBe('OPPORTUNITY_FROM_STATUS_REQUIRED');
    expect((await post({ from_status: 'completed' })).body.code).toBe('OPPORTUNITY_REASON_REQUIRED');
    const stale = await post({ from_status: 'active', reason: 'A slip' });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'OPPORTUNITY_STATUS_STALE', status: 'completed' });
    expect(opp.update).not.toHaveBeenCalled();
    expect(auditEntry).not.toHaveBeenCalled();
  });

  // Steps made before advance saved its history: the last status written is the one before.
  test('a step the history never recorded goes back to the last status written', async () => {
    const opp = row({ id: ID, status: 'completed', status_history: [h('offered'), h('active')] });
    const res = await undo(app(models(opp)), 'completed');
    expect(res.status).toBe(200);
    expect(res.body.undone).toEqual({ from: 'completed', to: 'active' });
  });

  test('twice goes back two steps, then there is nothing earlier', async () => {
    const opp = row({ id: ID, status: 'considering', status_history: [h('offered'), h('considering')] });
    const a = app(models(opp));
    expect((await undo(a, 'considering')).body.undone).toEqual({ from: 'considering', to: 'offered' });
    // The same click again names a status it no longer has: refused, no second step.
    expect((await undo(a, 'considering')).body.code).toBe('OPPORTUNITY_STATUS_STALE');
    const again = await undo(a, 'offered');
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/no earlier status/);
  });

  test('held is beat 14\'s: 409, detach it there', async () => {
    const opp = row({ id: ID, status: 'held', status_history: [h('offered'), h('held', { previous_status: 'offered' })] });
    const res = await undo(app(models(opp)), 'held');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/beat 14/);
    expect(opp.update).not.toHaveBeenCalled();
  });

  test('a step that came from beat 14 is not undone into held', async () => {
    const opp = row({ id: ID, status: 'offered', status_history: [h('offered'), h('held'), h('offered')] });
    expect((await undo(app(models(opp)), 'offered')).status).toBe(409);
  });

  test('ids that are not UUIDs are a 400; unknown is a 404; ADMIN only', async () => {
    expect((await undo(app(models(null)), 'offered', 'abc')).status).toBe(400);
    expect((await undo(app(models(null)), 'offered', SHOW, '42')).status).toBe(400);
    expect((await undo(app(models(null)), 'offered')).status).toBe(404);
    expect((await undo(app(models(null), { admin: false }), 'offered')).status).toBe(403);
  });
});

describe('GET /opportunities/:showId', () => {
  // With its number and whether it is completed, so a held card can say
  // why it waits (Evoni, 2026-10-23).
  test('one held for beat 14 carries its episode', async () => {
    const opps = [row({ id: ID, status: 'held', offered_in_episode_id: EP }), row({ id: 'o2', status: 'offered', offered_in_episode_id: null })];
    const query = jest.fn(async () => [{ id: EP, title: 'The Gala', episode_number: 1, evaluation_status: 'accepted' }]);
    const a = app({ Opportunity: { findAll: jest.fn(async () => opps) }, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } });
    const res = await request(a).get(`/api/v1/opportunities/${SHOW}`);
    expect(res.status).toBe(200);
    expect(res.body.opportunities[0].beat14_episode).toEqual({ id: EP, title: 'The Gala', episode_number: 1, evaluation_status: 'accepted', season_number: null, season_context: null });
    expect(res.body.opportunities[1].beat14_episode).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1].replacements).toEqual({ ids: [EP] });
  });
});
