# F-AUTH-1 — Cognito pool topology decision, owed to PE #65 — 2026-08-22

## Scope statement — read first

**This document specifies a decision, not a remedy.** §9.10's remedy is unspecifiable without first choosing a target topology, and that choice depends on infrastructure ownership and product intent this register doesn't have visibility into. What follows lays out the branches, their consequences, their reversibility, and — the part that matters most — which branches can be chosen blind and which cannot. **It ends in a question for Evoni, not an answer.**

**Referred to by role throughout, not by identifier** — "the existing shared pool," "a new pool" — per the standing discipline of keeping identifiers out of working text. §9.10 itself already discloses them; this document adds no new disclosure surface.

**Basis.** `main` at `3c8d147d39f8aaec05c76345bea5957ab45460e4`. Derived from documents (`F-AUTH-1_Fix_Plan_v1.5.md` §9.9, §9.10; `Session_PE_Roster.md` PE #64, #65, #66) and from the liveness-check result recorded at PE #64/#65 (one pool exists in the account; three identities in it). No new AWS call issued in the course of writing this document. No deployed host contacted. Prod FROZEN.

## Exhaustiveness — stated, not assumed

**This enumeration is bounded by what §9.10 contemplated, not by what's possible, and that's a real limitation, not a formality.** §9.10 imagined exactly one shape: two Cognito pools, one per environment. Branches A and B are the two ways to reach that shape from where the account actually is; Branch C is this document's addition, not §9.10's.

**At least one further class exists and is named here only so it isn't silently foreclosed:** isolation without a pool split at all — a single pool with Cognito **groups** or a claims-based scoping layer distinguishing dev-issued from prod-issued identities at the application layer, or a migration off Cognito entirely. **This document does not develop that class.** It would need its own cost analysis and its own author, and presenting three branches as *the* three would constrain Evoni's choice more than the evidence supports. If a fourth shape is wanted, that's a fourth branch to add, not a gap this document quietly closes by omission.

**It is undeveloped because this document's remit is §9.10's remedy, not because anyone assessed it and set it aside.** No revision, entry, or session has evaluated a non-split isolation model on its merits. Absence of development here should not be read as a judgment against it.

## Branch A — repurpose the existing pool as canonical prod; stand up a new pool for dev

**Mechanism.** The pool that exists today keeps its identities and becomes prod's system of record. A new, empty pool is created for dev; dev's env config repoints to it.

**Consequence for the three known identities.** All three — Evoni's and the two others found at PE #64's liveness check — become prod identities by inheritance, not by evaluation. **This is the branch's real cost, and it is not a small one:** if either of the two non-Evoni identities is dev/test debris rather than a real user, this branch promotes it to permanent prod status without anyone having looked at it first.

**Does this branch require knowing who the three identities are? No — it can be chosen without that.** Nothing about *executing* Branch A depends on identifying the two non-Evoni accounts. But choosing it blind is itself a decision with the consequence stated above, and that consequence should be read before the choice is made, not discovered after.

**Reversibility.** The new dev pool is trivially disposable if the split needs redoing. **What is not reversible is Branch A's promotion of the three existing identities to prod** — undoing that after the fact is Branch B, run backwards, against records that by then may have prod-side history attached.

**This is also the branch where that cost is invisible at the moment of choosing.** Nothing fails when Branch A is executed. No log line marks the promotion, no test turns red, no step requires anyone to look at the two non-Evoni identities before they become permanent prod records. The branch that costs the least effort and the branch whose worst consequence produces no signal are the same branch — which is the shape this register keeps finding under other names: a low-friction path whose cost doesn't register at the point where it's incurred, only later, if anyone goes looking.

**Cost.** Low. One new pool, one config change per environment. No Cognito user migration of any kind.

## Branch B — create a new prod pool; retain the existing pool as dev

**Mechanism.** A new pool is created and designated canonical prod. Any identity that belongs in prod is migrated into it from the existing pool; the existing pool continues as dev's.

**Consequence.** This is the branch that actually matches what most readers would picture "split the pools, prod stays prod" as meaning — but it's the opposite of what §9.10's plan clause literally says (the plan retains the shared pool as prod; this branch does not). Flagging that inversion explicitly since it's easy to reach for this branch as "the obvious one" and not notice it contradicts the plan text it's nominally implementing.

**Does this branch require knowing who the three identities are? Yes, and this is the finding worth surfacing rather than burying in a bullet.** Cognito does not move users between pools as a platform operation — a user migrated this way is re-created, re-authenticated, or Lambda-migrated on next login, not transplanted. Deciding *which* of the three identities gets that treatment requires knowing which of them is a real prod user. **PE #64's identity-count question was deliberately closed at the count** (§9.10's own remit didn't require who); Branch B reopens exactly that question, and does so as a precondition of execution, not as an afterthought. Anyone choosing this branch should know going in that it doesn't stay abstract.

**Reversibility.** Partial. The new prod pool, once it has live prod traffic against it, is not trivially discardable the way Branch A's new dev pool is.

**Cost.** Real and non-trivial — this is the branch that is actually a data migration, not a config change, matching §9.10's trigger language rather than its plan language. That mismatch (PE #65 Defect 1) is precisely why the remedy as written can't be executed without first picking a branch: the plan clause describes Branch A's mechanics, the trigger clause describes Branch B's consequence, and no revision noticed they don't name the same operation.

## Branch C — abandon the split; revise §9.10's disposition instead of remediating it

**This branch gets the same rigor as the other two, not a token entry, because it may be right.**

**What would have to be true for this to be a legitimate end state, not a deferral dressed as one:** the shared pool would need a real isolation mechanism substituting for the pool boundary — Cognito groups distinguishing dev-origin from prod-origin identities, application-layer authorization keyed to that group rather than to pool identity, and a documented operator model stating who can create accounts in it and under what review. **None of that currently exists.** §9.10 and PE #64 describe a pool with no isolation of any kind — one flat identity space, no groups, no claims distinguishing environments. Choosing Branch C today, as the account stands, would be closing the finding without remediating it, not accepting an equivalent remediation.

**So Branch C is legitimate only as a future state, conditioned on work that doesn't exist yet — not as a decision executable today.** If Evoni's judgment is that pool-level isolation was never actually the right control for this system and something else (group-based scoping, say) should replace it, that's a real answer, but it's a design commitment with its own build, not a checkbox that closes PE #64/#65 as filed.

**Does this branch require knowing who the three identities are? Not to choose it.** It requires knowing them, and every future identity, to *operate* it — the whole point of the substitute isolation mechanism is that it has to evaluate every identity going forward, which is a heavier standing commitment than either A or B, not a lighter one.

**Reversibility.** Fully reversible as a decision — nothing is destroyed by choosing it, and A or B remain available later. **Not cost-free**, because the isolation mechanism it depends on is unbuilt work, and until it's built, Branch C is a severity re-classification of an unresolved gap, not a closure.

## The cost of choosing none of them

**Deferral is not a fourth branch; it is the current state, and it has a cost that compounds rather than holds still.** Every day this decision goes unmade, the existing pool keeps accepting whatever traffic reaches it. Concretely: Branch B's migration set can only grow, since every new identity in the shared pool is one more record requiring the same re-creation-or-migration treatment PE #64's finding already applies to the two known today. Branch A's blind promotion covers a wider and less-examined set the longer it waits, for the identical invisible-cost reason given in Branch A's body. **Branches A and B both get more expensive under delay; Branch C's precondition — building a substitute isolation mechanism — does not get cheaper by waiting either, since nothing about deferral advances that work.** No branch benefits from delay. This is not stated to press for a choice; it is the missing cell in the table above, and a decision document that prices three options without pricing its own non-selection is incomplete.

## What each branch requires, side by side

| | Requires knowing the 2 non-Evoni identities to **choose**? | Requires it to **execute/operate**? | Data migration? | Reversible? | Cost of delay |
|---|---|---|---|---|---|
| **A** — existing pool → prod | No | No | None | New dev pool: yes. Identity promotion: no. | Blind-promotion set grows |
| **B** — new pool → prod | No | **Yes** — reopens PE #64's closed question | Yes, real | Partial once live | Migration set grows |
| **C** — abandon split | No | Yes, ongoing, for every future identity | None | Yes, as a decision; the substitute mechanism is separate unbuilt work | Precondition unbuilt regardless |

## What this document does not do

- **Does not choose a branch.** That's Evoni's, stated at the top and repeated here because it's the point.
- **Does not create, rename, or repurpose any AWS resource.**
- **Does not edit `docs/cognito-ids.txt`**, or resolve PE #66.
- **Does not resolve PE #65.** It supplies the specification PE #65 says is owed; PE #65 closes when a branch is chosen and costed against real config/sequencing, not when branches are listed.
- **Does not reopen PE #64's identity-count closure on its own.** It names the one branch (B) under which that question returns, and the one branch (C) under which it returns in a different, ongoing form.
- **Contacts no deployed host. Changes no gate, no severity, no disposition.**

**Resolution path.** Bring this to Evoni for branch selection. PE #65 records the re-specification as owed; this document is that specification. It closes PE #65 when a branch is chosen and costed against real config/sequencing — not before.

*Filed 2026-08-22. Basis `3c8d147d39f8aaec05c76345bea5957ab45460e4`. Derived from documents. No deployed host contacted. No AWS call issued. Prod FROZEN.*
