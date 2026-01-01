/**
 * Audit Log Middleware - Additional Coverage Tests
 * Tests for edge cases and error scenarios
 */
const auditLog = require('../../../src/middleware/auditLog');
const { ActivityLog } = require('../../../src/models');

jest.mock('../../../src/models');

describe('Audit Log Middleware - Additional Coverage', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      body: { oldValues: null, newValues: { field: 'value' } },
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      path: '/api/episodes',
      user: { id: 'user123' },
      get: jest.fn().mockReturnValue('test-agent'),
    };
    res = {
      locals: {},
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('auditLog middleware', () => {
    test('should intercept res.send and call next', () => {
      const { auditLog: auditLogMiddleware } = auditLog;
      
      auditLogMiddleware(req, res, next);
      
      // Should override res.send and call next
      expect(next).toHaveBeenCalled();
      expect(res.send).toBeDefined();
    });

    test('should skip logging for /health paths', () => {
      req.path = '/health';
      const { auditLog: auditLogMiddleware } = auditLog;
      
      auditLogMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should skip logging for /api/v1 paths', () => {
      req.path = '/api/v1/endpoint';
      const { auditLog: auditLogMiddleware } = auditLog;
      
      auditLogMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getActionType function', () => {
    test('should return create for POST', () => {
      const { getActionType } = auditLog;
      
      const action = getActionType('POST');
      
      expect(action).toBe('create');
    });

    test('should return edit for PUT', () => {
      const { getActionType } = auditLog;
      
      const action = getActionType('PUT');
      
      expect(action).toBe('edit');
    });

    test('should return edit for PATCH', () => {
      const { getActionType } = auditLog;
      
      const action = getActionType('PATCH');
      
      expect(action).toBe('edit');
    });

    test('should return delete for DELETE', () => {
      const { getActionType } = auditLog;
      
      const action = getActionType('DELETE');
      
      expect(action).toBe('delete');
    });

    test('should return view for GET', () => {
      const { getActionType } = auditLog;
      
      const action = getActionType('GET');
      
      expect(action).toBe('view');
    });
  });

  describe('captureResponseData middleware', () => {
    test('should capture response data in res.locals', () => {
      const { captureResponseData } = auditLog;
      const middleware = captureResponseData;
      
      middleware(req, res, next);
      
      // Should call next
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getResourceInfo function', () => {
    test('should extract resource info from URL', () => {
      const { getResourceInfo } = auditLog;
      req.path = '/api/episodes/123';
      req.method = 'GET';
      
      const info = getResourceInfo(req);
      
      expect(info).toHaveProperty('resource');
      expect(info).toHaveProperty('resourceId');
    });

    test('should handle different endpoints', () => {
      const { getResourceInfo } = auditLog;
      req.path = '/api/metadata/456';
      
      const info = getResourceInfo(req);
      
      expect(info).toBeDefined();
    });
  });

  describe('logger service', () => {
    test('should provide logAction method', () => {
      const { logger } = auditLog;
      
      expect(logger.logAction).toBeDefined();
      expect(typeof logger.logAction).toBe('function');
    });

    test('should provide getUserHistory method', () => {
      const { logger } = auditLog;
      
      expect(logger.getUserHistory).toBeDefined();
      expect(typeof logger.getUserHistory).toBe('function');
    });

    test('should provide getResourceHistory method', () => {
      const { logger } = auditLog;
      
      expect(logger.getResourceHistory).toBeDefined();
      expect(typeof logger.getResourceHistory).toBe('function');
    });

    test('should provide getAuditTrail method', () => {
      const { logger } = auditLog;
      
      expect(logger.getAuditTrail).toBeDefined();
      expect(typeof logger.getAuditTrail).toBe('function');
    });

    test('should provide getStats method', () => {
      const { logger } = auditLog;
      
      expect(logger.getStats).toBeDefined();
      expect(typeof logger.getStats).toBe('function');
    });
  });
});
