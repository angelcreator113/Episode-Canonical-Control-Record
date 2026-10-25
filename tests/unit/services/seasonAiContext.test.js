// The season's AI calls share one retry rule (planner PR 4, 2026-10-24):
// two tries, a short pause before the second on 529/503, and never a second
// try after a budget refusal. The SDK is mocked; nothing reaches the network.

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const Anthropic = require('@anthropic-ai/sdk');
const {
  askModel, setRetryPause, RETRY_PAUSE_MS, isBudgetRefusal, phaseLine, threadLine, goalLine, debtLines, bullets,
} = require('../../../src/services/seasonAiContext');

const MODELS = ['model-under-test'];
const answer = (text) => ({ content: [{ type: 'text', text }] });
const budget = () => Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
const status = (code) => Object.assign(new Error(`status ${code}`), { status: code });
const ask = (extra = {}) => askModel({ api: new Anthropic(), models: MODELS, maxTokens: 100, prompt: 'p', label: 'test', ...extra });

describe('askModel: the house retry rule', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    setRetryPause(5);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => setRetryPause(RETRY_PAUSE_MS));

  test('a budget refusal is final: one call, the refusal thrown as it came', async () => {
    mockCreate.mockRejectedValue(budget());
    const err = await ask().catch((e) => e);
    expect(isBudgetRefusal(err)).toBe(true);
    expect(err.status).toBe(429);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('529 (overloaded): a pause, then a second call that answers', async () => {
    mockCreate.mockRejectedValueOnce(status(529)).mockResolvedValueOnce(answer('ok'));
    const started = Date.now();
    const res = await ask();
    expect(res.content[0].text).toBe('ok');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4);
  });

  test('503 twice: two calls, then the error', async () => {
    mockCreate.mockRejectedValue(status(503));
    await expect(ask()).rejects.toMatchObject({ status: 503 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('a 529 then a budget refusal stops at the refusal', async () => {
    mockCreate.mockRejectedValueOnce(status(529)).mockRejectedValueOnce(budget());
    await expect(ask()).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('another failure is tried twice, with no pause', async () => {
    mockCreate.mockRejectedValue(new Error('socket hang up'));
    await expect(ask()).rejects.toThrow('socket hang up');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('an unreadable answer is asked again once through read', async () => {
    mockCreate.mockResolvedValueOnce(answer('no json')).mockResolvedValueOnce(answer('{"a":1}'));
    const read = (r) => JSON.parse(r.content[0].text);
    await expect(ask({ read })).resolves.toEqual({ a: 1 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('an answer first time is one call, with the model, tokens and prompt given', async () => {
    mockCreate.mockResolvedValue(answer('ok'));
    await ask();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({ model: 'model-under-test', max_tokens: 100, messages: [{ role: 'user', content: 'p' }] });
  });
});

describe('the shared lines', () => {
  const p = { phase: 2, title: 'Ascension', tagline: 'Climb', status: 'active', episode_start: 9, episode_end: 16, emotional_arc: 'hungry' };
  test('phaseLine: a phase, or a part with its range', () => {
    expect(phaseLine(p)).toBe('Phase 2: Ascension ("Climb"); emotional arc: hungry');
    expect(phaseLine(p, { status: true })).toBe('Phase 2 (active): Ascension ("Climb"); emotional arc: hungry');
    expect(phaseLine({ phase: 3, title: 'Legacy' }, { status: true })).toBe('Phase 3 (upcoming): Legacy');
    expect(phaseLine(p, { word: 'Part', range: true })).toBe('Part 2: Ascension ("Climb"), E9–E16; emotional arc: hungry');
  });
  test('threadLine: id, status and description when asked', () => {
    const t = { id: 't-1', title: 'The rival', status: 'open', description: 'Someone   copies Lala' };
    expect(threadLine(t)).toBe('- [t-1] The rival');
    expect(threadLine(t, { id: false })).toBe('- The rival');
    expect(threadLine(t, { status: true })).toBe('- [t-1] The rival (open)');
    expect(threadLine(t, { description: 8 })).toBe('- [t-1] The rival — Someone ');
    expect(threadLine(t, { description: true })).toBe('- [t-1] The rival — Someone copies Lala');
  });
  test('goalLine and debtLines', () => {
    const g = { title: 'Reach 10', target_metric: 'reputation', current_value: 4, target_value: 10, episode_range: '[1,8]', status: 'active' };
    expect(goalLine(g)).toBe('- Reach 10 (reputation 4/10)');
    expect(goalLine(g, { status: true, range: true })).toBe('- Reach 10 (reputation 4/10, episodes 1–8, active)');
    expect(debtLines([{ narrative_weight: 'She owes Sable' }, { goal_title: 'Rent' }])).toBe('- She owes Sable\n- Rent');
    expect(debtLines([])).toBe('- None.');
    expect(bullets([], String, '(none)')).toBe('(none)');
  });
});
