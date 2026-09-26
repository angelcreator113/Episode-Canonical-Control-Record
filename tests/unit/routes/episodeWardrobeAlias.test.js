/**
 * Task #1926 — the approval handlers and the suggestions path include
 * EpisodeWardrobe → Wardrobe by the alias src/models/index.js registers,
 * 'wardrobeItem'. On origin/main five includes in
 * src/controllers/wardrobeApprovalController.js (approveWardrobeItem x2,
 * rejectWardrobeItem x2, getApprovalStatus x1) and one in
 * src/controllers/wardrobeLibraryController.js getSuggestions asked for
 * 'wardrobe', which is not associated, and each request answered 500
 * ("wardrobe is not associated to EpisodeWardrobe!").
 *
 * The pattern is #1883 / PR #1895's bulkApprove test, taken one step
 * further: the models are the real src/models/index.js (loaded, never
 * connected), so every include — nested ones too — is validated by
 * Sequelize itself, and the SQL is really generated. Only
 * sequelize.query is stubbed: it records the SQL and hands back rows built
 * by the real models. No database.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
  optionalAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
  authorize: () => (_req, _res, next) => next(),
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({
  aiRateLimiter: (_req, _res, next) => next(),
}));

const EP = '11111111-1111-4111-8111-111111111111';
const WR = '22222222-2222-4222-8222-222222222222';
const SHOW = '33333333-3333-4333-8333-333333333333';
const LIB = 7;

let models;
let sequelize;
let app;
let sql;
let linkState;

function linkRow() {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    episode_id: EP,
    wardrobe_id: WR,
    scene: null,
    worn_at: new Date('2026-09-25T00:00:00Z'),
    notes: null,
    is_episode_favorite: false,
    approval_status: linkState.approval_status,
    approved_by: linkState.approved_by,
    approved_at: linkState.approved_at,
    rejection_reason: linkState.rejection_reason,
    created_at: new Date('2026-09-25T00:00:00Z'),
    updated_at: new Date('2026-09-25T00:00:00Z'),
    deleted_at: null,
    wardrobeItem: {
      id: WR,
      name: 'Gold coat',
      library_item_id: linkState.libraryItemId,
      libraryItem: linkState.libraryItemId ? { id: LIB, name: 'Gold coat (library)' } : null,
    },
    episode: { id: EP, show_id: SHOW, title: 'Pilot' },
  };
}

// Rows the stubbed query layer returns, by model, in the nested form the
// pg dialect produces after grouping joined columns.
function rowsFor(model) {
  if (model === models.EpisodeWardrobe) return [linkRow()];
  if (model === models.Episode) {
    return [{ id: EP, show_id: SHOW, title: 'Pilot', show: { id: SHOW, name: 'SAL' } }];
  }
  return [];
}

function stubQuery() {
  return jest.spyOn(sequelize, 'query').mockImplementation(async (text, options = {}) => {
    sql.push(typeof text === 'string' ? text : String(text && text.query));
    if (options.type === 'SELECT' && options.model) {
      const built = options.model.bulkBuild(rowsFor(options.model), {
        isNewRecord: false,
        include: options.include,
        includeNames: options.includeNames,
        includeMap: options.includeMap,
        includeValidated: true,
        raw: true,
      });
      return options.plain ? built[0] || null : built;
    }
    if (options.type === 'UPDATE' || options.type === 'INSERT') {
      if (options.instance && options.instance.constructor === models.EpisodeWardrobe) {
        for (const k of ['approval_status', 'approved_by', 'approved_at', 'rejection_reason']) {
          linkState[k] = options.instance.get(k);
        }
      }
      return [options.instance, 1];
    }
    return [];
  });
}

beforeAll(() => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  ({ models, sequelize } = require('../../../src/models'));
  app = express();
  app.use(express.json());
  app.use('/api/v1/episodes', require('../../../src/routes/wardrobeApproval'));
  app.use('/api/v1/wardrobe-library', require('../../../src/routes/wardrobeLibrary'));
  log.mockRestore();
  warn.mockRestore();
});

beforeEach(() => {
  sql = [];
  // A native wardrobe item (no library link) by default: the handlers then
  // skip WardrobeUsageHistory, and nothing but sequelize.query is stubbed.
  linkState = {
    approval_status: 'pending', approved_by: null, approved_at: null,
    rejection_reason: null, libraryItemId: null,
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  stubQuery();
});
afterEach(() => jest.restoreAllMocks());

describe('EpisodeWardrobe → Wardrobe has one registered alias', () => {
  test('the loaded models register wardrobeItem and nothing named wardrobe', () => {
    const aliases = Object.keys(models.EpisodeWardrobe.associations).sort();
    expect(aliases).toEqual(['episode', 'sceneDetails', 'wardrobeItem']);
    expect(models.EpisodeWardrobe.associations.wardrobeItem.target).toBe(models.Wardrobe);
    expect(models.EpisodeWardrobe.associations.wardrobeItem.foreignKey).toBe('wardrobe_id');
  });

  test('the model file carries no second declaration of the association', () => {
    // index.js is the one home; EpisodeWardrobe.associate was never called.
    expect(models.EpisodeWardrobe.associate).toBeUndefined();
  });
});

describe('PUT /api/v1/episodes/:episodeId/wardrobe/:wardrobeId/approve (approveWardrobeItem)', () => {
  test('approves with the registered include and keeps data.wardrobe', async () => {
    const res = await request(app)
      .put(`/api/v1/episodes/${EP}/wardrobe/${WR}/approve`)
      .send({ notes: 'looks right' });

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Wardrobe item approved successfully');
    expect(res.body.data.approval_status).toBe('approved');
    // Response shape: the item under data.wardrobe, as the handler has always written it.
    expect(res.body.data.wardrobe).toEqual(expect.objectContaining({ id: WR, name: 'Gold coat' }));
    expect(res.body.data.wardrobe).toHaveProperty('libraryItem', null);
    expect(res.body.data.wardrobeItem).toBeUndefined();

    // The SQL really joins through the registered alias, nested include too.
    expect(sql.some((s) => s.includes('LEFT OUTER JOIN "wardrobe" AS "wardrobeItem"'))).toBe(true);
    expect(sql.some((s) => s.includes('AS "wardrobeItem->libraryItem"'))).toBe(true);
    expect(sql.some((s) => s.startsWith('UPDATE "episode_wardrobe"'))).toBe(true);
  });

  test('an already-approved link answers 200 with data.wardrobe', async () => {
    linkState.approval_status = 'approved';
    const res = await request(app).put(`/api/v1/episodes/${EP}/wardrobe/${WR}/approve`).send({});

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Item already approved');
    expect(res.body.data.wardrobe).toEqual(expect.objectContaining({ id: WR }));
    expect(res.body.data.wardrobeItem).toBeUndefined();
  });

  // WardrobeUsageHistory.create is stubbed from here on: the model's own
  // create fails validation ("WardrobeUsageHistory.createdAt cannot be
  // null") independent of #1926, reported separately.
  test('a library-linked item\'s usage-history row gets the episode\'s show_id', async () => {
    linkState.libraryItemId = LIB;
    const create = jest.spyOn(models.WardrobeUsageHistory, 'create').mockResolvedValue({});
    const res = await request(app).put(`/api/v1/episodes/${EP}/wardrobe/${WR}/approve`).send({});

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      libraryItemId: LIB, episodeId: EP, showId: SHOW, usageType: 'approved',
    }));
  });
});

describe('PUT /api/v1/episodes/:episodeId/wardrobe/:wardrobeId/reject (rejectWardrobeItem)', () => {
  test('rejects with the registered include and keeps data.wardrobe', async () => {
    linkState.libraryItemId = LIB;
    const create = jest.spyOn(models.WardrobeUsageHistory, 'create').mockResolvedValue({});
    const res = await request(app)
      .put(`/api/v1/episodes/${EP}/wardrobe/${WR}/reject`)
      .send({ reason: 'wrong era' });

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Wardrobe item rejected');
    expect(res.body.data.approval_status).toBe('rejected');
    expect(res.body.data.rejection_reason).toBe('wrong era');
    expect(res.body.data.wardrobe).toEqual(expect.objectContaining({ id: WR, name: 'Gold coat' }));
    expect(res.body.data.wardrobeItem).toBeUndefined();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      libraryItemId: LIB, showId: SHOW, usageType: 'rejected', notes: 'wrong era',
    }));
  });
});

describe('GET /api/v1/episodes/:episodeId/wardrobe/approval-status (getApprovalStatus)', () => {
  test('groups the links and keeps each entry\'s wardrobe key', async () => {
    linkState.libraryItemId = LIB;
    const res = await request(app).get(`/api/v1/episodes/${EP}/wardrobe/approval-status`);

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 1, pending: 1, approved: 0, rejected: 0 });
    expect(res.body.data.pending[0].wardrobeId).toBe(WR);
    expect(res.body.data.pending[0].wardrobe).toEqual(expect.objectContaining({ id: WR, name: 'Gold coat' }));
    expect(res.body.data.pending[0].wardrobe.libraryItem).toEqual(expect.objectContaining({ id: LIB }));
  });
});

describe('GET /api/v1/wardrobe-library/suggestions (getSuggestions)', () => {
  test('excludes the episode\'s assigned library items and answers 200', async () => {
    linkState.libraryItemId = LIB;
    const res = await request(app).get(`/api/v1/wardrobe-library/suggestions?episodeId=${EP}`);

    expect(res.body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
    const libraryQuery = sql.find((s) => s.includes('FROM "wardrobe_library"'));
    expect(libraryQuery).toBeDefined();
    expect(libraryQuery).toContain(`NOT IN (${LIB})`);
    expect(libraryQuery).toContain(`'${SHOW}'`);
  });
});
