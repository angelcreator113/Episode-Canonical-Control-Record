/**
 * POST /wardrobe-events/:episodeId/lock-outfit (Task #1924).
 *
 * On main it hard-deleted the episode's links and then failed to re-create
 * them (EpisodeWardrobe.create named columns the table lacked): the outfit
 * was wiped and the route answered 500. Now the remove is a soft delete and
 * the remove plus re-link run in one transaction, so a failure part-way
 * leaves the old outfit as it was.
 *
 * The EpisodeWardrobe fake is the table-checked one (canon plus live
 * migrations, tests/unit/helpers/episodeWardrobeTable.js); the transaction
 * fake snapshots its rows and restores them if the callback throws, as a
 * rollback would. No database.
 */
const { postMigrationColumns, tableCheckedEpisodeWardrobe } = require('../helpers/episodeWardrobeTable');

const mockModels = {};
jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

const router = require('../../../src/routes/wardrobeEventRoutes');

function lockHandler() {
  const layer = router.stack.find((l) => l.route && l.route.path === '/:episodeId/lock-outfit' && l.route.methods.post);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

async function setup({ failOn = null } = {}) {
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  const EpisodeWardrobe = tableCheckedEpisodeWardrobe(await postMigrationColumns());
  const tx = { id: 'tx' };
  const transaction = jest.fn(async (cb) => {
    const snapshot = EpisodeWardrobe.rows.map((r) => ({ r, state: { ...r } }));
    const length = EpisodeWardrobe.rows.length;
    try {
      return await cb(tx);
    } catch (e) {
      EpisodeWardrobe.rows.length = length;
      for (const { r, state } of snapshot) Object.assign(r, state);
      throw e;
    }
  });
  Object.assign(mockModels, {
    EpisodeWardrobe,
    sequelize: { transaction },
    Wardrobe: {
      findByPk: jest.fn(async (id) => {
        if (id === failOn) throw new Error('boom');
        return { id, toJSON: () => ({ id }) };
      }),
    },
  });
  return { EpisodeWardrobe, transaction, tx };
}

async function run(body) {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await lockHandler()({ params: { episodeId: 'ep-1' }, body }, res);
  return res;
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('locks the new outfit as approved, soft-deleting the old one, in one transaction', async () => {
  const { EpisodeWardrobe, transaction, tx } = await setup();
  const old = EpisodeWardrobe.seed({ episode_id: 'ep-1', wardrobe_id: 'w-old', approval_status: 'approved' });
  const kept = EpisodeWardrobe.seed({ episode_id: 'ep-1', wardrobe_id: 'w-dress', approval_status: 'pending' });

  const res = await run({ wardrobe_ids: ['w-dress', 'w-heels'] });

  expect(res.statusCode).toBe(200);
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(EpisodeWardrobe.destroy.mock.calls[0][0].transaction).toBe(tx);
  // Removed, not lost: the old piece keeps its row with deleted_at set.
  expect(old.deleted_at).toBeInstanceOf(Date);
  // A piece locked again is restored, not re-created into the unique pair.
  expect(kept.deleted_at).toBeNull();
  expect(kept.approval_status).toBe('approved');
  expect(EpisodeWardrobe.rows).toHaveLength(3);
  expect(EpisodeWardrobe.rows.filter((r) => r.deleted_at == null).map((r) => [r.wardrobe_id, r.approval_status]))
    .toEqual([['w-dress', 'approved'], ['w-heels', 'approved']]);
});

test('a failure part-way leaves the old outfit as it was, and answers 500', async () => {
  const { EpisodeWardrobe } = await setup({ failOn: 'w-heels' });
  const old = EpisodeWardrobe.seed({ episode_id: 'ep-1', wardrobe_id: 'w-old', approval_status: 'approved' });

  const res = await run({ wardrobe_ids: ['w-dress', 'w-heels'] });

  expect(res.statusCode).toBe(500);
  expect(old.deleted_at).toBeNull();
  expect(EpisodeWardrobe.rows.map((r) => r.wardrobe_id)).toEqual(['w-old']);
});
