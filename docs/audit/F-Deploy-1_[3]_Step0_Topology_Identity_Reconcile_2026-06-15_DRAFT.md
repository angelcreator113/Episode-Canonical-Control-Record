# F-Deploy-1 [3] Step-0 Topology and Identity Reconcile (DRAFT, 2026-06-15)

> PREP DOCUMENT. AUTHORIZES NO PROD-BOX MUTATION.
> This note is additive and supersedes nothing. It is not the [3] cold open.
> Reading or drafting this changes nothing on episode-backend (54.163.229.144).

| | |
|---|---|
| Purpose | Carry a cold-open-ready Step-0 gate for [3] Phase 2 steps 5-6 (restart-to-align and topology finalize), using route/port authority rather than process-name assumptions. |
| Evidence basis | (1) PM2 identity inversion finding (fab6c7da) establishing role authority by nginx route plus bound port. (2) Live ecosystem read in this session showing production definition already aligned to port 3000 hotfix identity. |
| Provenance stamp | Read from main at commit fab6c7da6d054554f345bcc6742750326971ff30 on 2026-06-15; ecosystem file blob: 2f3e9ca9de1600e2fccf696bc174a344ddae9c85. |
| Scope | Step-0 framing only for the eventual [3] cold open. No command authorization. |

---

## Sec 1 - Binding authority rule for [3] Phase 2 steps 5-6

For this topology, process name is metadata; route plus port is authority.

- Production authority: nginx prod vhost routes to localhost:3000.
- Development authority: nginx dev vhost routes to localhost:3002.
- Any launch/restart validation for [3] must prove ownership and health on these route-authoritative ports, not infer role from PM2 name.

This rule is mandatory for [3] restart assembly and post-restart verification.

---

## Sec 2 - Reconciled baseline known before [3] cold open

From session evidence already reviewed:

- Production-serving process identity resolved to PM2 id 3 on port 3000 (episode-api-prod-hotfix).
- Development process is PM2 id 0 on port 3002 (episode-api).
- ecosystem.config.js production app definition is already aligned to the hotfix identity and port 3000.
- ecosystem.config.js development app definition remains on port 3002.

Net effect: prior risk hypothesis (ecosystem relaunch implicitly flips production to episode-api on 3000) is demoted by current file evidence.

Residual risk is command-level and ownership-level during restart execution.

---

## Sec 3 - Mandatory pre-restart gate question

Before assembling any irreversible restart command in [3], answer this explicitly from live state:

- Does the exact ecosystem restart command intended for [3] relaunch the production definition that binds port 3000 and preserves prod routing, without creating competing ownership of 3000 or leaving orphaned listeners?

If this cannot be answered from explicit command and live-map checks, do not proceed to restart.

---

## Sec 4 - Required pre-restart captures (must be recorded in [3] session)

Capture these immediately before restart command execution:

1. nginx route targets for prod and dev vhosts (to confirm authority map unchanged).
2. PM2 process map with ids, names, modes, and PIDs.
3. Active listener ownership for port 3000 and port 3002, including current PID for 3000 owner.
4. The exact command string to be executed for restart-to-align, with target app definition explicit.

Pre-restart ownership capture is required so post-restart ownership assertions are testable.

---

## Sec 5 - Required post-restart checks (abort-linked)

Immediately after restart in [3], verify all of:

1. Exactly one process owns port 3000.
2. The post-restart 3000 owner is the expected single owner from the assembled command.
3. If the 3000 owner PID changed, the prior 3000 owner PID is no longer bound (no orphan listener).
4. Prod and dev routed health checks pass through their domains.
5. pm2 dump persistence reflects intended topology for resurrect.

Credential-survival linkage (critical):

- Treat this restart as the first live test that FD-40-aligned .env credential state survives fresh process load.
- Green status before restart is not proof of post-restart credential viability.
- Run the runbook AG integrity gate (F-Deploy-1_[3]_Master_Runbook_DRAFT Sec 7 Step 5) as the authoritative abort trigger for post-restart credential/auth failure.

---

## Sec 6 - Carry-forward open reconcile (inet_server_addr)

Keep inet_server_addr reconciliation open at [3] cold open.

- Partial evidence exists: FD-40 post-rotation probe reported 10.0.20.224.
- This is suggestive and directionally consistent.
- It does not, by itself, formally close v20 Sec 2 reconcile.
- [3] session must either close this with explicit proof or defer with rationale in-session.

---

## Sec 7 - Session and PR discipline

- This document is prep-only and not executable authority.
- [3] remains a separate cold-open session with fresh live re-verification.
- Keep this file as _DRAFT and land via normal PR path (no direct-to-main pattern).
