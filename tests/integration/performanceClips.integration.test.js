/**
 * The clip home (Evoni, 2026-10-03; agreed with episode creation step 8,
 * docs/EVENT_EPISODE_FLOW.md §8(o) item 2): an episode's JustAWoman and
 * Lala performance clips, one per canonical beat per performer, and
 * production coverage reading them. On the migrated database through the
 * real routes.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clipsMigration = require('../../src/migrations/20261003100000-create-episode-performance-clips');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Performance clips (the clip home, §8(o) item 2)', () => {
  const show = uuid();
  const asset = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (ep) => `/api/v1/episode-brief/${ep}/performance-clips`;

  async function episode() {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Clips ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    return ep;
  }

  beforeAll(async () => {
    await clipsMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-perf-clips', email: 'user@perfclips.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Perf clips ${show.slice(0, 8)}`, slug: `perf-clips-${show.slice(0, 8)}` });
    await run(`INSERT INTO assets (id, name, asset_type, media_type, s3_url_raw, created_at, updated_at)
               VALUES (:asset, 'Headphones take', 'VIDEO', 'video', 'https://cdn.example/headphones.mp4', NOW(), NOW())`, { asset });
  });

  test('the migration is guarded: running it again changes nothing', async () => {
    await clipsMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'episode_performance_clips'");
    expect(n).toBe(3);
  });

  test('attach by asset, list, then attaching again for the same beat and performer replaces it', async () => {
    const ep = await episode();
    const first = await auth(request(app).put(url(ep))).send({ canonical_beat_number: 1, performer: 'justawoman', asset_id: asset, label: 'Headphones on' });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ canonical_beat_number: 1, performer: 'justawoman', asset_id: asset, label: 'Headphones on', status: 'draft' });

    const again = await auth(request(app).put(url(ep))).send({ canonical_beat_number: 1, performer: 'justawoman', video_url: 'https://cdn.example/take2.mp4', status: 'approved' });
    expect(again.status).toBe(200);
    expect(again.body.replaced).toBe(true);
    expect(again.body.data).toMatchObject({ id: first.body.data.id, asset_id: null, video_url: 'https://cdn.example/take2.mp4', status: 'approved' });

    const list = await auth(request(app).get(url(ep)));
    expect(list.body.data).toHaveLength(1);
  });

  test('bad input is refused with a reason and nothing is written', async () => {
    const ep = await episode();
    for (const [body, error] of [
      [{ canonical_beat_number: 15, performer: 'lala', video_url: 'https://x.dev/a.mp4' }, /1 to 14/],
      [{ canonical_beat_number: 6, performer: 'guest', video_url: 'https://x.dev/a.mp4' }, /performer must be one of/],
      [{ canonical_beat_number: 6, performer: 'lala' }, /asset_id or a video_url/],
      [{ canonical_beat_number: 6, performer: 'lala', video_url: 'ftp://x.dev/a.mp4' }, /http/],
      [{ canonical_beat_number: 6, performer: 'lala', asset_id: uuid() }, /Asset not found/],
    ]) {
      const res = await auth(request(app).put(url(ep))).send(body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toMatch(error);
    }
    const missing = await auth(request(app).put(url(uuid()))).send({ canonical_beat_number: 6, performer: 'lala', video_url: 'https://x.dev/a.mp4' });
    expect(missing.status).toBe(404);
    expect(await rows('SELECT id FROM episode_performance_clips WHERE episode_id = :ep', { ep })).toEqual([]);
  });

  test('production coverage counts an attached clip, and removing it counts it missing again', async () => {
    const ep = await episode();
    const attached = await auth(request(app).put(url(ep))).send({ canonical_beat_number: 6, performer: 'lala', video_url: 'https://cdn.example/lala.mp4', label: 'Voice command' });
    const coverage = async () => { const r = await auth(request(app).get(`/api/v1/episode-brief/${ep}/production-coverage`)); return r.body.data; };
    let c = await coverage();
    // Clips are read, so no clip indicator is "not tracked" (the interface one
    // may be, where timeline_placements is absent from the test schema).
    expect(c.beats.every((b) => b.indicators.host.met !== null && b.indicators.character.met !== null)).toBe(true);
    expect(c.beats.find((b) => b.number === 6).indicators.character).toEqual({ requirement: 'required', met: true, text: 'Voice command' });

    const del = await auth(request(app).delete(`${url(ep)}/${attached.body.data.id}`));
    expect(del.status).toBe(200);
    c = await coverage();
    expect(c.beats.find((b) => b.number === 6).indicators.character.met).toBe(false);
    expect((await auth(request(app).delete(`${url(ep)}/${attached.body.data.id}`))).status).toBe(404);
    // Removing leaves a soft-deleted row, so the beat can take a new clip.
    const re = await auth(request(app).put(url(ep))).send({ canonical_beat_number: 6, performer: 'lala', video_url: 'https://cdn.example/lala2.mp4' });
    expect(re.status).toBe(201);
  });
});
