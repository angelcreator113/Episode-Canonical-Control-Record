// ============================================================================
// Teleprompter remote routes (/api/v1/teleprompter-remote; batch 3): the
// desktop's routes need a session (requireAuth) and pass the user on; the
// phone's carry no auth and pass only the X-Remote-Token header; errors map
// to 409 / 410 / 400. The service is mocked.
// ============================================================================
const express = require('express');
const request = require('supertest');

jest.mock('../../../src/models', () => ({ sequelize: { query: jest.fn() } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      if (req.get('Authorization') !== 'Bearer ok') return res.status(401).json({ error: 'auth' });
      req.user = { id: 'u1' };
      return next();
    },
    authorize: () => (req, _res, next) => next(),
  };
});
jest.mock('../../../src/services/teleprompterRemoteService', () => {
  const actual = jest.requireActual('../../../src/services/teleprompterRemoteService');
  return {
    ...actual,
    createSession: jest.fn(), commandsAfter: jest.fn(), putState: jest.fn(), endSession: jest.fn(), addCommand: jest.fn(), stateByToken: jest.fn(),
  };
});

const remote = require('../../../src/services/teleprompterRemoteService');
const router = require('../../../src/routes/teleprompterRemoteRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/teleprompter-remote', router);
const ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'a'.repeat(43);

beforeEach(() => jest.clearAllMocks());

test('the desktop routes need a session', async () => {
  for (const [method, path] of [['post', '/'], ['get', `/${ID}/commands`], ['put', `/${ID}/state`], ['delete', `/${ID}`]]) {
    const res = await request(app)[method](`/api/v1/teleprompter-remote${path}`);
    expect(res.status).toBe(401);
  }
  expect(remote.createSession).not.toHaveBeenCalled();
});

test('POST / opens a session for the signed-in user and returns the token once', async () => {
  remote.createSession.mockResolvedValue({ session: { id: ID, expires_at: 'later', command_seq: 0 }, token: TOKEN });
  const res = await request(app).post('/api/v1/teleprompter-remote').set('Authorization', 'Bearer ok').send({ episode_id: 'ep' });
  expect(res.status).toBe(201);
  expect(res.body.data).toEqual({ id: ID, expires_at: 'later', command_seq: 0, token: TOKEN });
  expect(res.headers['cache-control']).toBe('no-store');
  expect(remote.createSession).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', episodeId: 'ep' });
});

test('GET /:id/commands passes the owner and the seq; PUT state; DELETE ends', async () => {
  remote.commandsAfter.mockResolvedValue({ seq: 2, commands: [{ seq: 2, command: 'toggle' }], ended: false });
  const res = await request(app).get(`/api/v1/teleprompter-remote/${ID}/commands?after=1`).set('Authorization', 'Bearer ok');
  expect(res.status).toBe(200);
  expect(remote.commandsAfter).toHaveBeenCalledWith(expect.anything(), { id: ID, userId: 'u1', after: '1' });
  remote.putState.mockResolvedValue(null);
  const gone = await request(app).put(`/api/v1/teleprompter-remote/${ID}/state`).set('Authorization', 'Bearer ok').send({ state: { running: true } });
  expect(gone.status).toBe(410);
  remote.endSession.mockResolvedValue(true);
  const ended = await request(app).delete(`/api/v1/teleprompter-remote/${ID}`).set('Authorization', 'Bearer ok');
  expect(ended.body.data).toEqual({ ended: true });
  expect(remote.endSession).toHaveBeenCalledWith(expect.anything(), { id: ID, userId: 'u1' });
});

test('the phone routes need no account: only the token header reaches the service', async () => {
  remote.addCommand.mockResolvedValue({ seq: 1, state: null, expires_at: 'later' });
  const res = await request(app).post('/api/v1/teleprompter-remote/phone/commands').set('X-Remote-Token', TOKEN).send({ command: 'faster' });
  expect(res.status).toBe(200);
  expect(remote.addCommand).toHaveBeenCalledWith(expect.anything(), { token: TOKEN, command: 'faster' });
  remote.stateByToken.mockRejectedValue(new remote.RemoteError(410, remote.GONE, 'SESSION_GONE'));
  const gone = await request(app).get('/api/v1/teleprompter-remote/phone/state').set('X-Remote-Token', 'x');
  expect(gone.status).toBe(410);
  expect(gone.body).toMatchObject({ success: false, code: 'SESSION_GONE' });
});

test('before the migration: 409 with the plain message; an unexpected error is a logged 500 with no detail', async () => {
  remote.addCommand.mockRejectedValue(new remote.RemoteError(409, remote.NOT_READY, 'MIGRATION_PENDING'));
  const res = await request(app).post('/api/v1/teleprompter-remote/phone/commands').set('X-Remote-Token', TOKEN).send({ command: 'toggle' });
  expect(res.status).toBe(409);
  expect(res.body.error).toBe(remote.NOT_READY);
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  remote.stateByToken.mockRejectedValue(new Error('connection refused at 10.0.0.5'));
  const boom = await request(app).get('/api/v1/teleprompter-remote/phone/state').set('X-Remote-Token', TOKEN);
  expect(boom.status).toBe(500);
  expect(boom.body.error).not.toContain('10.0.0.5');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

test('the phone routes are rate limited', async () => {
  remote.stateByToken.mockResolvedValue({ state: null, expires_at: 'later', seq: 0 });
  let last;
  for (let i = 0; i < 152; i += 1) last = await request(app).get('/api/v1/teleprompter-remote/phone/state').set('X-Remote-Token', TOKEN);
  expect(last.status).toBe(429);
});
