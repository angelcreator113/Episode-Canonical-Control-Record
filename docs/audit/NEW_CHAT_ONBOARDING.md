# Prime Studios — New Chat Onboarding

**Purpose:** Bootstrap a new Claude conversation about Prime Studios. Compact wake-up sequence. For depth on any topic, follow the signposts below.

**Structure note:** Sections 1–10 are stable — they describe what Prime Studios is and how to work on it, and change only when the project itself changes. Section 11 ("Current fix-cycle state") is volatile and dated; it will drift between updates. The volatile section names its own authoritative sources on main — when in doubt, those win over this doc.

---

> [STOP] **PROD STATE -- READ BEFORE ANY F-Deploy-1 OR PROD WORK (updated 2026-06-01).** The data-swap catastrophe the old hazard described is DEFUSED: the on-disk `.env` is now canon-only (`DB_HOST -> episode-control-dev`, verified; FD-36), so a restart comes up on canon, not the empty DB. BUT prod is currently running on an EMERGENCY HOTFIX (additive PM2 process on port 3000, after a 2026-06-01 outage), not a clean topology, and a credential was exposed in-session. Before any prod action read, in order: `docs/audit/Prime_Studios_Audit_Handoff_v12.md`, `docs/audit/F-Deploy-1_INCIDENT_2026-06-01_prod-502-restore.md`, the FD-31 Pre-Flight Plan v1.4, and the Track B plan v0.2. The remaining prod work is the **combined restart window** (topology align + credential rotation) -- a topology/ops matter, gated under Rule 7, NOT a data-catastrophe. The original `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) is historical context, now largely mitigated.

---

## 1. Wake-up sequence (read in order)

0. **If this session touches F-Deploy-1 or prod at all, read the STOP banner above + `docs/audit/Prime_Studios_Audit_Handoff_v12.md` and the 2026-06-01 incident doc FIRST.** The data-swap catastrophe is defused (FD-36); prod runs on an emergency hotfix pending the combined restart window. Prod actions are gated under Rule 7, but are now topology/ops work, not data-loss avoidance.
1. **Read this doc end-to-end.** ~5 minutes. After reading, sanity-check §11 against current state — `git log --oneline -1 main` should match (or be reasonably close to) the main HEAD §11 names. If main has moved significantly past what §11 claims, treat §11 as stale and verify against the canonical docs it points at.
2. **Read the current audit canonical doc on main.** See §11 for which revision is current. The audit doc is the authoritative state-of-codebase reference; this onboarding doc is orientation only. Allow ~30 minutes for a full first read.
3. **Read the current F-Deploy-1 Fix Plan revision on main.** See §11 for which revision is current. Fix Plan revisions are additive — later revisions build on earlier ones, which remain on main as historical record.
4. **Scan `docs/audit/Session_PE_Roster.md`** — running list of session-surfaced production-environment items. Each PE entry has Status (OPEN / RESOLVED / DEFERRED) and links to the relevant keystone.

If a question lands and current state isn't clear — search the repo first. The docs on main are the source of truth, not memory.

---

## 2. What Prime Studios is

Sole-developer franchise OS + AI-powered production platform built around the LalaVerse universe. Flagship show: *Styling Adventures with Lala* (SAL) — narrative-driven fashion/lifestyle series, 24-episode Season 1.

**Two tiers:**
- **Franchise tier** — LalaVerse, Show Bible (89 rules), World Foundation (11 locations, 5 cities), Social Systems (15 archetypes), Cultural Calendar (42 events). Fully populated, real-data pages.
- **Show tier (Producer Mode)** — Episode production, scene management, wardrobe, career goals, character state.

**The architectural keystone** (named in v8, the keystone that explains the audit): **F-Franchise-1 — Franchise-tier write-only architecture.** The wire from franchise tier → show tier is missing. Six services in the production pipeline maintain private canon copies as JS literals; zero AI services read Universe. Director Brain isn't a feature to build — it's F-Franchise-1's resolution.

---

## 3. Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5 + Tailwind |
| Backend | Node.js 20 + Express 4 + Sequelize 6 |
| Database | PostgreSQL 15 (AWS RDS, `db.t3.small` — do not downgrade given schema complexity) |
| Auth | AWS Cognito + JWT (but see F-AUTH-1: `middleware/auth.js` applies `optionalAuth` globally) |
| Storage | AWS S3 (assets, wardrobe images) |
| AI | Anthropic Claude API (`claude-sonnet-4-6` canonical per Decision #90), RunwayML, DALL-E 3, Replicate |
| Hosting | AWS EC2 (single instance, shared dev+prod), ALB, RDS, NAT, WAF |
| Process manager | PM2 cluster mode |
| Repo | github.com/angelcreator113/Episode-Canonical-Control-Record |
| Ports | Dev 3002, prod 3000 (see F-Deploy-G1-H — `ecosystem.config.js` default env is dev port; prod requires `--env production` flag) |
| Branch protection | LIVE on main per FD-5 (required status checks gate merges; see §11 for current check list) |

---

## 4. The eight keystones

Identity and one-line summary. For per-keystone *current status*, see §11. For depth on any keystone, see the audit canonical doc on main (named in §11).

| Keystone | Origin | One-line summary |
|---|---|---|
| **F-AUTH-1** | v5–v8 (3 sub-forms) | Codebase-wide auth-bypass on writes. `optionalAuth` lets unauthenticated + invalid-token requests through. Three sub-forms: routes declaring `optionalAuth`, routes declaring no auth middleware, routes with `optionalAuth` on episode-mutation paths. Fixed via six-step coordinated recipe. |
| **F-Deploy-1** | v9 | Deploy pipeline + autonomous-merge surface. Non-fatal migration handling + healthy-looking PM2 with broken routes + shared dev/prod EC2 instance + zero-gate branch protection + autonomous PR-opening mechanism. |
| **F-App-1** | v6 | Schema-as-JS auto-repair in `app.js:262–328`. Five tables created on every boot with hardcoded schemas drifting from migrations. Master Pattern 40 instance. |
| **F-Stats-1** | v7 | `character_state` had no Sequelize model. Phase A added the model. Phase B migrates 9+ raw-SQL writers. |
| **F-Ward-1** | v7 | `episode_wardrobe` has no migration. Table exists only via Sequelize sync. Pattern 40b canonical schema-source drift Tier 4. |
| **F-Reg-2** | v6 | `registry_characters` write-contention without locking. Pattern 41 master. 4 confirmed instances. |
| **F-Ward-3** | v7 (restored v8) | Two outfit-set controllers, two storage architectures, one underlying table. Delete the plural controller. |
| **F-Franchise-1** | v8 | Franchise tier is write-only across the entire production pipeline. Six services route around the franchise tier with private canon copies as JS literals. Director Brain is the fix. |

**Plus F-Sec-3 (character_key drift) as keystone-in-motion.** v8 closes §10.1 'lala' surfaces at 10/10 and §10.2 'justawoman' surfaces at 6/6. Subordinate to F-Franchise-1.

**Fix sequence (locked v9):** F-AUTH-1 → **F-Deploy-1** → F-App-1 → F-Stats-1 (Phase B) → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= build Director Brain) → F-Sec-3.

---

## 5. Working principles (from sessions with Evoni)

These shape how Claude should operate on this project:

1. **Path A discipline.** Full forensic audit before fixes. Audit closed in v8. Fix-cycle now means no scope changes to findings during fix execution. No skipping, no parallel hotfixes outside the sequence.

2. **Rule 7 — Draft → Confirm → Execute.** Real shared-state changes (push, PR creation, merge, force-push, deletion) need explicit user confirmation before Claude proposes commands and after Claude drafts them. Mechanical local operations (checkout, single-file edits, branch creation) don't need a gate — the gate exists to prevent compounding mistakes at points of real state change.

3. **Verify before commit.** Header-count checks + content-sample checks are reliable; line-count predictions are noise. When data looks weird, ask for a different view (e.g. VS Code direct read) before theorizing about cause.

4. **Trust the user first.** When state seems weird, ask what was done before theorizing about autonomous tooling. Default to "Evoni was working in parallel" not "tooling acted autonomously" — even when the autonomous-tooling pattern is real.

5. **Methodical before fast.** Full audit before any fixes. Be told honestly when drift patterns appear. Don't rush. Don't push back on Evoni's energy or judgment — she sleeps in 4–5 hour cycles and her "I'm fine" is calibrated differently than a default-pattern human's.

6. **AI-drafted commit messages and PR descriptions must be grep-checked.** Per FD-21: GitHub's closing-keyword set followed by `#N` will be parsed by GitHub regardless of grammatical context — conditional, subjunctive, and historical references are not exempt. The keyword set: `close`, `closes`, `closed`, `closing`, `fix`, `fixes`, `fixed`, `fixing`, `resolve`, `resolves`, `resolved`, `resolving` — followed by `#N` or `org/repo#N`. Backtick fencing works in issue/PR comment markdown only, not in commit messages.

