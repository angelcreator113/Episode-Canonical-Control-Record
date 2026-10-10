# Read: security and storage plan for a public Website content endpoint

- **Basis:** `origin/main` at `f9655720cbef90d5d942f4efde9e567df3eccee1` (every `path:line` below is at this SHA)
- **Date:** 2026-10-10
- **Task:** #2820 (W1). Builds on #2821 (W2, the endpoint and admin) and #2822 (W3, wiring the site).
- **Spec:** `docs/design/2026-10-landing-and-stylesheet.md` Part 1 (the public landing page), as amended by #2818.
- No host, AWS, database, or Cognito contact. No code or register change.

Markers: **MEASURED** means a `path:line` read at the basis SHA. **INFERRED** means a conclusion drawn from measured code, with the reason given.

---

## §1 How auth is applied today

**There is no global auth middleware.** The app-wide `optionalAuth` mount was removed by F-AUTH-1 FD-67 Option 1 (ruled 2026-09-02); the comment at `src/app.js:234-237` records the removal, and the old dev bypass is commented out at `src/app.js:239-243`. What runs for every request, in order (`src/app.js:204-284`): CORS (`:204`), helmet with CSP off (`:218-222`), JSON/urlencoded 10 MB (`:224-225`), `attachRBAC` (`:246`), `captureResponseData` (`:249`), the API limiter of 500 requests per 15 minutes per IP on `/api` (`:257-264`), and a write limiter of 60 per minute on POST/PUT/PATCH/DELETE (`:267-280`). `trust proxy` is 1 (`:35`), so the limiters key on `X-Forwarded-For`'s first hop. **MEASURED**

**Auth is per route.** Each router imports `requireAuth`/`optionalAuth`/`authorize` from `src/middleware/auth.js` (exports at `:645`) and attaches them handler by handler. `optionalAuth` (`src/middleware/auth.js:444`) admits a request with no token and verifies one if present. **MEASURED**

**Existing public routes.** The F-AUTH-1 Tier 4 disposition marks a deliberate public read with a `// PUBLIC:` comment and `optionalAuth`. There are 25 such markers in `src/routes/` (`grep -rn "// PUBLIC:" src/routes | wc -l` → 25), for example:
- `src/routes/scripts.js:19-20` — `router.get('/', optionalAuth, …)` (scripts catalog)
- `src/routes/metadata.js:21`, `src/routes/thumbnails.js:19`, `src/routes/assets.js:71` — catalog reads
- `src/routes/worldStudio.js:1092` and 20 more — World cluster reads, "published catalog data with no creator attribution"

