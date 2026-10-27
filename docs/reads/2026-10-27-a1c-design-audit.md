# A1c design and dependency audit (read), revision 2

**Status:** design only. Nothing is implemented. A1c needs Evoni's approval of this revised plan, and of each PR in §9, before any code.

**Revision 2 (2026-10-27)** records Evoni's rulings on D1–D11 and her seven additional requirements:
- **Approved as recommended:** D1 (structure kept), D2, D3, D5, D6, D7, D8, D9, D10.
- **Modified:**
  - **D4:** deterministic hints and exact matches only. Uncertain matches are never kept on the strength of which screen saved them. The confidence and review policy is §3.
  - **D11:** ordinary retention stays, but anything a durable production reference names is kept (§6).
- **Superseded:** revision 1's §2–§9. §0 (the post-deploy checks) and §1 (the code audit) still stand, unchanged in substance.

**Measured at:** `main` `2899dbc9`, in production since Deploy #170.

**Sources:**
- the architecture review, `docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md` (REV);
- `docs/GAMEPLAY_DIRECTOR_SPEC.md` Rev 5 (GD);
- `docs/STAGE_PIP_VOICE_PLAN.md` (SPV);
- `src/utils/lineKeys.js` (LK);
- three read-only code audits.

---

## 0. Post-deploy verification (Deploy #170)

This session has no database or box access. "Evidence" is from the deploy's own on-box output and the code it ran.

| # | Check | Evidence | Still to do (Evoni, read-only) |
|---|---|---|---|
| 1 | Both `script_line_keys` columns are nullable JSONB | Migration `20261026190000` adds both as `{ type: JSONB, allowNull: true }` (L74, L77), and its guard refuses any other existing definition. The log shows `migrated (0.041s)` and `db:migrate exit 0` | `SELECT table_name, data_type, is_nullable FROM information_schema.columns WHERE column_name='script_line_keys';` should return 2 rows, `jsonb` / `YES` |
| 2 | The A1b migration is in `SequelizeMeta` | The ledger read `1 pending of 390` before the migration and `OK: 0 pending of 390` after it. Deploy and Restart each re-read it: 0 pending | `SELECT name FROM "SequelizeMeta" WHERE name LIKE '20261026190000%';` should return 1 row |
| 3 | The staging directory and success record were removed | `phase_restart` removes the record, then the stage, then prints `RESTART_OK=1`. The log has `RESTART_OK=1` and no "is in use" or "next migrate phase removes it" line | On the box: `ls -la ~/.episode-stage ~/.episode-deploy-migrated` should show the directory empty or absent, and no record file |
| 4 | Episode creation and script-version saving | **Not tested after the deploy.** No session test touched production. The deploy checks only `/health` | Needs Evoni's approval: one test episode and one Script tab save, then check that a version row appears |

## 1. Every path that writes an episode script

### 1.1 Server writers

These ten are the only places `episodes.script_content` is written:

| # | Writer (stable name) | Route / caller | Text source | Transaction / row lock | Lock-keeping, overwrite guard | Version source |
|---|---|---|---|---|---|---|
| W1 | `episodeController.updateEpisode` (L492–607) | `PUT /episodes/:id` (Script tab Save, Raw editor, Import, Restore, QuickEpisodeCreator skeleton) | client, whole text | yes, `FOR UPDATE` | `scriptKeepingLocks(keepExtras)`, no guard | `save`, or `restore` when `restored_from` is a known version |
| W2 | `episodeController.updateScriptLocks` (L702–755) | `PUT /episodes/:id/script-locks` (Approve/Unlock) | client, optional | yes, `FOR UPDATE` | `keepLockedBeats` | `lock`, then `captureOnLock` in the background |
| W3 | `episodeScriptWriterService.generateEpisodeScript` (L1202–1212) | `POST /episode-scripts/:episodeId/generate` | AI | **no** | guard only before the AI call; locks kept | `generate`. **Failure swallowed** |
| W4 | `episodeScriptWriterRoutes` lock (L158–168) | `POST /episode-scripts/:scriptId/lock` | the `episode_scripts.script_text` row, which the client can edit | **no** | **no guard**; locks kept | `generate`. **Failure swallowed** |
| W5 | `worldEvents/inject` (L48, L106–112) | `POST /world/:show/events/:ev/inject` | server merge of `[EVENT:]` / `[LOCATION_HINT:]` tags | transaction, but the episode is read **outside** it, unlocked | **edits locked beats**; no guard by design | `generate` |
| W6 | `worldEvents/episodeGenerate` (L96–103) | `POST …/generate-episode` with `draft_script` | template | **no** | skips if a script exists; locks kept | `generate` |
| W7 | `worldEvents/scriptAndBulk` (L61–108) | `POST …/generate-script` | template | **no** | guard 409; locks kept | `generate`. Returns the raw skeleton |
| W8 | `worldEvents/episodeBatch` (L124–129) | `POST …/generate-episode-from-many` with `draft_script` | template | **no** | skip guard; locks kept | `generate` |
| W9 | `episodes.js` generate-beats (L1374–1487) | `POST /episodes/:id/generate-beats` (no frontend caller) | template | **no** | **no overwrite guard**; locks kept | `generate` |
| W10 | `episodeBriefRoutes` generate-script (L606–703) | `POST /episode-brief/:id/generate-script` | AI | yes, re-read under `FOR UPDATE` | guard 409, locks re-applied under the lock | `generate` |

