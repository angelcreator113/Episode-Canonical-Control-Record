// ============================================================================
// Raw clips routes (/api/v1/episode-clips; Evoni, 2026-10-17): upload keeps
// the original and queues green removal when asked; only video is taken;
// remove-green re-queues; a clip already running is a 409. Mocked: no
// database, no S3, no ffmpeg (rawClipMedia is a jest mock).
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a), transaction: async (fn) => fn('tx') } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); }, authorize: () => (_req, _res, next) => next() };
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
    keyProgress: jest.fn(() => ({})),
    roomToKey: jest.fn(async () => ({ ok: true, needs: 721 * 1048576, free: 2600 * 1048576 })),
  };
});

jest.mock('../../../src/services/voiceFootageJobs', () => ({ onClipUploaded: jest.fn(async () => null) }));

const media = require('../../../src/services/rawClipMedia');
const voiceFootage = require('../../../src/services/voiceFootageJobs');
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

  test('voice from footage (V2): every new clip is offered to the voice queue, which decides (Lala only, flag on); the upload never waits on it', async () => {
    voiceFootage.onClipUploaded.mockClear();
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'lala').field('green_screen', 'true')
      .attach('video', VIDEO, { filename: 'take2.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(voiceFootage.onClipUploaded).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({ episode_id: 'ep-1', performer: 'lala', s3_key_raw: expect.stringMatching(/^episodes\/ep-1\/raw-clips\/.+\/original\.mp4$/) }),
      { userId: 'u1' });
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

describe('POST /:episodeId with a teleprompter take\'s fields (Teleprompter audit 8, 9, 14)', () => {
  test('beat_number goes in the INSERT; start_line and beat_marks are kept and reported as stored', async () => {
    const base = mockQuery.getMockImplementation();
    mockQuery.mockImplementation(async (sql, opts) => {
      if (/^\s*UPDATE episode_raw_clips SET (start_line|beat_marks)/.test(sql)) return [[{ id: opts.replacements.clipId, beat_number: 3, start_line: 2, is_favorite: false, has_take_fields: true }]];
      return base(sql, opts);
    });
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'justawoman').field('label', 'Beat 3 · take 1').field('beat_number', '3').field('start_line', '2')
      .field('beat_marks', JSON.stringify([{ beat: 3, t: 0 }])).field('seconds', '41.2')
      .attach('video', VIDEO, { filename: 'beat-3-take-1.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(201);
    expect(res.body.stored).toEqual(['start_line', 'beat_marks']);
    expect(res.body.not_stored).toEqual([]);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert).toMatchObject({ beatNumber: 3, duration: 12.5 });
    const updates = mockQuery.mock.calls.filter(([sql]) => /^\s*UPDATE episode_raw_clips SET (start_line|beat_marks)/.test(sql));
    expect(updates).toHaveLength(2);
    expect(res.body.data).toMatchObject({ performer: 'justawoman', start_line: 2, beat_number: 3 });
  });

  test('before the migrations the clip is still saved and the fields are reported not_stored', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const base = mockQuery.getMockImplementation();
    mockQuery.mockImplementation(async (sql, opts) => {
      if (/^\s*UPDATE episode_raw_clips SET start_line/.test(sql)) throw Object.assign(new Error('column "start_line" of relation "episode_raw_clips" does not exist'), { original: { code: '42703' } });
      if (/^\s*UPDATE episode_raw_clips SET beat_marks/.test(sql)) throw Object.assign(new Error('column "beat_marks" of relation "episode_raw_clips" does not exist'), { original: { code: '42703' } });
      return base(sql, opts);
    });
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'justawoman').field('start_line', '0').field('beat_marks', '[{"beat":1,"t":0}]')
      .attach('video', VIDEO, { filename: 'full.webm', contentType: 'video/webm' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, stored: [], not_stored: ['start_line', 'beat_marks'] });
    spy.mockRestore();
  });

  test('a bad beat field is a 400 by the PATCH rules, and the refusal is logged at warn', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'lala').field('beat_number', '15')
      .attach('video', VIDEO, { filename: 'a.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/beat_number must be/);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/upload refused \(400\)/), expect.stringMatching(/beat_number/));
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))).toBe(false);
    warn.mockRestore();
  });

  test('when ffprobe has no length, the take\'s own seconds are kept', async () => {
    media.inspect.mockResolvedValueOnce({ duration_seconds: null, width: 1280, height: 720, thumbPath: null });
    const res = await request(app).post('/api/v1/episode-clips/ep-1')
      .field('performer', 'justawoman').field('seconds', '63.5')
      .attach('video', VIDEO, { filename: 'take.webm', contentType: 'video/webm' });
    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO episode_raw_clips/.test(sql))[1].replacements;
    expect(insert.duration).toBe(63.5);
    expect(res.body).toMatchObject({ stored: [], not_stored: [] });
  });
});

