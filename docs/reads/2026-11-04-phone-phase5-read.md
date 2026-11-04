# Lala's Phone phase 5 read — episode skeleton and script language (2026-11-04)

**SHA:** `efb8ba29` (origin/main, 2026-11-04). Task: #3124.
**Spec:** `docs/design/2026-10-lalas-phone.md` §7 (the episode rhythm and skeleton), §8 (script language), §1 Rules 4 and 5, §15 phase 5, §16.
**Scope:** read only. No code was changed and no issues were opened. Every finding is marked **MEASURED** (file:line at this SHA) or **INFERRED** (reasoned from measured code, not run).

## 1. Summary

Most of the parts phase 5 needs already exist, but they are spread out and named in the show's older language. Three things stand out:

- **A skeleton exists, but it is the legacy 9-beat one.** It is not the spec's six beats, and Start Episode turns it off.
- **The cue language is the `[UI:VERB Target]` grammar.** Its targets are free text, matched to the Phone Hub's screens by fuzzy name. The spec instead wants fixed screen names and fixed verbs.
- **The phone path check is built,** for taps and opens. It is the strongest piece to build on.

Nothing exists yet for:

- Prime's outro, its idea library or its repeat warning;
- the "Previously on" beat;
- the brand-deal and career-moment beats.

Rule 4 (no timings) is broken by the script parser. Rule 5 (who speaks) is only half checked.

## 2. How episodes and scripts are made today

| # | Finding | Evidence |
|---|---|---|
| 2.1 | **The skeleton generator writes 9 beats.** In order: `OPENING_RITUAL`, `CREATOR_WELCOME`, `INTERRUPTION #1`, `REVEAL #1`, `STAKES_INTENTION`, `TRANSFORMATION`, `INTERRUPTION #2`, `EVENT_TRAVEL`, `CLIFFHANGER`. | MEASURED `src/utils/scriptSkeletonGenerator.js` `generateScriptSkeleton` :27; headers :66, :84, :102, :114, :140, :171, :219, :236, :262 |
| 2.2 | **The skeleton can write `[WEAR: <id>]` per piece of a locked look** (option `look`, `lookPieceFor` :335). Without a look it writes the line "Lala: 'Bestie... I look like money.'" instead. | MEASURED `scriptSkeletonGenerator.js` :22-23, :191-206 |
| 2.3 | **Its only caller passes no `look`,** so no `[WEAR]` cue is ever pre-placed. | MEASURED `src/routes/worldEvents/episodeGenerate.js` :87-90 (`includeNarration`, `includeAnimations` only) |
| 2.4 | **Start Episode does not use the skeleton.** It asks for `draft_script: false`. The skeleton runs only through the generate-episode route when a draft is asked for. The save goes through `services/scriptSave` (locked row, versions). | MEASURED `frontend/src/pages/eventPackage/useStartEpisode.js` :70; `episodeGenerate.js` :91-96 |
| 2.5 | **The Script tab numbers beats against a 14-beat canonical map,** `EXPECTED_ON_SCREEN` (1 Headphones on … 9 To-do list, 10 Location, … 14 Fade out). This map and the skeleton's 9 named beats are two different rhythms. Neither one is the spec's six-beat rhythm. | MEASURED `frontend/src/lib/scriptMoments.js` `EXPECTED_ON_SCREEN` :342-360 |
| 2.6 | **The AI script writer gets a carry-forward block** from the last approved story record. | MEASURED `src/services/episodeScriptWriterService.js` :457-460 → `storyCarryForward.carryForEpisode` |
| 2.7 | **Where a new skeleton belongs:** in `scriptSkeletonGenerator` (or a sibling), saved through `scriptSave`. It would be offered at Start Episode, which today skips any draft. | INFERRED from 2.1-2.4 |

## 3. Phone cues in scripts today

