# P-4/P-5 Off-Box Build — Evidence Pack (DRAFT)

> **Status:** DRAFT, warm-safe. Drafted 2026-06-18. (Live HEAD is captured at
> use-time in E0 — this doc does not pin a HEAD, which would go stale.)
> **Purpose:** Make the next fresh P-4/P-5 session one-pass and unambiguous, so a
> *real-but-uncaptured* build (the 06-18 failure mode) can never pass again.
> **Carrying rule:** This doc is reference for the clean session. It is NOT itself
> a `[3]` precondition and contains no box action. Committing it is a normal
> Rule-7 gated step to be decided later — not here.

---

## Design principle (applies to all three artifacts)

A **prose claim has zero evidentiary weight.** "I built it and it started" does not
pass. Only **pasted, verbatim, unedited command-output blocks** pass. Every PASS
slot below is an empty fenced block; an empty or hand-summarized block is an
automatic NOT PASSED. The acceptance gate (Artifact 3) reads *only* the filled
blocks, never the session narrative.

**Two spots flagged `⟦CONFIRM-SPEC⟧`** must be reconciled against ExecutionSpec
Sec 0 *inside the clean session before building* — they are deliberately not
invented here.

---

# ARTIFACT 1 — Transcript-Capture Checklist (fresh P-4/P-5 session)

## 1.0 Session preconditions (must all be true before any build command)

- [ ] This is a **fresh session** with **no inherited conclusions** — no handoff
      docs, no runbook *conclusions*, no reconciliation material carried in. (A
      session that inherited those is WARM and disqualified from producing a
      `[3]`-bearing PASS.) This does **not** forbid reading a *required spec section
      live in-session* — that is permitted and, for E5, mandatory. The line is:
      inheriting conclusions = disqualified; reading a scoped spec section live and
      evidencing it = correct cold-entry behavior.
- [ ] Own **wake-up trio** run and pasted (Evidence E0 below). Memory HEAD is
      stale by design — verify live.
- [ ] **Rebuild-at-priming** acknowledged: no artifact from a prior P-4/P-5
      attempt is reused. The container and `node_modules` are built from scratch
      this session.
- [ ] **Zero-box-contact** acknowledged: no SSH, no AWS mutation, no read of
      `ubuntu@54.163.229.144`, no read of canon RDS `episode-control-dev`. The box
      Node-patch read is **A2-cfg**, which belongs to the cold `[3]` window, NOT here.

## 1.1 Parity target (build against the PINNED SPEC, not the box)

| Axis | Target | Pin confidence | Gate rule |
|---|---|---|---|
| Architecture | `x86_64` | HIGH | exact match required |
| libc | glibc (Ubuntu 22.04 → glibc 2.35) | HIGH | exact match required |
| Node | major **20** (build target Node 20.x) | MEDIUM | **engines-range ABI parity** (Node `>=20.0.0`) — NOT exact-patch |
| npm | build target **10.x** | MEDIUM | **engines-range ABI parity** (npm `>=9.0.0`) — NOT exact-patch |

