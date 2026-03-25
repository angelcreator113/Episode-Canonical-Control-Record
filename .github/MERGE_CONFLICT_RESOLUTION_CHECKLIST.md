# Merge Conflict Resolution Checklist

When resolving merge conflicts, use this checklist to prevent feature regressions and ensure merge integrity.

## Before Resolving Conflicts

- [ ] **Define Feature Contract**: Document the API shape, UI flow, error states, and expected behavior of the feature being merged
  - Example: erase/inpaint flow should: (1) accept mask + prompt, (2) call Replicate API, (3) upload result to S3, (4) display inpainted image, (5) show error message on failure
- [ ] **Identify Key Regions**: Mark line ranges in conflicted files where semantic changes occur (e.g., API calls, error handling, S3 operations)

## Resolving Conflicts

- [ ] **Resolve by Behavior, Not by "Theirs/Ours"**: Don't blindly accept sides. For each conflict block:
  - Read both versions
  - Understand what each side changed and why
  - Choose or synthesize the version that preserves the feature contract
  - Example: if HEAD adds quality prompts and origin/main refactors the API call, keep main's API structure but inject HEAD's quality prompt enhancements
- [ ] **Check Syntax**: After resolution, validate backend files
  ```bash
  node -c src/routes/memories.js
  node -c src/routes/episodes.js
  node -c src/services/inpaintingService.js
  ```
- [ ] **Verify Markers Removed**: Confirm no conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) remain
  ```bash
  grep -r "^<<<<<<<\|^=======\|^>>>>>>>" src/ frontend/src/
  ```

## Testing Merged Code

**Critical Hot-Spot Areas** (always test these):

### 1. Scene Editor Erase/Inpaint Flow
- [ ] Open SceneStudio.jsx component
- [ ] Draw a mask on the canvas using erase brush
- [ ] Enter an inpaint prompt (e.g., "blue sky")
- [ ] Click "Apply"
- [ ] Verify:
  - Inpaint API call succeeds (Network tab shows 200)
  - S3 URL returned and image displays
  - No JavaScript errors in console

### 2. Inpaint Error Handling
- [ ] Simulate backend failure (disable API token or use invalid prompt)
- [ ] Click "Apply" again
- [ ] Verify:
  - Error message displays in UI (friendly, actionable text)
  - getNetworkAwareApiError() utility returns correct message
  - No unhandled promise rejection in console

### 3. S3 Upload Behavior
- [ ] After successful inpaint, check Network tab for S3 request
- [ ] Verify:
  - S3 URL is accessible and returns 200
  - No ACL errors (S3 ACL should NOT be reintroduced as `ACL: 'public-read'`)
  - Image renders correctly in scene

### 4. Image Restyle Flow (if modified)
- [ ] Apply mood/time-of-day transform to a scene
- [ ] Verify S3 upload and image display work as above

## Post-Resolution

- [ ] **Commit Message**: Include merge note describing approach
  ```
  Merge origin/main and resolve conflicts in SceneStudio, inpaintingService

  Strategy: Kept upstream API call pattern (predictions.create) + polling.
  Preserved HEAD's quality prompts (qualityPrompt, negativePrompt, 36 steps).
  Removed S3 ACL (deprecated). All conflict regions tested.
  ```
- [ ] **PR Comment**: Document what was kept from each side
  ```
  ## Merge Conflict Resolution
  
  **Files Affected**: 4 (SceneStudio.jsx, inpaintingService.js, imageRestyleService.js, SceneStudio.css)
  
  **Decision Log**:
  - inpaintingService.js: Kept origin/main's Replicate polling flow, added HEAD's quality prompts.
  - SceneStudio.jsx: Kept upstream structure, added getNetworkAwareApiError() utility.
  - imageRestyleService.js: Removed S3 ACL (deprecated in both).
  - SceneStudio.css: Accepted main's cleaner stylesheet (erase component removed upstream).
  
  **Testing**: Erase flow, error handling, S3 uploads all validated.
  ```
- [ ] **Push to Branch**: Commit resolution and push to remote
  ```bash
  git add <conflicted files>
  git commit -m "..."
  git push origin <branch-name>
  ```

## Why This Matters

Merge conflicts often mask **semantic conflicts** — changes to behavior that Git doesn't detect:
- API call restructuring + quality prompt changes
- Error handling improvements + new error codes
- S3 deprecations + image upload side effects

Blindly accepting "theirs" or "ours" can silently break features. The checklist ensures you verify behavior, not just syntax.

## Questions?

If resolving conflicts, ask:
1. Does the feature work end-to-end?
2. Do all error paths display correct messages?
3. Are deprecated patterns (e.g., S3 ACL) not reintroduced?
4. Did I synthesize both sides, or just pick one?

---

**Last Updated**: March 25, 2026  
**Hot-Spots Identified**: Erase/inpaint flow, error messages, S3 uploads, API retry patterns
