// ============================================================================
// Goal ladders at a phase boundary (Evoni, 2026-10-25): getPhaseGoalStatus
// and isUnmet judge only the rung being worked on; rungs up next are left as
// they are; passive goals keep today's behaviour. sequelize.query is mocked.
// ============================================================================

const { getPhaseGoalStatus, isUnmet } = require('../../../src/services/arcProgressionService');

const G = (id, title, metric, target, extra = {}) => ({
  id, title, type: 'secondary', target_metric: metric, target_value: target, current_value: 0, status: 'active', priority: 2,
  created_at: '2026-10-01T00:00:00Z', unlocks_on_complete: [], ...extra,
});
const GOALS = [
  G('starter', 'Starter Fund', 'coins', 500),
  G('money', 'The Money Talk', 'coins', 2000),
  G('closet', 'Closet Upgrade', 'coins', 5000),
  G('legacy', 'Legacy', 'reputation', 10, { type: 'primary', priority: 1 }),
  G('firstimp', 'First Impressions', 'reputation', 3),
  G('consistent', 'Stay Consistent', 'consistency_streak', 7, { type: 'passive' }),
  G('lights', 'Keep the Lights On', 'coins', 200, { status: 'completed' }),
];

function models() {
  const query = jest.fn(async (sql) => {
    if (/status = 'active'/.test(sql)) return [GOALS.filter((g) => g.status === 'active').map((g) => ({ ...g }))];
    return [GOALS.map((g) => ({ ...g }))];
  });
  return { sequelize: { query } };
}

describe('the phase boundary on ladders', () => {
  test('only the rung being worked on counts as remaining; up-next rungs (a primary too) are not unmet', async () => {
    const status = await getPhaseGoalStatus('show-1', { title: 'Foundation', episode_start: 1, episode_end: 8 }, models());
    expect(status).toMatchObject({ total: 7, completed: 1, active_remaining: 3, up_next: 3, primary_total: 1, primary_incomplete: 0 });
    const unmet = status.goals.filter(isUnmet).map((g) => g.id).sort();
    expect(unmet).toEqual(['consistent', 'firstimp', 'starter']);
    expect(status.goals.find((g) => g.id === 'money').rung).toBe('up_next');
    expect(status.warning_message).toBe('Phase "Foundation" has 3 active goal(s) that haven\'t been completed or failed yet.');
  });

  test('isUnmet keeps the old rule for a goal that is not a waiting rung', () => {
    expect(isUnmet({ status: 'active', rung: 'active' })).toBe(true);
    expect(isUnmet({ status: 'paused', type: 'primary', rung: null })).toBe(true);
    expect(isUnmet({ status: 'completed', type: 'primary' })).toBe(false);
    expect(isUnmet({ status: 'active', type: 'primary', rung: 'up_next' })).toBe(false);
  });
});
