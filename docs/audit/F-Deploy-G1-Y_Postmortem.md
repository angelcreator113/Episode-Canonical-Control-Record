# F-Deploy-G1-Y Postmortem — Identified, removal-sufficient

**Status:** Drafted 2026-05-21 during F-Deploy-1 Phase A G4 soak day 2. Local-state only, not committed to main during G4 soak.

**Purpose:** Capture the forensics, evidence progression, and methodological lessons of the F-Deploy-G1-Y investigation that closed via FD-22 on 2026-05-19 (F-Deploy-1 Fix Plan v1.3 §4). The closure record in v1.3 is terse — names the conclusion, cites the evidence count, marks the gate closed. This document is the long-form record: how the investigation went, what was learned methodologically, and where the closure boundary sits.

**Scope:** Postmortem only. Does not modify v1.3 §4. Does not modify FD-22's decision-log entry. References both as canonical sources. Serves as the canonical example for v11 §3.3.4 (removal-sufficient closure type) when v11 ships at soak close.

**Cross-references:**

- F-Deploy-1 Fix Plan v1.3 §4 (FD-22 closure narrative)
- F-Deploy-1 Fix Plan v1.2 §6 FD-19 (deferral on N=1 evidence)
- F-Deploy-1 Fix Plan v1.1 (Gate A-G1 pre-flight where loki was first surfaced)
- v11 §3.3.4 (closure-semantic vocabulary — removal-sufficient pattern)
- Session_PE_Roster.md PE #50 (separate finding — external AWS change during soak; not related but adjacent in time)

---

## §1 What F-Deploy-G1-Y actually was

F-Deploy-G1-Y is the audit handle for an observed behavior on the Prime Studios development environment: **PRs opening on `claude/**` branches without explicit `gh pr create` invocation.**

