# A1c design and dependency audit (read), revision 4

**Status:** design only. Nothing is implemented. Each release needs Evoni's approval before any code. The R1 implementation specification is a separate document: `docs/reads/2026-10-27-a1c-r1-spec.md`.

**History:**
- **Revision 1:** the code audit and the first design.
- **Revision 2:** Evoni's rulings on D1–D11 and her seven requirements.
- **Revision 3:** her rulings on N1–N6; the hints, stale-save and restore answers; the release boundary.
- **Revision 4 (2026-10-27):** her rulings on P1–P6 and her seven release conditions, set out in the "Revision 4" section below.
  - Revision 4 wins wherever it differs from the revision 3 body that follows it. The body is kept for its detail.

---

## Revision 4: rulings P1–P6 and the release conditions

### R4.1 Rulings

| # | Ruling | Effect on the plan |
|---|---|---|
| P1 | Three releases, approved on two conditions: R1 and R2 stay **identity-neutral**, and R3 turns identity writes on **consistently for all ten writers** | R1 and R2 never write, retire or change identity data (R4.2). R3 turns writes on with one switch that every writer goes through (R4.4) |
| P2 | Strict revision tokens for non-empty scripts, keeping local drafts, with an actionable conflict-or-reload path | As in §7. The old-tab sequence is spelled out in R4.6 |
| P3 | All three inject refusals | The error names the blocking beat (number and label), or the locked beat holding an old `[EVENT:]` or `[LOCATION_HINT:]` tag. The tag is never moved to another beat or to the top |
| P4 | The tightened repeated-line policy | As in §2.1, rule 3 |
| P5 | Recorded edit operations, with explicit rules. **A broad AI rewrite never inherits keys by position** | See R4.3 |
| P6 | The retention contract also covers references with no foreign key: JSON manifests, external asset records and future durable references. A foreign key alone is not assumed to protect everything | See R4.5. This replaces §9.2 |

### R4.2 Identity-neutral in R1 and R2 (condition 1)

**Neither release writes identity data.**
- No `UPDATE` in R1 or R2 includes `script_line_keys`, on `episodes` or on `episode_script_versions`.
- No key is minted, retired or changed.
- A version row written in R1 or R2 has `script_line_keys = NULL`.
- The R2 repair runs as a **dry run only**. Its apply step writes keys, so it arrives with R3.

**Any row that already has keys is refused, never changed.**
- Production should have none: nothing has ever written them. The pre-deploy check in the R1 spec confirms it.
- If an R1 or R2 writer finds an episode whose `script_line_keys` is not null, it answers `409 LINE_IDENTITY_ACTIVE`: "Line identities are active for this episode; this version of the app can't change its script safely." Nothing is written.
- This is also what keeps an R3 rollback safe (R4.7).

**The identity plan is computed only for logs** (condition 2). After a write commits, the service simulates the identity plan from the replaced text to the saved text under §2's strict rules, with no hints. It logs **counts only**, as one line:

`[line-identity-plan] {"v":1,"episode":"<id>","writer":"W1","source":"save","state":"unkeyed","lines_before":120,"lines_after":121,"kept_exact":110,"kept_group":4,"moved":1,"uncertain_similar":3,"uncertain_group":0,"new":3,"removed":2,"ms":4}`

