'use strict';

/**
 * Voice Studio B1 (Evoni, 2026-10-27; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 5 R4.3/R5.3/R5.5):
 * the database foundation for line-based dialogue takes. New tables only;
 * nothing existing is changed (script_voice_clips stays as it is and is
 * still what the teleprompter plays).
 *
 *   voice_source_assets             immutable source media: an uploaded or
 *     recorded file, an extract of a raw take, or an old voice clip brought in.
 *     Never edited, never hard-deleted (ON DELETE RESTRICT everywhere).
 *   line_voice_candidates           one take for one line
 *   line_voice_associations         which line a take is tied to (append-only;
 *     a confirmed move or a reassignment is a new row)
 *   line_voice_candidate_revisions  the take's trim, gain and fades (append-only)
 *   line_voice_approvals            one current approval per line, naming the
 *     exact candidate revision and association it approved
 *   line_voice_reconfirmations      a person's re-confirmation (design E1)
 *
 * An approval and a re-confirmation pin the script revision and the
 * episode's script save number, episodes.script_seq (Evoni, 2026-10-27/28):
 * the revision is a hash of the text, so A -> B -> A (an empty B included)
 * has the approved revision again; script_seq goes up on every save that
 * changes the text and on nothing else, whatever the clock. The pair decides
 * whether the script was saved since. No row here names a script version, so
 * version pruning never depends on Voice Studio; an approval's own row keeps
 * what it approved (words, speaker, line, context), the revision and the
 * save number, and stays readable once the versions of its day are gone.
 * Approval rows are never deleted.
 *
 * Needs episodes.script_seq (20261027190000-add-episode-script-seq, A1c):
 * up() checks for it first and creates nothing without it.
 *
 * Every table has created_at, updated_at and deleted_at. down() refuses while
 * any of the tables has a row, so a rollback cannot drop data; empty, it drops
 * them. Runs only through the Deploy workflow.
 */

const TABLES = [
  'line_voice_reconfirmations',
  'line_voice_approvals',
  'line_voice_candidate_revisions',
  'line_voice_associations',
  'line_voice_candidates',
  'voice_source_assets',
];

const TS = `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL`;

