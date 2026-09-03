# Prime Studios Audit Handoff v26

| | |
|---|---|
| **Predecessor** | Audit Handoff v25. v26 supersedes v25 Sec 1, Sec 2, Sec 3, and Sec 6. **v25's Sec 0, Sec 4, Sec 5, Sec 7, and Sec 8 stand and are not re-derived here** — per-claim authority: v25 remains authoritative for anything this document does not cover. |
| **Basis** | `origin/main` at `9250b60e59df31820536521ee1115b0b4c136af0`, derived live 2026-09-03. |
| **Author date** | 2026-09-03 |
| **Type** | Handoff. Rules nothing. Mints nothing. Changes no gate, finding, severity, owner, or disposition. |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios. |

---

## No `v26` pre-existed at this basis

```
$ ls docs/audit/ | grep -iE 'handoff' | sort -V
Prime_Studios_Audit_Handoff_v19.md
Prime_Studios_Audit_Handoff_v20.md
Prime_Studios_Audit_Handoff_v22.md
Prime_Studios_Audit_Handoff_v23.md
Prime_Studios_Audit_Handoff_v25.md
```

No `v26` on `main` before this document. `v25` is the newest by numeric sort.

---

# Sec 0. What changed since v25's basis

**v25's basis was `6aea0f73`, 2026-08-26. This document's basis is `9250b60e`,
2026-09-03 — eight days, and the runtime system is again unchanged by all of
it, same as v25 said of its own predecessor window.** What moved is the
register:

- **F-AUTH-1 limb 1's confirmation sweep completed.** All twelve CPs now
  carry a filed confirmation pass (`F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md`
  through `…CP12…`, CP10 committed 2026-09-01, the rest 2026-09-02),
  confirming **127** recorded dispositions — not the `129` v25 Sec 1 carried,
  which was never re-derived, only cited. Sec 2 and Sec 3 below record this
  as **PARTIAL**, not discharged: the confirmation sweep is complete, but
  ratifying the discharge is a handoff's to rule, and this one declines to,
  per Sec 8.
- **The two `disagree` and five `cannot-tell` verdicts inside that sweep are
  consolidated** at `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`,
  with the code re-verified against each cited basis. No disposition is
  recommended there either.
