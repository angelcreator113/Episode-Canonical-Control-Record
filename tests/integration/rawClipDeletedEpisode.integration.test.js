/**
 * A1.3-0 (C1): a take whose episode was deleted while it uploaded is not
 * saved, and only its own stored files are removed. On the test database,
 * through the real clip routes (multipart and one-request) and the real
 * episode delete route, with the S3 client stubbed so every call is recorded:
 *   T1  delete first, then attach: 409 CLIP_EPISODE_DELETED, no row, both of
 *       this upload's keys deleted (multipart and one-request);
 *   T2  attach first, then delete: the clip is saved, the delete is refused
 *       as filmed (A1.2c);
 *   T3  a retried complete after the refusal: the same 409, no second clean-up;
 *   T3a a replay after a successful attach (the row exists), then the episode
 *       is deleted: the existing row is returned and nothing is deleted;
 *   T3b the thumbnail delete fails: the 409 still answers, one
 *       [raw-clip-orphan] line names the thumbnail key;
 *   T3c a removed clip row references the key: nothing is deleted;
 *   T4  valid uploads to a live episode: 201 as before, nothing deleted;
 * and the clean-up never touches a key outside the upload's own prefix.
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

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clips = require('../../src/services/rawClipsService');
const media = require('../../src/services/rawClipMedia');
const multipart = require('../../src/services/rawClipMultipart');
const { cleanupRefusedUpload } = require('../../src/routes/rawClipRoutes');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const MB = 1024 * 1024;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');
const sent = (name) => mockSend.mock.calls.map(([c]) => c).filter((c) => c.name === name);
const deletedKeys = () => sent('DeleteObject').map((c) => c.input.Key);

(shouldSkip ? describe.skip : describe)('A1.3-0 (C1): a take for a deleted episode is refused, and only its own files are cleaned up', () => {
  const show = uuid();
  const episodes = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const BASE = (ep) => `/api/v1/episode-clips/${ep}`;

  async function addEpisode() {
    const id = uuid();
    episodes.push(id);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, 'Clip refusal', 1, 'draft', NOW(), NOW())`, { id, show });
    return id;
  }
  const softDelete = (ep) => run('UPDATE episodes SET deleted_at = NOW() WHERE id = :ep', { ep });
  const clipRows = (ep) => rows('SELECT id, deleted_at FROM episode_raw_clips WHERE episode_id = :ep', { ep });
  const start = (ep, body = {}) => auth(request(app).post(`${BASE(ep)}/uploads`)).send({
    performer: 'lala', label: 'Take', filename: 'take.mp4', content_type: 'video/mp4', size: 3 * MB, ...body,
  });
  const putPart = (ep, uploadId, n, bytes) => auth(request(app).put(`${BASE(ep)}/uploads/${uploadId}/parts/${n}`))
    .set('Content-Type', 'application/octet-stream').send(Buffer.alloc(bytes, n));
  const complete = (ep, uploadId, body = {}) => auth(request(app).post(`${BASE(ep)}/uploads/${uploadId}/complete`)).send(body);
  async function uploadedMultipart(ep) {
    const started = await start(ep);
    expect(started.status).toBe(201);
    expect((await putPart(ep, started.body.uploadId, 1, 3 * MB)).status).toBe(200);
    return started.body;
  }

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-clip-refusal', email: 'clips@refusal.dev', name: 'Clips', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `clip-refusal-${show.slice(0, 8)}` });
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
    jest.spyOn(media, 'run').mockImplementation(async () => ({ stdout: Buffer.from(JSON.stringify({ format: { duration: '4.5' }, streams: [{ codec_type: 'video', width: 1080, height: 1920 }] })), stderr: '' }));
    jest.spyOn(media, 'enqueueKey').mockImplementation(() => true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM episode_raw_clips WHERE episode_id IN (:episodes)', { episodes }).catch(() => {});
    await run('DELETE FROM episodes WHERE id IN (:episodes)', { episodes }).catch(() => {});
    await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    await sequelize.close();
  });

  const orphanLines = () => console.error.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[raw-clip-orphan] '))
    .map((l) => JSON.parse(l.slice('[raw-clip-orphan] '.length)));

  test('T1 (multipart): deleted before complete: 409, no row, both of its keys deleted', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    await softDelete(ep);
    const res = await complete(ep, up.uploadId, { thumbnail: `data:image/jpeg;base64,${JPEG}` });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'CLIP_EPISODE_DELETED' });
    expect(await clipRows(ep)).toEqual([]);
    const prefix = `episodes/${ep}/raw-clips/${up.clipId}/`;
    expect(deletedKeys().sort()).toEqual([`${prefix}original.mp4`, `${prefix}thumbnail.jpg`].sort());
    expect(orphanLines()).toEqual([]);
  });

  test('T3: a retried complete after the refusal: the same 409, no second clean-up', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    await softDelete(ep);
    expect((await complete(ep, up.uploadId)).status).toBe(409);
    const firstDeletes = deletedKeys();
    expect(firstDeletes).toHaveLength(1); // no thumbnail was sent: only the original
    const again = await complete(ep, up.uploadId);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('CLIP_EPISODE_DELETED');
    expect(deletedKeys()).toEqual(firstDeletes);
    expect(sent('CompleteMultipartUpload')).toHaveLength(1);
    expect(await clipRows(ep)).toEqual([]);
  });

  test('T1 (one request): deleted while the file was stored: 409, no row, both of its keys deleted', async () => {
    const ep = await addEpisode();
    const thumb = path.join(os.tmpdir(), `thumb-${uuid()}.jpg`);
    fs.writeFileSync(thumb, Buffer.from(JPEG, 'base64'));
    jest.spyOn(media, 'inspect').mockImplementation(async () => ({ duration_seconds: 4.5, width: 1080, height: 1920, thumbPath: thumb }));
    const stored = [];
    jest.spyOn(media, 'uploadFile').mockImplementation(async (_p, key) => {
      stored.push(key);
      if (stored.length === 1) await softDelete(ep); // the episode is deleted mid-upload
      return `https://bucket/${key}`;
    });
    const res = await auth(request(app).post(BASE(ep))).field('performer', 'lala').attach('video', Buffer.alloc(1024, 1), 'take.mp4');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLIP_EPISODE_DELETED');
    expect(await clipRows(ep)).toEqual([]);
    expect(deletedKeys().sort()).toEqual([...stored].sort());
    expect(stored.every((k) => k.startsWith(`episodes/${ep}/raw-clips/`))).toBe(true);
    fs.rmSync(thumb, { force: true });
  });

  test('T2: attached first, then the delete: the clip is saved and the delete is refused as filmed', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    const res = await complete(ep, up.uploadId);
    expect(res.status).toBe(201);
    const del = await auth(request(app).delete(`/api/v1/episodes/${ep}`));
    expect(del.status).toBe(409);
    expect((await rows('SELECT deleted_at FROM episodes WHERE id = :ep', { ep }))[0].deleted_at).toBeNull();
    expect(await clipRows(ep)).toHaveLength(1);
    expect(deletedKeys()).toEqual([]);
  });

  test('T3a: a replay after a successful attach, then the episode deleted: the existing row, nothing deleted', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    const first = await complete(ep, up.uploadId);
    expect(first.status).toBe(201);
    await softDelete(ep); // simulated: the A1.2c route refuses this delete (T2)
    // The route answers from memory (the same clip) ...
    const again = await complete(ep, up.uploadId);
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(up.clipId);
    // ... and the attach itself, asked again (memory lost), returns the existing row.
    const replay = await clips.createClip(sequelize, { id: up.clipId, episode_id: ep, show_id: show, performer: 'lala', s3_key_raw: up.key });
    expect(replay.id).toBe(up.clipId);
    expect(deletedKeys()).toEqual([]);
    expect(await clipRows(ep)).toHaveLength(1);
  });

  test('T3b: the thumbnail delete fails: the 409 still answers; one [raw-clip-orphan] line names the thumbnail key', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    await softDelete(ep);
    const base = mockSend.getMockImplementation();
    mockSend.mockImplementation(async (cmd) => {
      if (cmd.name === 'DeleteObject' && /thumbnail\.jpg$/.test(cmd.input.Key)) throw Object.assign(new Error('SlowDown'), { name: 'SlowDown' });
      return base(cmd);
    });
    const res = await complete(ep, up.uploadId, { thumbnail: `data:image/jpeg;base64,${JPEG}` });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLIP_EPISODE_DELETED');
    const prefix = `episodes/${ep}/raw-clips/${up.clipId}/`;
    expect(deletedKeys().sort()).toEqual([`${prefix}original.mp4`, `${prefix}thumbnail.jpg`].sort()); // both attempted
    const lines = orphanLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ episode_id: ep, clip_id: up.clipId, key: `${prefix}thumbnail.jpg` });
    expect(lines[0].reason).toMatch(/delete failed/);
    expect(typeof lines[0].at).toBe('string');
  });

  test('T3c: a removed clip row references the key: nothing is deleted', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    // Simulated: another (removed) row names this upload's original key.
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, deleted_at, created_at, updated_at)
               VALUES (:id, :ep, :show, 'lala', :key, NOW(), NOW(), NOW())`, { id: uuid(), ep, show, key: up.key });
    await softDelete(ep);
    const res = await complete(ep, up.uploadId);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLIP_EPISODE_DELETED');
    expect(deletedKeys()).toEqual([]);
  });

  test('T4: valid uploads to a live episode: 201 as before, nothing deleted', async () => {
    const ep = await addEpisode();
    const up = await uploadedMultipart(ep);
    const res = await complete(ep, up.uploadId, { thumbnail: `data:image/jpeg;base64,${JPEG}` });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: up.clipId, episode_id: ep });

    const thumb = path.join(os.tmpdir(), `thumb-${uuid()}.jpg`);
    fs.writeFileSync(thumb, Buffer.from(JPEG, 'base64'));
    jest.spyOn(media, 'inspect').mockImplementation(async () => ({ duration_seconds: 4.5, width: 1080, height: 1920, thumbPath: thumb }));
    jest.spyOn(media, 'uploadFile').mockImplementation(async (_p, key) => `https://bucket/${key}`);
    const one = await auth(request(app).post(BASE(ep))).field('performer', 'lala').field('green_screen', 'true').attach('video', Buffer.alloc(1024, 1), 'take.mp4');
    expect(one.status).toBe(201);
    expect(media.enqueueKey).toHaveBeenCalledTimes(1); // the green removal is still handed over
    expect(await clipRows(ep)).toHaveLength(2);
    expect(deletedKeys()).toEqual([]);
    fs.rmSync(thumb, { force: true });
  });

  test('the clean-up deletes only keys under the upload\'s own prefix, one exact key at a time', async () => {
    const ep = await addEpisode();
    const clipId = uuid();
    const own = `episodes/${ep}/raw-clips/${clipId}/original.mp4`;
    const out = await cleanupRefusedUpload({ episodeId: ep, clipId, keys: [
      own,
      `episodes/${ep}/raw-clips/${uuid()}/original.mp4`, // another clip's
      `episodes/${ep}/raw-clips/${clipId}/`, // the prefix itself
      `episodes/${uuid()}/raw-clips/${clipId}/original.mp4`, // another episode's
      null,
    ] });
    expect(out).toEqual({ deleted: [own], kept: [], failed: [] });
    expect(deletedKeys()).toEqual([own]);
    expect(sent('ListObjectsV2')).toHaveLength(0);
  });
});
