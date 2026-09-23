// ============================================================================
// aiCostTracker — daily budget counted from ai_usage_logs (#1735)
// ============================================================================
// Today's spend is SUM(cost_usd) of today's ai_usage_logs rows, cached for
// SPEND_CACHE_MS, plus spend this process recorded since the last read. Each
// test loads a fresh copy of the tracker (a "restart") against a mocked
// AIUsageLog. No network, no database.

let mockSum;          // jest.fn standing in for AIUsageLog.sum
let mockCreate;       // AIUsageLog.create; tests can delay the row write
const mockRows = [];

jest.mock('../../../src/models', () => ({
  AIUsageLog: {
    sum: (...a) => mockSum(...a),
    create: (...a) => mockCreate(...a),
  },
}));

const MESSAGE = {
  id: 'm1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
  content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 500 },   // $0.0105 at sonnet pricing
};
let fetchCalls = 0;
const fakeFetch = async () => {
  fetchCalls += 1;
  return new Response(JSON.stringify(MESSAGE), { status: 200, headers: { 'content-type': 'application/json' } });
};
// max_tokens 1000 at $15/M output → a worst-case estimate of $0.015.
const PARAMS = { model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: 'x' }] };

// The where clause is { created_at: { [Op.gte]: date } }; Op keys are Symbols.
const sinceOf = (options) => {
  const cond = options.where.created_at;
  return cond[Object.getOwnPropertySymbols(cond)[0]];
};
const settle = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));

// Load the tracker and the SDK fresh, as a restarted process would.
function loadFresh() {
  let tracker;
  let Anthropic;
  jest.isolateModules(() => {
    tracker = require('../../../src/services/aiCostTracker');
    Anthropic = require('@anthropic-ai/sdk');
  });
  const client = new Anthropic({ apiKey: 'test', fetch: fakeFetch, maxRetries: 0 });
  return { tracker, client };
}

