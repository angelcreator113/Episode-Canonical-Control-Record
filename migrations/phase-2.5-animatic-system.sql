-- Migration: Phase 2.5 - Animatic System
-- Description: Add tables for beats (script→timeline bridge), character clips, and audio clips
-- Version: 2.5.0
-- Date: 2026-02-10

-- ==========================================
-- BEATS TABLE (Script → Timeline Bridge)
-- ==========================================
-- Purpose: Auto-generated timing beats from script
-- Links script lines to timeline positions

CREATE TABLE IF NOT EXISTS beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  beat_type TEXT NOT NULL CHECK (beat_type IN ('dialogue', 'ui_action', 'sfx', 'music', 'cta', 'transition')),
  character_id UUID, -- Nullable, can reference character_profiles or be NULL for non-character beats
  label TEXT NOT NULL, -- e.g., "LaLa asks question", "Subscribe CTA"
  start_time FLOAT NOT NULL CHECK (start_time >= 0), -- Scene-relative seconds
  duration FLOAT NOT NULL CHECK (duration > 0), -- How long beat lasts
  payload JSONB DEFAULT '{}', -- Flexible data: {line: "How are you?", emotion: "curious", script_line_id: 123}
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'locked', 'approved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_beats_scene ON beats(scene_id);
CREATE INDEX idx_beats_character ON beats(character_id) WHERE character_id IS NOT NULL;
CREATE INDEX idx_beats_type ON beats(beat_type);
CREATE INDEX idx_beats_status ON beats(status);
CREATE INDEX idx_beats_time ON beats(scene_id, start_time); -- For timeline queries

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_beats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beats_updated_at_trigger
  BEFORE UPDATE ON beats
  FOR EACH ROW
  EXECUTE FUNCTION update_beats_updated_at();

COMMENT ON TABLE beats IS 'Auto-generated timing beats linking script to timeline';
COMMENT ON COLUMN beats.payload IS 'Flexible JSONB: {line, emotion, script_line_id, notes}';

-- ==========================================
-- CHARACTER CLIPS TABLE (Per-Character Assembly)
-- ==========================================
-- Purpose: Video clips for each character in each scene
-- Enables per-character editing workflow

