/**
 * #1942 — the browse-pool decision_log write carries the signed-in user's id.
 *
 * F-AUTH-1 G3 clause 3's evidence path (tests/integration/f-auth-1-g3-clause3.test.js)
 * runs against a database; these checks run without one. They fail on
 * origin/main at 2b2584fbd, where logBrowsePoolGenerated drops user_id and the
 * browse-pool route never passes it, so every row stores null.
 */
const fs = require('fs');
const path = require('path');
const { DecisionLogger } = require('../../../src/utils/decisionLogger');

const ROOT = path.join(__dirname, '..', '..', '..');

// Records every sequelize.query call; the INSERT's replacements are what
// would reach decision_log.
const recordingSequelize = () => {
  const calls = [];
  return {
    calls,
    query: async (sql, options) => {
      calls.push({ sql, replacements: options?.replacements });
      return [[], 0];
    },
  };
};

const browsePoolArgs = {
  episode_id: null,
  show_id: '11111111-1111-4111-8111-111111111111',
  bias: 'balanced',
  pool_size: 8,
  total_items: 3,
  has_wardrobe: true,
};

describe('DecisionLogger.logBrowsePoolGenerated — user_id', () => {
  test('passes user_id through to the decision_log INSERT', async () => {
    const seq = recordingSequelize();
    const logger = new DecisionLogger(seq);
    const userId = '22222222-2222-4222-8222-222222222222';

    await logger.logBrowsePoolGenerated({ ...browsePoolArgs, user_id: userId });

    expect(seq.calls).toHaveLength(1);
    expect(seq.calls[0].sql).toMatch(/INSERT INTO decision_log/);
    expect(seq.calls[0].replacements.user_id).toBe(userId);
    expect(seq.calls[0].replacements.type).toBe('browse_pool_generated');
  });

  test('does not substitute a fallback when user_id is absent', async () => {
    const seq = recordingSequelize();
    const logger = new DecisionLogger(seq);

    await logger.logBrowsePoolGenerated({ ...browsePoolArgs });

    // log()'s own parameter default is null; no 'system' / 'anonymous' / 'unknown'.
    expect(seq.calls[0].replacements.user_id).toBeNull();
  });
});

describe('POST /world/:showId/browse-pool — passes req.user.id, no fallback', () => {
  const SRC = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'world.js'), 'utf8');
  const call = SRC.slice(SRC.indexOf('logger.logBrowsePoolGenerated('));
  const args = call.slice(0, call.indexOf('})'));

  test('the route is requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/world\/:showId\/browse-pool', requireAuth,/);
  });

  test('the logging call passes user_id: req.user.id', () => {
    expect(args).toMatch(/user_id: req\.user\.id,/);
  });

  test('with no fallback operator', () => {
    expect(args).not.toMatch(/user_id:[^\n]*(\|\||\?\?)/);
  });
});

describe('#1942 — the plural decision-logs surface is retired', () => {
  test('src/app.js no longer mounts /api/v1/decision-logs', () => {
    const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
    expect(app).not.toMatch(/\/api\/v1\/decision-logs/);
  });

  test('the route file and the model are gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'routes', 'decisionLogs.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src', 'models', 'DecisionLog.js'))).toBe(false);
  });
});
