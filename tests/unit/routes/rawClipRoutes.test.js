// ============================================================================
// Raw clips routes (/api/v1/episode-clips; Evoni, 2026-10-17): upload keeps
// the original and queues green removal when asked; only video is taken;
// remove-green re-queues; a clip already running is a 409. Mocked: no
// database, no S3, no ffmpeg (rawClipMedia is a jest mock).
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/rawClipMedia', () => {
  const os = require('os');
  const path = require('path');
  return {
    TMP_DIR: path.join(os.tmpdir(), 'raw-clips-test'),
    clipPrefix: (e, c) => `episodes/${e}/raw-clips/${c}`,
    inspect: jest.fn(async () => ({ duration_seconds: 12.5, width: 1920, height: 1080, thumbPath: null })),
    uploadFile: jest.fn(async (_p, key) => `https://bucket/${key}`),
    removeFile: jest.fn(async () => {}),
    enqueueKey: jest.fn(() => true),
    activeIds: jest.fn(() => []),
  };
});

const media = require('../../../src/services/rawClipMedia');
const router = require('../../../src/routes/rawClipRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/episode-clips', router);

const VIDEO = Buffer.from('not really a video, the media layer is mocked');

beforeEach(() => {
  mockQuery.mockReset();
  Object.values(media).forEach((fn) => fn?.mockClear?.());
  mockQuery.mockImplementation(async (sql, opts = {}) => {
    if (/FROM episodes WHERE id/.test(sql)) return [[{ id: 'ep-1', show_id: 'show-1' }]];
    if (/^\s*INSERT INTO episode_raw_clips/.test(sql)) return [[{ id: opts.replacements.id, performer: opts.replacements.performer, key_status: opts.replacements.keyStatus }]];
    if (/FROM episode_raw_clips/.test(sql) && /LIMIT 1/.test(sql)) return [[{ id: 'c1', episode_id: 'ep-1', s3_key_raw: 'episodes/ep-1/raw-clips/c1/original.mp4' }]];
    if (/^\s*UPDATE episode_raw_clips SET key_status/.test(sql)) return [[{ id: 'c1', key_status: opts.replacements.status, key_strength: opts.replacements.strength }]];
    return [[]];
  });
});

describe('POST /:episodeId (upload)', () => {
  test('a Lala clip on green screen is stored and its green removal queued', async () => {
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'lala').field('green_screen', 'true')
      .attach('video', VIDEO, { filename: 'take1.MP4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ performer: 'lala', key_status: 'queued' });
    expect(media.uploadFile).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/^episodes\/ep-1\/raw-clips\/.+\/original\.mp4$/), 'video/mp4');
    expect(media.enqueueKey).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ episodeId: 'ep-1', strength: 'medium', localPath: expect.any(String) }));
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({ showId: 'show-1', duration: 12.5, width: 1920, label: 'take1.MP4', originalFilename: 'take1.MP4' });
  });

  test('a guest clip without green screen is stored with no green removal', async () => {
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'guest').field('guest_name', 'Sage')
      .attach('video', VIDEO, { filename: 'guest.mov', contentType: 'video/quicktime' });
    expect(res.status).toBe(201);
    expect(res.body.data.key_status).toBe('none');
    expect(media.enqueueKey).not.toHaveBeenCalled();
    expect(media.removeFile).toHaveBeenCalled();
  });

  test('a non-video file is refused', async () => {
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'lala')
      .attach('video', Buffer.from('hi'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only video files/);
  });

  test('a missing performer is refused', async () => {
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .attach('video', VIDEO, { filename: 'a.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/performer must be one of/);
  });
});

describe('POST /:episodeId/:clipId/remove-green', () => {
  test('queues green removal at the strength asked', async () => {
    const res = await request(app).post('/api/v1/episode-clips/ep-1/c1/remove-green').send({ strength: 'high' });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ key_status: 'queued', key_strength: 'high' });
    expect(media.enqueueKey).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ clipId: 'c1', strength: 'high', s3KeyRaw: 'episodes/ep-1/raw-clips/c1/original.mp4' }));
  });

  test('a clip already running is a 409', async () => {
    media.activeIds.mockReturnValueOnce(['c1']);
    const res = await request(app).post('/api/v1/episode-clips/ep-1/c1/remove-green').send({});
    expect(res.status).toBe(409);
    expect(media.enqueueKey).not.toHaveBeenCalled();
  });
});

describe('GET, PATCH and DELETE', () => {
  test('list passes the running clips through', async () => {
    media.activeIds.mockReturnValueOnce(['c7']);
    const res = await request(app).get('/api/v1/episode-clips/ep-1');
    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1].replacements.activeIds).toEqual(['c7']);
  });

  test('delete of an unknown clip is a 404', async () => {
    const res = await request(app).delete('/api/v1/episode-clips/ep-1/nope');
    expect(res.status).toBe(404);
  });

  test('patch with nothing to change is a 400', async () => {
    const res = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({});
    expect(res.status).toBe(400);
  });
});
