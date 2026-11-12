# A1.2-SPEC-v5: Amendments and clarifications

**Status:** adopted by Evoni on 2026-11-10.

**What this file amends.** `docs/design/2026-11-a1-2-start-snapshot-freeze-spec-v5.md`, sha256 `a99c3e46ed0bd2e12e88d438706048c9446992b9326043bce82e06c7134db0da`, 373 lines, 28,120 bytes. That file is kept byte-identical. Nothing in it is edited, and every change lives here.

**Provenance of the base specification.**
- **Recovered** verbatim from the 2026-11-06 session transcript ("Today's work planning"): a full Read of `scratchpad/decision-pack/A1.2-SPEC-v5.md` at 18:52:13Z. Recovered file sha256: `a99c3e46ed0bd2e12e88d438706048c9446992b9326043bce82e06c7134db0da`.
- **Delivered** to Evoni at 18:53:25Z as an attachment (`file_uuid f5b815d4-3469-40e3-ab42-0bd228f2cd33`). The delivery record lists 28,120 bytes.
- **Library copy (Evoni's statement, 2026-11-10).** Evoni reports that her ChatGPT Library copy of A1.2-SPEC-v5, created on 2026-11-06, has a SHA-256 hash matching the recovered file. That comparison was made by Evoni and is recorded on her statement.
- **The delivered attachment** itself was not available for an independent byte comparison, and it has not been hashed.
- **Authority.** Authorized on 2026-11-06 (PR #3733). Confirmed by Evoni on 2026-11-10 as "the authoritative historical baseline".

The three sections below do not conflict. Each one states its own scope.

## Amendment 1 (adopted by Evoni, 2026-11-10)

Wording drafted in the Gate 1 review and adopted by Evoni on 2026-11-10. The
quoted text below is that adopted wording, not a quotation of an earlier
ruling. It adds one exception to Q-3 and changes nothing else in A1.2-SPEC-v5,
whose file is kept byte-identical (sha256 above).

> Q-3 is unchanged for every existing writer: W3 (`placeEpisodeIn`) and W12
> (the full-season special swap and move) keep their refusals, and §13's
> acceptance tests stand. One new operation, the A7-x placement-only Move or
> Swap (EVENT_EPISODE_FLOW §8(ff)), may change which slot holds a filmed,
> unaccepted, unpublished episode. It calls `snapshotEpisode`, whose guard
> skips the frozen episode, so `season_context`, `season_number` and the
> brief's Start-record and intent fields stay byte-identical; the episode is
> listed in `snapshot_skipped`. It never writes late context (§8a stays
> `recordLateContext()` only). Filmed episodes become eligible only after
> unfilmed started episodes have shipped. The freeze stays permanent; no
> switch is added; no static guard is relaxed.

Added acceptance tests (for the new operation only):
1. For a filmed episode, a Move or Swap leaves `season_context` and
   `season_number` byte-identical, and brief intent, `arc_number` and
   `position_in_arc` unchanged; the response lists `snapshot_skipped`.
2. A frozen episode with NULL `season_context` → refused (§8a stays the only path).
3. `placeEpisodeIn`, the swap and the move still refuse a frozen episode (W3, W12).
4. The static writer pin is unchanged: four writers.

---

## Refinement of A1-e (adopted by Evoni, 2026-11-10)

The quoted paragraphs are Evoni's words of 2026-11-10: K-A, K-A1 and the
narrative-purpose synchronization ruling. The sentences outside the quotation
are consolidated explanatory wording, adopted with it. It narrows A1-e
(A1.2-SPEC-v5 §1) for episodes in a weekly season slot and leaves A1-e
unchanged for specials' episodes and unslotted episodes. A1.2-SPEC-v5 is
unedited.

> For slotted episodes, "narrative_purpose" belongs to authoritative season-slot
> planning. Episode Home displays it read-only, and the server enforces that
> ownership. Unslotted episodes retain independent editing. Preserve historical
> and filmed production values.
>
> Special episodes do not count as slotted for narrative-purpose ownership.
> Weekly season-slot episodes use the authoritative slot purpose. Specials and
> unslotted episodes retain brief-owned narrative purpose. Existing freeze and
> production protections remain applicable.
>
> Do not infer that a stored brief value is safe to overwrite merely because it
> resembles current planning. Only synchronize when the existing provenance or
> previous authoritative value can be established reliably. Otherwise preserve
> the brief and display the discrepancy for review. Never overwrite locked
> briefs or filmed production history.

Effect on §13 test 10. For a specials' or unslotted episode the expectation
stands as written. For a weekly-slot episode, a request that changes
`narrative_purpose` is refused (409) whether or not the episode is frozen; an
unchanged value still saves (200). Synchronization only fills an empty brief
value (today's behaviour); a non-empty value is never overwritten, because no
reliable provenance exists (Q-1: "Authorship is never inferred from values").

---

## Clarification of D-22 scope (adopted by Evoni, 2026-11-10)

The quoted paragraph is Evoni's K-B ruling of 2026-11-10, verbatim. The
"Reading" paragraph after it is consolidated explanatory wording, adopted with
it. It states how D-22 (A1.2-SPEC-v5 §1) sits beside the general audit trail
and changes nothing in D-22. A1.2-SPEC-v5 is unedited.

> Preserve D-22's dedicated "episode_intent_audit" for its narrowly scoped
> future frozen-episode intent correction workflow. The existing
> "activity_logs", repaired under issue #1948, remains the authoritative
> general administrative audit trail, including Move/Swap. Do not create
> duplicate general-purpose audit infrastructure. Do not implement or migrate
> D-22.

Reading: D-22's "never `activity_logs`" governs audited frozen-episode intent
edits only; the withdrawal of "`activity_logs` as the audit table" in
A1.2-SPEC-v5's opening section (line 8) refers to that same workflow.
