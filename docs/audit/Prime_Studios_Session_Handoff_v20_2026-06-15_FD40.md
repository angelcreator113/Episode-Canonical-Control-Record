> **[SUPERSEDED - point-in-time handoff, 2026-06-18]**
> This is a dated 2026-06-15 handoff; its "floor" (HEAD 33a434e6, PR #799) is stale.
> Current main HEAD is 9d6961f2 (Fix Plan v1.12, PR #821). Do not inherit this
> handoff's state as current. Specifically: this file's "Gate 2.5 closed durable via
> PR #799" describes the gate file being recorded - #799 did not mint the FD-40
> register; v1.12 (PR #821) did. This file is the likely propagation vector by
> which "register through FD-40" entered working memory as a false settled fact; it is
> retained as trail and explicitly flagged so it cannot be re-read as current. Run the
> wake-up trio against live state; trust nothing dated here.
# Prime Studios — Session Handoff v20 (post-FD-40, 2026-06-15)

**Floor for next session:** HEAD `33a434e6` on `origin/main` (FD-40 squash, PR #799). Wake-up sequence first, always: `git fetch origin` -> `git log --oneline -1 origin/main` -> `gh pr list --state open`. Fetch before any reset. Expect HEAD at `33a434e6` or later.

## What closed this session

Gate 2.5 — canon credential rotation — now recorded durable on main via PR #799. The FD-40 record carries a supersede banner that honestly documents the rotation having executed ahead of its Rule 7 drafted block and reconciled retroactively; close confirmed on independent live-state verification (five evidence points: RDS applied / no pending, SSM v2, SHA-256 byte-equality, CloudTrail ordering RDS-then-SSM, canon probe `episode_metadata|143|10.0.20.224`). Hygiene attestation (scrollback / disk scan) recorded in the committed FD-40 diff; confirmed with operator before merge rather than inherited.

## Open / carry-forward

- **[3] still cold and unprimed.** Gate 2.5 green does not prime it. Opens in its own cold session with its own wake-up and FD-31 §7 abort re-verify. A session that opened by reading a handoff is not that session.
- **#752** (AK-3 PM2 naming) parked — only live when [3] is being primed.
- **was-it-used: permanently investigation-incomplete.** No canon VPC flow logs; RDS logs only back to 06-12; 3.94.166.174/32 attribution aged out of 90-day window. Closed on rotation.
- **Post-[3] security sweep** carries: AD (no IAM instance profile), AE (box SG), AF (canon RDS SG `sg-002578912805d1930` — corrected label on record, NOT the fork's `sg-0164d0b20fbebacbb`), flow-logs enablement on canon VPC `vpc-0754967be21268e7e`, `PubliclyAccessible: true` on canon RDS.
- **Standing escalation triggers:** `0.0.0.0/0` or `3.94.166.174/32` reappearing on canon SG ingress tcp/5432 — escalate, do not treat as routine.

## Lessons (carried because they are about how sessions go, not what they produce)

1. Live terminal beats the polished transcript, every time. Treat any summary of completed work — including this handoff — as a claim to verify against live state, not a fact to inherit. This session's wake-up carried scrollback hygiene as "open" while the PR showed it attested; that gap got caught only by reading the actual diff.
2. On shared-state mutation, draft -> confirm -> execute is not optional. The rotation last session is the cautionary tale: clean outcome, irregular path, luck doing the work the gate should have done. There is heavy mutation still ahead on the keystone sequence — the gate is what turns "got lucky" into "knew it was safe."

## Persona note

The drill-sergeant PM prompt stays declined. Velocity pressure works directly against the forensic discipline this project runs on.