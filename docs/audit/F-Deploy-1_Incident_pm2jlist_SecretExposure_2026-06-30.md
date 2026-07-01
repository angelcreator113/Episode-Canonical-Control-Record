# F-Deploy-1 — Incident: pm2 jlist Secret Exposure to Session Transcript (2026-06-30)

**Type:** Incident record. Doc-only, additive. Mints no FD, supersedes nothing, primes
nothing, advances no gate. Box stays FROZEN; FD-31 OPEN; [3] not advanced by this document.
Records a live-derived incident + de-escalation and a remediation checklist the next
session inherits. `[skip-automerge]`.

## What happened

During a cold [3] prime, an independent all-stopped derivation was run against the prod
backend (`episode-backend`, `54.163.229.144`) via SSH. The command used was `pm2 jlist`.
`pm2 jlist` emits each process's **full environment**, so the prod pm2 env snapshot —
including secrets — was printed into the Claude Code session transcript.

`pm2 jlist` (with `pm2 env` / `pm2 prettylist`) is the **runbook-prohibited** command for
exactly this reason (Rotation_Session_Scoping_v2 Sec 4: "they print the secret to
console/transcript"). For live process-state, the correct read is `pm2 list` / `pm2 status`,
or `pm2 jlist | jq '.[].pm2_env.status'` (status only, no env).

## Exposure surface

The Claude Code session transcript — a retained logging/storage surface not controlled by
the operator. Containment (deactivate/restrict) does **not** end this exposure; only rotation
of each still-live value does. The plaintext persists in the transcript regardless of
downstream action.

## Credential classes exposed (no values recorded here)

- Canon DB password (`DB_PASSWORD`)
- One AWS IAM access key id (`…RD72RVGV`) + its secret
- Anthropic API key
- OpenAI API key
- `JWT_SECRET`
- ElevenLabs / Runway / Replicate / Fal / RemoveBG API keys
- One Gmail app password (`LALAVERSE_EMAIL_PASSWORD`)

## Key forensic finding — the pm2 env snapshot is STALE

Live, read-only AWS reads (account 637423256673):

- Exactly two IAM users exist: `evoni-admin` (key `…45BBZUGV`, Active) and
  `episode-metadata-ci-cd` (key `…WQUGVBJL`, Active, created 2026-05-11).
- The leaked key `…RD72RVGV` matches **neither** live user key.
- Root account holds **no** access keys (`AccountAccessKeysPresent = 0`), so `…RD72RVGV`
  cannot be a root key.
- Long-term `AKIA` keys belong only to IAM users or root → `…RD72RVGV` is a
  **deleted / already-rotated** key. **It is dead.**

Therefore **no live AWS credential is exposed.** The live keys (`…BJL`, `…ZUGV`) were not in
the dump. The would-be highest-severity vector (cloud-wide AWS key) required no action.

This proves the env snapshot is stale (old deploy), which lowers — but does not eliminate —
the probability the other leaked values are current. Each remaining class needs its own
liveness check; staleness of one value does not certify staleness of the rest.

## Severity reassessment

Deflated from "full prod secret set leaked, cloud-wide key burned, emergency-rotate-now" to:
a stale env snapshot was printed; its most dangerous element is already dead; remaining items
are third-party keys of uncertain liveness, rotatable methodically provider-side; the canon
DB password remains the gated [3] keystone. No live identity/cloud exposure; no minutes-matter
item.

## Remediation checklist (operator / next session)

- [x] **AWS IAM key (`…RD72RVGV`)** — confirmed dead (deleted/rotated). No action. Live keys
  `…BJL` / `…ZUGV` were not exposed.
- [x] **Third-party API keys** (Anthropic, OpenAI, ElevenLabs, Runway, Replicate, Fal,
  RemoveBG) — **ROTATED 2026-06-30**: new keys in GitHub Actions + main-tree `.env`, each
  confirmed value-free (GitHub `updated_at` advance + `.env` line-SHA256 change, count=1);
  old keys revoked at each provider console (surfaces-before-revoke order verified per item).
  `ecosystem.config.js` correctly untouched (passthrough). Parallel-tree `.env` functional
  update **deferred** (leak-closed by the revokes).
- [x] **`JWT_SECRET`** — **ROTATED 2026-06-30**: new secret in GitHub + main `.env`. No provider
  revoke; old tokens die at next restart (session-invalidating; app stopped, no live sessions).
- [x] **`LALAVERSE_EMAIL_PASSWORD`** (Gmail app password) — **ROTATED 2026-06-30**: new app
  password in main `.env`; old app-password deleted at Google.
- [ ] **Canon DB password** — **GATED, unchanged**. Stays the [3] keystone, warm/cold-gated per
  the Credential Branch Execution Runbook. Not touched by this rotation.
- [x] **SCP note** — `evoni-admin` (AdministratorAccess) is SCP-denied
  `iam:GetAccessKeyLastUsed`; IAM forensic reads are guardrail-constrained. Deeper IAM
  introspection needs org/root identity.
- [ ] **Gated restart / parallel tree — OUTSTANDING (deferred to warm/gated session)**: the new
  main-`.env` values load only on a **dump-refreshing** restart (pm2 dump caches old resolved
  env — see rotation draft breadcrumb); the parallel-tree `.env` functional update awaits the
  promote-or-not decision. Neither is an incident action.

## Process note

The prohibited command was run despite being in-context. Live process-state reads must use
status-only forms (`pm2 list` / `pm2 jlist | jq '.[].pm2_env.status'`); never `pm2 jlist` /
`pm2 env` / `pm2 prettylist` raw.

---
*Incident record, 2026-06-30. Doc-only, additive, mints no FD, primes nothing, advances no
gate. Box FROZEN; FD-31 OPEN. The cold prime reached its park (all-stopped, independently
derived); this incident occurred within it. Standing adjudication is the operator's.*
