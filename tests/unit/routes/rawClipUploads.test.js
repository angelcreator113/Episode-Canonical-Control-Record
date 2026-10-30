// ============================================================================
// Raw clips uploaded in parts, straight to S3 (Evoni, 2026-10-27: a 22-minute
// take failed with "ENOSPC: no space left on device"). Start, parts, complete
// (the clip row and the same answer as the one-request upload), abort, the
// wrong episode, a bad part number, a full disk answered in plain words
// (507), and the temp folder clean-up. Mocked: the S3 client, the signed
// link, ffprobe (rawClipMedia.run) and the database.
// ============================================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const command = (name) => class {
    constructor(input) { this.input = input; this.name = name; }
  };
  return {
    S3Client: class { send(cmd) { return mockSend(cmd); } },
    CreateMultipartUploadCommand: command('CreateMultipartUpload'),
    UploadPartCommand: command('UploadPart'),
    CompleteMultipartUploadCommand: command('CompleteMultipartUpload'),
    AbortMultipartUploadCommand: command('AbortMultipartUpload'),
    PutObjectCommand: command('PutObject'),
    GetObjectCommand: command('GetObject'),
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://bucket.example/signed-link') }));
jest.mock('../../../src/services/assetBucket', () => ({ ASSET_BUCKET: 'test-bucket', requireAssetBucket: () => 'test-bucket' }));

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a), transaction: async (fn) => fn('tx') } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const media = require('../../../src/services/rawClipMedia');
const multipart = require('../../../src/services/rawClipMultipart');
const errors = require('../../../src/services/rawClipErrors');
const router = require('../../../src/routes/rawClipRoutes');

const app = express();
app.use(express.json({ limit: '10mb', type: 'application/json' }));
app.use('/api/v1/episode-clips', router);

const MB = 1024 * 1024;
const BASE = '/api/v1/episode-clips/ep-1';
const sent = (name) => mockSend.mock.calls.map(([c]) => c).filter((c) => c.name === name);

let partNo = 0;
beforeEach(() => {
  multipart.reset();
  mockSend.mockReset();
  mockQuery.mockReset();
  partNo = 0;
  mockSend.mockImplementation(async (cmd) => {
    if (cmd.name === 'CreateMultipartUpload') return { UploadId: 'up-1' };
    if (cmd.name === 'UploadPart') { partNo += 1; return { ETag: `"etag-${cmd.input.PartNumber}-${partNo}"` }; }
    return {};
  });
  mockQuery.mockImplementation(async (sql, opts = {}) => {
    if (/FROM episodes WHERE id/.test(sql)) return opts.replacements.episodeId === 'ep-1' || opts.replacements.episodeId === 'ep-2' ? [[{ id: opts.replacements.episodeId, show_id: 'show-1' }]] : [[]];
    if (/^\s*INSERT INTO episode_raw_clips/.test(sql)) return [[{ id: opts.replacements.id, performer: opts.replacements.performer, label: opts.replacements.label, key_status: opts.replacements.keyStatus }]];
    if (/^\s*UPDATE episode_raw_clips SET (start_line|beat_marks)/.test(sql)) return [[{ id: opts.replacements.clipId, start_line: 2, beat_number: 3, is_favorite: false, has_take_fields: true }]];
    return [[]];
  });
  jest.spyOn(media, 'run').mockImplementation(async () => ({ stdout: Buffer.from(JSON.stringify({ format: { duration: '41.5' }, streams: [{ codec_type: 'video', width: 1080, height: 1920 }] })), stderr: '' }));
  jest.spyOn(media, 'uploadFile').mockImplementation(async (_p, key) => `https://bucket/${key}`);
  jest.spyOn(media, 'enqueueKey').mockImplementation(() => true);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const start = (body = {}) => request(app).post(`${BASE}/uploads`).send({
  performer: 'justawoman', label: 'Beat 3 · take 2', beat_number: 3, start_line: 2, seconds: 41.2,
  filename: 'beat-3-take-2.webm', content_type: 'video/webm', size: 10 * MB, ...body,
});
const putPart = (n, bytes, uploadId = 'up-1', ep = 'ep-1') => request(app)
  .put(`/api/v1/episode-clips/${ep}/uploads/${uploadId}/parts/${n}`)
  .set('Content-Type', 'application/octet-stream').send(Buffer.alloc(bytes, n));

describe('POST /:episodeId/uploads (start)', () => {
  test('starts an S3 multipart upload at the clip\'s key and answers the upload, the clip and 8 MB parts', async () => {
    const res = await start();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, uploadId: 'up-1', partSize: 8 * MB, parts: 2 });
    expect(res.body.key).toBe(`episodes/ep-1/raw-clips/${res.body.clipId}/original.webm`);
    const [create] = sent('CreateMultipartUpload');
    expect(create.input).toEqual({ Bucket: 'test-bucket', Key: res.body.key, ContentType: 'video/webm' });
  });

  test('validates like the one-request upload: performer, beat, video only, a size, at most 5 GB', async () => {
    expect((await start({ performer: 'nobody' })).body.error).toMatch(/performer must be one of/);
    expect((await start({ beat_number: 15 })).body.error).toMatch(/beat_number must be/);
    const notVideo = await start({ filename: 'notes.txt', content_type: 'text/plain' });
    expect(notVideo.status).toBe(400);
    expect(notVideo.body.error).toMatch(/Only video files/);
    expect((await start({ size: 0 })).status).toBe(400);
    const huge = await start({ size: 6 * 1024 * MB });
    expect(huge.status).toBe(413);
    expect(huge.body.error).toMatch(/over 5 GB/);
    expect((await request(app).post('/api/v1/episode-clips/ep-404/uploads').send({ performer: 'lala', size: 10, filename: 'a.mp4' })).status).toBe(404);
    expect(sent('CreateMultipartUpload')).toHaveLength(0);
  });
});

