# Read: current landing page, routes, auth and assets

- **Basis:** origin/main `a1705862e62534cba05126b0edf44d37fd76855d`. All `path:line` citations are at this SHA, read with `git show a1705862:<path>` / `git grep -n <pat> a1705862 -- <paths>`.
- **Date:** 2026-10-10
- **Task:** #2805
- **Spec:** `docs/design/2026-10-landing-and-stylesheet.md` (#2803). **MEASURED:** `git ls-tree a1705862 docs/design` returns nothing; the spec is not on main at the basis SHA, so this read works from the Part 1 summary in the dispatch.
- No host, AWS, database, or Cognito contact.
- Changes no code.

---

## 1. What renders at `/` today

- **MEASURED** `frontend/src/App.jsx:281`: logged-out `/` renders `LandingPage`. It is imported eagerly at `frontend/src/App.jsx:12`, so it ships in the main chunk.
- **MEASURED** `frontend/src/pages/LandingPage.jsx` (194 lines) is one static component. Its only imports are React, `Link`, three lucide icons (`Flower2`, `Moon`, `Sparkles`) and its stylesheet (`:1-4`).
- **MEASURED** It makes no API calls: no `useEffect`, `fetch`, `apiClient` or `axios` anywhere in the file (`:1-194`). The only "API" is a comment at `:94-95`: `Wire to featured clip API when available: GET /api/site/featured-clip`. L5 must **not** follow that comment.
- **MEASURED** Structure:
  - Nav at `:16-29`. The brand reads "PRIME STUDIOS". Anchor links are `#show`, `#world` and `#studio` (`:23-25`), plus a pill `<Link to="/login">Enter</Link>` (`:26`).
  - Hero at `:32-46`: three decorative blobs, the badge "SEASON ONE · NOW IN PRODUCTION" (`:37`), the h1 "A universe, styled to perfection." (`:38`), and CTAs "Meet Lala" and "Watch the world grow" (`:43-44`). There is no image.
  - Flagship section `#show` at `:49-84`: "Styling Adventures with Lala" with three cards.
  - Screening room `#screening` at `:87-106`: a CSS-only poster with a play glyph and a fabricated caption, `APPROVED CUT` + `Episode 12 — "The Gala" · 0:42` (`:102-103`). This presents invented production data as real. L5 replaces it.
  - Stats `#world` at `:109-124`: hard-coded "219 Production milestones", "140+ Canon story systems" and "∞" (`:112-120`).
  - Studio `#studio` at `:127-163`: "Not just a show. A franchise operating system." (`:131`), plus a mock internal panel `.lp-atelier` with rows "Episode 12 — script locked", "Wardrobe — 3 looks staged", "World event — gala scheduled" and "Continuity engine — all green" (`:145-160`). The rows are fake, and the panel sets inline hex dots (`:141-143`).
  - Quote band at `:166-175`.
  - Footer at `:178-190`: "Press" and "Careers" are inert `<span>`s (`:185-186`); the footer CTA is `<Link to="/login">Enter the studio</Link>` (`:187`).
- **MEASURED** `frontend/src/styles/LandingPage.css` is 406 lines.
  - `:9` uses `@import url('https://fonts.googleapis.com/...Cormorant+Garamond...&family=Jost...')`. That is an external font fetch, not an app API call.
  - Tokens are `--lp-*`, scoped to `.lp`, not `:root` (`:11-29`).
  - Body font is `'Jost'` (`:31`); display font is `'Cormorant Garamond', serif` (`:116,173,286,345,372`).
  - `.lp` owns its own scroll (`height:100dvh; overflow-y:auto`, `:37-38`) because `App.css` sets `html, body { overflow:hidden }` (`frontend/src/App.css:6-10`).
  - `.lp *` resets margin and padding (`:43`).
  - The only breakpoint is `@media (max-width:760px)` (`:395-401`), and on phones it simply hides the nav links (`:397`), with no drawer. A reduced-motion block is at `:403-406`.
- **INFERRED** (eager import plus Vite CSS bundling): `LandingPage.css`, including its Google Fonts `@import`, is in the main CSS bundle for every page, logged-in or not.

## 2. Router setup

- **MEASURED** `frontend/src/main.jsx:100-102` renders `<App />` with no providers. `main.jsx:4` imports `./index.css`. Side effects at module load:
  - stale-chunk reload listeners (`:18-33`)
  - pull-to-refresh touch blockers (`:52-98`)
  - in production, `navigator.serviceWorker.register('/sw.js')` (`:106-116`)
- **MEASURED** Provider stack, from `frontend/src/App.jsx:669-685`: `ErrorBoundary > ToastProvider > AuthProvider > BulkSelectionProvider > SearchFiltersProvider > Router > AppContent`.
- **MEASURED** The auth gate is an `if` inside `AppContent`, not a route guard:
  - `AppContent` shows a full-page `LoadingSkeleton` while `loading` (`:261-276`).
  - Then `if (!isAuthenticated)` returns a separate `<Routes>` (`:278-296`).
  - Otherwise it renders the app shell (Sidebar, Header, `<Routes>`) at `:311-562`.
  - `ProtectedRoute` is defined at `:184-192` but used nowhere (`git grep ProtectedRoute` hits only `:184`).
- **MEASURED** `isAuthenticated` means only that a token is present in localStorage, with no server check:
  - `AuthContext.jsx:24-26` initialises it from `!!localStorage.getItem('authToken')`.
  - `AuthContext.jsx:29-49` sets it from `authService.isAuthenticated()`, which is `!!this.getToken()` (`frontend/src/services/authService.js:82-84`).
- **MEASURED** Public (no login) routes, which is the complete list:
  - `/` → `LandingPage` (`App.jsx:281`)
  - `/login` → `Login` (`:282`)
  - `/__dev-token-carrier`, DEV builds only (`:283-292`)
  - `*` → `<Navigate to="/">` (`:293`)
- **MEASURED** Second guard: an effect sends any logged-out, tokenless visitor whose path is not in `PRE_AUTH_PATHS = ['/login','/', …dev]` to `/` (`:32`, `:249-257`). Hash anchors (`/#show`) keep pathname `/`, so they are unaffected.
- **MEASURED** A logged-in user who hits `/` gets `Home`, inside the app shell (`App.jsx:330`). They never see the landing page. The authenticated `/login` route is `<Navigate to="/">` (`:557`), and the authenticated catch-all is `<Navigate to="/">` (`:560`).
- **MEASURED** "Enter Studio" should link to `/login`, which existing CTAs already use (`LandingPage.jsx:26,187`).
  - After login, `Login.handleLogin` calls `useAuth().login` and does not navigate itself (`frontend/src/pages/Login.jsx:26-30`).
  - The `AppContent` effect then sees `isAuthenticated && pathname==='/login'` and runs `navigate('/', {replace:true})` (`App.jsx:238-245`), which lands on `Home`.
  - Login's brand and "Back to the story" links go to `/` (`Login.jsx:59-63`).

## 3. Where static images can live

- **MEASURED** `frontend/public` holds only `favicon.svg` (257 B) and `sw.js` (5341 B). `frontend/src/assets` does not exist at the basis SHA.
- **MEASURED** Image files in the whole repo are limited to `test-assets/*.png` and `test-images/*.png` (the largest is 31 KB). There is no LalaVerse map image and no scene-set image.
- **MEASURED** In the app, the map comes from the API: `getWorldMapApi` → `GET /api/v1/world/map` (`frontend/src/components/Episodes/EpisodeScriptTab.jsx:22-23,618`). The size of the map image therefore **cannot be measured from the repo**. Evoni must export it, and it must be committed as a file. The landing page must not reuse this fetch.
- **MEASURED** Vite config (`frontend/vite.config.js:1-70`):
  - no `publicDir` or `assetsInlineLimit` override, so Vite defaults apply
  - no PWA plugin
  - `manualChunks` covers vendor libraries only (`:52-63`)
- **INFERRED** (Vite defaults): two ways to bundle an image.
  - `frontend/src/assets/landing/*.webp` imported from JSX (`import mapUrl from '../assets/landing/lalaverse-map.webp'`) is content-hashed into `dist/assets/`. Files under 4 KB are inlined as base64.
  - `frontend/public/landing/*` is copied verbatim to `dist/landing/*`, with no hash.
  - Both are same-origin static files, not API calls. `src/assets` is preferred: imports are checked at build time and the hash busts caches.
- **MEASURED** Express serves `dist/assets` at `/assets` with `Cache-Control: no-cache, no-store, must-revalidate` (`src/app.js:1721-1752`, header at `:1748`). It serves other `dist` files the same way (`:1755-1773`). The SPA catch-all skips `/api/`, `/assets/` and any path with an extension (`:1777-1802`).
  - **INFERRED:** the explicit MIME branch has no `.webp` or `.avif` case (`:1731-1746`), so serve-static's own MIME lookup decides those types.
  - **INFERRED:** with `no-store`, every visit re-downloads the hero image, unless nginx (not in the repo) overrides the header. This is a performance concern for L6.
- **MEASURED** The service worker `frontend/public/sw.js` (`CACHE_NAME='lalaverse-v5'`, `:11`):
  - `/assets/*` is cache-first (`:87-110`), so a hashed landing image is cached after the first visit.
  - Other same-origin GETs, such as `/landing/*` from `public/`, are network-first and cached (`:113-127`).
  - Navigations are network-first (`:41-58`).
  - It is registered only in production (`main.jsx:111-114`) and unregistered in dev (`:107-110`).

## 4. Global CSS, Tailwind, tokens, fonts

- **MEASURED** `frontend/src/index.css` (113 lines):
  - `@import "tailwindcss"` (`:2`), so Tailwind v4 Preflight applies globally, through PostCSS `@tailwindcss/postcss` (`frontend/postcss.config.js`)
  - then `design-tokens.css`, `shared-components.css` and `responsive.css` (`:5-11`)
  - a global `* {margin:0;padding:0}` (`:40-44`), and `body` font set to `var(--font-sans)` (`:53-55`)
- **MEASURED** `frontend/src/App.css:6-14` sets `html, body {height:100%; overflow:hidden; background:var(--surface-bg)}`. Below 1279px it switches to `overflow-y:auto` (`App.css:368-372`).
- **MEASURED** The `--lala-*` tokens live in `frontend/src/styles/design-tokens.css`, in a `:root` block starting at `:8`:
  - teal and pink aliases (`:39-45`) and lavender (`:52-57`)
  - the "LALA PALETTE" block (`:242-272`): `--lala-parchment #FAF7F0` (`:249`), `--lala-ink #2C2C2C` (`:254`), `--lala-gold #B8962E` (`:258`), radius and control heights (`:268-272`)
  - font tokens: `--font-prose: 'Lora', Georgia…` (`:150`) and `--font-ui: 'DM Mono'…` (`:151`)
  - **None** of the spec colours (ivory, blush, orchid, ice, champagne, plum) or Cormorant or DM Sans tokens exist.
- **MEASURED** `frontend/index.html:11` loads Google Fonts: Lora, Playfair Display, DM Mono, **DM Sans** (300–700, plus italic 400) and Caveat. Cormorant Garamond is not loaded there. It is loaded by CSS `@import`s in `LandingPage.css:9`, `Sidebar.css:12`, `CharacterProfile.css:6`, `CharacterProfilePage.css:7` and `SetupWizard.css:8`. The `<title>` is "Episode Canonical Control - Phase 2" (`index.html:12`).
- **INFERRED** How to add landing-only tokens without touching other pages:
  - Declare the new tokens on a landing root class, the way `LandingPage.css:11-29` already scopes `--lp-*` to `.lp`. For example, `.site { --site-ivory:#FAF6F1; … }` in a new `frontend/src/styles/site-tokens.css` imported only by the landing components.
  - Never add them to `:root` and never edit `design-tokens.css`.
  - Prefix every class (`.site-*`) because all CSS ends up in global scope.
  - To meet L2's "shared tokens" without changing pages, a `:root`-level `--site-*` set is also safe: these are new names that no page reads. Only the use sites must be scoped.

## 5. Existing routes named /lalaverse, /shows, /productions, /collaborate, /about

- **MEASURED** Frontend: `git grep 'path="/(lalaverse|productions?|collaborat|about|our-world)'` finds **no** route. There are also no `to=`, `href` or `navigate` targets for those paths.
- **MEASURED** `/shows` is the private Producer app, defined only in the authenticated block (`App.jsx:362-370`):
  - `/shows` → `ShowManagement` (`:362`)
  - `/shows/:id` → `ShowDetail` (`:364`)
  - `/shows/:id/world` → `WorldAdmin`, which is Producer Mode (`:366`)
  - `/episodes` redirects to `/shows` (`:350`)
- **MEASURED** `/world` is authenticated only and redirects to `/universe?tab=state` (`App.jsx:554`). The world redirect maps are at `:453` and `:473` (`frontend/src/utils/worldRedirects.js`).
- **MEASURED** Backend: none of `/lalaverse`, `/productions`, `/collaborate` or `/about` is mounted. Related mounts: `app.use('/api/v1/shows', showRoutes)` (`src/app.js:941`, plus `gameShowRoutes` at `:954`) and `/api/v1/site-organizer` (`:697`). There is no `/api/site/*` route behind the `featured-clip` comment.
- **INFERRED** Conflicts:
  - Nav items "Our World", "Productions" and "Collaborate" must be in-page anchors (`#world`, `#productions`, `#collaborate`), not paths.
  - A path such as `/productions` would hit the logged-out catch-all and bounce to `/` (`App.jsx:293`).
  - A logged-in user would bounce to `Home` (`:560`).
  - Any `/shows/...` link would expose the private Producer route.
  - No public `/lalaverse` route should be added, as the dispatch requires.

## 6. Proposed file-by-file plan

**L2 tokens**
- Create `frontend/src/styles/site-tokens.css` with `--site-ivory #FAF6F1`, `--site-blush #E9C4D5`, `--site-orchid #AD79B6`, `--site-ice #B7DFEA`, `--site-champagne #D6B77C` and `--site-plum #30253D`.
- Add font tokens: `--site-font-display: 'Cormorant Garamond', 'Lora', Georgia, serif` and `--site-font-body: 'DM Sans', system-ui, sans-serif`.
- Scope the tokens to `.site`, or use new `:root` names, per §4.
- DM Sans is already loaded (`index.html:11`). Load Cormorant through an `@import` in `site-tokens.css` only, with the same URL shape as `LandingPage.css:9`.
- Do not edit `design-tokens.css`, `index.css` or `index.html`.

**L3 layout and hero**
- Create `frontend/src/components/site/PublicSiteLayout.jsx`, `LandingHero.jsx` and `frontend/src/styles/PublicSite.css`.
- Nav: anchors for Our World, Productions and Collaborate, plus an outlined `<Link to="/login">Enter Studio</Link>`.
- Phone drawer: a `useState` toggle and a `<button aria-expanded aria-controls>`, with Escape and link-click to close.
- Route: replace the element at `App.jsx:281` (the logged-out `/`) with the new landing. Keep it eagerly imported, or lazy with `Suspense`. Do not touch the authenticated `/` at `:330`, `PRE_AUTH_PATHS` (`:32`) or `AuthContext`.
- Map: `frontend/src/assets/landing/lalaverse-map.webp`, imported (§3), around 1600px wide with a smaller `srcset` variant, and with `width`/`height` attributes to avoid layout shift.
- Keep the `.lp` scroll-ownership rule (`height:100dvh; overflow-y:auto`), because `App.css:6-10` locks body scroll.
- Retire `LandingPage.jsx` and `LandingPage.css` once the new page is wired in (their fake data is §1).

**L4 sections**
- Create `FlagshipShowSection.jsx`, `WorldPillars.jsx`, `StudioOverview.jsx`, `CollaborationSection.jsx` and `FinalCallToAction.jsx` under `components/site/`, plus `frontend/src/components/site/siteContent.js` (static copy).
- Use a `mailto:` contact.
- Put scene-set images in `frontend/src/assets/landing/scenes/*.webp`, exported by Evoni, as none are in the repo (§3).
- StudioOverview must not reproduce the `.lp-atelier` mock rows or the made-up stats.

**L5 screening**
- Create `FeaturedScreening.jsx` and `frontend/src/components/site/featuredScreening.config.js`, which exports `{ clip: null }`.
- Render "First look coming soon" when `clip` is null.
- Add no fetch, and delete the `/api/site/featured-clip` comment.

**L6 tests and QA**
- Add vitest specs in `frontend/src/components/site/*.test.jsx` (jsdom, globals, from `frontend/vitest.config.js:19-22`; `@testing-library/react` at `package.json:41`). They should cover:
  - each section renders
  - the Enter Studio `href` is `/login`
  - the drawer toggles `aria-expanded`
  - FeaturedScreening shows the fallback
  - a spy on `global.fetch` and `apiClient.get` asserting **zero calls** while the landing renders
  - the absence of the strings "Episode 12", "The Gala" and "franchise operating system"
- Viewports: 320, 375, 430, 768, 1024 and 1440 (375px is the house check). Confirm no horizontal scroll, visible focus rings, reduced-motion handling, contrast (ink on ivory), image weight, and `npx vite build` chunk output.

## 7. Risks: API or auth touch for logged-out visitors

- **MEASURED** `AuthProvider` makes no network call on mount. It reads only localStorage (`AuthContext.jsx:29-49`, via `authService.js:82-84`).
- **MEASURED** `ToastProvider`, `BulkSelectionProvider`, `SearchFiltersProvider` and `ErrorBoundary` contain no `fetch`, `api` or `axios` references.
- **MEASURED** `frontend/src/services/api.js` is imported at module load by `App.jsx:4`. It only creates the axios instance and interceptors (`:4-20`, `:86`) and sends nothing on its own.
- **MEASURED** Its 401 path, `wipeSessionAndRedirect`, sets `window.location.href='/login'` in production (`api.js:66-73`). It fires only after a request.
- **MEASURED** The Socket.io client exists only in `frontend/src/services/exportService.js` (`getSocket`, `:16-20`). It is created lazily and used only by `ExportPage`.
- **MEASURED** No analytics (`gtag`, `posthog`, `sentry`) appears in `frontend/src` or `index.html`.
- **MEASURED** The logged-in shell components (`AppAssistant`, `CommandPalette`, `PullToRefresh`, `OrientationToast`, Sidebar, Header) mount only on the authenticated branch (`App.jsx:311-583`), never on the landing branch.
- **MEASURED** A stale token (localStorage has `authToken`, even an expired one) makes `isAuthenticated` true (`AuthContext.jsx:24-26`). Such a visitor gets `Home` at `/` (`App.jsx:330`), which imports and calls several services (`frontend/src/pages/Home.jsx:5-9`), instead of the landing page. That is existing behaviour; the landing work must not "fix" it by changing auth.
- **MEASURED** `main.jsx:113` registers `/sw.js` in production, and its `/api/` branch caches API responses (`sw.js:62-82`). The landing page sends none, so this is moot unless L5 adds a fetch.
- **MEASURED** Google Fonts are fetched cross-origin from `index.html:11` and the CSS `@import`s (§4). They are not the app API, but they are a third-party request. Self-hosting fonts would be a later choice; flag it for L6.
- **INFERRED** The landing page could start calling the API in these ways:
  - following the `featured-clip` comment (`LandingPage.jsx:94-95`)
  - reusing `getWorldMapApi` (`EpisodeScriptTab.jsx:22-23`) for the map
  - importing any `services/*` module or `useAuth().login`
  - linking to `/shows/*`

  The L6 zero-call vitest spy is the guard against all of these.
