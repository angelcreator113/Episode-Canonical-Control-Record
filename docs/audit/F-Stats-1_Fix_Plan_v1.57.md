# F-Stats-1 Fix Plan v1.57

*Additive-supersede on v1.56. Mints §60 and ratifies **XK-3**. Seven files read. Mints no FD. Changes no shape total.*

## What changed in v1.57

**XK-3 is admitted to the Cross-Keystone Register.** Reach: F-AUTH-1 and F-Stats-1.
Ownership: OWNED (F-Stats-1 v1.57). Fix: UNEVALUATED.

**The finding: there is no authorization substrate for the tenancy root.**
`req.user.id` is a token subject with no row behind it. No `User` model exists in
`src/models/`. No model declares a User association. `shows` carries no ownership
column and neither does `universes` above it. The authorization middleware tier
takes a group name and never receives a resource identifier. **Show-scoped
authorization is not implemented, is not implementable against current schema, and
was not omitted by any handler — there is nothing to omit.**

**This arrived through FD-62's remedy question, not through a probe aimed at it.**
v1.56 §59.7 recorded FD-62's remedy as owed and unevaluated. Attempting the
evaluation required answering *may this principal act on this show*, and the answer
is that no stored fact addresses it.

**Four admission gates. Three closed on direct reads; XK-3 Gate 3 is open and requires a live database
under a FROZEN prod.** §60.2 records each with its basis.

**Changes no total.** The shape stands at **30 sites, 29 handlers, 11 files**, still
unminted as a whole. Rule 2's remaining population is **34**, unread. FD tail
remains **FD-62**; this revision mints no FD. XK tail advances **XK-2 → XK-3**.

**Distinct from XK-2, and the distinction is the reason for a separate entry.**
XK-2's remedy does not fix FD-62's three sites: they restate `show_id` in the
destructive predicate, satisfying XK-2's test, and remain defective. §60.4 records
the separation argument.

**F-Sec-3 is excluded from the reach table.** Its overlap is plausible and not
established, and §2 of the register does not admit asserted reach.

---

## §60 — XK-3 admission

### §60.1 What is admitted

> **XK-3 — no authorization substrate for the tenancy root.** Identity has no
> representation in the data model. There is no relation, column, helper, or
> middleware signature by which a handler could determine whether a principal may
> act on a given show. The partition the schema declares on `show_id` is therefore
> unenforceable by any code path in the repository.

**Admission is by this revision.** Per the register's front-matter authority note,
the register is a container and mints nothing on its own; entries acquire ownership
only when a Fix Plan revision ratifies them. This is that revision.

**Admission criteria (register §2), tested:**

1. *Upstream of two or more keystones* — F-AUTH-1 and F-Stats-1. §60.5.
2. *Does not resolve inside any single keystone* — §60.5.
3. *A Fix Plan revision ratifies* — this one.

**Not excluded on any of §2's grounds.** It is not single-keystone residue, not a
production-environment observation, and its reach is established by read rather
than asserted.

### §60.2 The four gates

| Admission gate | Question | Result | Basis |
|---|---|---|---|
| XK-3 Gate 1 | Does `shows` carry an ownership column? | **No** — at creation or in any ALTER | five schema sources, below |
| XK-3 Gate 2 | Does any middleware tier scope to a resource? | **No** — structurally incapable | `src/middleware/auth.js`, direct read |
| XK-3 Gate 3 | Is there more than one principal in practice? | **OPEN** | requires live DB; prod FROZEN |
| XK-3 Gate 4 | Does any model relate to a user? | **No** — and no `User` model exists | `src/models/*.js` grep + tree listing |

**XK-3 Gate 1's five sources**, all read in full or in relevant part:

- `src/models/Show.js` — no owner column; no `associate` block
- `src/migrations/20260109132556-create-shows.js` — canonical create-table
- `scripts/migrations/fix-shows-schema.sql`
- `scripts/migrations/create-shows-only.sql`
- `scripts/migrations/recreate-shows-table.js`

