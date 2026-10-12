# The Pulse — design spec (October 2026)

Source: Evoni's design conversations (The Pulse mockups on the design canvas; the "automated character voice feed posts" conversation). Build tasks implement this document. Items marked [decide] wait for Evoni.

## 1. What it is
- **The Pulse** is LalaVerse's social network, where Lala and the cast post. Tagline: "Every city has a story." It replaces the page currently called "Feed".
- Two views of the same data:
  - **The Pulse** — what Lala sees. The audience sees exactly this. Nothing behind the curtain appears here.
  - **Social Director** — Evoni's control room at **Admin › The Pulse**. Never visible in The Pulse.
- **Admin** is one page with tabs: **The Pulse**, **Website** (moved out of the sidebar), **Show settings**.

## 2. Rules that apply everywhere
1. **Canon.** Anything live on The Pulse is canon: posts, comments, numbers, revealed images, profiles.
2. **Story clock.** Every post, comment, number change, reveal and event carries a story-time stamp. The Pulse never shows something before its story time.
3. **One owner.** Character photos live on the character record; city images and colours on the city in World; venue images on scene sets; Lala's episode fits on the episode's Style Page. Pulse Settings edits those records; it keeps no copies.
4. **Two faces for every image spot.** Director view shows an empty spot as a dashed "+ Add" in place. The Pulse omits empty spots entirely (text post, city name in its colours); nothing looks broken.
5. **No fourth wall.** Nothing about the show, episodes or Prime Studios appears in The Pulse.
6. **Readability.** Posts sit on solid cards. Glass and holographic effects only on frames, navigation and decoration. WCAG AA contrast.
7. **Real vs in-world.** In-world numbers (followers, likes) are story. Real audience numbers (views, clicks, affiliate sales) live in a separate dashboard and never mix.

## 3. The Pulse (Lala's view)
- **Header:** cover image (uploaded), "The Pulse — Every city has a story.", search, Lala's avatar and follower count.
- **Left:** Feed, Dream Cities, Events, Stories, Characters, Messages; Explore (Trending, Fashion, Beauty, Music, Lifestyle, Creator Hub); a **"Check out the latest fit"** card showing Lala's most recent fit.
- **Centre:** stories row (people, then the five Dream Cities in their colours); composer "What's happening in LaLaVerse?"; feed of post cards (avatar, name, time, city, text, tags, photos, likes/comments/shares, comment preview).
- **Right:** Explore the Dream Cities (map + five cities with colours and subtitles); Trending in the Verse (counted from approved, live, tagged posts); Upcoming Events (from real events, with date and venue).
- **City colours:** Dazzle District (pearl, rose gold, fashion pink); Radiance Row (lavender, aqua); Echo Park (violet, electric blue); Ascent Tower (silver, ice blue); Maverick Harbor (sea glass, champagne, coastal teal). Stored per city; editable.
- **Latest fit:** from the episode Style Page's front or hero photo once that episode has happened in story time; everyday fits uploaded in Pulse Settings.
- **Mobile:** one feed column; stories across the top; compact city selector; bottom navigation Home, Explore, Create, Inbox, Profile.
- **City feeds:** each Dream City has its own feed and local trends.
- **Messages:** Lala's DMs are canon conversations, drafted in voice and approved like posts; they can appear on Lala's Phone.
- **Phone sync:** when Lala opens The Pulse on her Phone in an episode, it shows The Pulse as of that beat's story time (same posts, numbers, reveals).

## 4. Social Director (Admin › The Pulse)
Sub-tabs:
- **Review** — everything waiting for Evoni: Lala's posts, posts about Lala, anything that reveals story, flagged drafts, proposed numbers, episode follower changes.
- **Uploads (Pulse Settings)** — Cover (with alt text); Dream Cities (image, story-bubble image, colours; saved to the city); Characters (profile photo and cover; saved to the character); Lala's everyday fits.
- **Growth** — Lala's follower line across episodes (approved numbers solid, projection dashed), best and worst posts, biggest jumps and their causes, Influence.
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

