/**
 * T9 (docs/EVENT_EPISODE_FLOW.md §8(cc); Task #2395): "Lala's goal tasks
 * scale with the event: 2–3 for small or low-key events, 4–6 for major ones;
 * no fixed template lists."
 */
const fs = require('fs');
const path = require('path');
const {
  GOAL_TASK_BOUNDS, goalTaskScale, goalFields, composeGoalTasks, enforceGoalTaskBounds,
} = require('../../../src/utils/goalTasks');
const { buildSocialTasks } = require('../../../src/services/episodeGeneratorService');
const episodeGenerator = require('../../../src/services/episodeGeneratorService');

const FULL = {
  name: 'Maison Rue Launch',
  description: 'The spring collection unveiled on the rooftop. Press everywhere.',
  format: 'brand_launch',
  theme: 'Garden noir',
  dress_code: 'Black tie florals',
  venue_name: 'The Glasshouse',
  host: 'Celeste Rue',
  host_brand: 'Maison Rue',
  narrative_stakes: 'If Lala lands here, the fashion press takes her seriously.',
  canon_consequences: { automation: { guest_profiles: [{ display_name: 'Nia' }, { handle: 'jules' }] } },
};

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('goalTaskScale: the event\'s prestige sets the bounds', () => {
  test.each([
    [1, 'small', 2, 3], [3, 'small', 2, 3], [4, 'small', 2, 3],
    [5, 'standard', 3, 4], [6, 'standard', 3, 4],
    [7, 'major', 4, 6], [8, 'major', 4, 6], [10, 'major', 4, 6],
  ])('prestige %i is %s (%i–%i)', (prestige, scale, min, max) => {
    expect(goalTaskScale({ prestige })).toMatchObject({ scale, min, max, prestige });
  });

  test('T9\'s two sizes as ruled: 2–3 small, 4–6 major', () => {
    expect(GOAL_TASK_BOUNDS.small).toEqual({ min: 2, max: 3 });
    expect(GOAL_TASK_BOUNDS.major).toEqual({ min: 4, max: 6 });
  });

  test('no prestige reads as the column default, 5; out of range is clamped', () => {
    expect(goalTaskScale({}).prestige).toBe(5);
    expect(goalTaskScale(null).scale).toBe('standard');
    expect(goalTaskScale({ prestige: '9' }).scale).toBe('major');
    expect(goalTaskScale({ prestige: 42 }).prestige).toBe(10);
    expect(goalTaskScale({ prestige: -3 }).scale).toBe('small');
  });
});

describe('enforceGoalTaskBounds', () => {
  const goals = (n, source = 'goal') => Array.from({ length: n }, (_, i) => ({ slot: `g${i}`, label: `Goal ${i}`, task_source: source }));

  test('more than the maximum is trimmed to it, optional ideas first', () => {
    const list = [...goals(3), { slot: 'idea', label: 'Idea', task_source: 'optional' }, ...goals(3).map((g) => ({ ...g, slot: `h${g.slot}` }))];
    const out = enforceGoalTaskBounds(list, goalTaskScale({ prestige: 2 }));
    expect(out).toHaveLength(3);
    expect(out.some((t) => t.task_source === 'optional')).toBe(false);
    expect(enforceGoalTaskBounds(goals(9), goalTaskScale({ prestige: 9 }))).toHaveLength(6);
  });

  test('fewer than the minimum is kept as it is and logged, never padded', () => {
    const out = enforceGoalTaskBounds(goals(1), goalTaskScale({ prestige: 8 }), 'Test');
    expect(out).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/\[Test\] 1 goal task\(s\) for a major event, below its minimum of 4; kept as generated, not padded/));
  });

  test('within bounds: unchanged, nothing logged', () => {
    expect(enforceGoalTaskBounds(goals(3), goalTaskScale({ prestige: 3 }))).toHaveLength(3);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('an item with no label is not counted', () => {
    expect(enforceGoalTaskBounds([...goals(2), { slot: 'x', label: '  ' }], goalTaskScale({ prestige: 3 }))).toHaveLength(2);
  });
});

