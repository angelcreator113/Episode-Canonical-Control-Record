/**
 * searchLogger Middleware Unit Tests
 * Tests search query analytics logging
 */

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../src/utils/logger');
const searchLogger = require('../../../src/middleware/searchLogger');

describe('searchLogger', () => {
  let mockReq, mockRes, mockNext, originalJson;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { user: { id: 'user-123' }, queryTime: 50 };
    originalJson = jest.fn();
    mockRes = {
      json: originalJson,
    };
    mockNext = jest.fn();
  });

  it('should call next', () => {
    searchLogger(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should replace res.json with a wrapper function', () => {
    searchLogger(mockReq, mockRes, mockNext);
    expect(mockRes.json).not.toBe(originalJson);
    expect(typeof mockRes.json).toBe('function');
  });

  it('should pass data through to originalJson', () => {
    searchLogger(mockReq, mockRes, mockNext);
    const testData = { query: 'fashion', total: 5, hits: [1, 2, 3] };
    mockRes.json(testData);
    expect(originalJson).toHaveBeenCalledWith(testData);
  });

  it('should log debug when response has a query and results exist (1-999)', () => {
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'lala', total: 42, hits: [1, 2] });
    expect(logger.debug).toHaveBeenCalledWith('Search executed', expect.objectContaining({
      query: 'lala',
      totalHits: 42,
      resultsReturned: 2,
      userId: 'user-123',
    }));
  });

  it('should log info for zero-result searches', () => {
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'nothing', total: 0, hits: [] });
    expect(logger.info).toHaveBeenCalledWith('Search with zero results', expect.objectContaining({
      query: 'nothing',
      totalHits: 0,
    }));
  });

  it('should log info for popular searches (total > 1000)', () => {
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'popular', total: 1500, hits: new Array(20) });
    expect(logger.info).toHaveBeenCalledWith('Popular search query', expect.objectContaining({
      query: 'popular',
      totalHits: 1500,
    }));
  });

  it('should not log when response does not contain a query field', () => {
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ data: 'some other response' });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should use anonymous userId when req.user is not present', () => {
    mockReq.user = null;
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'test', total: 1, hits: [1] });
    expect(logger.debug).toHaveBeenCalledWith(
      'Search executed',
      expect.objectContaining({ userId: 'anonymous' })
    );
  });

  it('should include queryTime from req.queryTime', () => {
    mockReq.queryTime = 123;
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'timing', total: 1, hits: [1] });
    expect(logger.debug).toHaveBeenCalledWith(
      'Search executed',
      expect.objectContaining({ queryTime: 123 })
    );
  });

  it('should default resultsReturned to 0 when hits is undefined', () => {
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'no hits', total: 0 });
    expect(logger.info).toHaveBeenCalledWith(
      'Search with zero results',
      expect.objectContaining({ resultsReturned: 0 })
    );
  });

  it('should include a timestamp in the log data', () => {
    searchLogger(mockReq, mockRes, mockNext);
    mockRes.json({ query: 'ts', total: 1, hits: [1] });
    const logData = logger.debug.mock.calls[0][1];
    expect(logData).toHaveProperty('timestamp');
    expect(new Date(logData.timestamp).toString()).not.toBe('Invalid Date');
  });
});
