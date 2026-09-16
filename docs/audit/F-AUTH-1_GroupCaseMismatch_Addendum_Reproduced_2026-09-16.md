| **PRIME STUDIOS** **F-AUTH-1 — GROUP-NAME CASE MISMATCH, ADDENDUM: REPRODUCED END TO END** *Upgrades `F-AUTH-1_GroupCaseMismatch_MEASURED_2026-09-16.md` from a structural finding (established by reading code) to a reproduction (established by running it). Additive only — the original document is merged and immutable. Mints nothing.* |
| --- |

**Document version**

v1.0 — **ADDENDUM, NOT A CORRECTION.** The original note's structural
claim was correct as filed; nothing in it is retracted or restated as
wrong. This document adds a fact the original didn't have: a live
end-to-end run confirming the predicted failure actually occurs, not
just that the code as read would produce it.

**Basis:** `origin/main` at `950dbd2e5f84d2e9ce4910b0a9001fa20b6ec135`,
2026-09-16 (post `#1474`, `#1472`). Local server run against the real
Cognito pool and app, `test-admin@example.com`, this session.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
Evoni ran every credential-bearing step herself (Layer 1 `initiate-auth`,
Layer 2 `/login`, `/me`, and the group-gated route); this document
records her account of what came back, redacted of tokens and
passwords per this session's own handling discipline.

**Status**

**Additive addendum. Records one reproduction, on Evoni's account of her
own run.** No FD, XK, or PE number is minted. Prod remains **FROZEN** —
all four steps ran against the dev pool and a local server, no
production contact.

---

# §1. What was run

Four steps, in sequence, same test user and same issued token throughout:

1. **`aws cognito-idp initiate-auth`**, `USER_PASSWORD_AUTH`, no
   `SECRET_HASH` (per `#1472`'s fix) — `AuthenticationResult` returned.
   Confirms the fix works against the pool's real (secret-less) client.
2. **`POST /api/v1/auth/login`** (local server, real Cognito env vars),
   same credential — `success: true`, `"Login successful"`, the five
   pinned fields present.
3. **`GET /api/v1/auth/me`** with the issued access token — `200`,
   `"User information retrieved"`, `user.groups` containing `admin`.
4. **`PUT /api/v1/assets/:id/approve`** — one of the 38 sites the
   original note identified as checking `authorize(['ADMIN'])` — same
   token:

   ```
   403
   {"error":"Forbidden","message":"User must be in one of these groups: ADMIN","code":"AUTH_GROUP_REQUIRED"}
   ```

---

# §2. What this establishes that the original note could not

The original note (§3, §5) stated the 38/51 breakdown and the failure
mode from reading `authorize`'s and `requireGroup`'s source and the
call sites' literal strings. It was explicit that it could not establish
whether any real admin had been affected, and could not establish
whether any user actually held group membership (§1's confirmed/
unconfirmed split).

This run resolves both, for this one account: `test-admin@example.com`
**is** a member of the `admin` group (confirmed by the token's
`cognito:groups` claim, read via `/me`'s response, not asserted from the
console alone), Cognito correctly authenticated and authorized the
request at the identity layer, and the app's own middleware denied it
anyway — for the reason, and only the reason, the original note named:
the literal string comparison at `auth.js:502`/`jwtAuth.js:134` against
an uppercase constant that does not match the lowercase group name.

No inference step remains between "the code, read carefully, implies
this defect" and "this defect happened, observed directly."

---

# §3. What this does not change

- **Does not alter the 38/51 count**, the two comparison sites, or the
  controllers-vs-routes split the original note recorded. All stand as
  filed.
- **Does not recommend a fix**, for the same reason the original
  declined to: the three shapes named there remain materially different
  in blast radius, and choosing among them is still Evoni's decision,
  untouched by this reproduction.
- **Does not decide the FD-mint question.** This addendum strengthens
  the evidentiary basis available to that decision; it does not make
  the decision.
- **Does not touch FD-65** or either Fix Plan revision. This route
  (`assets.js`) and this middleware (`authorize`) are the authorization
  layer; FD-65 is the issuance layer. The same test run happens to
  exercise both, and this document reports only the authorization half
  of what that run showed.

---

# §4. Disposition

Recording only. No FD, XK, or PE number. Prod **FROZEN**.