- **FD-67's branch was ruled** (`F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`,
  Option 1) **and implemented** (`7a1eb427c5`, PR #1185). Neither closes
  FD-67 — that needs a Fix Plan revision, per Sec 6.A item 11 below.
- **PE #65's execution sequence was assembled**
  (`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`), the one piece its own
  resolution document named as missing. It does not close PE #65 by its own
  statement (§7 there) — that is a ratifying revision's or Evoni's.
- **The dangerous SSH/pm2 deploy prompts were retired**
  (`.github/agents/deploy.agent.md`, `.github/prompts/deploy-dev.prompt.md`,
  PR #1201) — freeze notices in place of the SSH/`git pull`/`pm2 restart`
  procedures; §10 item 4's carry from `PROJECT_CONTEXT.md` is now discharged.
- **`PROJECT_CONTEXT.md`** was refreshed 2026-09-03 to carry the same limb 1
  re-derivation and to re-check every item in its own §6.5 and §10 against
  `origin/main` — Sec 6.B below draws on that work and independently
  re-verifies it rather than carrying it, per H1.
- **Amendment 30** to the Owed Index recorded one read-only, Evoni-authorized
  SSM `describe-parameters` enumeration, run by an agent session and ruled a
  **crossing as to actor** by Evoni — four parameters exist, none under
  `/episode-metadata/`. Carried from v25's Sec 6.4 pointer; not re-derived
  here, since it changes no gate this document reports on.
- **Amendment 10 §J3–§J5** name three specific corrections owed to v25 Sec 6:
  item 5's walk-back instruction (misleading, not merely inert), item 1's
  missing warning about history-scoped vs. commit-scoped reads, and Amendment
  6's still-absent pointer banner. **All three are absorbed into Sec 6.A
  below, in the form Amendment 10 proposed.**
- **Two draft-material documents void on this document's landing**, per
  their own absorption conditions: `v26_Draft_Material_Perennials_2026-08-27.md`
  (its substance is carried by Amendment 10 §J5, which is what is cited
  below, per §J5.1's own instruction — not the draft itself) and
  `v26_Draft_Material_Attention_2026-08-27.md` (which states of itself that
  *"nothing in the register may cite it as establishing anything"* — this
  document does not, and records only that it existed and is now void).

---

# Sec 1. Current authorities

**Re-derived at `9250b60e`, numeric sort, `.md` only** (Sec 1.1 below).

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -1
F-AUTH-1_Fix_Plan_v2.68.md
$ ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -1
F-Deploy-1_Fix_Plan_v1.49.md
$ ls docs/audit | grep -E '^F-Stats-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -1
F-Stats-1_Fix_Plan_v1.60.md
$ ls docs/audit | grep -E '^F-App-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -1
F-App-1_Fix_Plan_v1.1.md
```

**No new Fix Plan revision has landed in any family since v25.** Every
maximum below is identical to v25 Sec 1's.

**Blob SHAs, full forty characters, compared against v25's recorded values as
a baseline only — not as the source of the current maxima:**

| Layer | Authority on `main` | Blob at `9250b60e` | Blob at v25's `6aea0f73` | Changed? |
|---|---|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.68.md` | `db62a38f6b2f2f055f3043e0bfe53f5b3e28e84b` | `db62a38f6b2f2f055f3043e0bfe53f5b3e28e84b` | No |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.49.md` | `7ed517797947b75b6c6f67de840ad7afd7ff9ff2` | `7ed517797947b75b6c6f67de840ad7afd7ff9ff2` | No |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.60.md` | `6b1e93a07c412951e96ac3299dbc3336561312ff` | `6b1e93a07c412951e96ac3299dbc3336561312ff` | No |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | `33766072ebf60229fcd33dfd6a4c55ed1f4fd2f1` | `33766072ebf60229fcd33dfd6a4c55ed1f4fd2f1` | No |
| Cross-keystone | `Cross_Keystone_Register.md` | `d277588c81cf9bedea52aa015f79311e769a57f9` | `d277588c81cf9bedea52aa015f79311e769a57f9` | No |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | `3990b39bc94e7e6a5e95265ec1a2ae4c589e0cd7` | `3990b39bc94e7e6a5e95265ec1a2ae4c589e0cd7` | No |
| Production-environment items | `Session_PE_Roster.md` | `c99139e8bf47aa983993e52b21e0f78796970411` | `89ef077e7382164de9892dc91b9b752fd023515b` | **Yes** — PE #68 minted 2026-08-28, after v25's basis |
| Predecessor handoff | `Prime_Studios_Audit_Handoff_v25.md` | `d8beaca0ad6b655ea560cf75d1cb02df3f52adc6` | `226be252a62fe3001f4eb088b94e4e14271c2501` (pre-marker) | **Yes** — v25's own Amd7 correction marker, disclosed on its own face |

**Register tails, re-derived, not carried — instruments and raw output:**

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
(none — XK entries live inside Cross_Keystone_Register.md, not as standalone files)

$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
56:### XK-1 — `paranoid` exposure
207:### XK-2 — row-scope not enforced in SQL
288:### XK-3 — no authorization substrate for the tenancy root

$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -3
66
67
68
```

| tail | value | method |
|---|---|---|
| FD | **FD-69**, retired (spent on a duplicate). **FD-70 is next-available and unminted.** | Highest filed `FD-NN_*.md` |
| XK | **XK-3** | `Cross_Keystone_Register.md` face, highest `### XK-` heading |
| PE | **PE #68** | `Session_PE_Roster.md` face, highest `### PE #` heading |

**A caution recorded because it nearly misled this derivation.** `grep -r
'XK-4'`, `grep -r 'PE #69'`, and `grep -ro 'FD-70'` all return non-zero counts
across `docs/audit/` — 33, 33, and 56 respectively at a nearby basis — but
every occurrence found on inspection is a **mention of the next-available,
unminted number**, inside instruments like this one or inside "does not mint"
disclaimers (e.g. `F-AUTH-1_Limb1_CP2_Confirmation_2026-09-02.md:272`). **None
is a mint.** Sec 4.1's finding — *authority derived by sorting filenames is
unsound* — has a sibling here: **tail derivation by counting mentions is
unsound**, for the same reason. The tails above are derived from actually
filed headings and files, not mention counts.

## Sec 1.1 What this table's derivation covered

**`.md` only**, same exclusion as v25 Sec 1.1. Not re-checked whether any
`.docx` maximum now exceeds its `.md` counterpart — no `.docx` revision has
been filed in this window in any family (no new file of any extension
appears under `docs/audit/` for F-AUTH-1, F-Deploy-1, F-Stats-1, or F-App-1
beyond the four already-known `.md` maxima), so the `.md`-only exclusion
carries the same bound v25 Sec 1.1 recorded, unchanged.

---

# Sec 2. Keystone standing

| Keystone | Standing |
|---|---|
| F-AUTH-1 | Backend sweep REOPENED-QUALIFIED. **G3 PARTIALLY DISCHARGED, OPEN.** Limb 1 **PARTIAL** — confirmation sweep complete (12/12 CPs, 127 recorded dispositions: 120 agree, 2 disagree, 5 cannot-tell), ratification of discharge not performed here. Limb 3 assessment NOT COMPLETED. G4 **never entered** and not enterable; G5 blocked; G6 not reached. |
| F-Deploy-1 | **CLOSED** at v1.49, unchanged. Recognizing its manual SSM path does not reopen it. |
| F-App-1 | SHIPPED; non-gating, unchanged. |
| F-Stats-1 | Phase B live, unchanged since v25 — newest authority still `v1.60`, blob unchanged (Sec 1). Items 23 and 36 CLOSED. |
| F-Ward-1 | Queued. **Zero repository presence, re-checked at this basis** (`ls docs/audit/ | grep -iE '^F-Ward-1_'` → empty). |
| F-Reg-2 | Queued. **Zero repository presence, re-checked** (same instrument, `F-Reg-2`, empty). |
| F-Ward-3 | Queued. **Zero repository presence, re-checked** (same instrument, `F-Ward-3`, empty). |
| F-Franchise-1 | Queued. **Zero repository presence, re-checked** (same instrument, `F-Franchise-1`, empty). Director Brain remains this keystone's resolution. |
| F-Sec-3 | Queued last in the locked sequence. Unchanged — two documents on file (`F-Sec-3_Canonical_CharacterKey_Decision_2026-07-02.md`, `F-Sec-3_CharacterState_Surface_Inventory_2026-07-03.md`), neither newer than v25's basis. |
| F-Tools-1 | One-time audit, 2026-05-21, unchanged. |

**Locked sequence (Path A), unchanged:** F-AUTH-1 → F-Deploy-1 → F-App-1 →
F-Stats-1 Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= Director
Brain) → F-Sec-3.

---

# Sec 3. G3 re-derived at `9250b60e`

| part | state | source |
|---|---|---|
| Limb 1 | **PARTIAL.** 12/12 CPs confirmed; 127 recorded dispositions (120 agree, 2 disagree, 5 cannot-tell). `~700` estimate remains WITHDRAWN, per v25. Ratification of discharge NOT PERFORMED — see Sec 8. | CP1–CP12 confirmations; `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` |
| Limb 3 | **open; ASSESSMENT NOT COMPLETED**, unchanged | `v2.61`–`v2.68`, carried |
| G4 | **never entered; not enterable**, unchanged | carried |
| Dimension 1 | **PASS** — carried historical, unchanged | `v2.60`, per Amd10 §J3's table |
| Dimension 2 | **PASS** — current at `v2.60` basis, unchanged | `v2.61`, per Amd10 §J3 |
| Dimension 3 | **NOT PERFORMED** — current, unchanged | `v2.68` |
| Dimension 4 | **FAIL** — carried historical, unchanged | `v2.61`, per Amd10 §J3 |
| Dimension 5 | **NOT PERFORMED** — current, unchanged | `v2.61` |

**Dimension dispositions are unchanged from v25 Sec 3 and Amendment 10 §J3's
table, and are not re-walked here** — Amendment 10 §J3 rules out walking the
revision chain (the walk-back instruction is withdrawn; see Sec 6.A item 5)
and the dispositions above are copied from its table, which this document
did not re-derive independently, only re-cite. **Only limb 1 has moved since
v25.**

## Sec 3.1 FD-67 and FD-68, and PE #65 — re-checked

**FD-67: branch ruled and implemented, not closed.** `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`
rules Option 1; `7a1eb427c5` implements it (PR #1185). `v2.68`, still the
newest Fix Plan revision (Sec 1), does not record a close. FD-67 remains
**OPEN/P2** by its own ruling document's explicit statement (§4: *"Does not
close FD-67"*).

**FD-68's severity interaction with FD-65 remains unadjudicated.** No new
document addresses it since v25.

**PE #65: costed and sequenced, not closed.** `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`
supplies the one missing piece its own resolution document named — an
ordered sequence with gates — and states at its own §7 that whether this
discharges PE #65's closing criterion *"is for a ratifying revision or for
Evoni directly… not asserted by this filing."* Not asserted here either.

## Sec 3.2 The Actions path, re-derived live

```
$ [github API] list_workflows → 5 workflows:
  Deploy to Production      disabled_manually   .github/workflows/deploy-production.yml
  Auto-merge to Dev         disabled_manually   .github/workflows/auto-merge-to-dev.yml
  Deploy to Development     active              .github/workflows/deploy-dev.yml (workflow_dispatch only)
  Validate                  active              .github/workflows/validate.yml
  Copilot cloud agent       active              dynamic/copilot-swe-agent/copilot (no file in the tree)

$ [github API] list_workflow_runs, most recent 30 (2026-09-02T09:59 → 2026-09-03T13:03):
  all 30 are "Validate", conclusion success (one failure at 2026-09-02T12:10:14Z,
  on claude/fd67-option1-implementation, superseded by a success 10 minutes later
  on the same branch). No deploy run of any kind. Nothing queued or in_progress.
```

**Unchanged from v25 Sec 3.4.** The Actions path remains closed at this
basis — no production deploy workflow is dispatchable, and none has run.
**This does not establish that SSM, SSH, or console access to production is
closed.** Per v25 Sec 6 item 13, that residue is Evoni's word, not a
repository derivation, and is not re-asked here. **Prod is carried as
FROZEN on that basis.**

---

# Sec 4–5, 7–8 of v25 stand, unchanged

**Not re-derived by this document.** v25 Sec 4 (method findings to carry),
Sec 5 (live carries and docket, except Sec 5.2 item 1 and Sec 5.6's FD-63
line — both folded into Sec 6.B below rather than duplicated), Sec 7
(housekeeping and bounded non-actions), and Sec 8 (what v25 does not do) are
authoritative for what they cover and are not superseded here. A reader
needing them reads `Prime_Studios_Audit_Handoff_v25.md` directly.

---

# Sec 6. Rebuilt for the next author

**Two parts.** 6.A is the procedural checklist v25 Sec 6 handed forward,
carried with the three corrections Amendment 10 §J3–§J5 name and owed. 6.B
is the substantive owed/open ledger — rebuilt from the v25 Owed Index chain
through Amendment 30 and `PROJECT_CONTEXT.md` §6.5, with every item
re-verified against `docs/audit/` at this basis rather than carried.

## Sec 6.A Executable checklist, carried with Amendment 10's three corrections

Items 2, 3, 4, 6, 7, 9, 10-A, 13, 14 are unchanged from v25 Sec 6 and are not
restated in full — see `Prime_Studios_Audit_Handoff_v25.md` Sec 6 for their
text. What changed:

**Item 1 — position, with Amendment 10 §J5.3's addition:**

> **(h) History-scoped reads answer commit-scoped questions.** `git log … --
> <path>` walks history for the newest commit touching `<path>` reachable
> from the named commit; `git show --name-only --format= <commit> -- <path>`
> answers about that commit. With `--format=` suppressing the date, both
> emit a bare path list and are indistinguishable by shape — a false YES is
> plausible, non-empty, and about a different commit. Use `git show
> --name-only`, or restore the date field. `git show` is sound on non-merge
> commits; on a merge it needs `-m`. Full derivation at
> `v25_Owed_Index_Amd10_2026-08-27.md` §J5.2 — **cited per §J5.1's own
> instruction, not `v26_Draft_Material_Perennials_2026-08-27.md`, which is
> void on this document's landing.**

**Item 5 — re-derive G3, Amendment 10 §J3's replacement, superseding v25's
text in full:**

> **5. Re-derive G3.** Class: **perennial.**
>
> Limb 1 status, limb 3 outcome, G4 entry, and all five dimension
> dispositions.
>
> **Do not walk back through the revision chain.** No Status face carries
> five dimensions; `v2.61`'s four is the maximum and is unique, and every
> revision after it carries none. Take the dispositions and their suppliers
> from `v25_Owed_Index_Amd8_2026-08-27.md` §H4's table, which separates
> *supplied at* from *last restated*.
>
> `F-AUTH-1_Fix_Plan_v2.59.md`'s correction banner is mandatory reading for
> Dimensions 1 and 4. It withdraws D2 and preserves D1 and D4 by name at
> line 127.
>
> Record for each disposition whether it is a current score or a carried
> historical. D1 and D4 are carried historicals.
>
> Mention is not carriage. Face carriage is read at the `**Status**` block,
> bounded at the block, plural-safe.
>
> `v2.68`'s Status face says "Five dispositions, all definitional." Those
> are its limb-1 scope rulings, not the G3 dimensions.

**New item — Amendment 6's absent pointer banner, Amendment 10 §J4's text:**

> **Amd6's absent pointer banner.** Class: **one-time, OPEN.** Amendment 6 is
> the only non-tail link in the Owed Index chain without a forward pointer.
> Amendment 7 states it received one; it did not. Placing it requires first
> ruling which forward pointer is correct — see Amendment 7 §G6. **The
> ruling is not the handoff author's to make.**

**Item 8 — FD-66 infrastructure read.** Unchanged text. **Re-checked: still
NOT PERFORMED**, Evoni-gated. No evidence of authorization or performance
found in `docs/audit/` at this basis.

**Item 10-B — route shadowing disposition.** Unchanged text. **Re-checked:
still OPEN**, unchanged — no FD minted for the six dead declarations.

**Item 11 — FD-67/FD-68 remedy.** **Partially advanced, not closed** — see
Sec 3.1. Text otherwise unchanged: check HTTP classification and explicit
placeholder behaviour separately; FD-68/FD-65's interaction still needs
adjudication.

**Item 12 — PE #65.** **Advanced (costed and sequenced), not closed** — see
Sec 3.1. "A decision specification is not a decision" now reads: an
execution sequence is not a closure either.

## Sec 6.B Owed and open items, verified at this basis

**Evoni-gated (host, AWS, DB, Cognito, GitHub settings, or a ruling) —
re-verified against `docs/audit/` at `9250b60e`:**

| Item | Status | Source |
|---|---|---|
| v25 item 8 disposition: what canon-schema reconciliation requires. Read PERFORMED 2026-08-29. | **STILL OWED** (disposition; the read itself is done). | Amd18, Amd22–24, Amd29 |
| Addendum A/B follow-up canon reads: authorized 2026-09-01. | **STILL OWED**, unchanged — blocked on credential location. | Amd28 §AD2, Amd30 §AF2 |
| `JWT_SECRET` dev/prod environment read. | **STILL OWED.** | v25 Sec 6 item 9 |
| FD-68 vs FD-65 severity adjudication. | **STILL OWED.** | v25 Sec 6 item 11 |
| F-AUTH-1 limb 3 dimensions 3 and 5 (host/shared-Cognito reads). | **STILL OWED.** | F-AUTH-1 v2.68 |
| PE #64 severity re-rule. | **STILL OWED.** | PE roster |
| PE #65 Branch B closure ruling. | **STILL OWED** — costing and sequencing now both filed (Sec 3.1); closure is not. | PE roster, Amd16; `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` §7 |
| Re-recording §9.10's P1 in a Fix Plan revision. | **STILL OWED** — confirmed zero occurrences of `§9.10` in `v2.68` as of 2026-09-02, per the PE65 sequencing document's own check. | PE65 sequencing §3 step 1 |
| PE #68: whether the injected git credential acts as `angelcreator113`. | **CANNOT-TELL** — only a real push or reading the credential settles it; neither is repo-derivable. | Amd12, Amd14 |
| F-Deploy-1 post-close: AD, AE, AF, fork-RDS teardown, dev DNS repoint, prod SSM transport, credential rotations, prod reconciliation session. | **STILL OWED**, unchanged. | F-Deploy-1 v1.49 |
| Branch-protection bypass disposition. | **STILL OWED** — newest evidence note still 2026-07-07. | `Finding_Main_BranchProtection_Bypass` |
| Register rulings: v25 item 5 replacement text (now supplied, Sec 6.A — the *placement* decision, i.e. whether to ratify it into a future revision's face, is still Evoni's); Amd6's pointer banner (still absent, Sec 6.A); the status banner on Amd28 §AD3.3 (confirmed unplaced); XK-1 ratification; VENDOR DOCUMENTATION source class; attribution-gap remedies; production-provenance mechanism; `deploy-production.yml` header figures; authorship-record preservation choice. | **STILL OWED, all sub-items.** | Amd10, Amd13, Amd30, drafts of 2026-08-22/24 |

**Register work an agent session can do (repo-only, filed with
`/audit-file`, pushed and merged under Rule 7):**

| Item | Status | Source |
|---|---|---|
| F-AUTH-1 limb 1 per-CP confirmation passes. | **DONE.** 12/12 CPs, 127 dispositions (120/2/5). Ratification still owed — see Sec 3, Sec 8. | CP1–CP12 confirmations |
| Limb 1 disagrees/cannot-tells, consolidated. | **DONE.** | `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` |
| Retire dangerous SSH/pm2 deploy prompts. | **DONE.** | PR #1201 |
| F-Stats-1 owed: reads slice, PE #62 overlap close, §35.5 classes 2–6 homing, second-shape mint decision, StorytellerMemory references, transactionality, unread lines. | **STILL OWED**, unchanged — no new F-Stats-1 revision. | v1.60 §63.5 |
| XK-1 admission status; XK-2 extent census; XK-3 full call-site population (needs a live DB: Evoni). | **STILL OWED.** | CKR |
| Route-shadowing FD decision (item 10-B). | **STILL OWED.** | `Route_Shadowing_Survey_2026-08-22_DRAFT.md` |
| v27 handoff: supersede this document's Sec 1/2/3/6 in turn; carry forward anything still owed here. | **STILL OWED** — this document is v26, not v27; the next supersession is not this document's to perform. | — |
| Roster hygiene: closed index omits PE #63 and #66; PE #64 status superseded; `§AD/§AE/§AF` collision. | **STILL OWED** — roster last touched 2026-08-27, before this window. | PE roster, Amd29/30 |
| F-Sec-3 cold items. | **STILL OWED.** | F-Sec-3 inventory §5 |
| F-Tools-1 opens. | **STILL OWED.** | F-Tools-1 §4 |
| F-Deploy-1 amendment: SSM rewrite also closed cross-environment write. | **STILL OWED** — the DRAFT still states the gap. | `Production_State_Provenance_2026-08-22_DRAFT.md` §8 |

**Code PRs:**

| Item | Status | Source |
|---|---|---|
| FD-64 fix. | **DONE (code)**, `65cbe7013`/`2e5dbdf28`. Recording in a Fix Plan revision **STILL OWED**. | F-AUTH-1 v2.6x |
| FD-66 disposition + baseline migration sequence. | **STILL OWED.** | FD-66 DRAFT |
| 28 `claude/**` branch tips lacking `[skip-automerge]`. | **STILL OWED.** | Amd26 §AB3 |

---

# Sec 7. Register hygiene note, disclosed rather than corrected

**This document's own carriage is imperfect and the imperfection is
disclosed rather than smoothed.** Sec 3's dimension dispositions are re-cited
from Amendment 10 §J3's table (Sec 4–5, 7–8's carry-forward note above), not
independently re-derived by a fresh walk of `F-AUTH-1_Fix_Plan_v2.59.md`
and `v2.60`'s bodies — the same "mention is not carriage" caution Amendment
10 §J3 states applies to this document's own Sec 3 table as much as to any
successor's. **A reader relying on Dimension 1 or 4's disposition for a
ruling should read `v2.59`'s and `v2.60`'s bodies directly**, per Amendment
10 §J3's own instruction, and not stop at this document's table.

---

# Sec 8. What v26 does not do

- **Does not ratify limb 1's discharge.** All twelve CPs are confirmed; that
  is the confirmation sweep, not a ruling that the sweep discharges G3's
  limb 1. CP12's own text asserts *"Limb 1 discharges"* — that is the
  confirming document's own claim, made about its own population, not a
  handoff's ruling about the gate. **This document declines to make that
  ruling.** It is Evoni's, or a future revision's, explicitly.
- **Does not close FD-64, FD-67, or PE #65.** FD numbers are minted and
  closed only by a Fix Plan revision — `F-AUTH-1_Fix_Plan_v2.69` or later,
  which Evoni rules. A handoff carries state; it does not adjudicate. FD-64
  is fixed in code and unrecorded; FD-67 is ruled and implemented and
  unrecorded; PE #65 is costed and sequenced and unclosed. All three are
  named as owed in Sec 6.B, not closed here.
- **Does not mint FD-70, XK-4, or PE #69.** Sec 1's tails record all three
  as next-available and unminted, and this document does not change that.
- **Does not re-derive limb 3, advance Dimension 3 or 5, enter G4, or alter
  the freeze.**
- **Does not amend v25**, its correction marker, or any revision named
  above. Sec 4–5, 7–8 of v25 stand, unedited, per the carry-forward note
  above.
- **Does not treat `v26_Draft_Material_Attention_2026-08-27.md`'s content as
  established.** That document states of itself that it is not authority
  and cannot become authority; this document does not cite it as
  establishing anything, per its own prohibition. It is void on this
  document's landing, same as its sibling.
- **Does not perform Sec 6.A items 8 or 9** (FD-66 infrastructure read,
  `JWT_SECRET` read) — both remain Evoni-gated and NOT PERFORMED.
- **Does not contact any host, AWS, database, or Cognito.** Every claim
  above is either MEASURED (a repository or API read, command and output
  pasted) or explicitly carried from a cited predecessor document, never
  upgraded in standing.
- **Prod FROZEN**, per Sec 3.2 — derived from the Actions API, not asserted
  from memory, and bounded exactly as v25 Sec 3.4 bounded it: the Actions
  path is closed; SSM/SSH/console residue is Evoni's word, not a repository
  derivation.

---

*Type: handoff. Supersedes v25 Sec 1, 2, 3, 6. Rules nothing, mints nothing,
ratifies no discharge. Every claim MEASURED against `origin/main` at this
basis or explicitly carried and cited. No host, AWS, database, or Cognito
contact. Prod FROZEN.*
