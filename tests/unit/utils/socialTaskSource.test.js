/**
 * T1 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2292): only an accepted
 * deliverable makes a social task required. Every generated task is a goal
 * or an optional idea.
 */
const fs = require('fs');
const path = require('path');
const { buildSocialTasks } = require('../../../src/services/episodeGeneratorService');
const {
  socialTaskSource, isSocialTaskRequired, withDeliverableTasks, withCareerTasks, TASK_SOURCES,
} = require('../../../src/utils/socialTaskSource');

const EVENT_TYPES = ['invite', 'brand_deal', 'guest', 'upgrade', 'something_else'];
const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitter', 'onlyfans', 'twitch', 'substack', 'multi'];
const CATEGORIES = ['fashion', 'beauty', 'lifestyle', 'fitness', 'food', 'music', 'creator_economy', 'drama'];

const DELIVERABLE = { id: 'd-1', description: 'One reel in the coat', deliverable_type: 'instagram_reel', due_date: null, required: true };

describe('buildSocialTasks: no deliverables, nothing required', () => {
  test.each(EVENT_TYPES)('%s, with every platform and niche', (type) => {
    const lists = [buildSocialTasks(type)];
    for (const platform of PLATFORMS) {
      for (const content_category of CATEGORIES) lists.push(buildSocialTasks(type, { platform, content_category }));
    }
    for (const tasks of lists) {
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.filter((t) => t.required)).toEqual([]);
      for (const t of tasks) expect(['goal', 'optional']).toContain(t.task_source);
    }
  });

  test('the brand_deal list no longer invents Sponsored Post 1/2', () => {
    const slots = buildSocialTasks('brand_deal').map((t) => t.slot);
    expect(slots).not.toContain('brand_post_1');
    expect(slots).not.toContain('brand_post_2');
    const src = fs.readFileSync(path.join(__dirname, '../../../src/services/episodeGeneratorService.js'), 'utf8');
    expect(src).not.toMatch(/label: 'Sponsored Post/);
  });

  test('a template keeps its goal/optional distinction', () => {
    const byslot = Object.fromEntries(buildSocialTasks('invite').map((t) => [t.slot, t.task_source]));
    expect(byslot.grwm).toBe('goal');
    expect(byslot.go_live).toBe('optional');
  });
});

describe('buildSocialTasks: a real deliverable is the one required task', () => {
  test('exactly that task is required, and it names its deliverable', () => {
    const tasks = buildSocialTasks('brand_deal', { platform: 'youtube' }, [], { deliverables: [DELIVERABLE] });
    const required = tasks.filter((t) => t.required);
    expect(required).toHaveLength(1);
    expect(required[0]).toMatchObject({
      slot: 'deliverable_d-1', label: 'One reel in the coat', deliverable_id: 'd-1', task_source: 'host_requirement', owed_to: 'host',
    });
  });

  test('a deliverable the terms mark optional is shown, not required', () => {
    const tasks = buildSocialTasks('invite', null, [], { deliverables: [{ ...DELIVERABLE, required: false }] });
    expect(tasks.filter((t) => t.required)).toEqual([]);
    expect(tasks.find((t) => t.deliverable_id).task_source).toBe('host_requirement');
  });

  test('a deliverable row without a description adds no task', () => {
    const tasks = buildSocialTasks('invite', null, [], { deliverables: [{ ...DELIVERABLE, description: '  ' }] });
    expect(tasks.some((t) => t.deliverable_id)).toBe(false);
  });
});

describe('a task stored before T1', () => {
  const legacy = [
    { slot: 'brand_post_1', label: 'Sponsored Post 1', required: true, completed: true },
    { slot: 'grwm', label: 'GRWM', required: true, completed: true },
    { slot: 'go_live', label: 'Go Live', required: false },
  ];

  test('reads as a goal or an optional idea, never required', () => {
    expect(legacy.map(socialTaskSource)).toEqual(['goal', 'goal', 'optional']);
    expect(legacy.filter(isSocialTaskRequired)).toEqual([]);
  });

  test('a regenerated list drops the retired slots and keeps completion', () => {
    const tasks = withDeliverableTasks(legacy, [DELIVERABLE]);
    expect(tasks.map((t) => [t.slot, t.task_source, t.required, Boolean(t.completed)])).toEqual([
      ['grwm', 'goal', false, true],
      ['go_live', 'optional', false, false],
      ['deliverable_d-1', 'host_requirement', true, false],
    ]);
  });

  test('regenerating twice does not duplicate the deliverable task', () => {
    const once = withDeliverableTasks(legacy, [DELIVERABLE]);
    expect(withDeliverableTasks(once, [DELIVERABLE])).toEqual(once);
  });
});