describe('composeGoalTasks: written from the event, bounded by its scale', () => {
  test('a small event gets 2–3 goals; a major one 4–6', () => {
    const small = composeGoalTasks(goalFields({ ...FULL, prestige: 3 }), goalTaskScale({ prestige: 3 }));
    const major = composeGoalTasks(goalFields({ ...FULL, prestige: 9 }), goalTaskScale({ prestige: 9 }));
    expect(small.length).toBeGreaterThanOrEqual(2);
    expect(small.length).toBeLessThanOrEqual(3);
    expect(major.length).toBeGreaterThanOrEqual(4);
    expect(major.length).toBeLessThanOrEqual(6);
  });

  test('each goal names something of this event', () => {
    const tasks = composeGoalTasks(goalFields({ ...FULL, prestige: 9 }), goalTaskScale({ prestige: 9 }));
    const text = tasks.map((t) => `${t.label} ${t.description}`).join(' | ');
    expect(text).toMatch(/Black tie florals/);
    expect(text).toMatch(/The Glasshouse/);
    expect(text).toMatch(/Celeste Rue/);
    expect(text).toMatch(/Maison Rue/);
    for (const t of tasks) {
      expect(t).toMatchObject({ task_source: 'goal', required: false, completed: false });
    }
  });

  test('a bare event (name only) reaches the minimum from its name, no more', () => {
    const tasks = composeGoalTasks(goalFields({ name: 'Coffee with Nia', prestige: 2 }), goalTaskScale({ prestige: 2 }));
    expect(tasks.map((t) => t.label)).toEqual(['Post from Coffee with Nia', 'Recap Coffee with Nia']);
  });

  test('a major event with too few fields is not padded to 4; it is logged', () => {
    const tasks = composeGoalTasks(goalFields({ name: 'Gala', prestige: 9 }), goalTaskScale({ prestige: 9 }), { where: 'Test' });
    expect(tasks).toHaveLength(2);
    expect(console.warn).toHaveBeenCalled();
  });

  test('upTo: the minimum only (the AI fallback)', () => {
    const b = goalTaskScale({ prestige: 9 });
    expect(composeGoalTasks(goalFields({ ...FULL, prestige: 9 }), b, { upTo: b.min })).toHaveLength(4);
  });

  test('two different events get different goals', () => {
    const b = goalTaskScale({ prestige: 5 });
    const a = composeGoalTasks(goalFields(FULL), b).map((t) => t.label);
    const c = composeGoalTasks(goalFields({ name: 'Run Club', venue_name: 'Echo Park', dress_code: 'Athleisure' }), b).map((t) => t.label);
    expect(a.filter((l) => c.includes(l))).toEqual([]);
  });
});

describe('buildSocialTasks: no fixed template lists (T9)', () => {
  test('the templates are gone from the service and its exports', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../src/services/episodeGeneratorService.js'), 'utf8');
    expect(src).not.toMatch(/const SOCIAL_TASK_TEMPLATES\s*=/);
    expect(src).not.toMatch(/const PLATFORM_TASKS\s*=/);
    expect(src).not.toMatch(/const CATEGORY_TASKS\s*=/);
    expect(src).not.toMatch(/label: 'Get Ready With Me'/);
    expect(episodeGenerator.SOCIAL_TASK_TEMPLATES).toBeUndefined();
    expect(episodeGenerator.PLATFORM_TASKS).toBeUndefined();
    expect(episodeGenerator.CATEGORY_TASKS).toBeUndefined();
  });

  test('the Career Checklist fallback list is gone', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../src/services/todoListService.js'), 'utf8');
    expect(src).not.toMatch(/Capture the moment everyone will talk about/);
    expect(src).not.toMatch(/Give the brand their money shot/);
  });

  test('host platform and niche no longer add tasks; the count is the event\'s', () => {
    for (const prestige of [2, 5, 9]) {
      const plain = buildSocialTasks('invite', null, [], { event: { ...FULL, prestige } });
      const withHost = buildSocialTasks('invite', { platform: 'youtube', content_category: 'fashion' }, [], { event: { ...FULL, prestige } });
      const { min, max } = goalTaskScale({ prestige });
      for (const list of [plain, withHost]) {
        expect(list.length).toBeGreaterThanOrEqual(min);
        expect(list.length).toBeLessThanOrEqual(max);
      }
      expect(withHost.map((t) => t.slot)).toEqual(plain.map((t) => t.slot));
    }
  });

  test('context.prestige (no event row yet) sets the scale', () => {
    const ctx = { event_name: 'Pop-up', venue_name: 'Loft', host_name: 'Ada', dress_code: 'Denim', guest_names: ['Bo'], description: 'Small. Fun.' };
    expect(buildSocialTasks('invite', null, [], { ...ctx, prestige: 2 })).toHaveLength(3);
    expect(buildSocialTasks('invite', null, [], { ...ctx, prestige: 9 }).length).toBeGreaterThanOrEqual(4);
  });

  test('deliverables sit outside the bounds and stay the only required tasks', () => {
    const deliverables = [1, 2, 3, 4].map((i) => ({ id: `d-${i}`, description: `Reel ${i}`, required: true, owed_to: 'brand' }));
    const tasks = buildSocialTasks('brand_deal', null, [], { event: { ...FULL, prestige: 2 }, deliverables });
    expect(tasks.filter((t) => t.deliverable_id)).toHaveLength(4);
    expect(tasks.filter((t) => !t.deliverable_id).length).toBeLessThanOrEqual(3);
    expect(tasks.filter((t) => t.required).every((t) => t.deliverable_id)).toBe(true);
  });

  test('outfit pieces name the look', () => {
    const tasks = buildSocialTasks('invite', null, [{ name: 'Silk slip', brand: 'Vela', category: 'dress' }], { event: { ...FULL, prestige: 9 } });
    expect(tasks.find((t) => t.slot === 'look').label).toBe('Get ready in the Silk slip by Vela');
  });
});
