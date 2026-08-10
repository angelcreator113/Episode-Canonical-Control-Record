# F-Stats-1 Fix Plan v1.32

| | |
|---|---|
| **Predecessor** | v1.31 (`4b743941`, #997). |
| **Basis** | `e4390220`. |
| **Author date** | 2026-08-10 |
| **Gate effect** | v1.30 §32.3's derivation is COMPLETED and CLOSED. *Open item 23 (F-Stats-1)* is ruled NEVER MINTED; no register item exists under that label and none is created. §32.3's bar on the F-Stats-1 forward path is LIFTED and replaced by an anchor to §28. `worldEvents.js` group dispositions are re-anchored to §28's re-derived totals. No fix evaluated, no unit disposition changed, no FD minted. Tail unchanged at FD-61. |

## What changed in v1.32

- **v1.30 §32.3's derivation is COMPLETE.** §32.3 recorded three of
  twenty-nine revisions checked and declined to disposition. The full corpus is
  now checked by three probes (§34.1). All return a negative.
- ***Open item 23 (F-Stats-1)* is ruled NEVER MINTED.** It is an inherited claim
  without support, of the class §32 records. It is not withdrawn, because it was
  never admitted; the ruling is that no register item exists under that label.
  See §34.2.
- **§32.3's forward-path bar is LIFTED.** §32.3 barred the F-Stats-1 forward path
  from relying on *open item 23 (F-Stats-1)*'s identity, and named the
  `worldEvents.js` characterisation explicitly. The bar was correct while the
  identity was unestablished. The identity is now established as absent, and the
  characterisation is re-anchored to §28. See §34.3.
- **The carrying set is corrected.** §32.3 names v1.26, v1.28, and v1.29.
  **v1.27 also carries the claim** and was omitted. The carrying set is
  **v1.26–v1.29 inclusive**. See §34.2.
- **§34 minted:** the never-minted ruling and the re-anchor.
- **Deliberately out of scope:** open item 36, carried unchanged. XK-1's remedy,
  unevaluated per v1.31 §33.3. `worldEvents.js` dispositions themselves — this
  revision re-anchors the characterisation and performs no disposition.

## §34 — a claim that was never minted

### §34.1 The derivation

Three probes, all run via `git show origin/main:` against `e4390220`. No
working-tree read; no live database contact.

| Probe | Pattern | Scope | Result |
|---|---|---|---|
| A | `open item 23`, `-SimpleMatch` | all 32 F-Stats-1 Fix Plan revisions, v1.0–v1.31 | 0 hits v1.0–v1.25. First occurrence v1.26 (3). Then v1.27 (1), v1.28 (1), v1.29 (1), v1.30 (6), v1.31 (3). |
| B | `item 23`, `-SimpleMatch` | F-Stats-1 Fix Plan revisions v1.0–v1.25 | 0 hits. |
| C | `item 23`, `-SimpleMatch` | every artifact in `docs/audit/` **except** F-Stats-1 Fix Plans | 0 hits. |

**Probe B is a deliberate superset of probe A**, not a second phrasing of it. A
mint may have used `item 23` without the `open` prefix; probe A would miss it.
`-SimpleMatch` on the two-token phrase excludes `§23.1`, `v1.23`, and the bare
numeral, all of which are dense in this corpus.

**Probe C exists because probe A and B are scoped to one document family.** The
convention that only Fix Plan revisions mint applies to FD numbers; it is not
established for per-keystone open-item numbers. Probe C closes the possibility
that the item was minted in a handoff, an inventory, or another register
artifact and imported. It was not.

**§32.3 checked three of twenty-nine revisions and ruled a section-collision
with §23.1 out.** That collision-exclusion is confirmed here by probe design:
`-SimpleMatch` on `item 23` cannot match `§23.1`.

### §34.2 The ruling

***Open item 23 (F-Stats-1)* was never minted.**

v1.26's language is assertion, not creation. Its "What changed" states *"Open
item 23 narrowed, not closed"*; its Forward Statement states *"Open item 23
stands."* Both presuppose a prior existence. Twenty-six preceding revisions
contain no such existence under either phrasing, and no other `docs/audit/`
artifact contains one.

**Nothing is withdrawn.** A withdrawal presupposes an admission. The correct
disposition is that the label names no register item and never did.

**The mechanism is §32's.** v1.30 §32 was minted against an inherited claim
carried on a predecessor's authority without a supporting citation. §16's
handler count ran eleven revisions; item 6's precondition ran five; this ran
four before §32.3 caught it.

**Carrying set, corrected: v1.26–v1.29 inclusive.** §32.3 names v1.26, v1.28,
and v1.29 and omits v1.27, which carries one occurrence. v1.30 and v1.31 also
reference the label, but as record and derivation — they are not carriers and
are not part of the set.

**Reading instruction for the carrying set.** References to *open item 23
(F-Stats-1)* in v1.26–v1.29 are not void. Each points at real, measured
substance — §28's undispositioned `worldEvents.js` groups. Those revisions are
not superseded and are not corrected on any other point. The correction is that
the substance was labelled with an item number that does not exist.

### §34.3 `worldEvents.js` — re-anchored to §28

§32.3 barred the forward path from relying on the label's identity, and named
the target: *"the characterisation of `worldEvents.js` group dispositions as the
largest remaining F-Stats-1 work."* v1.30 and v1.31 both left `worldEvents.js`
unopened on that basis.

**The bar is lifted, and the dependency is replaced, not removed.**

The characterisation never required the item number. It requires §28, which
v1.26 derived live at `3fdd49de` by bounded per-handler windows and which states
its totals *can be relied on*:

| Quantity | §28 |
|---|---|
| `router.*` handlers | 61 |
| SQL-carrying handlers | 50 |
| Statements | 112, confirmed by a third independent method |
| Groups | 9 |

Undispositioned at v1.26: seven groups — Invitations (23), Episode generation
(15), Financial (10), Outfit (7), Venue/social (5 less the 2 already
dispositioned), Distribution (3), Stories (2) — plus two Overlays handlers.

**§28's totals stand and are the anchor. §28's dispositions do not exist and are
not supplied here.** v1.26 is explicit that the totals can be relied on and the
dispositions cannot, because there are none. That distinction is preserved
verbatim by this revision.

**`worldEvents.js` group disposition is F-Stats-1's largest remaining work.**
This characterisation is now supported. It rests on §28 at basis `3fdd49de`,
which no revision has disturbed.

### §34.4 What this revision does not do

- Does not disposition any `worldEvents.js` handler or group. Not one.
- Does not open `worldEvents.js` for execution. It removes the register bar; the
  execution decision is a separate revision.
- Does not re-derive §28. Its totals are cited at v1.26's basis, not remeasured.
- Does not supersede v1.26–v1.29 on any point other than the item label.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not close open item 36.
- Does not disturb open item 6's v1.31 carve-out, or the two carved money-path
  assertions cited to XK-1.
- Does not mint an FD, PE, or XK number.
- Does not enumerate prod. Prod remains FROZEN.
- **No live database contact.** Source- and register-derived entirely, via
  `git show origin/main:` at `e4390220`.

## §11 Plan Version History (UPDATED)

Rows v1.0 through v1.31 carry forward from v1.31 unchanged. Appended:

| v1.32 | 2026-08-10 | `e4390220` | v1.30 §32.3's derivation COMPLETED across the full corpus by three probes. *Open item 23 (F-Stats-1)* ruled NEVER MINTED — an inherited claim without support; nothing withdrawn because nothing was admitted. Carrying set corrected to v1.26–v1.29 inclusive (v1.27 omitted by §32.3). §32.3's forward-path bar LIFTED; `worldEvents.js` characterisation re-anchored to §28's totals at `3fdd49de`. §34 minted. No FD. |

v1.32 supersedes v1.31 **on §32.3's derivation status and the register status of
the *open item 23 (F-Stats-1)* label only.** All other v1.31, v1.30, v1.29,
v1.28, v1.27, and v1.26 forward direction stands unchanged — including §33's
ownership assignment and item 6 carve-out, XK-1, §32's inheritance-failure
record, §28's re-derived totals, §16 as corrected by v1.26, §24 as restored by
v1.30, §30's divergence findings, and §31's boot-path DDL record.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.31. Tail: **FD-61**.
- Mints: **§34**.
- Closes: v1.30 **§32.3's derivation**. Lifts §32.3's forward-path bar.
- Rules: *open item 23 (F-Stats-1)* **never minted**. No item withdrawn; none
  existed.
- Corrects: §32.3's carrying set — **v1.27 added**; set is v1.26–v1.29 inclusive.
- Re-anchors: `worldEvents.js` remaining-work characterisation to **§28**.
- Carries: **open item 36**, unchanged.
- **Numeral disambiguation:** *open item 23 (F-Stats-1)* is unrelated to §23.1
  (F-Stats-1), a section of this plan, and to any FD-23. First reference in any
  document must carry the origin label in full. Per v1.31, *open item 40
  (F-Stats-1)* likewise remains unrelated to *FD-40 (F-Deploy-1)*.
- Changes no unit disposition, no PR state, no gate beyond §32.3's bar.
- Additive-supersede on v1.31; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).
- **No live database contact.**

