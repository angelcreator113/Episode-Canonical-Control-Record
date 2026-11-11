/**
 * logger.logAction: the one audit call the controllers make (issue #1948;
 * Evoni, 2026-11-11). It writes through ActivityLog.logActivity and nothing
 * else, never rejects, never records a view, an IP address or a user agent.
 */
jest.mock('../../../src/models', () => ({ models: { ActivityLog: {} } }));

const { models } = require('../../../src/models');
const auditLog = require('../../../src/middleware/auditLog');

const { logger, changesFrom, captureResponseData } = auditLog;
const UUID = '5d1c2a44-0c0a-4a5e-8a53-0e0a4f3f9b21';

beforeEach(() => {
  models.ActivityLog.logActivity = jest.fn().mockResolvedValue({ id: 1 });
});
afterEach(() => jest.restoreAllMocks());

describe('what the module is', () => {
  test('it exports the logger and the response capture; the request-logging middleware is gone', () => {
    expect(Object.keys(auditLog).sort()).toEqual(['captureResponseData', 'changesFrom', 'logger']);
    expect(auditLog.auditLog).toBeUndefined();
  });

  test('captureResponseData keeps what res.json sent and calls next', () => {
    const res = { locals: {}, json: jest.fn() };
    const next = jest.fn();
    captureResponseData({}, res, next);
    res.json({ data: { id: 3 } });
    expect(res.locals.responseData).toEqual({ id: 3 });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('changesFrom: the changes JSON', () => {
  test('old and new values become before and after; anything else goes under meta', () => {
    expect(changesFrom({ oldValues: { title: 'a' }, newValues: { title: 'b' }, changedFields: ['title'] }))
      .toEqual({ before: { title: 'a' }, after: { title: 'b' }, meta: { changedFields: ['title'] } });
    expect(changesFrom({ fileName: 'cut.mp4', fileSize: 12 })).toEqual({ meta: { fileName: 'cut.mp4', fileSize: 12 } });
  });

  test('an IP address and a user agent are never kept', () => {
    expect(changesFrom({ newValues: { a: 1 }, ipAddress: '203.0.113.9', userAgent: 'Mozilla/5.0' })).toEqual({ after: { a: 1 } });
    expect(changesFrom({ ipAddress: '203.0.113.9', userAgent: 'Mozilla/5.0' })).toBeNull();
  });

  test('nothing to record is null', () => {
    expect(changesFrom()).toBeNull();
    expect(changesFrom({ oldValues: null, newValues: undefined })).toBeNull();
  });
});

describe('logAction', () => {
  test('one call is one entry through the one writer', async () => {
    await expect(logger.logAction('user-1', 'edit', 'episode', UUID, { oldValues: { t: 1 }, newValues: { t: 2 }, ipAddress: '203.0.113.9' }))
      .resolves.toEqual({ id: 1 });
    expect(models.ActivityLog.logActivity).toHaveBeenCalledTimes(1);
    expect(models.ActivityLog.logActivity).toHaveBeenCalledWith({
      userId: 'user-1', action: 'edit', resourceType: 'episode', resourceId: UUID, changes: { before: { t: 1 }, after: { t: 2 } },
    });
  });

  test.each(['view', 'VIEW', 'View'])('a %s writes nothing', async (action) => {
    await expect(logger.logAction('user-1', action, 'episode', UUID, { episodeTitle: 'x' })).resolves.toBeNull();
    expect(models.ActivityLog.logActivity).not.toHaveBeenCalled();
  });

  test('a failed write is logged loudly and resolves to null: the request goes on', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    models.ActivityLog.logActivity = jest.fn().mockRejectedValue(new Error('value too long for type character varying(100)'));
    await expect(logger.logAction('user-1', 'edit', 'episode', UUID)).resolves.toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0].join(' ')).toMatch(/\[audit\] NOT RECORDED: edit episode .*value too long/);
  });

  test('a missing model is a logged failure, not a silent skip', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete models.ActivityLog;
    await expect(logger.logAction('user-1', 'delete', 'file', UUID)).resolves.toBeNull();
    expect(error.mock.calls[0].join(' ')).toMatch(/NOT RECORDED.*not loaded/);
    models.ActivityLog = {};
  });
});

describe('the readers fall back to nothing, with a logged reason', () => {
  test.each([
    ['getUserHistory', ['user-1', 10]],
    ['getResourceHistory', ['episode', UUID]],
    ['getAuditTrail', [new Date(0), new Date(), {}]],
    ['getStats', [7]],
  ])('%s', async (name, args) => {
    models.ActivityLog[name] = jest.fn().mockResolvedValue([{ id: 1 }]);
    await expect(logger[name](...args)).resolves.toEqual([{ id: 1 }]);
    expect(models.ActivityLog[name]).toHaveBeenCalledWith(...args);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    models.ActivityLog[name] = jest.fn().mockRejectedValue(new Error('down'));
    await expect(logger[name](...args)).resolves.toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
