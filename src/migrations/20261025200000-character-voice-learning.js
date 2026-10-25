'use strict';

/**
 * Character voices that learn (Evoni, 2026-10-25): every character's voice
 * learns from what she approves and how she edits the AI's lines, in the
 * show and in the book, one voice per character, each rule and line tagged
 * with where it was said: 'gameplay' (show beats 1-10 and 14), 'cutscene'
 * (beats 11-13), 'narration' (the book's prose). services/characterVoice.js
 * reads and writes all of it in raw SQL; the VoiceSignal and VoiceRule
 * models keep their old attributes, so the book's existing voice routes
 * work the same before and after this runs.
 *
 *   voice_signals  + character_key STRING(80)  the character's slug ('lala',
 *                                              'justawoman', a registry key)
 *                  + context STRING(16)        gameplay | cutscene | narration
 *                  + episode_id UUID, beat_number INTEGER
 *                  + source STRING(24)         episode_edit | episode_rewrite
 *                                              | approved_line | book_edit
 *   voice_rules    + the same five, and
 *                  + size STRING(8)            small (applies by itself) | major
 *                                              (waits for her Approve)
 *                  + auto_applied BOOLEAN      default false; a small rule
 *                                              that went live without her
 *                  + from_episode_number INTEGER  the episode it was learned at
 *                  + check_json JSONB          its machine-checkable form, e.g.
 *                                              {type:'max_sentences',n:2}
 *                  + supersedes_rule_id INTEGER  the older rule it replaced
 *                                              (growth), put back by Undo
 *   enum_voice_rules_status     + 'dismissed' (her Dismiss, and Undo)
 *   enum_voice_rules_rule_type  + word_choice, catchphrase, greeting,
 *                                 line_length, banned_word, punctuation,
 *                                 personality, values, attitude, relationship
 *   character_voice_lines  (new) every line she approved, per character:
 *                  id UUID, character_key, show_id, episode_id, beat_number,
 *                  book_id, chapter_id, context, text, text_hash (sha256 of
 *                  the line, one live row per character and hash), source
 *                  (approved | edited | rewrite | book), created_at,
 *                  updated_at, deleted_at
 *
 * voice_signals' book_id, chapter_id and line_id are already nullable
 * (20260307400000), so nothing there changes.
 *
 * Guarded: each column, index and table only when absent, each enum value
 * IF NOT EXISTS, so it can run twice. down drops the table, the indexes and
 * the columns; Postgres cannot drop an enum value, so the added values stay
 * (unused, harmless; the old code never writes them).
 */

const NEW_COLUMNS = {
  voice_signals: ['character_key', 'context', 'episode_id', 'beat_number', 'source'],
  voice_rules: ['character_key', 'context', 'episode_id', 'beat_number', 'source', 'size', 'auto_applied', 'from_episode_number', 'check_json', 'supersedes_rule_id'],
};
const RULE_TYPES = ['word_choice', 'catchphrase', 'greeting', 'line_length', 'banned_word', 'punctuation', 'personality', 'values', 'attitude', 'relationship'];

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};
const columnExists = async (sequelize, table, column, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column',
    { replacements: { table, column }, transaction });
  return rows.length > 0;
};
const typeExists = async (sequelize, name) => {
  const [rows] = await sequelize.query('SELECT 1 FROM pg_type WHERE typname = :name', { replacements: { name } });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const types = {
      character_key: { type: Sequelize.STRING(80), allowNull: true },
      context: { type: Sequelize.STRING(16), allowNull: true },
      episode_id: { type: Sequelize.UUID, allowNull: true },
      beat_number: { type: Sequelize.INTEGER, allowNull: true },
      source: { type: Sequelize.STRING(24), allowNull: true },
      size: { type: Sequelize.STRING(8), allowNull: true },
      auto_applied: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      from_episode_number: { type: Sequelize.INTEGER, allowNull: true },
      check_json: { type: Sequelize.JSONB, allowNull: true },
      supersedes_rule_id: { type: Sequelize.INTEGER, allowNull: true },
    };

    // Enum values first and outside a transaction: a value added inside one
    // cannot be used until it commits.
    if (await typeExists(sequelize, 'enum_voice_rules_status')) {
      await sequelize.query("ALTER TYPE \"enum_voice_rules_status\" ADD VALUE IF NOT EXISTS 'dismissed'");
    }
    if (await typeExists(sequelize, 'enum_voice_rules_rule_type')) {
      for (const t of RULE_TYPES) {
        await sequelize.query(`ALTER TYPE "enum_voice_rules_rule_type" ADD VALUE IF NOT EXISTS '${t}'`);
      }
    }

    await sequelize.transaction(async (transaction) => {
      for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
        if (!(await tableExists(sequelize, table, transaction))) continue;
        for (const column of columns) {
          if (!(await columnExists(sequelize, table, column, transaction))) {
            await queryInterface.addColumn(table, column, types[column], { transaction });
          }
        }
      }
      if (await tableExists(sequelize, 'voice_signals', transaction)) {
        await sequelize.query('CREATE INDEX IF NOT EXISTS voice_signals_character ON voice_signals (character_key, status) WHERE deleted_at IS NULL', { transaction });
        await sequelize.query('CREATE INDEX IF NOT EXISTS voice_signals_episode ON voice_signals (episode_id, beat_number) WHERE deleted_at IS NULL', { transaction });
      }
      if (await tableExists(sequelize, 'voice_rules', transaction)) {
        await sequelize.query('CREATE INDEX IF NOT EXISTS voice_rules_character ON voice_rules (character_key, context, status) WHERE deleted_at IS NULL', { transaction });
      }

      if (!(await tableExists(sequelize, 'character_voice_lines', transaction))) {
        await queryInterface.createTable('character_voice_lines', {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          character_key: { type: Sequelize.STRING(80), allowNull: false },
          show_id: { type: Sequelize.UUID, allowNull: true },
          episode_id: { type: Sequelize.UUID, allowNull: true },
          beat_number: { type: Sequelize.INTEGER, allowNull: true },
          book_id: { type: Sequelize.UUID, allowNull: true },
          chapter_id: { type: Sequelize.UUID, allowNull: true },
          context: { type: Sequelize.STRING(16), allowNull: false },
          text: { type: Sequelize.TEXT, allowNull: false },
          text_hash: { type: Sequelize.STRING(64), allowNull: false },
          source: { type: Sequelize.STRING(16), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      // One live row per character and line.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS character_voice_lines_one_line ON character_voice_lines (character_key, text_hash)
           WHERE deleted_at IS NULL`, { transaction });
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS character_voice_lines_character ON character_voice_lines (character_key, context, created_at DESC)
           WHERE deleted_at IS NULL`, { transaction });
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS character_voice_lines_episode ON character_voice_lines (episode_id) WHERE deleted_at IS NULL', { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, 'character_voice_lines', transaction)) {
        await queryInterface.dropTable('character_voice_lines', { transaction });
      }
      await sequelize.query('DROP INDEX IF EXISTS voice_signals_character', { transaction });
      await sequelize.query('DROP INDEX IF EXISTS voice_signals_episode', { transaction });
      await sequelize.query('DROP INDEX IF EXISTS voice_rules_character', { transaction });
      for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
        if (!(await tableExists(sequelize, table, transaction))) continue;
        for (const column of [...columns].reverse()) {
          if (await columnExists(sequelize, table, column, transaction)) {
            await queryInterface.removeColumn(table, column, { transaction });
          }
        }
      }
    });
  },
};