## Forward Statement

v1.32 is the plan-of-record.

***Open item 23 (F-Stats-1)* does not exist and never did.** No downstream
artifact may cite it. References in v1.26–v1.29 are to be read as pointing at
§28's undispositioned groups.

**`worldEvents.js` group disposition is F-Stats-1's largest remaining work, and
the claim is now supported** — 112 statements across 50 SQL-carrying handlers of
61 total, in 9 groups, seven undispositioned plus two Overlays handlers, per §28
at `3fdd49de`. The register bar is lifted. The execution decision is not taken
here.

**Open item 36 remains carried.**

**Open item 6 is CLOSED with carve-out** per v1.31 §33.2; the two money-path
purchase assertions remain not covered, cited to XK-1.

**XK-1 is owned and unremedied.** 48 exposed tables; remedy unevaluated; touches
a FROZEN prod.

**One workstation hazard remains live** per v1.29: §31's boot-path inline DDL
makes `npm start` and `npm run dev` unsafe pending PE #62 resolution.

After F-Stats-1 closes: **F-Ward-1 next** — inheriting §26's two tables, eight of
§30's canon-only wardrobe tables, and XK-1's `episode_wardrobe` /
`episode_wardrobe_defaults` exposure. Per XK-1's recorded obligation, F-Ward-1's
first plan artifact must reference the inventory and XK-1. F-Ward-3 inherits
`outfit_sets` / `outfit_set_items` under the same obligation.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-10. Main at `e4390220`. Predecessor: v1.31.*
*Minted: §34. Closed: §32.3's derivation. Ruled: open item 23 (F-Stats-1) never minted. Corrected: §32.3's carrying set. Carried: open item 36. Mints no FD. Tail: FD-61. [skip-automerge]*