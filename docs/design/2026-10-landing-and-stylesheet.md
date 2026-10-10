# Landing page and style sheet design specs (October 2026)

Source: Evoni's design canvas and the "Prime Studios Public Website Redesign Blueprint". These specs are what the build tasks implement. Anything marked [placeholder] waits for Evoni's content.

## Part 1: Public landing page

### Purpose and rules
- Public, logged-out page that says what Prime Studios makes. Positioning: Prime Studios is the creator, Styling Adventures with Lala is the flagship, LalaVerse is the destination.
- It shows no private production data. Bundled images in the frontend's public assets are its defaults. **Amended 2026-10-10 (was "It is static. It makes no calls to the app's API"):** the page now makes one read, `GET /api/v1/public/site-content`.
  - That route needs no sign-in, takes no writes and is rate-limited.
  - It returns only the Website slots Evoni has published, field by field (`websiteSlotService.publicContent`).
  - The media it names lives in the public site location (`SITE_PUBLIC_*`, served through the CDN once it is set up), never the studio's media service.
  - With nothing published, or if the read fails, the page keeps its bundled defaults.
  - Contract: `docs/reads/2026-10-10-website-content-read.md` §1 and §4. Built in #2833 (endpoint and admin) and #2838 (the page). Go-live steps: `docs/WEBSITE_GO_LIVE.md`.
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
| plum | #30253D | headings, body text, primary buttons |
| lavender | #E4DAF1 | feature sections: hero, Featured Production |
| lavender deep | #CFBFE6 | closing section and footer; the Featured Production frame |
Display font: Cormorant Garamond (fallback Lora, Georgia). Body and buttons: DM Sans (fallback system sans). Primary buttons are plum with ivory text; secondary buttons are ivory with a plum outline.

**Amended 2026-10-10 (lavender), Evoni's request:** the feature sections that were plum with ivory text are soft lavender with plum text. The hero and Featured Production use lavender; the closing section and footer use lavender deep. Plum stays the colour of headings, text and primary buttons. Contrast holds WCAG AA:
- plum on lavender is 10.70:1
- plum on lavender deep is 8.40:1

Shipped in #2826 (`site-tokens.css`: `--site-lavender`, `--site-lavender-deep`, and the `--site-feature-*` roles; the pairs are checked in `siteTokens.test.js`).

### Sections (desktop 1440 canvas, 1200px content width)
1. Sticky nav, 76px: "Prime Studios" wordmark; Our World, Productions, Collaborate; outlined "Enter Studio" button on the right.
2. Hero, about 760px: the LalaVerse map artwork full-bleed, with a lavender wash from the left so the plum text reads (was a plum gradient; amended 2026-10-10). Text is real text, never baked into the image. Eyebrow "AN ORIGINAL ENTERTAINMENT UNIVERSE"; heading "Where Fashion Becomes a World."; the blueprint's hero paragraph; buttons "Explore Our Universe" (ivory) and "Watch Our Vision" (outline). Until a vision video exists, "Watch Our Vision" scrolls to Featured Production.
3. Flagship: two columns; left a 4:5 portrait slot for approved Lala art [placeholder until supplied]; right eyebrow "Our flagship production", heading "Styling Adventures with Lala", italic tagline, the blueprint paragraph, button "Discover the Show".
4. World pillars on white: heading "Fashion is just the beginning."; three cards with a 4:3 image and text: Fashion With Meaning (Lala's closet scene set image), Characters With Lives ([placeholder] approved character art), Places Worth Exploring (Lala's home scene set image).
5. Featured Production on lavender (was plum; amended 2026-10-10): 16:9 frame showing the map dimmed with "First look coming soon" and a line that a 30-second clip or a YouTube video appears there once it is published; heading "Step Inside the Story."; "Watch Featured Video" disabled and labelled soon; "Explore the Production" outline button. Once published, the featured video is EITHER a YouTube link OR an uploaded MP4 clip of 30 seconds max. YouTube uses the privacy-enhanced embed behind a thumbnail-and-play facade that loads nothing from YouTube until tapped; captions come from YouTube. Uploaded clips need a poster and, if anyone speaks, captions; respect reduced motion. The Privacy page must mention the YouTube embed.
6. Inside Prime Studios: eyebrow "Inside Prime Studios"; heading "One World. Many Ways In."; line "We aren't simply producing individual episodes. We're building a world where stories can continue, characters can grow, and audiences can discover something new."; four cards, each a 4:5 image or short clip plus heading and line:
   a. A World of Its Own — "LaLaVerse has five cities, a social network its characters really post on, and people who remember what happened last time. Every episode adds to it." (map art)
   b. The Book Series — "Before Lala tells the story in novels, so you can go deeper than the screen allows." (cover art; spoiler-free)
   c. Made in Our Own Studio — "Written, styled and edited in-house, from the first invitation to the final cut." (behind-the-scenes image or clip, high level, never screenshots of internal tools)
   d. Fashion as Storytelling — "Every look is a choice that changes the story. Each episode gets its own style sheet." (closet image, or an approved style sheet later)
   Button "Discover the Studio". Titles are working titles and may change.
