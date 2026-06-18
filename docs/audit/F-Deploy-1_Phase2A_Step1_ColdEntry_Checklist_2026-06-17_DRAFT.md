# F-Deploy-1 Phase 2A Step 1 — Cold-Entry Checklist (DRAFT)

> **PLANNING ARTIFACT. AUTHORIZES NO PROD-BOX ACTION. BOX REMAINS FROZEN.**
> Drafted in a WARM session (2026-06-17) following the #812 abort / #813 hold / #814 provenance-resolved chain.
> This document does not open a Phase 2A attempt and does not make the gate-rule decision. It stages the conditions for a future COLD window.

| | |
|---|---|
| Drafted | 2026-06-17 (warm) |
| Gate status at draft | **HELD** (Phase 2A Step 1 abort stands; #812) |
| Box | FROZEN (with one known asterisk — see A0) |
| Predecessor record | #812 (abort), #813 (hold + drift + deviation log), #814 (provenance resolved) |

---

## Why this is structured in two parts

The next window must be **COLD**: per locked discipline, a cold open reads **only runbook Step 0 + runs the abort re-verify against live terminal output**, inheriting nothing else. Any reconciliation reading warms it and disqualifies it.

But this session produced facts the next attempt needs (gate-rule question, config drift, freeze asterisk). If the cold window *read* them, it would warm itself.

**Resolution:** complete the decision/record work in WARM sessions first and **fold the outcomes into runbook Step 0 and the abort re-verify on main**. The cold window then inherits everything through its one permitted read, as settled main content — and stays cold.

So: **Section A is warm-legal and lands on main. Section B is the cold window and only opens after A is on main.**

---

## A0 — Carry-forward facts (must be reflected on main before cold open)

- **Freeze asterisk.** An un-gated probe this session wrote `/tmp/pm2jlist.json` (inert) to the box (#813 deviation log). The box is no longer "untouched since freeze" in the strict sense. The abort re-verify must account for this so a discovered `/tmp` artifact is **not** mistaken for a new mutation.
- **Provenance settled (#814).** Pinned `v20.20.2` was the **build-container** Node (NodeSource `setup_20.x` on 06-14, commit `7d729801`, branch `f-deploy-1-pre2a-pass-filed-2026-06-14` only — never on main, never on box). Live box runtime is `v20.20.1`. Same major, same ABI. Skew is benign under source-on-box deploy.
- **The gate FAILed as written** because Step 1's rule is exact-patch 4-tuple match. That rule question is unresolved and is **owner-level** (#814) — not a reconstruction call.

---

## Section A — Warm-legal prerequisites (land on main BEFORE the cold window)

> **[STEP 0 MAPPING 2026-06-17 -- A5.]** "Runbook Step 0" throughout this checklist = Master
> Runbook **Sec 5 / Phase 1 live abort re-verify** (the runbook has no literally-named Step 0).
> A0-A4 are folded there per A5. Section A's A1-A4 question-phrasing is preserved as the historical
> warm-session staging; the decisions are recorded in
> docs/audit/F-Deploy-1_A5_GateRule_Reconciliation_DRAFT_2026-06-17.md (additive-supersede, per the
> #816 precedent -- the staged doc is not rewritten).

- [ ] **A-merge.** Confirm #812 / #813 / #814 are on `origin/main` (`git log --oneline -5 origin/main`).
- [ ] **A1 — Gate-rule decision.** With the runbook owner, decide whether Phase 2A Step 1 asserts **exact-patch** Node parity (current rule → re-aborts on .1 vs .2) or **ABI/engines-range** satisfaction (→ passes on benign same-major skew), given a source-on-box deploy. Record the decision on main as a runbook-rule clarification / FD entry. *This is the gating decision; nothing downstream is real until it lands.*
- [ ] **A2-cfg — Config-vs-runtime drift handling.** Ecosystem config declares Node `20.20.0` (PATH + NODE_VERSION); runtime is `20.20.1`; both binaries present, so a config-driven restart can silently shift runtime to `20.20.0`. Decide and record the handling (align config to runtime, or explicitly accept and gate it) **before any restart step exists in the path.**
- [ ] **A3 — Re-pin / rebuild applicability (depends on A1).** #812 said "rebuild off-box against confirmed pin"; #814 withdrew the down-pin reasoning because there is **no build artifact** in the source-on-box runtime path. Resolve whether rebuild-at-priming applies to the runtime at all, or governs only the off-box build-viability checks (P-4/P-5). If A1 lands ABI/engines-range, this question may dissolve — confirm, don't assume.
- [ ] **A4 — Surface prerequisites G2A-1 and G2A-2.** #812 names these as "surface before first mutation." *I do not have their contents.* Read them from source, record their status, and resolve or explicitly carry each.
- [ ] **A5 — Fold A0–A4 into Step 0 / abort re-verify text on main.** This is the move that keeps the next window cold. After A1–A4 land, edit runbook Step 0 (and the abort re-verify procedure) so it carries: the settled gate rule, the drift-handling decision, the G2A-1/G2A-2 status, and the freeze asterisk. Ship via the normal gated `[skip-automerge]` PR.

**Until A5 is on main, do not open the cold window.** A cold window opened against a Step 0 that still encodes the old exact-patch rule will simply re-abort.

---

## Section B — Cold window open sequence (only after Section A is on main)

> Open in a fresh window with **no prior reading inherited.** Skip general onboarding. The only permitted reads are Step 0 and the abort re-verify.

- [ ] **B1 — Wake-up trio** (live state is authority):
  ```
  git fetch origin
  git log --oneline -1 origin/main
  gh pr list --state open
  ```
- [ ] **B2 — Scoped Step 0 read only.** Read runbook Step 0 (now carrying A0–A4 per A5). Do **not** read handoffs, prior session notes, or general onboarding. *Exact Step 0 wording: source from the live runbook — not reproduced here.*
- [ ] **B3 — FD-31 §7 abort re-verify against LIVE terminal output.** Run the re-verify **as written in FD-31 §7** (I do not have its text; source it). Account for the known `/tmp/pm2jlist.json` write — a found `/tmp` artifact is expected, not a new mutation.
- [ ] **B4 — Rerun Phase 2A Step 1 from top.** Under the **settled** gate rule (A1). Re-probe the box read-only; apply the rule as folded into Step 0. Abort remains a valid success condition.
- [ ] **B5 — Pre-restart config-drift gate.** If and only if the path reaches a restart step: verify which Node the restart will bind (config forces `20.20.0`); do not let it shift runtime unless `20.20.0` is the decided target per A2-cfg. Otherwise abort.

---

## Section C — Standing discipline (every step)

- **Rule 7:** Draft → Confirm → Execute gates every push, PR create, merge, force-push, file deletion, and any box mutation. Read-only probes are permitted; writes are not, until a gated mutation step is explicitly authorized.
- **PowerShell:** one command per line; `&&` is not a separator; no literal `→` arrows in pasted blocks.
- **`git status` before any `git reset --hard`** — it destroys staged-but-uncommitted files.
- **Box stays frozen** through B1–B4. The first authorized box write is a separately gated decision, not part of this checklist.
- **Abort is success.** Catching a mismatch before a write path is the gate working, not a failure.

---

## Items I do NOT have (source these from live/main; do not invent)

- FD-31 §7 abort re-verify text.
- G2A-1 and G2A-2 prerequisite definitions.
- Exact runbook Step 0 / Step 1 wording.

*End of cold-entry checklist DRAFT. Author: Claude (warm session), with Evoni. Owner-level items (A1, A2-cfg) require the runbook owner.*
