# F-Stats-1 §35.5 Classes 2–6 — Homing, Located

| | |
|---|---|
| **Basis** | `origin/main` at `900d6e16f57b3c2bb29cf79c65fa01bb800ae083`, 2026-09-13 (date of that commit; this read performed 2026-09-14). |
| **Type** | Standalone note. Mints nothing. Rules nothing. Recommends no homing option. Does not close the item. |
| **Standing** | MEASURED for every read performed in this document. Anything drawn from a predecessor document is labelled **carried** and cited to its source, never upgraded past that source's own standing. |
| **Scope** | `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3 — "§35.5's classes 2–6 homing" — locate-and-record only. |

---

## §1. Locating §35.5 across the family

```
$ ls docs/audit | grep -E '^F-Stats-1_'
F-Stats-1_CharacterState_Canon_Verification_2026-06-08_DRAFT.md
F-Stats-1_Fix_Plan_v1.0.docx
F-Stats-1_Fix_Plan_v1.0.md
F-Stats-1_Fix_Plan_v1.1.docx
F-Stats-1_Fix_Plan_v1.1.md
F-Stats-1_Fix_Plan_v1.10.md
F-Stats-1_Fix_Plan_v1.11.md
F-Stats-1_Fix_Plan_v1.12.md
F-Stats-1_Fix_Plan_v1.13.md
F-Stats-1_Fix_Plan_v1.14.md
F-Stats-1_Fix_Plan_v1.15.md
F-Stats-1_Fix_Plan_v1.16.md
F-Stats-1_Fix_Plan_v1.17.md
F-Stats-1_Fix_Plan_v1.18.md
F-Stats-1_Fix_Plan_v1.19.md
F-Stats-1_Fix_Plan_v1.2.docx
F-Stats-1_Fix_Plan_v1.2.md
F-Stats-1_Fix_Plan_v1.20.md
F-Stats-1_Fix_Plan_v1.21.md
F-Stats-1_Fix_Plan_v1.22.md
F-Stats-1_Fix_Plan_v1.23.md
F-Stats-1_Fix_Plan_v1.24.md
F-Stats-1_Fix_Plan_v1.25.md
F-Stats-1_Fix_Plan_v1.26.md
F-Stats-1_Fix_Plan_v1.27.md
F-Stats-1_Fix_Plan_v1.28.md
F-Stats-1_Fix_Plan_v1.29.md
F-Stats-1_Fix_Plan_v1.3.md
F-Stats-1_Fix_Plan_v1.30.md
F-Stats-1_Fix_Plan_v1.31.md
F-Stats-1_Fix_Plan_v1.32.md
F-Stats-1_Fix_Plan_v1.33.md
F-Stats-1_Fix_Plan_v1.34.md
F-Stats-1_Fix_Plan_v1.35.md
F-Stats-1_Fix_Plan_v1.36.md
F-Stats-1_Fix_Plan_v1.37.md
F-Stats-1_Fix_Plan_v1.38.md
F-Stats-1_Fix_Plan_v1.39.md
F-Stats-1_Fix_Plan_v1.4.md
F-Stats-1_Fix_Plan_v1.40.md
F-Stats-1_Fix_Plan_v1.41.md
F-Stats-1_Fix_Plan_v1.42.md
F-Stats-1_Fix_Plan_v1.43.md
F-Stats-1_Fix_Plan_v1.44.md
F-Stats-1_Fix_Plan_v1.45.md
F-Stats-1_Fix_Plan_v1.46.md
F-Stats-1_Fix_Plan_v1.47.md
F-Stats-1_Fix_Plan_v1.48.md
F-Stats-1_Fix_Plan_v1.49.md
F-Stats-1_Fix_Plan_v1.5.md
F-Stats-1_Fix_Plan_v1.50.md
F-Stats-1_Fix_Plan_v1.51.md
F-Stats-1_Fix_Plan_v1.52.md
F-Stats-1_Fix_Plan_v1.53.md
F-Stats-1_Fix_Plan_v1.54.md
F-Stats-1_Fix_Plan_v1.55.md
F-Stats-1_Fix_Plan_v1.56.md
F-Stats-1_Fix_Plan_v1.57.md
F-Stats-1_Fix_Plan_v1.58.md
F-Stats-1_Fix_Plan_v1.59.md
F-Stats-1_Fix_Plan_v1.6.md
F-Stats-1_Fix_Plan_v1.60.md
F-Stats-1_Fix_Plan_v1.7.md
F-Stats-1_Fix_Plan_v1.8.md
F-Stats-1_Fix_Plan_v1.9.md
F-Stats-1_PE62_Overlap_Location_2026-09-11.md
F-Stats-1_PhaseA_G1_Audit.docx
F-Stats-1_PhaseA_G1_Audit.md
F-Stats-1_PhaseB_G1_Planning.md
F-Stats-1_PhaseB_Gate_Reconciliation_2026-06-28.md
F-Stats-1_PhaseB_OwedScoping_2026-09-10.md
F-Stats-1_S355_Classes2to6_Homing_2026-09-14.md
F-Stats-1_ShapeMint_Options_2026-09-10.md
F-Stats-1_StorytellerMemory_References_2026-09-10.md
F-Stats-1_Surface_Reverification_2026-07-21.md
F-Stats-1_WorldStudio_Transactionality_2026-09-10.md
```

**Note on the listing above:** `F-Stats-1_S355_Classes2to6_Homing_2026-09-14.md`
— this document itself — appears in its own `ls` output, because the
command was re-run after this file was committed to this branch (it does
not exist on `origin/main` at the Basis SHA). Self-reference noted, not
excluded from the raw paste, per H1.

```
$ grep -n '35\.5' docs/audit/F-Stats-1_*.md
docs/audit/F-Stats-1_Fix_Plan_v1.33.md:23:  whose reach is asserted but not established is inadmissible. See §35.5.
docs/audit/F-Stats-1_Fix_Plan_v1.33.md:177:### §35.5 Findings recorded, none minted
docs/audit/F-Stats-1_Fix_Plan_v1.33.md:219:- Does not mint any finding at §35.5, or assert reach beyond this file.
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:8:| **Gate effect** | v1.33 §35.3 is CORRECTED: the read census understated both counts, and the write surface was never measured. Corrected figures: 29 reads (16 scoped / 13 unscoped), 20 writes (7 scoped / 10 unscoped id-keyed / 2 show-only / 1 episode-keyed). §35.5 finding class 1's severity is RESTATED as write-side. v1.33's Appendix A is superseded as an exhibit. No group disposition changes. No fix evaluated, no gate lifted, no FD minted. Tail unchanged at FD-61. |
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:17:- **§35.5 finding class 1 is RESTATED.** Its severity is write-side, not
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:99:### §36.3 §35.5 finding class 1 — severity restated
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:101:v1.33 §35.5 records finding class 1 as *scope parameter as filter, not
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:157:| v1.34 | 2026-08-10 | `c4782084` | v1.33 §35.3 CORRECTED: read census 13/11 → 16/13; the probe keyed on `LIMIT\s*1`, a syntactic accident excluding un-LIMITed reads and all writes. Write surface measured for the first time — 20 sites, 10 unscoped id-keyed, 2 to `canon_consequences`. §35.5 class 1 severity restated as write-side; class remains unminted. v1.33 Appendix A superseded as an exhibit. No disposition changes. §36 minted. No FD. |
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:160:and on §35.5 class 1's severity statement only.** All other v1.33 forward
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:168:- Restates: v1.33 §35.5 finding class 1's severity.
docs/audit/F-Stats-1_Fix_Plan_v1.34.md:209:*Minted: §36. Corrected: v1.33 §35.3. Restated: v1.33 §35.5 class 1. Superseded as exhibit: v1.33 Appendix A. Carried: open item 36. Mints no FD. Tail: FD-61. [skip-automerge]*
docs/audit/F-Stats-1_Fix_Plan_v1.35.md:19:- **v1.34 is not otherwise disturbed.** §36's corrected census, §35.5 class 1's
docs/audit/F-Stats-1_Fix_Plan_v1.35.md:108:episode-keyed), and restated §35.5 finding class 1's severity as write-side. Episode
docs/audit/F-Stats-1_Fix_Plan_v1.35.md:126:on whether the access-control classes recorded at §35.5 belong to F-Stats-1, to
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:22:**Finding class 1 has a stronger sub-form than §35.5 recorded** — §44.7. In
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:25:alone. §35.5 characterises the class as *scope parameter used as filter, not
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:233:Every instance below is an instance of a class already recorded at §35.5. **No
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:246:**New shapes not cleanly inside §35.5's six**, recorded for the homing decision:
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:259:§35.5 characterises class 1 as *scope parameter used as filter, not authorization
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:274:§35.5's homing conclusion is unchanged: **not F-Stats-1, and not F-AUTH-1 as
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:280:decision is more urgent than §35.5's record implies.**
docs/audit/F-Stats-1_Fix_Plan_v1.41.md:356:- Records, unminted: new instances of §35.5 classes 1, 2, 3, 5, 6; three new
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:6:**§35.5 finding class 1's reach is ESTABLISHED beyond `worldEvents.js`.** Two
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:10:**§35.5's exclusion basis is false as stated for class 1.** It reads: *"Each has
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:18:**No finding is minted.** §35.5's homing conclusion is unchanged — class 1 is not
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:127:§35.5 ruled class 1 *"OWED. Not F-Stats-1. Not F-AUTH-1 as scoped — every handler
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:255:| v1.44 | 2026-08-13 | **§35.5 finding class 1's reach ESTABLISHED beyond `worldEvents.js`** — two instances in `arcRoutes.js` (:158 in `PUT /world/:showId/arc/phase/:phase`, :209 in `POST /world/:showId/arc/extend`), both the scope-cashed-at-the-write shape recorded at §44.3 for 1837/1910/1911: a scoped `show_arcs` read followed by an `UPDATE ... WHERE id = :id` carrying no scope term, in routes that declare `:showId` and use it for the read. All three tests satisfied — route carries `:showId`, `showId` available and dropped, table show-partitioned. **§35.5's exclusion basis is false as stated for class 1**, and **Cross-Keystone Register §2's exclusion no longer applies to it.** **No finding is minted**: §35.5's homing conclusion is unchanged, since both `arcRoutes.js` handlers declare `requireAuth` exactly as `worldEvents.js`'s do — the class is real, spans files, and has no keystone that owns it. Three options recorded at §47.5; **option 3 taken (record reach, defer minting)** because options 1 and 2 are fix-sequence decisions. **Not established:** extent (two files is establishment, not a census; the grep was a floor), and classes 2–6. **F-AUTH-1 instance reported, not minted:** `worldStudio.js:2483` declares `optionalAuth` on a write — sub-form (a), already owned. **Class 2 candidate** (`opportunityRoutes.js:258` hand-rolled soft delete, correctly scoped, route unread) and **class 5 instance** (`arcRoutes.js` `/arc/extend` whole-JSONB read-modify-write on canon columns) recorded, reach not claimed. **§47.2:** a manufactured class-1 finding was avoided — `worldStudio.js` has no `:showId` in any of 53 routes, so the class cannot apply there; the scoping model was checked before the scoping question was asked. **§47.6 method hazard:** the first probe was malformed (`-Context` emits lines, `-NotMatch` filters lines, SQL sits in multi-line literals) and nothing was concluded from it — §43.7's hazard reproduced two revisions after §43.7 recorded it. Mints no FD. No live DB contact. Prod FROZEN, untouched. §47 minted. Basis `112ea6d1`. |
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:262:- Establishes: **§35.5 finding class 1's reach beyond `worldEvents.js`**. Cross-
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:285:- Additive-supersede on v1.43; no destructive rewrite. §35.5's body is not
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:287:- **Numeral disambiguation:** *finding class 1 (F-Stats-1 §35.5)* is unrelated to
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:306:§35.5's conclusion holds: this is not F-Stats-1's finding, and it is not
docs/audit/F-Stats-1_Fix_Plan_v1.44.md:315:unprobed, and classes 2 through 6 remain where §35.5 left them. What this revision
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:17:**§35.5's exclusion of class 1 from F-AUTH-1 is UPHELD on a new and stronger
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:18:basis.** §35.5 justified it by symptom: *"every handler declares `requireAuth` and
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:146:categorical gap, and it is why §35.5's conclusion holds. §35.5 reached the right
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:206:| v1.45 | 2026-08-14 | **v1.44 §47.7's F-AUTH-1 instance report RETRACTED.** `worldStudio.js:2483` is the **ratified CP3 D1 Tier 3 site** — *"req.user consumed for ownership tagging"* per F-AUTH-1 v2.37's D1 disposition, independently confirmed at v2.38 §1.2, v2.39 §1.2 and v2.42 §1.3, with the required item-15 rationale comment at line 2482. v2.42 §1.3 records that same comment as a new false-positive class for §5.57's probe — **the shape that fooled F-AUTH-1's probe fooled v1.44's read.** v1.44's own evidence (sole `optionalAuth` write of 53 routes; sole options-form invocation) was correct and pointed at the ratification; it was recorded as suspicion and reported as a finding. **Method hazard: reading a route's auth posture means reading the rationale comment above the declaration, not the declaration alone** — F-AUTH-1 item 15 requires one on every Tier 3 and Tier 4 marking. **v1.44 §47.5's option 2 CORRECTED and WITHDRAWN**: it is not a re-scope but a category change, and F-AUTH-1's **backend sweep is CLOSED at CP12** with deployment tracks G3→G6 open and G5 gated on the prod freeze — widening it would reopen a closed sweep mid-deployment, not amend a queued one. **§35.5's exclusion of class 1 from F-AUTH-1 UPHELD on a categorical basis (§48.4):** F-AUTH-1's five-tier model (requireAuth / +authorize(['ADMIN']) / optionalAuth-with-ownership-tagging / public-read / env-gated) answers **which callers may reach an endpoint**; class 1 asks **which rows a handler may touch once inside**. `PUT /world/:showId/arc/phase/:phase` is correctly Tier 1 and still writes another show's arc. Authorization vocabulary: 39 occurrences in v2.37, 1 in v2.42, zero in v2.2 and v1.5 — coverage arrived with the tier model; 20 of 39 read. **Minting and scheduling are separable** — v1.44 treated them as one decision. **No finding minted.** Mints no FD. No live DB contact. Prod FROZEN, untouched. §48 minted. Basis `51add405`. |
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:217:- Upholds: **§35.5's exclusion of class 1 from F-AUTH-1**, on the categorical
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:218:  basis at §48.4 rather than §35.5's symptom-based one.
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:239:- **Numeral disambiguation:** *finding class 1 (F-Stats-1 §35.5)* is unrelated to
docs/audit/F-Stats-1_Fix_Plan_v1.45.md:261:asking. §35.5 excluded class 1 from F-AUTH-1 because its instances pass CP12.
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:10:**Origin:** §35.5 finding class 1 (v1.33). Reach established at v1.44 §47.3;
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:198:- Does not mint a finding class for §35.5's classes 2–6, or establish their reach.
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:212:| v1.46 | 2026-08-14 | **XK-2 MINTED and admitted to the Cross-Keystone Register** — *row-scope not enforced in SQL*: a scope parameter present in the route, used for a read, dropped at the write that follows it. **Origin** §35.5 finding class 1 (v1.33); reach established v1.44 §47.3; F-AUTH-1 exclusion upheld on categorical grounds v1.45 §48.4. **Reach:** F-Stats-1 (`worldEvents.js` 1837/1910/1911/1229 and the §44.7 population) and F-AUTH-1 (`arcRoutes.js` :158/:209, enumerated twice in v2.37's CP7 cluster). **OWNED by this revision; fix UNEVALUATED.** All three CKR §2 criteria satisfied and all three exclusions checked — reach is **established, not asserted**. **Not F-AUTH-1:** its five-tier model governs endpoint reachability; `PUT /world/:showId/arc/phase/:phase` is correctly Tier 1 and still writes another show's arc. **Not F-Stats-1:** an ORM call without a scope clause is exactly as unscoped as the SQL it replaces, and §44.3 ruled most instances WITHDRAW anyway. **Why it survives every existing check:** CP12 greps auth declarations and these declarations are correct — the defect is visible only to a probe that reads predicates. Severity bounded: exploitation needs a known row UUID and no examined handler provides an enumeration path. **§49.5 sets precedent** — XK-1 was admitted by the register's creating revision, so admitting a second entry was unwritten mechanics; CKR §6 governs existing entries, not new admissions; the footer gains an **appended** dated line with `Admitted: XK-1` left intact. **Not established:** extent (2 files; 20 of 22 `:showId` files unprobed; the probe was a floor), other keystones' surfaces, prod. Minting is not scheduling; the locked sequence is unchanged. Mints no FD. No live DB contact. Prod FROZEN, untouched. §49 minted. Basis `055da746`. |
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:225:  `opportunityRoutes.js:258`; the class 5 instance in `arcRoutes.js`; §35.5's
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:245:  (F-Stats-1 §35.5)* is unrelated to *F-AUTH-1's Tier 1*. **F-AUTH-1 section and
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:254:§35.5 recorded six finding classes at v1.33 and minted none, because their reach
docs/audit/F-Stats-1_Fix_Plan_v1.46.md:271:**Five of §35.5's six classes remain unminted and homing-owed**, their reach
docs/audit/F-Stats-1_Fix_Plan_v1.47.md:232:- Does not establish reach for §35.5's classes 2–6.
docs/audit/F-Stats-1_Fix_Plan_v1.47.md:257:- Carries: §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate at
docs/audit/F-Stats-1_Fix_Plan_v1.48.md:202:- Does not establish reach for §35.5's classes 2–6.
docs/audit/F-Stats-1_Fix_Plan_v1.48.md:227:  per v1.47; §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate
docs/audit/F-Stats-1_Fix_Plan_v1.49.md:266:  §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate at
docs/audit/F-Stats-1_Fix_Plan_v1.50.md:194:  unread destructive sites**; §35.5's classes 2–6, unminted and homing-owed; the
docs/audit/F-Stats-1_Fix_Plan_v1.51.md:163:  the **75 unread destructive sites**; §35.5's classes 2–6, unminted and
docs/audit/F-Stats-1_Fix_Plan_v1.52.md:216:  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
docs/audit/F-Stats-1_Fix_Plan_v1.53.md:192:  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
docs/audit/F-Stats-1_Fix_Plan_v1.54.md:216:  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
docs/audit/F-Stats-1_Fix_Plan_v1.55.md:298:  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
docs/audit/F-Stats-1_Fix_Plan_v1.56.md:229:  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
docs/audit/F-Stats-1_Fix_Plan_v1.57.md:263:  amendments; the reads surface and v1.51 §54.4's instrument question; §35.5's
docs/audit/F-Stats-1_Fix_Plan_v1.58.md:236:- Carries forward, unchanged from v1.57: the shape instances, unminted; **13 unread destructive sites**; XK-3's remedy and Gate 3's measurement; FD-62's remedy, unevaluated; XK-2's owed amendments; the reads surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the eleven-router collision surface and fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from v1.48; tenancy paths owed from v1.53 and v1.54; open items 22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1 and not claimed; `SEED_WARDROBE` as JS-constants-as-canon; §60.6's five observations and their homing; §60.7's unexplained pathspec defect; all other items carried from v1.57. Open items 41 and 23 remain **CLOSED** per v1.43.
docs/audit/F-Stats-1_Fix_Plan_v1.59.md:234:- Carries forward, unchanged from v1.58: the shape instances, unminted; **the reads slice, owed since v1.49 §52.6**; XK-3's remedy and Gate 3's measurement; FD-62's remedy, unevaluated; XK-2's owed amendments; v1.51 §54.4's instrument question; §35.5's classes 2-6, unminted and homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the eleven-router collision surface and fail-open mount pattern, **both extended by §62.4 and §62.9**; `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from v1.48; tenancy paths owed from v1.53 and v1.54; open items 22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1; `SEED_WARDROBE` as JS-constants-as-canon; §60.6's five observations and their homing; §60.7's unexplained pathspec defect; all other items carried from v1.58. Open items 41 and 23 remain **CLOSED** per v1.43.
docs/audit/F-Stats-1_Fix_Plan_v1.60.md:200:- Carries forward, unchanged from v1.59: the shape instances, unminted; XK-3's remedy and Gate 3's measurement; FD-62's remedy, unevaluated; XK-2's owed amendments; v1.51 §54.4's instrument question; §35.5's classes 2-6, unminted and homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the eleven-router collision surface and fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from v1.48; open items 22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1; `SEED_WARDROBE` as JS-constants-as-canon; §60.6's five observations and their homing; §60.7's unexplained pathspec defect; all other items carried from v1.59. Open items 41 and 23 remain **CLOSED** per v1.43.
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:131:### Item 3 — §35.5 classes 2–6 homing
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:133:> "§35.5's classes 2-6, unminted and homing-owed"
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:137:**Names:** `worldEvents.js`, per §35.5's own text at the revision that
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:145:v1.33 §35.5 ("Findings recorded, none minted") records six classes found
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:152:**To close:** run the cross-route-file probe §35.5 itself names as
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:305:- **Item 3** (§35.5 classes 2–6 homing) traces to the **Carries forward**
docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:321:- Does not run the §35.5 cross-route-file reach probe.
```
81 lines total when this command was run (2026-09-14, after this document's
own commit to this branch): 70 of them fall in 21 pre-existing family files
(v1.33 through v1.60 plus `OwedScoping`); the remaining 11 are this
document's own self-references, since this file now exists in the directory
the glob `F-Stats-1_*.md` scans and necessarily quotes "§35.5" itself.
Excluded from the pasted block above to avoid quoting this document inside
itself.

**The 81/70/11 split is not reproducible against a moving target** — this
document's own text will keep changing as amendments are drafted before
merge (as it already has, once, between the two commits on this branch),
so its self-match count will not stay 11 on a later re-run even though
nothing else about it changed. **The 70-line family count is reproducible
regardless**, because it names the pre-existing files explicitly rather
than relying on the glob to exclude this one — those files are filed and
immutable per the register's carriage rules, so this instrument's count
does not move even as this document's own does:

```
$ grep -n '35\.5' docs/audit/F-Stats-1_Fix_Plan_v1.*.md docs/audit/F-Stats-1_PhaseB_OwedScoping_2026-09-10.md | wc -l
70
```

This is the same 70-line set pasted above (verified identical by construction:
the explicit file list names exactly the 21 pre-existing `Fix_Plan` revisions
that matched plus `OwedScoping`, the same 22 files the glob-based command
matched minus this document). **Anyone re-running this exact command, at
any point after this document exists, gets 70** — it is the instrument this
document's classes-2–6 disposition in §3 actually rests on, not the 81/11
self-inclusive glob figures above, which are read-time artifacts of when
the command happened to be run relative to this file's own drafting.

The hits relevant to classes 2–6 specifically (as opposed to class 1, which
has its own homing history — see §2 below) are quoted where they matter in
§3.

**§2. Supplier, not restaters — the distinction applied**

Per the supplied-at / last-restated method (`v25_Owed_Index_Amd8_2026-08-27.md`
§H4: *"Sec 3's source column names where a disposition last appears, not
what supplied it... One column cannot hold both"*), this document separates
**where §35.5's six classes were first stated, in their own words** from
**where later revisions only mention them**.

**Supplied at `F-Stats-1_Fix_Plan_v1.33.md` §35.5, "Findings recorded, none
minted."** That section's own closing line (v1.33:219) is explicit: *"Does
not mint any finding at §35.5, or assert reach beyond this file."* §35.5
itself records findings and states it mints none of them — "supplying" is
the correct word for what v1.33 did to these six classes; "minting" is not,
and is not used for v1.33 anywhere in this document from here on. The six
classes' descriptive text — the words quoted per class in §3 below — appear
nowhere else in the family in that form. This is confirmed by
`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3 (carried, cited below),
which also names v1.33 as the revision that "minted" (its word — the six
classes' §35.5 disposition, quoted at v1.33:186–190, is `OWED`/`Observation`,
not `MINTED`; this document uses "supplying" instead, not that carried
document's word) §35.5, and pastes its own probe for it:
`grep -l '§35\.5' docs/audit/F-Stats-1_Fix_Plan_v1.*.md | head -1` →
`docs/audit/F-Stats-1_Fix_Plan_v1.33.md` (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:137–143`,
carried, not re-run here).

**Re-derived independently below, since that carried probe's unsorted
`head -1` does not itself establish earliest revision** (`ls`/`grep -l`'s default glob order on `v1.*` sorts
`v1.1` before `v1.10` before `v1.2`, a string order, not a numeric one — so
an unsorted `head -1` can return the alphabetically-first match rather than
the chronologically-earliest one). Numeric sort applied explicitly, shown
first over the full `.md` population (`.docx` copies excluded — they are
not greppable text, and the sort key `-t. -k2 -n` would otherwise read
their field 2 the same way) so the ordering itself is checkable by eye
before any filtering:

```
$ ls docs/audit/F-Stats-1_Fix_Plan_v1.*.md | grep -v '\.docx$' | sort -t. -k2 -n
docs/audit/F-Stats-1_Fix_Plan_v1.0.md
docs/audit/F-Stats-1_Fix_Plan_v1.1.md
docs/audit/F-Stats-1_Fix_Plan_v1.2.md
docs/audit/F-Stats-1_Fix_Plan_v1.3.md
docs/audit/F-Stats-1_Fix_Plan_v1.4.md
docs/audit/F-Stats-1_Fix_Plan_v1.5.md
docs/audit/F-Stats-1_Fix_Plan_v1.6.md
docs/audit/F-Stats-1_Fix_Plan_v1.7.md
docs/audit/F-Stats-1_Fix_Plan_v1.8.md
docs/audit/F-Stats-1_Fix_Plan_v1.9.md
docs/audit/F-Stats-1_Fix_Plan_v1.10.md
docs/audit/F-Stats-1_Fix_Plan_v1.11.md
docs/audit/F-Stats-1_Fix_Plan_v1.12.md
docs/audit/F-Stats-1_Fix_Plan_v1.13.md
docs/audit/F-Stats-1_Fix_Plan_v1.14.md
docs/audit/F-Stats-1_Fix_Plan_v1.15.md
docs/audit/F-Stats-1_Fix_Plan_v1.16.md
docs/audit/F-Stats-1_Fix_Plan_v1.17.md
docs/audit/F-Stats-1_Fix_Plan_v1.18.md
docs/audit/F-Stats-1_Fix_Plan_v1.19.md
docs/audit/F-Stats-1_Fix_Plan_v1.20.md
docs/audit/F-Stats-1_Fix_Plan_v1.21.md
docs/audit/F-Stats-1_Fix_Plan_v1.22.md
docs/audit/F-Stats-1_Fix_Plan_v1.23.md
docs/audit/F-Stats-1_Fix_Plan_v1.24.md
docs/audit/F-Stats-1_Fix_Plan_v1.25.md
docs/audit/F-Stats-1_Fix_Plan_v1.26.md
docs/audit/F-Stats-1_Fix_Plan_v1.27.md
docs/audit/F-Stats-1_Fix_Plan_v1.28.md
docs/audit/F-Stats-1_Fix_Plan_v1.29.md
docs/audit/F-Stats-1_Fix_Plan_v1.30.md
docs/audit/F-Stats-1_Fix_Plan_v1.31.md
docs/audit/F-Stats-1_Fix_Plan_v1.32.md
docs/audit/F-Stats-1_Fix_Plan_v1.33.md
docs/audit/F-Stats-1_Fix_Plan_v1.34.md
docs/audit/F-Stats-1_Fix_Plan_v1.35.md
docs/audit/F-Stats-1_Fix_Plan_v1.36.md
docs/audit/F-Stats-1_Fix_Plan_v1.37.md
docs/audit/F-Stats-1_Fix_Plan_v1.38.md
docs/audit/F-Stats-1_Fix_Plan_v1.39.md
docs/audit/F-Stats-1_Fix_Plan_v1.40.md
docs/audit/F-Stats-1_Fix_Plan_v1.41.md
docs/audit/F-Stats-1_Fix_Plan_v1.42.md
docs/audit/F-Stats-1_Fix_Plan_v1.43.md
docs/audit/F-Stats-1_Fix_Plan_v1.44.md
docs/audit/F-Stats-1_Fix_Plan_v1.45.md
docs/audit/F-Stats-1_Fix_Plan_v1.46.md
docs/audit/F-Stats-1_Fix_Plan_v1.47.md
docs/audit/F-Stats-1_Fix_Plan_v1.48.md
docs/audit/F-Stats-1_Fix_Plan_v1.49.md
docs/audit/F-Stats-1_Fix_Plan_v1.50.md
docs/audit/F-Stats-1_Fix_Plan_v1.51.md
docs/audit/F-Stats-1_Fix_Plan_v1.52.md
docs/audit/F-Stats-1_Fix_Plan_v1.53.md
docs/audit/F-Stats-1_Fix_Plan_v1.54.md
docs/audit/F-Stats-1_Fix_Plan_v1.55.md
docs/audit/F-Stats-1_Fix_Plan_v1.56.md
docs/audit/F-Stats-1_Fix_Plan_v1.57.md
docs/audit/F-Stats-1_Fix_Plan_v1.58.md
docs/audit/F-Stats-1_Fix_Plan_v1.59.md
docs/audit/F-Stats-1_Fix_Plan_v1.60.md
```

`v1.0` through `v1.60` in true numeric order — `v1.9` before `v1.10`,
`v1.19` before `v1.20`, `v1.59` before `v1.60` throughout, not the
lexicographic order (`v1.1, v1.10, v1.11, ... v1.19, v1.2, v1.20, ...`)
the unsorted glob would give. `sort -t. -k2 -n`'s key is field 2 of each
`.`-delimited name — `33` for `v1.33.md` — and works here only because
every file in this population shares the `v1.` prefix and a plain
numeric suffix; that precondition is checkable directly in the 61-line
list above.

Filtered to matches, same sort order preserved:

```
$ ls docs/audit/F-Stats-1_Fix_Plan_v1.*.md | grep -v '\.docx$' | sort -t. -k2 -n | xargs grep -l '§35\.5' 2>/dev/null
docs/audit/F-Stats-1_Fix_Plan_v1.33.md
docs/audit/F-Stats-1_Fix_Plan_v1.34.md
docs/audit/F-Stats-1_Fix_Plan_v1.35.md
docs/audit/F-Stats-1_Fix_Plan_v1.41.md
docs/audit/F-Stats-1_Fix_Plan_v1.44.md
docs/audit/F-Stats-1_Fix_Plan_v1.45.md
docs/audit/F-Stats-1_Fix_Plan_v1.46.md
docs/audit/F-Stats-1_Fix_Plan_v1.47.md
docs/audit/F-Stats-1_Fix_Plan_v1.48.md
docs/audit/F-Stats-1_Fix_Plan_v1.49.md
docs/audit/F-Stats-1_Fix_Plan_v1.50.md
docs/audit/F-Stats-1_Fix_Plan_v1.51.md
docs/audit/F-Stats-1_Fix_Plan_v1.52.md
docs/audit/F-Stats-1_Fix_Plan_v1.53.md
docs/audit/F-Stats-1_Fix_Plan_v1.54.md
docs/audit/F-Stats-1_Fix_Plan_v1.55.md
docs/audit/F-Stats-1_Fix_Plan_v1.56.md
docs/audit/F-Stats-1_Fix_Plan_v1.57.md
docs/audit/F-Stats-1_Fix_Plan_v1.58.md
docs/audit/F-Stats-1_Fix_Plan_v1.59.md
docs/audit/F-Stats-1_Fix_Plan_v1.60.md
```

`xargs grep -l` preserves the input order, so this is the 61-line list
above with the 40 non-matching files (`v1.0`–`v1.32`, `v1.36`–`v1.40`,
`v1.42`–`v1.43`) dropped and nothing reordered. `v1.33` is the first line
of both the full numeric list restricted to matches and this filtered
output — confirmed earliest by revision number and visible as such in
the unfiltered list above, not asserted from an unsorted `head -1`.

**Every later hit for classes 2–6 specifically is a mention, not a
restatement, with one partial exception.** `F-Stats-1_Fix_Plan_v1.41.md`
§44.6 (v1.41:238–244) restates classes 2, 3, 5, and 6 by name and records
**new instances of each — still inside `worldEvents.js`** — but its own
text at v1.41:233–236 disclaims reach: *"No class is minted, no reach
beyond `worldEvents.js` is asserted, and no ownership is claimed... two
groups in one file is not establishment."* This is carriage of new
*instances*, not a restatement that changes the class's own words or its
homing status. Every other hit from v1.42 onward (v1.46:198, v1.46:225,
v1.46:271, v1.47:232, v1.47:257, and the "Carries forward" bullet
repeated verbatim in v1.48 through v1.60) names "classes 2–6" as a group
inside a longer carried-items list — a mention, per the mention-is-not-
carriage rule, not a restatement of any individual class's content.

---

## §3. Classes 2–6, quoted and dispositioned

All five quotes below are from the supplying revision's table,
`F-Stats-1_Fix_Plan_v1.33.md` lines 183–190 (`### §35.5 Findings recorded,
none minted`):

```
183	| # | Class | Instances | Homing status |
184	|---|---|---|---|
185	| 1 | Scope parameter as filter, not authorization boundary | 11 unscoped of 24 census sites; in-handler splits at 2697, 2776, 2219; bypass on fallback at 2626 | **OWED.** Not F-Stats-1. Not F-AUTH-1 as scoped — every handler declares `requireAuth` and passes every CP12 grep. |
186	| 2 | Soft-delete filter maintained by hand in raw queries | 7+ instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs from XK-1: the column exists and the query omits it. |
187	| 3 | Swallowing catch producing a fabricated result | 4 at 2278; 1 at 2219; counter-example at 2352 | OWED. |
188	| 4 | Parallel balance readers, none authoritative | 3 mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item 6's carved assertions. |
189	| 5 | Denormalized JSON snapshot with no refresh path | `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description` copies already on the register. |
190	| 6 | Model-acquisition idiom drift | 3 idioms across 22 statements | Observation. Low severity. |
```

Class 1 is included above only for context (it is not this document's
subject — it was minted as **XK-2** at `F-Stats-1_Fix_Plan_v1.46.md` §49,
per that revision's Forward Statement: *"It has a number now. XK-2 — row-
scope not enforced in SQL"*). Classes 2–6 are this document's subject.

### Class 2 — "Soft-delete filter maintained by hand in raw queries"

> v1.33:186 — *"Soft-delete filter maintained by hand in raw queries | 7+
> instances, 3 tables, in-handler split at 2697 | OWED. Mechanism differs
> from XK-1: the column exists and the query omits it."*

New instances (still `worldEvents.js`-only) recorded at v1.41:241: *"5
further in-handler splits; 1109-vs-1307 divergence on one table."* No
revision establishes reach beyond `worldEvents.js`, mints a finding
number, or homes it to a keystone. **UNHOMED.**

### Class 3 — "Swallowing catch producing a fabricated result"

> v1.33:187 — *"Swallowing catch producing a fabricated result | 4 at
> 2278; 1 at 2219; counter-example at 2352 | OWED."*

New instances (still `worldEvents.js`-only) at v1.41:242: *"1149 (canon
write lost), 1214/1221 (approval no-op), 2178/2191 (incomplete canon row
echoed as complete), 1718, 1972."* No reach probe, mint, or homing
disposition in any later revision. **UNHOMED.**

### Class 4 — "Parallel balance readers, none authoritative"

> v1.33:188 — *"Parallel balance readers, none authoritative | 3
> mechanisms: 2219, 2278, 3730 | OWED. Money path; adjacent to open item
> 6's carved assertions."*

No later revision records a new instance of class 4 specifically — it is
absent from v1.41 §44.6's per-class instance table (which lists 1, 2, 3,
5, 6 but not 4) and absent from every subsequent revision's body text; it
survives only inside the "classes 2–6" group mention repeated in the
Register-hygiene "Carries forward" bullets from v1.46 onward. **UNHOMED**;
whether its instance count or reach has been re-examined since v1.33 is
**cannot-tell** from the family's text — the only evidence either way is
its absence from v1.41's per-class list, which is silence, not a
negative finding.