What the log line never contains:
- script text, dialogue, line or beat labels;
- line hashes (a short line's 32-bit hash could be guessed);
- keys, character names or event names.

Its failure is logged as a message with no content, and never affects the save. Its purpose is to measure, before R3, how often edits would fall into "uncertain" without hints.

### R4.3 Identity rules for recorded operations (P5)

| Operation | Rule |
|---|---|
| Edit a line's words (line editor) | same key: the person chose this one line |
| AI rewrite of **one** line, "Use this" | same key: an explicit single-line replace the person accepted |
| AI regenerate of a **beat**, and any AI or template rewrite of more than one line | **no positional inheritance.** Replaced lines are new. Only lines that come back byte-identical keep their keys, by the exact rules (§2.1, rules 2–3) |
| Generate the whole script (AI or template) | the same: exact rules only |
| Duplicate a line | the original keeps its key; the copy is new |
| Split a line | the first part keeps the key; the other parts are new |
| Merge lines | the merged line keeps the **first** line's key; the others retire |
| Move a line, or move a beat | keys move with their lines |

### R4.4 R3 activation gate (condition 4)

R3 turns identity writes on with **one constant in the save service**. Every writer reaches the database only through that service, and a static guard proves it. Before the R3 deploy is approved, all of these must hold:

1. **All ten writers.** The static guard shows `script_content` and `script_line_keys` are written only by the service. The integration matrix (W1–W10 × unkeyed / valid / inconsistent, plus atomicity and §5.4 invariants) passes with writes **on**.
2. **Frontend hints.**
   - Save and Approve send `line_hints`, `script_revision` and `identity_review:'ask'`, and the review round trip passes.
   - The frontend `scriptLines` twin matches the server's (the A1a parity test).
   - **For an episode that already has keys, the R3 server refuses any text write without `line_hints`,** answering `409 SCRIPT_CLIENT_OUTDATED`, "reload". A browser tab opened before R3 can't create identity churn.
3. **Read and repair compatibility.**
   - `line_identity` is right for all three states.
   - Repair dry run and apply use the same rule function as the service, so the same input gives the same plan.
   - The R2 report, run just before the R3 deploy, shows **no** episode with non-null keys.
4. **Deployment state of every process.**
   - The Deploy run's `RESTART_HEAD` is the R3 commit, and the frontend artifact was built from it.
   - The worker is stopped (as today), or was restarted on R3. Workers write no scripts, which the guard confirms.
   - No other script or scheduled job writes `script_content`: the guard also covers `scripts/`.
5. **Rollback proven.** CI shows R2 code refusing writes to episodes that have keys (R4.7).
6. **First production check after the deploy, with Evoni's approval:**
   - one save keys an episode and `line_identity` reads `ok`;
   - a second save keeps unchanged lines' keys;
   - nothing changes in `script_voice_clips`.

### R4.5 Retention contract (P6; replaces §9.2)

1. **Today.**
   - No durable reference to a version row exists: §9.1 lists everything that reads versions, all of it transient.
   - No protection is claimed, and none is added.
2. **What counts as a durable reference** is any stored value that names a version row or depends on its text or keys staying available, **whatever form it takes**:
   - a foreign-key column;
   - an id inside JSON (a manifest);
   - an id in an external asset record, such as an object's metadata or a media service's record;
   - any future durable record.
3. **Protection lives in code, in one place.**
   - `scriptVersions.prune` asks a **registry of reference providers**. Each provider answers "which of these version ids does my data still reference?", reading its own column, JSON path or asset table.
   - `prune` keeps every id any provider names.
   - **A foreign key with `ON DELETE RESTRICT` is added where the reference is a column,** as a second line of defence, never as the only one.
4. **External records must be mirrored.** A reference that exists only in an external system (an object store, a third-party service) can't be protected. A feature that creates one must also write a database record its provider can read. Without that, the version it relies on is not protected, and the feature must not rely on it.
5. **The first feature that adds a durable reference,** in the same PR:
   - adds its provider to the registry (the registry is created by that first feature);
   - adds the foreign key where applicable;
   - adds a test that prune keeps a referenced version.
6. **Approved manifests freeze their own copy** of text, keys and locks (REV R2.2). If they also record a version id, that is a durable reference.
7. **Enforcement from R1, with no new structure.** A static test keeps an allowlist of the files that may read or name version rows today:
   - `scriptVersions.js`;
   - the version model;
   - the history routes;
   - the controller's restore check;
   - `characterVoice` (a read at lock time).

   Any new file that touches `episode_script_versions`, `EpisodeScriptVersion` or a stored version id fails CI until it is added to the allowlist **with its classification**: transient, or durable with a provider. The same test fails on any migration that references the table.

### R4.6 An older browser tab across a deploy (condition 7)

1. **Before R1 deploys,** a tab is open on the Script tab with unsaved text.
   - That text is already kept in this browser's storage: `useScriptDraft` writes it 800 ms after typing stops, and again when the page unloads.
   - Only a successful save clears it.
2. **R1 deploys.** The tab keeps running the old page code, which doesn't know about `script_revision`.
3. **The person presses Save.** The R1 server sees a non-empty stored script with no token and answers `409 SCRIPT_REVISION_REQUIRED`. Nothing is written.
   - The old code shows "Save failed".
   - The typed text stays on the page, and the stored draft is untouched because only a successful save clears it.
   - Approve/Lock behaves the same way.
4. **The person reloads** (or opens the episode again).
   - The new page loads the current script and its `script_revision`.
   - Because the stored draft differs from the saved script, the page shows "Put them back".
   - If someone saved the script in the meantime, the existing confirmation warns: "The saved script has changed since these changes were kept. Put them back over it? Save keeps them; History has the saved one."
5. **The person chooses.**
   - **"Put them back"** puts the draft on the page, and Save sends it with the **current** token. The person has seen the warning, so this is an explicit decision.
   - **Discard** keeps the newer script.
   - Either way, the script being replaced is kept in History, atomically (N2).
6. **Limits.**
   - If the browser blocks storage, the draft only survives while the old tab stays open. The person can copy the text before reloading. The new page's conflict messages say so ("Copy your text before reloading if this browser doesn't keep drafts").
   - A new tab opened after the deploy always has a token, so it never sees `SCRIPT_REVISION_REQUIRED`. It can see `SCRIPT_CHANGED` when another tab saved first.
   - In that case the page:
     - keeps the text;
     - shows "This script changed since you opened it";
     - offers "Load the newer script", which keeps the person's text as a draft, the same "Put them back" path;
     - offers "Compare".

### R4.7 Rollback, per release (condition 5)

All three releases add no migration, so rolling back means deploying the previous release's commit through the Deploy workflow. The migrate step finds nothing pending.

| Release rolled back | What happens | Data left behind |
|---|---|---|
| **R1 → before R1** | The previous behaviour returns, including the bugs R1 fixed: the inject editing locked beats, the swallowed failures, the missing guard, the non-atomic history. The old server ignores `script_revision`; tabs opened under R1 that keep sending it are fine | The version rows R1 wrote are ordinary rows, all with keys null. No identity data exists to clean up |
| **R2 → R1** | The read fields and the admin report go. The repair dry run goes; it never wrote anything | Nothing |
| **R3 → R2** | **Episodes R3 keyed become read-only for script changes.** R2's writers refuse them with `409 LINE_IDENTITY_ACTIVE`, keeping the page's draft. Episodes that are still unkeyed stay fully editable. **No key, version or voice clip is changed, so the identities stay valid** for when R3 is deployed again | The keys R3 wrote stay as they are and still describe their scripts, because nothing could change those scripts while R2 was running. Re-deploying R3 continues with no repair needed |

**After an R3 rollback, the recommended response is to fix forward.** Making keyed episodes editable again without R3 would mean deliberately dropping their identities. That is a separate admin decision (Q1 below), never an automatic one.

### R4.8 Voice clips (condition 6)

- In all three releases, nothing reads, writes, re-keys, deletes or soft-deletes `script_voice_clips`, and clip matching is unchanged.
- Each release's tests assert the table is untouched by every writer.
- A1d comes after R3, with its own approval.

### R4.9 Remaining question

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should R3 also ship an admin-only, per-episode "deactivate identity" tool (dry run, then apply, logged) for use after an R3 rollback? It would drop an episode's keys back to unkeyed | **Not now.** Fixing forward is safer, and the tool would itself be a write that discards identity data. Revisit only if an R3 rollback actually happens and keeps episodes read-only for too long |

---

*The revision 3 body follows. Where it differs from Revision 4 above, Revision 4 wins:*
- *§8: repair apply moves to R3;*
- *§9.2: replaced by R4.5;*
- *§12.3: R2 is dry-run only.*

**Measured at:** `main` `2899dbc9`, in production since Deploy #170.

**Sources:**
- the architecture review, `docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md` (REV);
- `docs/GAMEPLAY_DIRECTOR_SPEC.md` Rev 5 (GD);
- `docs/STAGE_PIP_VOICE_PLAN.md` (SPV);
- `src/utils/lineKeys.js` (LK);
- read-only code audits.

---

## 0. Rulings in force

| Ruling | Content |
|---|---|
| D1 | Keep the real script structure. Never invent beat headers or rewrite a script from the 14-beat display. Identity uses LK's beats, so a headerless script has `b:null` |
| D2 | Every writer obeys the same identity rules |
| D3 | An existing mismatch needs an explicit dry run, then an approved repair |
| D4 + N1 | Verified editor hints keep identity, even through wording changes. Exact, unambiguous matches keep it automatically. Repeated identical lines keep theirs only when the mapping cannot swap identities silently. Similarity alone never establishes identity |
| D5 | Restore reads its text from the saved version on the server, never from the browser |
| D6 | Optimistic concurrency: an actionable conflict, and never an overwrite of newer changes |
| D7 | `line_identity` exposes consistent active identities; retired history stays internal |
| D8 | Repair is admin-only, one episode at a time; the report is read-only |
| D9 + N6 | Event injection keeps its intended beat and narrative position, and never edits a locked beat. If its position is blocked, it refuses and names the beat. It never moves its tag to the top or into another beat |
| D10 | The writer integrity bugs are fixed in A1c-1 |
| D11 + N5 | Ordinary retention limits stay. A durably referenced version is never pruned. The contract is defined now, with no speculative database structure and no claim to protect references the system can't yet identify |
| N2 | Text, keys and the required version history save atomically; a failed history write fails the save |
| N3 | If the script changed during an AI generation, the draft comes back unsaved with a conflict explanation |
| N4 | A lock-only Approve on an unkeyed episode keys it in the same transaction, with no text change |

Evoni's requirements 1–7 (revision 2) still apply in full. §0 of revision 2 (the post-deploy checks) and §1 (the code audit) are unchanged and not repeated here, except for the facts each section below relies on.

---

## 1. Identity states (unchanged from revision 2)

| State | Stored record | Readers |
|---|---|---|
| **No identity yet** (`unkeyed`) | `null`: every episode today | `{ status:'unkeyed' }` |
| **Valid** (`ok`) | describes the stored text exactly | `{ status:'ok', lines:[{k,b,h}] }`, active lines only |
| **Inconsistent** (`mismatch`) | doesn't describe the stored text | `{ status:'mismatch', reason }`; reading never repairs it |
| **Historical version** | a version row's record, or `null` before A1c | Restore only, checked against the version's own text |

The state is computed only by `checkLineKeys(storedText, storedKeys)`, and no read path writes (requirement 5).

---

## 2. Confidence policy (N1 as ruled)

Each line of the text being saved gets one outcome. Rules are applied in this order.

### 2.1 Identity is kept

1. **Verified editor hint.** The line carries a key that is live in the stored record and used by no other line in the request. The request's `script_revision` must match the stored one (§7), which proves the hint was made against this record. A verified hint keeps identity **whatever the wording change**.
   - The server's own writers give deterministic hints for lines they carry over byte for byte: lock-keeping (§5, §6.4), inject (§4.3) and restore provenance (§5).
2. **Exact and unique.** Among the lines still unmatched, the normalised text appears exactly once in the stored record and exactly once in the new text. Its key is kept, whether the line stays in its beat or moves to another one. A unique text cannot be swapped, so this is never ambiguous.
3. **Exact repeated group, order-preserving.** A text appears more than once. Its occurrences keep their keys, paired in order, **only if both** hold:
   - (a) the group has the same number of occurrences before and after;
   - (b) the order of the group's occurrences relative to every other exactly-matched line in the script is unchanged: the old-to-new mapping of all exact matches is monotonic across the group.

   When (b) fails, some line moved past an occurrence. The occurrence that moved can't be told apart from the one that stayed, so pairing them would be guesswork.
   - Example: `[Yes.(K1), Hello, Yes.(K3)]` → `[Yes., Yes., Hello]` fails (b), so the whole group is uncertain.

### 2.2 Uncertain: identity is not kept automatically

4. **Similar but not identical** text without a hint, at any similarity. This is a *suggestion* for review only (N1: similarity never establishes identity).
5. **A repeated group failing 3(a) or 3(b).**
6. **A refused hint:** unknown, retired, used twice, or sent without a matching `script_revision`. The line is treated as having no hint, and the refusal is reported.

Uncertain lines get **new keys**, and the candidates' old keys retire, unless a person confirms the pairing (§6.3). The rule doesn't depend on which screen or writer saved the text.

### 2.3 New and removed

7. **New:** a line with no kept identity gets a newly minted key. It is checked against live keys, retired keys and every remaining version's keys, so it is never one used before.
8. **Removed:** a stored key with no pairing retires, with `retired_in` set to the version row this save creates. The retired list only grows.

### 2.4 A1a change (inside A1c)

LK's `matchLines` currently does three things A1c can't accept:
- it **takes** edited pairs (word similarity ≥ 0.5);
- it pairs repeated lines by longest common run whatever their counts;
- that run's tie-break order is arbitrary.

A1c adds a strict mode, used by the save service everywhere:
- edited pairs are returned as suggestions only;
- repeated groups follow rule 3.

A1a's existing default and its tests stay as they are.

---

## 3. Atomic saves (N2)

Every script write is one transaction:
1. lock the row and read text, locks, keys and revision;
2. check `script_revision` (§7);
3. check the state (§1);
4. keep locked beats, recording each line's provenance;
5. assign identities (§2, §5);
6. check the invariants (§5.4);
7. write the version row: the replaced text with its own keys;
8. write the text, keys and locks in one update.

**Any failure rolls back everything.** That includes the version-row write, which today logs its failure and lets the save go on. The response then says nothing was saved and why.

---

## 4. Behaviour by state and action

The actions:
- **Save:** W1 (Script tab, Raw editor, Import, skeleton).
- **Generate:** W3, W4, W6, W7, W8, W9, W10.
- **Restore:** W1 with a version id.
- **Event Inject:** W5.
- **Approve/Lock:** W2.

### 4.1 No identity yet

| Action | Behaviour |
|---|---|
| Save | First-save initialisation: every line of the saved text is minted. The state becomes Valid |
| Generate | Revision taken before the AI call; if the script changed during the call, `409 SCRIPT_CHANGED` with the draft unsaved (N3). Otherwise initialised as Save |
| Restore | §5 (no current keys, so there can be no collision with them) |
| Event Inject | §4.3, then initialised |
| Approve/Lock | With text: as Save. Lock only: the unchanged text is keyed in the same transaction (N4). The state becomes Valid |

### 4.2 Valid

| Action | Behaviour |
|---|---|
| Save | `script_revision` check (§7), then §2. Locked beats keep text and keys |
| Generate | N3 check after the AI call. Rules 2–3 only, because a generator has no editor hints. Locked beats keep text and keys |
| Restore | §5 |
| Event Inject | §4.3: untouched lines keep their keys through the inject's own hints |
| Approve/Lock | With text: as Save. Lock only: keys and text unchanged |

### 4.3 Event injection (N6 as ruled)

1. **The intended beat is chosen exactly as today**, by what the script contains, never by locks:
   - the first beat headed `STAKES`;
   - else the first headed `REVEAL`;
   - else the first headed `INTERRUPTION`;
   - else the top of the script, before its first beat header.
2. **The intended position is right after that beat's header,** as today.
3. **Every beat lock is whole-beat** (`script_locked_beats` holds beat numbers), so a locked beat has no unlocked position inside it.
   - If the intended beat is locked, the inject refuses: `409 INJECT_BLOCKED_BY_LOCK` with `{ beat_number, beat_label }`, for example "Beat 5 · STAKES is approved. Unlock it to place this event, or add the tag by hand."
   - It never falls back to REVEAL or INTERRUPTION when STAKES is locked, and never to the top. That would be "another beat" (N6).
4. **The top-of-script case:**
   - **Script with headers:** the top is the preamble before the first header. It belongs to no beat, so no beat lock can block it.
   - **Script with no headers** (D1: `b:null`): the top is the start of the only text. If any positional beat lock is in force on that episode, the inject refuses and names the lock: inserting at the start would change the first approved block.
5. **Old tags.** Today the inject removes every `[EVENT:]` and `[LOCATION_HINT:]` tag anywhere in the script. If one sits inside a locked beat, the inject refuses and names that beat. Removing it would edit approved content, and keeping it would leave two event tags.
6. **Identities.** The inject knows exactly which lines it removes (old tags) and adds (new tags):
   - every other line keeps its key through deterministic hints;
   - removed tags retire;
   - new tags are minted.

### 4.4 Inconsistent

Every action is refused before any change with `409 LINE_KEYS_NEED_REPAIR`, which gives the reason and a link to the repair dry run. Generate is refused before the AI call. The way out is an admin dry run, then an approved repair, then a retry.

---

## 5. Restore without collisions (question 3)

### 5.1 Inputs

Inside the restore transaction:
- **V**: the version row, read by id for this episode only (D5). That gives its text, and its record `VK`, which is `null` before A1c.
- **C**: the current record, with live keys `L` and retired keys `R`.
- **Final text:** V's text after lock-keeping. Each **current locked beat** stays as it is now, with its current lines. Every other line comes from V.

### 5.2 Assigning a key to every line of the final text

Each line's provenance comes from lock-keeping: *locked* or *from V*.
1. **Locked lines** keep their current keys (requirement 7). Call that set `Lk`.
2. **Lines from V, when `VK` describes V's own text** (`checkLineKeys` = ok). Each line takes its own historical key `k` from `VK`, unless:
   - **`k ∈ Lk`:** the key is held right now by a kept locked line, for example a line that moved into a beat that has since been approved. The locked line keeps `k`, and the V line gets a **new** key. The report names both. *A key is never on two lines.*
   - **`k` is not in `L ∪ R ∪ (any remaining version's keys of this episode)`:** it cannot belong to this episode's lineage. It is refused and the line gets a new key. This should never happen; it guards against a corrupted version row.
   - **Otherwise `k` is reinstated.** That is safe in each case:
     - `k ∈ L \ Lk`: the line currently holding `k` is not in the final text, because restore replaces every unlocked line. So `k` returns to its own historical line, and nothing else holds it.
     - `k ∈ R`: a retired key returns to the one line it described in V. It never goes to a different line, because it comes from V's own record for that exact line.
3. **Lines from V, when `VK` is `null` or doesn't describe V's text:** rules 2–3 (§2) against the **live** keys `L \ Lk` only. Retired keys are never matched by text. Everything else is minted, and the report says the version's identities could not be used.

### 5.3 Retired history after the restore

- **Newly retired:** every key in `L` that the final text doesn't use, with `retired_in` set to the new version row and its **current** `(b, h)` as the last known line.
- **New retired list:** `R ∪ VK.retired ∪ newly retired`, minus every key the final text uses. Where a key appears in more than one list, the newest `(b, h, retired_in)` wins, current first.
- **It only grows,** except for keys reinstated by this restore. Reinstating a retired key is the one way a key leaves `R` (REV R3.1).

### 5.4 Invariants checked before writing (on every save, not only restore)

If any of these fails, the transaction is rolled back and the response says nothing was saved:
- every key appears **at most once** among the final lines;
- no key is both live and retired;
- every final key is newly minted or comes from `L`, `R` or this episode's versions;
- `checkLineKeys(finalText, finalRecord)` = ok;
- the retired list contains every key of the previous live set that isn't in the final lines.

---

## 6. Editor hints (question 1)

### 6.1 What the Script tab has today

- `BeatSection` keeps a per-beat list of session ids (`useLineIds` → `nextLineIds`, ids `line-N`). It is updated from the last recorded operation (`lineOpRef` / `noteLineOp`: `move`, or `splice` with `at` and `removed`), or else by the longest common run.
- **These ids are for keeping focus on a line, not for identity:**
  - they start fresh every page load and aren't tied to the saved text;
  - they live per beat, so a line moving to another beat loses its id;
  - an **edit is recorded as a splice that removes one line and adds one,** so an edited line gets a **new** id;
  - beat moves, regenerate-beat accept and phone-path fixes record no operation;
  - the Raw editor, Import and Restore change the whole text with no structure.

### 6.2 What A1c-4 adds

- **A script-level identity list.** `identityRef` is an array aligned to `scriptLines(scriptText)` from the frontend twin of LK (parity already tested, A1a). Each entry is a server key, or `null` for a line the page added.
- **It is seeded from `line_identity`**, which arrives in the GET and in **every save response** for the text actually saved. It is reseeded after every successful save, and whenever the page takes newer text from the server.
- **Every edit operation updates it deterministically:**

| Operation | Effect on `identityRef` |
|---|---|
| Edit a line's words (line editor) | **same key**: a new `replace` operation, instead of today's remove-and-add |
| Rewrite a line (AI), "Use this" | same key (`replace`) |
| Delete a line | entry removed; the server retires the key |
| Add a line, moment or overlay | `null` inserted |
| Move a line, within or across beats | the key moves with the line (a `move` operation with beat and index on both ends) |
| Move a beat | every key of that beat moves with it (a new `beatMove` operation) |
| Duplicate a line (new operation) | the original keeps its key; the copy is `null` |
| Split a line (new line-editor action) | the first part keeps the key; the rest are `null` |
| Merge lines (new line-editor action) | the merged line keeps the first line's key; the others are removed (retired on the server) |
| Regenerate a beat, "Use it" | the replaced lines get `null`; the server's exact rules (2–3) keep any line that came back unchanged |
| Phone-path fix | the inserted lines are `null`; every existing line keeps its key |
| Raw editor typing, Import, "Use newer", "Put them back" | `identityRef` is recomputed **only** for lines whose text is unchanged and unique (rule 2). Every other line is `null`. These lines are then up to the server's rules and the review (§6.3) |

- **Save and Approve send** `{ script_content, script_revision, line_hints, identity_review:'ask' }`. Here `line_hints[i]` is `identityRef[i]` for the `i`-th `scriptLines` line of the text sent.
- **Locked beats are never edited on the page,** so their keys stay the same.

### 6.3 Review

- **When to ask:** if a save has uncertain lines (rules 4–6) and the client sent `identity_review:'ask'`, the server applies nothing.
- **The question:** it answers `409 LINE_IDENTITY_REVIEW` with `[{ line_index, text, candidates:[{ key, old_text, reason }] }]`. For each line the page asks: "the same line, edited" (pick one candidate) or "a new line". It offers "treat all as new" as a shortcut.
- **The re-send:** the confirmed choices become `line_hints`, which are verified hints (rule 1), and the page sends the save again.
- **Clients without review:** a client that sends no `identity_review` gets new keys for uncertain lines, reported in the response.

### 6.4 Hints through lock-keeping

The server re-applies locked beats after receiving the text, so the saved text can differ from the text sent. Each saved line's provenance comes from lock-keeping:
- **a line from the sent text** takes its hint, by its index in the sent text's `scriptLines`;
- **a line of a locked beat that was put back** takes its stored key;
- **an extra beat renumbered to 15+** keeps its hints, with a new `b`.

### 6.5 Before A1c-4

The Script tab sends **no** hints. Under rules 2–3 alone:
- **wording edits** get new keys;
- **a duplicated line** makes its group fail rule 3(a), so the original also gets a new key;
- **splits and merges** get new keys;
- **moves of unique lines** keep theirs.

§12 explains why the recommended release boundary means none of this ever happens to stored identities.

---

## 7. Stale-save protection for existing clients (question 2)

### 7.1 The token

`script_revision` is an opaque hash of the stored text **and** its identity record (or `unkeyed`). Using the identity record as well as the text catches the case where another tab saved the same text with different keys, for example after an edit and an undo.

Two exclusions:
- **`updated_at` is not used,** because a title or teaser edit would cause a false conflict.
- **The token is not a key,** and it never contains `ln_…`. A1b's "no response carries keys" test still holds.

**Where it comes from:**
- The episode GET returns it from A1c-1 onwards.
- Every script-writing response returns the new one.

### 7.2 The rule, in A1c-1

| Request | Rule |
|---|---|
| `PUT /episodes/:id` with `script_content`, or `PUT …/script-locks` (with or without text) | `script_revision` is **required** whenever the stored script is not empty. If it is missing: `409 SCRIPT_REVISION_REQUIRED`, "This page is out of date. Reload to see the current script; your unsaved text is kept." If it differs: `409 SCRIPT_CHANGED`, with the current revision so the page can offer compare and reload |
| The same, when the stored script is empty | allowed without a revision, because there is nothing to overwrite. This is QuickEpisodeCreator's skeleton for a new episode |
| Server writers (generate, inject, templates) | each takes the revision itself when it starts. Those with an AI call compare it again at write time (N3) |

### 7.3 Why requiring it is safe

- **Old tabs, not old apps.** The Deploy workflow ships the frontend and the backend in the same run, from the same commit. After a deploy, the only "existing clients" are browser tabs opened before it.
- **Today's code fails safe.** An old tab's Save gets the 409, and today's `handleSave` shows "Save failed".
- **The text survives.** The page's local draft (`useScriptDraft`, kept in the browser every 800 ms) holds the typed text. After a reload, the existing "Put them back" banner restores it. Nothing is overwritten, and nothing typed is lost.
- **Leniency would defeat the protection.** Accepting a missing revision would keep last-write-wins for exactly the tabs most likely to be stale. So the rule is strict.

### 7.4 Frontend part of A1c-1 (small)

- The Script tab stores `script_revision` from the GET and from each save response.
- It sends it on Save and Approve.
- It handles `SCRIPT_REVISION_REQUIRED`, `SCRIPT_CHANGED`, `LINE_KEYS_NEED_REPAIR` and `INJECT_BLOCKED_BY_LOCK` with clear messages, keeping the local draft.
- QuickEpisodeCreator's skeleton save needs no change, because it writes to an empty script.

This is the only frontend change in A1c-1; hints are A1c-4.

---

## 8. Repair and report (D3, D8; unchanged from revision 2)

- **Who:** admin-only, one episode per call.
- **Dry run:** the default. It returns `{ status_before, reason, plan:{kept, moved, uncertain, new, retired}, per_line, plan_hash }` and writes nothing. It applies §2 with no hints.
- **Apply:** `{ confirm:true, plan_hash, confirmed_pairs? }`.
  - Under `FOR UPDATE` it recomputes the plan; if it differs, it returns `409 PLAN_CHANGED`.
  - It writes **only** `script_line_keys` and a `line-key-repair` version row, atomically.
- **Report:** a read-only admin listing of each episode's state and dry-run summary.

---

## 9. Version-retention contract (N5 as ruled)

### 9.1 What references version rows today (verified at `2899dbc9`)

| Reference | Kind | Durable? |
|---|---|---|
| History list and view: `GET /episodes/:id/script-versions[/:versionId]`, `ScriptHistory` | read | no |
| `restored_from` on a save (W1) | request field, checked and then used only as the version source | no |
| `characterVoice.captureOnLock` baseline | a query at lock time for the first version after the newest `generate`; nothing stored | no |
| Foreign keys or columns naming `episode_script_versions` | none: only its own two migrations mention the table | — |
| Manifests, dialogue assets, other production records | do not exist yet | — |

**So no durable reference to a version row exists today.** A1c claims to protect nothing beyond that, and adds no table or column for it.

### 9.2 The contract

1. **Pruning.** Only `scriptVersions.prune` deletes version rows. It keeps the newest 50 save, lock and restore versions, and the newest 10 generated.
2. **What counts as durable.** A durable reference is any stored value in another table that names an `episode_script_versions.id`, or that needs a version's text or keys to stay reproducible.
3. **What a feature that adds one must do, in the same PR:**
   - (a) declare the reference with a database foreign key to `episode_script_versions.id`, `ON DELETE RESTRICT`. The database then refuses to delete a referenced row whatever the code does;
   - (b) make `prune` skip referenced rows. It queries the declared referencing tables, so a restricted delete never surfaces as an error;
   - (c) add a test showing a referenced version survives pruning.
4. **Approved manifests freeze their own copy** of the text, keys and locks (REV R2.2), so they never depend on a version row staying. If a manifest also records the version id, that is a durable reference under rule 2.
5. **Enforcement now, without new structure:** A1c-1 adds a static test that fails CI when any migration other than the table's own adds a reference to `episode_script_versions`, unless `prune` handles that table. A future feature can't add a reference silently.

**Identity safety does not rely on retention.** The live retired list only grows, and minting checks it, so pruning can never cause a key to be reused.

---

## 10. Voice clips and other position-based consumers (unchanged)

- A1c reads, changes, re-keys, deletes and soft-deletes no `script_voice_clips` row, and doesn't change clip matching. A test asserts that every A1c write leaves the table unchanged.
- The existing loss risk is A1d's: today, recording a line soft-deletes whichever clip held the same `(beat, line_index)` slot.
- todo/at, My Little List, post drafts and `captureOnLock` are unchanged.

---

## 11. Tests and acceptance

Revision 2's list stands, plus the tests below.

**Confidence (§2):**
- A verified hint keeps a key through any wording change.
- An unverified hint (stale revision, retired, duplicated) is refused and reported.
- Rule 3: the `[Yes., Hello, Yes.]` → `[Yes., Yes., Hello]` case is uncertain; a pure deletion of `Hello` keeps both Yes keys, in order.
- Similarity alone never keeps a key, at any score.

**Restore (§5):**
- A key held by a kept locked line is never put on a second line; the version line gets a new key and the report names both.
- A key live elsewhere and unlocked returns to its historical line.
- A retired key returns only to its own line.
- A foreign key in a corrupted version is refused.
- Retired-history merge: newest wins, reinstated keys leave `R`, and nothing else ever leaves it.
- Invariants (§5.4): a forced violation rolls back everything.

**Atomicity (§3):** a forced version-row failure leaves text, keys and locks unchanged, and the response says nothing was saved.

**Stale saves (§7):**
- missing revision on a non-empty script gets `409 SCRIPT_REVISION_REQUIRED`;
- a changed revision gets `409 SCRIPT_CHANGED` with the current one;
- an empty script saves without a revision;
- a title-only change doesn't change the revision;
- the same text with different keys does change it.

**Inject (§4.3):**
- intended beat locked → refused, naming it, with no fallback to another beat;
- an old tag in a locked beat → refused;
- top of a script with headers → allowed;
- headerless with a lock → refused;
- untouched lines keep their keys.

**Retention (§9):**
- the static test fails on a new reference to `episode_script_versions` that `prune` doesn't handle;
- `prune` still keeps 50 and 10.

**Hints (A1c-4):** every operation in §6.2's table produces the stated `identityRef`; lock-keeping provenance (§6.4); the review round trip (§6.3).

**Per-writer integration tests (W1–W10):** all three states each, with atomicity (requirement 4).

**Acceptance:**
- No identity is kept by similarity or by guesswork.
- No key ever appears on two lines.
- No newer script is ever overwritten.
- No read changes anything.
- Locked content is preserved.
- Voice clips are unchanged.

---

## 12. Release boundary (assessment and recommendation)

### 12.1 Does A1c-1 alone lose identities?

If A1c-1 wrote identities before the Script tab sends hints (A1c-4), every ordinary Script tab wording edit, duplicate, split or merge would retire the old key and mint a new one (§6.5). Those keys would be lost unnecessarily. Nothing breaks during that period, because:
- no consumer reads keys until A1d, A2 or manifests;
- `line_identity` isn't exposed until A1c-3.

But the lost lineage could never be recovered once a consumer anchors to keys. And the retired list would grow with churn that serves no purpose.

### 12.2 Options

| Option | Contents | Risk |
|---|---|---|
| A | A1c-1 through A1c-4 in one release | No churn, but the largest change at once: the save path, all ten writers, repair, reads and the Script tab. Long-lived branch, hard to review, one failure blocks everything, including the integrity fixes |
| B | A1c-1 writing identities, then A1c-4 later | Unnecessary identity churn in between (§12.1) |
| **C (recommended)** | **Three releases. Identities are written only from the release that also ships hints** | Each release small enough to review and deploy alone; no interim loss |

### 12.3 Recommended releases

| Release | Contents | Identity writes |
|---|---|---|
| **R1: integrity** (A1c-1) | all of A1c-1, plus §7.4's small frontend part | **Off.** The service computes the identity plan for every write and logs its counts per save. That gives real kept/new/uncertain numbers to check the policy against. It stores nothing: `script_line_keys` stays `null` on every episode. The off switch is a constant in the service, not an environment variable, so turning it on is a reviewed code change |
| **R2: repair and reads** (A1c-2 + A1c-3) | admin repair dry run and apply, the read-only report, `line_identity` on episode and version GETs | **Off.** With every episode unkeyed, repair has nothing to repair; its "key without text change" apply stays disabled until R3. Reads return `unkeyed` |
| **R3: identity on** (A1c-4) | Script tab identity list, hints, review and the new operations (§6), plus the one-line switch that turns identity writes on | **On**, for every writer at once. From the first save after R3, an episode is initialised (§4.1), and the page receives `line_identity` to hint every later edit |

Each release goes through its own PR review and its own Deploy workflow run. **A1d and every other key consumer may start only after R3 is live and its first-save initialisation is verified in production.**

**Why C is safest:**
- the integrity fixes (atomic history, stale protection, locks, D10) reach production without waiting for UI work;
- identity starts only when the page can keep it;
- R1's logged plans test the confidence policy on real saves before anything is stored;
- every release can be reverted alone. R1 and R2 store no identities, so reverting them leaves nothing to undo.

---

## 13. Decisions still needed

| # | Question | Recommendation |
|---|---|---|
| P1 | Release boundary: C (R1 integrity with identity writes off; R2 repair and reads; R3 hints with identity on), A, or B | **C** |
| P2 | §7.2: strict `script_revision` on a non-empty script, so an old tab gets "reload" and its text is kept locally | **Strict**, as written |
| P3 | §4.3 inject: refuse when the intended beat is locked (no fallback), refuse on an old tag in a locked beat, refuse at the top of a headerless script with a lock | **Yes, all three.** If you want locks finer than a whole beat, that's a separate design |
| P4 | §2.1 rule 3: a repeated group keeps its keys only with the same count **and** an order-preserving position; otherwise every occurrence is uncertain | **Yes** |
| P5 | §6.2 new line-editor actions in A1c-4: duplicate, split, merge, beat move as recorded operations | **Yes**, so these keep identity deterministically instead of needing review |
| P6 | §9.2 rule 5: the static test now; foreign key plus `prune` handling in the first feature that adds a version reference | **Yes** |