plus `src/models/Universe.js` — the only model above `shows` — which carries name,
slug, description and four narrative fields, and associates downward only.

**`creator_name` is not ownership.** It is a nullable free-text `STRING` on both the
model and the migration, present for display. It references nothing.

**XK-3 Gate 2's basis.** `authorize` is a documented alias for `verifyGroup` — the source
comment states it. Both compare `req.user.groups` against a named group and 403
otherwise. **Neither receives a route parameter, a body, or a resource id.** This is
a signature gap, not a configuration gap: no argument would make either answer a
resource question. Thirty call sites were sampled and all pass `admin` or `ADMIN`.

**The call-site sample is not the population.** It was truncated at thirty by the
probe's own flag. The Gate 2 conclusion rests on the middleware signature, which does
not depend on the count; the call-site sample corroborates and does not carry it.
**A later revision may measure the full population without disturbing this entry.**

**XK-3 Gate 4's forty hits are provenance, not ownership** — `created_by` and `user_id`
scalar columns recording who acted. Zero `belongsTo` associations to a user.
`file.js`, `job.js` and `PhonePlaythroughState` genuinely partition by `user_id`,
in raw SQL and on leaf records; **they do not reach the show tier.**

**Gate 4's negative is guarded.** An empty result for `belongsTo(models.User` would
mean nothing if no `User` model existed to belong to — so the tree was listed.
`src/models/` contains `UserDecision.js` and nothing else matching. **There is no
`User` model**, which strengthens the negative rather than weakening it.

### §60.3 Why this is a finding and not a design preference

**The schema declares the partition.** `show_id` appears across the show tier as a
foreign key with an index. Handlers filter on it. Sixty-plus register sections have
been written about whether that filtering is correct. **The partition is asserted
throughout the system and enforceable nowhere**, and that gap is a fact about the
code rather than an opinion about how it should be built.

**A single-operator deployment does not make it untrue.** Whether any second
principal exists is XK-3 Gate 3 and is unmeasured. v1.56 §59.4 established the posture and it
is carried unchanged: **structural findings are not downgraded by an unmeasured
population and not inflated by one.**

**The bound, stated in full so the entry does not over-claim.** The defect is real:
the authorization substrate is absent, established by three closed gates on direct
reads. The exploit path is bounded: it requires a second principal — some
authenticated caller who should not reach a given show. **Whether such a caller
exists is XK-3 Gate 3, it is open, and no present-population claim is made in either
direction.** The finding is admitted as *bounded and unmeasured*, not as resolved
and not as presently exploited.

**How this differs from XK-1's openness.** XK-1 was admitted with its population
question open — how many tables, in which environments. That is an open question
about *extent*. XK-3's open gate gates *severity*: whether the structural absence
has a present exploit path at all. **Both are admissible with the question open, and
they are not the same shape of openness.** A later revision closing XK-3 Gate 3
would change what can be said about exploitation and would change nothing about
whether the substrate exists.

### §60.4 Distinct from XK-2

| | XK-2 | XK-3 |
|---|---|---|
| Tenant value | available and correct | caller-supplied |
| Failure | the write drops it | nothing can authorize it |
| Class | enforcement | substrate absence |
| Remedy shape | restate the predicate | build the relation, then check it |

**The decisive test is FD-62.** Its three sites *do* restate `show_id` in the
destructive predicate. They pass XK-2's test. They delete another show's catalogue
anyway. **XK-2's first candidate remedy — restating the scope predicate on every
write — leaves all three exactly as they are.**

That is v1.55 §58.3's finding stated in register terms: a predicate that names the
right column and the wrong value. XK-2 governs predicates that omit the column.
**Two failures, adjacent surfaces, no overlap in remedy.**

### §60.5 Why no single keystone resolves it

**F-AUTH-1** governs which callers may reach an endpoint. Every tier answers a
question about the actor: is there a token, is it valid, is the actor in a group.
**None answers a question about the resource.** F-AUTH-1 could close Tracks G3
through G6 and this would be untouched.