Outside `/api`, `/health` is public with a reduced body (`src/app.js:285-296`, Task #1999), `/uploads` is served statically with a 7-day max-age (`src/app.js:1708`), and the SPA's `/assets` is served with `Cache-Control: no-cache, no-store, must-revalidate` (`src/app.js:1721-1751`). **MEASURED**

**How one unauthenticated, read-only route would be mounted without weakening anything else** (INFERRED from the pattern above):
1. A **new router file** (e.g. `src/routes/publicSite.js`) holding exactly one handler, `router.get('/site-content', siteContentLimiter, handler)`, with a `// PUBLIC:` marker naming the rationale. It needs no `optionalAuth` either, since it reads no identity: nothing in the handler may consult `req.user`.
2. Mounted on its own path, `app.use('/api/v1/public', publicSiteRoutes)`, **not** under an existing router. A shared router risks a later handler inheriting "public" by placement, and the F-AUTH-1 diff-lock tests (`tests/unit/routes/*-tier*`, which regex-assert each router's auth chain) are per file.
3. The writes that manage the slots (W2's admin) live in a separate, ordinary router with `requireAuth + authorize(['ADMIN'])`, so the public file has no write verbs at all.
4. A per-file tier test asserting the file has one GET, no write verb, no `req.user`, and the `// PUBLIC:` marker; plus `scripts/validate-routes.js` registration.

Nothing else changes: no global middleware is added or removed, and no existing route's chain moves.

## §2 How images and video are stored today

**There is no single storage service.** At least five bucket rules exist (MEASURED):

| Writer | Bucket rule | URL returned | `path:line` |
|---|---|---|---|
| `uploadPng` (title overlay, Lookbook photos) | `S3_PRIMARY_BUCKET ‖ AWS_S3_BUCKET`; with neither, returns a `data:` URL stored as the URL | plain `https://<bucket>.s3.<region>.amazonaws.com/<key>`, `CacheControl max-age=31536000` | `src/services/episodeTitleOverlayService.js:376-386` |
| `AssetProcessingService` | `S3_BUCKET` | plain S3 URL | `src/services/AssetProcessingService.js:145-152` |
| `AssetService` | `AWS_S3_BUCKET ‖ S3_ASSET_BUCKET ‖ 'episode-metadata-assets-dev'` | — | `src/services/AssetService.js:37` |
| `ImageProcessingService` | `S3_BUCKET_NAME ‖ 'episode-metadata-storage-dev'` | — | `src/services/ImageProcessingService.js:25` |
| `FileValidationService` (uploads) | `AWS_S3_BUCKET_EPISODES` / `AWS_S3_BUCKET_THUMBNAILS` | — | `src/services/FileValidationService.js:143-147` |

**URLs are plain, not signed, for most writers.** `uploadPng` and `AssetProcessingService` return unsigned object URLs (above), which only load in a browser if the bucket or prefix allows public reads; whether it does is unverifiable here (no AWS contact). **Some paths sign instead**: `S3Service` (`src/services/S3Service.js:70-71`, SDK v2 `getSignedUrl`), `productionPackageService` (`:516-522`), and `s3AIService` (`src/services/s3AIService.js:4`, `:61`, 7-day presigned URLs). One writer sets `ACL: 'public-read'` explicitly (`src/services/financialFrameGeneratorService.js:80`). **MEASURED** INFERRED: the bucket(s) behind the plain URLs must already permit public `GetObject` on at least some prefixes, or those images would not render in the studio today; which prefixes, and whether that is intended, is for Evoni to confirm in the console.

**A CDN exists for thumbnails only, and only if configured.** `Thumbnail.prototype.getCloudfrontUrl` uses `CLOUDFRONT_DOMAIN` when set, else the S3 URL (`src/models/Thumbnail.js:202-207`). **MEASURED** Whether `CLOUDFRONT_DOMAIN` is set in production is unknown here.

**Video.** MP4 is accepted by several multer filters (`src/routes/footage.js:22`, `src/routes/sceneLibrary.js:18`, `src/routes/assets.js:35`; types listed at `src/services/FileValidationService.js:23`) and written by `s3AIService` with `ContentType: 'video/mp4'` (`src/services/s3AIService.js:57`, `:84`). No path enforces a duration cap. **MEASURED**

**No separate public-only location exists.** Nothing names a public bucket or a public prefix as such; public readability today, where it exists, is a side effect of bucket policy or one explicit ACL. **INFERRED** from the table above.

### Evoni-only AWS checklist (do not attempt from a session)

Each step is a console or IaC action only Evoni performs (CLAUDE.md non-negotiables).
1. Create a **dedicated public prefix or bucket** for site media, e.g. `s3://<bucket>/site-public/` (or a new `prime-studios-site-public` bucket). Keep it separate from production media.
2. Attach a **bucket policy granting `s3:GetObject` on `site-public/*` only** — no `ListBucket`, no wildcard over the bucket. Keep Block Public Access on for every other prefix (or bucket).
3. Put **CloudFront** in front of that prefix (Origin Access Control), with a cache policy that respects `Cache-Control` and a response-headers policy adding `X-Content-Type-Options: nosniff`.
4. Give the app's IAM role **`s3:PutObject` and `s3:DeleteObject` on `site-public/*` only**, so the W2 admin can publish but nothing else gains write.
5. Set two server env values (Evoni edits the server `.env`): `SITE_PUBLIC_BUCKET` / `SITE_PUBLIC_PREFIX`, and `SITE_PUBLIC_CDN` (the CloudFront domain).
6. Optional: a CORS rule on the prefix allowing `GET` from the site's origin, only if the site ever reads pixels (canvas). The landing page does not need it to display `<img>`/`<video>`.

## §3 Proposed data shape

One table, `website_slots`, one live row per slot key (proposal; W2 builds it):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | never returned publicly |
| `slot_key` | VARCHAR(40) NOT NULL | CHECK in the fixed list below; partial UNIQUE `(slot_key) WHERE deleted_at IS NULL` |
| `media_type` | VARCHAR(20) NOT NULL | CHECK in `image`, `video_clip`, `youtube`, `style_sheet` |
| `file_key` | TEXT NULL | object key under the public prefix (image or MP4) |
| `youtube_id` | VARCHAR(20) NULL | the 11-character id only, validated `^[A-Za-z0-9_-]{11}$`; never a full URL |
| `style_sheet_episode_id` | UUID NULL | `brand_fashion` only; resolved at publish time to the approved sheet's PNG, copied to the public prefix |
| `poster_key` | TEXT NULL | required for `video_clip`; recommended for `youtube` (a local facade image) |
| `captions_key` | TEXT NULL | WebVTT; required for a clip with speech |
| `alt_text` | VARCHAR(300) NULL | required for images and posters |
| `duration_seconds` | NUMERIC(5,2) NULL | measured server-side at upload; must be ≤ 30 for clips |
| `file_size_bytes` | INTEGER NULL | cap: images 5 MB, clips 25 MB (proposal) |
| `status` | VARCHAR(12) NOT NULL DEFAULT `draft` | CHECK in `draft`, `published` |
| `published_at` | TIMESTAMPTZ NULL | |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | soft delete |

**Fixed slot keys:** `hero`, `flagship_lala`, `pillar_fashion`, `pillar_characters`, `pillar_places`, `featured_video`, `brand_world`, `brand_books`, `brand_studio`, `brand_fashion`, `logo`.

**Per-slot media rules:**
- `featured_video`: **either** `youtube` (`youtube_id`) **or** `video_clip` (MP4 ≤ 30 s, ≤ 25 MB), plus `poster_key` and, for a clip with speech, `captions_key`. A CHECK makes `youtube_id` and `file_key` mutually exclusive.
- `brand_studio`: `image` or `video_clip` (≤ 30 s).
- `brand_fashion`: `image`, or `style_sheet` referencing an episode whose sheet is approved (#2814); the PNG is copied into the public prefix at publish, so the public response never carries the episode id.
- All others: `image` only.

**Never public, by construction:** episode ids (only `brand_fashion` holds one, and it is not returned), character ids or keys, user ids, studio asset ids, draft rows.

## §4 Proposed public endpoint contract

`GET /api/v1/public/site-content` (W2 builds it; W3 consumes it).
- **Method:** GET only; the router has no other verb (§1).
- **Auth:** none; no `optionalAuth`; the handler never reads `req.user`.
- **Rows:** `status = 'published' AND deleted_at IS NULL` only.
- **Fields, whitelisted per slot:** `slot_key`, `media_type`, `url` (CDN URL built from `file_key`), `youtube_id` (only for `youtube`), `poster_url`, `captions_url`, `alt_text`, `duration_seconds`. Nothing else, built field by field, never a spread of the row.
- **Shape:** `{ slots: { hero: {...}, featured_video: {...}, ... }, updated_at }`; a missing key means "use the bundled default".
- **Empty:** `200 { slots: {}, updated_at: null }`. The site keeps its bundled placeholders and the Featured Production fallback (#2810). Never 404, never an error page.
- **Caching:** `Cache-Control: public, max-age=300, stale-while-revalidate=3600` and an `ETag` from `max(updated_at)`; `304` on match. Media URLs themselves are immutable keys (new upload → new key), cached long at the CDN.
- **Rate limit:** its own limiter, e.g. 60 requests per minute per IP, in addition to the global `/api` limiter (`src/app.js:257-264`).
- **Errors:** a database failure returns `200 { slots: {} }` and logs (`console.error`), so a studio outage never breaks the public page.
- **YouTube:** the response carries the id only. The site renders a local poster and loads `youtube-nocookie.com` only on tap (spec section 5); the endpoint never proxies YouTube.

## §5 Risks and where they belong

| Risk | Why it matters | Owner |
|---|---|---|
| A new unauthenticated route | Every Tier 4 addition widens the public surface; the F-AUTH-1 diff-locks and Tier dispositions govern it | **F-AUTH-1** (Tier 4 disposition; needs its own tier test and a ruling that it is in scope) |
| A handler later reading `req.user` or a write verb landing in the public file | Would turn "public read" into an unauthenticated write or an identity leak | **F-AUTH-1** (diff-lock: one GET, no `req.user`, no write verbs) |
| Over-broad bucket policy | `GetObject` on the whole bucket would expose studio media and drafts | **Evoni-only infra** (§2 checklist); no F-code owns S3 policy; record under F-Deploy-1 if a register home is wanted |
| Leaking ids through the payload (episode, character, user, asset) | Ties the public site to private production data | **F-AUTH-1** (whitelist response; Tier 4 "no creator attribution" pattern at `src/routes/worldStudio.js:1092`) |
| Data-URL fallback | `uploadPng` stores base64 when no bucket is set (`src/services/episodeTitleOverlayService.js:378`); a public slot must never be a `data:` URL | W2 build rule: refuse to publish without the public bucket |
| Unbounded clips | No duration cap exists today (§2); a long or huge MP4 costs bandwidth | W2 build rule: measure with ffprobe/sharp at upload, refuse > 30 s or > 25 MB |
| Third-party tracking via YouTube | Loading the player on page view sets cookies | Spec section 5 facade; the Privacy page must mention it |
| Character data | The public slots hold no character records or keys | **F-Sec-3** owns `character_key` drift and `character_state` (`F-Sec-3_Canonical_CharacterKey_Decision_2026-07-02.md`); **not implicated** as long as §3's "never public" list holds. If a slot ever referenced a character, it would become F-Sec-3's |

**Sequencing for Evoni to decide:** W2 needs (a) an F-AUTH-1 ruling that one Tier 4 route is in scope, and (b) the §2 checklist done, before the endpoint can serve real media. Until then W2 can build the admin and the endpoint against `data:`-free drafts, and W3 keeps the site on its bundled defaults.

## §6 Open questions

1. Is there an existing public prefix or CloudFront distribution in production that should be reused instead of a new one? (§2 shows `CLOUDFRONT_DOMAIN` support for thumbnails.)
2. Size caps: 5 MB images and 25 MB clips are proposals.
3. Does `logo` stay an image slot, or is the logo set in type (open from #2803)?
4. Should `brand_fashion`'s style sheet copy update automatically when a new sheet is approved, or only on a manual re-publish? This read proposes manual.
