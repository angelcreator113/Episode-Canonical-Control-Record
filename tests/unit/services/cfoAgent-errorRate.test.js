// ============================================================================
// Task #2145 — the CFO audit's AI error rate (cost_watchdog, cfoAgent.js):
// failed calls over all calls in the window, 0% when there were none. It used
// to count every call as an error (COUNT(*)), so it could never read below
// 50%. Mocked models; no database.
// ============================================================================

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a), QueryTypes: { SELECT: 'SELECT' } },
}));

const { errorRatePct, runSubAgent } = require('../../../src/services/cfoAgent');

describe('errorRatePct', () => {
  test('0 of 10 failed gives 0%', () => {
    expect(errorRatePct({ errors: 0, total: 10 })).toBe(0);
  });

  test('5 of 10 failed gives 50%', () => {
    expect(errorRatePct({ errors: 5, total: 10 })).toBe(50);
  });

  test('0 calls gives 0%, with no division by zero', () => {
    expect(errorRatePct({ errors: 0, total: 0 })).toBe(0);
    expect(errorRatePct({})).toBe(0);
  });
});

describe('cost_watchdog error-rate finding (mocked query results)', () => {
  // Answers each cost_watchdog query by its SQL. The error-rate query is
  // answered from a week of logged calls (one is_error flag per call), for
  // the query's own column shape: today's (errors, total), or the old one
  // (errors = COUNT(*), successes), so the old query's result is realistic.
  const week = (failed, total) => Array.from({ length: total }, (_, i) => i < failed);
  const answer = (calls) => async (sql) => {
    if (/is_error/.test(sql)) {
      const failed = calls.filter(Boolean).length;
      if (/FILTER \(WHERE is_error\)::int AS errors/.test(sql)) return [{ errors: failed, total: calls.length }];
      if (/COUNT\(\*\)::int AS errors/.test(sql)) return [{ errors: calls.length, successes: calls.length - failed }];
      throw new Error(`unexpected error-rate query: ${sql}`);
    }
    if (/SELECT COUNT\(\*\)::int AS cnt FROM ai_usage_logs/.test(sql)) return [{ cnt: 10 }];
    if (/AS avg_cost/.test(sql)) return [{ avg_cost: 0 }];
    if (/model_name LIKE '%opus%'/.test(sql)) return [{ cnt: 0, cost: 0 }];
    if (/cache_read_input_tokens/.test(sql)) return [{ cache_reads: 0, total_input: 0 }];
    if (/GROUP BY route_name/.test(sql)) return [];
    return [{ cost: 0 }];
  };
  const errorFindings = (report) => report.findings.filter((f) => /error rate/.test(f.msg));

  beforeEach(() => {
    mockQuery.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('the query counts errors with FILTER (WHERE is_error) over COUNT(*) for the week', async () => {
    mockQuery.mockImplementation(answer(week(0, 10)));
    await runSubAgent('cost_watchdog');
    const sql = mockQuery.mock.calls.map(([q]) => q).find((q) => /is_error/.test(q));
    expect(sql).toMatch(/COUNT\(\*\) FILTER \(WHERE is_error\)::int AS errors/);
    expect(sql).toMatch(/COUNT\(\*\)::int AS total/);
    expect(sql).toMatch(/INTERVAL '7 days'/);
    expect(sql).not.toMatch(/NOT is_error/);
  });

  test('a week with no failures raises no error-rate finding', async () => {
    mockQuery.mockImplementation(answer(week(0, 10)));
    expect(errorFindings(await runSubAgent('cost_watchdog'))).toEqual([]);
  });

  test('5 of 10 failed is critical at 50.0%; the threshold and label are unchanged', async () => {
    mockQuery.mockImplementation(answer(week(5, 10)));
    expect(errorFindings(await runSubAgent('cost_watchdog'))).toEqual([
      { level: 'critical', msg: '50.0% error rate — failed calls waste money on partial token processing' },
    ]);
  });
});
