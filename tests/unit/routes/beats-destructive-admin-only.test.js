/**
 * The two beat deletes are an ADMIN's (Evoni, 2026-11-22). DELETE
 * /api/v1/beats/:id (src/routes/beats.js) and DELETE
 * /api/v1/scenes/:sceneId/beats/clear (src/routes/animatic.js) hard-delete
 * beats (the clear also every character clip of the scene) with no restore,
 * and asked for a sign-in only. Both now need a sign-in in the admin group,
 * refused before the handler. The other beat routes stay sign-in.
 *
 * The real routers, auth middleware, controller and beat service; the models
 * are stand-ins (the beats and character_clips tables are not in the
 * migrated test database), so no database is read.
 */
const mockBeatRow = { destroy: jest.fn() };
const mockBeat = { findByPk: jest.fn(), findAll: jest.fn(), destroy: jest.fn() };
const mockClip = { destroy: jest.fn() };
const mockScene = { findByPk: jest.fn() };
jest.mock('../../../src/models', () => {
  const models = { Beat: mockBeat, CharacterClip: mockClip, Scene: mockScene, CharacterProfile: {}, AudioClip: {} };
  return { ...models, models };
});

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const beatService = require('../../../src/services/beatService');

const app = express();
app.use(express.json());
// Mounted as src/app.js mounts them: both on /api/v1, beats first.
app.use('/api/v1', require('../../../src/routes/beats'));
app.use('/api/v1', require('../../../src/routes/animatic'));

const BEAT = '33333333-3333-4333-8333-333333333333';
const SCENE = '44444444-4444-4444-8444-444444444444';
const ONE = `/api/v1/beats/${BEAT}`;
const CLEAR = `/api/v1/scenes/${SCENE}/beats/clear`;
const NON_ADMINS = [['USER'], ['EDITOR'], ['VIEWER'], ['USER', 'EDITOR'], []].map((groups) => [groups]);
const token = (groups) => TokenService.generateTokenPair({
  id: `beats-${groups.join('-') || 'none'}`, email: 'beats@test.dev', name: 'beats', groups, role: groups[0],
}).accessToken;
const call = (method, path, auth) => {
  const r = request(app)[method](path);
  return auth ? r.set('Authorization', `Bearer ${auth}`) : r;
};

let clearSpy;
const nothingDeleted = () => {
  expect(mockBeat.findByPk).not.toHaveBeenCalled();
  expect(mockScene.findByPk).not.toHaveBeenCalled();
  expect(mockBeatRow.destroy).not.toHaveBeenCalled();
  expect(mockBeat.destroy).not.toHaveBeenCalled();
  expect(mockClip.destroy).not.toHaveBeenCalled();
  expect(clearSpy).not.toHaveBeenCalled();
};

beforeEach(() => {
  for (const fn of [mockBeatRow.destroy, mockBeat.findByPk, mockBeat.findAll, mockBeat.destroy, mockClip.destroy, mockScene.findByPk]) fn.mockReset();
  mockBeat.findByPk.mockResolvedValue(mockBeatRow);
  mockBeatRow.destroy.mockResolvedValue();
  mockScene.findByPk.mockResolvedValue({ id: SCENE });
  mockClip.destroy.mockResolvedValue(5);
  mockBeat.destroy.mockResolvedValue(3);
  clearSpy = jest.spyOn(beatService, 'clearSceneBeats');
});
afterEach(() => jest.restoreAllMocks());

describe('DELETE /api/v1/beats/:id needs a sign-in in the admin group', () => {
  test('signed out: a 401, and nothing is read or deleted', async () => {
    expect((await call('delete', ONE, null)).status).toBe(401);
    nothingDeleted();
  });

  test.each(NON_ADMINS)('signed in, groups %j: a 403, and nothing is read or deleted', async (groups) => {
    const res = await call('delete', ONE, token(groups));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    nothingDeleted();
  });

  test('an admin: the beat is looked up by its id and destroyed, answered as before', async () => {
    const res = await call('delete', ONE, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Beat deleted successfully' });
    expect(mockBeat.findByPk).toHaveBeenCalledWith(BEAT);
    expect(mockBeatRow.destroy).toHaveBeenCalledTimes(1);
    expect(mockBeatRow.destroy).toHaveBeenCalledWith();
  });

  test('an admin, no such beat: the same 404 as before', async () => {
    mockBeat.findByPk.mockResolvedValue(null);
    const res = await call('delete', ONE, token(['ADMIN']));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Beat not found' });
    expect(mockBeatRow.destroy).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/scenes/:sceneId/beats/clear needs a sign-in in the admin group', () => {
  test('signed out: a 401, and nothing is read or deleted', async () => {
    expect((await call('delete', CLEAR, null)).status).toBe(401);
    nothingDeleted();
  });

  test.each(NON_ADMINS)('signed in, groups %j: a 403, and nothing is read or deleted', async (groups) => {
    const res = await call('delete', CLEAR, token(groups));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(res.body.data).toBeUndefined();
    nothingDeleted();
  });

  test('an admin: the scene\'s clips, then its beats, are destroyed, answered as before', async () => {
    const res = await call('delete', CLEAR, token(['ADMIN']));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { beats_deleted: 3, clips_deleted: 5 },
      message: 'Cleared 3 beats and 5 clips',
    });
    expect(mockScene.findByPk).toHaveBeenCalledWith(SCENE);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledWith(SCENE);
    expect(mockClip.destroy).toHaveBeenCalledWith({ where: { scene_id: SCENE } });
    expect(mockBeat.destroy).toHaveBeenCalledWith({ where: { scene_id: SCENE } });
    expect(mockClip.destroy.mock.invocationCallOrder[0]).toBeLessThan(mockBeat.destroy.mock.invocationCallOrder[0]);
  });

  test('an admin, no such scene: the same 404 as before, nothing deleted', async () => {
    mockScene.findByPk.mockResolvedValue(null);
    const res = await call('delete', CLEAR, token(['ADMIN']));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Scene not found' });
    expect(clearSpy).not.toHaveBeenCalled();
    expect(mockClip.destroy).not.toHaveBeenCalled();
    expect(mockBeat.destroy).not.toHaveBeenCalled();
  });
});

describe('the other beat routes still ask for a sign-in only', () => {
  test('a signed-in non-admin reaches the handlers of the read, the edit and the generate', async () => {
    mockScene.findByPk.mockResolvedValue(null);
    mockBeat.findByPk.mockResolvedValue(null);
    const user = token(['USER']);
    // 404s from the handlers (nothing found), not 403s from a group check.
    expect((await call('get', ONE, user)).status).toBe(404);
    expect((await call('patch', ONE, user).send({})).status).toBe(404);
    expect((await call('post', `/api/v1/scenes/${SCENE}/beats/generate`, user).send({ scriptLines: [] })).status).toBe(404);
    expect(mockBeat.findByPk).toHaveBeenCalledTimes(2);
    expect(mockScene.findByPk).toHaveBeenCalledTimes(1);
  });
});
