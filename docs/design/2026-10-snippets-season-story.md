# Snippets and Season Story — design spec (October 2026)
Source: Evoni's design conversations. Companions: docs/design/2026-10-the-pulse.md, docs/design/2026-10-lalas-phone.md, docs/design/2026-10-style-templates.md. Items marked [decide] wait for Evoni.
## 1. What it is

* An episode has two halves: gameplay (beats 1–10: Prime and Lala, the phone, wardrobe, the brand deal) and story (beats 11–14: a snippet).
* A snippet is a self-contained 2–5 minute scripted scene, shot as realistic video (Runway) with Evoni performing every role.
* Snippets are canon and feed the season story across episodes.

## 2. Rules

1. No fixed timings. Length is a guide only (about 150 spoken words per minute, so roughly 300–750 spoken words plus action). Durations are decided in the Timeline Editor.
2. Canon and reveals apply. A snippet respects the story clock, reveal schedules and "who knows what".
3. One owner. Snippets read characters, Pulse posts, wardrobe, scene sets and results from their owners.
4. Evoni approves. Proposed casts, roles, drafts and callbacks are suggestions until she approves them.

## 3. Snippet shape

1. Hook — the first moments that grab attention.
2. Setup — where we are, who is here, what Lala wants.
3. Turn — something changes (a person, a reveal, a choice).
4. Button — the moment lands and leaves a thread pulling toward the next snippet.

* Kinds: confrontation, reveal, bonding, aftermath, cold open [extendable].

## 4. Casting from The Pulse

* Before writing, the system proposes a cast with roles (for example catalyst, ally, skeptic, rival, mentor, witness) from evidence: who posted about the event, attendance and guest lists, reactions and comments toward Lala, unanswered threads, each character's archetype and Relationship Map.
* Each proposed role shows its evidence ("commented 'look at you' on her fit post").
* Role history: the proposal remembers each character's past roles and can suggest a shift so no one plays the same role forever.
* Evoni approves or recasts.

## 5. Writing the snippet

* The draft uses each character's Voice Profile and pulls callbacks to what has been said publicly on The Pulse.
* The turn reflects the episode's outcome: the result (SLAY, PASS, …) and Lala's choices earlier in the episode (look, brand deal accepted or declined).
* Continuity check before recording: Lala's outfit matches the Style Page, the venue and angle match the scene set, the time of day matches the story clock, and no one knows something they shouldn't yet. Issues are flagged, not auto-fixed.

## 6. Season story

* Storylines each have an arc shape across the season's slots: setup → rising → crisis → payoff. Every snippet is placed on the storylines it moves.
* Season view: each storyline's health ("set up in E1, nothing since"), and a suggestion for what its next snippet should do (escalate, complicate, pay off).
* Promises list: every planted hook (unanswered comment, mystery brand, hinted secret) is recorded and must be paid off by the finale. Unpaid promises surface as snippet ideas; finale planning starts from this list.
* Variety view: the mix of snippet kinds across the season, so the same kind doesn't run back to back.
* Story view: all snippets in story-time order, grouped by storyline.

## 7. Production

* Line sheets per character, which can group a character's lines across several snippets for one recording session, with direction notes ("dry, unimpressed").
* Teleprompter mode for recording.
* Takes are tracked and linked to the timeline, so the edit knows which take is used.
* Shot list for Runway per snippet: setting and angle from the scene set, Lala's look from the Style Page, characters present.
* Runway shot library: every generated shot is saved and tagged (venue, angle, character, mood) for reuse.
* Character reference sheets for Runway so characters look consistent across snippets.
* Copy-out script export (plain text and a formatted script).

## 8. The Pulse around a snippet

* Teaser posts before the episode, reactions during the story time the snippet covers, fallout afterwards — scheduled automatically within reveal rules and approved like other Pulse content.

## 9. The game layer (keeping the episode watchable)

* The quest: the invitation is the quest; the dress code is the requirement; the Shopping list is the inventory; brand-deal deliverables are a side quest. Stated early in the episode.
* HUD overlay: coins, stress and reputation shown changing live as choices are made (values as of each beat).
* Consequence callouts: when an earlier choice pays off, the script marks it ("Because you chose the crimson pumps…") as a line or overlay.
* Rewards as beats: the result reveal, payouts landing in Bank, follower jumps, career unlocks.
* The snippet is the reward: gameplay first, story as the cutscene.
* Flash-forward cold open: an optional few seconds from the snippet at the very start, then "earlier today".
* Recurring segments: Fit Check, Brand Deal, Pulse Check (reading reactions), Career Moment, the Snippet.
* Viewers as players: an optional between-episode poll decides a real choice (approved by Evoni before it becomes canon); Prime's comment prompts; Easter eggs from The Pulse.
* Outro tease: Prime's outro can tease the snippet's open thread (written fresh each time).

## 10. Script editor support

* Snippet slot at beats 11–14, linked to the snippet record.
* Pacing strip: beat types across the episode (gameplay, notification, choice, reward, cutscene).
* Gentle flags for long stretches without a choice, reward or reveal ("3 beats since the last choice"). Flags only; no timing.
* Segment markers for the recurring segments.

## 11. Build order

1. Snippet record and slot: snippets as canon records linked to an episode's beats 11–14; shape fields; kinds; story-time stamp.
2. Storylines and season view: arc shape per storyline, placement, health, promises list, variety and story views.
3. Casting: evidence gathering from The Pulse and relationships, role proposals with evidence, role history, approval.
4. Drafting: draft with voices and callbacks; outcome-shaped turn; continuity check.
5. Production tools: line sheets, cross-snippet batching, teleprompter, takes, export.
6. Runway tools: shot lists, shot library, character reference sheets.
7. Game layer: quest framing, HUD overlay, consequence callouts, reward beats, flash-forward, segment markers, pacing strip and flags.
8. Pulse wrap and viewer participation: scheduled teasers and reactions; polls (after the public site is live). Each phase is split into issues small enough for one phone-reviewable PR, each starting with a read when it touches data it has not measured.

## 12. Open decisions [decide]

* Role names list (starting set).
* Whether the flash-forward cold open is on by default.
* Which segments are in every episode vs optional.
* Whether polls can change canon directly or only suggest.
