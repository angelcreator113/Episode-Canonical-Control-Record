# F-Deploy-1 Canon Credential Durability SCOPING OUTCOME (2026-06-12)

> **SCOPING OUTCOME NOTE. AUTHORIZES NO BOX ACTION AND NO SECRET WRITE.**
> Records the scoping conclusion that gates the durability write session: the one
> unresolved provenance gate, the execution-session decision rule, and the cost of
> the box-read branch. Names no value. Templates no `put-parameter`. The write
> remains its own deliberate, gated Rule 7 session. Box stays FROZEN. [3] not primed.

| | |
|---|---|
| **Parent finding** | `F-Deploy-1_Canon_Credential_Durability_Finding_2026-06-12.md` |
| **Plan** | `F-Deploy-1_Canon_Credential_Durability_Plan_2026-06-12.md` (Path 1, SSM SecureString; Sec 4 un-templated by design). |
| **Purpose** | Resolve the value-provenance gate the plan left open, and record what the box-read branch costs, before the write session opens. |
| **Status** | Scoping closed. Write session not yet opened. No value held in this artifact. |

---

## Sec 1 -- The one unresolved gate

The plan (Sec 4) sources the put from "the value the operator holds securely." It does
not establish that such a copy exists. As of scoping, there is NO evidence in-session
of a confirmed secure off-box copy already in hand. The live POST-ROTATION value is
recorded as living in only two places: canon RDS and the box `.env`. (The finding's
discovery-time phrasing -- pm2 process memory plus box `.env` -- describes the pre-
rotation moment; post-rotation, pm2 holds the now-dead OLD credential, and canon +
box `.env` hold the live one.) The workstation `.env` is stale/dead and must never be
used as a source.

So the gate before the write session is a single question: does the operator hold a
secure off-box copy now, or does staging the value require reading it back out of the
box `.env`?

## Sec 2 -- Execution-session decision rule

1. **Held copy exists:** use it as the put source. No box read. Both verification
   checks (Sec 5 of the plan) stay independent.
2. **No held copy:** perform a one-time controlled extraction from the box `.env`
   under the no-echo / no-history handling path, then immediate put + hash-based
   verify + canon-auth re-probe.

This is the only unresolved gate before the durability write session opens.

## Sec 3 -- What branch 2 costs (so the write session opens eyes-open)

Branch 2 is not just plumbing into the put. It introduces a surface that does not
exist today: the post-rotation credential in transient plaintext on the operator's
machine during the read. The credential currently lives in exactly two places; branch
2 deliberately creates a transient third before SSM becomes the durable third. That
makes the extraction itself a Rule 7 mutation of the exposure surface, not setup.

Three constraints follow:

- **One uninterrupted sequence.** Extract -> put -> hash-verify -> canon re-probe, with
  no pause between extraction and the durable write landing. A staged plaintext copy
  left sitting is what leaks into history, scrollback, or a clipboard manager.
- **No-echo on BOTH sides.** The box read is inside the freeze envelope (a read of
  `.env`, no box mutation) but must not render the secret -- no `cat .env`. Read the
  single key without echoing it, on the box side; the value must not render on either
  the box terminal or the operator terminal in transit.
- **Correctness gate shifts.** Under branch 2 the source of truth for the put IS the
  box `.env` -- the same artifact whose loss is the risk this fix exists to close. So
  the plan's Sec 5 step-1 hash compare degrades from "did I store what I intended" to
  "did the put faithfully transfer the box value." The real proof of correctness moves
  entirely onto Sec 5 step-2, the canon re-probe (`10.0.20.224` / canon VPC, identity
  by IP/VPC never by name string). Branch 1 keeps both checks independent; branch 2
  runs with one fewer independent check. Treat the canon re-probe as the correctness
  gate, not the hash compare.

## Sec 4 -- Additional execution-session notes (NOT a template)

- **Reachability split.** The `put-parameter` runs under operator admin identity and
  can run workstation-side. The canon re-probe connects to `10.0.20.224`, private in
  the canon VPC, so it likely runs box-side (read-only, established SSL probe pattern,
  inside freeze). The write session may legitimately span two surfaces. Reuse the
  proven gate-2.5 probe path; do not invent a new credential path.
- **Pre-write identity AND region check (two distinct confirmations).**
  1. Confirm active caller identity with `aws sts get-caller-identity` (returns
     account / ARN / UserId -- it does NOT report region).
  2. Pin region separately: force `--region us-east-1` explicitly on every AWS command
     in the session, or verify the configured default region independently. Identity
     and region are two confirmations, not one.
  Same identifier discipline the plan applies to the param path and the RDS naming
  hazard.

## Sec 5 -- What this note does NOT do

- Does NOT hold, name, or write the secret.
- Does NOT template the `put-parameter` (Sec 4 of the plan stays un-templated).
- Does NOT touch, restart, or edit `.env` on the box.
- Does NOT prime, schedule, or authorize [3], and does NOT resolve AD/AE/AF.

---
*Scoping-outcome companion to the Path-1 durability plan. Records the value-provenance
gate, the held-copy vs box-read decision rule, and the cost of the box-read branch
(transient third copy, one uninterrupted sequence, no-echo both sides, canon re-probe
as the correctness gate). The single `put-parameter` write remains its own gated Rule
7 session. Authorizes no box action and writes no secret. Box FROZEN; [3] not primed.*