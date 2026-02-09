# 🎬 Script Generator Backend - Implementation Complete

**Status**: ✅ All backend components created and integrated

## Summary of Implementation

### Part 1: Script Parser Utility ✅
**File**: `backend/src/utils/scriptParser.js` (188 lines)

**Features**:
- **Scene Detection**: 6 regex patterns for different scene header formats:
  - `SCENE 1: Title`
  - `INT. LOCATION - DAY` / `EXT. LOCATION - DAY`
  - `SCENE 1 - Title`
  - `[SCENE 1] Title`
  - `ACT 1: Title`

- **Duration Estimation**: 1 word ≈ 0.4 seconds (minimum 30s per scene)

- **Content Extraction**: Gets text between scene markers

- **Pattern Analysis**:
  - Word frequency & favorite words
  - Sentence length averages
  - Emotional tone detection (energetic vs positive)
  - Show-specific patterns

- **Quality Checks**:
  - Attention span warnings (scenes > 120s)
  - Duration validation against targets

### Part 2: Sequelize Models ✅
Created 5 new models registered in `src/models/index.js`:

1. **ShowConfig** (`src/models/ShowConfig.js`)
   - Stores show-specific settings
   - Fields: target_duration, target_scene_count, format, niche_category, content_specs

2. **ScriptTemplate** (`src/models/ScriptTemplate.js`)
   - Template formulas with placeholders
   - Fields: template_content, variables, scene_structure, learning_metadata

3. **ScriptLearningProfile** (`src/models/ScriptLearningProfile.js`)
   - Learned writing patterns per show
   - Fields: vocabulary_data, pacing_data, structure_data, confidence_scores

4. **ScriptEditHistory** (`src/models/ScriptEditHistory.js`)
   - Tracks all user edits for learning
   - Fields: edit_type, variable_affected, original_value, final_value, user_reasoning

5. **ScriptSuggestion** (`src/models/ScriptSuggestion.js`)
   - AI suggestions with context
   - Fields: variable_key, suggested_value, context_used, confidence_score

### Part 3: API Routes ✅
**File**: `src/routes/scriptGenerator.js` (305 lines)

**Endpoints**:

1. **Configuration Management**
   - `GET /api/v1/shows/:showId/config` - Get show config
   - `PUT /api/v1/shows/:showId/config` - Update show config

2. **Template Management**
   - `GET /api/v1/shows/:showId/template` - Get script template
   - `POST /api/v1/shows/:showId/template` - Create template

3. **AI Suggestions**
   - `POST /api/v1/episodes/:episodeId/script-suggestions` - Generate AI suggestions
     - Analyzes episode context (wardrobe, guests)
     - Pulls writing patterns from past 5 episodes
     - Generates smart suggestions for variables
     - Returns suggestions with confidence scores

4. **Script Generation**
   - `POST /api/v1/templates/:templateId/generate` - Generate script from template
     - Replaces {{VARIABLE}} placeholders
     - Returns estimated duration, word count, scene count

### Part 4: Integration ✅
**Updated Files**:

1. **app.js** - Added script generator route loading and mounting:
   ```javascript
   app.use('/api/v1/shows', scriptGeneratorRoutes);
   app.use('/api/v1/episodes', scriptGeneratorRoutes);
   app.use('/api/v1/templates', scriptGeneratorRoutes);
   ```

2. **src/models/index.js** - Registered all 5 new models for export

## API Usage Examples

### 1. Get Show Configuration
```bash
curl GET /api/v1/shows/show-123/config
```
**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "show_id": "show-123",
    "target_duration": 600,
    "target_scene_count": 7,
    "format": "YouTube long-form",
    "niche_category": "fashion"
  }
}
```

### 2. Get Script Suggestions
```bash
curl POST /api/v1/episodes/ep-456/script-suggestions \
  -H "Content-Type: application/json" \
  -d '{"template_id": "tpl-789"}'
