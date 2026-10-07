/**
 * Show-library overlays in an episode (Evoni, 2026-10-07): a show overlay is
 * used in an episode by placing it on one of the episode's beats; the
 * episode overlays response lists the episode's beats, its event, and the
 * show overlays it places.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Show-library overlays in an episode', () => {
  const shows = [];
  let token;
  let createdPlacementsTable = false;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-library', email: 'u@library.dev', name: 'Library', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    const [{ exists }] = await q(`SELECT to_regclass('public.timeline_placements') IS NOT NULL AS exists`);
    if (!exists) {
      await run(`CREATE TABLE timeline_placements (
        id UUID PRIMARY KEY, episode_id UUID NOT NULL, placement_type TEXT NOT NULL, asset_id UUID,
        wardrobe_item_id UUID, scene_id UUID, attachment_point TEXT, offset_seconds DECIMAL(10,3),
        absolute_timestamp DECIMAL(10,3), track_number INTEGER, duration DECIMAL(10,3), z_index INTEGER,
        properties JSONB DEFAULT '{}'::jsonb, character VARCHAR(100), label VARCHAR(255), visual_role TEXT,
        created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ)`);
      createdPlacementsTable = true;
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM scene_plans WHERE episode_id IN ${eps}`, { show });
      await run(`DELETE FROM timeline_placements WHERE episode_id IN ${eps}`, { show });
      await run('DELETE FROM assets WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    if (createdPlacementsTable) await run('DROP TABLE IF EXISTS timeline_placements');
  });

  async function seed() {
    const ids = { show: uuid(), other: uuid(), ep: uuid(), event: uuid(), title: uuid(), lower: uuid(), theirs: uuid(), own: uuid() };
    shows.push(ids.show, ids.other);
    for (const id of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id, n: `lib-${id.slice(0, 8)}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'used', :ep, 5, NOW(), NOW())`, ids);
    for (const [n, name] of [[1, 'Opening Ritual'], [5, 'Reveal'], [9, 'Exit']]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
                 VALUES (:id, :ep, :n, :name, false, false, :n, false, NOW(), NOW())`, { id: uuid(), ep: ids.ep, n, name });
    }
    const asset = (id, name, showId, episodeId = null) => run(
      `INSERT INTO assets (id, name, asset_type, show_id, episode_id, s3_url_processed, metadata, created_at, updated_at)
       VALUES (:id, :name, 'UI_OVERLAY', :showId, :episodeId, 'https://x/o.png', '{}'::jsonb, NOW(), NOW())`, { id, name, showId, episodeId });
    await asset(ids.title, 'UI Overlay: Show Title', ids.show);
    await asset(ids.lower, 'UI Overlay: Lower Third', ids.show);
    await asset(ids.theirs, 'UI Overlay: Their Title', ids.other);
    await asset(ids.own, 'UI Overlay: Episode Only', ids.show, ids.ep);
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const overlays = async (ids) => (await auth(request(app).get(`/api/v1/episodes/${ids.ep}/overlays`))).body.data;
  const place = (ids, body) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/overlays/library`)).send(body);

  it('the overlays response lists the beats and the event; nothing from the library yet', async () => {
    const ids = await seed();
    const data = await overlays(ids);
    expect(data.beats).toEqual([{ number: 1, name: 'Opening Ritual' }, { number: 5, name: 'Reveal' }, { number: 9, name: 'Exit' }]);
    expect(data.event).toEqual({ id: ids.event, show_id: ids.show, name: 'Velvet Gala' });
    expect(data.library).toEqual([]);
  });

  it('places a show overlay on a beat, moves it to another, and takes it off', async () => {
    const ids = await seed();
    const res = await place(ids, { asset_id: ids.title, beat_number: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ asset_id: ids.title, beat: { number: 1, name: 'Opening Ritual' } });
    expect((await overlays(ids)).library).toEqual([{ asset_id: ids.title, name: 'Show Title', beat: { number: 1, name: 'Opening Ritual' } }]);

    expect((await place(ids, { asset_id: ids.title, beat_number: 9 })).status).toBe(200);
    const rows = await q('SELECT label, properties FROM timeline_placements WHERE episode_id = :ep AND asset_id = :title AND deleted_at IS NULL', ids);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Show Title — Beat 9: Exit');
    expect((await overlays(ids)).library[0].beat).toEqual({ number: 9, name: 'Exit' });

    const off = await auth(request(app).delete(`/api/v1/episodes/${ids.ep}/overlays/library/${ids.title}`));
    expect(off.status).toBe(200);
    expect(off.body.data.removed).toBe(1);
    expect((await overlays(ids)).library).toEqual([]);
  });

  it("refuses another show's overlay, an episode-only overlay, a beat the episode lacks, and no beat", async () => {
    const ids = await seed();
    expect((await place(ids, { asset_id: ids.theirs, beat_number: 1 })).status).toBe(404);
    expect((await place(ids, { asset_id: ids.own, beat_number: 1 })).status).toBe(404);
    const missing = await place(ids, { asset_id: ids.lower, beat_number: 4 });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('BEAT_NOT_FOUND');
    expect((await place(ids, { asset_id: ids.lower })).status).toBe(400);
    expect((await q('SELECT COUNT(*)::int n FROM timeline_placements WHERE episode_id = :ep', ids))[0].n).toBe(0);
  });

  it('needs a signed-in user', async () => {
    const ids = await seed();
    expect((await request(app).post(`/api/v1/episodes/${ids.ep}/overlays/library`).send({ asset_id: ids.title, beat_number: 1 })).status).toBe(401);
  });
});
