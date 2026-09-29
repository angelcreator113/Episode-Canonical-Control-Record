/**
 * T1 (docs/EVENT_EPISODE_FLOW.md §8(bb); Task #2292): only an accepted
 * deliverable makes a social task required. Every generated task is a goal
 * or an optional idea.
 */
const fs = require('fs');
const path = require('path');
const { buildSocialTasks } = require('../../../src/services/episodeGeneratorService');
const {
  socialTaskSource, isSocialTaskRequired, withDeliverableTasks,
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
      slot: 'deliverable_d-1', label: 'One reel in the coat', deliverable_id: 'd-1', task_source: 'deliverable',
    });
  });

  test('a deliverable the terms mark optional is shown, not required', () => {
    const tasks = buildSocialTasks('invite', null, [], { deliverables: [{ ...DELIVERABLE, required: false }] });
    expect(tasks.filter((t) => t.required)).toEqual([]);
    expect(tasks.find((t) => t.deliverable_id).task_source).toBe('deliverable');
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
      ['deliverable_d-1', 'deliverable', true, false],
    ]);
  });

  test('regenerating twice does not duplicate the deliverable task', () => {
    const once = withDeliverableTasks(legacy, [DELIVERABLE]);
    expect(withDeliverableTasks(once, [DELIVERABLE])).toEqual(once);
  });
});
