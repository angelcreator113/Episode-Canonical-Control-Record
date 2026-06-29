# F-Deploy-1 — Parallel Tree Construction Spec (2026-06-27)

> **Scope:** This spec closes a gap in Runbook Sec 7A between Step 3 (node_modules staged)
> and Step 4 (stand up parallel process). It is additive — it does not rewrite the runbook.
> The finding feeds the next Fix Plan revision; no FD number is self-applied here.
> Every box-touching line is a discrete Rule 7 gate. Nothing in this document executes
> without draft → confirm → execute per step.

---

## Finding

Runbook Sec 7A Step 3 stages node_modules to a parallel path. Step 4 starts a parallel
process "against the new tree." No step between them specifies how to materialize the
parallel app directory (app code at origin/main HEAD + node_modules co-located + `.env`
resolved). Strategy B's authoritative definition (Pricing doc, Sec 3) requires "a clean
checkout of the chosen origin/main state in a parallel location/process." Phase 2A Step 3
execution (2026-06-25) completed node_modules staging only; no app code checkout was done.
No Phase 2B artifact exists. FD39 bridge is silent on construction.

**Step 4 is not executable as written until this spec's P1–P5 sequence completes.**
FD number authority sits with the next Fix Plan revision.

---

## Facts established this session (read-only, not inherited)

| Fact | Value | How confirmed |
|---|---|---|
| App code source | `git archive origin/main HEAD` | Serving tree clean vs origin/main (`git diff origin/main --stat` empty, 2026-06-27 live check) |
| Box `origin/main` ref | `13002465...` | `git -C /home/ubuntu/episode-metadata rev-parse origin/main` run live on box, 2026-06-27 |
| node_modules revision-match | MATCH | `package-lock.json` SHA256 identical at build commit `ae721589` and origin/main HEAD `13002465` (`85fbc788...`) |
| node_modules actual size | 525 MB | `du -sh` on box, 2026-06-27 |
| Disk free (current) | 1.8 GB / 78% used | `df -h /` on box, 2026-06-27 |
| `.env` gate | 2b PASS | All five discrete `DB_*` keys present, canon identity confirmed live by `inet_server_addr()` / `current_database()`, 2026-06-27 |
| PM2 entry point | `src/server.js` | Ecosystem config (all PM2 entries) + `package.json scripts.start` at origin/main HEAD |
| Require-resolution entry | `src/app.js` | `package.json main` at origin/main HEAD |
| Untracked files (serving tree) | `ecosystem.config.js.bak-20260619-a2cfg` only | `git status --porcelain` on box, 2026-06-27 — not load-bearing |

**Risk decision basis — copy over move (P3):** Staged node_modules is 525 MB actual
(runbook estimated ~1.1 GB; actual is roughly half). With 1.8 GB free, a copy leaves
~1.25 GB free — comfortable margin. Copy-then-delete-after-P5 keeps the staged set
intact as a fallback until the parallel tree is verified complete; a failed parallel
tree is recoverable without a node_modules rebuild. If disk were tighter than the
525 MB copy overhead allows, move would be required — record this measurement so a
future reader sees why copy was chosen and does not revert to move without re-checking.

---

## Target parallel directory

`/home/ubuntu/episode-metadata-parallel/`

Chosen to be unambiguous:
- Does not collide with serving tree: `/home/ubuntu/episode-metadata/` (DO NOT TOUCH)
- Does not collide with stale rejected deploy dir: `/home/ubuntu/episode-metadata-deploy/`
  (March–May 2026, not at HEAD — correctly rejected as parallel tree source)
- Does not collide with staging path: `/home/ubuntu/episode-nodemodules-staging-20260625/`

---

## Construction sequence

### P1 — Create parallel app directory (Rule 7 mutation)

```bash
mkdir /home/ubuntu/episode-metadata-parallel
```

Pre-condition: confirm directory does not already exist before executing (`mkdir`
without `-p` will fail if it does — this is intentional, not an oversight).

---

### P2 — Extract app code at origin/main HEAD (Rule 7 mutation)

```bash
git -C /home/ubuntu/episode-metadata archive origin/main \
  | tar -x -C /home/ubuntu/episode-metadata-parallel
```