### Class 5 — "Denormalized JSON snapshot with no refresh path"

> v1.33:189 — *"Denormalized JSON snapshot with no refresh path |
> `outfit_pieces` at 2697 | OWED. Same shape as the `canonical_description`
> copies already on the register."*

A new instance (still `worldEvents.js`-only) at v1.41:243: *"1580
whole-JSONB read-modify-write, last-write-wins."* No reach probe, mint, or
homing disposition follows. **UNHOMED.**

### Class 6 — "Model-acquisition idiom drift"

> v1.33:190 — *"Model-acquisition idiom drift | 3 idioms across 22
> statements | Observation. Low severity."*

Note this class alone is recorded as an **Observation**, not `OWED`, at
its own supplying line — a disposition this document carries and does not
upgrade. A new instance (still `worldEvents.js`-only) at v1.41:244:
*"`getModels()` vs `req.app.get('models')` vs `require('../models')`
across both groups."* No later revision homes it or changes its
Observation standing. **UNHOMED** in the same sense as classes 2, 3, and
5 — no keystone or register entry claims it — while its own text
continues to mark it lower severity than the other four.

---

## §4. The citation path is the "Carries forward" bullet, not §63.5

`F-Stats-1_Fix_Plan_v1.60.md`'s Register-hygiene section carries this
item's text in its **`Carries forward:`** bullet (v1.60:200): *"...v1.51
§54.4's instrument question; §35.5's classes 2-6, unminted and homing-owed;
the class 2 candidate at `opportunityRoutes.js:258`..."* — **carried**,
cited to that file directly; this document does not independently re-walk
v1.60's own text beyond quoting the bullet already quoted by its source.

