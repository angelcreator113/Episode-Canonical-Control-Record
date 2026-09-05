---
description: "Use when editing, debugging, or adding endpoints to src/routes/memories.js. Covers AI prompt construction, context loading, SSE streaming, model retry patterns, and the 12K-line file structure. Use for: new route, API endpoint, SSE stream, AI call, prompt engineering, context loader, voice injection, WriteMode backend, Story Engine backend."
applyTo: "src/routes/memories.js"
---
## This file is stale

`src/routes/memories.js` does not exist. PR #328 (2026-03-25) split it into
`src/routes/memories/{index,helpers,core,interview,voice,stories,planning,assistant,engine,extras}.js`
(10 files, ~12,867 lines total). The 17 context loaders live in `engine.js`,
not `helpers.js`.

The `optionalAuth` scaffold in this file's example also contradicts the
live convention: writes use `requireAuth` (or `requireAuth` +
`authorize(['ADMIN'])`); `optionalAuth` is for public catalog GETs only,
with a `// PUBLIC:` comment.

For the current file layout and conventions, read `PROJECT_CONTEXT.md`
§4.2 and §5.
