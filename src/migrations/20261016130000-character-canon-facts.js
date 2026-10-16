'use strict';

/**
 * Character facts (Character Consistency Engine, step 2; Evoni, 2026-10-16:
 * "2M, start step 2"; services/characterFacts).
 *
 *   1. registry_characters.canon_facts (JSONB): income, occupation, major
 *      possessions and the facts not decided yet. Added only when missing and
 *      tagged, so down drops it only if this migration added it.
 *   2. Maren Elise Volk (@slowsift) has 2M followers (Evoni's ruling). Her
 *      Pulse card said 1.2M while her bio and dilemma said 2M. In each show
 *      whose follower ledger holds her, an accepted override row brings her
 *      latest count to 2,000,000 (none when it already is), and her
 *      follower_count_approx becomes "2M". Each row and the old text are
 *      logged in canon_fact_migrations; down removes those rows and puts the
 *      text back.
 */

const TABLE = 'registry_characters';
const MARK = 'added by 20261016130000-character-canon-facts';
const LOG = 'canon_fact_migrations';
const MAREN = 'slowsift';
const COUNT = 2000000;
const REASON = "Evoni, 2026-10-16: Maren's canon follower count is 2M (Character Consistency Engine).";

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, name, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name }, t);
const columnExists = (sequelize, table, column, t) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column }, t);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, TABLE, transaction) && !(await columnExists(sequelize, TABLE, 'canon_facts', transaction))) {
        await queryInterface.addColumn(TABLE, 'canon_facts', { type: Sequelize.JSONB, allowNull: true }, { transaction });
        await sequelize.query(`COMMENT ON COLUMN ${TABLE}.canon_facts IS '${MARK}'`, { transaction });
      }

      if (!(await tableExists(sequelize, 'social_profiles', transaction))) return;
      if (!(await tableExists(sequelize, LOG, transaction))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          social_profile_id: { type: Sequelize.INTEGER, allowNull: false },
          pulse_follower_id: { type: Sequelize.UUID, allowNull: true },
          old_follower_count_approx: { type: Sequelize.STRING(50), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      const [profiles] = await sequelize.query(
        `SELECT id, follower_count_approx FROM social_profiles
          WHERE LOWER(LTRIM(handle, '@')) = :handle AND deleted_at IS NULL`, { replacements: { handle: MAREN }, transaction });
      const hasLedger = await tableExists(sequelize, 'pulse_followers', transaction);
      for (const p of profiles) {
        if (hasLedger) {
          const [shows] = await sequelize.query(
            `SELECT DISTINCT ON (show_id) show_id, count_after, story_order FROM pulse_followers
              WHERE social_profile_id = :pid AND status = 'accepted' AND deleted_at IS NULL
              ORDER BY show_id, story_order DESC, decided_at DESC NULLS LAST, created_at DESC`,
            { replacements: { pid: p.id }, transaction });
          for (const s of shows) {
            if (Number(s.count_after) === COUNT) continue;
            const [[row]] = await sequelize.query(
              `INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
               VALUES (:show, :pid, :at, :change, :count, 'override', :reason, 'accepted', 'migration', NOW(), NOW(), NOW()) RETURNING id`,
              { replacements: { show: s.show_id, pid: p.id, at: s.story_order, change: COUNT - Number(s.count_after), count: COUNT, reason: REASON }, transaction });
            await sequelize.query(`INSERT INTO ${LOG} (social_profile_id, pulse_follower_id, created_at, updated_at) VALUES (:pid, :rid, NOW(), NOW())`,
              { replacements: { pid: p.id, rid: row.id }, transaction });
          }
        }
        if (p.follower_count_approx !== '2M') {
          await sequelize.query(`INSERT INTO ${LOG} (social_profile_id, old_follower_count_approx, created_at, updated_at) VALUES (:pid, :old, NOW(), NOW())`,
            { replacements: { pid: p.id, old: p.follower_count_approx }, transaction });
          await sequelize.query("UPDATE social_profiles SET follower_count_approx = '2M' WHERE id = :pid", { replacements: { pid: p.id }, transaction });
        }
      }
      console.log(`[migration 20261016130000] Maren set to 2M on ${profiles.length} profile(s)`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, LOG, transaction)) {
        const [rows] = await sequelize.query(`SELECT social_profile_id, pulse_follower_id, old_follower_count_approx FROM ${LOG} ORDER BY id DESC`, { transaction });
        for (const r of rows) {
          if (r.pulse_follower_id) {
            await sequelize.query('DELETE FROM pulse_followers WHERE id = :id', { replacements: { id: r.pulse_follower_id }, transaction });
          } else {
            await sequelize.query('UPDATE social_profiles SET follower_count_approx = :old WHERE id = :pid',
              { replacements: { pid: r.social_profile_id, old: r.old_follower_count_approx }, transaction });
          }
        }
        await queryInterface.dropTable(LOG, { transaction });
      }
      const [[tagged]] = await sequelize.query(
        `SELECT col_description(c.oid, a.attnum) = :mark AS mine FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
          WHERE c.relname = :table AND a.attname = 'canon_facts' AND NOT a.attisdropped`, { replacements: { table: TABLE, mark: MARK }, transaction });
      if (tagged?.mine) await queryInterface.removeColumn(TABLE, 'canon_facts', { transaction });
    });
  },
};
