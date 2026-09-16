| **PRIME STUDIOS** **F-AUTH-1 — FD-65'S HALVES AND THE TIER 5 CARRIER'S CURRENT MECHANISM, READ** *Two records, both repo-derived. Mints nothing. Rules nothing. Both feed rulings that are Evoni's.* |
| --- |

**Document version**

v1.0 — **READ ONLY.** Files what `docs/audit/F-AUTH-1_Fix_Plan_v2.49.md`,
`v2.50.md`, and `v2.67.md` say about FD-65's two halves, in their own words
with line numbers; and what `docs/audit/F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md`'s
Shape A ruling rests on, checked clause-by-clause against the carrier's
current source. **Mints no FD, XK, or PE. Rules nothing — both open
questions this document surfaces are named at §5 and left to Evoni.**

**Basis:** `origin/main` at `1367e4a1581d5ce0ed6866ec928eb03b01d8da12`,
2026-09-15 (`git log -1 --format='%H %ad' --date=iso-strict
1367e4a1581d5ce0ed6866ec928eb03b01d8da12` → `2026-09-15T21:06:52-04:00`
— the commit's own date, not this document's filing date). All reads
local git against that commit, plus one local `frontend` production
build (no host, AWS, database, or Cognito contact).

**Filing date:** `date -u +%Y-%m-%d` → `2026-09-16`, read at filing time
in the same session as the basis SHA above. Filename dated 2026-09-16
accordingly, per the register's convention that a note's filename carries
when it was filed, not when the facts inside it were established
(`F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md` states the same
convention for the same one-day gap). The gap here is not a midnight-UTC
crossing — `1367e4a1` was itself committed 2026-09-15; this session ran
past that date into the next.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Standalone read, filed per issue #1461, carrying forward issue #1460's
session report so it exists as a repo artifact rather than only a chat
transcript.** Every command below was re-run fresh at this document's own
basis — none of #1460's pasted output is carried forward as if
re-verified here. No FD, XK, or PE is minted. Prod **FROZEN**.

---

# §1. Which revision supplies FD-65's text, which merely restate it

Per `v25_Owed_Index_Amd8_2026-08-27.md` §H4's supplied-at / last-restated
distinction — MEASURED:

```
$ grep -rn "FD-65" docs/audit/F-AUTH-1_Fix_Plan_v2.4*.md docs/audit/F-AUTH-1_Fix_Plan_v2.5*.md | wc -l
76
```

**`v2.49` supplies FD-65's text.** Its own document-version line (line 6):
*"v2.49 — MINTS FD-65 (F-AUTH-1). P0. SHIPS NO CODE."* §1 (line 18–20):
*"FD-65 (F-AUTH-1) — P0. The authentication surface issues signed tokens to
unauthenticated callers, and lets those callers specify their own
privileges."* Every other file in the `v2.4*`/`v2.5*` glob (`v2.50`
through `v2.59`) only restates FD-65's status (*"FD-65 remains OPEN and
P0"*, *"FD-65 — OPEN, P0"*, etc.) — none re-derives the finding or its
two-halves partition. RULED, cited from v2.49, not re-derived by this
document.

**The `v2.4*`/`v2.5*` glob is not where FD-65's family ends.** MEASURED:

```
$ grep -rln "FD-65" docs/audit/F-AUTH-1_Fix_Plan_v2.6*.md
docs/audit/F-AUTH-1_Fix_Plan_v2.60.md
docs/audit/F-AUTH-1_Fix_Plan_v2.61.md
docs/audit/F-AUTH-1_Fix_Plan_v2.67.md
docs/audit/F-AUTH-1_Fix_Plan_v2.69.md
docs/audit/F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md
```

`v2.67` — outside a `v2.4*`/`v2.5*`-only search — is the revision that
closes FD-65 (§2 below).

## §1.1 The two halves, quoted from v2.49 §1 — RULED, quoted not paraphrased

