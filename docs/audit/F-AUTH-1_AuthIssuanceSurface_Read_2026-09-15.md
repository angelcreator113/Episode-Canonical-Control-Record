# F-AUTH-1 — Auth Issuance Surface Read

*Standalone note. Measurement only. Mints nothing, rules nothing, proposes
nothing.*

## Basis

```
$ git rev-parse origin/main
98ffde850b8817923deb0b4e21e7b74baca03a20
$ git log -1 --format='%H %ad' --date=iso-strict origin/main
98ffde850b8817923deb0b4e21e7b74baca03a20 2026-09-14T20:53:59-04:00
```

Standing: MEASURED for every read performed here. Working tree confirmed
clean and identical to this basis (`git status --short`, no output) before
any paste below was taken.

## Filing date

```
$ date -u +%Y-%m-%d
2026-09-15
```

Filename dated `2026-09-15` — the date of this `date` read, taken at filing
time in the same session as the basis SHA above, per the register's
convention that a note's filename carries when it was filed, not when the
facts inside it were established. Evoni's three rulings below are dated
2026-09-14 regardless: that is when she made them, not when this note
files.

## Evoni's three rulings (hers, dated 2026-09-14, cited — not findings of this note)

This note records the following as already decided by Evoni on 2026-09-14.
It does not re-derive, re-argue, or endorse them; it exists because they
were made:

> (a) the fix-cycle scope restriction is waived for password-login
> implementation

> (b) the local HS256 token family is narrowed to a controlled internal
> flow, and must not remain the issuance path for user login

> (c) FD-65's issuance half closes on live verification against the real
> Cognito pool, not on implementation

This note rules nothing itself. It records the surface these rulings
apply to, so that whatever implementation follows can be checked against
what the repo actually contains today.

## Verification side — `src/middleware/auth.js`

Full file, rendered from source at basis:

```
$ git show 98ffde850b8817923deb0b4e21e7b74baca03a20:src/middleware/auth.js | cat -n
```

The algorithm-routing function, `verifyToken`, and its two callees:

```
   138	// F-AUTH-X1: parse the JWT header and return the alg field if it's one we route
   139	// on. Returns 'RS256' | 'HS256' | null. Never throws — a malformed token simply
   140	// returns null and the caller applies the routing fallback (see Q4 §4 above).
   141	// Reads ONLY the header — never decodes the payload, never validates signature.
   142	const detectTokenAlgorithm = (token) => {
   143	  if (typeof token !== 'string' || token.length === 0) return null;
   144	  const dot = token.indexOf('.');
   145	  if (dot < 1) return null;
   146	  const headerB64 = token.slice(0, dot);
   147	  try {
   148	    const normalized = headerB64.replace(/-/g, '+').replace(/_/g, '/');
   149	    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
   150	    const headerJson = Buffer.from(padded, 'base64').toString('utf8');
   151	    const header = JSON.parse(headerJson);
   152	    if (header && typeof header.alg === 'string') {
   153	      const alg = header.alg.toUpperCase();
   154	      if (alg === 'RS256' || alg === 'HS256') return alg;
   155	    }
   156	  } catch (_err) {
   157	    /* fallthrough → null */
   158	  }
   159	  return null;
   160	};
```

RS256 path — Cognito, via `aws-jwt-verify` against Cognito JWKS:

```
   175	// F-AUTH-X1: Cognito (RS256) verifier path. Preserves the existing id-token-
   176	// then-access-token fallback so token_use:'access' tokens still verify.
   177	const verifyViaCognito = async (token) => {
   178	  try {
   179	    try {
   180	      const payload = await getIdTokenVerifier().verify(token);
   181	      return { payload, source: 'cognito', alg: 'RS256' };
   182	    } catch (idError) {
   183	      try {
   184	        const payload = await getAccessTokenVerifier().verify(token);
   185	        return { payload, source: 'cognito', alg: 'RS256' };
   186	      } catch (_accessError) {
   187	        throw idError;
   188	      }
   189	    }
   190	  } catch (error) {
   191	    throw wrapVerifierError(error);
   192	  }
   193	};
```

(`getIdTokenVerifier` / `getAccessTokenVerifier`, lines 110–122, lazily call
`CognitoJwtVerifier.create({ userPoolId, tokenUse, clientId })` from
`aws-jwt-verify`, imported at line 1.)

HS256 path — `tokenService`:

```
   195	// F-AUTH-X1: tokenService (HS256) verifier path. The same code path that has
   196	// run under NODE_ENV === 'test' since the F-Auth-3 era — now active in all
   197	// environments per the Phase 2 surface §Q4 routing decision.
   198	const verifyViaHs256 = (token) => {
   199	  try {
   200	    const payload = verifyHs256Token(token);
   201	    return { payload, source: 'local-hs256', alg: 'HS256' };
   202	  } catch (error) {
   203	    throw wrapVerifierError(error);
   204	  }
   205	};
```

(`verifyHs256Token` is `tokenService.verifyToken`, imported at line 2:
`const { verifyToken: verifyHs256Token } = require('../services/tokenService');`)

The router itself:

