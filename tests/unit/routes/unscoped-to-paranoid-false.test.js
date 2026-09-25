/**
 * Three former .unscoped() calls include soft-deleted rows (Task #1843).
 *
 * In Sequelize 6 `.unscoped()` clears default and named scopes but NOT the
 * paranoid predicate; only `paranoid: false` does. The calls below were
 * written to see deleted rows too:
 *   - POST /admin/reset-character-stats: Show list ("List ALL shows"; the raw
 *     SELECT it replaced in 081e0d989 had no deleted_at predicate).
 *   - POST /generate-next-chapter: StorytellerStory approved-story lookup and
 *     StoryTaskArc lookup (908f93090). StoryTaskArc is not paranoid (#1841).
 *
 * No database: the real models are loaded with the app's define on a
 * Sequelize instance whose query() is stubbed to record the generated SQL,
 * and the real route handlers are invoked with those models.
 */
const path = require('path');
const { Sequelize } = require('sequelize');

const SRC = path.join(__dirname, '..', '..', '..', 'src');
const appConfig = require(path.join(SRC, 'config', 'sequelize.js'));

const captured = [];

function buildModels() {
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', {
    dialect: 'postgres',
    logging: false,
    define: appConfig.test.define,
  });
  sequelize.query = async (sql) => {
    captured.push(typeof sql === 'string' ? sql : sql.query);
    return [];
  };
  const Show = require(path.join(SRC, 'models', 'Show.js'))(sequelize);
  const StorytellerStory = require(path.join(SRC, 'models', 'StorytellerStory.js'))(sequelize);
  const StoryTaskArc = require(path.join(SRC, 'models', 'StoryTaskArc.js'))(sequelize);
  // Stop reset-character-stats right after the Show list; only its SQL matters.
  const CharacterState = { count: async () => { throw new Error('stop after show list'); } };
  return { sequelize, Show, StorytellerStory, StoryTaskArc, CharacterState };
}

const mockModels = buildModels();
jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({
  aiRateLimiter: (req, res, next) => next(),
}));
// Stop generate-next-chapter at the model call; no network.
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: async () => { throw new Error('stop before AI call'); } },
})));

function handler(router, routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods.post
  );
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function fakeRes() {
  return { status() { return this; }, json() { return this; }, setTimeout() {} };
}

describe('former .unscoped() calls generate SQL with no deleted_at predicate', () => {
  beforeEach(() => { captured.length = 0; });

  it('the app define, Show and StorytellerStory are paranoid; StoryTaskArc is not (the premise)', () => {
    expect(appConfig.test.define.paranoid).toBe(true);
    expect(mockModels.Show.options.paranoid).toBe(true);
    expect(mockModels.StorytellerStory.options.paranoid).toBe(true);
    expect(mockModels.StoryTaskArc.options.paranoid).toBe(false);
  });

  it('reset-character-stats lists shows including soft-deleted ones', async () => {
    const router = require('../../../src/routes/evaluation');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await handler(router, '/admin/reset-character-stats')({ body: {} }, fakeRes());
    errSpy.mockRestore();

    const list = captured.filter((sql) => /FROM "shows"/.test(sql));
    expect(list).toHaveLength(1);
    expect(list[0]).not.toMatch(/deleted_at/);
  });

  it('generate-next-chapter reads stories (and the task arc) with no deleted_at predicate', async () => {
    const router = require('../../../src/routes/memories/engine');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await handler(router, '/generate-next-chapter')(
      { body: { characterKey: 'just-a-woman' } }, fakeRes()
    );
    errSpy.mockRestore();
    warnSpy.mockRestore();

    const stories = captured.filter((sql) => /FROM "storyteller_stories"/.test(sql));
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatch(/"status" = 'approved'/);
    expect(stories[0]).not.toMatch(/deleted_at/);

    const arcs = captured.filter((sql) => /FROM "story_task_arcs"/.test(sql));
    expect(arcs).toHaveLength(1);
    expect(arcs[0]).not.toMatch(/deleted_at/);
  });
});
