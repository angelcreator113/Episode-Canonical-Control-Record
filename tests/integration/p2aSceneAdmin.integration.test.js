/**
 * Scene, set-link and footage writes are an ADMIN's (P2a; Evoni, 2026-11-22;
 * docs/audit/F-AUTH-1_SceneSetFootageWrites_AdminOnly_Amendment_2026-11-22.md).
 *
 * Seventy-three write routes carry requireAuth then authorize(['ADMIN']),
 * before any rate limiter, upload handling or handler; a seventy-fourth,
 * POST /api/v1/scene-sets, stays any signed-in account's and refuses only
 * the episode link. For each of the seventy-three, on the migrated database
 * through the real app and the real auth middleware:
 *   - signed out: 401;
 *   - signed in but not an admin: 403 with authorize's own body;
 *   - during that refusal no statement that writes is sent to the database
 *     (every statement is recorded, tests/helpers/lockTrace), every row the
 *     routes could change is as it was, no provider is called (axios,
 *     Replicate, Anthropic), nothing is sent to storage and no upload is
 *     read;
 *   - an admin is never answered by authorize.
 * What an admin then gets from each route is unchanged and is the subject of
 * the routes' own suites, which now ask as an admin.
 *
 * Also here: the scene-set object routes reached with a SCENE's id (the same
 * handlers as the Studio's scene routes), both declarations of the six
 * routes declared twice, the episode-asset delete's order against the
 * document rule, the scene-set create's episode link, and the reads that
 * stay any signed-in account's.
 */
jest.unmock('uuid');

const mockAnthropic = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
const mockReplicateRun = jest.fn();
jest.mock('replicate', () => jest.fn(() => ({ run: mockReplicateRun, predictions: { create: mockReplicateRun, get: mockReplicateRun } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), request: jest.fn(), create: actual.create };
});
const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const crypto = require('crypto');
const multer = require('multer');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lockTrace = require('../helpers/lockTrace');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const src = (file) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'routes', file), 'utf8');