Extracts tracked files only at `origin/main` (`13002465`, verified live on box). Excludes:
node_modules (git-ignored), untracked files (only `.bak` present — confirmed not
load-bearing). Does not touch the serving tree. The `.env` is git-ignored and not
extracted — P4 handles it via symlink.

---

### P3 — Copy staged node_modules into parallel directory (Rule 7 mutation)

```bash
cp -r /home/ubuntu/episode-nodemodules-staging-20260625/node_modules \
      /home/ubuntu/episode-metadata-parallel/node_modules
```

**COPY, not move.** Disk permits it (525 MB copy, 1.8 GB free → ~1.25 GB remaining).
The staged set at `episode-nodemodules-staging-20260625/node_modules` **remains intact**
as a fallback until P5 passes. The staging source is deleted in P6, not here.

Revision-match confirmed: build commit `ae721589` lockfile SHA256 = origin/main HEAD
lockfile SHA256. The copied node_modules are consistent with the code extracted in P2.

---

### P4 — Symlink `.env` into parallel directory (Rule 7 mutation)

```bash
ln -s /home/ubuntu/episode-metadata/.env \
      /home/ubuntu/episode-metadata-parallel/.env
```

**SYMLINK, not copy. This line must not be softened into a copy.** A symlink transfers
the gate 2b pass (the canon-identity-confirmed `.env` is the same file). A copied `.env`
would be a new file whose canon-identity is unproven from the parallel process and would
require a fresh probe before any process start against it.

---

### P5 — Verify parallel tree is complete (read-only — no Rule 7)

This is the checkpoint the runbook omitted. P5 pass is the gate between "tree built"
and "process started." **Step 4 of Sec 7A does not execute until P5 passes.**

```bash
# Directory structure
ls -la /home/ubuntu/episode-metadata-parallel/

# Entry points (both required)
test -f /home/ubuntu/episode-metadata-parallel/src/server.js && echo "server.js OK"
test -f /home/ubuntu/episode-metadata-parallel/src/app.js    && echo "app.js OK"

# .env symlink — resolves AND is readable (catches dangling symlinks)
ls -la /home/ubuntu/episode-metadata-parallel/.env
test -r /home/ubuntu/episode-metadata-parallel/.env && echo "env readable"

# node_modules present
ls /home/ubuntu/episode-metadata-parallel/node_modules/ | head -5
```

Expected outcomes:
- `ls -la` shows `src/`, `migrations/`, `package.json`, `package-lock.json`,
  `node_modules/`, `.env` → (symlink to `/home/ubuntu/episode-metadata/.env`)
- Files owned by `ubuntu` (running as `ubuntu`; `git archive | tar -x` preserves this
  — confirm in `ls -la` output, do not assume)
- `server.js OK` and `app.js OK` both printed
- `env readable` printed (symlink is not dangling)
- node_modules populated

**Any failure in P5 = abort. Diagnose before proceeding to Step 4 or P6.**

---

### P6 — Delete staging source after P5 passes (Rule 7 mutation — deletion of shared state)

Executed **only after P5 passes**. This is a Rule 7 gate, not a cleanup footnote:
deletion of shared state on the box requires draft → confirm → execute.

```bash
rm -rf /home/ubuntu/episode-nodemodules-staging-20260625/node_modules
```

After P6, the staging parent directory (`episode-nodemodules-staging-20260625/`) will
be empty. The parallel tree at `episode-metadata-parallel/` is the sole copy of the
node_modules. The staging parent directory may be removed separately if desired, but
that is out of scope for this spec.

---

## After P1–P6: Step 4 is executable

`/home/ubuntu/episode-metadata-parallel/` is a valid target for Runbook Sec 7A Step 4
("stand up the parallel process"). Step 4 remains Rule 7.

---

## Rollback

P3 is the only step with a meaningful partial-failure risk (copy of 525 MB —
interruptible). If interrupted: P3 staging source is intact (copy, not move), so
staged node_modules are not lost. Clean up partial `episode-metadata-parallel/node_modules`
and re-run P3.

For abort of the entire construction (any step): `rm -rf /home/ubuntu/episode-metadata-parallel/`
removes the entire box-side footprint of P1–P4. The staging source (`episode-nodemodules-staging-20260625/`)
remains intact until P6.

---

*Parallel tree construction spec. Closes runbook gap at Sec 7A Step 3 → Step 4.
All facts derived live 2026-06-27. Feeds next Fix Plan revision for FD authority.*
