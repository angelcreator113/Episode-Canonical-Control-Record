# F-AUTH-1 v2.55 — Owed Index

## CORRECTION BANNER — added 2026-08-19, after `65c8f6d4`

**§1 item 3 is withdrawn. The `down` verification gate WAS exercised at ship
time, and the record is in the commit that carried the migration.**

**What §1 item 3 claims:** *"whether 2b was executed is not stated in any
landed commit message"*, developed into *"the precedent-setting migration's
gate has no evidence of having been exercised."*

**That is false.** `956697c0`'s commit message states:

> `down` removes the column. **Verified as a gate per v2.54 section 2 step 2b,
> not assumed from an exit code:** `information_schema` read after each phase
> gave PRESENT (timestamptz, nullable, default NONE) → ABSENT after
> `db:migrate:undo` → PRESENT with identical shape after re-apply. **No
> residue.**

**This satisfies v2.54 §2 step 2b on its own terms, method included.** Step 2b
required confirming absence *"by reading `information_schema`, not by trusting
the command's exit code."* The record names `information_schema` and
explicitly disclaims the exit code. **Item 3 is discharged. There is no open
question about the precedent, and no phase of the cycle is unrecorded.**

**§1 item 1 is sharpened, not withdrawn.** `16c47a5f`'s message carries a
section headed *"THE BEFORE/AFTER PAIR, as v2.54 section 2 sequences it"*: the
run-time `origin/main` SHA `8a537c9c401c63dc5698fc1df94ad79f2e8d5daf` — read
at run time as §2 step 1 required, not quoted from the revision — the verbatim
BEFORE output (2 of 2 failed at the absent column) and the AFTER pass (2 of 2,
test unchanged). **The records exist and are durable.** What remains owed is
narrower than §1 states: v2.54 §2 item 4 requires them *in the closure
revision*, so transcription into v2.55 is the outstanding act, not
re-derivation.

### How this document came to assert an absence it had not searched

**§4 lists `956697c0` as a pointer. Its message body was never read.** *"Not
stated in any landed commit message"* is an absence claim, and an absence
claim is only as good as the search behind it. **No search was run.** The
pointer list was compiled from `git log --oneline`, which shows subject lines
only, and `956697c0`'s subject line does not mention 2b.

**Recorded rather than fixed quietly, because the failure is this document's
own subject matter.** §3 exists to catch a citation that went stale by
mechanism, through no error by its author. **This is a citation that was never
checked at all. The two are different failures, and only one of them is
anybody's fault.**

**Unaffected:** §2, §3, §3.1, §5, §6, and the closing non-establishments. **The
Axis P finding at §3 stands** — it was derived by reading FD-66's banner
against v2.54's text, and both were read in full.

**Method note for whoever closes the remaining items: read the commit bodies,
not the subject lines.** `956697c0` and `16c47a5f` each carry multi-paragraph
records that `--oneline` hides entirely.

**Type: index. Not a revision, not a specification, and not an authorization.**
It records **what v2.55 was owed and by whom**, so the list survives outside a
session transcript. **Every entry below cites a landed source** — a v2.54
section, an FD-66 section or banner, or a commit SHA. Nothing here is sourced
to a conversation.

**This index makes no claim that the list is complete**, and it resolves
nothing. Where a figure is disputed it records the dispute and its sources
rather than picking a value. **Whether any owed item is still the right thing
to do is a judgment this index does not make.**

Compiled 2026-08-19. Basis: `origin/main` at `ccd8a7c9`, v2.54 at `8a537c9c`.

---

## §1. Owed to v2.55 by v2.54 (landed `8a537c9c`)

| # | Owed | Source | Status of the underlying work |
|---|---|---|---|
| 1 | **The before/after pair, both records** | v2.54 §4 bullet 3, specified at §2 | Work **done, record owed** — migration `956697c0`, test `16c47a5f`, both cited by FD-66 §5.1 |
| 2 | **Closure of the F-Auth-5 remediation** | v2.54 §5 bullet 2; §6 bullet 3 — *"v2.55 closes F-Auth-5"* | Not started in any landed commit |
| 3 | **The `down` verification record** | v2.54 §2 step 2b — a **gate**, not a record: *"if `down` fails … the migration does not ship"* | Migration landed at `956697c0`; whether 2b was executed is not stated in any landed commit message |

