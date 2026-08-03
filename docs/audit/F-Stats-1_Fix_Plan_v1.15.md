# F-Stats-1 Fix Plan v1.15

**Basis:** `7eb81b77` (#971). **Predecessor:** v1.14 (`5d9be42b`, #969).
**Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.14.

---

## What changed in v1.15

A canon-write scan was executed and returned clean. Four infrastructure
items raised by `Infra_DevRouting_502_2026-08-03.md` are recorded as
forward-pointers. **No F-Stats-1 execution state changes.** PR 4a is
merged at #971; §15's PR 4 split is unaffected and PR 4b remains the next
executable work.

---

## §17 Canon-write scan, 2026-08-03 (NEW)

### Occasion

`Infra_DevRouting_502_2026-08-03.md` (#970) records that for approximately
fifteen minutes `dev.primepisodes.com` served the production API against
canon. That note explicitly does not claim canon was written to; it claims
writes *would have* reached canon had they occurred, and states no such
writes were checked for. This section closes that open question.

### Method

Catalog-driven, executed from the dev box `54.87.253.45` against canon.
Read-only enforced via `PGOPTIONS="-c default_transaction_read_only=on"`.

Identity gate, observed at execution:
`current_database()` = `episode_metadata`, `host(inet_server_addr())` =
`10.0.20.224`. Canon confirmed.

The scan enumerated every table in schema `public` carrying an `updated_at`
column from `information_schema.columns`, then counted rows where
`updated_at::date = DATE '2026-08-03'`, filtering to non-zero counts.

### Result

**Zero rows. No table reported a row updated on 2026-08-03.**

### Scope of the claim

This establishes **no evidence of writes**, not that writes were
impossible.

- It covers only tables carrying `updated_at`. Tables without that column
  were not enumerated.
- It detects only writes that touch `updated_at`. A write bypassing the
  column, or a hard delete, would not appear.
- It is date-granular, not window-granular. It is a stronger test than the
  fifteen-minute window only because production is paused and any write on
  this date would be anomalous.

Sufficient on those terms. The note's fourth non-claim is **closed**.

### Method note

`inet_server_addr()::text` preserves the netmask and returns
`10.0.20.224/32`, which does not string-match a bare address. Identity
gates comparing against `10.0.20.224` must use `host(inet_server_addr())`.
A gate that fails this way is indistinguishable at a glance from a gate
that caught a wrong box.

---

## §18 Infrastructure items - forward-pointed, NOT F-Stats-1 scope (NEW)

The following are raised by #970 and by the session that produced this
revision. **F-Stats-1 does not own them.** They are recorded here only so
they are not lost, and are forward-pointed to whichever register entry
owns infrastructure. An evidence note that forward-points to "whoever owns
infrastructure" points at nobody; that is the failure mode of PE #62 and
these are recorded to avoid repeating it.

**Open item 25 - `episode-worker` stopped on the production box.**
Observed in #970: PM2 reports `episode-worker` stopped with 4 restarts on
`i-02ae7608c531db485`, alongside `episode-api-prod-hotfix` online at 22
days. Not investigated. A production process is down and nothing owns
that fact.

**Open item 26 - `Infra_DevRouting_502_2026-08-03.md` has no owner.**
The note is sound and its Option B is correctly deferred to an approved
window under freeze. It mints no authority and names no owning register
entry. Ownership is owed at a future register revision.

**Open item 27 - db_password is exposed.**
During the session producing this revision, the credential was printed to
a console and into a session transcript while deriving connection
parameters. The value is to be treated as burned. Rotation was already
deferred-but-owed; this shortens that clock. The value is deliberately not
reproduced here. Secrets are to be assigned into shell variables without
echoing to stdout.

**Open item 28 - agent escalation without a confirmation gate.**
#970 records an AI coding agent operating in the maintainer's editor
escalating from read-only investigation to `sudo` modification of a frozen
production box, unprompted, and reloading nginx twice. This is a standing
tooling condition, not a one-off: the same escalation is available on the
next diagnosis. Mitigation is a tooling change - constraining terminal
auto-execute, or removing production SSH reach from the editor
environment - and is owed alongside item 26.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.13 | 2026-08-03 | S15 PR 4 six-way split; Decision #26; S12.39; S12.40; open item 17 CLOSED; open items 20, 21. Basis 5a8de23c. |
| v1.14 | 2026-08-03 | S16 worldEvents.js inventory - 112 not 144; S12.41; S12.42; S12.35 extended; S12.43; S12.38 inverted; open items 22-24. Basis 5d9be42b. |
| v1.15 | 2026-08-03 | S17 canon-write scan, clean; S18 infra forward-pointers; open items 25-28. PR 4a merged at #971. Basis 7eb81b77. |

v1.15 supersedes v1.14 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.14.
- Mints: §17, §18, open items 25-28.
- Closes: the fourth non-claim of `Infra_DevRouting_502_2026-08-03.md`.
- Changes no F-Stats-1 execution state. §15's PR 4 split stands as written
  in v1.13.
- §18 items are recorded, not owned. F-Stats-1 claims no authority over
  them.
- Live-database contact: one read-only session against canon, identity
  gated, `default_transaction_read_only=on`. No writes. No prod-box
  contact. No configuration change on any host.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.15 is the plan-of-record. **PR 4b is the next executable work**, per
§15's six-way split in v1.13, which this revision does not alter.

The canon-write question is closed on the terms stated in §17. The four
§18 items are tracked but unowned, and remain unowned until an
infrastructure register entry claims them.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-03. Main at `7eb81b77` (#971). Predecessor: v1.14.*
*Minted: §17, §18, open items 25-28. No FD numbers. [skip-automerge]*