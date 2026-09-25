/**
 * Task #1870, step 1 — each of the seven writes that dropped values for
 * columns production has, driven through its real call site.
 *
 * The model each site writes is a schema-checked fake
 * (tests/unit/helpers/schemaCheckedModel.js): it reads the declared
 * attributes from the real model file and throws when a create/update value
 * names one the model does not declare — exactly the keys Sequelize would
 * silently drop. Before the columns were declared, every test here failed on
 * that throw (or on the swallowed error it caused); with them declared the
 * value reaches the write. Mocked models, no database.
 */
const express = require('express');
const request = require('supertest');

const MODELS = '../../../src/models';
const AUTH = '../../../src/middleware/auth';

function passAuth() {
  jest.doMock(AUTH, () => {
    const actual = jest.requireActual(AUTH);
    return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
  });
}

function schemaChecked(name, impls) {
  return require('../helpers/schemaCheckedModel').schemaCheckedModel(name, impls);
}

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('WorldEvent.create — POST /world/:showId/events/from-profile (src/routes/worldEvents.js)', () => {
  test('theme, mood, color_palette, floral_style and border_style reach the create', async () => {
    const WorldEvent = schemaChecked('WorldEvent', {
      create: async (data) => ({ id: 'ev-new', ...data, toJSON: () => ({ id: 'ev-new', ...data }) }),
    });
    const query = jest.fn(async () => [[]]);
    jest.doMock(MODELS, () => ({
      sequelize: { query },
      SocialProfile: {
        findByPk: async () => ({
          toJSON: () => ({
            id: 42, handle: 'hosty', display_name: 'Hosty', content_category: 'fashion',
            archetype: 'soft_life', follower_tier: 'macro', brand_partnerships: [],
            aesthetic_dna: {}, city: null, frequent_venues: [],
          }),
        }),
        findAll: async () => [],
      },
      WorldEvent,
    }));
    jest.doMock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
    jest.doMock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_q, _s, next) => next() }));
    jest.doMock('../../../src/services/episodeGeneratorService', () => ({ buildSocialTasks: () => [] }));
    passAuth();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const app = express();
    app.use(express.json());
    app.use('/api/v1', require('../../../src/routes/worldEvents'));

    const res = await request(app).post('/api/v1/world/show-1/events/from-profile').send({ profile_id: 42 });
    expect(res.status).toBe(201);
    expect(WorldEvent.create).toHaveBeenCalledTimes(1);
    // The create succeeded, so the raw-SQL fallback (which has no theme) never ran.
    expect(query.mock.calls.filter(([sql]) => /INSERT INTO world_events/.test(sql))).toHaveLength(0);
    expect(WorldEvent.create.mock.calls[0][0]).toMatchObject({
      theme: 'dreamy luxury',
      mood: 'serene, aspirational, soft, fashion-forward',
      color_palette: ['lavender', 'champagne', 'cloud white'],
      floral_style: 'fashion show florals',
      border_style: 'watercolor wash',
    });
    expect(res.body.event.theme).toBe('dreamy luxury');
  });
});

describe('StorytellerBook.update — POST /arc-stage (src/routes/sceneProposeRoute.js)', () => {
  test('current_arc_stage and arc_stage_scores reach the update', async () => {
    const StorytellerBook = schemaChecked('StorytellerBook');
    jest.doMock(MODELS, () => ({
      // Eight stories, so the stage is 'pressure'. calculateArcStage's own
      // query (book_id / arc_stage, which storyteller_stories lacks) is one of
      // the 18 hidden failures and is not under test here; the rows carry
      // only declared keys so this mock does not vouch for it.
      StorytellerStory: { findAll: jest.fn(async () => Array.from({ length: 8 }, (_, i) => ({ id: `s${i}` }))) },
      StorytellerBook,
    }));
    jest.doMock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
    jest.doMock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_q, _s, next) => next() }));
    passAuth();

    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/sceneProposeRoute'));

    const res = await request(app).post('/arc-stage').send({ book_id: 'book-1' });
    expect(res.status).toBe(200);
    expect(StorytellerBook.update).toHaveBeenCalledWith(
      { current_arc_stage: 'pressure', arc_stage_scores: { establishment: 0, pressure: 0, crisis: 0, integration: 0 } },
      { where: { id: 'book-1' } },
    );
  });
});

