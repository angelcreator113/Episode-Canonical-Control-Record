# F-Deploy-1 — 2026-06-24 Warm-Session Evidence Note

**Type:** Evidence note (warm session, additive forward-pointer). Mints no FD. Does not revise Fix Plan. Does not prime or close [3].
**Session status:** WARM — non-recoverably disqualified from priming [3]. See §1.
**Date:** 2026-06-24
**Forward-pointers:** → Fix Plan v1.15 (FD-42, credential precondition); → `F-Deploy-1_session-handoff_20260624.md` (cold-session carry-in); → `F-Deploy-1_2026-06-21_canon-auth-investigation_evidence.md` (auth baseline)
**Box mutations this session:** None. Box remains FROZEN.

---

## §1 — Session warm-status ruling (recorded for cold-session inherit)

This session opened as warm per the 06-24 handoff note. During this session, the following reconciliation-and-handoff documents were read in full:

- `F-Deploy-1_Box_Repo_Reconciliation_Session2_Result.md`
- `F-Deploy-1_2026-06-21_canon-auth-investigation_evidence.md`
- Fix Plan v1.15 (FD-42)
- `F-Deploy-1_[3]_Master_Runbook_DRAFT.md`
- `F-Deploy-1_session-handoff_20260624.md`

Reading that body of material is precisely the warm-disqualification class defined by the cold spec. There is no path from here to a valid cold [3] prime in this session. **The [3] restart did not happen and is not scheduled for this session.** All live SSH work done earlier in this session (abort re-verify, credential probe, pm2 read) stands as real verification and is captured below — but it does not constitute [3] priming, and no warm session may prime [3].

---

## §2 — Abort re-verify (GREEN — carry forward to cold session as durable)

Abort re-verify was run this session against the FD-31 §7 Sec-5 gates. Result: **GREEN**.

**Gates verified (FD-31 §7 Sec-5):**
1. Seven content-table counts against baseline — exact-match on all seven: episodes 72, shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444, franchise_knowledge 605.
2. Table total: **143**.
3. `ai_usage_logs`: 767 — not abort-bearing per Sec 5; logged for completeness.
4. RDS snapshot `episode-control-dev-prefreeze-insurance-20260530`: status **`available`**.
5. Local verified dump present: `Documents\PrimeStudios-Backups\episode-control-dev-verified-20260530.dump`, **2,828,246 bytes**.

**Connection-drop caveat (must travel with this green result):** The first query of the session produced a server-closed-connection error; the connection auto-recovered and the identical retry returned clean results. This is not abort-bearing. Cause is **unconfirmed** — a PGOPTIONS/version-mismatch story was floated during the session, but that is hypothesis, not a confirmed finding. Do not enshrine the benign account. Log it as cause-unconfirmed; cold session should note whether the drop recurs.

**FD-38 status (NOT independently verified this session):** The §7 checklist previously labeled this as "FD-38 integrity gate — Confirmed in abort re-verify." That label came from document reads, not from a live check labelled FD-38. What was actually run is the Sec-5 content-count pass above. Whether FD-38 IS the Sec-5 integrity gate (in which case it is confirmed by the counts above) or is a distinct gate not checked this session is unresolved here. **The cold session must confirm whether the Sec-5 pass fully covers FD-38 or whether FD-38 requires a separate run.** Do not inherit "FD-38 confirmed" from this note.

Disposition: the five Sec-5 gates above are durable unless the box state changes. The cold session should re-confirm them at open but does not need to re-derive from first principles.

---

## §3 — Credential probe: auth_ok=1 vs handoff "value unknown" (OPEN RECONCILIATION — load-bearing for cold [3])

### §3.1 — What the probe found

This session ran an auth probe against canon (`episode-control-dev`) using the box `.env` `DB_PASSWORD` value. Result: **`auth_ok=1`** — the stored credential authenticated against canon at approximately **15:xx UTC 2026-06-24**.

This probe is genuine and informative. The app is connected.

### §3.2 — The contradiction

The 06-24 session handoff states:

> *"06-23 19:46 root console MFA — masterUserPassword set + manageMasterUserPassword:false (back to manual)"*
> *"Current canon value = unknown to both parties (HIDDEN in CloudTrail; not recoverable from logs)."*

The handoff's "value unknown" framing was authored BEFORE this session's `auth_ok=1` probe. The probe is the newer evidence. However, it cannot be assumed to close the precondition on its own because:

