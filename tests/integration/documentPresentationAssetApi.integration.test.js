/**
 * A document presentation is kept by its document (V2-2a-1, Evoni
 * 2026-11-20): the generic asset API cannot edit, delete, relabel, approve,
 * reject, process or label one, cannot make an asset one, and leaves them
 * out of its lists unless one is asked for by its type. Against real
 * Postgres, through the app's routes. Ordinary assets are handled as before.
 * (The other routes that could reach one are in
 * documentPresentationProtections.integration.test.js: the app allows 60
 * writes a minute from one address, and each file is its own app.)
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { DOCUMENT_PRESENTATION, MANAGED_CODE, MANAGED_MESSAGE } = require('../../src/utils/documentPresentationAssets');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the asset API and a document presentation', () => {
  const show = uuid();
  const presentation = uuid();
  const ordinary = uuid();
  const ordinary2 = uuid();
  const tokens = {};
  const as = (who, req) => req.set('Authorization', `Bearer ${tokens[who]}`);
  const MANAGED = { success: false, error: MANAGED_MESSAGE, code: MANAGED_CODE };
  const SPELLINGS = {
    'upper case': (id) => id.toUpperCase(),
    'no hyphens': (id) => id.replace(/-/g, ''),
    'in braces': (id) => `{${id}}`,
    'groups of four': (id) => id.replace(/-/g, '').match(/.{4}/g).join('-'),
  };
  const NAME = `Guards presentation ${show.slice(0, 8)}`;
  // Every column but the clock a harmless read might not touch.
  const rowOf = async (id) => (await q('SELECT * FROM assets WHERE id = :id', { id }))[0];
  const insertAsset = (id, type, name, extra = {}) => run(
    `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, category, show_id, approval_status, s3_url_raw, s3_url_processed, metadata, created_at, updated_at)
     VALUES (:id, :name, :type, :role, 'EPISODE', 'SHOW', 'overlay', :show, :status, :url, :url, CAST(:metadata AS jsonb), NOW(), NOW())`,
    { id, name, type, show, role: extra.role || 'CHAR.HOST.LALA', status: extra.status || 'approved', url: `https://x.s3.amazonaws.com/${id}.png`, metadata: JSON.stringify(extra.metadata || {}) });

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@guards.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token('test-admin-presentation', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-presentation', ['USER', 'EDITOR'], 'USER');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show, name: `Guards ${show.slice(0, 8)}`, slug: `guards-${show.slice(0, 8)}` });
    await insertAsset(presentation, DOCUMENT_PRESENTATION, NAME, { role: 'DOCUMENT.PRESENTATION.OFFER_LETTER', metadata: { document_presentation: { presentation: 'reading', panel_index: 1 } } });
    await insertAsset(ordinary, 'PROMO_LALA', `Guards ordinary ${show.slice(0, 8)}`);
    await insertAsset(ordinary2, 'EPISODE_FRAME', `Guards ordinary two ${show.slice(0, 8)}`);
  });

  afterAll(async () => {
    await run('DELETE FROM assets WHERE show_id = :show', { show }).catch((err) => console.error('cleanup assets:', err.message));
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('cleanup shows:', err.message));
  });

  // [name, who, send(id) -> request]
  const BY_ID = [
    ['PUT /assets/:id', 'editor', (id) => request(app).put(`/api/v1/assets/${id}`).send({ name: 'Renamed', metadata: {} })],
    ['DELETE /assets/:id', 'editor', (id) => request(app).delete(`/api/v1/assets/${id}`)],
    ['PUT /assets/:id/approve', 'admin', (id) => request(app).put(`/api/v1/assets/${id}/approve`).send({})],
    ['PUT /assets/:id/reject', 'admin', (id) => request(app).put(`/api/v1/assets/${id}/reject`).send({ reason: 'no' })],
    ['PUT /assets/:id/process', 'admin', (id) => request(app).put(`/api/v1/assets/${id}/process`).send({})],
    ['POST /assets/:id/process-background', 'admin', (id) => request(app).post(`/api/v1/assets/${id}/process-background`).send({})],
    ['POST /assets/:id/labels', 'editor', (id) => request(app).post(`/api/v1/assets/${id}/labels`).send({ labelIds: [uuid()] })],
    ['DELETE /assets/:id/labels/:labelId', 'editor', (id) => request(app).delete(`/api/v1/assets/${id}/labels/${uuid()}`)],
    ['POST /assets/:id/remove-background', 'admin', (id) => request(app).post(`/api/v1/assets/${id}/remove-background`).send({})],
    ['POST /assets/:id/enhance', 'admin', (id) => request(app).post(`/api/v1/assets/${id}/enhance`).send({})],
    ['POST /assets/:id/reset-processing', 'admin', (id) => request(app).post(`/api/v1/assets/${id}/reset-processing`).send({})],
    ['POST /assets/process', 'admin', (id) => request(app).post('/api/v1/assets/process').send({ asset_id: id, template_id: uuid() })],
  ];
  const BY_IDS = [
    ['POST /assets/bulk/delete', 'editor', (ids) => request(app).post('/api/v1/assets/bulk/delete').send({ assetIds: ids })],
    ['POST /assets/bulk/change-type', 'editor', (ids) => request(app).post('/api/v1/assets/bulk/change-type').send({ assetIds: ids, assetType: 'EPISODE_FRAME' })],
    ['POST /assets/bulk/add-labels', 'editor', (ids) => request(app).post('/api/v1/assets/bulk/add-labels').send({ assetIds: ids, labelIds: [uuid()] })],
    ['POST /assets/bulk/process-background', 'admin', (ids) => request(app).post('/api/v1/assets/bulk/process-background').send({ assetIds: ids })],
  ];

  describe('one asset, named in the address or the body', () => {
    it.each(BY_ID)('%s refuses a document presentation and leaves its row as it was', async (_name, who, send) => {
      const before = await rowOf(presentation);
      const res = await as(who, send(presentation));
      expect([res.status, res.body]).toEqual([409, MANAGED]);
      expect(await rowOf(presentation)).toEqual(before);
    });

    it('its id written another way does not get past any of them', async () => {
      const before = await rowOf(presentation);
      // The last of these takes the id in its body; the others in the address.
      for (const [, who, send] of [BY_ID[0], BY_ID[1], BY_ID[11]]) {
        for (const spell of Object.values(SPELLINGS)) {
          const res = await as(who, send(spell(presentation)));
          // Refused by the rule, or before it by the address's own check: never done.
          expect([400, 409]).toContain(res.status);
        }
      }
      expect(await rowOf(presentation)).toEqual(before);
    });

    it('someone not signed in is answered as before, by the sign-in check', async () => {
      const res = await request(app).delete(`/api/v1/assets/${presentation}`);
      expect(res.status).toBe(401);
    });
  });

  describe('several assets at once', () => {
    it.each(BY_IDS)('%s: one document presentation among ordinary assets refuses the whole request, and no row changes', async (_name, who, send) => {
      const before = [await rowOf(presentation), await rowOf(ordinary), await rowOf(ordinary2)];
      const res = await as(who, send([ordinary, presentation, ordinary2]));
      expect([res.status, res.body]).toEqual([409, MANAGED]);
      expect([await rowOf(presentation), await rowOf(ordinary), await rowOf(ordinary2)]).toEqual(before);
    });

    it.each(Object.keys(SPELLINGS))('its id written another way (%s) refuses them all the same', async (how) => {
      const before = [await rowOf(presentation), await rowOf(ordinary)];
      for (const [, who, send] of BY_IDS) {
        const res = await as(who, send([ordinary, SPELLINGS[how](presentation)]));
        expect([res.status, res.body]).toEqual([409, MANAGED]);
      }
      expect([await rowOf(presentation), await rowOf(ordinary)]).toEqual(before);
    });
  });

  describe('no asset is made a document presentation here', () => {
    it('changing a type to it is refused, in bulk or singly, however the type is written', async () => {
      const before = [await rowOf(ordinary), await rowOf(ordinary2)];
      const bulk = await as('editor', request(app).post('/api/v1/assets/bulk/change-type')).send({ assetIds: [ordinary, ordinary2], assetType: ' document_presentation ' });
      expect([bulk.status, bulk.body]).toEqual([409, MANAGED]);
      const single = await as('editor', request(app).put(`/api/v1/assets/${ordinary}`)).send({ asset_type: DOCUMENT_PRESENTATION });
      expect([single.status, single.body]).toEqual([409, MANAGED]);
      expect([await rowOf(ordinary), await rowOf(ordinary2)]).toEqual(before);
    });
  });

  describe('lists', () => {
    const listed = (res) => (res.body.data || res.body.assets || []).map((a) => a.id);

    it('the open list leaves it out: plain, by show, by its category, and when searched for by its name or its type', async () => {
      for (const query of [{}, { show_id: show }, { show_id: show, category: 'overlay' }, { show_id: show, search: NAME }, { search: 'DOCUMENT_PRESENTATION' }, { show_id: show, asset_scope: 'SHOW' }, { show_id: show, include_global: 'true' }]) {
        const res = await request(app).get('/api/v1/assets').query({ limit: 500, ...query });
        expect(res.status).toBe(200);
        expect(listed(res)).not.toContain(presentation);
      }
      // The ordinary assets of the show are still listed.
      const res = await request(app).get('/api/v1/assets').query({ show_id: show });
      expect(listed(res).sort()).toEqual([ordinary, ordinary2].sort());
    });

    it('asked for by its type: only someone signed in is given them', async () => {
      const open = await request(app).get('/api/v1/assets').query({ show_id: show, asset_type: DOCUMENT_PRESENTATION });
      expect(open.status).toBe(401);
      for (const type of [DOCUMENT_PRESENTATION, 'document_presentation']) {
        const res = await as('editor', request(app).get('/api/v1/assets')).query({ show_id: show, asset_type: type });
        expect(res.status).toBe(200);
        expect(listed(res)).toEqual([presentation]);
      }
    });

    it('the asset search finds it only when asked for by its type', async () => {
      const found = async (filters) => {
        const res = await as('editor', request(app).post('/api/v1/assets/search')).send({ approvalStatus: 'approved', query: 'Guards', ...filters });
        expect(res.status).toBe(200);
        return res.body.data.map((a) => a.id);
      };
      expect(await found({})).toEqual(expect.arrayContaining([ordinary, ordinary2]));
      expect(await found({})).not.toContain(presentation);
      expect(await found({ assetType: DOCUMENT_PRESENTATION })).toEqual([presentation]);
    });

    it('it can still be read by its id', async () => {
      const res = await request(app).get(`/api/v1/assets/${presentation}`);
      expect(res.status).toBe(200);
    });
  });

  describe('ordinary assets, as before', () => {
    it('are renamed, relabelled in bulk and deleted', async () => {
      const renamed = await as('editor', request(app).put(`/api/v1/assets/${ordinary}`)).send({ name: 'Guards renamed' });
      expect(renamed.status).toBe(200);
      expect((await rowOf(ordinary)).name).toBe('Guards renamed');
      const retyped = await as('editor', request(app).post('/api/v1/assets/bulk/change-type')).send({ assetIds: [ordinary, ordinary2], assetType: 'BRAND_LOGO' });
      expect(retyped.status).toBe(200);
      expect([(await rowOf(ordinary)).asset_type, (await rowOf(ordinary2)).asset_type]).toEqual(['BRAND_LOGO', 'BRAND_LOGO']);
      // An id PostgreSQL reads another way still names the ordinary asset.
      const deleted = await as('editor', request(app).post('/api/v1/assets/bulk/delete')).send({ assetIds: [ordinary2.toUpperCase()] });
      expect(deleted.status).toBe(200);
      expect((await rowOf(ordinary2)).deleted_at).not.toBeNull();
      const one = await as('editor', request(app).delete(`/api/v1/assets/${ordinary}`));
      expect(one.status).toBe(200);
      expect((await rowOf(ordinary)).deleted_at).not.toBeNull();
      // And through all of it the presentation is as it was made.
      expect(await rowOf(presentation)).toMatchObject({ asset_type: DOCUMENT_PRESENTATION, name: NAME, deleted_at: null, approval_status: 'approved' });
    });
  });
});
