/**
 * F-AUTH-1 Gate G3 clause 3 — decisionLogs `user_id` test.
 *
 * Specified at Fix Plan v2.53 §1.1 and restated at v2.54 §2.1. This is NOT
 * v1.5 §4.6's verification step 1, which compared the persisted value against
 * a sibling route's write and therefore passed when both were `undefined`.
 *
 * Discharges v2.52 §6 item 1. Per v2.52 §3 a test discharging a recorded
 * ledger obligation requires no authorizing revision; the migration it depends
 * on is authorized separately at v2.54 §1.
 *
 * THE THREE ASSERTIONS, and why each is worded as it is:
 *
 *   1. Persisted `user_id` is non-null and not the string 'undefined'.
 *      The string form matters: `req.user?.sub` evaluated to `undefined` and a
 *      permissive column would have stored "undefined" as text.
 *
 *   2. It equals `req.user.id` AS THE MIDDLEWARE SETS IT — not a sibling
 *      route's write, and not the `sub` claim. Ground truth is read from
 *      GET /api/v1/auth/me, which returns the middleware-mapped `req.user`.
 *      Asserting against the signed `sub` would be correct today and wrong
 *      after any remapping, which is the coupling F-Auth-5 removed and which
 *      a test must not reintroduce.
 *
 *      COUPLING, RECORDED NOT DESIGNED AROUND (v2.54 §2.1): /me runs
 *      `authenticateJWT` from src/middleware/jwtAuth.js, a different
 *      middleware from this route's `requireAuth` (src/middleware/auth.js:487).
 *      Both map `id: decoded.sub`, and no `sub` key is set by any of the five
 *      req.user assignment sites across the two files. The proxy is sound
 *      today; it is not sound by construction. `req.user` is not reachable
 *      from the test boundary and this is the closest available ground truth.
 *
 *   3. An anonymous POST persists NO ROW. Verified by absence of a row
 *      carrying that request's unique `entity_id`, not by a count delta,
 *      which would race anything else writing to the table.
 *
 * The persisted value is read from the DATABASE, not from the response body.
 * A response could echo a value it did not store — the same echo/decode split
 * the FD-65 suite makes explicit.
 */
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { DecisionLog } = require('../../src/models');

// Mirrors the guard in auth.integration.test.js — never run against RDS.
const shouldSkip = process.env.DATABASE_URL?.includes('amazonaws.com');

const DECISION_LOGS_URL = '/api/v1/decision-logs';
const ME_URL = '/api/v1/auth/me';

// `decision_logs.entity_id` is uuid-typed, and tests/setup.js:20 mocks the
// `uuid` module to return non-UUID strings — so crypto.randomUUID(), not v4().
const uniqueEntityId = () => crypto.randomUUID();

const principalId = `g3c3-${crypto.randomUUID()}`;
const token = TokenService.generateToken(
  {
    id: principalId,
    email: 'g3c3@example.test',
    groups: ['USER'],
    role: 'USER',
  },
  'access'
);

const postLog = (entityId, bearer) => {
  const req = request(app).post(DECISION_LOGS_URL);
  if (bearer) req.set('Authorization', `Bearer ${bearer}`);
  return req.send({
    action_type: 'g3c3-verify',
    entity_type: 'g3c3',
    entity_id: entityId,
  });
};

(shouldSkip ? describe.skip : describe)('F-AUTH-1 Gate G3 clause 3 — decisionLogs user_id', () => {
  const created = [];

  afterAll(async () => {
    // force: true — DecisionLog is paranoid, so a soft delete would leave the
    // row and the next run's absence assertion would still pass, but the table
    // would accumulate. Tolerate failure: before the migration lands, the
    // model cannot query this table at all.
    for (const entityId of created) {
      try {
        await DecisionLog.destroy({ where: { entity_id: entityId }, force: true });
      } catch {
        /* nothing was persisted, or the column is absent — either way, nothing to clean */
      }
    }
  });

  test('authenticated POST persists user_id equal to the middleware-mapped principal', async () => {
    const me = await request(app).get(ME_URL).set('Authorization', `Bearer ${token}`);

    // Ground truth for assertion 2. If /me is not serving req.user, the rest
    // of this test has nothing to compare against and should say so here.
    expect({ status: me.status, hasId: Boolean(me.body?.data?.user?.id) }).toEqual({
      status: 200,
      hasId: true,
    });
    const middlewareMappedId = me.body.data.user.id;

    const entityId = uniqueEntityId();
    created.push(entityId);
    const res = await postLog(entityId, token);

    // Surface the server's error text on failure rather than only the status,
    // so a failing run shows WHICH failure it was (v2.54 §2 step 1).
    expect({ status: res.status, error: res.body?.error }).toEqual({
      status: 201,
      error: undefined,
    });

    // Read the PERSISTED row, not the echo.
    const row = await DecisionLog.findOne({ where: { entity_id: entityId } });
    expect(row).not.toBeNull();

    // Assertion 1 — non-null, and not the string 'undefined'.
    expect(row.user_id).not.toBeNull();
    expect(row.user_id).not.toBeUndefined();
    expect(row.user_id).not.toBe('undefined');
    expect(row.user_id).not.toBe('');

    // Assertion 2 — equals req.user.id as the middleware sets it.
    expect(row.user_id).toBe(middlewareMappedId);
  });

  test('anonymous POST is refused and persists no row', async () => {
    const entityId = uniqueEntityId();
    created.push(entityId);

    const res = await postLog(entityId, null);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('code', 'AUTH_REQUIRED');

    // Assertion 3 — absence of this request's row specifically. Not a count
    // delta: a count would race any concurrent writer.
    const row = await DecisionLog.findOne({ where: { entity_id: entityId } });
    expect(row).toBeNull();
  });
});
