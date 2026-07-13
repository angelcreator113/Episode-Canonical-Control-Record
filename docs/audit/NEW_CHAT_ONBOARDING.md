# Prime Studios — New Chat Onboarding

**Purpose:** Bootstrap a new Claude conversation about Prime Studios.
This doc contains ZERO frontier assertions by design. It tells you WHERE
current state lives and HOW to derive it — never WHAT it currently is.
Its predecessor (frozen 2026-06-01) died of snapshot rot that leaked past
its own quarantine section; this version cannot rot on that axis because
it holds no state to go stale. If any sentence here appears to assert
current phase, status, version, or configuration — treat that as a defect
in this doc and correct it.

---

## 1. Wake-up sequence (mandatory, in order)

1. **Wake-up trio:**
   `git fetch origin`
   `git log --oneline -1 origin/main`
   `gh pr list`
   Any remembered HEAD, PR state, or session brief is stale by design.

2. **Find the newest F-Deploy-1 Fix Plan revision.** Never sort revision
   names lexically — v1.9 outsorts v1.37. Numeric-sort the version suffix:

   ```powershell
   git ls-tree -r origin/main --name-only |
     Select-String 'F-Deploy-1_Fix_Plan_v([\d.]+)\.md' |
     Sort-Object { [version]$_.Matches[0].Groups[1].Value } |
     Select-Object -Last 1
   ```

   Read the newest revision's bold headline paragraph, its Gate effect
   row, and its register-hygiene section (frontier, tail, carried
   obligations). That is current state. Nothing else is. The same
   regex-plus-numeric-sort pattern applies per-keystone when other fix
   plans are active.

3. **Per-claim authority rule.** The newest revision is authoritative only
   for claims it closes. Older revisions remain authoritative for claims
   they closed that were never superseded. Never treat "highest revision
   number" as authority on every axis (FD-52/FD-53 lineage).

4. **FD-ceiling rule.** The FD counter's authority is the MINTING revision.
   FDs born closed are often never restated — a newest-revision-only scan
   UNDERSTATES the ceiling. Derive by cross-revision scan before minting:
   scan at least the last three revisions for `FD-\d+` and take the max.

5. **Audit canon — same discipline:**

   ```powershell
   git ls-tree -r origin/main --name-only |
     Select-String 'Prime_Studios_Audit_Handoff_v(\d+)\.md' |
     Sort-Object { [int]$_.Matches[0].Groups[1].Value } |
     Select-Object -Last 1
   ```

   Audit revisions are additive — later supersedes earlier only for
   content it explicitly covers.

---

## 2. What Prime Studios is (stable)

Sole-developer (Evoni / JAWIHP / angelcreator113) franchise OS + AI-powered
production platform around the LalaVerse universe. Flagship show: *Styling
Adventures with Lala* (SAL). Two tiers: franchise tier (Show Bible, World
Foundation, Social Systems, Cultural Calendar) and show tier / Producer Mode
(episode production, scenes, wardrobe, career goals, character state).

The architectural keystone: **F-Franchise-1 — the franchise tier is
write-only.** Production services maintain private JS-literal canon copies
and route around it. Director Brain is F-Franchise-1's resolution, not a
separate feature.

Deployed at primepisodes.com. Repo:
github.com/angelcreator113/Episode-Canonical-Control-Record.
Stack identity: React + Vite frontend; Node/Express/Sequelize backend;
AWS EC2 + RDS PostgreSQL + PM2. Every version, instance class, process
mode, port mapping, and check list: DERIVE LIVE. Do not trust any document
(including this one) for infrastructure properties.

**Infrastructure identities (verify live before acting on any):**
EC2 `.144` = `ubuntu@54.163.229.144` (runs all app processes); dev box =
`ubuntu@98.93.190.74` (episode-dev-backend); shared key
episode-prod-key.pem. Canon RDS = `episode-control-dev` — **misleadingly
named: it is the canon-data instance, not a disposable dev DB.** Identity
by query (§4.5), never by name. Region us-east-1. Process lists, ports,
modes, versions: derive live.

---

## 3. The keystones and the locked fix sequence (identity only)

