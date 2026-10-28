'use strict';

/**
 * Timeline C1 (Evoni, 2026-10-28; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 6, R4.3 C1,
 * R5.1, R5.3, R5.6): the database foundation for the episode's edit. New
 * tables only; nothing existing is changed. The legacy Timeline Editor keeps
 * timeline_data and scenes.duration_seconds to itself, and the reusable
 * scene_angles.video_duration is never written.
 *
 *   episode_edit_state       the live edit's concurrency token (edit_revision)
 *   episode_beat_production  per beat: Prime required (no row) or gameplay_only;
 *     a change soft-deletes the previous row (history kept)
 *   episode_scene_clips      the scene track: one or more clips per beat, each
 *     with its own episode-specific duration and, for a video, the source
 *     length measured by the server (source_duration_ms)
 *   episode_prime_segments   Prime's takes placed on the edit: video range,
 *     one placement (anchor + offset) and the commentary sub-range on the same
 *     source clock (no audio offset column, so audio can't slide); a NULL
 *     commentary range means this segment has none
 *   episode_pip_settings     the PIP's default layout, visibility and cutout
 *   episode_pip_visibility   manual hide/show rules (never mute)
 *   timeline_items           keyframes, visibility, angle changes, transitions,
 *     dialogue nudges (audio_offset) and caption overrides (reserved)
 *   timeline_audio_items     music and SFX (reserved, no UI yet)
 *   edit_versions            named, immutable snapshots of the live edit
 *
 * Times are integer milliseconds; layout is pixels at 1920x1080. Every table
 * has created_at, updated_at and deleted_at. down() refuses while any of the
 * tables has a row; empty, it drops them. Runs only through the Deploy
 * workflow.
 */

const TABLES = [
  'edit_versions',
  'timeline_audio_items',
  'timeline_items',
  'episode_pip_visibility',
  'episode_pip_settings',
  'episode_prime_segments',
  'episode_scene_clips',
  'episode_beat_production',
  'episode_edit_state',
];

const TS = `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL`;

const BEAT = (col, nullable = false) => `${col} SMALLINT ${nullable ? 'NULL' : 'NOT NULL'} CHECK (${col} IS NULL OR ${col} BETWEEN 1 AND 14)`;
const ANCHOR_KINDS = "('beat_start', 'line_start', 'item_start')";
// An anchor: a beat's start (needs the beat), or a line or a timeline item (needs its id).
const anchor = (prefix, nullable = false) => `
        ${prefix}anchor_kind VARCHAR(16) ${nullable ? 'NULL' : 'NOT NULL'} CHECK (${prefix}anchor_kind IS NULL OR ${prefix}anchor_kind IN ${ANCHOR_KINDS}),
        ${BEAT(`${prefix}anchor_beat`, true)},
        ${prefix}anchor_ref UUID NULL,
        ${prefix}offset_ms INTEGER ${nullable ? 'NULL' : 'NOT NULL DEFAULT 0'},
        CONSTRAINT ${prefix || 'start_'}anchor_target_CHK CHECK (
          ${prefix}anchor_kind IS NULL
          OR (${prefix}anchor_kind = 'beat_start' AND ${prefix}anchor_beat IS NOT NULL AND ${prefix}anchor_ref IS NULL)
          OR (${prefix}anchor_kind IN ('line_start', 'item_start') AND ${prefix}anchor_ref IS NOT NULL)
        )`;