None of these write the script: any other `Episode.create`, the seed `bulkCreate`s, raw SQL, `scriptParse`, `world`, `evaluation`, the workers and queues, regenerate-beat and rewrite-line.

**Facts that shape the design:**
- Every writer loads the episode without its keys (default scope).
- Nine of ten change the text after it arrives: lock-keeping puts beats back, renumbers extras to 15+, and re-joins with `\n\n`.
- Six have no transaction or row lock, and W5 reads unlocked.
- Restore trusts the browser's text.
- `snapshotScript` copies text and locks but never keys. It swallows its own failures, de-duplicates against the newest version, and hard-deletes beyond 50/10.

### 1.2 Frontend

Only two calls send editor text, both in `EpisodeScriptTab`:
- `handleSave` → W1;
- `handleApprove` → W2.

Both send the **whole** text, with no hints and no version or hash. Every edit (line edit, delete, add, move, beat move, regenerate-beat accept, phone-path fix, Raw editor, Import, Restore) changes local text only.

`useLineIds` / `nextLineIds` / `lineOpRef` already track per-line ids within a beat, but seeded per session as `line-N`. Three edits record no operation: beat move, regenerate-beat accept, phone-path fixes.

There is no server autosave. Every write is last-write-wins, and a save from another tab goes undetected.

### 1.3 Consumers that name lines by position (depend on A1c; not changed by it)

| Consumer | Identifier | Risk today |
|---|---|---|
| `script_voice_clips` (unique `episode_id, beat_number, line_index`) | teleprompter index, spoken lines only | Inserting a line above makes a clip point at the wrong line, and recording the new line **soft-deletes the moved line's clip**. Renumbering a beat orphans its clips |
| `todo/at`, `dealChecklistService`, `scriptWear`, `scriptTodo` | request-time beat and line index | stale positions give the wrong "as of" state |
| My Little List / `lalaKnowledge` | `{beat,line}` recomputed per read | positions a client cached go stale |
| `characterVoice.captureOnLock` | content pairing; its AI baseline is a version row | a pruned baseline is lost |
| `scriptPostDrafts` | `${beat}|${text}` | an edit or renumber makes a duplicate draft |

**Three line counts exist:**
- LK: every non-blank, non-header line. A headerless script gets `b:null`.
- `scriptWear` / `lalaKnowledge`: the same per beat, but a headerless script becomes 14 beats.
- The teleprompter: spoken lines only.

**Identity uses LK's count only.** Under D1, the 14-beat display never becomes stored structure, and no header is ever invented or written.

---

## 2. The four identity states

An episode's state is read **only** by checking the stored record against the stored text: `checkLineKeys(storedText, storedKeys)`. Nothing on a read path changes it (requirement 5).

