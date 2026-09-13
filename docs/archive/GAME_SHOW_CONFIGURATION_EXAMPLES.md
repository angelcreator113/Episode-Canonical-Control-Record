# 🎮 Game Show Configuration Examples

## Show Format Configuration

### "Styling Adventures with Lala" - Game Show Format

```javascript
// Show Configuration
{
  id: '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b',
  name: 'Styling Adventures with lala',
  show_format: 'game_show',
  format_config: {
    layout_style: 'twitch',
    player_character: 'JustAWomanInHerPrime',
    ai_character: 'Lala',
    interactive_elements: true,
    has_photoshoot_phase: true,
    ui_overlay_required: true,
    
    // Additional customization
    color_scheme: 'vibrant',
    music_track: 'upbeat_pop',
    target_audience: 'fashion_enthusiasts',
    episode_length: 600  // 10 minutes
  }
}
```

---

## Layout Template Examples

### 1. Twitch Gaming Layout
Best for: Interactive gameplay, live reactions, side panels

```javascript
{
  show_id: '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b',
  name: 'Twitch Gameplay Layout',
  layout_type: 'twitch',
  regions: {
    main_feed: {
      x: 20,
      y: 10,
      width: 60,
      height: 70,
      content: 'player_camera',
      label: 'Main Player Feed'
    },
    ui_panel_right: {
      x: 82,
      y: 10,
      width: 16,
      height: 80,
      content: 'fashion_choices',
      label: 'Fashion Options'
    },
    chat_overlay: {
      x: 2,
      y: 10,
      width: 16,
      height: 80,
      content: 'live_chat',
      label: 'Chat'
    },
    bottom_bar: {
      x: 2,
      y: 82,
      width: 96,
      height: 16,
      content: 'prompts',
      label: 'Instructions'
    }
  },
  transition_in: 'slide-left',
  transition_out: 'slide-right'
}
```

### 2. Photoshoot Cinematic Layout
Best for: Full-screen reveal, dramatic moments

```javascript
{
  show_id: '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b',
  name: 'Photoshoot Reveal Layout',
  layout_type: 'cinematic',
  regions: {
    hero_shot: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      content: 'full_screen_camera',
      label: 'Full Screen Outfit Reveal'
    },
    credit_overlay: {
      x: 5,
      y: 85,
      width: 90,
      height: 10,
      content: 'outfit_credit',
      label: 'Designer/Brand Credit'
    }
  },
  transition_in: 'fade-in',
  transition_out: 'fade-out'
}
```

### 3. Picture-in-Picture Layout
Best for: AI advisor + main action

```javascript
{
  show_id: '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b',
  name: 'AI Advisor PIP Layout',
  layout_type: 'picture_in_picture',
  regions: {
    main_content: {
      x: 0,
      y: 0,
      width: 100,
      height: 75,
      content: 'player_camera',
      label: 'Main Content'
    },
    pip_corner: {
      x: 65,
      y: 65,
      width: 30,
      height: 30,
      content: 'ai_character',
      label: 'AI Advisor (Lala)'
    }
  },
  transition_in: 'pop-in',
  transition_out: 'pop-out'
}
```

### 4. Split Screen Interview Layout
Best for: Conversation, Q&A

```javascript
{
  show_id: '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b',
  name: 'Interview Split Screen',
  layout_type: 'split_screen',
  regions: {
    speaker_left: {
      x: 0,
      y: 0,
      width: 50,
      height: 100,
      content: 'speaker_camera',
      label: 'Interviewer'
    },
    speaker_right: {
      x: 50,
      y: 0,
      width: 50,
      height: 100,
      content: 'interviewee_camera',
      label: 'Interviewee (Lala)'
    },
    bottom_info: {
      x: 0,
      y: 85,
      width: 100,
      height: 15,
      content: 'question_text',
      label: 'Current Question'
    }
  },
  transition_in: 'slide-in',
  transition_out: 'slide-out'
}
```

