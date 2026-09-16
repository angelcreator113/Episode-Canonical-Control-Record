| **PRIME STUDIOS** **F-AUTH-1 — V2.72'S ATTESTED STANDING AND `PROJECT_CONTEXT.MD`'S STALE §6.1** *Standalone read. Mints nothing. Rules nothing. Corrects this filing's own earlier misreading of v2.72's banner stack, caught before merge — see note below.* |
| --- |

**Document version**

v1.0 — **READ ONLY.** Files that `PROJECT_CONTEXT.md` §6.1 has not been
refreshed since 2026-09-03 and still names `v2.71` as F-AUTH-1's current
authority and FD-67 as OPEN/P2, though `v2.72` — filed 2026-09-11, its §3/§4
rulings confirmed ATTESTED by Evoni the same evening — superseded it; §6.5
(added 2026-09-12) already carries the correct picture. Also files, cited
not re-derived, two already-filed consequences independent of that
staleness: FD-65's issuance half and the Tier 5 dev-token carrier's Shape A
clause 3, both contingent on PR #1457 (2026-09-15), which postdates v2.72
by four days. **Mints no FD, XK, or PE. Rules nothing** — whether and how to
refresh §6.1, and FD-65's/Shape A's current standing, are left to Evoni.

**Correction, made before this document merged into the register:** an
earlier commit on this same PR quoted only `docs/audit/F-AUTH-1_Fix_Plan_v2.72.md`
lines 5–7 (`sed -n '5,7p'`) and stated the register's ruling-authority
question over v2.72 §3/§4 was still open. It is not: a newer banner sits at
lines 1–3 (added 2026-09-11T20:00:36, 27 minutes after the banner at lines
5–7, per PR #1392) that retracts the older banner and states the rulings
are ATTESTED. Reading from a line offset instead of the top of the file
skipped it — the exact newest-first-banner failure this register's own
convention exists to prevent. Caught on re-check before merge; this
document was rewritten once it was found.

**Basis:** `origin/main` at `7f54c3fcf1a8ebf7fabebd1fb5d8be47581e3749`,
2026-09-15. All reads local git against that commit. No host, AWS,
database, or Cognito contact.

**Filing date:** 2026-09-16, same session as the basis SHA above.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Standalone read, filed per issue #1463. **Rules nothing, on any of the
three things it touches: not whether/how `PROJECT_CONTEXT.md` §6.1 should
be refreshed (§2–§3), not FD-65's issuance half (§4), not the Tier 5
carrier's Shape A clause 3 (§5). All three are left to Evoni.** v2.72
§3/§4's own standing is **not** one of them — that is settled, ATTESTED,
cited at §1, not re-opened here. No FD, XK, or PE is minted. Prod
**FROZEN**.

---

# §1. v2.72's banner stack, quoted in full, newest-first — MEASURED

```
$ sed -n '1,7p' docs/audit/F-AUTH-1_Fix_Plan_v2.72.md
> **RULING AUTHORITY ATTESTED — PRIOR BANNER RETRACTED — 2026-09-11**
> **RULING AUTHORITY CONFIRMED.** Evoni confirmed that the rulings in §3 and §4 of this document were her direct decisions (ATTESTED). The prior banner inferred absence of authorization from its absence in a relayed transcript, which is not the same thing; that premise is incorrect and the prior banner is retracted.
> **STANDING:** The rulings in §3 (closing FD-67) and §4 (recording D5 as MEASURED-ABSENT) stand as authorized by Evoni (ATTESTED).

> **RULING AUTHORITY UNESTABLISHED — 2026-09-11**
> **UNAUTHORISED RULINGS RECORDED.** The rulings in §3 and §4 of this document were authored and merged by an automated agent session (Task #1384 / PR #1385). No authorization for them appears in the session transcript or conversation record.
> **OPEN QUESTION:** Whether these rulings stand, and what FD-67's and Dimension 5's standings are in consequence, is unadjudicated and is Evoni's to rule in a future revision.
```

```
$ git log --format='%H %ad %s' --date=iso-strict -- docs/audit/F-AUTH-1_Fix_Plan_v2.72.md
59077711dd909b186ac9dede7868c40650072c3d 2026-09-11T20:00:36-04:00 docs(audit): prepend ruling authority attested banner to v2.72 [skip-automerge] (#1392)
c7a959caa4289f9be54732e6d48c09223ac634a6 2026-09-11T19:33:38-04:00 docs(audit): prepend ruling authority banner to v2.72 [skip-automerge] (#1388)
4d91c817cac2bb616388778960ac519e45ca1b88 2026-09-11T19:18:11-04:00 docs(audit): author F-AUTH-1 Fix Plan v2.72 [skip-automerge] (#1385)
```

Three commits, one evening: authored (19:18) → flagged unauthorized (19:33)
→ re-attested, flag retracted (20:00). No commit has touched the file
since. **Per the register's newest-first banner convention, the ATTESTED
banner governs: v2.72 §3 (closing FD-67) and §4 (D5 MEASURED-ABSENT)
stand.** This document cites that standing — ATTESTED, ascribed to banner
#1392, not independently re-verified by any read performed here — rather
than treating it as open.

**Method, not self-criticism, for whoever reads a banner-stacked file
next:** `sed -n '5,7p'` answers "what is at lines 5–7," not "what is at the
top of this file." A register whose correction convention is
newest-banner-first will put the newest fact at line 1; an offset read
that starts past it will systematically miss exactly the correction that
matters most. Read a file whose top might carry a banner whole, from line
1 — `cat -n`, not a line-range guess. This basis's own
`F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` does this
correctly at its §2.2 (`cat -n docs/audit/F-AUTH-1_Fix_Plan_v2.67.md`,
whole file); this document's first version did not, and that is the entire
cause of the correction above.

---

# §2. Why `PROJECT_CONTEXT.md` §6.1 and §6.5 disagree — staleness, not a live question — MEASURED

```
$ git log -S "F-AUTH-1 itself now current at" --format='%H %ad %s' --date=iso-strict -- PROJECT_CONTEXT.md
deedc9aafa980c757450edf36b4a787a9f928f7a 2026-09-03T18:01:44-04:00 docs(context): refresh for v2.69 rulings and banner [skip-automerge] (#1215)
```

```
$ git log -S "FD-68 vs FD-65 severity interaction (item 11)" --format='%H %ad %s' --date=iso-strict -- PROJECT_CONTEXT.md
4dbc547c59e5565daf400affafa746c5f2ee88c5 2026-09-12T13:39:14-04:00 docs(context): refresh F-AUTH-1 row for v2.72 rulings [skip-automerge] (#1396)
```

§6.1's line naming `v2.71` as F-AUTH-1's current authority (line 214) and
its FD-67 OPEN/P2 table row (line 228) date to **2026-09-03** — a refresh
for `v2.69`, predating `v2.70`, `v2.71`, and `v2.72` entirely. §6.5's row
(line 268) dates to **2026-09-12** — one day after the ATTESTED banner (§1
above) — and correctly states v2.72 §3 ADJUDICATED, FD-67 CLOSED. **§6.1
was never refreshed past `v2.69`; §6.5 was written with the current,
resolved picture already in hand. This is an ordinary stale-section gap,
not two authorities in live disagreement.**

---

# §3. FD-67's actual status

FD-67 is **CLOSED**, per `v2.72` §3, ATTESTED (§1 above). `PROJECT_CONTEXT.md`
§6.1 (line 228) still carries **OPEN/P2** and is stale for the reason dated
at §2. Refreshing §6.1 to match §6.5 is owed; this document does not
perform that refresh — it edits no existing file (§6).

---

# §4. FD-65's issuance half — cited, not re-derived, independent of §1–§3

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

**The dating matters for v2.72 specifically, regardless of §1's
correction.** v2.72 was filed and its §3/§4 rulings ATTESTED on 2026-09-11
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

- **Re-verify** the ATTESTED banner's own claim that Evoni confirmed §3/§4
  as her direct decisions. Cited from banner #1392 (ATTESTED), not
  independently re-derived by any read performed here.
- **Refresh** `PROJECT_CONTEXT.md` §6.1 to match §6.5. Named as owed at
  §3; not performed.
- **Rule** FD-65's issuance half's or the Tier 5 carrier's Shape A's
  current standing. §4–§5 cite what already stands filed; none of it is
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

*Type: standalone read, filed per issue #1463. Rules nothing on
`PROJECT_CONTEXT.md` §6.1's refresh, FD-65's issuance half, or the Tier 5
carrier's Shape A — all three left to Evoni. v2.72 §3/§4's standing is
settled (ATTESTED) and cited, not re-opened. Mints nothing. Host/AWS/DB/
Cognito contact: none. Prod FROZEN.*

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date filed: 2026-09-16. Basis: `origin/main` at
`7f54c3fcf1a8ebf7fabebd1fb5d8be47581e3749`.*
*Authority: `F-AUTH-1_Fix_Plan_v2.72.md` (both banners, ATTESTED governing),
`PROJECT_CONTEXT.md` §6.1/§6.5,
`F-AUTH-1_FD65Halves_And_Tier5Carrier_Read_2026-09-16.md` — RULED/ATTESTED/
MEASURED, cited, not re-derived. All grep/git commands above — MEASURED,
this document's own reads.*
