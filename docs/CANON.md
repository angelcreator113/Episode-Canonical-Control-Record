# Canon: who Lala and JustAWoman are

Evoni's ruling, 2026-10-15. This is the one version. When a prompt, seed, or
screen says something else, this wins: change the prompt, not the canon.

## The two worlds

- **JustAWoman lives in her world** (our world, the real one). She is a Black
  woman, mother, wife, and content creator. Her story is *Before Lala*
  (Book 1) and the weekly short stories, written with the Book 1 tools
  (WriteMode, the Story Engine, Stories). Those tools stay.
- **JustAWoman writes Lala's world.** She created Lala and builds the
  LalaVerse. In *Styling Adventures with Lala* she is the player and host,
  outside Lala's scene.
- **Lala lives in the LalaVerse.** Her social app is The Pulse; adult content
  there is on The PlayRoom.

## Who Lala is

- Lala is a **sentient fashion game character and AI character that
  JustAWoman created.**
- **Lala does not know.** She does not know she was built, that she is in a
  show, or that JustAWoman exists. Her world feels complete and real to her.
- So nothing written from inside the LalaVerse (a Pulse post, a LalaVerse
  feed profile, Lala's own lines) names JustAWoman or says Lala was made.
  Author-only views (a character's Blind Spot, the reader of *Before Lala*)
  may know.
- The older "daughter" framing (Lala as JustAWoman's daughter, "she
  inherited her mother's ambition") is retired.

## How Lala became sentient

- JustAWoman poured so much of herself into building Lala that **her
  consciousness transferred** into Lala. Evoni, 2026-10-15: still canon.
  When in the story it happens is not decided yet.
- Lala still does not know. She feels the resonance and cannot name its
  source.

## The books are written from the show

Evoni, 2026-10-15. *Before Lala* is not prewritten; it follows the show.
Each episode is told three ways:

| Layer | Covers |
|---|---|
| The episode | what the viewer sees |
| The short story | the event, in full |
| The book chapter | everything the viewer does not see |

- **Beat 11 (Event Outcome) carries a piece of the short story.** A short,
  animated part of the short story plays there, so the viewer asks "what
  happened at that event?" The full event is the short story.
- **The chapters are JustAWoman's point of view**: everything the viewer
  does not see, from JustAWoman creating Lala's world to well beyond the
  events — the juicy details, all that JustAWoman, in her prime, imagines
  is happening in that world.

## The Book 1 cast (Cast B)

Evoni, 2026-10-15. JustAWoman's world:

- Husband: **David**.
- Sons: **Elias** (9, the quiet witness) and **Zion** (5, the loud anchor).
- **Marcus** is the paying man, never a son.
- The Comparison Creator is **Nia Vale** (the escalation mirror).
- **The Witness** is unnamed.
- The rest of the 24-character ecosystem is `BOOK1_ECOSYSTEM` in
  `src/routes/memories/engine.js`.

Retired: the sons Marcus (7), Miles (5) and Noah (3); Dana as the Witness;
Chloe as the Comparison Creator. Jade, the Almost-Mentor, is deleted
(Evoni, 2026-10-16): she is out of the seed, the relationship map, the
Story Engine's character DNA, the appearance rules and the therapy
profiles.

The `pressure` role is labelled **Pressure**, not Antagonist (2026-10-16):
David is pressure and cannot be villainized. Lala's species is
`sentient AI`, not human.

## The Lala bleed

One intrusive thought, once. Not Lala speaking: Lala's register surfacing
once in JustAWoman's narration.

**The bleed follows the transfer** (Evoni, 2026-10-15): it comes in the
first chapter after the consciousness transfer, not at a fixed chapter
number. Until the transfer is placed, no chapter carries it. (The Story
Engine used to put it in chapter 47 of its 50-chapter plan.)

The transfer episode is set once, per show, in Write Mode's "From the show"
section (`shows.metadata.consciousness_transfer`). The chapter writer
(`bleedStateOf` in `src/routes/bookFromShowRoutes.js`) then puts the bleed in
the book's first chapter whose episode comes after it. The Story Engine's
50-chapter plan is not tied to episodes, so it does not read the setting; it
flags no bleed unless a brief says the transfer happened. The book's plan is
now made from the episodes instead: "Plan the next chapters" on This week's
episode (`/this-week`; `POST /books/:bookId/plan` in
`src/routes/bookFromShowRoutes.js`) plans a chapter for each episode that
still owes one, and marks the bleed on the first chapter after the transfer.

## The show and the Pulse around the book

- Beat 11's piece of the short story shows on that episode's Scene Planner,
  beat 11, marked for animation (`Beat11Piece` in
  `frontend/src/pages/ScenePlannerPage.jsx`).
- A chapter written from its episode is shown what the LalaVerse said on
  The Pulse about it (live posts only), so JustAWoman can react to it.
- An event's host may post about it once it is announced, without Review
  for naming an event that has not happened yet (`hostAnnouncing` in
  `src/services/pulseGate.js`). Everyone else's mention still goes to Review.

## No JustAWoman in the LalaVerse

Lala does not know JustAWoman exists, so JustAWoman has no LalaVerse
profile. The locked @justawoman record is removed (migration
`20261015190000-remove-justawoman-lalaverse-profile`); its seeder no longer
inserts it. Her real-world feed (`feed_layer` `real_world`) stays.

## Where the app encodes it

Cited by name, so a later edit can find them.

- Feed generation for Lala's world: `PROTAGONISTS` (`lala`) in
  `frontend/src/pages/feed/feedConstants.js`; the LalaVerse block of
  `buildGenerationPrompt` callers in `src/routes/socialProfileRoutes.js` and
  `src/routes/socialProfileBulkRoutes.js` ("Lala does not know she was
  built"); `generateAndSaveProfile` in `src/services/feedScheduler.js`.
- Characters: `WORLD_CONFIGS.lalaverse` in `src/routes/worldStudio.js`
  ("a confident AI fashion game character who became sentient"); the Lala
  entry in `src/routes/characterGenerator.js`; `characterGrowthRoute.js`
  ("Lala does NOT know she was built by JustAWoman").
- Consciousness: `src/routes/consciousness.js` (JustAWoman's consciousness
  in Lala; Lala does not know).
- Book 1 cast: `BOOK1_NODES` / `BOOK1_EDGES` (the relationship map's seed)
  and `BOOK1_ECOSYSTEM` in `src/routes/memories/engine.js`;
  `WORLD_CONFIGS.book1` in `src/routes/characterGenerator.js`;
  `WRITE_MODE_CHARACTER_RULES` in `src/routes/memories/stories.js`;
  `frontend/src/data/characterAppearanceRules.js`.
- Show Bible: "Character Bible — Lala Identity" in
  `src/seeders/20260312800000-show-brain-franchise-laws.js` ("Lala does NOT
  know she is in a show").
- The two worlds in data: a character's `world` is `book-1` (JustAWoman's
  world) or `lalaverse`; a feed profile's `feed_layer` is `real_world`
  (JustAWoman's feed, real apps) or `lalaverse` (The Pulse). A new
  character takes its registry's world (`worldForNewCharacter` in
  `src/routes/characterRegistry.js`); only the Book 1 registry is
  JustAWoman's.
