/**
 * F-AUTH-1 FD-63 — runtime anonymous-rejection guard.
 *
 * The four static Shape files under tests/unit/routes/ assert that requireAuth
 * appears in the source. That is a diff-lock and it cannot catch the failure
 * that matters most here: an import that silently resolves to `undefined`.
 * Express treats `undefined` in a middleware position as absent, so a route
 * would ship unauthenticated with every static assertion green.
 *
 * These tests make real requests through src/app.js and assert on the response
 * CODE, not the status alone. `AUTH_REQUIRED` can only be produced by
 * requireAuth actually executing; a missing middleware yields 200, 400 or 500.
 *
 * No Cognito configuration is required. requireAuth checks the Authorization
 * header and returns before it ever calls verifyToken:
 *   - no header            -> 401 AUTH_REQUIRED
 *   - malformed header     -> 401 AUTH_INVALID_FORMAT
 * Only a well-formed bearer token reaches the verifier.
 *
 * Gate G3's authenticated half is supplied below, and needs no Cognito mock.
 * An earlier draft of this comment claimed it did, on the grounds that
 * TokenService is the jwtAuth.js path (D20) and does not authenticate
 * requireAuth routes. That was wrong, and Fix Plan v2.49 §6 supersedes it:
 * middleware/auth.js:2 imports tokenService's verifyToken as verifyHs256Token,
 * and verifyToken:190 routes HS256 tokens to it. A TokenService-minted token
 * therefore authenticates a requireAuth route directly.
 *
 * The routing is by `alg` in the token header, so it is environment-
 * independent — the NODE_ENV === 'test' branch at auth.js:197 is only the
 * unparseable-alg fallback and is not what makes these tests pass.
 */
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

// Gate G3's authenticated half. Minted through the HS256 path requireAuth
// actually accepts (v2.49 §6). Deliberately NOT the ADMIN group: these routes
// are Tier 1 per v2.46, so a plain authenticated principal is the correct
// probe, and using ADMIN would mask a route that had been mis-tiered upward.
const authToken = () =>
  TokenService.generateToken(
    { id: 'fd63-gate-g3', email: 'fd63@example.test', groups: ['USER'], role: 'USER' },
    'access'
  );

// Mirrors the guard in auth.integration.test.js — never run against RDS.
const shouldSkip = process.env.DATABASE_URL?.includes('amazonaws.com');

// One representative route per FD-63 miss shape. Each path is uniquely
// prefixed in src/app.js: animatic was deliberately NOT chosen, because it
// mounts bare at '/api/v1' alongside beatRoutes, characterClipRoutes and
// audioClipRoutes, and a prefix collision could mean the request never reaches
// the router under test.
const SHAPES = [
  {
    shape: 'Shape 1 — bare declaration under the global mount',
    router: 'decisions.js',
    method: 'post',
    url: '/api/v1/decisions',
  },
  {
    shape: 'Shape 2 — file-scope router.use(requireAuth) preset',
    router: 'authorNoteRoutes.js',
    method: 'post',
    url: '/api/v1/author-notes',
  },
  {
    shape: 'Shape 3 — multi-line declaration',
    router: 'iconSlots.js',
    method: 'post',
    url: '/api/v1/icon-slots/mappings',
  },
  {
    shape: 'Shape 4 — non-`router` variable name',
    router: 'luxuryFilterRoutes.js',
    method: 'post',
    url: '/api/v1/luxury-filter/validate',
  },
];

