/**
 * Job auditing (Evoni, 2026-11-11: "do not persist arbitrary job payloads.
 * Use an explicit allowlist of safe metadata."). A job's payload is whatever
 * the caller sent; the audit entry names the job and never copies it.
 */
process.env.NODE_ENV = 'test';

jest.mock('../../../src/models/job', () => ({
  Job: { create: jest.fn(), findById: jest.fn() },
  JOB_STATUS: { PENDING: 'pending' },
  JOB_TYPE: { THUMBNAIL: 'thumbnail-generation' },
}));
jest.mock('../../../src/models', () => ({ ProcessingQueue: { create: jest.fn().mockResolvedValue({ id: 'p' }) } }));
jest.mock('../../../src/services/QueueService', () => ({ sendJob: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/services/ErrorRecovery', () => ({}));
jest.mock('../../../src/services/NotificationService', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/services/SocketService', () => ({ broadcastMessage: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/middleware/auditLog', () => ({ logger: { logAction: jest.fn().mockResolvedValue({ id: 1 }) } }));

const { Job } = require('../../../src/models/job');
const { logger: audit } = require('../../../src/middleware/auditLog');
// The module exports an instance while createJob is static, so it is reached
// through the class here. (The route calls it on the instance, where it does
// not exist: POST /api/v1/jobs fails today. A separate, older defect.)
const JobController = require('../../../src/controllers/jobController').constructor;

const EPISODE = '5b3c1e8a-1d2f-4c6b-8e7a-9f0a1b2c3d4e';
const FILE = '0d6c1c0e-8a0c-4a4e-9b1f-6f0e2d9a7c11';

describe('job creation: the audit entry is an allowlist, never the payload', () => {
  let res;
  beforeEach(() => {
    jest.clearAllMocks();
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });
  const create = (body) => JobController.createJob({ body, user: { id: 'u-1', email: 'e' }, params: {}, query: {} }, res);

  test('the entry holds the job type, the two ids, the retry limit and whether a payload came; nothing from inside the payload', async () => {
    Job.create.mockResolvedValue({ id: 'job-1', payload: { anything: true } });
    await create({
      jobType: 'thumbnail-generation',
      maxRetries: 5,
      payload: { episodeId: EPISODE, fileId: FILE, metadata: { note: 'PRIVATE NOTE' }, apiKey: 'sk-live-1', callbackUrl: 'https://signed.example/x?sig=abc', script: 'A SCRIPT' },
    });
    expect(audit.logAction).toHaveBeenCalledTimes(1);
    expect(audit.logAction.mock.calls[0]).toEqual(['u-1', 'create', 'job', 'job-1',
      { jobType: 'thumbnail-generation', episodeId: EPISODE, fileId: FILE, maxRetries: 5, hasPayload: true }]);
    expect(JSON.stringify(audit.logAction.mock.calls[0])).not.toMatch(/PRIVATE NOTE|sk-live|signed\.example|A SCRIPT|payload"/);
  });

  test('an id that is not a plain id is dropped, not stored', async () => {
    Job.create.mockResolvedValue({ id: 'job-2' });
    await create({ jobType: 'thumbnail-generation', payload: { episodeId: { $ne: null, dump: 'x'.repeat(500) }, fileId: 'y'.repeat(300) } });
    expect(audit.logAction.mock.calls[0][4]).toEqual({ jobType: 'thumbnail-generation', episodeId: null, fileId: null, maxRetries: 3, hasPayload: true });
  });

  test('a refused job type, and a job that could not be created, write no entry', async () => {
    await create({ jobType: 'not-a-job', payload: {} });
    expect(res.status).toHaveBeenCalledWith(400);
    Job.create.mockRejectedValue(new Error('db down'));
    await create({ jobType: 'thumbnail-generation', payload: {} });
    expect(audit.logAction).not.toHaveBeenCalled();
  });
});
