/**
 * Removing a take asks what uses it first (Evoni, 2026-11-12;
 * rawClipsService.removeClip). On the test database, through the real
 * delete route (DELETE /api/v1/episode-clips/:episodeId/:clipId), with the
 * edit made by the real edit service and Voice Studio's rows written as its
 * tables hold them.
 *
 *   - ADMIN only: anyone else gets 403 and nothing changes;
 *   - a take the live edit uses is kept, 409 CLIP_IN_USE, blocked_by naming
 *     each use: a Prime segment, a scene clip, a timeline placement;
 *   - a take a saved version of the edit names is kept, though the live edit
 *     no longer uses it;
 *   - a take whose sound is a Voice Studio source is kept (alone, with takes
 *     of a line, with an approved line), and so is one whose voice job is
 *     waiting or running;
 *   - a superseded segment, a removed placement, a finished or failed job
 *     and another episode's rows do not hold a take;
 *   - an unused take is soft-deleted: its row stays, its files are not
 *     deleted, the episode is still filmed;
 *   - nothing forces it: no flag in the request changes the answer;
 *   - a placement, a version save, a restore, a new voice source and a
 *     removal take turns, in both orders, and none leaves a row naming a
 *     removed take;
 *   - a refused removal changes nothing: script, brief, takes, edit, versions.
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

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const edit = require('../../src/services/episodeEditService');
const studio = require('../../src/services/voiceStudioService');
const clipsService = require('../../src/services/rawClipsService');
const media = require('../../src/services/rawClipMedia');
const { peekFrozen } = require('../../src/utils/snapshotFreeze');
const { scriptRevision } = require('../../src/utils/scriptRevision');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}, transaction = null) => sequelize.query(sql, { replacements, transaction });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const USER = 'test-admin-clipdel';
const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: "Bestie, come style me."\n\n## BEAT: 2 · Creator Welcome\nPrime: "Welcome back, besties."';
const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility', 'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];

(shouldSkip ? describe.skip : describe)('removing a take asks what uses it first', () => {
  const show = uuid();
  const episodes = [];
  let admin;
  let editor;
  const as = (token) => (r) => r.set('Authorization', `Bearer ${token}`);
  const del = (ep, clip, token = admin, body) => {
    const r = as(token)(request(app).delete(`/api/v1/episode-clips/${ep}/${clip}`));
    return body ? r.send(body) : r;
  };

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: USER, email: 'admin@clipdel.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-user-clipdel', email: 'user@clipdel.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `clipdel-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
    jest.spyOn(media, 'cancelKey').mockImplementation(() => true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (episodes.length) {
      const e = { e: episodes };
      const clean = (sql) => run(sql, e).catch((err) => console.error('[cleanup]', err.message));
      await clean('UPDATE episode_prime_segments SET superseded_by = NULL WHERE episode_id IN (:e)');
      for (const table of EDIT_TABLES) await clean(`DELETE FROM ${table} WHERE episode_id IN (:e)`);
      await clean('DELETE FROM voice_footage_jobs WHERE episode_id IN (:e)');
      await clean('DELETE FROM line_voice_approvals WHERE episode_id IN (:e)');
      await clean('DELETE FROM line_voice_candidate_revisions WHERE candidate_id IN (SELECT id FROM line_voice_candidates WHERE episode_id IN (:e))');
      await clean('DELETE FROM line_voice_associations WHERE episode_id IN (:e)');
      await clean('DELETE FROM line_voice_candidates WHERE episode_id IN (:e)');
      await clean('DELETE FROM voice_source_assets WHERE episode_id IN (:e)');
      await clean('DELETE FROM episode_script_versions WHERE episode_id IN (:e)');
      await clean('DELETE FROM episode_briefs WHERE episode_id IN (:e)');
      await clean('DELETE FROM episode_raw_clips WHERE episode_id IN (:e)');
      await clean('DELETE FROM episodes WHERE id IN (:e)');
    }
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('[cleanup] shows:', err.message));
    await sequelize.close();
  });

  // ── fixtures ─────────────────────────────────────────────────────────────
  const clip = async (ep, performer, label, seconds = 60) => {
    const id = uuid();
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, label, s3_key_raw, thumbnail_key, duration_seconds, beat_number, created_at, updated_at)
      VALUES (:id, :ep, :show, :performer, :label, :key, :thumb, :seconds, 1, NOW(), NOW())`,
    { id, ep, show, performer, label, key: `episodes/${ep}/raw-clips/${id}/original.mp4`, thumb: `episodes/${ep}/raw-clips/${id}/thumbnail.jpg`, seconds });
    return id;
  };
  // An episode with a script, a brief, two of Prime's takes and two of Lala's.
  const world = async () => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
      VALUES (:ep, :show, 'Clip removal', :n, 'draft', :script, '[1]'::jsonb, NOW(), NOW())`, { ep, show, n: 9100 + episodes.length, script: SCRIPT });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, narrative_purpose, created_at, updated_at) VALUES (:id, :ep, :show, 'The studio visit.', NOW(), NOW())`, { id: uuid(), ep, show });
    return { ep, prime: await clip(ep, 'justawoman', 'Prime take 1'), prime2: await clip(ep, 'justawoman', 'Prime take 2'), lala: await clip(ep, 'lala', 'Lala take 1'), lala2: await clip(ep, 'lala', 'Lala take 2') };
  };
  const rev = async (ep) => (await edit.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const withRev = async (ep, extra = {}) => ({ episodeId: ep, editRevision: await rev(ep), userId: USER, ...extra });
  const placeSegment = async (w, clipId = w.prime) => (await edit.placeSegment(sequelize, await withRev(w.ep, { body: { raw_clip_id: clipId, anchor_kind: 'beat_start', anchor_beat: 1, source_out_ms: 10000 } }))).segment_id;
  const placeScene = async (w, clipId = w.lala, beat = 2) => (await edit.placeSceneClip(sequelize, await withRev(w.ep, { body: { beat_number: beat, source_kind: 'raw_clip', source_id: clipId, source_out_ms: 10000 } }))).scene_clip_id;
  const placePerformer = async (w, clipId = w.lala) => (await edit.addItem(sequelize, await withRev(w.ep, { body: { kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 3, values: { raw_clip_id: clipId, source_in_ms: 0, source_out_ms: 5000, layout: { x: 0, y: 0, w: 480, h: 270 } } } }))).item_id;
  const source = async (w, clipId = w.lala) => {
    const id = uuid();
    await run(`INSERT INTO voice_source_assets (id, episode_id, source_kind, s3_key, sha256, content_type, file_size_bytes, duration_ms, source_raw_clip_id, source_in_ms, source_out_ms)
      VALUES (:id, :ep, 'extracted', :key, :sha, 'audio/flac', 1000, 30000, :clip, 0, 30000)`, { id, ep: w.ep, key: `episodes/${w.ep}/voice/sources/${id}.flac`, sha: sha(id), clip: clipId });
    return id;
  };
  const candidate = async (w, sourceId) => {
    const id = uuid();
    await run('INSERT INTO line_voice_candidates (id, episode_id, source_asset_id) VALUES (:id, :ep, :sourceId)', { id, ep: w.ep, sourceId });
    return id;
  };
  // An approval in force for a take of a line, as Voice Studio's tables hold one.
  const approve = async (w, candidateId) => {
    const revisionId = uuid();
    const associationId = uuid();
    const approvalId = uuid();
    const h = sha(candidateId);
    const sr = scriptRevision(SCRIPT, null);
    await run('INSERT INTO line_voice_candidate_revisions (id, candidate_id, revision_no, in_ms, out_ms, settings_hash) VALUES (:id, :c, 1, 0, 1000, :h)', { id: revisionId, c: candidateId, h });
    await run(`INSERT INTO line_voice_associations (id, candidate_id, episode_id, beat_number, line_index, occurrence, words, row_hash, prev_hash, next_hash, context_hash, script_revision)
      VALUES (:id, :c, :ep, 1, 0, 1, 'Bestie, come style me.', :h, :h, :h, :h, :sr)`, { id: associationId, c: candidateId, ep: w.ep, h, sr });
    await run(`INSERT INTO line_voice_approvals (id, episode_id, candidate_id, candidate_revision_id, association_id, beat_number, line_index, occurrence, approved_context, approved_context_hash, pinned_script_revision, pinned_script_seq, approved_by)
      VALUES (:id, :ep, :c, :r, :a, 1, 0, 1, '{}'::jsonb, :h, :sr, 0, 'tester')`, { id: approvalId, ep: w.ep, c: candidateId, r: revisionId, a: associationId, h, sr });
    return approvalId;
  };
  const job = async (w, clipId, status, { sourceId = null } = {}) => {
    const id = uuid();
    await run(`INSERT INTO voice_footage_jobs (id, episode_id, raw_clip_id, performer, kind, status, idempotency_key, input_ref, output_source_id)
      VALUES (:id, :ep, :clip, 'lala', 'extract', :status, :key, 'ref', :sourceId)`, { id, ep: w.ep, clip: clipId, status, key: `extract:${clipId}:${id}`, sourceId });
    return id;
  };
  const clipRow = async (id) => (await rows('SELECT * FROM episode_raw_clips WHERE id = :id', { id }))[0];
  const state = async (ep) => ({
    episode: await rows('SELECT script_content, script_locked_beats, script_seq::text AS script_seq, deleted_at FROM episodes WHERE id = :ep', { ep }),
    briefs: await rows('SELECT * FROM episode_briefs WHERE episode_id = :ep ORDER BY id', { ep }),
    clips: await rows('SELECT * FROM episode_raw_clips WHERE episode_id = :ep ORDER BY id', { ep }),
    segments: await rows('SELECT * FROM episode_prime_segments WHERE episode_id = :ep ORDER BY id', { ep }),
    sceneClips: await rows('SELECT * FROM episode_scene_clips WHERE episode_id = :ep ORDER BY id', { ep }),
    items: await rows('SELECT * FROM timeline_items WHERE episode_id = :ep ORDER BY id', { ep }),
    versions: await rows('SELECT * FROM edit_versions WHERE episode_id = :ep ORDER BY id', { ep }),
    editState: await rows('SELECT edit_revision::text AS r FROM episode_edit_state WHERE episode_id = :ep', { ep }),
    sources: await rows('SELECT * FROM voice_source_assets WHERE episode_id = :ep ORDER BY id', { ep }),
    jobs: await rows('SELECT * FROM voice_footage_jobs WHERE episode_id = :ep ORDER BY id', { ep }),
  });
  const kinds = (res) => (res.body.blocked_by || []).map((b) => b.kind);
  // Refused: 409 CLIP_IN_USE for exactly these uses, and nothing changed.
  const expectKept = async (w, clipId, expectedKinds) => {
    const before = await state(w.ep);
    const res = await del(w.ep, clipId);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'CLIP_IN_USE', clip: { id: clipId } });
    expect(kinds(res).sort()).toEqual([...expectedKinds].sort());
    for (const b of res.body.blocked_by) expect(typeof b.label === 'string' && b.label.length > 10).toBe(true);
    expect(res.body.error).toMatch(/can't be deleted\. .+ Nothing was deleted\.$/);
    expect(await state(w.ep)).toEqual(before);
    expect((await clipRow(clipId)).deleted_at).toBeNull();
    return res;
  };
  const expectRemoved = async (w, clipId) => {
    const before = await clipRow(clipId);
    const res = await del(w.ep, clipId);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const after = await clipRow(clipId);
    expect(after.deleted_at).not.toBeNull();
    // Soft only: the row and its files' keys are as they were.
    const { deleted_at: _d1, updated_at: _u1, ...restBefore } = before;
    const { deleted_at: _d2, updated_at: _u2, ...restAfter } = after;
    expect(restAfter).toEqual(restBefore);
  };

  // ── who may delete ───────────────────────────────────────────────────────
  describe('who may delete a take', () => {
    test('a signed-in user who is not an admin: 403, the take stays; uploading, starring and relabelling are as before', async () => {
      const w = await world();
      const before = await state(w.ep);
      const res = await del(w.ep, w.prime2, editor);
      expect(res.status).toBe(403);
      expect(await state(w.ep)).toEqual(before);
      expect((await request(app).delete(`/api/v1/episode-clips/${w.ep}/${w.prime2}`)).status).toBe(401);
      // The take's other writes keep their own rule (requireAuth).
      const star = await as(editor)(request(app).patch(`/api/v1/episode-clips/${w.ep}/${w.prime2}`)).send({ is_favorite: true, label: 'The good one' });
      expect(star.status).toBe(200);
      expect(await clipRow(w.prime2)).toMatchObject({ is_favorite: true, label: 'The good one', deleted_at: null });
    });

    test('an admin removes a take nothing uses: soft-deleted, its files kept, the episode still filmed', async () => {
      const w = await world();
      const filmed = await peekFrozen(sequelize, w.ep);
      const others = (await state(w.ep)).clips.filter((c) => c.id !== w.prime2);
      await expectRemoved(w, w.prime2);
      expect(mockSend.mock.calls.map(([c]) => c.name).filter((n) => /Delete/.test(n))).toEqual([]);
      expect((await state(w.ep)).clips.filter((c) => c.id !== w.prime2)).toEqual(others);
      expect(await peekFrozen(sequelize, w.ep)).toEqual(filmed);
      // Gone already: 404, as before.
      expect((await del(w.ep, w.prime2)).status).toBe(404);
    });

    test('404 for an unknown take, another episode\'s take and an id that is not one; no edit state is made for them', async () => {
      const w = await world();
      const other = await world();
      for (const [ep, id] of [[w.ep, uuid()], [w.ep, other.prime], [uuid(), w.prime], [w.ep, 'not-an-id']]) {
        // eslint-disable-next-line no-await-in-loop
        expect((await del(ep, id)).status).toBe(404);
      }
      expect((await clipRow(other.prime)).deleted_at).toBeNull();
      expect(await rows('SELECT 1 FROM episode_edit_state WHERE episode_id IN (:eps)', { eps: [w.ep, other.ep] })).toEqual([]);
    });
  });

  // ── what holds a take ────────────────────────────────────────────────────
  describe('the live edit holds a take', () => {
    test('a Prime segment', async () => {
      const w = await world();
      await placeSegment(w);
      const res = await expectKept(w, w.prime, ['prime_segment']);
      expect(res.body.blocked_by[0]).toMatchObject({ kind: 'prime_segment', count: 1 });
      expect(res.body.blocked_by[0].label).toMatch(/Prime segment \(beat 1\)/);
      // The other take of the same performer is not held.
      await expectRemoved(w, w.prime2);
    });

    test('a scene clip', async () => {
      const w = await world();
      await placeScene(w);
      const res = await expectKept(w, w.lala, ['scene_clip']);
      expect(res.body.blocked_by[0].label).toMatch(/scene clip \(beat 2\)/);
      await expectRemoved(w, w.lala2);
    });

    test('a timeline placement of a performer\'s take', async () => {
      const w = await world();
      await placePerformer(w);
      await expectKept(w, w.lala, ['performer_clip']);
    });

    test('several uses are all named', async () => {
      const w = await world();
      await placeScene(w, w.lala, 2);
      await placeScene(w, w.lala, 4);
      await placePerformer(w);
      const res = await expectKept(w, w.lala, ['scene_clip', 'performer_clip']);
      expect(res.body.blocked_by.find((b) => b.kind === 'scene_clip')).toMatchObject({ count: 2 });
    });

    test('a superseded segment does not hold its old take; the take that replaced it is held', async () => {
      const w = await world();
      const old = await placeSegment(w, w.prime);
      await edit.replaceTake(sequelize, await withRev(w.ep, { segmentId: old, body: { raw_clip_id: w.prime2, source_in_ms: 0, source_out_ms: 10000 } }));
      expect((await rows('SELECT superseded_at FROM episode_prime_segments WHERE id = :old', { old }))[0].superseded_at).not.toBeNull();
      await expectKept(w, w.prime2, ['prime_segment']);
      await expectRemoved(w, w.prime);
    });

    test('a superseded segment and a live use together: held, by the live use only', async () => {
      const w = await world();
      const old = await placeSegment(w, w.prime);
      await edit.replaceTake(sequelize, await withRev(w.ep, { segmentId: old, body: { raw_clip_id: w.prime2, source_in_ms: 0, source_out_ms: 10000 } }));
      await source(w, w.prime);
      await expectKept(w, w.prime, ['voice_source']);
    });

    test('a removed placement no longer holds the take', async () => {
      const w = await world();
      const sceneClipId = await placeScene(w);
      await expectKept(w, w.lala, ['scene_clip']);
      await run('UPDATE episode_scene_clips SET deleted_at = NOW() WHERE id = :id', { id: sceneClipId });
      await expectRemoved(w, w.lala);
    });

    test('another episode\'s edit does not hold this episode\'s take', async () => {
      const w = await world();
      const other = await world();
      await placeSegment(other);
      await expectRemoved(w, w.prime);
    });
  });

  describe('a saved version of the edit holds a take', () => {
    test('saved with a segment, a scene clip and a placement, then all three removed from the live edit: each take is still held by the version, by name', async () => {
      const w = await world();
      const seg = await placeSegment(w);
      const sc = await placeScene(w, w.lala);
      const item = await placePerformer(w, w.lala2);
      const saved = await edit.createVersion(sequelize, await withRev(w.ep, { name: 'Before the re-shoot' }));
      await run('UPDATE episode_prime_segments SET deleted_at = NOW() WHERE id = :seg', { seg });
      await run('UPDATE episode_scene_clips SET deleted_at = NOW() WHERE id = :sc', { sc });
      await run('UPDATE timeline_items SET deleted_at = NOW() WHERE id = :item', { item });
      for (const id of [w.prime, w.lala, w.lala2]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await expectKept(w, id, ['edit_version']);
        expect(res.body.blocked_by[0]).toMatchObject({ kind: 'edit_version', count: 1, versions: [{ id: saved.version_id, name: 'Before the re-shoot' }] });
        expect(res.body.blocked_by[0].label).toContain('"Before the re-shoot"');
      }
      // A take the version does not name is not held.
      await expectRemoved(w, w.prime2);
      // The version restores, and every take it names is still there.
      await edit.restoreVersion(sequelize, await withRev(w.ep, { versionId: saved.version_id }));
      const live = await edit.reviewReadiness(sequelize, { episodeId: w.ep });
      expect(live.findings.filter((f) => /_source_missing$/.test(f.code))).toEqual([]);
    });

    test('a version that is itself removed no longer holds the take', async () => {
      const w = await world();
      const seg = await placeSegment(w);
      const saved = await edit.createVersion(sequelize, await withRev(w.ep, { name: 'Old cut' }));
      await run('UPDATE episode_prime_segments SET deleted_at = NOW() WHERE id = :seg', { seg });
      await expectKept(w, w.prime, ['edit_version']);
      await run('UPDATE edit_versions SET deleted_at = NOW() WHERE id = :id', { id: saved.version_id });
      await expectRemoved(w, w.prime);
    });

    test('a version that names a take removed earlier is not restored: 409 VERSION_SOURCE_REMOVED, nothing changed', async () => {
      const w = await world();
      await placeSegment(w);
      const saved = await edit.createVersion(sequelize, await withRev(w.ep, { name: 'Has a removed take' }));
      // As it could be before removal asked: the take removed under its version.
      await run('UPDATE episode_raw_clips SET deleted_at = NOW() WHERE id = :id', { id: w.prime });
      const before = await state(w.ep);
      await expect(edit.restoreVersion(sequelize, await withRev(w.ep, { versionId: saved.version_id })))
        .rejects.toMatchObject({ status: 409, code: 'VERSION_SOURCE_REMOVED', extra: { missing_raw_clip_ids: [w.prime] } });
      expect(await state(w.ep)).toEqual(before);
    });
  });

  describe('Voice Studio holds a take', () => {
    test('a source made from its sound: alone, with a take of a line, and with an approved line', async () => {
      const w = await world();
      const sourceId = await source(w);
      let res = await expectKept(w, w.lala, ['voice_source']);
      expect(res.body.blocked_by[0]).toMatchObject({ takes: 0, approved: 0 });
      const cand = await candidate(w, sourceId);
      res = await expectKept(w, w.lala, ['voice_source']);
      expect(res.body.blocked_by[0]).toMatchObject({ takes: 1, approved: 0 });
      expect(res.body.blocked_by[0].label).toMatch(/1 take of a line/);
      await approve(w, cand);
      res = await expectKept(w, w.lala, ['voice_source']);
      expect(res.body.blocked_by[0]).toMatchObject({ takes: 1, approved: 1 });
      expect(res.body.blocked_by[0].label).toMatch(/1 approved line/);
      await expectRemoved(w, w.lala2);
    });

    test('a revoked approval is not counted as approved; the source still holds the take', async () => {
      const w = await world();
      const cand = await candidate(w, await source(w));
      const approvalId = await approve(w, cand);
      await run("UPDATE line_voice_approvals SET revoked_at = NOW(), revoked_by = 'tester' WHERE id = :id", { id: approvalId });
      const res = await expectKept(w, w.lala, ['voice_source']);
      expect(res.body.blocked_by[0]).toMatchObject({ takes: 1, approved: 0 });
    });

    test('a voice job waiting or running holds it; a failed or cancelled one does not', async () => {
      const w = await world();
      const queued = await job(w, w.lala, 'queued');
      let res = await expectKept(w, w.lala, ['voice_job']);
      expect(res.body.blocked_by[0]).toMatchObject({ status: 'queued' });
      await run("UPDATE voice_footage_jobs SET status = 'running' WHERE id = :id", { id: queued });
      res = await expectKept(w, w.lala, ['voice_job']);
      expect(res.body.blocked_by[0]).toMatchObject({ status: 'running' });
      expect(res.body.blocked_by[0].label).toMatch(/being prepared now/);
      await run("UPDATE voice_footage_jobs SET status = 'failed' WHERE id = :id", { id: queued });
      await job(w, w.lala, 'cancelled');
      await expectRemoved(w, w.lala);
    });

    // Evoni, 2026-11-12: any live source holds its take, with no takes of a
    // line and no approved line; a job that failed or was cancelled, before
    // or after the source was made, does not open a way round it.
    test('a live source still holds the take when its jobs failed or were cancelled; only removing the source row itself releases it', async () => {
      const w = await world();
      const sourceId = await source(w);
      await job(w, w.lala, 'failed');
      await job(w, w.lala, 'cancelled');
      const res = await expectKept(w, w.lala, ['voice_source']);
      expect(res.body.blocked_by[0]).toMatchObject({ kind: 'voice_source', count: 1, takes: 0, approved: 0 });
      // A source that is no longer live (nothing in the app removes one today) is the only thing that would not hold it.
      await run('UPDATE voice_source_assets SET deleted_at = NOW() WHERE id = :id', { id: sourceId });
      await expectRemoved(w, w.lala);
    });

    test('a finished job leaves its source, and the source holds the take', async () => {
      const w = await world();
      const sourceId = await source(w);
      await job(w, w.lala, 'succeeded', { sourceId });
      await expectKept(w, w.lala, ['voice_source']);
    });
  });

  test('nothing forces it: no flag in the request, query or header changes the answer', async () => {
    const w = await world();
    await placeSegment(w);
    const before = await state(w.ep);
    for (const send of [
      () => del(w.ep, w.prime, admin, { force: true, confirm: true, hard: true, confirmOverwrite: true }),
      () => as(admin)(request(app).delete(`/api/v1/episode-clips/${w.ep}/${w.prime}?force=true&hard=true`)),
      () => del(w.ep, w.prime).set('X-Force-Delete', 'true'),
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await send();
      expect([res.status, res.body.code]).toEqual([409, 'CLIP_IN_USE']);
    }
    expect(await state(w.ep)).toEqual(before);
  });

  // ── turns ────────────────────────────────────────────────────────────────
  describe('a removal and the edit take turns', () => {
    // Holds the edit's lock as an edit write does, does `work` in that
    // transaction, and commits after `ms`.
    const holdEdit = async (ep, work, { share = false, ms = 500 } = {}) => {
      const t = await sequelize.transaction();
      await run('INSERT INTO episode_edit_state (episode_id) VALUES (:ep) ON CONFLICT (episode_id) DO NOTHING', { ep }, t);
      await run(`SELECT 1 FROM episode_edit_state WHERE episode_id = :ep FOR ${share ? 'SHARE' : 'UPDATE'}`, { ep }, t);
      await work(t);
      let committed = false;
      const done = sleep(ms).then(async () => { committed = true; await t.commit(); });
      return { done, committed: () => committed };
    };

    test('a placement in progress commits first: the removal waited for it, sees it and keeps the take', async () => {
      const w = await world();
      const held = await holdEdit(w.ep, (t) => run(`INSERT INTO episode_prime_segments (id, episode_id, raw_clip_id, source_in_ms, source_out_ms, anchor_kind, anchor_beat)
        VALUES (:id, :ep, :clip, 0, 10000, 'beat_start', 1)`, { id: uuid(), ep: w.ep, clip: w.prime }, t));
      const res = await del(w.ep, w.prime);
      expect(held.committed()).toBe(true);
      await held.done;
      expect([res.status, res.body.code, kinds(res)]).toEqual([409, 'CLIP_IN_USE', ['prime_segment']]);
      expect((await clipRow(w.prime)).deleted_at).toBeNull();
    });

    test('a version being saved commits first (the edit held FOR SHARE, as Save version holds it): the removal waited and keeps the take', async () => {
      const w = await world();
      const snapshot = JSON.stringify({ scene_clips: [{ id: uuid(), source_kind: 'raw_clip', source_id: w.lala }] });
      const held = await holdEdit(w.ep, (t) => run(`INSERT INTO edit_versions (id, episode_id, name, snapshot, snapshot_sha256, edit_revision, script_revision, script_seq)
        VALUES (:id, :ep, 'Saved meanwhile', CAST(:snapshot AS jsonb), :sha, 0, :sr, 0)`, { id: uuid(), ep: w.ep, snapshot, sha: sha(snapshot), sr: scriptRevision(SCRIPT, null) }, t), { share: true });
      const res = await del(w.ep, w.lala);
      expect(held.committed()).toBe(true);
      await held.done;
      expect([res.status, kinds(res)]).toEqual([409, ['edit_version']]);
    });

    // The removal's own transaction, held open: its locks, then the delete, committed after `ms`.
    const removalInProgress = async (w, clipId, ms = 500) => {
      const t = await sequelize.transaction();
      await edit.lockEdit(sequelize, w.ep, t);
      await run('SELECT id FROM episode_raw_clips WHERE id = :id FOR UPDATE', { id: clipId }, t);
      await run('UPDATE episode_raw_clips SET deleted_at = NOW() WHERE id = :id', { id: clipId }, t);
      let committed = false;
      const done = sleep(ms).then(async () => { committed = true; await t.commit(); });
      return { done, committed: () => committed };
    };

    test.each([
      ['a Prime segment', (w) => ({ clip: w.prime, place: (r) => edit.placeSegment(sequelize, { episodeId: w.ep, editRevision: r, userId: USER, body: { raw_clip_id: w.prime, anchor_kind: 'beat_start', anchor_beat: 1, source_out_ms: 10000 } }) })],
      ['a scene clip', (w) => ({ clip: w.lala, place: (r) => edit.placeSceneClip(sequelize, { episodeId: w.ep, editRevision: r, userId: USER, body: { beat_number: 2, source_kind: 'raw_clip', source_id: w.lala, source_out_ms: 10000 } }) })],
      ['a timeline placement', (w) => ({ clip: w.lala, place: (r) => edit.addItem(sequelize, { episodeId: w.ep, editRevision: r, userId: USER, body: { kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 3, values: { raw_clip_id: w.lala, source_in_ms: 0, source_out_ms: 5000, layout: { x: 0, y: 0, w: 480, h: 270 } } } }) })],
    ])('the removal commits first: %s placed at the same moment waited for it and is refused (Take not found); no row names the removed take', async (_name, make) => {
      const w = await world();
      const { clip: clipId, place } = make(w);
      const r = await rev(w.ep);
      const removal = await removalInProgress(w, clipId);
      const outcome = await place(r).then(() => ({ placed: true, sawCommit: removal.committed() }), (err) => ({ err, sawCommit: removal.committed() }));
      await removal.done;
      expect(outcome.sawCommit).toBe(true);
      expect(outcome.err).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      const s = await state(w.ep);
      expect([s.segments, s.sceneClips, s.items]).toEqual([[], [], []]);
      expect((await clipRow(clipId)).deleted_at).not.toBeNull();
    });

    test('the removal commits first: a restore of a version naming the take waited for it and is refused; nothing is restored', async () => {
      const w = await world();
      // A version naming a take, written as it could exist before removal asked (the route would now keep the take).
      const snapshot = JSON.stringify({ segments: [{ id: uuid(), raw_clip_id: w.prime, source_in_ms: 0, source_out_ms: 10000, anchor_kind: 'beat_start', anchor_beat: 1 }] });
      const versionId = uuid();
      await run(`INSERT INTO edit_versions (id, episode_id, name, snapshot, snapshot_sha256, edit_revision, script_revision, script_seq)
        VALUES (:id, :ep, 'Old cut', CAST(:snapshot AS jsonb), :sha, 0, :sr, 0)`, { id: versionId, ep: w.ep, snapshot, sha: sha(edit.stableJson(JSON.parse(snapshot))), sr: scriptRevision(SCRIPT, null) });
      const r = await rev(w.ep);
      const removal = await removalInProgress(w, w.prime);
      const outcome = await edit.restoreVersion(sequelize, { episodeId: w.ep, editRevision: r, userId: USER, versionId }).then(() => ({ restored: true }), (err) => ({ err, sawCommit: removal.committed() }));
      await removal.done;
      expect(outcome.sawCommit).toBe(true);
      expect(outcome.err).toMatchObject({ status: 409, code: 'VERSION_SOURCE_REMOVED' });
      expect((await state(w.ep)).segments).toEqual([]);
    });
  });

  describe('a removal and Voice Studio take turns', () => {
    const fakeMedia = (onUpload = async () => {}) => ({
      probe: async () => ({ hasAudio: true, duration_ms: 30000, sample_rate: 48000, channels: 1 }),
      sha256File: async () => sha(uuid()),
      upload: async (...args) => { await onUpload(...args); },
    });
    const tmpFile = () => {
      const p = require('path').join(require('os').tmpdir(), `clipdel-${uuid()}.flac`);
      require('fs').writeFileSync(p, Buffer.alloc(64, 1));
      return p;
    };
    let restoreMedia;
    beforeEach(() => { restoreMedia = null; });
    afterEach(() => { if (restoreMedia) restoreMedia(); });
    // setMedia(null) puts the service's own media back.
    const useMedia = (m) => { studio.setMedia(m); restoreMedia = () => studio.setMedia(null); };

    test('the take is removed while its sound is being stored: no source is written for it', async () => {
      const w = await world();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      // The removal lands while the file uploads (after the first check of the take).
      useMedia(fakeMedia(async () => { expect((await del(w.ep, w.lala)).status).toBe(200); }));
      const file = tmpFile();
      await expect(studio.createExtractedSource(sequelize, { episodeId: w.ep, rawClipId: w.lala, localPath: file }))
        .rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
      require('fs').rmSync(file, { force: true });
      expect(await rows('SELECT id FROM voice_source_assets WHERE source_raw_clip_id = :id', { id: w.lala })).toEqual([]);
      expect((await clipRow(w.lala)).deleted_at).not.toBeNull();
    });

    test('a source being written commits first (the take held FOR SHARE, as the writer holds it): the removal waited for it and keeps the take', async () => {
      const w = await world();
      const t = await sequelize.transaction();
      await run('SELECT id FROM episode_raw_clips WHERE id = :id FOR SHARE', { id: w.lala }, t);
      const id = uuid();
      await run(`INSERT INTO voice_source_assets (id, episode_id, source_kind, s3_key, sha256, content_type, file_size_bytes, duration_ms, source_raw_clip_id, source_in_ms, source_out_ms)
        VALUES (:id, :ep, 'extracted', :key, :sha, 'audio/flac', 1000, 30000, :clip, 0, 30000)`, { id, ep: w.ep, key: `k/${id}.flac`, sha: sha(id), clip: w.lala }, t);
      let committed = false;
      const done = sleep(500).then(async () => { committed = true; await t.commit(); });
      const res = await del(w.ep, w.lala);
      await done;
      expect(committed).toBe(true);
      expect([res.status, kinds(res)]).toEqual([409, ['voice_source']]);
      expect((await clipRow(w.lala)).deleted_at).toBeNull();
    });

    test('a live take: its source is written as before, once, and then holds the take', async () => {
      const w = await world();
      useMedia(fakeMedia());
      const file = tmpFile();
      const first = await studio.createExtractedSource(sequelize, { episodeId: w.ep, rawClipId: w.lala, localPath: file });
      expect(first).toMatchObject({ existed: false, source: { source_kind: 'extracted', source_raw_clip_id: w.lala } });
      const again = await studio.createExtractedSource(sequelize, { episodeId: w.ep, rawClipId: w.lala, localPath: file });
      expect(again).toMatchObject({ existed: true, source: { id: first.source.id } });
      require('fs').rmSync(file, { force: true });
      await expectKept(w, w.lala, ['voice_source']);
    });
  });

  // ── re-recording ─────────────────────────────────────────────────────────
  test('re-recording a filmed episode: the first take, in use, cannot be removed; the script, brief, edit and its history are untouched; the episode stays filmed', async () => {
    const w = await world();
    await placeSegment(w, w.prime);
    await placeScene(w, w.lala);
    await edit.createVersion(sequelize, await withRev(w.ep, { name: 'First cut' }));
    await source(w, w.lala);
    const filmed = await peekFrozen(sequelize, w.ep);
    const before = await state(w.ep);
    // New takes arrive (new ids, as an upload makes them), and one is starred.
    const retake = await clip(w.ep, 'justawoman', 'Prime re-take');
    expect((await as(admin)(request(app).patch(`/api/v1/episode-clips/${w.ep}/${retake}`)).send({ is_favorite: true })).status).toBe(200);
    // The originals are held by what uses them.
    await expectKept(w, w.prime, ['prime_segment', 'edit_version']);
    await expectKept(w, w.lala, ['scene_clip', 'edit_version', 'voice_source']);
    const after = await state(w.ep);
    expect({ ...after, clips: after.clips.filter((c) => c.id !== retake) }).toEqual(before);
    expect(await peekFrozen(sequelize, w.ep)).toEqual(filmed);
    // The unused re-take can be removed, and the episode is still filmed.
    await expectRemoved(w, retake);
    expect(await peekFrozen(sequelize, w.ep)).toEqual(filmed);
    expect(clipsService.CLIP_IN_USE).toBe('CLIP_IN_USE');
  });
});
