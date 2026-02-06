-- Migration: Add start_time_seconds to episode_scenes
-- Calculates absolute timeline position for each scene based on cumulative duration

-- Step 1: Add column if it doesn't exist
ALTER TABLE episode_scenes 
ADD COLUMN IF NOT EXISTS start_time_seconds NUMERIC(10, 3) DEFAULT 0;

-- Step 2: Update start_time_seconds for each scene
-- Uses window function to calculate cumulative sum of previous scenes' durations
WITH scene_positions AS (
  SELECT 
    id,
    episode_id,
    scene_order,
    duration_seconds,
    -- Calculate cumulative start time (sum of all previous scenes' durations)
    COALESCE(
      SUM(duration_seconds) OVER (
        PARTITION BY episode_id 
        ORDER BY scene_order 
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) as calculated_start_time
  FROM episode_scenes
)
UPDATE episode_scenes es
SET start_time_seconds = sp.calculated_start_time
FROM scene_positions sp
WHERE es.id = sp.id
  AND (es.start_time_seconds IS NULL 
       OR es.start_time_seconds = 0 
       OR ABS(es.start_time_seconds - sp.calculated_start_time) > 0.001);

-- Step 3: Verify migration
SELECT 
  e.title as episode_title,
  COUNT(es.id) as total_scenes,
  COUNT(es.start_time_seconds) FILTER (WHERE es.start_time_seconds >= 0) as scenes_with_start_time,
  MAX(es.start_time_seconds + es.duration_seconds) as total_duration_seconds
FROM episodes e
LEFT JOIN episode_scenes es ON e.id = es.episode_id
GROUP BY e.id, e.title
ORDER BY e.created_at DESC;

-- Step 4: Sample output - first 5 scenes per episode
SELECT 
  e.title as episode_title,
  es.scene_order,
  es.title_override,
  es.start_time_seconds,
  es.duration_seconds,
  (es.start_time_seconds + es.duration_seconds) as end_time_seconds
FROM episode_scenes es
JOIN episodes e ON es.episode_id = e.id
WHERE es.scene_order <= 5
ORDER BY e.created_at DESC, es.scene_order ASC
LIMIT 20;