| # | Finding | Evidence |
|---|---|---|
| 3.1 | **The UI line grammar is `[UI:VERB Target]`,** and the target is free text. | MEASURED `scriptMoments.js` `UI_LINE` :21, `parseMoment` :24 |
| 3.2 | **Verbs the picker writes:** OPEN, CLICK, SCROLL and CLOSE (`PHONE_VERBS`); SHOW and HIDE for the phone itself (`DEVICE_VERBS`); DISPLAY and HIDE for overlays. Verbs the reader knows add TYPE, CHECK, NOTIFY, SWIPE, SELECT, HOVER, PULSE and VOICE_ACTIVATE, plus the message verbs NOTIFY, DM and POST. | MEASURED `scriptMoments.js` :34-52, `VERB_LABELS` :53-56, `MESSAGE_VERBS` :140 |
| 3.3 | **Other cue tags already in use:** `[WEAR: id]`, `[DELIVER: id]`, `[TODO_MODE: shopping\|deal\|career]`, `[LEARNS: state [id]]` (5 states) and `[MAIL: …]`. | MEASURED `scriptMoments.js` `wearLine` :531, `deliverLine` :638, `TODO_MODES` :628, `LEARNS_STATES` (≈:697); `src/utils/scriptBeatParser.js` :329-358 |
| 3.4 | **The cue picker is `MomentPicker`.** You pick a screen, icon, overlay or the phone, then a verb. Icon taps are written as the path of taps that reaches them. | MEASURED `frontend/src/components/Episodes/EpisodeScriptTab.jsx` `MomentPicker` :684-700 |
| 3.5 | **Screen names come from the Phone Hub rows, not a fixed list.** A target is matched by its stem (`targetStem` drops "overlay", "screen", "icon" …). There is no `phoneHome.js` or other fixed screen catalogue. | MEASURED `scriptMoments.js` `targetStem` :73, `resolveMoment` :87 |
| 3.6 | **The production Phone Hub mapping still has gaps:** The Pulse icon is miswired to `perfume_page`, there is no Bank screen, there is no Mail screen, and Call is miswired to `homepage`. | MEASURED `docs/reads/2026-10-14-phone-hub-read.md` :241-250 (measured there against production, 2026-10-14; not re-measured: no database contact in this read) |
| 3.7 | **The parser gives every UI action a duration** (click 0.8 s, open 1.2 s …), and beats get default durations. | MEASURED `scriptBeatParser.js` `UI_ACTION_DURATIONS` :54-61, `BEAT_DEFAULTS` :63 |
| 3.8 | **The beat model's types are** `dialogue`, `ui_action`, `sfx`, `music`, `cta` and `transition`. | MEASURED `src/models/Beat.js` :30 |

### 3.9 The spec's twelve cues against what exists

| Spec cue (§8) | Today | Verdict |
|---|---|---|
| Lala is equipped with <piece> → Lala: <line> | `[WEAR: id]` + Lala line slot | **built** (cue); line draft is a template (§4) |
| notification arrives | `[UI:NOTIFY Sender: text]` | **built** |
| opens <screen> | `[UI:OPEN Target]` | **partly**: free-text target |
| scrolls The Pulse | `[UI:SCROLL Target]` | **partly**: any target |
| reads <item> in Mail | `[MAIL: …]`; no "reads item" form | **partly** |
| accepts / declines <offer> | `[LEARNS: deal_accepted]` / `opportunity_accepted`; no decline | **partly** |
| ticks off <item> | `[DELIVER: id]` (deal items); `[UI:CHECK_ITEM]`; Shopping list crossing comes from `[WEAR]` | **partly** |
| checks Bank | `[UI:OPEN Bank…]` with no Bank screen (3.6) | **missing** |
| payout lands | none | **missing** |
| <character> calls | none (Call icon miswired, 3.6) | **missing** |
| Prime taps Voice → Lala: <line> | `[UI:CLICK VoiceIcon]` + `[UI:VOICE_ACTIVATE Lala]`; voice clicks auto-added (`beatWithVoiceClicks`) | **built** |
| Prime taps Location → travel to <venue> | `[UI:CLICK LocationIcon]`; the travel itself is phase 6 | **partly** |

Evidence: MEASURED `scriptMoments.js` :34-56, :531, :638; `scriptBeatParser.js` :276, :329-358; `frontend/src/lib/scriptShowRules.js` `beatWithVoiceClicks` :119-125.

