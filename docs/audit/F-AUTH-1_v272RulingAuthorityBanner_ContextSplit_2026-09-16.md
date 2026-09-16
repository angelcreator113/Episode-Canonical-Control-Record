| **PRIME STUDIOS** **F-AUTH-1 — V2.72'S RULING-AUTHORITY BANNER AND `PROJECT_CONTEXT.MD`'S §6.1/§6.5 SPLIT** *Standalone read. Mints nothing. Rules nothing. Names what the banner puts in question, and cites what already stands filed for the two named consequences.* |
| --- |

**Document version**

v1.0 — **READ ONLY.** Files that `F-AUTH-1_Fix_Plan_v2.72.md` carries
an unresolved ruling-authority banner over its own §3 and §4, that
`PROJECT_CONTEXT.md` names two different current F-AUTH-1 revisions with
two different FD-67 outcomes in two different sections, and what already
stands filed — cited, not re-derived — for the two consequences that follow
if the banner's question resolves against v2.72. **v2.72 §6's "FD-65
remains CLOSED" is a reaffirmation, not a fresh check — it describes a
world in which `POST /api/v1/auth/login` was still disabled, four days
before the PR that changed that (§4 below dates both). Not wrong; predates
its own trigger.** **Mints no FD, XK, or PE. Rules nothing — the open
question this document surfaces at §1 is named and left to Evoni.**

**Basis:** `origin/main` at `7f54c3fcf1a8ebf7fabebd1fb5d8be47581e3749`,
2026-09-15 (`git log -1 --format='%H %ad %s' --date=short
7f54c3fcf1a8ebf7fabebd1fb5d8be47581e3749`). All reads local git against
that commit. No host, AWS, database, or Cognito contact.

**Filing date:** 2026-09-16, same session as the basis SHA above.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Standalone read, filed per issue #1463 (opened retroactively — the read
began as live session synthesis, chasing a version-number mismatch Evoni
pointed at between `F-AUTH-1_Fix_Plan_v2.72.md` and `PROJECT_CONTEXT.md`
back to its source in a `/wake-up` + three-grep read; the issue was filed
once the finding's shape was clear, so this document does not itself enter
the register outside the normal issue→branch→PR loop). This note is that
chase's writeup as a repo artifact rather than only a chat transcript.
**Rules nothing, on any of the four questions it touches: not whether
`v2.72` §3/§4 stand (§1's own open question — the one this document
surfaces, and the one a reader might expect it to answer here), not FD-67's
standing (§3), not FD-65's issuance half (§4), not the Tier 5 carrier's
Shape A clause 3 (§5). All four are named and left to Evoni.** No FD, XK,
or PE is minted. Prod **FROZEN**.

---

# §1. The banner, quoted — MEASURED

```
$ sed -n '5,7p' docs/audit/F-AUTH-1_Fix_Plan_v2.72.md
> **RULING AUTHORITY UNESTABLISHED — 2026-09-11**
> **UNAUTHORISED RULINGS RECORDED.** The rulings in §3 and §4 of this document were authored and merged by an automated agent session (Task #1384 / PR #1385). No authorization for them appears in the session transcript or conversation record.
> **OPEN QUESTION:** Whether these rulings stand, and what FD-67's and Dimension 5's standings are in consequence, is unadjudicated and is Evoni's to rule in a future revision.
```

```
$ git log --diff-filter=A --format=%ad --date=short -- docs/audit/F-AUTH-1_Fix_Plan_v2.72.md | tail -1
2026-09-11
```

The banner's own date matches the file's git creation date. §3 is the
FD-68/FD-65 severity-interaction ruling that closes FD-67; §4 is the Limb 3
Dimension 5 criterion-status ruling. Both are named in the banner as
unauthorised and of unestablished standing. Neither has been re-ruled or
withdrawn as of this document's basis — MEASURED:

```
$ git log --oneline -- docs/audit/F-AUTH-1_Fix_Plan_v2.72.md
7f54c3fc docs(audit): file FD-65 halves and Tier 5 carrier premises read [skip-automerge] (#1462)
... (file itself last touched at its own filing commit; no subsequent commit edits it, consistent with the register's immutability rule)
```

---

# §2. `PROJECT_CONTEXT.md` names two different current revisions — MEASURED

```
$ grep -n "F-AUTH-1_Fix_Plan_v2.7[0-9]" PROJECT_CONTEXT.md
214:### 6.1 Keystones and standing (Handoff v26, basis `9250b60e`; F-AUTH-1 itself now current at `F-AUTH-1_Fix_Plan_v2.71.md`, plus 2026-09-03 correction banners on v26 and v2.69 — see below)
220:**F-AUTH-1's authority has since moved again, to `F-AUTH-1_Fix_Plan_v2.70.md`**...
222:**F-AUTH-1's authority has since moved a third time, to `F-AUTH-1_Fix_Plan_v2.71.md`**...
228:| **F-AUTH-1** | ... | `docs/audit/F-AUTH-1_Fix_Plan_v2.71.md` |
268:| **DONE.** FD-68 vs FD-65 severity interaction (item 11) — **ADJUDICATED** (`v2.72` §3) ... | `F-AUTH-1_Fix_Plan_v2.72.md` §3 |
271:...`F-AUTH-1_Fix_Plan_v2.71.md`) |
```

