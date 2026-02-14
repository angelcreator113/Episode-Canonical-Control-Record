# Animatic Player Integration Guide

## Overview
The Animatic Player provides professional multi-track video preview with audio mixing for your animatic system. This guide shows how to integrate it into your Scene Composer.

## Files Created
- `frontend/src/components/Episodes/SceneComposer/AnimaticPlayer.jsx` - Main player component
- `frontend/src/components/Episodes/SceneComposer/AnimaticPlayer.css` - Player styling
- `frontend/src/components/Episodes/SceneComposer/AnimaticPreview.jsx` - Integration wrapper

## Quick Integration

### Option 1: Add to Scene Composer

Add a "Preview Animatic" button to your Scene Composer component:

```jsx
// In SceneComposer.jsx or similar
import React, { useState } from 'react';
import AnimaticPreview from './AnimaticPreview';

function SceneComposer({ sceneId }) {
  const [showAnimatic, setShowAnimatic] = useState(false);

  return (
    <div className="scene-composer">
      {/* Your existing scene editing UI */}
      <div className="scene-composer-header">
        <h2>Scene Editor</h2>
        <button 
          className="preview-animatic-btn"
          onClick={() => setShowAnimatic(true)}
        >
          🎬 Preview Animatic
        </button>
      </div>

      {/* Timeline, controls, etc. */}
      
      {/* Animatic Player Modal */}
      {showAnimatic && (
        <AnimaticPreview 
          sceneId={sceneId}
          onClose={() => setShowAnimatic(false)}
        />
      )}
    </div>
  );
}

export default SceneComposer;
```

### Option 2: Add to Timeline Component

Integrate directly into the Timeline view:

```jsx
// In TimelineView.jsx
import React, { useState } from 'react';
import AnimaticPreview from '../AnimaticPreview';

function TimelineView({ sceneId, beats, characterClips, audioClips }) {
  const [showPlayer, setShowPlayer] = useState(false);

  return (
    <div className="timeline-view">
      {/* Timeline tracks */}
      <div className="timeline-header">
        <button onClick={() => setShowPlayer(true)}>
          ▶ Play Animatic
        </button>
      </div>

      {/* Rest of timeline UI */}

      {showPlayer && (
        <AnimaticPreview 
          sceneId={sceneId}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}
```

## How It Works

### 1. User Clicks "Preview Animatic"
- `AnimaticPreview` component is rendered
- Calls `/api/v1/scenes/:sceneId/composition` endpoint

### 2. Data Loading
- Fetches scene metadata (title, duration, background)
- Loads all beats, character clips, and audio clips
- Parses composition structure

### 3. Player Initialization
- `AnimaticPlayer` receives parsed data
- Preloads video clips (character videos)
- Preloads audio clips (dialogue, music, SFX)
- Initializes Web Audio API for mixing

### 4. Playback
- Canvas renders at 1920x1080
- 30 FPS animation loop
- Audio tracks sync with timeline
- Video clips composite in real-time

## Features

### Video Compositing
- Multiple character video tracks
- Background layer
- UI overlay layer
- Placeholder rendering for missing videos

### Audio Mixing
- Independent volume control per track type
- Dialogue, ambience, music, SFX channels
- Real-time mixing via Web Audio API
- Time-accurate playback synchronization

### Timeline Controls
- Play/Pause/Stop buttons
- Seek to start/end
- Scrubber for manual seeking
- Frame-accurate timecode display

### Track Visibility
- Toggle background on/off
- Toggle characters on/off
- Toggle UI elements on/off
- Maintains audio even when tracks hidden

### Export (Coming Soon)
- Export composited video as MP4
- Include all audio tracks mixed
- Preserve timeline structure

## API Requirements

The player requires these endpoints (already implemented):

```
GET /api/v1/scenes/:sceneId/composition
```

**Response format:**
```json
{
  "success": true,
  "data": {
    "scene_id": "uuid",
    "scene_title": "Scene Title",
    "duration_seconds": 30.5,
    "composition": {
      "beats": [...],
      "character_clips": [...],
      "audio_clips": [...]
    }
  }
}
```

## CSS Customization

The player is styled with variables that can be overridden:

```css
/* In your main stylesheet */
.animatic-player {
  --primary-color: #3b82f6;
  --accent-color: #10b981;
  --bg-color: #0a0a0a;
  --header-bg: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}
```

## Browser Compatibility

Requires:
- Web Audio API (all modern browsers)
- HTML5 Canvas (all modern browsers)
- ES6+ JavaScript support
- Async/await support

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Tips

### For Better Performance:
1. **Preload videos**: Ensure video URLs are accessible and fast
2. **Optimize video size**: Use compressed formats (H.264)
3. **Limit concurrent tracks**: Keep character clips under 4 simultaneous
4. **Audio format**: Use MP3 or AAC for best compatibility

### Canvas Rendering:
- Renders at native 1920x1080 but scales to fit screen
- Uses `requestAnimationFrame` for smooth playback
- Reuses video elements for efficiency

## Troubleshooting

### "Failed to load video"
- Check video URL accessibility
- Verify CORS headers on video server
- Ensure video format is supported (H.264/MP4 recommended)

### "Audio not playing"
- Browser may require user interaction before audio plays
- Check volume settings (both player and browser)
- Verify audio URLs are accessible

### "Player not appearing"
- Check that scene has composition data
- Verify API endpoint returns valid data
- Check browser console for errors

## Example Scene Structure

For the player to work optimally, ensure your scenes have:

```javascript
// Beats with timing
{
  "beat_type": "dialogue",
  "start_time": 0.0,
  "duration": 3.5,
  "label": "LaLa introduces topic"
}

// Character clips with video URLs
{
  "character_id": "uuid",
  "role": "dialogue",
  "start_time": 0.0,
  "duration": 3.5,
  "video_url": "https://cdn.example.com/clips/lala-intro.mp4",
  "expression": "excited"
}

// Audio clips with URLs
{
  "track_type": "dialogue",
  "start_time": 0.0,
  "duration": 3.5,
  "url": "https://cdn.example.com/audio/lala-intro.mp3"
}
```

## Next Steps

1. **Add button to your Scene Composer** - Use the integration code above
2. **Generate beats** - Use POST `/api/v1/scenes/:sceneId/beats/generate`
3. **Add video URLs** - Assign video_url to character clips
4. **Add audio URLs** - Assign url to audio clips
5. **Test the player** - Click "Preview Animatic"

## Support

For issues or questions:
- Check Phase 2.5 documentation: `PHASE_2.5_ANIMATIC_SYSTEM_COMPLETE.md`
- Run tests: `node test-animatic-routes.js`
- Check API logs for composition endpoint errors

---

**Ready to preview your animatics!** 🎬
