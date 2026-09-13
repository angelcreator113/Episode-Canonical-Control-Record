# Week 3 Day 3 - YouTube Analysis System

## Backend Validation
- [x] `ai_training_data` table exists in database
- [x] `ytdl-core` package installed
- [x] `src/services/youtubeService.js` created
- [x] `src/services/claudeService.js` created
- [x] `src/routes/youtube.js` created
- [x] Routes registered in `src/app.js`
- [x] S3_TRAINING_BUCKET in .env

## API Endpoints Working
- [ ] POST /api/youtube/analyze (full workflow)
- [ ] GET /api/youtube/metadata (quick preview)
- [ ] GET /api/youtube/library (list all)
- [ ] GET /api/youtube/:id (single video)
- [ ] DELETE /api/youtube/:id (delete video)

## Frontend Validation
- [ ] `YouTubeAnalyzer.jsx` component created
- [ ] Component added to EpisodeDetail page
- [ ] "YouTube Training" tab appears
- [ ] Can paste YouTube URL
- [ ] Preview shows metadata
- [ ] Analyze button works
- [ ] Progress indicator shows
- [ ] Results display correctly

## Full Workflow Test
1. [ ] Navigate to any episode
2. [ ] Click "YouTube Training" tab
3. [ ] Paste a YouTube URL (suggest short video for testing)
4. [ ] Click "Preview" - should show thumbnail, title, stats
5. [ ] Click "Analyze with AI" - should show processing
6. [ ] Wait 2-5 minutes (depending on video size)
7. [ ] Results should show:
   - [ ] Content style
   - [ ] Pacing
   - [ ] Tone
   - [ ] Key topics
   - [ ] Style summary
8. [ ] Can view full JSON analysis
9. [ ] Can analyze another video

## Database Verification
```sql
SELECT 
  id,
  video_id,
  source_type,
  video_title,
  s3_key,
  pacing_rhythm,
  is_user_style,
  analyzed_at,
  created_at
FROM ai_training_data
WHERE source_type = 'youtube'
ORDER BY created_at DESC;
```

## Troubleshooting
- If download fails: Check YouTube video is not age-restricted or private
- If S3 upload fails: Verify AWS credentials and bucket exists
- If Claude fails: Check ANTHROPIC_API_KEY in .env
- If slow: YouTube downloads can be 100-500MB, be patient
- If metadata extraction fails: Try different video (some are blocked)

## Success Criteria
✅ Can analyze YouTube video end-to-end
✅ Video stored in S3 training bucket
✅ AI analysis saved to database
✅ Results display in UI
✅ Can analyze multiple videos

## Status Summary

### ✅ COMPLETED (Backend)
- Database table verified
- Dependencies installed (ytdl-core, @anthropic-ai/sdk)
- YouTubeService created (350 lines)
- ClaudeService exists
- API routes created (150 lines)
- Routes registered in app.js
- Environment variables configured

### 🟡 PENDING (Testing & Frontend)
- API endpoints need server restart to test
- Frontend component needs creation
- UI integration needed
- End-to-end workflow testing

### 📝 NOTES
- Backend structure complete and ready
- ytdl-core may have YouTube API rate limiting issues
- Consider fallback to yt-dlp for production
- S3 bucket must exist: episode-metadata-training
- Videos can be 100MB-1GB+ depending on quality
