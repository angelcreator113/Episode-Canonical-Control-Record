/**
 * A document presentation is not attached like other assets (Evoni,
 * 2026-11-19): every generic operation that stores an asset on something
 * else refuses one with the same 409, before it writes anything, and goes
 * on taking an ordinary asset as it did.
 *
 * Each of the 21 operations, and the scene's own assets object, is called
 * here as its real handler over stand-in models that record every write.
 * The rule's own query runs against real Postgres in
 * tests/integration/documentPresentationAttachmentGuards.integration.test.js.
 */
jest.unmock('uuid');

const PRESENTATION = '11111111-1111-4111-8111-111111111111';
const ORDINARY = '22222222-2222-4222-8222-222222222222';
const ORDINARY_2 = '33333333-3333-4333-8333-333333333333';
const OWNER = '44444444-4444-4444-8444-444444444444';

jest.mock('../../../src/models', () => {
  const ASSET_TYPES = {
    '11111111-1111-4111-8111-111111111111': 'DOCUMENT_PRESENTATION',
    '22222222-2222-4222-8222-222222222222': 'PROMO_LALA',
    '33333333-3333-4333-8333-333333333333': 'EPISODE_FRAME',
  };
  const state = { writes: [], findOne: {}, failLookup: false };
  // As PostgreSQL reads a uuid: braces and hyphens aside, any case.
  const asDatabase = (id) => {
    const hex = String(id).toLowerCase().replace(/^\{(.*)\}$/, '$1').replace(/-/g, '');
    return /^[0-9a-f]{32}$/.test(hex) ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
  };
  const wrote = (what) => { state.writes.push(what); };
  const row = (model, fields = {}) => {
    const self = {
      id: '55555555-5555-4555-8555-555555555555', is_locked: false, assets: {}, canvas_settings: {}, metadata: {},
      current_version: 1, ...fields,
    };
    for (const m of ['update', 'save', 'destroy', 'increment', 'addAssets', 'updateAssets', 'setAssets']) {
      self[m] = jest.fn(async () => { wrote(`${model}#${m}`); return self; });
    }
    self.reload = jest.fn(async () => self);
    self.toJSON = () => ({ ...fields, id: self.id });
    self.get = (key) => (key ? self[key] : self.toJSON());
    return self;
  };
  const assetRow = (given) => {
    const id = asDatabase(given);
    return ASSET_TYPES[id] ? rowOf(id) : null;
  };
  const rowOf = (id) => (ASSET_TYPES[id] ? row('Asset', { id, asset_type: ASSET_TYPES[id], asset_role: 'UI.OVERLAY.WARDROBE_LIST', s3_url_processed: 'https://x/a.png' }) : null);
  const model = (name) => ({
    findByPk: jest.fn(async (id) => (name === 'Asset' ? assetRow(id) : row(name, { id }))),
    findAll: jest.fn(async (opts = {}) => (name === 'Asset' ? [].concat(opts.where?.id || []).map(assetRow).filter(Boolean) : [])),
    findOne: jest.fn(async () => (state.findOne[name] ? row(name, state.findOne[name]) : null)),
    count: jest.fn(async () => 0),
    max: jest.fn(async () => 0),
    create: jest.fn(async (fields) => { wrote(`${name}.create`); return row(name, fields); }),
    bulkCreate: jest.fn(async (rows) => { wrote(`${name}.bulkCreate`); return rows.map((r) => row(name, r)); }),
    findOrCreate: jest.fn(async ({ where, defaults }) => { wrote(`${name}.findOrCreate`); return [row(name, { ...where, ...defaults }), true]; }),
    update: jest.fn(async () => { wrote(`${name}.update`); return [1]; }),
    destroy: jest.fn(async () => { wrote(`${name}.destroy`); return 1; }),
    increment: jest.fn(async () => { wrote(`${name}.increment`); }),
    upsert: jest.fn(async () => { wrote(`${name}.upsert`); return [row(name), true]; }),
  });
  const cache = {};
  const transaction = () => ({ commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}), finished: null });
  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    literal: (s) => s,
    transaction: jest.fn(async (work) => (typeof work === 'function' ? work(transaction()) : transaction())),
    query: jest.fn(async (sql, opts = {}) => {
      const text = String(sql).trim();
      // The rule's own read: which of these ids are document presentations.
      if (/FROM assets WHERE id IN \(:ids\) AND asset_type = :type/.test(text)) {
        if (state.failLookup) throw new Error('connection terminated unexpectedly');
        const hit = (opts.replacements.ids || []).some((id) => ASSET_TYPES[id] === opts.replacements.type);
        return [hit ? [{ '?column?': 1 }] : [], hit ? 1 : 0];
      }
      if (/^(SELECT|SAVEPOINT|RELEASE|ROLLBACK TO)/i.test(text)) {
        const one = { id: '66666666-6666-4666-8666-666666666666', asset_role: 'UI.OVERLAY.WARDROBE_LIST', metadata: {}, canon_consequences: {}, used_in_episode_id: null, s3_url_processed: 'https://x/a.png', name: 'Template', version: 1, required_roles: [] };
        return opts.type === 'SELECT' ? [one] : [[one], 1];
      }
      wrote(`sql:${text.slice(0, 40)}`);
      return [[{ id: '77777777-7777-4777-8777-777777777777' }], 1];
    }),
  };
  const special = { sequelize, Sequelize: { Op: {} }, __state: state };
  const proxy = new Proxy({}, {
    get: (_t, name) => {
      if (name === 'models') return proxy;
      if (name in special) return special[name];
      if (typeof name !== 'string' || name === 'then') return undefined;
      cache[name] = cache[name] || model(name);
      return cache[name];
    },
  });
  return proxy;
});

