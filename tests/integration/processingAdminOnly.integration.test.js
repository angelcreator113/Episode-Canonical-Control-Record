/**
 * Starting image processing is an ADMIN's (Evoni, 2026-11-16), against the
 * test database.
 *
 * Eleven routes that start a background removal or an enhancement (paid
 * calls to remove.bg, Runway or Cloudinary), or undo one, asked for a sign-in
 * only:
 *   assets            remove-background, enhance, reset-processing,
 *                     bulk/process-background, :id/process,
 *                     :id/process-background, process
 *   ui-overlays       :showId/remove-bg/:assetId
 *   episode-poses     the upload, from-lookbook, :poseId/reprocess
 * So a viewer or an editor could spend on them and rewrite a production
 * asset. Each now also asks for an ADMIN, by the existing authorize. The
 * handlers are not changed.
 *
 * No processing is ever paid for here: every outbound call is refused by the
 * test, and the ADMIN cases use addresses the handlers refuse themselves.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('starting image processing is an ADMIN\'s', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const show = crypto.randomUUID();
  const ep = crypto.randomUUID();
  const asset = crypto.randomUUID();
  const tokens = {};
  let ipN = 0;
  let outbound;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const send = (who, [method, path, body]) => {
    ipN += 1;
    const r = request(app)[method](path).set('X-Forwarded-For', `198.51.${160 + Math.floor(ipN / 200)}.${(ipN % 200) + 1}`);
    const signed = tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
    return body ? signed.send(body) : signed;
  };
  // The eleven, on a real asset, show and episode.
  const routes = (id = asset) => [
    ['post', `/api/v1/assets/${id}/remove-background`],
    ['post', `/api/v1/assets/${id}/enhance`],
    ['post', `/api/v1/assets/${id}/reset-processing`],
    ['post', '/api/v1/assets/bulk/process-background', { assetIds: [id] }],
    ['put', `/api/v1/assets/${id}/process`],
    ['post', `/api/v1/assets/${id}/process-background`],
    ['post', '/api/v1/assets/process', { asset_id: id, template_id: crypto.randomUUID(), processing: { removeBackground: true } }],
    ['post', `/api/v1/ui-overlays/${show}/remove-bg/${id}`],
    ['post', `/api/v1/episode-poses/${ep}`, { character_key: 'lala', pose: 'standing' }],
    ['post', `/api/v1/episode-poses/${ep}/from-lookbook`, { image_id: crypto.randomUUID(), character_key: 'lala', pose: 'standing' }],
    ['post', `/api/v1/episode-poses/${ep}/${crypto.randomUUID()}/reprocess`],
  ];
  // The asset's whole row, whatever columns this database has.
  const state = async () => (await run('SELECT row_to_json(a)::text AS row FROM assets a WHERE a.id = :asset', { asset }))[0];
  const poseCount = async () => (await run('SELECT COUNT(*)::int AS n FROM episode_character_poses WHERE episode_id = :ep', { ep }).catch((err) => { console.error('[processingAdminOnly] pose count:', err.message); return [[{ n: 0 }]]; }))[0][0].n;

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@processing.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())', { show, n: `processing-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Processing', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_raw, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:asset, :name, 'UI_OVERLAY', :show, 'https://x/raw.png', 'https://x/a.png', '{"kept":true}'::jsonb, NOW(), NOW())`, { asset, name: `processing-${tag}`, show });
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Every paid call would leave through one of these: none may.
    const refuse = async () => { throw new Error('no outbound call is expected in this test'); };
    outbound = [jest.spyOn(global, 'fetch').mockImplementation(refuse), jest.spyOn(axios, 'post').mockImplementation(refuse),
      jest.spyOn(axios, 'get').mockImplementation(refuse), jest.spyOn(axios, 'request').mockImplementation(refuse)];
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM assets WHERE id = :asset', { asset });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  test('there are eleven, and each names the ADMIN check on its own line', () => {
    expect(routes()).toHaveLength(11);
    const fs = require('fs');
    const path = require('path');
    const src = (file) => fs.readFileSync(path.join(__dirname, '../../src/routes', file), 'utf8');
    const pinned = {
      'imageProcessing.js': ["post('/:id/remove-background'", "post('/:id/enhance'", "post('/:id/reset-processing'"],
      'assets.js': ["post('/bulk/process-background'", "put('/:id/process'", "post('/:id/process-background'", "post('/process'"],
      'uiOverlayRoutes.js': ["post('/:showId/remove-bg/:assetId'"],
      'episodePoseRoutes.js': ["post('/:episodeId'", "post('/:episodeId/from-lookbook'", "post('/:episodeId/:poseId/reprocess'"],
    };
    for (const [file, starts] of Object.entries(pinned)) {
      const lines = src(file).split('\n');
      for (const start of starts) {
        const line = lines.find((l) => l.startsWith(`router.${start},`));
        expect([file, start, !!line && /requireAuth, authorize\(\['ADMIN'\]\)/.test(line)]).toEqual([file, start, true]);
      }
    }
  });

  test('no token: 401 on every one; nothing is asked of a paid service and the asset is not touched', async () => {
    const before = await state();
    for (const route of routes()) expect([route[1], (await send('anon', route)).status]).toEqual([route[1], 401]);
    for (const spy of outbound) expect(spy).not.toHaveBeenCalled();
    expect(await state()).toEqual(before);
  });

  test.each(['viewer', 'editor'])('%s: 403 on every one, however often; nothing is asked of a paid service, no asset is rewritten and no pose is made', async (who) => {
    const before = await state();
    const poses = await poseCount();
    for (let i = 0; i < 2; i += 1) {
      for (const route of routes()) {
        const res = await send(who, route);
        expect([route[1], res.status]).toEqual([route[1], 403]);
        expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
        expect(res.body.data).toBeUndefined();
      }
    }
    // An upload with a photo is refused before the photo is taken.
    const upload = await request(app).post(`/api/v1/episode-poses/${ep}`).set('Authorization', `Bearer ${tokens[who]}`).set('X-Forwarded-For', '198.51.169.9')
      .field('character_key', 'lala').field('pose', 'standing').attach('image', Buffer.from('not a real photo'), { filename: 'pose.png', contentType: 'image/png' });
    expect(upload.status).toBe(403);
    for (const spy of outbound) expect(spy).not.toHaveBeenCalled();
    expect(await state()).toEqual(before);
    expect(await poseCount()).toBe(poses);
  });

  test('an ADMIN is let through to every handler, which answers for itself (never 401 or 403)', async () => {
    // Addresses the handlers refuse themselves (no such asset, pose or photo), so nothing is processed or paid for.
    const before = await state();
    for (const route of routes(crypto.randomUUID())) {
      const res = await send('admin', route[2] && route[1].endsWith('/bulk/process-background') ? [route[0], route[1], { assetIds: [] }] : route);
      expect([route[1], [401, 403].includes(res.status)]).toEqual([route[1], false]);
    }
    expect(await state()).toEqual(before);
  });

  test('an ADMIN\'s own refusals are the handlers\', as before: no asset list 400, no asset named 400, no photo 400', async () => {
    const missing = crypto.randomUUID();
    expect((await send('admin', ['post', '/api/v1/assets/bulk/process-background', { assetIds: [] }])).status).toBe(400);
    expect((await send('admin', ['post', '/api/v1/assets/process', { template_id: missing }])).status).toBe(400);
    expect((await send('admin', ['post', `/api/v1/episode-poses/${ep}`, {}])).status).toBe(400);
  });

  test('what was not changed: the processing status read and the pose list still ask for a sign-in only', async () => {
    for (const who of ['viewer', 'editor']) {
      expect([who, [401, 403].includes((await send(who, ['get', `/api/v1/assets/${asset}/processing-status`])).status)]).toEqual([who, false]);
      expect([who, [401, 403].includes((await send(who, ['get', `/api/v1/episode-poses/${ep}`])).status)]).toEqual([who, false]);
    }
  });
});
