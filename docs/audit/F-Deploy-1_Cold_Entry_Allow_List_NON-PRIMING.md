> ===== TERMINAL SUPERSEDE / SAFETY STOP (prepended 2026-07-31) =====
> THIS DOCUMENT IS VOID FOR EXECUTION. STOP READING FOR ACTION.
>
> The [3] window is not open. Fix Plan v1.20 (2026-07-06) recorded the
> id-3/[3] restart-to-align thread COMPLETE and closed FD-31 and FD-38.
> Fix Plan v1.48 (2026-07-22) closed Phase B and the F-Deploy-1 KEYSTONE.
>
> DO NOT prime a session from this document.
> DO NOT run any [3] cold-adoption, re-verify, or adjudication step.
> DO NOT mint a Fix Plan revision or advance the FD register from this track.
>
> FREEZE NOTICE: FD-31 being CLOSED does NOT lift the prod freeze. v1.20
> states freeze posture for prod actions outside ratified gates is
> UNCHANGED; v1.48 confirms standing gates survived the keystone close.
> This document confers NO authority to reboot, restart, or alter the prod
> box, and no authority to issue any freeze-lift.
>
> If you need current state, derive it live: numeric-sort the
> docs/audit/F-Deploy-1_Fix_Plan_v1.*.md revisions and read the tail.
> Do not treat any version number in this banner as current.
>
> This file's two "permitted reads" have no live referent: FD-31 is closed.
> Original at-filing text preserved verbatim below.
> ==================================================================
# F-Deploy-1 — [3] Cold-Entry Allow-List (NAVIGATION ONLY)

> **PURPOSE: This file lets a fresh cold session reach exactly the two reads it**
> **is permitted, with verified paths, without performing a broad scan that would**
> **warm it on entry. It is a pointer list. It carries NO content from those reads,**
> **NO conclusions, NO reasoning. Reading this file in full does NOT warm a session**
> **— that is the whole point of keeping it conclusion-free.**
>
> **This file authorizes nothing. It does not prime [3]. It changes nothing on**
> **the box (`54.163.229.144`, FROZEN, "do not reboot" stands).**

## Who this is for

A FRESH COLD SESSION priming [3]. Per Fix Plan v1.13 Sec 3, three [3]
preconditions are OPEN, and all three are properties of the priming session
itself:
- it must be a fresh cold session (inheriting nothing)
- it must do a live FD-31 Sec 7 abort re-verify
- it must do a scoped Master Runbook Sec 5 read ONLY (carrying the A5 cold-entry fold)

A session that has read this project's runbooks, fix plans, reconciliation docs,
or abort writeups is WARM and disqualified — binary, non-recoverable within the
session. This allow-list is written so that reading IT does not trip that wire.
The author session of this file was warm; that does not transfer through a
pointer list.

## Step 0 — your own wake-up trio (do not trust any commit below as live)

    git fetch origin
    git log --oneline -1 origin/main
    gh pr list

Capture YOUR live HEAD. The commit cited in this file (below) is the commit this
allow-list was authored against — it is a provenance stamp, NOT a value to pin
your reads to. If live HEAD differs, your reads run against live HEAD, and you
re-confirm these paths still exist before trusting them.

## The two permitted reads (verified paths; re-confirm existence at your HEAD)

Authored against: origin/main @ cbbf8172 (provenance only — verify live).

1. Scoped Master Runbook Sec 5 read ONLY:
   docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md

   ⚠️ PATH CONTAINS LITERAL BRACKETS. PowerShell glob hazard.
   - For git show: single-quote the whole ref argument.
   - For any Get-Content / Select-String / git add against the working tree:
     -LiteralPath is MANDATORY; explicit quoting for git add.
   - Read Sec 5 ONLY. Reading conclusions, other sections, or other runbooks
     warms the session and disqualifies it from priming [3].

2. Live FD-31 Sec 7 abort re-verify source:
   docs/audit/F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md

   No brackets in this path. Sec 7 is the abort-conditions section.
   The re-verify is LIVE (workstation→canon RDS, read-only), not a doc read —
   the doc gives you the checks; you run them against live canon and compare.

## What is NOT in this file by design

- No Sec 5 content. No Sec 7 abort values or fingerprints. No expected counts.
- No FD-40 / FD-42 / Gate 2.5 / AF / reconciliation conclusions.
- No "here's what you'll find." You find it live, cold, yourself.

If you want any of the above, you are no longer cold. Stop and open a new
session.

## Provenance (does not warm a reader)

Author session was WARM (had read both runbooks, Fix Plan v1.13, the P4P5 PASS
note). It produced this pointer list only. Per v1.13 Sec 3 and Path A
discipline, a cold session opening [3] inherits NOTHING from the warm session
that produced this record — including this file's existence beyond its pointers.
