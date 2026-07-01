# F-Deploy-1 — Third-Party Credential Rotation Order (2026-06-30) — DRAFT

**Type:** Draft rotation procedure. Doc-only, additive. Mints no FD, supersedes nothing,
advances no gate. **Off the [3] gate.** Box stays FROZEN; FD-31 OPEN. `[skip-automerge]`.

**Rule 7:** This is a DRAFT. Operator confirms, operator executes, confirm-old-dead each item.
The drafter does not execute any step here.

## Why these, and not the others

Triggered by the 2026-06-30 pm2-jlist transcript exposure
([incident note](./F-Deploy-1_Incident_pm2jlist_SecretExposure_2026-06-30.md)). Every value in
that transcript is **burned** (retained surface) and rotates regardless of liveness — liveness
is irrelevant to whether a value sitting in a retained log is compromised. Precautionary-rotate,
skip liveness-testing (testing spends the key and writes provider logs to prove nothing that
changes the action).

**In scope (this doc):** Anthropic, OpenAI, ElevenLabs, Runway, Replicate, Fal, RemoveBG
(seven provider keys); then `LALAVERSE_EMAIL_PASSWORD` (Gmail app-password); then `JWT_SECRET`.

**Excluded — do NOT rotate here:**
- `DB_PASSWORD` (canon) — the **gated [3] keystone**. Stays on the Credential Branch Execution
  Runbook track. Whether the leaked value is even current is the cold-locked probe question.
- AWS IAM key `…RD72RVGV` — already dead (deleted/rotated). No action; closed in the incident note.

## Consumer inventory (live, 2026-06-30 — names only, no values)

Derived from `gh secret list` (repo `angelcreator113/Episode-Canonical-Control-Record`) and
`aws ssm describe-parameters`. **Drift is assumed, not parity** — the env-staleness proven this
session (a dead AWS key still sitting in the box env) is the reason. Every surface a name appears
on gets its own update line; do not assume two surfaces hold the same value.

- **SSM Parameter Store holds NONE of the nine.** Its only credential parameter is
  `/episode-metadata/canon/db_password` (gated, excluded here). ⇒ **no SSM step in Batch A/B.**
- **On-box VALUE surface is `/home/ubuntu/episode-metadata/.env` ONLY** (live-confirmed
  2026-06-30). All 9 names present, `^NAME=` anchored, exactly one line each.
- **`ecosystem.config.js` holds NO values — do NOT edit it.** Its matches are passthroughs
  (`KEY: process.env.KEY`; 7/7 are `process.env` refs, 0 hardcoded). The value resolves from
  `.env` at start. `OPENAI_API_KEY` and `LALAVERSE_EMAIL_PASSWORD` aren't referenced there at all.

**Per-name surface map (live 2026-06-30 — update exactly the ✓ surfaces):**

| Name | GitHub | `.env` (value) | `ecosystem.config.js` |
|---|:-:|:-:|:-:|
| `ANTHROPIC_API_KEY` | ✓ | ✓ | passthrough — do not edit |
| `ELEVENLABS_API_KEY` | ✓ | ✓ | passthrough — do not edit |
| `RUNWAY_ML_API_KEY` | ✓ | ✓ | passthrough — do not edit |
| `REPLICATE_API_TOKEN` | ✓ | ✓ | passthrough — do not edit |
| `FAL_KEY` | ✓ | ✓ | passthrough — do not edit |
| `REMOVEBG_API_KEY` | ✓ | ✓ | passthrough — do not edit |
| `OPENAI_API_KEY` | ✓ | ✓ | absent |
| `JWT_SECRET` | ✓ | ✓ | passthrough — do not edit |
| `LALAVERSE_EMAIL_PASSWORD` | — | ✓ | absent |

Edit `.env` in an editor — **not** `cat`/`pm2 jlist`. Leave `ecosystem.config.js` untouched.

