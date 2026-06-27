# F-Deploy-1 [3] — Cold Adoption Template Pack (BLANK — fill from your own live reads)

> These are FORMS, not findings. Every `‹ … ›` field is blank by design and must be filled
> by the closing cold session from its own Step 1 reads. Do not pre-fill from any prior
> document. If a field is already filled when you receive this, that is a drafting error —
> clear it and read for yourself.

---

## TEMPLATE 1 — Fix Plan revision (mints the close; advances the register)

```
Fix Plan vX.‹NN›   (‹NN› = current live tail + 1, determined at mint time)
Date (UTC): ‹fill›
Session attestation: COLD. Step 0 priming completed this session:
  - Wake-up trio HEAD observed: ‹fill›
  - Sec 5 scoped read: ‹done / not-done›
  - FD-31 §7 abort re-verify: ‹PASS / FAIL — your own run›
Minting: this revision advances the FD register tail ‹FD-prev› → ‹FD-new›.

Subject: F-Deploy-1 [3] — adoption of warm-executed cutover via cold full-re-verify

Body:
  [3] cutover MECHANICS were executed in a prior WARM continuation (not a validly-primed
  cold window). This revision records the cold full-re-verify performed this session and
  the resulting adoption-or-rejection. The prior execution was treated as a claim to test,
  not inherited.

  Step 1 re-verify results (this session's own live reads):
    - Box identity (IMDS instance-id):           ‹fill›
    - Canon RDS identity (private IP / VPC):      ‹fill›
    - Box git HEAD vs origin/main:                ‹fill›
    - Working tree clean:                         ‹fill›
    - A2-cfg interpreter mechanism present:       ‹fill›
    - .env DB_PASSWORD quoting (dotenv v17 cure): ‹fill›
    - Instance profile / static-key posture:      ‹fill›
    - prod-hotfix process + port + uptime:        ‹fill›
    - /health on prod-hotfix port:                ‹fill›
    - Canon counts unfiltered (catalog match):    ‹fill›
    - Canon counts active (reconciled vs unfilt): ‹fill›
    - inet_server_addr() = canon private iface:   ‹fill›

  Adjudication verdict: ‹ADOPT / REJECT — you decide; do not inherit›
  Rationale: ‹fill›
```

## TEMPLATE 2 — FD register advance entry

```
‹FD-new›: F-Deploy-1 [3] closed via cold adoption of warm-executed mechanics.
  Minted by: Fix Plan vX.‹NN› (Template 1).
  Window provenance: warm-executed, cold-re-verified-and-adopted (NOT clean cold prime).
  Date (UTC): ‹fill›
  Supersedes/relates: ‹fill — prior FD on the F-Deploy-1 chain›
  Qualifiers carried (if any): ‹fill›
```

## TEMPLATE 3 — Runbook supersede banner (additive — prepend, preserve below verbatim)

```
> ── SUPERSEDE BANNER (prepended ‹date UTC›) ───────────────────────────────
> F-Deploy-1 [3] CLOSED via cold adoption. See Fix Plan vX.‹NN›, FD register ‹FD-new›.
> Window provenance: warm-executed mechanics, cold full-re-verified and adopted this
> session — NOT a clean cold prime. The at-filing text below is preserved verbatim.
> ──────────────────────────────────────────────────────────────────────────

[... original runbook section text preserved verbatim, unedited ...]
```

## TEMPLATE 4 — FD-31 formal-lift note

```
FD-31 FREEZE — FORMAL LIFT
Date (UTC): ‹fill›
Authority: F-Deploy-1 [3] close, Fix Plan vX.‹NN›, FD register ‹FD-new›.
Lift basis: cold full-re-verify (Step 1) confirmed live box state; FD-31 §7 abort
  re-verify (Step 0) ‹PASS — your own run›.
Standing-order change: "do not reboot" freeze ‹LIFTED / remains for residual items›.
Residual post-[3] items explicitly NOT covered by this lift (deferred-by-design):
  - Fork SG Locus 7 (‹sg-id›) :5432 0.0.0.0/0 — post-[3] security sweep
  - F-Deploy-G1-AD: migrate box onto a PROD-scoped profile / off static keys
    (note: current profile is the dev-named profile per naming inversion — verify posture)
  - PR #752 (AK-3 PM2 naming) — parked, post-[3]
  - ‹any others you confirm from Sec 5 / FD-31 §7›
Verdict: ‹fill›
```

---

## Fill-discipline reminders (navigation, not findings)
- Encoding: write files with `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)` (no BOM);
  verify with `git diff` and a control-char scan, not console display.
- `[3]` in paths needs `-LiteralPath` (PowerShell glob hazard) and explicit quoting for `git add`.
- One command per line. `git diff --cached` before every commit. Rule 7 on every shared-state change.
