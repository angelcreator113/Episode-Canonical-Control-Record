# F-AUTH-1 — `POST /login` handler's unreachable region, read

**Basis:** `origin/main` at `2457b6e267e8ceca688c2c59edc652a64b1061da` (2026-09-14).
**Standing:** MEASURED for every read performed in this document — repo reads,
command and raw output pasted. Anything drawn from a predecessor document is
labelled **carried** and cited to that document; it is never upgraded to
MEASURED here.

This is a read. It mints nothing, rules nothing, and closes nothing. See the
closing section.

---

## 1. The handler, whole, line-numbered — MEASURED

```
$ sed -n '42,121p' src/routes/auth.js | nl -ba -v42 -w3
```

```
 42	router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
 43	  // FD-65 ISSUANCE HALF, closed 2026-08-22. This route issued a signed token
 44	  // to any caller supplying a well-formed email and any 6-character password;
 45	  // no credential was ever verified. v2.49 minted FD-65 with two halves and
 46	  // v2.50 closed only the privilege half (75ac05f0, caller-supplied
 47	  // groups/role removed), explicitly leaving this one open at P0.
 48	  //
 49	  // Disabled rather than repaired: implementing real verification is a
 50	  // decision about whether password login should exist at all, given Cognito
 51	  // is the actual authentication path. Fails closed until that is ruled.
 52	  return res.status(401).json({
 53	    error: 'Unauthorized',
 54	    message: 'Password login is disabled.',
 55	    code: 'AUTH_LOGIN_DISABLED',
 56	  });
 57	  try {
 58	    const { email, password } = req.body;
 59	
 60	    // Validate email
 61	    if (!email || !email.includes('@')) {
 62	      return res.status(400).json({
 63	        error: 'Bad Request',
 64	        message: 'Valid email required',
 65	        code: 'AUTH_INVALID_EMAIL',
 66	      });
 67	    }
 68	
 69	    // For development: accept any password (in production, verify against Cognito)
 70	    if (!password || password.length < 6) {
 71	      return res.status(400).json({
 72	        error: 'Bad Request',
 73	        message: 'Password must be at least 6 characters',
 74	        code: 'AUTH_INVALID_PASSWORD',
 75	      });
 76	    }
 77	
 78	    // Generate token pair
 79	    const user = {
 80	      id: `user-${email.split('@')[0]}-${Date.now()}`, // Generate ID for dev/test
 81	      email,
 82	      name: email.split('@')[0],
 83	      groups: ['USER'],
 84	      role: 'USER',
 85	    };
 86	
 87	    const tokens = TokenService.generateTokenPair(user);
 88	
 89	    // Store refresh token in secure httpOnly cookie (optional)
 90	    res.cookie('refreshToken', tokens.refreshToken, {
 91	      httpOnly: true,
 92	      secure: process.env.NODE_ENV === 'production',
 93	      sameSite: 'strict',
 94	      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
 95	    });
 96	
 97	    return res.status(200).json({
 98	      success: true,
 99	      message: 'Login successful',
100	      data: {
101	        accessToken: tokens.accessToken,
102	        refreshToken: tokens.refreshToken,
103	        tokenType: tokens.tokenType,
104	        expiresIn: tokens.expiresIn,
105	        user: {
106	          email: user.email,
107	          name: user.name,
108	          groups: user.groups,
109	          role: user.role,
110	        },
111	      },
112	    });
113	  } catch (error) {
114	    console.error('Login error:', error);
115	    return res.status(500).json({
116	      error: 'Internal Server Error',
117	      message: error.message,
118	      code: 'AUTH_LOGIN_ERROR',
119	    });
120	  }
121	});
```

## 2. Tier as declared — MEASURED

The route line's middleware chain, verbatim, is what line 42 states and no
more:

```
router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
```

`optionalAuth`, then `loginLimiter`, then `validateLoginRequest`, in that
order, ahead of the handler body. Not characterized beyond this line.

## 3. The unconditional return, and the unreachable region's extent — MEASURED

The unconditional return, lines 52–56:

```
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Password login is disabled.',
    code: 'AUTH_LOGIN_DISABLED',
  });
```

This `return` is unconditional — no guarding `if`, no branch — and precedes
every statement that follows it inside the same function body. The
unreachable region is everything after it and before the handler's closing
`});`: **lines 57–121**.

ESLint's own flag, raw command and output:

```
$ npx eslint src/routes/auth.js
/home/user/Episode-Canonical-Control-Record/src/routes/auth.js
  57:3  error  Unreachable code  no-unreachable

✖ 1 problem (1 error, 0 warnings)
```

The flag lands on line 57 — the `try {` immediately following the
unconditional return — consistent with the stated 57–121 extent.

## 4. What the unreachable region does, itemized by line — MEASURED

Quoted, not paraphrased:

- **Email check — line 61.** `if (!email || !email.includes('@')) {`
- **Password-length check — line 70.** `if (!password || password.length < 6) {`
- **User-object construction with groups and role — lines 79–85.**
  ```
  const user = {
    id: `user-${email.split('@')[0]}-${Date.now()}`, // Generate ID for dev/test
    email,
    name: email.split('@')[0],
    groups: ['USER'],
    role: 'USER',
  };
  ```