```
$ sed -n '18,29p' docs/audit/F-AUTH-1_Fix_Plan_v2.49.md
```

Lines 24–27:

> **The finding has two halves and they require separate remedies.**
>
> - **Issuance.** Neither endpoint verifies a credential. There is no
>   database lookup, no password comparison, no Cognito call. `POST
>   /login`'s own comment at `:54` states the design: *"For development:
>   accept any password (in production, verify against Cognito)."* The
>   integration is absent.
> - **Privilege.** Both endpoints read `groups` and `role` from the caller
>   and sign them into the token unmodified.

---

# §2. What v2.50 closed, in its own words — and what v2.67 closed

## §2.1 v2.50 — RULED, quoted, MEASURED line numbers

```
$ grep -n "closes nothing\|does not close\|Does not close" docs/audit/F-AUTH-1_Fix_Plan_v2.50.md
6:v2.50 — ... The authorization is bounded at §1 and closes nothing. ...
35:> This authorization does not close FD-65, and no closure revision may cite it as having done so.
157:- A declared-partial remediation of FD-65 is authorized, bounded by §1's table, and by a scope statement that closes nothing.
173:- Does not close, downgrade, or reprioritise FD-65, and forbids a closure revision from doing so on this authorization's basis (§1).
```

**v2.50's own words close nothing — not FD-65 entire, not one half.** Not
ambiguous; explicit and repeated across the document-version line, a
blockquote at §1, and two summary bullets at §10/§11. v2.50 only
*authorizes* a code change (removal of caller-supplied `groups`/`role`
from `/login`, deletion of `/test-token`) that PR #1044/`75ac05f0` later
shipped.

## §2.2 v2.67 — RULED, quoted whole where it matters, MEASURED line numbers

```
$ cat -n docs/audit/F-AUTH-1_Fix_Plan_v2.67.md
```

Document-version line (lines 6–10):

> v2.67 — **CLOSES FD-65.** Its privilege half was closed at v2.50
> (`75ac05f0`). Its issuance half is closed here as **CLOSED-BY-REMOVAL**,
> not as CLOSED, with a reactivation condition attached. `POST
> /api/v1/auth/login` returns `401 AUTH_LOGIN_DISABLED` unconditionally on
> `main` (`e5215a66`) and on the production host.

§3, the ruling itself (line 66):

> **Ruling: FD-65's issuance half is CLOSED-BY-REMOVAL. FD-65 is closed.**

§3 continues (lines 74–76), on why "CLOSED" alone was rejected:

> **"CLOSED" is nevertheless the wrong word.** It ordinarily means the
> system now does correctly what it was doing incorrectly. **Here it does
> nothing.** A plain CLOSED would assert a verification contract that does
> not exist.

**§4, the reactivation condition, quoted in full (lines 90–105):**

> **If `POST /api/v1/auth/login` is re-enabled in any form, FD-65's
> issuance half reopens as a precondition of that work, not as a
> discovery after it.**
>
> The re-enabling instrument must state, before the route serves again:
>
> 1. what verifies the credential;
> 2. what the token carries, and that it is not caller-supplied; and
> 3. how both are tested — the assertions skipped at
>    `tests/integration/f-auth-1-fd65.test.js` behind `LOGIN_DISABLED` are
>    restored by setting that constant to `false`, and they must pass.
>
> This condition is carried in three places so it cannot be missed from
> any of them: here; in the handler comment at `src/routes/auth.js`; and
> in the named `LOGIN_DISABLED` constant in the test file.

---

# §3. When the issuance half was described as open — MEASURED, dated

```
$ grep -rln "issuance half" docs/audit/
```
16 files. Each dated by git file-creation date (`git log --diff-filter=A
--format=%ad --date=short -- <file> | tail -1`), MEASURED, re-run fresh
at this document's basis:

