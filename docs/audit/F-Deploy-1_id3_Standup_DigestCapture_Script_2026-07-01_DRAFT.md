# F-Deploy-1 — id-3 Standup: Digest-Capture Script (pre-scripted, DRAFT, 2026-07-01)

**Type:** Companion artifact to `F-Deploy-1_id3_Standup_Scoping_Gate2.5_Readiness_2026-07-01_DRAFT.md`
(merged #882). Satisfies that note's **§6.1 precondition** — the digest-capture method
"**scripted and canonicalization-pinned before the sitting, not improvised at the daemon**." Doc-only,
additive. **Mints no FD.** Supersedes nothing. Box stays FROZEN; FD-31 and FD-42 remain OPEN.

**Rule 7:** This is a DRAFT script. The operator confirms and executes it *in the gated sitting*;
the drafter does not run it. It is **box-read-only** — no mutation, no `.env` edit, no `pm2` state
change. It is run **after** the sitting's live §6.1 preconditions pass and the value-free format
probes (below) confirm the on-box formats.

---

## Sec 1 — Canonicalization decision (pinned — read before trusting any digest)

**Form: VALUE-ONLY.** For each source, extract the raw `DB_PASSWORD` value, strip the trailing
newline, and `sha256sum` the resulting bytes. Nothing else is hashed — not the key name, not the
delimiter, not surrounding quotes (one layer of double-quotes stripped; see Sec 1.2).

### 1.1 — Why NOT the #879 line method (this is the load-bearing call)

The #879 rotation record (`F-Deploy-1_ThirdParty_Credential_Rotation_Order_2026-06-30_DRAFT.md`)
digests with `grep -hE '^NAME=' .env | sort | sha256sum` — i.e. the **full `NAME=value\n` line**.
That is correct **there** because #879 compares an `.env` baseline against a later `.env` state:
same file format on both sides, so hashing the whole line (key + `=` + value + newline) is sound and
even catches key-name corruption.

**This script compares across different source formats:**

| Source | Line shape for `DB_PASSWORD` |
|---|---|
| `.env` | `DB_PASSWORD=value` |
| `pm2 env 3` | `DB_PASSWORD: value` **or** `DB_PASSWORD=value` (confirm live — Sec 2) |
| `~/.pm2/dump.pm2` | JSON: `…"pm2_env":{"DB_PASSWORD":"value"}…` |

Hashing full lines across these would hash the **differing key/delimiter/quoting prefixes** and
produce a **guaranteed MISMATCH even when the value is byte-identical** — the precise
"spurious mismatch reads as a real one" failure the scoping note's §3.1 forbids. Therefore the pinned
method here is value-only, applied **identically** to every source. Every future comparison against a
DB-credential digest minted by this script MUST use this same value-only method — **not** #879's line
method. (The **one** deliberate exception is the `xcheck` timestamp diagnostic, which uses #879's line
method *on purpose* and against a *different* key — see Sec 1.4.)

### 1.2 — Properties

- **Safe-by-construction.** The only reachable error is a **false MISMATCH** (two canonical forms of
  the same value differing by an un-normalized quirk — e.g. a single-quoted `.env` value, Sec 1.3).
  A false MATCH is **impossible** (distinct values cannot collide under SHA-256). So this script can
  *fail to confirm* but can **never fabricate** "found the working credential" — exactly matching
  Sec 3.3's diagnostic-not-confirmatory ceiling. The bias is correct: it errs toward STOP, never
  toward a false green.
- **Unsalted `sha256sum`**, matching #879's risk posture. A high-entropy secret's SHA-256 is not
  meaningfully reversible; consistency with the house method beats a salt/key-management wrinkle that
  would break plain `sha256sum` comparison.
- **Value never printed.** Only 64-hex digests and key-redacted probe lines reach stdout (Sec 4).

### 1.3 — Known, bounded edge

The script strips one layer of surrounding **double** quotes (dotenv's common form). It does **not**
strip single quotes or replicate full dotenv parsing. If the on-box `.env` single-quotes the value,
the `.env`-side digest will differ from the pm2-side (which holds the already-parsed value) → a
**MISMATCH that is a formatting artifact, not a real difference**. This degrades to Sec 3.3's
"inconclusive," never to a false match. The Sec 2 probe surfaces quoting before the comparison is
trusted; if quoting is present, resolve it value-free at the sitting, do not override the verdict.

### 1.4 — The one deliberate exception: `xcheck` uses #879's line method (dead-credential-safe)

The value-only rule (1.1) is correct for the **DB credential**, where both sides are computed live
under one method. It is **not** universal: it forfeits a cross-check against #879's *committed*
digests, which are **line-digests** (`grep -hE '^NAME=' .env | sort | sha256sum`). The `xcheck` mode
exists to recover that, for **one** purpose — **timestamping id-3's launch env** — and therefore
reconstructs #879's exact byte-form (`KEY=value\n`, `sort`, no newline-strip) so its output is
comparable to a committed baseline. This is a deliberate dual-method design, not a contradiction of
1.1: value-only for the cross-format DB compare/mint; #879's line method *only* for the provider-key
timestamp cross-check.

**Why it is cheap and transcript-safe to run:** `xcheck` targets `ANTHROPIC_API_KEY`, whose old value
was **rotated and revoked at the provider console on 2026-06-30** (#879). So the cross-check digests a
**dead credential** — even the theoretical digest-of-a-secret concern is moot, the value cannot be
used if recovered, and the reference (`88971bbd…908d2f`) is already committed. A reader should not
re-litigate its safety: the probed value is revoked, and only the digest is emitted.

**What a MATCH proves (and its ceiling):** that id-3's launch env holds the *pre-06-30* Anthropic key
→ id-3 launched **before the 06-30 rotation**. It anchors to the **06-30 Anthropic** boundary, *not*
the 06-20/06-23 DB rotations — so it is a time-anchor to combine with `pm2 describe` launch-time /
restart-count evidence, never a standalone DB verdict. Both of its assumptions (baseline is the
pre-rotation digest; the provider value was unquoted) degrade to **NO-MATCH**, never a false MATCH.

---

## Sec 2 — Value-free format probes (the sitting's FIRST on-box step)

Three on-box formats cannot be seen from off-box and must be confirmed **before** trusting any
comparison. Each probe **redacts the value from the first delimiter onward** (`:` or `=`), so it is
transcript-safe:

```bash
NAME=DB_PASSWORD; PROC_ID=3; ENV_FILE=/home/ubuntu/episode-metadata/.env
# (a) pm2 env delimiter + that env is on STDOUT (not stderr): expect one redacted line
pm2 env "$PROC_ID" 2>/dev/null | grep -E "^${NAME}[:=]" | sed -E 's/^([^:=]*[:=]).*/\1<redacted>/'
# (b) .env has exactly the key, and its quoting: expect one redacted line, note any quote after '='
grep -E "^${NAME}=" "$ENV_FILE" | sed -E 's/^([^:=]*[:=]).*/\1<redacted>/'
# (c) jq present (for the dump.pm2 surface): expect a path
command -v jq || echo "NO jq — dump.pm2 surface unavailable; use pm2 env surface only"
```

Expected: (a) exactly one line, revealing `:` vs `=` and proving the env prints to **stdout** (if
`(a)` is empty but `pm2 env` clearly ran, the env may be on stderr — STOP and re-scope the read).
(b) exactly one line; if a `"` or `'` follows the `=`, note it (Sec 1.3). (c) jq path or the fallback
notice.

---

## Sec 3 — The script (`id3-cap.sh`) — box-read-only, value-free output

```bash
#!/usr/bin/env bash
# id3-cap.sh — id-3 gate-2.5 credential digest capture. EXPOSURE-SAFE.
# Prints ONLY 64-hex digests / verdicts. NEVER prints the secret value.
# Canonicalization: VALUE-ONLY (see companion doc Sec 1). Box-READ-ONLY.
# Rule 7: operator runs in the gated sitting; drafter does not run this.
# DO NOT add `set -x` — it would echo secret values.
set -uo pipefail

NAME="${NAME:-DB_PASSWORD}"
PROC_ID="${PROC_ID:-3}"
PROC_NAME="${PROC_NAME:-episode-api-prod-hotfix}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/episode-metadata/.env}"
DUMP="${DUMP:-$HOME/.pm2/dump.pm2}"
EMPTY_SHA="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

guard(){ # $1 digest — fail loud on empty / no-bytes-hashed masquerade
  [ -n "${1:-}" ] || { echo "HALT: empty digest"; exit 10; }
  [ "$1" != "$EMPTY_SHA" ] || { echo "HALT: digest==SHA256('') — no bytes hashed (no-match)"; exit 11; }
}

digest_env(){ # value-only digest of .env NAME= line
  [ -r "$ENV_FILE" ] || { echo "HALT: cannot read $ENV_FILE"; exit 2; }
  local c; c=$(grep -cE "^${NAME}=" "$ENV_FILE")
  [ "$c" -eq 1 ] || { echo "HALT: '${NAME}=' x${c} in .env (need 1)"; exit 3; }
  grep -E "^${NAME}=" "$ENV_FILE" \
    | sed -E "s/^${NAME}=//" | sed -E 's/^"(.*)"$/\1/' \
    | tr -d '\n' | sha256sum | cut -d' ' -f1
}

digest_pmenv(){ # value-only digest of pm2 env PROC_ID NAME (stopped- or running-state)
  pm2 env "$PROC_ID" >/dev/null 2>&1 || { echo "HALT: pm2 env $PROC_ID failed (bad id / pm2 down)"; exit 4; }
  local c; c=$(pm2 env "$PROC_ID" 2>/dev/null | grep -cE "^${NAME}[:=]")
  [ "$c" -eq 1 ] || { echo "HALT: '${NAME}' x${c} in pm2 env $PROC_ID (need 1)"; exit 5; }
  pm2 env "$PROC_ID" 2>/dev/null | grep -E "^${NAME}[:=]" \
    | sed -E "s/^${NAME}[:=][[:space:]]*//" | sed -E 's/^"(.*)"$/\1/' \
    | tr -d '\n' | sha256sum | cut -d' ' -f1
}

digest_dump(){ # value-only digest of dump.pm2 NAME for PROC_NAME (empty -> guard trips)
  command -v jq >/dev/null 2>&1 || { echo "HALT: jq absent — dump surface unavailable"; exit 6; }
  [ -f "$DUMP" ] || { echo "HALT: $DUMP absent (no pm2 save?)"; exit 7; }
  jq -r --arg n "$PROC_NAME" --arg k "$NAME" \
     '[.[]|select(.name==$n)|.pm2_env[$k]]|.[0] // ""' "$DUMP" \
    | tr -d '\n' | sha256sum | cut -d' ' -f1
}

xcheck(){ # line-digest (matches #879 BYTES) of a PROVIDER key vs committed baseline → timestamps launch env
  local KEY="${XKEY:-ANTHROPIC_API_KEY}"
  local REF="${XREF:?set XREF to the #879 committed baseline digest, pulled live from the record}"
  pm2 env "$PROC_ID" >/dev/null 2>&1 || { echo "HALT: pm2 env $PROC_ID failed"; exit 4; }
  local c; c=$(pm2 env "$PROC_ID" 2>/dev/null | grep -cE "^${KEY}[:=]")
  [ "$c" -eq 1 ] || { echo "HALT: '${KEY}' x${c} in pm2 env (need 1)"; exit 5; }
  local d                                    # reconstruct "KEY=value\n"; NO tr -d '\n' — mirror #879's sort|sha256sum
  d=$(pm2 env "$PROC_ID" 2>/dev/null | grep -E "^${KEY}[:=]" \
        | sed -E "s/^${KEY}[:=][[:space:]]*/${KEY}=/" \
        | sort | sha256sum | cut -d' ' -f1)
  guard "$d"
  echo "line-digest($KEY, id-$PROC_ID, #879 method): $d"
  echo "#879 committed baseline (XREF)            : $REF"
  echo "  (XREF must be pasted live from the committed #879 record at sitting time — not hardcoded/remembered)"
  if [ "$d" = "$REF" ]; then
    echo "VERDICT: MATCH — id-3 holds the PRE-rotation $KEY → launch env predates the 06-30 rotation (Sec 1.4)"
  else
    echo "VERDICT: NO-MATCH — id-3 $KEY != baseline (launched later, OR reformat artifact — Sec 1.4 caveats)"
  fi
}

case "${1:-compare}" in
  compare) # Sec 3.3 diagnostic: id-3 stopped launch env  vs  on-box .env
    de=$(digest_env);   guard "$de"
    dp=$(digest_pmenv); guard "$dp"
    echo ".env       $NAME : $de"
    echo "pm2 env $PROC_ID $NAME : $dp"
    if [ "$de" = "$dp" ]; then
      echo "VERDICT: MATCH  — id-3 launch env == on-box .env (leans: launched-with-STALE; Sec 3.3)"
    else
      echo "VERDICT: MISMATCH — id-3 launch env != on-box .env (inconclusive-positive; Sec 3.3)"
    fi ;;
  mint)    # Sec 5.1 success deliverable: proven-working running id-3 credential
    dp=$(digest_pmenv); guard "$dp"
    echo "MINTED reference digest ($NAME, RUNNING id-$PROC_ID, value-only): $dp"
    echo "Record in the sitting record as the off-box canon-credential reference (Sec 5.1)." ;;
  dump)    # Surface 2: launch env at rest
    dd=$(digest_dump); guard "$dd"
    echo "dump.pm2   $NAME : $dd" ;;
  xcheck)  # Sec 1.4 timestamp diagnostic: provider-key line-digest vs #879 committed baseline
    xcheck ;;
  *) echo "usage: id3-cap.sh [compare|mint|dump|xcheck]   (xcheck needs XREF=<#879 baseline>)"; exit 64 ;;
esac
```

---

## Sec 4 — Usage under Rule 7 (in the sitting, after §6.1 passes)

1. **Probes first (Sec 2)** — confirm delimiter, stdout-not-stderr, `.env` quoting, jq presence.
2. **`compare`** — while id-3 is **still stopped**: the Sec 3.3 diagnostic (launch env vs stale
   `.env`). Bounded per Sec 1.2 — reads MISMATCH as inconclusive, never as "found it."
3. **(optional) `dump`** — cross-check the at-rest launch env; also inventories `dump.pm2` as an
   exposure/cleanup surface (scoping note §3.2).
4. **(optional, recommended) `xcheck`** — while id-3 is **still stopped**: `XREF=<#879 baseline>
   XKEY=ANTHROPIC_API_KEY ./id3-cap.sh xcheck`, with `XREF` pasted live from the committed #879
   record. Timestamps id-3's launch env against the 06-30 rotation boundary (Sec 1.4) — an
   independent time-anchor that sharpens `compare`'s ambiguous branches. Dead-credential-safe.
5. **After the gated `pm2 start 3` and pool-auth success (scoping note §5) — `mint`.** This digests
   the **proven-working running** credential and is **the sitting's deliverable**: the off-box
   reference FD-42 says does not exist. Corroboration (scoping note §5.1): if the stopped-state
   `compare` digest == this `mint` digest, the daemon held the working value intact across the stop.

Every path prints only digests/verdicts. No value crosses into the transcript. `set -x` is prohibited.

---

## Sec 5 — What this artifact did / did not do

- **DID:** pin the dual-method canonicalization (value-only for the cross-format DB compare/mint,
  with the reasoned divergence from #879's line method; #879's line method retained *only* for the
  `xcheck` provider-key timestamp diagnostic, Sec 1.4), specify the value-free format probes, and
  provide the box-read-only, fail-loud capture
  script the scoping note's §6.1 requires pre-scripted.
- **DID NOT:** run on the box, read any live value, execute any `pm2`/`.env`/box action, perform
  gate 2.5, enter the sitting, or authorize it. Box untouched; freeze stands; FD-31 and FD-42 OPEN.

---
*Companion capture-script draft, 2026-07-01. Doc-only, additive, mints no FD, advances no gate.
Satisfies the id-3 standup scoping note's §6.1 pre-scripted-capture precondition. The sitting remains
gated and is its own deliberate Rule-7 session. [skip-automerge]*