---

## Episode Phase Examples

### Default Game Show Structure

```javascript
// Phase 1: Intro
{
  episode_id: 'ep-uuid',
  phase_name: 'intro',
  start_time: 0,
  end_time: 30,
  layout_template_id: 'layout-cinematic-uuid',
  active_characters: {
    player: {
      visible: true,
      camera: 'main_feed',
      control: 'user',
      emotion: 'excited'
    },
    ai: {
      visible: false
    }
  },
  phase_config: {
    narration: 'Welcome to Styling Adventures with Lala!',
    background_music: 'upbeat',
    duration_locked: true
  }
}

// Phase 2: Gameplay
{
  episode_id: 'ep-uuid',
  phase_name: 'gameplay',
  start_time: 30,
  end_time: 510,  // 8 minutes of gameplay
  layout_template_id: 'layout-twitch-uuid',
  active_characters: {
    player: {
      visible: true,
      camera: 'main_feed',
      control: 'user',
      emotion: 'focused'
    },
    ai: {
      visible: true,
      camera: 'overlay',
      control: 'system',
      mode: 'fashion_advisor',
      behavior: 'encouraging'
    }
  },
  phase_config: {
    interactive_elements_enabled: true,
    choice_timer: 30,
    ai_feedback_enabled: true,
    difficulty_level: 'medium'
  }
}

// Phase 3: Photoshoot
{
  episode_id: 'ep-uuid',
  phase_name: 'photoshoot',
  start_time: 510,
  end_time: 570,  // 1 minute photoshoot
  layout_template_id: 'layout-cinematic-uuid',
  active_characters: {
    player: {
      visible: true,
      camera: 'full_screen',
      control: 'user',
      emotion: 'confident'
    },
    ai: {
      visible: false
    }
  },
  phase_config: {
    lighting: 'professional',
    camera_angle: 'front_60',
    music: 'triumphant',
    duration_locked: true
  }
}

// Phase 4: Outro
{
  episode_id: 'ep-uuid',
  phase_name: 'outro',
  start_time: 570,
  end_time: 600,
  layout_template_id: 'layout-cinematic-uuid',
  active_characters: {
    player: {
      visible: true,
      camera: 'main_feed',
      control: 'user',
      emotion: 'satisfied'
    },
    ai: {
      visible: true,
      camera: 'overlay',
      control: 'system',
      mode: 'congratulator'
    }
  },
  phase_config: {
    summary_text: 'You successfully styled 3 outfits!',
    next_episode_teaser: true
  }
}
```

---

## Interactive Element Examples

### Fashion Choice Element

```javascript
{
  episode_id: 'ep-uuid',
  element_type: 'fashion_choice',
  appears_at: 120,
  disappears_at: 150,
  
  content: {
    prompt: 'Choose your next outfit:',
    options: [
      {
        id: 1,
        name: 'Pink Sequin Dress',
        image_url: 's3://bucket/dress-pink.jpg',
        price: 299,
        designer: 'Luxury Fashion Co',
        description: 'Perfect for evening wear'
      },
      {
        id: 2,
        name: 'Black Jumpsuit',
        image_url: 's3://bucket/jumpsuit-black.jpg',
        price: 199,
        designer: 'Contemporary Wear',
        description: 'Versatile and elegant'
      },
      {
        id: 3,
        name: 'White Summer Dress',
        image_url: 's3://bucket/dress-white.jpg',
        price: 149,
        designer: 'Casual Line',
        description: 'Fresh and comfortable'
      }
    ],
    timer_seconds: 30,
    show_countdown: true,
    ai_hint_available: true
  },
  
  screen_position: {
    x: 70,
    y: 50,
    width: 25,
    height: 40
  },
  
  ui_style: {
    background: 'rgba(0, 0, 0, 0.7)',
    border: '2px solid #667eea',
    border_radius: '12px',
    padding: '16px',
    font_family: 'Montserrat, sans-serif',
    accent_color: '#667eea'
  },
  
  requires_input: true,
  auto_advance_after: 30  // Auto-advance to next element if no choice made
}
```

