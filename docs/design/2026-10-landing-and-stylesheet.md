# Landing page and style sheet design specs (October 2026)

Source: Evoni's design canvas and the "Prime Studios Public Website Redesign Blueprint". These specs are what the build tasks implement. Anything marked [placeholder] waits for Evoni's content.

## Part 1: Public landing page

### Purpose and rules
- Public, logged-out page that says what Prime Studios makes. Positioning: Prime Studios is the creator, Styling Adventures with Lala is the flagship, LalaVerse is the destination.
- It is static. It makes no calls to the app's API and shows no private production data. Images are exported files in the frontend's public assets, not fetched from the media service.
- "Enter Studio" goes to the existing login route. Do not change authentication.
- Never present an episode as published unless it is. Episode 1 is a draft, so Featured Production ships in its fallback state.
- Do not reveal author-only canon (for example, who JustAWoman is to Lala).
- Going live is a deploy decision Evoni makes herself. Building and merging does not publish it.

### Design tokens (shared with the rest of the app later)
| Token | Hex | Use |
|---|---|---|
| ivory | #FAF6F1 | page backgrounds |
| blush | #E9C4D5 | cards, soft accents |
| orchid | #AD79B6 | accents and small labels only (white text on it fails WCAG AA) |
| ice | #B7DFEA | cool contrast |
| champagne | #D6B77C | premium details, closing button |
| plum | #30253D | headings, dark sections, primary buttons |
Display font: Cormorant Garamond (fallback Lora, Georgia). Body and buttons: DM Sans (fallback system sans). Primary buttons are plum with ivory text; secondary buttons are ivory with a plum outline.

### Sections (desktop 1440 canvas, 1200px content width)
1. Sticky nav, 76px: "Prime Studios" wordmark; Our World, Productions, Collaborate; outlined "Enter Studio" button on the right.
2. Hero, about 760px: the LalaVerse map artwork full-bleed, with a plum gradient from the left so text reads. Text is real text, never baked into the image. Eyebrow "AN ORIGINAL ENTERTAINMENT UNIVERSE"; heading "Where Fashion Becomes a World."; the blueprint's hero paragraph; buttons "Explore Our Universe" (ivory) and "Watch Our Vision" (outline). Until a vision video exists, "Watch Our Vision" scrolls to Featured Production.
3. Flagship: two columns; left a 4:5 portrait slot for approved Lala art [placeholder until supplied]; right eyebrow "Our flagship production", heading "Styling Adventures with Lala", italic tagline, the blueprint paragraph, button "Discover the Show".
4. World pillars on white: heading "Fashion is just the beginning."; three cards with a 4:3 image and text: Fashion With Meaning (Lala's closet scene set image), Characters With Lives ([placeholder] approved character art), Places Worth Exploring (Lala's home scene set image).
5. Featured Production on plum: 16:9 frame showing the map dimmed with "First look coming soon" and a line that the screening appears once a video is approved and published; heading "Step Inside the Story."; "Watch Featured Video" disabled and labelled soon; "Explore the Production" outline button.
6. Inside Prime Studios: blueprint copy and "Discover the Studio" button beside a collage of scene set images (bedroom, closet).
7. Collaborate: heading "There's Room for Your Magic."; three cards (Creative Talent on blush, Brands & Partnerships on champagne tint, Production & Technology on ice) with blueprint copy; button "Explore Collaboration Opportunities".
8. Closing and footer on plum: "Let's Create Something Unforgettable.", blueprint paragraph, champagne "Start a Conversation" button; footer line "Prime Studios — The Creative Home of LaLaVerse." with Privacy, Terms, Enter Studio.
All copy is the blueprint's final copy.

### Phone (design separately; check 320, 375, 430)
Menu button instead of nav links; map image above the headline; every section one column; full-width buttons at least 44px tall; hero heading 38–48px; body 15–17px.

### Collaboration contact (first version)
"Start a Conversation" and "Explore Collaboration Opportunities" open an email link to an address Evoni supplies [placeholder]. A real inquiry form (new public endpoint, spam protection, rate limiting) is a later task after a security read, because it is the only public write path.

