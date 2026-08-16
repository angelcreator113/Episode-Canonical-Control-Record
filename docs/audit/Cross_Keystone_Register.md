# Cross-Keystone Register

| | |
|---|---|
| **Purpose** | Ownership home for findings upstream of two or more keystones in the locked fix-cycle sequence. |
| **Created** | 2026-08-09 |
| **Ratifying instrument** | F-Stats-1 Fix Plan v1.31. |
| **Basis** | `f499a3ba`. |
| **Authority note** | This document is a container. It mints nothing on its own. Entries acquire ownership only when a Fix Plan revision ratifies them through the pipeline. A self-applied entry carries no register authority. |

## §1 Why this register exists

The locked sequence assigns every finding to a keystone. It has no container for
findings that sit *above* the sequence — upstream of two or more keystones,
resolvable inside none of them. Such a finding has nowhere to be owned, and goes
unowned by default: a missing container, not a missing decision.

**Open item 40 (F-Stats-1)** is the first admitted instance.
`Paranoid_Exposure_Inventory_2026-08-07.md` §6 declines to assign it an owner, and
its §5 records the resulting obligation "because there is currently nowhere else
to record it." This register is that place.

## §2 Admission criteria

An entry is admitted when **all** hold:

1. The finding is upstream of two or more keystones in the locked sequence, or
   sits outside the sequence entirely (boot path, pipeline, workstation).
2. It does not resolve by work inside any single keystone.
3. A Fix Plan revision ratifies its admission.

Not admitted: single-keystone residue (belongs to that keystone),
production-environment observations (belong to `Session_PE_Roster.md`), and
findings whose reach is asserted but not established.

## §3 Numbering

Entries are **XK-n**, minted only by a ratifying Fix Plan revision.

**XK numbers are their own space.** They do not interact with FD numbers, PE
numbers, or per-keystone open-item numbers. On first reference in any document,
an imported item retains its origin label in full — *open item 40 (F-Stats-1)*
— never the bare numeral. `docs/audit/F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md`
concerns **FD-40 (F-Deploy-1)**, which is unrelated to open item 40 (F-Stats-1).

## §4 Entries

| # | Finding | Reach | Ownership | Fix |
|---|---|---|---|---|
| XK-1 | `paranoid` exposure — 48 model tables inherit `paranoid` with no `deleted_at` column | F-Stats-1, F-Ward-1, F-Ward-3 | OWNED (F-Stats-1 v1.31) | UNEVALUATED |
| XK-2 | Row-scope not enforced in SQL — scope parameter present in the route, used for a read, dropped at the write | F-Stats-1, F-AUTH-1 | OWNED (F-Stats-1 v1.46) | UNEVALUATED |
| XK-3 | No authorization substrate for the tenancy root — no user↔show relation exists, so `show_id` is caller-asserted and unverifiable | F-AUTH-1, F-Stats-1 | OWNED (F-Stats-1 v1.57) | UNEVALUATED |

---

### XK-1 — `paranoid` exposure