describe('PUT /:episodeId/uploads/:uploadId/parts/:partNumber', () => {
  test('sends the part on to S3 and keeps its ETag; sending it again replaces it', async () => {
    await start();
    const one = await putPart(1, 8 * MB);
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ success: true, partNumber: 1, etag: '"etag-1-1"' });
    const again = await putPart(1, 8 * MB);
    expect(again.body.etag).toBe('"etag-1-2"');
    const uploads = sent('UploadPart');
    expect(uploads).toHaveLength(2);
    expect(uploads[0].input).toMatchObject({ Bucket: 'test-bucket', UploadId: 'up-1', PartNumber: 1, ContentLength: 8 * MB });
    expect(multipart.get('up-1').parts.get(1).etag).toBe('"etag-1-2"');
  });

  test('a bad part number is a 400, and so is one past the last part', async () => {
    await start();
    for (const n of ['0', '10001', 'abc', '1.5']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await putPart(n, 10);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/part number must be a whole number from 1 to 10000/);
    }
    const past = await putPart(3, 10);
    expect(past.status).toBe(400);
    expect(past.body.error).toMatch(/only 2 parts/);
    expect(sent('UploadPart')).toHaveLength(0);
  });

  test('a part of the wrong size is refused (it arrived incomplete)', async () => {
    await start();
    const res = await putPart(1, 5 * MB);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/arrived incomplete/);
  });

  test('another episode\'s upload, or an unknown one, is a 404', async () => {
    await start();
    const wrongEp = await putPart(1, 8 * MB, 'up-1', 'ep-2');
    expect(wrongEp.status).toBe(404);
    expect((await putPart(1, 8 * MB, 'nope')).status).toBe(404);
    expect((await request(app).post('/api/v1/episode-clips/ep-2/uploads/up-1/complete').send({})).status).toBe(404);
    expect((await request(app).delete('/api/v1/episode-clips/ep-2/uploads/up-1')).status).toBe(404);
    expect(sent('UploadPart')).toHaveLength(0);
    expect(sent('AbortMultipartUpload')).toHaveLength(0);
  });
});

