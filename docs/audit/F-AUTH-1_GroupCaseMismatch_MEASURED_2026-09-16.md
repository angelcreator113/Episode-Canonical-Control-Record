| **PRIME STUDIOS** **F-AUTH-1 — GROUP-NAME CASE MISMATCH, MEASURED** *Records that 38 of 51 admin-group authorization call sites, across two independent middleware implementations, deny a legitimate admin because they check `'ADMIN'` against a pool that emits `admin`. Records only — recommends no fix, mints no FD.* |
| --- |

**Document version**

v1.0 — **MEASURED, NOT DISPOSED.** This document records what was
measured this session and nothing more: the pool's actual group names,
the two case-sensitive comparison sites, and every call site's exact
string, broken down by match/mismatch. It does not recommend among the
three fix shapes named at §5, and it does not decide whether this mints
an FD — both are named as open questions for Evoni, not answered here.

**Basis:** `origin/main` at `237da78408b2edc358e3e232a312a94831ef1565`,
2026-09-16 (post `docs/audit/F-Tools-1_AWSReadAccess_Ruling_Amendment2_2026-09-16.md`,
which is the authority for the `list-groups` read this document cites).

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only.** Supplies a measured finding for Evoni's disposition;
does not itself dispose. No FD, XK, or PE number is minted by this
document. Prod **FROZEN**. No AWS, host, or database contact by this
document beyond the already-merged `list-groups` read it cites.

---

# §1. The pool's actual groups, as measured

```
$ aws cognito-idp list-groups --user-pool-id us-east-1_mFVU52978 --region us-east-1 --query "Groups[].{GroupName:GroupName,Description:Description,Precedence:Precedence,RoleArn:RoleArn}"
[
    {
        "GroupName": "viewer",
        "Description": "viewer group for dev",
        "Precedence": null,
        "RoleArn": null
    },
    {
        "GroupName": "admin",
        "Description": "admin group for dev",
        "Precedence": null,
        "RoleArn": null
    },
    {
        "GroupName": "editor",
        "Description": "editor group for dev",
        "Precedence": null,
        "RoleArn": null
    }
]
```

Three groups exist: `viewer`, `admin`, `editor` — all lowercase, no
`Precedence` or `RoleArn` set on any. `cognito:groups` on an issued
token is therefore capable of being populated (groups exist to belong
to); this settles the third of three console-reported facts as
**partially confirmed** — and the split is specific, not a hedge:

- **Confirmed:** at least one group exists, so a user who belongs to one
  *would* get `cognito:groups` on their token. This half is settled by
  the `list-groups` read above.
- **Unconfirmed:** whether any user actually belongs to any group.
  That's a `list-users-in-group` question, and that call is not in the
  allowlist. Group existence is necessary but not sufficient for the
  claim "populated on issued tokens" — this document establishes the
  claim is *possible*, not that it is *happening*.

This distinction sets the defect's actual blast radius, not just a
qualifier on the finding. If no user is a member of any group, no token
carries `cognito:groups` at all, and every one of the 51 call sites
below denies every caller for that reason first — the case mismatch
would be a second, currently-inactive defect, not the operative one.
Which of these is true is not established here.

---

# §2. The two comparison sites, quoted from source

Two independent middleware modules implement group-authorization
checks. Both use the identical pattern: exact-match, case-sensitive.

**`src/middleware/auth.js:502`** (inside `authorize`):

```js
if (!req.user.groups || !req.user.groups.some((group) => groups.includes(group))) {
```

**`src/middleware/jwtAuth.js:134`** (inside `requireGroup`):

```js
if (!req.user.groups || !req.user.groups.some((g) => groups.includes(g))) {
```

Both call `Array.prototype.includes`, which does no case normalization.
`req.user.groups` in both is built from `decoded['cognito:groups']` —
the literal strings Cognito emits, i.e. `admin`, not `ADMIN`. A call site
passing `'ADMIN'` will never match a real `admin` group member, in
either module.

`src/middleware/auth.js:522` — `const authorizeRole = authorize;` —
confirms `authorize` and `authorizeRole` are the same function under
two names, not two implementations. The count at §3 treats them as one
family accordingly; `requireGroup` (`jwtAuth.js`) is the second, genuinely
independent implementation, sharing only the comparison pattern.