const GAIN = (col) => `${col} NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (${col} BETWEEN -24 AND 12)`;
const FADE = (col) => `${col} INTEGER NOT NULL DEFAULT 0 CHECK (${col} BETWEEN 0 AND 2000)`;

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });

      await q(`CREATE TABLE episode_edit_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE RESTRICT,
        edit_revision BIGINT NOT NULL DEFAULT 0 CHECK (edit_revision >= 0),
        updated_by VARCHAR(255) NULL,
        ${TS}
      )`);

      await q(`CREATE TABLE episode_beat_production (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        ${BEAT('beat_number')},
        prime_mode VARCHAR(16) NOT NULL CHECK (prime_mode IN ('required', 'gameplay_only')),
        note TEXT NULL,
        set_by VARCHAR(255) NULL,
        set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ${TS}
      )`);
      // One current setting per beat; earlier ones are soft-deleted (history).
      await q('CREATE UNIQUE INDEX episode_beat_production_current ON episode_beat_production (episode_id, beat_number) WHERE deleted_at IS NULL');

      await q(`CREATE TABLE episode_scene_clips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        ${BEAT('beat_number')},
        position INTEGER NOT NULL CHECK (position >= 0),
        source_kind VARCHAR(16) NOT NULL CHECK (source_kind IN ('angle_still', 'angle_video', 'raw_clip')),
        source_id UUID NOT NULL,
        source_in_ms INTEGER NULL,
        source_out_ms INTEGER NULL,
        source_duration_ms INTEGER NULL CHECK (source_duration_ms IS NULL OR source_duration_ms > 0),
        duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
        created_by VARCHAR(255) NULL,
        ${TS},
        CONSTRAINT episode_scene_clips_range CHECK (
          (source_kind = 'angle_still' AND source_in_ms IS NULL AND source_out_ms IS NULL AND source_duration_ms IS NULL)
          OR (source_kind <> 'angle_still' AND source_duration_ms IS NOT NULL AND source_in_ms IS NOT NULL AND source_out_ms IS NOT NULL
              AND source_in_ms >= 0 AND source_in_ms < source_out_ms AND source_out_ms <= source_duration_ms)
        )
      )`);
      await q('CREATE UNIQUE INDEX episode_scene_clips_place ON episode_scene_clips (episode_id, beat_number, position) WHERE deleted_at IS NULL');

      await q(`CREATE TABLE episode_prime_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        raw_clip_id UUID NOT NULL REFERENCES episode_raw_clips(id) ON DELETE RESTRICT,
        source_in_ms INTEGER NOT NULL CHECK (source_in_ms >= 0),
        source_out_ms INTEGER NOT NULL,
        ${anchor('')},
        layout JSONB NULL,
        audio_in_ms INTEGER NULL,
        audio_out_ms INTEGER NULL,
        ${GAIN('audio_gain_db')},
        audio_muted BOOLEAN NOT NULL DEFAULT FALSE,
        ${FADE('audio_fade_in_ms')},
        ${FADE('audio_fade_out_ms')},
        status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
        superseded_by UUID NULL REFERENCES episode_prime_segments(id) ON DELETE RESTRICT,
        superseded_at TIMESTAMPTZ NULL,
        created_by VARCHAR(255) NULL,
        ${TS},
        -- One clock: the commentary is a sub-range of the video's source range, or there is none
        -- (both NULL: a split half the commentary was not in). None is never audible. Each branch
        -- states its NULLs, since a CHECK that comes out NULL would pass.
        CONSTRAINT episode_prime_segments_sync CHECK (
          (audio_in_ms IS NULL AND audio_out_ms IS NULL AND audio_fade_in_ms = 0 AND audio_fade_out_ms = 0)
          OR (audio_in_ms IS NOT NULL AND audio_out_ms IS NOT NULL
              AND source_in_ms <= audio_in_ms AND audio_in_ms < audio_out_ms AND audio_out_ms <= source_out_ms)
        ),
        CONSTRAINT episode_prime_segments_fades CHECK (audio_in_ms IS NULL OR audio_fade_in_ms + audio_fade_out_ms <= audio_out_ms - audio_in_ms)
      )`);
      await q('CREATE INDEX episode_prime_segments_episode ON episode_prime_segments (episode_id) WHERE deleted_at IS NULL AND superseded_at IS NULL');

      await q(`CREATE TABLE episode_pip_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL UNIQUE REFERENCES episodes(id) ON DELETE RESTRICT,
        default_layout JSONB NULL,
        default_visible BOOLEAN NOT NULL DEFAULT TRUE,
        use_cutout BOOLEAN NOT NULL DEFAULT FALSE,
        ${TS}
      )`);

      await q(`CREATE TABLE episode_pip_visibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        scope VARCHAR(8) NOT NULL CHECK (scope IN ('beat', 'range')),
        ${BEAT('beat_number', true)},
        ${anchor('', true)},
        ${anchor('end_', true)},
        visible BOOLEAN NOT NULL,
        set_by VARCHAR(255) NULL,
        ${TS},
        CONSTRAINT episode_pip_visibility_scope CHECK (
          (scope = 'beat' AND beat_number IS NOT NULL AND anchor_kind IS NULL AND end_anchor_kind IS NULL)
          OR (scope = 'range' AND beat_number IS NULL AND anchor_kind IS NOT NULL AND end_anchor_kind IS NOT NULL
              AND offset_ms IS NOT NULL AND end_offset_ms IS NOT NULL)
        )
      )`);

      await q(`CREATE TABLE timeline_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        scene_clip_id UUID NULL REFERENCES episode_scene_clips(id) ON DELETE RESTRICT,
        kind VARCHAR(24) NOT NULL CHECK (kind IN ('object_keyframe', 'camera_keyframe', 'object_visibility', 'angle_change', 'transition', 'audio_offset', 'caption_override')),
        target_id TEXT NULL,
        view VARCHAR(16) NULL,
        ${anchor('')},
        "values" JSONB NOT NULL DEFAULT '{}'::jsonb,
        origin VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (origin IN ('auto', 'user', 'director')),
        approval VARCHAR(16) NOT NULL DEFAULT 'approved' CHECK (approval IN ('pending', 'approved', 'rejected')),
        proposal_id UUID NULL,
        created_by VARCHAR(255) NULL,
        ${TS}
      )`);
      await q('CREATE INDEX timeline_items_episode ON timeline_items (episode_id) WHERE deleted_at IS NULL');

      await q(`CREATE TABLE timeline_audio_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        track VARCHAR(8) NOT NULL CHECK (track IN ('music', 'sfx')),
        asset_ref TEXT NULL,
        slot TEXT NULL,
        source_in_ms INTEGER NOT NULL CHECK (source_in_ms >= 0),
        source_out_ms INTEGER NOT NULL,
        ${anchor('')},
        ${GAIN('gain_db')},
        ${FADE('fade_in_ms')},
        ${FADE('fade_out_ms')},
        duck_under_dialogue_db NUMERIC(4,1) NULL CHECK (duck_under_dialogue_db IS NULL OR duck_under_dialogue_db BETWEEN -24 AND 0),
        created_by VARCHAR(255) NULL,
        ${TS},
        CONSTRAINT timeline_audio_items_range CHECK (source_in_ms < source_out_ms),
        CONSTRAINT timeline_audio_items_source CHECK (asset_ref IS NOT NULL OR slot IS NOT NULL)
      )`);

      await q(`CREATE TABLE edit_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        name VARCHAR(200) NOT NULL CHECK (length(trim(name)) > 0),
        snapshot JSONB NOT NULL,
        snapshot_sha256 CHAR(64) NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
        edit_revision BIGINT NOT NULL CHECK (edit_revision >= 0),
        script_revision VARCHAR(44) NOT NULL CHECK (script_revision ~ '^sr1-[0-9a-f]{40}$'),
        script_seq BIGINT NOT NULL CHECK (script_seq >= 0),
        created_by VARCHAR(255) NULL,
        ${TS}
      )`);
      await q('CREATE INDEX edit_versions_episode ON edit_versions (episode_id, created_at DESC)');
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        const [[reg]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: table }, transaction });
        if (!reg.reg) continue;
        const [[{ n }]] = await sequelize.query(`SELECT count(*)::int AS n FROM ${table}`, { transaction });
        if (n > 0) throw new Error(`Refusing to drop ${table}: it has ${n} row(s). Edit data is never dropped by a rollback; fix forward.`);
      }
      for (const table of TABLES) await sequelize.query(`DROP TABLE IF EXISTS ${table}`, { transaction });
    });
  },
};