---

## 6. Anti-patterns to avoid

1. **Don't redesign the database schema.** The audit closed at v8. Schema is what it is. Use the migration system + the keystone fix-sequence.
2. **Don't add features.** Anything not in the locked keystone sequence is scope creep until F-Franchise-1 (Director Brain) ships.
3. **Don't say "I'll optimize this later."** Do it right the first time or skip it.
4. **Don't say "the docs are wrong about X" without checking the actual file:line.** Audit citations are precise. Question them only with file:line evidence to the contrary.
5. **Don't ship code through the deploy pipeline without verifying the fix in dev first.** F-Deploy-1 exists because the pipeline silently lets broken code through.

---

## 7. Key file paths

Paths you'll want to read. §11 names which audit and Fix Plan revision is currently canonical.

**Audit canon:**
- `docs/audit/Prime_Studios_Audit_Handoff_v10.docx`
- `docs/audit/Prime_Studios_Audit_Handoff_v9.docx`
- `docs/audit/Prime_Studios_Audit_Handoff_v8.docx`
- `docs/audit/Session_PE_Roster.md` — running PE list
- `docs/audit/F-Stats-1_Fix_Plan_v1.2.md` — F-Stats-1 fix plan (Phase A through §12.20)
- `docs/audit/F-Stats-1_PhaseB_G1_Planning.md` — Phase B per-PR plan
- `docs/audit/F-Deploy-1_G1_Audit.md` — F-Deploy-1 G1 findings (audit document, not fix plan)
- `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` — F-Deploy-1 Fix Plan v1.0
- `docs/audit/F-Deploy-1_Fix_Plan_v1.1.md` — Gate A-G1 closure revision
- `docs/audit/F-Deploy-1_Fix_Plan_v1.2.md` — A-1b ship + sub-form D partial revision
- `docs/audit/F-Deploy-1_Fix_Plan_v1.3.md` — Phase A G2 close revision
- `docs/audit/F-AUTH-1_Fix_Plan_v2_37.docx` — F-AUTH-1 fix plan