```
   207	const verifyToken = async (token) => {
   208	  const alg = detectTokenAlgorithm(token);
   209	
   210	  if (alg === 'RS256') return verifyViaCognito(token);
   211	  if (alg === 'HS256') return verifyViaHs256(token);
   212	
   213	  // Routing fallback for unparseable/missing alg. See Q8 §4 above.
   214	  if (process.env.NODE_ENV === 'test') return verifyViaHs256(token);
   215	  return verifyViaCognito(token);
   216	};
```

**What decides the routing:** `detectTokenAlgorithm` (lines 142–160) reads
only the JWT header's `alg` claim — never the payload, never the signature
— and returns `'RS256'`, `'HS256'`, or `null`. `verifyToken` (lines
207–216) then dispatches: `alg === 'RS256'` → `verifyViaCognito`;
`alg === 'HS256'` → `verifyViaHs256`; if `alg` cannot be parsed at all, the
fallback is `verifyViaHs256` when `NODE_ENV === 'test'` and
`verifyViaCognito` otherwise (lines 213–215). Both verifier paths produce
an equally-trusted `req.user`; the resulting `source` field
(`'cognito'` | `'local-hs256'`) is documented in the file's own header
comment (lines 37–42) as "OBSERVABILITY ONLY... NOT a security boundary."

## Issuance side — `src/services/tokenService.js`

Full file, rendered from source at basis:

