// ============================================================================
// My Little List ♡ routes (Evoni, 2026-10-26, Phase 1): a login on every
// route; bad ids, keys and positions answered before anything is read;
// service errors keep their status and code; anything else is a logged 500.
// The service is mocked; its rules are tests/unit/services/myLittleListService.test.js.
// ============================================================================

const express = require('express');
const request = require('supertest');

const EP = '11111111-1111-4111-8111-111111111111';
const KEY = 'mll_0123456789abcdef01234567';

function app(service, { authed = true } = {}) {
  jest.resetModules();
  jest.doMock('../../../src/middleware/auth', () => ({
    requireAuth: (req, res, next) => (authed ? next() : res.status(401).json({ error: 'Authentication required' })),
  }));
  jest.doMock('../../../src/services/myLittleListService', () => ({
    ...jest.requireActual('../../../src/services/myLittleListService'),
    ...service,
  }));
  const a = express();
  a.use(express.json());
  a.set('models', { sequelize: {} });
  a.use('/api/v1', require('../../../src/routes/myLittleListRoutes'));
  return a;
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

const PUBLIC = { app: 'My Little List ♡', items: [{ key: KEY, title: 'Check my coins', note: null, done: false, can_check: true, can_edit: true, can_remove: true }], progress: { done: 0, total: 1 } };

describe('GET /episodes/:episodeId/my-little-list', () => {
  test('the list as of the position asked, the start of the episode by default', async () => {
    const getMyLittleList = jest.fn(async () => PUBLIC);
    const a = app({ getMyLittleList });
    let res = await request(a).get(`/api/v1/episodes/${EP}/my-little-list?beat=6&line=2`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, as_of: { beat: 6, line: 2 }, ...PUBLIC });
    expect(getMyLittleList).toHaveBeenLastCalledWith(expect.anything(), EP, { beat: 6, line: 2 });
    res = await request(a).get(`/api/v1/episodes/${EP}/my-little-list`);
    expect(getMyLittleList).toHaveBeenLastCalledWith(expect.anything(), EP, { beat: 1, line: 0 });
  });

  test('a bad position or episode id is a 400 and nothing is read', async () => {
    const getMyLittleList = jest.fn();
    const a = app({ getMyLittleList });
    for (const url of [`/api/v1/episodes/${EP}/my-little-list?beat=15`, `/api/v1/episodes/${EP}/my-little-list?line=-1`, '/api/v1/episodes/not-a-uuid/my-little-list']) {
      expect((await request(a).get(url)).status).toBe(400);
    }
    expect(getMyLittleList).not.toHaveBeenCalled();
  });

  test('no episode is a 404; a failure is a logged 500', async () => {
    expect((await request(app({ getMyLittleList: jest.fn(async () => null) })).get(`/api/v1/episodes/${EP}/my-little-list`)).status).toBe(404);
    const res = await request(app({ getMyLittleList: jest.fn(async () => { throw new Error('db down'); }) })).get(`/api/v1/episodes/${EP}/my-little-list`);
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith('[MyLittleList] GET failed:', expect.any(Error));
  });

  test('without a login: 401, on every route', async () => {
    const a = app({}, { authed: false });
    for (const [method, url] of [
      ['get', `/api/v1/episodes/${EP}/my-little-list`], ['get', `/api/v1/episodes/${EP}/my-little-list/review`],
      ['post', `/api/v1/episodes/${EP}/my-little-list/items`], ['patch', `/api/v1/episodes/${EP}/my-little-list/items/${KEY}`],
      ['delete', `/api/v1/episodes/${EP}/my-little-list/items/${KEY}`],
    ]) {
      expect((await request(a)[method](url)).status).toBe(401);
    }
  });
});

describe('the writes', () => {
  test('POST adds her reminder: 201 with its key', async () => {
    const addReminder = jest.fn(async () => ({ key: KEY }));
    const res = await request(app({ addReminder })).post(`/api/v1/episodes/${EP}/my-little-list/items`).send({ title: 'Charge my phone' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, key: KEY });
    expect(addReminder).toHaveBeenCalledWith(expect.anything(), EP, { title: 'Charge my phone' });
  });

  test('PATCH passes the change and the position separately', async () => {
    const updateItem = jest.fn(async () => ({ key: KEY }));
    const res = await request(app({ updateItem })).patch(`/api/v1/episodes/${EP}/my-little-list/items/${KEY}`).send({ done: true, beat: 12, line: 0 });
    expect(res.status).toBe(200);
    expect(updateItem).toHaveBeenCalledWith(expect.anything(), EP, KEY, { done: true }, { beat: 12, line: 0 });
  });

  test('DELETE reads its position from the query', async () => {
    const removeItem = jest.fn(async () => ({ key: KEY }));
    const res = await request(app({ removeItem })).delete(`/api/v1/episodes/${EP}/my-little-list/items/${KEY}?beat=3`);
    expect(res.status).toBe(200);
    expect(removeItem).toHaveBeenCalledWith(expect.anything(), EP, KEY, { beat: 3, line: 0 });
  });

  test('a key that is not one of ours is a 404 before anything is read', async () => {
    const updateItem = jest.fn();
    const res = await request(app({ updateItem })).patch(`/api/v1/episodes/${EP}/my-little-list/items/task:network`).send({ done: true });
    expect(res.status).toBe(404);
    expect(updateItem).not.toHaveBeenCalled();
  });

  test.each([
    [403, 'COMPLETION_FROM_GAMEPLAY'], [404, 'LIST_ITEM_NOT_FOUND'], [400, 'LIST_ITEM_INVALID'], [503, 'PERSONAL_LIST_MIGRATION_PENDING'],
  ])('a service %s %s keeps its status and code', async (status, code) => {
    const updateItem = jest.fn(async () => { throw Object.assign(new Error('no'), { status, code }); });
    const res = await request(app({ updateItem })).patch(`/api/v1/episodes/${EP}/my-little-list/items/${KEY}`).send({ done: true });
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ success: false, code, error: 'no' });
    expect(console.error).not.toHaveBeenCalled();
  });
});

test('GET review: the producer\'s view, with its issues', async () => {
  const getReview = jest.fn(async () => ({ items: [{ key: KEY, kind: 'task', reason: 'needs_wording', label: 'Win over the director' }], issues: [] }));
  const res = await request(app({ getReview })).get(`/api/v1/episodes/${EP}/my-little-list/review?beat=12`);
  expect(res.status).toBe(200);
  expect(res.body.items[0]).toMatchObject({ reason: 'needs_wording' });
});
