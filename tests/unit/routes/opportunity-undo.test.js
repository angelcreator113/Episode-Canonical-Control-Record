// ============================================================================
// The show tab's opportunities (Evoni, 2026-10-19): Undo the last step, and
// the list says which episode's beat 14 holds one. No database.
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
  }));
  const a = express();
  a.use(express.json());
  a.set('models', models);
  a.use('/api/v1', require('../../../src/routes/opportunityRoutes'));
  return a;
}
const undo = (a, show = SHOW, id = ID) => request(a).post(`/api/v1/opportunities/${show}/${id}/undo`);
const models = (opp) => ({ Opportunity: { findOne: jest.fn(async () => opp) } });

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('POST /opportunities/:showId/:id/undo', () => {
  test('goes back to the status before the last step, with an Undone entry', async () => {
    const opp = row({ id: ID, status: 'completed', status_history: [h('offered'), h('active', { from: 'offered' }), h('completed', { from: 'active' })] });
    const res = await undo(app(models(opp)));
    expect(res.status).toBe(200);
    expect(res.body.undone).toEqual({ from: 'completed', to: 'active' });
    expect(opp.status).toBe('active');
    expect(opp.status_history[opp.status_history.length - 1]).toMatchObject({ status: 'active', note: 'Undone', undone_from: 'completed' });
  });

  test('twice goes back two steps, then there is nothing earlier', async () => {
    const opp = row({ id: ID, status: 'considering', status_history: [h('offered'), h('considering')] });
    const a = app(models(opp));
    expect((await undo(a)).body.undone).toEqual({ from: 'considering', to: 'offered' });
    const again = await undo(a);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/no earlier status/);
  });

  test('held is beat 14\'s: 409, detach it there', async () => {
    const opp = row({ id: ID, status: 'held', status_history: [h('offered'), h('held', { previous_status: 'offered' })] });
    const res = await undo(app(models(opp)));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/beat 14/);
    expect(opp.update).not.toHaveBeenCalled();
  });

  test('a step that came from beat 14 is not undone into held', async () => {
    const opp = row({ id: ID, status: 'offered', status_history: [h('offered'), h('held'), h('offered')] });
    expect((await undo(app(models(opp)))).status).toBe(409);
  });

  test('ids that are not UUIDs are a 400; unknown is a 404; ADMIN only', async () => {
    expect((await undo(app(models(null)), 'abc')).status).toBe(400);
    expect((await undo(app(models(null)), SHOW, '42')).status).toBe(400);
    expect((await undo(app(models(null)))).status).toBe(404);
    expect((await undo(app(models(null), { admin: false }))).status).toBe(403);
  });
});

describe('GET /opportunities/:showId', () => {
  test('one held for beat 14 carries its episode', async () => {
    const opps = [row({ id: ID, status: 'held', offered_in_episode_id: EP }), row({ id: 'o2', status: 'offered', offered_in_episode_id: null })];
    const query = jest.fn(async () => [{ id: EP, title: 'The Gala' }]);
    const a = app({ Opportunity: { findAll: jest.fn(async () => opps) }, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } });
    const res = await request(a).get(`/api/v1/opportunities/${SHOW}`);
    expect(res.status).toBe(200);
    expect(res.body.opportunities[0].beat14_episode).toEqual({ id: EP, title: 'The Gala' });
    expect(res.body.opportunities[1].beat14_episode).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1].replacements).toEqual({ ids: [EP] });
  });
});