| Date | Document |
|---|---|
| 2026-08-17 | `F-AUTH-1_Fix_Plan_v2.49.md` |
| 2026-08-18 | `F-AUTH-1_Fix_Plan_v2.52.md` |
| 2026-08-18 | `F-AUTH-1_Fix_Plan_v2.53.md` |
| 2026-08-18 | `F-AUTH-1_Fix_Plan_v2.54.md` |
| 2026-08-18 | `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` |
| 2026-08-20 | `F-AUTH-1_Fix_Plan_v2.56.md` |
| 2026-08-22 | `F-AUTH-1_Fix_Plan_v2.58.md` |
| 2026-08-22 | `F-AUTH-1_Fix_Plan_v2.67.md` |
| 2026-08-22 | `FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md` |
| 2026-08-22 | `Prime_Studios_Audit_Handoff_v24.md` |
| 2026-08-22 | `Production_State_Provenance_2026-08-22_DRAFT.md` |
| 2026-09-05 | `F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md` |
| 2026-09-11 | `F-AUTH-1_v272_Ruling_Prep_2026-09-11.md` |
| 2026-09-14 | `F-AUTH-1_LoginHandler_UnreachableRegion_Read_2026-09-14.md` |
| 2026-09-14 | `F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md` — filename date is the 15th; git commit date is the 14th. Recorded as a discrepancy; not investigated further here. |
| 2026-09-15 | `F-AUTH-1_JWTAuth_Cognito_Claim_Finding_2026-09-15.md` |

**Earliest: `v2.49` itself, 2026-08-17** — the minting document uses the
phrase at its own origin.

---

# §4. Dating `PROJECT_CONTEXT.md`'s keystone line — MEASURED

```
$ git log -S "FD-65 and FD-68 CLOSED" --oneline -- PROJECT_CONTEXT.md
1367e4a15 docs(context): refresh for PRs #1449, #1452, #1457 [skip-automerge] (#1459)
a87ac4a35 docs(context): re-derive limb 1 and owed-list status [skip-automerge] (#1197)
3babe6904 docs(project): add project context, phone-first workflow, and Claude guardrails [skip-automerge] (#1169)
```

```
$ git log -1 --format='%H %ad %s' --date=short 3babe6904
3babe69043cd21fef3f2537c89290b2135f77de4 2026-09-01 docs(project): add project context, phone-first workflow, and Claude guardrails [skip-automerge] (#1169)
```

**The line was first introduced 2026-09-01.** This postdates both the
earliest "issuance half" document (`v2.49`, 2026-08-17, §3 above) and the
closure ruling itself (`v2.67`, 2026-08-22, §2.2 above). **Stated, not
resolved:** at its own origin, the "CLOSED" claim was citing an
already-approved qualified-closure ruling — it does not predate or
contradict an earlier document. Whether it remains accurate at this
document's own basis is addressed at §5.

---

# §5. What changed since v2.67, stated as fact — not a ruling

**PR #1457 (Task #1456) re-enabled `POST /api/v1/auth/login` on
2026-09-15** — the event `v2.67` §4 (quoted in full at §2.2 above) names
as the trigger for its own reactivation condition. `v2.67` §4 names three
preconditions for the re-enabling instrument. Checked fresh, MEASURED,
against this document's own basis:

1. **"what verifies the credential"** — `src/routes/auth.js`'s `/login`
   handler now calls `cognitoPasswordAuthService.initiatePasswordAuth`,
   which performs a real Cognito `InitiateAuth` (`USER_PASSWORD_AUTH`)
   exchange. Present.
2. **"what the token carries, and that it is not caller-supplied"** — the
   handler's success response is built from the id token's own claims
   (`id`, `email`, `name`, `groups`), not from the request body; the
   handler destructures only `{ email, password }` from `req.body`.
   Present.
