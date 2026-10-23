// ============================================================================
// POST /episodes/:episodeId/todo/complete/:slot ticked from the Script tab
// (Evoni, 2026-10-23): { source: 'script', beat } is kept on the task as
// completed_source / completed_beat; anything else is a 400; a failure is
// logged. No database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const EP = '22222222-2222-4222-8222-222222222222';
const TASKS = [
  { slot: 'relationship_guest', label: 'Get to know Truthville', task_source: 'goal', completed: false },
  { slot: 'post_reel', label: 'Post the reel', task_source: 'deliverable', deliverable_id: 'd1', completed: false },
];

function app(query) {
  jest.resetModules();
  jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, res, next) => next(), authorize: () => (req, res, next) => next() }));
  const a = express();
  a.use(express.json());
  a.set('models', { sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } });
  a.use('/api/v1', require('../../../src/routes/todoListRoutes'));
  return a;
}
const listQuery = (social = TASKS) => jest.fn(async (sql) => (/^SELECT/.test(sql) ? [{ id: 't1', tasks: [], social_tasks: JSON.stringify(social) }] : [[], 1]));
const written = (query) => JSON.parse(query.mock.calls.find(([sql]) => /^UPDATE/.test(sql))[1].replacements.socialTasks);

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('ticked from the script, the task keeps where and in which beat', async () => {
  const query = listQuery();
  const res = await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({ completed: true, source: 'script', beat: 11 });
  expect(res.status).toBe(200);
  expect(res.body.social_tasks[0]).toMatchObject({ completed: true, completed_source: 'script', completed_beat: 11 });
  expect(written(query)[0]).toMatchObject({ completed: true, completed_source: 'script', completed_beat: 11 });
  expect(written(query)[1]).toEqual(TASKS[1]);
});

test('a plain completion still works; un-ticking drops the script fields', async () => {
  let query = listQuery();
  let res = await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({});
  expect(res.body.social_tasks[0]).toEqual({ ...TASKS[0], completed: true });
  query = listQuery([{ ...TASKS[0], completed: true, completed_source: 'script', completed_beat: 11 }]);
  res = await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({ completed: false });
  expect(res.body.social_tasks[0]).toEqual({ ...TASKS[0], completed: false });
});

test('another source, or a beat that is not 1-14, is a 400 and nothing is read', async () => {
  const query = listQuery();
  const a = app(query);
  expect((await request(a).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({ source: 'ai', beat: 11 })).status).toBe(400);
  expect((await request(a).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({ source: 'script', beat: 15 })).status).toBe(400);
  expect((await request(a).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({ source: 'script', beat: '11' })).status).toBe(400);
  expect(query).not.toHaveBeenCalled();
});

test('a failure is a 500, and logged', async () => {
  const res = await request(app(jest.fn(async () => { throw new Error('db down'); }))).post(`/api/v1/episodes/${EP}/todo/complete/relationship_guest`).send({ source: 'script', beat: 11 });
  expect(res.status).toBe(500);
  expect(console.error).toHaveBeenCalledWith('[TodoList] complete slot failed:', expect.any(Error));
});
