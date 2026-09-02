| **PRIME STUDIOS** **F-AUTH-1 SPECIFICATION — PE #65 EXECUTION SEQUENCE** *Assembles the sequence `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §8 names as owed. Rules nothing. Mints nothing. Executes nothing.* |
| --- |

# F-AUTH-1 — PE #65: ordered execution sequence with its gates — 2026-09-02

**FILED 2026-09-02.** This document performs the step
`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §8 identifies as the sole
remaining gap in PE #65's closing criterion: *"an ordered execution sequence
with its gates,"* assembled from that document's §5.1 config surface and
§5.3–§5.5 constraints, against the per-environment manifests that exist on
`main`, under the standing prod freeze, and against `v25` Sec 6 item 13's
residue.

**Basis:** `origin/main` at `f15c113a775cdd607485a7e1cd301565f5fc135a`, 2026-09-02.
Derived entirely from documents already on `main` — the resolution document
named above, `Prime_Studios_Audit_Handoff_v25.md` Sec 6 items 11 and 13, and
the config-surface citations both already carry. **No new repository read was
performed to produce this sequence; every constraint it orders was already
filed.**

**Environment contact — stated in full.** None. This document is assembled
entirely from prose already on `main`. No local database, no local file
outside `docs/audit/` read for new facts, no listener opened, no Redis
contact. **No AWS call issued. No deployed host contacted. No Cognito
contact. Prod FROZEN.**

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Specification only.** Orders constraints already filed into steps and
gates. **Rules nothing** — Branch B was already ruled at
`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §1 and is not re-ruled here.
**Mints nothing** — no FD, XK, or PE number. **Executes nothing** — no AWS
resource created, read, renamed, or repurposed; no migration performed or
scheduled; no config file written. **Does not itself close PE #65** — see
§7. Ships no code. Changes no gate.

---

## §1. What this document orders, and on what authority

