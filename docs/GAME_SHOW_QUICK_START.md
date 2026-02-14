# 🎮 Game Show Features - Quick Start Guide

## Files Created

✅ **1. Database Migration**
- Location: [src/migrations/1739041800000-add-game-show-features.js](src/migrations/1739041800000-add-game-show-features.js)
- Size: 8.4 KB
- Tables: interactive_elements, layout_templates, episode_phases, ai_interactions
- Columns: show_format, format_config added to shows

✅ **2. React Component**  
- Location: [frontend/src/components/GameShowComposer.jsx](frontend/src/components/GameShowComposer.jsx)
- Size: 12.5 KB
- Features: Phase timeline, character management, default structure generation

✅ **3. API Routes**
- Location: [src/routes/gameShows.js](src/routes/gameShows.js)
- Size: 4.2 KB
- Endpoints: 6 endpoints for phases, layouts, and interactive elements

✅ **4. Routes Registered**
- File: [src/app.js](src/app.js#L633)
- Status: Lines 633-642 - GameShowRoutes mounted on /api/v1/episodes and /api/v1/shows

---

## Execution Checklist

### Phase 1: Database Preparation
```bash
# Run the migration
npx sequelize-cli db:migrate

# Verify new tables
psql -U postgres -d episode_metadata -c "\dt" | grep -E "(interactive_elements|layout_templates|episode_phases|ai_interactions)"
```

### Phase 2: Update Show Configuration
```javascript
// For "Styling Adventures with Lala"
const show = await Show.findByPk('32bfbf8b-1f46-46dd-8a5d-3b705d324c1b');
show.show_format = 'game_show';
show.format_config = {
  layout_style: 'twitch',
  player_character: 'JustAWomanInHerPrime',
  ai_character: 'Lala',
  interactive_elements: true,
  has_photoshoot_phase: true,
  ui_overlay_required: true
};
await show.save();
```

### Phase 3: Create Layout Templates
```javascript
// Twitch gameplay layout
POST /api/v1/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/layouts
{
  "name": "Twitch Gameplay Layout",
  "layout_type": "twitch",
  "regions": {
    "main_feed": { "x": 20, "y": 10, "width": 60, "height": 70, "content": "player_camera" },
    "ui_panel_right": { "x": 82, "y": 10, "width": 16, "height": 80, "content": "fashion_choices" },
    "chat_overlay": { "x": 2, "y": 10, "width": 16, "height": 80, "content": "live_chat" },
    "bottom_bar": { "x": 2, "y": 82, "width": 96, "height": 16, "content": "prompts" }
  }
}

// Photoshoot cinematic layout
POST /api/v1/shows/32bfbf8b-1f46-46dd-8a5d-3b705d324c1b/layouts
{
  "name": "Photoshoot Cinematic",
  "layout_type": "cinematic",
  "regions": {
    "hero_shot": { "x": 0, "y": 0, "width": 100, "height": 100, "content": "full_screen_camera" }
  }
}
```

### Phase 4: Test Component Integration
```jsx
// In episode editor
import GameShowComposer from './components/GameShowComposer';

export default function EpisodeEditor({ episodeId, showId }) {
  return (
    <>
      {/* Other components */}
      <GameShowComposer 
        episodeId={episodeId}
        showId="32bfbf8b-1f46-46dd-8a5d-3b705d324c1b"
      />
    </>
  );
}
```

### Phase 5: Generate Default Structure
Click the "Generate Default Structure" button in GameShowComposer:
- Creates 4 phases: intro, gameplay, photoshoot, outro
- Auto-calculates timing: 30s, 480s, 60s, 30s
- Assigns character configurations
- Links layout templates

### Phase 6: Add Interactive Elements
```javascript
// Fashion choice element during gameplay
POST /api/v1/episodes/{episodeId}/interactive
{
  "element_type": "fashion_choice",
  "appears_at": 120,
  "disappears_at": 150,
  "content": {
    "prompt": "Choose your next outfit",
    "options": [
      { "id": 1, "name": "Pink Sequin Dress", "image_url": "...", "price": 299 },
      { "id": 2, "name": "Black Jumpsuit", "image_url": "...", "price": 199 }
    ],
    "timer_seconds": 30
  },
  "screen_position": { "x": 70, "y": 50, "width": 25, "height": 40 },
  "requires_input": true,
  "auto_advance_after": 30
}
```

---

## API Reference

### Phases Endpoints

**Get All Phases for Episode**
```
GET /api/v1/episodes/{episodeId}/phases
Response: { success: true, data: [...phases] }
```

**Create Phases in Bulk**
```
POST /api/v1/episodes/{episodeId}/phases/bulk
Body: {
  phases: [
    { phase_name, duration, active_characters, ... }
  ]
}
```

### Layouts Endpoints

**Get Layout Templates**
```
GET /api/v1/shows/{showId}/layouts
Response: { success: true, data: [...layouts] }
```

**Create Layout Template**
```
POST /api/v1/shows/{showId}/layouts
Body: {
  name: "Layout Name",
  layout_type: "twitch|cinematic|split_screen|etc",
  regions: { ... },
  transition_in: "slide-left",
  transition_out: "slide-right"
}
```

### Interactive Elements Endpoints

**Get Elements for Episode**
```
GET /api/v1/episodes/{episodeId}/interactive
Response: { success: true, data: [...elements] }
```

**Add Interactive Element**
```
POST /api/v1/episodes/{episodeId}/interactive
Body: {
  element_type: "fashion_choice|poll|prompt|overlay|button",
  appears_at: 120.5,
  disappears_at: 150.5,
  content: { ... },
  screen_position: { x, y, width, height },
  requires_input: true,
  auto_advance_after: 30
}
```

---

## Data Structure Examples

### Show Format Config
```json
{
  "layout_style": "twitch",
  "player_character": "JustAWomanInHerPrime",
  "ai_character": "Lala",
  "interactive_elements": true,
  "has_photoshoot_phase": true,
  "ui_overlay_required": true
}
```

### Episode Phase
```json
{
  "id": "uuid",
  "episode_id": "uuid",
  "phase_name": "gameplay",
  "start_time": 30,
  "end_time": 510,
  "layout_template_id": "uuid",
  "active_characters": {
    "player": { "visible": true, "camera": "main_feed", "control": "user" },
    "ai": { "visible": true, "camera": "overlay", "control": "system", "mode": "advisor" }
  },
  "phase_config": {}
}
```

### Interactive Element
```json
{
  "id": "uuid",
  "episode_id": "uuid",
  "element_type": "fashion_choice",
  "appears_at": 120,
  "disappears_at": 150,
  "content": {
    "prompt": "Choose your next outfit",
    "options": [...],
    "timer_seconds": 30
  },
  "screen_position": { "x": 70, "y": 50, "width": 25, "height": 40 },
  "ui_style": { "background": "rgba(0,0,0,0.7)", "border_radius": "12px" },
  "requires_input": true,
  "auto_advance_after": 30
}
```

---

## Troubleshooting

### Migration Fails
```bash
# Check if migration was already run
npx sequelize-cli db:migrate:status

# Rollback if needed
npx sequelize-cli db:migrate:undo
```

### Routes Not Loading
- Check [src/app.js](src/app.js#L633) - should have Game Show routes section
- Ensure [src/routes/gameShows.js](src/routes/gameShows.js) exists
- Server log should show "✓ Game Show routes loaded"

### Component Not Rendering
- Verify show has `show_format` set to 'game_show'
- Check browser console for API errors
- Verify episodes and shows tables have data

---

## Performance Notes

- All routes use optional auth middleware
- Eager loading of layout templates for phases
- Indexes on: (episode_id, appears_at), (show_id), (episode_id, start_time), (episode_id, trigger_time)
- JSONB columns for flexible configuration

---

## Next Features

- [ ] Real-time character positioning
- [ ] Voice sample integration  
- [ ] Interactive element preview
- [ ] Phase timeline editor UI
- [ ] Layout visual builder
- [ ] AI dialogue script editor
- [ ] Mobile responsive layouts

---

**Status: ✅ Ready for Migration and Testing**