### Quality bar
WCAG AA contrast, keyboard and focus support, alt text, reduced-motion support, responsive images with set aspect ratios, no layout shift. Test 320, 375, 430, 768, 1024, 1440.

### Open naming question
Lala's in-world social network is also called "lalaverse". Do not create a public /lalaverse route until Evoni decides which meaning it has.

## Part 2: Lookbook tab, style sheet panel, style sheet template

### Lookbook tab (episode › Production sub-tab, between Wardrobe and Phone)
Purpose: the place Evoni uploads that episode's images, sorted into the spots the style sheet uses. Her photos are used as-is; nothing is generated here.
- Header: "Lookbook", counters "images in" and "style sheet ready (x of 11)", button "Preview style sheet".
- Batch drop zone: drop many photos; they land in a "To sort" tray; tapping a photo assigns it a category: front, side, back, hero, hair, nails, eyes, lips, skin, venue, inspo.
- Lala in the look: four upload slots, Front, Side, Back (full body) and Hero.
- Hair: one photo plus a name field (e.g. "soft glam waves"); the name prints under HAIR on the sheet.
- Nails: one photo plus a name field; prints under NAILS.
- Beauty details: Eyes, Lips, Skin photos plus optional makeup notes.
- Venue: pre-filled from the episode's event scene set (its look image and angles). Tapping an image toggles "In lookbook". "Upload your own" adds a custom venue image.
- Key inspo: up to two uploads plus two textures made automatically from the wardrobe piece images.
Hair, nails and beauty are fields on the episode's look, not closet items.

### Style sheet panel (episode › Production › Wardrobe)
- Title "Style sheet" with status Draft or Approved and a readiness bar (x of 11).
- The four Lala upload slots, shared with the Lookbook (same data).
- "Filled in for you" list, each row showing its source and state: Event details (Event Package), Venue (scene set, choose angle), Wardrobe breakdown (saved look; flags missing required slots such as Body), Hair/nails/beauty (from the Lookbook), Color palette (from piece images, adjustable), Mood words (event keywords), Tagline (editable text; an AI draft is optional and later).
- Buttons: Preview style sheet, Approve. Cost line: $0 when all photos are uploaded.
- Once approved: download as PNG. Using it in Release, Lala's Feed and the website is later wiring.

### Style sheet template (portrait 1024 x 1536)
All text is real text laid over images.
- Top row, three columns: left, the show logo ("Styling" gold serif, "Adventures" pink script, "with", "LALA" serif caps) above THE LOOK (Front, Side, Back photos with labels); centre, the Hero photo in a slightly tilted white frame; right, "EPISODE 0n", the event name, the venue's city chip, a venue image labelled "THE VENUE · <venue name>", and EVENT DETAILS rows: HOST, TYPE, DRESS CODE, WHEN, VIBE.
- WARDROBE BREAKDOWN: seven columns, BODY, SHOES, BAG, JEWELRY, HAIR, PERFUME, NAILS, each with the piece image and its name in small caps. Empty required slots show "Needed".
- Bottom row, three framed panels: COLOR PALETTE (five swatches, the word "Mood" in script, mood words); BEAUTY DETAILS (Eyes, Lips, Skin, Nails); KEY INSPO (two venue angles, two textures).
- Footer strip: the LalaVerse map as a skyline with the tagline in script and "LALAVERSE · FASHION · ATTENTION · MONEY".
- Look: blush-to-lilac-to-ivory background, champagne-gold frame borders and pill labels, plum text.
- Every value comes from canon data (episode, Event Package, scene set, saved look, Lookbook). The sheet never invents an event, host, time, venue or city.

### Episode 1 reference values
Episode 01 · Wearable Experiments Studio Session · STUDIO BY SABLE's Studio, Echo Park · Host STUDIO BY SABLE · Dress code elevated contemporary, smart-casual · Thu, Nov 12, 6:30 PM · Vibe statement, modern, elevated, sophisticated, creative · Saved pieces: Crimson Satin Ballerina Pump (shoes), Crimson Bloom Enamel Stud Earrings (jewelry); Body still needed.