- **`TokenService.generateTokenPair` call — line 87.**
  `const tokens = TokenService.generateTokenPair(user);`
- **`res.cookie` refresh-token write — lines 90–95.**
  ```
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  ```
- **Success response — lines 97–112.**
  ```
  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: {
        email: user.email,
        name: user.name,
        groups: user.groups,
        role: user.role,
      },
    },
  });
  ```

(The `catch` block at lines 113–120 is also inside the unreachable region by
the same extent, since it belongs to the same `try` that opens at line 57;
it is not separately itemized above because item 5 of the issue names only
the six pieces listed.)

## 5. The handler's own words — quoted, not summarized

The comment block at lines 43–51, in full, as the file states it:

> // FD-65 ISSUANCE HALF, closed 2026-08-22. This route issued a signed token
> // to any caller supplying a well-formed email and any 6-character password;
> // no credential was ever verified. v2.49 minted FD-65 with two halves and
> // v2.50 closed only the privilege half (75ac05f0, caller-supplied
> // groups/role removed), explicitly leaving this one open at P0.
> //
> // Disabled rather than repaired: implementing real verification is a
> // decision about whether password login should exist at all, given Cognito
> // is the actual authentication path. Fails closed until that is ruled.

This is the file speaking about its own intent. It is recorded here as the
file's words, not adopted as this note's conclusion.

## 6. History — MEASURED

```
$ git log -n 5 --format='%h %ad %s' --date=short -- src/routes/auth.js
7a1eb427c 2026-09-02 fix(auth): implement FD-67 Option 1 - remove global optionalAuth mount [skip-automerge] (#1185)
e5215a66e 2026-08-22 fix(auth): close FD-65's issuance half - disable password login [skip-automerge] (#1100)
75ac05f03 2026-08-17 fix(auth): F-AUTH-1 FD-65 declared-partial per Fix Plan v2.50 - delete /test-token route, remove caller-supplied groups/role from /login (#1044)
abc354aef 2026-02-06 Fix all test failures and add missing database migrations
8cc72528e 2026-01-28 feat: UI/UX improvements and Docker staging deployment
```

`e5215a66e` (2026-08-22), subject `fix(auth): close FD-65's issuance half -
disable password login [skip-automerge] (#1100)`, is the commit that
introduced the unconditional 401 return read in §3 above.

## 7. Classification — retained-by-design, as the file asserts

The comment block quoted in §5 states the disablement was a deliberate
choice — "Disabled rather than repaired" — made pending a ruling on whether
password login should exist at all, and explicitly ties the disablement to
FD-65's still-open issuance half. On that basis the region is classified
**retained-by-design, not orphaned**: this is what the file itself asserts.
This note does not independently verify the reasoning behind that
assertion — whether Cognito is in fact the sole intended authentication
path, or whether the P0 characterization is current, is not re-derived
here.

## 8. Consequence for `PROJECT_CONTEXT.md` §10 item 6 — stated, not ruled

`PROJECT_CONTEXT.md` §10 item 6 reads, in relevant part:

> **STILL OWED** — no `eslint` reference in `.github/workflows/validate.yml`
> at this basis. Add ESLint to the CI Validate workflow after clearing the
> remaining 9 pre-existing errors in 6 `src/` files (§4.8), or record why
> not.

Re-derived fresh at this document's basis, not carried from that line:

```
$ npx eslint src/ tests/ --format json
```
reports 6 files with `errorCount > 0`, 9 errors total: three single-error
migration files under `src/migrations/`, `src/services/financialPressureService.js`
(3 errors), and `src/routes/auth.js` (1 error) — the same count and file
set item 6 already carries.

`src/routes/auth.js`'s one error is the `no-unreachable` flag at line 57
read in §3. As long as the unreachable region stands, that error cannot be
cleared without either removing the region or making it reachable — both
dispositions of the region itself, which §7 above declines to recommend.
**This is stated as a fact about item 6's text — "clearing the remaining 9
... errors" cannot complete as written while this file contributes one of
the 9 — not as a recommendation to change the region, the item, or the
workflow.**

---

## Closing — mints nothing, rules nothing, recommends nothing

- **Mints nothing.** No FD-70, no XK-4, no PE #69. This is a standalone
  read, not a Fix Plan revision, not a ratifying revision, not a
  `Session_PE_Roster.md` entry.
- **Rules nothing.** The region's disposition — repair, delete, or leave in
  place — is not decided here.
- **Recommends nothing.** Neither deletion nor retention is preferred by
  this note.
- **Does not touch** FD-65's open issuance half (§5, §7 above quote and cite
  it; this note does not reopen, narrow, or close it) or FD-68's
  unadjudicated severity interaction with FD-65 (`Prime_Studios_Audit_Handoff_v26.md`
  Sec 3.1, carried, not re-derived here).
- **Does not characterize** the handler's security posture beyond what the
  code (§1, §3, §4) and its own comment (§5) say.
- Only a ratifying revision, or Evoni's written ruling, disposes of the
  region.

No host, AWS, database, or Cognito contact. Prod FROZEN.
