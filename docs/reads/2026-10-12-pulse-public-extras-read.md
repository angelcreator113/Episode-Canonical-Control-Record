# Read: The Pulse public extras (phase 8)

- **Basis:** `origin/main` at `46b6ff1e1b979b15fa4ad853df2e8733607b66a2`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-12
- **Task:** #3004, part 1 of 6 of The Pulse spec phase 8 (`docs/design/2026-10-the-pulse.md` §11, §12 step 8 "Public extras"). The parts are #3004 to #3009.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/`, `frontend/src/` and `docs/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means a conclusion drawn from measured code, with the reason given.
- Nothing here was read from a database or a bucket, so whether any object is publicly readable today is not measured.

**Evoni's phase 8 rulings (2026-10-12, this session):**
1. **Build what doesn't need website storage now.** The spec places phase 8 "after website storage is live" (§11), and it isn't: `SITE_PUBLIC_BUCKET` is not set (§1). Voting and the recap read and write the database and show text on the public site; images we host wait for storage.
2. **Votes: one per browser plus a rate limit.** An anonymous cookie id and a hashed IP, one vote per poll each, and a strict per-IP limit. No accounts, no captcha. Results are advisory: Evoni picks on the Style Page.
3. **The recap is a page on the public website,** drafted each week and published only when Evoni approves. No email yet.

---

## §1 The public site today (for #3005, #3006, #3009)

**One public page, one public read.** Logged-out visitors get `PublicLanding` at `/` (`frontend/src/App.jsx:297`), and `/site-preview` shows it too (`:351`). **MEASURED.** It makes one request, `GET /api/v1/public/site-content`, with a plain `fetch` and no credentials (`frontend/src/components/site/siteMedia.js:3-5,15`). **MEASURED.** The route is mounted at `/api/v1/public` (`src/app.js:838-839`). **MEASURED.**

**How that read is built** (`src/routes/publicSite.js`):
- No write verb, no `optionalAuth`, no `req.user` (`:1-8`). **MEASURED.**
- Its own limiter, 60 a minute (`:16-22`), and a `// PUBLIC:` comment (`:24`). **MEASURED.**
- A failed read answers empty slots, never an error page; `Cache-Control: public, max-age=300` with an ETag (`:25-38`). **MEASURED.**

**INFERRED: the public poll and recap routes join this router** (`/api/v1/public/polls`, `/api/v1/public/recaps`), with the same shape: no auth middleware, `// PUBLIC:`, a whitelisted response, their own limiter. The public site is not scoped to a show today: the site-content read takes no show id. So the public poll and recap reads should take none either, and return what Evoni has opened or published.

