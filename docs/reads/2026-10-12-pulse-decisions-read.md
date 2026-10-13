# Read: The Pulse's open decisions, settled (phase 10)

- **Basis:** `origin/main` at `033dd3a71de0f6e58788b5ccfbc7bb4938af33a7`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-12
- **Task:** #3028, part 1 of 7 of The Pulse phase 10. The parts are #3028 to #3034.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Updates `docs/design/2026-10-the-pulse.md` §5, §7, §8 and §13 with the rulings.
  - Makes no host, AWS, database or Cognito contact. No row was counted, so every statement about data is about code.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means reasoned from measured code, not observed running.

**Evoni's rulings, 2026-10-12** (this read's subject; the spec's §13 had them as `[decide]`):
1. **Lifecycle.** Active: a character gets a Voice Profile and can post. Alive: they also take part in ongoing conversations, relationships and event reactions. Her approval of the voice comes before automated posting.
2. **Audience tiers.** By follower count: Emerging 0, Nano 1,000, Micro 10,000, Mid-tier 50,000, Macro 250,000, Mega 1,000,000. They are separate from Lala's Influence stat: followers measure audience size, and Influence her ability to affect the world. The Pulse works out the tier from the count, and the stored 4-tier field stays (her choice).
3. **Daily cap.** 20 AI text-generation requests per show: 5 automated and 15 for manual work.
   - A request is one drafting call and can draft a small batch.
   - Regenerations count. The quality check and viewing saved content do not count (her choice).
   - Image generation has its own budget.
4. **Teasers.** Cropped by default to a deliberate detail (fabric, an accessory, part of a venue). Blur is used when concealing the full reveal matters. The teaser is made from the existing image, with no new generation.

---

## 1. Lifecycle: today both stages do everything

- **One list.** `POSTING_STAGES = ['active', 'alive']` (`src/services/pulseVoices.js:28`). `eligible` (`:200-228`) returns characters at those stages, with a Feed profile, that Lala has met by the moment (`:205`). **MEASURED**
- **Who uses it:** ambient posts (`src/services/pulseAmbient.js:73`) and event posts and their comment pool (`src/services/pulseEventPosting.js:102`). Both filter on "has a voice". **MEASURED**
- **Who skips it:**
  - DMs check only that the sender has a voice (`src/services/pulseDms.js:89`).
  - Closeness proposals run for any live post or comment (`src/services/pulseCloseness.js:115`).
  - Storyline posters need only a voice (`src/services/pulseStorylines.js:50`). **MEASURED**
- **No approval.**
  - `pulse_voices.status` is `built | edited` (`src/models/PulseVoice.js:18`).
  - Nothing checks for an approved voice before the worker posts.
  - Admin › The Pulse › Voices has Build, edit and pin, and no Approve (`frontend/src/components/Admin/PulseVoices.jsx`).

  **MEASURED**
- **This changes:** the posting read's "active or alive" (`docs/reads/2026-10-12-pulse-posting-read.md:17`).

**Parts:**
- **#3029:** an Approve voice step. Her edits keep it, and a rebuild clears it. Automated jobs skip unapproved voices.
- **#3030:** Active vs Alive.
  - Active: ambient and planned storyline posting.
  - Alive: event reactions, DMs (Lala exempt), closeness moves and storyline suggestions.

## 2. Audience tiers: nothing computes a tier from a count