```
**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "episode_id": "ep-456",
      "variable_key": "EMOTIONAL_FOCUS",
      "suggested_value": "confidence",
      "context_used": {
        "episode_number": 5,
        "wardrobe_items": ["jacket", "boots"],
        "reasoning": "Based on positive tone from past episodes"
      },
      "confidence_score": 0.75
    }
  ]
}
```

### 3. Generate Script from Template
```bash
curl POST /api/v1/templates/tpl-789/generate \
  -H "Content-Type: application/json" \
  -d '{
    "episode_id": "ep-456",
    "variables": {
      "EMOTIONAL_FOCUS": "confidence",
      "OUTFIT_INTENTION": "show-stopping elegance",
      "SOCIAL_PROOF": "10000+ besties love this"
    }
  }'
```
**Response**:
```json
{
  "success": true,
  "data": {
    "script": "SCENE 1: Opening Ritual\nWe're bringing confidence to the closet...",
    "template_used": "Fashion Show Formula",
    "variables_applied": {...},
    "metadata": {
      "estimated_duration": 480,
      "word_count": 1200,
      "scene_count": 7
    }
  }
}
```

## Next Steps - Frontend Implementation

The frontend will use:
1. **ScriptGeneratorSmart.jsx** - React component with form for AI-guided generation
2. **EpisodeScriptWithScenes.jsx** - Enhanced to include generator button
3. **Tab integration** - Add generator as option in Scripts tab

## Database Tables Created

When migrations run, these tables will be created:
- `show_configs` - Show-level settings
- `script_templates` - Template formulas
- `script_learning_profiles` - Learned patterns per show
- `script_edit_history` - Edit audit trail
- `script_suggestions` - AI suggestions with metadata

## Architecture Highlights

✅ **Context-Aware**: Uses episode context (wardrobe, guests, episode number)
✅ **Pattern Learning**: Analyzes past scripts from same show
✅ **Confidence Scoring**: Tracks how confident AI is in suggestions
✅ **Extensible**: Ready for Claude API integration for enhanced suggestions
✅ **Audit Trail**: Tracks all edits for continuous improvement

## Testing the API

1. **Test show config creation**:
   ```bash
   curl -X PUT http://localhost:3002/api/v1/shows/test-show/config \
     -H "Content-Type: application/json" \
     -d '{"target_duration": 600, "niche_category": "fashion"}'
   ```

2. **Test suggestion generation**:
   ```bash
   # First create a template
   curl -X POST http://localhost:3002/api/v1/shows/test-show/template \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Fashion Formula",
       "template_content": "SCENE 1: {{EMOTIONAL_FOCUS}}\nWe are bringing {{OUTFIT_INTENTION}}",
       "variables": [
         {"key": "EMOTIONAL_FOCUS", "label": "Emotion", "examples": ["confidence", "power"]},
         {"key": "OUTFIT_INTENTION", "label": "Style", "examples": ["elegance", "edge"]}
       ]
     }'
   
   # Then generate suggestions
   curl -X POST http://localhost:3002/api/v1/episodes/ep-123/script-suggestions \
     -H "Content-Type: application/json" \
     -d '{"template_id": "returned-template-id"}'
   ```

## Files Created/Modified

**New Files** (5):
- ✅ `backend/src/utils/scriptParser.js`
- ✅ `backend/src/models/ShowConfig.js`
- ✅ `backend/src/models/ScriptTemplate.js`
- ✅ `backend/src/models/ScriptLearningProfile.js`
- ✅ `backend/src/models/ScriptEditHistory.js`
- ✅ `backend/src/models/ScriptSuggestion.js`
- ✅ `backend/src/routes/scriptGenerator.js`

**Modified Files** (2):
- ✅ `src/app.js` - Route registration
- ✅ `src/models/index.js` - Model registration

---

**Ready for**: Frontend integration + Claude API enhancement
