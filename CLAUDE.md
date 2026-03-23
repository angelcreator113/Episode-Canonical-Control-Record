# Episode Canonical Control Record

Literary fiction platform for "Before Lala" — a memoir-style novel with AI-assisted writing tools.
Core character: JustAWoman. World: the LalaVerse.

## Tech Stack

- Backend: Node.js/Express, Sequelize ORM, PostgreSQL (Neon cloud DB)
- Frontend: React 18 + Vite, vanilla CSS (no Tailwind/CSS-in-JS)
- AI: Anthropic Claude (claude-sonnet-4-6), via `anthropic` SDK
- Infra: EC2 (PM2), S3 assets, nginx reverse proxy
- DB: Sequelize with global `paranoid: true` (all tables need `deleted_at`)

## Architecture

```
src/routes/          # Express routes — memories.js is ~12K lines
src/models/          # Sequelize models (100+)
src/services/        # Business logic
src/middleware/      # Auth (optionalAuth), error handling
frontend/src/pages/  # Route-level React components
frontend/src/components/  # Shared components
```

## Commands

```bash
# Backend
npm run dev              # nodemon on port 3002
node -c src/routes/memories.js  # Quick syntax check

# Frontend
cd frontend && npm run dev      # Dev server on port 5173
cd frontend && npx vite build   # Production build

# Validate & Test
npm run validate         # Routes + lint + route-health tests + cost audit
npm test                 # Jest with coverage
```

## Key Conventions

- Route auth: use `optionalAuth` middleware (not `requireAuth`)
- AI model fallback: `const MODELS = ['claude-sonnet-4-6'];` with retry loop
- SSE streaming: `Content-Type: text/event-stream`, `X-Accel-Buffering: no`
- Context loaders return `null` when no data — conditionally inject into prompts
- Error handling: try/catch with `console.error` + JSON response, never crash
- Frontend design tokens: parchment `#FAF7F0`, gold `#B8962E`, ink `#2C2C2C`
- Typography: `Lora` 17.5px for prose, `DM Mono` for UI/labels
- Icons: `lucide-react` exclusively
- API base: `/api/v1/memories/` for AI/story endpoints
- State: React hooks only — no Redux/Zustand
- All models soft-delete (paranoid mode); always include `deleted_at` in migrations
- JSONB fields: `voice_signature`, `relationships_map`, `evolution_tracking`, `extra_fields`
- Mobile-first: test at 375px, use CSS media queries

## Deploy

- Dev: `dev.primepisodes.com` → EC2, PM2 managed
- DB: Neon PostgreSQL, pooling enabled
- See `ecosystem.config.js` for PM2 config