## 4. Lala's line after each piece

| # | Finding | Evidence |
|---|---|---|
| 4.1 | **There is a template draft line from the piece** (`draftFacts`, `draftLine`, `lalaLine`) and a slot finder (`lalaLineSlots`). | MEASURED `frontend/src/lib/lalaLineDraft.js` :43, :97, :107, :121 |
| 4.2 | **The slot is shown under each equipped piece.** It has an AI draft button (`onAiDraft`), but nothing passes it, so there is no AI draft. | MEASURED `EpisodeScriptTab.jsx` `LalaLineSlot` :943-952, used :1331 without `onAiDraft` |

## 5. What a phone path check can reuse

| # | Finding | Evidence |
|---|---|---|
| 5.1 | **`phoneCheck` walks a beat's UI lines from the screen the phone shows.** A tap whose icon is not on that screen is flagged. A target that does not exist is listed as missing. Close goes back. Hiding the phone returns home. | MEASURED `scriptMoments.js` `phoneCheck` :446-494; `TAP_VERBS` :130; `OFF_VERBS` :231 |
| 5.2 | **`phoneStartScreens` carries the screen across beats.** The phone is up from beat 2 to 10 (`PHONE_UP_FROM_BEAT`, `PHONE_UP_UNTIL_BEAT`). | MEASURED `scriptMoments.js` :251-262, :497-510 |
| 5.3 | **Script health reads it** and shows "<name> isn't made yet" and the wrong-screen taps. | MEASURED `frontend/src/lib/scriptHealth.js` :10, :82-88 |
| 5.4 | **Paths through the icons are worked out** in `phonePaths` (frontend and server copies). | MEASURED `frontend/src/lib/phonePaths.js`, `src/utils/phonePaths.js` (files present) |
| 5.5 | **What it does not check:** that a target is one of the fixed §8 screens; that `[WEAR]`, `[DELIVER]` and `[LEARNS]` reach a real screen (they have their own flag lists: `wearFlags` :610, `dealCueFlags`, `learnsCueFlags`). | MEASURED `scriptMoments.js` :593-626; INFERRED that they share no path rule |

## 6. Previously on, and Prime's outro

| # | Finding | Evidence |
|---|---|---|
| 6.1 | **The data for "Previously on" exists.** `lastRecord` reads the latest `approved` story record (what happened, relationships, threads) before an episode. | MEASURED `src/services/storyCarryForward.js` `lastRecord` :52-60 |
| 6.2 | **"Before" means `episode_number <`.** It does not use the season's story order (phase 7 ruling G1; `services/seasonStoryOrder`, PR #3697, not merged). A bonus episode numbered 40 would be "previously" for nothing it follows. | MEASURED `storyCarryForward.js` :59, `carryForEpisode` :123-133; INFERRED consequence |
| 6.3 | **No "Previously on" beat is written** by the skeleton, the writer or the Script tab. There are no hits for "previously on" outside comments. | MEASURED grep at this SHA (`src`, `frontend/src`) |
| 6.4 | **Prime's outro:** the skeleton ends with Prime's "Besties... did she slay? Rate this look…" line. This is not an outro library. No table, service or check exists for past outro lines, and no repeat check exists. The "outro" hits are scene types in `claudeService` :81-88. | MEASURED `scriptSkeletonGenerator.js` :262-264; grep at this SHA |
| 6.5 | **The source for Prime's tease exists:** the planted Pulse storylines (`PulseStoryline`, `PulseStorylineBeat`, `services/pulseStorylines.js`). | MEASURED files present |
| 6.6 | **A repeat check could read the earlier scripts' Prime lines** (`episodes.script_content`, in story order) instead of a new table. | INFERRED |

## 7. Rules 4 and 5