1. The "value unknown" framing was based on CloudTrail analysis showing the 06-23 event set a new password whose value is not in the logs — yet the probe succeeded. This means the box `.env` now holds the post-06-23 canon password, but we do not know how that came to be.
2. One plausible and likely account: on 06-24 (yesterday relative to the probe), the operator corrected the box `.env` with the correct credential — meaning the 06-23 event set canon to a value the operator knew, and the operator wrote it to `.env` same day. The probe succeeding on 06-24 is consistent with this.
3. An alternative account — that the probe hit something other than canon (wrong `DB_HOST`, or a cached connection, or prod instance instead of dev) — is lower probability but was not ruled out by the probe alone.

### §3.3 — Disposition (carry forward as open reconciliation, NOT as closed precondition)

**The credential precondition is NOT closed.** The honest framing for the cold-session inheritor is:

*A read-only probe returned `auth_ok=1` against canon at approximately 15:xx UTC 2026-06-24 using the box `.env` `DB_PASSWORD`. This is genuinely informative and is consistent with the box `.env` having been corrected (operator-confirmed) yesterday 06-24, which post-dates the 06-23 canon rotation. However, it directly contradicts the handoff's "canon value unknown to both parties" framing — a framing authored before this probe. This warm session does not resolve that contradiction and does not get to declare the precondition closed on the strength of its own probe.*

The cold [3] session must run its own first-action auth probe independently: confirm `DB_HOST` resolves to canon (`episode-control-dev`), confirm `inet_server_addr()` returns the canon VPC private IP as recorded in the infra reference (confirmed live at probe time — do not validate against the IP in this note, which is from memory), confirm the probe exits `psql_exit=0`. The cold probe closing it is a clean gate pass. The cold probe surfacing a discrepancy is also a clean gate result. Either outcome is acceptable. What is not acceptable is carrying this warm session's `auth_ok=1` forward as a pre-verified closed gate — that is the exact substitution the binary warm/cold rule exists to prevent.

---

## §4 — id 3 targeting (UNRESOLVED — cold session must verify before any Phase 2 action)

This session ran `pm2 list` and observed id 3 (`episode-api-prod-hotfix`, fork, online). **id 3's port was not confirmed this session.** Specifically: the Session-2 reconciliation result (§3.3) shows port 3002 as "PM2 god (pid 90911)" — not a node app — while id 3 is listed online with ↺0. Whether id 3 is actively binding port 3002 as a node process, or is online-in-PM2 but the port is held by the daemon, or is in some other state, is unresolved as of this session.

**Targeting implication:** origin/main `ecosystem.config.js` defines `episode-api-prod-hotfix` as the prod app (PORT 3000, NODE\_ENV=production in default `env`). A Phase 2 A2 restart using `--only episode-api-prod-hotfix` would target **id 3 by name**. If id 3 is currently the dev leg (as Session 2 §3.3 reads it), that restart action hits the dev process — the same inversion class as the 06-01 502.

The cold session must, as a cold-Phase-0 box precondition — separate from and after the git wake-up trio (`git fetch` / `git log` / `gh pr list`) — run `pm2 list` + `ss -tlnp` and confirm:
- Which port id 0 (`episode-api`) is currently binding
- Which port id 3 (`episode-api-prod-hotfix`) is currently binding, or whether it is running at all
- Whether the port-to-id mapping still matches the 06-21 read or has changed

No restart command may be drafted until that read is in hand and the `--only` target is confirmed to reference the prod leg. This is a hard gate, not a soft check.

---

## §5 — .env line-46 cosmetic finding

**Line:** `/home/ubuntu/episode-metadata/.env`, line 46 — `ANTHROPIC_API_KEY=<value>`.

**Structure:** Structurally clean `KEY=value` assignment. Lines 44–48 (`REPLICATE_SAM_MODEL`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `RUNWAY_ML_API_KEY`, and adjacent) are each on their own lines with no collisions and no swallowed keys.

**The defect:** The *value* of `ANTHROPIC_API_KEY` contains unquoted spaces. Under bash sourcing (`set -a; . ./.env`), bash splits the value on the space and attempts to execute the trailing token(s) as a shell command, producing `command not found`. This is a bash-only parse failure. Node's `dotenv` parser reads the full remainder of the line as the value and is unaffected.

