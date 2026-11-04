'use strict';

/**
 * The tables the application used to create at runtime (Evoni, 2026-11-04;
 * docs/reads/2026-11-04-runtime-ddl-inventory.md). The application no longer
 * runs DDL: these are created here, by a reviewed migration, and only where
 * they do not exist yet.
 *
 * Each definition is the one the runtime code created, unchanged, so an
 * environment where the application already created the table and a fresh
 * one end up alike:
 *   - continuity_timelines, continuity_characters, continuity_beats,
 *     continuity_beat_characters (and the enum enum_continuity_timelines_status):
 *     what ContinuityTimeline/Character/Beat/BeatCharacter.sync() created
 *     (src/routes/continuityEngine.js ensureTables), captured from Sequelize.
 *   - chapter_versions: src/routes/storyHealth.js.
 *   - ecosystem_previews: src/routes/worldStudio.js ensurePreviewsTable.
 *   - video_compositions and its two indexes: src/controllers/videoCompositionController.js
 *     and src/routes/admin.js.
 * generation_jobs (20260323000000) and franchise_knowledge (20260307210000)
 * already have migrations.
 *
 * Nothing existing is changed. A table that exists is skipped, whoever owns
 * it: CREATE TABLE IF NOT EXISTS needs only CREATE on the schema, and each
 * index is created only when no relation of that name exists and this role
 * may index the table (CREATE INDEX on a table another role owns is refused,
 * even with IF NOT EXISTS; such an index is skipped with a notice).
 * chapter_versions, ecosystem_previews and video_compositions keep their
 * runtime definitions without deleted_at, so a fresh database matches
 * production; adding it is a separate, reviewed change.
 *
 * Every name is schema-qualified, and the transaction resolves names in
 * pg_catalog only (the pattern of 20261104170000).
 *
 * down: nothing. These tables may predate this migration and hold data;
 * dropping them is never automatic.
 */

const TABLES = [
  ['continuity_timelines', `CREATE TABLE IF NOT EXISTS public.continuity_timelines (
    id UUID, show_id UUID REFERENCES public.shows (id) ON DELETE SET NULL ON UPDATE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Timeline', description TEXT, season_tag VARCHAR(100),
    status public.enum_continuity_timelines_status DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY (id))`],
  ['continuity_characters', `CREATE TABLE IF NOT EXISTS public.continuity_characters (
    id UUID, timeline_id UUID NOT NULL REFERENCES public.continuity_timelines (id) ON DELETE CASCADE ON UPDATE CASCADE,
    character_key VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL, role VARCHAR(255),
    color VARCHAR(20) NOT NULL DEFAULT '#5b7fff', sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY (id))`],
  ['continuity_beats', `CREATE TABLE IF NOT EXISTS public.continuity_beats (
    id UUID, timeline_id UUID NOT NULL REFERENCES public.continuity_timelines (id) ON DELETE CASCADE ON UPDATE CASCADE,
    beat_number INTEGER NOT NULL DEFAULT 1, name VARCHAR(500) NOT NULL, location VARCHAR(500) NOT NULL,
    time_tag VARCHAR(255), note TEXT, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY (id))`],
  ['continuity_beat_characters', `CREATE TABLE IF NOT EXISTS public.continuity_beat_characters (
    id UUID, beat_id UUID NOT NULL REFERENCES public.continuity_beats (id) ON DELETE CASCADE ON UPDATE CASCADE,
    character_id UUID NOT NULL REFERENCES public.continuity_characters (id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (beat_id, character_id), PRIMARY KEY (id))`],
  ['chapter_versions', `CREATE TABLE IF NOT EXISTS public.chapter_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), chapter_id UUID NOT NULL,
    version_number INT NOT NULL DEFAULT 1, content TEXT, word_count INT DEFAULT 0,
    snapshot_reason VARCHAR(100) DEFAULT 'manual', created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['ecosystem_previews', `CREATE TABLE IF NOT EXISTS public.ecosystem_previews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), preview_id VARCHAR(255) UNIQUE NOT NULL,
    world_tag VARCHAR(100) NOT NULL DEFAULT 'lalaverse', characters JSONB NOT NULL DEFAULT '[]',
    generation_notes TEXT DEFAULT '', status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`],
  ['video_compositions', `CREATE TABLE IF NOT EXISTS public.video_compositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES public.episodes (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'complete', 'error')),
    scenes JSONB DEFAULT '[]'::jsonb, assets JSONB DEFAULT '[]'::jsonb, settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`],
];

const INDEXES = [
  ['idx_video_compositions_episode_id', 'CREATE INDEX idx_video_compositions_episode_id ON public.video_compositions (episode_id)'],
  ['idx_video_compositions_status', 'CREATE INDEX idx_video_compositions_status ON public.video_compositions (status)'],
];

module.exports = {
  TABLES,
  INDEXES,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements) => sequelize.query(sql, { transaction, replacements });
      await q('SET LOCAL search_path = pg_catalog, pg_temp');
      await q(`DO $t$ BEGIN
        CREATE TYPE public.enum_continuity_timelines_status AS ENUM ('draft', 'active', 'locked');
      EXCEPTION WHEN duplicate_object THEN NULL; END $t$`);
      for (const [, sql] of TABLES) await q(sql);
      // An index is added only where this role may: CREATE INDEX needs the
      // table's owner (or a member of that role). On a table another role
      // owns (production: one the application created), it is skipped with a
      // notice and can be added after the ownership is transferred.
      for (const [name, sql] of INDEXES) {
        const [[row]] = await q(
          `SELECT to_regclass(:index) IS NOT NULL AS present,
                  pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE') AS may
             FROM pg_catalog.pg_class c WHERE c.oid = 'public.video_compositions'::regclass`,
          { index: `public.${name}` },
        );
        if (row.present) continue;
        if (row.may) await q(sql);
        else console.log(`[20261104200000] ${name} not created: public.video_compositions is owned by another role (add it after the ownership transfer).`);
      }
    });
  },

  async down() {
    console.log('[20261104200000] down: nothing is dropped; these tables may predate this migration and hold data.');
  },
};
