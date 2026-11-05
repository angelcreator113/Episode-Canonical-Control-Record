'use strict';

/**
 * PROPOSED (not in src/migrations; cannot run until Evoni approves and it is moved there).
 *
 * data_correction_log: durable, append-only undo records for approved one-off production
 * data corrections (Evoni, 2026-11-04: "durable, access-controlled undo records with
 * conditional restoration"). One row per corrected field: the exact before and after values,
 * who approved it and where, when it was applied and by which database role, and when (if
 * ever) it was undone. UNIQUE (correction_key, record_table, record_id, field) means a
 * correction cannot be applied twice.
 *
 * Access: no API route reads or writes this table; only the database roles with grants can.
 * PUBLIC has no privileges (REVOKE below). The read-only reviewer role keeps SELECT only if
 * the database's default privileges already grant it.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('data_correction_log')) return;
    await queryInterface.createTable('data_correction_log', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      correction_key: { type: Sequelize.STRING(100), allowNull: false },
      record_table: { type: Sequelize.STRING(100), allowNull: false },
      record_id: { type: Sequelize.STRING(100), allowNull: false },
      field: { type: Sequelize.STRING(100), allowNull: false },
      before_value: { type: Sequelize.JSONB, allowNull: true },
      after_value: { type: Sequelize.JSONB, allowNull: true },
      approved_by: { type: Sequelize.STRING(255), allowNull: false },
      approval_ref: { type: Sequelize.TEXT, allowNull: false },
      applied_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      applied_by: { type: Sequelize.STRING(255), allowNull: false, defaultValue: Sequelize.literal('current_user') },
      undone_at: { type: Sequelize.DATE, allowNull: true },
      undone_by: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('data_correction_log', ['correction_key', 'record_table', 'record_id', 'field'], {
      unique: true, name: 'data_correction_log_once',
    });
    await queryInterface.sequelize.query('REVOKE ALL ON data_correction_log FROM PUBLIC');
  },
  down: async (queryInterface) => {
    const [[{ n }]] = await queryInterface.sequelize.query('SELECT count(*)::int AS n FROM data_correction_log');
    if (n > 0) throw new Error('data_correction_log holds undo records; export them before dropping');
    await queryInterface.dropTable('data_correction_log');
  },
};