```
$ git show 98ffde850b8817923deb0b4e21e7b74baca03a20:src/services/tokenService.js | cat -n
     1	/**
     2	 * Token Service
     3	 * Handles JWT token generation, validation, and refresh
     4	 * Implements security best practices for JWT handling
     5	 */
     6	
     7	const jwt = require('jsonwebtoken');
     8	const crypto = require('crypto');
     9	
    10	class TokenService {
    11	  // Token blacklist for revoked tokens (in production, use Redis)
    12	  static tokenBlacklist = new Set();
    13	
    14	  /**
    15	   * Generate a JWT token for a user
    16	   * @param {object} user - User object with id, email, etc.
    17	   * @param {string} type - 'access' or 'refresh'
    18	   * @returns {string} JWT token
    19	   */
    20	  static generateToken(user, type = 'access') {
    21	    const secret = process.env.JWT_SECRET;
    22	
    23	    if (!secret) {
    24	      throw new Error('JWT_SECRET is not configured in environment variables');
    25	    }
    26	
    27	    if (secret.length < 32) {
    28	      throw new Error('JWT_SECRET must be at least 32 characters for security');
    29	    }
    30	
    31	    const expiresIn =
    32	      type === 'refresh' ? process.env.JWT_REFRESH_EXPIRY || '7d' : process.env.JWT_EXPIRY || '1h';
    33	
    34	    const jti = crypto.randomBytes(16).toString('hex'); // Unique token ID
    35	    const payload = {
    36	      jti, // Unique token identifier
    37	      sub: user.id || user.userId,
    38	      email: user.email,
    39	      name: user.name || user.email.split('@')[0],
    40	      groups: user.groups || [],
    41	      role: user.role || 'USER',
    42	      type, // 'access' or 'refresh'
    43	      iat: Math.floor(Date.now() / 1000),
    44	    };
    45	
    46	    const signOptions = {
    47	      expiresIn,
    48	      algorithm: 'HS256',
    49	    };
    50	
    51	    // Only add issuer and audience in non-test environments
    52	    if (process.env.NODE_ENV !== 'test') {
    53	      signOptions.issuer = process.env.TOKEN_ISSUER || 'episode-metadata-api';
    54	      signOptions.audience = process.env.TOKEN_AUDIENCE || 'episode-metadata-app';
    55	    }
    56	
    57	    const token = jwt.sign(payload, secret, signOptions);
    58	
    59	    return token;
    60	  }
    61	
    62	  /**
    63	   * Generate both access and refresh tokens
    64	   * @param {object} user - User object
    65	   * @returns {object} { accessToken, refreshToken, expiresIn }
    66	   */
    67	  static generateTokenPair(user) {
    68	    const accessToken = this.generateToken(user, 'access');
    69	    const refreshToken = this.generateToken(user, 'refresh');
    70	
    71	    // Decode to get expiry
    72	    const decoded = jwt.decode(accessToken);
    73	    const expiresIn = decoded.exp * 1000 - Date.now();
    74	
    75	    return {
    76	      accessToken,
    77	      refreshToken,
    78	      expiresIn,
    79	      tokenType: 'Bearer',
    80	    };
    81	  }
    82	
    83	  /**
    84	   * Verify a JWT token
    85	   * @param {string} token - JWT token to verify
    86	   * @returns {object} Decoded token payload
    87	   */
    88	  static verifyToken(token, type = 'access') {
    89	    try {
    90	      const verifyOptions = {
    91	        algorithms: ['HS256'],
    92	      };
    93	
    94	      // In production, enforce issuer and audience. In test, they're optional
    95	      if (process.env.NODE_ENV !== 'test') {
    96	        verifyOptions.issuer = process.env.TOKEN_ISSUER || 'episode-metadata-api';
    97	        verifyOptions.audience = process.env.TOKEN_AUDIENCE || 'episode-metadata-app';
    98	      }
    99	
   100	      const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
   101	
   102	      // Check if token is blacklisted (revoked)
   103	      if (this.tokenBlacklist.has(decoded.jti)) {
   104	        throw new Error('Token has been revoked');
   105	      }
   106	
   107	      // Verify token type if specified
   108	      if (type && decoded.type !== type) {
   109	        throw new Error(`Invalid token type. Expected: ${type}, Got: ${decoded.type}`);
   110	      }
   111	
   112	      // Verify required claims
   113	      if (!decoded.sub || !decoded.email) {
   114	        throw new Error('Missing required token claims');
   115	      }
   116	
   117	      return decoded;
   118	    } catch (error) {
   119	      if (error.name === 'TokenExpiredError') {
   120	        throw new Error('Token has expired');
   121	      } else if (error.name === 'JsonWebTokenError') {
   122	        throw new Error('Invalid token signature');
   123	      } else if (error.message.includes('revoked')) {
   124	        throw error; // Re-throw revoked token error as-is
   125	      }
   126	      throw new Error(`Token verification failed: ${error.message}`);
   127	    }
   128	  }
   129	
   130	  /**
   131	   * Revoke a token (add to blacklist)
   132	   * @param {string} token - JWT token to revoke
   133	   */
   134	  static revokeToken(token) {
   135	    try {
   136	      const decoded = jwt.decode(token);
   137	      if (decoded && decoded.jti) {
   138	        this.tokenBlacklist.add(decoded.jti);
   139	      }
   140	    } catch (error) {
   141	      console.warn('Failed to revoke token:', error.message);
   142	    }
   143	  }
   144	
   145	  /**
   146	   * Refresh an access token using a refresh token
   147	   * @param {string} refreshToken - Refresh token
   148	   * @returns {object} New { accessToken, expiresIn }
   149	   */
   150	  static refreshAccessToken(refreshToken) {
   151	    try {
   152	      const decoded = this.verifyToken(refreshToken, 'refresh');
   153	
   154	      const newAccessToken = this.generateToken(
   155	        {
   156	          id: decoded.sub,
   157	          email: decoded.email,
   158	          name: decoded.name,
   159	          groups: decoded.groups,
   160	          role: decoded.role,
   161	        },
   162	        'access'
   163	      );
   164	
   165	      const decodedAccess = jwt.decode(newAccessToken);
   166	      const expiresIn = decodedAccess.exp * 1000 - Date.now();
   167	
   168	      return {
   169	        accessToken: newAccessToken,
   170	        expiresIn,
   171	        tokenType: 'Bearer',
   172	      };
   173	    } catch (error) {
   174	      throw new Error(`Token refresh failed: ${error.message}`);
   175	    }
   176	  }
   177	
   178	  /**
   179	   * Generate a test token for development
   180	   * Useful for testing without Cognito
   181	   * @param {object} overrides - Override default test user properties
   182	   * @returns {object} { token, user, expiresAt }
   183	   */
   184	  static generateTestToken(overrides = {}) {
   185	    const testUser = {
   186	      id: 'test-user-' + crypto.randomBytes(8).toString('hex'),
   187	      email: overrides.email || 'test@episode-metadata.dev',
   188	      name: overrides.name || 'Test User',
   189	      groups: overrides.groups || ['USER', 'EDITOR'],
   190	      role: overrides.role || 'USER',
   191	      ...overrides,
   192	    };
   193	
   194	    const { accessToken, refreshToken, expiresIn } = this.generateTokenPair(testUser);
   195	    const decoded = jwt.decode(accessToken);
   196	
   197	    return {
   198	      accessToken,
   199	      refreshToken,
   200	      user: testUser,
   201	      expiresAt: new Date(decoded.exp * 1000),
   202	      expiresIn,
   203	    };
   204	  }
   205	}
   206	
   207	module.exports = TokenService;
   208	
   209	// Export individual methods for easier importing
   210	module.exports.generateToken = TokenService.generateToken.bind(TokenService);
   211	module.exports.verifyToken = TokenService.verifyToken.bind(TokenService);
   212	module.exports.generateTokenPair = TokenService.generateTokenPair.bind(TokenService);
   213	module.exports.refreshAccessToken = TokenService.refreshAccessToken.bind(TokenService);
   214	module.exports.revokeToken = TokenService.revokeToken.bind(TokenService);
   215	module.exports.generateTestToken = TokenService.generateTestToken.bind(TokenService);
```

`TokenService.generateToken` (lines 20–60) always signs with
`algorithm: 'HS256'` (line 48) against `process.env.JWT_SECRET` (line 21).
There is no other minting function in this file and no branch that signs
with any other algorithm. `generateTokenPair` (67–81) calls
`generateToken` twice (access + refresh). `generateTestToken` (184–204)
calls `generateTokenPair` once, for a synthetic user.

### Call-site grep — raw

```
$ grep -rn "generateTokenPair\|TokenService" --include='*.js' src/ tests/
```

