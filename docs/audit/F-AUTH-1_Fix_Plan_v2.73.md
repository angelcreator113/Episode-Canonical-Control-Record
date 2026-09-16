| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Reopens FD-65's issuance half on the trigger `v2.67` §4 itself named. Supersedes `v2.67`'s CLOSED-BY-REMOVAL standing. Establishes a two-stage discharge/closure path. Mints no new numbers.* |
| --- |

**Document version**

**v2.73 — FIX PLAN REVISION. Mints no new numbers. Reopens FD-65's
issuance half, supersedes `v2.67`'s CLOSED-BY-REMOVAL standing, and
establishes the path to its discharge and closure.** This document lands
Evoni's ruling — drafted in this session, reviewed clause by clause
against the primary sources by Evoni, and confirmed by her as her ruling
— transcribed verbatim below; see §3 for the provenance note in full.

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.72.md`. **v2.72's rulings stand and
are not re-ruled here** — the FD-68/FD-65 severity-interaction
adjudication and FD-67's closure (§3), and Limb 3 Dimension 5's
`MEASURED-ABSENT` status (§4). This document rules one separate matter:
FD-65's issuance half's standing following `PR #1457`'s 2026-09-15
reactivation of `POST /api/v1/auth/login`. **What v2.73 supersedes:**
`v2.67` §3's CLOSED-BY-REMOVAL standing for FD-65's issuance half — the
premise that standing rested on (*"the route issues nothing"*) no longer
holds. **What stands unchanged:** `v2.67`'s privilege-half closure
(CLOSED on the merits at `v2.50`, `75ac05f0`), limb 1's discharge
(`v2.69` §6 Ruling 1), FD-64's closure (Ruling 2), PE #65's closure
(Ruling 4), `v2.70`'s itemization-deltas ruling, `v2.71`'s
unwired-models ruling, and `v2.72`'s FD-67 closure and Dimension 5
ruling — none of these is re-ruled or touched here.

**Basis:** `origin/main` at `e01d6faf6cb17a8e660e8d0866cc6bb12ebcc793`,
2026-09-15 (`git rev-parse origin/main`; `git log -1 --format='%ad'
--date=iso-strict origin/main` → `2026-09-15T23:29:10-04:00`).

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -3
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.70.md
F-AUTH-1_Fix_Plan_v2.71.md
F-AUTH-1_Fix_Plan_v2.72.md

$ grep -n "^### XK-" docs/audit/Cross_Keystone_Register.md | tail -1
288:### XK-3 — no authorization substrate for the tenancy root

$ grep -n "^### PE #" docs/audit/Session_PE_Roster.md | sort -t# -k2 -n | tail -1
2146:### PE #68 — an agent harness injects a git credential that authorizes write to this repository...
```

Both instruments agree: global FD tail is **FD-69** (retired); **FD-70
remains next-available and unminted**, unchanged by this document. XK
tail **XK-3**. PE tail **PE #68**. All three unchanged from `v2.72`'s own
re-derivation.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Ruling by Evoni** — drafted in session, reviewed clause by clause
against the primary sources by her, confirmed as her ruling — transcribed
verbatim below; see §3.

**Status**

**Revision. Rules one matter, on Evoni's word.** FD-65's issuance half is
**REOPENED**, effective 2026-09-15, on the trigger `v2.67` §4 itself
named: `PR #1457` re-enabled `POST /api/v1/auth/login`. Closure now
proceeds in two stages — **discharge** by `v2.67` §4's three
preconditions (two **MET**, one **NOT MET** and not a one-line fix — see
§3), then **closure** by live verification against the real Cognito
pool, per Evoni's 2026-09-14 ruling (c), unchanged. `v2.67`'s
CLOSED-BY-REMOVAL standing for the issuance half is **superseded**. The
privilege half remains **CLOSED** on the merits, unaffected.

Limb 1 remains **DISCHARGED**. FD tail remains **FD-69** (retired; FD-70
next-available, unminted); XK tail **XK-3**; PE tail **PE #68**. Prod
**FROZEN**.

---

# §1. What was open, and the trigger that closed the gap

`F-AUTH-1_Fix_Plan_v2.67.md` §3 closed FD-65's issuance half as
**CLOSED-BY-REMOVAL**, not CLOSED, precisely because the route was
disabled rather than repaired:

