---
description: "Use when creating or editing React frontend components, pages, or CSS. Covers design tokens, component patterns, mobile-first CSS, and icon usage. Use for: React component, JSX page, CSS styling, responsive design, Lora typography, parchment theme, lucide icons, Vite build, frontend state."
applyTo: "frontend/src/**"
---
# Frontend Component Conventions

## Design Tokens

```css
--parchment:    #FAF7F0;    /* backgrounds */
--parchment-dark: #F0EBE0;  /* secondary surfaces */
--gold:         #B8962E;    /* accent, primary action */
--gold-dark:    #9A7B1F;    /* hover state */
--ink:          #2C2C2C;    /* primary text */
--ink-light:    #6B6B6B;    /* secondary text */
--sage:         #7A8B6F;    /* success, nature */
--warm-gray:    #D4CFC7;    /* borders, dividers */
```

## Typography

- **Prose**: `font-family: 'Lora', serif; font-size: 17.5px; line-height: 1.7`
- **UI/Labels**: `font-family: 'DM Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px`
- **Headings**: `font-family: 'Lora', serif` at various sizes

## Icons

Use `lucide-react` exclusively. Never Font Awesome, Material Icons, or emoji.
```jsx
import { Settings, ChevronRight, BookOpen } from 'lucide-react';
<Settings size={16} />
```

## Component Patterns

- State: `useState`, `useCallback`, `useMemo` — no Redux/Zustand
- API calls: `fetch('/api/v1/memories/...')` with try/catch
- Loading states: Use `LoadingSkeleton` component
- No TypeScript — all files are `.jsx` / `.js`

## CSS Conventions

- Vanilla CSS only — no Tailwind, CSS-in-JS, or CSS modules
- One CSS file per page: `WriteMode.css` alongside `WriteMode.jsx`
- Mobile-first: design for 375px, then scale up with `@media (min-width: 768px)`
- Scroll behavior: `overflow-y: auto` with `-webkit-overflow-scrolling: touch`
- Transitions: `transition: all 0.2s ease` for interactive elements

## SSE Streaming (Frontend)

```javascript
const response = await fetch('/api/v1/memories/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...params, stream: true }),
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
// Parse `data: {...}\n\n` events
```

## Build

```bash
cd frontend && npx vite build   # Production build (~13s)
cd frontend && npm run dev      # Dev server on port 5173
```
