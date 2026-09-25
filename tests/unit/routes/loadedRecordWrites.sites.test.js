/**
 * Task #1909, step 4 — writes through a loaded record that Sequelize
 * dropped, driven through their real call sites.
 *
 * scripts/check-schema-agreement.js step 1 now reports x.update(values) and
 * x.attr = ...; x.save() on a row loaded in the same block. These are the
 * sites it found that are fixed (the rest are baselined with a reason; see
 * the PR). Each loaded row is a real Sequelize instance of the real model,
 * defined on a never-connected Sequelize instance
 * (tests/unit/helpers/schemaCheckedModel.js), so it drops exactly what
 * production drops: an undeclared key, or a JSONB value edited in place and
 * passed back as the same reference. The query interface's update is stubbed
 * to record what save() would send. No database.
 */
const express = require('express');
const request = require('supertest');

const MODELS = '../../../src/models';

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function loadModel(name) {
  return require('../helpers/schemaCheckedModel').loadModel(name);
}

/** Record every UPDATE save() would send: [{ table, values, fields }]. */
function recordSaves(Model) {
  const saves = [];
  jest.spyOn(Model.sequelize.getQueryInterface(), 'update').mockImplementation(async (instance, table, values, _where, opts) => {
    saves.push({ table, values: { ...values }, fields: [...(opts.fields || [])] });
    return [instance, 1];
  });
  return saves;
}

/** A row as findByPk / findOne returns it (not new, nothing changed). */
const loaded = (Model, row) => Model.build(row, { isNewRecord: false, raw: true });

describe('EpisodeWardrobe.is_episode_favorite — toggleEpisodeFavorite (src/controllers/wardrobeController.js)', () => {
  test('the toggle is saved', async () => {
    const EpisodeWardrobe = loadModel('EpisodeWardrobe');
    const saves = recordSaves(EpisodeWardrobe);
    const link = loaded(EpisodeWardrobe, { id: 'ew-1', episode_id: 'ep-1', wardrobe_id: 'w-1', is_episode_favorite: false });
    jest.spyOn(EpisodeWardrobe, 'findOne').mockResolvedValue(link);
    jest.doMock(MODELS, () => ({ models: { EpisodeWardrobe, Wardrobe: {}, Episode: {} }, sequelize: {}, Sequelize: {} }));
    jest.doMock('../../../src/services/wardrobeImageService', () => ({}));
    const controller = require('../../../src/controllers/wardrobeController');

    const res = { status: jest.fn(() => res), json: jest.fn() };
    await controller.toggleEpisodeFavorite({ params: { id: 'ep-1', wardrobeId: 'w-1' }, body: {} }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(saves).toHaveLength(1);
    expect(saves[0].table).toBe('episode_wardrobe');
    expect(saves[0].values).toMatchObject({ is_episode_favorite: true });
    expect(res.json.mock.calls[0][0].message).toBe('Episode favorite added');
  });
});

describe('RegistryCharacter — PUT /character-crossings/:id/confirm-gap (src/routes/characterCrossingRoutes.js)', () => {
  test('performing_publicly, dimensions_performed and dimensions_hidden are saved on the character', async () => {
    const CharacterCrossing = loadModel('CharacterCrossing');
    const RegistryCharacter = loadModel('RegistryCharacter');
    const saves = recordSaves(RegistryCharacter); // one query interface for both models
    const crossing = loaded(CharacterCrossing, { id: 'cx-1', character_id: 'rc-1', gap_confirmed: false });
    const char = loaded(RegistryCharacter, { id: 'rc-1', performing_publicly: false, dimensions_performed: [], dimensions_hidden: [] });
    jest.spyOn(CharacterCrossing, 'findByPk').mockResolvedValue(crossing);
    jest.spyOn(RegistryCharacter, 'findByPk').mockResolvedValue(char);
    jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));

    const app = express();
    app.use(express.json());
    app.set('models', { CharacterCrossing, RegistryCharacter });
    app.use('/', require('../../../src/routes/characterCrossingRoutes'));

    const res = await request(app).put('/cx-1/confirm-gap').send({ dimensions_performed: ['ambition'], dimensions_hidden: ['grief'] });

    expect(res.status).toBe(200);
    expect(res.body.character_updated).toBe(true);
    const charSave = saves.find((s) => s.table === 'registry_characters');
    expect(charSave).toBeDefined();
    expect(charSave.values).toMatchObject({
      performing_publicly: true,
      dimensions_performed: ['ambition'],
      dimensions_hidden: ['grief'],
    });
  });
});