> *"The finding's claim is now false. It held that unauthenticated
> callers obtain signed tokens from `/login`. They do not; the route
> issues nothing."*

§4 attached a reactivation condition, verbatim:

> *"If `POST /api/v1/auth/login` is re-enabled in any form, FD-65's
> issuance half reopens as a precondition of that work, not as a
> discovery after it."*

and named three preconditions the re-enabling instrument must satisfy
before the route serves again: (1) what verifies the credential; (2)
what the token carries, and that it is not caller-supplied; (3) how both
are tested — restoring the assertions gated by `LOGIN_DISABLED` in
`tests/integration/f-auth-1-fd65.test.js`.

`Task #1456` / `PR #1457` (merged `a37174b48`, 2026-09-15) implemented a
real Cognito `InitiateAuth` exchange at `POST /api/v1/auth/login`. That
is the trigger `v2.67` §4 named. The route no longer issues nothing —
`v2.67` §3's own stated premise for CLOSED-BY-REMOVAL is false as of
this commit.

---

# §2. Evidence this revision cites

**Verified present at this basis; cited, not restated as this document's
own findings, except where marked freshly re-checked.**

1. **`F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` §5**
   (merged this basis) — checks `v2.67` §4's three preconditions fresh
   against the repo: precondition 1 (credential verification) Present;
   precondition 2 (token not caller-supplied) Present; precondition 3
   (`LOGIN_DISABLED` restored to `false`, assertions passing) Not
   present. That document explicitly declines to state what follows;
   this revision states it.

2. **`src/routes/auth.js`'s current handler comment** (re-checked fresh
   at this basis):

   ```
   $ sed -n '87,94p' src/routes/auth.js
   ```
   ```
    * Per F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md and
    * F-AUTH-1_LoginHandler_UnreachableRegion_Read_2026-09-14.md, Evoni ruled
    * on 2026-09-14 (a) the fix-cycle scope restriction is waived for
    * password-login implementation, (b) the local HS256 token family is
    * narrowed to a controlled internal flow and must not remain the issuance
    * path for user login, and (c) FD-65's issuance half closes on live
    * verification against the real Cognito pool, not on implementation. This
    * handler implements ruling (b); it does not, and cannot, discharge (c).
   ```

   The implementing PR's own comment already states it does not close
   the issuance half — this revision's ruling agrees with, and does not
   contradict, the code it is ruling on.

3. **`tests/integration/f-auth-1-fd65.test.js`'s current header comment
   on `LOGIN_DISABLED`** (re-checked fresh at this basis):

   ```
   $ sed -n '56,65p' tests/integration/f-auth-1-fd65.test.js
   ```
   ```
    // LOGIN_DISABLED, despite its name, no longer means "/login is disabled" —
    // it now gates only whether THIS FILE exercises /login's response over a
    // real signature-verified HTTP round trip. That still doesn't happen here:
    // this file's mock (above) never returns a token shaped so that auth.js's
    // verifier would accept it (a genuine Cognito access token is RS256, signed
    // by Cognito's own key, which this file cannot fabricate without live
    // Cognito contact), so the assertions gated by LOGIN_DISABLED remain
    // skipped, unchanged from before this PR. Re-enabling them is separate work:
    // deciding how (or whether) to fabricate an acceptable token for this
    // specific end-to-end check without contacting Cognito.
   ```

   Precondition 3 is not "flip `LOGIN_DISABLED` to `false`." The file's
   own comment states that flipping it would not make the gated
   assertions pass, because the mock cannot produce a token
   `src/middleware/auth.js`'s real verifier would accept — a design
   decision (how, or whether, to fabricate an acceptable token without
   live Cognito contact) precedes the flip.

4. **`F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md`** — carries
   Evoni's three 2026-09-14 rulings verbatim, including ruling (c),
   quoted in full at §2 above via the code comment that cites it.

---

# §3. The ruling