```
src/middleware/jwtAuth.js:7:const TokenService = require('../services/tokenService');
src/middleware/jwtAuth.js:38:      const decoded = TokenService.verifyToken(token);
src/middleware/jwtAuth.js:91:      const decoded = TokenService.verifyToken(token);
src/middleware/auth.js:25:// generateTokenPair) for production traffic that was previously verifier-
src/services/tokenService.js:10:class TokenService {
src/services/tokenService.js:67:  static generateTokenPair(user) {
src/services/tokenService.js:194:    const { accessToken, refreshToken, expiresIn } = this.generateTokenPair(testUser);
src/services/tokenService.js:207:module.exports = TokenService;
src/services/tokenService.js:210:module.exports.generateToken = TokenService.generateToken.bind(TokenService);
src/services/tokenService.js:211:module.exports.verifyToken = TokenService.verifyToken.bind(TokenService);
src/services/tokenService.js:212:module.exports.generateTokenPair = TokenService.generateTokenPair.bind(TokenService);
src/services/tokenService.js:213:module.exports.refreshAccessToken = TokenService.refreshAccessToken.bind(TokenService);
src/services/tokenService.js:214:module.exports.revokeToken = TokenService.revokeToken.bind(TokenService);
src/services/tokenService.js:215:module.exports.generateTestToken = TokenService.generateTestToken.bind(TokenService);
src/routes/auth.js:9:const TokenService = require('../services/tokenService');
src/routes/auth.js:87:    const tokens = TokenService.generateTokenPair(user);
src/routes/auth.js:139:    const newTokens = TokenService.refreshAccessToken(refreshToken);
src/routes/auth.js:173:        TokenService.revokeToken(token);
src/routes/auth.js:242:    const decoded = TokenService.verifyToken(token);
tests/integration/phase3a-integration.test.js:9:const TokenService = require('../../src/services/tokenService');
tests/integration/phase3a-integration.test.js:30:    const tokens = TokenService.generateTokenPair(testUser);
tests/integration/f-auth-1-fd63.test.js:22: * TokenService is the jwtAuth.js path (D20) and does not authenticate
tests/integration/f-auth-1-fd63.test.js:25: * and verifyToken:190 routes HS256 tokens to it. A TokenService-minted token
tests/integration/f-auth-1-fd63.test.js:34:const TokenService = require('../../src/services/tokenService');
tests/integration/f-auth-1-fd63.test.js:41:  TokenService.generateToken(
tests/integration/f-auth-1-g3-clause3.test.js:45:const TokenService = require('../../src/services/tokenService');
tests/integration/f-auth-1-g3-clause3.test.js:124:const token = TokenService.generateToken(
tests/integration/f-auth-1-fd65.test.js:31:const TokenService = require('../../src/services/tokenService');
tests/integration/f-auth-1-fd65.test.js:136:      const adminToken = TokenService.generateToken(
tests/integration/episodes.integration.test.js:9:const TokenService = require('../../src/services/tokenService');
tests/integration/episodes.integration.test.js:29:    const tokens = TokenService.generateTokenPair(user);
tests/integration/wardrobe-money.integration.test.js:29:const TokenService = require('../../src/services/tokenService');
tests/integration/wardrobe-money.integration.test.js:44:    token = TokenService.generateTokenPair({
tests/integration/auth.integration.test.js:9:const TokenService = require('../../src/services/tokenService');
tests/integration/auth.integration.test.js:27:    const tokens = TokenService.generateTokenPair(user);
tests/integration/auth.integration.test.js:234:      const expiredToken = TokenService.generateToken(user, 'access');
tests/integration/auth.integration.test.js:316:      const e2eTokens = TokenService.generateTokenPair({
tests/integration/assets.integration.test.js:9:const TokenService = require('../../src/services/tokenService');
tests/integration/assets.integration.test.js:24:    const tokens = TokenService.generateTokenPair(user);
tests/unit/middleware/auth-gaps.test.js:12:  generateTokenPair: jest.fn(),
tests/unit/middleware/f-auth-x1-dual-verifier.test.js:32:  generateTokenPair: jest.fn(),
tests/unit/middleware/jwtAuth.test.js:7:const TokenService = require('../../../src/services/tokenService');
tests/unit/middleware/jwtAuth.test.js:59:      TokenService.verifyToken.mockReturnValue({
tests/unit/middleware/jwtAuth.test.js:87:      TokenService.verifyToken.mockReturnValue(decodedToken);
tests/unit/middleware/jwtAuth.test.js:100:      TokenService.verifyToken.mockReturnValue({
tests/unit/middleware/jwtAuth.test.js:115:      TokenService.verifyToken.mockReturnValue({
tests/unit/middleware/jwtAuth.test.js:128:      TokenService.verifyToken.mockImplementation(() => {
tests/unit/middleware/jwtAuth.test.js:146:      TokenService.verifyToken.mockImplementation(() => {
tests/unit/middleware/jwtAuth.test.js:158:      TokenService.verifyToken.mockImplementation(() => {
tests/unit/middleware/jwtAuth.test.js:172:      TokenService.verifyToken.mockReturnValue({
tests/unit/middleware/jwtAuth.test.js:196:      TokenService.verifyToken.mockReturnValue(claims);
tests/unit/middleware/jwtAuth.test.js:227:      TokenService.verifyToken.mockImplementation(() => {
tests/unit/middleware/jwtAuth.test.js:248:      TokenService.verifyToken.mockImplementation(() => {
tests/unit/middleware/jwtAuth.test.js:260:      TokenService.verifyToken.mockReturnValue({
tests/unit/middleware/jwtAuth.test.js:290:      TokenService.verifyToken.mockReturnValue({
tests/unit/services/tokenService.test.js:2: * TokenService Unit Tests
tests/unit/services/tokenService.test.js:15:const TokenService = require('../../../src/services/tokenService');
tests/unit/services/tokenService.test.js:25:describe('TokenService', () => {
tests/unit/services/tokenService.test.js:28:    TokenService.tokenBlacklist = new Set();
tests/unit/services/tokenService.test.js:38:      const token = TokenService.generateToken(sampleUser);
tests/unit/services/tokenService.test.js:44:      const token = TokenService.generateToken(sampleUser);
tests/unit/services/tokenService.test.js:53:      const token = TokenService.generateToken(sampleUser, 'refresh');
tests/unit/services/tokenService.test.js:61:      expect(() => TokenService.generateToken(sampleUser)).toThrow('JWT_SECRET is not configured');
tests/unit/services/tokenService.test.js:68:      expect(() => TokenService.generateToken(sampleUser)).toThrow('JWT_SECRET must be at least 32 characters');
tests/unit/services/tokenService.test.js:73:      const token = TokenService.generateToken({ ...sampleUser, groups: ['admin'], role: 'ADMIN' });
tests/unit/services/tokenService.test.js:81:      const token = TokenService.generateToken(user);
tests/unit/services/tokenService.test.js:87:  describe('generateTokenPair', () => {
tests/unit/services/tokenService.test.js:89:      const pair = TokenService.generateTokenPair(sampleUser);
tests/unit/services/tokenService.test.js:97:      const pair = TokenService.generateTokenPair(sampleUser);
tests/unit/services/tokenService.test.js:103:      const pair = TokenService.generateTokenPair(sampleUser);
tests/unit/services/tokenService.test.js:110:      const token = TokenService.generateToken(sampleUser);
tests/unit/services/tokenService.test.js:111:      const decoded = TokenService.verifyToken(token, 'access');
tests/unit/services/tokenService.test.js:117:      const token = TokenService.generateToken(sampleUser) + 'tampered';
tests/unit/services/tokenService.test.js:118:      expect(() => TokenService.verifyToken(token)).toThrow();
tests/unit/services/tokenService.test.js:122:      const token = TokenService.generateToken(sampleUser, 'access');
tests/unit/services/tokenService.test.js:123:      expect(() => TokenService.verifyToken(token, 'refresh')).toThrow(/Invalid token type/);
tests/unit/services/tokenService.test.js:127:      const token = TokenService.generateToken(sampleUser);
tests/unit/services/tokenService.test.js:128:      TokenService.revokeToken(token);
tests/unit/services/tokenService.test.js:129:      expect(() => TokenService.verifyToken(token)).toThrow(/revoked/);
tests/unit/services/tokenService.test.js:133:      expect(() => TokenService.verifyToken('not.a.jwt')).toThrow();
tests/unit/services/tokenService.test.js:139:      const token = TokenService.generateToken(sampleUser);
tests/unit/services/tokenService.test.js:141:      TokenService.revokeToken(token);
tests/unit/services/tokenService.test.js:142:      expect(TokenService.tokenBlacklist.has(decoded.jti)).toBe(true);
tests/unit/services/tokenService.test.js:146:      expect(() => TokenService.revokeToken('invalid-token')).not.toThrow();
tests/unit/services/tokenService.test.js:150:      expect(() => TokenService.revokeToken(null)).not.toThrow();
tests/unit/services/tokenService.test.js:156:      const { refreshToken } = TokenService.generateTokenPair(sampleUser);
tests/unit/services/tokenService.test.js:157:      const result = TokenService.refreshAccessToken(refreshToken);
tests/unit/services/tokenService.test.js:164:      const { refreshToken } = TokenService.generateTokenPair(sampleUser);
tests/unit/services/tokenService.test.js:165:      const result = TokenService.refreshAccessToken(refreshToken);
tests/unit/services/tokenService.test.js:171:      const accessToken = TokenService.generateToken(sampleUser, 'access');
tests/unit/services/tokenService.test.js:172:      expect(() => TokenService.refreshAccessToken(accessToken)).toThrow(/Token refresh failed/);
tests/unit/services/tokenService.test.js:176:      const { refreshToken } = TokenService.generateTokenPair(sampleUser);
tests/unit/services/tokenService.test.js:177:      TokenService.revokeToken(refreshToken);
tests/unit/services/tokenService.test.js:178:      expect(() => TokenService.refreshAccessToken(refreshToken)).toThrow();
tests/unit/services/tokenService.test.js:184:      const result = TokenService.generateTestToken();
tests/unit/services/tokenService.test.js:193:      const result = TokenService.generateTestToken();
tests/unit/services/tokenService.test.js:199:      const result = TokenService.generateTestToken({ email: 'admin@test.com', role: 'ADMIN' });
tests/unit/services/tokenService.test.js:205:      const result = TokenService.generateTestToken();
```

