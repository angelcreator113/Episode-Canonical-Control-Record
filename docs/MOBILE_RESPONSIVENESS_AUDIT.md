# Mobile Responsiveness Audit — Writing Pages

**Date:** 2025-01-XX  
**Scope:** ChapterJourney, WriteMode, StoryPlannerConversational, ReadingMode, StorytellerPage, plus global CSS (App.css, index.css, responsive.css, design-tokens.css)

---

## Executive Summary

The writing pages have **generally strong** mobile responsiveness — WriteMode, StoryPlannerConversational, and StorytellerPage all have extensive multi-breakpoint media queries with thoughtful touch handling. However, there are **critical gaps** in ReadingMode (zero responsive handling) and recurring issues with `100vh` vs `100dvh`, sub-44px touch targets at small breakpoints, and a few hardcoded pixel values that can overflow on very small screens.

### Severity Legend
- 🔴 **Critical** — Broken layout or major UX problem on mobile
- 🟡 **Moderate** — Usable but degraded experience
- 🟢 **Minor** — Cosmetic or edge-case

---

## Global Infrastructure

### ✅ What's Working Well

| Item | Status |
|------|--------|
| **Viewport meta tag** (`index.html`) | `width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover` — Excellent. Allows pinch zoom, supports notched devices. |
| **App.css** | Mobile-first 4-breakpoint system (480 / 768 / 1024 / 1025+), uses `100dvh`, `overflow-x: hidden` |
| **responsive.css** | 1393 lines of global responsive overrides — touch targets, safe areas, reduced motion, landscape, per-page 480px fixes |
| **design-tokens.css** | Safe-area CSS vars (`--safe-top/bottom/left/right`), z-index hierarchy, layout tokens |
| **`box-sizing: border-box`** | Applied globally in index.css ✅ |
| **`overflow-x: hidden`** on body | Prevents horizontal scroll ✅ |

---

## File-by-File Issues

---

### 1. `frontend/src/pages/ChapterJourney.css` (1314 lines)

**Breakpoints:** 769px (min), 768px (max), 420px (max) — 3 media queries

#### 🔴 CJ-1: `100vh` instead of `100dvh` on `.cj-root`

