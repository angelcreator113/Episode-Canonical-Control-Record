/**
 * Timeline Editor redesign P4 on Postgres (2026-11-02): the C1 additions the
 * editor needs, with no new table or column. A scene clip split and
 * reordered without moving the clock; music and SFX items, timeline items
 * and PIP visibility rules changed in place; and a batch of steps as one
 * change: one transaction, one revision, all or nothing.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const svc = require('../../src/services/episodeEditService');
const tl = require('../../src/utils/editTimeline');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];

const VIDEO_URL = `https://cdn.example/${crypto.randomUUID()}.mp4`;
svc.setMedia({
  async probeUrl(url) {
    if (url !== VIDEO_URL) throw new Error(`ffprobe could not open ${url}`);
    return { hasVideo: true, duration_ms: 8000 };
  },
});

const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility', 'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];

(shouldSkip ? describe.skip : describe)('Timeline Editor P4 additions (Postgres)', () => {
  const show = uuid();
  const episodes = [];
  const sets = [];
  const USER = 'test-p4-admin';
  let adminToken;
  let userToken;
  const flag = process.env.EPISODE_EDIT;

  beforeAll(async () => {
    process.env.EPISODE_EDIT = 'on';
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `p4-${show.slice(0, 8)}` });
    adminToken = TokenService.generateTokenPair({ id: USER, email: 'a@p4.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-p4-user', email: 'u@p4.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
  });

  afterAll(async () => {
    process.env.EPISODE_EDIT = flag;
    if (episodes.length) {
      const e = { e: episodes };
      for (const table of EDIT_TABLES) await run(`DELETE FROM ${table} WHERE episode_id IN (:e)`, e);
      await run('DELETE FROM episode_raw_clips WHERE episode_id IN (:e)', e);
      await run('DELETE FROM scene_set_episodes WHERE episode_id IN (:e)', e);
    }
    if (sets.length) {
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:s)', { s: sets });
      await run('DELETE FROM scene_sets WHERE id IN (:s)', { s: sets });
    }
    if (episodes.length) await run('DELETE FROM episodes WHERE id IN (:e)', { e: episodes });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  // An episode with a linked scene set (a still and a video angle) and one of Prime's takes.
  const world = async () => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
      VALUES (:ep, :show, 'P4', :n, 'draft', '', NOW(), NOW())`, { ep, show, n: 9000 + episodes.length });
    const setId = uuid();
    sets.push(setId);
    await run(`INSERT INTO scene_sets (id, name, scene_type, created_at, updated_at) VALUES (:id, 'P4 set', 'OTHER', NOW(), NOW())`, { id: setId });
    await run('INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, created_at, updated_at) VALUES (:x, :id, :ep, 0, NOW(), NOW())', { x: uuid(), id: setId, ep });
    const still = uuid();
    const video = uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, still_image_url, created_at, updated_at)
      VALUES (:id, :setId, 'WIDE', 'Wide', 'https://cdn.example/still.png', NOW(), NOW())`, { id: still, setId });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, video_clip_url, created_at, updated_at)
      VALUES (:id, :setId, 'WIN', 'Window', :url, NOW(), NOW())`, { id: video, setId, url: VIDEO_URL });
    const prime = uuid();
    await run(`INSERT INTO episode_raw_clips (id, episode_id, performer, s3_key_raw, duration_seconds, created_at, updated_at)
      VALUES (:id, :ep, 'justawoman', :key, 60, NOW(), NOW())`, { id: prime, ep, key: `k/${prime}.mp4` });
    return { ep, still, video, prime };
  };
  const rev = async (ep) => (await svc.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const as = async (ep, extra = {}) => ({ episodeId: ep, editRevision: await rev(ep), userId: USER, ...extra });
  const clips = async (ep, beat) => rows(`SELECT id, position, source_in_ms, source_out_ms, duration_ms FROM episode_scene_clips
    WHERE episode_id = :ep AND beat_number = :beat AND deleted_at IS NULL ORDER BY position`, { ep, beat });
  const beatSpan = async (ep, beat) => {
    const { edit } = await svc.loadEdit(sequelize, { episodeId: ep });
    const b = tl.beatTimeline(edit).beats[beat - 1];
    return [b.start, b.end];
  };
  const placeStill = async (w, beat, ms) => (await svc.placeSceneClip(sequelize, await as(w.ep, { body: { beat_number: beat, source_kind: 'angle_still', source_id: w.still, duration_ms: ms } }))).scene_clip_id;
  const refused = (promise, status, code) => expect(promise).rejects.toMatchObject({ status, ...(code ? { code } : {}) });

  test('a still splits into two clips whose lengths add up to the old one; the clips after it keep their order; the clock moves nothing', async () => {
    const w = await world();
    const a = await placeStill(w, 1, 10000);
    const b = await placeStill(w, 1, 3000);
    await placeStill(w, 2, 5000);
    const before = [await beatSpan(w.ep, 1), await beatSpan(w.ep, 2)];
    const r = await svc.splitSceneClip(sequelize, await as(w.ep, { clipId: a, body: { at_ms: 4000 } }));
    const now = await clips(w.ep, 1);
    expect(now.map((c) => [c.id, c.position, c.duration_ms])).toEqual([[a, 0, 4000], [r.new_scene_clip_id, 1, 6000], [b, 2, 3000]]);
    expect([await beatSpan(w.ep, 1), await beatSpan(w.ep, 2)]).toEqual(before);
  });

  test("a video splits at its own source time; a split in a held last frame, or at the clip's edge, is refused", async () => {
    const w = await world();
    const v = (await svc.placeSceneClip(sequelize, await as(w.ep, { body: { beat_number: 1, source_kind: 'angle_video', source_id: w.video, source_in_ms: 1000, source_out_ms: 6000, duration_ms: 7000 } }))).scene_clip_id;
    const r = await svc.splitSceneClip(sequelize, await as(w.ep, { clipId: v, body: { at_ms: 2000 } }));
    const now = await clips(w.ep, 1);
    expect(now.map((c) => [c.source_in_ms, c.source_out_ms, c.duration_ms])).toEqual([[1000, 3000, 2000], [3000, 6000, 5000]]);
    // The second part plays 3000–6000 then holds for 2000: no split in the hold.
    await refused(svc.splitSceneClip(sequelize, await as(w.ep, { clipId: r.new_scene_clip_id, body: { at_ms: 4000 } })), 409, 'SPLIT_IN_HOLD');
    await refused(svc.splitSceneClip(sequelize, await as(w.ep, { clipId: v, body: { at_ms: 2000 } })), 400, 'BAD_SPLIT');
  });

  test('a scene clip moves to another place in its beat; the others keep their order and the beat its length', async () => {
    const w = await world();
    const a = await placeStill(w, 3, 1000);
    const b = await placeStill(w, 3, 2000);
    const c = await placeStill(w, 3, 3000);
    const span = await beatSpan(w.ep, 3);
    await svc.reorderSceneClip(sequelize, await as(w.ep, { clipId: c, body: { index: 0 } }));
    expect((await clips(w.ep, 3)).map((x) => [x.id, x.position])).toEqual([[c, 0], [a, 1], [b, 2]]);
    await svc.reorderSceneClip(sequelize, await as(w.ep, { clipId: c, body: { index: 2 } }));
    expect((await clips(w.ep, 3)).map((x) => x.id)).toEqual([a, b, c]);
    expect(await beatSpan(w.ep, 3)).toEqual(span);
    await refused(svc.reorderSceneClip(sequelize, await as(w.ep, { clipId: c, body: { index: 3 } })), 400, 'BAD_VALUE');
  });

  test('a music item is moved, trimmed and re-levelled in place; a bad value changes nothing', async () => {
    const w = await world();
    await placeStill(w, 1, 20000);
    const id = (await svc.addAudioItem(sequelize, await as(w.ep, { body: { track: 'music', asset_ref: 'bed', source_in_ms: 0, source_out_ms: 9000, anchor_kind: 'edit_start', offset_ms: 0 } }))).audio_item_id;
    await svc.updateAudioItem(sequelize, await as(w.ep, { audioItemId: id, body: { anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 1500, source_in_ms: 500, gain_db: -9.5, fade_in_ms: 300, duck_under_dialogue_db: -6 } }));
    const [row] = await rows(`SELECT anchor_kind, anchor_beat, offset_ms, source_in_ms, source_out_ms, gain_db::float8 AS gain_db, fade_in_ms, fade_out_ms,
      duck_under_dialogue_db::float8 AS duck FROM timeline_audio_items WHERE id = :id`, { id });
    expect(row).toEqual({ anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 1500, source_in_ms: 500, source_out_ms: 9000, gain_db: -9.5, fade_in_ms: 300, fade_out_ms: 0, duck: -6 });
    const r0 = await rev(w.ep);
    await refused(svc.updateAudioItem(sequelize, await as(w.ep, { audioItemId: id, body: { fade_in_ms: 2000, fade_out_ms: 2000, source_out_ms: 3000 } })), 400, 'BAD_FADE');
    await refused(svc.updateAudioItem(sequelize, await as(w.ep, { audioItemId: id, body: { gain_db: 20 } })), 400, 'BAD_GAIN');
    expect(await rev(w.ep)).toBe(r0);
  });

  test("a timeline item's values and anchor change in place; it can't anchor to itself", async () => {
    const w = await world();
    await placeStill(w, 1, 10000);
    const id = (await svc.addItem(sequelize, await as(w.ep, { body: { kind: 'transition', anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 0, values: { type: 'cut' } } }))).item_id;
    await svc.updateItem(sequelize, await as(w.ep, { itemId: id, body: { values: { type: 'crossfade', duration_ms: 500 }, anchor_kind: 'edit_start', offset_ms: 2000 } }));
    const [row] = await rows('SELECT anchor_kind, offset_ms, "values" FROM timeline_items WHERE id = :id', { id });
    expect(row).toEqual({ anchor_kind: 'edit_start', offset_ms: 2000, values: { type: 'crossfade', duration_ms: 500 } });
    await refused(svc.updateItem(sequelize, await as(w.ep, { itemId: id, body: { anchor_kind: 'item_start', anchor_ref: id, offset_ms: 0 } })), 400, 'BAD_ANCHOR');
    await refused(svc.updateItem(sequelize, await as(w.ep, { itemId: id, body: {} })), 400, 'NOTHING_TO_CHANGE');
  });

  test("a beat's PIP rule is shown or hidden in place; only a range rule has a start and an end", async () => {
    const w = await world();
    const id = (await svc.addVisibilityRule(sequelize, await as(w.ep, { body: { scope: 'beat', beat_number: 2, visible: false } }))).rule_id;
    await svc.updateVisibility(sequelize, await as(w.ep, { ruleId: id, body: { visible: true } }));
    expect((await rows('SELECT visible FROM episode_pip_visibility WHERE id = :id', { id }))[0].visible).toBe(true);
    await refused(svc.updateVisibility(sequelize, await as(w.ep, { ruleId: id, body: { anchor_kind: 'edit_start', offset_ms: 0 } })), 409, 'NOT_A_RANGE');
  });

  test('a batch is one change: every step in one transaction, one new revision', async () => {
    const w = await world();
    const a = await placeStill(w, 1, 10000);
    const r0 = Number(await rev(w.ep));
    const res = await svc.batchOps(sequelize, await as(w.ep, { steps: [
      { op: 'scene-clip.update', id: a, body: { duration_ms: 8000 } },
      { op: 'segment.place', body: { raw_clip_id: w.prime, anchor_kind: 'edit_start', offset_ms: 0, source_out_ms: 8000 } },
      { op: 'beat.mode', body: { beat: 4, prime_mode: 'gameplay_only' } },
    ] }));
    expect(Number(res.edit_revision)).toBe(r0 + 1);
    expect(res.results).toHaveLength(3);
    expect(res.results[1].segment_id).toBeTruthy();
    expect((await clips(w.ep, 1))[0].duration_ms).toBe(8000);
    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    expect(edit.segments).toHaveLength(1);
    expect(edit.beatModes[4]).toBe('gameplay_only');
  });

  test('a step that is refused rolls back the steps before it, and the answer names that step', async () => {
    const w = await world();
    const a = await placeStill(w, 1, 10000);
    const r0 = await rev(w.ep);
    await expect(svc.batchOps(sequelize, await as(w.ep, { steps: [
      { op: 'scene-clip.update', id: a, body: { duration_ms: 2000 } },
      { op: 'segment.place', body: { raw_clip_id: w.prime, anchor_kind: 'edit_start', offset_ms: 0, source_out_ms: 999999 } },
    ] }))).rejects.toMatchObject({ status: 400, code: 'BAD_RANGE', message: expect.stringMatching(/^Step 2 \(segment\.place\)/), extra: { step: 1 } });
    expect(await rev(w.ep)).toBe(r0);
    expect((await clips(w.ep, 1))[0].duration_ms).toBe(10000);
  });

  test('a batch is refused before any step when it is stale, empty, too long or names a step it cannot hold', async () => {
    const w = await world();
    const a = await placeStill(w, 1, 10000);
    const stale = { episodeId: w.ep, editRevision: '0', userId: USER };
    await refused(svc.batchOps(sequelize, { ...stale, steps: [{ op: 'scene-clip.update', id: a, body: { duration_ms: 1 } }] }), 409, 'EDIT_CHANGED');
    await refused(svc.batchOps(sequelize, await as(w.ep, { steps: [] })), 400, 'NO_STEPS');
    await refused(svc.batchOps(sequelize, await as(w.ep, { steps: Array.from({ length: 51 }, () => ({ op: 'remove', id: a, body: { what: 'scene_clip' } })) })), 400, 'TOO_MANY_STEPS');
    for (const op of ['version.create', 'beats.lock', 'restore']) {
      await refused(svc.batchOps(sequelize, await as(w.ep, { steps: [{ op }] })), 400, 'BAD_STEP');
    }
  });

  test('the routes: admin only, each write sends its revision, and the batch answers with one new revision', async () => {
    const w = await world();
    const a = await placeStill(w, 1, 10000);
    const r0 = await rev(w.ep);
    const url = `/api/v1/episodes/${w.ep}/edit`;
    const asUser = await request(app).post(`${url}/ops`).set('Authorization', `Bearer ${userToken}`).send({ edit_revision: r0, steps: [{ op: 'remove', id: a, body: { what: 'scene_clip' } }] });
    expect(asUser.status).toBe(403);
    const split = await request(app).post(`${url}/scene-clips/${a}/split`).set('Authorization', `Bearer ${adminToken}`).send({ edit_revision: r0, at_ms: 3000 });
    expect(split.status).toBe(200);
    expect(split.body.data).toMatchObject({ scene_clip_id: a, new_scene_clip_id: expect.any(String) });
    const ops = await request(app).post(`${url}/ops`).set('Authorization', `Bearer ${adminToken}`).send({
      edit_revision: split.body.data.edit_revision,
      steps: [{ op: 'scene-clip.reorder', id: a, body: { index: 1 } }, { op: 'scene-clip.update', id: a, body: { duration_ms: 2500 } }],
    });
    expect(ops.status).toBe(200);
    expect(Number(ops.body.data.edit_revision)).toBe(Number(split.body.data.edit_revision) + 1);
    expect((await clips(w.ep, 1)).map((c) => [c.position, c.duration_ms])).toEqual([[0, 7000], [1, 2500]]);
    const patch = await request(app).patch(`${url}/audio-items/${uuid()}`).set('Authorization', `Bearer ${adminToken}`).send({ edit_revision: ops.body.data.edit_revision, gain_db: -3 });
    expect(patch.status).toBe(404);
  });
});
