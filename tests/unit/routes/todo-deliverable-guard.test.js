// ============================================================================
// A deliverable's task is never ticked by hand (Evoni, 2026-10-26: "Required
// brand deliverables must not be completed through a generic manual
// social-task endpoint. They must follow their actual submission, approval,
// and payout rules.").
//   - POST /todo/complete/:slot and /todo/complete-social/:slot answer 409
//     DELIVERABLE_COMPLETION_DERIVED for it and write nothing;
//   - goals and optional ideas still tick, with the row locked;
//   - so a refused tick leaves the scoring (computeSocialTaskBonuses) and
//     every financial write untouched, while the deliverable's own
//     submission (socialTaskSource.withDeliverableDone) is what completes it.
// No database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const EP = '22222222-2222-4222-8222-222222222222';
const GOAL = { slot: 'meet_stylist', label: 'Meet the stylist', task_source: 'goal', completed: false };
const IDEA = { slot: 'snap_florals', label: 'Snap the florals', task_source: 'optional', completed: false };
const REEL = { slot: 'deliverable_d1', label: 'One reel in the coat', task_source: 'brand_deliverable', owed_to: 'brand', deliverable_id: 'd1', required: true, completed: false };
const TASKS = [GOAL, IDEA, REEL];

const TXN = { id: 'txn' };
function app(query) {
  jest.resetModules();
  jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, res, next) => next(), authorize: () => (req, res, next) => next() }));
  jest.doMock('../../../src/services/storyCarryForward', () => ({ settleFollowUps: jest.fn(async () => {}) }));
  const a = express();
  a.use(express.json());
  a.set('models', { sequelize: { query, QueryTypes: { SELECT: 'SELECT' }, transaction: async (fn) => fn(TXN) } });
  a.use('/api/v1', require('../../../src/routes/todoListRoutes'));
  return a;
}
const listQuery = (social = TASKS) => jest.fn(async (sql) => (/^SELECT/.test(sql) ? [{ id: 't1', tasks: [], social_tasks: JSON.stringify(social) }] : [[], 1]));
const updates = (query) => query.mock.calls.filter(([sql]) => !/^SELECT/.test(sql));

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe.each([
  ['/todo/complete', {}],
  ['/todo/complete', { completed: true, source: 'script', beat: 11 }],
  ['/todo/complete-social', { completed: true }],
  ['/todo/complete-social', { completed: false }],
])('%s with %j', (route, body) => {
  test("a deliverable's task is a 409 and nothing is written", async () => {
    const query = listQuery();
    const res = await request(app(query)).post(`/api/v1/episodes/${EP}${route}/deliverable_d1`).send(body);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'DELIVERABLE_COMPLETION_DERIVED' });
    expect(res.body.error).toMatch(/submitted/);
    expect(updates(query)).toHaveLength(0);
  });
});

describe('/todo/complete-social: goals and ideas still tick', () => {
  test('a goal ticks, read FOR UPDATE and written in the same transaction', async () => {
    const query = listQuery();
    const res = await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete-social/meet_stylist`).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.social_tasks.map((t) => [t.slot, t.completed])).toEqual([['meet_stylist', true], ['snap_florals', false], ['deliverable_d1', false]]);
    const [selectSql, selectOpts] = query.mock.calls.find(([sql]) => /^SELECT/.test(sql));
    expect(selectSql).toMatch(/FOR UPDATE$/);
    expect(selectOpts.transaction).toBe(TXN);
    const [updateSql, updateOpts] = updates(query)[0];
    expect(updateSql).toMatch(/^UPDATE episode_todo_lists SET social_tasks/);
    expect(updateOpts.transaction).toBe(TXN);
  });

  test('an optional idea unticks', async () => {
    const query = listQuery([GOAL, { ...IDEA, completed: true }, REEL]);
    const res = await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete-social/snap_florals`).send({ completed: false });
    expect(res.status).toBe(200);
    expect(res.body.social_tasks[1].completed).toBe(false);
  });

  test('an unknown slot is a 404, not a silent no-op write', async () => {
    const query = listQuery();
    const res = await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete-social/nope`).send({ completed: true });
    expect(res.status).toBe(404);
    expect(updates(query)).toHaveLength(0);
  });
});

describe('scoring and money', () => {
  const { computeSocialTaskBonuses } = jest.requireActual('../../../src/services/episodeCompletionService');
  const { withDeliverableDone } = jest.requireActual('../../../src/utils/socialTaskSource');

  test('a refused tick leaves the score as it was: the required deliverable still counts as open', async () => {
    const before = computeSocialTaskBonuses(TASKS);
    const query = listQuery();
    await request(app(query)).post(`/api/v1/episodes/${EP}/todo/complete-social/deliverable_d1`).send({ completed: true });
    // Nothing was written, so the list the score reads is the list it read before.
    expect(updates(query)).toHaveLength(0);
    expect(computeSocialTaskBonuses(TASKS)).toEqual(before);
    expect(before.detail).toMatchObject({ required_done: 0, required_total: 1, all_required_done: false });
    expect(before.deltas.stress).toBe(1);
  });

  test('no tick route touches the ledger, coins or the deliverable row', async () => {
    for (const [route, slot] of [['/todo/complete', 'deliverable_d1'], ['/todo/complete-social', 'deliverable_d1'], ['/todo/complete-social', 'meet_stylist']]) {
      const query = listQuery();
      await request(app(query)).post(`/api/v1/episodes/${EP}${route}/${slot}`).send({ completed: true });
      for (const [sql] of query.mock.calls) {
        expect(sql).not.toMatch(/financial_transactions|character_state|coins|event_deliverables|ledger/i);
      }
    }
  });

  test('the deliverable\'s submission is what completes it, once', () => {
    const done = withDeliverableDone(TASKS, 'd1');
    expect(done[2]).toMatchObject({ completed: true, completed_source: 'deliverable' });
    expect(done.slice(0, 2)).toEqual([GOAL, IDEA]);
    expect(computeSocialTaskBonuses(done).detail).toMatchObject({ required_done: 1, all_required_done: true });
    expect(withDeliverableDone(done, 'd1')).toBeNull();
    expect(withDeliverableDone(TASKS, 'other')).toBeNull();
  });
});
