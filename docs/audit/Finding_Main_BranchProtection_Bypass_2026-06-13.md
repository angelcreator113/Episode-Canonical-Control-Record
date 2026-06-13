# Finding — `main` Branch Protection Is Non-Enforcing Against the Operator Account

**Date:** 2026-06-13
**Session:** Handoff v20 filing (paper-only)
**Status:** FILED — finding only. No settings change this session. Disposition is a decision for the operator (see §5).
**Finding ID / registry placement:** OPEN — see §6.

## 0. One-line

Direct pushes to `refs/heads/main` on the operator account (`angelcreator113`) complete past the branch's protection ruleset (PR-required + 3 status checks), emitting `Bypassed rule violations for refs/heads/main`. The gates that protect canon are therefore self-imposed (Rule 7 / PR ceremony), not platform-enforced, for the account that does all the work.

## 1. What was observed

- v19 Sec 0 recorded, at the v18 push: remote reported `Bypassed rule violations for refs/heads/main` — the push to `main` completed past nominal protection (PR-required + 3 status checks) on the operator account.
- The `56564d69` finding push (this session line) followed the same direct-to-main pattern: a finding doc became canon on `main` with no PR, no review, no CI gate.
- v18/v19 handoffs landed the same way (direct to main per their own Sec 0 push results, e.g. `a0350c83..419a019e`).

By contrast, the v20 handoff (PR #786) and the doc-PR chain generally go through branch → PR → `[skip-automerge]` → manual merge. That ceremony is voluntary: the platform would let the same content go straight to main.

## 2. Likely mechanism (CONFIRM — not asserted)

The phrase "Bypassed rule violations" is GitHub **rulesets** language (not classic branch protection). It indicates an **Active** ruleset on `refs/heads/main` whose bypass list includes the actor — typically because "Repository admin" (or "Maintain") is granted bypass, or the operator account is named explicitly. An **Evaluate**-mode ruleset would log without blocking and reads differently; confirm which.

Verify in **Settings → Rules → Rulesets** (and Settings → Branches for any classic protection): mode (Active vs Evaluate), the required-checks list, and exactly who/what is on the bypass list. Do NOT assume from this finding; read the live config.

## 3. What it means

- Canon can be minted to `main` without the PR gate that is supposed to check it. "Docs on main beat conversation memory" is a load-bearing rule in this project; if main can be written unreviewed, the authority of main rests entirely on operator discipline at write time.
- The Path A / Rule 7 posture (draft → confirm → execute; gates exist because push-through caused prior incidents) is **self-enforced only**. There is no platform backstop if discipline wobbles.

## 4. Why it matters now (live example)

This session churned: a placeholder file and a truncated paste both reached a committed/pushed state on a feature branch before a gate caught them. On a feature branch that is harmless — force-push recovery, no canon impact. But the same failure mode on a *direct-to-main* push, which the platform currently permits, would put a placeholder or truncated doc into canon with nothing between the mistake and main. The branch ceremony is what contained today's churn; the platform did not require it.

## 5. Disposition — DECISION FOR THE OPERATOR (not actioned this session)

Two coherent paths; this is a judgment call, not a defect to auto-fix:

- **(A) Enforce.** Tighten the ruleset so even the operator account routes through a PR for `main` (remove admin/owner from bypass, or require PR + checks with no bypass). Pro: platform backstop; canon cannot be minted unreviewed; today's churn could not reach main. Con: friction for a sole operator; emergency direct pushes need a deliberate temporary bypass.
- **(B) Accept.** Formally accept the bypass as a deliberate solo-operator posture, documented as accepted-risk, with compensating controls named explicitly (Rule 7 gate, wake-up sequence, BOM/line gates, branch ceremony as standing practice even when unenforced). Pro: no friction; matches sole-operator reality. Con: relies entirely on discipline; today showed discipline can wobble.
- **Middle path:** keep bypass generally, but scope the ruleset to require a PR for anything under `docs/audit/**` (canon). Handoffs and findings then cannot go direct-to-main, while operational hotfixes still can.

## 6. Finding ID / registry placement — OPEN

Surfaced in the F-Deploy-1 handoff chain (v19/v20 Sec 0) but is a repo-governance concern independent of the deploy keystone. Proposed: register as a new governance-area finding rather than folding into F-Deploy-1, so the deploy keystone stays clean. Confirm the ID/area before treating this as a registered finding. The filename here is provisional pending that decision.

## 7. State at close

- No settings changed. No ruleset touched. This finding is paper-only.
- Filed via the proper PR ceremony (branch → PR → `[skip-automerge]`) deliberately — modeling the enforced-path behavior even though the platform would permit a direct push.
