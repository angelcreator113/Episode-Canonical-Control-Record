/**
 * POST /wardrobe/browse-pool: the episode -> event lookup.
 *
 * Task #1838 kept this lookup including soft-deleted events, as the raw
 * world_events SELECT it replaced (d5746ca7b, F-Stats-1 PR 4e) did.
 * Task #1917 (§8(w) P2) supersedes that: the lookup reads the episode's one
 * event (utils/episodeEventSql: the brief's live event, else the first live
 * stamped one), the same event the episode's tabs show, so a deleted event
 * is no longer this episode's event here either.
 *
 * No database: the real WorldEvent model is loaded with the app's define on
 * a Sequelize instance whose query() is stubbed to record the generated SQL,
 * and the real browse-pool handler is invoked with that model.
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
    const text = typeof sql === 'string' ? sql : sql.query;
    captured.push(text);
    // The episode's event id (utils/episodeEventSql episodeEventId).
    if (/^SELECT \(SELECT COALESCE/.test(text)) return [[{ id: 'ev-1' }]];
    return [];
  };
  const WorldEvent = require(path.join(SRC, 'models', 'WorldEvent.js'))(sequelize);
  // Stop the handler right after the lookup; only the lookup's SQL matters.
  const Wardrobe = { findAll: async () => { throw new Error('stop after lookup'); } };
  return { WorldEvent, Wardrobe, Sequelize, sequelize };
}

const mockModels = buildModels();
jest.mock('../../../src/models', () => mockModels);
// The controller is not under test; stand it in so it loads nothing.
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, {
  get: () => (req, res) => res.json({}),
}));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

const router = require('../../../src/routes/wardrobe');

function browsePoolHandler() {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === '/browse-pool' && l.route.methods.post
  );
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

describe('POST /wardrobe/browse-pool event lookup', () => {
  beforeEach(() => { captured.length = 0; });

  it('the app define and WorldEvent are paranoid (the premise of this test)', () => {
    expect(appConfig.test.define.paranoid).toBe(true);
    expect(mockModels.WorldEvent.options.paranoid).toBe(true);
  });

  it('reads the episode\'s one event, then loads that event by id as a live row', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const req = { body: { show_id: 'show-1', episode_id: 'ep-1' } };
    const res = { status() { return this; }, json() { return this; } };

    await browsePoolHandler()(req, res);
    errSpy.mockRestore();

    const rule = captured.filter((sql) => /^SELECT \(SELECT COALESCE/.test(sql));
    expect(rule).toHaveLength(1);
    expect(rule[0]).toMatch(/eb_b\.episode_id = :episodeId/);
    expect(rule[0]).toMatch(/st_w\.deleted_at IS NULL/);
    const lookup = captured.filter((sql) => /FROM "world_events"/.test(sql));
    expect(lookup).toHaveLength(1);
    expect(lookup[0]).toMatch(/"id" = 'ev-1'/);
    expect(lookup[0]).not.toMatch(/used_in_episode_id/);
  });
});