> **Why range, not exact-patch:** the #812 false abort was box `v20.20.1` vs build
> `v20.20.2`. The A1 decision (merged in #817) set the gate at engines-range ABI
> parity, so a patch delta inside Node 20 / npm ≥9 is **PASS**, not abort. Do not
> compare against an assumed box patch version here — that comparison is what
> failed before, and the box read isn't owed until `[3]`.

## 1.2 Required evidence (each item = one pasted block in the PASS artifact)

For **every** command below: run it, then paste the **complete verbatim output**
(including the command line and any trailing exit-status check) into the matching
slot in Artifact 2. No truncation of the head/tail. No paraphrase.

- [ ] **E0 — Wake-up trio.** `git fetch origin`; `git log --oneline -1 origin/main`;
      `gh pr list --state open`. Confirms the session opened on live state.
- [ ] **E1 — Container base identity.** The Dockerfile/base image line *and* the
      resolved platform: `uname -m` (→ `x86_64`) and the libc version
      (`ldd --version` → glibc 2.35) **from inside the build container**.
- [ ] **E2 — Runtime versions in-container.** `node --version` and `npm --version`
      from inside the container.
- [ ] **E3 — engines-range parity assertion.** A pasted check that E2's versions
      satisfy Node `>=20.0.0` / npm `>=9.0.0` (range, per §1.1). A one-liner that
      prints PASS/FAIL on the range is acceptable *if its output is pasted*.
- [ ] **E4 — Clean dependency install.** `npm ci` full output, including the final
      "added N packages" line and the **exit status** (`echo $?` → `0`) on the
      next line. `npm ci` (not `npm install`) is mandatory — it builds from the
      committed `package-lock.json` with no resolution drift.
- [ ] **E5 — Start-verify.** The app start command and its output up to the point
      that proves it reached a serving/listening state. `⟦CONFIRM-SPEC⟧` —
      confirm against ExecutionSpec Sec 0 (a) the exact success string that counts
      as "started," and (b) whether start-verify is DB-connected. If DB-connected,
      it runs against a **disposable local Postgres in the same build**, never canon
      RDS. Paste both the start output and the liveness probe output (e.g. the
      `/health` response), whatever Sec 0 defines.
- [ ] **E6 — Zero-mutation attestation (deterministic).** Paste a command/output
      block that scans the build-window shell history for any box-contact command
      and shows an **empty result**, e.g.:
      `history | grep -Ei '(^|[^[:alnum:]_])(ssh|aws|psql|pm2)($|[^[:alnum:]_])'` →
      (no matching lines). POSIX bracket form, not `\b` — `\b` is a GNU extension and
      not portable across all greps.
      Then paste the **container teardown** output (e.g. `docker rm -f <id>` /
      `docker compose down`) confirming the build environment was disposed. An empty
      grep result plus a teardown line is the pass; anything matched is a STOP (§1.4).

## 1.3 Pass / fail rules

- **PASS** = E0–E6 slots are ALL filled with verbatim output AND every gate rule in
  §1.1 is satisfied by the pasted E1–E3 blocks AND E4 exit status is `0` AND E5
  shows the Sec-0 success string AND E6 attests zero box contact.
- **NOT PASSED** = any slot empty, summarized, or truncated; OR `npm install` used
  in place of `npm ci`; OR any exact-patch comparison used as an abort trigger
  (that's the #812 error); OR any evidence the box/canon RDS was contacted.
- **There is no partial pass.** A real build with a missing E-slot is NOT PASSED —
  by design, this is exactly the 06-18 case.

## 1.4 Stop conditions (abort the session, record NOT PASSED, do not retry blind)

1. **Spec ambiguity at E5.** If ExecutionSpec Sec 0 can't be read or is unclear on
   the start-verify success criterion, STOP. Don't invent a success string.
2. **Parity miss on a HIGH axis.** arch ≠ x86_64 or libc ≠ glibc 2.35 → STOP; the
   base image is wrong.
3. **`npm ci` non-zero exit.** STOP; capture the failing output as evidence and end
   NOT PASSED. Do not switch to `npm install` to force it green.
4. **Any impulse to "just check the box."** STOP. Box read is A2-cfg / cold `[3]`,
   not P-4/P-5.
5. **Transcript not capturing.** If output isn't landing in the transcript, STOP
   before building — an uncaptured build is the failure you're preventing.

---

# ARTIFACT 2 — PASS Artifact Template (fill in the clean session)

> Save as the run record. **Empty fenced blocks = NOT PASSED.** Paste raw terminal
> output only; do not edit it to "look clean."

```
P-4/P-5 OFF-BOX BUILD — RUN RECORD
Session date (UTC): __________
HEAD at session open (from E0): __________
Outcome: [ ] PASS   [ ] NOT PASSED
```

### E0 — Wake-up trio (live state at session open)
```
<paste: git fetch origin / git log --oneline -1 origin/main / gh pr list --state open>
```

### E1 — Container platform identity (arch + libc, from inside container)
```
<paste: base image line; uname -m; ldd --version>
```

### E2 — Runtime versions (from inside container)
```
<paste: node --version; npm --version>
```

### E3 — engines-range parity assertion (Node >=20.0.0 / npm >=9.0.0)
```
<paste: range check output showing PASS on both — NOT an exact-patch compare>
```

### E4 — npm ci (clean install, with exit status)
```
<paste: full npm ci output, final "added N packages" line, then echo $? -> 0>
```

### E5 — start-verify  ⟦CONFIRM-SPEC: success string + DB-connected? per ExecutionSpec Sec 0⟧
```
<paste: start command output to the Sec-0 success state>
```
```
<paste: liveness probe output (e.g. /health response), per Sec 0>
```

### E6 — zero-mutation attestation (no box / no canon RDS contact)
```
<paste: history | grep -Ei '(^|[^[:alnum:]_])(ssh|aws|psql|pm2)($|[^[:alnum:]_])'  -> (no matching lines)>
```
```
<paste: container teardown output (docker rm -f <id> / docker compose down)>
```

### Self-check before declaring outcome
- [ ] Every E-block above contains real pasted output (none empty/summarized)
- [ ] E1 arch = x86_64, libc = glibc 2.35 (HIGH axes, exact)
- [ ] E2/E3 satisfy Node ≥20.0.0 and npm ≥9.0.0 by **range**, not patch
- [ ] E4 exit status = 0, and the command was `npm ci` (not `npm install`)
- [ ] E5 shows the Sec-0 success string
- [ ] E6 attests zero box/canon contact
- [ ] No exact-patch comparison was used as an abort trigger anywhere

---

# ARTIFACT 3 — Acceptance Gate for Reopening `[3]`

> This gate is read by the **next** session that wants to open the cold `[3]`
> window. It consumes **only the filled Artifact-2 blocks** — never the prose of
> the build session, never a summary, never memory.

## 3.1 The gate

`[3]` precondition "P-4/P-5 PASSED" is satisfied **iff** a completed Artifact-2 run
record exists and **all** of the following resolve against its pasted blocks:

- [ ] **G-1** Artifact-2 `Outcome` reads PASS, and the self-check list is fully
      ticked, **and** the ticks are independently re-verifiable from the pasted
      blocks (re-read E1–E6; do not trust the ticks alone).
- [ ] **G-2** E0 HEAD is on the `main` lineage that still leads to current
      `origin/main` (no rebase/divergence since the build). Re-run the wake-up trio
      now and confirm continuity.
- [ ] **G-3** E1 confirms x86_64 + glibc 2.35 (HIGH-axis exact match).
- [ ] **G-4** E2/E3 confirm Node ≥20.0.0 and npm ≥9.0.0 by **range** (a patch-level
      delta is NOT a fail — reject any record that aborted on exact-patch).
- [ ] **G-5** E4 shows `npm ci` with exit 0.
- [ ] **G-6** E5 shows the ExecutionSpec-Sec-0 start-verify success string and its
      liveness probe.
- [ ] **G-7** E6 attests zero box / zero canon-RDS contact during the build.

If any of G-1…G-7 cannot be resolved from pasted evidence → **P-4/P-5 precondition
UNMET.** `[3]` does not open. (This is the state at draft time: precondition UNMET,
pending a captured Artifact-2 PASS run.)

## 3.2 What this gate explicitly refuses

- A session saying "I ran the build last time and it worked." → UNMET.
- A summary or handoff note asserting PASS without the Artifact-2 blocks. → UNMET.
- A PASS record that aborted on, or would have aborted on, an exact Node/npm patch
  mismatch. → reject (re-arms the #812 false-abort error).
- Reuse of a persisted build artifact (violates rebuild-at-priming). → UNMET.

## 3.3 Relationship to the other still-closed gates (unchanged, for context)

Passing this gate clears **only** the P-4/P-5 precondition. `[3]` still additionally
requires, at its own cold session start: own wake-up trio → scoped read of runbook
Sec 5 only → **fresh live FD-31 §7 abort re-verify** (canon row counts vs catalog,
snapshot + verified dump on disk) → and the standing closed gates (Gate 2.5 cred
rotation, Stop Gate #1 no-repeat-at-cutover). This artifact does not touch any of
those.

---

## Open items for the clean session to resolve (do NOT resolve from memory)

1. `⟦CONFIRM-SPEC⟧` in E5 — exact start-verify success string + DB-connected? →
   ExecutionSpec Sec 0.
2. *(Resolved in this revision)* E6 is now a deterministic command set — empty
   `history | grep` (POSIX bracket form) for ssh/aws/psql/pm2 plus container
   teardown output.
   - **Shell-scope sub-decision (deferred to spec-read):** run the E6 scan
     **inside the build container**, not on the host. The container's history is
     exactly the build window; host (PowerShell) history predates Docker and would
     miss a box-contact command run earlier in the session even with a correct grep.
     Candidate in-container form, after build / before teardown:
     `history | grep -E '(^|[^[:alnum:]_])(ssh|aws|psql|pm2)($|[^[:alnum:]_])'`
   - **Carries one assumption to confirm against the build mechanism in Sec 0:**
     this only works if an *interactive* in-container shell recorded a history. A
     non-interactive build (Dockerfile `RUN` steps, or one-shot
     `docker run … npm ci && npm start`) has no `history` to scan — in that case
     E6's attestation has to come from the build invocation itself (e.g. the run
     command had no creds/key mounted and no route to the box), not a history grep.
3. Disposition of this Evidence Pack itself (commit? where? supersede prior
   checklist?) → normal Rule-7 gated decision, made later, not in the build session.