Per `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3 (carried; that
document is the instrument that scoped this item and is cited, not
re-derived, here): *"'§35.5's classes 2-6, unminted and homing-owed' —
Register hygiene, `Carries forward:` bullet (**not** the `Owes:` bullet —
see divergence note)"* (`F-Stats-1_PhaseB_OwedScoping_2026-09-10.md:133–135`).
**This is the item's citation path** — the `Carries forward:` bullet, not
a §63.5 heading. This document does not assert that a `§63.5` exists or
does not exist in `v1.60`; it was not searched for, since the citation
path was already established by the carried source above and re-deriving
it was not this document's task.

---

## §5. Closing — what this document does and does not do

**Does:**
- Locate §35.5 in the F-Stats-1 family (§1).
- Identify the supplying revision (`v1.33` §35.5) and distinguish it from
  every later mention or partial restatement of new instances (§2).
- Quote each of classes 2–6 in the supplying revision's own words,
  line-numbered, and record a disposition — UNHOMED for classes 2, 3, and
  5; UNHOMED with a cannot-tell note on re-examination for class 4;
  UNHOMED (Observation-standing preserved) for class 6 (§3).
- Record the v1.60 citation path as the `Carries forward:` bullet, per
  the carried `OwedScoping` item 3 note (§4).

**Does not:**
- Mint any finding, FD, XK, or PE number.
- Rule anything, or resolve any of the five UNHOMED dispositions above.
- Recommend a homing option (F-Stats-1, F-AUTH-1, a new Cross-Keystone
  Register entry, or any other keystone) for any of classes 2–6.
- Close `F-Stats-1_PhaseB_OwedScoping_2026-09-10.md` Item 3, or any part
  of it. **Only an F-Stats-1 Fix Plan revision closes it** — newest
  authority remains `v1.60`, unchanged by this document.
- Establish reach for any class beyond what the family's own text already
  records (`worldEvents.js`-only, per v1.33 and v1.41).
- Edit `v1.60` or any other filed document in `docs/audit/`, or add a
  banner to one.
- Touch `src/`, `frontend/`, `tests/`, or any workflow file.
- Make any host, AWS, database, or Cognito contact. **No live database
  contact. Prod FROZEN, untouched, not addressed by this document.**

---

*Type: standalone locate-and-record note. Rules: nothing. Mints: nothing.
Host/AWS/DB/Cognito contact: none. Prod FROZEN. [skip-automerge]*