| State | Stored `script_line_keys` | Meaning | Readers (`GET`) |
|---|---|---|---|
| **No identity yet** (`unkeyed`) | `null` | Every episode written before A1c. Nothing is wrong; it was never keyed | `line_identity: { status: 'unkeyed' }`, no lines. Consumers keep today's behaviour |
| **Valid** (`ok`) | a record whose `text_hash`, line count and every line's beat and hash describe the stored text | The keys can be trusted | `line_identity: { status: 'ok', lines: [{ k, b, h }] }`, active lines only; `retired` stays internal (D7) |
| **Inconsistent** (`mismatch`) | a record that does not describe the stored text: the reason is `version`, `text_hash`, `line_count` or `line` | Something changed the text, or the rules, without the keys | `line_identity: { status: 'mismatch', reason }`, no lines. The page says "Line identities need checking", and reading it repairs nothing |
| **A historical version** | a version row's `script_line_keys`, which is null for versions saved before A1c | The identities the script had when that version was replaced | used only by Restore (§4.4), checked against the version's **own** text |

The first save after A1c is the safe way out of **No identity yet** (requirement 6). The only way out of **Inconsistent** is an admin repair (D3, D8).

---

## 3. Confidence and review policy (D4, modified)

Every line of the text being saved gets exactly one outcome.

### 3.1 Certain: identity kept, no review

1. **Editor hint.** The line carries a key that is live in the stored record and not used by another line in the same request. The request's `base_text_hash` must equal the stored text's hash (D6), so the hint refers to the record it was made from.
   - A server writer that builds the text itself (inject, lock-keeping) gives its own deterministic hints for the lines it carries over unchanged.
2. **Exact and unique.** The line's normalised text appears exactly once among the stored lines still unmatched, and exactly once among the new lines still unmatched, in the same beat or across beats. In the same beat it is "kept"; in another beat it is "moved".
3. **Exact repeated group, same count.** A text appears *n* times in a beat before and *n* times after, in the same relative order: the copies are paired in order.

### 3.2 Uncertain: never kept without an explicit confirmation

Uncertain lines get a **new** key, and the old key retires, unless a person explicitly confirms the pairing. Uncertain cases:

4. **Edited in place.** A line with no hint whose words are similar to a removed line, by LK's word similarity (≥ 0.5 today).
5. **Repeated group whose count changed.** A text appears 3 times before and 2 after: which copy went is ambiguous, so every copy in the group is uncertain.
6. **A refused hint:** the key is unknown, retired, used twice, or sent with a stale base. The line is treated as having no hint, and the refusal is reported.

### 3.3 New and removed

7. **New.** A line with no certain pairing gets a newly minted key, checked against live, retired and every remaining version's keys. It is never one used before.
8. **Removed.** A stored key with no pairing retires, with `retired_in` set to the version row this save creates. The retired list only grows.

### 3.4 Review, and how it phases in

- **The server never decides from the screen that saved the text.** The same rules apply to Save, Generate, Inject, Approve and Restore. Only the *confirmation* differs, and only a person can give it.
- **Until A1c-4 ships,** no client can confirm, so uncertain lines always get new keys. Every response and log line lists them: `report.uncertain: [{ new_line, candidate_old_key, reason }]`.
- **From A1c-4,** the Script tab sends `identity_review: 'ask'`. If any line is uncertain, the save is **not** applied. The server answers `409 LINE_IDENTITY_REVIEW` with the candidate pairs. The screen asks, per line, "same line, edited" or "new line" (with "all new" as a shortcut). It re-sends with the confirmed pairs as hints (rule 1).
  - Clients that send no `identity_review` keep the default of new keys.
  - Server writers (generate, inject, templates) have no person to ask, so their uncertain lines always get new keys, and the report lists them.
- **A1a change inside A1c-1.** LK's `matchLines` applies step 2 ("edited") itself, and pairs repeated lines by longest common run whatever their counts. A1c adds a strict option: edited pairs are **suggested**, not taken, and a repeated group is certain only when its count is unchanged. A1a's existing tests keep the current default. The save service always uses the strict option.

---

## 4. Behaviour by state and action

The actions:
- **Save:** W1 (Script tab, Raw editor, Import, skeleton).
- **Generate:** W3, W6, W7, W8, W9, W10, plus W4 (Script Writer lock), which replaces the whole script with generated text.
- **Restore:** W1 with a version id; the text is read on the server (D5).
- **Event Inject:** W5.
- **Approve/Lock:** W2, a lock with or without unsaved text.

Every write runs in **one transaction** (requirement 1):
1. lock the row and read its text, locks and keys;
2. check `base_text_hash` where one was sent;
3. check the state;
4. keep locked beats;
5. assign identities (§3);
6. write the version row (the replaced text with **its** keys);
7. write the text, keys and locks in one update.