`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §8 states PE #65's closing
criterion is met when a branch is chosen **and costed against real config
and sequencing**, and that the branch is chosen (§1 of that document) and
the costing exists (§5.1, §5.3–§5.5) but **nothing assembles the costing
into an ordered sequence with its gates.** That is the one thing missing,
by that document's own accounting, and it is the one thing this document
supplies.

**This document adds no new constraint.** Every step below cites the
resolution document's own section for its content. Where a step requires a
decision the resolution document left open (§5.4's auth-flow read, §5.5's
item-11 coupling), this document names the open decision as a gate rather
than closing it — closing it would be re-ruling, which is not this
document's authority.

## §2. Phase 0 — the precondition that gates every later phase

**Nothing in Phase 1 or Phase 2 may begin until this phase's gate is passed,
live, by Evoni.**

**Gate G0 — prod-freeze residue confirmed live.** `v25` Sec 6 item 13, quoted
in full: *"The Actions path is derivable from the repository and the
API… The remainder is not. SSM, SSH, and console access reach production by
paths no repository read observes. Confirm the residue live through the
appropriate authority before any prod / shared-Cognito / host action."*
Branch B is a shared-Cognito action by definition. **No repository read —
including this one — can pass this gate.** It is confirmed by Evoni,
outside any agent session, or it is not confirmed at all.

**This gate is not new.** It restates `v25` Sec 6 item 13 and the top-level
freeze rule (`CLAUDE.md`, "Production is FROZEN") without softening either.
It is placed first because every step in Phase 2 is a prod or
shared-Cognito action and none may be reordered ahead of it.

## §3. Phase 1 — documentation steps, no host or AWS contact, performable now

**These steps touch only files under `docs/audit/` (and, at step 2, a new
migration file that is written but not run). None requires Phase 0's gate.**
They are ordered first because nothing about them depends on AWS state, and
leaving them until after execution risks the same drift
`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` Banner 2 (§B5, superseded
premise) and §4's Defect 3 (*"carriage is the operation that does not
interrogate what it carries"*) both warn against — a spec written after the
fact tends to describe what happened rather than what was decided.

1. **Re-record §9.10's P1 into the current Fix Plan authority.** The
   resolution document §6 and §7 both state this is owed and is a Fix Plan
   revision — the only instrument that mints FD numbers — not this
   document's to perform. §9.10 occurs zero times in
   `F-AUTH-1_Fix_Plan_v2.68.md` as of this basis (unchanged from the
   resolution document's own count). **Not performed here; named because
   `v25` Sec 6's own rule requires a runnable obligation to appear in Sec 6
   or be explicitly excluded, and this document is not the vehicle for a
   Fix Plan revision.**

2. **Write, do not run, the `decision_logs.deleted_at` migration.**
   `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` §7.1.1
   rules this migration first in FD-66's own sequence, ahead of FD-66's
   baseline, on grounds unrelated to PE #65 — it is named here only because
   it shares this document's "prepared, not executed, no host contact"
   shape, and a reader assembling the owed Evoni-gated work in one pass
   should find it adjacent. **Still requires authorizing**, per FD-66 §7.1.1
   itself. Not written by this document; tracked as separate, pending
   authorization.

3. **Confirm the dev manifest needs no change.** `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`
   §5.2 establishes two per-environment manifests exist —
   `ecosystem.config.js` (`env_production`) and `ecosystem.dev.config.js`
   ("NO env_production blocks belong in this file"). Branch B retains the
   existing shared pool as dev (§1), so `ecosystem.dev.config.js`'s Cognito
   values are **unchanged by this execution**. This is a repository read
   confirming a negative, performable now: `git show origin/main:ecosystem.dev.config.js`
   contains no `COGNITO_*` write this sequence would alter. **Not itself
   probative of anything new** — it restates §5.2's finding in the form a
   sequence needs, and is listed as a step so a later reader does not have
   to re-derive that the dev side of Branch B is a no-op on config.

## §4. Phase 2 — AWS and host actions, Evoni's own, in order

**Every step in this phase is a shared-Cognito or prod action. Per §2's Gate
G0, none may begin before Evoni confirms the freeze residue live. No agent
session performs any step in this phase, under any authorization this
document could grant — this document grants none. The ordering below is
what the resolution document's constraints imply about sequence; it is not
an instruction to any agent, and no agent-authored automation should be
built to carry it out.**

1. **Resolve §5.4's auth-flow bound.** `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`
   §5.4: `USER_PASSWORD_AUTH` is document-sourced from
   `docs/COGNITO_USER_POOL_SETTINGS.md` only; `ListUserPoolClients` does not
   return `ExplicitAuthFlows`, and `DescribeUserPoolClient` was deliberately
   not called because its response may include `ClientSecret`, outside the
   authorized no-secret boundary. **Gate G1 — this is Evoni's decision, not
   a technical step this document can order past:** either accept the
   documented setting without AWS verification (a risk-acceptance call), or
   perform a `DescribeUserPoolClient` read structured to discard
   `ClientSecret` from its own response before any value is logged or
   stored. Either choice is hers; this document states the fork and takes
   neither branch.

2. **Create the new Cognito pool, designated canonical prod.** Per §1's
   ruling. AWS write; Evoni's own action, under Gate G0.

3. **Configure the new pool's app client** with `ExplicitAuthFlows` matching
   whatever Gate G1 resolved to, and obtain its Client ID and Client Secret.

4. **Update the four config variables** — `COGNITO_USER_POOL_ID`,
   `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_REGION` (§5.1's
   surface, read only by `src/config/environment.js` and
   `src/middleware/auth.js`) — on the **prod manifest's** `env_production`
   block only (`ecosystem.config.js`), per Phase 1 step 3's confirmation
   that the dev manifest is untouched. **This is a server `.env`/PM2
   manifest edit on the frozen box and is explicitly barred to any agent
   session by `CLAUDE.md`'s non-negotiables regardless of this document.**

5. **Migrate the three known Evoni-controlled identities** into the new
   pool. §5.3: the migration set is three records held by one person, not
   an unknown population, and password currency is unestablished (§6.1 of
   the 2026-08-25 resolution) — so a reset-on-first-login path is not a
   burden this branch imposes but a step plausibly owed regardless. **Gate
   G2 — the migration mechanism (reset-on-first-login vs. an alternative)
   is Evoni's choice**, informed by that finding; this document does not
   select one.

6. **Verify equivalence and smoke-test the auth flow** against the new pool,
   inside a prod window Evoni opens herself. **No agent session opens,
   schedules, or requests such a window.**

7. **Sequence against item 11 (the FD-67/FD-68 remedy) if both are live at
   once.** §5.5, quoted: `src/middleware/auth.js` is both the Cognito config
   reader this branch repoints and the site of `COGNITO_CONFIG_PLACEHOLDERS`
   and `COGNITO_INFRA_ERROR_NAMES`, which item 11's remedy changes the
   behaviour of. **Named, not adjudicated, in the resolution document, and
   named, not adjudicated, here too** — FD-67 itself remains OPEN/P2 with
   no branch chosen (`F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`
   §9, §10), so there is no remedy yet to sequence against. **Gate G3 — if
   FD-67/FD-68's remedy is authorized before this branch executes, whichever
   change to `src/middleware/auth.js` lands second must be rebased against
   the first; this document does not pick an order because only one side of
   the pair exists at this basis.**

## §5. What the phase split does and does not establish

**The split is sequencing, not risk classification.** Phase 1 being
host-free does not make it optional or lower-priority than Phase 2 — item
11's remedy (Phase 1 step 1's sibling concern) and the `decision_logs`
migration (step 2) are independently gated on Evoni's authorization, not on
AWS access, and nothing here ranks them against other owed work.

**Phase 2's ordering is derived from dependency, not urgency.** Step 1 (the
auth-flow bound) is placed first within Phase 2 because step 3 needs its
answer; steps 2–4 are placed in the order Branch B's own mechanics require
(pool before client before config repoint); step 5 follows because a
migration target must exist before identities move into it; step 6 follows
because equivalence is checked against a populated pool; step 7 is a
cross-cutting constraint checked whenever it becomes live, not a step with
a fixed position in the numbered sequence.

## §6. What this document cannot establish

- **It cannot confirm Gate G0.** No repository read establishes SSM, SSH, or
  console-path freeze state. That is the entire content of `v25` Sec 6 item
  13's "remainder," stated as not repository-derivable in the item itself.
- **It cannot resolve Gate G1, G2, or G3.** Each is a decision the
  resolution document or this one names as open and explicitly declines to
  make. Ordering them into a sequence is not the same as ruling them, and
  this document does neither for the three gates.
- **It does not verify that Phase 2's steps are exhaustive.** It orders the
  constraints `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §5.1–§5.5
  already filed. A constraint that document did not surface is not
  surfaced here either.