const AUTHORIZE_BODY = { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' };
const LINK_SENTENCE = 'Only an admin can link a scene set to an episode.';

(shouldSkip ? describe.skip : describe)("Scene, set-link and footage writes are an admin's (P2a)", () => {
  const show = uuid();
  const episode = uuid();
  const scene = uuid();
  const set = uuid();
  const angle = uuid();
  const asset = uuid();
  const sceneObject = uuid();
  const setObject = uuid();
  const libraryScene = uuid();
  const TAG = show.slice(0, 8);
  const tokens = {};
  let ip = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.92.${Math.floor(ip / 250)}.${(ip % 250) + 1}`);
  const as = (who) => (r) => (who ? from(r).set('Authorization', `Bearer ${tokens[who]}`) : from(r));

  const EP = `/api/v1/episodes/${episode}`;
  const EPS = '/api/v1/episodes';
  const SETS = `/api/v1/scene-sets/${set}`;
  const SC = `/api/v1/scenes/${scene}`;
  const FOOT = '/api/footage';
  const BRIEF = `/api/v1/episode-brief/${episode}`;
  const other = uuid();

  // [name, method, path, body, upload field?]: a request an admin could send.
  const ROUTES = [
    // routes/episodes.js (26)
    ['episode locations', 'put', `${EP}/locations`, { locations: [{ scene_set_id: set, role: 'home' }] }],
    ['move removed sets', 'post', `${EP}/move-removed-sets`, { from_set_id: other, to_set_id: set }],
    ['episode set link', 'post', `${EP}/scene-sets`, { sceneSetIds: [set] }],
    ['episode set unlink', 'delete', `${EP}/scene-sets/${set}`, {}],
    ['episode set reorder', 'patch', `${EP}/scene-sets/reorder`, { order: [set] }],
    ['scenes reorder', 'put', `${EP}/scenes/reorder`, { sceneIds: [scene] }],
    ['episode scene create', 'post', `${EP}/scenes`, { title: 'New scene' }],
    ['scene calculate-duration', 'post', `${EPS}/scenes/${scene}/calculate-duration`, {}],
    ['scene asset add', 'post', `${EPS}/scenes/${scene}/assets`, { assetId: asset }],
    ['scene asset update', 'put', `${EPS}/scenes/${scene}/assets/${sceneObject}`, { opacity: 0.5 }],
    ['scene asset remove', 'delete', `${EPS}/scenes/${scene}/assets/${sceneObject}`, {}],
    ['scene from angle', 'post', `${EP}/scenes/from-angle`, { scene_set_id: set, scene_angle_id: angle }],
    ['library scene add', 'post', `${EP}/library-scenes`, { sceneLibraryId: libraryScene }],
    ['library scene update', 'put', `${EP}/library-scenes/${libraryScene}`, { sceneOrder: 2 }],
    ['library scene remove', 'delete', `${EP}/library-scenes/${libraryScene}`, {}],
    ['library asset add', 'post', `${EP}/library-assets`, { assetId: asset }],
    ['library asset update', 'patch', `${EP}/library-assets/${asset}`, { folder: 'x' }],
    ['library asset remove', 'delete', `${EP}/library-assets/${asset}`, {}],
    ['sequence items reorder', 'put', `${EP}/sequence-items/reorder`, { itemIds: [libraryScene] }],
    ['sequence items note', 'post', `${EP}/sequence-items/note`, { noteText: 'a note' }],
    ['episode asset add', 'post', `${EP}/assets`, { assetIds: [asset] }],
    ['episode asset remove', 'delete', `${EP}/assets/${asset}`, {}],
    ['episode asset update', 'patch', `${EP}/assets/${asset}`, { usage_type: 'overlay' }],
    ['timeline placement create', 'post', `${EP}/timeline/placements`, { placementType: 'asset', assetId: asset }],
    ['timeline placement update', 'patch', `${EP}/timeline/placements/${other}`, { offsetSeconds: 1 }],
    ['timeline placement delete', 'delete', `${EP}/timeline/placements/${other}`, {}],
    // routes/sceneSetRoutes.js (12 by middleware; the create is its own block)
    ['set delete', 'delete', SETS, {}],
    ['set episodes link', 'post', `${SETS}/episodes`, { episode_ids: [episode] }],
    ['set episode unlink', 'delete', `${SETS}/episodes/${episode}`, {}],
    ['set canvas save', 'put', `${SETS}/canvas`, { objects: [], canvas_settings: { zoom: 2 } }],
    ['set object add', 'post', `${SETS}/objects`, { asset_id: asset }],
    ['set object update', 'patch', `${SETS}/objects/${setObject}`, { opacity: 0.2 }],
    ['set object delete', 'delete', `${SETS}/objects/${setObject}`, {}],
    ['set object duplicate', 'post', `${SETS}/objects/${setObject}/duplicate`, {}],
    ['set generate-object', 'post', `${SETS}/generate-object`, { prompt: 'a lamp' }],
    ['set transform-object', 'post', `${SETS}/transform-object`, { image_url: 'https://x/a.png', prompt: 'gold' }],
    ['set regenerate-background', 'post', `${SETS}/regenerate-background`, { mood: 'warm' }],
    ['set angle generate-depth', 'post', `${SETS}/angles/${angle}/generate-depth`, {}],
    // routes/scenes.js (27: every write in the file)
    ['scene create', 'post', '/api/v1/scenes', { episode_id: episode, title: 'New' }],
    ['scene duplicate', 'post', `${SC}/duplicate`, {}],
    ['scene status', 'put', `${SC}/status`, { status: 'storyboarded' }],
    ['scene character add', 'post', `${SC}/characters`, { characterName: 'Lala' }],
    ['scene character remove', 'delete', `${SC}/characters/Lala`, {}],
    ['scene thumbnail', 'put', `${SC}/thumbnail`, { thumbnailId: other }],
    ['scene assets replace', 'put', `${SC}/assets`, { assets: {} }],
    ['scene asset link', 'post', `${SC}/assets`, { assetId: asset }],
    ['scene asset unlink', 'delete', `${SC}/assets/${asset}`, {}],
    ['scene asset details', 'patch', `${SC}/assets/${asset}`, { opacity: 0.3 }],
    ['scene canvas save', 'put', `${SC}/canvas`, { objects: [], background_url: 'https://x/changed.png' }],
    ['scene generate-object', 'post', `${SC}/generate-object`, { prompt: 'a lamp' }],
    ['scene transform-object', 'post', `${SC}/transform-object`, { image_url: 'https://x/a.png', prompt: 'gold' }],
    ['scene regenerate-background', 'post', `${SC}/regenerate-background`, { mood: 'warm' }],
    ['scene suggest-objects', 'post', `${SC}/suggest-objects`, {}],
    ['scene inpaint', 'post', `${SC}/inpaint`, { mask: 'data:image/png;base64,AAAA', prompt: 'remove' }],
    ['scene segment', 'post', `${SC}/segment`, { x: 1, y: 1 }],
    ['scene animate', 'post', `${SC}/animate`, { imageUrl: 'https://x/a.png' }],
    ['scene generate-depth', 'post', `${SC}/generate-depth`, { image_url: 'https://x/a.png' }],
    ['scene object add', 'post', `${SC}/objects`, { asset_id: asset }],
    ['scene object update', 'patch', `${SC}/objects/${sceneObject}`, { opacity: 0.2 }],
    ['scene object delete', 'delete', `${SC}/objects/${sceneObject}`, {}],
    ['scene object duplicate', 'post', `${SC}/objects/${sceneObject}/duplicate`, {}],
    ['scene object variant', 'post', `${SC}/objects/${sceneObject}/variants`, { asset_id: asset }],
    ['scene variant activate', 'patch', `${SC}/variant-groups/${other}/activate`, { variantId: sceneObject }],
    ['scene update', 'put', SC, { title: 'Changed', background_url: 'https://x/changed.png' }],
    ['scene delete', 'delete', SC, {}],
    // routes/footage.js (4)
    ['footage upload', 'post', `${FOOT}/upload`, null, 'video'],
    ['footage asset link', 'post', `${FOOT}/episodes/${episode}/assets`, { assetIds: [asset] }],
    ['footage asset unlink', 'delete', `${FOOT}/episodes/${episode}/assets/${asset}`, {}],
    ['footage scene delete', 'delete', `${FOOT}/scenes/${scene}`, {}],
    // routes/episodeBriefRoutes.js (4)
    ['performance clip attach', 'put', `${BRIEF}/performance-clips`, { beat_number: 1, asset_id: asset, performer: 'Lala' }],
    ['performance clip remove', 'delete', `${BRIEF}/performance-clips/${other}`, {}],
    ['dressed angle generate', 'post', `${BRIEF}/dressed-angles/${angle}/generate`, {}],
    ['dressed angle upload', 'post', `${BRIEF}/dressed-angles/${angle}/upload`, null, 'image'],
  ];
  const send = (who, [, method, urlPath, body, upload]) => {
    const r = as(who)(request(app)[method](urlPath));
    if (upload) return r.field('episodeId', episode).attach(upload, Buffer.from('not really a file'), { filename: 'take.mp4', contentType: upload === 'video' ? 'video/mp4' : 'image/png' });
    return r.send(body);
  };

  // Every row a P2a route could change, whole. Scoped to this file's show so
  // another suite on the same database cannot disturb it.
  const snapshot = async () => ({
    episodes: await rows('SELECT * FROM episodes WHERE show_id = :show ORDER BY id', { show }),
    scenes: await rows('SELECT * FROM scenes WHERE episode_id = :episode ORDER BY id', { episode }),
    sceneAssets: await rows('SELECT * FROM scene_assets WHERE scene_id = :scene OR scene_set_id = :set ORDER BY id', { scene, set }),
    sets: await rows('SELECT * FROM scene_sets WHERE show_id = :show ORDER BY id', { show }),
    angles: await rows('SELECT * FROM scene_angles WHERE scene_set_id = :set ORDER BY id', { set }),
    setLinks: await rows('SELECT * FROM scene_set_episodes WHERE episode_id = :episode OR scene_set_id = :set ORDER BY id', { episode, set }),
    episodeScenes: await rows('SELECT * FROM episode_scenes WHERE episode_id = :episode ORDER BY id', { episode }),
    episodeAssets: await rows('SELECT * FROM episode_assets WHERE episode_id = :episode ORDER BY asset_id', { episode }),
    assets: await rows('SELECT * FROM assets WHERE show_id = :show ORDER BY id', { show }),
    clips: await rows('SELECT * FROM episode_performance_clips WHERE episode_id = :episode ORDER BY id', { episode }),
    plans: await rows('SELECT * FROM scene_plans WHERE episode_id = :episode ORDER BY id', { episode }),
    events: await rows('SELECT * FROM world_events WHERE show_id = :show ORDER BY id', { show }),
  });
  const writesIn = (records) => records.filter((r) => r.kind === 'write' || r.kind === 'insert'
    || (r.kind === 'other' && /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(r.sql || '')));
  const providersCalled = () => [
    mockAnthropic, mockReplicateRun, axios.post, axios.get, axios.put, axios.delete, axios.request, mockS3Send,
  ].reduce((n, fn) => n + fn.mock.calls.length, 0);

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@p2a.dev`, name: id, groups, role }).accessToken;
    tokens.editor = token('p2a-editor', ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token('p2a-viewer', ['viewer'], 'USER');
    tokens.admin = token('p2a-admin', ['ADMIN'], 'ADMIN');
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `P2a ${TAG}`, slug: `p2a-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'P2a episode', :n, 'draft', NOW(), NOW())`, { episode, show, n: Math.floor(Math.random() * 100000) + 500 });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:set, :name, 'HOME_BASE', :show, 'https://x/p2a-base.jpg', 'complete', NOW(), NOW())`, { set, show, name: `P2a set ${TAG}` });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, still_image_url, created_at, updated_at)
               VALUES (:angle, :set, 'Wide', 'WIDE', 'https://x/p2a-wide.jpg', NOW(), NOW())`, { angle, set });
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_raw, created_at, updated_at)
               VALUES (:asset, :name, 'EPISODE_FRAME', :show, 'https://x/p2a-asset.png', NOW(), NOW())`, { asset, show, name: `P2a asset ${TAG}` });
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, background_url, created_at, updated_at)
               VALUES (:scene, :episode, 1, 'P2a scene', 'https://x/p2a-bg.jpg', NOW(), NOW())`, { scene, episode });
    await run(`INSERT INTO scene_assets (id, scene_id, asset_id, object_label, opacity, created_at, updated_at)
               VALUES (:sceneObject, :scene, :asset, 'On the scene', 1, NOW(), NOW())`, { sceneObject, scene, asset });
  });
  beforeEach(() => {
    ip += 1;
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show, episode, scene, set } }).catch((err) => console.error('cleanup:', err.message));
    await q('DELETE FROM scene_assets WHERE scene_id IN (SELECT id FROM scenes WHERE episode_id = :episode) OR scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)');
    await q('DELETE FROM scenes WHERE episode_id = :episode');
    await q('DELETE FROM scene_set_episodes WHERE episode_id = :episode OR scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)');
    await q('DELETE FROM scene_angles WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)');
    await q('DELETE FROM scene_sets WHERE show_id = :show');
    await q('DELETE FROM assets WHERE show_id = :show');
    await q('DELETE FROM episodes WHERE show_id = :show');
    await q('DELETE FROM shows WHERE id = :show');
    await sequelize.close();
  });

  it('the table names seventy-three routes, each once', () => {
    expect(ROUTES).toHaveLength(73);
    expect(new Set(ROUTES.map((r) => `${r[1]} ${r[2]}`)).size).toBe(73);
  });

  describe.each(ROUTES)('%s', (...route) => {
    it('signed out: 401, nothing written, no provider, storage or upload', async () => {
      const before = await snapshot();
      const uploadSpy = jest.spyOn(multer.memoryStorage().constructor.prototype, '_handleFile');
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await send(null, route); } finally { trace.uninstall(); }
      expect(res.status).toBe(401);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(providersCalled()).toBe(0);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it.each(['editor', 'viewer'])('signed in as %s, not an admin: 403 from authorize, no statement that writes, every row as it was, no provider, storage or upload', async (who) => {
      const before = await snapshot();
      const uploadSpy = jest.spyOn(multer.memoryStorage().constructor.prototype, '_handleFile');
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await send(who, route); } finally { trace.uninstall(); }
      expect(res.status).toBe(403);
      expect(res.body).toEqual(AUTHORIZE_BODY);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(providersCalled()).toBe(0);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('an admin is not stopped by the check', async () => {
      // What the route then does is its own suites' subject; here only that
      // an admin is never answered by authorize. It is asked about rows that
      // do not exist, with an empty body, so nothing is made, changed or
      // spent (no provider key is set in the test environment either).
      const [, method, urlPath] = route;
      const ghost = [episode, scene, set, angle, asset, sceneObject, setObject, libraryScene]
        .reduce((p, id) => p.split(id).join(uuid()), urlPath);
      const res = await as('admin')(request(app)[method](ghost)).send({});
      expect([401, 403]).not.toContain(res.status);
      expect(res.body?.code).not.toBe('AUTH_GROUP_REQUIRED');
    });
  });

  describe("the scene-set object routes reached with a scene's id (the same handlers as the Studio's)", () => {
    const viaSet = (suffix = '') => `/api/v1/scene-sets/${scene}/objects/${sceneObject}${suffix}`;
    const objectRow = async () => (await rows('SELECT * FROM scene_assets WHERE id = :sceneObject', { sceneObject }))[0];
    const objectCount = async () => (await rows('SELECT COUNT(*)::int AS n FROM scene_assets WHERE scene_id = :scene', { scene }))[0].n;

    it.each([
      ['PATCH', (who) => as(who)(request(app).patch(viaSet())).send({ opacity: 0.1 })],
      ['DELETE', (who) => as(who)(request(app).delete(viaSet())).send()],
      ['duplicate', (who) => as(who)(request(app).post(viaSet('/duplicate'))).send({})],
    ])('%s by someone who is not an admin: 403, and the scene keeps its object as it was', async (_label, call) => {
      const before = await objectRow();
      const count = await objectCount();
      for (const who of ['editor', 'viewer']) {
        const res = await call(who);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(AUTHORIZE_BODY);
      }
      expect(await objectRow()).toEqual(before);
      expect(await objectCount()).toBe(count);
    });

    it("an admin's PATCH through the set path does change the scene's object: the path this check closes is a real one", async () => {
      const res = await as('admin')(request(app).patch(viaSet())).send({ opacity: 0.4 });
      expect(res.status).toBe(200);
      expect(Number((await objectRow()).opacity)).toBeCloseTo(0.4);
      await run('UPDATE scene_assets SET opacity = 1 WHERE id = :sceneObject', { sceneObject });
    });
  });

  describe('routes declared twice carry the check on both declarations', () => {
    const episodes = src('episodes.js');
    const declared = (method, routePath) => {
      const re = new RegExp(`router\\.${method}\\(\\s*'${routePath.replace(/[/:]/g, (c) => `\\${c}`)}',([\\s\\S]*?)\\);`, 'g');
      return [...episodes.matchAll(re)].map((m) => m[1]);
    };
    it.each([
      ['post', 'library-assets'],
      ['patch', 'library-assets/:assetId'],
      ['delete', 'library-assets/:assetId'],
      ['post', 'timeline/placements'],
      ['patch', 'timeline/placements/:placementId'],
      ['delete', 'timeline/placements/:placementId'],
    ])('%s …/%s: /:id/… and /:episodeId/…', (method, tail) => {
      for (const param of [':id', ':episodeId']) {
        const chains = declared(method, `/${param}/${tail}`);
        expect(chains).toHaveLength(1);
        expect(chains[0]).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\),/);
      }
    });
  });

  describe('DELETE /episodes/:id/assets/:assetId and the document-presentation rule', () => {
    const presentation = uuid();
    beforeAll(async () => {
      await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_raw, metadata, created_at, updated_at)
                 VALUES (:presentation, :name, 'DOCUMENT_PRESENTATION', :show, 'https://x/p2a-doc.png', '{}'::jsonb, NOW(), NOW())`,
      { presentation, show, name: `P2a presentation ${TAG}` });
    });

    it('the check sits after requireAuth and before the document rule', () => {
      expect(src('episodes.js')).toMatch(/'\/:id\/assets\/:assetId',\s*validateUUIDParam\('id'\),\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*(\/\/[^\n]*\n\s*)?require\('\.\.\/utils\/documentPresentationAssets'\)\.protectDocumentPresentations/);
    });

    it("someone who is not an admin gets authorize's 403, not the document rule's answer", async () => {
      const res = await as('editor')(request(app).delete(`${EP}/assets/${presentation}`)).send();
      expect(res.status).toBe(403);
      expect(res.body).toEqual(AUTHORIZE_BODY);
    });

    it("an admin still gets the document rule's refusal, as before", async () => {
      const res = await as('admin')(request(app).delete(`${EP}/assets/${presentation}`)).send();
      expect(res.status).not.toBe(403);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.code).not.toBe('AUTH_GROUP_REQUIRED');
      expect((await rows('SELECT id FROM assets WHERE id = :presentation', { presentation }))).toHaveLength(1);
    });
  });

  describe('POST /api/v1/scene-sets: making a set is any signed-in account\'s, linking it to an episode is an admin\'s', () => {
    const made = [];
    const create = (who, extra) => as(who)(request(app).post('/api/v1/scene-sets'))
      .send({ name: `P2a made ${TAG} ${made.length}-${Math.random().toString(36).slice(2, 7)}`, scene_type: 'HOME_BASE', show_id: show, ...extra });
    const setCount = async () => (await rows('SELECT COUNT(*)::int AS n FROM scene_sets WHERE show_id = :show', { show }))[0].n;
    const linkCount = async () => (await rows('SELECT COUNT(*)::int AS n FROM scene_set_episodes WHERE episode_id = :episode', { episode }))[0].n;

    it('the route keeps its middleware: requireAuth alone', () => {
      expect(src('sceneSetRoutes.js')).toMatch(/router\.post\('\/', requireAuth, async \(req, res\) => \{/);
    });

    it('signed out: 401', async () => {
      expect((await create(null, {})).status).toBe(401);
    });

    it.each([
      ['no episode_ids', {}],
      ['episode_ids null', { episode_ids: null }],
      ['episode_ids []', { episode_ids: [] }],
    ])('someone who is not an admin, %s: the set is made (201) and nothing is linked', async (_label, extra) => {
      const links = await linkCount();
      const res = await create('editor', extra);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(await linkCount()).toBe(links);
    });

    it.each([
      ['an episode', () => ({ episode_ids: [episode] })],
      ['several', () => ({ episode_ids: [episode, uuid()] })],
      ['a string', () => ({ episode_ids: episode })],
      ['an object', () => ({ episode_ids: { id: episode } })],
      ['a number', () => ({ episode_ids: 7 })],
      ['an empty string', () => ({ episode_ids: '' })],
      ['false', () => ({ episode_ids: false })],
      ['an array of nothing useful', () => ({ episode_ids: [null] })],
    ])('someone who is not an admin, episode_ids as %s: 403 with the sentence, no set made, nothing linked, nothing written', async (_label, extra) => {
      for (const who of ['editor', 'viewer']) {
        const sets = await setCount();
        const links = await linkCount();
        const trace = lockTrace.install(sequelize);
        let res;
        try { res = await create(who, extra()); } finally { trace.uninstall(); }
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ success: false, code: 'AUTH_GROUP_REQUIRED', error: LINK_SENTENCE, message: LINK_SENTENCE, fields: ['episode_ids'] });
        expect(writesIn(trace.records)).toEqual([]);
        expect(await setCount()).toBe(sets);
        expect(await linkCount()).toBe(links);
      }
    });

    it('the refusal comes before the body is judged: a non-admin with episode_ids and no name is still the 403', async () => {
      const res = await as('editor')(request(app).post('/api/v1/scene-sets')).send({ episode_ids: [episode] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    });

    it('an admin with episode_ids: the set is made and linked, as before', async () => {
      const links = await linkCount();
      const res = await create('admin', { episode_ids: [episode] });
      expect(res.status).toBe(201);
      expect(await linkCount()).toBe(links + 1);
    });
  });

  describe('reads stay any signed-in account\'s', () => {
    const READS = [
      ['scenes list', `/api/v1/scenes?episode_id=${episode}`],
      ['scene', SC],
      ['scene assets', `${SC}/assets`],
      ['scene canvas', `${SC}/canvas`],
      ['scene depth map', `${SC}/depth-map`],
      ['set canvas', `${SETS}/canvas`],
      ['episode library scenes', `${EP}/library-scenes`],
      ['episode library assets', `${EP}/library-assets`],
      ['episode scene sets', `${EP}/scene-sets`],
      ['episode scenes', `${EP}/scenes`],
      ['performance clips', `${BRIEF}/performance-clips`],
      ['dressed angles', `${BRIEF}/dressed-angles?scene_set_id=${set}`],
    ];
    it.each(READS)('%s: an editor and a viewer are answered as an admin is', async (_label, urlPath) => {
      const admin = await as('admin')(request(app).get(urlPath));
      expect([401, 403]).not.toContain(admin.status);
      for (const who of ['editor', 'viewer']) {
        const res = await as(who)(request(app).get(urlPath));
        expect(res.status).toBe(admin.status);
        expect(res.body?.code).not.toBe('AUTH_GROUP_REQUIRED');
      }
    });

    it('the dressed-angle brief (a POST that only reads) still answers someone who is not an admin', async () => {
      const admin = await as('admin')(request(app).post(`${BRIEF}/dressed-angles/${angle}/brief`)).send({});
      const editor = await as('editor')(request(app).post(`${BRIEF}/dressed-angles/${angle}/brief`)).send({});
      expect([401, 403]).not.toContain(editor.status);
      expect(editor.status).toBe(admin.status);
    });
  });
});