If any step fails, **nothing** is written. That includes the version history, which today logs its own failure and lets the save go on; this is a deliberate behaviour change (N2). Locked beats keep their text **and** keys in every case (requirement 7).

### 4.1 No identity yet (`unkeyed`)

| Action | Behaviour |
|---|---|
| Save | **First-save initialisation.** Lock-keeping runs, then every line of the saved text gets a new key; session hints are ignored, since there is nothing they could refer to. The state becomes **Valid**. The version row stores the replaced text with keys `null`, which is accurate |
| Generate | The same initialisation on the generated text. The overwrite guard and locks apply as today, plus the stale check (N3) |
| Restore | The server reads the version's text. If the version has valid keys for its own text, they are reinstated (§4.4); otherwise every line is minted. The state becomes **Valid** |
| Event Inject | The inject builds the new text outside locked beats (D9), then every line is minted. The state becomes **Valid** |
| Approve/Lock | With unsaved text: the same as Save. Lock only, text unchanged: the text is keyed in the same write (N4). The state becomes **Valid** |

### 4.2 Valid identity (`ok`)

| Action | Behaviour |
|---|---|
| Save | A stale `base_text_hash` returns `409 SCRIPT_CHANGED`, with nothing written (D6). Lines are assigned as in §3: before A1c-4 uncertain lines get new keys; from A1c-4 the save stops at `409 LINE_IDENTITY_REVIEW`. Locked beats keep their keys |
| Generate | The base hash is taken **before** the AI call. If the stored text changed by write time, the result is `409 SCRIPT_CHANGED` with the generated draft returned unsaved, so newer text is never overwritten (N3). Otherwise only certain rules 2–3 apply: unchanged lines keep keys, everything else is new, removed keys retire. Locked beats keep text and keys |
| Restore | §4.4 |
| Event Inject | Inject knows exactly which tag lines it removes and adds, so every untouched line keeps its key through its own deterministic hints. Removed tags retire, and new tags are minted. Locked beats are never edited (D9): tags go into the first allowed position outside them, or the inject refuses with a reason (N6) |
| Approve/Lock | With unsaved text: the same as Save. Lock only: text and keys are unchanged, and only `script_locked_beats` changes. The version row stores the replaced text with its keys |

### 4.3 Inconsistent identity (`mismatch`)

| Action | Behaviour |
|---|---|
| Save, Restore, Event Inject, Approve/Lock | **Refused before any change:** `409 LINE_KEYS_NEED_REPAIR` with the reason and the repair dry-run link (D2). Text, keys, locks and history are all left as they were. The Script tab keeps the person's edits in the local draft |
| Generate | Refused **before the AI call**, so no money is spent, and checked again at write time |
| Way out | An admin runs the repair dry run, approves it (D3, D8, §5), and then the original action is retried |

### 4.4 Restore, and historical identities (requirement 2)

1. **The text comes from the server.** It reads the version row by id, for this episode only. Browser text sent with a restore is ignored (D5).
2. **Lock-keeping applies** to the restored text: today's locked beats stay as they are now, with their current keys (requirement 7).
3. **If the version's keys describe the version's own text** (`checkLineKeys` = ok), each version line takes **its own historical key**, with these exceptions:
   - **a key that a kept locked beat uses right now** stays with the locked line. The version's line gets a new key, and the report names it. A key is never on two lines;
   - **a key that is neither live, nor retired in this episode, nor in any version of this episode** cannot have belonged to this episode. It is refused and the line gets a new key. This should never happen; it is a guard;
   - **otherwise the key is reinstated.** A reinstated key comes back only for its own line, because the version's keys describe that version's text. A retired key is never given to an unrelated line.

   Every key live now that the restored text doesn't use retires. The retired list is merged and only grows.
4. **If the version has no keys** (saved before A1c), or its keys don't describe its text, the restore is treated like a Generate:
   - unchanged lines keep today's keys by certain rules 2–3;
   - everything else gets new keys;
   - the report says the version's identities could not be used.
5. **The restore's `base_text_hash`** guards against restoring over a newer save (D6).

LK's `restoreLineKeys` already reinstates only the version's own keys, and refuses when the keys don't describe the text. A1c adds the locked-beat exception and the "belongs to this episode" guard around it.

---

