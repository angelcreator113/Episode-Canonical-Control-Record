-- Scene trim columns already exist in episode_scenes table (trim_start, trim_end)
-- This script initializes existing scenes with default trim values

-- Initialize existing scenes with trim values where not already set
-- Set trim_start = 0, trim_end = libraryScene.duration_seconds for scenes with video
UPDATE episode_scenes es
SET trim_start = COALESCE(trim_start, 0.0),
    trim_end = COALESCE(trim_end, sl.duration_seconds)
FROM scene_library sl
WHERE es.scene_library_id = sl.id
  AND sl.duration_seconds IS NOT NULL
  AND (es.trim_start IS NULL OR es.trim_end IS NULL);

-- For scenes with images or explicit duration, ensure trim_start is initialized
UPDATE episode_scenes
SET trim_start = COALESCE(trim_start, 0.0)
WHERE trim_start IS NULL;

-- Note: trim_start and trim_end are already defined as DECIMAL(10,3) in the model
-- trim_start: Trim start point in seconds (0 = beginning of source)
-- trim_end: Trim end point in seconds (NULL = use full source duration)
