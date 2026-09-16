| **PRIME STUDIOS** **F-AUTH-1 — GROUP-NAME CASE MISMATCH, ADDENDUM 2: FIX REPRODUCED** *Records that the structural condition `F-AUTH-1_GroupCaseMismatch_MEASURED_2026-09-16.md` measured no longer exists in current code, and that the absence was reproduced end to end. Additive only — the original note and its first addendum are merged and immutable. Rules nothing, mints nothing, edits no filed document.* |
| --- |

**Document version**

v1.0 — **ADDENDUM, NOT A CORRECTION, NOT A DISPOSITION.** Neither the
original note nor its first addendum is retracted, restated as wrong, or
disposed by this document. This addendum adds two facts neither prior
document had: the comparison sites now read differently than the
original's §2 quoted them, and a second end-to-end run — on the fixed
code — reproduces the absence of the original failure.

**Basis:** `origin/main` at `fab882f79a9f098053cae205c52f28535fa7ff42`,
2026-09-16 (post `#1479`, the fix; post `#1472`, `#1474`, cited by the
first addendum).

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
Evoni ran the reproduction herself; this document records her account of
what came back, redacted of tokens per this session's own handling
discipline (§5).

**Status**

**Additive addendum. Records that the measured condition no longer
exists in current code, and one reproduction of that absence, on
Evoni's account of her own run.** No FD, XK, or PE number is minted. No
finding is ruled. Prod remains **FROZEN** — no AWS, host, or database
contact by this document.

---

# §0. Filename date

Derived from the filing date, read the same way the basis (§1) is read:
`date -u +%Y-%m-%d` at the time of filing returned `2026-09-16`, and
`git rev-parse origin/main`'s commit date (§1) is also `2026-09-16` —
the two agree, so the filename carries `2026-09-16` with no
disambiguation needed.

---

# §1. Basis and standings