describe('POST /:episodeId/uploads/:uploadId/complete', () => {
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');

  test('joins the parts in order, stores the browser\'s thumbnail, creates the clip like the one-request upload', async () => {
    const { body: started } = await start({ beat_marks: JSON.stringify([{ beat: 3, t: 0 }]) });
    await putPart(2, 2 * MB);
    await putPart(1, 8 * MB);
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({ thumbnail: `data:image/jpeg;base64,${JPEG}` });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, stored: ['start_line', 'beat_marks'], not_stored: [] });
    expect(res.body.data).toMatchObject({ id: started.clipId, performer: 'justawoman', start_line: 2, beat_number: 3 });
    const [complete] = sent('CompleteMultipartUpload');
    expect(complete.input.MultipartUpload.Parts).toEqual([{ PartNumber: 1, ETag: '"etag-1-2"' }, { PartNumber: 2, ETag: '"etag-2-1"' }]);
    const [thumb] = sent('PutObject');
    expect(thumb.input).toMatchObject({ Key: `episodes/ep-1/raw-clips/${started.clipId}/thumbnail.jpg`, ContentType: 'image/jpeg' });
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({
      id: started.clipId, showId: 'show-1', beatNumber: 3, label: 'Beat 3 · take 2', originalFilename: 'beat-3-take-2.webm',
      size: 10 * MB, duration: 41.5, width: 1080, height: 1920, keyRaw: started.key,
    });
    // ffprobe read the signed link, never a downloaded copy.
    expect(media.run).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['https://bucket.example/signed-link']), expect.objectContaining({ timeoutMs: expect.any(Number) }));
    expect(sent('GetObject')).toHaveLength(0);
    expect(media.enqueueKey).not.toHaveBeenCalled();
    // Asked again (the answer lost on the way): the same clip, nothing joined or inserted twice.
    const again = await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(started.clipId);
    expect(sent('CompleteMultipartUpload')).toHaveLength(1);
    expect(mockQuery.mock.calls.filter(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))).toHaveLength(1);
  });

  test('ffprobe failing keeps the browser\'s length; green screen queues removal from S3 (no local file)', async () => {
    media.run.mockRejectedValue(new Error('ffprobe failed: took too long and was stopped'));
    const { body: started } = await start({ performer: 'lala', green_screen: 'true', size: 3 * MB, beat_number: undefined, start_line: undefined });
    await putPart(1, 3 * MB);
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ stored: [], not_stored: [] });
    expect(res.body.data.key_status).toBe('queued');
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert.duration).toBe(41.2);
    expect(media.enqueueKey).toHaveBeenCalledWith(expect.anything(), { clipId: started.clipId, episodeId: 'ep-1', s3KeyRaw: started.key, strength: 'medium', durationSeconds: 41.2 });
  });

  test('voice from footage (V2): the joined clip is offered to the voice queue with its uploader; the upload never waits on it', async () => {
    const voiceFootage = require('../../../src/services/voiceFootageJobs');
    const offered = jest.spyOn(voiceFootage, 'onClipUploaded').mockResolvedValue(null);
    const { body: started } = await start({ performer: 'lala', size: 3 * MB, beat_number: undefined, start_line: undefined });
    await putPart(1, 3 * MB);
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    expect(res.status).toBe(201);
    expect(offered).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({ id: started.clipId, episode_id: 'ep-1', performer: 'lala', s3_key_raw: started.key }),
      { userId: expect.anything() });
    offered.mockRestore();
  });

  test('missing parts are a 409 that names them', async () => {
    await start();
    await putPart(1, 8 * MB);
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    expect(res.status).toBe(409);
    expect(res.body.missing).toEqual([2]);
    expect(sent('CompleteMultipartUpload')).toHaveLength(0);
  });

  test('an S3 refusal is answered in plain words, never the raw code', async () => {
    await start({ size: 3 * MB });
    await putPart(1, 3 * MB);
    mockSend.mockImplementation(async (cmd) => {
      if (cmd.name === 'CompleteMultipartUpload') throw Object.assign(new Error('AccessDenied: User is not authorized'), { name: 'AccessDenied', $fault: 'client', $metadata: { httpStatusCode: 403 } });
      return {};
    });
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toBe(errors.STORAGE_REFUSED);
    expect(res.body.error).not.toMatch(/AccessDenied/);
  });
});

