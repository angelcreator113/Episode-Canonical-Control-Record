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

// auditLogs.js:18 — `router.get('/', requireAuth, authorize(['ADMIN']), ...)`,
// mounted at src/app.js:892. Chosen because v2.49 §2.4 names it: the control
// that would evidence an intrusion sat behind the credential the intrusion
// supplied.
const ADMIN_GATED_URL = '/api/v1/audit-logs';

const anonymousLogin = (body) => request(app).post('/api/v1/auth/login').send(body);

(shouldSkip ? describe.skip : describe)('F-AUTH-1 FD-65 — privilege half', () => {
  describe('POST /login ignores caller-supplied privilege', () => {
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
    test('is refused by authorize(["ADMIN"]) — 403, not 200', async () => {
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

      // Deliberately "cleared the gate", not "returned 200". The handler
      // queries the database and returns 500 in this environment; asserting
      // 200 would couple this control to handler behaviour it does not test
      // and would fail for reasons unrelated to authorization. What the
      // control must show is that authorize(['ADMIN']) admits a genuine ADMIN
      // — i.e. that the 403 asserted above comes from the gate rejecting
      // ['USER'], not from the gate being broken or the router unmounted.
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
      expect(res.body).not.toHaveProperty('code', 'AUTH_GROUP_REQUIRED');
    });
  });
});
