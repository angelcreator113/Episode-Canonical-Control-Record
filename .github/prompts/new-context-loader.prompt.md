---
description: "Create a new context loader function for WriteMode/Story Engine. Adds the async loader, wires it into loadWriteModeContext, and updates buildWriteModeContextBlock."
agent: "story-engine"
---
Create a new context loader in `src/routes/memories.js` following existing patterns:

## Steps
1. **Create the loader function** near the other loaders (~line 8000-8700):
   - Name: `async function load{{LoaderName}}(characterKey)`
   - Query the relevant model using `characterKey` (string slug, NOT integer PK)
   - Return formatted text or `null` if no data
   - Wrap in try/catch → `console.error` + return `null`

2. **Wire into `loadWriteModeContext()`** (~line 8745):
   - Add the new loader to the `Promise.all()` array
   - Destructure the result

3. **Wire into `buildWriteModeContextBlock()`**:
   - Add a conditional section: only inject if data is not null
   - Format: `## Section Name\n${data}`

4. **Validate**: Run `node -c src/routes/memories.js`

## Context Loader Convention
- Input: `characterKey` (string slug from `RegistryCharacter.character_key`)
- Output: formatted string or `null`
- All loaders are fault-tolerant — never throw, always return null on error