**Item 3 is listed separately from item 1 deliberately, and it is the sharpest
item in this section.** v2.54 §4 names two records; §2 step 2b describes a
third artifact with different force — **a gate, whose stated consequence is
that the migration does not ship.** The migration shipped at `956697c0`.

**The precedent-setting migration's gate has no evidence of having been
exercised.** v2.54 §1.2 calls reversibility *precedent-setting* — this is the
first schema change under the FD-66 §7.1 migrations-only ruling — and §2 step
2b warns that an unverified `down` would establish that `down` is a formality,
*"the precise opposite of §1.2's intent, and a precedent inherited by a
baseline where the `down` is the only recovery path."*

**Two readings fit the landed record and an index cannot separate them:** 2b
ran and was not recorded, or 2b did not run. **If it did not run, the
precedent that was set is not the one v2.54 intended.** This is stated as an
absence of evidence, which is what it is — not as a claim that the gate was
skipped.

**Re-derivable, and cheaply.** The `down` is still in the migration file;
running it against a scratch database answers whether it *works*. **It does
not answer whether it was checked at the time**, and only the second question
bears on the precedent.

**A green result does not close this item.** Green and red are not symmetric
evidence: green tests the artifact and leaves the process question exactly
where it was, while red would prove the gate had something to catch — worse,
and more informative. **Running the `down` cannot discharge item 3. Only a
record of 2b having been exercised can.**

## §2. Owed to v2.55 by FD-66 (`FD-66_..._DRAFT.md`, minted `eb3bd70d`)

| # | Owed | Source |
|---|---|---|
| 4 | **The Gate G3 clause 3 closure record** | FD-66 §5.1 STATE AT FILING — *"The closure record belongs to v2.55"* |
| 5 | **The infrastructure read** at FD-66 §6.4.1 | v2.54 §5 bullet 5 — *"remains owed and is not attempted here"* |

**Item 5 requires contacting a deployed host.** Prod is FROZEN per every
revision's closing line. **This index does not authorize it.**

## §3. Figures v2.54 cites that landed commits have since corrected

**Re-read from source; do not inherit.** This is the shape v2.52 §4.1 records
as its fifth instance and FD-66 §5.1 cites by name — accurate text, inherited
forward, no longer true.

**v2.54 §6 bullet 4 states: _"Axis P at FD-66 §6.3.1 has 19 members."_**
FD-66's own CORRECTION BANNER B1, added after `79f9bab1`, supersedes it — and
not by one number but by three, which is why quoting any single one is unsafe:

| Basis | Method | Axis P | Source |
|---|---|---:|---|
| `77fc5fb0` | **as filed, wrong method** | 19 | FD-66 B1 table, row 1 — the figure v2.54 §6 quotes |
| `77fc5fb0` | corrected | **13** | FD-66 B1 table, row 2 |
| `main` @ 2026-08-18 | corrected | **12** | FD-66 B1 table, row 3 |

Two things a reader of v2.54 §6 alone would not know, both stated by B1:

- **The method was wrong, not just the count.** `Model.options.paranoid` was
  the exposure test; the correct test is **whether a deletion attribute
  resolves**. Six members are *inoperatively paranoid* (`timestamps: false`),
  so Sequelize never names `deleted_at` and nothing fails.
- **Rows 1 and 2 are the same commit.** They differ by method, not by drift.
  Rows 2 and 3 differ by drift — **`decision_logs` left the set** when
  `956697c0` added its column, which is v2.54's own migration.

**FD-66 §6.3.1 body text still reads `Axis P (19)`.** The banner corrects it;
the body was not rewritten. **A reader who reaches §6.3.1 without the banner
gets the superseded figure**, which is why v2.54 §6's citation is to the number
that is wrong twice over.

**FD-66 B3 reconciles 13 against XK-1's 48 by membership, not arithmetic** —
11 inoperatively paranoid + 13 Axis P + 24 table-absent = 48, zero residue.

### §3.1 This is a property of additive-supersede, not a defect of FD-66

