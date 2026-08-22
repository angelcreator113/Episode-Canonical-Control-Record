/**
 * F-AUTH-1 FD-65 — the privilege half, closed.
 *
 * Fix Plan v2.50 §1 change #2 removed `groups` and `role` from POST /login's
 * inputs. Before it, an anonymous caller could name their own groups and
 * receive a signed token carrying them, which cleared all 36
 * `authorize([...])` gates across 11 route files — including the three on
 * auditLogs.js, the control that would evidence an intrusion.
 *
 * These tests assert that escalation is gone. They were recorded as owed at
 * v2.51 §2 obligation 6 and §6 item 1: the remediation shipped at 75ac05f0
 * with no test asserting the direct negative of the escalation it closed.
 *
 * WHAT THIS DOES NOT COVER, and it is not a gap in these tests:
 * the issuance half of FD-65 is still open. An anonymous caller supplying any
 * well-formed email and any six-character password still receives a valid
 * signed token — now carrying ['USER'] rather than groups of their choosing —
 * and that token still satisfies requireAuth on all 95 handlers promoted at
 * 8ba2b95c. That is v2.51 §2 obligation 2. FD-65 remains OPEN and P0, and
 * nothing here should be read as closing it.
 *
 * Two claims are checked separately because they are different claims:
 *   - the ECHO (`data.user.groups`) proves the response is honest;
 *   - the DECODE (payload of `data.accessToken`) proves what requireAuth and
 *     authorize will actually read. A response could echo ['USER'] while
 *     signing something else.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

// Mirrors the guard in auth.integration.test.js — never run against RDS.
const shouldSkip = process.env.DATABASE_URL?.includes('amazonaws.com');

// FD-65 ISSUANCE HALF CLOSED 2026-08-22. POST /login now returns 401 before any
// other logic runs, so the assertions below that reach the privilege half
// THROUGH /login can no longer observe it.
//
// They are SKIPPED, NOT DELETED. The property they assert -- that
// caller-supplied `groups`/`role` are ignored -- still holds in code: 75ac05f0
// removed those inputs from the handler. It is simply unobservable over HTTP
// while the route is disabled. Deleting them would quietly discard the only
// direct evidence of the privilege half's closure.
//
// If /login is ever re-enabled, set this to false and the assertions return.
const LOGIN_DISABLED = true;
const describeLogin = LOGIN_DISABLED ? describe.skip : describe;
const testLogin = LOGIN_DISABLED ? test.skip : test;

// auditLogs.js:18 — `router.get('/', requireAuth, authorize(['ADMIN']), ...)`,
// mounted at src/app.js:892. Chosen because v2.49 §2.4 names it: the control
// that would evidence an intrusion sat behind the credential the intrusion
// supplied.
const ADMIN_GATED_URL = '/api/v1/audit-logs';

const anonymousLogin = (body) => request(app).post('/api/v1/auth/login').send(body);

(shouldSkip ? describe.skip : describe)('F-AUTH-1 FD-65 — privilege half', () => {
  // The issuance half, closed 2026-08-22. v2.49 minted FD-65 with both halves;
  // v2.50 closed the privilege half only and said so. This is the other one.
  describe('POST /login issues no token at all', () => {
    test('returns 401 and no accessToken, whatever is supplied', async () => {
      const res = await anonymousLogin({
        email: 'escalate@example.test',
        password: 'password123',
        groups: ['ADMIN'],
        role: 'admin',
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_LOGIN_DISABLED');
      expect(res.body.data).toBeUndefined();
    });
  });

  describeLogin('POST /login ignores caller-supplied privilege', () => {
    test('echoes ["USER"] when the caller asks for ADMIN', async () => {
      const res = await anonymousLogin({
        email: 'escalate@example.test',
        password: 'password123',
        groups: ['ADMIN'],
        role: 'admin',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.groups).toEqual(['USER']);
      expect(res.body.data.user.groups).not.toContain('ADMIN');
    });

    test('signs ["USER"] into the token, not merely into the response', async () => {
      const res = await anonymousLogin({
        email: 'escalate@example.test',
        password: 'password123',
        groups: ['ADMIN'],
        role: 'admin',
      });

      // decode, not verify — this asserts what was signed, and the signature
      // is already covered by the FD-63 suite's wrong-signature control.
      const payload = jwt.decode(res.body.data.accessToken);

      expect(payload.groups).toEqual(['USER']);
      expect(payload.groups).not.toContain('ADMIN');
      expect(payload.role).not.toBe('admin');
    });
  });

  describe('the resulting token against an ADMIN gate', () => {
    testLogin('is refused by authorize(["ADMIN"]) — 403, not 200', async () => {
      const login = await anonymousLogin({
        email: 'escalate@example.test',
        password: 'password123',
        groups: ['ADMIN'],
        role: 'admin',
      });

      const res = await request(app)
        .get(ADMIN_GATED_URL)
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'AUTH_GROUP_REQUIRED');
    });

    // NEGATIVE CONTROL. Without it a 403 above proves nothing: it would look
    // identical if the gate were broken, the router unmounted, or this URL
    // wrong. src/app.js:521-527 in particular substitutes a 500 handler when
    // auditLogs.js fails to require, so a broken route file is a live way for
    // the assertion above to pass for the wrong reason.
    //
    // This also demonstrates the gate still admits a genuine ADMIN — the
    // property the remediation must not have broken.
    test('CONTROL: a genuinely ADMIN token is admitted by the same gate', async () => {
      const adminToken = TokenService.generateToken(
        {
          id: 'fd65-control-admin',
          email: 'admin@example.test',
          groups: ['ADMIN'],
          role: 'ADMIN',
        },
        'access'
      );

      const res = await request(app)
        .get(ADMIN_GATED_URL)
        .set('Authorization', `Bearer ${adminToken}`);

      // Deliberately "cleared the gate", not "returned 200". Past the gate the
      // handler 500s on every database this repo builds, with no environmental
      // qualifier: src/migrations/20240101000005-create-activity-logs.js
      // creates `activity_logs` with camelCase columns (userId, actionType, …),
      // while src/models/ActivityLog.js:101 declares `underscored: true`, so
      // every query the model issues asks for user_id, action_type, … Nothing
      // reconciles the two, and GET /api/v1/audit-logs has never worked.
      //
      // Observed both ways on 2026-08-18 — locally, and in CI on the Validate
      // run for PR #1049: `column "user_id" does not exist`, raised at
      // src/routes/auditLogs.js:52.
      //
      // An earlier version of this comment claimed no migration creates the
      // table. That was wrong, and how it was wrong is worth keeping: the
      // search was `grep migrations/`, but .sequelizerc points
      // `migrations-path` at src/migrations/.
      //
      // SEARCH src/migrations/. That is the tree `sequelize db:migrate` reads,
      // and the only one. A migration that exists anywhere else does not run.
      //
      // Corrected 2026-08-19: an earlier version of this comment also said
      // "this repo has two migration directories." That count is withdrawn,
      // not replaced. There are more than two, and no number is
      // substitutable, because "migration directory" has no predicate here:
      // `migrations/`, `migrations/sequelize-migrations/`,
      // `scripts/migrations/` and `migrations-node-pg-migrate/` all hold
      // migration-shaped files, and these trees have been counted several
      // different ways, each correct under some predicate and wrong under
      // another. `migrations-node-pg-migrate/` is not even sequelize — it
      // uses node-pg-migrate's `exports.up = (pgm) =>` form.
      //
      // The operative consequence, which is what matters here: a grep hit
      // outside src/migrations/ does not mean a migration runs, and a miss
      // inside it is the only negative worth acting on.
      //
      // Not established: whether other models share this mismatch. 133 of 154
      // models declare `underscored: true`, and none but ActivityLog has been
      // checked against the migration that creates its table.
      //
      // So `toBe(200)` is not a tightening this control is giving up; it would
      // fail everywhere, on handler behaviour this control does not test.
      // What the control must show is that authorize(['ADMIN']) admits a genuine ADMIN
      // — i.e. that the 403 asserted above comes from the gate rejecting
      // ['USER'], not from the gate being broken or the router unmounted.
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
      expect(res.body).not.toHaveProperty('code', 'AUTH_GROUP_REQUIRED');
    });
  });
});
