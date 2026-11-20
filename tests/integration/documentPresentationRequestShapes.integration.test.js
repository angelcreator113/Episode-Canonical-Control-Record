/**
 * An asset id in a shape the route never meant (V2-2a-1, Evoni 2026-11-20).
 *
 * Found in review: POST /assets/bulk/delete with { assetIds: [[id]] } got
 * past the rule, which looked only at the top of the list, and the
 * database layer read the inner list as "any of these ids": a document
 * presentation was deleted. Two things answer it, both before any write:
 *  - a list of ids must be a list of id strings, and one id one id string
 *    (400 otherwise), on the routes that take them in a body;
 *  - the rule itself looks for an id anywhere inside what a request names,
 *    so the attachment guards (PR 3896), which share it, are covered too.
 * Against real Postgres, through the app's routes; every refusal is
 * checked to have changed no row.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { DOCUMENT_PRESENTATION, MANAGED_CODE, REFUSAL_CODE, anyDocumentPresentation, UninspectableAssetIdsError } = require('../../src/utils/documentPresentationAssets');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('an asset id in a shape the route never meant', () => {
  const show = uuid();
  const episode = uuid();
  const scene = uuid();
  const sceneSet = uuid();
  const event = uuid();
  const P = uuid(); // the document presentation
  const O = uuid(); // an ordinary asset
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const insertAsset = (id, type, role) => run(
    `INSERT INTO assets (id, name, asset_type, asset_role, asset_scope, show_id, approval_status, s3_url_raw, s3_url_processed, metadata, created_at, updated_at)
     VALUES (:id, :name, :type, :role, 'SHOW', :show, 'approved', 'https://x.s3.amazonaws.com/a.png', 'https://x.s3.amazonaws.com/a.png', '{}'::jsonb, NOW(), NOW())`,
    { id, name: `Shapes ${type}`, type, role, show });
  // Everything a request here could have changed.
  const everything = async () => ({
    assets: await q('SELECT * FROM assets WHERE show_id = :show ORDER BY id', { show }),
    scene: await q('SELECT background_url, canvas_settings, assets FROM scenes WHERE id = :scene', { scene }),
    set: await q('SELECT canvas_settings FROM scene_sets WHERE id = :sceneSet', { sceneSet }),
    objects: await q('SELECT id FROM scene_assets WHERE scene_id = :scene OR scene_set_id = :sceneSet', { scene, sceneSet }),
    defaults: await q('SELECT * FROM episode_wardrobe_defaults WHERE episode_id = :episode', { episode }),
    clips: await q('SELECT * FROM episode_performance_clips WHERE episode_id = :episode', { episode }),
    event: await q('SELECT canon_consequences, updated_at FROM world_events WHERE id = :event', { event }),
    compositions: await q('SELECT id FROM thumbnail_compositions WHERE episode_id = :episode', { episode }),
  });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-shapes', email: 'shapes@test.dev', name: 'shapes', groups: ['USER', 'ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show, name: `Shapes ${show.slice(0, 8)}`, slug: `shapes-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:episode, :show, 'Shapes', 1, 'draft', NOW(), NOW())`, { episode, show });
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at) VALUES (:scene, :episode, 1, 'Shapes scene', NOW(), NOW())`, { scene, episode });
    await run(`INSERT INTO scene_sets (id, show_id, name, scene_type, created_at, updated_at) VALUES (:sceneSet, :show, 'Shapes set', 'HOME_BASE', NOW(), NOW())`, { sceneSet, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at) VALUES (:event, :show, 'Shapes event', 'invite', '{}'::jsonb, 'draft', NOW(), NOW())`, { event, show });
    await insertAsset(P, DOCUMENT_PRESENTATION, 'DOCUMENT.PRESENTATION.OFFER_LETTER');
    await insertAsset(O, 'PROMO_LALA', 'CHAR.HOST.LALA');
  });

  afterAll(async () => {
    const drop = (sql) => run(sql, { show, episode, scene, sceneSet }).catch((err) => console.error('cleanup:', err.message));
    await drop('DELETE FROM scene_assets WHERE scene_id = :scene OR scene_set_id = :sceneSet');
    await drop('DELETE FROM episode_wardrobe_defaults WHERE episode_id = :episode');
    await drop('DELETE FROM episode_performance_clips WHERE episode_id = :episode');
    await drop('DELETE FROM thumbnail_compositions WHERE episode_id = :episode');
    await drop("DELETE FROM template_studio WHERE name LIKE 'Shapes template %'");
    await drop('DELETE FROM assets WHERE show_id = :show');
    await drop('DELETE FROM world_events WHERE show_id = :show');
    await drop('DELETE FROM scenes WHERE id = :scene');
    await drop('DELETE FROM scene_sets WHERE id = :sceneSet');
    await drop('DELETE FROM episodes WHERE id = :episode');
    await drop('DELETE FROM shows WHERE id = :show');
  });

  const deep = (value, levels) => (levels ? [deep(value, levels - 1)] : value);
  // Lists that carry the presentation's id somewhere a route does not mean one.
  const CARRYING = {
    'a list inside the list (the shape that deleted one)': () => [[P]],
    'several lists deep': () => deep(P, 4),
    'beside an ordinary id': () => [O, [P]],
    'as an object in the list': () => [{ id: P }],
    'inside an object inside a list': () => [O, { any: [P] }],
    'nested, and spelled another way': () => [[`{${P.replace(/-/g, '').toUpperCase()}}`]],
    'an object where the list should be': () => ({ 0: P }),
    'deeper than the rule looks': () => deep(P, 12),
  };
  // Lists that are simply not lists of ids.
  const MALFORMED = {
    'an ordinary id in a list inside the list': () => [[O]],
    'a number': () => [7],
    'words': () => ['not an id'],
    'null': () => [null],
    'one id, not a list': () => O,
    'an object': () => ({ a: 1 }),
    'an empty list': () => [],
  };

  describe('POST /assets/bulk/delete: a list of ids is a list of id strings', () => {
    const send = (assetIds) => as(request(app).post('/api/v1/assets/bulk/delete')).send({ assetIds });

    it.each(Object.keys(CARRYING))('carrying the presentation, %s: refused, and no row is changed', async (shape) => {
      const before = await everything();
      const res = await send(CARRYING[shape]());
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(await everything()).toEqual(before);
    });

    it.each(Object.keys(MALFORMED))('not a list of ids, %s: refused, and no row is changed', async (shape) => {
      const before = await everything();
      const res = await send(MALFORMED[shape]());
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(await everything()).toEqual(before);
    });
  });

  describe('the other routes that take ids in a body', () => {
    const SHAPES = ['a list inside the list (the shape that deleted one)', 'beside an ordinary id', 'as an object in the list', 'deeper than the rule looks'];
    const ROUTES = [
      ['POST /assets/bulk/change-type', (ids) => request(app).post('/api/v1/assets/bulk/change-type').send({ assetIds: ids, assetType: 'EPISODE_FRAME' })],
      ['POST /assets/bulk/add-labels', (ids) => request(app).post('/api/v1/assets/bulk/add-labels').send({ assetIds: ids, labelIds: [uuid()] })],
      ['POST /assets/bulk/process-background', (ids) => request(app).post('/api/v1/assets/bulk/process-background').send({ assetIds: ids })],
    ];

    it.each(ROUTES)('%s refuses each, and no row is changed', async (_name, send) => {
      const before = await everything();
      for (const shape of SHAPES) {
        const res = await as(send(CARRYING[shape]()));
        expect([res.status, res.body.error]).toEqual([400, 'Validation failed']);
      }
      expect(await everything()).toEqual(before);
    });

    it('one id is one id string: role assignment, reject-overlay and processing refuse a list or an object where an id belongs', async () => {
      const before = await everything();
      const sent = [
        request(app).post('/api/v1/roles/bulk-assign').send({ assignments: [{ assetId: [P], roleKey: 'BG.MAIN' }] }),
        request(app).post('/api/v1/roles/bulk-assign').send({ assignments: [{ assetId: O, roleKey: 'BG.MAIN' }, { assetId: { id: P }, roleKey: 'BG.MAIN' }] }),
        request(app).post('/api/v1/roles/bulk-assign').send({ assignments: [[{ assetId: P, roleKey: 'BG.MAIN' }]] }),
        request(app).post(`/api/v1/world/${show}/events/${event}/reject-overlay`).send({ assetId: [P] }),
        request(app).post(`/api/v1/world/${show}/events/${event}/reject-overlay`).send({ assetId: { id: P } }),
        request(app).post('/api/v1/assets/process').send({ asset_id: [[P]], template_id: uuid() }),
      ];
      for (const pending of sent) {
        const res = await as(pending);
        expect([res.status, res.body.error]).toEqual([400, 'Validation failed']);
      }
      expect(await everything()).toEqual(before);
    });

    it('well-formed requests are refused by the rule as before, and an ordinary id is still taken', async () => {
      const before = await everything();
      const mixed = await as(request(app).post('/api/v1/assets/bulk/delete')).send({ assetIds: [O, P.toUpperCase()] });
      expect([mixed.status, mixed.body.code]).toEqual([409, MANAGED_CODE]);
      expect(await everything()).toEqual(before);
      const retyped = await as(request(app).post('/api/v1/assets/bulk/change-type')).send({ assetIds: [O.replace(/-/g, '')], assetType: 'BRAND_LOGO' });
      expect(retyped.status).toBe(200);
      expect((await q('SELECT asset_type FROM assets WHERE id = :O', { O }))[0].asset_type).toBe('BRAND_LOGO');
    });
  });

  describe('the attachment guards share the rule (PR 3896): an id in a list or an object where one id belongs', () => {
    // PostgreSQL reads a one-item list's text, {id}, as that id: an asset
    // id sent as [id] can be stored as the asset it names.
    it.each([
      ['a scene canvas object', () => request(app).put(`/api/v1/scenes/${scene}/canvas`).send({ canvas_settings: { zoom: 5 }, objects: [{ id: 'client-1', asset_id: [P], object_type: 'image' }] })],
      ['a scene canvas object, nested deeper and beside an ordinary one', () => request(app).put(`/api/v1/scenes/${scene}/canvas`).send({ objects: [{ id: 'client-1', asset_id: O, object_type: 'image' }, { id: 'client-2', asset_id: [[P]], object_type: 'image' }] })],
      ['a scene canvas object, as an object', () => request(app).put(`/api/v1/scenes/${scene}/canvas`).send({ objects: [{ id: 'client-1', asset_id: { id: P }, object_type: 'image' }] })],
      ['a scene set canvas object', () => request(app).put(`/api/v1/scene-sets/${sceneSet}/canvas`).send({ objects: [{ id: 'client-1', asset_id: [P], object_type: 'image' }] })],
      ['a new scene set object', () => request(app).post(`/api/v1/scene-sets/${sceneSet}/objects`).send({ asset_id: [[P]] })],
      ['a wardrobe default', () => request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`).send({ character_name: 'Lala', outfit_asset_id: [[P]] })],
      ['a wardrobe default, as an object', () => request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`).send({ character_name: 'Lala', outfit_asset_id: { id: P } })],
      ['approve-overlay', () => request(app).post(`/api/v1/world/${show}/events/${event}/approve-overlay`).send({ assetId: [[P]] })],
      ["the scene's assets object, deep inside it", () => request(app).put(`/api/v1/scenes/${scene}/assets`).send({ assets: { ui_elements: [{ layers: [[{ asset: P }]] }] } })],
    ])('%s: refused by the rule, and no row is changed', async (_name, send) => {
      const before = await everything();
      const res = await as(send());
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(REFUSAL_CODE);
      expect(await everything()).toEqual(before);
    });

    it('a value nested deeper than the rule looks is not passed as "no asset": the request fails and nothing is written', async () => {
      const before = await everything();
      const canvas = await as(request(app).put(`/api/v1/scenes/${scene}/canvas`)).send({ objects: [{ id: 'client-1', asset_id: deep(P, 12), object_type: 'image' }] });
      expect(canvas.status).toBeGreaterThanOrEqual(400);
      const wardrobe = await as(request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`)).send({ character_name: 'Lala', outfit_asset_id: deep(P, 12) });
      expect(wardrobe.status).toBeGreaterThanOrEqual(400);
      expect(await everything()).toEqual(before);
    });
  });

  describe('the rule itself, against the assets table', () => {
    it('finds the presentation at any depth, in a list or an object, in any spelling', async () => {
      for (const value of [[[P]], deep(P, 7), { a: { b: [O, { c: P }] } }, [O, [[`{${P.toUpperCase()}}`]]]]) {
        expect(await anyDocumentPresentation(value)).toBe(true);
      }
      for (const value of [[[O]], deep(O, 7), { a: { b: [O] } }, [[7, null, 'words']]]) {
        expect(await anyDocumentPresentation(value)).toBe(false);
      }
    });

    it('refuses to answer for a value too deep or too large to look through', async () => {
      await expect(anyDocumentPresentation(deep(P, 12))).rejects.toThrow(UninspectableAssetIdsError);
      await expect(anyDocumentPresentation(Array.from({ length: 6000 }, () => O))).rejects.toThrow(UninspectableAssetIdsError);
    });
  });
});
