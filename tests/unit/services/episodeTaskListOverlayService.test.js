'use strict';

// P14 (Evoni, 2026-09-30; Task #2395): "An episode's task list can be
// approved; approving offers "Design task-list overlay" (cost shown) in the
// event's visual direction; it becomes an episode overlay placed on the
// tasks/deadline beat, replacing an earlier one."
const sharp = require('sharp');
const svc = require('../../../src/services/episodeTaskListOverlayService');
const compositor = require('../../../src/services/taskListOverlayCompositor');
const invitationCompositing = require('../../../src/services/invitationCompositingService');
const { deriveEventVisualDirection } = require('../../../src/services/eventVisualDirection');

const TASKS = [
  { slot: 'deliverable_d1', label: 'Post the sponsored reel', description: 'Reel · due 2026-10-12', deliverable_id: 'd1', owed_to: 'brand', required: true, completed: false },
  { slot: 'grwm', label: 'Film the GRWM', description: 'Feature the gown', task_source: 'goal', required: false, completed: false },
  { slot: 'career_network', label: 'Meet the editor', description: '', task_source: 'optional', generated_by: 'career', completed: false },
];

describe('the tasks/deadline beat and the overlay type', () => {
  test('is canonical beat 9, Reminder/Deadline, whose screen action is TODO_LIST', () => {
    expect(svc.TASK_LIST_BEAT).toMatchObject({ number: 9, name: 'Reminder/Deadline', screen_action: 'TODO_LIST' });
  });

  test('recognises a to-do / task-list type, and never the wardrobe checklist', () => {
    expect(svc.isTaskListOverlayType('TodoListOverlay')).toBe(true);
    expect(svc.isTaskListOverlayType('todo_list')).toBe(true);
    expect(svc.isTaskListOverlayType('custom_3', 'Mission List')).toBe(true);
    expect(svc.isTaskListOverlayType('wardrobe_list', 'Wardrobe List')).toBe(false);
    expect(svc.isTaskListOverlayType('todo_checklist')).toBe(false);
    expect(svc.isTaskListOverlayType('mail_panel', 'Mail Panel')).toBe(false);
  });
});

describe('task list content and hash', () => {
  test('content is label, description, source and required, in order', () => {
    expect(svc.taskListContent(TASKS)).toEqual([
      { label: 'Post the sponsored reel', description: 'Reel · due 2026-10-12', source: 'brand_deliverable', required: true },
      { label: 'Film the GRWM', description: 'Feature the gown', source: 'goal', required: false },
      { label: 'Meet the editor', description: '', source: 'optional', required: false },
    ]);
    expect(svc.taskListContent(JSON.stringify(TASKS))).toHaveLength(3); // stored as text
    expect(svc.taskListContent([{ label: '  ' }, null])).toEqual([]);
  });

  test('ticking a task done does not change the hash; an edit or a reorder does', () => {
    const h = svc.taskListHash(TASKS);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(svc.taskListHash(TASKS.map((t) => ({ ...t, completed: true })))).toBe(h);
    expect(svc.taskListHash(TASKS.map((t, i) => (i === 1 ? { ...t, label: 'Film the GRWM at golden hour' } : t)))).not.toBe(h);
    expect(svc.taskListHash([TASKS[1], TASKS[0], TASKS[2]])).not.toBe(h);
  });
});

describe('taskListOverlayState', () => {
  const hash = svc.taskListHash(TASKS);
  const estimate = { usd: 0.04, priced: true, unit: 'megapixel', units: 1, model: 'fal-ai/flux-pro/v1.1' };

  test('estimate is priced from the options the overlay is generated with', () => {
    expect(svc.TASK_LIST_OVERLAY_OPTIONS).toEqual({ size: 'portrait', quality: 'hd', useCase: 'overlay' });
    expect(svc.estimateTaskListOverlay()).toEqual(estimate);
  });

  test('no list: nothing offered', () => {
    expect(svc.taskListOverlayState(null)).toMatchObject({ exists: false, task_count: 0, approved: false, overlay: null, offer: { offered: false } });
  });

  test('not approved: no offer', () => {
    const s = svc.taskListOverlayState({ social_tasks: TASKS });
    expect(s).toMatchObject({ exists: true, task_count: 3, hash, approved: false, overlay: null, offer: { offered: false } });
  });

  test('approved = the approved hash equals the current hash; then the design is offered with its estimate', () => {
    const s = svc.taskListOverlayState({ social_tasks: TASKS, task_list_approved_at: new Date(), task_list_approved_hash: hash });
    expect(s.approved).toBe(true);
    expect(s.offer).toEqual({ offered: true, kind: 'design', requires_approval: false, estimate });
    const stale = svc.taskListOverlayState({ social_tasks: TASKS, task_list_approved_at: new Date(), task_list_approved_hash: 'old' });
    expect(stale.approved).toBe(false);
    expect(stale.offer).toEqual({ offered: false });
  });

  test('a current overlay: no offer; a changed list: outdated, redesign offered needing approval', () => {
    const row = { social_tasks: TASKS, task_list_approved_at: new Date(), task_list_approved_hash: hash, task_overlay_asset_id: 'a1', task_overlay_hash: hash };
    const current = svc.taskListOverlayState(row, { s3_url_processed: 'https://x/o.png', metadata: '{"overlay_type":"TodoListOverlay","beat_number":9,"beat_name":"Reminder/Deadline"}' });
    expect(current.overlay).toEqual({
      asset_id: 'a1', designed_hash: hash, outdated: false, image_url: 'https://x/o.png',
      overlay_type: 'TodoListOverlay', beat: { number: 9, name: 'Reminder/Deadline' },
    });
    expect(current.offer).toEqual({ offered: false });

    const edited = [...TASKS, { label: 'Thank the host', task_source: 'goal' }];
    const changed = svc.taskListOverlayState({ ...row, social_tasks: edited });
    expect(changed.approved).toBe(false);
    expect(changed.overlay.outdated).toBe(true);
    expect(changed.offer).toEqual({ offered: true, kind: 'redesign', requires_approval: true, estimate });
  });
});

