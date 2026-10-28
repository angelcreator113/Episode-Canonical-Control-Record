/**
 * Timeline C1 on Postgres (Evoni, 2026-10-28; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 6, R5.6
 * C1-1..C1-10). The nine tables, the service and the routes, with only the
 * URL probe faked (ffprobe on a scene angle's video).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const svc = require('../../src/services/episodeEditService');
const tl = require('../../src/utils/editTimeline');
const migration = require('../../src/migrations/20261028100000-create-episode-edit-tables');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];

// The fake probe: a URL's measured length, or a failure.
const PROBES = new Map();
svc.setMedia({
  async probeUrl(url) {
    if (!PROBES.has(url)) throw new Error(`ffprobe could not open ${url}`);
    return PROBES.get(url);
  },
});

const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility', 'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];
const SCRIPT = [
  '## BEAT: 1 · Opening', 'Lala: "Bestie, come style me."', 'Prime: right',
  '', '## BEAT: 2 · Arrival', 'Guest: "Love the look!"',
].join('\n');

(shouldSkip ? describe.skip : describe)('Timeline C1 (Postgres)', () => {
  const show = uuid();
  const episodes = [];
  const sets = [];
  const USER = 'test-c1-admin';
  let adminToken;
  let userToken;

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `c1-${show.slice(0, 8)}` });
    adminToken = TokenService.generateTokenPair({ id: USER, email: 'a@c1.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    userToken = TokenService.generateTokenPair({ id: 'test-c1-user', email: 'u@c1.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
  });

  afterAll(async () => {
    if (episodes.length) {
      const e = { e: episodes };
      await run('UPDATE episode_prime_segments SET superseded_by = NULL WHERE episode_id IN (:e)', e);
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

  // An episode with a linked scene set (a still and a video angle), an unlinked set's angle, and takes.
  const world = async ({ script = SCRIPT } = {}) => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'C1', :n, 'draft', :script, '[]'::jsonb, NOW(), NOW())`, { ep, show, n: 8000 + episodes.length, script });
    const mkSet = async (linked) => {
      const id = uuid();
      sets.push(id);
      await run(`INSERT INTO scene_sets (id, name, scene_type, created_at, updated_at) VALUES (:id, 'C1 set', 'OTHER', NOW(), NOW())`, { id });
      if (linked) await run('INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, created_at, updated_at) VALUES (:x, :id, :ep, 0, NOW(), NOW())', { x: uuid(), id, ep });
      return id;
    };
    const linkedSet = await mkSet(true);
    const otherSet = await mkSet(false);
    const angle = async (setId, { still = null, video = null, requested = 5 } = {}) => {
      const id = uuid();
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, still_image_url, video_clip_url, video_duration, created_at, updated_at)
        VALUES (:id, :setId, 'WIDE', 'Wide', :still, :video, :requested, NOW(), NOW())`, { id, setId, still, video, requested });
      return id;
    };
    const videoUrl = `https://cdn.example/${uuid()}.mp4`;
    PROBES.set(videoUrl, { hasVideo: true, duration_ms: 7340 });
    const a = {
      still: await angle(linkedSet, { still: 'https://cdn.example/still.png' }),
      video: await angle(linkedSet, { video: videoUrl, requested: 5 }),
      noVideo: await angle(linkedSet, { still: 'https://cdn.example/s2.png' }),
      badProbe: await angle(linkedSet, { video: `https://cdn.example/${uuid()}-broken.mp4` }),
      unlinked: await angle(otherSet, { still: 'https://cdn.example/s3.png' }),
    };
    const clip = async (performer, seconds, episodeId = ep) => {
      const id = uuid();
      await run(`INSERT INTO episode_raw_clips (id, episode_id, performer, s3_key_raw, duration_seconds, created_at, updated_at)
        VALUES (:id, :episodeId, :performer, :key, :seconds, NOW(), NOW())`, { id, episodeId, performer, key: `k/${id}.mp4`, seconds });
      return id;
    };
    const c = { prime: await clip('justawoman', 140), prime2: await clip('justawoman', 60), lala: await clip('lala', 30), unmeasured: await clip('justawoman', null) };
    return { ep, a, c, videoUrl };
  };
  const rev = async (ep) => (await svc.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const as = async (ep, extra = {}) => ({ episodeId: ep, editRevision: await rev(ep), userId: USER, ...extra });
  const expectRefusal = async (promise, status, code) => {
    await expect(promise).rejects.toMatchObject({ status, ...(code ? { code } : {}) });
  };
  // Every beat a still of `ms`, so the clock is simple (beat n starts at (n - 1) * ms).
  const fillBeats = async (w, ms = 10000) => {
    for (const b of tl.BEATS) await svc.placeSceneClip(sequelize, await as(w.ep, { body: { beat_number: b, source_kind: 'angle_still', source_id: w.a.still, duration_ms: ms } }));
  };
  const place = async (w, body) => svc.placeSegment(sequelize, await as(w.ep, { body: { raw_clip_id: w.c.prime, anchor_kind: 'beat_start', anchor_beat: 1, ...body } }));
  const segOp = async (w, fn, segmentId, body = {}) => svc[fn](sequelize, await as(w.ep, { segmentId, body }));

  test('C1-1 migration: down refuses while a table has a row; empty, it drops and up recreates', async () => {
    const w = await world();
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 3, primeMode: 'gameplay_only' }));
    await expect(migration.down(sequelize.getQueryInterface())).rejects.toThrow(/Refusing to drop/);
    expect((await rows('SELECT count(*)::int AS n FROM episode_beat_production WHERE episode_id = :ep', { ep: w.ep }))[0].n).toBe(1);
    // Only this suite writes these tables: empty them, then down and up.
    await run('UPDATE episode_prime_segments SET superseded_by = NULL');
    for (const table of EDIT_TABLES) await run(`DELETE FROM ${table}`);
    await migration.down(sequelize.getQueryInterface());
    for (const table of EDIT_TABLES) expect((await rows('SELECT to_regclass(:t) AS r', { t: table }))[0].r).toBeNull();
    await migration.up(sequelize.getQueryInterface());
    for (const table of EDIT_TABLES) expect((await rows('SELECT to_regclass(:t)::text AS r', { t: table }))[0].r).toBe(table);
  });

  test('C1-2 a stale edit_revision is refused and writes nothing; a success adds one; two writes from one view: one 409', async () => {
    const w = await world();
    expect(await rev(w.ep)).toBe('0');
    const ok = await svc.setBeatMode(sequelize, { episodeId: w.ep, editRevision: '0', userId: USER, beatNumber: 2, primeMode: 'gameplay_only' });
    expect(ok.edit_revision).toBe('1');
    await expectRefusal(svc.setBeatMode(sequelize, { episodeId: w.ep, editRevision: '0', userId: USER, beatNumber: 2, primeMode: 'required' }), 409, 'EDIT_CHANGED');
    await expectRefusal(svc.setBeatMode(sequelize, { episodeId: w.ep, editRevision: undefined, userId: USER, beatNumber: 2, primeMode: 'required' }), 409, 'EDIT_REVISION_REQUIRED');
    expect((await rows('SELECT prime_mode FROM episode_beat_production WHERE episode_id = :ep AND deleted_at IS NULL', { ep: w.ep }))).toEqual([{ prime_mode: 'gameplay_only' }]);
    expect(await rev(w.ep)).toBe('1');
    for (let round = 0; round < 5; round += 1) {
      const r = await rev(w.ep);
      const results = await Promise.allSettled([
        svc.setBeatMode(sequelize, { episodeId: w.ep, editRevision: r, userId: USER, beatNumber: 4, primeMode: 'gameplay_only' }),
        svc.placeSceneClip(sequelize, { episodeId: w.ep, editRevision: r, userId: USER, body: { beat_number: 1, source_kind: 'angle_still', source_id: w.a.still, duration_ms: 1000 + round } }),
      ]);
      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((x) => x.status === 'rejected').reason).toMatchObject({ status: 409, code: 'EDIT_CHANGED', extra: { current_revision: (BigInt(r) + 1n).toString() } });
    }
    // The first write on an episode creates its state: two at once, still one winner.
    const fresh = await world();
    const firsts = await Promise.allSettled([1, 2].map((b) => svc.setBeatMode(sequelize, { episodeId: fresh.ep, editRevision: '0', userId: USER, beatNumber: b, primeMode: 'gameplay_only' })));
    expect(firsts.map((x) => x.status).sort()).toEqual(['fulfilled', 'rejected']);
  });

  test('C1-3 scene clips: links, media and measured durations checked; the sources are never written', async () => {
    const w = await world();
    const angleBefore = await rows('SELECT * FROM scene_angles WHERE id = :id', { id: w.a.video });
    const placeClip = async (body) => svc.placeSceneClip(sequelize, await as(w.ep, { body: { beat_number: 1, ...body } }));
    await expectRefusal(placeClip({ source_kind: 'angle_still', source_id: w.a.unlinked, duration_ms: 1000 }), 409, 'ANGLE_NOT_LINKED');
    await expectRefusal(placeClip({ source_kind: 'angle_video', source_id: w.a.noVideo }), 409, 'NO_VIDEO');
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expectRefusal(placeClip({ source_kind: 'angle_video', source_id: w.a.badProbe }), 422, 'PROBE_FAILED');
    } finally { errors.mockRestore(); }
    // The measured length (7340 ms), not scene_angles.video_duration (5 s requested).
    await expectRefusal(placeClip({ source_kind: 'angle_video', source_id: w.a.video, source_out_ms: 7341 }), 400, 'BAD_RANGE');
    const { scene_clip_id: id, source_duration_ms: dur } = await placeClip({ source_kind: 'angle_video', source_id: w.a.video });
    expect(dur).toBe(7340);
    const [row] = await rows('SELECT source_in_ms, source_out_ms, source_duration_ms, duration_ms FROM episode_scene_clips WHERE id = :id', { id });
    expect(row).toEqual({ source_in_ms: 0, source_out_ms: 7340, source_duration_ms: 7340, duration_ms: 7340 });
    // Trims and an episode-specific duration; nothing past the measured source.
    await svc.updateSceneClip(sequelize, await as(w.ep, { clipId: id, body: { source_in_ms: 500, source_out_ms: 6000, duration_ms: 12000 } }));
    await expectRefusal(svc.updateSceneClip(sequelize, await as(w.ep, { clipId: id, body: { source_out_ms: 8000 } })), 400, 'BAD_RANGE');
    expect(await rows('SELECT * FROM scene_angles WHERE id = :id', { id: w.a.video })).toEqual(angleBefore);
    // A still takes no in/out; a raw clip must be Lala's or a guest's, with a measured length.
    await expectRefusal(placeClip({ source_kind: 'angle_still', source_id: w.a.still, source_in_ms: 0, duration_ms: 1000 }), 400, 'BAD_RANGE');
    await expectRefusal(placeClip({ source_kind: 'raw_clip', source_id: w.c.prime }), 409, 'WRONG_PERFORMER');
    const lala = await placeClip({ source_kind: 'raw_clip', source_id: w.c.lala });
    expect(lala.source_duration_ms).toBe(30000);
    // Database CHECK: a range past the source is refused whatever the caller.
    await expect(run(`INSERT INTO episode_scene_clips (episode_id, beat_number, position, source_kind, source_id, source_in_ms, source_out_ms, source_duration_ms, duration_ms)
      VALUES (:ep, 9, 0, 'angle_video', :src, 0, 9000, 7340, 9000)`, { ep: w.ep, src: w.a.video })).rejects.toThrow(/episode_scene_clips_range/);
  });

  test('C1-3 the probe runs before the edit is locked: another edit is not held up by it', async () => {
    const w = await world();
    const slowUrl = `https://cdn.example/${uuid()}-slow.mp4`;
    const angle = uuid();
    const [{ scene_set_id: setId }] = await rows('SELECT scene_set_id FROM scene_angles WHERE id = :id', { id: w.a.video });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, video_clip_url, created_at, updated_at) VALUES (:angle, :setId, 'SLOW', 'Slow', :slowUrl, NOW(), NOW())`, { angle, setId, slowUrl });
    let release;
    const gate = new Promise((r) => { release = r; });
    svc.setMedia({ probeUrl: async (url) => { if (url === slowUrl) { await gate; return { hasVideo: true, duration_ms: 4000 }; } throw new Error('no'); } });
    try {
      const r0 = await rev(w.ep);
      const placing = svc.placeSceneClip(sequelize, { episodeId: w.ep, editRevision: r0, userId: USER, body: { beat_number: 1, source_kind: 'angle_video', source_id: angle } });
      // While it is being measured, another write with the same revision goes through at once.
      const other = await svc.setBeatMode(sequelize, { episodeId: w.ep, editRevision: r0, userId: USER, beatNumber: 2, primeMode: 'gameplay_only' });
      expect(other.edit_revision).toBe((BigInt(r0) + 1n).toString());
      release();
      await expectRefusal(placing, 409, 'EDIT_CHANGED');
    } finally {
      svc.setMedia({ async probeUrl(url) { if (!PROBES.has(url)) throw new Error(`ffprobe could not open ${url}`); return PROBES.get(url); } });
    }
  });

  test('C1-4 Prime segments: Prime\'s own take of this episode, measured, the commentary inside the video', async () => {
    const w = await world();
    await expectRefusal(place(w, { raw_clip_id: w.c.lala }), 409, 'WRONG_PERFORMER');
    const other = await world();
    await expectRefusal(place(w, { raw_clip_id: other.c.prime }), 404);
    await expectRefusal(place(w, { raw_clip_id: w.c.unmeasured }), 409, 'NO_DURATION');
    await expectRefusal(place(w, { source_out_ms: 140001 }), 400, 'BAD_RANGE');
    await expectRefusal(place(w, { source_in_ms: 1000, source_out_ms: 5000, audio_in_ms: 500 }), 400, 'COMMENTARY_OUTSIDE_VIDEO');
    await expectRefusal(place(w, { anchor_beat: 15 }), 400, 'BAD_BEAT');
    await expectRefusal(place(w, { anchor_kind: 'item_start', anchor_ref: uuid() }), 404);
    const { segment_id: id } = await place(w, { source_in_ms: 1000, source_out_ms: 5000 });
    const [row] = await rows('SELECT audio_in_ms, audio_out_ms FROM episode_prime_segments WHERE id = :id', { id });
    expect(row).toEqual({ audio_in_ms: 1000, audio_out_ms: 5000 });
    // Database CHECK: one clock, whatever the caller.
    await expect(run(`INSERT INTO episode_prime_segments (episode_id, raw_clip_id, source_in_ms, source_out_ms, anchor_kind, anchor_beat, offset_ms, audio_in_ms, audio_out_ms)
      VALUES (:ep, :clip, 1000, 5000, 'beat_start', 1, 0, 900, 4000)`, { ep: w.ep, clip: w.c.prime })).rejects.toThrow(/episode_prime_segments_sync/);
  });

  test('C1-5 sync through the service: move, trim video (commentary clamped), trim commentary, split, gain, mute', async () => {
    const w = await world();
    await fillBeats(w);
    const CLAP = 7000;
    const check = async () => {
      const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
      const p = tl.placedSegments(edit).find((x) => !x.error && x.seg.source_in_ms <= CLAP && CLAP < x.seg.source_out_ms);
      const t = p.start + (CLAP - p.seg.source_in_ms);
      expect(tl.layoutAt(edit, t).pip.source_time_ms).toBe(CLAP);
      const ev = tl.mixPlan(edit).commentary.find((c) => c.timeline_start_ms <= t && t < c.timeline_end_ms);
      if (ev) expect(Math.abs(tl.sourceTimeAt(ev, t) - CLAP)).toBeLessThanOrEqual(1000 / 30);
      return { t, edit };
    };
    const { segment_id: id } = await place(w, { source_in_ms: 5000, source_out_ms: 20000, anchor_beat: 2, offset_ms: 1000 });
    expect((await check()).t).toBe(13000);
    await segOp(w, 'moveSegment', id, { anchor_kind: 'beat_start', anchor_beat: 2, offset_ms: 1500 });
    expect((await check()).t).toBe(13500);
    // The commentary first trimmed to 9-18 s, then the video's head to 6 s: the commentary is not moved.
    await segOp(w, 'trimSegmentAudio', id, { audio_in_ms: 9000, audio_out_ms: 18000 });
    await segOp(w, 'trimSegmentVideo', id, { source_in_ms: 6000 });
    let [row] = await rows('SELECT source_in_ms, audio_in_ms, audio_out_ms, offset_ms FROM episode_prime_segments WHERE id = :id', { id });
    expect(row).toEqual({ source_in_ms: 6000, audio_in_ms: 9000, audio_out_ms: 18000, offset_ms: 2500 });
    expect((await check()).t).toBe(13500);
    // Trimming the video's tail into the commentary clamps it; cutting all of it away is refused.
    await segOp(w, 'trimSegmentVideo', id, { source_out_ms: 16000 });
    [row] = await rows('SELECT audio_out_ms FROM episode_prime_segments WHERE id = :id', { id });
    expect(row.audio_out_ms).toBe(16000);
    await expectRefusal(segOp(w, 'trimSegmentVideo', id, { source_out_ms: 8000 }), 409, 'COMMENTARY_OUTSIDE_TRIM');
    // A second take: trimming the video's head into its commentary clamps the commentary's start, in place.
    const { segment_id: other } = await place(w, { raw_clip_id: w.c.prime2, anchor_beat: 9, source_in_ms: 1000, source_out_ms: 20000, audio_in_ms: 2000, audio_out_ms: 15000 });
    await segOp(w, 'trimSegmentVideo', other, { source_in_ms: 5000, source_out_ms: 12000 });
    expect((await rows('SELECT source_in_ms, source_out_ms, audio_in_ms, audio_out_ms, offset_ms FROM episode_prime_segments WHERE id = :id', { id: other }))[0])
      .toEqual({ source_in_ms: 5000, source_out_ms: 12000, audio_in_ms: 5000, audio_out_ms: 12000, offset_ms: 4000 });
    await svc.removeRow(sequelize, await as(w.ep, { what: 'segment', id: other }));
    await expectRefusal(segOp(w, 'trimSegmentAudio', id, { audio_in_ms: 5000 }), 400, 'COMMENTARY_OUTSIDE_VIDEO');
    await segOp(w, 'setSegmentAudio', id, { audio_gain_db: -4.5, audio_fade_in_ms: 200, audio_fade_out_ms: 300 });
    // Split at 6.8 s: the clap lands in the second half, at the same edit time.
    const split = await segOp(w, 'splitSegment', id, { at_source_ms: 6800 });
    expect(split.segment_ids).toHaveLength(2);
    const { edit: afterSplit } = await check();
    // Both halves are written in one transaction: listed by source time here (they never overlap).
    const halves = afterSplit.segments.slice().sort((x, y) => x.source_in_ms - y.source_in_ms);
    expect(halves.map((s) => [s.source_in_ms, s.source_out_ms])).toEqual([[6000, 6800], [6800, 16000]]);
    // The first half had no commentary in it: it keeps its video range as a muted commentary range.
    expect(halves[0]).toMatchObject({ audio_in_ms: 6000, audio_out_ms: 6800, audio_muted: true });
    expect(halves[1]).toMatchObject({ audio_in_ms: 9000, audio_out_ms: 16000, audio_gain_db: -4.5, audio_fade_in_ms: 0, audio_fade_out_ms: 300 });
    expect((await rows('SELECT superseded_by FROM episode_prime_segments WHERE id = :id', { id }))[0].superseded_by).toBe(split.segment_ids[0]);
    await expectRefusal(segOp(w, 'moveSegment', id, { anchor_kind: 'beat_start', anchor_beat: 1 }), 409, 'SEGMENT_REPLACED');
    // Muting the second half: the picture stays, the commentary goes.
    await segOp(w, 'setSegmentAudio', halves[1].id, { audio_muted: true });
    const { t, edit } = await check();
    expect(tl.layoutAt(edit, t).pip).not.toBeNull();
    expect(tl.mixPlan(edit).commentary).toEqual([]);
  });

  test('C1-6 hiding the PIP: no picture there; the mix plan is the same events', async () => {
    const w = await world();
    await fillBeats(w);
    await place(w, {});
    const before = (await svc.mixPlanOf(sequelize, { episodeId: w.ep })).mix;
    await svc.addVisibilityRule(sequelize, await as(w.ep, { body: { scope: 'beat', beat_number: 3, visible: false } }));
    await svc.addVisibilityRule(sequelize, await as(w.ep, { body: { scope: 'range', anchor_kind: 'beat_start', anchor_beat: 6, offset_ms: 1000, end_anchor_kind: 'beat_start', end_anchor_beat: 7, end_offset_ms: 0, visible: false } }));
    expect((await svc.layoutAtTime(sequelize, { episodeId: w.ep, t: 25000 })).layout.pip).toBeNull();
    expect((await svc.layoutAtTime(sequelize, { episodeId: w.ep, t: 55000 })).layout.pip).toBeNull();
    expect((await svc.layoutAtTime(sequelize, { episodeId: w.ep, t: 50500 })).layout.pip).not.toBeNull();
    expect((await svc.mixPlanOf(sequelize, { episodeId: w.ep })).mix).toEqual(before);
    expect((await svc.reviewReadiness(sequelize, { episodeId: w.ep })).findings.filter((f) => f.code === 'prime_footage_missing')).toEqual([]);
  });

  test('C1-7 coverage in review readiness: a required gap blocks; gameplay-only waives it; hidden but covered does not', async () => {
    const w = await world();
    await fillBeats(w);
    await place(w, { source_out_ms: 35000 });
    let r = await svc.reviewReadiness(sequelize, { episodeId: w.ep });
    expect(r.ready).toBe(false);
    expect(r.findings.filter((f) => f.code === 'prime_footage_missing').map((f) => f.beat)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const b of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: b, primeMode: 'gameplay_only' }));
    await svc.setPipSettings(sequelize, await as(w.ep, { body: { default_visible: false } }));
    r = await svc.reviewReadiness(sequelize, { episodeId: w.ep });
    expect(r.findings.filter((f) => f.code === 'prime_footage_missing')).toEqual([]);
  });

  test('review readiness: missing or changed sources and unapproved lines block; with them fixed it is ready', async () => {
    const w = await world({ script: '## BEAT: 1 · Opening\nPrime: hello' });
    // 14 x 9 s + Lala's 10 s = 136 s, inside Prime's 140 s take: every required beat covered.
    await fillBeats(w, 9000);
    const { scene_clip_id: lalaClip } = await svc.placeSceneClip(sequelize, await as(w.ep, { body: { beat_number: 2, source_kind: 'raw_clip', source_id: w.c.lala, source_out_ms: 10000 } }));
    await place(w, {});
    let r = await svc.reviewReadiness(sequelize, { episodeId: w.ep });
    expect(r).toMatchObject({ ready: true, counts: { blocking: 0 } });
    await run("UPDATE episode_raw_clips SET performer = 'justawoman' WHERE id = :id", { id: w.c.lala });
    await run("UPDATE episode_raw_clips SET performer = 'lala' WHERE id = :id", { id: w.c.prime });
    await run('UPDATE scene_angles SET deleted_at = NOW() WHERE id = :id', { id: w.a.still });
    r = await svc.reviewReadiness(sequelize, { episodeId: w.ep });
    expect(r.ready).toBe(false);
    const found = (code) => r.findings.filter((f) => f.code === code);
    expect(found('source_performer_changed').map((f) => f.ref).sort()).toEqual([lalaClip, r.findings.find((f) => f.code === 'source_performer_changed' && f.ref !== lalaClip).ref].sort());
    expect(found('scene_source_missing')).toHaveLength(14);
    // A spoken line with no approved take blocks too.
    const spoken = await world({ script: '## BEAT: 1 · Opening\nLala: "Hi."' });
    const rs = await svc.reviewReadiness(sequelize, { episodeId: spoken.ep });
    expect(rs.findings.find((f) => f.code === 'line_audio_unapproved')).toMatchObject({ beat: 1, line_index: 0, severity: 'blocking' });
  });

  test('replacing a take: a new segment in the same place; the old one kept, superseded', async () => {
    const w = await world();
    const { segment_id: old } = await place(w, { anchor_beat: 3, offset_ms: 400, layout: { x: 100, y: 100, w: 400, h: 225 } });
    await segOp(w, 'setSegmentAudio', old, { audio_gain_db: -2 });
    const { segment_id: next } = await segOp(w, 'replaceTake', old, { raw_clip_id: w.c.prime2, source_in_ms: 1000, source_out_ms: 30000 });
    const [o] = await rows('SELECT superseded_by, superseded_at FROM episode_prime_segments WHERE id = :old', { old });
    expect(o.superseded_by).toBe(next);
    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    expect(edit.segments).toHaveLength(1);
    expect(edit.segments[0]).toMatchObject({ id: next, raw_clip_id: w.c.prime2, anchor_beat: 3, offset_ms: 400, layout: { x: 100, y: 100, w: 400, h: 225 }, audio_gain_db: -2, audio_in_ms: 1000, audio_out_ms: 30000 });
    await expectRefusal(segOp(w, 'replaceTake', next, { raw_clip_id: w.c.lala }), 409, 'WRONG_PERFORMER');
  });

  test('C1-9 versions: saved, then edited, then restored: the live edit equals the snapshot; the version is unchanged', async () => {
    const w = await world();
    await fillBeats(w, 5000);
    const { segment_id: seg } = await place(w, { source_out_ms: 30000 });
    await svc.addVisibilityRule(sequelize, await as(w.ep, { body: { scope: 'beat', beat_number: 2, visible: false } }));
    await svc.setPipSettings(sequelize, await as(w.ep, { body: { use_cutout: true } }));
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 9, primeMode: 'gameplay_only' }));
    const saved = await svc.createVersion(sequelize, await as(w.ep, { name: 'First cut' }));
    await expectRefusal(svc.createVersion(sequelize, { episodeId: w.ep, editRevision: '0', userId: USER, name: 'stale' }), 409, 'EDIT_CHANGED');
    const versionBefore = await rows('SELECT * FROM edit_versions WHERE id = :id', { id: saved.version_id });

    // Edit: split the segment, remove a clip, add one, change a beat mode and the PIP.
    await segOp(w, 'splitSegment', seg, { at_source_ms: 12000 });
    const { edit: mid } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    await svc.removeRow(sequelize, await as(w.ep, { what: 'scene_clip', id: mid.sceneClips[0].id }));
    await svc.placeSceneClip(sequelize, await as(w.ep, { body: { beat_number: 1, source_kind: 'angle_video', source_id: w.a.video } }));
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 9, primeMode: 'required' }));
    await svc.setPipSettings(sequelize, await as(w.ep, { body: { use_cutout: false, default_visible: false } }));
    const beforeRestore = await rev(w.ep);

    const restored = await svc.restoreVersion(sequelize, await as(w.ep, { versionId: saved.version_id }));
    expect(restored.edit_revision).toBe((BigInt(beforeRestore) + 1n).toString());
    const { rows: live } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    const version = await svc.getVersion(sequelize, { episodeId: w.ep, versionId: saved.version_id });
    expect(svc.stableJson(live)).toBe(svc.stableJson(version.snapshot));
    expect(await rows('SELECT * FROM edit_versions WHERE id = :id', { id: saved.version_id })).toEqual(versionBefore);
    expect(version.snapshot_sha256).toBe(saved.snapshot_sha256);
    // A damaged version is refused, never used.
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await run(`UPDATE edit_versions SET snapshot = jsonb_set(snapshot, '{pip}', '[]'::jsonb) WHERE id = :id`, { id: saved.version_id });
      await expectRefusal(svc.restoreVersion(sequelize, await as(w.ep, { versionId: saved.version_id })), 500, 'VERSION_DAMAGED');
    } finally { errors.mockRestore(); }
  });

  test('C1-10 beat production: beat 15 refused; a change supersedes and keeps its history', async () => {
    const w = await world();
    await expectRefusal(svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 15, primeMode: 'gameplay_only' })), 400, 'BAD_BEAT');
    await expectRefusal(svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 5, primeMode: 'sometimes' })), 400, 'BAD_MODE');
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 5, primeMode: 'gameplay_only', note: 'cutscene' }));
    await svc.setBeatMode(sequelize, await as(w.ep, { beatNumber: 5, primeMode: 'required' }));
    const all = await rows('SELECT prime_mode, deleted_at IS NULL AS current, note FROM episode_beat_production WHERE episode_id = :ep ORDER BY created_at, set_at', { ep: w.ep });
    expect(all).toEqual([{ prime_mode: 'gameplay_only', current: false, note: 'cutscene' }, { prime_mode: 'required', current: true, note: null }]);
    expect((await svc.loadEdit(sequelize, { episodeId: w.ep })).edit.beatModes).toEqual({ 5: 'required' });
  });

  test('items and audio items: kinds and targets checked, anchored by beat or item; removing is a soft delete', async () => {
    const w = await world();
    await fillBeats(w);
    await expectRefusal(svc.addItem(sequelize, await as(w.ep, { body: { kind: 'explosion', anchor_kind: 'beat_start', anchor_beat: 1 } })), 400, 'BAD_KIND');
    await expectRefusal(svc.addItem(sequelize, await as(w.ep, { body: { kind: 'audio_offset', target_id: uuid(), anchor_kind: 'beat_start', anchor_beat: 1 } })), 404);
    const { item_id: first } = await svc.addItem(sequelize, await as(w.ep, { body: { kind: 'transition', anchor_kind: 'beat_start', anchor_beat: 3, offset_ms: 200, values: { type: 'fade' } } }));
    const { item_id: second } = await svc.addItem(sequelize, await as(w.ep, { body: { kind: 'camera_keyframe', anchor_kind: 'item_start', anchor_ref: first, offset_ms: 100 } }));
    await svc.placeSegment(sequelize, await as(w.ep, { body: { raw_clip_id: w.c.prime, anchor_kind: 'item_start', anchor_ref: second, source_out_ms: 1000 } }));
    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    expect(tl.placedSegments(edit)[0]).toMatchObject({ start: 20300 });
    await svc.addAudioItem(sequelize, await as(w.ep, { body: { track: 'sfx', slot: 'door_open', source_out_ms: 900, anchor_kind: 'beat_start', anchor_beat: 2, gain_db: -3 } }));
    expect((await svc.mixPlanOf(sequelize, { episodeId: w.ep })).mix.audio).toEqual([expect.objectContaining({ kind: 'sfx', slot: 'door_open', timeline_start_ms: 10000, timeline_end_ms: 10900 })]);
    await svc.removeRow(sequelize, await as(w.ep, { what: 'item', id: first }));
    expect((await rows('SELECT deleted_at IS NOT NULL AS gone FROM timeline_items WHERE id = :id', { id: first }))[0].gone).toBe(true);
    // The segment anchored through the removed item is now unresolved: a blocking finding, never a guess.
    const r = await svc.reviewReadiness(sequelize, { episodeId: w.ep });
    expect(r.findings.find((f) => f.code === 'anchor_unresolved')).toMatchObject({ severity: 'blocking', reason: 'anchor_missing' });
  });

  test('routes: off unless switched on; writes need ADMIN and edit_revision; reads answer', async () => {
    const w = await world();
    const prev = process.env.EPISODE_EDIT;
    try {
      delete process.env.EPISODE_EDIT;
      const off = await request(app).get(`/api/v1/episodes/${w.ep}/edit`).set('Authorization', `Bearer ${adminToken}`);
      expect(off.status).toBe(404);
      expect(off.body.code).toBe('EPISODE_EDIT_OFF');
      process.env.EPISODE_EDIT = 'on';
      const read = await request(app).get(`/api/v1/episodes/${w.ep}/edit`).set('Authorization', `Bearer ${userToken}`);
      expect(read.status).toBe(200);
      expect(read.body.data.edit_revision).toBe('0');
      const forbidden = await request(app).post(`/api/v1/episodes/${w.ep}/edit/beats/2/mode`).set('Authorization', `Bearer ${userToken}`).send({ edit_revision: '0', prime_mode: 'gameplay_only' });
      expect(forbidden.status).toBe(403);
      const ok = await request(app).post(`/api/v1/episodes/${w.ep}/edit/beats/2/mode`).set('Authorization', `Bearer ${adminToken}`).send({ edit_revision: '0', prime_mode: 'gameplay_only' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.edit_revision).toBe('1');
      const stale = await request(app).post(`/api/v1/episodes/${w.ep}/edit/beats/2/mode`).set('Authorization', `Bearer ${adminToken}`).send({ edit_revision: '0', prime_mode: 'required' });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'EDIT_CHANGED', current_revision: '1' });
      const layout = await request(app).get(`/api/v1/episodes/${w.ep}/edit/layout?t=0`).set('Authorization', `Bearer ${userToken}`);
      expect(layout.status).toBe(200);
      const findings = await request(app).get(`/api/v1/episodes/${w.ep}/edit/findings`).set('Authorization', `Bearer ${userToken}`);
      expect(findings.body.data.findings.filter((f) => f.code === 'scene_missing')).toHaveLength(14);
      // The episode's own routes are unaffected.
      const episode = await request(app).get(`/api/v1/episodes/${w.ep}`).set('Authorization', `Bearer ${adminToken}`);
      expect(episode.status).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.EPISODE_EDIT; else process.env.EPISODE_EDIT = prev;
    }
  });

  test('a soft-deleted episode is not found', async () => {
    const w = await world();
    await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :ep', { ep: w.ep });
    await expectRefusal(svc.loadEdit(sequelize, { episodeId: w.ep }), 404);
    await expectRefusal(svc.setBeatMode(sequelize, { episodeId: w.ep, editRevision: '0', userId: USER, beatNumber: 1, primeMode: 'required' }), 404);
  });
});