**On-box value-free confirm baselines** — `.env` lines, anchored `^NAME=`, full SHA256, captured
2026-06-30. Each on-box edit requires **BOTH** value-free signals, not just the hash:
1. **`.env` mtime advanced to edit-day** — proves a write landed *at all*. (`stat -c %y .env`.)
2. **Line digest off baseline** — proves the value *changed*. (`grep -hE '^NAME=' .env | sort | sha256sum`.)
Hash alone can't distinguish *no-write* from *write-same-value*: the first Anthropic attempt left a
byte-identical hash AND a 3-day-stale mtime — the mtime is what proved the edit never reached the
file. Both move, or the surface didn't update.

```
ANTHROPIC_API_KEY         88971bbdb00069ee3b3c2b90ff0524060a3ba580cbd847a556c86ffa3b908d2f
OPENAI_API_KEY            26c8624a232ad2d688c4f86bafc580e56d7abbb7c4ff6c8e682968877bf329ee
ELEVENLABS_API_KEY        7756b838ce96216b73bb85df3fb2741c01c48efb416524efa97a464c6b599cf2
RUNWAY_ML_API_KEY         664ae25a58f0668add8c9c3ee0b8e538322374ac422dd852a1d8e8aac5666f6c
REPLICATE_API_TOKEN       0818c1a0a3cff2789a14c765520f2578edc12c4b49bb834bdab02b580ace9346
FAL_KEY                   3280d478e92489e7d45ab334ac09251df828fc7b63f8e139c654620a19a94bb7
REMOVEBG_API_KEY          42ad319dd2fdd81f2c03c2fa985baab38c29738f8afdb156730f81b9ab067998
JWT_SECRET                55ad0a3cf100496ae07c11c0afd53c3cb171e9d1e1aa96fe1d02867d12873157
LALAVERSE_EMAIL_PASSWORD  fa097e05447442b185a5919828484b776167219947876f3f2d64891b0291c557
```

**Breadcrumb for the gated restart (NOT Batch A):** pm2's dump (`~/.pm2/dump.pm2`) caches the
OLD *resolved* env; a plain `pm2 restart`/resurrect can reload stale values even after `.env` is
updated. The gated restart must re-read `ecosystem.config.js` + `.env` (e.g.
`pm2 reload ecosystem.config.js --env production`, or delete+start) or the new values won't load.
Untested here — flag for the restart procedure.

## Second on-box tree — `episode-metadata-parallel/.env` — batch-wide disposition (ALL NINE)