**Does it touch DB_PASSWORD or the credential precondition?** No. `DB_PASSWORD` is on a separate, clean line. The `auth_ok=1` probe demonstrated that `DB_PASSWORD` parses correctly even under bash sourcing. This finding is independent of §3 and does **not** escalate to the credential precondition.

**Classification:** Informational / cosmetic-to-bash-only. No action required in or near the [3] restart window.

**Disposition:** Quote the value (e.g., `ANTHROPIC_API_KEY="value with spaces"`) during a later `.env` hygiene pass, sequenced well away from the restart window. **Do not edit `.env` during or near the restart** — touching the prod env file immediately before a restart is an unforced shared-state change that complicates abort reasoning.

---

## §6 — Node-path patch delta

**Source:** `pm2 describe 0` output, read this session.

**Finding:** Version-vs-path discrepancy at the patch level:
- `node.js version` reported by the running process: **20.20.1**
- `PATH` directory in the divergent-env block: `/home/ubuntu/.nvm/versions/node/v20.20.0/bin` (rendered in output as `…v20.20.0/b`)
- Delta: PATH directory says **v20.20.0**; running interpreter identifies as **v20.20.1** — one patch level apart.

**Cause:** Unconfirmed. Most plausible benign reading is a stale PATH directory vs a since-upgraded nvm default, with the upgraded binary (v20.20.1) resolved correctly at runtime despite the PATH entry still pointing at the `.0` directory. ABI-compatible at this delta. **Do not enshrine the benign account** — cause is cause-unconfirmed; log it as such.

**Blocking status:** Non-blocking under A1. The A5 reconciliation moved the node version gate to ABI/engines-range (`>=20.0.0` / `>=9.0.0`) specifically so a patch delta does not false-abort the pre-flight (PR #812 fix). A `.0`-vs-`.1` patch difference is inside that range.

**Phase assignment:** Phase 2 (ecosystem / A2-cfg), not Phase 2A (code reconciliation / Strategy B). This is the resolution of the deferred A2-cfg node-path read — a live-box observation of the running interpreter vs PATH entry, not a code-level finding. It carries into the Phase 2 pre-flight as a known-documented discrepancy, not as a blocker.

---

## §7 — Cold-session [3] inherit checklist

The cold session opens with the wake-up trio (`git fetch`, `git log origin/main -5`, `gh pr list --state open`) and inherits the following as its pre-work:

| Item | Status inherited | Cold-session action |
|---|---|---|
| Session warm-status | Warm (this session) | Open fresh cold session; do NOT inherit this session's probe results as pre-verified |
| Abort re-verify | GREEN (§2) | Re-confirm at session open (brief, not full re-derive) |
| Credential precondition | OPEN RECONCILIATION (§3) | Run handoff's mandated first-action auth probe as cold check; confirm `DB_HOST`, `inet_server_addr()`, `.env` SHA |
| id 3 port/leg | UNRESOLVED (§4) | Cold-Phase-0 box precondition (after wake-up trio): `pm2 list` + `ss -tlnp`; confirm port/leg before any Phase 2 targeting |
| `.env` line-46 cosmetic | Informational / bash-only / non-escalating (§5) | No action in restart window; quote value in later hygiene pass |
| Node-path patch delta | Non-blocking, cause-unconfirmed, Phase 2 (A2-cfg) (§6) | Carry as known-documented discrepancy into Phase 2 pre-flight; not a blocker |
| FD-38 integrity gate | NOT independently verified as FD-38 this session (§2) | Confirm whether FD-38 is fully covered by the Sec-5 pass (§2) or requires a separate run; do not inherit as confirmed |
| `auth_ok=1` probe result | Informative, contradicts "value unknown" framing | The cold probe either confirms it (closes precondition) or surfaces a discrepancy (re-opens) |

---

## §8 — What this session did NOT do

For audit completeness:

- Did NOT restart `episode-api` (id 0) or any PM2 process
- Did NOT run `pm2 save`, `pm2 dump`, `pm2 reload`, or any PM2 write command
- Did NOT rotate or write any credential (no `modify-db-instance`, no `ssm put-parameter`, no `.env` write)
- Did NOT run `git push`, `git commit`, or any box working-tree mutation
- Did NOT prime [3]

Box remains FROZEN. The running PM2 state (id 0 on 3000, id 3 online, worker online) is unchanged from session open.
