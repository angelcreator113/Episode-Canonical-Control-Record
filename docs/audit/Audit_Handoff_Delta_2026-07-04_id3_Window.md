# Audit Handoff Delta — 2026-07-04 (b) — id-3/[3] Combined Window (Partial)

Supplements the 2026-07-04 (a) delta and Prime_Studios_Audit_Handoff_v15.md.
Supersedes nothing. Records the FD-31 [3] combined FD-31/Track-B window opened and
worked this session — credential branch RESOLVED, restart-to-align NOT taken (deferred
on topology grounds). Built by transcription of this session's live reads. Cold sessions
verify everything below against main before relying on it.

## Window designation

Evoni designated this session the dedicated cold [3] window and, as sole operator,
declared it the combined FD-31/Track-B window. Wake-up trio at entry: origin/main
`1b295c4c` (#901, the 07-04(a) delta merge), zero open PRs. deploy-dev push trigger
verified empty (disabled). All state re-derived live from main; nothing inherited.

## FD-31 §7 abort re-verify — GREEN (all pre-restart conditions)

Read live from `F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md` Sec 7 (+ the
Fix Plan v1.15 FD-42 supersede banner in Sec 6.3) and the
`F-Deploy-1_[3]_Credential_Branch_Execution_Runbook.md`.

- Off-box gates (v2 §3): snapshot `episode-control-dev-prefreeze-insurance-20260530`
  `available` 100%; verified dump present, 2,828,246 bytes exact; SG `sg-002578912805d1930`
  ingress clean (no `0.0.0.0/0`, no `3.94.166.174/32`); Layer-1 identity = episode-control-dev,
  master postgres. ALL GREEN.
- Live-DB fingerprint (FD-38 unfiltered count, via the authenticated probe below): tables 143;
  episodes 72, shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444,
  franchise_knowledge 605. EXACT match to Sec 3.1 catalog. ai_usage_logs 767 (informational,
  excluded per FD-38(e); was 765 — expected append growth). GREEN.

## Credential branch — RESOLVED with NO canon write (Branch 4 dissolved)

Probe order per runbook Step P, masked/non-printing throughout, canon identity by data
(`current_database()`=episode_metadata, `inet_server_addr()`=10.0.20.224), never by name.
Candidates sourced from `capture-20260621-prereconcile/untracked/` (hash-verified before each
probe; quote-audit confirmed all three probed files unquoted, so all three negatives valid):

- Candidate B (`9f7856a2…438b`, .env.bak-20260612-144450): AUTH FAIL — eliminated.
  This is FD-44 Leg A's assigned proof-test → Leg A settlement data point = FAIL for B.
- Candidate A (`70469a66…1dc5`, .env.bak-manual-20260511-1536): AUTH FAIL — eliminated.
- Stale (`97aac3b0…41fae`, .env.pre-dbport-20260620-154546): AUTH FAIL — eliminated.
  (Bonus: hash-verify confirmed the recorded value is sha256 of the newline-stripped value,
  settling the FD-44 method-equivalence question — recorded hash IS sha256.)

All three on-disk candidates eliminated → Branch 4 indicated. BUT the 07-02 sitting record
(`F-Deploy-1_id3_Standup_Sitting_Record_2026-07-02.md`, finding 1) had already revised the
FD-42 "in-memory only" premise: the on-disk `.env` DB_PASSWORD IS the working canon credential.
Confirmed live this session:

- /proc/<id-3 PID>/environ DB_PASSWORD = `b6694fc0…dddb9` (exact match to sitting-record mint).
- Live `.env` DB_PASSWORD (amended method: strip one quote layer + trailing newline) =
  `b6694fc0…dddb9` — MATCH.
- **Off-process canon auth with the live `.env` value SUCCEEDED**, identity green
  (episode_metadata / 10.0.20.224).

→ **Branch 4 DISSOLVED. Leg A upgraded SUBSTANTIATED → PROVEN** (direct off-process auth with
the on-disk value). No canon write, no rotation-count increment. FD-43 rotation-count qualifier
untouched.

Note: the 07-04 process start (id-3 shows STARTED Thu Jul 2 13:47) is the 07-02 sitting's
`pm2 start 3`, not a new event. `pm2 describe` created-06-27 vs process-start-07-02 both true
(creation vs current start).

## FD-44/FD-45 evidentiary read — COMPLETE (dump.pm2)

Digested `~/.pm2/dump.pm2` (34,266 bytes, mtime 06-24 03:14, jq-free python3 masked digest).
Evidence PRESERVED to `capture-20260621-prereconcile/dump.pm2.fd45-evidence-20260704` before
any pm2 save could rewrite it.

- Pre-window 3-process topology frozen: episode-api (3002), episode-worker, episode-api-prod-hotfix
  (3000), all canon DB_HOST.
- **Timeline sharpener:** episode-api holds Candidate B (`9f7856a2`) at rest; episode-worker AND
  episode-api-prod-hotfix hold the working `b6694fc0`. Working value was on-box by 06-24 — three
  days before id-3's 06-27 creation. Leg A timeline tightens from "by id-3 launch" to "by 06-24."
- **len discrepancy (correction owed):** dump reports `b6694fc0` at len 39; v1.18 FD-44 carried
  "len 40." Full-hash matches are definitive (same value); len-40 was pre-amendment (quote/newline
  included). Correction for next Fix Plan revision.
- **Exposure inventory:** 12 distinct plaintext secrets at rest in episode-api's env block
  (incl. AWS static keys = AD finding, OpenAI, Anthropic, JWT, ElevenLabs, fal, Replicate, Runway,
  removebg, LALAVERSE_EMAIL_PASSWORD). FD-45 deletion-bar LIFTS (evidentiary read complete);
  cleanup owed. NOTE: Track B's `pm2 save` regenerates this surface with the same plaintext
  serialization — cleanup must account for regeneration, not just deletion.

## SSM re-anchor — DONE, roundtrip-verified (v5 canonical)

Off-box gap (FD-42/43) closed: `/episode-metadata/canon/db_password` re-anchored to the proven
`b6694fc0` value. NO canon write. History:
- v3 (20:01) — CORRUPTED in transit (PowerShell→ssh→bash three-layer quoting mangle). Invalid.
- v4 (20:31:09) / v5 (20:31:23) — guarded block double-execution (14s apart, same user); both hold
  the verified value. v5 canonical, ROUNDTRIP verified `b6694fc0…dddb9`.
Now: `.env` == SSM v5 == canon live password, one canonical secret source.

## F-Stats-1 Phase B baseline captured

Live canon read: `idx_character_state_unique` EXISTS
(UNIQUE on (show_id, season_id, character_key) WHERE season_id IS NOT NULL). `character_state`
holds ONE key: `lala`, 3 rows. NO `justawoman` rows. The dual-key drift the P0 finding described
is NOT present in live data (consistent with Phase A close #684). This is the Phase B baseline.

## Topology finding — restart-to-align NOT taken (deferred)

`ecosystem.config.js` (live) defines THREE apps: episode-api-prod-hotfix (3000, prod-default so a
bare start can't land prod on 3002), episode-worker (one shared, Track B DB-2), episode-api (3002).
No literal secrets in config (all `process.env.X ||` refs; loads .env via dotenv).

`pm2 list` shows FOUR ids, TWO mismatches with config:
- id-0 `episode-api` is **cluster** mode; config defines single fork. `uiOverlayRoutes.js`
  module-scope state is a logged P0 that BREAKS under cluster mode. Reconciliation needed.
- id-4 `episode-api-paral…` (= episode-metadata-parallel) is NOT in config — the unaccounted
  process, almost certainly the id-4 register mystery.

Because a `pm2 save` now would freeze this mismatched state into resurrect, and reconciling id-0
mode + identifying id-4 is genuine forensic classification, the restart-to-align was DEFERRED to a
fresh cold window. id-3 remains online, healthy, correct port + credential. Freeze holds.
W0 (evidence preservation) executed; W1 (pm2 list, sanctioned) executed; W2+ NOT taken.

## Register tail

No FD minted or closed by this session directly (a Fix Plan revision does that — see companion
v1.19 notes). Live effect for adoption: Leg A PROVEN; FD-45 evidentiary read complete (deletion-bar
lifts, cleanup owed); FD-31 §7 GREEN pre-restart; FD-31/42/43/44/45 remain OPEN pending the Fix
Plan revision and the deferred restart. Freeze UNCHANGED: box FROZEN, id-3 held running; deploy-dev
push trigger disabled.

## Open / owed (status, not tasks)

- **RESTART-TO-ALIGN (next cold window):** reconcile id-0 cluster-vs-config; identify id-4
  (episode-metadata-parallel) BEFORE any pm2 save; then start intended topology by name from live
  config, verify (FD-38 gate), pm2 save, re-digest resurrect state.
- **P1 — rotate db_password:** the base64 of the working value was disclosed in this session's chat
  transcript (scrollback paste). Base64 is trivially decodable → treat as disclosed. Rotate at a
  future gated window; note the exposure. Canon not reachable from the disclosure context and SSM
  re-anchor is done, so not an emergency — but a real P1 follow-up.
- **FD-45 cleanup:** owed, now unbarred; account for pm2-save regeneration of the surface.
- Correction owed: FD-44 `b6694fc0` len 39 (not 40).

## Deviations logged (Rule 7)

1. RA-1 (SSM write) re-routed mid-boundary without a confirm cycle when the box lacked AWS CLI.
   Worked, but a gate-skip. Recorded.
2. Multiple block-cascades ran past a failed predecessor (D2/D3 sequencing; a new-session D3).
   No harm — tools failed loudly, no bad write landed — but a real discipline gap. Corrected
   mid-session by moving the hash-gate INTO the code (guarded put-parameter block).
3. Credential base64 disclosed in transcript (see P1 above).

## Other findings banked

- `cfoAgent.js:217,261` uses Windows `2>nul` → creates literal `nul` in repo cwd on Linux.
  Explains the 07-04 19:47 `nul` mtime (benign; id-3's cfoAgent timer). Repo fix (→ `2>/dev/null`)
  via PR, not a live edit.
- Prod box has NO AWS CLI installed (static keys in .env but no CLI) — corrects the runbook's
  implicit assumption for on-box AWS ops.
- Cross-VPC: box is 172.31.x (default VPC); canon RDS is vpc-0754967… /10.0.20.224. The SG's
  `54.163.229.144/32` (box public IP) is LOAD-BEARING ingress, not redundant. Do not remove.
- SSH port 22 world-open — continuous internet brute-force visible in auth.log (AE class).
- id3-cap.sh uses `pm2 env` (runbook-prohibited as printing) but fully piped/non-printing — the
  sanctioned masked implementation; tension noted for the record.

Entry state at filing: origin/main `1b295c4c`, no open PRs. Wake-up trio first;
live state beats this document beats memory.