### Poll Element

```javascript
{
  episode_id: 'ep-uuid',
  element_type: 'poll',
  appears_at: 200,
  disappears_at: 230,
  
  content: {
    question: 'What\'s your favorite styling tip?',
    options: [
      { id: 1, text: 'Color coordination', votes: 1250 },
      { id: 2, text: 'Fit and proportion', votes: 980 },
      { id: 3, text: 'Accessorizing', votes: 750 },
      { id: 4, text: 'Texture mixing', votes: 620 }
    ],
    results_visible: true,
    multiple_choice: false,
    timer_seconds: 30
  },
  
  screen_position: {
    x: 15,
    y: 80,
    width: 70,
    height: 18
  },
  
  ui_style: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text_color: 'white',
    border_radius: '8px',
    padding: '12px'
  },
  
  requires_input: false,  // Poll doesn't require interaction
  auto_advance_after: 30
}
```

### Prompt/Info Element

```javascript
{
  episode_id: 'ep-uuid',
  element_type: 'prompt',
  appears_at: 50,
  disappears_at: 80,
  
  content: {
    text: 'Match the outfit to the occasion',
    hint: 'Think about the weather and activity',
    difficulty: 'easy'
  },
  
  screen_position: {
    x: 35,
    y: 5,
    width: 30,
    height: 8
  },
  
  ui_style: {
    background: 'rgba(255, 193, 7, 0.9)',
    border: '2px solid #FFC107',
    border_radius: '4px',
    font_size: '16px',
    font_weight: 'bold',
    text_align: 'center'
  },
  
  requires_input: false,
  auto_advance_after: 30
}
```

### Button Overlay

```javascript
{
  episode_id: 'ep-uuid',
  element_type: 'button',
  appears_at: 100,
  disappears_at: 130,
  
  content: {
    label: 'Get AI Advice',
    action: 'request_ai_feedback',
    feedback_text: 'Lala: That outfit is fabulous! The colors complement your skin tone perfectly.'
  },
  
  screen_position: {
    x: 80,
    y: 60,
    width: 15,
    height: 6
  },
  
  ui_style: {
    background: '#667eea',
    text_color: 'white',
    border_radius: '6px',
    padding: '8px 16px',
    cursor: 'pointer',
    hover_background: '#764ba2'
  },
  
  requires_input: true,
  auto_advance_after: null  // Manual click only
}
```

---

## AI Interaction Examples

### Fashion Advisor Interaction

```javascript
{
  episode_id: 'ep-uuid',
  character_id: 'char-lala-uuid',
  
  trigger_time: 120,  // At 2:00 in episode
  
  interaction_type: 'advice',
  
  ai_dialogue: 'That pink dress looks amazing! But have you considered pairing it with these gold accessories? It would really make the outfit pop!',
  
  visual_treatment: 'hologram',  // Options: hologram, screen_overlay, avatar, voice_only
  
  voice_sample_id: 'voice-lala-advice-001',
  voice_settings: {
    speed: 1.0,
    tone: 'encouraging',
    intensity: 'normal'
  },
  
  duration: 8,  // Spoken word duration in seconds
  
  associated_actions: [
    { type: 'show_product', product_id: 'gold-accessory-set' }
  ]
}
```

### Challenge Interaction

```javascript
{
  episode_id: 'ep-uuid',
  character_id: 'char-lala-uuid',
  
  trigger_time: 300,
  
  interaction_type: 'challenge',
  
  ai_dialogue: 'I dare you to style an outfit using only patterns! Can you do it without clashing?',
  
  visual_treatment: 'screen_overlay',
  
  voice_sample_id: 'voice-lala-challenge-001',
  
  challenge_config: {
    constraint: 'patterns_only',
    time_limit: 60,
    reward: 'bonus_points',
    difficulty: 'hard'
  }
}
```