F-AUTH-1 (auth-bypass on writes, three sub-forms) · F-Deploy-1 (deploy
pipeline + autonomous-merge surface) · F-App-1 (schema-as-JS auto-repair)
· F-Stats-1 (character_state model + raw-SQL writers) · F-Ward-1
(episode_wardrobe migration gap) · F-Reg-2 (registry write-contention) ·
F-Ward-3 (duplicate outfit-set controllers) · F-Franchise-1 (write-only
franchise tier → Director Brain) · F-Sec-3 (character_key drift,
subordinate to F-Franchise-1).

**Locked sequence (Path A):** F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1
Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= Director Brain)
→ F-Sec-3.

Per-keystone STATUS lives in the newest Fix Plan / Handoff revisions.
This doc never states it.

---

## 4. Standing disciplines (stable — these ARE the project's canon)

1. **Live beats docs beats memory.** The primary failure mode is
   stale-but-coherent reads: session brief + memory + a feature branch all
   corroborating each other while all stale. Only a per-file
   `git show origin/main:<path>` on the contested file breaks it.
2. **Rule 7 — Draft → Confirm → Execute.** Real shared-state changes
   (push, PR create, merge, force-push, deletion) gate on explicit confirm
   before AND after drafting. Mechanical local ops don't gate.
3. **Evidence, not claims.** A claim is not a close; the artifact is the
   close. Evidence of execution must exit 0 and appear in the transcript.
   Empty stdout is not evidence of absence unless the read exited 0
   (FD-51). Downstream reads that look identical whether or not an action
   fired are not evidence the action fired.
4. **Attribution.** Masked-input exhibits cannot self-attribute. An exhibit
   produced under conflicting session records is superseded by a fresh
   attributable run, not reconciled.
5. **RDS identity by query, never by name.** Instance names are misleading
   by design here. `SELECT current_user, current_database(),
   inet_server_addr();` before any DB-touching action.
6. **Prod box FROZEN by default.** No reboot/restart outside a deliberate
   gated window. Confirm freeze status live.
7. **FD numbers are minted only by Fix Plan revisions.** Standalone files
   and self-applied "closed" banners are not register authority.
8. **Prose about other documents is never authority** (FD-49). Workflow
   runtime state needs `gh workflow list --all` (FD-50).
9. **FD-21 commit hygiene.** No GitHub closing keyword adjacent to `#N`
   anywhere in commit messages. `[skip-automerge]` is a TITLE token, not a
   label. PR bodies via `--body-file`.
10. **Git discipline.** Explicit-path `git add` only. `git diff --cached`
    gate before every commit. `git status` before any `--hard` reset.
    Squash-merge + branch delete.
11. **Credential custody.** Method of record: paper + adjacent SHA256
    fingerprint (first 12 hex), fingerprint recorded in the register.
    Rotation close sets negative-probe EVERY value with known disclosure,
    and validate transcription by positive-probe-from-paper.
12. **PowerShell hazards.** One command per line; `&&` invalid; literal
    `<placeholder>` parse-errors; `[3]` in paths needs `-LiteralPath`;
    no-BOM writes via `[System.IO.File]::WriteAllText`; never round-trip
    no-BOM UTF-8 through `Get-Content`; single-quoted here-strings;
    PowerShell `>` redirect writes UTF-16 — for UTF-8 file output from
    git, use `cmd /c "git show ... > file"`.

---

## 5. Working with Evoni (stable)

- In chat-only contexts, Evoni executes all commands and pastes terminal
  output back before proceeding; in agent contexts the agent executes
  directly. Rule-7 gates apply identically in both.
- Windows PowerShell environment; `gh` + `git` CLI.
- Cite audit findings by document and section, not paraphrase.
- Don't push back on energy or pace — her 4–5 hour cycle is her calibration,
  not a default human's.
- When state seems weird, ask what she did before theorizing about
  autonomous tooling.
- No feature additions, no schema redesigns, no "optimize later" during the
  fix cycle. Anything outside the locked sequence is scope creep.

---

## 6. This doc's maintenance rule

This doc changes only when the PROJECT changes (a keystone is added or
resolved, a discipline is minted or retired, the working model shifts).
It never changes to "update status" — it has no status to update. If you
find yourself adding a version number, a phase, a date-stamped state, or
an infrastructure property: stop. That content belongs in a Fix Plan
revision, and this doc already tells the reader how to find those.
