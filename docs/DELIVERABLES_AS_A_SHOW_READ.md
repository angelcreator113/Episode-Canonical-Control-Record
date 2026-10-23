# Deliverables as another show: a read, not a ruling

## Status of this document

Read-only research for a decision Evoni has not made yet. She asked (2026-10-23):
"I was also thinking about making the deliverables another show. What do you think?",
and chose "Not sure yet". This rules nothing and changes no code. It builds on
`docs/DELIVERABLES_READ.md`, which covers what deliverables are and what reads them, and does not
restate it.

Code is cited by stable name (file, function, table); line numbers are left out because they drift.

---

## 1. What a deliverable is today

- **A brand-deal promise attached to one event.** Each one is a row in `event_deliverables`
  (`src/models/EventDeliverable.js`), with a format (`deliverable_type`: Pulse video, GRWM, Pulse
  stories ×N, carousel, Go Live, try-on/haul, link in bio, content for the brand), a platform
  (`pulse`, `pulse_private`, `playroom`), a quantity, a free-text due date, who it is owed to
  (host or brand) and a fee.
- **No show of its own.** The table has no `show_id`; it reaches the show only through its event.
- **Where the rows come from:** the deal (`Opportunity.deliverables`) is copied into rows by
  `eventTermsService.insertEventDeliverables`.
- **When they lock:** Start Episode stamps `episode_id` and locks them (the terms lock).
- **Status and pay:** status moves one step at a time (`pending → completed → submitted →
  approved`, `validateDeliverableTransition`), and approval pays the fee
  (`dealPayoutService.bookContentFee`).
- **How content gets linked to them:** a Pulse post (`feed_posts`) is linked to a deliverable by
  hand (`deliverable_posts`, `src/services/deliverableProgress.js`). Linking only counts progress;
  it never moves the status.
- **Same show only:** `deliverableProgress.link` refuses a post from another show ("That post is in
  another show.").
- **They show up as tasks:** in the episode's social tasks, as "brand deliverable" or "host
  requirement" (`withDeliverableTasks`, `src/utils/socialTaskSource.js`).

So nothing makes deliverable content as a unit of its own. It is Pulse posts, often from the
episode, linked afterwards.

## 2. What "another show" would mean

A second `Show` row (for example a short companion show), whose episodes are Lala making the
content she owes: the GRWM, the try-on, the stories. Each episode is tied to one event's
deliverables.

**What it would need:**
1. **A link from a companion episode to the event's deliverables.** For example, an
   `episode_deliverables` table or an `episodes.source_event_id`. Neither exists.
2. **Posts from either show counting toward a deliverable.** Today `deliverableProgress.link`
   blocks a post from the second show.
3. **A per-show feed lens.** `episodeGeneratorService` calls `generateFeedMoments` with
   `showType: 'styling_adventures'` hard-coded, and `CONTENT_LENSES` in `feedMomentsService.js`
   would need an entry for the new show.
4. **An episode length or format.** `episodes` has none, so short-form episodes couldn't be told
   apart from the main show's 14-beat episodes.
5. **Its own episode shape.** The 14-beat script, Start Episode and the evaluation are built for
   Styling Adventures. A deliverables show would need its own short template (`EpisodeTemplate`
   exists for templates, but not for a different beat count).
6. **The money side is already there.** The fee is paid on approval. A companion episode would make
   the content, and the approval would still pay.

**Size:** a new show type. Several PRs and at least two migrations. Worth it only if the companion
episodes would actually be filmed or posted as episodes.

## 3. The smaller options

- **Inside the main episode.** A deliverable becomes a "must cover" item in the script (the same
  list as the relationship goals), so a beat shows Lala filming the GRWM. One small PR; no new show.
- **On Lala's phone only.** The content appears as Pulse posts after the episode (what happens
  today), with the app suggesting the link instead of linking by hand. One small PR.

## 4. Recommendation

Decide after the story-loop work (the "What changed" card and carrying Episode 1 into Episode 2)
is in, because that work adds the "must cover" items and the carried follow-ups that the smaller
options would reuse.

If deliverables keep feeling like their own content, a companion show is a sound idea. It would
build on the money and posting that already exist, and the five items in §2 are the work.
