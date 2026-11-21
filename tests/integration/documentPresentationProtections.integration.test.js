/**
 * A document presentation is kept by its document (V2-2a-1, Evoni
 * 2026-11-20), on the paths outside the asset API: the phone's overlay
 * routes, reject-overlay, role assignment, removing an asset from an
 * episode, Start Episode's linking, an upload of the same file, global
 * search and the Thumbnail Studio's pictures. Against real Postgres.
 * (The asset API itself: documentPresentationAssetApi.integration.test.js.)
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const {
  DOCUMENT_PRESENTATION, MANAGED_CODE, MANAGED_MESSAGE, NOT_DOCUMENT_PRESENTATION_SQL, exceptDocumentPresentations,
} = require('../../src/utils/documentPresentationAssets');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the other ways to an asset, and a document presentation', () => {
  const show = uuid();
  const episode = uuid();
  const event = uuid();
  const presentation = uuid();
  const overlay = uuid();
  const eventAsset = uuid();
  const tokens = {};
  const as = (who, req) => req.set('Authorization', `Bearer ${tokens[who]}`);
  const MANAGED = { success: false, error: MANAGED_MESSAGE, code: MANAGED_CODE };
  const SPELLINGS = {
    'upper case': (id) => id.toUpperCase(),
    'no hyphens': (id) => id.replace(/-/g, ''),
    'in braces': (id) => `{${id}}`,
    'groups of four': (id) => id.replace(/-/g, '').match(/.{4}/g).join('-'),
  };
  const TAG = show.slice(0, 8);
  const HASH = crypto.createHash('sha256').update(Buffer.from(`same file ${TAG}`)).digest('hex');
  const rowOf = async (id) => (await q('SELECT * FROM assets WHERE id = :id', { id }))[0];
  const insertAsset = (id, type, name, { role = 'CHAR.HOST.LALA', metadata = {}, hash = null } = {}) => run(
    `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, category, show_id, approval_status, s3_url_raw, s3_url_processed, file_hash, metadata, created_at, updated_at)
     VALUES (:id, :name, :type, :role, 'EPISODE', 'SHOW', 'overlay', :show, 'approved', :url, :url, :hash, CAST(:metadata AS jsonb), NOW(), NOW())`,
    { id, name, type, show, role, hash, url: `https://x.s3.amazonaws.com/${id}.png`, metadata: JSON.stringify(metadata) });

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@guards.dev`, name: id, groups, role }).accessToken;
    tokens.admin = token('test-admin-presentation-2', ['USER', 'ADMIN'], 'ADMIN');
    tokens.editor = token('test-editor-presentation-2', ['USER', 'EDITOR'], 'USER');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show, name: `Guards ${TAG}`, slug: `guards-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:episode, :show, 'Guards', 1, 'draft', NOW(), NOW())`, { episode, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Guards gala', 'invite', 'ready', 5, '{}'::jsonb, NOW(), NOW())`, { event, show });
    // The worst case for the indirect paths: it names its event at the top
    // of its metadata (which Start Episode matches on), carries a file hash
    // (which an upload matches on) and has "overlay" in its name and role.
    await insertAsset(presentation, DOCUMENT_PRESENTATION, `Guards overlay presentation ${TAG}`, {
      role: 'UI.OVERLAY.PRESENTATION', hash: HASH, metadata: { event_id: event, overlay_type: 'wardrobe', document_presentation: { presentation: 'reading' } },
    });
    await insertAsset(overlay, 'UI_OVERLAY', `Guards overlay ${TAG}`, { role: 'UI.OVERLAY.WARDROBE_LIST', metadata: { overlay_type: 'wardrobe' } });
    await insertAsset(eventAsset, 'EPISODE_FRAME', `Guards event picture ${TAG}`, { metadata: { event_id: event } });
  });

  afterAll(async () => {
    const drop = (sql) => run(sql, { show }).catch((err) => console.error('cleanup:', err.message));
    await drop('DELETE FROM assets WHERE show_id = :show');
    for (const t of ['scene_plans', 'episode_briefs', 'feed_posts', 'financial_transactions', 'character_state_history', 'character_state']) {
      await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
    }
    await drop('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show');
    await drop('DELETE FROM episodes WHERE show_id = :show');
    await drop('DELETE FROM world_events WHERE show_id = :show');
    await drop('DELETE FROM shows WHERE id = :show');
  });

  const ROUTES = [
    ['PUT /ui-overlays/:showId/category/:assetId', 'editor', (id) => request(app).put(`/api/v1/ui-overlays/${show}/category/${id}`).send({ category: 'phone', name: 'Renamed' })],
    ['PUT /ui-overlays/:showId/image-fit/:assetId', 'editor', (id) => request(app).put(`/api/v1/ui-overlays/${show}/image-fit/${id}`).send({ image_fit: { mode: 'cover' } })],
    ['PUT /ui-overlays/:showId/screen-links/:assetId', 'editor', (id) => request(app).put(`/api/v1/ui-overlays/${show}/screen-links/${id}`).send({ screen_links: [] })],
    ['POST /ui-overlays/:showId/screen-links/:assetId/icon', 'editor', (id) => request(app).post(`/api/v1/ui-overlays/${show}/screen-links/${id}/icon`).send({ link_id: 'a' })],
    ['PUT /ui-overlays/:showId/content-zones/:assetId', 'editor', (id) => request(app).put(`/api/v1/ui-overlays/${show}/content-zones/${id}`).send({ content_zones: [] })],
    ['DELETE /ui-overlays/:showId/asset/:assetId', 'editor', (id) => request(app).delete(`/api/v1/ui-overlays/${show}/asset/${id}`)],
    ['POST …/reject-overlay', 'editor', (id) => request(app).post(`/api/v1/world/${show}/events/${event}/reject-overlay`).send({ assetId: id })],
    ['POST /roles/bulk-assign', 'admin', (id) => request(app).post('/api/v1/roles/bulk-assign').send({ assignments: [{ assetId: overlay, roleKey: 'BG.MAIN' }, { assetId: id, roleKey: 'BG.MAIN' }] })],
    ['DELETE /episodes/:id/assets/:assetId', 'editor', (id) => request(app).delete(`/api/v1/episodes/${episode}/assets/${id}`)],
  ];

  describe('routes that find an asset by its id', () => {
    it.each(ROUTES)('%s refuses a document presentation and leaves every row as it was', async (_name, who, send) => {
      const before = [await rowOf(presentation), await rowOf(overlay)];
      const res = await as(who, send(presentation));
      expect([res.status, res.body]).toEqual([409, MANAGED]);
      expect([await rowOf(presentation), await rowOf(overlay)]).toEqual(before);
    });

    it.each(Object.keys(SPELLINGS))('its id written another way (%s) is refused by each of them the same', async (how) => {
      const before = [await rowOf(presentation), await rowOf(overlay)];
      for (const [, who, send] of ROUTES) {
        const res = await as(who, send(SPELLINGS[how](presentation)));
        expect([res.status, res.body]).toEqual([409, MANAGED]);
      }
      expect([await rowOf(presentation), await rowOf(overlay)]).toEqual(before);
    });
  });

  describe('Start Episode', () => {
    it("links the event's ordinary assets to the new episode and leaves its document presentation unlinked", async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const before = await rowOf(presentation);
      const res = await as('admin', request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });
      expect(res.status).toBe(201);
      const started = res.body.data?.episode?.id || res.body.episode?.id;
      expect((await rowOf(eventAsset)).episode_id).toBe(started);
      expect(await rowOf(presentation)).toEqual(before);
      expect(before.episode_id).toBeNull();
    });
  });

  describe('an upload of the very same file', () => {
    it('does not find a document presentation as the copy to reuse', async () => {
      // The lookup AssetService.uploadAsset makes before it stores anything.
      const reuse = (where) => models.Asset.findOne({ where });
      expect((await reuse({ file_hash: HASH, deleted_at: null })).id).toBe(presentation);
      expect(await reuse(exceptDocumentPresentations({ file_hash: HASH, deleted_at: null }))).toBeNull();
      // An ordinary asset with that hash is still found.
      const twin = uuid();
      await insertAsset(twin, 'EPISODE_FRAME', `Guards twin ${TAG}`, { hash: HASH });
      expect((await reuse(exceptDocumentPresentations({ file_hash: HASH, deleted_at: null }))).id).toBe(twin);
    });

    it('uploadAsset asks with that rule', async () => {
      const AssetService = require('../../src/services/AssetService');
      const findOne = jest.spyOn(models.Asset, 'findOne').mockRejectedValue(new Error('stop here'));
      await expect(AssetService.uploadAsset({ buffer: Buffer.from(`same file ${TAG}`), originalname: 'a.png', mimetype: 'image/png', size: 9 }, 'EPISODE_FRAME', null, {}, 'user')).rejects.toThrow();
      const { where } = findOne.mock.calls[0][0];
      findOne.mockRestore();
      expect(where.file_hash).toBe(HASH);
      expect(await models.Asset.findOne({ where, attributes: ['id', 'asset_type'] })).toMatchObject({ asset_type: 'EPISODE_FRAME' });
    });
  });

  describe('searches and pickers', () => {
    // Global search's own request cannot run on a migrations-built database
    // (it selects assets.s3_key, which only the deployed table may have), so
    // its condition is run here as it is written, and the request itself is
    // checked in tests/unit/routes/documentPresentationMutationInventory.test.js.
    it("global search's condition leaves it out, by its name or by its type; ordinary assets are still found", async () => {
      const found = async (term) => (await q(
        `SELECT id FROM assets WHERE (name ILIKE :term OR asset_type ILIKE :term) AND deleted_at IS NULL AND ${NOT_DOCUMENT_PRESENTATION_SQL} AND show_id = :show`,
        { term: `%${term}%`, show })).map((r) => r.id);
      expect(await found(`presentation ${TAG}`)).toEqual([]);
      expect(await found('DOCUMENT_PRESENTATION')).toEqual([]);
      expect(await found(`Guards overlay ${TAG}`)).toEqual([overlay]);
      // Without the condition it would be found.
      expect((await q('SELECT id FROM assets WHERE name ILIKE :term AND show_id = :show', { term: `%presentation ${TAG}%`, show })).map((r) => r.id)).toEqual([presentation]);
    });

    it('the Thumbnail Studio offers it neither as a cut-out nor as a library picture', async () => {
      const thumbnails = require('../../src/services/youtubeThumbnailService');
      const library = await thumbnails.libraryImages(sequelize, show);
      const urls = library.map((p) => p.url);
      expect(urls).not.toContain(`https://x.s3.amazonaws.com/${presentation}.png`);
      expect(urls).toContain(`https://x.s3.amazonaws.com/${overlay}.png`);
      // The cut-outs are read inside sources(), for an episode of the show.
      const [{ id: anEpisode }] = await q('SELECT id FROM episodes WHERE show_id = :show LIMIT 1', { show });
      const all = JSON.stringify(await thumbnails.sources(sequelize, anEpisode));
      expect(all).not.toContain(presentation);
      expect(all).toContain(overlay);
    });
  });

  describe('ordinary assets, as before', () => {
    it("the phone's own overlay is recategorised, and rejected through reject-overlay", async () => {
      const moved = await as('editor', request(app).put(`/api/v1/ui-overlays/${show}/category/${overlay}`)).send({ category: 'phone' });
      expect(moved.status).toBe(200);
      const rejected = await as('editor', request(app).post(`/api/v1/world/${show}/events/${event}/reject-overlay`)).send({ assetId: overlay });
      expect(rejected.status).toBe(200);
      expect((await rowOf(overlay)).deleted_at).not.toBeNull();
      expect(await rowOf(presentation)).toMatchObject({ asset_type: DOCUMENT_PRESENTATION, deleted_at: null, episode_id: null });
    });
  });
});
