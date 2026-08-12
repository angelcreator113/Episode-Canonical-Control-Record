# F-Stats-1 Fix Plan v1.35

| | |
|---|---|
| **Predecessor** | v1.34 (`bec18181`, #1007). |
| **Basis** | `baf960e8`. |
| **Author date** | 2026-08-11 |
| **Gate effect** | **Open item 36 is CLOSED by ruling** under v1.28's stated condition. The evidence v1.27 conditioned closure on became unobtainable on 2026-08-08 and cannot be recovered. **Open item 41 is minted** to make the undispositioned `worldEvents.js` surface visible to the register. No disposition changes. No finding class minted. No gate lifted. No FD minted. Tail unchanged at FD-61. |

## What changed in v1.35

- **Open item 36 CLOSED by ruling.** Carried at v1.27, v1.28, v1.29, v1.30, v1.31,
	v1.32, v1.33, and v1.34 — six carries past v1.28's own stop condition. See §37.
- **The carry condition is identified as unsatisfiable.** v1.27 conditioned closure
	on a fresh re-read of the exposed value. v1.27's own session overwrote that value
	the same day. See §37.3.
- **Open item 41 minted (new):** the `worldEvents.js` undispositioned surface has no
	open-item representation. See §38.
- **v1.34 is not otherwise disturbed.** §36's corrected census, §35.5 class 1's
	write-side restatement, the five group dispositions, and finding classes 2–6 all
	stand unchanged.
- **Deliberately out of scope:** the six unminted finding classes remain unminted and
	undispositioned. Episode generation and Invitations remain unopened. XK-1's remedy
	and the XK-1 population question, both still deferred. §29's local-to-canon write
	hazard and the `scripts/migrations/` hardcoded-fallback class are **forward-pointed,
	not minted** — see §38.3.

---

## §37 — Open item 36 CLOSED by ruling

### §37.1 Mint restated

v1.21 (2026-08-05) minted open item 36. While searching `.env` for a local postgres
credential, the canon `DB_PASSWORD` value was printed in full to a session transcript.
The command was chosen without a redaction filter; the exposure was avoidable. v1.21
folded the item into open item 32's existing rotation scope and took no action,
recording it so that the rotation session would account for it.

Open item 32 was subsequently **resolved** at v1.27, and §27's rotation-gate obligation
was **dissolved** there — no rotation was required or performed. Item 36 was minted into
that rotation scope; the scope no longer exists. Item 36 has had no pending action
attached to it since v1.27, only a pending ruling.

### §37.2 Evidentiary basis, with its limit stated in the claim

The exposed value was read from the workstation `.env`. v1.18 established on
2026-08-04 — the day before the exposure — that the local `.env` value does not
authenticate against canon, tested in both truncated and single-quoted forms, both
rejected with `password authentication failed for user "postgres"`.

The basis is therefore: **the exposed value came from the same `.env` source
previously proven non-authenticating.** It is stated at that strength deliberately.
`.env` is untracked and no history exists to prove the file was unmodified between the
08-04 test and the 08-05 read; the ruling does not claim more than the source
continuity supports. No modification is recorded in that window, and the next recorded
modification is 2026-08-08.

### §37.3 Why the ruling, and not the evidence

v1.27 declined closure pending *"a fresh re-read of the same value,"* carrying item 36
rather than closing it on what it called a weaker evidentiary chain. That position was
correct at the time it was written.

**It became unsatisfiable the same day.** v1.27's own session resolved open item 32 by
restoring the workstation `.env` from the maintainer's password manager. That restore
overwrote the exposed value. As of 2026-08-08 the only surviving copy of the value is
the 2026-08-05 session transcript that constitutes the exposure itself; re-reading it
to close the item would re-perform the exposure.

v1.28 stated the stop condition: item 36 *"should not carry a third time without either
the evidence or a ruling that the derivation suffices."* The evidence is unobtainable
and has been since before that condition was written. v1.29 reproduced v1.28's carry
paragraph verbatim, including its now-stale reference to carrying "to v1.28," and
v1.30–v1.34 carried without re-examining it. Six carries past a three-carry limit.

**This is the ruling.** The derivation suffices, at the strength stated in §37.2.

### §37.4 Disposition

**Open item 36: CLOSED.**

- No rotation driver. Open item 32 resolved at v1.27; §27's rotation-gate obligation
	dissolved there and is **not revived** by this revision.
- Canon's working credential is the password-manager value. It was never exposed.
- No live database contact is made by this revision. No prod-box contact. No dev-box
	contact. Prod remains FROZEN and this revision confers no authority to touch it.

### §37.5 Residual — recorded, not actioned

If the 2026-08-05 session transcript persists in durable or shared storage, it holds a
former canon credential. On the §37.2 basis that value is non-authenticating and
confers no access. Disposal is hygiene, not remediation, and no obligation is created
here.

**Carried forward as a lesson, not an item:** the exposure was avoidable by command
construction. Credential-adjacent reads take a redaction filter.

---

## §38 — Open item 41 (new): the undispositioned `worldEvents.js` surface is invisible to the register

### §38.1 The gap

v1.33 dispositioned 22 of 63 statements across five groups and recorded six finding
classes, **all unminted**. v1.34 corrected the census to 29 reads (16 scoped / 13
unscoped) and 20 writes (7 scoped / 10 unscoped id-keyed / 2 show-only / 1
episode-keyed), and restated §35.5 finding class 1's severity as write-side. Episode
generation and Invitations remain undispositioned and unopened.

**None of this surface is represented as an open item.** It lives in §35 and §36 prose.

With item 36 closed at §37, the register-hygiene block of this keystone would otherwise
report **zero open items** while the keystone carries 41 undispositioned statements and
six unminted finding classes. A cold session running the wake-up trio and reading
register hygiene alone will read F-Stats-1 as near-closed. It is not.

This is the same structural property the audit has documented elsewhere: the canonical
record and the operative truth held in two places with no reconciliation between them.
Here it is running inside the audit apparatus itself.

### §38.2 What this item is, and what it is not

**Open item 41 exists to make the surface visible.** It does not disposition any
statement, does not mint any finding class, does not assign severity, and does not rule
on whether the access-control classes recorded at §35.5 belong to F-Stats-1, to
F-AUTH-1, or to a keystone not yet minted. That disposition question is live and is
left open deliberately.

**Closure condition:** open item 41 closes when the `worldEvents.js` surface is either
fully dispositioned within F-Stats-1 or formally re-homed to another keystone with the
undispositioned remainder transferred. Partial disposition does not close it.

### §38.3 Forward-points, not mints

Two exposure-class surfaces are recorded here and **owned by no item in this revision**:

- **§29's local-to-canon write hazard.** The workstation `.env` now holds a working
	canon credential and points at the canon host; any database-touching local run
	reaches live canon and can write to it. The prior authentication failure was an
	accidental safety net and that net is gone.
- **`scripts/migrations/` hardcoded password fallbacks.** Those files execute DDL and
	DML, several with hardcoded credential fallbacks, and none check which database they
	address.

Both are recorded at v1.27 §29 and neither has an owning item. They are **not minted
here** — this revision does not open a credential-hygiene workstream it cannot close.
Ownership is owed at a future revision.

---

## §11 Plan Version History (UPDATED)

| v1.35 | 2026-08-11 | **Open item 36 CLOSED by ruling** — the carry condition v1.27 set became unsatisfiable on 2026-08-08 when v1.27's own `.env` restore overwrote the exposed value; six carries past v1.28's three-carry stop condition. Basis stated at source-continuity strength, not moment-of-exposure strength. §27's dissolved rotation-gate obligation not revived. **Open item 41 minted** — `worldEvents.js` undispositioned surface (41 of 63 statements, six unminted finding classes) had no open-item representation. §29's write hazard and the `scripts/migrations/` fallback class forward-pointed, unowned. No live DB contact. Prod FROZEN, untouched. §37, §38 minted. Basis `baf960e8`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.34. Tail: **FD-61**.
- Mints: **§37, §38, open item 41**.
- Closes: **open item 36** (by ruling).
- Carries: open item 6 (closed with carve-out per v1.31 §33.2, carve-out stands), and
	all other items carried from v1.34.
- Defers: XK-1's remedy; the XK-1 population question; v1.33 §35.4's Venue/social count
	defect.
- Forward-points: §29's local-to-canon write hazard and the `scripts/migrations/`
	hardcoded-fallback class. **No ownership claimed.**
- Changes no unit disposition, no PR state, no group disposition. Unit 19's withdrawal
	stands.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod remains
	FROZEN.
- Additive-supersede on v1.34; no destructive rewrite. v1.21's and v1.27's bodies are
	not modified; the ruling lives here.
- **Numeral disambiguation:** *open item 41 (F-Stats-1)* is unrelated to *FD-41
	(F-Deploy-1)* and to any §41.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-11. Main at `baf960e8`. Predecessor: v1.34 (`bec18181`, #1007).*
*Minted: §37, §38, open item 41. Closed: open item 36 by ruling. Forward-pointed: §29 write hazard, `scripts/migrations/` fallback class. Mints no FD. Tail: FD-61. [skip-automerge]*
