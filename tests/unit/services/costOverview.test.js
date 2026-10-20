/**
 * The cost page's pure parts (services/costOverview; Evoni, 2026-10-19):
 * which feature a logged route belongs to, the budget lines and levels, the
 * Daily update's budget warnings, and the post-picture waiting count
 * degrading to "not available yet" before its column exists.
 */
const co = require('../../../src/services/costOverview');

describe('featureFor: logged route names → features', () => {
  test.each([
    ['camera-roll', false, 'camera_roll'],
    ['pulse-post-picture', true, 'post_pictures'],
    ['picture-suggestion', true, 'picture_suggestions'],
    ['media-variation', true, 'variations'],
    ['cast-generate', false, 'character_tools'],
    ['svc:sceneGenerationService', true, 'scene_images'],
    ['sceneSetRoutes', true, 'scene_images'],
    ['svc:characterAppearance', true, 'portraits'],
    ['castRoutes', true, 'portraits'],
    ['castRoutes', false, 'character_tools'],
    ['characterRegistry', false, 'character_tools'],
    ['svc:invitationGeneratorService', true, 'show_graphics'],
    ['worldMomentsRoutes', false, 'world_moments'],
    ['svc:worldMoments', false, 'world_moments'],
    ['brandPulseRoutes', false, 'brands'],
    ['svc:brandPulse', false, 'brands'],
    ['svc:pulseDrafter', false, 'pulse_engine'],
    ['feedPostRoutes', false, 'pulse_engine'],
    ['worker:pulseQueue', false, 'pulse_engine'],
    ['episodeScriptWriterRoutes', false, 'episodes'],
    ['worldEvents', false, 'episodes'],
    ['storyteller', false, 'writing'],
    ['svc:storyGenerationService', false, 'writing'],
    // The writing hub's routes, named with their folder (aiCostTracker.routeNameFromStack).
    ['memories/engine', false, 'writing'],
    ['memories/assistant', false, 'writing'],
    ['unknown', false, 'other'],
    ['', false, 'other'],
    [null, false, 'other'],
    ['something-new', false, 'other'],
  ])('%s (image %s) → %s', (route, image, key) => {
    expect(co.featureFor(route, { image })).toBe(key);
  });

  test('every feature key has a label', () => {
    const keys = co.FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    co.FEATURES.forEach((f) => expect(f.label).toBeTruthy());
  });
});

describe('budget lines and levels', () => {
  test('levelFor: ok below 80, warn from 80, over at 100', () => {
    expect(co.levelFor(0)).toBe('ok');
    expect(co.levelFor(79.9)).toBe('ok');
    expect(co.levelFor(80)).toBe('warn');
    expect(co.levelFor(99.9)).toBe('warn');
    expect(co.levelFor(100)).toBe('over');
    expect(co.levelFor(140)).toBe('over');
  });

  test('budgetLine: spent, cap, left, percent', () => {
    expect(co.budgetLine(8.5, 10)).toEqual({ spent_usd: 8.5, cap_usd: 10, left_usd: 1.5, percent: 85, level: 'warn' });
    expect(co.budgetLine(12, 10)).toMatchObject({ left_usd: 0, percent: 120, level: 'over' });
    expect(co.budgetLine(null, 50)).toMatchObject({ spent_usd: 0, percent: 0, level: 'ok' });
    expect(co.budgetLine(5, 0)).toMatchObject({ percent: 0, left_usd: 0 });
  });

  test('budgetAlerts: one per line past 80%, none when the log could not be read', () => {
    const budgets = { read_ok: true, all: co.budgetLine(20, 50), images: co.budgetLine(8.5, 10) };
    const alerts = co.budgetAlerts(budgets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ budget: 'images', level: 'warn', percent: 85 });
    expect(alerts[0].message).toContain('85%');

    const over = co.budgetAlerts({ read_ok: true, all: co.budgetLine(51, 50), images: co.budgetLine(10, 10) });
    expect(over.map((a) => [a.budget, a.level])).toEqual([['all', 'over'], ['images', 'over']]);
    expect(over[0].message).toMatch(/refused until tomorrow/);

    expect(co.budgetAlerts({ read_ok: false, all: co.budgetLine(51, 50), images: co.budgetLine(10, 10) })).toEqual([]);
    expect(co.budgetAlerts(null)).toEqual([]);
  });

  test('postPictureLimit: PULSE_POST_IMAGES_PER_DAY, default 20', () => {
    const saved = process.env.PULSE_POST_IMAGES_PER_DAY;
    delete process.env.PULSE_POST_IMAGES_PER_DAY;
    expect(co.postPictureLimit()).toBe(20);
    process.env.PULSE_POST_IMAGES_PER_DAY = '5';
    expect(co.postPictureLimit()).toBe(5);
    process.env.PULSE_POST_IMAGES_PER_DAY = 'nope';
    expect(co.postPictureLimit()).toBe(20);
    if (saved === undefined) delete process.env.PULSE_POST_IMAGES_PER_DAY; else process.env.PULSE_POST_IMAGES_PER_DAY = saved;
  });
});

describe('post pictures today', () => {
  beforeEach(() => co.resetColumnCacheForTests());

  test('no picture_job column yet: waiting is "not available", never an error', async () => {
    const query = jest.fn(async (sql) => (/information_schema/.test(sql) ? [[]] : [[{ n: 3 }]]));
    const out = await co.postPicturesToday({ sequelize: { query } }, { dayStart: new Date() });
    expect(out).toEqual({ made_today: 3, limit: co.postPictureLimit(), waiting: null, waiting_available: false });
    expect(query.mock.calls.some(([sql]) => /picture_job->>'status'/.test(sql))).toBe(false);
  });

  test('with the column: the waiting count', async () => {
    const query = jest.fn(async (sql) => {
      if (/information_schema/.test(sql)) return [[{ '?column?': 1 }]];
      if (/feed_posts/.test(sql)) return [[{ n: 4 }]];
      return [[{ n: 7 }]];
    });
    const out = await co.postPicturesToday({ sequelize: { query } }, { dayStart: new Date() });
    expect(out).toMatchObject({ made_today: 7, waiting: 4, waiting_available: true });
  });
});