**Provenance, per the same disclosure test `F-AUTH-1_Fix_Plan_v2.69.md`
Ruling 1 and the Shape A ruling's own note both apply.** The wording
below was drafted in this session's conversation, not composed by Evoni
from a blank page. It is her ruling because of what happened next:
Evoni reviewed the drafted wording clause by clause against the primary
sources this document cites at §1–§2 — `v2.67`'s own text, the current
codebase, the cited read documents — corrected one point of framing
before accepting it, and confirmed the result as her ruling.
Approval-after-clause-by-clause-verification is a different disclosure
than approval of an assembled text taken on faith, and this document
does not claim the latter. Transcribed verbatim below; no word altered
from what she confirmed.

> **Ruling (Evoni, 2026-09-16).** FD-65's issuance half is **REOPENED**,
> effective 2026-09-15, on the trigger `v2.67` §4 names: `POST
> /api/v1/auth/login` was re-enabled by PR #1457. This records the
> reopening that `v2.67` made automatic on the trigger; it is not a
> judgment that it should reopen.
>
> Closure proceeds in two stages, on the register's existing
> DISCHARGED-then-closed distinction rather than a new one.
>
> **Discharge** is by `v2.67` §4's three preconditions. Preconditions 1
> and 2 are **MET**, confirmed at
> `F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` §5: the
> handler performs a real Cognito `InitiateAuth` exchange, and its
> response is built from the id token's claims, never from the request
> body. Precondition 3 is **NOT MET** and is not a one-line change:
> `LOGIN_DISABLED` remains `true` in
> `tests/integration/f-auth-1-fd65.test.js`, and that file's own comment
> records why flipping it would not make the assertions pass — its mock
> cannot produce a token that `src/middleware/auth.js`'s verifier
> accepts, and deciding how or whether to fabricate one without live
> Cognito contact is unscoped work. Discharging precondition 3 therefore
> requires that design decision first, then the flip, then the
> assertions passing.
>
> **Closure** is by live verification against the real Cognito pool, per
> my ruling (c) of 2026-09-14, which stands unchanged. Discharge of
> `v2.67`'s preconditions does not close the issuance half; it
> establishes that the code is shaped correctly. Only exercising it
> against the real pool closes it, and no agent session performs that.
>
> `v2.67`'s CLOSED-BY-REMOVAL standing is superseded as of 2026-09-15 —
> the removal it rested on no longer holds. The privilege half remains
> CLOSED on the merits, unaffected.

---

# §4. What this revision does not do

- **Does not perform the live-pool verification** that closes the
  issuance half. That is Evoni-gated — host, AWS, and Cognito contact —
  and no agent session performs it, per the ruling's own last sentence
  of its third paragraph.
- **Does not scope precondition 3's design task** (how, or whether, to
  fabricate a Cognito-acceptable token for
  `tests/integration/f-auth-1-fd65.test.js` without live Cognito
  contact). Names it as unscoped work, per §2 item 3 and the ruling's
  own second paragraph; does not decide it.
- **Does not re-rule `v2.67`'s privilege-half closure**, which stands
  CLOSED on the merits, unaffected.
- **Does not re-rule any of `v2.69`'s, `v2.70`'s, `v2.71`'s, or
  `v2.72`'s rulings.** All stand as those revisions left them.
- **Does not mint** an FD, XK, or PE number.
- **Does not edit** `v2.67`, `src/routes/auth.js`,
  `tests/integration/f-auth-1-fd65.test.js`, `PROJECT_CONTEXT.md`, or any
  other filed document or source file. All stay as they are; whether and
  how `PROJECT_CONTEXT.md`'s F-AUTH-1 row should be refreshed against
  this revision is left to a separate pass, the same way past revisions
  have left that refresh to a following task.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: finding-reopening and standing-supersession, by qualified
disposition. Reopens FD-65's issuance half; supersedes `v2.67`'s
CLOSED-BY-REMOVAL standing; establishes a two-stage discharge/closure
path. Mints nothing. No host, AWS, database, or Cognito contact by this
revision. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Filing date: 2026-09-16. Basis: `origin/main` at
`e01d6faf6cb17a8e660e8d0866cc6bb12ebcc793`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.67.md` §§3–4 (cited, not re-derived
except where marked fresh above), Evoni's ruling at §3 (ATTESTED — drafted
in session, reviewed clause by clause against the primary sources and
confirmed by her as her ruling; see §3's provenance note).*