describe('the image: background prompt and composited text carry the event\'s visual direction', () => {
  const direction = deriveEventVisualDirection({ theme: 'soft glam', prestige: 9, color_palette: ['blush', 'rose gold'] });

  test('background prompt: the show\'s style first, the theme, palette and richness, no text', () => {
    const prompt = svc.buildTaskListBackgroundPrompt({ stylePrefix: 'SHOW STYLE: pastel. ', direction });
    expect(prompt.startsWith('SHOW STYLE: pastel. ')).toBe(true);
    expect(prompt).toContain('(soft glam theme)');
    expect(prompt).toContain(`Background: ${direction.background}.`);
    expect(prompt).toContain('Color palette emphasis: blush, rose gold.');
    expect(prompt).toContain('Maximum luxury');
    expect(prompt).toContain('NO TEXT anywhere on the image');
  });

  test('with no source event it uses the invitation\'s default direction', () => {
    expect(svc.buildTaskListBackgroundPrompt({ direction: null })).toContain('(default theme)');
  });

  test('composite content: every task\'s text, its source note, the deadline, and the theme\'s accent', () => {
    const content = compositor.buildTaskListLayerContent(svc.taskListContent(TASKS), {
      eventName: 'Velvet Gala', eventDate: '2026-10-12', direction,
    });
    expect(content).toEqual({
      heading: "Lala's To-Do",
      subheading: 'Velvet Gala',
      deadline: 'Before October 12',
      theme: 'soft glam',
      accent: compositor.THEME_ACCENTS['soft glam'],
      tasks: [
        { label: 'Post the sponsored reel', note: 'Required · for the brand', required: true },
        { label: 'Film the GRWM', note: null, required: false },
        { label: 'Meet the editor', note: 'Optional', required: false },
      ],
    });
    expect(compositor.accentFor(deriveEventVisualDirection({ theme: 'chic minimal' }))).toBe('#1A1A1A');
    expect(compositor.accentFor(null)).toBe(compositor.THEME_ACCENTS.default);
  });

  test('compositeTaskList draws on the background and keeps its size', async () => {
    jest.spyOn(invitationCompositing, 'checkFonts').mockResolvedValue(true); // no font download
    const bg = await sharp({ create: { width: 288, height: 512, channels: 3, background: '#f5e6e8' } }).png().toBuffer();
    const content = compositor.buildTaskListLayerContent(svc.taskListContent(TASKS), { direction });
    const out = await compositor.compositeTaskList(bg, content);
    const meta = await sharp(out.buffer).metadata();
    expect(meta).toMatchObject({ format: 'png', width: 288, height: 512 });
    expect(out.drawn).toBe(3);
    const { data: before } = await sharp(bg).raw().toBuffer({ resolveWithObject: true });
    const { data: after } = await sharp(out.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(Buffer.compare(before, after)).not.toBe(0);
    jest.restoreAllMocks();
  });

  test('a long list is shrunk, then cut with a "+ N more" line, never overflowing', async () => {
    jest.spyOn(invitationCompositing, 'checkFonts').mockResolvedValue(true);
    const many = Array.from({ length: 40 }, (_, i) => ({ label: `Task ${i + 1} with a fairly long description of the thing to do`, task_source: 'goal' }));
    const bg = await sharp({ create: { width: 288, height: 512, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const out = await compositor.compositeTaskList(bg, compositor.buildTaskListLayerContent(svc.taskListContent(many), { direction }));
    expect(out.drawn).toBeGreaterThan(0);
    expect(out.drawn).toBeLessThan(40);
    jest.restoreAllMocks();
  });
});

describe('mergeTaskListIntoOverlayStatus', () => {
  const overlay = { id: 'tl-1', url: 'https://x/tl.png', overlay_type: 'TodoListOverlay' };
  const types = [
    { id: 'mail_panel', name: 'Mail Panel', generated: true, asset_id: 'mp' },
    { id: 'todo_list', name: 'To-Do List', generated: false, asset_id: null },
  ];

  test('fills the show\'s task-list type entry as the episode\'s own', () => {
    const out = svc.mergeTaskListIntoOverlayStatus(types, overlay);
    expect(out[0]).toBe(types[0]);
    expect(out[1]).toMatchObject({ id: 'todo_list', generated: true, asset_id: 'tl-1', is_episode_override: true, is_episode_task_list: true });
  });

  test('appends its own entry when the show has no task-list type; none leaves the list as it is', () => {
    const out = svc.mergeTaskListIntoOverlayStatus([types[0]], overlay);
    expect(out[1]).toMatchObject({ id: 'TodoListOverlay', name: 'Task List', beat: 'Beat 9', lifecycle: 'per_episode', asset_id: 'tl-1' });
    expect(svc.mergeTaskListIntoOverlayStatus(types, null)).toBe(types);
  });
});