**F-Stats-1** converts raw SQL to ORM calls and reads predicates for scope terms. A
correctly scoped ORM call is still scoped to whatever value the caller supplied.
**The lens cannot see this**; it found it only by trying to write a remedy.

**The remedy spans both and neither.** Schema (a column or a join table), model
layer (a `User` model and associations), middleware (a resource-scoped tier), and
every consumer that would call it. **No keystone in the locked sequence owns that
surface.**

### §60.6 Recorded, unminted

Surfaced while reading XK-3 Gates 1 and 2. **Not adopted, not minted, not admitted.**

- **`scripts/migrations/recreate-shows-table.js` executes `DROP TABLE IF EXISTS
  "shows" CASCADE` against `process.env.DATABASE_URL`** with no environment guard,
  no confirmation, and no dry-run. `CASCADE` on the tenancy root drops dependent
  constraints and views. It is node-executable and sits in a directory with no
  ordering and no `SequelizeMeta` relationship. **Same family as PE #62's boot-path
  inline DDL — destructive schema operations reachable without a gate.** Whether it
  has ever been run anywhere is unknown and unaskable under freeze.
- **Four creation dialects for `shows`, none authoritative.** The canonical
  migration, `fix-shows-schema.sql`, `create-shows-only.sql` and
  `recreate-shows-table.js` disagree on `premiere_date` (timestamptz vs date vs
  timestamp), on `icon` (`STRING(10)` vs `varchar(255)` vs absent), and take four
  positions on `status` (Sequelize ENUM, degraded to `varchar(50)`, named
  `show_status_enum`, bare `VARCHAR(50)`). **`fix-shows-schema.sql`'s own comments
  record a creation this repository does not contain** — it names a prior enum of
  `active/paused/completed/cancelled`.
- **Model/migration drift on `shows`.** `20260221200003-add-universe-era-columns.js`
  adds `universe_id`, `era_name` and `era_description`. **None is declared in
  `src/models/Show.js`.**
- **`admin` vs `ADMIN` casing split.** `admin.js:20` passes `['admin']`;
  `assets.js:934` and others pass `['ADMIN']`. `verifyGroup` compares with
  `.includes()`, case-sensitive. **They cannot both be correct.** Reported for
  whoever executes F-AUTH-1's deployment tracks; F-AUTH-1 is not assessed and no
  claim is made on it.
- **Four parallel migration directories** — `src/migrations/` (~200),
  `migrations/` (21), `migrations/sequelize-migrations/` (14),
  `scripts/migrations/` (~230) — with confirmed duplicate filenames across trees.
  The "multiple parallel seed strategies, none authoritative" pattern.

### §60.7 Method notes

**A pathspec defect, unexplained.** `git grep -l "shows" origin/main -- src/migrations`
returned one file. `git grep -c "shows" origin/main -- "src/migrations/*.js"`
returned nineteen. Same tree, same pattern, different pathspec form. **The cause is
not established. No negative from the bare-directory pathspec form is usable.**
Eleventh position in the hazard family, after v1.55 §58.7's unexplained null.

**A false null from a wrong path, corrected by a recursive search.** An early probe
concluded no `shows` migration existed. It searched `migrations/`; the canonical
directory is `src/migrations/`. **The conclusion was wrong and was withdrawn on the
same day it was formed.** Recorded because the failure mode — searching a plausible
path and reading the null as absence — is the one this register keeps meeting.

**A filename read as content.** `20260206000003-make-show-name-nullable.js` was
suspected of altering `shows`; it alters `episodes.show_name` and never names the
`shows` table. **Two probes correctly omitted it and the suspicion was the error.**

---

## What this revision does not do

- **Mints no FD.** FD tail remains **FD-62**.
- **Changes no total.** Shape 30/29/11; Rule 2 remainder 34.
- Does not read the remaining **34 destructive sites**; they are not asserted clean.
- Does not mint the shape. v1.48 §51.5 option 3 stands.
- Does not evaluate XK-3's remedy, FD-62's remedy, or either shape's remedy.
- Does not close XK-3 Gate 3, and does not assert anything about the principal population,
  the row count of `shows`, or any environment's actual schema.