**Limits already on every request.**
- `apiLimiter`: 500 requests per 15 minutes per IP on `/api` (`src/app.js:256-264`). **MEASURED.**
- `writeLimiter`: 60 writes a minute per IP on every POST, PUT, PATCH and DELETE (`:266-279`). **MEASURED.**
- `trust proxy` is 1 (`:35`), so `req.ip` (what `express-rate-limit` keys on by default) is the client address nginx forwards. **MEASURED** (the setting); **INFERRED** (the key, from the library's default).

**The only public write today** is `POST /world/generate-ecosystem-preview` (`src/routes/worldStudio.js:2587-2588`), behind `optionalAuth({ degradeOnInfraFailure: true })` and the global limiters. **MEASURED.** A vote would be the first public write with no login path at all. **INFERRED.**

**Website storage is not live.** Uploads need `SITE_PUBLIC_BUCKET`; until it is set every upload is refused with 503 `SITE_STORAGE_NOT_CONFIGURED`, with no data-URL fallback (`src/services/websiteSlotService.js:8-10,50`). **MEASURED.** `docs/WEBSITE_GO_LIVE.md` lists the bucket, its policy and the CDN as Evoni's steps still to do (§2–3, `:21-38`). **MEASURED.** The earlier read found no public-only location: public readability, where it exists, is a side effect of bucket policy or one explicit ACL (`docs/reads/2026-10-10-website-content-read.md:52`). **MEASURED.**

**INFERRED: no images on the public poll card or recap until storage is live.** Wardrobe and post images are S3 URLs (`src/models/Wardrobe.js:49-74`) whose public readability is not established. The public payload must not carry production ids either (`docs/reads/2026-10-10-website-content-read.md:116`). So the public card shows text: the question and each option's label.

---

## §2 What a poll is about: an event's look (for #3005, #3007)

**How a look is named today.** There are three shapes. Only one of them is a real, show-scoped list of pieces.
- **The episode's locked outfit:** approved `episode_wardrobe` links, read by `GET /api/v1/wardrobe/outfit/:episode_id` (`src/routes/wardrobe.js:312-330`). **MEASURED.**
- **The event's planned outfit:** `world_events.outfit_pieces`, a JSONB array of wardrobe item ids (`src/models/WorldEvent.js:206-218`). Episodes read it through `used_in_episode_id`, so a look picked once on the event reaches every episode that uses it (`src/migrations/20260804000000-add-outfit-to-world-event.js:3-20`). **MEASURED.**
- **Outfit sets:** `outfit_sets` has an INTEGER id and no show (`src/models/OutfitSet.js:7-34`). But `world_events.outfit_set_id` (`WorldEvent.js:210-213`) and `episode_briefs.outfit_set_id` (`src/models/EpisodeBrief.js:50`) are UUIDs. **MEASURED.** **INFERRED:** an outfit set's id cannot be stored in either UUID column, so outfit sets are not a working way to name a look for an event today.

**INFERRED: a poll option points at a list of wardrobe item ids,** the same shape as `world_events.outfit_pieces` and as `lock-outfit-atomic`'s `wardrobe_ids` (`wardrobe.js:1702`). It stores ids, never copies of the pieces, plus a label Evoni writes ("The pink set"). The ids stay in Admin and never reach the public payload.

**The poll's subject is an event or an episode.** An event's episode is `world_events.used_in_episode_id`, one event per episode (the unique index `world_events_used_in_episode_unique`). **MEASURED** (`src/migrations/20260219000003-world-events.js:155`; the index at `src/migrations/20260805000000-episode-brief-outfit-set-and-event-uniqueness.js:43`). A poll keyed on the event finds its episode through that link, and the Style Page reads polls by the episode or its event. **INFERRED.**

**Important for #3007: the existing lock path spends coins.** `POST /api/v1/wardrobe/lock-outfit-atomic` (`wardrobe.js:1727`) checks every piece's reach and buys every unowned piece for sale from Lala's coin balance, in one transaction. It writes the coin ledger, and replaces the episode's previously locked outfit (`:1704-1726`). **MEASURED.** So "Use this look" through that path is a game action, not just a choice:
- it can spend in-world coins;
- it can be refused for too few coins;
- it replaces the current lock.

**INFERRED: #3007 should not lock on its own.** It shows the audience's pick on the Style Page, then **Use this look** opens Producer Mode's look builder with those pieces chosen (`frontend/src/lib/lookBuilder.js:1-8`, which saves through the same `lock-outfit-atomic`), where Evoni locks as she does today and sees the coin cost first. Evoni decides.

---

## §3 Protecting a vote (for #3005)

**Nothing exists to reuse.** **MEASURED** by search at the basis:
- no cookie parser (`cookie-parser` is not a dependency; `src/app.js` reads no cookie);
- no captcha, no visitor id, no IP hashing.

CORS allows credentials (`src/app.js:196`). **MEASURED.**

**INFERRED: the shape that meets ruling 2 with no new dependency:**
- **The cookie:** the vote route reads `req.headers.cookie` itself. If there's no `pulse_voter` cookie, it sets one: a random id (`crypto.randomUUID()`), `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1/public/polls`, one year. The page's `fetch` is same-origin, so the cookie travels without `credentials: 'include'`.
- **Hashing:**
  - `voter_hash = sha256(salt + ':v:' + cookieId)`;
  - `ip_hash = sha256(salt + ':ip:' + req.ip)`;
  - the salt comes from `POLL_HASH_SALT` (Evoni's server setting). With no salt the vote answers 503 and stores nothing, so an unsalted hash is never written.
  - The raw IP and the raw cookie id are never stored or logged.
- **One vote per poll:** unique indexes on (poll, voter_hash) and (poll, ip_hash). A repeat is a 409.
  - A shared IP (an office, a phone network) gets one vote per poll. That is the cost of ruling 2's "and a hashed IP"; Evoni may relax it to the cookie alone later.
- **Rate limit:** its own limiter on the vote route, 10 a minute per IP, on top of `writeLimiter`.
- **What leaves the server:**
  - the public read returns the open polls' question and option labels, never ids of wardrobe, episodes or events;
  - counts appear only once a poll is closed;
  - the vote answers `{ ok: true }` or a 409.

---

## §4 The recap's selection (for #3008)

**Two clocks.**
- **The real week is `posted_at`,** the moment a post went live. It is set when a post is created live (`src/routes/feedPostRoutes.js:214`) and when the drafter releases one (`src/services/pulseDrafter.js:145`). **MEASURED.** `feed_posts.posted_at` is nullable (`src/models/FeedPost.js:37`). **MEASURED.**
- **Story time is the post's story order** (`storyClock.postOrderSql`, `src/services/storyClock.js:91`). The present is the latest published episode's After (`:63-72`). **MEASURED.**

**INFERRED: "this week's moments" = live posts whose `posted_at` falls in the week,** shown as The Pulse shows them at the present. The recap must never show what The Pulse would not show today.

**What The Pulse shows at a moment** (`GET /feed-posts?at=`, `feedPostRoutes.js:125-180`):
- posts with a story order at or before the moment, or none (`:129-131`);
- minus hidden posts and posts by characters Lala hasn't met (`:139-140`, through `pulseReveals.revealsAt`, `src/services/pulseReveals.js:176-205`);
- with numbers as they stand on the growth curve (`:180`, `pulseNumbers.applyNumbers`).

**MEASURED.** **INFERRED:** #3008 calls the same pieces with `at` = the present: `revealsAt`, then `applyNumbers`, then ranks by likes, so a recap and The Pulse can't disagree.

**Numbers: decided or proposed.** `numbersAt` shows locked final numbers when the row is decided (`DECIDED`: accepted, adjusted, viral, flop, `src/services/pulseNumbers.js:48`) and otherwise the proposal, "never more" (`:239-251`). **MEASURED.** **INFERRED:** the recap ranks by the numbers The Pulse shows. A post whose numbers are still proposed ranks on its proposal. Evoni sees the draft before anything is public, and that is the check.

**Comments** are real counts (`comments_count`), not curve numbers (`pulseNumbers.js:265-269`). **MEASURED.**

**Email:** `nodemailer` sends only to one admin address (`src/services/notifications.js:18-27`). There is no subscriber list and no newsletter. **MEASURED.** That fits ruling 3, which leaves email out.

---

## §5 What waits for website storage

| Feature | Needs storage? | Why |
|---|---|---|
| Poll card with question and labels | No | Text from the database (§1) |
| Option pictures on the public card | Yes | Wardrobe images are not established as public (§1) |
| Style Page offer (#3007) | No | Admin-only, behind `requireAuth` |
| Recap page with posts' text and numbers | No | Text from the database (§4) |
| Recap post images, share image | Yes | Same as option pictures |

**INFERRED.** Once `SITE_PUBLIC_BUCKET` is live, pictures can be added by copying chosen images into the public prefix, as the website slots do. That is a later issue.

---

## §6 The parts

| # | Part | Reads from this doc |
|---|---|---|
| #3005 | Polls: tables, Admin API, protected public vote | §1, §2 (option = wardrobe ids + label), §3 |
| #3006 | Polls in Admin and on the public page | §1 (text only, no ids), §3 (counts after close) |
| #3007 | The audience's pick on the Style Page | §2 (offer only; the lock spends coins, so Use this look opens the look builder) |
| #3008 | The weekly recap, drafted, published on approval | §4 |
| #3009 | Recap review in Admin, the public recap page | §1, §5 |