## 5. Repair of inconsistent episodes (D3, D8)

- **Who:** `requireAuth` + `authorize(['ADMIN'])`.
- **Scope:** one episode per call. There is no bulk apply.
- **Dry run:** `POST /api/v1/episodes/:id/script/line-keys/repair`, the default.
  - Under a read lock it returns `{ status_before, reason, plan: { kept, moved, uncertain, new, retired }, per_line, plan_hash }`. Nothing is written.
  - It uses §3's rules with no hints: uncertain lines are listed, never kept.
- **Apply:** `{ confirm: true, plan_hash, confirmed_pairs? }`.
  - Under `FOR UPDATE` it recomputes the plan; if it differs, it returns `409 PLAN_CHANGED`.
  - It writes **only** `script_line_keys`, never the text.
  - It writes a version row with source `line-key-repair`.
  - It logs the counts.
  - The admin can confirm individual uncertain pairs, the same review as §3.4.
- **Report:** a read-only admin GET lists every episode's state, reason and what a dry run would do. It writes nothing.
- **Today's episodes** are all **No identity yet**, which is not inconsistent, so no repair is needed: their first save initialises them. An admin may also key one without changing its text through the same dry run and apply, for example before the voice-clip backfill.

---

## 6. Version retention (D11, modified)

- **Ordinary drafts keep today's limits:** the newest 50 save, lock and restore versions, and the newest 10 generated, per episode.
- **A durably referenced version is never pruned.** `prune` skips any version id named by an approved production manifest, a dialogue asset, or another durable production reference. A1c-1 adds that check as a registry of referencing sources.
- **No table references a version row today,** because manifests and line-keyed dialogue assets don't exist yet. So the registry starts **empty**, and nothing pruned today is protected by it. N5 asks whether to add a protective column now instead.
- **Every future table** that references a version must register in the same PR that creates it. A test proves a referenced version survives pruning.
- **Identity safety never depends on retention.** The live `retired` list only grows, and minting checks it. A pruned version can never cause a key to be reused.

---

## 7. Voice clips and other position-based consumers (requirement 3)

- **A1c does not read, change, re-key, delete or soft-delete any `script_voice_clips` row,** and doesn't change how clips are matched or saved. A test asserts that every A1c write leaves `script_voice_clips` exactly as it was.
- **The existing loss risk is not fixed by A1c:** recording a line soft-deletes whichever clip held the same `(beat, line_index)` slot. That is A1d's job: move clips to `(line_key, h)` with `keyForStoredLine`, and flag ambiguity instead of guessing. A1d needs Valid identities, so it comes right after A1c-3.
- **A1c changes none of the other consumers** (todo/at, My Little List, post drafts, `captureOnLock`). They keep reading positions as today.

---

## 8. Tests and acceptance criteria

### 8.1 Integration tests, one per writer (requirement 4)

Postgres, through the real routes. Each writer is tested in all three states:
- **No identity yet:** it initialises, and the result is `ok`.
- **Valid:** unchanged lines keep keys, removed keys retire, and new lines are minted.
- **Inconsistent:** 409, and nothing written.

Each also asserts that **text, keys and the version row change together or not at all.** A forced failure in the version write leaves all three unchanged.

| Writer | Also covers |
|---|---|
| W1 Save | stale `base_text_hash` → 409 with nothing written; hints honoured; refused hints reported; locked beats keep text and keys; clearing the script retires every key |
| W1 Restore | server-side text, with browser text ignored; valid version keys reinstated; a key held by a kept locked beat is not duplicated; a pre-A1c version reconciles; retired keys go only to their own line |
| W2 Approve/Lock | lock only keeps keys; lock with text behaves like Save; a mismatch refuses the lock too |
| W3 Script Writer generate | stale check after the AI call → 409 with the draft unsaved; a failed save is reported, not swallowed (D10) |
| W4 Script Writer lock | overwrite guard added; transaction and row lock; failure reported (D10) |
| W5 Event inject | locked beats never edited (D9); the inject's own hints keep untouched lines; refusal when no allowed position exists (N6) |
| W6 generate-episode draft | transaction and lock; skipped when a script exists |
| W7 event generate-script | guard 409; the response returns the **saved** text |
| W8 episode from many | transaction and lock; skip guard |
| W9 generate-beats | **new overwrite guard** (D10); transaction and lock |
| W10 episode-brief generate-script | stale check after the AI call (N3); locks re-applied under the lock |