- Does not adopt, mint, or admit any §60.6 item.
- Does not assess F-AUTH-1. The `admin`/`ADMIN` split is reported, not claimed.
- Does not measure the full `authorize` call-site population.
- Does not amend XK-1 or XK-2. Their bodies are untouched.
- Does not disposition any statement or any file.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.57 | 2026-08-16 | **Ratifies XK-3 — no authorization substrate for the tenancy root.** Reach F-AUTH-1 and F-Stats-1; OWNED (F-Stats-1 v1.57); fix UNEVALUATED. `req.user.id` is `decoded.sub`, a token subject with **no row behind it**; there is **no `User` model** in `src/models/`, no model declares a User association, `shows` carries no ownership column at creation or in any ALTER, and `universes` above it carries none either. The authorization tier — `authorize`, a **documented alias for `verifyGroup`** — compares `req.user.groups` against a group name and **never receives a resource identifier**, a signature gap rather than a configuration gap. **Show-scoped authorization is not implemented, not implementable against current schema, and not omitted by any handler — there is nothing to omit.** Arrived through **FD-62's remedy question** (v1.56 §59.7), not through a probe aimed at it. **§60.2: four admission gates, named XK-3 Gate 1–4 to avoid collision with F-AUTH-1's CP12-G and Track G series** — Gate 1 closed on five schema sources plus `Universe.js`; Gate 2 closed on a middleware read (30 call sites sampled, all `admin`/`ADMIN`, **sample truncated and not the population** — the conclusion rests on the signature, not the count); **Gate 3 OPEN**, principal population unmeasured, requires live DB under FROZEN prod; Gate 4 closed on a 40-hit grep returning **zero associations**, the negative guarded by listing `src/models/` to confirm no `User` model exists. Gate 4's forty hits are **provenance, not ownership** — `created_by`/`user_id` record who acted; `file.js`, `job.js` and `PhonePlaythroughState` partition leaf records and **do not reach the show tier**. **§60.4: distinct from XK-2, and the decisive test is FD-62** — its three sites restate `show_id` in the destructive predicate, **satisfy XK-2's test**, and delete another show's catalogue anyway; XK-2's candidate remedy leaves all three unchanged. XK-2 is enforcement failure, XK-3 is substrate absence. **§60.5:** F-AUTH-1's tiers all answer questions about the actor and none about the resource; F-Stats-1's lens reads predicates and cannot see a caller-supplied value; the remedy spans schema, model layer, middleware and every consumer. **F-Sec-3 excluded from reach** — plausible and not established, and register §2 does not admit asserted reach. **§60.3:** the schema declares the partition throughout and enforces it nowhere; **not downgraded by an unmeasured population and not inflated by one** (v1.56 §59.4 posture carried). The bound is stated in full — defect real, exploit path requiring a second principal, **Gate 3 open and no present-population claim in either direction**; admitted as *bounded and unmeasured*, not resolved and not presently exploited. **XK-1's openness was extent; XK-3's is severity** — both admissible, not the same shape. **§60.6 recorded, unminted:** `recreate-shows-table.js` executes **`DROP TABLE IF EXISTS "shows" CASCADE`** against `DATABASE_URL` with no guard, no confirmation, no dry-run — PE #62's family; **four creation dialects for `shows`** disagreeing on types and taking four positions on `status`, with `fix-shows-schema.sql` recording a prior enum this repository does not contain; **model/migration drift** — `universe_id`, `era_name`, `era_description` added by migration, undeclared on the model; **`admin` vs `ADMIN` casing split** against case-sensitive `.includes()`, reported for F-AUTH-1; **four parallel migration directories** with duplicate filenames. **§60.7 method notes:** an **unexplained pathspec defect** — bare `-- src/migrations` returned 1 file, quoted glob returned 19, cause not established, **no negative from the bare form is usable**, eleventh in the hazard family; a false null from searching `migrations/` when the canonical tree is `src/migrations/`, **withdrawn the same day**; a filename read as content at `make-show-name-nullable`. Reads seven files. Mints no FD. Closes nothing. FD tail **FD-62**. XK tail advances **XK-2 → XK-3**. No live DB contact. Prod FROZEN, untouched. §60 minted. Basis `ff3637ec`. |