describe('DELETE /:episodeId/uploads/:uploadId (abort)', () => {
  test('aborts the S3 upload and forgets it', async () => {
    await start();
    const res = await request(app).delete(`${BASE}/uploads/up-1`);
    expect(res.status).toBe(200);
    const [abort] = sent('AbortMultipartUpload');
    expect(abort.input).toEqual({ Bucket: 'test-bucket', Key: expect.stringMatching(/original\.webm$/), UploadId: 'up-1' });
    expect(multipart.get('up-1')).toBeNull();
    expect((await putPart(1, 8 * MB)).status).toBe(404);
  });

  test('uploads left over 6 hours are aborted by the sweep', async () => {
    await start();
    expect(await multipart.sweepExpired(Date.now() + 1000)).toEqual([]);
    expect(await multipart.sweepExpired(Date.now() + 6 * 60 * 60 * 1000 + 1000)).toEqual(['up-1']);
    expect(sent('AbortMultipartUpload')).toHaveLength(1);
    expect(multipart.get('up-1')).toBeNull();
  });
});

describe('a full disk, in plain words (ENOSPC → 507)', () => {
  test('friendlyError maps ENOSPC and EDQUOT to 507 and S3 / network faults to plain messages', () => {
    expect(errors.friendlyError(Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }))).toEqual({ status: 507, message: errors.NO_ROOM });
    expect(errors.friendlyError(new Error('EDQUOT: disk quota exceeded')).status).toBe(507);
    expect(errors.friendlyError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))).toEqual({ status: 503, message: errors.STORAGE_UNREACHABLE });
    expect(errors.friendlyError(Object.assign(new Error('x'), { name: 'NoSuchUpload', $metadata: {} })).status).toBe(404);
    expect(errors.friendlyError(new Error('Cannot read properties of undefined'))).toEqual({ status: 500, message: errors.SOMETHING_WRONG });
    expect(errors.NO_ROOM).toBe('The server ran out of room while saving this take. Your take is still safe on this phone — tap Retry later.');
  });

  test('the one-request upload answers 507 with the friendly message when writing fails with ENOSPC', async () => {
    jest.spyOn(media, 'inspect').mockRejectedValue(Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC', errno: -28 }));
    const res = await request(app).post(BASE)
      .field('performer', 'justawoman')
      .attach('video', Buffer.from('a take'), { filename: 'take.webm', contentType: 'video/webm' });
    expect(res.status).toBe(507);
    expect(res.body).toEqual({ success: false, error: errors.NO_ROOM });
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/upload failed \(507\)/), 'ENOSPC', expect.stringMatching(/ENOSPC/));
  });

  test('the one-request upload is refused up front (507) when the disk has no room for it', async () => {
    jest.spyOn(media, 'freeBytes').mockResolvedValue(10 * MB);
    const res = await request(app).post(BASE)
      .field('performer', 'justawoman')
      .attach('video', Buffer.from('a take'), { filename: 'take.webm', contentType: 'video/webm' });
    expect(res.status).toBe(507);
    expect(res.body.error).toBe(errors.NO_ROOM);
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))).toBe(false);
  });
});

describe('the temp folder clean-up (sweepTmp)', () => {
  test('removes files older than 6 hours, keeps newer ones and any a job still uses, and logs what went', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-clips-sweep-'));
    const old = path.join(dir, 'old-upload.webm');
    const busy = path.join(dir, 'job-original.mp4');
    const fresh = path.join(dir, 'fresh.webm');
    [old, busy, fresh].forEach((f) => fs.writeFileSync(f, 'x'));
    const sevenHoursAgo = (Date.now() - 7 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(old, sevenHoursAgo, sevenHoursAgo);
    fs.utimesSync(busy, sevenHoursAgo, sevenHoursAgo);
    const removed = await media.sweepTmp({ dir, busy: new Set([busy]) });
    expect(removed).toEqual(['old-upload.webm']);
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(busy)).toBe(true);
    expect(fs.existsSync(fresh)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/temp clean-up removed 1 file/), 'old-upload.webm');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a temp folder that is not there yet is nothing to do', async () => {
    expect(await media.sweepTmp({ dir: path.join(os.tmpdir(), `raw-clips-none-${Date.now()}`) })).toEqual([]);
  });
});

