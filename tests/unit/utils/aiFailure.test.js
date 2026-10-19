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
