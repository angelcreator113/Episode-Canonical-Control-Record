'use strict';

/**
 * voice_footage_jobs (Voice plan V2; Evoni, 2026-10-30): the durable record
 * of each job that prepares a clip's voice for Voice Studio. Today the only
 * kind is 'extract' (the clip's sound, as an 'extracted' voice source); V3
 * adds 'match' with its own migration.
 *
 * One row per attempt. A retry is a new row with attempt + 1, so every try
 * stays in the history. At most one live job (queued, running or
 * succeeded) per idempotency key, so the same clip is never prepared twice
 * at once and a prepared clip is not prepared again.
 *
 * The jobs are run by the footage-only worker (src/workers/voiceFootageWorker.js),
 * never by episode-worker. Nothing here is deleted: rows get deleted_at.
 * A new table only; no existing table changes. Guarded so it can run twice.
 */

const TABLE = 'voice_footage_jobs';

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });
      await q(`CREATE TABLE IF NOT EXISTS ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
        raw_clip_id UUID NOT NULL REFERENCES episode_raw_clips(id) ON DELETE RESTRICT,
        performer VARCHAR(40) NOT NULL,
        kind VARCHAR(20) NOT NULL CONSTRAINT voice_footage_jobs_kind CHECK (kind IN ('extract')),
        status VARCHAR(20) NOT NULL DEFAULT 'queued'
          CONSTRAINT voice_footage_jobs_status CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
        attempt INTEGER NOT NULL DEFAULT 1 CONSTRAINT voice_footage_jobs_attempt CHECK (attempt BETWEEN 1 AND 20),
        idempotency_key TEXT NOT NULL,
        input_ref TEXT NOT NULL,
        output_source_id UUID NULL REFERENCES voice_source_assets(id) ON DELETE RESTRICT,
        retryable BOOLEAN NULL,
        error_code VARCHAR(60) NULL,
        error_message TEXT NULL,
        requested_by VARCHAR(255) NULL,
        trigger VARCHAR(20) NOT NULL DEFAULT 'upload'
          CONSTRAINT voice_footage_jobs_trigger CHECK (trigger IN ('upload', 'prepare', 'retry')),
        run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ NULL,
        heartbeat_at TIMESTAMPTZ NULL,
        finished_at TIMESTAMPTZ NULL,
        worker_id VARCHAR(120) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL,
        CONSTRAINT voice_footage_jobs_done_has_source CHECK (status <> 'succeeded' OR output_source_id IS NOT NULL)
      )`);
      // At most one live job per key: the same clip is never prepared twice at once.
      await q(`CREATE UNIQUE INDEX IF NOT EXISTS voice_footage_jobs_live_key ON ${TABLE} (kind, idempotency_key)
        WHERE status IN ('queued', 'running', 'succeeded') AND deleted_at IS NULL`);
      // Claiming: the oldest queued job that is due.
      await q(`CREATE INDEX IF NOT EXISTS voice_footage_jobs_claim ON ${TABLE} (status, run_after, created_at) WHERE deleted_at IS NULL`);
      // The Files page: the latest job per clip.
      await q(`CREATE INDEX IF NOT EXISTS voice_footage_jobs_clip ON ${TABLE} (raw_clip_id, created_at DESC) WHERE deleted_at IS NULL`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${TABLE}`);
  },
};
