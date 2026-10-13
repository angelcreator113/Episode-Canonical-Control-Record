# The Pulse — design spec (October 2026)

Source: Evoni's design conversations (The Pulse mockups on the design canvas; the "automated character voice feed posts" conversation). Build tasks implement this document. Items marked [decide] wait for Evoni.

Updated 2026-10-13 (phase 11, Task #3076) with Evoni's rulings of that day (§14) and with what was built differently from the first text (`docs/reads/2026-10-13-pulse-gap-read.md` §1). Where this document and the code disagree, the gap read and §13–§14 say which one was ruled right.

## 1. What it is
- **The Pulse** is LalaVerse's social network, where Lala and the cast post. Tagline: "Every city has a story." It replaces the page currently called "Feed".
- Two views of the same data:
  - **The Pulse** — what Lala sees. The audience sees exactly this. Nothing behind the curtain appears here.
  - **Social Director** — Evoni's control room at **Admin › The Pulse**. Never visible in The Pulse.
- **Admin** is one page with tabs: **The Pulse**, **Website** (moved out of the sidebar), **Show settings**, **Tools** (Evoni, 2026-10-11).

## 2. Rules that apply everywhere
1. **Canon.** Anything live on The Pulse is canon: posts, comments, numbers, revealed images, profiles.
2. **Story clock.** Every post, comment, number change, reveal and event carries a story-time stamp. The Pulse never shows something before its story time. A comment is stamped with the present when it is written, never earlier than its post, and waits until that moment (Evoni, 2026-10-13, Task #3064); a comment with no stamp reads as its post's. A post, fit or trend with no known story time reads as "always". The stories row lists recent posters by real time.
3. **One owner.** Character photos live on the character record; city images and colours on the city in World; venue images on scene sets; Lala's episode fits on the episode's Style Page. Pulse Settings edits those records; it keeps no copies.
4. **Two faces for every image spot.** Director view shows an empty spot as a dashed "+ Add" in place. The Pulse omits empty spots entirely (text post, city name in its colours); nothing looks broken.
5. **No fourth wall.** Nothing about the show, episodes or Prime Studios appears in The Pulse.
6. **Readability.** Posts sit on solid cards. Glass and holographic effects only on frames, navigation and decoration. WCAG AA contrast.
7. **Real vs in-world.** In-world numbers (followers, likes) are story. Real audience numbers (views, clicks, affiliate sales) never mix with them. Their separate dashboard is **later** (Evoni, 2026-10-13, Task #3073): it waits for a real analytics source.

## 3. The Pulse (Lala's view)
- **Header:** cover image (uploaded), "The Pulse — Every city has a story.", search, Lala's avatar and follower count. The count is her canon count at the story moment, with its audience tier ("12,400 followers · Micro tier"); until her starting count is accepted it shows the profile's estimate, marked as one (Evoni, 2026-10-13, Task #3062).
- **Left:** Feed, Dream Cities, Events, Characters, Messages; a **"Check out the latest fit"** card showing Lala's most recent fit. Stories and Explore (Trending, Fashion, Beauty, Music, Lifestyle, Creator Hub) are **later**; their placeholders were removed (Evoni, 2026-10-13, Task #3073).
- **Centre:** stories row (people, then the five Dream Cities in their colours); composer "What's happening in LaLaVerse?" (text; Photo and Location are not yet available); feed of post cards (avatar, name, time, city, text, tags, photos, likes/comments/shares, comment preview).
- **Right:** Explore the Dream Cities (the five cities with colours and subtitles; the **map is later**: it waits for a map image, Evoni, 2026-10-13); Trending in the Verse (counted from approved, live, tagged posts shown at the moment, never a teaser's hidden words or tags); Upcoming Events (from real events, with date and venue).
- **City colours:** Dazzle District (pearl, rose gold, fashion pink); Radiance Row (lavender, aqua); Echo Park (violet, electric blue); Ascent Tower (silver, ice blue); Maverick Harbor (sea glass, champagne, coastal teal). Stored per city; editable.
- **Latest fit:** from the episode Style Page's front or hero photo once that episode has happened in story time; everyday fits uploaded in Pulse Settings.
- **Mobile:** one feed column; stories across the top; compact city selector; bottom navigation Home, Explore, Create, Inbox, Profile. Explore opens Events.
- **City feeds:** each Dream City has its own feed and local trends.
- **Messages:** Lala's DMs are canon conversations, drafted in voice and approved like posts; they can appear on Lala's Phone.
- **Phone sync:** when Lala opens The Pulse on her Phone in an episode, it shows The Pulse as of that episode's During moment (same posts, numbers, reveals). Each beat's own moment is **later**: beats have no story time of their own yet.

## 4. Social Director (Admin › The Pulse)
Sub-tabs:
- **Review** — everything waiting for Evoni: Lala's posts, posts about Lala, anything that reveals story, flagged drafts, proposed numbers, episode follower changes.
- **Uploads (Pulse Settings)** — Cover (with alt text); Dream Cities (image, story-bubble image, colours; saved to the city); Characters (profile photo and cover; saved to the character); Lala's everyday fits.
- **Growth** — Lala's follower line across episodes (approved numbers solid, projection dashed), best and worst posts, biggest jumps and their causes, and her **Influence**, read only: the `character_state` stat that episodes move, with each episode's change. The Pulse never moves Influence (Evoni, 2026-10-13, Task #3066).
- **Voices** — each character's Voice Profile: build, edit, pin examples, approve.
- **Engine** — the daily request lanes, the queue, and episodes whose posts were never queued (queue them from here).
- **Polls** and **Recaps** — the public extras (§11).
- **Storylines** — long-running threads the system plants and pays off across posts (planner).
- **Calendar** — every post, reveal and event on one story-time calendar.
- **Story clock scrubber** — pick any story moment and see The Pulse exactly as it was then.

## 5. Reveals
- Applies to **images, posts, character profiles and events**.
- Each item has a reveal moment on its event's timeline: **Announced → Invitation sent → Lala arrives → During → After the episode**, or a specific story time.
- Before its moment an item is **hidden** or shown as a **teaser**, labelled "first look". A teaser is **cropped by default** to a deliberate detail (fabric, an accessory, part of a venue), fitting SAL's visual style; it is **blurred** when concealing the full reveal matters. Either way it is cut from the existing image, with no new generation (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §4).
- A character's profile stays hidden until the episode where Lala meets them.

## 6. Who knows what
- A character can only post or comment about what they would know at that story time: they were there, they were told, or it was already posted publicly.
- Drafts that break this are flagged to Review, never auto-published.
- What a character knows covers events (who was there, who was told, what was posted). Secrets and other facts are not modelled.

## 7. Posting engine
- **Voice Profiles** are built automatically from the Deep Profile's public face when a character reaches the **Active** lifecycle stage (Evoni, 2026-10-12 and 2026-10-13; Task #3070): an hourly check queues one build per Active or Alive character with a Feed profile and no voice, through the automated lane. A built voice still waits for Evoni's approval. When the public face changes, the voice is marked for a rebuild, which Evoni starts. Living State is kept out of voices by design (below). Voices are built from concrete habits (case, punctuation, emoji, sentence length, topics, phrases they would never use) plus a shared list of banned AI-sounding phrases. **Pinned posts** become voice examples, and so do **Evoni's edits**: an AI draft whose text she changed becomes an example when she approves it (the newest 8 edits are kept, and an edit never pushes out a pinned example).
- **Living State vs public persona.** A character's private feelings shape what they post but are never stated in posts unless they choose to reveal them.
- **Who may post:** revealed characters at **Active** or later, and the worker posts for a character only once Evoni has **approved their voice**. **Alive** characters also take part in ongoing conversations (DMs), relationships and event reactions.
- **Event-triggered posting:** when an episode is completed, the engine decides who would post (attended, closeness to Lala, temperament: oversharer vs lurker) and drafts posts and comment threads. Posting when a **scene** happens is **later** (Evoni, 2026-10-13): it waits for beat-level story time.
- **Ambient posts:** a scheduled worker drafts occasional posts between events from each character's Living State.
- **Relationship-shaped reactions:** who comments on a post comes from their relationship to its **poster** (the kind of relationship in `social_profile_relationships`, moved by the closeness ledger, §9), whether they attended, and their temperament; how they comment comes from each voice (Evoni, 2026-10-13, Task #3072). The episode's posters do not comment on each other's event posts.
- **Slang spreading** through relationships over time is **later** (Evoni, 2026-10-13, Task #3073). Today a voice's own `signature_phrases` habit is the only shared phrasing.
- **Quality gate:** a second check scores each draft for voice match and canon (story clock, reveals, who knows what). Passing everyday posts by other characters auto-publish; anything else goes to Review.
- **Always to Review:** Lala's posts, posts or comments about Lala, anything that reveals story, anything flagged by the gate. The API enforces this, not only the page: such a post sent as live by anyone but an admin is saved as a draft. An admin (Evoni's "Post now" as Lala, her Approve in Review) may put one live (Evoni, 2026-10-13, Task #3047).
- **Cost control:** **20 AI text-generation requests per show per day**, 5 for automated work and 15 for manual work. Those are the defaults; Evoni can change each in Engine, up to 100. A request is one drafting call and may draft a small batch of posts or replies. Every Pulse drafting call counts, including the episode post generator. Regenerations count; the quality check and viewing saved content do not. Image generation has its own budget. Automated work (event posts and their comments, ambient posts, storyline beats, voice builds) runs through a queue. When the automated lane is used up, event posts, comments and voice builds wait for its reset at midnight UTC, a storyline beat waits planned, and an ambient post is skipped (ambient keeps half the lane free for events). Manual work runs when Evoni asks, under the same count; DMs are queued (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §3).

## 8. Numbers
- **Followers are canon** per character, changed only with a recorded cause. Today the causes written are a starting count, an episode result and an override; a post or an event as a cause is not yet written, so characters other than Lala move only by override. Lala's starting count waits for Evoni; other characters' are accepted at once.
- **Each post's likes and shares are proposed when it goes live** from: the poster's followers at that story time, post type (fit post, status, announcement), riding a current trend, the episode result where relevant, and a small random factor fixed at proposal time (stable on refresh).
- **Review:** Lala's numbers always wait for Evoni (Accept, Adjust with a one-line reason, Make it viral, Make it flop). Other characters' everyday numbers auto-accept unless unusual (large spike, about Lala) — then flagged.
- **After acceptance** numbers lock as canon and grow along a curve over two story moments, then settle (story time has no hours). The number shown at any story time is the canon number for that moment.
- **Comments count** equals real drafted comments; "view N more" appears only when those N exist.
- **Trending counts** come from approved, live posts with the tag.
- **Episode follower change:** proposed when an episode is completed, from its result and its posts; approved by Evoni; recorded in her stats and the Decision Log.
- **Audience tier** comes from the follower count: Emerging 0, Nano 1,000, Micro 10,000, Mid-tier 50,000, Macro 250,000, Mega 1,000,000. It is separate from Lala's **Influence** stat: followers measure audience size; Influence measures her ability to affect the world (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §2).
- **The stored tier** (`follower_tier`: micro, mid, macro, mega) stays for character generation, event prestige and follow odds. Its starting counts land in the matching count tier: micro starts at 25,000 (Micro), not 5,000 (Evoni, 2026-10-13, Task #3068). Only starting counts proposed from then on change.

## 9. Relationships respond to the social world
- Repeated interactions (or ignored ones) adjust closeness by small amounts, each change recorded with its cause, proposed and approved like numbers. The changes live in their own ledger (`pulse_closeness`), keyed on the pair of Feed profiles. A pair starts from its kind of relationship and moves only by accepted changes. It covers Alive characters and Lala, so a Feed profile with no registry character never moves.
- **The kind of relationship** The Pulse uses is `social_profile_relationships` (Evoni, 2026-10-13, Task #3072). The Relationship Map page edits its own table (`feed_profile_relationships`), whose types do not steer The Pulse. The map shows each pair's Pulse closeness for the active show, read only.

## 10. Shop the Look and the wardrobe real-world layer
- Wardrobe items carry real_* fields separate from in-world fields. In-world posts never show real brands or prices.
- Shop the Look links appear only in Distribution posts and on the public website, never in The Pulse; affiliate links always carry the required disclosure.

## 11. Public extras
Both shipped text-only, before website storage was set up; images follow once it is (`SITE_PUBLIC_BUCKET`).
- **Audience voting:** a public poll ("which look for <event>?") whose result is offered to Evoni as a choice on the Style Page.
- **Weekly Pulse recap:** a shareable digest of the week's biggest revealed, published moments, as a web page. The **newsletter is dropped** (Evoni, 2026-10-13, Task #3073).

## 12. Build order
1. **Admin shell and rename:** Admin page with tabs; Website moves under it; Feed becomes The Pulse (old /feed links redirect).
2. **Pulse Uploads:** cover, cities (saved to cities), characters (saved to characters), everyday fits.
3. **The Pulse look** reading real data, with the Director-view toggle and two-faced image spots.
4. **Story clock, reveals and the scrubber** (needs the story-time field from the feed wiring work).
5. **Numbers:** proposals, Review, locking and growth curve, episode follower change, Growth tab.
6. **Posting engine:** Voice Profiles, event-triggered drafts, quality gate, ambient worker with daily cap.
7. **World depth:** who knows what, relationship consequences, DMs, Phone sync, city feeds, Storylines, Calendar.
8. **Public extras:** audience voting and weekly recap.
9. **Shop the Look.**
10. **The 2026-10-12 decisions** (§13).
11. **The gap read and the 2026-10-13 decisions** (§14; `docs/reads/2026-10-13-pulse-gap-read.md`).
Each phase is split into issues small enough for one phone-reviewable PR, each starting with a read when it touches data it has not measured.

## 13. Decisions (settled by Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md`)
- **Posting lifecycle stage:** Active posts (after Evoni approves the voice); Alive also converses, relates and reacts to events (§7).
- **Audience tiers:** six tiers by follower count, separate from Influence (§8).
- **Daily generation cap:** 20 text requests per show, 5 automated and 15 manual; images budgeted separately (§7).
- **Teasers:** cropped to a detail by default; blurred when concealment matters (§5).

## 14. Decisions (settled by Evoni, 2026-10-13; `docs/reads/2026-10-13-pulse-gap-read.md` §4)
- **Lala's posts:** the API holds them for Review; an admin may still post as Lala live (§7; Task #3047).
- **Header follower count:** Lala's canon count at the moment, with her tier (§3; Task #3062).
- **Comment story time:** comments carry a story order and wait until their moment (§2; Task #3064).
- **Influence:** shown on Growth, read only; The Pulse does not move it (§4; Task #3066).
- **The stored tiers:** kept; only `TIER_MIDDLE` fixed so each starting count lands in its count tier (§8; Task #3068).
- **Voices:** built automatically at Active, still approved by Evoni; her edits become examples (§7; Task #3070).
- **Relationships:** `social_profile_relationships` is canon for the kind of relationship; commenters follow their relationship to the poster; the Relationship Map shows closeness read only (§7, §9; Task #3072).
- **Kept for later:** slang spreading, scene triggers, the Dream Cities map, Stories and Explore, a real-audience dashboard. **Dropped:** the newsletter. The Stories and Explore placeholders were removed (§2, §3, §7, §11; Task #3073).