7. Collaborate: heading "There's Room for Your Magic."; three cards (Creative Talent on blush, Brands & Partnerships on champagne tint, Production & Technology on ice) with blueprint copy; button "Explore Collaboration Opportunities".
8. Closing and footer on lavender deep (was plum; amended 2026-10-10): "Let's Create Something Unforgettable.", blueprint paragraph, champagne "Start a Conversation" button; footer line "Prime Studios — The Creative Home of LaLaVerse." with Privacy, Terms, Enter Studio.
All copy is the blueprint's final copy.

### Phone (design separately; check 320, 375, 430)
Menu button instead of nav links; map image above the headline; every section one column; full-width buttons at least 44px tall; hero heading 38–48px; body 15–17px.

### Collaboration contact (first version)
"Start a Conversation" and "Explore Collaboration Opportunities" open an email link to an address Evoni supplies [placeholder]. A real inquiry form (new public endpoint, spam protection, rate limiting) is a later task after a security read, because it is the only public write path.

### Quality bar
WCAG AA contrast, keyboard and focus support, alt text, reduced-motion support, responsive images with set aspect ratios, no layout shift. Test 320, 375, 430, 768, 1024, 1440.

### Open naming question
Lala's in-world social network is also called "lalaverse". Do not create a public /lalaverse route until Evoni decides which meaning it has.

## Part 2: Style Page (was the Lookbook tab), style sheet panel, style sheet template

