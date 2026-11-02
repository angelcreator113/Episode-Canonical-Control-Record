/**
 * Timeline C1b on Postgres (Timeline Editor redesign Gate 2a, 2026-11-02;
 * design R8.2, R8.5; rulings D3, D4, D5). The migration (guarded, and a down
 * that refuses while anything uses it), and the service's checked kinds:
 * Lala's or a guest's take over the scene (performer_clip), captions and
 * titles, timed visual-mode changes, a beat's default visual mode, and
 * opacity on a layout.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const svc = require('../../src/services/episodeEditService');
const tl = require('../../src/utils/editTimeline');
const c1b = require('../../src/migrations/20261102120000-add-episode-edit-c1b-kinds');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility', 'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];

(shouldSkip ? describe.skip : describe)('Timeline C1b (Postgres)', () => {
  const show = uuid();
  const episodes = [];
  const USER = 'test-c1b-admin';
  let adminToken;
  const flag = process.env.EPISODE_EDIT;

  beforeAll(async () => {
    process.env.EPISODE_EDIT = 'on';
    await c1b.up(sequelize.getQueryInterface(), Sequelize); // the suite runs on the latest schema
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `c1b-${show.slice(0, 8)}` });
    adminToken = TokenService.generateTokenPair({ id: USER, email: 'a@c1b.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });

  afterAll(async () => {
    process.env.EPISODE_EDIT = flag;
    if (episodes.length) {
      const e = { e: episodes };
      for (const table of EDIT_TABLES) await run(`DELETE FROM ${table} WHERE episode_id IN (:e)`, e);
      await run('DELETE FROM episode_raw_clips WHERE episode_id IN (:e)', e);
      await run('DELETE FROM episodes WHERE id IN (:e)', e);
    }
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  const world = async () => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
      VALUES (:ep, :show, 'C1b', :n, 'draft', '', NOW(), NOW())`, { ep, show, n: 9500 + episodes.length });
    const clip = async (performer, seconds) => {
      const id = uuid();
      await run(`INSERT INTO episode_raw_clips (id, episode_id, performer, s3_key_raw, duration_seconds, created_at, updated_at)
        VALUES (:id, :ep, :performer, :key, :seconds, NOW(), NOW())`, { id, ep, performer, key: `k/${id}.mp4`, seconds });
      return id;
    };
    return { ep, lala: await clip('lala', 12), guest: await clip('guest', 8), prime: await clip('justawoman', 30) };
  };
  const rev = async (ep) => (await svc.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const as = async (ep, extra = {}) => ({ episodeId: ep, editRevision: await rev(ep), userId: USER, ...extra });
  const refused = (promise, status, code) => expect(promise).rejects.toMatchObject({ status, ...(code ? { code } : {}) });
  const add = async (w, body) => svc.addItem(sequelize, await as(w.ep, { body: { anchor_kind: 'edit_start', offset_ms: 0, ...body } }));
  const LAYOUT = { x: 200, y: 100, w: 800, h: 900 };

  test('the migration runs twice without change, and its down refuses while a row uses C1b, changing nothing', async () => {
    await c1b.up(sequelize.getQueryInterface(), Sequelize);
    const w = await world();
    await add(w, { kind: 'visual_mode', values: { mode: 'cinematic' } });
    await expect(c1b.down(sequelize.getQueryInterface())).rejects.toThrow(/Refusing to undo C1b/);
    expect((await rows(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'timeline_items' AND column_name = 'duration_ms'`))[0].n).toBe(1);
  });

  test("D3: Lala's take is placed over the scene with her place, opacity and range; its length is its range", async () => {
    const w = await world();
    const r = await add(w, { kind: 'performer_clip', values: { raw_clip_id: w.lala, source_in_ms: 1000, source_out_ms: 7000, layout: { ...LAYOUT, opacity: 0.85 } } });
    expect(r.duration_ms).toBe(6000);
    const { edit, c1b } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    expect(c1b).toBe(true); // GET /edit says so, and the editor offers C1b only then
    const it = edit.items.find((i) => i.id === r.item_id);
    expect(it).toMatchObject({ kind: 'performer_clip', duration_ms: 6000, values: { raw_clip_id: w.lala, source_in_ms: 1000, source_out_ms: 7000, layout: { ...LAYOUT, opacity: 0.85 }, layer: 0 } });
    expect(tl.layersAt(edit, 500).layers.find((l) => l.kind === 'performer')).toMatchObject({ item_id: r.item_id, source_time_ms: 1500, opacity: 0.85 });
  });

  test("D3: a performer clip is Lala's or a guest's take of this episode, measured, inside its range; anything else is refused", async () => {
    const w = await world();
    const other = await world();
    const r0 = await rev(w.ep);
    await refused(add(w, { kind: 'performer_clip', values: { raw_clip_id: w.prime, layout: LAYOUT } }), 409, 'WRONG_PERFORMER');
    await refused(add(w, { kind: 'performer_clip', values: { raw_clip_id: other.lala, layout: LAYOUT } }), 404, 'NOT_FOUND');
    await refused(add(w, { kind: 'performer_clip', values: { raw_clip_id: w.guest, source_out_ms: 9000, layout: LAYOUT } }), 400, 'BAD_RANGE');
    await refused(add(w, { kind: 'performer_clip', values: { raw_clip_id: w.guest } }), 400, 'BAD_LAYOUT');
    await refused(add(w, { kind: 'performer_clip', values: { raw_clip_id: w.guest, layout: LAYOUT, colour: 'red' } }), 400, 'BAD_VALUE');
    await refused(add(w, { kind: 'performer_clip', values: { raw_clip_id: w.guest, layout: { ...LAYOUT, opacity: 2 } } }), 400, 'BAD_LAYOUT');
    expect(await rev(w.ep)).toBe(r0);
  });

  test('D4: captions and titles have their text, style and place, and a length; the text is trimmed', async () => {
    const w = await world();
    const r = await add(w, { kind: 'caption', duration_ms: 3000, values: { text: '  A New Alliance ', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 } } });
    const [row] = await rows('SELECT "values", duration_ms FROM timeline_items WHERE id = :id', { id: r.item_id });
    expect(row).toEqual({ values: { text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 } }, duration_ms: 3000 });
    await refused(add(w, { kind: 'caption', duration_ms: 3000, values: { text: '   ', style_key: 'title', layout: LAYOUT } }), 400, 'BAD_VALUE');
    await refused(add(w, { kind: 'caption', duration_ms: 3000, values: { text: 'x', style_key: 'comic-sans', layout: LAYOUT } }), 400, 'BAD_VALUE');
    await refused(add(w, { kind: 'caption', values: { text: 'x', style_key: 'caption', layout: LAYOUT } }), 400, 'BAD_VALUE');
    await refused(add(w, { kind: 'caption', duration_ms: 3000, values: { text: 'x'.repeat(501), style_key: 'caption', layout: LAYOUT } }), 400, 'BAD_VALUE');
  });

  test('a caption changes field by field and is checked again; its length changes too', async () => {
    const w = await world();
    const r = await add(w, { kind: 'caption', duration_ms: 3000, values: { text: 'Hello', style_key: 'caption', layout: LAYOUT } });
    await svc.updateItem(sequelize, await as(w.ep, { itemId: r.item_id, body: { values: { text: 'Hello, bestie' }, duration_ms: 4500 } }));
    const [row] = await rows('SELECT "values", duration_ms FROM timeline_items WHERE id = :id', { id: r.item_id });
    expect(row).toEqual({ values: { text: 'Hello, bestie', style_key: 'caption', layout: LAYOUT }, duration_ms: 4500 });
    await refused(svc.updateItem(sequelize, await as(w.ep, { itemId: r.item_id, body: { values: { style_key: 'nope' } } })), 400, 'BAD_VALUE');
  });

  test('R8.2: a timed mode change has a mode and no length; a beat has a default visual mode, kept beside its Prime mode and length', async () => {
    const w = await world();
    await refused(add(w, { kind: 'visual_mode', values: { mode: 'noir' } }), 400, 'BAD_VALUE');
    await refused(add(w, { kind: 'visual_mode', duration_ms: 100, values: { mode: 'cinematic' } }), 400, 'BAD_VALUE');
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 3, primeMode: 'gameplay_only' }));
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 3, visualMode: 'cinematic' }));
    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    expect(edit.beatModes[3]).toBe('gameplay_only');
    expect(edit.beatVisualModes).toEqual({ 3: 'cinematic' });
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 3, visualMode: null }));
    expect((await svc.loadEdit(sequelize, { episodeId: w.ep })).edit.beatVisualModes).toBeUndefined();
    await refused(svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 3, visualMode: 'noir' })), 400, 'BAD_MODE');
  });

  test("D5: Prime's layout takes an opacity from 0 to 1; a layout with another key is refused", async () => {
    const w = await world();
    const seg = (await svc.placeSegment(sequelize, await as(w.ep, { body: { raw_clip_id: w.prime, anchor_kind: 'edit_start', offset_ms: 0, layout: { x: 1, y: 2, w: 300, h: 200, opacity: 0.5 } } }))).segment_id;
    expect((await rows('SELECT layout FROM episode_prime_segments WHERE id = :id', { id: seg }))[0].layout).toEqual({ x: 1, y: 2, w: 300, h: 200, opacity: 0.5 });
    await refused(svc.setSegmentLayout(sequelize, await as(w.ep, { segmentId: seg, body: { layout: { x: 1, y: 2, w: 300, h: 200, rotation: 15 } } })), 400, 'BAD_LAYOUT');
  });

  test('overlay, phone_screen and gameplay_action wait for their state model; a performer whose take is removed is a blocking finding', async () => {
    const w = await world();
    for (const kind of ['overlay', 'phone_screen', 'gameplay_action']) await refused(add(w, { kind, values: {} }), 409, 'KIND_NOT_BUILT');
    const r = await add(w, { kind: 'performer_clip', values: { raw_clip_id: w.guest, layout: LAYOUT } });
    await run('UPDATE episode_raw_clips SET deleted_at = NOW() WHERE id = :id', { id: w.guest });
    const { findings } = await svc.reviewReadiness(sequelize, { episodeId: w.ep });
    expect(findings).toContainEqual({ code: 'performer_source_missing', severity: 'blocking', ref: r.item_id });
  });

  test('a version saved with C1b items restores them; the routes take the new kinds and the visual mode', async () => {
    const w = await world();
    const r = await add(w, { kind: 'caption', duration_ms: 2000, values: { text: 'Keep me', style_key: 'lower_third', layout: LAYOUT } });
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 1, visualMode: 'cinematic' }));
    const v = await svc.createVersion(sequelize, await as(w.ep, { name: 'with C1b' }));
    await svc.removeRow(sequelize, await as(w.ep, { what: 'item', id: r.item_id }));
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 1, visualMode: 'gameplay' }));
    await svc.restoreVersion(sequelize, await as(w.ep, { versionId: v.version_id }));
    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    expect(edit.items.find((i) => i.id === r.item_id)).toMatchObject({ duration_ms: 2000, values: { text: 'Keep me' } });
    expect(edit.beatVisualModes).toEqual({ 1: 'cinematic' });

    const url = `/api/v1/episodes/${w.ep}/edit`;
    const res = await request(app).post(`${url}/beats/2/mode`).set('Authorization', `Bearer ${adminToken}`).send({ edit_revision: await rev(w.ep), visual_mode: 'cinematic' });
    expect(res.status).toBe(200);
    const item = await request(app).post(`${url}/items`).set('Authorization', `Bearer ${adminToken}`)
      .send({ edit_revision: res.body.data.edit_revision, kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 0, values: { raw_clip_id: w.lala, layout: LAYOUT } });
    expect(item.status).toBe(200);
    expect(item.body.data.duration_ms).toBe(12000);
  });
});
