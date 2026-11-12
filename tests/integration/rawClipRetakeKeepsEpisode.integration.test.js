/**
 * Re-recording an episode that is already filmed (Evoni, 2026-11-12):
 * uploading new takes and choosing one changes nothing else. On the test
 * database, through the real clip routes (the one-request upload, the in-part
 * upload and the take's PATCH), with the S3 client stubbed and every call
 * recorded.
 *
 * The episode starts as a filmed one does: a script with an approved beat, a
 * kept script version, a brief, a first take that is the beat's favourite,
 * and editing work that uses that take (a Prime segment, the edit's revision
 * and a saved edit version). After two new takes are uploaded and one is
 * made the favourite:
 *   - the script, its approved beats, its save number and its versions are
 *     as they were;
 *   - the brief is as it was;
 *   - the first take's row is as it was but for is_favorite (the new take
 *     took the star) and updated_at; its file and thumbnail keys are
 *     unchanged, it is not removed, and nothing was deleted from storage;
 *   - each new take has its own id and its own storage folder;
 *   - the editing work (segment, edit state, saved version) is as it was;
 *   - the episode is still filmed, from the first take's time.
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

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/rawClipMedia');
const multipart = require('../../src/services/rawClipMultipart');
const { peekFrozen } = require('../../src/utils/snapshotFreeze');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const MB = 1024 * 1024;
const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: "Bestie, come style me."\n\n## BEAT: 2 · Creator Welcome\nPrime: "Welcome back, besties."';

(shouldSkip ? describe.skip : describe)('re-recording a filmed episode: new takes change nothing else', () => {
  const show = uuid();
  const ep = uuid();
  const firstTake = uuid();
  const firstKey = `episodes/${ep}/raw-clips/${firstTake}/original.mp4`;
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const BASE = `/api/v1/episode-clips/${ep}`;

  const one = async (sql) => (await rows(sql, { ep }));
  const state = async () => ({
    episode: await one('SELECT script_content, script_locked_beats, script_line_keys, script_seq::text AS script_seq, title, status, deleted_at FROM episodes WHERE id = :ep'),
    scriptVersions: await one('SELECT * FROM episode_script_versions WHERE episode_id = :ep ORDER BY id'),
    briefs: await one('SELECT * FROM episode_briefs WHERE episode_id = :ep ORDER BY id'),
    segments: await one('SELECT * FROM episode_prime_segments WHERE episode_id = :ep ORDER BY id'),
    sceneClips: await one('SELECT * FROM episode_scene_clips WHERE episode_id = :ep ORDER BY id'),
    timelineItems: await one('SELECT * FROM timeline_items WHERE episode_id = :ep ORDER BY id'),
    editState: await one('SELECT episode_id, edit_revision::text AS edit_revision FROM episode_edit_state WHERE episode_id = :ep'),
    editVersions: await one('SELECT * FROM edit_versions WHERE episode_id = :ep ORDER BY id'),
  });
  const takes = () => one('SELECT * FROM episode_raw_clips WHERE episode_id = :ep ORDER BY created_at, id');
  const sent = (name) => mockSend.mock.calls.map(([c]) => c).filter((c) => c.name === name);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-retake', email: 'retake@clips.dev', name: 'Retake', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `retake-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, script_locked_beats, created_at, updated_at)
               VALUES (:ep, :show, 'Filmed once', 1, 'draft', :script, '[1]'::jsonb, NOW(), NOW())`, { ep, show, script: SCRIPT });
    await run(`INSERT INTO episode_script_versions (id, episode_id, script_content, created_at) VALUES (:id, :ep, 'an earlier draft', NOW() - interval '2 days')`, { id: uuid(), ep });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, narrative_purpose, forward_hook, created_at, updated_at)
               VALUES (:id, :ep, :show, 'The first studio visit.', 'They want her as a model.', NOW(), NOW())`, { id: uuid(), ep, show });
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, label, s3_key_raw, url_raw, thumbnail_key, thumbnail_url, duration_seconds, beat_number, is_favorite, created_at, updated_at)
               VALUES (:id, :ep, :show, 'justawoman', 'First take', :key, :url, :tkey, :turl, 12.5, 1, true, NOW() - interval '1 day', NOW() - interval '1 day')`,
    { id: firstTake, ep, show, key: firstKey, url: `https://bucket/${firstKey}`, tkey: `episodes/${ep}/raw-clips/${firstTake}/thumbnail.jpg`, turl: 'https://bucket/first-thumb.jpg' });
    // Editing work that uses the first take: a Prime segment, the edit's revision, a saved version of the edit.
    const segment = uuid();
    await run(`INSERT INTO episode_prime_segments (id, episode_id, raw_clip_id, source_in_ms, source_out_ms, anchor_kind, anchor_beat, created_at, updated_at)
               VALUES (:id, :ep, :clip, 0, 12000, 'beat_start', 1, NOW(), NOW())`, { id: segment, ep, clip: firstTake });
    await run('INSERT INTO episode_edit_state (episode_id, edit_revision) VALUES (:ep, 7)', { ep });
    const snapshot = JSON.stringify({ segments: [{ id: segment, raw_clip_id: firstTake }] });
    await run(`INSERT INTO edit_versions (id, episode_id, name, snapshot, snapshot_sha256, edit_revision, script_revision, script_seq, created_at)
               VALUES (:id, :ep, 'Before the re-shoot', CAST(:snapshot AS jsonb), :sha, 7, :rev, 0, NOW())`,
    { id: uuid(), ep, snapshot, sha: crypto.createHash('sha256').update(snapshot).digest('hex'), rev: require('../../src/utils/scriptRevision').scriptRevision(SCRIPT, null) });
  });
  beforeEach(() => {
    multipart.reset();
    mockSend.mockReset();
    let part = 0;
    mockSend.mockImplementation(async (cmd) => {
      if (cmd.name === 'CreateMultipartUpload') return { UploadId: `up-${uuid()}` };
      if (cmd.name === 'UploadPart') { part += 1; return { ETag: `"etag-${part}"` }; }
      return {};
    });
    jest.spyOn(media, 'run').mockImplementation(async () => ({ stdout: Buffer.from(JSON.stringify({ format: { duration: '4.5' }, streams: [{ codec_type: 'video', width: 1080, height: 1920 }] })), stderr: Buffer.alloc(0) }));
    jest.spyOn(media, 'enqueueKey').mockImplementation(() => true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const table of ['edit_versions', 'episode_prime_segments', 'episode_scene_clips', 'timeline_items', 'episode_edit_state', 'voice_footage_jobs', 'episode_raw_clips', 'episode_script_versions', 'episode_briefs']) {
      // eslint-disable-next-line no-await-in-loop
      await run(`DELETE FROM ${table} WHERE episode_id = :ep`, { ep }).catch((err) => console.error(`[cleanup] ${table}:`, err.message));
    }
    await run('DELETE FROM episodes WHERE id = :ep', { ep }).catch((err) => console.error('[cleanup] episodes:', err.message));
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('[cleanup] shows:', err.message));
    await sequelize.close();
  });

  test('two new takes (one request, and in parts), then one made the favourite: script, brief, first take, edit history and storage are untouched', async () => {
    const before = await state();
    const [firstBefore] = await takes();
    const filmedBefore = await peekFrozen(sequelize, ep);
    expect(filmedBefore.frozen).toBe(true);

    // Take 2: the one-request upload, for the same beat as the first take.
    const stored = [];
    jest.spyOn(media, 'inspect').mockImplementation(async () => ({ duration_seconds: 4.5, width: 1080, height: 1920, thumbPath: null }));
    jest.spyOn(media, 'uploadFile').mockImplementation(async (_p, key) => { stored.push(key); return `https://bucket/${key}`; });
    const second = await auth(request(app).post(BASE)).field('performer', 'justawoman').field('label', 'Second take').field('beat_number', '1')
      .attach('video', Buffer.alloc(1024, 1), 'take2.mp4');
    expect(second.status).toBe(201);

    // Take 3: the in-part upload.
    const started = await auth(request(app).post(`${BASE}/uploads`)).send({ performer: 'justawoman', label: 'Third take', filename: 'take3.mp4', content_type: 'video/mp4', size: 3 * MB, beat_number: 1 });
    expect(started.status).toBe(201);
    expect((await auth(request(app).put(`${BASE}/uploads/${started.body.uploadId}/parts/1`)).set('Content-Type', 'application/octet-stream').send(Buffer.alloc(3 * MB, 1))).status).toBe(200);
    const third = await auth(request(app).post(`${BASE}/uploads/${started.body.uploadId}/complete`)).send({});
    expect(third.status).toBe(201);

    let all = await takes();
    expect(all).toHaveLength(3);
    const [first, ...added] = all;
    expect(first.id).toBe(firstTake);
    // Uploading alone changed nothing about the first take, its star included.
    expect(first).toEqual(firstBefore);
    // Each new take: its own id, its own folder, nothing shared with the first.
    const ids = new Set(all.map((c) => c.id));
    expect(ids.size).toBe(3);
    for (const c of added) {
      expect(c.s3_key_raw.startsWith(`episodes/${ep}/raw-clips/${c.id}/`)).toBe(true);
      expect(c.s3_key_raw).not.toBe(firstKey);
      expect(c.deleted_at).toBeNull();
      expect(c.is_favorite).toBe(false);
    }
    expect(await state()).toEqual(before);

    // Choose the second take for the beat.
    const secondId = added.find((c) => c.label === 'Second take').id;
    const star = await auth(request(app).patch(`${BASE}/${secondId}`)).send({ is_favorite: true });
    expect(star.status).toBe(200);

    all = await takes();
    const firstAfter = all.find((c) => c.id === firstTake);
    // The first take gave up the star, and that is all: same file, same thumbnail, not removed.
    const { is_favorite: favBefore, updated_at: _u1, ...restBefore } = firstBefore;
    const { is_favorite: favAfter, updated_at: _u2, ...restAfter } = firstAfter;
    expect([favBefore, favAfter]).toEqual([true, false]);
    expect(restAfter).toEqual(restBefore);
    expect(firstAfter.deleted_at).toBeNull();
    expect(all.filter((c) => c.is_favorite).map((c) => c.id)).toEqual([secondId]);

    // The script, its versions, the brief and the editing work: as they were.
    expect(await state()).toEqual(before);
    // Nothing was deleted from storage, and nothing was written under the first take's folder.
    expect(sent('DeleteObject')).toEqual([]);
    expect(sent('DeleteObjects')).toEqual([]);
    expect(sent('AbortMultipartUpload')).toEqual([]);
    const written = [...stored, ...sent('CreateMultipartUpload').map((c) => c.input.Key), ...sent('PutObject').map((c) => c.input.Key)];
    expect(written.length).toBeGreaterThan(0);
    expect(written.some((k) => k.startsWith(`episodes/${ep}/raw-clips/${firstTake}/`))).toBe(false);
    // Still filmed, and from the same moment.
    expect(await peekFrozen(sequelize, ep)).toEqual(filmedBefore);
  });
});