### Feedback Interaction

```javascript
{
  episode_id: 'ep-uuid',
  character_id: 'char-lala-uuid',
  
  trigger_time: 420,  // User just completed a choice
  
  interaction_type: 'feedback',
  
  ai_dialogue: 'Excellent choice! You\'ve demonstrated great color theory understanding. This combination will definitely turn heads!',
  
  visual_treatment: 'avatar',
  
  voice_sample_id: 'voice-lala-positive-feedback-001',
  
  feedback_config: {
    sentiment: 'positive',
    points_awarded: 100,
    streak_continue: true
  }
}
```

---

## Database Query Examples

### Get All Phases for Episode

```sql
SELECT * FROM episode_phases
WHERE episode_id = 'ep-uuid'
ORDER BY start_time ASC;
```

### Get Interactive Elements in Timeline

```sql
SELECT * FROM interactive_elements
WHERE episode_id = 'ep-uuid'
AND appears_at >= 0
AND disappears_at <= 600
ORDER BY appears_at ASC;
```

### Get Layouts for Show

```sql
SELECT * FROM layout_templates
WHERE show_id = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b'
ORDER BY name ASC;
```

### Get AI Interactions Timeline

```sql
SELECT ai.*, cp.name as character_name
FROM ai_interactions ai
LEFT JOIN character_profiles cp ON ai.character_id = cp.id
WHERE ai.episode_id = 'ep-uuid'
ORDER BY ai.trigger_time ASC;
```

---

## API Request/Response Examples

### POST Create Phases Bulk

**Request:**
```bash
curl -X POST http://localhost:3002/api/v1/episodes/ep-uuid/phases/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "phases": [
      {
        "phase_name": "intro",
        "duration": 30,
        "active_characters": {
          "player": { "visible": true, "camera": "main_feed", "control": "user" }
        }
      },
      {
        "phase_name": "gameplay",
        "duration": 480,
        "active_characters": {
          "player": { "visible": true, "camera": "main_feed", "control": "user" },
          "ai": { "visible": true, "camera": "overlay", "control": "system", "mode": "advisor" }
        }
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "phase-uuid-1",
      "episode_id": "ep-uuid",
      "phase_name": "intro",
      "start_time": 0,
      "end_time": 30,
      "active_characters": {...},
      "created_at": "2026-02-09T00:30:00Z",
      "updated_at": "2026-02-09T00:30:00Z"
    },
    {
      "id": "phase-uuid-2",
      "episode_id": "ep-uuid",
      "phase_name": "gameplay",
      "start_time": 30,
      "end_time": 510,
      "active_characters": {...},
      "created_at": "2026-02-09T00:30:00Z",
      "updated_at": "2026-02-09T00:30:00Z"
    }
  ]
}
```

### POST Create Layout Template

**Request:**
```bash
curl -X POST http://localhost:3002/api/v1/shows/show-uuid/layouts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Twitch Gameplay Layout",
    "layout_type": "twitch",
    "regions": {...},
    "transition_in": "slide-left",
    "transition_out": "slide-right"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "layout-uuid",
    "show_id": "show-uuid",
    "name": "Twitch Gameplay Layout",
    "layout_type": "twitch",
    "regions": {...},
    "transition_in": "slide-left",
    "transition_out": "slide-right",
    "created_at": "2026-02-09T00:31:00Z",
    "updated_at": "2026-02-09T00:31:00Z"
  }
}
```

---

## Notes

- All timestamps are in **decimal seconds** (e.g., 120.5 = 2:00.5)
- Screen positions are **percentages** (0-100)
- Format config is **extensible** - add show-specific properties as needed
- Character control: `'user'` (player controls), `'system'` (AI controls)
- Interactive elements are rendered **in order of appearance**
- Auto-advance only works if `requires_input: false`

---

**Status:** ✅ Complete Configuration Reference