**File:** [ChapterJourney.css](frontend/src/pages/ChapterJourney.css#L50)

```css
.cj-root {
  height: 100vh;        /* ← Problem */
  overflow: hidden;
}
```

**Issue:** On mobile Safari/Chrome, `100vh` includes the browser URL bar area, causing content to extend behind the bottom bar. Combined with `overflow: hidden`, this clips the bottom of the writing area.

**Fix:**
```css
.cj-root {
  height: 100dvh;
  overflow: hidden;
}
```

#### 🟡 CJ-2: `100vh` on `.cj-loading` and `.cj-error`

**File:** [ChapterJourney.css](frontend/src/pages/ChapterJourney.css#L1074) and [line 1110](frontend/src/pages/ChapterJourney.css#L1110)

```css
.cj-loading { height: 100vh; }
.cj-error   { height: 100vh; }
```

**Issue:** Same mobile browser chrome issue — loading/error screens will be taller than visible viewport.

**Fix:** Change both to `height: 100dvh;`

#### 🟡 CJ-3: `.cj-override-blocks` flex without wrap

**File:** [ChapterJourney.css](frontend/src/pages/ChapterJourney.css#L575-L580)

```css
.cj-override-blocks {
  display: flex;
  gap: 20px;
  flex: 1;
  min-width: 0;
}
```

**Issue:** No `flex-wrap: wrap` — on narrow screens where override blocks are visible (they're hidden at 768px, but visible between 769px-1024px on tablets), the items can overflow.

**Fix:** Add `flex-wrap: wrap;`

#### 🟡 CJ-4: `min-height: calc(100vh - 140px)` in CJ-embedded context

**File:** [ChapterJourney.css](frontend/src/pages/ChapterJourney.css#L964)

```css
min-height: calc(100vh - 140px) !important;
```

**Issue:** Uses `100vh` in calc — same mobile browser chrome problem.

**Fix:** Change to `calc(100dvh - 140px)`

#### 🟢 CJ-5: Missing tablet breakpoint (1024px)

**Issue:** Jumps from 769px desktop straight to 768px mobile. Tablets (768-1024px) get the full desktop layout which can feel cramped, especially the override blocks and progress strip rows.

**Fix:** Consider adding `@media (max-width: 1024px)` to compact the ribbon slightly.

---

### 2. `frontend/src/pages/WriteMode.css` (3866 lines)

**Breakpoints:** 12 media queries — 900px, 640px, 767px (×6), 768px (min), 1024px (min), 380px, 480px, 481-768px, 769px+

#### ✅ What's Working Well
- Extensive mobile overrides at 767px — sidebars hidden, manuscript full-bleed, prose area auto-grows
- Safe area insets: `padding-bottom: max(10px, env(safe-area-inset-bottom))`
- iOS zoom prevention: font-size 16px on inputs
- Root uses `100dvh` ✅
- Manuscript margin line (`::after`) properly hidden on mobile

#### 🟡 WM-1: `.wm-edit-mic-btn` below touch target at ≤767px

**File:** [WriteMode.css](frontend/src/pages/WriteMode.css#L1396) (approx, in 767px media query)

```css
.wm-edit-mic-btn {
  width: 38px;
  height: 38px;
}
```

**Issue:** 38px is below the 44px minimum touch target for mobile.

**Fix:** `width: 44px; height: 44px;`

#### 🟡 WM-2: `.wm-mic-btn` drops to 40px at ≤380px

**File:** [WriteMode.css](frontend/src/pages/WriteMode.css#L2497) (approx, in 380px media query)

```css
.wm-mic-btn {
  width: 40px;
  height: 40px;
}
```

**Issue:** Primary recording button at 40px is below 44px on the smallest screens where fat-finger issues are most likely.

**Fix:** Keep at `44px` minimum even on 380px screens — the 4px difference won't break layout but will improve usability.

#### 🟡 WM-3: `.wm-history-panel` uses `100vh`

**File:** [WriteMode.css](frontend/src/pages/WriteMode.css#L2829)

```css
.wm-history-panel {
  height: 100vh;
}
```

**Issue:** Panel extends behind mobile browser chrome.

**Fix:** `height: 100dvh;`

#### 🟡 WM-4: `.wm-manuscript-page` uses `min-height: calc(100vh - 160px)`

**File:** [WriteMode.css](frontend/src/pages/WriteMode.css#L975)

```css
min-height: calc(100vh - 160px);
```

**Issue:** Uses `100vh` in calc — page may be slightly taller than visible area on mobile.

**Fix:** `min-height: calc(100dvh - 160px);`

#### 🟢 WM-5: `.wm-para-float-hint` positioning edge case

**File:** [WriteMode.css](frontend/src/pages/WriteMode.css#L1215) (approx)

```css
.wm-para-float-hint {
  left: calc(50% - 370px);
}
```

**Issue:** On screens 740-900px, this can position the hint off-screen left. It IS hidden at ≤767px, so this only affects narrow tablets (768-900px range).

**Fix:** Add `left: max(12px, calc(50% - 370px));`

---

### 3. `frontend/src/components/StoryPlannerConversational.css` (1592 lines)

**Breakpoints:** `hover: none` (L292), 900px (L1112), 768px (L1120), 480px (L1367) — 4 media queries

#### ✅ What's Working Well
- Tab-based layout on mobile (chat/plan toggle) — excellent pattern
- `font-size: 16px` on `.spc-input` at mobile (prevents iOS zoom)
- Safe area insets: `padding: 10px 12px max(14px, env(safe-area-inset-bottom, 14px))`
- Touch targets bumped to 44px at 768px for mic/send buttons
- `-webkit-overflow-scrolling: touch` on scroll areas

#### 🔴 SPC-1: Touch targets shrink below 44px at ≤480px

**File:** [StoryPlannerConversational.css](frontend/src/components/StoryPlannerConversational.css#L1367-L1385) (480px media query)

```css
.spc-clear-btn { min-width: 32px; min-height: 32px; }
.spc-close-btn { min-width: 32px; min-height: 32px; }
.spc-input     { min-height: 42px; }
```

**Issue:** At ≤480px (small phones — iPhone SE, Galaxy S), these critical interactive elements drop well below the 44px minimum. The close/clear buttons at 32px are particularly problematic.

**Fix:**
```css
@media (max-width: 480px) {
  .spc-clear-btn { min-width: 40px; min-height: 40px; }
  .spc-close-btn { min-width: 40px; min-height: 40px; }
  .spc-input     { min-height: 44px; }
}
```

#### 🟡 SPC-2: Desktop touch targets below 44px

**File:** [StoryPlannerConversational.css](frontend/src/components/StoryPlannerConversational.css#L258-L268) (default styles)

```css
.spc-mic-btn  { width: 42px; height: 42px; }
.spc-send-btn { height: 42px; }
```

**Issue:** Desktop defaults are 42px. While fixed to 44px at the 768px breakpoint, touch-enabled desktops/tablets above 768px still get 42px targets.

**Fix:** Change defaults to 44px, or use the `@media (hover: none) and (pointer: coarse)` query that already exists at [line 292](frontend/src/components/StoryPlannerConversational.css#L292).

---

### 4. `frontend/src/pages/ReadingMode.jsx` (815 lines) — 🔴 NO CSS FILE

**Breakpoints:** NONE — **Zero media queries, zero responsive handling**

#### 🔴 RM-1: Entire page has no responsive styles

**File:** [ReadingMode.jsx](frontend/src/pages/ReadingMode.jsx#L425-L815) (inline styles object)

**Issue:** ReadingMode uses **100% inline JavaScript styles** with hardcoded pixel values. There are no `@media` queries, no conditional mobile logic, and no CSS file. On a 375px iPhone screen:

| Element | Value | Effective Width |
|---------|-------|-----------------|
| `.manuscript` | `padding: '60px 40px 0'` | 375 - 80 = **295px content** |
| `.bookTitle` | `fontSize: 36` | Oversized for mobile |
| `.dropCap` | `fontSize: 68` | Massively oversized |
| `.chapterTitle` | `fontSize: 22` | Acceptable but no scaling |
| `.line` | `fontSize: 17` | No mobile reduction |
| `.topBar` | `padding: '12px 24px'` | Wastes 48px on small screens |

**Impact:** Text will be crammed, drop caps will dominate the screen, the top bar meta info will overflow, and ~80px of padding is wasted on a 375px screen.

**Fix (recommended approach):** Create `ReadingMode.css` with mobile overrides. Since this uses inline styles, the fastest fix is adding a `useMediaQuery` hook in the component and conditionally adjusting the style object:

```jsx
// Add to ReadingMode.jsx
const isMobile = window.innerWidth <= 768;

// Then in the styles object:
manuscript: {
  maxWidth: 640,
  margin: '0 auto',
  padding: isMobile ? '32px 16px 0' : '60px 40px 0',
},
bookTitle: {
  // ...existing,
  fontSize: isMobile ? 24 : 36,
},
dropCap: {
  fontSize: isMobile ? 48 : 68,
  marginTop: isMobile ? 6 : 10,
},
topBar: {
  padding: isMobile ? '8px 12px' : '12px 24px',
},
```

Or better: extract styles to a CSS file with proper media queries.

#### 🔴 RM-2: `.shell` uses `minHeight: '100vh'`

**File:** [ReadingMode.jsx](frontend/src/pages/ReadingMode.jsx#L465)

```js
shell: { minHeight: '100vh', ... }
```

**Fix:** `minHeight: '100dvh'`

#### 🟡 RM-3: No iOS zoom prevention on any inputs

**Issue:** The back button and TOC button use inline styles with no explicit `font-size: 16px` — not an issue since they're buttons not inputs, but the overall page has no consideration for iOS behavior.

#### 🟡 RM-4: `.topMeta` flex layout overflow on narrow screens

**File:** [ReadingMode.jsx](frontend/src/pages/ReadingMode.jsx#L488-L491)

```js
topMeta: {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
},
```

**Issue:** Book title + "· 12,345 words · 49 min read" on a 320px screen with 48px of button padding will overflow horizontally.

**Fix:** Add `flexWrap: 'wrap', justifyContent: 'center'` or hide stats on mobile.

#### 🟡 RM-5: TOC sticky positioning mismatch

**File:** [ReadingMode.jsx](frontend/src/pages/ReadingMode.jsx#L502)

```js
toc: { position: 'sticky', top: 45, ... }
```

**Issue:** The `top: 45` is hardcoded and assumes a specific top bar height. If the top bar wraps on mobile (which it would without media queries), the TOC will overlap content.

---

### 5. `frontend/src/pages/StorytellerPage.css` (4361 lines)

**Breakpoints:** 12+ media queries — 1100px, 1024px, 768px (×5), 640px (×2), 480px (×3), 360px, `hover:none+coarse`, `@supports safe-area-inset`

#### ✅ What's Working Well
- Exceptional mobile treatment: slide-over nav, fixed topbar, full-bleed writing, vertical workflow stepper
- Touch device `@media (hover: none) and (pointer: coarse)` with `touch-action: manipulation` preventing double-tap zoom
- Properly calculates `100dvh` for nav on mobile
- Safe area insets via `@supports` block
- Bottom sheet pattern for modals/briefs on mobile
- 360px breakpoint for very small phones

#### 🟡 ST-1: `.st-editor-layout` uses `min-height: 100vh`

**File:** [StorytellerPage.css](frontend/src/pages/StorytellerPage.css#L1598)

```css
.st-editor-layout {
  min-height: 100vh;
}
```

**Issue:** Should use `100dvh` for mobile browser chrome consistency.

**Fix:** `min-height: 100dvh;`

#### 🟡 ST-2: `.st-canon-panel` uses `100vh` in max-height

**File:** [StorytellerPage.css](frontend/src/pages/StorytellerPage.css#L3024)

```css
.st-canon-panel {
  max-height: calc(100vh - var(--st-topbar-h) - 40px);
}
```

**Issue:** Canon panel hidden at ≤1024px so this only affects 1025px+ desktop — low severity, but inconsistent.

**Fix:** `max-height: calc(100dvh - var(--st-topbar-h) - 40px);`

#### 🟡 ST-3: Touch targets below 44px at ≤480px breakpoint

**File:** [StorytellerPage.css](frontend/src/pages/StorytellerPage.css#L3720-L3740) (480px media query)

```css
.st-chapter-icon-btn { min-height: 36px; min-width: 36px; }
.st-tools-btn       { min-height: 32px; min-width: 32px; }
```

**Issue:** Chapter action buttons at 36px and tools button at 32px on small phones.

**Fix:**
```css
.st-chapter-icon-btn { min-height: 40px; min-width: 40px; }
.st-tools-btn       { min-height: 36px; min-width: 36px; }
```

#### 🟡 ST-4: `.st-section-actions button` is 26×26px

**File:** [StorytellerPage.css](frontend/src/pages/StorytellerPage.css#L1381-L1389)

```css
.st-section-actions button {
  width: 26px;
  height: 26px;
}
```

**Issue:** Section edit/delete buttons are 26px on all screen sizes. On touch devices they're hidden behind hover (opacity: 0), but the `hover: none` media query doesn't bump their size. If they become visible (e.g., via JavaScript), they're too small.

**Fix:** In the `@media (hover: none)` block, add:
```css
.st-section-actions button {
  width: 36px;
  height: 36px;
  font-size: 15px;
}
```

#### 🟢 ST-5: `.st-nav` uses `100vh` in base style

**File:** [StorytellerPage.css](frontend/src/pages/StorytellerPage.css#L1983)

```css
.st-nav {
  height: calc(100vh - var(--st-topbar-h));
}
```

**Issue:** Desktop-only (nav is repositioned to fixed on mobile and uses `100dvh` there), so low severity. But the 768px override has both `100vh` and `100dvh` — [line 3462](frontend/src/pages/StorytellerPage.css#L3462) shows:
```css
height: calc(100vh - var(--st-topbar-h));
height: calc(100dvh - var(--st-topbar-h));
```
The double declaration is a correct progressive-enhancement pattern ✅ (fallback for browsers not supporting dvh).

---

## Cross-Cutting Issues

### 🟡 CC-1: Inconsistent `100vh` vs `100dvh` usage

| File | Line | Element | Using |
|------|------|---------|-------|
| ChapterJourney.css | 50 | `.cj-root` | `100vh` 🔴 |
| ChapterJourney.css | 1074 | `.cj-loading` | `100vh` 🟡 |
| ChapterJourney.css | 1110 | `.cj-error` | `100vh` 🟡 |
| ChapterJourney.css | 964 | CJ-embedded min-height | `100vh` 🟡 |
| WriteMode.css | 975 | `.wm-manuscript-page` | `100vh` 🟡 |
| WriteMode.css | 2829 | `.wm-history-panel` | `100vh` 🟡 |
| StorytellerPage.css | 1598 | `.st-editor-layout` | `100vh` 🟡 |
| StorytellerPage.css | 3024 | `.st-canon-panel` | `100vh` 🟢 |
| ReadingMode.jsx | 465 | `.shell` | `100vh` 🔴 |

All desktop-context uses can remain `100vh`, but any element visible on mobile should use `100dvh` (with `100vh` fallback if needed).

### 🟡 CC-2: Touch target compliance summary

The global `responsive.css` sets `min-height: 44px; min-width: 44px` on buttons for `(hover: none) and (pointer: coarse)`, which is excellent. However, **per-component media queries override these back down** at small breakpoints:

| Component | Element | Size at ≤480px | Minimum |
|-----------|---------|---------------|---------|
| SPC | `.spc-clear-btn` | 32px | 44px |
| SPC | `.spc-close-btn` | 32px | 44px |
| SPC | `.spc-input` | 42px | 44px |
| WM | `.wm-edit-mic-btn` | 38px | 44px |
| WM | `.wm-mic-btn` (≤380px) | 40px | 44px |
| ST | `.st-tools-btn` (≤480px) | 32px | 44px |
| ST | `.st-chapter-icon-btn` (≤480px) | 36px | 44px |
| ST | `.st-section-actions button` | 26px | 44px |

### 🟢 CC-3: Font size for inputs on iOS

`responsive.css` globally sets `font-size: 16px !important` on all inputs for `(hover: none)` devices — this prevents iOS auto-zoom ✅. However, the `!important` may conflict with component-specific input sizing. Worth monitoring but not currently broken.

---

## Priority Fix List

### Phase 1 — Critical (ReadingMode + viewport units)

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 1 | Create `ReadingMode.css` or add responsive inline styles to ReadingMode.jsx | ReadingMode.jsx | **Entire page broken on mobile** |
| 2 | Change `.cj-root` from `100vh` to `100dvh` | ChapterJourney.css L50 | Content clipped behind browser chrome |
| 3 | Change `.cj-loading`, `.cj-error` from `100vh` to `100dvh` | ChapterJourney.css L1074, L1110 | Loading/error screens misaligned |

### Phase 2 — Touch Targets

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 4 | Bump `.spc-clear-btn`, `.spc-close-btn` to ≥40px at 480px | StoryPlannerConversational.css | Frustrating tap targets on small phones |
| 5 | Bump `.wm-edit-mic-btn` to 44px at 767px | WriteMode.css | Mic button too small |
| 6 | Keep `.wm-mic-btn` at 44px minimum even at 380px | WriteMode.css | Primary action button too small |
| 7 | Bump `.st-tools-btn` to ≥36px at 480px | StorytellerPage.css | Tools button too small |

### Phase 3 — Viewport Unit Cleanup

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 8 | `.wm-history-panel` → `100dvh` | WriteMode.css L2829 | History panel sizing |
| 9 | `.wm-manuscript-page` min-height → `100dvh` | WriteMode.css L975 | Manuscript sizing |
| 10 | `.st-editor-layout` min-height → `100dvh` | StorytellerPage.css L1598 | Editor layout |
| 11 | CJ-embedded min-height → `100dvh` | ChapterJourney.css L964 | Embedded page sizing |
| 12 | ReadingMode shell → `100dvh` | ReadingMode.jsx L465 | Reading shell sizing |

### Phase 4 — Polish

| # | Fix | Files | Impact |
|---|-----|-------|--------|
| 13 | Add `flex-wrap: wrap` to `.cj-override-blocks` | ChapterJourney.css L576 | Tablet overflow |
| 14 | Add `flexWrap: 'wrap'` to ReadingMode `.topMeta` | ReadingMode.jsx L488 | Mobile top bar overflow |
| 15 | Add `@media (hover: none)` size bump for `.st-section-actions button` | StorytellerPage.css | Touch device section actions |

---

## Appendix: Breakpoint Map

```
             360    420   480   640   768   900   1024  1100  1200
              │      │     │     │     │     │     │     │     │
ChapterJourney ─────────── 420 ────── 768 ────── 769+ ───────────
WriteMode ──── 380 ── 480 ─ 481-768 ─ 640 ── 767 ── 768+ ── 900 ── 1024+
SPC ────────────────── 480 ────────── 768 ── 900 ────────────────
StorytellerPage  360 ─ 480 ──── 640 ─ 768 ───── 1024 ─ 1100 ───
ReadingMode ─── (NONE) ─────────────────────────────────────────
responsive.css ─ 400 ─ 480 ─ 520 ─ 768 ─ 920L ─ 1024 ── 1200 ──
App.css ───────── 480 ─── 481-768 ── 769-1024 ─── 1025+ ───────
```

*L = landscape orientation query*
