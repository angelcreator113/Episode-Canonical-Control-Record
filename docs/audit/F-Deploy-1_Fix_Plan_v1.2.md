# F-Deploy-1 Fix Plan v1.2

**Phase A G2 progress — F-Deploy-G1-P closed (PR #705/A-1b); sub-form D partial findings; F-Deploy-G1-Y still open**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.1 (Gate A-G1 closure, merged 2026-05-16 via PR #703) |
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (main, merged via PR #698) |
| **Author start date** | 2026-05-17 |
| **Author session** | Single session, post-A-1b ship |
| **Status** | DRAFT v1.2 |
| **Sub-form scope** | A (closed: F-Deploy-G1-P), D (partial: extension finding) |
| **Open keystone items** | F-Deploy-G1-Y diagnostic; sub-form C (PR C-1 branch protection) |

## §1 Purpose

v1.2 documents the Phase A G2 progress between v1.1's Gate A-G1 close (2026-05-16) and the A-1b ship (2026-05-17). Specifically:

1. **A-1b shipped via PR #705**, replacing PR #704's contaminated commit lineage with a clean main-branched delivery. PR #704 stays open as the F-Deploy-G1-Y incident record.
2. **F-Deploy-G1-P closed** upon PR #705 merge to main (squash commit `1f548aed`). The hardcoded bang-prefix exclusion list is removed; the `[skip-automerge]` opt-out grep is live on main.
3. **Sub-form D partial findings**: `loki-laufeyson.intelligent-assistant` extension identified, removed, evidence partially preserved. Not conclusively the F-Deploy-G1-Y actor; warranted removal regardless.
4. **F-Deploy-G1-Y status updated**: one favorable data point (no amendment under VS Code closed + extension removed conditions) but variables not isolated; diagnostic remains open.

What v1.2 does NOT do:
- Does not close F-Deploy-G1-Y. Diagnostic remains open.
- Does not advance sub-form C (branch protection / PR C-1).
- Does not amend v10 audit handoff.
- Does not address PR #704 disposition beyond confirming its incident-record status.

## §2 Reference documents

| Document | Section reference | Role in v1.2 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` (main, PR #699) | §5.1 (sub-form A decisions), §5.3 (sub-form D diagnostic), §11 (FD-1 through FD-12) | Original Phase A plan; v1.2 closes work scoped at v1.0 §5.1 (sub-form A) |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.1.md` (main, PR #703) | Gate A-G1 closure; FD-13 through FD-15 | Predecessor revision; v1.2 follows v1.1's revision pattern |
| `docs/audit/F-Deploy-1_G1_Audit.md` (main, PR #698) | F-Deploy-G1-P (sub-form A finding), F-Deploy-G1-Y (sub-form D finding) | Source for closure attribution |
| `docs/audit/Prime_Studios_Audit_Handoff_v10.docx` (main, PR #701) | §4.2 (F-Deploy-1 keystone status), §7.3 Decisions #103, #104 | Audit canonical state at v1.2 author start |

**Git artifacts referenced in v1.2:**

| Artifact | What it is |
|---|---|
| PR #704 (`claude/f-deploy-1-a-1-opt-out-token`) | Original A-1 ship; commit `0195a2f4` is the amended head. Open as F-Deploy-G1-Y incident record. |
| PR #705 (squash commit `1f548aed`) | A-1b clean delivery. Merged to main 2026-05-17T17:21:25Z. Closes F-Deploy-G1-P. |
| Branch `claude/test-skip-automerge-postremoval` (commit `441e4709`) | F-Deploy-G1-Y diagnostic test commit. Pushed under VS Code closed + extension removed conditions. SHA matched remote; brackets intact. Auto-merged to dev as `f60cec71` because main's workflow at that time did not yet have the opt-out. |
| GitHub Actions run 25994349058 | Auto-merge to Dev run for the test commit. Workflow read main's HEAD (no opt-out yet); merged to dev as expected. |
| GitHub Actions run 25995006106 | Auto-merge to Dev run for A-1b's push. Workflow read A-1b's HEAD (opt-out present); detected `[skip-automerge]`; exit 78; no dev merge. Empirical verification of opt-out grep behavior. |

**Evidence preserved on local machine (not in repo):**

| Artifact | Path | Status |
|---|---|---|
| `loki-laufeyson.intelligent-assistant-1.0.9` partial zip | `~/Desktop/intelligent-assistant-evidence-1.0.9.zip` (714 bytes, partial) | Captured 2026-05-17 ~00:45 EDT. Partial due to source directory being deleted during compress. Not a full forensic copy. |
| Source files for partial zip | `~/Desktop/intelligent-assistant-evidence-1.0.9-files/` | Companion to the zip; also partial. |
| Extension data captured in this session's chat transcript | (not on disk) | Full package.json, README, four-layer identity mismatch, hardcoded URL to `Herm-Studio/Herm-assistant`, marketplace listing properties. |

## §3 Phase A G2 closures since v1.1

v1.1 closed Gate A-G1 (pre-flight) on 2026-05-16. v1.2 documents Phase A G2 progress in the 24 hours that followed.

### §3.1 F-Deploy-G1-P closed via PR #705 (A-1b)

**Finding (per G1 §3.1.1 / Fix Plan §12 Appendix A):** `auto-merge-to-dev.yml` used a hardcoded `branches:` bang-prefix exclusion list:

```yaml
branches:
  - 'claude/**'
  - '!claude/start-f-stats-1-g2'
  - '!claude/f-stats-1-phase-b-**'
```

The list required manual workflow edits per new incident class. Each F-Stats-1-class branch that needed opt-out required a workflow PR. Pattern was unsustainable; documented as F-Deploy-G1-P (P0).

**Closure (PR #705 / squash commit `1f548aed`):** Replaces the bang-prefix exclusion list with a commit-message grep:

```yaml
- name: Check for [skip-automerge] opt-out token
  run: |
    COMMIT_MSG="${{ github.event.head_commit.message }}"
    if echo "$COMMIT_MSG" | grep -qi '\[skip-automerge\]'; then
      echo "Opt-out token detected in commit message."
      echo "Branch: ${{ github.ref_name }}"
      echo "Commit: ${{ github.event.head_commit.id }}"
      echo "Neutral-exiting job (exit 78)."
      exit 78
    fi
    echo "No opt-out token. Proceeding with auto-merge to dev."
```

Authors include `[skip-automerge]` (case-insensitive, brackets required) in the head commit message; the workflow neutral-exits via exit 78. No workflow edit needed per incident class.

**Closure attribution:** F-Deploy-G1-P → CLOSED via PR #705 merge to main 2026-05-17T17:21:25Z.

### §3.2 A-1b ship sequence

A-1b is the clean re-delivery of PR A-1's content after PR #704's commit `3634b34d` was amended to `0195a2f4` (brackets stripped). See §4.5 for the PR #704 incident details; this section documents only the A-1b mechanics.

**Sequence:**

| Step | Action | Result |
|---|---|---|
| A.1 | Verified clean state on main (`ea76f51b`), VS Code closed | Clean working tree, no Code processes |
| A.2 | Branched `claude/f-deploy-1-a-1b-opt-out-token` from main | HEAD: `ea76f51b` |
| A.3 | `git checkout origin/claude/f-deploy-1-a-1-opt-out-token -- .github/workflows/auto-merge-to-dev.yml` | File staged; diff = 20 insertions, 2 deletions; opt-out logic present |
| A.4 | Commit with 4-paragraph message ending in `[skip-automerge]` | Local SHA: `53ad964d`; all four `[skip-automerge]` tokens intact |
| A.5 | Pre-push Rule 7 gate (explicit confirmation) | Confirmed |
| A.6 | `git push -u origin claude/f-deploy-1-a-1b-opt-out-token` | Remote SHA: `53ad964d`; SHA match; brackets intact |
| A.6.b | Auto-merge to Dev workflow run 25995006106 | Read A-1b's HEAD workflow (with opt-out); detected `[skip-automerge]`; exit 78; no dev merge — empirical verification of opt-out grep |
| A.7 | `gh pr create --base main --head claude/f-deploy-1-a-1b-opt-out-token` | PR #705 opened |
| A.8 | `gh pr merge 705 --squash --delete-branch` | Merged to main as squash commit `1f548aed`; branch deleted |
| A.9 | Verified main HEAD and workflow content | Main at `1f548aed`; `.github/workflows/auto-merge-to-dev.yml` contains opt-out grep |

**Each step gated by Rule 7** (draft → confirm → execute) for real shared-state changes (push, PR create, merge).

**Pre-push test conditions:** VS Code closed throughout commit creation and push verification. Working tree clean. Loki extension already removed (see §4.2).

### §3.3 F-Deploy-G1-Y test result

A separate test commit was pushed before A-1b to test the F-Deploy-G1-Y mechanism under post-extension-removal conditions:

| | |
|---|---|
| Branch | `claude/test-skip-automerge-postremoval` |
| Commit | `441e4709` |
| Modification | Single comment line appended to `scripts/morning-soak-check.ps1` |
| Commit message | Subject contained `[skip-automerge]`; third paragraph contained `[skip-automerge]` |
| VS Code state | Closed (verified empty `Get-Process -Name "Code"` immediately before push) |
| Loki extension state | Removed earlier in session |
| Local SHA | `441e47093fc0192976a4bee70b77fabecda54fb9` |
| Remote SHA | `441e47093fc0192976a4bee70b77fabecda54fb9` |
| SHA match | True |
| Brackets in remote message | Present, intact |
| Dev merge outcome | Auto-merged to dev as `f60cec71` (workflow at main's HEAD at push time did not yet have opt-out) |

**Result:** No commit amendment occurred. SHA matched, brackets intact.

**Interpretation:** One data point. Two variables changed from PR #704 conditions (VS Code closed; loki extension removed). Cannot isolate which (if either) was the deciding factor without further testing. See §5 for F-Deploy-G1-Y status.

## §4 Sub-form D diagnostic — partial findings

Sub-form D per G1 §3.7 and Fix Plan v1.0 §5.3 is the diagnostic phase for F-Deploy-G1-Y (autonomous PR-opening) and F-Deploy-G1-Z (commit identity drift). v10 §4.2 narrowed the candidate space to Copilot Workspace and Claude Code based on observed branch artifacts. This session expanded the candidate inventory, identified a new candidate not in v10 (`loki-laufeyson.intelligent-assistant`), and removed it.

v1.2 documents the expansion and removal. It does NOT conclude the diagnostic; F-Deploy-G1-Y remains open. See §5.

### §4.1 Candidate inventory expansion

v10 §4.2 named two confirmed-present candidates:
- Copilot Workspace (local branch `copilot/worktree-2026-03-11T12-57-09`)
- Claude Code VS Code extension (origin branches `claude/**-XXXXX` random-suffix pattern)

v1.1 §4.1 added (during Gate A-G1 pre-flight):
- `automatalabs.copilot-mcp` (Copilot MCP bridge)
- `eamodio.gitlens` (GitLens with AI commit-message features)
- `github.copilot-chat` (Copilot Chat with @workspace /generateCommitMessage)
- `danielsanmedium.dscodegpt` (CodeGPT, AI commit messages)
- `loki-laufeyson.intelligent-assistant` (1.0.9 — third-party, unknown publisher; flagged as new candidate)

v1.2 expands the diagnostic with file-system-level inspection of each candidate (read-only, evidence-preserving per Fix Plan §5.3.1). The most material finding is `loki-laufeyson.intelligent-assistant`.

### §4.2 `loki-laufeyson.intelligent-assistant` identification

**Identification evidence collected (all read-only):**

| Evidence source | Finding |
|---|---|
| Marketplace listing (`marketplace.visualstudio.com/items?itemName=loki-laufeyson.intelligent-assistant`) | 1,253 installs total; 2 ratings; "loki laufeyson" publisher name (Marvel character pseudonym); no verified publisher badge |
| Extension `package.json` | Publisher: `loki-laufeyson`. Repository: `github.com/WongLoki/intelligent-assistant` (name mismatch with publisher). Permissions: terminal execute, file read/write, project creation. Dependency: `@anthropic-ai/sdk ^0.25.1` |
| Extension `README.md` | Verbatim copy of Cline's README (Saoud Rizwan's project), with "Cline" substituted by "Intelligent Assistant" |
| Bundled `dist/extension.js` URL extraction | URLs referenced: `api.anthropic.com`, `bitinn/node-fetch`, `jimmy.warting.se/opensource` (normal SDK dependencies), and `github.com/Herm-Studio/Herm-assistant/blob/main/src/Sonnet.ts` (third undisclosed namespace) |
| Codebase grep for `loki-laufeyson`, `intelligent-assistant`, `OnCpmmand` | Zero matches outside of `F-Deploy-1_Fix_Plan_v1.1.md`'s own candidate inventory. Not part of Prime Studios. |
| VS Code globalStorage and workspaceStorage directories | No state directory found. Extension may have never been activated, or state stored in-memory only. |
| Install timestamp (`__metadata.installedTimestamp` in package.json) | 1768907948661 → 2026-01-19. User had no clear memory of installing it. |

**Identity-laundering pattern:**

Four mismatched identities across the extension's surfaces:

1. README credits "Saoud Rizwan" (Cline's author)
2. `package.json` repository: `github.com/WongLoki/intelligent-assistant`
3. Marketplace publisher: `loki-laufeyson`
4. Bundled code references: `github.com/Herm-Studio/Herm-assistant`

No legitimate scenario explains four undisclosed naming layers. This is by itself sufficient cause for removal regardless of F-Deploy-G1-Y role.

### §4.3 Removal sequence

| Step | Action |
|---|---|
| 1 | Marketplace listing screenshot captured (evidence: 1,253 installs, no verified publisher badge) |
| 2 | Extension `package.json` and `README.md` content captured in session transcript |
| 3 | Bundled `dist/extension.js` URL strings extracted |
| 4 | Codebase grep run — confirmed not part of Prime Studios |
| 5 | Anthropic API usage console reviewed Jan–May 2026 — no unexplained usage attributable to this extension |
| 6 | Compress-Archive attempted on extension directory for forensic preservation. Partial result (714 bytes, source directory deleted mid-read) |
| 7 | Extension removed via user-initiated delete (folder removal) |
| 8 | `extensions.json` registry edited to remove orphan entry (file size dropped from 46826 to 46180 bytes; loki entry count went 1 → 0) |
| 9 | VS Code restarted; registry state confirmed clean post-restart |

**Resulting state:**
- Extension files: gone
- Registry entry: gone
- Partial forensic zip: preserved on `~/Desktop/` (incomplete but exists)
- Full diagnostic detail: captured in session transcript

### §4.4 Causal status — not concluded

The diagnostic question per Fix Plan v1.0 §5.3.2 D-6 cross-correlation is: *was this extension the F-Deploy-G1-Y actor?*

**v1.2 cannot answer this conclusively.** Evidence is consistent with both:
- (a) Extension was the actor; removal closes F-Deploy-G1-Y
- (b) Extension was dormant (empty state directory); F-Deploy-G1-Y actor is one of the remaining candidates

The test commit `441e4709` and the A-1b commit `53ad964d` both pushed cleanly post-removal with no amendment. This is **one data point favorable to (a)** but does not isolate the variable from "VS Code closed."

A controlled re-test with VS Code open + extension absent would distinguish (a) from (b). Deferred to a future revision. See §5.3.

### §4.5 PR #704 reinterpretation

v10 §4.2 documented F-Deploy-G1-Y as "autonomous PR-opening mechanism, unidentified." The PR #704 incident on 2026-05-16 (commit `3634b34d` → `0195a2f4`, brackets stripped) was characterized as F-Deploy-G1-Y on the commit-amendment surface.

v1.2 corrects one inferential error in the original interpretation:

**Incorrect inference (corrected here):** "The auto-merge-to-dev workflow merged PR #704's commit to dev despite [skip-automerge] because the opt-out logic was not yet active on main."

**Corrected interpretation:** The auto-merge-to-dev workflow runs the YAML version on the branch being pushed, not the version on main. PR #704's branch *did* have the opt-out grep. The grep ran. It received `0195a2f4`'s message (brackets already stripped by the amendment) and did not match. The workflow fell through and merged to dev.

**The amendment specifically defeated the existing opt-out.** The bracket-strip was not a side effect of some other action; it was the precise modification needed to defeat the grep. This makes F-Deploy-G1-Y a more concerning finding than originally framed — the actor's behavior is tuned to (or at least incidentally defeats) the specific token used.

**Implication:** When designing future controlled tests, the actor cannot be assumed to be naive. It may behave differently with VS Code in different states, with the extension present vs. absent, with different commit message tokens, etc.

## §5 F-Deploy-G1-Y current status

F-Deploy-G1-Y per G1 §3.7 is the finding that "an autonomous mechanism" produces PR-opening and commit-amendment behavior on Evoni's local environment without explicit user invocation. v10 §4.2 narrowed the candidate space; v1.1 expanded the candidate inventory; v1.2 identified and removed one candidate.

The finding remains **OPEN** at v1.2 close.

### §5.1 What is known at v1.2

1. **PR #704 amendment is real and timed.** Reflog shows `3634b34d` at 2026-05-16 20:28:51 EDT, `0195a2f4 (amend)` at 2026-05-16 20:31:24 EDT. Author-date precedes commit-date by 2 minutes 33 seconds. Reflog tag is `commit (amend)`, not a hook or external script invocation.

2. **The amendment specifically defeats the `[skip-automerge]` grep.** Brackets were stripped from a token that the grep pattern requires literally. The commit body was wiped. The amendment was not random — it surgically removed the opt-out's matching characters.

3. **One data point of non-recurrence post-extension-removal:** test commit `441e4709` (VS Code closed, loki extension removed) and A-1b commit `53ad964d` (same conditions) both pushed cleanly. SHAs matched remote; brackets intact.

4. **Two variables changed simultaneously** between PR #704's conditions and the test conditions: VS Code state (open → closed) and loki extension state (present → removed). Cannot isolate which (or both) is causally relevant.

5. **Candidate inventory at v1.2 close:**
   - Copilot Workspace (confirmed present)
   - Claude Code VS Code extension (confirmed present; deliberately used)
   - `automatalabs.copilot-mcp` (Copilot MCP bridge — confirmed present)
   - `eamodio.gitlens` (confirmed present)
   - `github.copilot-chat` (confirmed present)
   - `danielsanmedium.dscodegpt` (confirmed present)
   - `loki-laufeyson.intelligent-assistant` (REMOVED)

### §5.2 What is not known at v1.2

1. **Which candidate (if any of the remaining six) is the F-Deploy-G1-Y actor.** No tool has been positively identified as the actor; the loki extension's role is suggested but not proven.

2. **Whether F-Deploy-G1-Y is reproducible under "VS Code open + loki absent" conditions.** This is the test that would isolate the loki extension's contribution.

3. **Whether F-Deploy-G1-Y is reproducible under "VS Code closed + commit message containing other tokens."** Unknown whether the actor targets `[skip-automerge]` specifically or any bracketed-token pattern.

4. **What action triggered the amendment.** Could be IDE-resident (extension watching git operations), shell-resident (git hook, alias), or OS-resident (scheduled task, daemon). Pre-flight checks at v1.1 ruled out git hooks (`core.hooksPath` not customized, only `.sample` files in `.git/hooks/`). Other vectors remain.

### §5.3 What is deferred to future revisions

Per Fix Plan v1.0 §5.3 the sub-form D diagnostic produces an artifact with one of three outcomes (identified — single source / identified — multi-source / unidentifiable with accepted residual risk). v1.2 does not commit to an outcome.

**Deferred to v1.3 or later:**

- **Controlled re-test with VS Code open + loki absent.** Isolates whether VS Code state or extension presence was the deciding factor for the favorable test result.
- **Controlled re-test with each remaining candidate disabled one at a time** (binary elimination). Most diagnostic, slowest. Six candidates × one re-test each = six test cycles minimum.
- **`.claude/ide/` lock file investigation.** v1.2 surfaced that Claude Code's IDE session locks accumulate over time (~70 lock files dating back to December 2025). Whether this is normal Claude Code behavior or worth examining further is unclear and deferred.
- **PR #704 disposition.** Currently preserved as incident record. When (and if) to close PR #704 is deferred — likely after F-Deploy-G1-Y close or downgrade.

**Not deferred — handled in this session:**
- Extension removal and registry cleanup (§4.3)
- A-1b ship and F-Deploy-G1-P close (§3)
- PR #704 reinterpretation (§4.5)
- v1.2 documentation (this document)

### §5.4 Phase A G2 close criteria status

Per Fix Plan v1.0 §5.4 sequence, Phase A G2 closes when sub-form A PRs (A-1, A-2, A-3) ship and the diagnostic phase G3 produces its artifact. v1.2 advances Phase A but does not close G2:

| Phase A G2 component | Status at v1.2 close |
|---|---|
| Sub-form A — A-1 (opt-out logic) | SHIPPED (PR #705 / A-1b; F-Deploy-G1-P closed) |
| Sub-form A — A-2 (backend build verification) | NOT STARTED |
| Sub-form A — A-3 (`-X ours` author notification) | NOT STARTED |
| Sub-form C — C-1 (branch protection) | NOT STARTED |
| Sub-form D — diagnostic artifact | PARTIAL (loki finding documented; F-Deploy-G1-Y unresolved) |

Phase A G2 close requires A-2, A-3, C-1, and a sub-form D resolution (per Fix Plan v1.0 §5.5 soak criteria). v1.2 closes one of these (sub-form A's A-1). Remaining items are scoped for v1.3 and beyond.

## §6 Decisions log — additions FD-16 through FD-20

Decisions made during v1.2 authoring, locking commitments made during the session work. Fix Plan v1.0 ended at FD-12; v1.1 added FD-13 through FD-15; v1.2 adds FD-16 through FD-20.

- **Decision FD-16: A-1b ships as PR #705, branched from clean main, no ancestry from PR #704's amended commit.** Per §1.2 caveat in Fix Plan v1.0 ("A-1 itself may not fit the new opt-out rules"), the A-1 work needed re-delivery after PR #704's commit was contaminated. v1.2 commits to A-1b as a fresh PR rather than amending PR #704 or rebasing. Rationale: keeps PR #704 intact as F-Deploy-G1-Y incident record; produces a clean main commit (`1f548aed`) with no inherited lineage from `0195a2f4`. (§3.2.)

- **Decision FD-17: PR #704 reinterpretation.** The PR #704 incident is not "the workflow merged because the opt-out wasn't active." The opt-out was active on PR #704's branch and ran on push. The amendment (`3634b34d` → `0195a2f4`) stripped brackets, causing the grep to not match, causing the workflow to fall through to merge. The amendment is therefore not random commit modification; it is behavior tuned to (or incidentally defeating) the specific opt-out token pattern. (§4.5, §5.1 item 2.)

- **Decision FD-18: `loki-laufeyson.intelligent-assistant` 1.0.9 removed; F-Deploy-G1-Y causal role not concluded.** Extension exhibits identity-laundering pattern (four mismatched naming layers); permissions include terminal execute and file read/write; no globalStorage state directory (suggesting never-activated or in-memory-only state). Removed regardless of F-Deploy-G1-Y role. Causal contribution to F-Deploy-G1-Y is suggested by one favorable test data point but not isolated; cannot be concluded without controlled re-test under VS Code open + extension absent conditions. (§4.2, §4.3, §4.4.)

- **Decision FD-19: F-Deploy-G1-Y test result interpreted as one data point, not as closure.** Test commit `441e4709` and A-1b commit `53ad964d` both pushed cleanly under VS Code closed + loki extension removed conditions. SHAs matched remote; brackets intact. Two variables changed simultaneously from PR #704's conditions; cannot isolate cause. v1.2 explicitly does not close F-Deploy-G1-Y on this evidence. (§3.3, §5.1, §5.2.)

- **Decision FD-20: Empirical verification of opt-out grep behavior recorded as positive evidence.** GitHub Actions run 25995006106 (A-1b's push) demonstrated the workflow's opt-out grep matches `[skip-automerge]` correctly, fires exit 78, and prevents the dev merge. This is positive empirical evidence — the opt-out mechanism is now known to work end-to-end, not merely "shipped." Future controlled tests can rely on the opt-out to prevent dev contamination during diagnostic pushes. (§3.1, §3.2.)

## §7 What v1.2 unblocks / does not unblock

### §7.1 What v1.2 unblocks

**F-Deploy-G1-P closed.** The hardcoded bang-prefix exclusion list pattern is retired. Future incident classes no longer require workflow PRs to add exclusions — authors include `[skip-automerge]` in the head commit message.

**Diagnostic pushes are now safe.** Future controlled tests for F-Deploy-G1-Y (or any other Phase A diagnostic) can push to `claude/**` branches with `[skip-automerge]` in the commit message and the workflow will neutral-exit without merging to dev. This removes the "every test contaminates dev" constraint that made the original PR #704 incident harder to diagnose. (Empirically verified at run 25995006106; see FD-20.)

**Sub-form A's A-2 and A-3 unblocked.** PR #705's ship demonstrates the A-1b pattern (branch from main, copy file from PR #704 source, ship via PR with `[skip-automerge]`). A-2 (backend build verification, FD-4 Change A-2.2) and A-3 (`-X ours` author notification, FD-4 Change A-2.3) can ship via the same pattern. Per Fix Plan v1.0 §5.1.2, A-2 and A-3 are independent of each other and of A-1; can ship in parallel.

**Sub-form C's PR C-1 unblocked.** Branch protection settings change (FD-5 / Fix Plan v1.0 §5.2.1 Decision C-1) is independent of A-1, A-2, A-3 and can ship at any time during Phase A G2. PR C-1 is a separate Rule 7 gate.

### §7.2 What v1.2 does NOT unblock

**Phase A G2 close.** Per Fix Plan v1.0 §5.4 the gate closes when sub-form A (A-1, A-2, A-3) is fully shipped, sub-form C ships, and sub-form D's diagnostic phase produces an artifact resolving F-Deploy-G1-Y. At v1.2 close: A-1 only, no C, partial D. G2 stays open.

**Phase A G4 soak.** Per Fix Plan v1.0 §5.5 the 1-week soak begins after G2 closes. Not started. Cannot start until G2 closes.

**Phase B G1 architectural decision (separate-EC2 α vs shared-safe β).** Per FD-8 deferred to Phase B G1. Phase B begins after Phase A closes through G4 soak. Cannot start until Phase A closes.

**F-Stats-1 Phase B G2.** Per Decision #98 (v10 revised, FD-10) blocked on F-Deploy-1 **Fix Plan Phase A close**. v1.2 advances Phase A but does not close it. F-Stats-1 Phase B G2 remains blocked.

**F-AUTH-1 fix execution.** Per Decision #98 revised in v10, F-AUTH-1's six-step recipe ships downstream of F-Deploy-1 Phase A close to ship through the hardened pipeline. v1.2 advances Phase A but does not close it. F-AUTH-1 execution remains queued.

**Downstream keystone sequence.** F-App-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1 (Director Brain), F-Sec-3 — all downstream of F-AUTH-1 ship, transitively downstream of F-Deploy-1 Phase A close. Unchanged from v10 §4.2.

### §7.3 State of play at v1.2 close

| Tier | Item | Status |
|---|---|---|
| Phase A G1 | Pre-flight | CLOSED (v1.1, PR #703) |
| Phase A G2 | Sub-form A — A-1 (opt-out logic) | SHIPPED (v1.2, PR #705, this revision) |
| Phase A G2 | Sub-form A — A-2 (backend build verification) | NOT STARTED |
| Phase A G2 | Sub-form A — A-3 (`-X ours` author notification) | NOT STARTED |
| Phase A G2 | Sub-form C — C-1 (branch protection) | NOT STARTED |
| Phase A G2 | Sub-form D — diagnostic | PARTIAL (loki removed; F-Deploy-G1-Y open) |
| Phase A G3 | Diagnostic phase | NOT STARTED (per Fix Plan v1.0 §5.3; v1.2's D-work is pre-G3) |
| Phase A G4 | 1-week soak | NOT STARTED (blocked behind G2 close) |
| Phase B | All gates | NOT STARTED (blocked behind Phase A close) |
| Phase C | All gates | NOT STARTED (blocked behind Phase B close) |

**Path A discipline note:** v1.2 ships only what was verified. F-Deploy-G1-Y is not closed; FD-19 makes this explicit. The temptation to declare "loki removed, mystery solved" was resisted in favor of "one data point, two variables, not isolated." Future revisions will close F-Deploy-G1-Y when (and only when) the evidence supports it.

---

*End of F-Deploy-1 Fix Plan v1.2 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-fix-plan-v1-2` (to be created at file-write time).*
*Date: 2026-05-17.*
*Predecessor: v1.1 (PR #703, merged 2026-05-16).*
*Successor: TBD (v1.3 likely scopes A-2 / A-3 / C-1 / F-Deploy-G1-Y diagnostic re-test).*
