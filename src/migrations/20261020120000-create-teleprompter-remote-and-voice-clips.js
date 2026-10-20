'use strict';

/**
 * Teleprompter batch 3 (Evoni, 2026-10-20; she approved this migration):
 *
 *   teleprompter_remote_sessions   a phone remote for the teleprompter. The
 *     desktop (logged in) opens one and shows a QR code; the phone sends
 *     commands with the token from that code. Only the token's sha256 is
 *     kept (token_hash, unique), never the token. A session lasts about two
 *     hours (expires_at) and End soft-deletes it.
 *       user_id       the owner (req.user.id, the Cognito sub)
 *       episode_id    the script being read, or null (pasted text)
 *       last_command  the newest command and the last few before it (JSONB)
 *       command_seq   counts commands; the desktop asks for those after the
 *                     seq it has applied
 *       state         what the desktop is doing (running, beat, speed,
 *                     recording), for the phone to show
 *
 *   script_voice_clips   a line of the script spoken by Evoni (Lala's voice,
 *     or any speaker's), played by the teleprompter when someone reads
 *     opposite it. beat_number + line_index name the line as the
 *     teleprompter counts it (lib/teleprompterLines); line_text is the line
 *     as it was when recorded, so a changed line shows "line changed since
 *     recorded". One live clip per (episode, beat, line): re-recording
 *     soft-deletes the old row (scriptVoiceClipsService); the partial unique
 *     index below holds it.
 *
 * New tables and indexes only, each with deleted_at. Guarded: each table is
 * created only when absent, each index with IF NOT EXISTS; down drops both
 * tables when present. Until this runs, the endpoints answer 409 with a
 * plain message and the pages hide the features.
 */

const REMOTE = 'teleprompter_remote_sessions';
const VOICE = 'script_voice_clips';

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const timestamps = () => ({
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, REMOTE, transaction))) {
        await queryInterface.createTable(REMOTE, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          user_id: { type: Sequelize.STRING(255), allowNull: false },
          episode_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'episodes', key: 'id' }, onDelete: 'SET NULL' },
          token_hash: { type: Sequelize.STRING(64), allowNull: false },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          last_command: { type: Sequelize.JSONB, allowNull: true },
          command_seq: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          state: { type: Sequelize.JSONB, allowNull: true },
          ...timestamps(),
        }, { transaction });
      }
      await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${REMOTE}_token_hash ON ${REMOTE} (token_hash)`, { transaction });
      await sequelize.query(`CREATE INDEX IF NOT EXISTS ${REMOTE}_user ON ${REMOTE} (user_id, expires_at) WHERE deleted_at IS NULL`, { transaction });

      if (!(await tableExists(sequelize, VOICE, transaction))) {
        await queryInterface.createTable(VOICE, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          episode_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'episodes', key: 'id' }, onDelete: 'CASCADE' },
          beat_number: { type: Sequelize.INTEGER, allowNull: false },
          line_index: { type: Sequelize.INTEGER, allowNull: false },
          speaker: { type: Sequelize.STRING(120), allowNull: false },
          line_text: { type: Sequelize.TEXT, allowNull: false },
          s3_key: { type: Sequelize.TEXT, allowNull: false },
          url: { type: Sequelize.TEXT, allowNull: false },
          content_type: { type: Sequelize.STRING(100), allowNull: true },
          duration_seconds: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
          file_size_bytes: { type: Sequelize.BIGINT, allowNull: true },
          created_by: { type: Sequelize.STRING(255), allowNull: true },
          ...timestamps(),
        }, { transaction });
      }
      await sequelize.query(`CREATE INDEX IF NOT EXISTS ${VOICE}_episode ON ${VOICE} (episode_id) WHERE deleted_at IS NULL`, { transaction });
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${VOICE}_one_live_per_line ON ${VOICE} (episode_id, beat_number, line_index)
          WHERE deleted_at IS NULL`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      // Dropping a table drops its indexes.
      if (await tableExists(sequelize, VOICE, transaction)) await queryInterface.dropTable(VOICE, { transaction });
      if (await tableExists(sequelize, REMOTE, transaction)) await queryInterface.dropTable(REMOTE, { transaction });
    });
  },
};
