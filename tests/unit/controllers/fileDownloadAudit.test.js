/**
 * File downloads in the audit trail (Evoni, 2026-11-11: "Keep auditing
 * successful file downloads. Do not record ordinary page views or
 * unsuccessful download attempts.").
 *
 * A download here is the handing out of a pre-signed link
 * (fileController.getPreSignedUrl): the browser then fetches the file from
 * storage directly, which the application does not see.
 */
process.env.NODE_ENV = 'test';

jest.mock('../../../src/models', () => ({
  FileStorage: { findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Episode: { findByPk: jest.fn() },
}));
jest.mock('../../../src/services/S3Service', () => ({ uploadFile: jest.fn(), getPreSignedUrl: jest.fn(), deleteFile: jest.fn(), getFileMetadata: jest.fn() }));
jest.mock('../../../src/services/FileValidationService', () => ({ validateFile: jest.fn(), generateS3Key: jest.fn(), getS3Bucket: jest.fn() }));
jest.mock('../../../src/services/JobQueueService', () => ({ enqueue: jest.fn() }));
jest.mock('../../../src/services/NotificationService', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/services/SocketService', () => ({ broadcastMessage: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../src/middleware/auditLog', () => ({ logger: { logAction: jest.fn().mockResolvedValue({ id: 1 }) } }));

const { FileStorage } = require('../../../src/models');
const S3Service = require('../../../src/services/S3Service');
const { logger: audit } = require('../../../src/middleware/auditLog');
const fileController = require('../../../src/controllers/fileController');

const FILE = '0d6c1c0e-8a0c-4a4e-9b1f-6f0e2d9a7c11';
const EPISODE = '5b3c1e8a-1d2f-4c6b-8e7a-9f0a1b2c3d4e';
const stored = (over = {}) => ({
  id: FILE, episode_id: EPISODE, file_name: 'cut.mp4', file_type: 'video', s3_bucket: 'b', s3_key: 'k', access_count: 2,
  update: jest.fn().mockResolvedValue({}), ...over,
});

describe('file downloads: one audit entry for a link handed out, none for an attempt that failed', () => {
  let req;
  let res;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: { episodeId: EPISODE, fileId: FILE }, user: { id: 'user-1', email: 'u@example.dev' }, query: {}, body: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  test('a successful download writes exactly one entry, with no link, bucket or key in it', async () => {
    FileStorage.findOne.mockResolvedValue(stored());
    S3Service.getPreSignedUrl.mockResolvedValue('https://storage.example/k?X-Amz-Signature=abc123');

    await fileController.getPreSignedUrl(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ url: expect.any(String), fileName: 'cut.mp4' }));
    expect(audit.logAction).toHaveBeenCalledTimes(1);
    expect(audit.logAction).toHaveBeenCalledWith('user-1', 'download', 'file', FILE, { fileName: 'cut.mp4', fileType: 'video', episodeId: EPISODE });
    expect(JSON.stringify(audit.logAction.mock.calls)).not.toMatch(/X-Amz|Signature|storage\.example|s3_key|s3_bucket/);
  });

  test('a file that does not exist: 404 and no entry', async () => {
    FileStorage.findOne.mockResolvedValue(null);
    await fileController.getPreSignedUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  test('the link could not be made: 500 and no entry', async () => {
    FileStorage.findOne.mockResolvedValue(stored());
    S3Service.getPreSignedUrl.mockRejectedValue(new Error('storage is down'));
    await fileController.getPreSignedUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  test('the lookup failed: 500 and no entry', async () => {
    FileStorage.findOne.mockRejectedValue(new Error('database is down'));
    await fileController.getPreSignedUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  test('the access count could not be saved: the request fails and no entry is written', async () => {
    FileStorage.findOne.mockResolvedValue(stored({ update: jest.fn().mockRejectedValue(new Error('write failed')) }));
    S3Service.getPreSignedUrl.mockResolvedValue('https://storage.example/k?X-Amz-Signature=abc123');
    await fileController.getPreSignedUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ url: expect.any(String) }));
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  test('listing files and reading a file\'s details are views: no entry', async () => {
    FileStorage.findAll.mockResolvedValue([stored()]);
    FileStorage.findOne.mockResolvedValue(stored());
    for (const name of ['listEpisodeFiles', 'getFileMetadata']) {
      if (typeof fileController[name] === 'function') await fileController[name](req, res);
    }
    expect(audit.logAction).not.toHaveBeenCalled();
  });
});
