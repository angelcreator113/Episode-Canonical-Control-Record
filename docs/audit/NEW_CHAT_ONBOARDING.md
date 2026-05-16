# Prime Studios — New Chat Onboarding

**Purpose:** Bootstrap a new Claude conversation about Prime Studios. Compact wake-up sequence. For depth on any topic, follow the signposts below.

**Last updated:** 2026-05-16 (post-v9 audit handoff)

---

## Wake-up sequence (read in order)

1. **Read this doc end-to-end.** ~5 minutes.
2. **Read `docs/audit/Prime_Studios_Audit_Handoff_v9.docx`** — the canonical state-of-codebase document. ~30 minutes for full read; sections §1, §4, §7.3, §11.5 for the v9 deltas alone. v9 is additive to v8 (which closed the audit); v8 sections 1–11 remain canonical for zones 1–26.
3. **Scan `docs/audit/Session_PE_Roster.md`** — the running list of session-surfaced production-environment items. Each PE entry has Status (OPEN / RESOLVED / DEFERRED) and links back to the relevant keystone.
4. **Check the active audit branch:** `claude/f-deploy-1-g1-audit` contains the in-progress F-Deploy-1 G1 audit document at `docs/audit/F-Deploy-1_G1_Audit.md`.

If the user asks a question and you're not sure of current state — search the repo first. The docs are the source of truth, not your memory.

---

## What Prime Studios is

Sole-developer franchise OS + AI-powered production platform built around the LalaVerse universe. Flagship show: *Styling Adventures with Lala* (SAL) — narrative-driven fashion/lifestyle series, 24-episode Season 1.

**Two tiers:**
- **Franchise tier** — LalaVerse, Show Bible (89 rules), World Foundation (11 locations, 5 cities), Social Systems (15 archetypes), Cultural Calendar (42 events). Fully populated, real-data pages.
- **Show tier (Producer Mode)** — Episode production, scene management, wardrobe, career goals, character state.

