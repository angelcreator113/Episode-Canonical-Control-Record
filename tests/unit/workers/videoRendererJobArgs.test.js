/**
 * Production system audit (2026-10-26, §A9): the export route queued
 * `platform` as a key and the timeline as `timelineData`; the worker read
 * `platform.width/height` and `timeline`. These tests take the job exactly
 * as the route queues it and run it through the worker's own processor,
 * with the canvas, FFmpeg, S3 and sockets faked.
 *
 * They show the chosen size and the timeline reach the worker. They do not
 * show export parity: the worker still draws one still per scene, with no
 * audio, and the Timeline editor's keyframes (no sceneId/elementId) still
 * draw as no transform (last test).
 */
const os = require('os');
const path = require('path');
const fsSync = require('fs');
const express = require('express');
const request = require('supertest');

process.env.EXPORT_TEMP_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), 'export-args-'));

// --- the route's collaborators ---------------------------------------------
const mockAddExportJob = jest.fn(async () => ({ id: 'job-1' }));
const mockProcess = jest.fn();
jest.mock('../../../src/queues/videoQueue', () => ({
  addExportJob: (...a) => mockAddExportJob(...a),
  getExportJob: jest.fn(),
  getQueueStats: jest.fn(),
  cancelExportJob: jest.fn(),
  videoQueue: { process: (...a) => mockProcess(...a) },
}));
const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...a) => mockQuery(...a) } }));
jest.mock('../../../src/config/database', () => ({}));
jest.mock('../../../src/services/S3Service', () => ({}));
jest.mock('../../../src/services/beatScenesService', () => ({ syncBeatScenesQuietly: jest.fn(async () => {}) }));

// --- the worker's collaborators --------------------------------------------
const mockCanvases = [];
const mockAlphas = [];
jest.mock('canvas', () => ({
  createCanvas: (width, height) => {
    mockCanvases.push({ width, height });
    const ctx = new Proxy({}, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (prop === 'createLinearGradient') return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set: (target, prop, value) => {
        if (prop === 'globalAlpha') mockAlphas.push(value);
        target[prop] = value;
        return true;
      },
    });
    return { getContext: () => ctx, toBuffer: () => Buffer.from('png') };
  },
  loadImage: async () => ({ width: 100, height: 100 }),
}));
const mockFfmpegOptions = [];
jest.mock('fluent-ffmpeg', () => () => {
  const handlers = {};
  const command = {
    input: () => command,
    inputOptions: () => command,
    outputOptions: (opts) => { mockFfmpegOptions.push(opts); return command; },
    on: (event, fn) => { handlers[event] = fn; return command; },
    save: (out) => { require('fs').writeFileSync(out, 'mp4'); setImmediate(() => handlers.end && handlers.end()); },
  };
  return command;
});
jest.mock('axios', () => ({ get: async () => ({ data: Buffer.from('img') }) }));
jest.mock('../../../src/config/aws', () => ({
  s3: { upload: () => ({ promise: async () => ({ Location: 'https://s3.example/out.mp4' }) }) },
}));
jest.mock('../../../src/sockets', () => ({
  emitExportProgress: jest.fn(), emitExportComplete: jest.fn(), emitExportFailed: jest.fn(),
}));

const exportRoutes = require('../../../src/routes/export');
require('../../../src/workers/videoRenderer');
const processor = mockProcess.mock.calls[0][2];

const SCENE = {
  id: 'scene-1', title: 'Arrival', scene_number: 1, duration_seconds: 4,
  background_url: 'https://s3.example/bg.png',
  characters: [{ id: 'lala', imageUrl: 'https://s3.example/lala.png', position: { x: '50%', y: '50%' } }],
  ui_elements: [],
};

function answerRouteQueries(timelineRow) {
  mockQuery.mockImplementation(async (sql) => {
    if (/FROM episodes/.test(sql)) return [[{ id: 'ep-1', title: 'Episode 1', episode_number: 1, show_id: 'show-1' }]];
    if (/FROM scenes/.test(sql)) return [[SCENE]];
    if (/FROM timeline_data/.test(sql)) return [[timelineRow]];
    return [[]];
  });
}

async function queueThroughRoute(body) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', exportRoutes);
  // Export is admin only in every environment since SEC-6 (2026-10-29).
  const admin = require('../../../src/services/tokenService').generateTokenPair({ id: 'export-admin', email: 'export@test.dev', name: 'export', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  const res = await request(app).post('/api/v1/episodes/ep-1/export').set('Authorization', `Bearer ${admin}`).send(body);
  expect(res.status).toBeLessThan(300);
  return mockAddExportJob.mock.calls.at(-1)[0];
}

const fakeJob = (data) => ({ id: 'job-1', data, opts: {}, attemptsMade: 0, progress: () => {} });

describe('export route → video worker arguments', () => {
  beforeEach(() => {
    mockAddExportJob.mockClear();
    mockCanvases.length = 0;
    mockAlphas.length = 0;
    mockFfmpegOptions.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => fsSync.rmSync(process.env.EXPORT_TEMP_DIR, { recursive: true, force: true }));

  test('the route still queues a platform key, a resolution and timelineData', async () => {
    answerRouteQueries({ keyframes: [] });
    const data = await queueThroughRoute({ platform: 'youtube', quality: '720p', format: 'mp4' });
    expect(data.platform).toBe('youtube');
    expect(data.resolution).toBe('1280x720');
    expect(data.timelineData).toEqual({ keyframes: [] });
  });

  test('the chosen size reaches the frames and the FFmpeg output', async () => {
    answerRouteQueries(null);
    const data = await queueThroughRoute({ platform: 'youtube', quality: '720p', format: 'mp4' });
    const result = await processor(fakeJob(data));

    expect(mockCanvases).toEqual([{ width: 1280, height: 720 }]);
    expect(mockFfmpegOptions[0]).toEqual(expect.arrayContaining(['-s', '1280x720']));
    expect(result.platform).toBe('youtube');
  });

  test('a size the encoder would refuse reaches FFmpeg made even (twitter, quality not a preset)', async () => {
    answerRouteQueries(null);
    const data = await queueThroughRoute({ platform: 'twitter', quality: 'web', format: 'mp4' });
    expect(data.resolution).toBe('1200x675');
    await processor(fakeJob(data));

    expect(mockCanvases).toEqual([{ width: 1200, height: 674 }]);
    expect(mockFfmpegOptions[0]).toEqual(expect.arrayContaining(['-s', '1200x674']));
  });

  test('the timeline reaches the renderer: a worker-shaped keyframe changes the drawing', async () => {
    answerRouteQueries({ keyframes: [{ sceneId: 'scene-1', elementId: 'lala', time: 0, opacity: 0.4 }] });
    const data = await queueThroughRoute({ platform: 'youtube', quality: '1080p', format: 'mp4' });
    await processor(fakeJob(data));

    expect(mockAlphas).toContain(0.4);
  });

  test('not parity: the Timeline editor\'s keyframes still draw as no transform', async () => {
    // TimelineEditor saves { id, time, properties: {...} } with no sceneId/elementId.
    answerRouteQueries({ keyframes: [{ id: 'k1', time: 0, properties: { opacity: 0.4 } }] });
    const data = await queueThroughRoute({ platform: 'youtube', quality: '1080p', format: 'mp4' });
    await processor(fakeJob(data));

    expect(mockAlphas).not.toContain(0.4);
    expect(mockAlphas).toContain(1);
  });
});
