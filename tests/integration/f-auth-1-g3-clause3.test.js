/**
 * F-AUTH-1 Gate G3 clause 3 — write attribution: persisted user id equals the
 * middleware-mapped principal.
 *
 * RETARGETED (#1942). This file previously exercised POST /api/v1/decision-logs
 * and the plural `decision_logs` table. That surface was retired under
 * Evoni's ruling (b) on #1942: production never had `decision_logs`, so the
 * test only ever passed against CI's migrated schema and clause 3's evidence
 * was never exercised against production. Under her ruling option 1 on #1942
 * (2026-09-26) it now exercises the one write-attribution path this change
 * creates: POST /api/v1/world/:showId/browse-pool (requireAuth) →
 * DecisionLogger.logBrowsePoolGenerated → INSERT INTO decision_log, whose
 * `user_id` (uuid) exists in production (canon capture 2026-09-17) and is
 * created by the live migration 20260219000001-decision-log-browse-pool.js.
 * The substitution and the finding behind it are recorded in the register
 * (docs/audit/F-AUTH-1_G3Clause3_Retarget_2026-09-26.md). The filename is
 * kept because Fix Plan v2.52–v2.59 cite this file by name.
 *
 * RETARGETED AGAIN (#1954). The world route above is not the one the app
 * calls. The styling game's closet calls POST /api/v1/wardrobe/browse-pool
 * (EpisodeWardrobeGameplay's loadPool), and the world route's only callers
 * were tests, so after Deploy AK decision_log stayed empty through repeated
 * closet loads (ATTESTED, Evoni, 2026-09-26). The attribution now sits on
 * the live route: POST /api/v1/wardrobe/browse-pool (requireAuth) →
 * recordBrowsePoolGenerated → DecisionLogger.logBrowsePoolGenerated →
 * INSERT INTO decision_log. This file posts the body loadPool posts. The
 * correction is recorded in the register
 * (docs/audit/F-AUTH-1_G3Clause3_Retarget_Correction_2026-09-26.md).
 *
 * Specified at Fix Plan v2.53 §1.1 and restated at v2.54 §2.1; the three
 * assertions are unchanged in substance:
 *
 *   1. Persisted `user_id` is non-null and not the string 'undefined'.
 *
 *   2. It equals `req.user.id` AS THE MIDDLEWARE SETS IT. Ground truth is read
 *      from GET /api/v1/auth/me, which returns the middleware-mapped `req.user`.
 *      COUPLING, RECORDED NOT DESIGNED AROUND (v2.54 §2.1): /me runs
 *      `authenticateJWT` from src/middleware/jwtAuth.js, a different
 *      middleware from this route's `requireAuth` (src/middleware/auth.js).
 *      Both map `id: decoded.sub`. The proxy is sound today; it is not sound
 *      by construction.
 *
 *   3. An anonymous POST persists NO ROW. Verified by absence of any row for
 *      a show created for that request alone, not by a count delta.
 *
 * WHY THE DATABASE, NOT THE RESPONSE. The route awaits the decision-log write
 * but DecisionLogger.log catches any write failure (logging it at error
 * level) and buffers the entry on a per-request logger instance that is then
 * discarded, so the route returns 200 with the same pool whether or not a row
 * was written. The response proves nothing; only the table does. Because the write is awaited before the response is sent, the
 * row (if any) is committed by the time the response arrives — no sleep and
 * no flush is needed, and none is used.
 *
 * WHY `uuid` IS UNMOCKED HERE. tests/setup.js mocks `uuid` to return
 * 'test-uuid-…' strings. DecisionLogger uses uuid v4 for `decision_log.id`, a
 * uuid column, so under the mock every insert fails and is silently buffered —
 * the test would fail for a harness reason, not a product one. This file
 * restores the real module so the write behaves as it does in production.
 */
jest.mock('uuid', () => jest.requireActual('uuid'));

const crypto = require('crypto');
const { execFileSync } = require('child_process');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

