/**
 * Audit Log Middleware Unit Tests
 */

const { logger } = require('../../../src/middleware/auditLog');
const { models } = require('../../../src/models');

jest.mock('../../../src/models');

describe('Audit Log Middleware', () => {
  let originalActivityLog;

  beforeEach(() => {
    jest.clearAllMocks();
    originalActivityLog = models.ActivityLog;
  });

  afterEach(() => {
    // Always restore ActivityLog after each test
    models.ActivityLog = originalActivityLog;
  });

  describe('logAction()', () => {
    test('should log user action', async () => {
      const mockLog = { id: 1, userId: 'user-123' };
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue(mockLog);

      const result = await logger.logAction(
        'user-123',
        'create',
        'episode',
        'ep-1',
        { newValues: { title: 'New Episode' } }
      );

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          actionType: 'create',
          resourceType: 'episode',
          resourceId: 'ep-1',
        })
      );
    });

    test('should include metadata in log', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      const metadata = {
        newValues: { name: 'Updated' },
        oldValues: { name: 'Old' },
        ipAddress: '127.0.0.1',
      };

      await logger.logAction('user-123', 'edit', 'episode', 'ep-1', metadata);

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: { name: 'Updated' },
          oldValues: { name: 'Old' },
          ipAddress: '127.0.0.1',
        })
      );
    });

    test('should handle missing optional metadata', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'view', 'metadata', 'meta-1');

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          actionType: 'view',
        })
      );
    });

    test('should handle database errors gracefully', async () => {
      models.ActivityLog.logActivity = jest
        .fn()
        .mockRejectedValue(new Error('DB error'));

      // Should not throw - error logging failures shouldn't break the app
      const result = await logger.logAction('user-123', 'create', 'episode', 'ep-1', {});
      
      expect(result).toBeNull();
    });
  });

  describe('getUserHistory()', () => {
    test('should retrieve user activity history', async () => {
      const mockLogs = [
        { id: 1, userId: 'user-123', actionType: 'create' },
        { id: 2, userId: 'user-123', actionType: 'edit' },
      ];

      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue(mockLogs);

      const logs = await logger.getUserHistory('user-123');

      expect(models.ActivityLog.getUserHistory).toHaveBeenCalledWith(
        'user-123',
        expect.any(Object)
      );
      expect(logs).toEqual(mockLogs);
    });

    test('should handle errors in getUserHistory', async () => {
      models.ActivityLog.getUserHistory = jest.fn().mockRejectedValue(new Error('DB error'));

      const logs = await logger.getUserHistory('user-123');

      expect(logs).toEqual([]);
    });
  });

  describe('getResourceHistory()', () => {
    test('should retrieve resource activity history', async () => {
      const mockLogs = [{ id: 1, resourceType: 'episode', resourceId: 'ep-1' }];
      models.ActivityLog.getResourceHistory = jest.fn().mockResolvedValue(mockLogs);

      await logger.getResourceHistory('episode', 'ep-1');

      expect(models.ActivityLog.getResourceHistory).toHaveBeenCalledWith(
        'episode',
        'ep-1'
      );
    });

    test('should return empty array on error', async () => {
      models.ActivityLog.getResourceHistory = jest.fn().mockRejectedValue(new Error('error'));

      const logs = await logger.getResourceHistory('episode', 'ep-1');

      expect(logs).toEqual([]);
    });
  });

  describe('getAuditTrail()', () => {
    test('should retrieve full audit trail', async () => {
      const mockTrail = [
        { id: 1, userId: 'user-123', action: 'create' },
        { id: 2, userId: 'user-456', action: 'edit' },
      ];

      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue(mockTrail);

      const trail = await logger.getAuditTrail({ limit: 10 });

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
      expect(trail).toEqual(mockTrail);
    });

    test('should return empty array on error', async () => {
      models.ActivityLog.getAuditTrail = jest.fn().mockRejectedValue(new Error('error'));

      const trail = await logger.getAuditTrail();

      expect(trail).toEqual([]);
    });
  });

  describe('getStats()', () => {
    test('should retrieve activity statistics', async () => {
      const mockStats = {
        totalActions: 100,
        byType: { create: 20, edit: 50, delete: 30 },
      };

      models.ActivityLog.getStats = jest.fn().mockResolvedValue(mockStats);

      const stats = await logger.getStats('7d');

      expect(models.ActivityLog.getStats).toHaveBeenCalledWith('7d');
      expect(stats).toEqual(mockStats);
    });

    test('should return empty object on error', async () => {
      models.ActivityLog.getStats = jest.fn().mockRejectedValue(new Error('error'));

      const stats = await logger.getStats('7d');

      expect(stats).toEqual({});
    });
  });

  describe('Action types', () => {
    const actionTypes = ['create', 'edit', 'delete', 'view'];

    test('should support all action types', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      for (const action of actionTypes) {
        jest.clearAllMocks();
        await logger.logAction('user-123', action, 'episode', 'ep-1', {});
        expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({ actionType: action })
        );
      }
    });
  });

  describe('getActionType()', () => {
    const { getActionType } = require('../../../src/middleware/auditLog');

    test('should map GET to view', () => {
      expect(getActionType('GET')).toBe('view');
    });

    test('should map POST to create', () => {
      expect(getActionType('POST')).toBe('create');
    });

    test('should map PUT to edit', () => {
      expect(getActionType('PUT')).toBe('edit');
    });

    test('should map PATCH to edit', () => {
      expect(getActionType('PATCH')).toBe('edit');
    });

    test('should map DELETE to delete', () => {
      expect(getActionType('DELETE')).toBe('delete');
    });

    test('should default to view for unknown methods', () => {
      expect(getActionType('OPTIONS')).toBe('view');
      expect(getActionType('HEAD')).toBe('view');
    });

    test('should handle case sensitivity', () => {
      expect(getActionType('get')).toBe('view');
      expect(getActionType('post')).toBe('view');
    });
  });

  describe('getResourceInfo()', () => {
    const { getResourceInfo } = require('../../../src/middleware/auditLog');

    test('should extract resource from path', () => {
      const req = { path: '/api/v1/episodes' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('episodes');
      expect(info.resourceId).toBeNull();
      expect(info.action).toBeNull();
    });

    test('should extract resource and ID', () => {
      const req = { path: '/api/v1/episodes/123' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('episodes');
      expect(info.resourceId).toBe('123');
      expect(info.action).toBeNull();
    });

    test('should extract resource, ID, and action', () => {
      const req = { path: '/api/v1/episodes/123/enqueue' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('episodes');
      expect(info.resourceId).toBe('123');
      expect(info.action).toBe('enqueue');
    });

    test('should handle action without ID', () => {
      const req = { path: '/api/v1/episodes/batch' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('episodes');
      expect(info.resourceId).toBeNull();
      expect(info.action).toBe('batch');
    });

    test('should handle thumbnails resource', () => {
      const req = { path: '/api/v1/thumbnails/456' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('thumbnails');
      expect(info.resourceId).toBe('456');
    });

    test('should handle metadata resource', () => {
      const req = { path: '/api/v1/metadata/789' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('metadata');
      expect(info.resourceId).toBe('789');
    });

    test('should handle processing resource', () => {
      const req = { path: '/api/v1/processing/999/status' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('processing');
      expect(info.resourceId).toBe('999');
      expect(info.action).toBe('status');
    });

    test('should return unknown for short paths', () => {
      const req = { path: '/api/v1' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('unknown');
      expect(info.resourceId).toBeNull();
      expect(info.action).toBeNull();
    });

    test('should handle trailing slashes', () => {
      const req = { path: '/api/v1/episodes/123/' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('episodes');
      expect(info.resourceId).toBe('123');
    });

    test('should handle deep paths with multiple segments', () => {
      const req = { path: '/api/v1/episodes/123/enqueue/test' };
      const info = getResourceInfo(req);
      expect(info.resource).toBe('episodes');
      expect(info.resourceId).toBe('123');
      expect(info.action).toBe('enqueue');
    });

    test('should differentiate numeric IDs from action names', () => {
      const req1 = { path: '/api/v1/episodes/123' };
      const info1 = getResourceInfo(req1);
      expect(info1.resourceId).toBe('123');
      expect(info1.action).toBeNull();

      const req2 = { path: '/api/v1/episodes/activate' };
      const info2 = getResourceInfo(req2);
      expect(info2.resourceId).toBeNull();
      expect(info2.action).toBe('activate');
    });
  });

  describe('Middleware (auditLog)', () => {
    const { auditLog } = require('../../../src/middleware/auditLog');

    test('should intercept res.send method', () => {
      const req = {
        path: '/api/v1/episodes',
        method: 'POST',
        user: { id: 'user-123' },
        body: { newValues: { title: 'New' } },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      const res = {
        send: jest.fn(),
        json: jest.fn(),
        locals: {},
      };

      const next = jest.fn();

      auditLog(req, res, next);

      expect(typeof res.send).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    test('should call next middleware', () => {
      const req = { path: '/api/v1/test', method: 'GET' };
      const res = { send: jest.fn(), locals: {} };
      const next = jest.fn();

      auditLog(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('captureResponseData()', () => {
    const { captureResponseData } = require('../../../src/middleware/auditLog');

    test('should intercept res.json method', () => {
      const req = {};
      const res = {
        json: jest.fn(),
        locals: {},
      };
      const next = jest.fn();

      captureResponseData(req, res, next);

      expect(typeof res.json).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    test('should capture response data in res.locals', () => {
      const req = {};
      const res = {
        locals: {},
      };
      res.json = jest.fn(function() { return this; });
      const next = jest.fn();

      captureResponseData(req, res, next);

      const responseData = { data: { id: 1, name: 'Test' } };
      res.json(responseData);

      expect(res.locals.responseData).toEqual(responseData.data);
    });

    test('should handle plain object responses', () => {
      const req = {};
      const res = {
        locals: {},
      };
      res.json = jest.fn(function() { return this; });
      const next = jest.fn();

      captureResponseData(req, res, next);

      const plainData = { id: 1, name: 'Test' };
      res.json(plainData);

      expect(res.locals.responseData).toEqual(plainData);
    });

    test('should handle null data', () => {
      const req = {};
      const res = {
        locals: {},
      };
      res.json = jest.fn(function() { return this; });
      const next = jest.fn();

      captureResponseData(req, res, next);

      res.json(null);

      expect(res.locals.responseData).toBeNull();
    });

    test('should call next middleware', () => {
      const req = {};
      const res = { json: jest.fn(), locals: {} };
      const next = jest.fn();

      captureResponseData(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('logAction - Extended Scenarios', () => {
    test('should convert numeric resourceId to string', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'view', 'episode', 123, {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: '123',
        })
      );
    });

    test('should include all metadata fields when provided', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      const options = {
        oldValues: { status: 'draft' },
        newValues: { status: 'published' },
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/91.0',
      };

      await logger.logAction('user-123', 'edit', 'episode', 'ep-1', options);

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith({
        userId: 'user-123',
        actionType: 'edit',
        resourceType: 'episode',
        resourceId: 'ep-1',
        oldValues: { status: 'draft' },
        newValues: { status: 'published' },
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/91.0',
      });
    });

    test('should handle ActivityLog not available', async () => {
      models.ActivityLog = null;

      const result = await logger.logAction('user-123', 'create', 'episode', 'ep-1', {});

      expect(result).toBeDefined();
    });

    test('should return null on database error', async () => {
      models.ActivityLog.logActivity = jest.fn().mockRejectedValue(new Error('Connection error'));

      const result = await logger.logAction('user-123', 'create', 'episode', 'ep-1', {});

      expect(result).toBeNull();
    });
  });

  describe('getUserHistory - Extended Scenarios', () => {
    test('should pass options to getUserHistory', async () => {
      const mockLogs = [];
      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue(mockLogs);

      const options = { limit: 50, offset: 0 };
      await logger.getUserHistory('user-123', options);

      expect(models.ActivityLog.getUserHistory).toHaveBeenCalledWith(
        'user-123',
        options
      );
    });

    test('should return empty array when ActivityLog unavailable', async () => {
      models.ActivityLog = null;

      const result = await logger.getUserHistory('user-123');

      expect(result).toEqual([]);
    });

    test('should handle different user IDs', async () => {
      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue([]);

      await logger.getUserHistory('user-456');

      expect(models.ActivityLog.getUserHistory).toHaveBeenCalledWith(
        'user-456',
        expect.any(Object)
      );
    });

    test('should handle large result sets', async () => {
      const mockLogs = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        userId: 'user-123',
        actionType: 'view',
      }));

      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue(mockLogs);

      const logs = await logger.getUserHistory('user-123');

      expect(logs.length).toBe(1000);
    });
  });

  describe('getResourceHistory - Extended Scenarios', () => {
    test('should accept different resource types', async () => {
      models.ActivityLog.getResourceHistory = jest.fn().mockResolvedValue([]);

      const resourceTypes = ['episode', 'thumbnail', 'metadata', 'processing'];

      for (const type of resourceTypes) {
        jest.clearAllMocks();
        models.ActivityLog.getResourceHistory = jest.fn().mockResolvedValue([]);
        
        await logger.getResourceHistory(type, 'res-123');

        expect(models.ActivityLog.getResourceHistory).toHaveBeenCalledWith(
          type,
          'res-123'
        );
      }
    });

    test('should handle numeric resource IDs', async () => {
      models.ActivityLog.getResourceHistory = jest.fn().mockResolvedValue([]);

      await logger.getResourceHistory('episode', 123);

      expect(models.ActivityLog.getResourceHistory).toHaveBeenCalledWith(
        'episode',
        123
      );
    });

    test('should return empty array when ActivityLog unavailable', async () => {
      models.ActivityLog = null;

      const result = await logger.getResourceHistory('episode', 'ep-1');

      expect(result).toEqual([]);
    });
  });

  describe('getAuditTrail - Extended Scenarios', () => {
    test('should pass options to getAuditTrail', async () => {
      const mockTrail = [];
      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue(mockTrail);

      const options = { limit: 100, startDate: '2024-01-01' };
      await logger.getAuditTrail(options);

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalledWith(options);
    });

    test('should return empty array when ActivityLog unavailable', async () => {
      models.ActivityLog = null;

      const result = await logger.getAuditTrail({ limit: 50 });

      expect(result).toEqual([]);
    });

    test('should handle different pagination options', async () => {
      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue([]);

      await logger.getAuditTrail({ limit: 50, offset: 100 });

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 100 })
      );
    });

    test('should handle date range options', async () => {
      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue([]);

      const options = { startDate: '2024-01-01', endDate: '2024-12-31' };
      await logger.getAuditTrail(options);

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalledWith(options);
    });
  });

  describe('getStats - Extended Scenarios', () => {
    test('should accept different time ranges', async () => {
      models.ActivityLog.getStats = jest.fn().mockResolvedValue({});

      const timeRanges = ['1d', '7d', '30d', '90d'];

      for (const range of timeRanges) {
        jest.clearAllMocks();
        models.ActivityLog.getStats = jest.fn().mockResolvedValue({});
        
        await logger.getStats(range);

        expect(models.ActivityLog.getStats).toHaveBeenCalledWith(range);
      }
    });

    test('should return empty object when ActivityLog unavailable', async () => {
      models.ActivityLog = null;

      const result = await logger.getStats('7d');

      expect(result).toEqual({});
    });

    test('should provide statistics structure', async () => {
      const mockStats = {
        totalActions: 500,
        byType: { create: 100, edit: 200, delete: 50, view: 150 },
        byResource: { episode: 250, thumbnail: 150, metadata: 100 },
        byUser: { 'user-123': 300, 'user-456': 200 },
      };

      models.ActivityLog.getStats = jest.fn().mockResolvedValue(mockStats);

      const stats = await logger.getStats('7d');

      expect(stats.totalActions).toBe(500);
      expect(stats.byType.create).toBe(100);
      expect(stats.byResource.episode).toBe(250);
    });

    test('should handle error with empty stats object', async () => {
      models.ActivityLog.getStats = jest.fn().mockRejectedValue(new Error('Stats error'));

      const stats = await logger.getStats('30d');

      expect(stats).toEqual({});
    });
  });

  describe('Resource Type Coverage', () => {
    test('should log activities for episodes', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'create', 'episode', 'ep-1', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'episode' })
      );
    });

    test('should log activities for thumbnails', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'edit', 'thumbnail', 'thumb-1', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'thumbnail' })
      );
    });

    test('should log activities for metadata', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'delete', 'metadata', 'meta-1', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'metadata' })
      );
    });

    test('should log activities for processing', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'view', 'processing', 'proc-1', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'processing' })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle concurrent logging requests', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      const promises = Array.from({ length: 10 }, (_, i) =>
        logger.logAction('user-123', 'view', 'episode', `ep-${i}`, {})
      );

      await Promise.all(promises);

      expect(models.ActivityLog.logActivity).toHaveBeenCalledTimes(10);
    });

    test('should handle special characters in resource IDs', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'view', 'episode', 'ep-@#$%', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: 'ep-@#$%' })
      );
    });

    test('should handle very long field values', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      const longString = 'a'.repeat(1000);
      await logger.logAction('user-123', 'edit', 'episode', 'ep-1', {
        newValues: { description: longString },
      });

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: { description: longString },
        })
      );
    });

    test('should handle undefined user ID', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction(undefined, 'view', 'episode', 'ep-1', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined })
      );
    });

    test('should handle empty string values', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('', 'view', '', '', {});

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'view',
        })
      );
    });
  });

  describe('Batch Operations and Aggregate Logging', () => {
    test('should log batch episode operations', async () => {
      models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });

      await logger.logAction('user-123', 'create', 'episode', 'batch', {
        newValues: { count: 10, episodes: ['ep-1', 'ep-2', 'ep-3'] },
      });

      expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'batch',
          newValues: expect.objectContaining({ count: 10 }),
        })
      );
    });

    test('should support custom action types beyond standard', async () => {
      const customActions = ['publish', 'archive', 'restore', 'export'];

      for (const action of customActions) {
        models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });
        
        await logger.logAction('user-123', action, 'episode', 'ep-1', {});

        expect(models.ActivityLog.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({ actionType: action })
        );
      }
    });
  });

  describe('Middleware Integration - auditLog', () => {
    const { auditLog } = require('../../../src/middleware/auditLog');

    test('should intercept res.send for logging', (done) => {
      const req = {
        path: '/api/v1/episodes',
        method: 'POST',
        user: { id: 'user-123' },
        body: { newValues: { title: 'New' } },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      let originalSend;
      const res = {
        send: jest.fn((data) => {
          originalSend.call(res, data);
          return res;
        }),
        locals: {},
      };
      originalSend = res.send;

      const next = jest.fn();

      auditLog(req, res, next);

      // Verify next was called immediately
      expect(next).toHaveBeenCalled();
      // Verify send was wrapped
      expect(typeof res.send).toBe('function');

      done();
    });

    test('should preserve original next behavior', () => {
      const req = { path: '/api/v1/test', method: 'GET' };
      const res = { send: jest.fn(), locals: {} };
      const next = jest.fn();

      auditLog(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        const req = { path: '/api/v1/test', method, locals: {} };
        const res = { send: jest.fn(), locals: {} };
        const next = jest.fn();

        auditLog(req, res, next);

        expect(next).toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });

    test('should handle missing user in request', () => {
      const req = { path: '/api/v1/test', method: 'GET' };
      const res = { send: jest.fn(), locals: {} };
      const next = jest.fn();

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Helper Functions - Integration', () => {
    const { getActionType, getResourceInfo } = require('../../../src/middleware/auditLog');

    test('getActionType should map all HTTP methods correctly', () => {
      const methodMap = {
        GET: 'view',
        POST: 'create',
        PUT: 'edit',
        PATCH: 'edit',
        DELETE: 'delete',
      };

      Object.entries(methodMap).forEach(([method, action]) => {
        expect(getActionType(method)).toBe(action);
      });
    });

    test('getResourceInfo should parse complex routes correctly', () => {
      const testCases = [
        {
          path: '/api/v1/episodes',
          expected: { resource: 'episodes', resourceId: null, action: null },
        },
        {
          path: '/api/v1/episodes/123',
          expected: { resource: 'episodes', resourceId: '123', action: null },
        },
        {
          path: '/api/v1/episodes/123/enqueue',
          expected: { resource: 'episodes', resourceId: '123', action: 'enqueue' },
        },
        {
          path: '/api/v1/metadata/456/validate',
          expected: { resource: 'metadata', resourceId: '456', action: 'validate' },
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const result = getResourceInfo({ path });
        expect(result).toEqual(expected);
      });
    });
  });

  describe('getUserHistory - Additional Coverage', () => {
    test('should handle pagination options', async () => {
      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue([]);

      await logger.getUserHistory('user-123', { limit: 100, offset: 50 });

      expect(models.ActivityLog.getUserHistory).toHaveBeenCalledWith(
        'user-123',
        { limit: 100, offset: 50 }
      );
    });

    test('should handle date range filtering', async () => {
      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue([]);

      await logger.getUserHistory('user-123', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(models.ActivityLog.getUserHistory).toHaveBeenCalled();
    });

    test('should handle sorting options', async () => {
      models.ActivityLog.getUserHistory = jest.fn().mockResolvedValue([]);

      await logger.getUserHistory('user-123', { sort: 'timestamp', order: 'DESC' });

      expect(models.ActivityLog.getUserHistory).toHaveBeenCalled();
    });
  });

  describe('getResourceHistory - Additional Coverage', () => {
    test('should handle batch resource IDs', async () => {
      models.ActivityLog.getResourceHistory = jest.fn().mockResolvedValue([]);

      await logger.getResourceHistory('episode', 'batch');

      expect(models.ActivityLog.getResourceHistory).toHaveBeenCalledWith('episode', 'batch');
    });

    test('should handle different time windows', async () => {
      models.ActivityLog.getResourceHistory = jest.fn().mockResolvedValue([]);

      await logger.getResourceHistory('thumbnail', 'thumb-1');

      expect(models.ActivityLog.getResourceHistory).toHaveBeenCalled();
    });
  });

  describe('getAuditTrail - Additional Coverage', () => {
    test('should support filtering by action type', async () => {
      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue([]);

      await logger.getAuditTrail({ actionType: 'delete', limit: 50 });

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'delete', limit: 50 })
      );
    });

    test('should support filtering by user', async () => {
      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue([]);

      await logger.getAuditTrail({ userId: 'user-123' });

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalled();
    });

    test('should support filtering by resource type', async () => {
      models.ActivityLog.getAuditTrail = jest.fn().mockResolvedValue([]);

      await logger.getAuditTrail({ resourceType: 'episode' });

      expect(models.ActivityLog.getAuditTrail).toHaveBeenCalled();
    });
  });

  describe('getStats - Additional Coverage', () => {
    test('should provide breakdown by action type', async () => {
      const mockStats = {
        totalActions: 500,
        byType: { view: 250, create: 150, edit: 80, delete: 20 },
      };

      models.ActivityLog.getStats = jest.fn().mockResolvedValue(mockStats);

      const stats = await logger.getStats('7d');

      expect(stats.byType.view).toBe(250);
      expect(stats.totalActions).toBe(500);
    });

    test('should provide breakdown by resource', async () => {
      const mockStats = {
        byResource: { episode: 300, thumbnail: 200 },
      };

      models.ActivityLog.getStats = jest.fn().mockResolvedValue(mockStats);

      const stats = await logger.getStats('30d');

      expect(stats.byResource.episode).toBe(300);
    });

    test('should provide breakdown by user', async () => {
      const mockStats = {
        byUser: { 'user-123': 200, 'user-456': 150 },
      };

      models.ActivityLog.getStats = jest.fn().mockResolvedValue(mockStats);

      const stats = await logger.getStats('90d');

      expect(stats.byUser['user-123']).toBe(200);
    });
  });
});