// ── T2 (§8(bb); Task #2294): one task list, a source on every item ──

describe('the four sources', () => {
  test('a deliverable is a host requirement or a brand deliverable, by owed_to', () => {
    const tasks = buildSocialTasks('brand_deal', null, [], {
      deliverables: [DELIVERABLE, { ...DELIVERABLE, id: 'd-2', description: 'Tag the brand', owed_to: 'brand' }],
    });
    const byId = Object.fromEntries(tasks.filter((t) => t.deliverable_id).map((t) => [t.deliverable_id, t]));
    expect(byId['d-1']).toMatchObject({ task_source: 'host_requirement', owed_to: 'host', required: true });
    expect(byId['d-2']).toMatchObject({ task_source: 'brand_deliverable', owed_to: 'brand', required: true });
  });

  test('every item of a list carries one of the four', () => {
    const tasks = buildSocialTasks('invite', { platform: 'youtube', content_category: 'fashion' }, [], {
      deliverables: [DELIVERABLE, { ...DELIVERABLE, id: 'd-2', owed_to: 'brand' }],
    });
    for (const t of tasks) expect(TASK_SOURCES).toContain(socialTaskSource(t));
    expect(new Set(tasks.map(socialTaskSource))).toEqual(new Set(TASK_SOURCES));
  });

  test("a T1-era deliverable task (no owed_to) reads as a host requirement", () => {
    expect(socialTaskSource({ deliverable_id: 'd-9', task_source: 'deliverable', required: true })).toBe('host_requirement');
  });
});

describe('withCareerTasks: the Career Checklist adds to the one list', () => {
  const list = [
    { slot: 'grwm', label: 'GRWM', task_source: 'goal', required: false, completed: true },
    { slot: 'deliverable_d-1', label: 'Reel', deliverable_id: 'd-1', owed_to: 'brand', task_source: 'brand_deliverable', required: true, completed: false },
  ];
  const career = [
    { slot: 'content_main', label: 'Capture the moment', task_source: 'goal', required: false },
    { slot: 'social_post', label: 'Post before midnight', task_source: 'optional', required: false },
  ];

  test('career goals and ideas join the list; nothing already there is touched', () => {
    const out = withCareerTasks(list, career);
    expect(out.slice(0, 2)).toEqual(list);
    expect(out.slice(2).map((t) => [t.slot, t.task_source, t.required, t.generated_by])).toEqual([
      ['career_content_main', 'goal', false, 'career'],
      ['career_social_post', 'optional', false, 'career'],
    ]);
  });

  test('a career item is never required, even if the AI says so', () => {
    const out = withCareerTasks([], [{ slot: 'x', label: 'Brand money shot', required: true }]);
    expect(out[0]).toMatchObject({ required: false, task_source: 'goal' });
    expect(out.filter(isSocialTaskRequired)).toEqual([]);
  });

  test('a regenerate replaces the previous career items and keeps a carried-over completion', () => {
    const first = withCareerTasks(list, career).map((t) => (t.slot === 'career_content_main' ? { ...t, completed: true } : t));
    const second = withCareerTasks(first, [
      { slot: 'content_main', label: 'Capture the moment, again', task_source: 'goal' },
      { slot: 'network', label: 'Meet the editor', task_source: 'goal' },
    ]);
    expect(second.map((t) => t.slot)).toEqual(['grwm', 'deliverable_d-1', 'career_content_main', 'career_network']);
    expect(second.find((t) => t.slot === 'career_content_main')).toMatchObject({ completed: true, label: 'Capture the moment, again' });
    expect(second.find((t) => t.slot === 'career_network').completed).toBe(false);
  });

  test('a career item never takes a deliverable\'s place or slot', () => {
    const out = withCareerTasks(list, [{ slot: 'grwm', label: 'Clash' }, { deliverable_id: 'd-x', label: 'Fake' }]);
    expect(out.filter((t) => t.deliverable_id)).toEqual([list[1]]);
    expect(new Set(out.map((t) => t.slot)).size).toBe(out.length);
  });
});
