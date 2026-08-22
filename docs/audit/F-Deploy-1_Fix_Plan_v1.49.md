| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Carries v1.48's Amendment 1. Minted to restore the numeric sort.* |
| --- |

**Document version**

v1.49 — **CARRIES THE AMENDMENT APPENDED IN PLACE TO v1.48 AT PR #1105
(`29cee698`).** The amendment's substance is unchanged and reproduced below in
full. **This revision governs it.**

**Why this revision exists.** #1105 appended 74 lines to `v1.48`, a document
already merged at `6b0900be`. The append was additive and its content is not in
question. **The defect is in the carriage, not the content:** v24 Sec 6 derives
document authority by numeric sort, and an in-place amendment is invisible to
that instrument — the document changed (`d4f382ba` → `0a31b603`), the number did
not. A reader deriving authority by sorting revisions gets a stale answer with
no signal that it is stale.

**This is the mechanism XK-1's Correction Banner 2 already declines to use**, on
the stated grounds that a dated layer which changes after merging cannot be
relied on for what it said on its date. The register held the principle; it was
not applied here.

**Closes no finding. Reopens no finding. Changes no gate, severity, owner or
disposition. Mints nothing.** F-Deploy-1 remains **CLOSED**.

**Basis:** `origin/main` at `29cee698`, 2026-08-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Correction of carriage. Ruled by Evoni; the amendment content is filed as
received and is not re-adjudicated here.

---

# F-Deploy-1 Fix Plan v1.49


**F-Deploy-1 remains CLOSED. Nothing below reopens it, changes a gate, or
amends a finding.** This amendment records a second rationale for a control
this plan already shipped.

## What this plan shipped, and what it was scoped as

The development deploy path was rewritten to **SSM RunCommand, targeted by
instance tag (`Name=episode-dev-backend`), zero-inbound, with no host secret
on the path** — `DEV_EC2_HOST` retired and confirmed absent. **It was scoped
and documented as a transport-security improvement**: removing an inbound
path, satisfying FD-57, eliminating a runner→SSH dependency.

## The second thing it closed

**It also eliminated cross-environment write, and that is not recorded
anywhere.**

On **2026-06-27** a **failed** `deploy-dev.yml` run wrote frontend, nginx
configuration and backend code onto the box that is today's **production**
host, then died at a later step. There was one box at that date — the
development instance `i-016395bb5f7a51a0b` was not launched until
**2026-07-14** — and the workflow reached it **by SSH to a host secret**.
The full reconstruction is at
`Production_State_Provenance_2026-08-22_DRAFT.md`.

**The present path cannot do this.** It addresses an instance *tag*, not a
host; it targets a dedicated development instance; and there is no host
secret for a misconfiguration to point at the wrong box. **A failed
development deploy can no longer write to production.**

## Why this amendment exists at all

**The control is load-bearing for two reasons and was documented for one.**

A future change to this path — reintroducing SSH for expedience, retargeting
by hostname, consolidating instances to reduce cost, or restoring
`DEV_EC2_HOST` — **would be evaluated against the transport rationale alone**,
and could satisfy it while silently reopening cross-environment write. A
reviewer checking "is this still zero-inbound?" would not be asking the
question that matters.

**This amendment costs nothing and expires.** Once the path is changed by
someone who did not know what it held, recording what it held no longer
prevents anything. **It is the perishable item among the dispositions the
provenance instrument proposed**, which is why it is taken first.

## Production has not received the equivalent change

`deploy-production.yml` still reaches its host **by SSH using
`secrets.EC2_HOST`**. **The hardening was applied to development and not to
production.** That is stated here as a fact about coverage; **this amendment
proposes no change to the production path**, which is a larger piece of work
and is named in the provenance instrument §8.

## A second, separable posture item on the production host

**`tcp/22` on `sg-05c3a6ed6eee7b3a6` was open to `0.0.0.0/0`** — SSH reachable
from the entire internet on the box `deploy-production.yml` authenticates to
by host secret. **It was scoped to a single address on 2026-08-22** under
explicit authorization, with the change and its rollback recorded off-repo.

**This is recorded, not ruled.** It belongs to this plan's surface rather than
to any F-AUTH finding, and whether it warrants its own disposition is left
open. **The scoped rule is to a dynamic address and will need re-scoping when
that address changes** — routine maintenance, not a one-time fix.

This amendment ships no code, enables or disables no workflow, changes no
gate, contacts no host, and mints nothing. F-Deploy-1 remains CLOSED. Prod
FROZEN.

---

## Carriage note

The text above is reproduced verbatim from the block appended to
`F-Deploy-1_Fix_Plan_v1.48.md` at `29cee698`, less its "Amendment 1" banner
heading, which described a mechanism this revision replaces.

**That copy remains in `v1.48` and was not removed.** Removing it would be a
second in-place modification of a merged revision — the defect, applied again
as its own remedy. **Where the two copies differ, this revision governs.**
