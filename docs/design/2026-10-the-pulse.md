# The Pulse — design spec (October 2026)

Source: Evoni's design conversations (The Pulse mockups on the design canvas; the "automated character voice feed posts" conversation). Build tasks implement this document. Items marked [decide] wait for Evoni.

Updated 2026-10-13 (phase 11, Task #3076) with Evoni's rulings of that day (§14) and with what was built differently from the first text (`docs/reads/2026-10-13-pulse-gap-read.md` §1). Updated again the same day (phase 12, Task #3130) with the phase 12 rulings and builds (§15; `docs/reads/2026-10-13-pulse-phase12-read.md`). Where this document and the code disagree, the reads and §13–§15 say which one was ruled right.

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
- **Centre:** stories row (people, then the five Dream Cities in their colours); composer "What's happening in LaLaVerse?"; feed of post cards (avatar, name, time, place, text, tags, photos, likes/comments/shares, comment preview).
- **Composer:** text, up to **four photos** (one by default) with alt text, which she can reorder and remove, uploaded and never AI-generated; several photos show as a swipeable carousel with a "1 / 3" counter (Task #3089). A **Location**: no location, a Dream City, or a canonical venue, which supplies its city (Task #3090). A tag never says where Lala travelled. Lala's posts still go to Review (§7).
- **Right:** Explore the Dream Cities (the five cities with colours and subtitles; the **map is later**: it waits for a map image, Evoni, 2026-10-13); Trending in the Verse (counted from approved, live, tagged posts shown at the moment, never a teaser's hidden words or tags); Upcoming Events (from real events, with date and venue).
- **City colours:** Dazzle District (pearl, rose gold, fashion pink); Radiance Row (lavender, aqua); Echo Park (violet, electric blue); Ascent Tower (silver, ice blue); Maverick Harbor (sea glass, champagne, coastal teal). Stored per city; editable.
- **Latest fit:** from the episode Style Page's front or hero photo once that episode has happened in story time; everyday fits uploaded in Pulse Settings.
- **Mobile:** one feed column; stories across the top; compact city selector; bottom navigation Home, Explore, Create, Inbox, Profile. Explore opens Events.
- **City feeds:** each Dream City has its own feed and local trends: posts tagged there, and the untagged posts of its profiles. A post tagged elsewhere shows in the tagged city; nothing moves a profile's city. The place label opens that city's feed; there is no venue page (Task #3090).
- **Messages:** Lala's DMs are canon conversations, drafted in voice and approved like posts; they can appear on Lala's Phone.
- **Phone sync:** when Lala opens The Pulse on her Phone in an episode, it shows The Pulse as of that episode's During moment (same posts, numbers, reveals). A Phone beat can be **pinned** to a story moment of its episode (Before to A week after; During by default), and the episode's Phone tab preview draws The Pulse as of that moment; a post linked to a beat must not be later than its pin (Evoni, 2026-10-13, Task #3111). Scene-level story time is still **later**.

## 4. Social Director (Admin › The Pulse)
Sub-tabs:
- **Review** — everything waiting for Evoni: Lala's posts, posts about Lala, anything that reveals story, flagged drafts (including a draft that discloses what a character privately knows, §6), proposed numbers, and follower changes (episode, post and event, each with its source, story time and amount).
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
- What a character knows covers events (who was there, who was told, what was posted). Who was at an event is one rule everywhere: the host (the event's creator or organizer; a brand-organized event has none) and the Event Package's Guests. An invitation alone is not attendance (Evoni, 2026-10-13, Task #3082).
- **What a character privately knows** (the "knows" text of their confirmed Registry relationships, `source_knows`/`target_knows`; never `reader_knows`) is private drafting context, next to their Living State: it shapes what they post and is never stated. The gate flags a draft that quotes any part of it, and the draft waits in Review; Evoni approving it is the deliberate disclosure (Evoni, 2026-10-13, Task #3088). Other secrets are not modelled.

## 7. Posting engine
- **Voice Profiles** are built automatically from the Deep Profile's public face when a character reaches the **Active** lifecycle stage (Evoni, 2026-10-12 and 2026-10-13; Task #3070): an hourly check queues one build per Active or Alive character with a Feed profile and no voice, through the automated lane. A built voice still waits for Evoni's approval. When the public face changes, the voice is marked for a rebuild, which Evoni starts. Living State is kept out of voices by design (below). Voices are built from concrete habits (case, punctuation, emoji, sentence length, topics, phrases they would never use) plus a shared list of banned AI-sounding phrases. **Pinned posts** become voice examples, and so do **Evoni's edits**: an AI draft whose text she changed becomes an example when she approves it (the newest 8 edits are kept, and an edit never pushes out a pinned example).
- **Living State vs public persona.** A character's private feelings shape what they post but are never stated in posts unless they choose to reveal them.
- **Who may post:** revealed characters at **Active** or later, and the worker posts for a character only once Evoni has **approved their voice**. **Alive** characters also take part in ongoing conversations (DMs), relationships and event reactions.
- **Event-triggered posting:** when an episode is completed, the engine decides who would post (attended, by the one attendance rule of §6; closeness to Lala; temperament: oversharer vs lurker) and drafts posts and comment threads. Posting when a **scene** happens is **later** (Evoni, 2026-10-13): it waits for beat-level story time.
- **Ambient posts:** a scheduled worker drafts occasional posts between events from each character's Living State.
- **Relationship-shaped reactions:** who comments on a post comes from their relationship to its **poster** (the kind of relationship in `social_profile_relationships`, moved by the closeness ledger, §9), whether they attended, and their temperament; how they comment comes from each voice (Evoni, 2026-10-13, Task #3072). The episode's posters do not comment on each other's event posts.
- **Slang spreading** through relationships over time is **later** (Evoni, 2026-10-13, Task #3073). Today a voice's own `signature_phrases` habit is the only shared phrasing.
- **Quality gate:** a second check scores each draft for voice match and canon (story clock, reveals, who knows what). Passing everyday posts by other characters auto-publish; anything else goes to Review.
- **Always to Review:** Lala's posts, posts or comments about Lala, anything that reveals story, anything flagged by the gate. **Lala's posts always go to Review, even an admin's** (Evoni, 2026-10-13, Task #3103; this reverses the Task #3047 exception for an admin's "Post now"). The API enforces it: a Lala post, or one about her, is saved as a draft whoever sends it, and only Evoni's Approve in Review puts it live; a reply naming Lala and Lala's money posts are drafts too. Lala's Feed has one action, **Send to Review**.
- **Cost control:** **20 AI text-generation requests per show per day**, 5 for automated work and 15 for manual work. Those are the defaults; Evoni can change each in Engine, up to 100. A request is one drafting call and may draft a small batch of posts or replies. Every Pulse drafting call counts, including the episode post generator. Regenerations count; the quality check and viewing saved content do not. Image generation has its own budget. Automated work (event posts and their comments, ambient posts, storyline beats, voice builds) runs through a queue. When the automated lane is used up, event posts, comments and voice builds wait for its reset at midnight UTC, a storyline beat waits planned, and an ambient post is skipped (ambient keeps half the lane free for events). Manual work runs when Evoni asks, under the same count; DMs are queued (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §3).

## 8. Numbers
- **Followers are canon** per character, changed only with a recorded cause, each applied once. The causes are a starting count, an override, an **episode result**, a **published original post** (2% of its locked likes; a post Evoni makes a flop loses that amount instead; stamped at the post's story time, or at a teaser's reveal), and an **approved event deliverable** (Lala gains 0.5% of her followers per piece, up to 5, at the episode's After). Drafts, teasers, invitations and merely attending change nothing (Evoni, 2026-10-13, Task #3086). Every proposed change waits in Review with its cause and amount; accepting changes followers only, never Influence. Lala's starting count waits for Evoni; other characters' are accepted at once.
- **Each post's likes and shares are proposed when it goes live** from: the poster's followers at that story time, post type (fit post, status, announcement), riding a current trend, the episode result where relevant, and a small random factor fixed at proposal time (stable on refresh).
- **Review:** Lala's numbers always wait for Evoni (Accept, Adjust with a one-line reason, Make it viral, Make it flop). Other characters' everyday numbers auto-accept unless unusual (large spike, about Lala) — then flagged.
- **After acceptance** numbers lock as canon and grow along a curve over two story moments, then settle (story time has no hours). The number shown at any story time is the canon number for that moment.
- **Comments count** equals real drafted comments; "view N more" appears only when those N exist.
- **Trending counts** come from approved, live posts with the tag.
- **Episode follower change:** proposed when an episode is completed, from its result and its posts; approved by Evoni; recorded in her stats and the Decision Log.
- **Audience tier** comes from the follower count: Emerging 0, Nano 1,000, Micro 10,000, Mid-tier 50,000, Macro 250,000, Mega 1,000,000. It is separate from Lala's **Influence** stat: followers measure audience size; Influence measures her ability to affect the world (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §2).
- **The stored tier** (`follower_tier`) is the six count tiers (Evoni, 2026-10-13, Task #3106). Character generation, event prestige and follow odds use them: Emerging prestige 1–2 and Nano 1–3, follow odds copied from each character's Micro, starting counts Emerging 500 and Nano 5,000; the four older tiers keep their values (Micro starts at 25,000). Stored labels were rewritten once from each profile's follower estimate, with no count written; they are not kept in step afterwards. The Registry offers the six plus ghost and unknown, which are never copied to a Feed profile.

## 9. Relationships respond to the social world
- Repeated interactions (or ignored ones) adjust closeness by small amounts, each change recorded with its cause, proposed and approved like numbers. The changes live in their own ledger (`pulse_closeness`), keyed on the pair of Feed profiles. A pair starts from its kind of relationship and moves only by accepted changes. It covers Alive characters and Lala, so a Feed profile with no registry character never moves.
- **The kind of relationship** The Pulse uses is `social_profile_relationships` (Evoni, 2026-10-13, Task #3072), and the **Relationship Map edits it**, so a change on the map changes The Pulse (Evoni, 2026-10-13, "go with (a)", Task #3115). It has 17 kinds: the 15 it had, plus **Orbit** (closeness 0.2) and **Former friends** (0.4) from the map. The map's old table (`feed_profile_relationships`) was copied over once and is no longer written; the map refuses the same kind twice for a pair, and its Auto-Generate is gone. The map shows each pair's Pulse closeness for the active show, read only. Feud, shade and former friends are the conflict kinds the Pressure Wave lists.
- **The Registry's relationships** (`character_relationships`) stay separate: the novel's relationships and what each character privately knows (§6). The Relationship Engine edits them (Task #3119).

## 10. Shop the Look and the wardrobe real-world layer
- Wardrobe items carry real_* fields separate from in-world fields. In-world posts never show real brands or prices.
- Shop the Look links appear only in Distribution posts and on the public website, never in The Pulse; affiliate links always carry the required disclosure.
- **Add piece** has the same Real world section as the piece editor, under More (Task #3083).
- **Order import:** an Amazon order-history CSV, with manual entry kept (Evoni, 2026-10-13, Task #3102). A preview matches each line to a piece (by ASIN, else by name), marks lines already imported, and leaves out cancelled ones; confirming fills only **empty** real-world fields, and a line that matches nothing is **kept for later**. The file is never stored, and no address, payment or email is kept. It never deducts Lala's coins or changes anything in-world. Gmail receipts are deferred.
- **On the public website** a published look shows the **look strip** (the approved style sheet's "The look only" export), drawn when Evoni publishes and copied to the public bucket; publishing again draws it again. Sending a re-approved, changed look drops the old image until she publishes again (Evoni, 2026-10-13, Task #3120).

## 11. Public extras
Public images are copied into the public site bucket (`SITE_PUBLIC_BUCKET`) when Evoni publishes, kept separate from private drafts; without the bucket a page is text only (Evoni, 2026-10-13, Task #3099).
- **Audience voting:** a public poll ("which look for <event>?") whose result is offered to Evoni as a choice on the Style Page. One vote per browser (cookie), or per account when signed in, with a **soft cap of 10** anonymous votes per IP on a poll, so a household or office can vote (Evoni, 2026-10-13, Task #3094). Only salted hashes are stored.
- **Weekly Pulse recap:** a shareable digest of the week's biggest revealed, published moments, as a web page. A teaser post is never in it, so a teaser's words never reach the public site (Task #3080). Each post shows its image as The Pulse shows it now (the photo, or its teaser while it is one; nothing while hidden), copied at publish. The **newsletter is dropped** (Evoni, 2026-10-13, Task #3073).

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
12. **Phase 12:** the phase 12 read and its rulings (§15; `docs/reads/2026-10-13-pulse-phase12-read.md`), and the relationships read (`docs/reads/2026-10-13-pulse-relationships-read.md`).
Each phase is split into issues small enough for one phone-reviewable PR, each starting with a read when it touches data it has not measured.

## 13. Decisions (settled by Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md`)
- **Posting lifecycle stage:** Active posts (after Evoni approves the voice); Alive also converses, relates and reacts to events (§7).
- **Audience tiers:** six tiers by follower count, separate from Influence (§8).
- **Daily generation cap:** 20 text requests per show, 5 automated and 15 manual; images budgeted separately (§7).
- **Teasers:** cropped to a detail by default; blurred when concealment matters (§5).

## 14. Decisions (settled by Evoni, 2026-10-13; `docs/reads/2026-10-13-pulse-gap-read.md` §4)
- **Lala's posts:** the API holds them for Review; an admin may still post as Lala live (§7; Task #3047). *Reversed in phase 12: they always go to Review, even an admin's (§15; Task #3103).*
- **Header follower count:** Lala's canon count at the moment, with her tier (§3; Task #3062).
- **Comment story time:** comments carry a story order and wait until their moment (§2; Task #3064).
- **Influence:** shown on Growth, read only; The Pulse does not move it (§4; Task #3066).
- **The stored tiers:** kept; only `TIER_MIDDLE` fixed so each starting count lands in its count tier (§8; Task #3068). *Superseded in phase 12: the stored tier became the six count tiers (§15; Task #3106).*
- **Voices:** built automatically at Active, still approved by Evoni; her edits become examples (§7; Task #3070).
- **Relationships:** `social_profile_relationships` is canon for the kind of relationship; commenters follow their relationship to the poster; the Relationship Map shows closeness read only (§7, §9; Task #3072). *In phase 12 the map came to edit that table (§15; Task #3115).*
- **Kept for later:** slang spreading, scene triggers, the Dream Cities map, Stories and Explore, a real-audience dashboard. **Dropped:** the newsletter. The Stories and Explore placeholders were removed (§2, §3, §7, §11; Task #3073).

## 15. Decisions (settled by Evoni, 2026-10-13, phase 12; `docs/reads/2026-10-13-pulse-phase12-read.md` §3)
- **Follower causes:** published original posts, approved event deliverables and episode outcomes propose follower changes, each once and each through Review; drafts, teasers, invitations and attending do not (§8; Task #3086).
- **What characters know:** the Registry's private "knows" text is drafting context; a draft that discloses it waits in Review (§6; Task #3088).
- **One attendance rule:** the host and the Event Package's Guests; an invitation is not attendance (§6; Task #3082).
- **Composer:** up to four photos with alt text, a carousel when several (§3; Task #3089); a Location of a Dream City or a venue, shown in that city's feed (§3; Task #3090).
- **Poll votes:** cookie or account, with a soft cap of 10 per IP (§11; Task #3094).
- **`GET /pulse-reveals/state`:** removed; nothing called it (Task #3098).
- **Public images:** the bucket first, then images; recaps copy their posts' images at publish (§11; Task #3099), and published looks show the look strip (§10; Task #3120).
- **Order import:** an Amazon CSV, filling empty fields only and keeping unmatched lines for later; Gmail deferred; never Lala's coins (§10; Task #3102).
- **Lala's posts always go to Review, even an admin's** (§7; Task #3103).
- **The stored tiers:** the six count tiers, one rewrite of the labels, counts unchanged (§8; Task #3106).
- **Relationships:** the Relationship Map edits `social_profile_relationships`, with Orbit and Former friends added as kinds; the map's old table was copied over (§9; Tasks #3110, #3115). The relationships read's defects were fixed separately (Task #3119).
- **Beat pinning:** a Phone beat can be pinned to a story moment, for the Phone tab preview (§3; Task #3111).