**Basis SHA:** `origin/main` at `fab882f79a9f098053cae205c52f28535fa7ff42`,
committed 2026-09-16 — the merge of `#1479` (title: "fix(auth): make
group comparison case-insensitive in authorize and requireGroup").

**Standing split, stated once and held throughout:**

- **MEASURED** — §2 (source re-read at this basis), §3 (enumeration
  re-run at this basis), §4 (normalization line quoted at this basis),
  §7 (residue count re-derived from §3), §8 (test-exclusion list
  re-read from `jest.config.js` at this basis). Every MEASURED claim
  below pastes the command and its output; none is carried on trust.
- **ATTESTED** — §5 only. The reproduction was Evoni's own run, not
  performed in this session. This document records her account of it,
  as reported in `#1479`'s own PR description, at the standing the
  original addendum used for its equivalent claim.

---

# §2. The two comparison sites, re-read at this basis

The original note's §2 quoted both sites' pre-fix form as a single
exact-match line each:

```
src/middleware/auth.js:502    if (!req.user.groups || !req.user.groups.some((group) => groups.includes(group))) {
src/middleware/jwtAuth.js:134  if (!req.user.groups || !req.user.groups.some((g) => groups.includes(g))) {
```

Re-read now, both sites (`cat -n`, this basis):

**`src/middleware/auth.js`, lines 489–519** (`authorize`):

```
   489	const authorize = (requiredGroups) => {
   490	  // Handle both single group and array of groups
   491	  const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];
   492	  // Case-insensitive: Cognito group names are values this app doesn't control.
   493	  // Plain toLowerCase() (not toLocaleLowerCase()/localeCompare) -- locale-invariant
   494	  // per spec, avoiding the Turkish-I class of defect on a value containing 'i'.
   495	  const normalizedGroups = groups.map((group) => group.toLowerCase());
   496	
   497	  return (req, res, next) => {
   498	    if (!req.user) {
   499	      return res.status(401).json({
   500	        error: 'Unauthorized',
   501	        message: 'User not authenticated',
   502	        code: 'AUTH_REQUIRED',
   503	      });
   504	    }
   505	
   506	    if (
   507	      !req.user.groups ||
   508	      !req.user.groups.some((group) => normalizedGroups.includes(group.toLowerCase()))
   509	    ) {
   510	      return res.status(403).json({
   511	        error: 'Forbidden',
   512	        message: `User must be in one of these groups: ${groups.join(', ')}`,
   513	        code: 'AUTH_GROUP_REQUIRED',
   514	      });
   515	    }
   516	
   517	    next();
   518	  };
   519	};
```

**`src/middleware/jwtAuth.js`, lines 122–150** (`requireGroup`):

```
   122	const requireGroup = (requiredGroups) => {
   123	  const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];
   124	  // Case-insensitive: Cognito group names are values this app doesn't control.
   125	  // Plain toLowerCase() (not toLocaleLowerCase()/localeCompare) -- locale-invariant
   126	  // per spec, avoiding the Turkish-I class of defect on a value containing 'i'.
   127	  const normalizedGroups = groups.map((group) => group.toLowerCase());
   128	
   129	  return (req, res, next) => {
   130	    if (!req.user) {
   131	      return res.status(401).json({
   132	        error: 'Unauthorized',
   133	        message: 'User not authenticated',
   134	        code: 'AUTH_REQUIRED',
   135	      });
   136	    }
   137	
   138	    if (
   139	      !req.user.groups ||
   140	      !req.user.groups.some((g) => normalizedGroups.includes(g.toLowerCase()))
   141	    ) {
   142	      return res.status(403).json({
   143	        error: 'Forbidden',
   144	        message: `User must be in one of these groups: ${groups.join(', ')}`,
   145	        code: 'AUTH_GROUP_REQUIRED',
   146	      });
   147	    }
   148	
   149	    next();
   150	  };
```

**The drift, named explicitly:** the original's single-line exact-match
comparison (`groups.includes(group)` / `groups.includes(g)`, no
normalization either side) is gone from both files. In its place, both
functions now build a `normalizedGroups` array via `.toLowerCase()`
ahead of the closure (line 495 / line 127), and the membership check
itself lowercases the candidate group on the way in
(`normalizedGroups.includes(group.toLowerCase())` /
`normalizedGroups.includes(g.toLowerCase())`, line 508 / line 140). The
line numbers shifted (502→508, 134→140) because the normalization lines
were inserted above the closure in both files. The 401/403 branches,
status codes, and error payloads are byte-identical to the original's
quoted form; only the comparison itself changed.

---

# §3. Enumeration re-run, not carried

The original note's §3 and `#1479`'s description both state 51 call
sites resolving to exactly two literal strings. Re-run at this basis
rather than carried:

```
$ grep -rnE "authorize(Role)?\(\s*\[?['\"]" src/ --include="*.js" | grep -v "src/middleware/auth.js" | grep -oE "authorize(Role)?\(\[?'[A-Za-z]+'\]?\)" | sort | uniq -c
     35 authorize(['ADMIN'])
      2 authorize(['admin'])
     11 authorizeRole(['admin'])

$ grep -rnE "requireGroup\(\s*\[?['\"]" src/ --include="*.js" | grep -oE "requireGroup\(\[?'[A-Za-z]+'\]?\)" | sort | uniq -c
      3 requireGroup('ADMIN')
```

35 + 2 + 11 + 3 = **51**, matching the original count. Exactly two
literal strings appear across all 51 — `'ADMIN'` and `'admin'` — and
both fold to `admin` under `.toLowerCase()`.

No call site references `editor` or `viewer` in any casing, re-checked
directly rather than inferred from the two-string enumeration above:

```
$ grep -rniE "(authorize(Role)?|requireGroup)\([^)]*['\"](editor|viewer)['\"]" src/ --include="*.js"
(no output — exit 1)
```

---

# §4. The normalization choice, quoted from source

Plain `.toLowerCase()`, not `.toLocaleLowerCase()` or `localeCompare`
without an explicit locale. Quoted directly from both files (identical
text in each, `auth.js:492–495` and `jwtAuth.js:124–127`):

```js
// Case-insensitive: Cognito group names are values this app doesn't control.
// Plain toLowerCase() (not toLocaleLowerCase()/localeCompare) -- locale-invariant
// per spec, avoiding the Turkish-I class of defect on a value containing 'i'.
const normalizedGroups = groups.map((group) => group.toLowerCase());
```

The reason, as the source states it: `admin` contains an `i`, and
`.toLocaleLowerCase()`/`localeCompare` without an explicit locale
consult OS/ICU locale data — the exact surface where the Turkish-I
defect class lives (`'I'.toLocaleLowerCase('tr')` folds to `ı`, not
ASCII `i`, under a Turkish locale). Plain `.toLowerCase()` implements
Unicode default case-folding per spec, independent of locale by
construction, so it cannot exhibit that defect regardless of the host's
configured locale.

---

# §5. The reproduction, ATTESTED — Evoni's own run

Recorded from Evoni's account of her run against the fixed code, as
reported in `#1479`'s own PR description (the same account the fix PR
itself cites):