### 8.2 Unit and property tests

- §3's rules: hint; exact and unique; repeated group with the same count; edited suggested, never taken; repeated group with a changed count is uncertain.
- The retired list only grows across 50 random saves, and no key ever appears on two lines.
- A new key is never one that was live, retired or in a remaining version.
- The A1a strict option keeps the existing A1a tests green.

### 8.3 Guards and the rest

- **Single write path.** A static test fails CI if any file other than the save service writes `script_content` **or** `script_line_keys`.
- **Reads don't write (requirement 5).** GET of an episode and of a version leaves `script_line_keys`, `updated_at` and the version count unchanged in all three states.
- **Voice clips untouched (requirement 3):** every writer leaves `script_voice_clips` unchanged.
- **Retention:** a version named by the reference registry survives pruning.
- **Repair:** the dry run writes nothing; a stale `plan_hash` gets 409; apply writes only keys plus a `line-key-repair` version; it is admin-only.
- **Reads (A1c-3):** `line_identity` per state as in §2; the raw column never appears.
- **Frontend (A1c-4):**
  - ids are seeded from the server keys;
  - hints are aligned to the twin's `scriptLines` and sent with the base hash;
  - the three 409s keep the local draft and explain what happened;
  - the review sends confirmed pairs.

### 8.4 Acceptance

- After A1c-1, every writer leaves the episode **Valid** (`checkLineKeys` = ok on the saved text), and none ever leaves it **Inconsistent**.
- No uncertain identity is kept without a person's confirmation.
- Locked beats keep their text and keys.
- No read changes anything.
- No voice clip changes.
- Each step is deployed through the Deploy workflow.

---

## 9. Revised sequence

| Step | PR | Contents | Needs |
|---|---|---|---|
| A1c-1 | **Single write path** | the save service; all ten writers at once (a partly moved state would make Inconsistent episodes); the A1a strict option; versions carry keys and history becomes atomic; the D6 stale check; the mismatch refusal; the D9 inject change; the D10 fixes; the D11 registry; the static guard; §8.1, §8.2, the read-doesn't-write test and the voice-clips-untouched test | N1–N6 |
| A1c-2 | **Repair and report** | admin dry run and apply, one episode at a time, plus the read-only report | — |
| A1c-3 | **Reads** | `line_identity` on episode and version GETs; the A1b "no response carries keys" test changes on purpose, because the raw column still never appears | — |
| A1c-4 | **Script tab** | ids seeded from keys; hints and base hash on Save and Approve; operations recorded for beat move, regenerate-beat accept and phone-path fixes; restore by version id; the three 409 screens; identity review | A1c-1, A1c-3 |
| next | A1d (not A1c) | voice clips moved to `(line_key, h)` with an ambiguity report and no guessing, which ends the existing loss risk; then A2 teleprompter marks | A1c-3 |

No step needs a migration. The new version source `line-key-repair` fits the existing `STRING(16)` column. Each PR is reviewed separately and deployed through the Deploy workflow.

---

## 10. Decisions still needed

| # | Question | Recommendation |
|---|---|---|
| N1 | Is §3's confidence policy right? In particular: a repeated line whose count is unchanged is certain, and a changed count makes the whole group uncertain | **Yes**, as written |
| N2 | Atomic history (requirement 1): today a failed version write is logged and the save goes on. A1c makes it fail the whole save, with nothing written and a clear error | **Yes.** It is what requirement 1 asks |
| N3 | A generator whose base changed during the AI call | **Refuse with `409 SCRIPT_CHANGED`**, returning the draft unsaved so it can be applied deliberately; W3 also keeps it in `episode_scripts` as today |
| N4 | Approve/Lock with no text change on an episode with no identity yet: key it in the same write, or leave it | **Key it.** It is a script write, and it saves a later surprise |
| N5 | Retention protection (D11): a registry in code (empty until manifests or dialogue assets exist), or a protective column now | **Registry now.** The first manifest or dialogue PR registers itself; a column can follow if a reference outside code ever needs it |
| N6 | Inject when the only valid tag position is inside a locked beat | **Put the tags before the first unlocked beat**, or at the top when no beat is unlocked; refuse with a reason only when no position outside a locked beat exists |