### Classification of every hit above

**Definition** (the class and its minting/verifying methods):
`src/services/tokenService.js:10` (`class TokenService`), `:67`
(`generateTokenPair`). `generateToken` and `verifyToken` are defined at
lines 20 and 88 of the same file and do not contain the literal string
`generateTokenPair` or `TokenService`, so they do not appear in this grep's
hit list — they are read in the full-file paste above instead.

**Export** (module surface): `src/services/tokenService.js:207–215`
(`module.exports = TokenService` and the six bound re-exports).

**Requires** (import sites, no call on that line): `src/middleware/jwtAuth.js:7`,
`src/routes/auth.js:9`, and one `require(...)` line in each of
`tests/integration/phase3a-integration.test.js:9`,
`tests/integration/f-auth-1-fd63.test.js:34`,
`tests/integration/f-auth-1-g3-clause3.test.js:45`,
`tests/integration/f-auth-1-fd65.test.js:31`,
`tests/integration/episodes.integration.test.js:9`,
`tests/integration/wardrobe-money.integration.test.js:29`,
`tests/integration/auth.integration.test.js:9`,
`tests/integration/assets.integration.test.js:9`,
`tests/unit/middleware/jwtAuth.test.js:7`,
`tests/unit/services/tokenService.test.js:15`.

