/**
 * GET /:showId/config (routes/scriptGenerator.js, mounted under
 * /api/v1/episodes and /api/v1/templates) is a read and writes nothing
 * (Evoni, 2026-11-22). It used to try to save a default row for any show id
 * it was asked about. The PUT, now the one place a configuration is made, is
 * an ADMIN's.
 *
 * The real router and auth middleware; the model is a stand-in, so no
 * database is read.
 */
jest.mock('../../../src/models', () => ({
  ShowConfig: { findOne: jest.fn(), create: jest.fn() },
  ScriptTemplate: { findOne: jest.fn() },
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const { ShowConfig } = require('../../../src/models');

const app = express();
app.use(express.json());
app.use('/api/v1/episodes', require('../../../src/routes/scriptGenerator'));

const SHOW = '11111111-1111-4111-8111-111111111111';
const token = (groups) => TokenService.generateTokenPair({
  id: `config-${groups.join('-') || 'none'}`, email: 'config@test.dev', name: 'config', groups, role: groups[0],
}).accessToken;
const as = (r, groups) => (groups ? r.set('Authorization', `Bearer ${token(groups)}`) : r);
const get = (groups) => as(request(app).get(`/api/v1/episodes/${SHOW}/config`), groups);
const put = (groups, body) => as(request(app).put(`/api/v1/episodes/${SHOW}/config`), groups).send(body);

const READERS = [['viewer'], ['USER', 'EDITOR'], ['ADMIN']];
const row = () => ({ show_id: SHOW, config_key: 'pacing', config_value: { wpm: 150 }, update: jest.fn().mockResolvedValue(undefined) });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('GET /:showId/config writes nothing', () => {
  test('signed out: 401, and the model is not read', async () => {
    expect((await get(null)).status).toBe(401);
    expect(ShowConfig.findOne).not.toHaveBeenCalled();
  });

  test.each(READERS)('a show with no saved configuration reads as the defaults for %j, and none is saved', async (...groups) => {
    ShowConfig.findOne.mockResolvedValue(null);
    const res = await get(groups);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      saved: false,
      data: {
        show_id: SHOW, target_duration: 600, target_scene_count: 7, format: 'YouTube long-form', niche_category: 'general',
        content_specs: { words_per_minute: 150, target_tolerance: 60 },
      },
    });
    expect(ShowConfig.create).not.toHaveBeenCalled();
  });

  test.each(READERS)('a saved configuration is read as it is for %j, and not changed', async (...groups) => {
    const saved = row();
    ShowConfig.findOne.mockResolvedValue(saved);
    const res = await get(groups);
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    expect(res.body.data).toMatchObject({ show_id: SHOW, config_key: 'pacing' });
    expect(saved.update).not.toHaveBeenCalled();
    expect(ShowConfig.create).not.toHaveBeenCalled();
  });

  test('a read that fails says so, and still saves nothing', async () => {
    ShowConfig.findOne.mockRejectedValue(new Error('relation "show_configs" does not exist'));
    const res = await get(['ADMIN']);
    expect(res.status).toBe(500);
    expect(ShowConfig.create).not.toHaveBeenCalled();
  });
});

describe('PUT /:showId/config is an ADMIN\'s', () => {
  test('signed out: 401; signed in but not an admin: 403; nothing is read or written', async () => {
    expect((await put(null, { config_key: 'pacing' })).status).toBe(401);
    for (const groups of [['viewer'], ['USER', 'EDITOR'], []]) expect((await put(groups, { config_key: 'pacing' })).status).toBe(403);
    expect(ShowConfig.findOne).not.toHaveBeenCalled();
    expect(ShowConfig.create).not.toHaveBeenCalled();
  });

  test('an admin makes a show\'s first configuration, as before', async () => {
    ShowConfig.findOne.mockResolvedValue(null);
    ShowConfig.create.mockImplementation(async (values) => values);
    const res = await put(['ADMIN'], { config_key: 'pacing', config_value: { wpm: 140 } });
    expect(res.status).toBe(200);
    expect(ShowConfig.create).toHaveBeenCalledWith({ show_id: SHOW, config_key: 'pacing', config_value: { wpm: 140 } });
  });

  test('an admin changes a saved configuration, as before', async () => {
    const saved = row();
    ShowConfig.findOne.mockResolvedValue(saved);
    const res = await put(['admin'], { config_value: { wpm: 160 } });
    expect(res.status).toBe(200);
    expect(saved.update).toHaveBeenCalledWith({ config_value: { wpm: 160 } });
    expect(ShowConfig.create).not.toHaveBeenCalled();
  });
});
