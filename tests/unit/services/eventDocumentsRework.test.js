/**
 * The event documents rework (2026-10-24):
 *   - a shopping list records the look it was drafted from (look_key), so
 *     "look changed" is the same on every device; Keep takes the new look;
 *   - Redraft within budget; amount checks on each version;
 *   - restore an earlier version; re-roll one line;
 *   - the career plan keeps goal / optional and its goal links into the
 *     episode, and says which lines the goal limit will not carry;
 *   - "Use in episode" for the career plan.
 */
const mockLook = { current: null };
jest.mock('../../../src/services/eventDocumentOverlayService', () => ({
  shoppingListContext: jest.fn(async () => ({ look: mockLook.current, balance: 300 })),
  overlayState: jest.fn(() => 'current'),
  makeDocumentOverlay: jest.fn(async () => null),
  shoppingLines: jest.fn(() => ({ lines: [], total: 0 })),
}));
jest.mock('../../../src/services/todoListService', () => ({
  generateTasks: jest.fn(),
  generateCareerTasks: jest.fn(),
  redraftDocumentLine: jest.fn(),
  listSlotOf: jest.requireActual('../../../src/services/todoListService').listSlotOf,
}));
jest.mock('../../../src/services/episodeEventsService', () => ({
  listEpisodeEvents: jest.fn(async () => ({ events: [{ id: 'ev-1' }] })),
}));

const todo = require('../../../src/services/todoListService');
const svc = require('../../../src/services/eventDocumentsService');

const flat = (sql) => sql.replace(/\s+/g, ' ').trim();

/** An in-memory event, episode and todo row, answering the service's SQL. */
function fakeModels(event, { todoRow = null, wardrobe = [] } = {}) {
  const state = { row: JSON.parse(JSON.stringify(event)), todo: todoRow ? { ...todoRow } : null, writes: [] };
  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(async (fn) => fn({ id: 'tx' })),
    query: jest.fn(async (sql, opts = {}) => {
      const q = flat(sql);
      const r = opts.replacements || {};
      if (/^SELECT \* FROM world_events WHERE id = :eventId AND show_id = :showId/.test(q)) {
        return [state.row.id === r.eventId && state.row.show_id === r.showId ? [JSON.parse(JSON.stringify(state.row))] : []];
      }
      if (/^SELECT \* FROM world_events WHERE id = :id/.test(q)) return [[JSON.parse(JSON.stringify(state.row))]];
      if (/FROM wardrobe/.test(q)) return wardrobe;
      if (/^SELECT id, show_id FROM episodes/.test(q)) return [[{ id: r.episodeId, show_id: 'show-1' }]];
      if (/^SELECT id, social_tasks, deleted_at FROM episode_todo_lists/.test(q)) return [state.todo ? [state.todo] : []];
      if (/^UPDATE episode_todo_lists SET social_tasks/.test(q)) {
        state.todo = { ...state.todo, social_tasks: JSON.parse(r.tasks) };
        state.writes.push('todo');
        return [[], 1];
      }
      if (/^INSERT INTO episode_todo_lists/.test(q)) {
        state.todo = { id: r.id, social_tasks: JSON.parse(r.tasks), deleted_at: null };
        state.writes.push('todo-insert');
        return [[], 1];
      }
      if (/^UPDATE world_events SET canon_consequences/.test(q)) {
        const cc = state.row.canon_consequences || {};
        state.row.canon_consequences = { ...cc, documents: { ...(cc.documents || {}), [r.type]: JSON.parse(r.doc) } };
        state.writes.push(r.type);
        return [[], 1];
      }
      return opts.type === 'SELECT' ? [] : [[], 0];
    }),
  };
  const CareerGoal = { findAll: jest.fn(async () => [{ id: 'g-1', title: 'Land a brand partnership', description: '', priority: 1 }]) };
  return { models: { sequelize, CareerGoal }, state };
}