**Call — mints an HS256 token** (`generateToken` or `generateTokenPair`,
production code only): `src/routes/auth.js:87`
(`TokenService.generateTokenPair(user)`, the disabled `/login` route body
— see next section). No other production call site mints a token;
`src/routes/auth.js:139` (`refreshAccessToken`) and `:173`
(`revokeToken`) operate on existing tokens, not new ones, though
`refreshAccessToken` internally calls `generateToken` again
(`tokenService.js:154`, inside the file already pasted whole above).

**Call — mints an HS256 token, test-only**: every remaining
`TokenService.generateToken(...)` / `TokenService.generateTokenPair(...)`
/ `TokenService.generateTestToken(...)` call under `tests/` in the list
above (both integration fixtures minting bearer tokens to drive
authenticated requests in tests, and `tests/unit/services/tokenService.test.js`
exercising the class directly). None of these run outside `NODE_ENV=test`.

**Call — verifies (not mints)**: `src/routes/auth.js:242`
(`/validate` route), `src/middleware/jwtAuth.js:38` and `:91`
(`authenticateJWT` / `optionalJWTAuth`), and the `TokenService.verifyToken`
call sites in `tests/unit/middleware/jwtAuth.test.js` (mocked) and
`tests/unit/services/tokenService.test.js` (direct).

**Comment / string reference, not code**: `src/middleware/auth.js:25`
(a code-comment naming `generateTokenPair` while describing F-AUTH-X1's
history — no `require` or call in that file); the two prose lines in
`tests/integration/f-auth-1-fd63.test.js:22` and `:25`; the two
`jest.fn()` mock declarations in `tests/unit/middleware/auth-gaps.test.js:12`
and `tests/unit/middleware/f-auth-x1-dual-verifier.test.js:32` (mock the
export, do not call the real function); `tests/unit/services/tokenService.test.js:2`
and `:25` (file header comment and `describe` block name).

## Where the one production HS256 mint sits — `src/routes/auth.js`

```
$ git show 98ffde850b8817923deb0b4e21e7b74baca03a20:src/routes/auth.js | sed -n '1,60p'
```

```
     1	/**
     2	 * Authentication Routes
     3	 * Handles login, token refresh, and token validation
     4	 */
     5	
     6	const express = require('express');
     7	const rateLimit = require('express-rate-limit');
     8	const router = express.Router();
     9	const TokenService = require('../services/tokenService');
    10	const { authenticateJWT } = require('../middleware/jwtAuth');
    11	const { optionalAuth } = require('../middleware/auth');
```

```
    37	/**
    38	 * POST /api/v1/auth/login
    39	 * Developer/test endpoint to get a JWT token
    40	 * In production, this would integrate with Cognito
    41	 */
    42	router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
    43	  // FD-65 ISSUANCE HALF, closed 2026-08-22. This route issued a signed token
    44	  // to any caller supplying a well-formed email and any 6-character password;
    45	  // no credential was ever verified. v2.49 minted FD-65 with two halves and
    46	  // v2.50 closed only the privilege half (75ac05f0, caller-supplied
    47	  // groups/role removed), explicitly leaving this one open at P0.
    48	  //
    49	  // Disabled rather than repaired: implementing real verification is a
    50	  // decision about whether password login should exist at all, given Cognito
    52	  return res.status(401).json({
    53	    error: 'Unauthorized',
    54	    message: 'Password login is disabled.',
    55	    code: 'AUTH_LOGIN_DISABLED',
    56	  });
    57	  try {
    58	    const { email, password } = req.body;
    ...
    87	    const tokens = TokenService.generateTokenPair(user);
    ...
```

