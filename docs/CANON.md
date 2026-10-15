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
- Show Bible: "Character Bible — Lala Identity" in
  `src/seeders/20260312800000-show-brain-franchise-laws.js` ("Lala does NOT
  know she is in a show").
- The two worlds in data: a character's `world` is `book-1` (JustAWoman's
  world) or `lalaverse`; a feed profile's `feed_layer` is `real_world`
  (JustAWoman's feed, real apps) or `lalaverse` (The Pulse). A new
  character takes its registry's world (`worldForNewCharacter` in
  `src/routes/characterRegistry.js`); only the Book 1 registry is
  JustAWoman's.