**The banner governs; the body does not know it.** Additive-supersede corrects
by prepending a banner and **never rewrites the body it corrects** — that is
the point of the convention, since a rewritten body destroys the record of
what was believed and when. The cost is structural: **every banner-carrying
document contains superseded text that still reads as authoritative**, and any
pointer aimed at a section rather than at the document lands on it.

**FD-66 is the instance, not the cause.** v2.54 §6 pointed at `§6.3.1` and was
correct when written; `§6.3.1` acquired a governing banner afterwards. **No
error was made at either end.** The citation went stale by mechanism.

**Rule, stated so it generalizes past this instance: a pointer into a
banner-carrying document must resolve to the banner first.** A citation of the
form *"document §N"* is incomplete where that document carries banners; the
resolvable form is *"document §N, as corrected by banner B"*, or a pointer to
the banner itself where one governs.

**Recorded as a register-level observation, not a ruling.** Whether the
convention should change — banners that enumerate the body sections they
govern, for instance — is a judgment this index does not make.

## §4. Landed since v2.54, bearing on the above

Commits between `8a537c9c` and `ccd8a7c9`, restricted to those a v2.55 author
must read. **This is a pointer list; it summarises no finding.**

- `956697c0` — the `deleted_at` migration v2.54 §1 authorized
- `16c47a5f` — the clause 3 test, *"with the before/after pair v2.54 section 2 requires"*
- `19b31b1d` — merge; the point FD-66 §5.1 names as *"clause 3 is met on `main`"*
- `eb3bd70d` — FD-66 minted P0
- `79f9bab1` — FD-66 correction banner: Axis P over-counted, and Axis P is XK-1's territory
- `f3b1f3d9`, `afe13438` — exposed set 48 → 37
- `2a744a92`, `1a00e947` — exposed set 37 → 13; XK-1 §2.1 limb 1 now fails
- `470ad7a1` — corrects both banner-2 drafts: **neither Variant of §12.11 has been retired**
- `803b0265` — FD-66 correction banner 2: B5's second question lost its premise
- `86c71df3` — migration-directory count withdrawn from the FD-65 control comment
- `ccd8a7c9` — PE #62 amendment (see §6)

**The exposed-set figure moved twice in this range (48 → 37 → 13).** Any
inherited count in that family needs its basis re-read.

## §5. Open questions parked, not owed

**These are not obligations on v2.55.** Listed so they are not mistaken for
either owed items or settled ones.

- **FD-66 B5 first question — scope or absorb.** Whether FD-66 should be
  re-scoped to exclude Axis P as XK-1's territory, or absorb it with
  attribution. **A register decision; XK-1 is owned by F-Stats-1.** Stands
  as written per banner 2 (`803b0265`).
- **FD-66 B5 second question — void.** Lost its premise to `76a7f1ac`; see
  banner 2.
- **FD-66 B4 — RAISED, NOT RESOLVED.** A challenge to XK-1's own count.

## §6. Adjacent, cross-track — not an F-AUTH-1 obligation

**PE #62 lives in `Session_PE_Roster.md`, which its own header defines as
session-scoped and explicitly distinct from the Track 8 roster kept in
F-AUTH-1 revisions.** Recorded here only so a v2.55 author who encounters
`model.sync` or inline DDL knows where it is already handled.

- `ccd8a7c9` — Variant A axis **closed**: 7 of 7 distinct models measured;
  3 of 7 cannot sync independently; all three in the one route that orders
  them correctly. Latent, not live. P2.
- `228ba43f` — Variant B and the request-path seeder recorded as an **open
  scoping decision, not a pending measurement.**

**Neither is owed to v2.55.**

---

## What this index does not establish

- **Not that the list is complete.** It is what four landed sources say is
  owed. An obligation recorded nowhere but a transcript is not here.
- **Not that any owed item is still correct to do.** §3 exists because at
  least one v2.54 citation is already superseded; others may be.
- **Not the value of any disputed figure.** §3 records three Axis P numbers
  and their bases; it picks none.
- **No measurement was performed. No FD minted, closed, or reprioritized.
  No gate changed. No schema or deployed host contacted. Prod FROZEN.**