**Layering note:** Audit revisions are additive. v10 is current canonical; supersedes v9/v8 only for content v10 explicitly covers. v9/v8 remain canonical for content v10 doesn't supersede (cross-zone implications, audit vocabulary, character_key catalog appendix). Fix Plan revisions follow the same pattern — later revisions build on earlier; the latest is canonical for current state, earlier are historical record.

**Code surfaces frequently referenced:**
- `src/app.js:262–328` — F-App-1 schema-as-JS auto-repair
- `src/middleware/auth.js:164–168` — F-AUTH-1 `optionalAuth` master surface
- `src/middleware/aiRateLimiter.js` — fixed in PR #694 (IPv6 keygen)
- `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js` — fixed in PR #694 (version column)
- `.github/workflows/deploy-dev.yml` — F-Deploy-G1-A through G findings
- `.github/workflows/auto-merge.yml` — DELETED 2026-05-15 as containment, locked permanent per FD-3
- `.github/workflows/auto-merge-to-dev.yml` — still active, merges `claude/**` branches to dev; carries FD-4 changes (opt-out label, backend build verification, `-X ours` notification)
- `ecosystem.config.js` — F-Deploy-G1-H–J findings (port/env-block issues)
- `scripts/morning-soak-check.ps1` — prod EC2 PM2 status + recent log dump utility

**Infrastructure:**
- Prod EC2: `ubuntu@54.163.229.144`, key `C:\Users\12483\episode-prod-key.pem`
- PM2 processes: `episode-api` (cluster mode), `episode-worker` (fork mode)

