# F-Deploy-1 — Canon Credential Rotation — Session Brief

**Status:** DRAFT — session brief, not a runbook. Carries no rotation commands by design.
**Procedure source-of-record:** `docs/audit/F-Deploy-1_Canon_Credential_Exposure_Finding_2026-06-14.md` §5 (landed on main via #797, commit `6d6e95b7`).
**Network-path context:** `docs/audit/F-Deploy-1_Canon_SG_Containment_Finding_2026-06-14.md` (same PR).
**Supersedes:** Nothing. Additive.

---

## 0. Why this brief carries no commands

The credential finding §5 step 2 instructs: *live-assemble the rotation against the actual ecosystem at execution time; never template the rotation commands.* This brief honors that. It stages the session — purpose, gate map, evidence bar, abort conditions — and points at §5 for the procedure. The operator assembles the actual commands live, against live state, at execution time. Any version of this brief that contained ready-to-paste rotation commands would be defective.

## 1. Declared sole purpose

Rotate the compromised canon DB credential and close the put-parameter operational gate against the rotated (v2) value. Nothing else belongs in this session. This is the first shared-state-touching session in the current thread — it writes the box `.env`, rotates on canon RDS, and overwrites the SSM SecureString. It is NOT the [3] restart session and must not drift toward it.

## 2. Why a dedicated session (not continuable from prior work)

Per the 2026-06-12 precedent restated in the exposure finding §4: a session carrying an emergency or complex event is not a clean start for the next sensitive/irreversible operation. The exposure-finding session was handoff-only because it *contained* the exposure event. By the same rule, this rotation session opens cold — its own wake-up sequence, nothing inherited.

## 3. Pre-conditions (confirm at session open, do not assume from this brief)

- Live wake-up: `git fetch origin` → `git log --oneline -1 origin/main` → `gh pr list --state open`. Confirm `6d6e95b7` (or later) is on main and the two finding docs are present at their non-DRAFT landed paths.
- Confirm the SG containment is intact: canon SG `sg-002578912805d1930` no longer carries `0.0.0.0/0` on `tcp/5432`, and the box's dedicated `/32` rule is present (the box reaches canon through it). If `0.0.0.0/0` has reappeared, STOP — that is a regression, not a rotation pre-condition.
- Confirm `3.94.166.174/32` has NOT reappeared in any canon ingress rule. If present → escalation per the SG finding §4, not a rotation step.
- Identify the undocumented third process `episode-api-prod-hotfix` (boot ~2026-06-01 20:02) before treating the box's runtime credential picture as understood. (Standing open item from register; relevant because rotation changes what a restart would reload.)

## 4. Procedure (pointer only — execute from finding §5)

The finding §5 sequence, summarized for orientation only:
1. Cold wake-up.
2. Live-assemble against actual ecosystem (no templating).
3. Rotate: new password on canon RDS → write box `.env` → overwrite SSM parameter (legitimate v2 write, retires v1 as backup-of-record).
4. Evidence: CloudTrail version increment v1 → v2 as attestation the write landed.
5. Re-verify against v2: byte-equality + box-side endpoint probe chain (the chain proven to return `episode_metadata|143|10.0.20.224` this session), now against rotated value.
6. Close put-parameter gate against v2 (mechanism + security both green).
7. Post-rotation hygiene: clear exposed value from local scrollback/buffer; confirm no raw terminal capture from the exposure session persists on disk.

Execute the authoritative steps from the landed finding, not from this summary.

## 5. Evidence bar (gate-close requires all)

- CloudTrail PutParameter showing version increment to v2, with principal/time/source-IP attestation (precedent: v1 write was `evoni-admin`, 2026-06-14 14:19:58 -04:00, `108.216.160.136`).
- Byte-equality v2 == box `.env` DB_PASSWORD (ordinal, length-checked).
- Box-side endpoint probe returning the canon discriminator `episode_metadata|143|10.0.20.224` against the rotated value.
- Hygiene confirmation (scrollback cleared, no on-disk capture).

## 6. HARD CONSTRAINT (carried verbatim from the finding)

The rotated credential value MUST NOT appear in any committed artifact, handoff doc, terminal capture committed to the repo, or this brief's successors. Record THAT rotation happened and that v2 verified; never record the value.

## 7. Abort conditions (any one → stop, hand off, do not improvise)

- `0.0.0.0/0` reappeared on canon SG, or `3.94.166.174/32` reappeared → security regression, escalate; do not rotate over an open path without reassessing.
- Box-side probe does not return `episode_metadata|143|10.0.20.224` after rotation → do not close the gate; the rotated value is not confirmed authenticating to canon.
- `episode-api-prod-hotfix` still unidentified at the point its credential state would matter → stop before any action whose safety depends on knowing what that process holds.
- Method drift under debugging pressure (the exact failure mode that caused the original exposure: wholesale `source` of `.env` instead of keyed in-memory extraction) → stop. Re-read finding §2 root cause before continuing.

Abort is a valid success condition. A clean handoff with the gate still open beats a rotation done over uncertain state.

## 8. What this session does NOT do

- Does NOT open or prime [3]. [3] is a separate cold-open session with its own FD-31 §7 abort re-verify, eligible only after this gate closes green.
- Does NOT touch the fork-side SG (`sg-0164d0b20fbebacbb`, empty fork) — deferred to post-[3] security sweep.
- Does NOT perform the post-[3] security sweep items (AD instance-profile, AE/AF SG lockdown, snapshot encryption).

## 9. Register impact to carry (per exposure finding §4A)

**MINT FD-40 in the rotation session as a REQUIRED FIRST DELIVERABLE** — not this session. Rationale: an entry filed now would record the exposure as investigation-start; investigation is not complete (VPC flow logs absent, "was it used" question unresolvable from RDS error logs, `3.94.166.174` attribution lost beyond CloudTrail). File the entry when its disposition is settled: gate moving OPEN→CLOSED as rotation completes (credential rotated, SSM v2 written, box `.env` verified aligned). This matches how FD-39's filing accrued its investigation-completion correction. Until FD-40 is minted, the exposure finding + [3] blocker pointer + this brief are the controlling record; the event is durable across four carriers (v20 handoff, two findings, the brief) and is not at risk of disappearing between this PR and the rotation session.

Additionally, **before or with FD-40's mint in the rotation session:**
- Correct the carried AF label: canon-side exposed SG was `sg-002578912805d1930` (canon, `10.0.20.224`), NOT `sg-0164d0b20fbebacbb` (empty fork). Acting on the old label would harden an empty DB.
- Add `3.94.166.174/32` reappearance as a standing escalation trigger.
- Log any new evidence on the "was it used" question (new-session flow-log review, any connection records) or note it as investigation-incomplete per evidence-retention limits.
