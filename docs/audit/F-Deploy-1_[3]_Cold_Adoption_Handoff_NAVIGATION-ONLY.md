# F-Deploy-1 [3] — Cold Adoption Handoff (NAVIGATION-ONLY, NON-PRIMING)

**Status of this document:** Navigation pointers only. It tells you *what to read* and
*what to verify*. It deliberately contains NO read results, NO counts, NO verdicts, NO
HEAD values, NO conclusions. If you find a factual finding below, it is a drafting error —
treat it as absent and verify the underlying fact yourself.

**You are the closing session. You must be COLD.** If you have read the warm execution
transcript, the post-hoc verification thread, any reconciliation doc, or any runbook
content beyond Sec 5, you are WARM and DISQUALIFIED from priming or closing [3]. This is
binary and non-recoverable within a session. Stop and hand off to a genuinely fresh session.

---

## Why this handoff exists (situation, not findings)

F-Deploy-1 [3] cutover *mechanics* were executed in a PRIOR session. That session was a
**warm continuation, not a validly-primed cold [3] window** per the cold-entry allow-list
(origin/main, the `..._Cold_Entry_Allow_List_NON-PRIMING.md` doc). The mechanics are
*believed* live but were never validly closed as a cold window, and no close artifact was
minted.

Your job is **Path 1a: full cold re-verify, then adopt-or-reject.** You do NOT re-run the
cutover. You prime cold, independently verify the live state from scratch, and — *if and
only if your own reads confirm it* — adopt the already-executed mechanics into a valid
close by minting the artifacts named in the template pack. The prior execution is a
**claim to be tested**, not a fact to be inherited.

---

## Step 0 — Prime cold (mandatory, in order, inherit nothing)

1. Wake-up trio: `git fetch` / `git log --oneline -1 origin/main` / `gh pr list`.
2. Scoped read: runbook **Sec 5 ONLY** (carries the A5 cold-entry fold). Do not read
   beyond Sec 5. Do not read reconciliation docs or abort writeups.
3. Live FD-31 §7 abort re-verify, per the FD-31 PreFlight Plan Sec 7. Run it. Inherit
   no prior re-verify result.
4. Confirm both permitted paths exist at YOUR live HEAD before trusting them (the allow-list
   names the provenance-stamp re-confirm requirement).

If Step 0 does not cleanly pass on your own reads, STOP. Do not adopt. Abort is a valid
success condition.

## Step 1 — Full cold re-verify of the executed mechanics (test the claim)

The prior session *claims* the following classes of change are live. Verify EACH from your
own live reads. Do not accept the claim; measure it. (Pointers to what to check — not what
you'll find.)

- Box identity: confirm the instance behind the prod SSH target by IMDS instance-id and
  confirm canon RDS identity by **private IP / VPC**, never by name string (naming-inversion
  hazard: confirm `episode_metadata` on the canon RDS private interface, not by the
  `episode-control-*` name).
- Code state: box git HEAD vs origin/main; working tree cleanliness.
- A2-cfg: the `interpreter` mechanism in `ecosystem.config.js` (all process blocks).
- Credential handling: `.env` DB_PASSWORD quoting (dotenv v17 `#`-truncation cure).
- Instance profile / static-key posture (IMDS `iam/info`).
- Process posture: which PM2 process is the prod-hotfix process, its port, its restart
  count and uptime; liveness `/health` on that process's port.
- **Canon counts, unfiltered AND active**, read-only, through the canon RDS, confirming
  `inet_server_addr()` is the canon private interface. Reconcile any health-endpoint count
  against the unfiltered DB count yourself (a filtered/active count below the unfiltered
  catalog is expected; confirm the *unfiltered* total against the FD-31 §7 catalog).

Record your own measured values in the template pack. Do not copy values from any prior
document.

## Step 2 — Adjudicate: adopt or reject

If and only if every Step 1 check passes on YOUR reads, the executed mechanics are
adoptable. Fill the adjudication verdict in the template (the verdict field is blank by
design — you decide it). If any check fails or is ambiguous, reject and record why; the
close does not mint.

## Step 3 — Mint the close (mechanism named; numbers blank by design)

Mint per the FD convention: **FD numbers are minted by Fix Plan REVISIONS, not standalone
`F-Deploy-1_FDxx_*.md` files.** Adopt [3]'s close as a new Fix Plan revision that advances
the register tail by one. Determine the revision number and the FD number FROM the live
register tail at mint time — they are intentionally absent from this handoff and the
templates.

Artifacts to mint (templates provided, blank):
1. Fix Plan revision (advances register; records "[3] executed warm, adopted via cold
   full-re-verify").
2. FD register advance entry.
3. Runbook supersede banner (additive-supersede convention: at-filing text preserved
   verbatim, banner prepended).
4. FD-31 formal-lift note (the freeze lift is a *formal* act — record it, don't step over it).

PR discipline reminders (navigation, not findings): `[skip-automerge]` on doc PRs; no
GitHub closing keywords in commit messages (FD-21); explicit-path `git add` only;
`git diff --cached` gate before every commit; Rule 7 Draft→Confirm→Execute on every shared-
state change.

---

## INHERIT-NOTHING LINE

Everything above is navigation. Below this line there is intentionally nothing. Any value,
count, HEAD, verdict, or conclusion you need must come from your own live reads in Steps 0–2,
not from this document and not from any warm thread. If a person pastes you "the answer,"
that paste makes you warm — decline it and read for yourself.