The behavior was first observed during F-AUTH-1 work cycle (April 2026, exact date in audit handoff v8). The pattern was that branches matching `claude/*-XXXXX` (random-suffix branches consistent with Claude Code's normal operation) would have PRs auto-open against `main` or `dev` without the human operator (JAWIHP / Evoni) running a PR-creation command.

The behavior was problematic because:

1. It created a class of unattributed actions on the GitHub project — PRs appearing without explicit human authorship.
2. It interacted with `auto-merge-to-dev.yml` (the workflow that auto-merged PRs from `claude/**` branches into `dev`) to produce a *full pipeline* from "branch pushed" to "code on dev" without explicit human approval at any step.
3. Combined with `auto-merge.yml` (the workflow that auto-merged dev to main), it had previously created scenarios where code reached main without explicit review — the autonomous-merge cascade documented in audit memory as a primary driver of F-Deploy-1's Path A locking discipline.

F-Deploy-G1-Y's investigative scope was narrower than the broader autonomous-merge problem: specifically the PR-opening mechanism, not the merging behavior. `auto-merge.yml` deletion (2026-05-15 containment per FD-2) addressed the merging side; F-Deploy-G1-Y addressed the upstream "where do these PRs come from" question.

## §2 Timeline of the investigation

### §2.1 First surface: April 2026

F-Deploy-G1-Y was filed during F-Deploy-1 G1 audit (PR #698, 27 findings A through AA). The original framing identified the symptom but not the cause: PRs appearing without `gh pr create` invocation. Two candidate explanations existed at G1 audit time:

- **Copilot Workspace** (locally installed, `copilot/worktree-2026-03-11` branch confirmed on local checkout)
- **Claude Code** (deliberately installed, random-suffix `claude/**-XXXXX` branches consistent with normal operation)

Both were deliberately installed tools. The investigation question at G1 audit was: which tool's normal operation produces PRs without explicit `gh pr create`?

### §2.2 v1.1 pre-flight: additional candidates surfaced

F-Deploy-1 Fix Plan v1.1 (PR #703, merged 2026-05-16) extended the candidate set during Gate A-G1 pre-flight inventory. Six VS Code extensions were surfaced as having permissions consistent with the F-Deploy-G1-Y behavior:

- GitLens
- Copilot Chat
- dscodegpt
- copilot-mcp
- loki-laufeyson.intelligent-assistant
- (plus the two underlying systems: Copilot Workspace, Claude Code)

This was a methodologically important step. The original two-candidate framing was based on "tools known to be installed for PR-creation work." The v1.1 pre-flight broadened to "tools with permissions sufficient to produce the behavior." The set grew from 2 to 7+ candidates without any new evidence about *which* was causal — just better enumeration of who *could* be.

### §2.3 loki-laufeyson identified as anomalous

During v1.1 pre-flight investigation, loki-laufeyson.intelligent-assistant surfaced as having unusual properties. Per FD-18 in v1.2 §6:

- **Layer 1:** Extension marketplace publisher name = "loki-laufeyson"
- **Layer 2:** Extension display name = "intelligent-assistant"
- **Layer 3:** Internal `package.json` name (different from both)
- **Layer 4:** Bundled code contained an undisclosed reference to a separate organization ("Herm-Studio") not mentioned in any marketplace metadata

Four mismatched naming layers across the extension's identity surface. This pattern is not normal for legitimate VS Code extensions, which typically present coherent identity across publisher/display/internal-name surfaces. The mismatch raised concern about the extension's trustworthiness independent of the F-Deploy-G1-Y question.

loki was removed from the local environment on 2026-05-17 as a containment measure. The removal was *not* an assertion that loki caused F-Deploy-G1-Y — it was a precaution given the identity-laundering pattern.

### §2.4 FD-19: the deferral on N=1 evidence

After loki removal, one diagnostic data point was collected:

- 2026-05-17, VS Code closed, loki removed, 30-second wait → clean (no F-Deploy-G1-Y behavior)

This was a single data point. F-Deploy-1 Fix Plan v1.2 §6 FD-19 explicitly *deferred* closure on this evidence:

> "FD-19: Single-data-point evidence is insufficient to claim F-Deploy-G1-Y closure. Two variables changed simultaneously (VS Code state, loki presence); isolation not achieved. Closure deferred to v1.3."

FD-19 is the methodological discipline anchor for this whole investigation. The temptation at N=1 was to declare closure — symptom hadn't recurred, loki was gone, problem solved. FD-19 refused that move on evidence-state grounds.

### §2.5 v1.3: N=8 evidence progression

Between v1.2 close (2026-05-17) and v1.3 author start (2026-05-18), seven additional data points were collected to expand variable isolation:

| # | Date | VS Code state | Wait window | loki state | Behavior |
|---|---|---|---|---|---|
| 1 | 2026-05-17 | closed | 30s | removed | clean |
| 2 | 2026-05-17 | closed | 5min | removed | clean |
| 3 | 2026-05-17 | closed | 15min | removed | clean |
| 4 | 2026-05-18 | open | 30s | removed | clean |
| 5 | 2026-05-18 | open | 2min | removed | clean |
| 6 | 2026-05-18 | open | 5min | removed | clean |
| 7 | 2026-05-18 | open | 10min | removed | clean |
| 8 | 2026-05-18 | open | 15min | removed | clean |

The expansion isolated loki as the consistent variable across both VS Code state conditions and across wait-window durations from 30 seconds to 15 minutes. Under all 8 tested conditions, with loki removed, F-Deploy-G1-Y behavior did not occur.

### §2.6 FD-22: closure as "identified — removal-sufficient"

F-Deploy-1 Fix Plan v1.3 §4.2 closed F-Deploy-G1-Y via FD-22 with the explicit framing "identified — removal-sufficient." The closure narrative was honest about what it did and didn't claim:

**What FD-22 established:**
- Under all tested conditions (VS Code closed/open, wait windows 30s–15min), with loki removed, F-Deploy-G1-Y behavior does not occur.
- Sufficiency of loki removal to halt the behavior.

**What FD-22 did NOT establish:**
- Whether loki was the *unique* causal mechanism.
- Whether other tools in the candidate set could produce identical behavior.
- Whether reintroducing loki would cause F-Deploy-G1-Y to recur (not tested).
- Whether loki's identity-laundering pattern (FD-18) is causally connected to F-Deploy-G1-Y or coincidental.

The closure was a correlation + sufficiency finding, not a causation finding. v10 §4.2 had explicitly permitted this outcome shape ("identified — known tool's normal operation"); v1.3 invoked that branch.

## §3 Methodological lessons

### §3.1 FD-19's deferral was the right move on N=1

The single-data-point evidence at v1.2 was suggestive — loki gone, behavior gone. It would have been easy to declare closure. FD-19 refused.

This refusal had two costs:
- 2 additional days of investigation (v1.2 close 2026-05-17 → v1.3 author start 2026-05-18)
- 7 additional data points to collect

And one benefit:
- The N=8 closure at FD-22 is *meaningfully stronger* than the N=1 closure would have been. With 8 data points spanning two VS Code states and 5 wait windows, the sufficiency claim is robust to a much wider range of conditions than N=1 could support.

If F-Deploy-G1-Y ever recurs in the future, the investigation has a stronger starting point than it would if FD-22 had closed at N=1. The N=8 evidence is "loki removal worked across these specific conditions" — a recurrence would necessarily be either a new variable, a delayed trigger beyond 15 min, or evidence that loki was never the cause.

The lesson: **single-data-point closures of investigations are weak by default. Evidence-state matters; N matters; variable isolation matters. Defer rather than paper over.**

### §3.2 Closure-semantic precision matters

FD-22's language is specifically "identified — removal-sufficient" and not "fixed" or "resolved" or "causation established." This precision is methodologically important.

- "Fixed" implies the cause was understood and addressed.
- "Resolved" implies the problem is gone.
- "Causation established" implies a tested causal chain.

FD-22 claims none of these. It claims only that removal of one candidate was *sufficient* to halt the behavior under all tested conditions. The actual causal mechanism might still be unknown; reintroducing loki might or might not bring back the behavior; other tools might or might not produce the same behavior.

The closure-semantic vocabulary in v11 §3.3 names this pattern explicitly: **removal-sufficient closure**. The pattern is honest when:

1. A symptom has stopped recurring after a specific removal action.
2. Multiple data points span varying conditions to rule out condition-specific behavior.
3. The closure narrative explicitly names what was and wasn't established.
4. A future-revisit clause exists if the symptom recurs.

FD-22 satisfies all four.

### §3.3 Variable isolation matters even after the variable is identified

The 8-data-point evidence wasn't *just* about strengthening the N count. It was specifically designed to isolate variables that v1.2's N=1 couldn't:

- VS Code closed (data points 1-3) vs. VS Code open (data points 4-8) → isolates whether VS Code state matters
- Wait windows 30s through 15min → isolates whether timing matters (delayed triggers vs. immediate)

The N=8 framing demonstrates that *under both VS Code states, across the full tested timing range, with loki absent*, the behavior does not occur. This is more useful than 8 data points all under the same conditions, which would have been N=8 but with the same single variable still confounded.

The lesson: **when designing follow-up evidence to support a closure, pick conditions that *isolate the variable in question*, not conditions that merely repeat the original observation.**

### §3.4 Identity-laundering is its own finding, separate from causation

loki's four-layer naming mismatch (FD-18) is a finding regardless of whether loki caused F-Deploy-G1-Y. Coherent identity across publisher/display/internal-name layers is a basic trustworthiness signal for VS Code extensions. The pattern of *deliberate* identity drift across four layers (publisher = "loki-laufeyson," display = "intelligent-assistant," internal name = something else, bundled code referencing "Herm-Studio") is anomalous.

Two readings of FD-18 vs. FD-22:

- **Reading A (causal):** The identity laundering is what *makes* loki capable of producing F-Deploy-G1-Y behavior. The four layers exist to obscure what the extension actually does. Removing loki halts the behavior because the obscured behavior went with it.
- **Reading B (coincidental):** loki happens to do something that triggers F-Deploy-G1-Y behavior. The identity laundering is a separate concern (publisher trustworthiness) that warrants its own action regardless of F-Deploy-G1-Y causation.

FD-22 does *not* commit to either reading. The closure is honest about leaving causation open. But FD-18 stands as a separate finding: even if loki had nothing to do with F-Deploy-G1-Y, its identity-laundering pattern is reason enough to keep it removed.

The lesson: **multiple findings about the same artifact can be methodologically separate. Don't bundle "is X causing Y?" with "is X trustworthy independent of Y?" — they may have different answers and different evidence requirements.**

### §3.5 The closure boundary is itself documentation

FD-22's "identified — removal-sufficient" framing is *not* a punt. It's a precise declaration of what was learned and what wasn't.

In contrast, three weaker closure shapes:

- **"Resolved" without evidence narrative.** "F-Deploy-G1-Y closed: no longer occurring" — true but unfalsifiable. Future-Claude can't verify the closure or reopen it on stronger evidence.
- **"Fixed via loki removal" claiming causation without isolation.** "Removing loki fixed F-Deploy-G1-Y" — overclaims. Doesn't survive scrutiny if F-Deploy-G1-Y recurs without loki present.
- **Indefinite deferral.** "F-Deploy-G1-Y status: under investigation" — no closure, no progress recorded, future-Claude inherits open scope without a starting point.

FD-22 avoids all three. It says: *here's what we did, here's what we observed, here's what that does and doesn't establish, here's the future-revisit clause if it recurs.* That precision is itself the closure's value.

The lesson: **a closure narrative that names its boundary is more useful than a closure that overclaims or underclaims. The methodological discipline is in the framing, not just in the conclusion.**

## §4 What this postmortem does NOT do

- Does not reopen FD-22. F-Deploy-G1-Y remains closed under the "identified — removal-sufficient" framing.
- Does not establish loki causation. The investigation deliberately stopped at sufficiency, not causation; this postmortem documents that stop, doesn't undo it.
- Does not modify F-Deploy-1 Fix Plan v1.3. v1.3 is on main as a closed point-in-time document; this postmortem is a separate artifact that cross-references v1.3 §4 but does not amend it.
- Does not commit to action on loki beyond removal. Removal happened 2026-05-17; whether loki is reinstalled in the future is a separate decision (likely no, given FD-18, but not addressed here).
- Does not address the broader autonomous-merge problem. F-Deploy-G1-Y is the PR-opening mechanism specifically; `auto-merge.yml` deletion handled the auto-merge cascade separately.

## §5 Status

- F-Deploy-G1-Y: CLOSED at FD-22, "identified — removal-sufficient" framing.
- loki-laufeyson.intelligent-assistant: REMOVED from local environment as of 2026-05-17. Status: confirmed absent across N=8 diagnostic data points.
- FD-18 (loki identity-laundering pattern): standing finding. Not causally linked to F-Deploy-G1-Y by FD-22 evidence; trustworthiness concern stands independent.
- This postmortem: local-state, queued for ship at v11 author session post-soak-close (~2026-05-26).

## §6 If F-Deploy-G1-Y recurs

If the behavior reappears in the future, this postmortem and v1.3 §4 give the next investigator a strong starting point:

1. **Check loki state first.** Has it been reinstalled? Has any extension with similar identity-laundering patterns been added? If yes → likely same mechanism; remove and verify.
2. **If loki state unchanged, the FD-22 sufficiency claim is broken.** This is the strongest re-open signal — recurrence under the exact conditions that previously cleared the behavior means another causal mechanism is in play.
3. **Run the N=8 protocol again with the new variable suspect.** The 8-data-point design is reusable: VS Code closed/open × wait windows 30s–15min, with the suspect tool removed.
4. **If recurrence is intermittent, the investigation gets harder.** Intermittent F-Deploy-G1-Y behavior would suggest a triggered (rather than passive) mechanism — something that fires conditionally rather than continuously. Investigation strategy would shift to log capture rather than presence/absence testing.

The closure was correlation + sufficiency. Recurrence is the falsification test it was designed to permit.

## §7 Adjacent autonomous-tooling findings (cross-reference, added 2026-05-26)

Three separate autonomous-tooling concerns surfaced during the F-Deploy-1 fix cycle. They share thematic territory ("automation acting on the repo without explicit human invocation") but have distinct mechanisms, distinct surfaces, and distinct closure records. Cross-listed here so future readers don't conflate them:

| Concern | Mechanism | Closure | Where documented |
|---|---|---|---|
| **F-Deploy-G1-Y** — PRs opening on `claude/**` branches without explicit `gh pr create` | Suspected VS Code extension behavior; loki-laufeyson.intelligent-assistant removal sufficient on N=8 evidence | CLOSED via FD-22 (removal-sufficient framing) | This postmortem; F-Deploy-1 Fix Plan v1.3 §4 |
| **`TySteamTest` author attribution on main commits** (PE #58) | GitHub App performing workflow-driven squash-merges via `auto-merge.yml` (deleted 2026-05-15); App credentials via `secrets.APP_ID` + `secrets.APP_PRIVATE_KEY` referenced in current `auto-merge-to-dev.yml` per PE #59 | CLOSED 2026-05-22 with corrected mechanism after three closure iterations | `Session_PE_Roster.md` PE #58 / PE #59 / PE #60 (landed canonical on main via PR #712) |
| **Autonomous-merge cascade to main** | `auto-merge.yml` running `gh pr merge --squash --auto` on every PR plus zero required status checks on main | CLOSED via FD-2 (`auto-merge.yml` deleted 2026-05-15) and FD-5 (branch protection with three required status checks shipped 2026-05-19) | F-Deploy-1 Fix Plan v1.0 §6 / v1.3 §3 |

The three concerns interact in time (all surfaced or closed during F-Deploy-1 Phase A) but not causally. F-Deploy-G1-Y's loki-removal-sufficient closure stands independent of PE #58's GitHub App finding; PE #58's GitHub App attribution stands independent of F-Deploy-G1-Y's PR-opening question; the auto-merge cascade was closed by workflow deletion regardless of either upstream investigation.

A reader investigating "what's the autonomous-tooling story for Prime Studios" needs all three closure records to have the full picture. None of the three supersedes the others; none of the three is a duplicate of the others.

---

*End of F-Deploy-G1-Y Postmortem. Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni. Original draft date: 2026-05-21 (F-Deploy-1 Phase A G4 soak day 2 of 7). §7 cross-reference appended 2026-05-26 post-PR-#712 landing.*
