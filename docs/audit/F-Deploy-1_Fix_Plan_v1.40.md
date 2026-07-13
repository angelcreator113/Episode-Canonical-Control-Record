# F-Deploy-1 Fix Plan v1.40

**P5 CLOSED-placeholder 2026-07-13: nginx provisioned on `episode-dev-backend`
(1.18.0, default site removed), certbot 1.21.0 staged with renewal timer
verifiably dark, all four LE-path files the deploy conf references present
(placeholder cert + includes), and the deploy leg's actual
`nginx/episode-dev.conf` DRY-PARSED GREEN against the staged substrate — the
duplicate-default_server and missing-cert-path failure modes that would have
burned the first dispatch are proven dead before dispatch exists. DNS repoint
drafted and premise-verified but DELIBERATELY RE-SEQUENCED to the §4.3/§4.4
cutover per G2 v1.3 §4 — the flip IS the serving cutover; repoint-first would
have deleted the shared-box fallback the burn-in design depends on. Track 1
frontier narrows to the §4.2 idle-baseline synthetic, ALONE. Mints no FD.
Register tail: FD-61 at open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.39 (Track 1 patch+reboot close; merged #928, c93a4a9b) |
| **Author date** | 2026-07-13 |
| **Gate effect** | Closes P5 (provision-required -> CLOSED-placeholder). Banks the DNS repoint draft for cutover execution. Advances no gate to execution; §4.2 synthetic remains the sole Track 1 hard-gate item; first dispatch remains blocked on §4.2 + re-enablement (Rule 7 gate, untaken, unproposed). |

**Basis (live reads and writes 2026-07-13, this session, transcribed from live
terminal output, not memory):**
- Wake-up trio: origin/main at c93a4a9b (#928, v1.39); `gh pr list` -> none.
- Session-open reads (Block A), SSH as ubuntu@98.93.190.74: `df -h /` 3.3G
  free; `pm2 list` daemon up tree EMPTY (v1.39 continuity); `ls /etc/nginx`
  exit 2 with explicit not-found error (proper FD-51 negative evidence).
- Writes B1-B6, each verified by its own read leg (see §1).
- Verification C1-C4 (see §2). Box returned to substrate-only at close.

## §1 P5 execution record (Blocks B, each write its own confirm)

- **B1** nginx install: 10 packages, 1.18.0-6ubuntu14.16, unit enabled +
  auto-started; `is-active` -> active, exit 0.
- **B2** default-site removal: `sites-enabled/` emptied (ls exit 0 on the
  empty dir — empty stdout WITH exit 0 immediately after watching the sole
  entry removed is the compliant form); `nginx -t` green on emptied config.
  Kills the duplicate-`default_server` parse failure at first deploy (the
  shipped conf's port-80 block also declares `default_server`).
- **B3** certbot staging: 13 packages, certbot 1.21.0 verified exit 0.
  Side-effect renewal timer recorded ARMED (next fire ~8h) as the baseline
  B6 discharges against.
- **B4** placeholder cert at the exact LE paths the conf references:
  self-signed RSA-2048, CN=dev.primepisodes.com, notAfter Oct 11 2026,
  x509 parse-read exit 0. No CA contact, no renewal lineage — deliberate;
  the cutover draft removes this live dir before real issuance (Finding 2,
  the `-0001` lineage-drift kill).
- **B5** includes: `options-ssl-nginx.conf` fetched from certbot upstream
  under the PIPESTATUS+byte-count double gate (curl-exit=0 via
  `${PIPESTATUS[0]}`, 774 bytes); `ssl-dhparams.pem` generated locally
  (2048-bit, 424 bytes). Premise note: certbot's PACKAGE ships neither
  include — both materialize at first plugin run; staging them is required
  for the parse. (Retraction of the contrary claim recorded in-session.)
- **B6** `systemctl disable --now certbot.timer`: symlink removal printed;
  probe printed `inactive` / `disabled` with trailing exit=1 — that exit
  belongs to `is-enabled` (the last command before the echo; 1 = disabled
  is its PASS value). `is-active`'s exit was not individually captured;
  the printed `inactive` is its evidence. A cold re-runner should probe
  each separately if exit codes are wanted per-command.

## §2 Verification record (Block C)

C1 nginx active exit 0. C2 four-file sweep, four exit 0. C3 the money
exhibit: the repo's real `nginx/episode-dev.conf` (2118 bytes, guarded fetch,
public-repo raw — premise verified off-box) installed to sites-enabled,
`nginx -t` GREEN against the staged substrate; removed; second `nginx -t`
green (substrate-only coherent). C4 `systemctl reload nginx` + active exit 0
— proves the post-B2 config LOADS, not merely that the pre-B2 process stayed
up (Finding 3, upgraded mandatory in review).

## §3 DNS repoint — drafted, verified, re-sequenced

Zone Z0315161397ME2HLRQZCN read in full (JSON artifact banked).
`dev.primepisodes.com. A 300 -> 54.163.229.144` is the zone's ONLY direct
box-IP record — apex/api/staging/www are all ALB aliases; blast radius is
dev alone. The dev URL is LIVE (200s on / and /health; /api/v1/shows returns
AUTH_REQUIRED — auth enforced, no anonymous leak) served by the prod box's
nginx: a costume on prod, reachable only via this record. Repoint UPSERT to
98.93.190.74 drafted and premise-verified; NOT executed. Ruling: per G2 v1.3
§4 the flip is the serving cutover and belongs at §4.3/§4.4 after the §4.2
hard gate — repoint-first would open a weeks-class dark window behind three
gates — the §4.2 idle-baseline synthetic, the re-enablement ruling (Rule 7,
untaken), and first dispatch itself — and delete the fallback property
§4.4/§6.3 burn-in depends on. Repoint-last is strictly dominant.

**Cutover draft inherits six:** repoint (banked) · SG :80/:443 live-read +
write · placeholder live-dir removal + stray renewal/archive sweep
IMMEDIATELY before issuance · fresh HTTP-01 issuance · renewal timer
re-enable · prod-box certbot renewal cleanup for dev.primepisodes.com
(gated prod write; due before ~mid-August — renewal window opens ~30 days
ahead of the Sept 16 expiry of the cert currently homed on the prod box).

## §4 Corrections and disclosures

- **deploy-dev.yml header staleness (correction owed):** the P2 annotation
  "does not exist yet" contradicts the register (P2 CLOSED at v1.38). It
  contaminated one live sequencing argument this session before being caught
  against v1.39 §4 — prose-in-file lost to register, FD-49 class. Header
  edit is a code-file change; fold into the next PR that touches the
  workflow, or the re-enablement gate record, whichever first.
- **Unplanned prod-box open (disclosure):** read-only SSH to
  ubuntu@54.163.229.144 (~19:17 UTC, `ls /etc/letsencrypt/live` + `certbot
  certificates`) outside any ratified gate. Output material to §3 (dev cert
  homed on prod, expiry Sept 16). Freeze posture unchanged; recorded as the
  discipline exception it is.
- **Input-targeting instance (disclosure; basis: reviewer terminal
  metadata, corroborated):** B4's `mkdir` first landed in a local
  PowerShell window (exit 1), caught via Last-Command metadata BEFORE the
  openssl command followed it — the same side-channel that burned F-e,
  working defensively this time. Not visible in the session transcript as
  pasted; corroborated by the fresh SSH login (22:46, prior 22:27)
  immediately preceding B4's on-box execution. B4's end state is proven
  by its own verification reads (C2 sweep, x509 parse exit 0), which
  supersede.
- **Ride-along class, FOURTH occurrence:** B1 executed in the same paste
  stream as Block A, ahead of both its confirm and the owed memory-fix
  confirm. Structural mitigation adopted mid-session and holding: gated
  command text is NOT WRITTEN until after its confirm — a command that
  doesn't exist can't ride a buffer. B2-B6 ran clean under it, five for
  five.
- **Guard own-goal (process note):** the first-proposed fetch guard used
  `$?` after `curl | tee` — the exact PIPESTATUS defect from the standing
  hazard list. Corrected to `${PIPESTATUS[0]}` + `wc -c` (two independent
  gates, no shared failure mode); the curl|tee zero-byte false-green is
  hereby a named class alongside its parent rule.
- Phased residue: 4 updates advertised at login — deliberately not chased,
  same disposition as v1.39's netplan pair.

## §5 Retained

v1.36 in full (two-track frontier); v1.37 (custody, FD-61 parked); v1.38
(P2 close); v1.39 (patch+reboot close, paste-buffer class). Prerequisite
register: P1-P3 CLOSED, P4 folds to first dispatch, **P5 CLOSED-placeholder
(this revision; real cert owed at cutover)**. deploy-dev.yml runtime:
`disabled_manually`, unchanged. FD-61 OPEN, parked.

## §6 Register hygiene

Tail at open: FD-61. Minted: none. Closed: P5 (provision-required ->
CLOSED-placeholder; live-verified authority; not an FD). Writes this
session: six dev-box writes B1-B6 (gated class, individually confirmed
except B1, disclosed §4); zero repo writes before this revision; zero
Route 53 writes (repoint banked, unexecuted). FD-21 check on commit
message. Ships [skip-automerge] in title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.40.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-13. Predecessor: v1.39 (c93a4a9b, #928).*
*Closed: P5 (CLOSED-placeholder). Minted: none. Tail: FD-61.*
*Track 1 frontier: §4.2 idle-baseline synthetic, alone. [skip-automerge]*