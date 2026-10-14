/**
 * Lala's Career list (Task #3181), with a stand-in database: goals as of the
 * episode, milestones, brands worked with from past deals (episodes accepted
 * before this one), and the per-brand hide (Evoni, 2026-10-14, ruling 4).
 */
const { careerListAt, saveHiddenBrands, hiddenBrandsOf } = require('../../../src/services/careerListService');

const T = (iso) => new Date(iso).toISOString();

function fakeDb({ show = { id: 's1', metadata: {} }, episode = { id: 'ep3', episode_number: 3 }, counted = [], goals = [], events = [], opps = [] } = {}) {
  const calls = [];
  const query = jest.fn(async (sql, opts) => {
    calls.push({ sql, replacements: opts?.replacements });
    if (sql.includes('FROM shows')) return [[show].filter(Boolean)];
    if (sql.includes('FROM episodes WHERE id')) return [[episode].filter(Boolean)];
    if (sql.includes("evaluation_status = 'accepted'")) return [counted];
    if (sql.includes('FROM career_goals')) return [goals];
    if (sql.includes('FROM world_events')) return [events];
    if (sql.includes('FROM opportunities')) return [opps];
    throw new Error(`unexpected SQL: ${sql}`);
  });
  return { models: { sequelize: { query } }, calls };
}

const COUNTED = [
  { id: 'ep1', episode_number: 1, title: 'One', completed_at: T('2026-10-01T10:00:00Z') },
  { id: 'ep2', episode_number: 2, title: 'Two', completed_at: T('2026-10-05T10:00:00Z') },
];

test('goals as of the episode: one completed after the last counted episode is still active then', async () => {
  const { models, calls } = fakeDb({
    counted: COUNTED,
    goals: [
      { id: 'g1', title: 'First cover', type: 'primary', target_metric: 'reputation', target_value: 5, status: 'completed', completed_at: T('2026-10-04T00:00:00Z') },
      { id: 'g2', title: 'Ten thousand followers', type: 'secondary', target_metric: 'followers', target_value: 10000, status: 'completed', completed_at: T('2026-10-09T00:00:00Z') },
      { id: 'g3', title: 'Save 2,000 coins', type: 'passive', target_metric: 'coins', target_value: 2000, status: 'active', completed_at: null },
    ],
  });
  const list = await careerListAt(models, 's1', { episodeId: 'ep3' });
  expect(list.goals.map((g) => [g.id, g.status])).toEqual([['g1', 'completed'], ['g2', 'active'], ['g3', 'active']]);
  expect(list.milestones).toEqual([{ kind: 'goal', title: 'First cover' }]);
  expect(list.as_of).toEqual({ episode_id: 'ep3', episodes_counted: 2 });
  // Only episodes numbered below this one count.
  expect(calls.find((c) => c.sql.includes("evaluation_status = 'accepted'")).replacements.below).toBe(3);
});

test('now (no episode): every completed goal is completed', async () => {
  const { models } = fakeDb({ counted: COUNTED, goals: [{ id: 'g2', title: 'Ten thousand followers', status: 'completed', completed_at: T('2026-10-09T00:00:00Z'), target_value: 1 }] });
  expect((await careerListAt(models, 's1')).goals[0].status).toBe('completed');
});

test('brands: each counted event brand and past deal, merged by name, in episode order; hidden ones left out but listed', async () => {
  const { models } = fakeDb({
    show: { id: 's1', metadata: JSON.stringify({ career_hidden_brands: ['velour magazine'] }) },
    counted: COUNTED,
    events: [
      { used_in_episode_id: 'ep2', host_brand: 'Maison Belle', host: 'Belle' },
      { used_in_episode_id: 'ep1', host_brand: null, host: 'STUDIO BY SABLE' },
    ],
    opps: [
      { episode_id: 'ep2', brand_or_company: 'maison belle', career_milestone: 'First runway' },
      { episode_id: 'ep1', brand_or_company: 'Velour Magazine', career_milestone: null },
    ],
  });
  const list = await careerListAt(models, 's1', { episodeId: 'ep3' });
  expect(list.brands).toEqual([
    { name: 'STUDIO BY SABLE', episodes: [{ id: 'ep1', number: 1, title: 'One' }] },
    { name: 'Maison Belle', episodes: [{ id: 'ep2', number: 2, title: 'Two' }] },
  ]);
  expect(list.hidden_brands).toEqual(['velour magazine']);
  expect(list.milestones).toContainEqual({ kind: 'opportunity', title: 'First runway', episode: { id: 'ep2', number: 2, title: 'Two' } });
});

test('nothing counted yet: no brands, and no event or deal is read', async () => {
  const { models, calls } = fakeDb({ counted: [] });
  const list = await careerListAt(models, 's1', { episodeId: 'ep3' });
  expect(list.brands).toEqual([]);
  expect(calls.some((c) => c.sql.includes('FROM world_events'))).toBe(false);
});

test('a missing show or episode is a 404', async () => {
  await expect(careerListAt(fakeDb({ show: null }).models, 's1')).rejects.toMatchObject({ name: 'CareerListError', status: 404, code: 'SHOW_NOT_FOUND' });
  await expect(careerListAt(fakeDb({ episode: null }).models, 's1', { episodeId: 'x' })).rejects.toMatchObject({ status: 404, code: 'EPISODE_NOT_FOUND' });
});

describe('hidden brands', () => {
  const showModel = (metadata) => {
    const show = { metadata, update: jest.fn(async (v) => Object.assign(show, v)) };
    return { Show: { findByPk: jest.fn(async () => show) }, show };
  };

  test('saved in show settings, trimmed and once each, keeping the other settings', async () => {
    const { Show, show } = showModel({ required_slots: ['outfit'] });
    expect(await saveHiddenBrands({ Show }, 's1', [' Velour Magazine ', 'velour magazine', 'Maison Belle'])).toEqual(['Velour Magazine', 'Maison Belle']);
    expect(show.update).toHaveBeenCalledWith({ metadata: { required_slots: ['outfit'], career_hidden_brands: ['Velour Magazine', 'Maison Belle'] } });
    expect(await saveHiddenBrands({ Show }, 's1', [])).toEqual([]);
  });

  test('a bad list is refused in plain words', async () => {
    const { Show } = showModel({});
    await expect(saveHiddenBrands({ Show }, 's1', 'Velour')).rejects.toMatchObject({ status: 400, message: 'brands must be a list of brand names.' });
    await expect(saveHiddenBrands({ Show }, 's1', [''])).rejects.toMatchObject({ status: 400 });
    await expect(saveHiddenBrands({ Show }, 's1', ['x'.repeat(201)])).rejects.toMatchObject({ status: 400 });
  });

  test('read from the metadata, as JSON or text', () => {
    expect(hiddenBrandsOf({ career_hidden_brands: ['A', '', 3] })).toEqual(['A']);
    expect(hiddenBrandsOf(JSON.stringify({ career_hidden_brands: ['B'] }))).toEqual(['B']);
    expect(hiddenBrandsOf(null)).toEqual([]);
  });
});
