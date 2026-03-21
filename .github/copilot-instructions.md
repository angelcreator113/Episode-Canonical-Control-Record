# Episode Canonical Control Record — Project Guidelines

## What This Is

Literary fiction platform for "Before Lala" — a memoir-style novel with AI-assisted writing tools.
Core character: JustAWoman. World: the LalaVerse. The platform includes Story Engine (auto-generation), WriteMode (author-assisted writing), Character Registry, Social Profile system, and production tooling.

## Tech Stack

- **Backend**: Node.js/Express, Sequelize ORM, PostgreSQL (Neon cloud DB)
- **Frontend**: React 18 + Vite, vanilla CSS (no Tailwind/CSS-in-JS)
- **AI**: Anthropic Claude (claude-sonnet-4-6), via `anthropic` SDK
- **Infra**: EC2 (PM2), S3 assets, nginx reverse proxy
- **DB**: Sequelize with global `paranoid: true` (all tables need `deleted_at`)

## Architecture

```
src/
  routes/          # Express route files — memories.js is the largest (~12K lines)
  models/          # Sequelize models (100+ models)
  services/        # Business logic (textureLayerService, aiCostTracker, etc.)
  middleware/      # Auth (optionalAuth), error handling
  workers/         # Background job processing

frontend/src/
  pages/           # Route-level components (WriteMode.jsx, StoryEngine.jsx, etc.)
  components/      # Shared/feature components
```

## Key Conventions

### Backend
- Route auth: use `optionalAuth` middleware (not `requireAuth`) — most routes are optional-auth
- AI calls: model fallback pattern `const MODELS = ['claude-sonnet-4-6'];` with retry loop
- SSE streaming: set headers `Content-Type: text/event-stream`, `X-Accel-Buffering: no`
- Context loaders return `null` when no data exists — conditionally inject into prompts
- `loadWriteModeContext(characterId)` loads 15 narrative context sources in parallel for WriteMode
- `buildWriteModeContextBlock(ctx)` formats context into prompt-ready text
- `getCharacterVoiceContext(characterId)` loads voice_signature from RegistryCharacter
- Error handling: try/catch with `console.error` + JSON error response, never crash

### Frontend
- Design tokens: parchment `#FAF7F0`, gold accent `#B8962E`, ink `#2C2C2C`
- Typography: `Lora` 17.5px for prose, `DM Mono` for UI/labels
- Icons: `lucide-react` exclusively
- API base: `/api/v1/memories/` for AI/story endpoints
- State: React hooks (useState, useCallback, useMemo) — no Redux/Zustand
- Mobile-first: test at 375px, use CSS media queries

### Database
- Character lookup: `RegistryCharacter.findByPk(id)` → get `character_key` → use for context loaders
- Paranoid mode: all models soft-delete; always include `deleted_at` in migrations
- JSONB fields: `voice_signature`, `relationships_map`, `evolution_tracking`, `extra_fields`
- SSL required for standalone scripts: `DB_SSL_REJECT_UNAUTHORIZED=false`

## Build & Test

```bash
# Backend
npm run dev              # nodemon on port 3002
node -c src/routes/memories.js  # Quick syntax check

# Frontend
cd frontend && npx vite build   # Production build
cd frontend && npm run dev      # Dev server on port 5173

# Full validation
npm run validate         # Routes + lint + route-health tests + cost audit
npm test                 # Jest with coverage
```

## Deploy

- **Dev**: `dev.primepisodes.com` → EC2 `54.163.229.144`, PM2 managed
- **SSH**: `ssh -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144`
- **DB**: Neon PostgreSQL (square-cherry project), pooling enabled
- See `ecosystem.config.js` for PM2 configuration