3. **"how both are tested — the assertions skipped at
   `tests/integration/f-auth-1-fd65.test.js` behind `LOGIN_DISABLED` are
   restored by setting that constant to `false`, and they must pass"** —
   checked fresh:
   ```
   $ grep -n "LOGIN_DISABLED" tests/integration/f-auth-1-fd65.test.js
   72:const LOGIN_DISABLED = true;
   73:const describeLogin = LOGIN_DISABLED ? describe.skip : describe;
   74:const testLogin = LOGIN_DISABLED ? test.skip : test;
   ```
   **`LOGIN_DISABLED` is `true` at this basis.** The assertions §4's third
   precondition names remain skipped. **Not present.**

**This document does not state whether FD-65's issuance half is therefore
open or closed, and does not state whether `PROJECT_CONTEXT.md`'s
keystone line needs correcting.** `v2.67` §4 states the condition under
which reopening occurs; whether that condition has been met in full, in
part, or not at all in the sense that matters is Evoni's determination,
not this document's.

---

# §6. The Tier 5 carrier's Shape A ruling — premises against current code

## §6.1 The ruling's eight clauses, quoted — RULED, MEASURED line numbers

```
$ grep -n "^> [0-9]\." docs/audit/F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md
111:> 1. A dev-server-only route is permitted...
114:> 2. It is a CARRIER, not a SOURCE...
118:> 3. Therefore it does not touch FD-65...
124:> 4. Gate: the route must not exist in a production build...
129:> 5. Not in frontend/public/...
132:> 6. Scope: local development and LAN access...
136:> 7. Token lifetime...
142:> 8. URL exposure...
```

§3 (lines 109–147), *"Approved by Evoni, transcribed verbatim. No word
altered"*:

> 2. It is a CARRIER, not a SOURCE. It mints nothing, calls no backend
>    endpoint, and creates no new way to obtain a token. The token is
>    minted out of band on the laptop via tokenService and carried in.
>
> 3. Therefore it does not touch FD-65. POST /api/v1/auth/login continues
>    to return 401 AUTH_LOGIN_DISABLED unconditionally, on every
>    environment, unchanged. This ruling does not reopen FD-65 and does
>    not authorize a backend dev-only token endpoint (Shape C), which
>    remains unruled.
>
> 4. Gate: the route must not exist in a production build. ... it must be
>    fail-closed — if the gate cannot be evaluated, the route is absent.
>
> 5. Not in frontend/public/. ...
>
> 6. Scope: local development and LAN access to a laptop dev server only.
>    ... the token carried must be minted under a local-only JWT_SECRET.
>
> 7. Token lifetime. tokenService reads JWT_EXPIRY from env at mint time
>    (default 1h). ...
>
> 8. URL exposure. The token is carried in the URL fragment, ...

§2 (lines 84–98) independently confirms clause 3's premise at the
ruling's own basis (2026-09-05), citing `v2.67` by name:

> Confirms clause 3: `/login` still returns `401 AUTH_LOGIN_DISABLED`
> unconditionally — the return fires before any environment check, in
> every environment — unchanged since `F-AUTH-1_Fix_Plan_v2.67.md` closed
> FD-65's issuance half as CLOSED-BY-REMOVAL.

## §6.2 The carrier's current implementation — MEASURED

```
$ grep -rn "dev-token-carrier" --include='*.jsx' --include='*.js' frontend/src/ src/
frontend/src/App.jsx:32:const PRE_AUTH_PATHS = ['/login', '/', ...(import.meta.env.DEV ? ['/__dev-token-carrier'] : [])];
frontend/src/App.jsx:280:            path="/__dev-token-carrier"
```

`frontend/src/App.jsx:23-25`: `DevTokenCarrier` is only imported via
`import.meta.env.DEV ? lazy(() => import('./pages/DevTokenCarrier')) :
null`. `App.jsx:277-286`: the route is only mounted inside
`{import.meta.env.DEV && (...)}`.

`frontend/src/pages/DevTokenCarrier.jsx`, whole file (34 lines):