### Style Page (episode › Production sub-tab, between Wardrobe and Phone)
**Amended 2026-10-10 (Task #2875):** the "Lookbook" tab is now the **Style Page**. Its data and routes stay the Lookbook's; the layout is new. The style sheet itself is the editor.

**The data the page edits (the Lookbook, unchanged).** Evoni's photos are used as they are, and nothing is generated here.
- **To sort tray and categories:** photos dropped on the page land in a "To sort" tray. Each one can be assigned a category: front, side, back, hero, hair, nails, eyes, lips, skin, venue, inspo.
- **Lala in the look:** Front, Side and Back (full body), and Hero.
- **Hair and nails:** each has one photo plus a name (for example "soft glam waves"). The name prints under HAIR or NAILS on the sheet.
- **Beauty:** Eyes, Lips and Skin photos, plus optional makeup notes.
- **Venue:** pre-filled from the episode's event scene set (its look image and angles). Evoni's own venue upload is also allowed.
- **Key inspo:** up to two uploads, plus two textures made automatically from the wardrobe piece images.
- **Where the fields live:** hair, nails and beauty are fields on the episode's look, not closet items.

**STYLE PAGE**
- **Tab:** episode › Production › "Style Page". It replaces "Lookbook" and uses the same data and routes.
- **Layout:** the style sheet at its real layout on the left (scaled to fit), and an editing panel on the right. What you see is what exports.
- **Empty spots:** every empty spot on the sheet is a dashed "+ Add <spot>" button in place: Front, Side, Back, Hero, Hair, Nails, Eyes, Lips, Skin, Inspo, plus the Body wardrobe slot ("Needed"). Tapping one selects it (pink outline) and opens it in the panel.
- **Filled spots:** show the real image. The venue has a "Swap" button that cycles through the event scene set's images. Textures and palette come from the piece images automatically.
- **In-place text:** tap the footer to edit the tagline ("Tap to write a tagline" when empty). Hair and nails names edit in place under their images.
- **Panel:** "Editing <section> · <spot>" with a one-line hint, Upload, and a picker from the To sort tray. Below it, the readiness bar ("Ready x of 11") with a chip per item, ticked when ready.
- **Readiness rule:**
  - look photos, venue, inspo, beauty: at least one image;
  - hair and nails: an image AND a name;
  - wardrobe: every required slot filled (Body included);
  - palette: five colours;
  - tagline: not empty.
- **Header:** "Style Page", a Draft/Approved pill, "Drop photos to sort", "Approve".
- **Share & export** (enabled only when Approved), all drawn on the server, as the title overlay is:
  - Style sheet PNG 1024x1536
  - Pinterest pin 1000x1500
  - Instagram story 1080x1920 (padded)
  - Instagram post 1080x1350 (cropped)
  - "The look only" strip (front, side, back)
  - print PDF
- **Send to Distribution:** adds the approved sheet and every export size to the episode's Distribution queue, with a caption draft.
  - An optional "Include Shop the Look links" adds each piece's real-world link.
  - When any link is an affiliate link, a disclosure line is added at the start of the caption, and it cannot be removed while links are present.
- **Phone:** works at 375px, with the sheet on top and the panel below. Tapping never jumps the page.
- **Real data only (Evoni, 2026-10-10):** every value on the page is the episode's own data: its event package, scene set, saved look, Lookbook photos and tagline. An empty value shows its dashed "+ Add" spot or a quiet placeholder. Mockup sample content is never shown or copied into code.

### Style sheet panel (episode › Production › Wardrobe)
- Title "Style sheet" with status Draft or Approved and a readiness bar (x of 11).
- The four Lala upload slots, shared with the Lookbook (same data).
- "Filled in for you" list, each row showing its source and state: Event details (Event Package), Venue (scene set, choose angle), Wardrobe breakdown (saved look; flags missing required slots such as Body), Hair/nails/beauty (from the Lookbook), Color palette (from piece images, adjustable), Mood words (event keywords), Tagline (editable text; an AI draft is optional and later).
- Buttons: Preview style sheet, Approve. Cost line: $0 when all photos are uploaded.
- Once approved: download as PNG. Using it in Release, Lala's Feed and the website is later wiring.

### Style sheet template (portrait 1024 x 1536)
All text is real text laid over images. The Style Page (above) shows this template as its editor, and every export is drawn from it.
- Top row, three columns: left, the show logo ("Styling" gold serif, "Adventures" pink script, "with", "LALA" serif caps) above THE LOOK (Front, Side, Back photos with labels); centre, the Hero photo in a slightly tilted white frame; right, "EPISODE 0n", the event name, the venue's city chip, a venue image labelled "THE VENUE · <venue name>", and EVENT DETAILS rows: HOST, TYPE, DRESS CODE, WHEN, VIBE.
- WARDROBE BREAKDOWN: seven columns, BODY, SHOES, BAG, JEWELRY, HAIR, PERFUME, NAILS, each with the piece image and its name in small caps. Empty required slots show "Needed".
- Bottom row, three framed panels: COLOR PALETTE (five swatches, the word "Mood" in script, mood words); BEAUTY DETAILS (Eyes, Lips, Skin, Nails); KEY INSPO (two venue angles, two textures).
- Footer strip: the LalaVerse map as a skyline with the tagline in script and "LALAVERSE · FASHION · ATTENTION · MONEY".
- Look: blush-to-lilac-to-ivory background, champagne-gold frame borders and pill labels, plum text.
- Every value comes from canon data (episode, Event Package, scene set, saved look, Lookbook). The sheet never invents an event, host, time, venue or city.

### Episode 1 reference values
Episode 01 · Wearable Experiments Studio Session · STUDIO BY SABLE's Studio, Echo Park · Host STUDIO BY SABLE · Dress code elevated contemporary, smart-casual · Thu, Nov 12, 6:30 PM · Vibe statement, modern, elevated, sophisticated, creative · Saved pieces: Crimson Satin Ballerina Pump (shoes), Crimson Bloom Enamel Stud Earrings (jewelry); Body still needed.
