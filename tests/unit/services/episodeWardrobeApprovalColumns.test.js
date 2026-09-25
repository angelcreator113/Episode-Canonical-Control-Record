/**
 * Task #1924 — episode_wardrobe gets its approval columns, so an episode can
 * have a look of its own.
 *
 * Evoni's production read (ATTESTED 2026-09-25): episode_wardrobe has 11
 * columns and none of approval_status, approved_by, approved_at,
 * rejection_reason or deleted_at. The EpisodeWardrobe model declared the
 * first four, so every model query failed, and Start's copy of the event's
 * pieces (generateEpisodeFromEvent) failed every time.
 *
 * The table here is canon plus every live migration that names it
 * (tests/unit/helpers/episodeWardrobeTable.js), and the EpisodeWardrobe fake
 * names every declared field in every call, as Sequelize does. No database.
 */

jest.mock('../../../src/services/feedMomentsService', () => ({ generateFeedMoments: jest.fn(async () => ({})) }));
jest.mock('../../../src/services/characterSyncService', () => ({
  syncAfterEvent: jest.fn(async () => ({ updated: 0 })),
  generatePostEventOpportunities: jest.fn(async () => []),
}));
jest.mock('../../../src/services/feedActivityService', () => ({ generatePostEventActivity: jest.fn(async () => []) }));
jest.mock('../../../src/services/timelinePlacementService', () => ({ autoPlaceRequiredOverlays: jest.fn(async () => []) }));

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const {
  canonColumns, recordingQueryInterface, tableMigrations, postMigrationColumns, tableCheckedEpisodeWardrobe,
} = require('../helpers/episodeWardrobeTable');
const { loadModel } = require('../helpers/schemaCheckedModel');

const MIGRATION = '20260925000001-add-approval-columns-to-episode-wardrobe.js';
const MIGRATION_PATH = path.join(__dirname, '..', '..', '..', 'src', 'migrations', MIGRATION);
const NEW_COLUMNS = ['approval_status', 'approved_by', 'approved_at', 'rejection_reason', 'deleted_at'];

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the table and the model agree (Task #1924)', () => {
  test('canon is the attested 11 columns', () => {
    expect(canonColumns().sort()).toEqual([
      'created_at', 'episode_id', 'id', 'is_episode_favorite', 'notes', 'scene', 'scene_id',
      'times_worn', 'updated_at', 'wardrobe_id', 'worn_at',
    ]);
  });

  test('every column the model declares exists once the live migrations have run', async () => {
    const cols = await postMigrationColumns();
    const Model = loadModel('EpisodeWardrobe');
    const missing = Object.values(Model.rawAttributes).map((a) => a.field).filter((f) => !cols.has(f));
    // On main: approval_status, approved_by, approved_at, rejection_reason.
    expect(missing).toEqual([]);
  });

  test('the model is paranoid, timestamps mapped to the snake_case columns', () => {
    const Model = loadModel('EpisodeWardrobe');
    expect(Model.options.paranoid).toBe(true);
    expect(Model.options.timestamps).toBe(true);
    expect(Model._timestampAttributes).toEqual({ createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at' });
  });
});

describe(`the migration ${MIGRATION}`, () => {
  test('exists, is the only live migration adding the table\'s columns, and adds the five columns with the model\'s types', async () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    // Task #1933's migration also names the table; it changes only indexes.
    expect(tableMigrations()).toEqual([MIGRATION, '20260926000000-dedupe-episode-wardrobe-indexes.js']);

    const qi = recordingQueryInterface(canonColumns());
    await require(MIGRATION_PATH).up(qi, Sequelize);
    const added = qi.calls.filter((c) => c.op === 'addColumn');
    expect(added.map((c) => c.column)).toEqual(NEW_COLUMNS);

    const Model = loadModel('EpisodeWardrobe');
    for (const c of added) {
      const attr = Model.rawAttributes[c.column];
      const sql = (t) => { const i = typeof t === 'function' ? new t() : t; return `${i.key}(${i._length ?? ''})`; };
      expect(sql(c.def.type)).toBe(sql(attr.type));
      expect(c.def.allowNull).toBe(true);
      expect(c.def.defaultValue).toBe(attr.defaultValue);
    }
  });

  test('backfills the existing rows to approved (Evoni\'s ruling 2), inside the same transaction', async () => {
    const qi = recordingQueryInterface(canonColumns());
    await require(MIGRATION_PATH).up(qi, Sequelize);
    const updates = qi.calls.filter((c) => c.op === 'query');
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toMatch(/UPDATE episode_wardrobe SET approval_status = 'approved'/);
    expect(qi.sequelize.transaction).toHaveBeenCalledTimes(1);
    // The backfill comes after the column it writes.
    expect(qi.calls.findIndex((c) => c.op === 'query')).toBeGreaterThan(qi.calls.findIndex((c) => c.column === 'approval_status'));
  });

  test('is idempotent: a second run adds nothing and touches no row', async () => {
    const qi = recordingQueryInterface([...canonColumns(), ...NEW_COLUMNS]);
    await require(MIGRATION_PATH).up(qi, Sequelize);
    expect(qi.calls).toEqual([]);
  });

  test('skips cleanly on a fresh database with no episode_wardrobe (CI): logs, adds nothing, never creates it', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const qi = recordingQueryInterface([], { tableExists: false });
    await require(MIGRATION_PATH).up(qi, Sequelize);
    await require(MIGRATION_PATH).down(qi, Sequelize);
    expect(qi.calls).toEqual([]);
    expect(qi.describeTable).not.toHaveBeenCalled();
    expect(warn.mock.calls.some(([m]) => /does not exist here/.test(String(m)))).toBe(true);
    warn.mockRestore();
  });

  test('down removes the five columns and leaves canon as it was', async () => {
    const qi = recordingQueryInterface([...canonColumns(), ...NEW_COLUMNS]);
    await require(MIGRATION_PATH).down(qi, Sequelize);
    expect(qi.calls.map((c) => c.column).sort()).toEqual([...NEW_COLUMNS].sort());
    expect([...qi.cols].sort()).toEqual(canonColumns().sort());
  });

  test('never creates the table', () => {
    const code = fs.readFileSync(MIGRATION_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/createTable|CREATE TABLE|\.sync\(/);
  });
});