| # | Finding | Evidence |
|---|---|---|
| 7.1 | **Rule 4 (no timings) is not enforced.** The parser stamps durations on every UI action and beat (3.7). Timings in the Timeline Editor are the spec's home for these. | MEASURED `scriptBeatParser.js` :54-63 |
| 7.2 | **Rule 5, Lala's side, is half built.** `voiceOffLines` finds Lala's lines with the voice off: a notification, message or mail allows the line that answers it; a dressing line allows its line. Voice clicks are auto-added. | MEASURED `frontend/src/lib/scriptShowRules.js` :100-117, :119-125 |
| 7.3 | **Rule 5, Prime's side, is not built.** Nothing checks that only Prime addresses the audience. The skeleton itself has Lala say "Bestie…" lines, which address the audience. | MEASURED `scriptSkeletonGenerator.js` :75-79, :131, :206, :247-249 |

## 8. Open issues touching phase 5

There are no open issues for phase 5 apart from this read (#3124). #3111 (The Pulse phase 12: a story moment per Phone beat) touches the beats the Phone tab previews, but not the skeleton or the cues. #3125 (phase 7) owns the story order that "Previously on" should use (6.2).

MEASURED: GitHub issue search at 2026-11-04 (open issues, terms: skeleton, Previously on, outro, cue picker, phone check, script language, Lala's Phone).

## 9. Gap table (spec phase 5)

| Spec item | Verdict | Evidence |
|---|---|---|
| Skeleton with the six beats, phone cues pre-wired | **partly built**: a 9-beat legacy skeleton; only Getting ready (`TRANSFORMATION`) and Travel (`EVENT_TRAVEL`) match; no `[WEAR]` pre-wired (no look passed); Start Episode skips it | 2.1-2.5 |
| 1 Previously on (optional per episode) | **not built** (data exists, ordered by episode_number) | 6.1-6.3 |
| 2 Getting ready: Shopping list, Lala line slot, a draft from the piece, crossed off | **partly built**: `[WEAR]` crossing and the slot are built; the draft is a template; AI draft is not wired | 2.2, 4.1-4.2 |
| 3 The brand deal arrives | **not built** as a beat (`[UI:NOTIFY]` exists) | 2.1, 3.2 |
| 4 The career moment ("spent so far") | **not built** as a beat (`[TODO_MODE: career]`, `[LEARNS]` exist) | 3.3 |
| 5 Prime's outro, library, repeat warning, tease | **not built** (storyline data exists) | 6.4-6.6 |
| 6 Travel | **partly built**: `EVENT_TRAVEL` beat; the transition is phase 6 | 2.1 |
| Fixed screen names | **not built**: free-text targets, fuzzy match, production mapping gaps | 3.1, 3.5, 3.6 |
| Fixed cue verbs; picker offers exactly them | **partly built**: 3 built, 6 partly, 3 missing | 3.9 |
| Phone check confirms each path is reachable | **built** for `[UI:]` taps and opens; **not** for the fixed names or the other tags | 5.1-5.5 |
| Rule 4 no timings | **not enforced** | 7.1 |
| Rule 5 who speaks | **half built** | 7.2-7.3 |

## 10. Proposed issues, in order

Each one is a single phone-reviewable PR. None of them is opened by this read.

| # | Issue | Files | Tests | Migration |
|---|---|---|---|---|
| P1 | **The cue vocabulary as one list.** A shared module of the §8 screens and cues, each with its tag form and the Phone Hub screen key it means. It stores no data; Rule 3 holds. | new `frontend/src/lib/phoneCues.js` and `src/utils/phoneCues.js` (same list, like `phonePaths`); `scriptMoments.js` reads labels from it | unit: every §8 cue has a tag form; every tag form round-trips through `parseMoment` / the tag readers | no |
| P2 | **The picker offers exactly the §8 cues.** `MomentPicker` lists the cues from P1, filled with the episode's screens, pieces, deliverables and offers. Free-text targets stay readable but are no longer offered. | `EpisodeScriptTab.jsx` (`MomentPicker`), `EpisodeScriptTab.css` | vitest: the picker lists the 12 cues; a cue whose screen is missing shows disabled with the reason | no |
| P3 | **Phone path check against the fixed names.** `phoneCheck` also flags a target that is not one of P1's screens, and a cue whose screen is not wired in the Hub. The flags appear in script health. | `scriptMoments.js` (`phoneCheck`), `scriptHealth.js` | unit: the 3.6 gaps (Bank, Mail, Call) each produce a flag; existing `phoneCheck` tests unchanged | no |
| P4 | **The six-beat skeleton.** A new generator for §7's six beats with cues from P1, `[WEAR]` per locked-look piece (passing `look`, 2.3), and empty Lala slots. It is offered at Start Episode as an opt-in. The legacy 9-beat skeleton is kept. | `src/utils/scriptSkeletonGenerator.js` (new function), `src/routes/worldEvents/episodeGenerate.js`, `useStartEpisode.js` | unit: six beats in order; `[WEAR]` per piece; no Lala line addresses the audience; integration: generate-episode with the opt-in saves through `scriptSave` | no |
| P5 | **Previously on.** An optional first beat built from `lastRecord` (key post, decisions, result), using the season's story order once PR #3697 is merged (6.2). Read only. | `storyCarryForward.js` (story-order "before"), skeleton from P4 | unit + integration: the record before in story order, not by episode_number; no beat when there is none | no |
| P6 | **Prime's outro: idea library and repeat warning.** Seed lines (once ruled, §16), a warning when an outro line repeats one from the last N episodes (read from earlier scripts, 6.6), and a tease drawn from a planted storyline. | new `src/services/primeOutro.js`, a route under an existing episodes router (`requireAuth`), Script tab hint | unit: repeat found across N earlier scripts; tease only from planted storylines | **no** if seed lines live in `shows.metadata` and repeats are read from scripts; **yes** (new file under `src/migrations/`, with `deleted_at`) if a library table is ruled |
| P7 | **Rule 5 check, Prime's side.** Script health flags a Lala line that addresses the audience ("Bestie…", "you guys", "subscribe"). P4's skeleton is written to pass it. | `frontend/src/lib/scriptShowRules.js`, `scriptHealth.js` | unit: Lala "Bestie…" flagged; Prime's same line not | no |
| P8 | **Lala line AI draft.** Wire `onAiDraft` to an AI handler: `aiRateLimiter`, `aiCostTracker`, `MODELS` retry loop, a Haiku side call. | `EpisodeScriptTab.jsx`, a new route and service | unit: the prompt carries the piece facts; cost logged | no |
| P9 | **Rule 4: stop the parser's timings** being read as the show's timings. Decide first (D5). | `scriptBeatParser.js` | depends on the ruling | no |

**Order:** P1 → P2 → P3 → P4 → P7 → P5 (after #3697) → P6 (after D1-D3) → P8 → P9 (after D5). The brand-deal and career-moment beats ride P4 using cues from P1. The deal lifecycle behind them is phase 4 and the Deal Track, so it is not built here.

## 11. Decisions needed from Evoni [decide]

- **D1 (§16): seed lines** for Prime's outro idea library. Who writes them, and how many?
- **D2: where the library lives:** `shows.metadata` (no migration) or its own table (migration). Also, how many recent episodes "repeat" looks back over.
- **D3 (§16): whether "Previously on" is on by default.**
- **D4: the six-beat skeleton and the legacy beats.** Should it replace the 9-beat skeleton and the 14-beat `EXPECTED_ON_SCREEN` map, or sit beside them as an opt-in? The Script tab's beat numbers, the phone-up window (beats 2-10) and the closet beat all read the 14-beat map (2.5, 5.2).
- **D5: Rule 4.** Should the parser's durations (3.7) be removed? Or kept as a hint that the Timeline Editor may ignore?
- **D6: the production Hub gaps** (3.6: no Bank or Mail screen; The Pulse and Call miswired). Fix them before P3, or let P3 flag them? Fixing them is a production data change and needs its own approval.
- **D7: the skeleton's "Bestie…" lines** for Lala (7.3). Should she keep them as in-world talk to the viewer-as-bestie, or does Rule 5 make them Prime's?
- **D8: decline.** Does "declines <offer>" need its own state in `[LEARNS]`, or is a missing accept enough?