Line 52's unconditional `return` runs before line 57's `try` block, so the
`generateTokenPair` call at line 87 is unreachable dead code at this basis
— FD-65's own in-code banner (lines 43–51) states this route "closed
2026-08-22" and is "Disabled rather than repaired." This route is
`optionalAuth`, not `requireAuth` (line 42); as the code stands, no request
to `POST /api/v1/auth/login` reaches the `generateTokenPair` call
regardless of auth header, because the handler returns at line 52 first.

## The HS256 boundary, as it stands today

Any route that accepts a token accepts either family. `requireAuth`,
`optionalAuth`, and the plain `authenticateToken` in
`src/middleware/auth.js` all route through the shared `verifyToken`
function pasted above (lines 207–216): a well-formed RS256 token verifies
against Cognito, a well-formed HS256 token verifies against
`tokenService`/`JWT_SECRET`, and both produce an equally-trusted
`req.user`. Per `src/middleware/auth.js`'s own header comment (lines
36–42, quoted above): "Both verifiers produce equally-trusted req.user; do
NOT use the source field for trust-level discrimination, RBAC, or
access-control decisions in route handlers." This applies uniformly across
the ~1,400 handler declarations that use `requireAuth`/`optionalAuth`
from this file (per PROJECT_CONTEXT.md §4.1) — this note does not
re-enumerate them; it establishes what the shared verifier does once a
token reaches it.