jest.mock('../../../src/db', () => {
  const models = require('../../../src/models');
  return { pool: { query: jest.fn(async (sql) => {
    if (!/^\s*SELECT/i.test(String(sql))) models.__state.writes.push('pool:write');
    return { rows: [{ id: 1 }], rowCount: 1 };
  }) } };
});
jest.mock('../../../src/middleware/auth', () => {
  const through = (req, _res, next) => { req.user = { id: 'user-1', groups: ['USER'] }; next(); };
  return { requireAuth: through, optionalAuth: through, authenticateToken: through, authorize: () => through, authorizeRole: () => through };
});
jest.mock('../../../src/middleware/jwtAuth', () => {
  const through = (req, _res, next) => { req.user = { id: 'user-1', groups: ['USER'] }; next(); };
  return { authenticateJWT: through, requireGroup: () => through, optionalJWT: through };
});
jest.mock('../../../src/services/episodeTaskCopyService', () => ({
  startedEpisodeFor: jest.fn(async () => null), readEpisodeSocialTasks: jest.fn(), writeEpisodeSocialTasks: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const models = require('../../../src/models');
const { REFUSAL_CODE, REFUSAL_MESSAGE } = require('../../../src/utils/documentPresentationAssets');

const state = models.__state;

/** A controller's handler, called as a route would call it. */
const call = (handler) => async ({ params = {}, body = {} }) => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.send = res.json;
  await handler({ params, body, query: {}, user: { id: 'user-1' }, headers: {}, get: () => null, app: { get: () => models } }, res, (err) => { if (err) throw err; });
  return { status: res.statusCode, body: res.body };
};

/** A handler written inside a router, reached through the router. */
const through = (router, method, path) => async ({ body = {} }) => {
  const app = express();
  app.use(express.json());
  app.set('models', models);
  app.use(router);
  const res = await request(app)[method](path).send(body);
  return { status: res.status, body: res.body };
};

const sceneStudio = require('../../../src/controllers/sceneStudioController');
const scenes = require('../../../src/controllers/sceneController');
const episodes = require('../../../src/controllers/episodeController');
const episodeAssets = require('../../../src/controllers/episodeAssetsController');
const placements = require('../../../src/controllers/timelinePlacementsController');
const iconCues = require('../../../src/controllers/iconCueController');

/**
 * The 21 operations, and the scene's assets object. `send(ids)` is the
 * request carrying those asset ids; `many` marks one that takes several.
 */
const OPERATIONS = [
  ['1. PUT /scenes/:id/canvas', call(sceneStudio.saveCanvas),
    (ids) => ({ params: { id: OWNER }, body: { objects: ids.map((asset_id, i) => ({ id: `client-${i}`, asset_id, object_type: 'image' })), canvas_settings: { zoom: 1 }, background_url: 'https://x/bg.png' } }), { many: true }],
  ['2. PUT /scene-sets/:id/canvas', call(sceneStudio.saveSceneSetCanvas),
    (ids) => ({ params: { id: OWNER }, body: { objects: ids.map((asset_id, i) => ({ id: `client-${i}`, asset_id, object_type: 'image' })), canvas_settings: { zoom: 1 } } }), { many: true }],
  ['3. POST /scenes/:id/objects', call(sceneStudio.addObject), ([asset_id]) => ({ params: { id: OWNER }, body: { asset_id } })],
  ['4. POST /scene-sets/:id/objects', call(sceneStudio.addSceneSetObject), ([asset_id]) => ({ params: { id: OWNER }, body: { asset_id } })],
  ['5. POST /scenes/:id/objects/:objectId/variants', call(sceneStudio.createVariant),
    ([new_asset_id]) => ({ params: { id: OWNER, objectId: OWNER }, body: { new_asset_id, variant_label: 'B' } }), { findOne: { SceneAsset: { asset_id: ORDINARY_2, scene_id: OWNER } } }],
  ['6. POST /scenes/:id/assets', call(scenes.addSceneAsset), (ids) => ({ params: { id: OWNER }, body: { assetIds: ids } }), { many: true }],
  ['7. POST /episodes/scenes/:scene_id/assets', call(scenes.addAssetToScene), ([asset_id]) => ({ params: { scene_id: OWNER }, body: { asset_id, role: 'background' } })],
  ['8. POST /episodes/:id/assets', call(episodes.addEpisodeAsset.bind(episodes)), (ids) => ({ params: { id: OWNER }, body: { assetIds: ids } }), { many: true }],
  ['9. POST /episodes/:id/library-assets', call(episodeAssets.addAssetToEpisode), ([assetId]) => ({ params: { id: OWNER }, body: { assetId } })],
  ['10. POST /footage/episodes/:episodeId/assets', through(require('../../../src/routes/footage'), 'post', `/episodes/${OWNER}/assets`), (ids) => ({ body: { assetIds: ids } }), { many: true }],
  ['11. POST /layers/:id/assets', through(require('../../../src/routes/layers'), 'post', `/${OWNER}/assets`), ([asset_id]) => ({ body: { asset_id } })],
  ['12. POST /episodes/:id/timeline/placements', call(placements.createPlacement),
    ([assetId]) => ({ params: { id: OWNER }, body: { placementType: 'asset', assetId, sceneId: OWNER } })],
  ['13. POST /episodes/:id/wardrobe-defaults', through(require('../../../src/routes/episodes'), 'post', `/${OWNER}/wardrobe-defaults`), ([outfit_asset_id]) => ({ body: { character_name: 'Lala', outfit_asset_id } })],
  ['14. POST /compositions', through(require('../../../src/routes/compositions'), 'post', '/'),
    (ids) => ({ body: { episode_id: OWNER, template_studio_id: OWNER, selected_formats: ['youtube'], asset_map: Object.fromEntries([['TEXT.TITLE', 'Words, not an id'], ...ids.map((id, i) => [`CHAR.ROLE_${i}`, id])]) } }), { many: true }],
  ['15. POST /compositions/:id/assets', through(require('../../../src/routes/compositions'), 'post', `/${OWNER}/assets`), ([asset_id]) => ({ body: { asset_id, role: 'CHAR.HOST.LALA' } })],
  ['16. PATCH /compositions/:id', through(require('../../../src/routes/compositions'), 'patch', `/${OWNER}`), ([guest_asset_id]) => ({ body: { guest_asset_id } })],
  ['17. PUT /compositions/:id', through(require('../../../src/routes/compositions'), 'put', `/${OWNER}`), ([lala_asset_id]) => ({ body: { composition_config: { lala_asset_id } } })],
  ['18. POST /episodes/:episodeId/icon-cues', call(iconCues.createIconCue), ([asset_id]) => ({ params: { episodeId: OWNER }, body: { asset_id, timestamp: '00:00:01', slot_id: 'slot-1', action: 'show' } })],
  ['19. PUT /episodes/:episodeId/icon-cues/:cueId', call(iconCues.updateIconCue), ([asset_id]) => ({ params: { episodeId: OWNER, cueId: OWNER }, body: { asset_id } })],
  ['20. PUT /episode-brief/:episodeId/performance-clips', through(require('../../../src/routes/episodeBriefRoutes'), 'put', `/${OWNER}/performance-clips`),
    ([asset_id]) => ({ body: { canonical_beat_number: 3, performer: 'lala', asset_id } })],
  ['21. POST /world/:showId/events/:eventId/approve-overlay', through(require('../../../src/routes/worldEvents/overlays'), 'post', `/world/${OWNER}/events/${OWNER}/approve-overlay`), ([assetId]) => ({ body: { assetId } })],
  ['The scene assets object: PUT /scenes/:id/assets', call(scenes.updateSceneAssets),
    (ids) => ({ params: { id: OWNER }, body: { assets: { lala_outfit_id: ids[0], background_id: ORDINARY_2, ui_elements: ids.slice(1) } } }), { many: true }],
];

const ROW_BASED = ['3.', '6.', '7.', '8.', '9.', '10.', '11.'];
// The same id as PostgreSQL also reads it (Evoni, 2026-11-19: an id written
// another way must not pass the rule).
const SPELLINGS = {
  'upper case': (id) => id.toUpperCase(),
  'no hyphens': (id) => id.replace(/-/g, ''),
  'in braces': (id) => `{${id}}`,
  'groups of four': (id) => id.replace(/-/g, '').match(/.{4}/g).join('-'),
  'upper case, no hyphens, in braces': (id) => `{${id.replace(/-/g, '').toUpperCase()}}`,
};

describe('a document presentation is refused by every generic operation that attaches an asset', () => {
  beforeEach(() => {
    state.writes.length = 0;
    state.findOne = {};
    state.failLookup = false;
  });

  test('all 21 operations and the scene assets object are here', () => {
    expect(OPERATIONS).toHaveLength(22);
  });

  describe.each(OPERATIONS)('%s', (_name, run, send, { many = false, findOne = {} } = {}) => {
    beforeEach(() => { state.findOne = findOne; });

    test('a document presentation: 409, the one explanation, and nothing written', async () => {
      const res = await run(send([PRESENTATION]));
      expect(res).toEqual({ status: 409, body: { success: false, error: REFUSAL_MESSAGE, code: REFUSAL_CODE } });
      expect(state.writes).toEqual([]);
    });

    test('an ordinary asset is taken as before', async () => {
      const res = await run(send([ORDINARY]));
      expect(res.status).not.toBe(409);
      expect(res.body?.code).not.toBe(REFUSAL_CODE);
      expect(res.status).toBeLessThan(400);
      expect(state.writes.length).toBeGreaterThan(0);
    });

    test.each(Object.entries(SPELLINGS))('its id written another way (%s) is refused the same, with nothing written', async (_how, spell) => {
      const res = await run(send([spell(PRESENTATION)]));
      expect(res).toEqual({ status: 409, body: { success: false, error: REFUSAL_MESSAGE, code: REFUSAL_CODE } });
      expect(state.writes).toEqual([]);
    });

    test('an ordinary asset whose id is written another way is not refused by the rule', async () => {
      for (const spell of Object.values(SPELLINGS)) {
        const res = await run(send([spell(ORDINARY)]));
        expect(res.status).not.toBe(409);
        expect(res.body?.code).not.toBe(REFUSAL_CODE);
      }
    });

    if (!ROW_BASED.some((n) => _name.startsWith(n))) {
      test('when the rule cannot ask the database, the request fails and nothing is attached', async () => {
        state.failLookup = true;
        const res = await run(send([ORDINARY]));
        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(state.writes).toEqual([]);
      });
    }

    if (many) {
      test('a presentation written another way among ordinary assets refuses the whole request', async () => {
        for (const spell of Object.values(SPELLINGS)) {
          state.writes.length = 0;
          const res = await run(send([ORDINARY, spell(PRESENTATION), ORDINARY_2]));
          expect(res.status).toBe(409);
          expect(res.body.code).toBe(REFUSAL_CODE);
          expect(state.writes).toEqual([]);
        }
      });

      test('one document presentation among ordinary assets refuses the whole request, with nothing written', async () => {
        const res = await run(send([ORDINARY, PRESENTATION, ORDINARY_2]));
        expect(res.status).toBe(409);
        expect(res.body.code).toBe(REFUSAL_CODE);
        expect(state.writes).toEqual([]);
      });
    }
  });
});

describe('what the rule reads as an asset id', () => {
  const { normalizeAssetId, assetIdsIn, assetIdsWithin, isDocumentPresentation, anyDocumentPresentation, DOCUMENT_PRESENTATION } = require('../../../src/utils/documentPresentationAssets');

  test('every spelling PostgreSQL reads as a uuid is the one id', () => {
    for (const spell of Object.values(SPELLINGS)) expect(normalizeAssetId(spell(PRESENTATION))).toBe(PRESENTATION);
    expect(normalizeAssetId(PRESENTATION)).toBe(PRESENTATION);
    expect(assetIdsIn(Object.values(SPELLINGS).map((spell) => spell(PRESENTATION)))).toEqual([PRESENTATION]);
  });

  test('what cannot be a uuid is not an id: too short or long, not hex, an unclosed brace, not a string', () => {
    const hex = PRESENTATION.replace(/-/g, '');
    for (const bad of [hex.slice(1), `${hex}0`, hex.replace('1', 'g'), `{${PRESENTATION}`, `${PRESENTATION}}`, `urn:uuid:${PRESENTATION}`, '', '{}', '-', null, undefined, 7, true, [PRESENTATION], { id: PRESENTATION }]) {
      expect(normalizeAssetId(bad)).toBeNull();
    }
  });

  test('a read that fails is thrown, not answered as "none"', async () => {
    models.__state.failLookup = true;
    await expect(anyDocumentPresentation([ORDINARY])).rejects.toThrow('connection terminated');
    models.__state.failLookup = false;
  });

  test('strings shaped like a UUID, once each, whatever their case or the space around them; nothing else', () => {
    expect(assetIdsIn([PRESENTATION, ` ${PRESENTATION.toUpperCase()} `, 'Words, not an id', '', null, undefined, 7, { id: ORDINARY }])).toEqual([PRESENTATION]);
    expect(assetIdsIn(ORDINARY)).toEqual([ORDINARY]);
    expect(assetIdsIn(undefined)).toEqual([]);
  });

  test('ids anywhere inside an object of them', () => {
    expect(assetIdsWithin({ lala_outfit_id: ORDINARY, ui_elements: [PRESENTATION, { asset: ORDINARY_2 }], note: 'no id', n: 3, none: null }).sort())
      .toEqual([PRESENTATION, ORDINARY, ORDINARY_2].sort());
  });

  test('a row is one by its asset_type, as a model instance or a plain row', () => {
    expect(isDocumentPresentation({ asset_type: DOCUMENT_PRESENTATION })).toBe(true);
    expect(isDocumentPresentation({ get: (k) => (k === 'asset_type' ? DOCUMENT_PRESENTATION : null) })).toBe(true);
    expect(isDocumentPresentation({ asset_type: 'DOCUMENT_OVERLAY' })).toBe(false);
    expect(isDocumentPresentation(null)).toBe(false);
  });

  test('with no id to ask about, the database is not asked', async () => {
    models.sequelize.query.mockClear();
    expect(await anyDocumentPresentation(['Words', null])).toBe(false);
    expect(models.sequelize.query).not.toHaveBeenCalled();
    expect(await anyDocumentPresentation([ORDINARY, ` ${PRESENTATION} `])).toBe(true);
  });
});