---

## 8. What this project is NOT

- NOT a generic episode-management tool (it's a specific franchise's production platform with deep AI integration).
- NOT in a "build new features" phase (post-audit fix-cycle, sequenced keystones).
- NOT a multi-developer codebase (single dev: Evoni / JAWIHP).
- NOT ready for external users (audit reveals scale of in-flight work).

---

## 9. How to be useful to Evoni

- Reference audit findings by document and section number, not by paraphrase. Audit citations are precise — match that precision.
- Use `gh`, `git`, and PowerShell-compatible commands (her working environment is Windows PowerShell).
- When proposing commands, follow Rule 7 — draft, confirm, execute.
- Don't push back on energy or pace — she knows her own capacity.
- When in doubt about autonomous-PR-opening behavior, see the most recent Fix Plan revision for current sub-form D status (F-Deploy-G1-Y).
- When in doubt about current state, search the repo and ask. Don't theorize from priors.

---

## 10. Stale-detection guidance

If §11 looks more than a few days old, treat it as orientation only and verify against the canonical docs §11 names. The doc admits it will drift. The pointers don't.

---

## 11. Current fix-cycle state -- as of 2026-06-01

**This section is quick orientation only and goes stale fast.** Authoritative current state lives in `docs/audit/Prime_Studios_Audit_Handoff_v12.md` (audit canonical) and `docs/audit/F-Deploy-1_Fix_Plan_v1.8.md` (current Fix Plan revision) on main. If this section conflicts with those, those win.

**Canonical docs on main:**
- Audit: **v12** (`docs/audit/Prime_Studios_Audit_Handoff_v12.md`, additive on v11/v10).
- F-Deploy-1 Fix Plan: **v1.8**. Register FD-1 through FD-37.
- FD-31 reconciliation: **Pre-Flight Plan v1.4** (`docs/audit/F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md`) -- all six pre-flight gates GREEN, pre-flight COMPLETE.
- Topology: **Track B plan v0.2** (`docs/audit/Track_B_PM2_Topology_Formalization_Plan.md`).
- Incident: `docs/audit/F-Deploy-1_INCIDENT_2026-06-01_prod-502-restore.md`.

For current main HEAD: `git log --oneline -1 main`.

**Prod state (2026-06-01):** RESTORED after a multi-day 502 outage (found by manual check -- no alert; finding F-Deploy-G1-AJ). Running on an emergency additive hotfix (PM2 `episode-api-prod-hotfix` on port 3000; dev on 3002; reboot-durable). The data-swap landmine is defused (FD-36, `.env` canon-only). NOT a clean topology -- Track B formalizes it.

**The true next executable prod action:** the **combined restart window** -- FD-31 credential rotation + Track B topology align + route-bug fix, in ONE gated prod restart (Rule 7 hard stop on the restart itself). This is topology/ops work, not data-catastrophe.

**Keystone status:**
- F-Deploy-1: Fix Plans v1.0-v1.8 on main. Phase A CLOSED, Phase B G1 CLOSED. Phase B G2 still BLOCKED on FD-31, but FD-31 substantially advanced (pre-flight complete, data-swap defused, preservation captured #737, cutover scoped). G2 Sec 4.2 memory gate still owed.
- F-AUTH-1: artifact on main (v2.37, #664), execution blocked behind F-Deploy-1 full close.
- F-App-1: SHIPPED (incident-driven). F-Stats-1: Phase A CLOSED, Phase B blocked behind F-Deploy-1 full close.
- F-Reg-2, F-Ward-1, F-Ward-3, F-Franchise-1 (Director Brain), F-Sec-3: queued behind F-Deploy-1 full close.

**Open (v12 Sec 10):** combined restart window; AJ monitoring IMPLEMENTATION (plan on main #743, alarm not yet created); credential rotation (canon DB pw exposed + in hotfix env, `-prod` pw, AWS static keys); `-prod` teardown; G1 registry reconcile (still owed, v12 Sec 8.1); Frontend IA dispositions PR; the parked `world_events` backfill migration (reconciliation-gated).

**Decisions log range:** Fix Plan register FD-1 through FD-37.

**Branch protection on main:** LIVE. Required checks: Cost Exposure Audit, Tests, Route Validation.