describe('CharacterCrossing — POST /character-crossings/:id/propose-gap (src/routes/characterCrossingRoutes.js)', () => {
  // A schema-checked instance: save() throws when a key assigned on the
  // crossing is not a declared attribute (a real instance ignores it
  // silently, which is the defect). The proposed dimensions are for the
  // response only; they are not crossing columns.
  function checkedInstance(Model, row) {
    const target = { ...row };
    const changed = new Set();
    const saved = [];
    const proxy = new Proxy(target, {
      set(t, k, v) {
        t[k] = v;
        if (typeof k === 'string' && typeof v !== 'function') changed.add(k);
        return true;
      },
    });
    target.save = jest.fn(async () => {
      for (const k of changed) {
        if (!Object.prototype.hasOwnProperty.call(Model.rawAttributes, k)) {
          throw new Error(`${Model.name}.${k} is not a declared attribute; instance save would drop it`);
        }
      }
      saved.push(Object.fromEntries([...changed].map((k) => [k, target[k]])));
      changed.clear();
      return proxy;
    });
    target.saved = saved;
    return proxy;
  }

  test('the proposal is returned and only crossing columns are saved', async () => {
    const CharacterCrossing = loadModel('CharacterCrossing');
    const RegistryCharacter = loadModel('RegistryCharacter');
    const crossing = checkedInstance(CharacterCrossing, {
      id: 'cx-1', character_id: 'rc-1', character: { selected_name: 'Sloane', role_type: 'friend' },
    });
    jest.spyOn(CharacterCrossing, 'findByPk').mockResolvedValue(crossing);
    const text = JSON.stringify({ score: 72, reasoning: 'Performs ambition.', dimensions_performed: ['ambition'], dimensions_hidden: ['grief'] });
    jest.doMock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
      messages: { create: jest.fn(async () => ({ content: [{ text }] })) },
    })));
    jest.doMock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_q, _s, next) => next() }));
    jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));

    const app = express();
    app.use(express.json());
    app.set('models', { CharacterCrossing, RegistryCharacter });
    app.use('/', require('../../../src/routes/characterCrossingRoutes'));

    const res = await request(app).post('/cx-1/propose-gap').send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 72, dimensions_performed: ['ambition'], dimensions_hidden: ['grief'] });
    expect(crossing.saved).toEqual([{ performance_gap_score: 72, gap_proposed_by_amber: 'Performs ambition.' }]);
  });
});

describe('Asset — AssetService approve / reject (src/services/AssetService.js)', () => {
  function loadService(asset) {
    const Asset = asset.constructor;
    jest.spyOn(Asset, 'findByPk').mockResolvedValue(asset);
    jest.doMock(MODELS, () => ({ models: { Asset, AssetLabel: {} } }));
    jest.doMock('../../../src/services/ImageProcessingService', () => ({ processImage: jest.fn() }));
    return require('../../../src/services/AssetService');
  }

  test('approveAsset saves who approved and when in metadata, and sends no processed_at', async () => {
    const Asset = loadModel('Asset');
    const saves = recordSaves(Asset);
    const asset = loaded(Asset, { id: 'a-1', approval_status: 'PENDING', metadata: { thumbnail_url: 't.png' } });
    const AssetService = loadService(asset);

    await AssetService.approveAsset('a-1', 'u1');

    expect(saves).toHaveLength(1);
    expect(saves[0].values).toMatchObject({
      approval_status: 'APPROVED',
      metadata: { thumbnail_url: 't.png', approved_by: 'u1', approved_at: expect.any(String) },
    });
    expect(saves[0].values).not.toHaveProperty('processed_at');
  });

  test('rejectAsset saves the reason in metadata, and sends no processing_error', async () => {
    const Asset = loadModel('Asset');
    const saves = recordSaves(Asset);
    const asset = loaded(Asset, { id: 'a-1', approval_status: 'PENDING', metadata: {} });
    const AssetService = loadService(asset);

    await AssetService.rejectAsset('a-1', 'wrong outfit');

    expect(saves).toHaveLength(1);
    expect(saves[0].values).toMatchObject({
      approval_status: 'REJECTED',
      metadata: { rejection_reason: 'wrong outfit', rejected_at: expect.any(String) },
    });
    expect(saves[0].values).not.toHaveProperty('processing_error');
  });
});
