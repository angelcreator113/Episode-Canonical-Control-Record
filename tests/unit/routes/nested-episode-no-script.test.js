/**
 * An episode inside another answer names it and carries no script (Evoni,
 * 2026-11-22: "SEC-2b protects episode responses and nested script-bearing
 * data."). Four reads included the whole episode row, script and all, for
 * anyone signed in:
 *
 *   GET  /api/v1/compositions/:id              services/CompositionService getComposition (and setPrimary)
 *   GET  /api/v1/decisions/:id                 routes/decisions
 *   PUT  /api/v1/scenes/:id                    controllers/sceneController updateScene
 *   POST /api/footage/episodes/:episodeId/assets   routes/footage
 *
 * Each now asks for EPISODE_NESTED_FIELDS, for every reader. The real
 * handlers run here over stand-in models that answer as the database would:
 * the episode's values for the attributes asked for, the whole row when none
 * are named. No database is read.
 */
const EP = '11111111-1111-4111-8111-111111111111';

jest.mock('../../../src/models', () => {
  const fn = () => jest.fn();
  const models = {
    Episode: { findByPk: fn() },
    Asset: { findAll: fn() },
    Scene: { findByPk: fn() },
    ThumbnailComposition: { findByPk: fn(), update: fn() },
    CompositionOutput: {},
    CompositionAsset: { findAll: fn() },
    UserDecision: { findByPk: fn() },
    DecisionPattern: {},
    Thumbnail: {}, SceneAsset: {}, AssetUsageLog: {},
  };
  return { models, sequelize: {}, ...models };
});

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const db = require('../../../src/models');
const { EPISODE_NESTED_FIELDS } = require('../../../src/services/episodeReadFields');

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: The unpublished line.';
const EPISODE_ROW = {
  id: EP, title: 'The Gala', episode_number: 3, season_number: 2, status: 'draft', show_id: 'show-1',
  description: 'INTERNAL SYNOPSIS: she loses the deal.', script_content: SCRIPT, script_locked_beats: [1, 2],
  evaluation_json: { tier_final: 'gold-tier-result' }, money_plan: { lines: [{ amount: 4321 }] }, total_income: '9876.00',
  teaser: 'She has one night.', internal_notes: 'PRODUCTION NOTE',
};
const PRIVATE_WORDS = ['unpublished line', 'INTERNAL SYNOPSIS', 'gold-tier-result', '4321', '9876.00', 'PRODUCTION NOTE'];
const NAMED = { id: EP, title: 'The Gala', episode_number: 3, season_number: 2, status: 'draft', show_id: 'show-1' };

/** The episode as a query for these attributes answers it: every column when none are named. */
const episodeAs = (attributes) => (attributes ? Object.fromEntries(attributes.filter((k) => k in EPISODE_ROW).map((k) => [k, EPISODE_ROW[k]])) : { ...EPISODE_ROW });
/** The Episode entry of an include, however it was written ('episode', or { model, as }). */
const episodeInclude = (include) => {
  const list = [].concat(include || []);
  if (list.includes('episode')) return {};
  return list.find((i) => i && (i.as === 'episode' || i.model === db.Episode)) || null;
};
const noScript = (body) => { for (const words of PRIVATE_WORDS) expect(JSON.stringify(body)).not.toContain(words); };

const token = (groups) => TokenService.generateTokenPair({
  id: `nested-${groups.join('-') || 'none'}`, email: 'nested@test.dev', name: 'nested', groups, role: groups[0],
}).accessToken;
const READERS = [['USER'], ['EDITOR'], ['USER', 'EDITOR'], ['ADMIN']];

beforeEach(() => jest.clearAllMocks());

test('the stand-in answers the whole row when no attributes are named (what these reads used to send)', () => {
  expect(episodeAs(undefined).script_content).toBe(SCRIPT);
  expect(episodeAs([...EPISODE_NESTED_FIELDS])).toEqual(NAMED);
});

describe('a composition (GET /api/v1/compositions/:id)', () => {
  const CompositionService = require('../../../src/services/CompositionService');
  const composition = (options) => {
    const inc = episodeInclude(options.include);
    const values = { id: 'comp-1', episode_id: EP, composition_config: {}, outputs: [], ...(inc ? { episode: episodeAs(inc.attributes) } : {}) };
    return { ...values, toJSON: () => ({ ...values }), update: jest.fn(async () => {}) };
  };
  beforeEach(() => {
    db.ThumbnailComposition.findByPk.mockImplementation(async (_id, options) => composition(options));
    db.ThumbnailComposition.update.mockResolvedValue([0]);
    db.CompositionAsset.findAll.mockResolvedValue([]);
  });

  test('getComposition: the episode by name, never its script', async () => {
    const json = await CompositionService.getComposition('comp-1');
    const inc = episodeInclude(db.ThumbnailComposition.findByPk.mock.calls[0][1].include);
    expect(inc.attributes).toEqual([...EPISODE_NESTED_FIELDS]);
    expect(json.episode).toEqual(NAMED);
    noScript(json);
  });

  test('setPrimary: the same', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const json = await CompositionService.setPrimary('comp-1');
    log.mockRestore();
    const inc = episodeInclude(db.ThumbnailComposition.findByPk.mock.calls[0][1].include);
    expect(inc.attributes).toEqual([...EPISODE_NESTED_FIELDS]);
    expect(json.episode).toEqual(NAMED);
    noScript(json);
  });
});

