Style Templates — design spec (October 2026)
Source: Evoni's design conversations and her Canva deck "LaLa Canva Style Sheets" (five portrait templates). Companions: docs/design/2026-10-landing-and-stylesheet.md (Style Page), docs/design/2026-10-the-pulse.md, docs/design/2026-10-lalas-phone.md. Items marked [decide] wait for Evoni.
1. What it is

* The unused Templates page becomes Style Templates: several designs of the same episode style information.
* The episode's Style Page stays the place data is entered. Style Templates only read that data and present it.
* Pick one or several templates per episode; each renders already filled.

2. Rules

1. Masters, never copies. The five templates are masters. An episode is data poured into them. Improving a master improves every episode's sheet.
2. Never an empty spot in an export. "ADD PHOTO" appears only in the editor. Exports fill, substitute, or close up (section 4).
3. One owner. Photos, pieces, event details, palettes and results are read from their owners; templates store none of their own copies.
4. Reveals apply. A template that shows anything after the event (result, style rating) is locked until the episode is published.
5. Readable. Text colour is chosen automatically to pass WCAG AA on its background.
6. Two layers. The in-world version uses LalaVerse names and coin prices. The Shop the Look version adds real brands and links and always carries the affiliate disclosure. Same layout.

3. The five masters (portrait; header "STYLING ADVENTURES with LaLa", episode line, footer "LaLaVerse • FASHION / ATTENTION / MONEY", page number)

1. The Episode Look — Hero (Lala); Venue; Fashion inspiration; The look • three angles (Front, Side, Back); Wardrobe breakdown, 7 piece slots (Outfit, Shoes, Purse, Jewelry, Hair, Perfume, Nails).
2. The Style Diary — subtitle "A little fashion. A lot of story."; Main outfit (Front); Detail shot; Venue mood; The details, 4 piece slots (Shoes, Bag, Jewelry, Beauty); Style notes / caption.
3. Runway to Reality — line "LOOK · CITY · OCCASION"; Full-body hero; Outfit detail; Back view; The finishing touches, 4 piece slots (Shoes, Purse, Accessories, Hair).
4. The Color Story — line "MOOD • TEXTURE • SILHOUETTE"; Main look; Venue / setting; Inspiration; Palette (6 swatches); Beauty + accessories, 5 slots (Hair, Makeup, Nails, Jewelry, Bag); Episode mood text.
5. Invited to Slay — banner "Event name / Host / Dream City" with Date, Dress code, Vibe; Lala final look; Event venue; Fashion reference; Look checklist, 7 piece slots (Outfit, Shoes, Bag, Jewelry, Hair, Perfume, Nails); Caption / style rating / story note.

4. Slot model and filling

* Photo slots have a role (hero, main look, detail, venue, inspiration) and a preferred angle (front, side, back) with fallback angles.
* Piece slots have a preferred category and can be filled by any piece.
* Text slots bind to a data field (section 6).
* Fill order:
   1. Each piece slot takes its preferred category if present.
   2. Unplaced pieces fill remaining empty piece slots; the slot's label becomes that piece's own category.
   3. If pieces run out, the row closes up and recentres (seven slots become six, and so on).
   4. If there are more pieces than slots, the most important win: Outfit, then Shoes, then pieces most featured in the episode. The rest go to an "And more" strip in templates that have room [decide which templates].
* Photo fallback: if a slot's preferred angle is missing, use the next-best angle; if no photo exists at all, the layout closes up rather than leaving a hole.

5. Uploads (on the Style Page)

* Buckets: Front · Back · Side and Hero, plus Detail, Venue and Inspiration. Drop a batch, then tap each photo into a bucket.
* Focal point: tap Lala's face once per photo; every template crops around it.
* Venue images come from the event's scene set, chosen on the Style Page.

6. Text that fills itself
Episode number; event name; host; venue; Dream City; date; dress code; vibe (from the Event Package); look and occasion; caption (from the tagline); episode mood (editable); style rating (from the episode result, after publication); piece names (in-world names; real names only in the Shop the Look version).
7. Palettes

* Event palette lives on the event (one owner), with roles: Background, Surface, Accent, Text (Text chosen automatically for contrast).
   * Proposed automatically from the invitation's design, the venue's décor and colours, the dress code and vibe, and the Dream City's colours; Evoni Accepts or adjusts; approved palette is canon.
   * Used by everything about the event: invitation, brand agreement, style templates, overlays, The Pulse's event card.
   * Fallbacks: approved event palette → venue and city colours → the show's default blush and lavender.
* Look palette comes from the episode's wardrobe pieces and fills the Color Story swatches and any palette circles.
* Templates are dressed in the event palette (background, frames, labels, titles); the look palette fills swatches only.

8. Reveals

* Invited to Slay is a before-the-event teaser: invitation details, venue, dress code, no result.
* Templates showing a style rating or result are locked until the episode is published.

9. Exports

* Each template exports in the Style Page sizes (sheet, Pinterest pin, Instagram story, Instagram post, look-only strip, PDF), drawn on the server.
* Carousel export: several templates of one episode as an Instagram carousel or Pinterest set in one action.
* Exports unlock only when the Style Page is Approved. Send to Distribution works per template.
* In-world and Shop the Look versions export separately; the Shop the Look version always carries the disclosure.

10. Season Style Book
At the end of a season, every episode's chosen sheets compile into one lookbook PDF.
11. Build order

1. Palette read (how invitation colours are chosen today) — issue created with this spec.
2. Slot model: template definitions with slot roles, angles and fallbacks; the fill algorithm with close-up and "And more"; unit tests.
3. Style Templates page: render the five masters from Style Page data; one-tap switching; editor shows "ADD PHOTO", exports never do.
4. Uploads: Front/Back/Side/Hero buckets and focal points on the Style Page.
5. Event palette: stored on the event, proposal and approval, fallbacks, automatic text contrast; templates and invitation use it.
6. Exports: per-template sizes, carousel, reveal locks.
7. Shop the Look versions and season Style Book. Each phase is split into issues small enough for one phone-reviewable PR.

12. Open decisions [decide]

* Which templates get an "And more" strip.
* The episode's default template(s).
* Whether the Style Book is shared publicly or kept private.