**The architectural keystone** (named in v8, the keystone that explains the audit): **F-Franchise-1 — Franchise-tier write-only architecture.** The wire from franchise tier → show tier is missing. Six services in the production pipeline maintain private canon copies as JS literals; zero AI services read Universe. Director Brain isn't a feature to build — it's F-Franchise-1's resolution.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5 + Tailwind |
| Backend | Node.js 20 + Express 4 + Sequelize 6 |
| Database | PostgreSQL 15 (AWS RDS, `db.t3.small` — do not downgrade given schema complexity) |
| Auth | AWS Cognito + JWT (but see F-AUTH-1: middleware/auth.js applies `optionalAuth` globally) |
| Storage | AWS S3 (assets, wardrobe images) |
| AI | Anthropic Claude API (`claude-sonnet-4-6` canonical per Decision #90), RunwayML, DALL-E 3, Replicate |
| Hosting | AWS EC2 (single instance, shared dev+prod), ALB, RDS, NAT, WAF |
| Process manager | PM2 cluster mode |
| Repo | github.com/angelcreator113/Episode-Canonical-Control-Record |
| Ports | Dev 3002, prod 3000 (see F-Deploy-G1-H — `ecosystem.config.js` default env is dev port; prod requires `--env production` flag) |

---

## State as of 2026-05-16

**Audit:** CLOSED at v8 (26 zones traced, 7 keystones named). v9 is post-audit fix-progress.

**Active keystone work:**
- **F-Stats-1 Phase A:** CLOSED 2026-05-15. CharacterState Sequelize model on main as `30f10fe7` (PR #684).
- **F-Deploy-1 G1 audit:** IN PROGRESS. 27 file:line findings filed (F-Deploy-G1-A through F-Deploy-G1-AA) on `claude/f-deploy-1-g1-audit`. Seven §3 file-read/diagnostic sections complete. Still TODO: §2.1–§2.5 failure narratives, §4 sub-form classification, §5 fix-plan structure.
- **First F-Deploy-1 fix shipped:** PR #694 / commit `139bbd7a` on main (2026-05-15). Resolved PE #41 (IPv6 rate-limit keygen) and PE #48 (migration version-column drift).

**Fix sequence (v9 locked):** F-AUTH-1 → **F-Deploy-1** → F-App-1 → F-Stats-1 (Phase B) → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= build Director Brain) → F-Sec-3.

Per Decision #9: F-Deploy-1 G1 close must precede F-Stats-1 Phase B G2 because structural fixes ship through the deploy pipeline that F-Deploy-1 is hardening.

---

## The eight keystones (v9)

For depth on any of these, see v9 §2.1 and §4.2.

| Keystone | Origin | One-line summary |
|---|---|---|
| **F-AUTH-1** | v5–v8 (3 sub-forms) | Codebase-wide auth-bypass on writes. `optionalAuth` lets unauthenticated + invalid-token requests through. Three sub-forms: routes declaring `optionalAuth`, routes declaring no auth middleware, routes with `optionalAuth` on episode-mutation paths. Fixed via six-step coordinated recipe. |
| **F-Deploy-1** | v9 (NEW) | Deploy pipeline + autonomous-merge surface. Non-fatal migration handling + healthy-looking PM2 with broken routes + shared dev/prod EC2 instance + zero-gate branch protection + autonomous PR-opening mechanism. G1 audit in progress. |
| **F-App-1** | v6 | Schema-as-JS auto-repair in `app.js:262–328`. Five tables created on every boot with hardcoded schemas drifting from migrations. Master Pattern 40 instance. |
| **F-Stats-1** | v7 (Phase A closed v9) | `character_state` had no Sequelize model. Phase A: model now exists. Phase B: migrate 9+ raw-SQL writers (BLOCKED on F-Deploy-1 G1 close). |
| **F-Ward-1** | v7 | `episode_wardrobe` has no migration. Table exists only via Sequelize sync. Pattern 40b canonical schema-source drift Tier 4. |
| **F-Reg-2** | v6 | `registry_characters` write-contention without locking. Pattern 41 master. 4 confirmed instances. |
| **F-Ward-3** | v7 (restored v8) | Two outfit-set controllers, two storage architectures, one underlying table. Delete the plural controller. |
| **F-Franchise-1** | v8 | Franchise tier is write-only across the entire production pipeline. Six services route around the franchise tier with private canon copies as JS literals. Director Brain is the fix. |

**Plus F-Sec-3 (character_key drift) as keystone-in-motion.** v8 closes §10.1 'lala' surfaces at 10/10 and §10.2 'justawoman' surfaces at 6/6. Subordinate to F-Franchise-1.

---

## Working principles (from sessions with Evoni)

These shape how Claude should operate on this project:

1. **Path A discipline.** Full forensic audit before any fixes. Audit was closed in v8. Fixes proceed in sequence (see §4 of v9). No skipping, no parallel hotfixes outside the sequence.

2. **Rule 7 — Draft → Confirm → Execute.** Real shared-state changes (push, PR creation, merge, force-push, deletion) need explicit user confirmation before Claude proposes commands and after Claude drafts them. Mechanical local operations (checkout, single-file edits, branch creation) don't need a gate — the gate exists to prevent compounding mistakes at points of real state change.

3. **Verify before commit.** Header-count checks + content-sample checks are reliable; line-count predictions are noise (lesson from 2026-05-15). When the data looks weird, ask for a different view (e.g. VS Code direct read) before theorizing about cause.

4. **Trust the user first.** When state seems weird, ask the user what they did before theorizing about autonomous tooling. Default to "Evoni was working in parallel" not "tooling acted autonomously" — even when the autonomous-tooling pattern is real (and it is: see F-Deploy-G1-Y).

5. **Evoni's working principle:** Methodical before fast. Full audit before any fixes. Be told honestly when drift patterns appear. Don't rush. Don't push back on her energy or judgment — she sleeps in 4–5 hour cycles and her "I'm fine" is calibrated differently than a default-pattern human's.

---

## Anti-patterns to avoid

1. **Don't redesign the database schema.** v8 closed the audit. Schema is what it is. Use the migration system + the keystone fix-sequence.
2. **Don't add features.** Anything not in v9's keystone sequence is scope creep until F-Franchise-1 (Director Brain) ships.
3. **Don't say "I'll optimize this later."** Do it right the first time or skip it.
4. **Don't say "the docs are wrong about X" without checking the actual file:line.** v8/v9 finding citations are precise. Question them only with file:line evidence to the contrary.
5. **Don't ship code through the deploy pipeline without verifying the fix in dev first.** F-Deploy-1 exists because the pipeline silently lets broken code through.

---

## Open PRs and active branches (as of 2026-05-16)

Active state changes hourly during work sessions. Check `gh pr list` and `git branch -a` for current state. Recent context:

- **Main branch tip:** `fc948cf3` — v9 handoff merged via PR #696
- **Active audit branch:** `claude/f-deploy-1-g1-audit` — F-Deploy-1 G1 audit, 8 commits, not yet PR'd to main
- **Merged today:** PR #695 (PE roster updates), PR #696 (v9 handoff)

---

## Key file paths

**Audit canon:**
- `docs/audit/Prime_Studios_Audit_Handoff_v9.docx` — current
- `docs/audit/Prime_Studios_Audit_Handoff_v8.docx` — prior, still referenced for zones 1–26
- `docs/audit/Session_PE_Roster.md` — running PE list
- `docs/audit/F-Stats-1_Fix_Plan_v1.2.md` — F-Stats-1 fix plan (Phase A through §12.20)
- `docs/audit/F-Stats-1_PhaseB_G1_Planning.md` — Phase B per-PR plan (blocked on F-Deploy-1)
- `docs/audit/F-Deploy-1_G1_Audit.md` (on `claude/f-deploy-1-g1-audit`) — in-progress F-Deploy-1 audit
- `docs/audit/F-AUTH-1_Fix_Plan_v2_37.docx` — F-AUTH-1 fix plan (queued, awaits F-Deploy-1 G1 close per current sequencing)

**Code surfaces frequently referenced:**
- `src/app.js:262–328` — F-App-1 schema-as-JS auto-repair
- `src/middleware/auth.js:164–168` — F-AUTH-1 `optionalAuth` master surface
- `src/middleware/aiRateLimiter.js` — fixed in PR #694 (IPv6 keygen)
- `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js` — fixed in PR #694 (version column)
- `.github/workflows/deploy-dev.yml` — F-Deploy-G1-A through G findings
- `.github/workflows/auto-merge.yml` — **DELETED 2026-05-15** as containment
- `.github/workflows/auto-merge-to-dev.yml` — still active, merges `claude/**` branches to dev
- `ecosystem.config.js` — F-Deploy-G1-H–J findings (port/env-block issues)

**Infrastructure:**
- Prod EC2: `ubuntu@54.163.229.144`, key `C:\Users\12483\episode-prod-key.pem`
- PM2 processes: `episode-api` (cluster mode), `episode-worker` (fork mode)

---

## What this project is NOT

- NOT a generic episode-management tool (it's a specific franchise's production platform with deep AI integration).
- NOT in a "build new features" phase (post-audit fix-cycle, sequenced keystones).
- NOT a multi-developer codebase (single dev: Evoni / JAWIHP).
- NOT ready for external users (audit reveals scale of in-flight work).

---

## How to be useful to Evoni

- Reference v9 by section number, not by paraphrase, when discussing audit findings.
- Use `gh`, `git`, and PowerShell-compatible commands (her working environment is Windows PowerShell).
- When proposing commands, follow Rule 7 — draft, confirm, execute.
- Don't push back on energy or pace — she knows her own capacity.
- When the audit branch sees activity, check if it's intentional or part of the autonomous-PR-opening pattern (F-Deploy-G1-Y).
- When in doubt about state, search the repo and ask. Don't theorize from priors.