describe('POST /:episodeId/:clipId/remove-green', () => {
  test('queues green removal at the strength asked', async () => {
    const res = await request(app).post('/api/v1/episode-clips/ep-1/c1/remove-green').send({ strength: 'high' });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ key_status: 'queued', key_strength: 'high' });
    expect(media.enqueueKey).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ clipId: 'c1', strength: 'high', s3KeyRaw: 'episodes/ep-1/raw-clips/c1/original.mp4' }));
  });

  test('passes the clip\'s length (for the disk check) and whether it has a cut-out (for the message) to the job', async () => {
    mockQuery.mockImplementation(async (sql, opts = {}) => {
      if (/FROM episode_raw_clips/.test(sql) && /LIMIT 1/.test(sql)) return [[{ id: 'c1', episode_id: 'ep-1', s3_key_raw: 'k', duration_seconds: 184, url_cutout: 'https://b/old.webm' }]];
      if (/^\s*UPDATE episode_raw_clips SET key_status/.test(sql)) return [[{ id: 'c1', key_status: opts.replacements.status }]];
      return [[]];
    });
    const res = await request(app).post('/api/v1/episode-clips/ep-1/c1/remove-green').send({});
    expect(res.status).toBe(202);
    expect(media.roomToKey).toHaveBeenCalledWith(184);
    expect(media.enqueueKey).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ durationSeconds: 184, hadCutout: true }));
  });

  test('low disk: a 507 in plain words at once; nothing queued and the clip left as it was', async () => {
    media.roomToKey.mockResolvedValueOnce({ ok: false, needs: 721 * 1048576, free: 300 * 1048576 });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/v1/episode-clips/ep-1/c1/remove-green').send({});
    errors.mockRestore();
    expect(res.status).toBe(507);
    expect(res.body.error).toBe('Not enough space on the server to remove the green (needs about 721 MB, 300 MB free). Nothing was changed: the original is as it was. Space has to be freed on the server before Retry will work.');
    expect(media.enqueueKey).not.toHaveBeenCalled();
    expect(mockQuery.mock.calls.some(([sql]) => /UPDATE episode_raw_clips/.test(sql))).toBe(false);
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

  test('a running green removal carries its progress; other clips, and a clip no longer processing, do not', async () => {
    mockQuery.mockImplementation(async (sql) => (/SELECT/.test(sql) && /FROM episode_raw_clips/.test(sql)
      ? [[{ id: 'c1', key_status: 'processing' }, { id: 'c2', key_status: 'done' }, { id: 'c3', key_status: 'processing' }]]
      : [[]]));
    media.keyProgress.mockReturnValueOnce({ c1: { percent: 42, elapsed_seconds: 600, eta_seconds: 828 }, c2: { percent: 99, elapsed_seconds: 1, eta_seconds: null } });
    const res = await request(app).get('/api/v1/episode-clips/ep-1');
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map((c) => [c.id, c]));
    expect(byId.c1.key_progress).toEqual({ percent: 42, elapsed_seconds: 600, eta_seconds: 828 });
    expect(byId.c2.key_progress).toBeUndefined();
    expect(byId.c3.key_progress).toBeUndefined();
  });

  test('delete of an unknown clip is a 404', async () => {
    const res = await request(app).delete('/api/v1/episode-clips/ep-1/nope');
    expect(res.status).toBe(404);
  });

  test('patch with nothing to change is a 400', async () => {
    const res = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({});
    expect(res.status).toBe(400);
  });

  test('patch of is_favorite / start_line before their migration is a 409 JSON message, not a 500', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('column "is_favorite" of relation "episode_raw_clips" does not exist'), { original: { code: '42703' } }));
    const res = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({ is_favorite: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: expect.stringMatching(/not switched on yet/) });
    spy.mockRestore();
  });

  test('patch of beat_marks (Record whole episode) stores them as JSONB and returns them; a bad list is a 400', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 'c1', beat_number: null, beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 41.3 }], has_beat_marks: true }]]);
    const res = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({ beat_marks: [{ beat: 2, t: 41.26 }, { beat: 1, t: 0 }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'c1', beat_number: null, beat_marks: [{ beat: 1, t: 0 }, { beat: 2, t: 41.3 }] });
    const [sql, opts] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/beat_marks = CAST\(:beat_marks AS jsonb\)/);
    expect(JSON.parse(opts.replacements.beat_marks)).toEqual([{ beat: 1, t: 0 }, { beat: 2, t: 41.3 }]);
    const bad = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({ beat_marks: [{ beat: 15, t: 3 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/beat_marks must be/);
  });

  test('patch of beat_marks before its migration is a logged 409 that says the database update has not run', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(Object.assign(new Error('column "beat_marks" of relation "episode_raw_clips" does not exist'), { original: { code: '42703' } }));
    const res = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({ beat_marks: [{ beat: 1, t: 0 }] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: expect.stringMatching(/database update .* hasn't run yet/) });
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/beat_marks column is missing/), expect.any(String));
    spy.mockRestore();
  });

  test('patch of a bad start_line is a 400', async () => {
    const res = await request(app).patch('/api/v1/episode-clips/ep-1/c1').send({ start_line: -2 });
    expect(res.status).toBe(400);
  });
});