beforeEach(() => {
  mockRows.length = 0;
  fetchCalls = 0;
  mockSum = jest.fn(async () => 0);
  mockCreate = async (row) => { mockRows.push(row); };
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
  jest.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('the default cap is $50 when AI_DAILY_BUDGET_USD is unset', () => {
  const saved = process.env.AI_DAILY_BUDGET_USD;
  delete process.env.AI_DAILY_BUDGET_USD;
  try {
    expect(loadFresh().tracker.DAILY_BUDGET).toBe(50);
  } finally {
    if (saved !== undefined) process.env.AI_DAILY_BUDGET_USD = saved;
  }
});

test("today's spend is read from logged usage, for the current UTC day", async () => {
  mockSum = jest.fn(async () => '12.345000');   // DECIMAL columns come back as strings
  const { tracker } = loadFresh();
  await tracker.refreshSpend();
  expect(tracker.getDailySpend()).toBeCloseTo(12.345, 6);
  const [column, options] = mockSum.mock.calls.at(-1);
  expect(column).toBe('cost_usd');
  const since = sinceOf(options);
  expect(since.toISOString()).toBe('2026-09-23T00:00:00.000Z');
});

test('a restart does not reset the counted spend', async () => {
  mockSum = jest.fn(async () => 30);
  const first = loadFresh().tracker;
  await first.refreshSpend();
  const second = loadFresh().tracker;           // a new process, nothing in memory
  await second.refreshSpend();
  expect(second.getDailySpend()).toBe(30);
});

test('a call whose estimate would pass the cap is refused before it is made', async () => {
  mockSum = jest.fn(async () => 49.99);
  const { tracker, client } = loadFresh();
  await tracker.refreshSpend();
  await expect(client.messages.create(PARAMS)).rejects.toMatchObject({ status: 429 });
  expect(fetchCalls).toBe(0);
});

test('a call within the cap goes ahead, and its spend counts before the next read', async () => {
  mockSum = jest.fn(async () => 10);
  const { tracker, client } = loadFresh();
  await tracker.refreshSpend();
  await client.messages.create(PARAMS);
  await settle();
  expect(fetchCalls).toBe(1);
  expect(tracker.getDailySpend()).toBeCloseTo(10.0105, 6);
});

test('the log is read at most once per SPEND_CACHE_MS, and a read does not double-count local spend', async () => {
  mockSum = jest.fn(async () => 10);
  const { tracker, client } = loadFresh();
  await tracker.refreshSpend();
  const reads = mockSum.mock.calls.length;

  await client.messages.create(PARAMS);
  await client.messages.create(PARAMS);
  await settle();
  expect(mockSum.mock.calls.length).toBe(reads);            // within the window: no new read
  expect(tracker.getDailySpend()).toBeCloseTo(10.021, 6);

  // The two calls' rows are now in the log; the next read includes them.
  mockSum = jest.fn(async () => 10.021);
  jest.advanceTimersByTime(tracker.SPEND_CACHE_MS);
  await client.messages.create(PARAMS);                     // stale → a read starts
  await settle();
  expect(mockSum).toHaveBeenCalledTimes(1);
  // The read covers the two earlier calls; only the call made after it started is added.
  expect(tracker.getDailySpend()).toBeCloseTo(10.021 + 0.0105, 6);
});

test('at a UTC day change the figure resets to zero and a read for the new day starts', async () => {
  jest.setSystemTime(new Date('2026-09-23T23:59:50.000Z'));
  mockSum = jest.fn(async () => 49.99);
  const { tracker, client } = loadFresh();
  await tracker.refreshSpend();
  await expect(client.messages.create(PARAMS)).rejects.toMatchObject({ status: 429 });

  jest.setSystemTime(new Date('2026-09-24T00:00:05.000Z'));
  mockSum = jest.fn(async () => 0);
  expect(tracker.getDailySpend()).toBe(0);
  await client.messages.create(PARAMS);                     // allowed on the new day
  await settle();
  expect(fetchCalls).toBe(1);
  const since = sinceOf(mockSum.mock.calls.at(-1)[1]);
  expect(since.toISOString()).toBe('2026-09-24T00:00:00.000Z');
});

test('a failed read keeps the last figure and fails open, with a warning', async () => {
  mockSum = jest.fn(async () => 20);
  const { tracker, client } = loadFresh();
  await tracker.refreshSpend();

  mockSum = jest.fn(async () => { throw new Error('connection refused'); });
  jest.advanceTimersByTime(tracker.SPEND_CACHE_MS);
  await tracker.refreshSpend();
  expect(tracker.getDailySpend()).toBe(20);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('could not read'));

  await client.messages.create(PARAMS);                     // still allowed: fail open
  await settle();
  expect(fetchCalls).toBe(1);
  expect(tracker.getDailySpend()).toBeCloseTo(20.0105, 6);  // local spend still counts
});

test('with the log never readable, the counter degrades to in-process spend and still refuses at the cap', async () => {
  const saved = process.env.AI_DAILY_BUDGET_USD;
  process.env.AI_DAILY_BUDGET_USD = '0.02';
  mockSum = jest.fn(async () => { throw new Error('connection refused'); });
  try {
    const { tracker, client } = loadFresh();
    await tracker.refreshSpend();
    await client.messages.create(PARAMS);                   // $0.0105 recorded locally
    await settle();
    await expect(client.messages.create(PARAMS)).rejects.toMatchObject({ status: 429 });
  } finally {
    if (saved === undefined) delete process.env.AI_DAILY_BUDGET_USD;
    else process.env.AI_DAILY_BUDGET_USD = saved;
  }
});

test('a read that starts before a call\'s row is written does not drop that call\'s spend', async () => {
  mockSum = jest.fn(async () => 10);
  const { tracker, client } = loadFresh();
  await tracker.refreshSpend();

  let finishWrite;
  mockCreate = (row) => new Promise((resolve) => { finishWrite = () => { mockRows.push(row); resolve(); }; });
  await client.messages.create(PARAMS);
  await settle();                                            // row write started, not finished
  expect(tracker.getDailySpend()).toBeCloseTo(10.0105, 6);

  jest.advanceTimersByTime(tracker.SPEND_CACHE_MS);
  await tracker.refreshSpend();                              // the log does not have the row yet
  expect(tracker.getDailySpend()).toBeCloseTo(10.0105, 6);   // still counted, from memory

  finishWrite();
  await settle();
  mockSum = jest.fn(async () => 10.0105);                    // now the log has it
  jest.advanceTimersByTime(tracker.SPEND_CACHE_MS);
  await tracker.refreshSpend();
  expect(tracker.getDailySpend()).toBeCloseTo(10.0105, 6);   // counted once, from the log
});