## 7. Posting engine
- **Voice Profiles** generate automatically from the Deep Profile when a character reaches the **Active** lifecycle stage (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §1) and regenerate when the profile or Living State changes significantly. They are built from concrete habits (case, punctuation, emoji, sentence length, topics, phrases they would never use) plus a shared list of banned AI-sounding phrases. Evoni's edits and pinned posts become voice examples.
- **Living State vs public persona.** A character's private feelings shape what they post but are never stated in posts unless they choose to reveal them.
- **Who may post:** revealed characters at **Active** or later, and the worker posts for a character only once Evoni has **approved their voice**. **Alive** characters also take part in ongoing conversations (DMs), relationships and event reactions.
- **Event-triggered posting:** when an event or scene happens, the engine decides who would post (attended, closeness to Lala, temperament: oversharer vs lurker) and drafts posts and comment threads.
- **Ambient posts:** a scheduled worker drafts occasional posts between events from each character's Living State.
- **Relationship-shaped reactions:** who reacts to a post, and how, comes from the Relationship Map and each voice.
- **Slang spreads** through relationships over time.
- **Quality gate:** a second check scores each draft for voice match and canon (story clock, reveals, who knows what). Passing everyday posts by other characters auto-publish; anything else goes to Review.
- **Always to Review:** Lala's posts, posts or comments about Lala, anything that reveals story, anything flagged by the gate.
- **Cost control:** **20 AI text-generation requests per show per day**, 5 for automated work and 15 for manual work. A request is one drafting call and may draft a small batch of posts or replies. Regenerations count; the quality check and viewing saved content do not. Image generation has its own budget. Jobs run through a queue (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §3).

## 8. Numbers
- **Followers are canon** per character, changed only with a recorded cause (episode result, a post, an event, an override).
- **Each post's likes, comments and shares are proposed when it goes live** from: the poster's followers at that story time, post type (fit post, status, announcement), riding a current trend, the episode result where relevant, and a small random factor fixed at proposal time (stable on refresh).
- **Review:** Lala's numbers always wait for Evoni (Accept, Adjust with a one-line reason, Make it viral, Make it flop). Other characters' everyday numbers auto-accept unless unusual (large spike, about Lala) — then flagged.
- **After acceptance** numbers lock as canon and grow along a curve over about two days of story time, then settle. The number shown at any story time is the canon number for that moment.
- **Comments count** equals real drafted comments; "view N more" appears only when those N exist.
- **Trending counts** come from approved, live posts with the tag.
- **Episode follower change:** proposed when an episode is completed, from its result and its posts; approved by Evoni; recorded in her stats and the Decision Log.
- **Audience tier** comes from the follower count: Emerging 0, Nano 1,000, Micro 10,000, Mid-tier 50,000, Macro 250,000, Mega 1,000,000. It is separate from Lala's **Influence** stat: followers measure audience size; Influence measures her ability to affect the world (Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md` §2).

## 9. Relationships respond to the social world
- Repeated interactions (or ignored ones) adjust Relationship Map closeness by small amounts, each change recorded with its cause, proposed and approved like numbers.

## 10. Shop the Look and the wardrobe real-world layer
- Wardrobe items carry real_* fields separate from in-world fields. In-world posts never show real brands or prices.
- Shop the Look links appear only in Distribution posts and on the public website, never in The Pulse; affiliate links always carry the required disclosure.

## 11. Later (public, after website storage is live)
- **Audience voting:** a public poll ("which look for <event>?") whose result is offered to Evoni as a choice on the Style Page.
- **Weekly Pulse recap:** a shareable digest of the week's biggest revealed, published moments for the website or a newsletter.

## 12. Build order
1. **Admin shell and rename:** Admin page with tabs; Website moves under it; Feed becomes The Pulse (old /feed links redirect).
2. **Pulse Uploads:** cover, cities (saved to cities), characters (saved to characters), everyday fits.
3. **The Pulse look** reading real data, with the Director-view toggle and two-faced image spots.
4. **Story clock, reveals and the scrubber** (needs the story-time field from the feed wiring work).
5. **Numbers:** proposals, Review, locking and growth curve, episode follower change, Growth tab.
6. **Posting engine:** Voice Profiles, event-triggered drafts, quality gate, ambient worker with daily cap.
7. **World depth:** who knows what, relationship consequences, DMs, Phone sync, city feeds, Storylines, Calendar.
8. **Public extras:** audience voting and weekly recap.
Each phase is split into issues small enough for one phone-reviewable PR, each starting with a read when it touches data it has not measured.

## 13. Decisions (settled by Evoni, 2026-10-12; `docs/reads/2026-10-12-pulse-decisions-read.md`)
- **Posting lifecycle stage:** Active posts (after Evoni approves the voice); Alive also converses, relates and reacts to events (§7).
- **Audience tiers:** six tiers by follower count, separate from Influence (§8).
- **Daily generation cap:** 20 text requests per show, 5 automated and 15 manual; images budgeted separately (§7).
- **Teasers:** cropped to a detail by default; blurred when concealment matters (§5).