describe('a decision (GET /api/v1/decisions/:id)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/decisions', require('../../../src/routes/decisions'));
  beforeEach(() => {
    db.UserDecision.findByPk.mockImplementation(async (id, options) => {
      const inc = episodeInclude(options.include);
      return { id, decision_type: 'layout', episode_id: EP, ...(inc ? { episode: episodeAs(inc.attributes) } : {}), scene: null };
    });
  });

  test('signed out: 401, as before', async () => {
    expect((await request(app).get('/api/v1/decisions/dec-1')).status).toBe(401);
    expect(db.UserDecision.findByPk).not.toHaveBeenCalled();
  });

  test.each(READERS.map((g) => [g.join('+'), g]))('%s: the episode by name, never its script', async (_label, groups) => {
    const res = await request(app).get('/api/v1/decisions/dec-1').set('Authorization', `Bearer ${token(groups)}`);
    expect(res.status).toBe(200);
    expect(episodeInclude(db.UserDecision.findByPk.mock.calls[0][1].include).attributes).toEqual([...EPISODE_NESTED_FIELDS]);
    expect(res.body.decision.episode).toEqual(NAMED);
    noScript(res.body);
  });
});

describe('a scene update (PUT /api/v1/scenes/:id, controllers/sceneController updateScene)', () => {
  const sceneController = require('../../../src/controllers/sceneController');

  test('the scene in the answer carries its episode by name, never its script', async () => {
    let scene;
    db.Scene.findByPk.mockImplementation(async (id, options) => {
      const inc = episodeInclude(options.include);
      scene = {
        id, title: 'Old', is_locked: false, ...(inc ? { episode: episodeAs(inc.attributes) } : {}),
        reload: jest.fn(async () => scene), save: jest.fn(async () => scene),
      };
      return scene;
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await sceneController.updateScene({ params: { id: 'scene-1' }, body: { title: 'New' }, user: { id: 'u1', groups: ['EDITOR'] } }, res);

    const inc = episodeInclude(db.Scene.findByPk.mock.calls[0][1].include);
    expect(inc.model).toBe(db.Episode);
    expect(inc.as).toBe('episode');
    expect(inc.attributes).toEqual([...EPISODE_NESTED_FIELDS]);
    expect(res.status).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({ success: true, message: 'Scene updated successfully' });
    expect(body.data.title).toBe('New');
    expect(body.data.episode).toEqual(NAMED);
    noScript(body);
  });
});

describe('linking assets to an episode (POST /api/footage/episodes/:episodeId/assets)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/footage', require('../../../src/routes/footage'));
  const ASSET = { id: 'asset-1', asset_type: 'EPISODE_FRAME', name: 'Frame' };
  let linked;
  beforeEach(() => {
    linked = [];
    db.Asset.findAll.mockResolvedValue([ASSET]);
    db.Episode.findByPk.mockImplementation(async (id, options = {}) => ({
      ...episodeAs(options.attributes),
      ...(options.include ? { assets: [ASSET] } : {}),
      addAssets: jest.fn(async (assets) => { linked.push(...assets); }),
    }));
  });
  const post = (auth) => {
    const r = request(app).post(`/api/footage/episodes/${EP}/assets`).send({ assetIds: ['asset-1'] });
    return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
  };

  test('signed out: 401, and nothing is linked', async () => {
    expect((await post(null)).status).toBe(401);
    expect(linked).toEqual([]);
  });

  test.each(READERS.map((g) => [g.join('+'), g]))('%s: the assets are linked as before; the episode in the answer by name, never its script', async (_label, groups) => {
    const res = await post(token(groups));
    expect(res.status).toBe(200);
    expect(linked).toEqual([ASSET]);
    // The read that answers is the one with the include.
    const answering = db.Episode.findByPk.mock.calls.find(([, options]) => options && options.include);
    expect(answering[1].attributes).toEqual([...EPISODE_NESTED_FIELDS]);
    expect(res.body).toMatchObject({ success: true, message: 'Successfully linked 1 asset(s) to episode' });
    expect(res.body.episode).toEqual({ ...NAMED, assets: [ASSET] });
    noScript(res.body);
  });
});