describe("Start's copy of the event's pieces (generateEpisodeFromEvent)", () => {
  function makeModels(EpisodeWardrobe) {
    const episode = { id: 'ep-new', update: jest.fn(async () => {}), toJSON: () => ({ id: 'ep-new' }) };
    return {
      sequelize: {
        QueryTypes: { SELECT: 'SELECT' },
        query: jest.fn(async (sql, opts = {}) => {
          if (/MAX\(episode_number\)/.test(sql)) return [[{ next_num: 4 }]];
          if (/^UPDATE world_events SET status = 'used'/.test(sql)) return [[{ id: opts.replacements.eventId }]];
          if (/INSERT INTO episode_todo_lists/.test(sql)) return [[{ id: 'todo-1' }]];
          return [[]];
        }),
        transaction: jest.fn(async (cb) => cb({ id: 'tx' })),
      },
      Episode: { create: jest.fn(async () => episode) },
      EpisodeBrief: { create: jest.fn(async (data) => ({ toJSON: () => data })) },
      EpisodeWardrobe,
    };
  }

  const EVENT = {
    id: 'ev-1', show_id: 'show-1', name: 'Maison Belle Gala', event_type: 'gala', prestige: 7, cost_coins: 0,
    outfit_pieces: [{ id: 'w-dress', name: 'Gold dress' }, { id: 'w-heels', name: 'Heels' }],
    canon_consequences: { automation: {} },
  };

  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey; });

  test('writes the pieces as the episode\'s approved look, and logs no failure', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const EpisodeWardrobe = tableCheckedEpisodeWardrobe(await postMigrationColumns());
    const { generateEpisodeFromEvent } = require('../../../src/services/episodeGeneratorService');

    await generateEpisodeFromEvent(EVENT, makeModels(EpisodeWardrobe), { showId: 'show-1' });

    // On main every call threw `column "approval_status" does not exist`
    // and no row was written.
    expect(EpisodeWardrobe.rows.map((r) => [r.episode_id, r.wardrobe_id, r.approval_status])).toEqual([
      ['ep-new', 'w-dress', 'approved'],
      ['ep-new', 'w-heels', 'approved'],
    ]);
    expect(EpisodeWardrobe.rows.every((r) => r.approved_at instanceof Date && r.deleted_at === null)).toBe(true);
    expect(error.mock.calls.filter(([m]) => /Outfit linking failed/.test(String(m)))).toEqual([]);
  });

  test('a piece whose earlier link was removed is restored, not re-created into the unique pair', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const EpisodeWardrobe = tableCheckedEpisodeWardrobe(await postMigrationColumns());
    const removed = EpisodeWardrobe.seed({
      episode_id: 'ep-new', wardrobe_id: 'w-dress', approval_status: 'rejected', rejection_reason: 'too loud', deleted_at: new Date(),
    });
    const { generateEpisodeFromEvent } = require('../../../src/services/episodeGeneratorService');

    await generateEpisodeFromEvent(EVENT, makeModels(EpisodeWardrobe), { showId: 'show-1' });

    expect(EpisodeWardrobe.rows).toHaveLength(2);
    expect(removed.deleted_at).toBeNull();
    expect(removed.approval_status).toBe('approved');
    expect(removed.rejection_reason).toBeNull();
    expect(EpisodeWardrobe.rows.find((r) => r.wardrobe_id === 'w-heels').approval_status).toBe('approved');
  });
});

describe('linkEpisodeWardrobe', () => {
  test('a live link is left as it is; a new pair takes the model default (pending)', async () => {
    const { linkEpisodeWardrobe } = require('../../../src/services/episodeWardrobeLinks');
    const EpisodeWardrobe = tableCheckedEpisodeWardrobe(await postMigrationColumns());
    const live = EpisodeWardrobe.seed({ episode_id: 'e', wardrobe_id: 'a', approval_status: 'approved' });

    expect(await linkEpisodeWardrobe(EpisodeWardrobe, { episode_id: 'e', wardrobe_id: 'a' }, { notes: 'x' })).toEqual([live, false]);
    expect(live.notes).toBeUndefined();

    const [created, how] = await linkEpisodeWardrobe(EpisodeWardrobe, { episode_id: 'e', wardrobe_id: 'b' });
    expect(how).toBe('created');
    expect(created.approval_status).toBe('pending');
  });
});