const ids = { showId: 'show-1', eventId: 'ev-1' };
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Studio Session', prestige: 3, canon_consequences: {} };
const LOOK = { state: 'event', total: 640, pieces: [{ id: 'p-heels', name: 'Gold heels', category: 'shoes', charge: { amount: 240 } }, { id: 'p-dress', name: 'Slip dress', category: 'dress', charge: { amount: 400 } }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockLook.current = null;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  todo.generateTasks.mockResolvedValue([
    { slot: 'dress', label: 'Pick up the Slip dress', required: true, piece_id: 'p-dress' },
    { slot: 'shoes', label: 'Pick up the Gold heels', required: true, piece_id: 'p-heels' },
  ]);
  todo.generateCareerTasks.mockResolvedValue([
    { slot: 'a', label: 'Pitch the Sable team', task_source: 'goal', goal_id: 'g-1' },
    { slot: 'b', label: 'Snap the florals', task_source: 'optional' },
    { slot: 'c', label: 'Thank the host', task_source: 'goal' },
    { slot: 'd', label: 'Post a story', task_source: 'goal' },
  ]);
});
afterEach(() => jest.restoreAllMocks());

describe('the look the shopping list was drafted from', () => {
  test('a draft records the look; a changed look reads as changed; Keep takes the new look', async () => {
    mockLook.current = LOOK;
    const { models, state } = fakeModels(EVENT);
    const doc = await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    expect(doc.look_key).toBe('p-dress,p-heels');
    expect(doc.items[0].piece_id).toBe('p-dress');
    expect((await svc.getDocuments(models, ids)).look_changed).toBe(false);

    mockLook.current = { ...LOOK, pieces: [LOOK.pieces[0]] };
    expect((await svc.getDocuments(models, ids)).look_changed).toBe(true);

    const kept = await svc.keepListForLook(models, ids);
    expect(kept).toMatchObject({ version: 1, look_key: 'p-heels' });
    expect((await svc.getDocuments(models, ids)).look_changed).toBe(false);
    expect(state.row.canon_consequences.documents.shopping_list.version).toBe(1);
  });

  test('Redraft within budget hands the writer her balance and the look\'s total', async () => {
    mockLook.current = LOOK;
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list', budget: true });
    expect(todo.generateTasks).toHaveBeenCalledWith(expect.any(Object), { look: LOOK, budget: { balance: 300, total: 640 } });
  });
});

describe('amount checks', () => {
  test('a shopping line naming a price no piece costs is flagged; an edit is checked too, never refused', async () => {
    mockLook.current = LOOK;
    todo.generateTasks.mockResolvedValueOnce([{ slot: 'shoes', label: 'Gold heels for 999 coins' }]);
    const { models } = fakeModels(EVENT);
    const doc = await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    expect(doc.checks.amounts).toEqual({ ok: false, invented: [999] });
    const edited = await svc.editDocument(models, { ...ids, type: 'shopping_list', items: [{ slot: 'shoes', label: 'Gold heels, 240 coins' }], note: '  wear them twice ' });
    expect(edited.checks.amounts.ok).toBe(true);
    expect(edited.note).toBe('wear them twice');
  });

  test('a career line naming an amount the deal does not state is flagged', () => {
    const checks = svc.documentChecks('career_plan', [{ label: 'Ask for 2,000 coins' }], { money: { text: 'We will pay you an appearance fee of 500 Prime Coins.' } });
    expect(checks.amounts).toEqual({ ok: false, invented: [2000] });
  });
});

describe('restore and re-roll one line', () => {
  test('restore makes an earlier version current again, as a new draft version', async () => {
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    await svc.editDocument(models, { ...ids, type: 'shopping_list', items: [{ slot: 'shoes', label: 'Mine' }] });
    const back = await svc.restoreDocument(models, { ...ids, type: 'shopping_list', fromVersion: 1 });
    expect(back).toMatchObject({ version: 3, status: 'draft', source: 'restored', restored_from: 1 });
    expect(back.items.map((i) => i.label)).toEqual(['Pick up the Slip dress', 'Pick up the Gold heels']);
    expect(back.history.map((h) => h.version)).toEqual([2, 1]);
    await expect(svc.restoreDocument(models, { ...ids, type: 'shopping_list', fromVersion: 9 })).rejects.toMatchObject({ status: 404 });
  });

  test('a line re-roll changes that line only, as a new version', async () => {
    const { models } = fakeModels(EVENT);
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    todo.redraftDocumentLine.mockResolvedValueOnce({ label: 'Heels that outshine the chandelier', description: 'Gold' });
    const doc = await svc.redraftLine(models, { ...ids, type: 'shopping_list', index: 1 });
    expect(doc).toMatchObject({ version: 2, source: 'line_redraft' });
    expect(doc.items.map((i) => i.label)).toEqual(['Pick up the Slip dress', 'Heels that outshine the chandelier']);
    expect(doc.items[1].piece_id).toBe('p-heels');
  });

  test('a bigger goal is not re-rolled here', async () => {
    const { models } = fakeModels(EVENT);
    const plan = await svc.draftDocument(models, { ...ids, type: 'career_plan' });
    const goalIndex = plan.items.findIndex((i) => i.section === 'bigger_goals');
    await expect(svc.redraftLine(models, { ...ids, type: 'career_plan', index: goalIndex })).rejects.toMatchObject({ status: 409 });
  });
});