// The nested probe script reads host/port from its own argv rather than
// having them interpolated into the source text. That's what actually fixes
// the Windows bug this replaced: the old version built a `node -e "..."`
// *string* and ran it through execSync, which shells out via cmd.exe on
// Windows — cmd.exe's quote parsing strips the double quotes around
// JSON.stringify(host), so the nested script saw a bare `localhost`
// identifier and threw before ever opening a socket. execFileSync spawns
// node.exe directly (no shell, no cmd.exe quote mangling) and passes host/
// port as separate argv elements, so there is no string to mis-quote.
const PROBE_SCRIPT =
  "const net=require('net');" +
  'const s=net.createConnection({host:process.argv[1],port:Number(process.argv[2])},' +
  '()=>{s.destroy();process.exit(0);});' +
  's.setTimeout(Number(process.argv[3]));' +
  "s.on('timeout',()=>{s.destroy();process.exit(1);});" +
  "s.on('error',()=>process.exit(1));";

// Synchronous TCP reachability probe. Must be synchronous because the
// describe.skip/describe choice below is made at module-evaluation time,
// before Jest runs any async beforeAll. Node has no synchronous socket API,
// so this shells out to a throwaway `node -e` one-liner and blocks on it —
// no new dependency, just Node's own child_process + net built-ins.
function isDatabaseReachable(databaseUrl, timeoutMs = 1500) {
  if (!databaseUrl) return false;
  let host;
  let port;
  try {
    const parsed = new URL(databaseUrl);
    host = parsed.hostname || 'localhost';
    port = parsed.port || '5432';
  } catch {
    return false;
  }
  // The probe may only ever contact loopback; any other host is treated as
  // unverifiable, not dialed. This session never opens a socket to a
  // non-loopback host under any circumstance.
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    return false;
  }
  try {
    execFileSync(process.execPath, ['-e', PROBE_SCRIPT, host, String(Number(port)), String(timeoutMs)], {
      stdio: 'ignore',
      timeout: timeoutMs + 500,
    });
    return true;
  } catch {
    return false;
  }
}

// Mirrors the guard in auth.integration.test.js — never run against RDS.
// Short-circuits before the reachability probe below: an amazonaws.com URL
// must never be dialed, reachable or not.
//
// The reachability half exists because DATABASE_URL is not reliably unset
// just because TEST_DATABASE_URL is (tests/setup.js, issue #1276): under
// --runInBand every test file in this run shares one process.env, and
// tests/unit/route-health.test.js:17 unconditionally sets
// `process.env.DATABASE_URL = 'postgres://localhost:5432/test'` at its own
// module load — a leak into any suite that runs after it in the same
// process, this one included. Run standalone (no leak, DATABASE_URL
// genuinely undefined), this suite instead hangs against Sequelize's own
// discrete-host-var fallback (src/config/sequelize.js) rather than failing
// fast. Both shapes are covered by probing the URL directly rather than
// trusting its mere presence.
const shouldSkip =
  process.env.DATABASE_URL?.includes('amazonaws.com') || !isDatabaseReachable(process.env.DATABASE_URL);

const ME_URL = '/api/v1/auth/me';
const BROWSE_POOL_URL = '/api/v1/wardrobe/browse-pool';

// `decision_log.user_id` is uuid-typed, so the principal id must be a UUID
// (a Cognito `sub` is one). crypto.randomUUID(), not the mocked uuid module.
const principalId = crypto.randomUUID();
const token = TokenService.generateToken(
  {
    id: principalId,
    email: 'g3c3@example.test',
    groups: ['USER'],
    role: 'USER',
  },
  'access'
);

// The body EpisodeWardrobeGameplay's loadPool sends.
const postBrowsePool = ({ showId, episodeId }, bearer) => {
  const req = request(app).post(BROWSE_POOL_URL);
  if (bearer) req.set('Authorization', `Bearer ${bearer}`);
  return req.send({
    show_id: showId,
    episode_id: episodeId,
    event_name: 'g3c3 gala',
    dress_code: 'black tie',
    dress_code_keywords: [],
    event_type: 'gala',
    prestige: 5,
    strictness: 5,
    host_brand: '',
    character_state: { coins: 100, reputation: 1 },
  });
};

