/**
 * POST /api/v1/amber/diagnostic/findings/:id/execute starts a separately
 * billed `claude` process (execFileSync). It is OFF unless
 * AMBER_CLI_EXECUTION_ENABLED is exactly "true" (Evoni, AI Operations Center
 * review, 2026-11-07):
 *   - while off: 403 CLI_EXECUTION_DISABLED before the finding is read, its
 *     status untouched, and the child process never started;
 *   - the auto-approve flags do not turn it on;
 *   - admin authorization and the "approved" check still apply when on.
 * child_process and Claude are stand-ins: no CLI and no AI call ever runs.
 */
const mockExecFileSync = jest.fn(() => 'changed one line');
jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), execFileSync: (...a) => mockExecFileSync(...a) }));

const mockCreate = jest.fn(async () => ({ content: [{ text: 'It worked.' }] }));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));

const mockFinding = { findAll: jest.fn(async () => []), findByPk: jest.fn(), update: jest.fn(async () => [1]) };
jest.mock('../../../src/models', () => ({
  sequelize: { query: jest.fn(async () => []), QueryTypes: { SELECT: 'SELECT' } },
  AmberFinding: mockFinding,
  AmberTaskQueue: { findAll: jest.fn(async () => []), create: jest.fn() },
}));

// Read when the route module loads; a stand-in path (the CLI is mocked).
process.env.CLAUDE_CODE_PROJECT_DIR = '/tmp/amber-cli-switch-test-project';

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const routes = require('../../../src/routes/amberDiagnosticRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/amber/diagnostic', routes);

const token = (groups) => TokenService.generateTokenPair({
  id: `cli-switch-${groups.join('-')}`, email: 'cli-switch@test.dev', name: 'cli', groups, role: groups[0],
}).accessToken;
const ADMIN = token(['ADMIN']);
const PATH = '/api/v1/amber/diagnostic/findings/f1/execute';

function approvedFinding(fields = {}) {
  const row = { id: 'f1', status: 'approved', title: 'Fix a thing', description: 'd', proposed_fix: 'p', ...fields };
  row.update = jest.fn(async (patch) => Object.assign(row, patch));
  row.reload = jest.fn(async () => row);
  return row;
}

const ENV_KEYS = ['AMBER_CLI_EXECUTION_ENABLED', 'AMBER_AUTO_APPROVE_DUPLICATE_BRAIN', 'AMBER_AUTO_APPROVE_MEMORY_REMINDER'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  mockExecFileSync.mockClear();
  mockCreate.mockClear();
  mockFinding.findByPk.mockReset();
  mockFinding.update.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  jest.restoreAllMocks();
});

const setFlag = (v) => { if (v === null) delete process.env.AMBER_CLI_EXECUTION_ENABLED; else process.env.AMBER_CLI_EXECUTION_ENABLED = v; };

describe('switched off (the default)', () => {
  test.each([[null], ['false'], ['TRUE'], ['True'], [' true'], ['true '], ['1'], ['yes'], ['on'], ['']])(
    'AMBER_CLI_EXECUTION_ENABLED=%j (null: unset): 403 CLI_EXECUTION_DISABLED, finding not read, CLI never started',
    async (value) => {
      setFlag(value);
      const finding = approvedFinding();
      mockFinding.findByPk.mockResolvedValue(finding);
      const res = await request(app).post(PATH).set('Authorization', `Bearer ${ADMIN}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CLI_EXECUTION_DISABLED');
      expect(mockFinding.findByPk).not.toHaveBeenCalled();
      expect(finding.update).not.toHaveBeenCalled();
      expect(mockFinding.update).not.toHaveBeenCalled();
      expect(mockExecFileSync).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    },
  );

  test('the auto-approve flags do not bypass it: an auto-approved finding is still refused', async () => {
    process.env.AMBER_AUTO_APPROVE_DUPLICATE_BRAIN = 'true';
    process.env.AMBER_AUTO_APPROVE_MEMORY_REMINDER = 'true';
    mockFinding.findByPk.mockResolvedValue(approvedFinding({ auto_approve_category: 'duplicate_brain_cleanup' }));
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${ADMIN}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CLI_EXECUTION_DISABLED');
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  test('executeFixViaClaudeCode itself refuses while off: no child process for any caller', async () => {
    const result = await routes.executeFixViaClaudeCode(approvedFinding());
    expect(result).toMatchObject({ success: false, code: 'CLI_EXECUTION_DISABLED' });
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  test('a non-admin still gets 403 AUTH_GROUP_REQUIRED (the admin check runs first)', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token(['USER'])}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  test('without sign-in: 401', async () => {
    expect((await request(app).post(PATH)).status).toBe(401);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

describe('switched on (exactly "true"): the existing checks still apply', () => {
  beforeEach(() => setFlag('true'));

  test('a non-admin is still refused, and the CLI is not started', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token(['USER'])}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GROUP_REQUIRED');
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  test('a finding that is not approved: 400, CLI not started', async () => {
    mockFinding.findByPk.mockResolvedValue(approvedFinding({ status: 'detected' }));
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${ADMIN}`);
    expect(res.status).toBe(400);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  test('no such finding: 404, CLI not started', async () => {
    mockFinding.findByPk.mockResolvedValue(null);
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${ADMIN}`);
    expect(res.status).toBe(404);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  test('an approved finding reaches the (stand-in) CLI exactly once, as before', async () => {
    const finding = approvedFinding();
    mockFinding.findByPk.mockResolvedValue(finding);
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${ADMIN}`);
    expect(res.status).toBe(200);
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync.mock.calls[0][0]).toBe('claude');
    expect(finding.update).toHaveBeenCalledWith({ status: 'executing' });
  });
});
