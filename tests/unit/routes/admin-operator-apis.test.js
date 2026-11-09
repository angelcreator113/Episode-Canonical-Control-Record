/**
 * P0 admin authorization (Evoni: "Enforce permissions on the server, not only
 * the frontend"). The Recycle Bin (/api/v1/memories/recycle-bin: list,
 * restore, permanent delete) and the Amber diagnostic engine
 * (/api/v1/amber/diagnostic/*: scan, findings, approve, execute, dismiss,
 * queue) answered any signed-in user. Now: 401 without sign-in, 403 for a
 * non-admin with no database read or write, and an admin reaches the handler.
 * The real routers and auth middleware; the models and Claude are stand-ins.
 */
const mockQuery = jest.fn(async () => []);
const mockFinding = { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => null), update: jest.fn(async () => [0]) };
const mockQueue = { findAll: jest.fn(async () => []), create: jest.fn(async (row) => row) };

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/models', () => ({
  sequelize: { query: mockQuery, QueryTypes: { SELECT: 'SELECT', UPDATE: 'UPDATE', DELETE: 'DELETE' } },
  AmberFinding: mockFinding,
  AmberTaskQueue: mockQueue,
}));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');

const app = express();
app.use(express.json());
app.use('/api/v1/memories', require('../../../src/routes/memories/assistant'));
app.use('/api/v1/amber/diagnostic', require('../../../src/routes/amberDiagnosticRoutes'));

const token = (groups) => TokenService.generateTokenPair({
  id: `p0-admin-${groups.join('-') || 'none'}`, email: 'p0-admin@test.dev', name: 'p0', groups, role: groups[0],
}).accessToken;

const send = ([method, path, body], auth) => {
  let r = request(app)[method](path);
  if (auth) r = r.set('Authorization', `Bearer ${auth}`);
  return body ? r.send(body) : r;
};

const RECYCLE = [
  ['get', '/api/v1/memories/recycle-bin'],
  ['post', '/api/v1/memories/recycle-bin/restore', { type: 'book', id: '00000000-0000-0000-0000-000000000001' }],
  ['delete', '/api/v1/memories/recycle-bin/book/00000000-0000-0000-0000-000000000001'],
];
const AMBER = [
  ['post', '/api/v1/amber/diagnostic/scan', { trigger: 'manual' }],
  ['get', '/api/v1/amber/diagnostic/findings'],
  ['get', '/api/v1/amber/diagnostic/urgent'],
  ['post', '/api/v1/amber/diagnostic/findings/f1/approve'],
  ['post', '/api/v1/amber/diagnostic/findings/f1/execute'],
  ['post', '/api/v1/amber/diagnostic/findings/f1/dismiss'],
  ['get', '/api/v1/amber/diagnostic/queue'],
  ['post', '/api/v1/amber/diagnostic/queue', { title: 'a task' }],
];

const noDataTouched = () => {
  expect(mockQuery).not.toHaveBeenCalled();
  for (const fn of [...Object.values(mockFinding), ...Object.values(mockQueue)]) expect(fn).not.toHaveBeenCalled();
};

describe('P0: the Recycle Bin and Amber diagnostics are admin only', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([...RECYCLE, ...AMBER].map((r) => [r[0].toUpperCase(), r[1], r]))(
    '%s %s: 401 without sign-in, 403 for a non-admin, nothing read or written',
    async (_m, _p, route) => {
      expect((await send(route, null)).status).toBe(401);
      const res = await send(route, token(['USER', 'EDITOR']));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
      noDataTouched();
    },
  );

  test('an admin lists, restores and permanently deletes in the Recycle Bin', async () => {
    const admin = token(['ADMIN']);
    expect((await send(RECYCLE[0], admin)).status).toBe(200);
    expect((await send(RECYCLE[1], admin)).status).toBe(200);
    expect((await send(RECYCLE[2], admin)).status).toBe(200);
    expect(mockQuery).toHaveBeenCalled();
  });

  test('an admin (Cognito group "admin", lower case) reaches the Amber diagnostic handlers', async () => {
    const admin = token(['admin']);
    expect((await send(AMBER[1], admin)).status).toBe(200); // findings
    expect((await send(AMBER[2], admin)).status).toBe(200); // urgent
    expect((await send(AMBER[3], admin)).status).toBe(404); // approve: no such finding
    // execute: switched off by default (AMBER_CLI_EXECUTION_ENABLED unset),
    // refused before the finding is read.
    const exec = await send(AMBER[4], admin);
    expect(exec.status).toBe(403);
    expect(exec.body.code).toBe('CLI_EXECUTION_DISABLED');
    expect((await send(AMBER[5], admin)).status).toBe(404); // dismiss: no such finding
    expect((await send(AMBER[6], admin)).status).toBe(200); // queue
    expect((await send(AMBER[7], admin)).status).toBe(200); // add to queue
    expect(mockFinding.findAll).toHaveBeenCalled();
    expect(mockQueue.create).toHaveBeenCalledTimes(1);
  });
});
