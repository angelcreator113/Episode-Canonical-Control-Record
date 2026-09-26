# Prime Studios Design Doctrine

## Status of this document

**Living design authority**, the same status as `docs/EVENT_EPISODE_FLOW.md` —
not filed under `docs/audit/`, no basis-SHA immutability rule, edited in
place as the doctrine evolves. This document records rules, not a register:
it mints no FD/XK/PE number, rules nothing beyond the nine items of
2026-09-22 and the rules of 2026-09-26 below, and
decides none of the questions listed under "Not decided here." It exists so
the same rules — the nine of 2026-09-22 and the rules of 2026-09-26 — don't
have to be restated in every issue that touches a
page or a workflow.

---

## The nine rules (Evoni, 2026-09-22)

**1. Three questions.** Every screen answers exactly one: what exists
(world), what am I making now (produce), or what reusable things do I have
(library). Administrative tooling is none of these three and stays out of
everyday navigation.
*Why:* a screen that tries to answer more than one question becomes a
screen nobody can describe in a sentence.

**2. The page contract.** Identity, status, the information needed for
this decision, exactly one primary action — everything else collapsed or
behind a drawer.
*Why:* a page with more than one obvious next step forces the person to
guess which one is real.

**3. Choose once upstream, inherit downstream.** A decision made earlier
is never asked for again; later steps show it and offer to change it.
*Why:* re-asking a settled decision is where trust in the tool erodes
fastest.

**4. Creation returns you where you came from, with the new thing
selected.** Worked example: the Event Package's venue and scene-set
creation (Task #1674, PR #1675). Picking "+ Create New Location" or "+
Create Scene Set" never navigates away — it creates inline, in a picker
scoped to the event, and selects the result in place.
*Why:* leaving a workflow to go create something, then having to find your
way back, is the single most common way a task gets abandoned mid-flow.

**5. Pickers, not navigation.** Choosing something opens a focused picker
scoped to the current context; you leave the workflow only to create or
deeply manage.
*Why:* navigating away to a whole other page to pick one thing loses the
context you were choosing it for.

**6. Libraries and workflows look different.** Libraries are search,
filter, browse. Workflows are status, what is missing, continue.
*Why:* a library screen that also tries to say "what's next," and a
workflow screen that also tries to be browsable, both do both jobs worse
than a screen built for one.

**7. One status vocabulary, human-facing.** Needs Setup, Ready, In
Progress, Needs Review, Complete, Locked — each with a plain reason
underneath. Recorded as the target; existing statuses are not renamed by
this document.
*Why:* five pages using five different words for "not done yet" makes the
whole product feel unfinished even where it isn't.

**8. Plain language, not field names.** Organizer, not
`source_profile_id`. Visual Set, not `scene_set_id`. Invitation, not
`invitation_asset_id`. Needs Review, not `pending_review`.
*Why:* a column name is an implementation detail; showing it to someone
who isn't touching the database is a leak, not a feature.

**9. Progressive disclosure.** The summary must carry the meaning, not
just hide the numbers. Prestige, strictness, and cost stay reachable in
one click.
*Why:* hiding a number without also saying what it means just moves the
confusion one click deeper.

---

## Rules added (Evoni, 2026-09-26)

**10. One Lala's Phone.** "Episode → Lala's Phone must render the same
canonical phone shell, apps, navigation and visual language as Producer
Mode's Lala's Phone. It is not a separate phone implementation. The
Episode view scopes the phone's content to the current episode and adds a
production-readiness rail alongside the device showing required phone
moments by beat, their status, and the next missing item. Selecting a
readiness item should navigate the phone preview to the corresponding
episode screen. Missions remain one phone capability, not the definition
of the Episode Phone tab." Producer Mode owns the phone system (home
screen, apps, reusable screens, global missions, skin, navigation); the
Episode is a second entrance to the same system.
*Why:* two phones drift apart.

**11. Event Name ≠ Episode Title.** The event name is what the event is
called in Lala's world, written as its organizer would name it. It never
uses the show name, episode number, "episode", "adventure" or
"LalaVerse", and uses Lala's name only if she is literally part of the
event's branding. The episode title comes later and may respond to what
happened.
*Why:* the two concepts had been bleeding together.

**12. Public event description ≠ producer story angle.** The description
is copy for someone deciding whether to attend: what happens, why go,
what it feels like. It never restates database facts (guest counts,
prestige numbers). The story angle is internal and separate.
*Why:* a database summary is not copy.

**13. Organizer, not Host, in the new-event flow.** Choosing or creating
an organizer sets it; the Event Package shows it as set, with only
"Change Organizer" reopening the choice.
*Why:* extends rule 8.

**14. Suggestions stay suggestions.** Anything Prime Studios proposes is
shown as suggested until Evoni accepts it. Field states are Set,
Suggested, Generating, Missing, or Waiting for <dependency>.
*Why:* nothing is written as canon silently.

**15. Readiness is phased.** The gates, and the question each answers:
Event Ready (do we know what is happening?), Story Ready (what is this
episode supposed to accomplish?), Script Ready (does the writer have
everything?), Production Ready (can every beat be produced?), Evaluation
Ready (can the outcome be judged fairly?), Acceptance Ready (may this
version become canon?).
*Why:* Event Ready is not Production Ready.

---

## Not decided here

Open navigation questions, not resolved by this document:

- **Sidebar grouping.** How Studio's pages, World, Write, and the
  franchise tier are grouped in navigation. Evoni wants Studio's pages
  kept as everyday production surfaces — not folded into an
  administrative or "advanced" area, not hidden behind a settings-style
  entry point.
- **Write's place.** Whether Write stays its own zone or folds into
  World.
- **Home vs. Producer Mode.** How Home relates to Producer Mode when
  there is only one show — whether Home is still a distinct landing
  surface, or Producer Mode effectively is Home in the single-show case.
- **Event Package enrichment on open.** Whether Event Package enrichment
  runs automatically on open. Task #1670 made name suggestions on-click
  only (`EventPackagePage`, the name-suggestion handler, line 179 at
  `8c4b19b5`); running AI on open is a cost decision.
- **What each readiness gate requires.** Rule 15 names the gates and
  their questions only.
- **Retiring `/episodes/create` and `/shows/:showId/quick-episode`.**
  Pending the call-path census (`PROJECT_CONTEXT.md` §10 item 23).

These are their own task, not this one.
