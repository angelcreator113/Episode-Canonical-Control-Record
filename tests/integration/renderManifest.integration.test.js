/**
 * The render manifest on Postgres (Evoni, 2026-11-16): a saved edit version
 * read back as one deterministic document, through the service and through
 * GET /api/v1/episodes/:id/edit/versions/:versionId/manifest. The read is
 * only a read: every statement is watched, storage, child processes, the
 * network and the job queues are stubbed and must stay untouched. Each
 * acceptance criterion of the manifest's brief is named in its test (AC n).
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const real = jest.requireActual('@aws-sdk/client-s3');
  const command = (name) => class { constructor(input) { this.input = input; this.name = name; } };
  const out = {};
  for (const k of Object.keys(real)) out[k] = /Command$/.test(k) ? command(k.replace(/Command$/, '')) : real[k];
  out.S3Client = class { send(cmd) { return mockSend(cmd); } };
  return out;
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://bucket.example/signed-link') }));
// Every way to start a process is recorded, then passed on.
const mockChild = jest.fn();
jest.mock('child_process', () => {
  const real = jest.requireActual('child_process');
  const out = { ...real };
  for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) out[k] = (...args) => { mockChild(k, args[0]); return real[k](...args); };
  return out;
});

const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const svc = require('../../src/services/episodeEditService');
const studio = require('../../src/services/voiceStudioService');
const media = require('../../src/services/rawClipMedia');
const footageJobs = require('../../src/services/voiceFootageJobs');
const { manifestOf } = require('../../src/services/renderManifestService');
const tl = require('../../src/utils/editTimeline');
const { Sequelize } = require('sequelize');
// The performer clip and the caption are C1b's (migration 20261102120000). Like the other suites that
// use them, this one runs it again before it starts: another suite may have left the test database without it.
const c1b = require('../../src/migrations/20261102120000-add-episode-edit-c1b-kinds');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];

const VIDEO_URL = `https://cdn.example/${uuid()}.mp4`;
svc.setMedia({ async probeUrl(url) { if (url !== VIDEO_URL) throw new Error(`ffprobe could not open ${url}`); return { hasVideo: true, duration_ms: 7340 }; } });

const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility', 'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];
const SCRIPT = ['## BEAT: 1 · Opening', 'Lala: "Bestie, come style me."', 'Prime: right', '', '## BEAT: 2 · Arrival', 'Lala: "Love the look!"'].join('\n');

(shouldSkip ? describe.skip : describe)('the render manifest (Postgres)', () => {
  const tag = uuid().slice(0, 8);
  const show = uuid();
  const ep = uuid();
  const other = uuid();
  const set = uuid();
  const USER = `manifest-admin-${tag}`;
  const tokens = {};
  const w = {};
  let savedSwitch;
  let ipN = 0;
  const EDIT = `/api/v1/episodes/${ep}/edit`;
  const as = (who, r) => {
    ipN += 1;
    const sent = r.set('X-Forwarded-For', `198.51.181.${(ipN % 200) + 1}`);
    return tokens[who] ? sent.set('Authorization', `Bearer ${tokens[who]}`) : sent;
  };
  const get = (who, path) => as(who, request(app).get(`${EDIT}${path}`));
  const rev = async () => (await svc.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const write = async (extra = {}) => ({ episodeId: ep, editRevision: await rev(), userId: USER, ...extra });
  const manifest = (over = {}) => manifestOf(sequelize, { episodeId: ep, versionId: w.version, purpose: 'preview', range: {}, ...over });
  const codes = (list) => list.map((f) => f.code);

  beforeAll(async () => {
    await c1b.up(sequelize.getQueryInterface(), Sequelize);
    savedSwitch = process.env.EPISODE_EDIT;
    process.env.EPISODE_EDIT = 'on';
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@manifest.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(USER, ['ADMIN'], 'ADMIN');

    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())', { show, n: `manifest-${tag}` });
    for (const [id, n] of [[ep, 1], [other, 2]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
        VALUES (:id, :show, 'Manifest', :n, 'draft', :script, '[]'::jsonb, NOW(), NOW())`, { id, show, n: 8800 + n, script: SCRIPT });
    }
    await run(`INSERT INTO scene_sets (id, name, scene_type, created_at, updated_at) VALUES (:set, 'Manifest set', 'OTHER', NOW(), NOW())`, { set });
    await run('INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, created_at, updated_at) VALUES (:x, :set, :ep, 0, NOW(), NOW())', { x: uuid(), set, ep });
    const angle = async (still, video) => {
      const id = uuid();
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, still_image_url, video_clip_url, video_duration, created_at, updated_at)
        VALUES (:id, :set, 'WIDE', 'Wide', :still, :video, 5, NOW(), NOW())`, { id, set, still, video });
      return id;
    };
    w.still = await angle(`https://cdn.example/${tag}-still.png`, null);
    w.video = await angle(null, VIDEO_URL);
    const clip = async (performer, seconds, cut = false) => {
      const id = uuid();
      await run(`INSERT INTO episode_raw_clips (id, episode_id, performer, s3_key_raw, url_raw, s3_key_cutout, url_cutout, key_status, duration_seconds, width, height, file_size_bytes, created_at, updated_at)
        VALUES (:id, :ep, :performer, :key, :url, :cutKey, :cutUrl, :status, :seconds, 1920, 1080, 4096, NOW(), NOW())`, {
        id, ep, performer, seconds, key: `episodes/${ep}/raw-clips/${id}/original.mp4`, url: `https://cdn.example/${id}/original.mp4`,
        cutKey: cut ? `episodes/${ep}/raw-clips/${id}/cutout-1.webm` : null, cutUrl: cut ? `https://cdn.example/${id}/cutout-1.webm` : null, status: cut ? 'done' : 'none',
      });
      return id;
    };
    w.prime = await clip('justawoman', 140, true);
    w.lala = await clip('lala', 30);

    // The edit: beat 1 is Lala's take (10 s), beat 2 the angle's video (7.34 s), beat 3 a still (5 s); beats 4-14 are empty.
    await svc.placeSceneClip(sequelize, await write({ body: { beat_number: 1, source_kind: 'raw_clip', source_id: w.lala, source_in_ms: 0, source_out_ms: 10000 } }));
    await svc.placeSceneClip(sequelize, await write({ body: { beat_number: 2, source_kind: 'angle_video', source_id: w.video } }));
    await svc.placeSceneClip(sequelize, await write({ body: { beat_number: 3, source_kind: 'angle_still', source_id: w.still, duration_ms: 5000 } }));
    w.segment = (await svc.placeSegment(sequelize, await write({ body: { raw_clip_id: w.prime, anchor_kind: 'edit_start', offset_ms: 0, source_in_ms: 0, source_out_ms: 22340 } }))).segment_id;
    await svc.setPipSettings(sequelize, await write({ body: { use_cutout: true, default_layout: { x: 1300, y: 700, w: 540, h: 304 } } }));
    w.performer = (await svc.addItem(sequelize, await write({ body: { kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 2, offset_ms: 500, values: { raw_clip_id: w.lala, source_in_ms: 12000, source_out_ms: 15000, layout: { x: 200, y: 100, w: 800, h: 900 } } } }))).item_id;
    w.caption = (await svc.addItem(sequelize, await write({ body: { kind: 'caption', anchor_kind: 'edit_start', offset_ms: 250, duration_ms: 2500, values: { text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 } } } }))).item_id;
    w.transition = (await svc.addItem(sequelize, await write({ body: { kind: 'transition', anchor_kind: 'beat_start', anchor_beat: 2, offset_ms: 0, values: { type: 'fade' } } }))).item_id;
    w.music = (await svc.addAudioItem(sequelize, await write({ body: { track: 'music', asset_ref: 'lib:bed', source_out_ms: 8000, anchor_kind: 'edit_start', offset_ms: 1000 } }))).audio_item_id;

    // A line cut from Lala's take at 2 s of it, approved, and placed where the scene shows that moment (2 s).
    w.source = uuid();
    w.sha = crypto.createHash('sha256').update(w.source).digest('hex');
    await run(`INSERT INTO voice_source_assets (id, episode_id, source_kind, s3_key, sha256, content_type, file_size_bytes, duration_ms, source_raw_clip_id, source_in_ms, source_out_ms)
      VALUES (:src, :ep, 'extracted', :key, :sha, 'audio/wav', 1000, 3000, :clip, 2000, 5000)`, { src: w.source, ep, key: `voice/${w.source}.wav`, sha: w.sha, clip: w.lala });
    const scriptRev = async () => (await studio.episodeState(sequelize, ep)).revision;
    const { candidate, revision } = await studio.createCandidate(sequelize, { episodeId: ep, sourceAssetId: w.source, settings: {}, userId: USER });
    const { association } = await studio.associate(sequelize, { episodeId: ep, candidateId: candidate.id, scriptRevision: await scriptRev(), beatNumber: 1, lineIndex: 0, userId: USER });
    const { approval_id: approval } = await studio.approve(sequelize, { episodeId: ep, candidateId: candidate.id, candidateRevisionId: revision.id, scriptRevision: await scriptRev(), expectedApprovalId: null, userId: USER });
    Object.assign(w, { candidate: candidate.id, association: association.id, approval });
    w.line = (await svc.placeDialogue(sequelize, await write({ body: { approval_id: approval, association_id: association.id, anchor_kind: 'edit_start', offset_ms: 2000 } }))).item_id;

    const saved = await svc.createVersion(sequelize, await write({ name: 'Manifest cut' }));
    w.version = saved.version_id;
    w.snapshotSha = saved.snapshot_sha256;
    w.editRevision = saved.edit_revision;
  });

  beforeEach(() => {
    mockSend.mockReset();
    mockChild.mockReset();
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (savedSwitch === undefined) delete process.env.EPISODE_EDIT; else process.env.EPISODE_EDIT = savedSwitch;
    const e = { e: [ep, other] };
    const quiet = (p) => p.catch((err) => console.error('[cleanup]', err.message));
    await quiet(run('UPDATE episode_prime_segments SET superseded_by = NULL WHERE episode_id IN (:e)', e));
    for (const table of EDIT_TABLES) await quiet(run(`DELETE FROM ${table} WHERE episode_id IN (:e)`, e));
    await quiet(run('DELETE FROM line_voice_reconfirmations WHERE approval_id IN (SELECT id FROM line_voice_approvals WHERE episode_id IN (:e))', e));
    await quiet(run('UPDATE line_voice_approvals SET superseded_by = NULL WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM line_voice_approvals WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM line_voice_candidate_revisions WHERE candidate_id IN (SELECT id FROM line_voice_candidates WHERE episode_id IN (:e))', e));
    await quiet(run('UPDATE line_voice_associations SET superseded_by = NULL WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM line_voice_associations WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM line_voice_candidates WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM voice_source_assets WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM episode_script_versions WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM episode_raw_clips WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM scene_set_episodes WHERE episode_id IN (:e)', e));
    await quiet(run('DELETE FROM scene_angles WHERE scene_set_id = :set', { set }));
    await quiet(run('DELETE FROM scene_sets WHERE id = :set', { set }));
    await quiet(run('DELETE FROM episodes WHERE id IN (:e)', e));
    await quiet(run('DELETE FROM shows WHERE id = :show', { show }));
    await sequelize.close();
  });

  test('AC 1 the same saved version gives byte-identical JSON and the same manifest_sha256, from the service and from the route', async () => {
    const a = await manifest();
    const b = await manifest();
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.manifest_sha256).toMatch(/^[0-9a-f]{64}$/);
    const { manifest_sha256: hash, ...body } = a;
    expect(hash).toBe(svc.sha256(svc.stableJson(body)));
    const one = await get('admin', `/versions/${w.version}/manifest`);
    const two = await get('admin', `/versions/${w.version}/manifest`);
    expect(one.status).toBe(200);
    expect(one.body.success).toBe(true);
    expect(JSON.stringify(two.body)).toBe(JSON.stringify(one.body));
    expect(JSON.stringify(one.body.data)).toBe(JSON.stringify(a));
    // No clock in it: nothing that looks like a timestamp of today, no signed link.
    expect(JSON.stringify(a)).not.toMatch(/X-Amz-|signed-link|Signature=/);
  });

  test('the manifest is the saved version, resolved: its edit, frames, files, picture and sound', async () => {
    const m = await manifest();
    expect(m).toMatchObject({ manifest_version: 1, purpose: 'preview', episode_id: ep, frame: { width: 1920, height: 1080, fps: 30 } });
    expect(m.edit).toEqual({ version_id: w.version, snapshot_sha256: w.snapshotSha, edit_revision: w.editRevision, script_revision: expect.stringMatching(/^sr1-[0-9a-f]{40}$/), script_seq: expect.any(String) });
    expect(m.range).toEqual({ start_frame: 0, end_frame: 671, whole: true }); // 22340 ms: frame 670 (22333 ms) is the last one inside
    expect(m.intervals[0].start_frame).toBe(0);
    expect(m.intervals[m.intervals.length - 1].end_frame).toBe(m.range.end_frame);
    expect(m.assets).toEqual({
      [`raw_clip:${w.lala}`]: { kind: 'raw_clip', record_id: w.lala, storage_key: `episodes/${ep}/raw-clips/${w.lala}/original.mp4`, url: `https://cdn.example/${w.lala}/original.mp4`, size_bytes: 4096, sha256: null, duration_ms: 30000, width: 1920, height: 1080, has_alpha: false, identity: 'weak' },
      [`raw_clip:${w.prime}`]: expect.objectContaining({ kind: 'raw_clip', identity: 'weak', duration_ms: 140000 }),
      [`cutout:${w.prime}`]: { kind: 'cutout', record_id: w.prime, storage_key: `episodes/${ep}/raw-clips/${w.prime}/cutout-1.webm`, url: `https://cdn.example/${w.prime}/cutout-1.webm`, size_bytes: null, sha256: null, duration_ms: 140000, width: 1920, height: 1080, has_alpha: true, identity: 'pinned' },
      [`angle_video:${w.video}`]: expect.objectContaining({ kind: 'angle_video', url: VIDEO_URL, identity: 'weak' }),
      [`angle_still:${w.still}`]: expect.objectContaining({ kind: 'angle_still', url: `https://cdn.example/${tag}-still.png`, identity: 'weak' }),
      [`voice_source:${w.source}`]: { kind: 'voice_source', record_id: w.source, storage_key: `voice/${w.source}.wav`, url: null, size_bytes: null, sha256: w.sha, duration_ms: 3000, width: null, height: null, has_alpha: false, identity: 'strong' },
    });
    // The first frame: Lala's take as the scene, Prime's cutout over it.
    expect(m.intervals[0].layers).toEqual([
      expect.objectContaining({ kind: 'scene', source_kind: 'raw_clip', source_id: w.lala, asset: `raw_clip:${w.lala}`, source_time_ms: 0, held: false, fit: 'cover' }),
      expect.objectContaining({ kind: 'pip', segment_id: w.segment, asset: `cutout:${w.prime}`, media: 'cutout', fit: 'contain', source_time_ms: 0, layout: { x: 1300, y: 700, w: 540, h: 304 } }),
    ]);
    // Sound: commentary and the line apart, no footage sound, the music left out and said so.
    expect(m.audio.footage).toEqual([]);
    expect(m.audio.commentary).toEqual([expect.objectContaining({ kind: 'commentary', segment_id: w.segment, asset: `raw_clip:${w.prime}`, timeline_start_ms: 0, timeline_end_ms: 22340 })]);
    expect(m.audio.dialogue).toEqual([expect.objectContaining({
      kind: 'dialogue', item_id: w.line, approval_id: w.approval, association_id: w.association, beat: 1, line_index: 0, asset: `voice_source:${w.source}`,
      s3_key: `voice/${w.source}.wav`, sha256: w.sha, source_kind: 'extracted', lineage: { raw_clip_id: w.lala, source_in_ms: 2000, source_out_ms: 5000 },
      timeline_start_ms: 2000, timeline_end_ms: 5000, source_start_ms: 0, source_end_ms: 3000,
    })]);
    expect(m.audio.excluded).toEqual([expect.objectContaining({ item_id: w.music, track: 'music', reason: 'unresolved_asset' })]);
    expect(m.audio.overlaps).toEqual([{ commentary: w.segment, dialogue: w.line, start_ms: 2000, end_ms: 5000 }]);
    const { technical, production } = m.readiness;
    expect(codes(technical.warnings)).toEqual(expect.arrayContaining(['audio_item_excluded', 'commentary_over_dialogue', 'item_not_rendered', 'asset_identity_weak']));
    // The line sits on its source, so no placement finding; the empty beats block the whole edit.
    expect(codes(technical.blocking)).not.toContain('dialogue_not_placed_on_source');
    expect(codes(technical.blocking)).not.toContain('asset_missing');
    expect(technical.blocking.filter((f) => f.code === 'scene_missing').map((f) => f.beat)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(production.complete).toBe(false);
    expect(production.missing).toEqual(expect.arrayContaining([expect.objectContaining({ what: 'music', item_id: w.music }), expect.objectContaining({ what: 'item', item_id: w.transition, kind: 'transition' }), expect.objectContaining({ what: 'prime_segment', segment_id: w.segment })]));
    expect(production.not_assessed).toContainEqual({ what: 'sfx', why: 'no record says whether this episode needs SFX' });
    expect(production.not_assessed.map((n) => n.what)).not.toContain('music');
  });

  test('AC 4 on saved rows: the intervals are layersAt of the version\'s snapshot at every frame', async () => {
    const m = await manifest();
    const version = await svc.getVersion(sequelize, { episodeId: ep, versionId: w.version });
    const edit = svc.editFrom(version.snapshot, await svc.voiceTakesFor(sequelize, ep, version.snapshot));
    let frames = 0;
    for (const runOf of m.intervals) {
      for (let f = runOf.start_frame; f < runOf.end_frame; f += 1) {
        frames += 1;
        const want = tl.layersAt(edit, tl.frameTime(f)).layers;
        const got = runOf.layers.map((l) => {
          const { asset, media, fit, ...rest } = l;
          if (l.kind === 'scene') delete rest.layout; else if (l.kind !== 'caption') delete rest.held;
          return l.source_time_ms != null && !l.held ? { ...rest, source_time_ms: l.source_time_ms + tl.frameTime(f) - tl.frameTime(runOf.start_frame) } : rest;
        });
        if (JSON.stringify(got) !== JSON.stringify(JSON.parse(JSON.stringify(want)))) expect([f, got]).toEqual([f, want]);
      }
    }
    expect(frames).toBe(m.range.end_frame);
    expect(m.intervals.length).toBeLessThan(20);
  });

  test('the manifest reads the saved version, never the live edit: a change made after the save changes nothing', async () => {
    const before = await manifest();
    await svc.removeRow(sequelize, await write({ what: 'item', id: w.caption }));
    await svc.setPipSettings(sequelize, await write({ body: { use_cutout: false } }));
    const after = await manifest();
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(JSON.stringify(after)).toContain(w.caption);
    expect(after.edit.edit_revision).toBe(w.editRevision);
  });

  test('AC 2 a second version with one layout value changed has another hash', async () => {
    const first = await manifest();
    await svc.setPipSettings(sequelize, await write({ body: { use_cutout: true, default_layout: { x: 1301, y: 700, w: 540, h: 304 } } }));
    const saved = await svc.createVersion(sequelize, await write({ name: 'One pixel over' }));
    const second = await manifest({ versionId: saved.version_id });
    expect(second.manifest_sha256).not.toBe(first.manifest_sha256);
    expect(second.edit.snapshot_sha256).not.toBe(first.edit.snapshot_sha256);
    expect(second.intervals[0].layers.find((l) => l.kind === 'pip').layout.x).toBe(1301);
    // The first version still reads as it did.
    expect((await manifest()).manifest_sha256).toBe(first.manifest_sha256);
  });

  test('AC 3 a changed angle URL and a changed cutout key each change the hash; put back, the hash is back', async () => {
    const base = (await manifest()).manifest_sha256;
    try {
      await run('UPDATE scene_angles SET video_clip_url = :url WHERE id = :id', { id: w.video, url: `${VIDEO_URL}?regenerated` });
      const angle = await manifest();
      expect(angle.manifest_sha256).not.toBe(base);
      expect(angle.assets[`angle_video:${w.video}`].url).toBe(`${VIDEO_URL}?regenerated`);
    } finally {
      await run('UPDATE scene_angles SET video_clip_url = :url WHERE id = :id', { id: w.video, url: VIDEO_URL });
    }
    expect((await manifest()).manifest_sha256).toBe(base);
    const key = `episodes/${ep}/raw-clips/${w.prime}/cutout-1.webm`;
    try {
      await run('UPDATE episode_raw_clips SET s3_key_cutout = :key WHERE id = :id', { id: w.prime, key: key.replace('cutout-1', 'cutout-2') });
      const cutout = await manifest();
      expect(cutout.manifest_sha256).not.toBe(base);
      expect(cutout.assets[`cutout:${w.prime}`].storage_key).toBe(key.replace('cutout-1', 'cutout-2'));
    } finally {
      await run('UPDATE episode_raw_clips SET s3_key_cutout = :key WHERE id = :id', { id: w.prime, key });
    }
    expect((await manifest()).manifest_sha256).toBe(base);
  });

  test('a source that is gone, or an angle whose set is no longer linked, is asset_missing; a version of another episode is not found', async () => {
    try {
      await run('UPDATE scene_set_episodes SET deleted_at = NOW() WHERE scene_set_id = :set AND episode_id = :ep', { set, ep });
      const m = await manifest();
      expect(m.readiness.technical.blocking.filter((f) => f.code === 'asset_missing').map((f) => f.asset).sort()).toEqual([`angle_still:${w.still}`, `angle_video:${w.video}`].sort());
    } finally {
      await run('UPDATE scene_set_episodes SET deleted_at = NULL WHERE scene_set_id = :set AND episode_id = :ep', { set, ep });
    }
    await expect(manifestOf(sequelize, { episodeId: other, versionId: w.version, purpose: 'preview', range: {} })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  test('AC 11 a range: frames and sound cut together; a ranged final is blocked; a bad range is refused', async () => {
    const part = await manifest({ range: { start_ms: '3000', end_ms: '4000' } });
    expect(part.range).toEqual({ start_frame: 90, end_frame: 120, whole: false });
    expect(part.audio.dialogue).toEqual([expect.objectContaining({ timeline_start_ms: 3000, timeline_end_ms: 4000, source_start_ms: 1000, source_end_ms: 2000, envelope_start_ms: 2000, envelope_end_ms: 5000 })]);
    // Beat 1 alone has its scene and Prime: ready, while beats 4-14 are empty.
    const beat1 = await manifest({ range: { start_ms: 0, end_ms: 10000 } });
    expect(beat1.readiness.technical).toMatchObject({ ready: true, blocking: [] });
    expect(beat1.readiness.production.complete).toBe(false);
    const final = await manifest({ purpose: 'final', range: { start_ms: 0, end_ms: 10000 } });
    expect(final.purpose).toBe('final');
    expect(codes(final.readiness.technical.blocking)).toEqual(expect.arrayContaining(['final_requires_whole_edit', 'asset_identity_unverified', 'scene_missing']));
    await expect(manifest({ range: { start_ms: 'soon' } })).rejects.toMatchObject({ status: 400, code: 'BAD_RANGE' });
    await expect(manifest({ range: { start_ms: 5000, end_ms: 4000 } })).rejects.toMatchObject({ status: 400, code: 'BAD_RANGE' });
  });

  describe('AC 14 the route', () => {
    const path = () => `/versions/${w.version}/manifest`;

    test('AC 14 no token is 401; a viewer and an editor are 403; none of them reaches the manifest', async () => {
      const service = require('../../src/services/renderManifestService');
      const called = jest.spyOn(service, 'manifestOf');
      const anon = await get('anon', path());
      expect(anon.status).toBe(401);
      for (const who of ['viewer', 'editor']) {
        const res = await get(who, path());
        expect([who, res.status]).toEqual([who, 403]);
        expect(res.body.data).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain(w.version);
      }
      expect(called).not.toHaveBeenCalled();
    });

    test('AC 14 an ADMIN is answered 200: a preview by default, a final or a range when asked', async () => {
      const res = await get('admin', path());
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ manifest_version: 1, purpose: 'preview', episode_id: ep, range: { whole: true }, edit: { version_id: w.version } });
      const final = await get('admin', `${path()}?purpose=final`);
      expect(final.body.data.purpose).toBe('final');
      const other2 = await get('admin', `${path()}?purpose=anything`);
      expect(other2.body.data.purpose).toBe('preview');
      const ranged = await get('admin', `${path()}?from=3000&to=4000`);
      expect(ranged.body.data.range).toEqual({ start_frame: 90, end_frame: 120, whole: false });
      const bad = await get('admin', `${path()}?from=4000&to=3000`);
      expect([bad.status, bad.body.code]).toEqual([400, 'BAD_RANGE']);
    });

    test('AC 14 with EPISODE_EDIT off it is 404 for an ADMIN too', async () => {
      const prev = process.env.EPISODE_EDIT;
      try {
        delete process.env.EPISODE_EDIT;
        const off = await get('admin', path());
        expect([off.status, off.body.code]).toEqual([404, 'EPISODE_EDIT_OFF']);
        expect(off.body.data).toBeUndefined();
      } finally {
        process.env.EPISODE_EDIT = prev;
      }
    });

    test('AC 14 an unknown version, a version id that is no id, and another episode\'s version are 404', async () => {
      for (const p of [`/versions/${uuid()}/manifest`, '/versions/not-an-id/manifest']) {
        const res = await get('admin', p);
        expect([p, res.status, res.body.code]).toEqual([p, 404, 'NOT_FOUND']);
      }
      const elsewhere = await as('admin', request(app).get(`/api/v1/episodes/${other}/edit/versions/${w.version}/manifest`));
      expect([elsewhere.status, elsewhere.body.code]).toEqual([404, 'NOT_FOUND']);
    });

    test('AC 14 GET /versions/:versionId still answers with the version and its snapshot, not a manifest', async () => {
      const res = await get('admin', `/versions/${w.version}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: w.version, name: 'Manifest cut', snapshot_sha256: w.snapshotSha });
      expect(Object.keys(res.body.data.snapshot).sort()).toEqual(['audio_items', 'beat_production', 'items', 'pip', 'scene_clips', 'segments', 'visibility']);
      expect(res.body.data.manifest_sha256).toBeUndefined();
      const list = await get('admin', '/versions');
      expect(list.body.data.map((v) => v.id)).toContain(w.version);
    });
  });

  test('AC 15 read-only: only SELECTs in read-only transactions; no row changed; no storage, process, network or job', async () => {
    const voiceFootage = (await rows("SELECT to_regclass('voice_footage_jobs')::text AS t"))[0].t;
    // Every row of everything the manifest reads, as text: a changed, added or removed row changes it.
    const SCOPED = [...EDIT_TABLES, 'episode_raw_clips', 'voice_source_assets', 'line_voice_candidates', 'line_voice_associations', 'line_voice_approvals', 'scene_set_episodes', ...(voiceFootage ? ['voice_footage_jobs'] : [])];
    const state = async () => {
      const out = {};
      for (const table of SCOPED) out[table] = (await rows(`SELECT count(*)::int AS n, md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS rows FROM ${table} t WHERE episode_id = :ep`, { ep }))[0];
      out.line_voice_candidate_revisions = (await rows('SELECT count(*)::int AS n, md5(coalesce(string_agg(t::text, \'|\' ORDER BY t::text), \'\')) AS rows FROM line_voice_candidate_revisions t WHERE candidate_id IN (SELECT id FROM line_voice_candidates WHERE episode_id = :ep)', { ep }))[0];
      out.line_voice_reconfirmations = (await rows('SELECT count(*)::int AS n FROM line_voice_reconfirmations WHERE approval_id IN (SELECT id FROM line_voice_approvals WHERE episode_id = :ep)', { ep }))[0];
      out.scene_angles = (await rows('SELECT count(*)::int AS n, md5(coalesce(string_agg(t::text, \'|\' ORDER BY t::text), \'\')) AS rows FROM scene_angles t WHERE scene_set_id = :set', { set }))[0];
      out.episodes = (await rows('SELECT count(*)::int AS n, md5(coalesce(string_agg(t::text, \'|\' ORDER BY t::text), \'\')) AS rows FROM episodes t WHERE id = :ep', { ep }))[0];
      return out;
    };
    const before = await state();
    expect(before.edit_versions.n).toBeGreaterThanOrEqual(1);
    expect(before.episode_raw_clips.n).toBe(2);
    expect(before.line_voice_approvals.n).toBe(1);

    const realQuery = sequelize.query.bind(sequelize);
    const statements = [];
    jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
      // The app's own hourly housekeeping timer (worldStudio's preview cleanup) is not the manifest's.
      if (!/cleanupOrphanedPreviews/.test(new Error().stack)) statements.push(String(typeof sql === 'string' ? sql : sql.query));
      return realQuery(sql, ...rest);
    });
    const fetched = jest.spyOn(global, 'fetch').mockImplementation(async () => { throw new Error('the manifest must not use the network'); });
    const axiosed = jest.spyOn(axios.Axios.prototype, 'request').mockImplementation(async () => { throw new Error('the manifest must not use the network'); });
    const queued = [jest.spyOn(media, 'enqueueKey'), jest.spyOn(media, 'keyClip'), jest.spyOn(media, 'uploadFile'), jest.spyOn(media, 'downloadFile'), jest.spyOn(media, 'run'),
      jest.spyOn(footageJobs, 'enqueueExtract'), jest.spyOn(footageJobs, 'prepare'), jest.spyOn(footageJobs, 'onClipUploaded')];

    const viaService = await manifest();
    const final = await manifest({ purpose: 'final', range: { start_ms: 1000, end_ms: 9000 } });
    const viaRoute = await get('admin', `/versions/${w.version}/manifest`);
    const recorded = statements.slice();
    sequelize.query.mockRestore();

    expect(viaRoute.status).toBe(200);
    expect(viaRoute.body.data.manifest_sha256).toBe(viaService.manifest_sha256);
    expect(final.range.whole).toBe(false);
    expect(recorded.length).toBeGreaterThan(10);
    const ALLOWED = /^\s*(SELECT|SET TRANSACTION|BEGIN|START TRANSACTION|COMMIT|ROLLBACK)\b/i;
    for (const sql of recorded) {
      expect([sql.slice(0, 120), ALLOWED.test(sql)]).toEqual([sql.slice(0, 120), true]);
      expect(sql).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+"?\w+"?\s+SET|DELETE\s+FROM|TRUNCATE|DROP|ALTER|CREATE)\b/i);
      expect(sql).not.toMatch(/\bFOR\s+(UPDATE|SHARE)\b/i);
    }
    // The manifest's own transaction is told to be read-only by the database.
    expect(recorded.filter((sql) => /^SET TRANSACTION READ ONLY/i.test(sql))).toHaveLength(3);
    expect(recorded.some((sql) => /REPEATABLE READ/i.test(sql))).toBe(true);

    expect(await state()).toEqual(before);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockChild).not.toHaveBeenCalled();
    expect(fetched).not.toHaveBeenCalled();
    expect(axiosed).not.toHaveBeenCalled();
    for (const spy of queued) expect(spy).not.toHaveBeenCalled();
  });

  test('AC 15 the database refuses a write inside the manifest\'s kind of transaction', async () => {
    const { Transaction } = require('sequelize');
    await expect(sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async (t) => {
      await sequelize.query('SET TRANSACTION READ ONLY', { transaction: t });
      await sequelize.query('UPDATE episodes SET title = title WHERE id = :ep', { replacements: { ep }, transaction: t });
    })).rejects.toThrow(/read-only transaction/);
  });

  // Last: it changes the approval for good.
  test('AC 8 an approval that stops being current plays nothing in the saved version\'s manifest, and blocks; AC 3 the hash changes', async () => {
    const before = await manifest();
    expect(before.audio.dialogue).toHaveLength(1);
    await studio.reviseCandidate(sequelize, { episodeId: ep, candidateId: w.candidate, settings: { in_ms: 100 }, userId: USER });
    const after = await manifest();
    expect(after.audio.dialogue).toEqual([]);
    expect(Object.keys(after.assets)).not.toContain(`voice_source:${w.source}`);
    expect(after.readiness.technical.blocking).toContainEqual(expect.objectContaining({ code: 'dialogue_take_not_current', ref: w.line, approval_id: w.approval, state: 'outdated_take' }));
    expect(after.manifest_sha256).not.toBe(before.manifest_sha256);
    expect(after.edit.snapshot_sha256).toBe(before.edit.snapshot_sha256);
  });
});