---

# §3. All 51 call sites, broken down

**38 of 51 mismatched — uppercase `'ADMIN'`/`'ADMIN'`-family string,
will deny a real member of the pool's `admin` group:**

`authorize(['ADMIN'])` / `authorizeRole(['ADMIN'])` family — 35 sites:
- `src/app.js` — 1 (`/admin/queues`)
- `src/routes/assets.js` — 2
- `src/routes/auditLogs.js` — 3
- `src/routes/cfoAgentRoutes.js` — 9
- `src/routes/designAgentRoutes.js` — 3
- `src/routes/evaluation.js` — 1
- `src/routes/seed.js` — 3
- `src/routes/siteOrganizerRoutes.js` — 3
- `src/routes/templates.js` — 5
- `src/routes/uiOverlayRoutes.js` — 1
- `src/routes/wardrobeApproval.js` — 4

`requireGroup('ADMIN')` (`jwtAuth.js`, separate implementation) — 3
sites, all in `src/routes/compositions.js`: lines 507 (`/:id/approve`),
553 (`/:id/publish`), 591 (`/:id/generate`).

**13 of 51 correct — lowercase `'admin'`, matches the pool as measured:**

`authorize(['admin'])` — 2 sites, `src/routes/admin.js`.

`authorizeRole(['admin'])` (same function as `authorize`, aliased) — 11
sites across 4 controller-style files: `src/controllers/activityController.js`
(3), `src/controllers/notificationController.js` (1),
`src/controllers/presenceController.js` (1),
`src/controllers/socketController.js` (6).

**The split has a shape.** Every correct site is in a
`controllers/`-directory file using the `authorizeRole` alias and
`authenticateToken`; every mismatched site is in a `routes/`-directory
file (or `app.js`) using `authorize` directly, or in `compositions.js`
using the separate `requireGroup` middleware with `authenticateJWT`. Two
different code-generation eras or authoring conventions, not a random
scatter — recorded as an observation, not explained further here.

---

# §4. The failure mode, stated plainly

This does not fail loudly. A real admin authenticating successfully,
holding a token with `cognito:groups: ["admin"]`, hits one of the 38
mismatched routes and receives `403 Forbidden` — `AUTH_GROUP_REQUIRED`,
"User must be in one of these groups: ADMIN". Every visible signal
(login succeeded, token verified, error message names the exact group
the user believes they're in) points at the user, the group assignment,
or an IAM-style permissions question — not at the comparison itself. It
is the kind of defect that survives because every symptom reads as
someone else's problem to fix.

---

# §5. What this document does not establish, and does not recommend

**Does not recommend a fix.** Three shapes are visible and are
materially different in blast radius:
1. Normalize case at the comparison site(s) — changes
   `authorize`'s/`requireGroup`'s matching semantics for every caller,
   not just these 38.
2. Change the 38 call sites' literal strings to lowercase — touches
   `src/app.js` and 10 route files plus `compositions.js`, no shared
   semantics change.
3. Add uppercase-named groups to the pool matching the code's
   expectations — an AWS write, barred by the freeze and outside the
   read-only `aws` allowlist regardless of disposition.

Which of these (or another shape) is correct is **Evoni's decision**,
not stated or implied here.

**Does not establish whether anyone has been affected.** The 38 sites
*will* deny a legitimate admin if one is exercised — that is a
structural fact about the code, verified by reading it. Whether any
real admin has actually attempted one of these 38 routes and been
denied is usage data this document has no access to and does not claim.

**Does not decide the FD-mint question.** FD-70 is next-available and
unminted (unchanged since `v2.73`'s re-derivation). Whether this
warrants that mint, and under what title, is Evoni's ruling — this
document supplies the measured basis for that ruling, not the ruling
itself.

**Independent of FD-65.** This is an authorization-comparison defect
(who is let through after a successful login), not an issuance defect
(whether a login mints a valid token in the first place). It does not
touch `v2.73`'s or `v2.74`'s (draft) precondition record, and is filed
separately from both.

---

# §6. Disposition

Recording only. No FD, XK, or PE number minted by this document. Prod
**FROZEN**. No new AWS, host, or database contact.
