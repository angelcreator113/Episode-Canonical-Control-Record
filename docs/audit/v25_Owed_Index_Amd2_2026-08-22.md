| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 2** *Retrievability is the third precondition. §A3's shape spans retrieval, not only classification.* |
| --- |

# v25 Owed Index — Amendment 2

**Document version**

**AMENDMENT 2 to `v25_Owed_Index_2026-08-22.md`, extending §1 as amended by
Amendment 1.** Adds **retrievability** as a third precondition and states that
**§A3's shape spans retrieval as well as classification.**

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 1 receives a pointer banner that carries nothing.

**Rules nothing new about any finding. Mints nothing.** Ships no code. Changes
no gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

**Basis:** `origin/main` at `bbf482e0`, 2026-08-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Amendment. Extends one precondition and one general form.

---

# §B1. Three properties, not two

Amendment 1 made §1 a paired precondition. **It is a triple.**

| # | property | check |
|---|---|---|
| 1 | **POSITION** — the worktree is where it should be | `git rev-parse HEAD` equals `git rev-parse origin/main` |
| 2 | **COMPLETENESS** — the object graph is deep enough to answer | `git rev-parse --is-shallow-repository` is `false` |
| 3 | **RETRIEVABILITY** — the record is in the tree at all | **the document may be outside the tree entirely** |

**A check passing the first two still reads one of twelve CP records and
reports the other eleven as absent — cleanly.**

That is not hypothetical. `F-AUTH-1_Limb1_Measurement_2026-08-22.md` §6.1
establishes it: **eleven of twelve CP closure documents are not on `main`**,
deleted across at least two events, all recoverable from history. **Position and
completeness both PASS against that tree.** Neither has anything to say about a
document that was deleted.

**No single command discharges retrievability**, which is why it is stated as a
property rather than a check. **The operative question is whether the record
being read is the whole record, and the worktree cannot answer it** — only the
history can.

---

# §B2. §A3's shape spans retrieval, not only classification

§A3 states: **an instrument that cannot see far enough returns absence, not
error.** Its four instances are all **classifiers**.

| layer | instrument | could not reach | returned |
|---|---|---|---|
| **classification** | `asyncHandler` opacity | routes it never reached | *"does not reference `req.user`"* |
| **classification** | identity-matching walk | a factory closure | `anon` |
| **classification** | route cross-checker | `router.use()` presets | **39** |
| **classification** | `Tier` overload | which of three taxonomies | a large, confident count |
| **retrieval** | `git merge-base --is-ancestor` | commits beyond a shallow boundary | `false` |
| **retrieval** | any worktree-pointed read | eleven deleted CP records | **one of twelve, no error** |

**The same failure at a different layer.** A classifier that cannot resolve what
a thing *is* reports a definite category. A retriever that cannot reach whether
a thing *exists* reports a definite absence. **Neither signals insufficiency.**

**This is the part worth carrying:** *someone hardening an instrument against
classifier blindness would not think to check whether the document exists.* The
two failures present identically downstream and are guarded against in
completely different places.

---

# §B3. Filing is a separate act from ruling

**Recorded because the index did not prevent its own failure mode.**

**Four times in one session** a ruling was made in the course of discussing
something else, was obviously correct, was accepted — and reached no file. The
owed index (`d2a0bd9f`) exists **because of the first three. It did not prevent
the fourth**, which is this one.

> **A ruling given in the course of other work is filed at the moment it is
> given, or it is transcript-only — regardless of how obviously correct it is.**

**The mechanism is that nothing in a conversation's flow prompts the filing.**
Ruling and filing are separate acts, and only the first has a natural occasion.
**The owed index catches what is outstanding at session end. This is a leak
during the session**, and an end-of-session sweep cannot catch what a lost
container has already taken.

**Same shape as §A3's fifth instance, one domain over.** There, a rule against
instrument blindness did not stop instrument blindness inside work applying that
rule. **Here, a rule against losing rulings did not stop a ruling being lost.**
Naming a failure does not arrest it; only a check placed where the failure
occurs does.

---

# §B4. What this amendment does not do

- **Does not amend §2 or §3** of the index, or §A2/§A3's general form, which
  stand.
- **Does not supply a command for retrievability** (§B1). It is a property to
  establish, not a check to run.
- **Does not rule on first-half auditability**, which
  `F-AUTH-1_Limb1_Measurement_2026-08-22.md` §5 raises and leaves for its own
  scoping.
- **Does not re-derive §A3.1's instances 1–3**, still carried as ruled.
- Does not perform or size limb 1, advance Dimension 3, discharge limb 3, enter
  G4, or alter the freeze.
- **Mints nothing.**

---

*Type: amendment, precondition and derivation only. No host, AWS, database, or
Cognito contact. Prod FROZEN. Not merged — v24 Sec 4.6.*
