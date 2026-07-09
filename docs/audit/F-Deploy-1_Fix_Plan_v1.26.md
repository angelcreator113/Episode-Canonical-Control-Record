# F-Deploy-1 Fix Plan v1.26

> **Observability findings — FD-50 (workflow runtime state), FD-51 (empty-output authority). Supersedes v1.25 §6.1 step 6 by pointer.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.25 (FD-48/FD-49 mint, PR #909) |
| **Register tail at open** | FD-49 |
| **Register tail at close** | FD-51 |
| **Closed** | none |
| **Minted** | FD-50, FD-51 |
| **Gate effect** | Advances no gate. Authorizes no prod-box or dev-box action. Phase position unchanged from v1.25 §2. |

---

## §1 Purpose

v1.26 records two observability findings discovered on 2026-07-09 while verifying the `[skip-automerge]` token's effect on PR #909.

Both findings share a shape: **a signal that looks like state, and is not.** They are minted separately because they fail in different places. FD-50 is about *where runtime state lives*. FD-51 is about *whether a read happened at all*. FD-51's blast radius is wider — it applies to every grep in the register, not only to workflow files.

v1.26 performs no first-instance architectural reasoning. It corrects a derive-sequence step shipped in v1.25 and adds a guard the register has never carried.

Phase position per v1.25 §2. v1.26 moves nothing.

---

## §2 The demonstration

Two workflow files on `origin/main`, read live 2026-07-09.

**`.github/workflows/auto-merge-to-dev.yml`** — declares itself armed:

    on:
      push:
        branches:
          - 'claude/**'

Uncommented. The `[skip-automerge]` opt-out gate and the `-X ours` merge strategy are both present and intact. The file is entirely truthful about its own contents.

**`.github/workflows/deploy-dev.yml`** — declares itself disabled, in the file:

    on:
      # ── DISABLED 2026-07-01 for the F-Deploy-1 freeze (opened for the [3] window) ──
      # The push→dev trigger arms the autonomous cascade documented in
      # Verify disabled from git (expected: EMPTY output — the only push: is commented):
      #   git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"
      # push:
      #   branches:
      #     - dev

Now the runtime, via `gh workflow list --all`:

| Workflow | ID | State |
|---|---|---|
| Copilot cloud agent | 229363646 | **active** |
| Validate | 247402926 | **active** |
| Deploy to Development | 224506682 | `disabled_manually` |
| Deploy to Production | 224506683 | `disabled_manually` |
| Auto-merge to Dev | 244372826 | `disabled_manually` |

**`auto-merge-to-dev.yml` says armed. It is dead.** Last run: `28289464941`, 2026-06-27, on branch `claude/f-deploy-1-phase2a-construction-spec-2026-06-27`. `origin/dev` HEAD is `dc18b83d`, dated 2026-06-27, matching that run.

*(Staleness is the reader's arithmetic: today minus 2026-06-27. No day-count is asserted here. A hardcoded age is itself a non-derivable claim that rots — the exact defect FD-50 names.)*

Two pushes of `claude/f-deploy-1-fix-plan-v1-25` on 2026-07-08 produced **zero runs**. Not `skipped` — absent. No run object was created.

---

## §3 Finding — FD-50

### §3.1 Two independent disablement layers

| Layer | Mechanism | Detectable by |
|---|---|---|
| **YAML** | trigger block commented out in the workflow file | `git show origin/main:<path>` + grep |
| **API** | `disabled_manually` via GitHub UI or API | `gh workflow list --all` **only** |

`deploy-dev.yml` is disabled at **both** layers. `auto-merge-to-dev.yml` is disabled at the **API layer only**.

No read of a workflow file can observe the API layer. `git show` returns bytes; `disabled_manually` is not in the bytes.

### §3.2 Consequence 1 — v1.25 §6.1 step 6 is defective

v1.25 §6.1 step 6 reads:

> `auto-merge-to-dev.yml` → opt-out / backend-syntax / `-X ours` steps intact.

Run against `origin/main` today, that check **passes**. The steps are intact. The workflow cannot run.

A cold session following v1.25's corrected derive sequence would confirm the workflow is sound and conclude it is live. This is FD-49's own failure — *"a session that believed it had verified live"* — reproduced inside the revision that named it.

v1.25's body is preserved per the additive-supersede convention. Step 6 is superseded by pointer to §5 below. v1.25 was correct on the evidence available at its authoring; recording that it was superseded is more useful to a cold reader than concealing that it shipped.

### §3.3 Consequence 2 — the standing `deploy-dev.yml` grep is necessary but insufficient

The standing check —

    git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"

— verifies the **YAML layer** and nothing else. Empty output means the trigger block is commented. It says nothing about `disabled_manually`.

Two failure directions, both live:

1. **YAML re-enabled, API still disabled.** Grep fires, register records "armed," workflow is dead. False alarm; work is done against a phantom risk.
2. **API re-enabled, YAML still commented.** Grep returns empty, register records "disabled," and the workflow arms silently on the next YAML edit. **This is the dangerous direction.**

The check is retained. It is no longer sufficient alone.

### §3.4 Consequence 3 — `[skip-automerge]` has been decorative since 2026-06-27

The token gates a workflow that cannot run. It shipped in the titles of PR #908 (v1.24) and PR #909 (v1.25) and had no effect in either case, because `Auto-merge to Dev` was `disabled_manually` throughout.

This is **not a defect**. The token is correct, costs nothing, and must continue to be used — it is the only protection if the workflow is re-enabled. What is recorded here is that the register believed the token was load-bearing during a period when it was not, and no read in any prior derive sequence could have revealed that.

### §3.5 Consequence 4 — the prod freeze has an enforcement mechanism

`Deploy to Production` (224506683) is `disabled_manually`. The frozen-prod posture is enforced at the API layer, not maintained by convention alone. This was not previously recorded in the register.

`Deploy to Development` (224506682) is likewise `disabled_manually`, in addition to its YAML-layer disablement.

---

## §4 Finding — FD-51

### §4.1 Empty output is not evidence of absence

A grep returning nothing means one of two things:

1. The command ran and found nothing.
2. The command did not run.

**Only the first is authority.** Distinguishing them requires the exit status **of the read itself — not of the pipeline it sits in** — and no register artifact has ever recorded either.

### §4.2 The live instance

The standing verification command, in its Bash form:

    git show origin/main:.github/workflows/deploy-dev.yml | grep -E "^\s*push:"

Under Git-Bash, MSYS path conversion mangles the git revision argument — `origin/main:.github/workflows/deploy-dev.yml` becomes a Windows-style path — and `git show` errors. The pipeline emits nothing on stdout.

**A cold reader sees empty output and concludes "no push trigger — disabled."** The command never executed. The conclusion is accidentally correct today, and would be accidentally wrong the moment someone re-enables the trigger.

**The naive guard fails against this exact instance.** In Bash, `$?` after a pipeline is grep's exit status, not `git show`'s — and grep exits `1` both when it ran and matched nothing, and when its stdin was empty because the upstream command fatalled. The two are indistinguishable. Demonstrated live, 2026-07-09:

    mangled read (git show fatals):        $? = 1    ${PIPESTATUS[0]} = 128
    clean read, no match (PATHCONV off):   $? = 1    ${PIPESTATUS[0]} = 0

"Check the exit status before trusting empty," as this finding was first drafted, would have passed the mangled read — a remediation that is itself an instance of the defect it names. Discriminating the two requires `${PIPESTATUS[0]}`, `set -o pipefail`, or splitting the read from the grep (redirect `git show` to a file, check that write succeeded, then grep the file). The PowerShell form is asymmetric here and safe: `Select-String` is a cmdlet and does not set `$LASTEXITCODE`, so `$LASTEXITCODE` after the pipeline carries `git show`'s status. That asymmetry — the same-shaped pipeline with opposite exit-status semantics — is the trap.

The inline note inside `deploy-dev.yml` uses the PowerShell `Select-String` form, which is correct in this environment. The *derive sequence* has never carried the guard.

### §4.3 Scope

FD-51 is not specific to workflow files. It applies to every `git show … | Select-String` in the register: a typo'd path, a renamed file, a deleted document, a mangled revision argument — each returns empty, and empty has been read as state throughout the audit.

This generalizes FD-49's lesson one step further. FD-49: *prose about the state of other documents is never authority.* FD-51: **a command's output is not authority over what it searched for unless the read itself succeeded — and in a pipeline, the pipeline's exit status does not tell you that.**

---

## §5 Amended derive sequence

Replaces v1.25 §6.1 step 6. Steps 1–5 of v1.25 §6.1 are retained unchanged.

    6. gh workflow list --all
       → runtime state for every workflow. `disabled_manually` is authority.
       A workflow file's contents cannot reveal this. Read it first.

    7. For any workflow the register treats as live:
       git show origin/main:.github/workflows/<file> → YAML-layer trigger state
       Both layers required. Neither alone is authority.

       NOTE (FD-51): empty output is authority ONLY if the READ succeeded.
       Checking `$?` after a pipeline gives grep's status, not git show's —
       and grep exits 1 both when it ran-and-matched-nothing and when its
       input was empty because the upstream command fatalled. The two are
       indistinguishable. Use `${PIPESTATUS[0]}`, or `set -o pipefail`, or
       redirect to a file and check the read before grepping. The PowerShell
       `Select-String` form is safe: `$LASTEXITCODE` carries `git show`'s
       status. Under Git-Bash, `git show origin/main:<path>` is additionally
       path-mangled by MSYS to an error; `MSYS_NO_PATHCONV=1` fixes the
       mangling but not the pipeline-status problem.

---

## §6 Decisions log — additions FD-50, FD-51

v1.25 ended at FD-49. v1.26 adds FD-50 and FD-51.

- **Decision FD-50: Workflow runtime state is not derivable from workflow file contents.** GitHub Actions workflows carry two independent disablement layers: a YAML layer (trigger block commented out, visible to `git show`) and an API layer (`disabled_manually`, visible only to `gh workflow list --all`). `auto-merge-to-dev.yml` on `origin/main` declares `on: push: branches: ['claude/**']`, uncommented, with its `[skip-automerge]` gate and `-X ours` strategy intact — and is `disabled_manually` (ID 244372826). Last run `28289464941`, 2026-06-27; `origin/dev` HEAD `dc18b83d`, same date. Two pushes on 2026-07-08 produced zero run objects. **Remediation:** `gh workflow list --all` enters the derive sequence as a required step preceding any workflow-file read (§5). **Consequences:** v1.25 §6.1 step 6 is defective and is superseded by pointer (§3.2); the standing `deploy-dev.yml` push-trigger grep is necessary but insufficient and must be paired with the API-layer read (§3.3); `[skip-automerge]` has been decorative since 2026-06-27 and is retained regardless (§3.4); `Deploy to Production` (224506683) and `Deploy to Development` (224506682) are both `disabled_manually`, meaning the prod freeze is enforced rather than conventional (§3.5). (Verification trail: §2, all live reads, 2026-07-09.)

- **Decision FD-51: A command's empty output is not authority over the absence of what it searched for, unless the read itself exited 0 — a status a pipeline's `$?` does not report.** Empty stdout means either that the command ran and matched nothing, or that the command did not run. Only the first is evidence. The register has never recorded exit status. Live instance: the standing `deploy-dev.yml` verification command, in Bash form, is silently mangled by Git-Bash MSYS path conversion — `git show origin/main:<path>` becomes a Windows-style path, `git show` errors, and the pipeline emits nothing. A reader sees empty output and concludes the trigger is disabled. The command never executed; the conclusion is accidentally correct today and would be accidentally wrong after any re-enablement. **Remediation:** the guard is carried explicitly in the derive sequence (§5, step 7 NOTE), with one correction made before this revision shipped: the naive guard — check `$?` after the pipeline — fails open, because `$?` carries grep's status and grep exits 1 both on ran-and-matched-nothing and on empty-stdin-because-upstream-fatalled (demonstrated live 2026-07-09: mangled read `$?`=1 / `${PIPESTATUS[0]}`=128; clean no-match read `$?`=1 / `${PIPESTATUS[0]}`=0). Use `${PIPESTATUS[0]}`, `set -o pipefail`, or split the read from the grep. The PowerShell `Select-String` form is safe because `$LASTEXITCODE` carries `git show`'s status; `MSYS_NO_PATHCONV=1` fixes the path-mangling only, not the pipeline-status blindness. **Scope:** FD-51 is not workflow-specific. It applies to every `git show … | Select-String` in the register — typo'd paths, renamed files, deleted documents, mangled revision arguments all return empty. **Register lesson:** FD-49 established that prose about the state of other documents is never authority. FD-50 establishes that a file's contents are not authority over that file's runtime state. FD-51 establishes that a read is not authority unless it happened. The three are one family: *a signal shaped like state, that is not state.*

---

## §7 Retained from v1.25 (explicitly not superseded)

- **FD-48** and **FD-49** as minted. Their verification trails stand.
- **v1.25 §6.1 steps 1–5** unchanged. Step 6 superseded per §5.
- **§5 ruling: Phase B G1 does not reopen.** Ruled by the maintainer (Evoni), 2026-07-08. Untouched.
- **FD-31** (prod three-axis split-brain, P0) remains **OPEN**. G2 §4.2 execution remains **BLOCKED**.
- **FD-47** as minted, subsumed by FD-48. Not closed.

---

## §8 Explicitly out of scope — flagged only, no register entry

- **`Copilot cloud agent` (ID 229363646, active).** The sole active workflow other than `Validate` (247402926). It is a candidate for the F-Deploy-G1-Y autonomous PR-opening mechanism, which has never been positively identified. **No verification trail exists. It is not named as cause.** Naming a suspect in the register without evidence is the origination pattern FD-48 was minted against.

- **`auto-merge-live.yml`.** Untracked, in the repository root. GitHub registers workflows only under `.github/workflows/`; a file in the root cannot run regardless of its contents. Its presence is unexplained. No action.

- **`deploy-dev.yml`'s inline reference to the `[3] window`.** Live pointer to gated work. Not inherited, not read, not acted on by this revision.

---

## §9 Register hygiene

- Register tail at v1.26 open: FD-49 (v1.25). FD-50 and FD-51 minted here. Tail at close: FD-51.
- FD numbers are minted only by Fix Plan revisions — this revision conforms.
- v1.26 was authored against `origin/main` at `47e6fe9f` (v1.24), while its predecessor v1.25 was still unmerged on PR #909. It ships from a branch cut from `f69dd726` (v1.25 merged). Ship order was #909 first — v1.26's §5 amendment is meaningless until v1.25 §6.1 exists on main. That ordering is satisfied at this commit.
- v1.26 closes no findings, advances no gates, authorizes no prod-box or dev-box action.

---

## §10 What v1.26 unblocks

Nothing new. The G2 citation-repair pass remains unblocked per v1.25 §10 — doc-only, no prod access.

G2 §4.2 *execution* remains **BLOCKED** on FD-31.

---

*End of F-Deploy-1 Fix Plan v1.26 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-09.*
*Predecessor: v1.25.*
*Closed: none. Minted: FD-50, FD-51. Advances no gate; authorizes no prod-box action. [skip-automerge]*