- **It does not check whether the four config variables' current values
  (dev-pool-pointing) are what `ecosystem.config.js`'s `env_production`
  block presently holds.** Values were not read, per this document's own
  no-new-read statement at the basis line; only the file's existence and
  the manifest split were cited, both already established at
  `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §5.2.

## §7. Whether PE #65 closes

**Not decided here.** `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §5
states PE #65 closes when a branch is chosen and costed against real config
and sequencing; §8 states the branch is chosen, the costing exists, and the
sequencing was the missing piece. **This document is that piece.** Whether
its filing discharges the criterion is a register-authority question this
document cannot rule on itself — the same discipline
`F-AUTH-1_FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` §7
applies to XK-1 ("a self-applied entry carries no register authority")
applies here with the roles reversed: a document cannot close the item it
was written to complete. **That determination is for a ratifying revision
or for Evoni directly**, not asserted by this filing.

## §8. What this document does not do

- **Does not rule Branch B.** Already ruled at
  `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §1; not re-opened here.
- **Does not resolve Gates G0, G1, G2, or G3.** Each remains open, named
  above, and none is inferred.
- **Does not authorize any AWS action, migration, or config edit.** Phase 2
  is a description of order, not a grant.
- **Does not perform any step of Phase 1 or Phase 2.** No migration file is
  written by this document; no Fix Plan revision is filed by this document.
- **Does not close PE #65.** See §7.
- **Does not mint** an FD, XK, or PE number. FD-70 remains next-available
  and unminted, per the resolution document's own tail (unchanged: this
  document performed no tail re-derivation, since it made no claim whose
  currency depends on one).
- **Contacts no host, dispatches no workflow, issues no token, performs no
  AWS read or write. Prod FROZEN.**

---

*Type: specification only. Assembles already-filed constraints into an
ordered sequence with named gates. Rules nothing, mints nothing, executes
nothing. No host, AWS, database, or Cognito contact. Prod FROZEN.*
