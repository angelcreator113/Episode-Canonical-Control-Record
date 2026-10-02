/**
 * The Timeline's save updates scene rows in place (Evoni's answer L12a,
 * 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh): "the Timeline's save
 * updates rows in place instead of deleting and recreating them").
 * POST /api/v1/episodes/:id/save used to hard-delete every scene of the
 * episode and create them again, so scene ids changed on every autosave
 * and the delete cascaded to the scenes' Scene Studio assets. Now:
 * - a scene sent with its id is updated, keeping its id and its assets;
 * - a scene with no known id is created, and the response maps the
 *   editor's id to the new one;
 * - a scene no longer sent is soft-deleted (deleted_at), and the episode's
 *   scene readers (export, cue generators, production package, phone
 *   context) read live scenes only.
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
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Timeline save updates scenes in place (§8(hh) L12a)', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const save = (ep, scenes) => auth(request(app).post(`/api/v1/episodes/${ep}/save`)).send({ scenes });

  async function episodeWithScenes() {
    const ep = uuid(); const a = uuid(); const b = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Timeline ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 400 });
    for (const [id, n, title] of [[a, 1, 'Arrival'], [b, 2, 'Reveal']]) {
      await run(`INSERT INTO scenes (id, episode_id, scene_number, title, duration_seconds, characters, ui_elements, dialogue_clips, created_at, updated_at)
                 VALUES (:id, :ep, :n, :title, 5, '[]', '[]', CAST(:clips AS jsonb), NOW(), NOW())`,
      { id, ep, n, title, clips: JSON.stringify(n === 1 ? [{ id: 'clip-1' }] : []) });
    }
    return { ep, a, b };
  }
  const live = (ep) => rows(`SELECT id, scene_number, title, duration_seconds, dialogue_clips FROM scenes
                              WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number`, { ep });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-timeline', email: 'user@timeline.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Timeline ${show.slice(0, 8)}`, slug: `timeline-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('a scene sent with its id keeps its id, takes the new values and keeps what was not sent', async () => {
    const { ep, a, b } = await episodeWithScenes();
    const res = await save(ep, [
      { id: a, scene_number: 1, title: 'Arrival, longer', duration_seconds: 7.5, characters: [{ id: 'lala' }], ui_elements: [] },
      { id: b, scene_number: 2, title: 'Reveal', duration_seconds: 5, characters: [], ui_elements: [] },
    ]);
    expect(res.status).toBe(200);
    const scenes = await live(ep);
    expect(scenes.map((s) => s.id)).toEqual([a, b]);
    expect(scenes[0]).toMatchObject({ title: 'Arrival, longer' });
    expect(Number(scenes[0].duration_seconds)).toBeCloseTo(7.5);
    expect(scenes[0].dialogue_clips).toEqual([{ id: 'clip-1' }]);
    expect(res.body.scenes).toEqual([{ client_id: a, id: a }, { client_id: b, id: b }]);
  });

  it("a scene's Scene Studio assets survive a save", async () => {
    const { ep, a, b } = await episodeWithScenes();
    const [asset] = await rows(`SELECT id FROM assets WHERE deleted_at IS NULL LIMIT 1`);
    const assetId = asset?.id || uuid();
    if (!asset) {
      await run(`INSERT INTO assets (id, name, asset_type, created_at, updated_at) VALUES (:assetId, 'Prop', 'PROP', NOW(), NOW())`, { assetId });
    }
    await run(`INSERT INTO scene_assets (id, scene_id, asset_id, created_at, updated_at) VALUES (gen_random_uuid(), :a, :assetId, NOW(), NOW())`, { a, assetId });
    await save(ep, [{ id: a, scene_number: 1, title: 'Arrival' }, { id: b, scene_number: 2, title: 'Reveal' }]);
    expect(await rows('SELECT id FROM scene_assets WHERE scene_id = :a', { a })).toHaveLength(1);
  });

  it("a new scene is created and the response maps the editor's id to it; a scene not sent is soft-deleted", async () => {
    const { ep, a, b } = await episodeWithScenes();
    const res = await save(ep, [
      { id: a, scene_number: 1, title: 'Arrival' },
      { id: 'scene-1717', scene_number: 2, title: 'Cutaway', duration_seconds: 3 },
    ]);
    expect(res.status).toBe(200);
    const scenes = await live(ep);
    expect(scenes.map((s) => s.title)).toEqual(['Arrival', 'Cutaway']);
    expect(scenes[0].id).toBe(a);
    expect(res.body.scenes).toEqual([{ client_id: a, id: a }, { client_id: 'scene-1717', id: scenes[1].id }]);
    const [gone] = await rows('SELECT deleted_at FROM scenes WHERE id = :b', { b });
    expect(gone.deleted_at).not.toBeNull();

    // The next autosave sends the new id: nothing is created twice.
    await save(ep, [{ id: a, scene_number: 1, title: 'Arrival' }, { id: scenes[1].id, scene_number: 2, title: 'Cutaway' }]);
    expect((await live(ep)).map((s) => s.id)).toEqual([a, scenes[1].id]);
  });

  it('a scene the Timeline removed is not exported: export reads live scenes only', async () => {
    const { ep } = await episodeWithScenes();
    await save(ep, []);
    expect(await live(ep)).toHaveLength(0);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await auth(request(app).post(`/api/v1/episodes/${ep}/export`)).send({ platform: 'youtube', quality: '1080p', format: 'mp4' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No scenes found');
  });

  it("another episode's scene id is not taken over; the same id sent twice is created once more", async () => {
    const one = await episodeWithScenes();
    const two = await episodeWithScenes();
    const res = await save(one.ep, [
      { id: one.a, scene_number: 1, title: 'Arrival' },
      { id: one.a, scene_number: 2, title: 'Arrival again' },
      { id: two.a, scene_number: 3, title: 'Borrowed' },
    ]);
    expect(res.status).toBe(200);
    const scenes = await live(one.ep);
    expect(scenes).toHaveLength(3);
    expect(scenes[0].id).toBe(one.a);
    expect(new Set(scenes.map((s) => s.id)).size).toBe(3);
    expect(scenes.map((s) => s.id)).not.toContain(two.a);
    expect((await live(two.ep)).map((s) => s.id)).toEqual([two.a, two.b]);
  });
});
