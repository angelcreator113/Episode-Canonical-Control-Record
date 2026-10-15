/**
 * The angle-vs-base consistency check (audit of the Scene Sets page,
 * 2026-10-15): a check that could not run (no key, an error, no JSON, no
 * score) says so, checked: false and score null. It used to return a
 * perfect 100, which hid every failed check.
 */
const replies = { next: null };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: jest.fn(async () => {
    if (replies.next instanceof Error) throw replies.next;
    return { content: [{ type: 'text', text: replies.next }] };
  }) },
})));

const { checkAngleConsistency } = require('../../../src/services/sceneGenerationService');

describe('checkAngleConsistency', () => {
  const run = () => checkAngleConsistency('https://s3/base.png', 'https://s3/angle.png', 'Vanity');
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); delete process.env.ANTHROPIC_API_KEY; });

  test('a scored reply is a check that ran', async () => {
    replies.next = '{"score": 62, "issues": ["the bed moved"]}';
    expect(await run()).toMatchObject({ checked: true, score: 62, pass: false, issues: ['the bed moved'] });
    replies.next = '{"score": 91, "issues": []}';
    expect(await run()).toMatchObject({ checked: true, score: 91, pass: true });
  });

  test('an error, no JSON, no score or no key is unchecked, never a pass', async () => {
    replies.next = new Error('could not fetch image');
    expect(await run()).toEqual({ checked: false, score: null, issues: [], pass: null, reason: 'could not fetch image' });
    replies.next = 'I cannot compare these.';
    expect(await run()).toMatchObject({ checked: false, score: null, pass: null });
    replies.next = '{"issues": []}';
    expect(await run()).toMatchObject({ checked: false, score: null });
    delete process.env.ANTHROPIC_API_KEY;
    expect(await run()).toMatchObject({ checked: false, score: null, reason: 'ANTHROPIC_API_KEY not configured' });
  });
});