const HASH = "CHAR(64) CHECK ({col} ~ '^[0-9a-f]{64}$')";
const hash = (col, nullable = false) => `${col} ${HASH.replace('{col}', col)}${nullable ? '' : ' NOT NULL'}`;
// A neighbour's row hash, or the beat's edge ('^' before the first line, '$' after the last).
const neighbour = (col) => `${col} VARCHAR(64) NOT NULL CHECK (${col} ~ '^([0-9a-f]{64}|\\^|\\$)$')`;
const REVISION = "VARCHAR(44) NOT NULL CHECK ({col} ~ '^sr1-[0-9a-f]{40}$')";
const revision = (col) => `${col} ${REVISION.replace('{col}', col)}`;

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });
      // The A1c prerequisite, before anything is made: one transaction, so a refusal leaves nothing behind.
      const [seq] = await sequelize.query(`SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'episodes' AND column_name = 'script_seq'`, { transaction });
      if (!seq.length) {
        throw new Error('Voice Studio needs episodes.script_seq: run 20261027190000-add-episode-script-seq (A1c) first. Nothing was created.');
      }

      await q(`CREATE TABLE voice_source_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        source_kind VARCHAR(16) NOT NULL CHECK (source_kind IN ('uploaded', 'recorded', 'extracted', 'legacy')),
        s3_key TEXT NOT NULL UNIQUE,
        ${hash('sha256')},
        content_type VARCHAR(100) NOT NULL,
        file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
        duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
        sample_rate INTEGER NULL CHECK (sample_rate IS NULL OR sample_rate > 0),
        channels SMALLINT NULL CHECK (channels IS NULL OR channels > 0),
        original_filename TEXT NULL,
        source_raw_clip_id UUID NULL REFERENCES episode_raw_clips(id) ON DELETE RESTRICT,
        source_in_ms INTEGER NULL,
        source_out_ms INTEGER NULL,
        legacy_voice_clip_id UUID NULL REFERENCES script_voice_clips(id) ON DELETE RESTRICT,
        created_by VARCHAR(255) NULL,
        ${TS},
        CONSTRAINT voice_source_extracted CHECK (
          (source_kind = 'extracted') = (source_raw_clip_id IS NOT NULL)
          AND (source_kind <> 'extracted' OR (source_in_ms IS NOT NULL AND source_out_ms IS NOT NULL AND source_in_ms >= 0 AND source_in_ms < source_out_ms))
          AND (source_kind = 'extracted' OR (source_in_ms IS NULL AND source_out_ms IS NULL))
        ),
        CONSTRAINT voice_source_legacy CHECK ((source_kind = 'legacy') = (legacy_voice_clip_id IS NOT NULL))
      )`);
      await q('CREATE INDEX voice_source_assets_episode ON voice_source_assets (episode_id) WHERE deleted_at IS NULL');
      // One import per old clip (the legacy import is idempotent).
      await q('CREATE UNIQUE INDEX voice_source_assets_one_legacy ON voice_source_assets (legacy_voice_clip_id) WHERE legacy_voice_clip_id IS NOT NULL');

      await q(`CREATE TABLE line_voice_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        source_asset_id UUID NOT NULL REFERENCES voice_source_assets(id) ON DELETE RESTRICT,
        label TEXT NULL,
        line_key TEXT NULL,
        created_by VARCHAR(255) NULL,
        ${TS}
      )`);
      await q('CREATE INDEX line_voice_candidates_episode ON line_voice_candidates (episode_id) WHERE deleted_at IS NULL');

      await q(`CREATE TABLE line_voice_associations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES line_voice_candidates(id) ON DELETE RESTRICT,
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        beat_number SMALLINT NOT NULL CHECK (beat_number BETWEEN 1 AND 14),
        line_index INTEGER NOT NULL CHECK (line_index >= 0),
        occurrence INTEGER NOT NULL CHECK (occurrence >= 1),
        speaker_key VARCHAR(120) NULL,
        speaker_written VARCHAR(120) NULL,
        delivery_note TEXT NULL,
        words TEXT NOT NULL,
        ${hash('row_hash')},
        ${neighbour('prev_hash')},
        ${neighbour('next_hash')},
        ${hash('context_hash')},
        ${revision('script_revision')},
        created_by VARCHAR(255) NULL,
        superseded_at TIMESTAMPTZ NULL,
        superseded_by UUID NULL REFERENCES line_voice_associations(id) ON DELETE RESTRICT,
        ${TS}
      )`);
      // One current association per take.
      await q('CREATE UNIQUE INDEX line_voice_associations_current ON line_voice_associations (candidate_id) WHERE superseded_at IS NULL AND deleted_at IS NULL');

      await q(`CREATE TABLE line_voice_candidate_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES line_voice_candidates(id) ON DELETE RESTRICT,
        revision_no INTEGER NOT NULL CHECK (revision_no >= 1),
        in_ms INTEGER NOT NULL CHECK (in_ms >= 0),
        out_ms INTEGER NOT NULL,
        gain_db NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (gain_db BETWEEN -24 AND 12),
        fade_in_ms INTEGER NOT NULL DEFAULT 0 CHECK (fade_in_ms BETWEEN 0 AND 2000),
        fade_out_ms INTEGER NOT NULL DEFAULT 0 CHECK (fade_out_ms BETWEEN 0 AND 2000),
        normalise BOOLEAN NOT NULL DEFAULT FALSE,
        ${hash('settings_hash')},
        rendered_s3_key TEXT NULL,
        ${hash('rendered_sha256', true)},
        created_by VARCHAR(255) NULL,
        ${TS},
        CONSTRAINT line_voice_revision_range CHECK (in_ms < out_ms AND fade_in_ms + fade_out_ms <= out_ms - in_ms),
        CONSTRAINT line_voice_revision_no UNIQUE (candidate_id, revision_no)
      )`);

      await q(`CREATE TABLE line_voice_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        candidate_id UUID NOT NULL REFERENCES line_voice_candidates(id) ON DELETE RESTRICT,
        candidate_revision_id UUID NOT NULL REFERENCES line_voice_candidate_revisions(id) ON DELETE RESTRICT,
        association_id UUID NOT NULL REFERENCES line_voice_associations(id) ON DELETE RESTRICT,
        beat_number SMALLINT NOT NULL CHECK (beat_number BETWEEN 1 AND 14),
        line_index INTEGER NOT NULL CHECK (line_index >= 0),
        occurrence INTEGER NOT NULL CHECK (occurrence >= 1),
        approved_context JSONB NOT NULL,
        ${hash('approved_context_hash')},
        ${revision('pinned_script_revision')},
        pinned_script_seq BIGINT NOT NULL CHECK (pinned_script_seq >= 0),
        approved_by VARCHAR(255) NOT NULL,
        approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        superseded_at TIMESTAMPTZ NULL,
        superseded_by UUID NULL REFERENCES line_voice_approvals(id) ON DELETE RESTRICT,
        invalidated_at TIMESTAMPTZ NULL,
        invalidated_reason VARCHAR(40) NULL,
        revoked_at TIMESTAMPTZ NULL,
        revoked_by VARCHAR(255) NULL,
        ${TS},
        CONSTRAINT line_voice_approval_invalid CHECK ((invalidated_at IS NULL) = (invalidated_reason IS NULL)),
        CONSTRAINT line_voice_approval_revoked CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
      )`);
      // In force: not superseded, invalidated, revoked or deleted. At most one in force per line, the
      // line being (beat, index) in the script it was approved against; occurrence is not part of it
      // (within one script the index already tells identical lines apart). A racing second approval
      // gets a unique violation, a 409.
      const IN_FORCE = 'superseded_at IS NULL AND invalidated_at IS NULL AND revoked_at IS NULL AND deleted_at IS NULL';
      await q(`CREATE UNIQUE INDEX line_voice_approvals_current ON line_voice_approvals (episode_id, beat_number, line_index) WHERE ${IN_FORCE}`);
      // At most one in force per take.
      await q(`CREATE UNIQUE INDEX line_voice_approvals_current_take ON line_voice_approvals (candidate_id) WHERE ${IN_FORCE}`);
      await q('CREATE INDEX line_voice_approvals_candidate ON line_voice_approvals (candidate_id)');

      await q(`CREATE TABLE line_voice_reconfirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        approval_id UUID NOT NULL REFERENCES line_voice_approvals(id) ON DELETE RESTRICT,
        ${revision('pinned_script_revision')},
        pinned_script_seq BIGINT NOT NULL CHECK (pinned_script_seq >= 0),
        ${hash('context_hash')},
        confirmed_by VARCHAR(255) NOT NULL,
        confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ${TS}
      )`);
      await q('CREATE INDEX line_voice_reconfirmations_approval ON line_voice_reconfirmations (approval_id, confirmed_at DESC)');
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        const [[reg]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: table }, transaction });
        if (!reg.reg) continue;
        const [[{ n }]] = await sequelize.query(`SELECT count(*)::int AS n FROM ${table}`, { transaction });
        if (n > 0) throw new Error(`Refusing to drop ${table}: it has ${n} row(s). Voice Studio data is never dropped by a rollback; fix forward.`);
      }
      for (const table of TABLES) await sequelize.query(`DROP TABLE IF EXISTS ${table}`, { transaction });
    });
  },
};
