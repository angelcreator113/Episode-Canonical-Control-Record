'use strict';

/**
 * pulse_voices: Evoni's approval of a voice (Task #3029; Evoni, 2026-10-12:
 * "Approve their voice before automated posting starts").
 *
 *   approved_at  DATE, null until she approves; cleared by a rebuild
 *   approved_by  STRING(255), who approved
 *
 * The worker drafts only for an approved voice (services/pulseVoices
 * isApproved). Existing voices start unapproved: nothing posts on its own
 * until she approves each one. Guarded: each column is added only when
 * absent; down drops exactly these two. deleted_at already exists
 * (20261012040000-create-pulse-voices).
 */

const COLUMNS = (Sequelize) => ({
  approved_at: { type: Sequelize.DATE, allowNull: true },
  approved_by: { type: Sequelize.STRING(255), allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existing = await queryInterface.describeTable('pulse_voices', { transaction });
      for (const [name, spec] of Object.entries(COLUMNS(Sequelize))) {
        if (!existing[name]) await queryInterface.addColumn('pulse_voices', name, spec, { transaction });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const existing = await queryInterface.describeTable('pulse_voices', { transaction });
      for (const name of Object.keys(COLUMNS(Sequelize))) {
        if (existing[name]) await queryInterface.removeColumn('pulse_voices', name, { transaction });
      }
    });
  },
};