## Register hygiene

- **Ratifies XK-3.** XK tail advances **XK-2 → XK-3**. The Cross-Keystone Register
  is amended by append: one §4 table row, one entry body, one footer line. **XK-1
  and XK-2 bodies are not touched.**
- **Mints no FD.** FD tail remains **FD-62**. Mints no PE.
- Mints: **§60**.
- Closes: **nothing**. XK-3 Gate 3 remains open.
- **Changes no total.** Shape **30 / 29 / 11**. Rule 2 remainder **34**.
- Records: XK-3's admission and its §2 criteria test (§60.1); the four gates and
  their bases (§60.2); why this is a finding rather than a design preference
  (§60.3); the XK-2 separation argument with FD-62 as its decisive test (§60.4);
  the no-single-keystone argument (§60.5); five unminted observations (§60.6);
  three method notes including one unexplained probe defect (§60.7).
- Carries forward, unchanged from v1.56: the twenty-seven remaining shape instances,
  unminted; **34 unread destructive sites**; FD-62's remedy, unevaluated; XK-2's owed
  amendments; the reads surface and v1.51 §54.4's instrument question; §35.5's
  classes 2–6, unminted and homing-owed; the class 2 candidate at
  `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the
  eleven-router collision surface and fail-open mount pattern;
  `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from
  v1.48; tenancy paths owed from v1.53 and v1.54; open items 22, 24, 6;
  `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1 and not claimed;
  `SEED_WARDROBE` as JS-constants-as-canon, not adopted; all other items carried from
  v1.56. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: XK-3's remedy; XK-3 Gate 3's measurement; the full `authorize` call-site population;
  §60.6's five observations and their homing; §60.7's unexplained pathspec defect;
  FD-62's remedy; all items deferred at v1.56.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod remains
  FROZEN.
- Additive-supersede on v1.56; no destructive rewrite. The register is appended to,
  not edited in place.
- **Numeral disambiguation:** *XK-3* is unrelated to §3, FD-3, PE #3, or open item 3.
  §60.2's admission gates are named **XK-3 Gate 1 … XK-3 Gate 4** and are always
  written in full. They are unrelated to **CP12-G1 … CP12-G6** (F-AUTH-1's
  retrospective closure greps, closed) and to **Track G3 … Track G6** (F-AUTH-1's
  forward deployment stages, open). Per F-AUTH-1 v2.38 bare `G<n>` is ambiguous;
  this document uses no bare `G<n>` form for its own gates.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**FD-62's remedy was deferred yesterday as owed and unevaluated. Attempting the
evaluation is what found this.** The question *may this principal act on this show*
turned out to have no data behind it anywhere in the system — and that is a larger
fact than the three handlers that raised it.

**The register has spent sixty sections asking whether handlers scope correctly.**
This one records that the thing they would scope *to* does not exist. `show_id` is a
foreign key with an index and no authority: any caller who names a show is treated
as entitled to it, because there is no stored fact that could say otherwise.

**What makes it admissible rather than merely true is FD-62.** Three handlers
restate the tenant term in the predicate, satisfy every test this pass has applied
including XK-2's, and remain defective. **That is a remedy boundary, not an
observation** — it establishes that XK-2's fix does not reach these sites and that
no keystone in the sequence owns the surface where their fix would live.

**XK-3 Gate 3 is open and it is the gate that bounds severity.** Whether a second principal
exists is a live-database question under a frozen production environment. The entry
is written so that either answer leaves it standing: **an unmeasured population does
not downgrade a structural finding, and it does not inflate one either.**

**Nothing is fixed. Ownership means the item has a home and a reader.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `ff3637ec` (#1030). Predecessor: v1.56.*
*Minted: §60. Ratifies: **XK-3**. Read: seven files. Closed: nothing. Mints no FD, no PE. Tail: FD-62. XK tail: **XK-3**. [skip-automerge]*