- **The stored tier.** `social_profiles.follower_tier` is `ENUM('micro','mid','macro','mega')` (`src/models/SocialProfile.js:36`). About twenty places read it: profile generation, event prestige, follow odds and prompts. **MEASURED** (traced; the list is in #3033's PR).
- **The Pulse.**
  - The only mapping goes from tier to count: `TIER_MIDDLE` seeds a starting count (`src/services/pulseFollowers.js:26`).
  - The Growth tab prints the stored tier label.
  - `src/services/pulseGrowth.js:8` notes that Influence waits.

  **MEASURED**
- **There is no Emerging or Nano tier anywhere.** **MEASURED**
- **This changes:** nothing that was ruled. The numbers read left the cut-offs open until data existed (`docs/reads/2026-10-12-pulse-numbers-read.md:101`). Evoni's ruling sets the tiers and keeps them separate from Influence, so no follower-to-Influence link is built.

**Part #3033:** `tierFor(count)` with the six bounds, shown wherever The Pulse shows a tier, from the count at that moment. The stored field and the scoring maps are untouched.

## 3. Daily cap: today it counts drafts, and only the queue's

- **The cap.**
  - `DEFAULTS = { daily_draft_cap: 30, … }`, `MAX_CAP = 500` (`src/services/pulseQueue.js:30-31`).
  - `draftsToday` sums the draft ids of finished jobs since UTC midnight (`:88-94`).
  - The cap is checked before each job (`:147-157`).
  - The Engine tab edits it (`frontend/src/components/Admin/PulseEngine.jsx:69`).
  - Ambient may use half of it (`src/services/pulseAmbient.js:27-28`).

  **MEASURED**
- **One job, about two calls.** Every queue job (event, ambient, comment, storyline, dm) drafts one item with one Sonnet call, then runs the gate, which is one Haiku call. **MEASURED** (traced: `pulseDrafter`, `pulseGate`, `pulseDms`)
- **Not counted at all.** Inline drafting from routes:
  - building a voice (`src/routes/pulseVoices.js:99`);
  - DM drafting is queued but started by hand (`src/routes/pulseDms.js:76`, `:101`);
  - storyline beat suggestions;
  - draft reactions (`src/routes/feedPostRoutes.js:443`);
  - redraft (`:633`).

  **MEASURED**
- **Images.**
  - The Pulse generates no images; its image service handles uploads.
  - An app-wide image budget exists, `AI_DAILY_IMAGE_BUDGET_USD` (default $10, `src/services/imageCostService.js:16`, `:149`).
  - The overall AI budget sits on top of it (`src/services/aiCostTracker.js:124`).

  The ruling's separate image budget therefore already holds. **MEASURED**
- **This changes:** the posting read's 30 drafts a day (`docs/reads/2026-10-12-pulse-posting-read.md:19`).

**Parts:**
- **#3031:** a request ledger, with two lanes (automated 5, manual 15) editable in Engine. Every drafting call takes one request, and the gate takes none.
- **#3032:** one request drafts a small batch (up to 5): an event's posts, or a post's reactions. Merge after #3031.

## 4. Teasers: today a CSS blur over the real image

- **The mode.** `pulse_reveals.mode` is `hidden | teaser`, default `teaser` (`src/migrations/20261011230000-create-pulse-reveals.js:48`). There is no crop region or style. **MEASURED**
- **The leak.** For a post teaser, `applyPostReveal` sets `photo_teaser` but keeps `image_url` (`src/routes/feedPostRoutes.js:61-75`; hidden nulls it at `:65`). Fits and the cover do the same. **MEASURED**
- **The look.**
  - The blur is `.pl-first-look-media { filter: blur(18px) … }` (`frontend/src/pages/SocialMediaPage.css:145`).
  - The picker offers "First look (blurred)" or "Hidden" (`frontend/src/components/Admin/RevealPicker.jsx:150-151`).

  So the full image reaches the browser. INFERRED: the reveal can be seen in the network tab.
- **This changes:** the story clock read's "a teaser is blurred" (`docs/reads/2026-10-11-pulse-story-clock-read.md:18`).

**Part #3034:**
- `teaser_style` (crop default, or blur) and a crop region.
- The teaser image is cut once from the existing image with sharp. There is no AI call.
- Teaser responses carry only the teaser image.

## 5. The parts

| # | Part | Area |
|---|---|---|
| #3028 | This read, and the spec updated | docs |
| #3029 | Evoni approves a voice before automated posting | backend + frontend |
| #3030 | Active posts; Alive also converses, relates, reacts | backend |
| #3031 | The cap counts requests: 5 automated, 15 manual | backend + frontend |
| #3032 | One request drafts a small batch (merge after #3031) | backend |
| #3033 | Six audience tiers from the count | backend + frontend |
| #3034 | Cropped teasers by default, blur when it matters | backend + frontend |