(shouldSkip ? describe.skip : describe)('F-AUTH-1 FD-63 — anonymous rejection', () => {
  describe.each(SHAPES)('$shape ($router)', ({ method, url }) => {
    test('no Authorization header -> 401 AUTH_REQUIRED', async () => {
      const res = await request(app)[method](url).send({});

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    test('does not reach the handler — no success payload', async () => {
      const res = await request(app)[method](url).send({});

      // A handler that ran would return its own shape. AUTH_REQUIRED is
      // emitted by requireAuth before next() is ever called.
      expect(res.body).not.toHaveProperty('status', 'SUCCESS');
      expect(res.body).not.toHaveProperty('success', true);
    });

    // Gate G3's authenticated half for this sub-form.
    //
    // The assertion is deliberately negative — "not rejected by auth" — and not
    // a 200. These handlers validate bodies and touch the database, so an
    // authenticated request legitimately returns 400 or 500 here. Asserting 200
    // would couple this suite to handler behaviour it is not testing and would
    // fail for reasons that have nothing to do with authentication.
    //
    // What it proves: requireAuth ran, accepted the credential, and called
    // next(). A 401 of either code would mean it did not.
    test('valid HS256 token -> passes requireAuth and reaches the handler', async () => {
      const res = await request(app)
        [method](url)
        .set('Authorization', `Bearer ${authToken()}`)
        .send({});

      expect(res.status).not.toBe(401);
      expect(['AUTH_REQUIRED', 'AUTH_INVALID_FORMAT', 'AUTH_INVALID_TOKEN']).not.toContain(
        res.body?.code
      );
    });
  });

  // Malformed-header path. Distinct code, and it also proves the middleware is
  // executing rather than being skipped: an absent middleware cannot
  // distinguish header shapes at all.
  describe('malformed Authorization header -> 401 AUTH_INVALID_FORMAT', () => {
    test.each([
      ['bare scheme', 'Bearer'],
      ['wrong scheme', 'Basic abc123'],
      ['too many parts', 'Bearer abc def'],
    ])('%s: %s', async (label, header) => {
      const res = await request(app)
        .post('/api/v1/decisions')
        .set('Authorization', header)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_INVALID_FORMAT');
    });
  });

  // Negative control for the authenticated half above.
  //
  // Those tests assert "not 401", which is only meaningful if a 401 is
  // reachable on the same request shape. This proves it is: a structurally
  // valid HS256 token signed with the wrong secret is rejected. Without this,
  // a requireAuth that had degraded to accepting anything would leave every
  // authenticated assertion green.
  test('well-formed HS256 token with a bad signature is rejected', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign(
      { sub: 'fd63-forged', email: 'forged@example.test', type: 'access' },
      'not-the-real-secret-but-long-enough-32chars',
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/v1/decisions')
      .set('Authorization', `Bearer ${forged}`)
      .send({});

    expect(res.status).toBe(401);

    // The code, not just the status, is what makes this a control. requireAuth
    // emits 401 from three places: AUTH_REQUIRED (no header), from
    // AUTH_INVALID_FORMAT (header shape), and AUTH_INVALID_TOKEN from the catch
    // after verifyToken has run and thrown. Only the third proves the token was
    // parsed, routed to the HS256 verifier, and rejected on its signature.
    // Asserting the status alone would pass on a merely malformed token, which
    // never reaches the verifier at all.
    expect(res.body).toHaveProperty('code', 'AUTH_INVALID_TOKEN');
  });

  // The two codes must stay distinct. F-Auth-4's frontend contract branches on
  // them: AUTH_REQUIRED redirects to /login, AUTH_INVALID_FORMAT passes through
  // as a client integration bug (LOCKED §4.6). Collapsing them would break the
  // interceptor without failing any status-only assertion.
  test('AUTH_REQUIRED and AUTH_INVALID_FORMAT are not interchangeable', async () => {
    const noHeader = await request(app).post('/api/v1/decisions').send({});
    const badHeader = await request(app)
      .post('/api/v1/decisions')
      .set('Authorization', 'Basic abc123')
      .send({});

    expect(noHeader.body.code).toBe('AUTH_REQUIRED');
    expect(badHeader.body.code).toBe('AUTH_INVALID_FORMAT');
    expect(noHeader.body.code).not.toBe(badHeader.body.code);
  });

  // roles.js is HELD under XK-3 (F-Stats-1 v1.57) per Fix Plan v2.45 §3 and
  // v2.46 §4 — deliberately NOT promoted. This asserts the hold is real rather
  // than an oversight, and will fail if roles.js is swept without a register
  // decision. It is not an assertion that the current state is safe: the eight
  // handlers take tenancy from the query string with no entitlement check.
  //
  // show_id is supplied because the handler 400s without it; without the
  // parameter this test would pass on the missing-parameter guard rather than
  // on the absence of auth.
  //
  // NOTE: this currently green-lights on a 500, not a working handler.
  // roles.js:19 calls AssetRoleService.getRolesForshow — lowercase `show`,
  // against an exported getRolesForShow — so the request throws past the
  // show_id guard. The assertion is still load-bearing: promoting roles.js
  // would produce 401/AUTH_REQUIRED and trip it either way. Once the casing is
  // fixed this should start passing on a 200 instead; that is not a reason to
  // relax the assertion.
  describe('roles.js — HELD under XK-3, deliberately unpromoted', () => {
    test('anonymous request is not rejected by auth', async () => {
      const res = await request(app).get('/api/v1/roles?show_id=held-under-xk-3');

      expect(res.status).not.toBe(401);
      expect(res.body?.code).not.toBe('AUTH_REQUIRED');
    });
  });
});