CREATE TABLE IF NOT EXISTS character_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID NOT NULL, -- Can reference character_profiles or be a placeholder ID
  beat_id UUID REFERENCES beats(id) ON DELETE SET NULL, -- Link to script beat
  role TEXT NOT NULL CHECK (role IN ('dialogue', 'reaction', 'idle', 'transition', 'placeholder')),
  start_time FLOAT NOT NULL CHECK (start_time >= 0), -- Scene-relative seconds
  duration FLOAT NOT NULL CHECK (duration > 0),
  video_url TEXT, -- S3 URL to video clip (NULL for placeholders)
  expression TEXT, -- e.g., interested, skeptical, amused, neutral, excited
  animation_type TEXT, -- For idle clips: listening, thinking, reacting
  metadata JSONB DEFAULT '{}', -- {trim_in: 0.1, hold_frames: 5, effects: [...], generation_params: {...}}
  status TEXT DEFAULT 'placeholder' CHECK (status IN ('placeholder', 'generated', 'approved', 'needs_regen')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_character_clips_scene ON character_clips(scene_id);
CREATE INDEX idx_character_clips_character ON character_clips(character_id);
CREATE INDEX idx_character_clips_beat ON character_clips(beat_id) WHERE beat_id IS NOT NULL;
CREATE INDEX idx_character_clips_role ON character_clips(role);
CREATE INDEX idx_character_clips_time ON character_clips(scene_id, start_time); -- For timeline queries
CREATE INDEX idx_character_clips_status ON character_clips(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_character_clips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER character_clips_updated_at_trigger
  BEFORE UPDATE ON character_clips
  FOR EACH ROW
  EXECUTE FUNCTION update_character_clips_updated_at();

COMMENT ON TABLE character_clips IS 'Video clips for each character, enabling per-character editing';
COMMENT ON COLUMN character_clips.role IS 'dialogue: speaking | reaction: responding | idle: listening/thinking | transition: movement';
COMMENT ON COLUMN character_clips.metadata IS 'Flexible JSONB: {trim_in, hold_frames, effects, generation_params}';

-- ==========================================
-- AUDIO CLIPS TABLE (TTS → Real VO Path)
-- ==========================================
-- Purpose: Audio tracks for dialogue, ambience, music, SFX
-- Supports TTS now, real voice-over swap later

CREATE TABLE IF NOT EXISTS audio_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  beat_id UUID REFERENCES beats(id) ON DELETE SET NULL, -- Link to dialogue beat
  track_type TEXT NOT NULL CHECK (track_type IN ('dialogue', 'ambience', 'music', 'sfx', 'foley')),
  start_time FLOAT NOT NULL CHECK (start_time >= 0), -- Scene-relative seconds
  duration FLOAT NOT NULL CHECK (duration > 0),
  url TEXT NOT NULL, -- S3 URL to audio file
  metadata JSONB DEFAULT '{}', -- {volume: 0.8, source: "tts", voice: "alloy", fade_in: 0.5, fade_out: 0.5}
  status TEXT DEFAULT 'tts' CHECK (status IN ('tts', 'temp_recording', 'final', 'needs_replacement')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audio_clips_scene ON audio_clips(scene_id);
CREATE INDEX idx_audio_clips_beat ON audio_clips(beat_id) WHERE beat_id IS NOT NULL;
CREATE INDEX idx_audio_clips_type ON audio_clips(track_type);
CREATE INDEX idx_audio_clips_time ON audio_clips(scene_id, start_time); -- For timeline queries
CREATE INDEX idx_audio_clips_status ON audio_clips(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_audio_clips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_clips_updated_at_trigger
  BEFORE UPDATE ON audio_clips
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_clips_updated_at();

COMMENT ON TABLE audio_clips IS 'Audio tracks: dialogue (TTS→VO), ambience, music, SFX';
COMMENT ON COLUMN audio_clips.metadata IS 'Flexible JSONB: {volume, source, voice, fade_in, fade_out, waveform_data}';

-- ==========================================
-- HELPER VIEWS
-- ==========================================

-- View: Complete scene composition (all tracks combined)
CREATE OR REPLACE VIEW scene_composition AS
SELECT 
  s.id AS scene_id,
  s.title AS scene_title,
  s.duration_seconds,
  jsonb_build_object(
    'beats', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'type', b.beat_type,
        'label', b.label,
        'start_time', b.start_time,
        'duration', b.duration,
        'character_id', b.character_id,
        'payload', b.payload
      ) ORDER BY b.start_time)
      FROM beats b
      WHERE b.scene_id = s.id
    ),
    'character_clips', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', cc.id,
        'character_id', cc.character_id,
        'role', cc.role,
        'start_time', cc.start_time,
        'duration', cc.duration,
        'video_url', cc.video_url,
        'status', cc.status
      ) ORDER BY cc.character_id, cc.start_time)
      FROM character_clips cc
      WHERE cc.scene_id = s.id
    ),
    'audio_clips', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ac.id,
        'track_type', ac.track_type,
        'start_time', ac.start_time,
        'duration', ac.duration,
        'url', ac.url,
        'status', ac.status
      ) ORDER BY ac.track_type, ac.start_time)
      FROM audio_clips ac
      WHERE ac.scene_id = s.id
    )
  ) AS composition
FROM scenes s;

COMMENT ON VIEW scene_composition IS 'Complete scene composition including all beats, character clips, and audio';

-- ==========================================
-- ROLLBACK
-- ==========================================

-- To rollback this migration:
/*
DROP VIEW IF EXISTS scene_composition;
DROP TRIGGER IF EXISTS audio_clips_updated_at_trigger ON audio_clips;
DROP TRIGGER IF EXISTS character_clips_updated_at_trigger ON character_clips;
DROP TRIGGER IF EXISTS beats_updated_at_trigger ON beats;
DROP FUNCTION IF EXISTS update_audio_clips_updated_at();
DROP FUNCTION IF EXISTS update_character_clips_updated_at();
DROP FUNCTION IF EXISTS update_beats_updated_at();
DROP TABLE IF EXISTS audio_clips;
DROP TABLE IF EXISTS character_clips;
DROP TABLE IF EXISTS beats;
*/