// Evoni, 2026-10-28: a 453 MB phone MP4 uploaded on Assets → Files showed
// only "453 MB" (no length, size or picture). The browser now measures
// every upload; the server takes its length, width, height and thumbnail
// whenever ffprobe gives nothing, and ffprobe can't hold the upload up.
describe('the browser\'s measure when ffprobe gives nothing (2026-10-28)', () => {
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');
  const filesUpload = (body = {}) => start({
    performer: 'justawoman', label: undefined, beat_number: undefined, start_line: undefined,
    filename: 'phone.mp4', content_type: 'video/mp4', size: 3 * MB, seconds: 481.4, width: 1080, height: 1920, ...body,
  });

  test('ffprobe failing over the link: the browser\'s length, width, height and thumbnail are kept', async () => {
    media.run.mockRejectedValue(new Error('ffprobe failed: https protocol not found'));
    const { body: started } = await filesUpload();
    await putPart(1, 3 * MB);
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({ thumbnail: `data:image/jpeg;base64,${JPEG}` });
    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({ duration: 481.4, width: 1080, height: 1920, thumbKey: `episodes/ep-1/raw-clips/${started.clipId}/thumbnail.jpg` });
    expect(sent('PutObject')).toHaveLength(1);
  });

  test('ffprobe answering with no length (a fragmented MP4: "N/A") keeps the browser\'s length; its own size wins', async () => {
    media.run.mockResolvedValue({ stdout: Buffer.from(JSON.stringify({ format: { duration: 'N/A' }, streams: [{ codec_type: 'video', width: 720, height: 1280 }] })), stderr: '' });
    await filesUpload();
    await putPart(1, 3 * MB);
    await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({ duration: 481.4, width: 720, height: 1280 });
  });

  test('an ffprobe that never answers is left behind: the clip is saved with the browser\'s measure', async () => {
    media.run.mockImplementation(() => new Promise(() => {}));
    const info = await multipart.probe('https://bucket.example/signed-link', { timeoutMs: 10, hardStopMs: 10 });
    expect(info).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/was not measured/), expect.stringMatching(/did not answer in time/));
  });

  test('a bad width or height is left out, not a refusal', async () => {
    media.run.mockRejectedValue(new Error('ffprobe failed'));
    const res = await filesUpload({ width: 'wide', height: -3 });
    expect(res.status).toBe(201);
    await putPart(1, 3 * MB);
    await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({ width: null, height: null });
  });
});

describe('end_beat_number with the upload (2026-10-28)', () => {
  test('an end beat with no start beat is refused before anything is sent to S3', async () => {
    const res = await start({ beat_number: undefined, end_beat_number: 11 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Pick the beat the clip starts on/);
    expect((await start({ beat_number: 5, end_beat_number: 3 })).status).toBe(400);
    expect(sent('CreateMultipartUpload')).toHaveLength(0);
  });

  test('kept after the row is made; before the database update it is reported not stored and the clip is saved', async () => {
    mockQuery.mockImplementation(async (sql, opts = {}) => {
      if (/FROM episodes WHERE id/.test(sql)) return [[{ id: 'ep-1', show_id: 'show-1' }]];
      if (/^\s*INSERT INTO episode_raw_clips/.test(sql)) return [[{ id: opts.replacements.id, beat_number: opts.replacements.beatNumber }]];
      if (/^\s*SELECT beat_number/.test(sql)) return [[{ beat_number: 1, has_end_beat: false }]];
      return [[]];
    });
    await start({ beat_number: 1, end_beat_number: 11, start_line: undefined, size: 3 * MB });
    await putPart(1, 3 * MB);
    const res = await request(app).post(`${BASE}/uploads/up-1/complete`).send({});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ stored: [], not_stored: ['end_beat_number'] });
    expect(res.body.data.beat_number).toBe(1);
  });
});