```
14  const hash = window.location.hash.replace(/^#/, '');
15  const params = new URLSearchParams(hash);
16  const authToken = params.get('authToken');
17  const refreshToken = params.get('refreshToken');
18  const user = params.get('user');
...
25  localStorage.setItem('authToken', authToken);
26  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
27  if (user) localStorage.setItem('user', user);
```

No `fetch`, `axios`, or any backend call anywhere in the file.

**Gate, independently verified with a fresh production build — not the
code comment's own claim alone:**

```
$ cd frontend && npx vite build
✓ built in 17.03s
$ grep -rl "dev-token-carrier\|DevTokenCarrier" dist/
(no output, exit 1 — zero matches)
```

`PRE_AUTH_PATHS` (`App.jsx:32`) still exempts `/__dev-token-carrier`,
still gated the same way. `src/services/tokenService.js:32` (clause 7's
premise): `type === 'refresh' ? process.env.JWT_REFRESH_EXPIRY || '7d' :
process.env.JWT_EXPIRY || '1h';` — present, unchanged.
`frontend/public/` (clause 5's premise): `find frontend/public -iname
"*dev-token*" -o -iname "*DevTokenCarrier*"` returns no output.

## §6.3 Premise-by-premise disposition

| Premise (clause) | Disposition |
|---|---|
| 2 — carrier not source, no backend call, no new minting path | **Confirmed** — no `fetch`/`axios` call anywhere in `DevTokenCarrier.jsx` |
| 3 — `/login` returns 401 unconditionally; ruling does not touch FD-65 | **Contradicted** — `/login` no longer returns 401 unconditionally as of PR #1457 (§5 above) |
| 4 — fail-closed gate, absent from production build | **Confirmed**, independently re-verified with a fresh `vite build` |
| 5 — not in `frontend/public/` | **Confirmed** |
| 6 — local/LAN scope; local-only `JWT_SECRET` for the minted token | **Cannot-tell** — the component's own code has no way to check or enforce what secret minted the token it is handed; that is an operator choice outside this file |
| 7 — lifetime via `JWT_EXPIRY` at mint time | **Confirmed** |
| 8 — carried in URL fragment | **Confirmed** — `window.location.hash`, not query string |

**This document does not state whether Shape A still holds, in whole or
in part, given clause 3's contradiction. That is Evoni's.**

---

# §7. Tails

This document mints no FD, XK, or PE. It does not touch the FD-70, XK-4,
or PE-tail sequence at all — no new finding, cross-keystone entry, or
roster entry is proposed anywhere above. Not re-derived, since nothing
here bears on it.

---

# §8. This document does not

- **Rule** whether FD-65's issuance half is open or closed at this basis.
  §5 states which of `v2.67` §4's three named preconditions the current
  repo state satisfies and which it does not; it does not draw a
  conclusion from that.
- **Rule** whether `PROJECT_CONTEXT.md`'s keystone line needs correcting.
- **Rule** whether the Tier 5 carrier's Shape A ruling, or its clause 3
  specifically, needs a new revision.
- **Mint** any FD, XK, or PE.
- **Edit** any existing file — `v2.49`, `v2.50`, `v2.67`, the Tier 5
  ruling, `PROJECT_CONTEXT.md`, and every other filed document stay
  exactly as they are.
- **Contact** any host, AWS, database, or Cognito. The one build performed
  (§6.2) is local `vite build` tooling only.

---

*Type: standalone read, filed per issue #1461. Rules nothing — both open
questions (FD-65's current standing per §5; the Tier 5 carrier's clause 3
per §6.3) are named and left to Evoni. Mints nothing — no FD-70, no XK-4,
no PE. Host/AWS/DB/Cognito contact: none. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date filed: 2026-09-16. Basis: `origin/main` at
`1367e4a1581d5ce0ed6866ec928eb03b01d8da12`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.49.md`, `v2.50.md`, `v2.67.md`,
`F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md` — RULED, cited, not
re-derived. All grep/git/build commands above — MEASURED, this document's
own reads.*