describe('ThumbnailComposition.create — CompositionService.createComposition (src/services/CompositionService.js)', () => {
  test('include_justawomaninherprime, justawomaninherprime_position and approval_status reach the create', async () => {
    const ThumbnailComposition = schemaChecked('ThumbnailComposition', {
      create: async (data) => ({ id: 'comp-1', ...data, toJSON: () => ({ id: 'comp-1', ...data }) }),
    });
    jest.doMock(MODELS, () => ({
      models: {
        ThumbnailTemplate: { findByPk: async () => ({ id: 'tpl-1', layout_config: { lala: {} } }) },
        Asset: { findByPk: async (id) => ({ id }) },
        CompositionAsset: { bulkCreate: jest.fn() },
        ThumbnailComposition,
      },
    }));
    jest.doMock('../../../src/services/AssetService', () => ({}));
    jest.doMock('../../../src/services/S3Service', () => ({}));
    // canonicalRoles does not export the three helpers CompositionService
    // imports, so on every branch createComposition throws a TypeError before
    // it reaches the create (reported separately; loud, not in #1870's scope).
    // Supply them so the write itself is exercised.
    jest.doMock('../../../src/constants/canonicalRoles', () => ({
      shouldRequireIconHolder: () => false,
      getTextRoles: () => [],
      getRoleMetadata: () => ({}),
    }));

    const CompositionService = require('../../../src/services/CompositionService');
    const position = { width_percent: 20, left_percent: 75, top_percent: 5 };
    await CompositionService.createComposition('ep-1', {
      template_id: 'tpl-1',
      justawomen_asset_id: 'jaw-1',
      include_justawomaninherprime: true,
      justawomaninherprime_position: position,
    }, 'u1');

    expect(ThumbnailComposition.create).toHaveBeenCalledTimes(1);
    expect(ThumbnailComposition.create.mock.calls[0][0]).toMatchObject({
      include_justawomaninherprime: true,
      justawomaninherprime_position: position,
      approval_status: 'DRAFT',
    });
  });
});

describe('Opportunity.create — spawnGoalUnlocks (src/services/careerPipelineService.js)', () => {
  test('career_goal_id reaches the create, and the opportunity is spawned', async () => {
    const Opportunity = schemaChecked('Opportunity', { create: async (data) => ({ ...data }) });
    const { spawnGoalUnlocks } = require('../../../src/services/careerPipelineService');

    const spawned = await spawnGoalUnlocks(
      { id: 'goal-1', title: 'First cover', priority: 1, unlocks_on_complete: ['maison_belle_contract'] },
      'show-1',
      { Opportunity, sequelize: { query: jest.fn() } },
    );

    // Before the declaration the create threw inside the service's own
    // try/catch (console.warn), so nothing was spawned.
    expect(spawned).toHaveLength(1);
    expect(Opportunity.create.mock.calls[0][0]).toMatchObject({ career_goal_id: 'goal-1' });
  });
});

describe('RegistryCharacter.update — POST /commit (src/routes/characterGenerator.js)', () => {
  test('world_character_id reaches the cross-link update', async () => {
    const updates = [];
    const RegistryCharacter = schemaChecked('RegistryCharacter', {
      findOne: async () => null,
      create: async (data) => ({ id: 'rc-1', ...data }),
      update: async (values, opts) => { updates.push([values, opts]); return [1]; },
    });
    passAuth();
    const app = express();
    app.use(express.json());
    app.locals.db = {
      RegistryCharacter,
      WorldCharacter: { create: async () => ({ id: 'wc-1' }) },
      sequelize: { query: jest.fn(), QueryTypes: { INSERT: 'INSERT' } },
    };
    app.use('/', require('../../../src/routes/characterGenerator'));

    const res = await request(app).post('/commit').send({
      registryId: 'reg-1',
      character: { name: 'Sloane Vega', layer: 'lalaverse', role_type: 'friend' },
    });
    expect(res.status).toBe(200);
    expect(res.body.world_character_id).toBe('wc-1');
    expect(updates).toEqual([[{ world_character_id: 'wc-1' }, { where: { id: 'rc-1' } }]]);
  });
});

describe('SceneSet.update — saveSceneSetCanvas (src/controllers/sceneStudioController.js)', () => {
  test('canvas_settings reaches the update, merged over the stored settings', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    const SceneSet = schemaChecked('SceneSet', {
      findByPk: async () => ({ id: 'set-1', canvas_settings: { depth_map_url: 'd.png', zoom: 1 } }),
    });
    jest.doMock(MODELS, () => ({
      SceneSet,
      sequelize: { transaction: async () => transaction },
    }));
    for (const svc of ['objectGenerationService', 'depthEstimationService', 'imageRestyleService', 'inpaintingService']) {
      jest.doMock(`../../../src/services/${svc}`, () => ({}));
    }
    const controller = require('../../../src/controllers/sceneStudioController');

    const res = { status: jest.fn(() => res), json: jest.fn() };
    await controller.saveSceneSetCanvas({ params: { id: 'set-1' }, body: { canvas_settings: { zoom: 2 } } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(transaction.commit).toHaveBeenCalled();
    expect(SceneSet.update).toHaveBeenCalledWith(
      { canvas_settings: { depth_map_url: 'd.png', zoom: 2 } },
      { where: { id: 'set-1' }, transaction },
    );
  });
});

describe('SceneSet.create — POST /properties/:id/rooms (src/routes/propertyRoutes.js)', () => {
  test('canvas_settings (room_type, room_layout_template) reaches the create', async () => {
    const SceneSet = schemaChecked('SceneSet', { create: async (data) => ({ ...data }) });
    jest.doMock(MODELS, () => ({
      SceneSet,
      WorldLocation: {
        findByPk: async () => ({ id: 'prop-1', name: 'The Loft', universe_id: 'uni-1' }),
        create: async (data) => ({ ...data }),
      },
    }));
    passAuth();
    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/propertyRoutes'));

    const res = await request(app).post('/prop-1/rooms').send({ name: 'Closet', room_type: 'closet' });
    expect(res.status).toBe(201);
    expect(SceneSet.create.mock.calls[0][0]).toMatchObject({
      scene_type: 'CLOSET',
      canvas_settings: { room_type: 'closet', room_layout_template: null },
    });
  });
});
