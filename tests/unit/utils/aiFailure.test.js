// utils/aiFailure (the profile audit, 2026-10-19): a budget refusal is a 429
// with its own message; the AI unreachable or without a key is a plain 502;
// anything else is the route's own error.

const { aiFailure, isAiUnreachable, UNREACHABLE } = require('../../../src/utils/aiFailure');

const res = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

describe('aiFailure', () => {
  test('a budget refusal is a 429 with its own message', () => {
    const r = res();
    const err = Object.assign(new Error('AI daily budget exceeded ($50.00 / $50).'), { code: 'AI_BUDGET_EXCEEDED' });
    expect(aiFailure(r, err)).toBe(r);
    expect(r.status).toHaveBeenCalledWith(429);
    expect(r.json.mock.calls[0][0]).toMatchObject({ code: 'AI_BUDGET_EXCEEDED', error: err.message });
  });

  test.each([
    ['no key (the SDK\'s plain Error)', new Error('Could not resolve authentication method. Expected either apiKey or authToken to be set.')],
    ['a connection error', Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' })],
    ['an overloaded answer', Object.assign(new Error('Overloaded'), { status: 529 })],
    ['a missing key in our own service', Object.assign(new Error('ANTHROPIC_API_KEY not configured'), { code: 'AI_UNAVAILABLE', status: 503 })],
  ])('%s is a plain 502, never the raw text', (_label, err) => {
    const r = res();
    expect(isAiUnreachable(err)).toBe(true);
    aiFailure(r, err);
    expect(r.status).toHaveBeenCalledWith(502);
    expect(r.json.mock.calls[0][0]).toEqual({ success: false, code: 'AI_UNREACHABLE', error: UNREACHABLE });
  });

  test('anything else is left to the route', () => {
    const r = res();
    expect(aiFailure(r, new Error('column "x" does not exist'))).toBeNull();
    expect(r.status).not.toHaveBeenCalled();
    expect(isAiUnreachable(null)).toBe(false);
  });
});

// plainAiErrors (the book side check, P1, 2026-10-20): every writing-hub route
// that answers its raw AI failure as a 500 reaches the author plainly.
describe('plainAiErrors', () => {
  const { plainAiErrors } = require('../../../src/utils/aiFailure');
  const run = (status, body) => {
    const sent = {};
    const r = { statusCode: status };
    r.status = jest.fn((s) => { r.statusCode = s; return r; });
    r.json = jest.fn((b) => { sent.status = r.statusCode; sent.body = b; return r; });
    const next = jest.fn();
    plainAiErrors({}, r, next);
    expect(next).toHaveBeenCalled();
    r.status(status).json(body);
    return sent;
  };

  test('a raw connection error in a 500 becomes a plain 502', () => {
    expect(run(500, { error: 'Connection error.' })).toEqual({ status: 502, body: { success: false, code: 'AI_UNREACHABLE', error: UNREACHABLE } });
  });

  test('the missing-key text in details becomes a plain 502', () => {
    expect(run(500, { error: 'Failed', details: 'Could not resolve authentication method. Expected either apiKey or authToken to be set.' }).status).toBe(502);
  });

  test.each([
    ['error', { error: 'AI daily budget exceeded ($50.00 / $50). Call blocked.' }],
    ['details', { error: 'Failed', details: 'AI daily budget exceeded ($50.00 / $50). Call blocked.' }],
    ['message', { message: 'Image generation is paused until tomorrow.' }],
  ])('a budget refusal in %s becomes a 429 with its own reason', (_where, body) => {
    const sent = run(500, body);
    expect(sent.status).toBe(429);
    expect(sent.body.code).toBe('AI_BUDGET_EXCEEDED');
    expect(sent.body.error).toMatch(/budget exceeded|paused until tomorrow/);
  });

  test('a 500 that is not the AI, and any non-error answer, pass untouched', () => {
    expect(run(500, { error: 'column "x" does not exist' })).toEqual({ status: 500, body: { error: 'column "x" does not exist' } });
    expect(run(200, { error: 'Connection error.' })).toEqual({ status: 200, body: { error: 'Connection error.' } });
    expect(run(404, { error: 'Not found' })).toEqual({ status: 404, body: { error: 'Not found' } });
  });
});
