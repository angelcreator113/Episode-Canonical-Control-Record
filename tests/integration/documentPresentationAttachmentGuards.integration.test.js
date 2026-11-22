/**
 * A document presentation is not attached like other assets (Evoni,
 * 2026-11-19), against real Postgres: the rule's own read, and the
 * operations whose tables a migrations-built database has, through the
 * app's routes. A refused request leaves every row as it was; an ordinary
 * asset is still taken. All 21 operations are covered one by one in
 * tests/unit/routes/documentPresentationAttachmentGuards.test.js.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { anyDocumentPresentation, DOCUMENT_PRESENTATION, REFUSAL_CODE, REFUSAL_MESSAGE } = require('../../src/utils/documentPresentationAssets');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('a document presentation is refused where an asset is attached', () => {
  const show = uuid();
  const episode = uuid();
  const scene = uuid();
  const sceneSet = uuid();
  const event = uuid();
  const presentation = uuid();
  const deletedPresentation = uuid();
  const ordinary = uuid();
  const overlay = uuid();
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const REFUSED = { success: false, error: REFUSAL_MESSAGE, code: REFUSAL_CODE };
  // The same id as PostgreSQL also reads it.
  const SPELLINGS = {
    'upper case': (id) => id.toUpperCase(),
    'no hyphens': (id) => id.replace(/-/g, ''),
    'in braces': (id) => `{${id}}`,
    'groups of four': (id) => id.replace(/-/g, '').match(/.{4}/g).join('-'),
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-editor-guards', email: 'guards@test.dev', name: 'guards', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show, name: `Guards ${show.slice(0, 8)}`, slug: `guards-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:episode, :show, 'Guards', 1, 'draft', NOW(), NOW())`, { episode, show });
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, created_at, updated_at) VALUES (:scene, :episode, 1, 'Guards scene', NOW(), NOW())`, { scene, episode });
    await run(`INSERT INTO scene_sets (id, show_id, name, scene_type, created_at, updated_at) VALUES (:sceneSet, :show, 'Guards set', 'HOME_BASE', NOW(), NOW())`, { sceneSet, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Guards event', 'invite', '{}'::jsonb, 'draft', NOW(), NOW())`, { event, show });
    const asset = (id, type, role, deleted = false) => run(
      `INSERT INTO assets (id, name, asset_type, asset_role, asset_scope, show_id, approval_status, s3_url_raw, s3_url_processed, metadata, created_at, updated_at, deleted_at)
       VALUES (:id, :name, :type, :role, 'SHOW', :show, 'approved', 'https://x.s3.amazonaws.com/a.png', 'https://x.s3.amazonaws.com/a.png', '{}'::jsonb, NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`,
      { id, name: `Guards ${type}`, type, role, show });
    await asset(presentation, DOCUMENT_PRESENTATION, 'DOCUMENT.PRESENTATION.OFFER_LETTER');
    await asset(deletedPresentation, DOCUMENT_PRESENTATION, 'DOCUMENT.PRESENTATION.OFFER_LETTER', true);
    await asset(ordinary, 'PROMO_LALA', 'CHAR.HOST.LALA');
    await asset(overlay, 'UI_OVERLAY', 'UI.OVERLAY.WARDROBE_LIST');
  });

  afterAll(async () => {
    const drop = (sql) => run(sql, { show, episode, scene, sceneSet }).catch((err) => console.error('cleanup:', err.message));
    await drop('DELETE FROM scene_object_variants WHERE scene_id = :scene');
    await drop('DELETE FROM scene_assets WHERE scene_id = :scene OR scene_set_id = :sceneSet');
    await drop('DELETE FROM episode_wardrobe_defaults WHERE episode_id = :episode');
    await drop('DELETE FROM episode_performance_clips WHERE episode_id = :episode');
    await drop('DELETE FROM episode_todo_lists WHERE episode_id = :episode');
    await drop('DELETE FROM thumbnail_compositions WHERE episode_id = :episode');
    await drop("DELETE FROM template_studio WHERE name LIKE 'Guards template %'");
    await drop('DELETE FROM assets WHERE show_id = :show');
    await drop('DELETE FROM world_events WHERE show_id = :show');
    await drop('DELETE FROM scenes WHERE id = :scene');
    await drop('DELETE FROM scene_sets WHERE id = :sceneSet');
    await drop('DELETE FROM episodes WHERE id = :episode');
    await drop('DELETE FROM shows WHERE id = :show');
  });

  describe('the rule reads the assets table', () => {
    it('finds a document presentation among ids, alone or with others, live or soft-deleted', async () => {
      expect(await anyDocumentPresentation(presentation)).toBe(true);
      expect(await anyDocumentPresentation([ordinary, overlay, presentation])).toBe(true);
      expect(await anyDocumentPresentation([deletedPresentation])).toBe(true);
      expect(await anyDocumentPresentation(` ${presentation.toUpperCase()} `)).toBe(true);
    });

    it('finds none among ordinary assets, unknown ids, or things that are not ids', async () => {
      expect(await anyDocumentPresentation([ordinary, overlay])).toBe(false);
      expect(await anyDocumentPresentation(uuid())).toBe(false);
      expect(await anyDocumentPresentation(['Words, not an id', null, undefined, 7, ''])).toBe(false);
      expect(await anyDocumentPresentation([])).toBe(false);
    });

    it('PostgreSQL reads each other spelling as the same asset, and so does the rule', async () => {
      for (const spell of Object.values(SPELLINGS)) {
        const [found] = await q('SELECT id FROM assets WHERE id = CAST(:id AS uuid)', { id: spell(presentation) });
        expect(found.id).toBe(presentation);
        expect(await anyDocumentPresentation(spell(presentation))).toBe(true);
        expect(await anyDocumentPresentation([ordinary, spell(presentation)])).toBe(true);
        expect(await anyDocumentPresentation([spell(ordinary), spell(overlay)])).toBe(false);
      }
    });

    it('what PostgreSQL would not read as a uuid is not asked about', async () => {
      const hex = presentation.replace(/-/g, '');
      for (const bad of [hex.slice(1), `${hex}0`, `{${presentation}`, `urn:uuid:${presentation}`]) {
        await expect(q('SELECT CAST(:id AS uuid) AS id', { id: bad })).rejects.toThrow(/invalid input syntax for type uuid/);
        expect(await anyDocumentPresentation(bad)).toBe(false);
      }
    });

    it('reads inside a transaction it is given', async () => {
      await sequelize.transaction(async (transaction) => {
        expect(await anyDocumentPresentation([presentation], { transaction })).toBe(true);
        expect(await anyDocumentPresentation([ordinary], { sequelize, transaction })).toBe(false);
      });
    });
  });

  describe('a scene canvas (one transaction)', () => {
    const sceneRow = async () => (await q('SELECT background_url, canvas_settings FROM scenes WHERE id = :scene', { scene }))[0];
    const objects = () => q('SELECT asset_id FROM scene_assets WHERE scene_id = :scene AND deleted_at IS NULL', { scene });

    it('one presentation among the objects refuses the save: no object, background or setting is written', async () => {
      const before = await sceneRow();
      const res = await as(request(app).put(`/api/v1/scenes/${scene}/canvas`)).send({
        background_url: 'https://x.s3.amazonaws.com/new-background.png',
        canvas_settings: { zoom: 3 },
        objects: [{ id: 'client-1', asset_id: ordinary, object_type: 'image' }, { id: 'client-2', asset_id: presentation, object_type: 'image' }],
      });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(REFUSED);
      expect(await sceneRow()).toEqual(before);
      expect(await objects()).toEqual([]);
    });

    it('ordinary objects are saved as before', async () => {
      const res = await as(request(app).put(`/api/v1/scenes/${scene}/canvas`)).send({
        objects: [{ id: 'client-1', asset_id: ordinary, object_type: 'image' }],
      });
      expect(res.status).toBe(200);
      expect(await objects()).toEqual([{ asset_id: ordinary }]);
    });

    it('a new object, and a variant of one, cannot carry a presentation either', async () => {
      const add = await as(request(app).post(`/api/v1/scenes/${scene}/objects`)).send({ asset_id: presentation });
      expect(add.status).toBe(409);
      expect(add.body).toEqual(REFUSED);
      const [{ id: objectId }] = await q('SELECT id FROM scene_assets WHERE scene_id = :scene AND deleted_at IS NULL', { scene });
      const variant = await as(request(app).post(`/api/v1/scenes/${scene}/objects/${objectId}/variants`)).send({ new_asset_id: presentation, variant_label: 'B' });
      expect(variant.status).toBe(409);
      expect(variant.body).toEqual(REFUSED);
      expect(await q('SELECT id FROM scene_object_variants WHERE scene_id = :scene', { scene })).toEqual([]);
      expect(await objects()).toEqual([{ asset_id: ordinary }]);
    });
  });

  describe('a scene set canvas', () => {
    const objects = () => q('SELECT asset_id FROM scene_assets WHERE scene_set_id = :sceneSet AND deleted_at IS NULL', { sceneSet });
    const settings = async () => (await q('SELECT canvas_settings FROM scene_sets WHERE id = :sceneSet', { sceneSet }))[0];

    // Saving an ordinary object to a scene set is not tried here: a
    // migrations-built database still has scene_assets.scene_id NOT NULL,
    // so it cannot hold a scene set's object at all (the unit file covers it).
    it('refuses a presentation, on the canvas and as a new object, with nothing written', async () => {
      const before = await settings();
      const refused = await as(request(app).put(`/api/v1/scene-sets/${sceneSet}/canvas`)).send({
        canvas_settings: { zoom: 3 }, objects: [{ id: 'client-1', asset_id: presentation, object_type: 'image' }],
      });
      expect(refused.status).toBe(409);
      expect(refused.body).toEqual(REFUSED);
      expect(await settings()).toEqual(before);
      expect(await objects()).toEqual([]);
      const added = await as(request(app).post(`/api/v1/scene-sets/${sceneSet}/objects`)).send({ asset_id: presentation });
      expect(added.status).toBe(409);
      expect(await objects()).toEqual([]);
    });
  });

  describe("the scene's own assets object", () => {
    it('an id anywhere in it that is a presentation refuses the update', async () => {
      const before = (await q('SELECT assets FROM scenes WHERE id = :scene', { scene }))[0];
      const res = await as(request(app).put(`/api/v1/scenes/${scene}/assets`)).send({ assets: { background_id: ordinary, ui_elements: [presentation] } });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(REFUSED);
      expect((await q('SELECT assets FROM scenes WHERE id = :scene', { scene }))[0]).toEqual(before);
    });

    it('ordinary ids are kept as before', async () => {
      const res = await as(request(app).put(`/api/v1/scenes/${scene}/assets`)).send({ assets: { background_id: ordinary } });
      expect(res.status).toBe(200);
      expect((await q('SELECT assets FROM scenes WHERE id = :scene', { scene }))[0].assets).toMatchObject({ background_id: ordinary });
    });
  });

  describe('an episode wardrobe default', () => {
    const rows = () => q('SELECT default_outfit_asset_id FROM episode_wardrobe_defaults WHERE episode_id = :episode', { episode });

    it('a presentation is refused before the row is made; an ordinary outfit is kept', async () => {
      const refused = await as(request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`)).send({ character_name: 'Lala', outfit_asset_id: presentation });
      expect(refused.status).toBe(409);
      expect(refused.body).toEqual(REFUSED);
      expect(await rows()).toEqual([]);
      const kept = await as(request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`)).send({ character_name: 'Lala', outfit_asset_id: ordinary });
      expect(kept.status).toBeLessThan(300);
      expect(await rows()).toEqual([{ default_outfit_asset_id: ordinary }]);
      // And it is not replaced by one afterwards.
      const replaced = await as(request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`)).send({ character_name: 'Lala', outfit_asset_id: presentation });
      expect(replaced.status).toBe(409);
      expect(await rows()).toEqual([{ default_outfit_asset_id: ordinary }]);
    });
  });

  describe('a performance clip', () => {
    const rows = () => q('SELECT asset_id FROM episode_performance_clips WHERE episode_id = :episode AND deleted_at IS NULL', { episode });

    it('a presentation is refused; an ordinary asset is attached, and is not replaced by one', async () => {
      const body = (asset_id) => ({ canonical_beat_number: 3, performer: 'lala', asset_id });
      const refused = await as(request(app).put(`/api/v1/episode-brief/${episode}/performance-clips`)).send(body(` ${presentation} `));
      expect(refused.status).toBe(409);
      expect(refused.body).toEqual(REFUSED);
      expect(await rows()).toEqual([]);
      const attached = await as(request(app).put(`/api/v1/episode-brief/${episode}/performance-clips`)).send(body(ordinary));
      expect(attached.status).toBe(201);
      const replaced = await as(request(app).put(`/api/v1/episode-brief/${episode}/performance-clips`)).send(body(presentation));
      expect(replaced.status).toBe(409);
      expect(await rows()).toEqual([{ asset_id: ordinary }]);
    });
  });

  describe('approve-overlay', () => {
    const assetRow = async (id) => (await q('SELECT approval_status, asset_scope, episode_id, deleted_at FROM assets WHERE id = :id', { id }))[0];
    const eventRow = async () => (await q('SELECT canon_consequences, updated_at FROM world_events WHERE id = :event', { event }))[0];

    it('a presentation is refused before the asset or the event is touched', async () => {
      await run(`UPDATE assets SET approval_status = 'pending' WHERE id = :presentation`, { presentation });
      const before = { asset: await assetRow(presentation), event: await eventRow() };
      const res = await as(request(app).post(`/api/v1/world/${show}/events/${event}/approve-overlay`)).send({ assetId: presentation });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(REFUSED);
      expect({ asset: await assetRow(presentation), event: await eventRow() }).toEqual(before);
    });

    it("one of the workflow's own overlays is approved as before", async () => {
      const res = await as(request(app).post(`/api/v1/world/${show}/events/${event}/approve-overlay`)).send({ assetId: overlay });
      expect(res.status).toBe(200);
      expect((await assetRow(overlay)).approval_status).toBe('approved');
      expect((await eventRow()).canon_consequences.automation.wardrobe_overlay_asset_id).toBe(overlay);
    });
  });

  describe('its id written another way, through the routes', () => {
    it.each(Object.keys(SPELLINGS))('%s: refused wherever it is sent, and every row is as it was', async (how) => {
      const id = SPELLINGS[how](presentation);
      const snapshot = async () => ({
        scene: (await q('SELECT background_url, canvas_settings, assets FROM scenes WHERE id = :scene', { scene }))[0],
        objects: await q('SELECT asset_id FROM scene_assets WHERE scene_id = :scene OR scene_set_id = :sceneSet ORDER BY asset_id', { scene, sceneSet }),
        defaults: await q('SELECT default_outfit_asset_id FROM episode_wardrobe_defaults WHERE episode_id = :episode', { episode }),
        clips: await q('SELECT asset_id FROM episode_performance_clips WHERE episode_id = :episode', { episode }),
        asset: (await q('SELECT approval_status, asset_scope, episode_id, updated_at FROM assets WHERE id = :presentation', { presentation }))[0],
        event: (await q('SELECT canon_consequences, updated_at FROM world_events WHERE id = :event', { event }))[0],
        compositions: await q('SELECT id FROM thumbnail_compositions WHERE episode_id = :episode', { episode }),
      });
      const before = await snapshot();
      const template = uuid();
      await run('INSERT INTO template_studio (id, name, created_at, updated_at) VALUES (:template, :name, NOW(), NOW())', { template, name: `Guards template ${template.slice(0, 8)}` });
      const sent = [
        as(request(app).put(`/api/v1/scenes/${scene}/canvas`)).send({ canvas_settings: { zoom: 9 }, objects: [{ id: 'client-1', asset_id: ordinary, object_type: 'image' }, { id: 'client-2', asset_id: id, object_type: 'image' }] }),
        as(request(app).put(`/api/v1/scene-sets/${sceneSet}/canvas`)).send({ objects: [{ id: 'client-1', asset_id: id, object_type: 'image' }] }),
        as(request(app).post(`/api/v1/scene-sets/${sceneSet}/objects`)).send({ asset_id: id }),
        as(request(app).put(`/api/v1/scenes/${scene}/assets`)).send({ assets: { background_id: ordinary, ui_elements: [id] } }),
        as(request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`)).send({ character_name: 'Lala', outfit_asset_id: id }),
        as(request(app).put(`/api/v1/episode-brief/${episode}/performance-clips`)).send({ canonical_beat_number: 3, performer: 'lala', asset_id: id }),
        as(request(app).post(`/api/v1/world/${show}/events/${event}/approve-overlay`)).send({ assetId: id }),
        as(request(app).post('/api/v1/compositions')).send({ episode_id: episode, template_studio_id: template, selected_formats: ['youtube'], asset_map: { 'CHAR.HOST.LALA': ordinary, 'BG.MAIN': id } }),
      ];
      for (const pending of sent) {
        const res = await pending;
        expect([res.status, res.body]).toEqual([409, REFUSED]);
      }
      expect(await snapshot()).toEqual(before);
    });

    it('an ordinary asset whose id is written another way is still taken (the database reads it)', async () => {
      const res = await as(request(app).post(`/api/v1/episodes/${episode}/wardrobe-defaults`)).send({ character_name: 'Guest', outfit_asset_id: ordinary.replace(/-/g, '').toUpperCase() });
      expect(res.status).toBeLessThan(300);
      expect(await q(`SELECT default_outfit_asset_id FROM episode_wardrobe_defaults WHERE episode_id = :episode AND character_name = 'Guest'`, { episode })).toEqual([{ default_outfit_asset_id: ordinary }]);
    });
  });

  describe('a new composition (no transaction of its own)', () => {
    it('a presentation in any role is refused before the composition is created', async () => {
      const template = uuid();
      await run('INSERT INTO template_studio (id, name, created_at, updated_at) VALUES (:template, :name, NOW(), NOW())', { template, name: `Guards template ${template.slice(0, 8)}` });
      const res = await as(request(app).post('/api/v1/compositions')).send({
        episode_id: episode, template_studio_id: template, selected_formats: ['youtube'],
        asset_map: { 'TEXT.TITLE': 'Words, not an id', 'CHAR.HOST.LALA': ordinary, 'BG.MAIN': presentation },
      });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(REFUSED);
      expect(await q('SELECT id FROM thumbnail_compositions WHERE episode_id = :episode', { episode })).toEqual([]);
    });
  });
});
