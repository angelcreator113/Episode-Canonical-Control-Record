# F-Deploy-1 — id-3 Standup: Sitting Record (2026-07-02)

**Type:** Sitting record. Executes the scoping note (#882) with the pre-scripted capture (#883).
**Mints no FD.** FD-42 premise-revision below is a finding for Fix Plan adoption, not a self-applied revision. Box freeze amended per Sec 6 below, by explicit authorization.

## 1 — Designation & cold entry
Designated the dedicated id-3 standup cold session by Evoni. Wake-up trio at entry: origin/main @ 8895ea65 (#883), zero open PRs. No reconciliation docs, runbooks, handoffs, or prior conclusions read; #882/#883 read as execution material authored for this sitting. All state re-derived live.

## 2 — §6.1 preconditions (all PASS, verified live at sitting time)
- deploy-dev push trigger: `git show origin/main:.github/workflows/deploy-dev.yml | Select-String "^\s*push:"` → empty.
- Open PRs: none (`gh pr list`, re-run at sitting start).
- Daemon signature: pm2 list = ids 0/1/3/4 all stopped; id-3 restarts 0. Matches 06-30 signature.
- Capture method pre-scripted (#883); audited in-sitting against §3.1 (one-pass, pinned canonicalization, loud empty-guard): PASS.
- Access ledger: MOTD last login Jul 2 02:19:49 UTC from 108.216.160.136 — accounted, Evoni.

## 3 — Track B coordination (recorded per scoping §2)
Track B named and informed before the sitting. Port flip 3002→3000, pm2 save / dump.pm2 topology correction, parallel/dev work: out of scope, Track B's own window. This sitting started id 3 only; ids 0/1/4 untouched; no pm2 save; no topology formalization.

## 4 — Pre-mutation reads (id-3 stopped)
- **Format probes:** pm2 env delimiter `:` on stdout; .env key present x1; jq ABSENT (dump digest surface unavailable).
- **Canonicalization amendment (sitting-level, per companion Sec 1.3):** on-box .env value is SINGLE-quoted (double-quote count 0, single-quote count 1). Pinned method amended: value-only, strip one layer of surrounding double OR single quotes, strip trailing newline — applied identically to both sides. id3-cap.sh patched in place (lines 24/33), bash -n clean, backup id3-cap.sh.bak retained.
- **Script transcription integrity:** 86 lines, 5 functions, case/esac 65/86 — console mangle was display artifact only.
- **compare:** .env b6694fc0b2c27cb66a30c6338a1d832e53976c1700d8c85e2b611747435dddb9 == pm2 env 3 (same) → MATCH, read at ceiling (ambiguous, leans launched-with-stale).
- **xcheck:** ANTHROPIC_API_KEY line-digest 88971bbd…908d2f == #879 committed baseline (XREF pulled live from the record) → MATCH: launch env predates 06-30 rotation.
- **pm2 describe 3:** created 2026-06-27T12:50:58.883Z, restarts 0, script /home/ubuntu/episode-metadata/src/server.js.
- **dump.pm2 exposure inventory (§3.2):** EXISTS, 34,266 bytes, mtime Jun 24 03:14 — plaintext-credential-at-rest surface; jq absent so not digested; flagged for later cleanup/triage. Not mutated.

## 5 — Mutation, verification, deliverable
- **Rule-7 gated mutation:** `pm2 start 3` (plain; NO --update-env; id 3 only). Executed on explicit confirm. Online, restarts 0 across snapshots, memory settled ~133mb. (Start output appeared twice in transcript; counter stayed 0 → duplicate paste, not duplicate execution.)
- **Pool-auth:** boot log shows "Database connection authenticated" (x2), Redis connected, server on prod/3000, no auth errors.
- **Identity (live, not by name):** pm2 env 3 DB_HOST = episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com — canon per committed SG-containment designation. **GATE 2.5 RE-GREENED** (3a semantic guarantee restored; #750 3a==3b confirm makeable).
- **MINT (the deliverable):** DB_PASSWORD, RUNNING id-3, value-only (amended method):
  `b6694fc0b2c27cb66a30c6338a1d832e53976c1700d8c85e2b611747435dddb9`
  This is the off-box canon-credential reference FD-42 said did not exist. All future comparisons MUST use the amended value-only method above.
- **§5.1 corroboration:** stopped-state digest == running digest — daemon held the value intact across the stop.

## 6 — Freeze-posture amendment (AUTHORIZED)
"Box FROZEN, except id 3 (episode-api-prod-hotfix) held running as the gate-2.5 reference process. ids 0/1/4 remain stopped; no topology formalization; no pm2 save; no port flip. id-3 up for credential-readability only, pending the [3] window and Track B's combined restart." — Authorized by Evoni in the sitting, 2026-07-02.

## 7 — Findings for Fix Plan adoption
1. **FD-42 premise revision (headline):** the on-disk .env DB_PASSWORD is the WORKING canon credential — proven by a running pool authenticating against canon. FD-42's off-box gap is closed by the minted reference; its staleness premise requires revision in the next Fix Plan revision.
2. **id-4 forward-pointer sharpened:** id-3 created 06-27 12:50:58 UTC — same construction window as the id-4 gap, ~16 min after the tightened 12:34:50 boundary. Corroborates the off-record-window hypothesis. id-4 remains OPEN.
3. **Template Studio route failure confirmed live at 07-02 boot** ("url argument must be of type string") — [3]-scope item stands.
4. CFO scheduled audit: 11 critical/high dependency vulnerabilities — backlog class.
5. dump.pm2 at-rest credential surface — cleanup/triage owed (see Sec 4).

## 8 — Artifacts left on box (deliberate)
~/id3-cap.sh (amended, value-free output) and ~/id3-cap.sh.bak retained for [3] reuse of the pinned method.

## 9 — What this sitting did NOT do
No [3] entry; no cutover; no rotation; no .env edit; no pm2 save; no topology change; no ids 0/1/4 action; no FD minted or closed; no gate other than 2.5 readability affected; deploy-dev trigger untouched (remains disabled, re-enablement still gated).

---
*Sitting record, 2026-07-02. Executes #882 per #883. Gate 2.5 re-greened; FD-42 off-box reference minted; freeze amended to hold id-3 running by explicit authorization. [skip-automerge]*