describe('the career plan into the episode', () => {
  test('goal / optional and goal links carry; the limit says which lines will not', async () => {
    const { models } = fakeModels(EVENT);
    const plan = await svc.draftDocument(models, { ...ids, type: 'career_plan' });
    const goals = svc.careerPlanGoals(plan);
    expect(goals.map((g) => [g.label, g.task_source, g.career_goal_id || null])).toEqual([
      ['Pitch the Sable team', 'goal', 'g-1'],
      ['Snap the florals', 'optional', null],
      ['Thank the host', 'goal', null],
      ['Post a story', 'goal', null],
    ]);
    // Prestige 3: a small event carries 3 of her goals; the optional idea goes first.
    const carry = svc.planCarry(EVENT, plan);
    expect(carry).toEqual({ limit: 3, carried: 3, dropped: ['Snap the florals'] });
    expect((await svc.getDocuments(models, ids)).career_carry).toEqual(carry);
  });

  test('Use in episode adds the plan\'s lines within the limit, keeps what is there, names what does not fit', async () => {
    const event = { ...EVENT, prestige: 3 };
    const { models, state } = fakeModels(event, {
      todoRow: { id: 't-1', deleted_at: null, social_tasks: [
        { slot: 'del', label: 'Post the reel', deliverable_id: 'd-1', required: true },
        { slot: 'own', label: 'Wear the pearls', task_source: 'goal' },
        { slot: 'plan_x', label: 'An old plan line', task_source: 'goal', from_event_document: { type: 'career_plan', version: 1 } },
      ] },
    });
    await svc.draftDocument(models, { ...ids, type: 'career_plan' });
    await svc.approveDocument(models, { ...ids, type: 'career_plan' });
    const out = await svc.useCareerPlanInEpisode(models, 'ep-1');

    const labels = state.todo.social_tasks.map((t) => t.label);
    expect(labels).toContain('Post the reel');
    expect(labels).toContain('Wear the pearls');
    expect(labels).not.toContain('An old plan line');
    // Room: limit 3, her own goal uses one → two plan lines fit.
    expect(out).toMatchObject({ added: 2, removed: 1 });
    expect(out.not_added).toEqual(['Thank the host', 'Post a story']);
    expect(state.todo.social_tasks.find((t) => t.label === 'Pitch the Sable team').career_goal_id).toBe('g-1');

    const again = await svc.useCareerPlanInEpisode(models, 'ep-1');
    expect(again).toMatchObject({ added: 0, removed: 0 });
  });

  test('a draft plan is refused', async () => {
    const { models } = fakeModels(EVENT, { todoRow: { id: 't-1', deleted_at: null, social_tasks: [] } });
    await svc.draftDocument(models, { ...ids, type: 'career_plan' });
    await expect(svc.useCareerPlanInEpisode(models, 'ep-1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('closet suggestions', () => {
  test('her own pieces for lines the look does not fill with one of hers', async () => {
    mockLook.current = LOOK;
    const { models } = fakeModels(EVENT, { wardrobe: [
      { id: 'w1', name: 'Silver sandals', clothing_category: 'heels', thumbnail_url: 'https://x/w1.png' },
      { id: 'w2', name: 'Red gown', clothing_category: 'gown' },
      { id: 'p-heels', name: 'Gold heels', clothing_category: 'shoes' },
      { id: 'w3', name: 'Cap', clothing_category: 'zzz' },
    ] });
    await svc.draftDocument(models, { ...ids, type: 'shopping_list' });
    const { closet } = await svc.getDocuments(models, ids);
    expect(closet.shoes).toEqual([{ id: 'w1', name: 'Silver sandals', image_url: 'https://x/w1.png' }]);
    expect(closet.dress.map((p) => p.id)).toEqual(['w2']);
  });
});