**Origin:** open item 40 (F-Stats-1), minted v1.23 (#988), re-homed to the
inventory at v1.24 (`95525f30`, #990), ownership escalated at v1.30
(`f499a3ba`, #996), assigned here by F-Stats-1 v1.31.

**Evidence artifact:** `docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md`.
That document is **not superseded and not moved.** It remains the measurement of
record. This register supplies only what its §6 declined to supply: an owner.

**Mechanism.** Any model table with timestamps but no `deleted_at` column carries
a latent failure — `column "deleted_at" does not exist` on the first INSERT
against a migration-built database.

**Numbers.** 110 model tables inherit `paranoid`; **48** are missing `deleted_at`
and exposed; 4 are missing it but immune via `timestamps: false`.

**Method correction — carry this forward.** The probe over-counts by 4.
`m.options.paranoid` reports `true` for models that also set `timestamps: false`,
because the global is inherited regardless. The exposed set is **models with
timestamps AND no `deleted_at`** — *not* models reporting `paranoid`. The four
inoperatively-paranoid models are `script_edit_history`,
`script_learning_profiles`, `script_suggestions`, `script_templates`. Anyone
re-running the probe must apply this correction or it will report 52.

**Cross-keystone reach** (inventory §4):

| Keystone | Exposed tables |
|---|---|
| F-Stats-1 | `character_state` |
| F-Ward-1 | `episode_wardrobe`, `episode_wardrobe_defaults` |
| F-Ward-3 | `outfit_sets`, `outfit_set_items` |

`episode_wardrobe` is F-Ward-1's Pattern 40b table — it has no migration
anywhere, and it is also on this list. `outfit_sets` and `outfit_set_items` are
the shared table surface behind F-Ward-3's two-controller drift. F-Stats-1 hit
this the moment open item 6 gave it integration coverage; F-Ward-1 and F-Ward-3
will hit it the same way, for the same reason, as soon as they get equivalent
coverage.

**Reciprocal-reference obligation** (inventory §5). Reciprocal references were
not filed in the Ward tracks; as of `394ca354` no `F-Ward-*` artifact existed in
`docs/audit/`. **When F-Ward-1 or F-Ward-3 opens a plan artifact, it must
reference the inventory and this entry.** The obligation transfers here and is
discharged only by that reference.

**Prod carve-out — do not let this harden.** The probe measured CI's
migration-built schema. Prod's schema drifted separately. Edit Stats works in
prod, so prod `character_state` almost certainly has the column — **this was not
verified, prod is FROZEN, and it must not be assumed.** Any statement about prod
exposure requires a gated verification window and carries no support until then.

**Fix: unevaluated.** A schema-wide migration, a scoped per-keystone migration,
and removing the global `paranoid` are all candidates. The inventory §6 declined
to evaluate them and this entry does not evaluate them either. Any of the three
touches a FROZEN prod and requires its own gated decision. Ownership here means
the item has a home and a reader, not that a remedy is selected.

---

### XK-2 — row-scope not enforced in SQL

**Origin:** §35.5 finding class 1 (F-Stats-1), recorded v1.33 with reach
established in one file and none beyond it. Reach established beyond it at v1.44
§47.3. Exclusion from F-AUTH-1 upheld on categorical grounds at v1.45 §48.4.
Admitted here by F-Stats-1 v1.46.

**Evidence artifacts:** F-Stats-1 Fix Plan v1.33 §35.5 (class recorded), v1.41
§44.3 and §44.7 (instances and sub-forms), v1.44 §47.3 (reach), v1.45
§48.4 (categorical basis). **None is superseded or moved.**

**Mechanism.** A handler destructures `showId` from its route, uses it to scope a
read, then issues a write keyed on the row id alone. The tenancy boundary is
enforced once, in JavaScript, and the write trusts that invariant rather than
restating it as a SQL predicate.

```
SELECT id, phases FROM show_arcs WHERE show_id = :showId AND status = 'active' ...   -- scoped
UPDATE show_arcs SET phases = :phases, updated_at = NOW() WHERE id = :id             -- unscoped
```

**Why it survives every existing check.** Every instance declares `requireAuth`
and passes F-AUTH-1's CP12 greps, because CP12 greps auth declarations and these
declarations are correct. The defect is invisible to a probe that reads
middleware and visible only to one that reads predicates.

**Sub-forms observed:**

| Sub-form | Instances |
|---|---|
| Scope cashed at the write | `worldEvents.js` 1837, 1910, 1911; `arcRoutes.js` :158, :209 |
| Caller-supplied FK written unvalidated | `worldEvents.js` 1229 |
| Route scope parameters entirely unread | `worldEvents.js` 1271, 1605, 1510 |

**Cross-keystone reach:**

| Keystone | Surface | Instances |
|---|---|---|
| F-Stats-1 | `worldEvents.js` | 1837, 1910, 1911, 1229, 1271, 1605, 1510 |
| F-AUTH-1 | `arcRoutes.js` (CP7 cluster) | :158, :209 |

25 of the 38 `worldEvents.js` statements dispositioned at v1.41 carry no scope
term, and three handlers read no route scope parameter at all. `arcRoutes.js` is
enumerated twice in F-AUTH-1 v2.37's CP7 cluster. *Inference, stated as such:*
its specific tier dispositions were not read, and CP7's completion is inferred
from the backend sweep's closure at CP12 rather than from a CP7-specific marker.
**What is established is that the file lies inside a keystone's enumerated sweep
scope and the instances survive it.**

**Why no single keystone resolves it.** F-AUTH-1's five-tier model governs which
callers may reach an endpoint. `PUT /world/:showId/arc/phase/:phase` is correctly
Tier 1 — `requireAuth`, a mutation, auth required regardless — and still
writes another show's arc. **A route can be perfectly tiered and still cross
tenants.** F-Stats-1 converts raw SQL to ORM calls, and **an ORM call without a
scope clause is exactly as unscoped as the SQL it replaces**; v1.41 §44.3 ruled
most instances WITHDRAW in any case. The defect lives between two correct
questions.

**Severity — bounded.** Exploitation requires a known row UUID, and none of the
examined handlers provides an enumeration path. **That bounds it; it does not
remove it.** The `arcRoutes.js` instances write `phases` and `progression_log` on
`show_arcs` — canon columns on the arc progression path.

**Extent — not established.** Two files. Twenty of the twenty-two `:showId`
route files are unprobed, and the probe that found `arcRoutes.js` was a floor: it
misses `WHERE e.id`, `WHERE id=:` without a space, and multi-line `WHERE`
clauses. F-Ward-1, F-Ward-3, F-Reg-2, F-Franchise-1 and F-Sec-3 surfaces are
unexamined. **Admission does not depend on extent; a later revision may measure
it without disturbing this entry.**

**Prod carve-out.** No prod enumeration was performed and none is implied.
`FD31-prod-only-schema-20260601.sql` lists `show_arcs`, so the table may sit
inside the prod/dev schema divergence F-Deploy-1 recorded — **unverified, and
no statement about prod exposure carries support until a gated window supplies
one.** Prod is FROZEN.

**Fix: unevaluated.** Candidates not evaluated here include restating the scope
predicate on every write, a repository-layer scoping helper, and row-level
security at the database. Each has different reach and cost. **Ownership here
means the item has a home and a reader, not that a remedy is selected.**

### XK-3 — no authorization substrate for the tenancy root

**Origin:** arrived through FD-62's remedy question (F-Stats-1 v1.56 §59.7), not
through a probe aimed at this. FD-62 records three destructive handlers taking
`show_id` from the request body and validating presence only. Designing a remedy
required answering *may this principal act on this show*, and that question has no
data behind it. Admitted here by F-Stats-1 v1.57.

**Evidence artifacts:** F-Stats-1 Fix Plan v1.55 §58.3 (the sub-form), v1.56 §59
(FD-62), and v1.57 §60 (the four admission gates and their reads). **None is
superseded or moved.**

**Mechanism.** `req.user.id` is `decoded.sub` — a Cognito subject string. No row
stands behind it. There is no `User` model in `src/models/`, no user table, and no
model in the codebase declares a `belongsTo` to one. `shows` carries no ownership
column; neither does `universes`, the only model above it. The authorization
middleware tier — `authorize`, a documented alias for `verifyGroup` — compares
`req.user.groups` against a named group and never receives a resource identifier.

**The consequence is not that a check was omitted. There is no check to omit.**
A handler that wanted to authorize a `show_id` has no relation to consult, no
helper to call, and no middleware signature that would accept the resource.

**What was read.** Four admission gates, all repo reads, no live database contact.
These are **XK-3 Gate 1 … XK-3 Gate 4**, always written in full; they are unrelated
to CP12-G1 … CP12-G6 and to Track G3 … Track G6 (F-AUTH-1).

| Admission gate | Result | Basis |
|---|---|---|
| XK-3 Gate 1 | `shows` has no ownership column, at creation or in any ALTER | `src/models/Show.js`; `src/migrations/20260109132556-create-shows.js`; `scripts/migrations/fix-shows-schema.sql`; `create-shows-only.sql`; `recreate-shows-table.js`; plus `src/models/Universe.js` above it |
| XK-3 Gate 2 | no resource-scoped authorization tier exists | `src/middleware/auth.js` direct read; `authorize` = `verifyGroup` by its own comment; 30 call sites all pass `admin`/`ADMIN` |
| XK-3 Gate 3 | **OPEN** — principal population unmeasured | requires live DB; prod FROZEN |
| XK-3 Gate 4 | no model declares a User association; no `User` model exists | 40-hit grep over `src/models/*.js`, zero associations; `git ls-tree` on `src/models` |

**XK-3 Gate 4's forty hits are provenance, not ownership.** `created_by` on `Scene`,
`SceneLibrary`, `Marker`, `EpisodeTemplate`, `LayerPreset`, `ThumbnailComposition`,
`SceneTemplate`; `user_id` on `DecisionLog`, `EditingDecision`,
`WardrobeUsageHistory`, `PhonePlaythroughState`, `file`, `job`. Every one records
*who acted*. None confers or checks a right. `file.js` and `job.js` do partition by
`user_id` in raw SQL, and `PhonePlaythroughState` carries a `(user_id, …)` unique
index — **these partition leaf records and do not reach the show tier.**

**XK-3 Gate 2's sample is not the population.** The call-site scan was truncated at
thirty by the probe's own flag. The gate rests on the middleware **signature**,
which does not depend on the count; the sample corroborates and does not carry it.
A later revision may measure the full population without disturbing this entry.

**Distinct from XK-2, and the distinction is load-bearing.** XK-2 is an enforcement
failure: the tenant value is available and correct, and the write drops it. XK-3 is
a substrate absence: the tenant value is caller-supplied and nothing can authorize
it. **XK-2's remedy does not fix XK-3's instances.** FD-62's three sites restate
`show_id` in the destructive predicate — they satisfy XK-2's test — and delete
another show's catalogue anyway. Restating the predicate on every write, XK-2's
first candidate remedy, leaves them exactly as they are.

**Why no single keystone resolves it.** F-AUTH-1's five-tier model governs *which
callers may reach an endpoint*; every tier answers a question about the actor and
none about the resource. F-AUTH-1 could close every open deployment track and this
would be untouched. F-Stats-1 converts raw SQL to ORM calls and reads predicates;
a correctly scoped ORM call is still scoped to a caller-supplied value. The remedy
spans schema, model layer, middleware, and every consumer that would call it —
outside both.

**Cross-keystone reach:**

| Keystone | Surface | Basis |
|---|---|---|
| F-AUTH-1 | `src/middleware/auth.js` — the tier model has no resource-scoped member | direct read; `authorize`/`verifyGroup`/`authorizeRole` all group-only |
| F-Stats-1 | the 30-site shape; FD-62's three instances | v1.55 §58, v1.56 §59 |

**F-Sec-3 is deliberately excluded.** Its surface plausibly overlaps, and that is
not established. §2 does not admit asserted reach, and an unestablished third
keystone would weaken an entry that clears the threshold on two.

**Severity — bounded, and the bound is unmeasured.** The defect is real: the
substrate is absent, established by three closed gates on direct reads. The exploit
path is bounded: it requires a second principal — some authenticated caller who
should not reach a given show. **Whether such a caller exists is XK-3 Gate 3, it is
open, and no present-population claim is made in either direction.** Admitted as
*bounded and unmeasured*, not as resolved and not as presently exploited.

**How this differs from XK-1's openness.** XK-1 was admitted with its population
question open — how many tables, in which environments. That is an open question
about *extent*. XK-3's open gate gates *severity*: whether the structural absence
has a present exploit path at all. **Both are admissible with the question open, and
they are not the same shape of openness.** Closing XK-3 Gate 3 would change what can
be said about exploitation and would change nothing about whether the substrate
exists.

**Not downgraded by an unmeasured population, and not inflated by one.** F-Stats-1
v1.56 §59.4 took this posture for FD-62 and it is carried here unchanged.

**XK-3 Gate 3 carve-out.** No live database contact was made for this entry. The
principal population, the row count of `shows`, and whether any environment's
`shows` table differs from all five schema sources are **unverified and must not be
assumed in either direction.** Any statement about them requires a gated window and
carries no support until one supplies it. Prod is FROZEN.

**Prod carve-out.** Four creation paths for `shows` were found in the repository —
the canonical migration, two ad-hoc SQL scripts, and a Node script — **and they
disagree on column types and on the `status` representation.** Which one built any
given environment is not recorded anywhere. No prod enumeration was performed and
none is implied.

**Fix: unevaluated.** Candidates not evaluated here include an ownership column on
`shows` with a backfill, a user↔show join table, a `User` model with associations,
and a resource-scoped middleware tier taking the resource id as an argument. Each
implies a different remedy for FD-62 and for the 30-site shape. Every candidate
touches schema and requires its own gated decision. **Ownership here means the item
has a home and a reader, not that a remedy is selected.**

## §5 What this register does not do

- Does not evaluate or select fixes. Every entry's remedy is unevaluated.
- Does not change any gate, unit disposition, or PR state.
- Does not supersede, move, or amend the artifacts it cites. Evidence artifacts
  stay where they are.
- Does not enumerate prod for any entry.
- Does not mint FD numbers. FD numbers are minted only by Fix Plan revisions.
- Does not confer authority on itself. See the front-matter authority note.

## §6 Maintenance

Additive-supersede applies. Entries are not edited in place after merge;
corrections prepend a banner and preserve the body. Status changes are ratified
by a Fix Plan revision that cites the entry, never by editing this file alone.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `f499a3ba`. Ratified by: F-Stats-1 Fix Plan v1.31.*
*Admitted: XK-1. Mints no FD. Evaluates no fix. No live database contact.*
*Admitted: XK-2 — 2026-08-14. Ratified by: F-Stats-1 Fix Plan v1.46. Main at `055da746`. Mints no FD. Evaluates no fix. No live database contact.*
*Admitted: XK-3 — 2026-08-16. Ratified by: F-Stats-1 Fix Plan v1.57. Main at `ff3637ec`. Mints no FD. Evaluates no fix. No live database contact.*
