# Lala's Phone — design spec (October 2026)

Source: Evoni's design conversations. Companion to docs/design/2026-10-the-pulse.md. Style Templates get their own spec later. Items marked [decide] wait for Evoni.

## 1. Rules
1. **One phone for the show.** Screens are masters, not copies per episode. What a screen shows in an episode comes from that episode's data at that beat.
2. **The phone shows the world as of the beat.** Coins, posts, mail, lists, badges and the map reflect that beat's story time.
3. **One owner.** The phone reads data owned elsewhere (The Pulse, Wardrobe, Events, deals, stats); it stores none of its own copies.
4. **No timings.** Phone cues attach to script lines, in order. How long anything stays on screen is decided in the Timeline Editor during editing.
5. **Who speaks.** Lala speaks unprompted in exactly two moments: when a notification arrives, and right after she is equipped with a wardrobe piece. Otherwise Prime prompts her with the Voice icon. Only Prime addresses the audience; Lala never does.
6. **No dead ends.** Every screen except the homepage has the phone's own back button (built into the phone, same place and look on every screen, not a hand-drawn tap zone).

## 2. Home screen
- Eight icons: **The Pulse, Closet, To-do, Location, Bank, Mail, Call, Voice**.
- A **stats panel** widget: coins (from Bank), followers (from The Pulse), reputation and influence (from Lala's stats), all as of the beat.
- **Unread badges** come from data (Mail when an invitation or offer arrives; The Pulse when someone comments). Never typed by hand.
- **Lock screen:** story-clock time, wallpaper, notification previews. Usable as an episode opener.

## 3. Screens and what feeds them
| Icon | Screen | Live content |
|---|---|---|
| The Pulse | The Pulse | Posts, comments, notifications and numbers as of the beat (see the Pulse spec) |
| Closet | Wardrobe | The closet and this episode's look; sections inside it for Shoes, Hair, Accessories, Jewelry, Perfume, Outfits (the former separate screens) |
| To-do | To-do | One screen with modes (section 5) |
| Location | World map | Dream Cities, venues, the day's event, travel from home to venue |
| Bank | Money | Lala's coins, spending, pending and paid deal payouts |
| Mail | Inbox | Event invitations, brand deals and other opportunities, messages |
| Call | Calls | Incoming calls from friends at story moments; canon, drafted in voice and approved like DMs |
| Voice | (no screen) | An action: Prime taps it and Lala speaks the line the beat calls for |

## 4. Modes in the Phone Hub
- **Build:** upload icons and screen artwork (backgrounds). A background may have an empty central panel reserved for live content.
- **Connect:** wire icons to screens (tap zones). Back buttons are automatic and are not wired here.
- **Content:** bind each screen's content panel to a data source. Sources: **The Pulse, Wardrobe, Shopping list, Career list, World map, Bank, Mail (invitations and opportunities), Calls**. The content shown in an episode is that source at that beat.

## 5. To-do modes
- **Getting ready:** the **Shopping list**. It can be opened many times while Lala gets ready; an item is crossed out from the beat where its piece is equipped or bought in Wardrobe. A running "spent so far" total shows what the look is costing.
- **At an event with an accepted deal:** that deal's checklist, labelled with the location ("At STUDIO BY SABLE's Studio"). Items tick off at the beats where they happen.
- **Otherwise:** the **Career list** (goals, brands worked with, milestones).
- For now the audience sees the Career list only at the career moment before travel (section 7).

## 6. Opportunities and brand deals
- Kinds, one system: **event invitations**, **brand deals** (sponsored content, wear a piece, collab), **career opportunities** (styling job, interview, feature).
- A brand deal reuses the Event Package deal model (deal type, deliverables, pay, payout timing, terms) but is offered by a brand, not the event host, and can arrive mid-episode.
- Lifecycle: **Offered → Accepted or Declined → Active (checklist) → Delivered → Paid → Counted in Results**.
- **Offer contents:** brand, what they want, pay in coins, deadline in story time, conditions (exclusivity, must be worn at the event).
- **Consequences:** Bank shows the payout pending, then paid when deliverables are approved; Results: all delivered raises that brand's trust, a missed deliverable lowers it; The Pulse gets the sponsored post with an in-world "#ad"; the Career list records the brand.
- **Brands are characters:** brand accounts have Pulse profiles, voices, posts and comments, like STUDIO BY SABLE.
- **Brand trust is per brand**, and each brand's trust shapes its next offer.
- **Rival brands:** accepting one brand can annoy its rival (unfollow, shade, a pulled offer). Exclusivity clauses are real choices.
- **Where offers come from:** drafted to fit the story and Lala's influence tier and niche, approved by Evoni. Bigger brands appear as she grows.
- **The Pulse ripples:** the brand reposts the sponsored post; friends react in their voices.

## 7. The episode rhythm and skeleton
New episodes can start from a skeleton with these beats already placed in order, phone cues pre-wired:
1. **Previously on…** — a recap built from the last episode's approved canon (key Pulse post, decisions, result). Optional per episode.
2. **Getting ready** — Lala opens the Shopping list several times as items are crossed off. Each time a piece is equipped, the script gets a Lala line slot right after it; a draft line may be suggested from the piece (name, in-world price, fit with the dress code) in her voice, for Evoni to edit. The piece is crossed off the Shopping list from that beat.
3. **The brand deal arrives** — notification; Lala reacts out loud.
4. **The career moment** — the Career list is shown; Lala accepts or declines; her line can reference the real "spent so far".
5. **Prime's outro** — Prime agrees with Lala and speaks to the audience (subscribe, come back next week). Written fresh each episode. An idea library offers suggestions and warns when a line repeats a recent episode; Prime may tease next week from a planted storyline.
6. **Travel** — Prime taps Location; the World map animates from Lala's home to the venue at the story-clock time of day; Lala transitions to the venue. Travel costs follow the Show Settings travel rules (same city: no travel).

## 8. Script language
Fixed screen names and cue verbs so every phone cue maps to a real screen and can be checked:
- Screens: The Pulse, Closet (and its sections), To-do (Shopping list, deal checklist, Career list), World map, Bank, Mail, Calls, Voice.
- Cues: Lala is equipped with <piece> → Lala: <line>; notification arrives; opens <screen>; scrolls The Pulse; reads <item> in Mail; accepts / declines <offer>; ticks off <item>; checks Bank; payout lands; <character> calls; Prime taps Voice → Lala: <line>; Prime taps Location → travel to <venue>.
- The script editor's phone cue picker offers exactly these, and the phone check confirms each path is reachable.

## 9. Career unlocks
As followers and Influence grow, abilities open [decide thresholds after real data]: counter-offers (negotiation), choosing between multiple offers, an agent or manager character who brings bigger deals, exclusive deals.

## 10. Phone states
Story devices available per beat: low battery, Do Not Disturb, cracked screen, new wallpaper as her arc changes.

## 11. Timeline export
A phone moment (for example lock screen → Mail → invitation, or the Location travel) can be exported as an overlay clip for the Timeline Editor. Clip length is adjustable there.

## 12. Screen backgrounds
Background PNGs (for example Shoes, Hair, Location, To-Do, Mail) are uploaded once in Build. Their empty central panel is the content panel bound in Content. Never duplicate a screen per episode.

## 13. In-world documents
- Invitations and brand agreements are official documents designed in the event's (or brand's) colours.
- The **brand agreement** replaces the old "Career plan" sticky note: letterhead with the brand's logo from its profile; title "Creator Partnership Agreement · <event>"; Brand and Creator boxes; numbered clauses filled from the deal (the engagement, deliverables and compensation, access, performance bonus, restrictions, disclosure); signature lines; an OFFER stamp that becomes EXECUTED with Lala's signature when she accepts.
- Lala's personal goals never appear on it; they stay on her Career list.
- The Shopping list stays Lala's own handwritten note.

## 14. Style Templates
The unused Templates page becomes **Style Templates**: several designs of the same episode style information. Specified separately.

## 15. Build order
1. **Home screen and navigation:** the eight icons, automatic back button, stats panel, consolidate old screens into Closet sections.
2. **Content binding:** Content mode with data sources; screens show data as of the beat; badges from data.
3. **To-do modes:** Shopping list crossing from Wardrobe, spent so far, deal checklist, Career list.
4. **Opportunities:** brand deals on the deal model, lifecycle, Mail delivery, Bank payouts, brand characters, per-brand trust.
5. **Episode skeleton and script language:** skeleton beats, cue vocabulary in the picker, phone path check, Prime idea library, Previously on.
6. **Travel and export:** Location transition, travel rules, timeline clip export.
7. **Growth:** career unlocks, rival brands, phone states, lock screen.
Each phase is split into issues small enough for one phone-reviewable PR, each starting with a read when it touches data it has not measured.

## 16. Open decisions [decide]
- Who can call Lala, and when calls are drafted automatically vs written.
- Career unlock thresholds.
- Seed lines for Prime's outro idea library.
- Whether "Previously on" is on by default.