> `PUT /api/v1/assets/:id/approve` with a real admin token that
> previously returned `403 AUTH_GROUP_REQUIRED` now returns `500`,
> `"connect ECONNREFUSED 127.0.0.1:55432"`.

Same route, same class of admin token, as the first addendum's §1 step
4 (which returned `403 AUTH_GROUP_REQUIRED` before the fix). No token,
credential, or other field value from that run is reproduced here
beyond the status codes and error string already disclosed in the
merged PR description.

**What this proves:** authorization cleared. The request reached the
route handler — `authorize(['ADMIN'])` at this site let the same
admin-group membership through that it denied before `#1479` — and the
`500` originates downstream of the authorization check, in the route
handler's own database call.

**What this does not prove:** the endpoint was not exercised end to
end, and no database was reachable to actually process the approval.
This reproduction establishes that the authorization layer no longer
produces the original's failure mode; it says nothing about whether
`PUT /api/v1/assets/:id/approve` completes correctly once a database is
reachable.

---

# §6. Current-code-state clause

**The condition the original note recorded no longer exists in current
code.** The original note itself is unchanged and remains correct as a
record of what was true at its own basis (`237da78408b2ed…`,
2026-09-16, pre-fix).

This document does not write that the original note is **"closed."**
That word choice is deliberate, not an oversight: the original note
minted no FD, XK, or PE, and disposed of nothing — it was, by its own
§6, "Recording only." A document that mints and disposes nothing has no
open/closed state for a later document to move. What changed is the
code the note described, not the note's own standing in the register.

---

# §7. Residue

`#1479` changed the comparison, not the call sites: "No call site
changed — all 51 literal strings stay as they are." The 38 sites
enumerated at §3 (35 `authorize(['ADMIN'])`/`authorizeRole(['ADMIN'])`
+ 3 `requireGroup('ADMIN')`) still pass a string, `'ADMIN'`, naming a
group that does not exist in the pool measured by the original note's
§1 (`admin`, `editor`, `viewer` — all lowercase, no uppercase variant).

The fix makes this **harmless, not correct.** `.toLowerCase()` folds
`'ADMIN'` and `'admin'` to the same value before comparison, so the
38 sites' wrong literal no longer matters operationally — but the
literal itself is still wrong on its face. If the normalization at
`auth.js:495`/`508` or `jwtAuth.js:127`/`140` is later removed, or a
third comparison site is written that checks `req.user.groups` against
these same 38 sites' literals without equivalent normalization, all 38
become live again, in the same failure mode the original note recorded.

---

# §8. What the fix does not settle

**The FD-70 mint question** — named next-available and unminted by the
original note's §5, untouched by both that note, its first addendum,
and this second addendum. Whether the measured-then-reproduced-then-
reproduced-fixed condition warrants an FD mint remains Evoni's ruling,
not made here.

**The test-coverage caveat**, re-read from `jest.config.js` at this
basis: `testPathIgnorePatterns` drops `notification.test.js`,
`presence.test.js`, and `socket.test.js` repo-wide (not
environment-specific — the same list applies wherever this Jest config
runs), and those three files hold 8 of the 13 already-correct call
sites named at the original note's §3 (`notificationController.js`'s 1
+ `presenceController.js`'s 1 + `socketController.js`'s 6 = 8). The
claim that all 13 already-correct sites are unaffected by `#1479`'s
change rests on the §3 enumeration (all 13 pass `'admin'`, which
case-folds to a no-op under the new comparison) plus
`tests/unit/controllers/activity.test.js`'s 3 covered sites
(`activityController.js`) — not on full test coverage of the 13.

---

# §9. Closing

This addendum mints no FD, XK, or PE number. It rules nothing. It
recommends nothing further. It does not dispose of
`F-AUTH-1_GroupCaseMismatch_MEASURED_2026-09-16.md` or its first
addendum, both of which remain filed, unchanged, and correct as records
of what was true at their own basis. Prod **FROZEN**. No AWS, host, or
database contact by this document.
