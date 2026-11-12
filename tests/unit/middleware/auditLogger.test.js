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
    expect(Object.keys(auditLog).sort()).toEqual(['LONG_TEXT', 'captureResponseData', 'changesFrom', 'episodeSummary', 'fieldChanges', 'limited', 'logger', 'only']);
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

describe('what an entry may hold, whoever calls (Evoni, 2026-11-11)', () => {
  const { episodeSummary, only, limited } = auditLog;
  const SCRIPT = 'INT. STUDIO - DAY\nLALA\nWe begin.\n'.repeat(120);

  test('a long text anywhere in an entry is its length and SHA-256, never its words', () => {
    const changes = changesFrom({ newValues: { title: 'T', script_content: SCRIPT }, note: SCRIPT, nested: { deep: [SCRIPT] } });
    expect(changes.after.title).toBe('T');
    expect(changes.after.script_content).toEqual({ long_text: true, length: SCRIPT.length, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(changes.meta.note.long_text).toBe(true);
    expect(changes.meta.nested.deep[0].long_text).toBe(true);
    expect(JSON.stringify(changes)).not.toContain('INT. STUDIO');
  });

  test('a credential-like key keeps its name and loses its value, at any depth', () => {
    const changes = changesFrom({
      newValues: { title: 'T', password: 'hunter2', apiKey: 'sk-live-1', api_key: 'k', accessToken: 'eyJ', refresh_token: 'r',
        Authorization: 'Bearer x', client_secret: 's', cookie: 'c', presignedUrl: 'https://signed', nested: { s3: { secretAccessKey: 'aws' } }, empty_token: null },
      sessionId: 'abc',
    });
    const text = JSON.stringify(changes);
    for (const value of ['hunter2', 'sk-live-1', 'eyJ', 'Bearer x', 'https://signed', '"aws"', '"abc"']) expect(text).not.toContain(value);
    expect(changes.after).toMatchObject({ title: 'T', password: '[removed]', apiKey: '[removed]', api_key: '[removed]', accessToken: '[removed]',
      refresh_token: '[removed]', Authorization: '[removed]', client_secret: '[removed]', cookie: '[removed]', presignedUrl: '[removed]', empty_token: null });
    expect(changes.after.nested.s3.secretAccessKey).toBe('[removed]');
    expect(changes.meta.sessionId).toBe('[removed]');
  });

  test('ordinary fields that merely resemble one are kept', () => {
    const changes = changesFrom({ newValues: { title: 'Pass the mic', status: 'draft', tags: ['secretly-good'], episode_number: 3 } });
    expect(changes.after).toEqual({ title: 'Pass the mic', status: 'draft', tags: ['secretly-good'], episode_number: 3 });
  });

  test('a long list keeps its first 50 items and the count of the rest; useful tags survive', () => {
    const tags = Array.from({ length: 80 }, (_, i) => `tag-${i}`);
    expect(changesFrom({ newValues: { tags: ['fashion', 'finale'] } }).after.tags).toEqual(['fashion', 'finale']);
    const kept = changesFrom({ newValues: { tags } }).after.tags;
    expect(kept).toHaveLength(51);
    expect(kept.slice(0, 50)).toEqual(tags.slice(0, 50));
    expect(kept[50]).toEqual({ more_items: 30 });
  });

  test('deep nesting, many keys and an oversized section are bounded', () => {
    let deep = 'leaf';
    for (let i = 0; i < 12; i += 1) deep = { inner: deep };
    expect(JSON.stringify(changesFrom({ newValues: deep }))).toContain('[nested]');
    expect(JSON.stringify(changesFrom({ newValues: deep }))).not.toContain('leaf');

    const wide = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
    const keptWide = changesFrom({ newValues: wide }).after;
    expect(Object.keys(keptWide)).toHaveLength(61);
    expect(keptWide.more_keys).toBe(40);

    // 40 fields of 1,900 characters each: every one is under the long-text line, the section is not.
    const heavy = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`field${i}`, 'x'.repeat(1900)]));
    const keptHeavy = changesFrom({ newValues: heavy }).after;
    expect(keptHeavy).toMatchObject({ too_large: true, characters: expect.any(Number) });
    expect(keptHeavy.keys).toContain('field0');
    expect(JSON.stringify(keptHeavy).length).toBeLessThan(2000);
  });

  test('dates and model rows are stored as plain values', () => {
    const when = new Date('2026-11-11T10:00:00Z');
    expect(limited({ at: when, row: { toJSON: () => ({ id: 1, token: 't' }) } })).toEqual({ at: '2026-11-11T10:00:00.000Z', row: { id: 1, token: '[removed]' } });
  });

  test('episodeSummary: what identifies an episode and its state, never the script or the rest of the row', () => {
    const row = { id: UUID, show_id: 's', title: 'Pilot', episode_number: 1, season_number: 2, status: 'draft', air_date: '2026-12-01', categories: ['a'],
      script_content: SCRIPT, description: 'A long description', evaluation_json: { score: 9 }, thumbnail_url: 'https://x', created_at: 'now' };
    const summary = episodeSummary({ toJSON: () => row });
    expect(summary).toEqual({ id: UUID, show_id: 's', title: 'Pilot', episode_number: 1, season_number: 2, status: 'draft', air_date: '2026-12-01',
      categories: ['a'], has_script: true, script_length: SCRIPT.length });
    expect(JSON.stringify(summary)).not.toMatch(/INT\. STUDIO|description|evaluation_json|thumbnail/);
    expect(episodeSummary({ id: UUID, script_content: '   ' })).toMatchObject({ id: UUID, title: null, has_script: false, script_length: 3 });
    expect(episodeSummary(null)).toMatchObject({ id: null, has_script: false, script_length: 0 });
  });

  test('only: the named keys and nothing else', () => {
    expect(only({ id: 1, status: 'failed', data: { anything: true }, errorMessage: 'x' }, ['id', 'status', 'jobType'])).toEqual({ id: 1, status: 'failed' });
    expect(only(null, ['id'])).toEqual({});
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

describe('fieldChanges: what an update entry holds (Evoni, 2026-11-11)', () => {
  const { fieldChanges, LONG_TEXT } = auditLog;
  const sha = (text) => require('crypto').createHash('sha256').update(text).digest('hex');
  const SCRIPT = 'INT. STUDIO - DAY\n'.repeat(400);

  test('only the fields that changed, each with its before and after value', () => {
    const before = { id: UUID, title: 'Before', status: 'draft', episode_number: 3, script_content: SCRIPT, categories: ['a'] };
    const after = { ...before, title: 'After', status: 'scripted' };
    expect(fieldChanges(before, after)).toEqual({
      oldValues: { status: 'draft', title: 'Before' },
      newValues: { status: 'scripted', title: 'After' },
      changedFields: ['status', 'title'],
    });
  });

  test('an unrelated edit does not copy the script, or any unchanged field, into the entry', () => {
    const before = { title: 'Before', script_content: SCRIPT, description: 'same', season_context: { slot_number: 4 } };
    const entry = changesFrom(fieldChanges(before, { ...before, title: 'After' }));
    expect(entry).toEqual({ before: { title: 'Before' }, after: { title: 'After' }, meta: { changedFields: ['title'] } });
    expect(JSON.stringify(entry)).not.toContain('INT. STUDIO');
    expect(JSON.stringify(entry)).not.toMatch(/description|season_context|script_content/);
  });

  test('a script edit is recorded by length and SHA-256 on both sides, not copied', () => {
    const edited = `${SCRIPT}LALA\nA new line.\n`;
    const { oldValues, newValues, changedFields } = fieldChanges({ title: 't', script_content: SCRIPT }, { title: 't', script_content: edited });
    expect(changedFields).toEqual(['script_content']);
    expect(oldValues.script_content).toEqual({ long_text: true, length: SCRIPT.length, sha256: sha(SCRIPT) });
    expect(newValues.script_content).toEqual({ long_text: true, length: edited.length, sha256: sha(edited) });
    expect(oldValues.script_content.sha256).not.toBe(newValues.script_content.sha256);
    expect(JSON.stringify({ oldValues, newValues })).not.toContain('INT. STUDIO');
  });

  test('a first script, a cleared script and a short text keep what a reader needs', () => {
    expect(fieldChanges({ script_content: null }, { script_content: SCRIPT })).toMatchObject({
      oldValues: { script_content: null }, newValues: { script_content: { long_text: true, length: SCRIPT.length } },
    });
    expect(fieldChanges({ script_content: SCRIPT }, { script_content: null }).newValues).toEqual({ script_content: null });
    const short = 'x'.repeat(LONG_TEXT);
    expect(fieldChanges({ description: 'old' }, { description: short }).newValues).toEqual({ description: short });
    expect(fieldChanges({ description: 'old' }, { description: `${short}x` }).newValues.description).toMatchObject({ long_text: true, length: LONG_TEXT + 1 });
  });

  test('dates, lists and objects are compared by value; a field that appears or disappears is a change', () => {
    const at = new Date('2026-11-01T10:00:00Z');
    expect(fieldChanges({ air_date: at, categories: ['a', 'b'], evaluation_json: { score: 1 } },
      { air_date: new Date(at.getTime()), categories: ['a', 'b'], evaluation_json: { score: 1 } }).changedFields).toEqual([]);
    expect(fieldChanges({ categories: ['a'] }, { categories: ['a', 'b'] })).toMatchObject({
      oldValues: { categories: ['a'] }, newValues: { categories: ['a', 'b'] }, changedFields: ['categories'],
    });
    expect(fieldChanges({ a: 1 }, { a: 1, thumbnail_url: 'u' })).toMatchObject({ oldValues: { thumbnail_url: null }, newValues: { thumbnail_url: 'u' } });
    expect(fieldChanges({ a: 1, gone: 'x' }, { a: 1 })).toMatchObject({ oldValues: { gone: 'x' }, newValues: { gone: null }, changedFields: ['gone'] });
  });

  test('nothing changed (only updated_at moved): no before or after, an empty list of fields', () => {
    const row = { title: 'Same', updated_at: new Date('2026-11-01T00:00:00Z') };
    expect(fieldChanges(row, { title: 'Same', updated_at: new Date('2026-11-02T00:00:00Z') }))
      .toEqual({ oldValues: null, newValues: null, changedFields: [] });
    expect(changesFrom(fieldChanges(row, row))).toEqual({ meta: { changedFields: [] } });
    expect(fieldChanges(undefined, undefined).changedFields).toEqual([]);
  });
});
