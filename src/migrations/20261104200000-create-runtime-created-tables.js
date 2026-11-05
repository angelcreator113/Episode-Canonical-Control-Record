'use strict';

/**
 * The tables the application used to create at runtime (Evoni, 2026-11-04;
 * docs/reads/2026-11-04-runtime-ddl-inventory.md). The application no longer
 * runs DDL: these are created here, by a reviewed migration, and only where
 * they do not exist yet.
 *
 * Each definition is production's own (read from its catalog, 2026-11-04), so
 * a fresh database matches production:
 *   - continuity_timelines, continuity_characters, continuity_beats,
 *     continuity_beat_characters and their indexes (src/routes/continuityEngine.js
 *     ensureTables used to sync them);
 *   - ecosystem_previews (src/routes/worldStudio.js ensurePreviewsTable);
 *   - video_compositions and its two indexes (src/controllers/videoCompositionController.js,
 *     src/routes/admin.js);
 *   - chapter_versions (src/routes/storyHealth.js), absent in production;
 *   - brain_documents, with its own migration's definition (20261008100000),
 *     so production's application-owned copy can be replaced by one the
 *     migration role owns.
 * generation_jobs (20260323000000) and franchise_knowledge (20260307210000)
 * already have migrations.
 *
 * Nothing existing is changed. A table that exists is skipped, whoever owns
 * it: CREATE TABLE IF NOT EXISTS needs only CREATE on the schema, and each
 * index is created only when no relation of that name exists and this role
 * may index the table (CREATE INDEX on a table another role owns is refused,
 * even with IF NOT EXISTS; such an index is skipped with a notice).
 * chapter_versions, ecosystem_previews, video_compositions and
 * continuity_beat_characters have no deleted_at, as in production; adding it is
 * a separate, reviewed change.
 *
 * Every name is schema-qualified, and the transaction resolves names in
 * pg_catalog only (the pattern of 20261104170000).
 *
 * down: nothing. These tables may predate this migration and hold data;
 * dropping them is never automatic.
 */

// Definitions copied from production (Evoni's read-only catalog check,
// docs/reads/2026-11-04-runtime-ddl-inventory.md §4, D3/D4), which is the
// reference: where a table exists there, a fresh database gets the same columns,
// defaults, constraints and indexes. chapter_versions does not exist in
// production; it gets the definition storyHealth.js created. brain_documents
// gets the definition of its own migration (20261008100000), so that the
// application-owned copy in production can be replaced by one the migration
// role owns (inventory §5).
const TABLES = [
  ['continuity_timelines', `CREATE TABLE IF NOT EXISTS public.continuity_timelines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    show_id UUID REFERENCES public.shows (id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Timeline', description TEXT, season_tag VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft'
      CONSTRAINT continuity_timelines_status_check CHECK (status IN ('draft', 'active', 'locked')),
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ)`],
  ['continuity_characters', `CREATE TABLE IF NOT EXISTS public.continuity_characters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    timeline_id UUID NOT NULL REFERENCES public.continuity_timelines (id) ON DELETE CASCADE,
    character_key VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL, role VARCHAR(255),
    color VARCHAR(20) NOT NULL DEFAULT '#5b7fff', sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ)`],
  ['continuity_beats', `CREATE TABLE IF NOT EXISTS public.continuity_beats (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    timeline_id UUID NOT NULL REFERENCES public.continuity_timelines (id) ON DELETE CASCADE,
    beat_number INTEGER NOT NULL DEFAULT 1, name VARCHAR(500) NOT NULL, location VARCHAR(500) NOT NULL,
    time_tag VARCHAR(255), note TEXT, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ)`],
  ['continuity_beat_characters', `CREATE TABLE IF NOT EXISTS public.continuity_beat_characters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    beat_id UUID NOT NULL REFERENCES public.continuity_beats (id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES public.continuity_characters (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now())`],
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
    status VARCHAR(50) DEFAULT 'draft' CHECK (status::text = ANY (ARRAY['draft'::varchar, 'processing'::varchar, 'complete'::varchar, 'error'::varchar]::text[])),
    scenes JSONB DEFAULT '[]'::jsonb, assets JSONB DEFAULT '[]'::jsonb, settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`],
  ['brain_documents', `CREATE TABLE IF NOT EXISTS public.brain_documents (
    id SERIAL PRIMARY KEY, source_name VARCHAR(300) NOT NULL, document_text TEXT NOT NULL,
    entries_created INTEGER DEFAULT 0, ingested_by VARCHAR(100) DEFAULT 'manual',
    ingested_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ)`],
];

// [index name, table, definition]
const INDEXES = [
  ['idx_continuity_timelines_show', 'continuity_timelines', 'CREATE INDEX idx_continuity_timelines_show ON public.continuity_timelines (show_id)'],
  ['idx_continuity_characters_timeline', 'continuity_characters', 'CREATE INDEX idx_continuity_characters_timeline ON public.continuity_characters (timeline_id)'],
  ['idx_continuity_characters_timeline_key', 'continuity_characters', 'CREATE UNIQUE INDEX idx_continuity_characters_timeline_key ON public.continuity_characters (timeline_id, character_key)'],
  ['continuity_beats_deleted_at_idx', 'continuity_beats', 'CREATE INDEX continuity_beats_deleted_at_idx ON public.continuity_beats (deleted_at) WHERE deleted_at IS NULL'],
  ['idx_continuity_beats_timeline', 'continuity_beats', 'CREATE INDEX idx_continuity_beats_timeline ON public.continuity_beats (timeline_id)'],
  ['idx_continuity_beats_timeline_num', 'continuity_beats', 'CREATE INDEX idx_continuity_beats_timeline_num ON public.continuity_beats (timeline_id, beat_number)'],
  ['idx_continuity_bc_beat', 'continuity_beat_characters', 'CREATE INDEX idx_continuity_bc_beat ON public.continuity_beat_characters (beat_id)'],
  ['idx_continuity_bc_char', 'continuity_beat_characters', 'CREATE INDEX idx_continuity_bc_char ON public.continuity_beat_characters (character_id)'],
  ['idx_continuity_bc_unique', 'continuity_beat_characters', 'CREATE UNIQUE INDEX idx_continuity_bc_unique ON public.continuity_beat_characters (beat_id, character_id)'],
  ['idx_video_compositions_episode_id', 'video_compositions', 'CREATE INDEX idx_video_compositions_episode_id ON public.video_compositions (episode_id)'],
  ['idx_video_compositions_status', 'video_compositions', 'CREATE INDEX idx_video_compositions_status ON public.video_compositions (status)'],
];

module.exports = {
  TABLES,
  INDEXES,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements) => sequelize.query(sql, { transaction, replacements });
      await q('SET LOCAL search_path = pg_catalog, pg_temp');
      for (const [, sql] of TABLES) await q(sql);
      // An index is added only where this role may: CREATE INDEX needs the
      // table's owner (or a member of that role). On a table another role
      // owns, it is skipped with a notice and can be added later.
      for (const [name, table, sql] of INDEXES) {
        const [[row]] = await q(
          `SELECT to_regclass(:index) IS NOT NULL AS present,
                  pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE') AS may
             FROM pg_catalog.pg_class c WHERE c.oid = to_regclass(:table)`,
          { index: `public.${name}`, table: `public.${table}` },
        );
        if (row.present) continue;
        if (row.may) await q(sql);
        else console.log(`[20261104200000] ${name} not created: public.${table} is owned by another role.`);
      }
    });
  },

  async down() {
    console.log('[20261104200000] down: nothing is dropped; these tables may predate this migration and hold data.');
  },
};