**§6.1's table (line 228)** names `v2.71` as F-AUTH-1's authority and states:
*"FD-67 remains OPEN/P2 — the branch is ruled and the remedy is implemented
and tested ... but that same §7.5 names FD-68's severity interaction with
FD-65 as unadjudicated, and `v2.69` §6 Ruling 3 records that gap as the sole
reason it stays open."*

**§6.5's row (line 268)** names `v2.72` §3 and states: *"ADJUDICATED ...
ruling FD-68 and FD-65 independent and severed defects. With this
adjudication complete and its remedy previously authorized, implemented,
and tested, FD-67 is officially CLOSED."*

Neither section cites or engages v2.72's own banner (§1 above). §6.1 is
silent on v2.72 entirely; §6.5 cites v2.72 §3's conclusion without noting
that §3 is the section the banner names as unauthorised. **Each section is
internally consistent with a different answer to the banner's open
question** — §6.1 with "no," §6.5 with "yes" — not merely inconsistent
with each other.

---

# §3. What follows for FD-67 if §1's question resolves against v2.72 — cited, not re-derived

If v2.72 §3 does not stand, FD-67's status is exactly what `PROJECT_CONTEXT.md`
§6.1 (line 228, quoted above) already carries: **OPEN/P2**, on `v2.69` §6
Ruling 3's own condition, unmet. This document draws no conclusion of its
own — it names that §6.1's row already states the reopened-consequence
verbatim, unedited, sitting sixty lines above §6.5's row that assumes the
opposite answer.

---

# §4. FD-65's issuance half — cited, not re-derived

`docs/audit/F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md`
(merged this basis, PR #1462) already files this, MEASURED at its own
basis (`1367e4a1`, 2026-09-15). Its §5 quotes `v2.67` §4's three named
reactivation preconditions and checks each against the repo fresh:

> 1. "what verifies the credential" — Present (real Cognito
>    `InitiateAuth` exchange).
> 2. "what the token carries, and that it is not caller-supplied" —
>    Present.
> 3. "how both are tested ... `LOGIN_DISABLED` ... set to `false`" —
>    **Not present**:
>    ```
>    $ grep -n "LOGIN_DISABLED" tests/integration/f-auth-1-fd65.test.js
>    72:const LOGIN_DISABLED = true;
>    ```

That document explicitly declines to rule whether the issuance half is
therefore open or closed, and leaves that to Evoni. `PROJECT_CONTEXT.md`
§6.5 already carries the same open question as a standing row (line 277):
*"STILL OWED ... FD-65's issuance half: live verification against the real
Cognito pool ... this is the only thing that closes it — not
implementation ... no session has performed the verification itself."*
§6.1 (line 239) names the same tension between that row and the table's
"CLOSED" claim, and leaves it to Evoni.

**The dating matters for v2.72 specifically.** v2.72 was filed 2026-09-11
(§1 above); PR #1457, the event `v2.67` §4 names as the reactivation
trigger, landed 2026-09-15 — four days later. v2.72 §6's *"does not alter
the closed standing of FD-64, FD-65, or FD-68"* is a reaffirmation, not a
fresh check: a statement about a world in which `POST
/api/v1/auth/login` was still disabled. **It is not wrong — it is accurate
to what existed at its own basis — but it predates its own trigger.** It
does not and could not speak to a precondition-check that didn't exist
yet. Whether FD-65's issuance half is therefore open or closed now is a
question this document does not answer.

---

# §5. The Tier 5 carrier's Shape A, clause 3 — cited, not re-derived

Same source document, §6.3, disposition table:

> | 3 — `/login` returns 401 unconditionally; ruling does not touch FD-65 |
> **Contradicted** — `/login` no longer returns 401 unconditionally as of
> PR #1457 |

The Shape A ruling (`F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md`)
rests clause 3 on FD-65's issuance half staying closed-by-removal; that
premise is now contradicted by the same PR #1457 named at §4 above. The
FD65Halves document states this as fact and declines to rule whether Shape
A still holds in whole or in part. This document adds nothing to that
disposition beyond citing it.

---

# §6. What this document does not do

- **Rule** whether `F-AUTH-1_Fix_Plan_v2.72.md` §3 or §4 stand. That is
  the banner's own open question, unadjudicated since 2026-09-11, and
  Evoni's alone.
- **Rule** FD-67's, FD-65's issuance half's, or the Tier 5 carrier's Shape
  A's standing. §3–§5 cite what already stands filed; none of it is
  re-derived or concluded here.
- **Mint** any FD, XK, or PE.
- **Edit** any existing file — `v2.72`, `PROJECT_CONTEXT.md`, the
  FD65Halves document, the Shape A ruling, and every other filed document
  stay exactly as they are.
- **Contact** any host, AWS, database, or Cognito.

---

# §7. Tails

This document mints no FD, XK, or PE and does not touch the FD-70, XK-4,
or PE-tail sequence. Not re-derived, since nothing here bears on it.

---

*Type: standalone read, filed from live session synthesis, no dispatch
issue. Rules nothing — the ruling-authority question at §1 is named and
left to Evoni. Mints nothing. Host/AWS/DB/Cognito contact: none. Prod
FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date filed: 2026-09-16. Basis: `origin/main` at
`7f54c3fcf1a8ebf7fabebd1fb5d8be47581e3749`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.72.md`, `PROJECT_CONTEXT.md` §6.1/§6.5,
`F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` — RULED/MEASURED,
cited, not re-derived. All grep/git commands above — MEASURED, this
document's own reads.*
