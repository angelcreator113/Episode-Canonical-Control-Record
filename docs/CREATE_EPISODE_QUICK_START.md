# Create Episode - Quick Start Guide 🚀

## What Changed?

Your Create Episode form now collects **comprehensive production metadata** to support multi-platform distribution, content planning, and team collaboration.

---

## New Information You Can Capture

### 1. 🌐 Distribution & Platforms
**Most Important Addition!**

- Select target platforms (YouTube, TikTok, Instagram, etc.)
- Choose content strategy:
  - Same everywhere
  - Same visuals, different captions  
  - Fully customized per platform
- Add platform-specific descriptions, hashtags, and CTAs

**Why it matters**: Determines aspect ratios, safe areas, templates, and export settings for Scene Composer.

---

### 2. 🎬 Content Intent
- Content type: Trailer, Main Show, Behind the Scenes, etc.
- Tone: Playful, Educational, Dramatic, etc.
- Primary audience

**Why it matters**: Influences pacing, templates, music suggestions, and caption style.

---

### 3. 🏗️ Episode Structure
- Has intro/outro/CTA
- Has recurring segment
- Has sponsor moment

**Why it matters**: Pre-creates scene slots and suggests templates.

---

### 4. 🎨 Visual Requirements
- Brand safe colors only
- Must include logo
- Avoid text near edges

**Why it matters**: Shows warnings in Scene Composer when constraints are violated.

---

### 5. 👥 Team & Approvals
- Owner/creator
- Collaborators
- Needs approval before publish

**Why it matters**: Future-proofs for approval workflows and collaboration features.

---

## How to Use

### Step 1: Create the Database Schema
```bash
# Run the migration
psql -U your_user -d your_database -f add-episode-distribution-metadata.sql
```

### Step 2: Restart Your Backend
The controller already accepts all new fields!

### Step 3: Try It Out
1. Navigate to `/episodes/create`
2. Fill in title and show (required)
3. Expand the new sections:
   - Distribution & Platforms
   - Content Intent
   - Structure
   - Visual Requirements
   - Team & Approvals
4. Create episode

---

## API Changes

### Request Body (New Fields)
```json
{
  "title": "Winter Lookbook Ep 1",
  "show_id": "uuid-here",
  
  // NEW: Distribution
  "platforms": {
    "youtube": true,
    "tiktok": true,
    "instagramReels": true
  },
  "content_strategy": "same-visuals-diff-captions",
  "platform_descriptions": {
    "youtube": {
      "description": "Full winter lookbook with styling tips",
      "hashtags": "#fashion #winter #style",
      "cta": "Subscribe for more!"
    },
    "tiktok": {
      "description": "Winter fashion inspo ❄️",
      "hashtags": "#WinterFashion #OOTD",
      "cta": "Follow for daily looks"
    }
  },
  
  // NEW: Content Intent
  "content_types": {
    "mainShow": true,
    "trailer": false
  },
  "tones": {
    "playful": true,
    "inspirational": true
  },
  "primary_audience": "Fashion enthusiasts 18-35",
  
  // NEW: Structure
  "structure": {
    "hasIntro": true,
    "hasOutro": true,
    "hasCTA": true
  },
  
  // NEW: Visual Requirements
  "visual_requirements": {
    "brandSafeColors": true,
    "mustIncludeLogo": true,
    "avoidTextNearEdges": true
  },
  
  // NEW: Ownership
  "owner_creator": "Jane Doe",
  "needs_approval": true,
  "collaborators": "John Smith, Alice Johnson"
}
```

### Response (Unchanged)
Same as before - returns the created episode with all fields.

---

## Database Schema

All new fields default to safe values, so existing episodes won't break:

```sql
-- JSONB fields (flexible, queryable)
platforms JSONB DEFAULT '{}'
platform_descriptions JSONB DEFAULT '{}'
content_types JSONB DEFAULT '{}'
tones JSONB DEFAULT '{}'
structure JSONB DEFAULT '{}'
visual_requirements JSONB DEFAULT '{}'

-- String fields
platforms_other VARCHAR(255)
content_strategy VARCHAR(50) DEFAULT 'same-everywhere'
primary_audience TEXT
owner_creator VARCHAR(255)
collaborators TEXT

-- Boolean
needs_approval BOOLEAN DEFAULT FALSE
```

---

## Progressive Disclosure

The form intelligently shows/hides sections:

1. **Platform selection** → Shows content strategy options
2. **Content strategy ≠ "same everywhere"** → Shows platform descriptions
3. All optional sections are clearly labeled
4. Progress bar updates in real-time

---

## Future Capabilities

These fields unlock powerful features:

### Short Term
- Filter Scene Composer templates by content type
- Show safe area guides based on platforms
- Auto-suggest aspect ratios

### Medium Term
- Platform-specific exports
- Approval workflows
- Collaboration features

### Long Term
- AI-powered suggestions
- Cross-platform publishing scheduler
- Analytics by platform/type/tone

---

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Backend accepts new fields without errors
- [ ] Frontend renders all new sections
- [ ] Checkboxes and radios work correctly
- [ ] Platform descriptions show/hide properly
- [ ] Progress bar updates correctly
- [ ] Form submits successfully
- [ ] Created episode includes new fields

---

## Files Changed

### Frontend
- `frontend/src/pages/CreateEpisode.jsx` - Added 5 new sections
- `frontend/src/styles/EpisodeForm.css` - Added checkbox/radio styles

### Backend
- `src/controllers/episodeController.js` - Accepts new fields
- `add-episode-distribution-metadata.sql` - Database migration

### Documentation
- `CREATE_EPISODE_ENHANCEMENTS.md` - Detailed implementation guide
- `CREATE_EPISODE_QUICK_START.md` - This guide

---

## Common Issues

### Issue: Platform descriptions not showing
**Solution**: Make sure you selected platforms AND chose a content strategy other than "same-everywhere"

### Issue: Form validation blocks submission
**Solution**: Only Title and Show are required. All new fields are optional.

### Issue: Database errors on submission
**Solution**: Run the migration script first: `add-episode-distribution-metadata.sql`

### Issue: Fields not saving
**Solution**: Check that backend controller has been updated and restarted

---

## Quick Commands

```bash
# Run database migration
psql -U postgres -d episode_control -f add-episode-distribution-metadata.sql

# Restart backend (if using nodemon)
# It should auto-restart, but if not:
npm run dev

# Check frontend in browser
# Navigate to: http://localhost:5174/episodes/create
```

---

## Support

If you encounter issues:
1. Check browser console for frontend errors
2. Check backend logs for API errors
3. Verify database migration ran successfully
4. Ensure all files were updated correctly

---

**Status**: ✅ Ready to Use  
**Version**: 1.0  
**Last Updated**: February 4, 2026
