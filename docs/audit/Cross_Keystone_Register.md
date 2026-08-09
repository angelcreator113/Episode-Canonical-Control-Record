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
