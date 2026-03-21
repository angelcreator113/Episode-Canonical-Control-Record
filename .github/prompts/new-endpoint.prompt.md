---
description: "Create a new WriteMode or API endpoint in memories.js. Scaffolds route with auth, voice context, WriteMode context loading, model retry, SSE streaming, and error handling."
agent: "story-engine"
---
Create a new endpoint in `src/routes/memories.js` following these exact patterns:

## Requirements
- Route: `POST /api/v1/memories/{{endpoint-name}}`
- Auth: `optionalAuth` middleware
- Extract `character_id` from `req.body`
- Load voice: `const charVoice = await getCharacterVoiceContext(character_id);`
- Load context: `const wmCtx = await loadWriteModeContext(character_id);`
- Format: `const narrativeContext = buildWriteModeContextBlock(wmCtx);`
- Model retry pattern with `const MODELS = ['claude-sonnet-4-6'];`
- Support `stream: true` via SSE with correct headers
- Error handling: try/catch → `console.error` + `res.status(500).json({ error })`

## After creating:
1. Run `node -c src/routes/memories.js` to validate syntax
2. Describe what the endpoint does and how to call it