One narrower surface exists alongside it: `src/middleware/jwtAuth.js`
(`authenticateJWT`, `optionalJWTAuth`, used by `src/routes/auth.js`
`/logout` and `/me`, and by seven handlers in
`src/routes/compositions.js`) calls only `TokenService.verifyToken`
directly (lines 38 and 91 of that file) — it has no Cognito verifier call
anywhere in it, despite its file header comment (line 3: "Supports both
AWS Cognito and custom JWT tokens"). As the code reads at this basis, the
routes gated by `authenticateJWT`/`optionalJWTAuth` accept only HS256
tokens; an RS256 (Cognito) token presented to them fails
`jwt.verify`-family validation inside `tokenService.verifyToken` (which
hard-codes `algorithms: ['HS256']` at `tokenService.js:91`) and is
rejected as an invalid token, not routed to Cognito. This is a narrower,
separate acceptance surface from the shared `auth.js` verifier described
above, not a second instance of the same boundary.

As for minting: today exactly one production call site mints an HS256
token (`src/routes/auth.js:87`, inside the FD-65-disabled `/login`
handler, unreachable per the previous section), plus one call
(`src/routes/auth.js:139`, `refreshAccessToken`) that re-mints an access
token from an existing valid refresh token, also reachable only if a
caller already holds an HS256 refresh token minted before the route was
disabled or via a path outside this repo. `generateTestToken`
(`tokenService.js:184`) is exported but has no caller anywhere in `src/`
(confirmed by the grep above — no `generateTestToken` hit under `src/`)
or in any route file; PROJECT_CONTEXT.md §0 item 5 records that the
`/test-token` endpoint was deleted (issue/PR #1044, August 2026), and this
grep is consistent with that: the method survives in the class but is
unwired.

## Absence of a Cognito issuance path — raw grep

```
$ grep -rn "InitiateAuth\|USER_PASSWORD_AUTH\|SECRET_HASH\|CognitoIdentityProvider" --include='*.js' src/
```

```
(no output)
```

Confirmed: nothing under `src/` calls Cognito's `InitiateAuth`,
references `USER_PASSWORD_AUTH`, computes a `SECRET_HASH`, or imports a
`CognitoIdentityProvider` client. The issuance half of FD-65 has no
Cognito code path in this repository at this basis — the only issuance
code that exists is the HS256 path in `tokenService.js` described above.
Cognito appears in this repo only as a *verification* dependency
(`aws-jwt-verify`, `CognitoJwtVerifier`, in `src/middleware/auth.js`), never
as an issuance dependency.

## Cognito-related environment variables referenced in code

```
$ grep -rn "COGNITO_[A-Z_]*" --include='*.js' src/
```

```
src/config/environment.js:33:    userPoolId: process.env.COGNITO_USER_POOL_ID,
src/config/environment.js:34:    clientId: process.env.COGNITO_CLIENT_ID,
src/config/environment.js:35:    clientSecret: process.env.COGNITO_CLIENT_SECRET,
src/config/environment.js:36:    region: process.env.COGNITO_REGION || 'us-east-1',
src/middleware/auth.js:70:// `process.env.COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX'` placeholder
src/middleware/auth.js:82:const COGNITO_CONFIG_PLACEHOLDERS = {
src/middleware/auth.js:88:  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
src/middleware/auth.js:89:  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
src/middleware/auth.js:91:  if (!userPoolId) missingVariables.push('COGNITO_USER_POOL_ID');
src/middleware/auth.js:92:  if (!clientId) missingVariables.push('COGNITO_CLIENT_ID');
src/middleware/auth.js:94:    if (userPoolId === COGNITO_CONFIG_PLACEHOLDERS.userPoolId) {
src/middleware/auth.js:95:      missingVariables.push('COGNITO_USER_POOL_ID');
src/middleware/auth.js:97:    if (clientId === COGNITO_CONFIG_PLACEHOLDERS.clientId) {
src/middleware/auth.js:98:      missingVariables.push('COGNITO_CLIENT_ID');
src/middleware/auth.js:102:    const err = new Error('COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID not configured');
src/middleware/auth.js:311:const COGNITO_INFRA_ERROR_NAMES = new Set([
src/middleware/auth.js:334:    if (cur.name && COGNITO_INFRA_ERROR_NAMES.has(cur.name)) return cur;
```

Four distinct env var **names** are read from `process.env` (values never
printed here):

| Variable | First `process.env.` read |
|---|---|
| `COGNITO_USER_POOL_ID` | `src/config/environment.js:33`, `src/middleware/auth.js:88` |
| `COGNITO_CLIENT_ID` | `src/config/environment.js:34`, `src/middleware/auth.js:89` |
| `COGNITO_CLIENT_SECRET` | `src/config/environment.js:35` (read only; no call site under `src/` consumes `clientSecret` from this config object — it is not used by the RS256 verifier path in `auth.js`, which never reads a client secret) |
| `COGNITO_REGION` | `src/config/environment.js:36` |

`src/middleware/auth.js:311` and `:334` (`COGNITO_INFRA_ERROR_NAMES`) are
a `Set` of Node/fetch error-class names used to classify infrastructure
failures (line 334's usage inside `findCognitoInfraCause`) — not an
environment variable read.

### `docs/cognito-ids.txt` and similar identifier files

This session's `.claude/settings.json` denies `Read` on
`docs/cognito-ids.txt` (and on `docs/connect-to-ec2.txt` and
`docs/rds-endpoint-dev.txt`) at the tool level; both the `Read` tool and a
targeted `Grep` against that path were refused outright in this session,
so this note did not open, quote, or paraphrase that file at all — not
even its banner, which this session has no access to render. Its
retirement status is recorded instead from two already-filed MEASURED
audit documents that already cite it without reproducing its contents:

- `PROJECT_CONTEXT.md` §1 (Cognito row): "`docs/cognito-ids.txt` and
  `docs/COGNITO_USER_POOL_SETTINGS.md` retired as authority (PE #66)."
- `docs/audit/Docs_Archive_Census_2026-09-13.md`: "`docs/cognito-ids.txt`,
  `docs/COGNITO_USER_POOL_SETTINGS.md`, `docs/connect-to-ec2.txt`,
  `docs/rds-endpoint-dev.txt` — Retired as authority; carry identifiers;
  do not paste their contents into prompts."

No pool ID, client ID, secret, or any other identifier value from that
file, or from `docs/COGNITO_USER_POOL_SETTINGS.md`, appears anywhere in
this note.

## Consequence of ruling (c)

Ruling (c) states that FD-65's issuance half closes on live verification
against the real Cognito pool, not on implementation. The consequence,
stated explicitly: whatever password-login implementation follows this
note — however it is built, and whatever it does to the HS256 boundary
described above — **cannot itself close FD-65's issuance half**. No
session performing that implementation may mark FD-65's issuance half
closed on the strength of its own PR merging. What lands on merge is
implementation filed with verification owed: the code changes, FD-65's
issuance half stays open, and closing it requires a live check against
the real Cognito pool — host and AWS contact that is Evoni-gated and
outside any agent session's authority (CLAUDE.md "Non-negotiables";
PROJECT_CONTEXT.md §0 item 2). That verification step belongs to Evoni,
not to this note, not to the implementation PR, and not to any follow-up
session.

## This note does not

- Mint any finding, decision, or fix-plan item. No FD-70, no XK-4, no
  PE #69 is created here.
- Rule anything. Evoni's three rulings above are recorded as hers,
  verbatim, dated as she made them — this note does not restate them as
  its own conclusions, endorse them, or extend their scope.
- Propose a route contract, an auth flow, an error-code mapping, or any
  other implementation design for password login.
- Narrow the HS256 boundary itself. Ruling (b) says the boundary will be
  narrowed; this note records what the boundary is today so that
  narrowing has a fixed surface to be drawn against — it does not draw
  that line.
- Contact any host, AWS account, database, or Cognito pool. Every read
  above is a repository read at the basis SHA on the face of this note.

Only a Fix Plan revision disposes of FD-65.

## Footer

**Type:** standalone measurement note. **Rules:** nothing — Evoni's three
rulings are recorded as hers, cited, not re-derived or restated as this
note's own. **Mints:** nothing — no FD-70, no XK-4, no PE #69, no other FD,
XK, or PE. **Host/AWS/DB contact:** none. **Prod FROZEN**, untouched.
**Closes:** nothing — FD-65's issuance half stays open; only a Fix Plan
revision disposes of it, and only live Cognito verification (Evoni-gated)
can satisfy ruling (c).

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date filed: 2026-09-15. Basis: `origin/main` at
`98ffde850b8817923deb0b4e21e7b74baca03a20` (2026-09-14).*
*Authority: `src/middleware/auth.js`, read directly, MEASURED;
`src/services/tokenService.js`, read directly, MEASURED; `src/routes/auth.js`,
read directly, MEASURED; `src/middleware/jwtAuth.js`, read directly,
MEASURED; raw greps as pasted above, MEASURED. Evoni's three rulings, dated
2026-09-14, RULED — cited, not re-derived.*
