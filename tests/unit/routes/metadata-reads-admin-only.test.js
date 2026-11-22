/**
 * The metadata reads are an ADMIN's (Evoni, 2026-11-22). GET
 * /api/v1/metadata, /ALL, /:id, /:id/summary and /episode/:episodeId carried
 * optionalAuth, so they answered anyone, signed in or not, with whole
 * metadata_storage rows: a video's transcription and extracted text among
 * them. They now need a sign-in in the admin group.
 *
 * The real router, auth middleware and controller; the models are stand-ins,
 * so no database is read.
 */
jest.mock('../../../src/models', () => {
  const MetadataStorage = { findAndCountAll: jest.fn(), findByPk: jest.fn(), getForEpisode: jest.fn() };
  const Episode = { findByPk: jest.fn() };
  return { models: { MetadataStorage, Episode } };
});

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const { models: { MetadataStorage, Episode } } = require('../../../src/models');

const app = express();
app.use(express.json());
app.use('/api/v1/metadata', require('../../../src/routes/metadata'));

const token = (groups) => TokenService.generateTokenPair({
  id: `metadata-${groups.join('-') || 'none'}`, email: 'metadata@test.dev', name: 'metadata', groups, role: groups[0],
}).accessToken;
const get = (path, auth) => {
  const r = request(app).get(`/api/v1/metadata${path}`);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

const ROW = {
  id: 5, episodeId: 'ep-1', tags: ['gala'], categories: ['fashion'], processingDurationSeconds: 12,
  extractedText: 'ON SCREEN: the private caption text', transcription: 'Lala: the private spoken line.',
  scenesDetected: [{ at: 0 }], sentimentAnalysis: { tone: 'warm' }, visualObjects: { dress: 1 },
};
const PRIVATE = ['the private caption text', 'the private spoken line'];

const READS = ['/', '/ALL', '/5', '/5/summary', '/episode/ep-1'];
const NOT_ADMIN = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []];
const modelCalls = () => MetadataStorage.findAndCountAll.mock.calls.length + MetadataStorage.findByPk.mock.calls.length
  + MetadataStorage.getForEpisode.mock.calls.length + Episode.findByPk.mock.calls.length;

beforeEach(() => {
  jest.clearAllMocks();
  MetadataStorage.findAndCountAll.mockResolvedValue({ count: 1, rows: [ROW] });
  MetadataStorage.findByPk.mockResolvedValue(ROW);
  MetadataStorage.getForEpisode.mockResolvedValue(ROW);
  Episode.findByPk.mockResolvedValue({ id: 'ep-1' });
});

describe('the metadata reads need a sign-in in the admin group', () => {
  test.each(READS)('signed out: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, null);
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
    for (const text of PRIVATE) expect(JSON.stringify(res.body)).not.toContain(text);
    expect(modelCalls()).toBe(0);
  });

  test.each(READS)('a token that is not one: GET %s is a 401 and reads nothing', async (path) => {
    const res = await get(path, 'not-a-token');
    expect(res.status).toBe(401);
    expect(modelCalls()).toBe(0);
  });

  test.each(READS)('signed in but not an admin: GET %s is a 403 and reads nothing', async (path) => {
    for (const groups of NOT_ADMIN) {
      const res = await get(path, token(groups));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      for (const text of PRIVATE) expect(JSON.stringify(res.body)).not.toContain(text);
    }
    expect(modelCalls()).toBe(0);
  });

  test.each(READS)('an admin: GET %s is a 200', async (path) => {
    const res = await get(path, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('the admin group is matched whatever its case, as authorize() does', async () => {
    expect((await get('/', token(['admin']))).status).toBe(200);
    expect((await get('/5', token(['Viewer', 'Admin']))).status).toBe(200);
  });
});

describe('an admin still reads what the pages read', () => {
  const admin = token(['ADMIN']);

  test('the list, one record and an episode\'s record carry the transcription and the extracted text', async () => {
    const list = await get('/', admin);
    expect(list.body.data[0].transcription).toBe(ROW.transcription);
    expect(list.body.data[0].extractedText).toBe(ROW.extractedText);
    expect(list.body.pagination.total).toBe(1);
    for (const path of ['/5', '/episode/ep-1']) {
      const res = await get(path, admin);
      expect(res.body.data.transcription).toBe(ROW.transcription);
      expect(res.body.data.extractedText).toBe(ROW.extractedText);
    }
  });

  test('the summary says only whether the text is there', async () => {
    const res = await get('/5/summary', admin);
    expect(res.body.data.extractedText).toBe('present');
    expect(res.body.data.hasTranscription).toBe(true);
    for (const text of PRIVATE) expect(JSON.stringify(res.body)).not.toContain(text);
  });
});
