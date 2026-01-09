const FileModel = require('../../../src/models/file');
const db = require('../../../src/config/database');
const { v4: uuidv4 } = require('uuid');

jest.mock('../../../src/config/database');

describe('FileModel Unit Tests', () => {
  const mockFileData = {
    id: uuidv4(),
    episodeId: uuidv4(),
    userId: 'user-123',
    fileName: 'test.mp4',
    fileType: 'video/mp4',
    fileSize: 1024000,
    s3Key: 'episodes/test.mp4',
    s3Url: 'https://s3.amazonaws.com/episodes/test.mp4',
    status: 'uploaded',
    metadata: { duration: 3600 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create file record successfully', async () => {
      db.query.mockResolvedValue({
        rows: [{ ...mockFileData, created_at: mockFileData.createdAt, updated_at: mockFileData.updatedAt }],
      });

      const result = await FileModel.create(mockFileData);

      expect(result).toMatchObject({
        id: mockFileData.id,
        fileName: mockFileData.fileName,
        fileSize: mockFileData.fileSize,
        status: 'uploaded',
      });
      expect(db.query).toHaveBeenCalled();
    });

    test('should set default status to pending', async () => {
      const dataWithoutStatus = { ...mockFileData };
      delete dataWithoutStatus.status;

      db.query.mockResolvedValue({
        rows: [{ ...mockFileData, status: 'pending' }],
      });

      const result = await FileModel.create(dataWithoutStatus);

      expect(result.status).toBe('pending');
    });

    test('should throw error on database failure', async () => {
      db.query.mockRejectedValue(new Error('DB Error'));

      await expect(FileModel.create(mockFileData)).rejects.toThrow('DB Error');
    });
  });

  describe('getById', () => {
    test('should retrieve file by ID', async () => {
      db.query.mockResolvedValue({
        rows: [mockFileData],
      });

      const result = await FileModel.getById(mockFileData.id);

      expect(result).toMatchObject({
        id: mockFileData.id,
        fileName: mockFileData.fileName,
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND deleted_at IS NULL'),
        [mockFileData.id]
      );
    });

    test('should return null for non-existent file', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FileModel.getById('non-existent-id');

      expect(result).toBeNull();
    });

    test('should exclude soft-deleted files', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await FileModel.getById(mockFileData.id);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
    });
  });

  describe('getByUserId', () => {
    test('should retrieve files by user ID', async () => {
      const files = [mockFileData, { ...mockFileData, id: uuidv4() }];
      db.query.mockResolvedValue({ rows: files });

      const result = await FileModel.getByUserId(mockFileData.userId);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalled();
    });

    test('should support pagination', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      await FileModel.getByUserId(mockFileData.userId, { limit: 10, offset: 20 });

      const call = db.query.mock.calls[0];
      expect(call[0]).toContain('LIMIT');
      expect(call[0]).toContain('OFFSET');
    });

    test('should filter by episode ID when provided', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      await FileModel.getByUserId(mockFileData.userId, { episodeId: mockFileData.episodeId });

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('episode_id');
    });

    test('should order by created_at descending', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      await FileModel.getByUserId(mockFileData.userId);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('ORDER BY created_at DESC');
    });
  });

  describe('getByEpisodeId', () => {
    test('should retrieve all files for episode', async () => {
      const files = [mockFileData, { ...mockFileData, id: uuidv4() }];
      db.query.mockResolvedValue({ rows: files });

      const result = await FileModel.getByEpisodeId(mockFileData.episodeId);

      expect(result).toHaveLength(2);
    });

    test('should exclude soft-deleted files', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await FileModel.getByEpisodeId(mockFileData.episodeId);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        expect.any(Array)
      );
    });
  });

  describe('getByS3Key', () => {
    test('should retrieve file by S3 key', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      const result = await FileModel.getByS3Key(mockFileData.s3Key);

      expect(result).toMatchObject({
        s3Key: mockFileData.s3Key,
      });
    });

    test('should return null if S3 key not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await FileModel.getByS3Key('nonexistent-key');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    test('should update file status', async () => {
      const updated = { ...mockFileData, status: 'processing' };
      db.query.mockResolvedValue({ rows: [updated] });

      const result = await FileModel.update(mockFileData.id, { status: 'processing' });

      expect(result.status).toBe('processing');
    });

    test('should only allow specific fields for update', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      await FileModel.update(mockFileData.id, {
        status: 'uploaded',
        s3_url: 'https://new-url.com',
        fileName: 'should-be-ignored',
      });

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('status');
      expect(query).toContain('s3_url');
      expect(query).not.toContain('file_name');
    });

    test('should update timestamp', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      await FileModel.update(mockFileData.id, { status: 'uploaded' });

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('updated_at');
    });
  });

  describe('delete', () => {
    test('should soft delete file', async () => {
      db.query.mockResolvedValue({ rows: [{ ...mockFileData, deleted_at: new Date() }] });

      await FileModel.delete(mockFileData.id);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('deleted_at = NOW()');
    });

    test('should only delete non-deleted files', async () => {
      db.query.mockResolvedValue({ rows: [mockFileData] });

      await FileModel.delete(mockFileData.id);

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('deleted_at IS NULL');
    });
  });

  describe('countByUserId', () => {
    test('should count user files', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await FileModel.countByUserId(mockFileData.userId);

      expect(result).toBe(5);
    });

    test('should return 0 for user with no files', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await FileModel.countByUserId(mockFileData.userId);

      expect(result).toBe(0);
    });
  });

  describe('getTotalSizeByUserId', () => {
    test('should calculate total size for user', async () => {
      db.query.mockResolvedValue({ rows: [{ total_size: '5242880' }] }); // 5MB

      const result = await FileModel.getTotalSizeByUserId(mockFileData.userId);

      expect(result).toBe(BigInt(5242880));
    });

    test('should return 0 if no files', async () => {
      db.query.mockResolvedValue({ rows: [{ total_size: '0' }] });

      const result = await FileModel.getTotalSizeByUserId(mockFileData.userId);

      expect(result).toBe(BigInt(0));
    });
  });

  describe('formatFile', () => {
    test('should convert snake_case to camelCase', () => {
      const dbRow = {
        id: mockFileData.id,
        episode_id: mockFileData.episodeId,
        user_id: mockFileData.userId,
        file_name: mockFileData.fileName,
        file_type: mockFileData.fileType,
        file_size: mockFileData.fileSize,
        s3_key: mockFileData.s3Key,
        s3_url: mockFileData.s3Url,
        status: mockFileData.status,
        metadata: JSON.stringify(mockFileData.metadata),
        created_at: mockFileData.createdAt,
        updated_at: mockFileData.updatedAt,
        deleted_at: null,
      };

      const result = FileModel.formatFile(dbRow);

      expect(result).toMatchObject({
        id: mockFileData.id,
        episodeId: mockFileData.episodeId,
        userId: mockFileData.userId,
        fileName: mockFileData.fileName,
        fileSize: mockFileData.fileSize,
      });
    });

    test('should parse metadata JSON', () => {
      const metadata = { duration: 3600, codec: 'h264' };
      const dbRow = {
        ...mockFileData,
        metadata: JSON.stringify(metadata),
      };

      const result = FileModel.formatFile(dbRow);

      expect(result.metadata).toEqual(metadata);
    });

    test('should return null for null input', () => {
      const result = FileModel.formatFile(null);
      expect(result).toBeNull();
    });
  });
});
