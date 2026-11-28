/**
 * The pictures the editor may draw (Gate 2b PR 1b; Evoni, 2026-11-28):
 * GET /edit/sources now also answers with `images`, the still pictures the
 * LIVE edit's overlay items name, resolved by the render manifest's own
 * rule (services/overlayImages).
 *
 * What this proves:
 *   1 a placed picture is returned with what the monitor needs to draw it,
 *     the processed URL preferred over the raw one;
 *   2 a picture no catalogue list would offer — a show-level screen an
 *     episode override replaces — is STILL resolved, which is the whole
 *     reason this block exists;
 *   3 a removed picture is absent, exactly as the manifest calls it missing;
 *   4 another show's picture and another episode's picture are refused;
 *   5 an episode with no overlays answers [], never a missing field;
 *   6 the route is an ADMIN's, as every edit read is.
 *
 * Reads only: this suite places items through the edit service and asserts
 * what comes back. Nothing renders and no asset is written.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const svc = require('../../src/services/episodeEditService');
const { existingWork } = require('../../src/services/editSourcesService');
const c1b = require('../../src/migrations/20261102120000-add-episode-edit-c1b-kinds');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility',
  'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];

(shouldSkip ? describe.skip : describe)('The pictures the editor may draw (PR 1b, Postgres)', () => {
  const showA = uuid();
  const showB = uuid();
  const episodes = [];
  const assets = [];
  const USER = 'test-pr1b-admin';
  let adminToken;
  let userToken;
  let flag;

  /** A picture in the asset table, as the overlay tools write one. */
  const image = async ({ show = showA, episode = null, name = 'Title overlay', processed = true, raw = true } = {}) => {
    const id = uuid();
    assets.push(id);
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, show_id, episode_id, s3_key_raw, s3_url_raw,
        s3_url_processed, content_type, width, height, file_size_bytes, created_at, updated_at)
      VALUES (:id, :name, 'UI_OVERLAY', 'title_overlay', :show, :episode, :key, :rawUrl, :proc,
        'image/png', 1920, 1080, 4242, NOW(), NOW())`,
    { id, name, show, episode, key: `overlays/${id}.png`,
      rawUrl: raw ? `https://example.invalid/${id}-raw.png` : null,
      proc: processed ? `https://example.invalid/${id}-processed.png` : null });
    return id;
  };

  const world = async (show = showA) => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
      VALUES (:ep, :show, 'Overlay sources', :n, 'draft', '', NOW(), NOW())`, { ep, show, n: 9800 + episodes.length });
    return { ep, show };
  };

  const rev = async (ep) => (await svc.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const place = async (ep, assetId) => svc.addItem(sequelize, {
    episodeId: ep, editRevision: await rev(ep), userId: USER,
    body: { kind: 'overlay', anchor_kind: 'edit_start', offset_ms: 0, duration_ms: 2000, values: { asset_id: assetId } },
  });
  const imagesOf = async (ep) => (await existingWork(sequelize, { episodeId: ep })).images;

  beforeAll(async () => {
    flag = process.env.EPISODE_EDIT;
    process.env.EPISODE_EDIT = 'on';
    await c1b.up(sequelize.getQueryInterface(), Sequelize);
    adminToken = TokenService.generateTokenPair({ id: 'test-pr1b-admin', email: 'a@pr1b.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-pr1b-user', email: 'u@pr1b.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    for (const [id, n] of [[showA, 'pr1b-a'], [showB, 'pr1b-b']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id, n: `${n}-${id.slice(0, 8)}` });
    }
  });

  afterAll(async () => {
    process.env.EPISODE_EDIT = flag;
    if (episodes.length) {
      const e = { e: episodes };
      for (const table of EDIT_TABLES) await run(`DELETE FROM ${table} WHERE episode_id IN (:e)`, e);
      await run('DELETE FROM episodes WHERE id IN (:e)', e);
    }
    if (assets.length) await run('DELETE FROM assets WHERE id IN (:a)', { a: assets });
    await run('DELETE FROM shows WHERE id IN (:s)', { s: [showA, showB] });
    await sequelize.close();
  });

  // ── 1 · what the monitor needs, and the URL precedence ──────────────────
  test('a placed picture comes back with its URL, size and name; processed beats raw', async () => {
    const w = await world();
    const a = await image({ episode: w.ep, name: 'Episode title' });
    await place(w.ep, a);
    const images = await imagesOf(w.ep);
    expect(images).toEqual([{ id: a, url: `https://example.invalid/${a}-processed.png`, width: 1920, height: 1080, name: 'Episode title' }]);

    // With no processed file, the raw one is what the monitor draws — the
    // same precedence the manifest's assetBook.image uses.
    const w2 = await world();
    const b = await image({ episode: w2.ep, processed: false });
    await place(w2.ep, b);
    expect((await imagesOf(w2.ep))[0].url).toBe(`https://example.invalid/${b}-raw.png`);
  });

  // ── 2 · the case the picker cannot answer ───────────────────────────────
  test('a show-level picture an episode override would hide is still resolved', async () => {
    const w = await world();
    // The show's own screen, reusable by every episode (episode_id NULL):
    // this is what the Phone Hub's catalogue drops from its list for an
    // episode that has its own version of the same screen.
    const showScreen = await image({ episode: null, name: 'Messages' });
    // The episode's override of the same screen, same name, its own row.
    const override = await image({ episode: w.ep, name: 'Messages' });
    await place(w.ep, showScreen);

    const images = await imagesOf(w.ep);
    expect(images.map((i) => i.id)).toEqual([showScreen]);
    expect(images[0].name).toBe('Messages');
    // The override is not invented into the answer: only what is placed.
    expect(images.map((i) => i.id)).not.toContain(override);
  });

  // ── 3 · removed ─────────────────────────────────────────────────────────
  test('a picture that is removed is gone from the answer, as the manifest calls it missing', async () => {
    const w = await world();
    const a = await image({ episode: w.ep });
    await place(w.ep, a);
    expect((await imagesOf(w.ep)).map((i) => i.id)).toEqual([a]);
    await run('UPDATE assets SET deleted_at = NOW() WHERE id = :id', { id: a });
    expect(await imagesOf(w.ep)).toEqual([]);
  });

  // ── 4 · ownership ───────────────────────────────────────────────────────
  test("another show's picture and another episode's picture are not returned", async () => {
    const w = await world();
    const mine = await image({ episode: w.ep });
    await place(w.ep, mine);
    const other = await world();
    const otherEpisodePicture = await image({ episode: other.ep });
    const otherShowPicture = await image({ show: showB });
    // The service refuses to place either, so they are written straight in
    // to prove the READ refuses them too, not only the write.
    const itemRow = async (assetId) => run(`INSERT INTO timeline_items (id, episode_id, kind, anchor_kind, offset_ms, "values", duration_ms, created_by, created_at, updated_at)
      VALUES (:id, :ep, 'overlay', 'edit_start', 0, CAST(:v AS jsonb), 2000, :u, NOW(), NOW())`,
    { id: uuid(), ep: w.ep, v: JSON.stringify({ asset_id: assetId, layout: { x: 0, y: 0, w: 1920, h: 1080 }, fit: 'contain', layer: 0 }), u: USER });
    await itemRow(otherEpisodePicture);
    await itemRow(otherShowPicture);

    expect((await imagesOf(w.ep)).map((i) => i.id)).toEqual([mine]);
  });

  // ── 5 · an edit with no pictures ────────────────────────────────────────
  test('an episode with no overlays answers an empty list, and the other fields are untouched', async () => {
    const w = await world();
    const answer = await existingWork(sequelize, { episodeId: w.ep });
    expect(answer.images).toEqual([]);
    expect(Array.isArray(answer.plan)).toBe(true);
    expect(answer.summary).toMatchObject({ plan_rows: expect.any(Number), beats_planned: expect.any(Number) });
  });

  // ── 6 · the route is an ADMIN's ─────────────────────────────────────────
  test('GET /edit/sources carries the images for an ADMIN and refuses anyone else', async () => {
    const w = await world();
    const a = await image({ episode: w.ep });
    await place(w.ep, a);

    const ok = await request(app).get(`/api/v1/episodes/${w.ep}/edit/sources`).set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.images.map((i) => i.id)).toEqual([a]);

    const asUser = await request(app).get(`/api/v1/episodes/${w.ep}/edit/sources`).set('Authorization', `Bearer ${userToken}`);
    expect(asUser.status).toBe(403);
    const anonymous = await request(app).get(`/api/v1/episodes/${w.ep}/edit/sources`);
    expect(anonymous.status).toBe(401);
  });
});