// Saving while recording (Evoni, 2026-10-28): the upload starts before the
// take's size is known; parts are checked again once complete brings it.
describe('an upload begun while the take records (size_unknown)', () => {
  const startLive = (body = {}) => start({ size: undefined, size_unknown: true, ...body });
  const complete = (body) => request(app).post(`${BASE}/uploads/up-1/complete`).send(body);

  test('starts without a size; a part of 1 byte to 8 MB is taken; no part past 5 GB worth (640)', async () => {
    const res = await startLive();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ uploadId: 'up-1', partSize: 8 * MB, parts: null });
    expect(multipart.get('up-1').size).toBeNull();
    expect((await putPart(2, 8 * MB)).status).toBe(200);
    expect((await putPart(3, 1234)).status).toBe(200);
    expect((await putPart(641, 10)).body.error).toMatch(/only 640 parts/);
    expect((await putPart(4, 0)).status).toBe(400);
    expect(sent('UploadPart')).toHaveLength(2);
  });

  test('still needs size_unknown: true to leave the size out (an old page that forgets it is a 400)', async () => {
    expect((await start({ size: undefined })).status).toBe(400);
    expect((await start({ size: undefined, size_unknown: 'yes' })).status).toBe(400);
  });

  test('complete needs the size; every part but the last must be exactly 8 MB, else it is missing (409)', async () => {
    await startLive();
    await putPart(1, 8 * MB);
    await putPart(2, 3 * MB); // sent short while recording (cannot be: it is not the last)
    await putPart(3, 2 * MB);
    expect((await complete({})).body.error).toMatch(/size of the take was not sent/);
    const short = await complete({ size: 18 * MB });
    expect(short.status).toBe(409);
    expect(short.body.missing).toEqual([2]);
    expect(multipart.get('up-1').size).toBe(18 * MB);
    // Once the size is known, a part must be exactly its size.
    expect((await putPart(2, 3 * MB)).status).toBe(400);
    expect((await putPart(2, 8 * MB)).status).toBe(200);
    // A size that differs from the one now fixed is refused.
    expect((await complete({ size: 19 * MB })).status).toBe(400);
    const done = await complete({ size: 18 * MB });
    expect(done.status).toBe(201);
    expect(sent('CompleteMultipartUpload')[0].input.MultipartUpload.Parts.map((p) => p.PartNumber)).toEqual([1, 2, 3]);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert.size).toBe(18 * MB);
  });

  test('a part past the last (the take ended shorter) is left out of the join', async () => {
    await startLive();
    await putPart(1, 8 * MB);
    await putPart(2, 5);
    await putPart(3, 7);
    const res = await complete({ size: 8 * MB + 5 });
    expect(res.status).toBe(201);
    expect(sent('CompleteMultipartUpload')[0].input.MultipartUpload.Parts.map((p) => p.PartNumber)).toEqual([1, 2]);
  });

  test('a bad or too-big size at complete is refused before anything is joined', async () => {
    await startLive();
    await putPart(1, 10);
    expect((await complete({ size: -1 })).status).toBe(400);
    expect((await complete({ size: 'big' })).status).toBe(400);
    expect((await complete({ size: 6 * 1024 * MB })).status).toBe(413);
    expect(sent('CompleteMultipartUpload')).toHaveLength(0);
  });

  test('the fields that exist only once the take ends come with complete, validated the same way', async () => {
    await startLive({ label: 'Full episode · take 4', beat_number: undefined, start_line: undefined, seconds: undefined });
    await putPart(1, 10);
    expect((await complete({ size: 10, fields: { beat_number: 99 } })).body.error).toMatch(/beat_number must be/);
    expect((await complete({ size: 10, fields: 'nope' })).status).toBe(400);
    media.run.mockRejectedValue(new Error('ffprobe failed'));
    const res = await complete({ size: 10, fields: { beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 61.5 }], seconds: 300.4, width: 720, height: 1280, performer: 'lala' } });
    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({ duration: 300.4, width: 720, height: 1280, performer: 'lala', label: 'Full episode · take 4' });
    const marks = mockQuery.mock.calls.find(([sql]) => /beat_marks/.test(sql) && /UPDATE/.test(sql));
    expect(marks).toBeTruthy();
  });

  test('a known-size upload still completes with no size, or the same one; a different size is a 400', async () => {
    await start({ size: 3 * MB });
    await putPart(1, 3 * MB);
    expect((await complete({ size: 4 * MB })).status).toBe(400);
    expect((await complete({ size: 3 * MB })).status).toBe(201);
  });
});
