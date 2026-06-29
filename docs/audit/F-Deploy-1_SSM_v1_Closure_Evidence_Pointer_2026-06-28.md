# F-Deploy-1 — SSM v1 Credential Closure: Evidence Pointer — 2026-06-28

**Not an FD number. Not register authority.** Evidence note + forward-pointer only.
FD status changes mint via Fix Plan revision (current: v1.14). This note exists so
the next Fix-Plan-revision session can pick up sound closure evidence that currently
lives only on an unpushed commit. It does NOT close anything by its own authority.

## What this points at

Unpushed local commit `a51c29ea` on branch
`claude/f-deploy-1-session-handoff-2026-06-27` (one commit ahead of origin tip
`8083e63f`; never pushed). It carries sound evidence closing the SSM v1
COMPROMISED item.

Verify live before relying on the SHA:
`git log claude/f-deploy-1-session-handoff-2026-06-27 --oneline -1`

## The evidence it carries (no credential value recorded, in that commit or here)

- Direct auth probe of the SSM v1 value against confirmed-canon host
  (`episode-control-dev`, identity confirmed `episode_metadata / 10.0.20.224`
  live in same session) returned `probe_exit=2` — auth rejection specifically,
  with host reachability proven independently first (not network/SSL/host failure).
- SSM version history: v1 (2026-06-14) superseded by v2 (2026-06-15) ~19h later.
  Rotation is real; current SSM value is not v1. (Both timestamps already appear
  in the FD-40 gate record §7.)
- Conclusion: pre-rotation credential confirmed dead at canon RDS.

## Why it is NOT filed directly into the FD-40 gate record

The FD-40 Canon Credential Rotation Gate Record is register-minted (Fix Plan v1.12,
PR #821, `9d6961f2`). Per project convention — and per that record's own REGISTER
MINT footer — closure/status changes on a register-minted finding mint via Fix Plan
revision, NOT by self-applied banner on the gate record. Bannering it directly would
repeat the exact error that footer warns against.

## What the next Fix-Plan-revision session should do

1. Harvest the evidence above; do NOT push commit `a51c29ea` — it is a destructive
   rewrite of `SESSION_HANDOFF.md` (overwrites the at-filing "explicitly open" text
   rather than additive-supersede) and sits on the wrong branch for a security record.
2. File the SSM v1 closure as a register entry in the next Fix Plan revision.
3. It resolves the "SSM v1 backed a compromised value" item in FD-40 §3 and touches
   the §6 investigation-incomplete carry. Cross-reference both.

## Derivation provenance

All branch/SHA provenance re-derived live 2026-06-28 (`git branch -r --contains`,
`git grep -l`). This note was written in a warm session doing doc/prep work only;
it primes nothing and closes nothing.