// Every decision_log row for the show, read straight from the table.
const rowsForShow = async (showId) => {
  const [rows] = await models.sequelize.query(
    `SELECT user_id::text AS user_id, type, episode_id::text AS episode_id, source
       FROM decision_log WHERE show_id = :showId`,
    { replacements: { showId } }
  );
  return rows;
};

(shouldSkip ? describe.skip : describe)(
  'F-AUTH-1 Gate G3 clause 3 — wardrobe browse-pool decision_log user_id',
  () => {
    const shows = [];

    // A show with one episode and one owned closet item: the minimum the
    // styling game has when it loads a pool.
    const makeFixture = async (label) => {
      const suffix = crypto.randomUUID();
      const show = await models.Show.create({
        name: `g3c3 ${label} ${suffix}`,
        slug: `g3c3-${label}-${suffix}`,
      });
      shows.push(show.id);
      const episode = await models.Episode.create({
        show_id: show.id,
        episode_number: 1,
        title: `g3c3 ${label}`,
        status: 'draft',
      });
      await models.Wardrobe.create({
        name: `g3c3 dress ${suffix}`,
        character: 'lala',
        clothing_category: 'dress',
        show_id: show.id,
        is_owned: true,
        is_visible: true,
      });
      return { showId: show.id, episodeId: episode.id };
    };

    afterAll(async () => {
      for (const showId of shows) {
        try {
          await models.sequelize.query('DELETE FROM decision_log WHERE show_id = :showId', {
            replacements: { showId },
          });
          await models.Wardrobe.destroy({ where: { show_id: showId }, force: true });
          await models.Episode.destroy({ where: { show_id: showId }, force: true });
          await models.Show.destroy({ where: { id: showId }, force: true });
        } catch (err) {
          console.error('[g3c3 cleanup] failed for show', showId, err.message);
        }
      }
    });

    test('authenticated POST persists user_id equal to the middleware-mapped principal', async () => {
      const me = await request(app).get(ME_URL).set('Authorization', `Bearer ${token}`);

      // Ground truth for assertion 2.
      expect({ status: me.status, hasId: Boolean(me.body?.data?.user?.id) }).toEqual({
        status: 200,
        hasId: true,
      });
      const middlewareMappedId = me.body.data.user.id;

      const fixture = await makeFixture('auth');
      const res = await postBrowsePool(fixture, token);

      // A 200 here does NOT show a row was written (see header); it only
      // shows the handler generated a pool.
      expect({ status: res.status, error: res.body?.error, pooled: res.body?.pool?.length > 0 }).toEqual({
        status: 200,
        error: undefined,
        pooled: true,
      });

      // Read the PERSISTED row, not the echo.
      const rows = await rowsForShow(fixture.showId);
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row.type).toBe('browse_pool_generated');
      expect(row.source).toBe('styling_game');
      expect(row.episode_id).toBe(fixture.episodeId);

      // Assertion 1 — non-null, and not the string 'undefined'.
      expect(row.user_id).not.toBeNull();
      expect(row.user_id).not.toBeUndefined();
      expect(row.user_id).not.toBe('undefined');
      expect(row.user_id).not.toBe('');

      // Assertion 2 — equals req.user.id as the middleware sets it.
      expect(row.user_id).toBe(middlewareMappedId);
    });

    test('anonymous POST is refused and persists no row', async () => {
      const fixture = await makeFixture('anon');

      const res = await postBrowsePool(fixture, null);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_REQUIRED');

      // Assertion 3 — no row for this request's own show. Not a count delta.
      const rows = await rowsForShow(fixture.showId);
      expect(rows).toEqual([]);
    });
  }
);
