# F-Deploy-1 Fix Plan — v1.21 (2026-07-06)

Formal revision. Supersedes v1.20's FD register only as stated below;
all other v1.20 content stands. Basis: the 2026-07-04 window record
(Audit_Handoff_Delta_2026-07-04_id3_Window.md, on main), ratified
outcomes in v1.19 (Leg A PROVEN, FD-45 read complete), and v1.20
(restart-to-align + save complete, FD-31 closed). Drafted as
transcription of committed documents read live this session; performs
no first-instance reasoning beyond register bookkeeping; executes no
query; no box or canon contact.

## FD register (authoritative as of this revision)

- FD-42 — CLOSED by this revision. Close condition (v1.15, as
  re-qualified by FD-43: resolution routed through the four-branch
  Credential Branch Execution Runbook #861, then restart-to-align)
  is satisfied on both halves:
  (i) Credential branch RESOLVED 2026-07-04 via the re-anchor branch:
      all three on-disk candidates eliminated by masked probe
      (quote-audit valid); Branch 4 dissolved — the live .env value
      (b6694fc0…dddb9) proven canon-valid by direct off-process auth,
      identity green (episode_metadata / 10.0.20.224). No canon write;
      FD-43 rotation-count qualifier untouched.
  (ii) Restart-to-align + pm2 save complete 2026-07-06 (v1.20; FD-31
      closed).
  The precondition finding itself is REMEDIED, not merely recorded:
  SSM /episode-metadata/canon/db_password re-anchored to the proven
  value (v5 canonical, roundtrip-verified; v3 corrupted-invalid, v4
  duplicate — recorded in the 07-04 delta). .env == SSM v5 == canon
  live password. A cold workstation session can satisfy Phase 1 as
  written. FD-42's observation legs are historical record; the
  operational hazard they described no longer exists.

- FD-43 — CLOSED by this revision. Same close condition as FD-42
  (minted v1.16 to extend FD-42's chain through the 06-23 rotation
  and route remediation through the cold probe). The probe executed
  07-04 and selected the re-anchor branch; restart-to-align complete
  per v1.20. The 06-23 rotation evidence (#863) remains canonical
  history; nothing in it is retracted.

- FD-44 — CLOSED by this revision.
  Leg (a): PROVEN (ratified v1.19; upgraded from SUBSTANTIATED by
  direct off-process auth 07-04; hash-verify settled the
  method-equivalence question — recorded hashes ARE sha256 of the
  newline-stripped value). Timeline sharpened by the FD-45 dump
  digest: the working value was on-box by 06-24, three days before
  id-3's creation.
  Leg (b) (.env == SSM v2 still holds?): DISSOLVED, not answered —
  the 07-04 re-anchor superseded SSM v2 with v5; the live SSM/box
  read the cold assignment required was performed in the designated
  cold [3] window, and its result is: .env == SSM v5, roundtrip-
  verified. The question's referent no longer exists; its protective
  purpose (off-box credential validity) is satisfied.
  CORRECTION (owed by the 07-04 delta, landed here): the working
  value b6694fc0 is len 39, not len 40 as carried in v1.18's FD-44
  entry. The len-40 figure was pre-amendment (quote layer + trailing
  newline included). Full-hash matches were definitive throughout;
  no conclusion changes. v1.19 ratified Leg A from the 07-04 record
  without landing this correction — an omission of this drafting
  process, corrected here per the additive-supersede convention.

- FD-45 — OPEN (tail only), unchanged from v1.20. Cleanup owed;
  must account for pm2-save regeneration of the surface (the 07-06
  save regenerated it, acknowledged in the 07-06 delta, consistent
  with the 07-04 record's warning). Evidence copy preserved at
  capture-20260621-prereconcile/dump.pm2.fd45-evidence-20260704;
  backup dump.pm2.bak-0624-preFD38 disposition decided at close.

## Carried items (consolidated; sources: 07-04 delta, v1.19, v1.20)

So that no open item orphans as its parent FDs close:

1. P1 — rotate canon db_password at a future gated window: the
   working value's base64 was disclosed in the 07-04 session
   transcript (treat as disclosed; not an emergency — canon
   unreachable from the disclosure context, SSM re-anchor done —
   but a real P1).
2. FD-45 cleanup (above).
3. Prod block exec_mode pin — deferred gated edit (v1.19/v1.20).
4. /home/ubuntu/episode-metadata-parallel/ residue — removal
   decision pending (v1.19/v1.20).
5. Repo fix: cfoAgent.js:217,261 Windows `2>nul` → `2>/dev/null`
   (creates literal `nul` file on Linux; benign; via PR).
6. Security observations banked 07-04, routed to their finding
   classes: SSH 22 world-open (AE class); AWS static keys in .env,
   no CLI on box (AD class); cross-VPC SG rule 54.163.229.144/32 is
   LOAD-BEARING ingress — do not remove.

## Register topology after this revision

FD-41 (v1.14; mechanism superseded, observations retained) →
FD-42 (v1.15; CLOSED v1.21) → FD-43 (v1.16; CLOSED v1.21) →
FD-44 (v1.17; CLOSED v1.21) → FD-45 (v1.18; OPEN, tail) →
FD-38 (v1.19; CLOSED v1.20) → FD-31 (CLOSED v1.20).
No prior register entry is rewritten.

*Closed: FD-42, FD-43, FD-44 (with len-39 correction landed).
Open: FD-45 tail + carried items. Minted: none. Advances no gate;
authorizes no prod-box action. [skip-automerge]*