A **second** `.env` exists at `/home/ubuntu/episode-metadata-parallel/.env` (the `episode-api-parallel`
process — port 3003, `autorestart:false`, stopped). It holds the **same nine** secrets (its Anthropic
line digest matched the main tree's `88971bbd…908d2f`). Preflight only hashed the main tree, so this
surface was invisible until the Anthropic edit-confirm exposed it. One disposition, batch-wide:

- **Leak-closure — covered by the provider revoke, all nine.** Revoking each old key at its console
  invalidates that value *everywhere it exists* — both trees, plus any un-inventoried copy. The
  parallel file needs nothing from us to close the leak.
- **Functional update (writing the NEW value into parallel's `.env`) — DEFERRED, all nine**, bound to
  the parallel-process **promote-or-not** decision (warm session). Folding it into Batch A would make a
  de-facto "this app is live-and-maintained" decision as a side effect of rotation — decision-by-
  momentum the gate exists to prevent.
- **Consequence: Batch A is NOT "fully applied on-box" until the parallel tree is dispositioned by the
  promote decision.** Batch A writes the main `.env` + GitHub only. The parallel `.env`'s leak is
  revoke-closed; its functional update waits. Named here so the deferred surface can't go invisible
  again — the fix for an invisible surface is a written one.

## Masked-handling rules (apply to every step)

- **Never echo a new secret to the transcript.** No `echo $KEY`, no `cat .env`, no `pm2 jlist`.
- **GitHub:** set via stdin/file, e.g. `gh secret set NAME < file` — never `--body "<SECRET>"`
  inline. Masked confirm = `gh secret list` shows the `Updated` timestamp advanced (no value shown).
- **Box runtime config:** edit in-place with an editor (`nano`/`vi`); do not echo/cat it.
- **Provider consoles:** create-new and revoke-old in the provider UI; confirm-dead by the
  console's key listing (old key id gone/revoked), not by an auth attempt with the old value.

## Preflight (once, before any roll)

- [x] **App confirmed stopped** (2026-06-30, `pm2 list` — not `jlist`): 4/4 `stopped`.
  Runtime-config updates are disruption-free; new values load only at the next (gated) start.
- [x] **On-box value surface identified** (2026-06-30): `.env` ONLY (9 names, `^NAME=`, one each).
  `ecosystem.config.js` is `process.env` passthrough — do not edit. SHA256 baselines recorded above.
- [x] **GitHub baseline captured** (2026-06-30) — compare post-roll for value-free confirm:
  `ANTHROPIC` 05-11T12:36:57Z · `ELEVENLABS` 05-11T12:36:58Z · `FAL` 05-11T12:44:22Z ·
  `JWT_SECRET` 05-10T23:20:35Z · `OPENAI` 05-11T12:37:00Z · `REMOVEBG` 05-11T12:44:22Z ·
  `REPLICATE` 05-11T12:36:58Z · `RUNWAY` 05-11T12:37:01Z.

## Standard on-box `.env` update step (Batch A & B) — guarded, value-free

The on-box `.env` write was the failure-prone surface (wrong file via path-concat; duplicate line
via append-not-replace; "edited+saved" passing on a no-op). The guarded helper below makes those
failure modes **loud**, not silent. Create it ONCE on the box:

```bash
cat > /home/ubuntu/rotate-envkey.sh <<'SCRIPT'
#!/usr/bin/env bash
F=/home/ubuntu/episode-metadata/.env
NAME="${1:?usage: rotate-envkey.sh KEYNAME}"
pre=$(grep -cE "^${NAME}=" "$F")
[ "$pre" -eq 1 ] || { echo "HALT: '${NAME}=' appears ${pre}x (need exactly 1). Fix first."; exit 3; }
read -rsp "Paste NEW value for ${NAME}, then Enter: " V; echo
[ -n "$V" ] || { echo "HALT: empty value."; exit 4; }
tmp=$(mktemp)
if V="$V" awk -v name="$NAME" '
      index($0, name "=")==1 { print name "=" ENVIRON["V"]; m=1; next }
      { print }
      END { exit(m?0:1) }' "$F" > "$tmp"; then
  post=$(grep -cE "^${NAME}=" "$tmp")
  [ "$post" -eq 1 ] && { mv "$tmp" "$F"; echo "DONE ${NAME} count=${post}"; } \
                    || { rm -f "$tmp"; echo "HALT: post-count=${post}, unchanged."; exit 5; }
else
  rm -f "$tmp"; echo "HALT: NOMATCH on ${NAME}, unchanged."; exit 1
fi
SCRIPT
chmod +x /home/ubuntu/rotate-envkey.sh
```

Per-key invocation (from PowerShell), value entered at a hidden prompt — never in command/history/transcript:
```
ssh -t -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144 "bash /home/ubuntu/rotate-envkey.sh <NAME>"
```
Guards: **pre-count≠1 → HALT** (absent or duplicate caught before any write); **awk `END{exit(m?0:1)}`
→ HALT NOMATCH** (no silent no-op); **post-count≠1 → HALT, file untouched** (`mv` only on a clean
single line). `ENVIRON["V"]` = value passed literally, no escape-mangling. `DONE` cannot print on a
no-op or double-replace. Expect `DONE <NAME> count=1`; anything else stops the item.

## Batch A — seven provider keys (mechanical; roll → update both surfaces → confirm-old-dead)

For EACH: (1) create a new key in the provider console; (2) update its ✓ surfaces per the map —
GitHub secret + `.env` line (masked); **do not touch `ecosystem.config.js`** (passthrough);
(3) revoke/delete the old key in the console; (4) confirm old key id shows revoked/deleted in the
console listing.

- [ ] **Anthropic** (`ANTHROPIC_API_KEY`) — console.anthropic.com → Settings → API Keys.
      Surfaces: GitHub `ANTHROPIC_API_KEY` + on-box runtime config.
- [ ] **OpenAI** (`OPENAI_API_KEY`) — platform.openai.com → API keys.
      Surfaces: GitHub `OPENAI_API_KEY` + on-box runtime config.
- [ ] **ElevenLabs** (`ELEVENLABS_API_KEY`) — elevenlabs.io → profile → API key (regenerate).
      Surfaces: GitHub `ELEVENLABS_API_KEY` + on-box runtime config.
- [ ] **Runway** (`RUNWAY_ML_API_KEY`) — dev.runwayml.com → API keys.
      Surfaces: GitHub `RUNWAY_ML_API_KEY` + on-box runtime config.
- [ ] **Replicate** (`REPLICATE_API_TOKEN`) — replicate.com/account/api-tokens.
      Surfaces: GitHub `REPLICATE_API_TOKEN` + on-box runtime config.
- [ ] **Fal** (`FAL_KEY`) — fal.ai/dashboard/keys.
      Surfaces: GitHub `FAL_KEY` + on-box runtime config.
- [ ] **RemoveBG** (`REMOVEBG_API_KEY`) — remove.bg → API keys.
      Surfaces: GitHub `REMOVEBG_API_KEY` + on-box runtime config.

## Batch B — local-consequence secrets (last)

- [ ] **Gmail app-password** (`LALAVERSE_EMAIL_PASSWORD`) — Google Account → Security →
      2-Step Verification → App passwords. Revoke old, generate new.
      Surface: **on-box runtime config only.** Confirm old shows removed in the app-passwords list.
- [ ] **`JWT_SECRET`** — **⚠ SESSION-INVALIDATING:** rotating invalidates every existing signed
      token; all logged-in users are logged out on the next app start. No provider to revoke.
      Generate a new random secret locally (never recorded in any doc/chat/commit).
      Surfaces: GitHub `JWT_SECRET` + on-box runtime config. Confirm-old-dead = old-secret tokens
      fail validation after next start.

## Postflight

- [ ] For each GitHub-resident name: `gh secret list` shows `Updated` advanced past the preflight
      baseline (masked confirmation — no value printed).
- [ ] On-box runtime config holds the new value (masked check via editor — not `cat`).
- [ ] **No restart performed.** Freeze intact. New values are durable for the next app start; the
      start itself is a separate gated action, not part of this rotation.
- [ ] `DB_PASSWORD` untouched (gated).

## Breadcrumb for the gated DB rotation (NOT this doc, NOT now)

Surfaces the canon DB password lives on, recorded so the gated session inherits the inventory
(names only; advances nothing): SSM `/episode-metadata/canon/db_password`; GitHub
`PROD_DB_PASSWORD`, `PRODUCTION_DATABASE_URL`, `DEV_DB_PASSWORD`, `DATABASE_URL`; on-box runtime
config. The probe/branch order remains the Credential Branch Execution Runbook's.

**This breadcrumb is a pointer, not current state.** Confirm each surface above live before
rotating — the same stale-by-design rule that governs everything else here governs the gated
session too. Inherit the inventory, not its currency.

---
*Draft third-party rotation order, 2026-06-30. Doc-only, additive, mints no FD, off the [3] gate,
box FROZEN. Operator executes under Rule 7; confirm-old-dead each item. DB password excluded and
gated; AWS key excluded and already dead. Consumer inventory live-derived 2026-06-30, drift-assumed.*
