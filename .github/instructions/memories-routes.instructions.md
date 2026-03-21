---
description: "Use when editing, debugging, or adding endpoints to src/routes/memories.js. Covers AI prompt construction, context loading, SSE streaming, model retry patterns, and the 12K-line file structure. Use for: new route, API endpoint, SSE stream, AI call, prompt engineering, context loader, voice injection, WriteMode backend, Story Engine backend."
applyTo: "src/routes/memories.js"
---
# memories.js Route Conventions

## File Structure (~12K lines)
The file contains ALL AI writing endpoints, Story Engine, context loaders, and utility functions.
Key sections by approximate line range:
- **1-1500**: Rewrite options, voice interview routes
- **2800-3400**: voice-to-story, story-edit, story-continue (WriteMode endpoints)
- **3900-4200**: ai-writer-action, scene-planner
- **8000-8900**: Context loader functions (loadStoryMemories, loadCharacterRelationships, etc.)
- **8700-8900**: `loadWriteModeContext()` + `buildWriteModeContextBlock()` shared helpers
- **10000+**: Story Engine generate-story, arc generation

## Adding a New WriteMode Endpoint

1. Extract `character_id` from `req.body`
2. Load voice: `const charVoice = await getCharacterVoiceContext(character_id);`
3. Load context: `const wmCtx = await loadWriteModeContext(character_id);`
4. Format: `const narrativeContext = buildWriteModeContextBlock(wmCtx);`
5. Inject `narrativeContext` into the AI prompt
6. Use model fallback pattern with retry

```javascript
router.post('/my-endpoint', optionalAuth, async (req, res) => {
  try {
    const { character_id, ...rest } = req.body;
    const charVoice = await getCharacterVoiceContext(character_id);
    const wmCtx = await loadWriteModeContext(character_id);
    const narrativeContext = buildWriteModeContextBlock(wmCtx);

    const MODELS = ['claude-sonnet-4-6'];
    // ... model retry loop
  } catch (err) {
    console.error('POST /my-endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

## SSE Streaming Pattern

```javascript
if (stream) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Required for nginx
  res.flushHeaders();

  const streamResp = anthropic.messages.stream({ model, max_tokens, messages });
  streamResp.on('text', (text) => {
    res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
  });
  await streamResp.finalMessage();
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}
```

## Context Loaders (characterKey = string slug, NOT integer PK)

All loaders return `null` when no data exists. Inject conditionally:
```javascript
const section = data ? `\n\n${data}` : '';
```

To get characterKey from character_id (integer PK):
```javascript
const { RegistryCharacter } = require('../models');
const regChar = await RegistryCharacter.findByPk(character_id, { attributes: ['character_key'] });
const ck = regChar?.character_key;
```

## Model Retry Pattern

```javascript
const MODELS = ['claude-sonnet-4-6'];
let response;
for (const model of MODELS) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await anthropic.messages.create({ model, max_tokens, messages });
      break;
    } catch (apiErr) {
      const status = apiErr?.status || apiErr?.error?.status;
      if ((status === 529 || status === 503) && attempt < 1) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (status === 529 || status === 503 || status === 404) break;
      throw apiErr;
    }
  }
  if (response) break;
}
```

## Quick Validation
Always run `node -c src/routes/memories.js` after edits to catch syntax errors.
