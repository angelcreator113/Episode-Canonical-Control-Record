'use strict';

/**
 * Poll votes: a cookie plus a soft cap per IP; signed-in voters by account
 * (Task #3094; Evoni, 2026-10-13). One vote per IP refused a second person
 * on the same household, office or carrier network.
 *   - drops the unique index pulse_poll_votes_one_per_ip; the per-cookie
 *     (now per-voter) unique index stays;
 *   - adds pulse_poll_votes_ip, a plain (poll_id, ip_hash) index, to count a
 *     network's votes against the soft cap (services/pulsePolls IP_SOFT_CAP);
 *   - adds signed_in: true when the vote came from an account, which the cap
 *     does not count.
 *
 * Guarded and reversible. down restores the unique index only while no poll
 * has two live votes from one IP; otherwise it stops and says so, rather than
 * delete votes.
 */

const VOTES = 'pulse_poll_votes';

const indexExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT 1 FROM pg_indexes WHERE indexname = :name', { replacements: { name }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    // Read before the transaction: describeTable uses its own connection, which the transaction's locks would block.
    const columns = await queryInterface.describeTable(VOTES);
    await sequelize.transaction(async (transaction) => {
      if (!columns.signed_in) {
        await queryInterface.addColumn(VOTES, 'signed_in', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
      }
      await sequelize.query('DROP INDEX IF EXISTS pulse_poll_votes_one_per_ip', { transaction });
      if (!(await indexExists(sequelize, 'pulse_poll_votes_ip', transaction))) {
        await sequelize.query(`CREATE INDEX pulse_poll_votes_ip ON ${VOTES} (poll_id, ip_hash) WHERE deleted_at IS NULL`, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const columns = await queryInterface.describeTable(VOTES);
    await sequelize.transaction(async (transaction) => {
      const [dupes] = await sequelize.query(
        `SELECT poll_id FROM ${VOTES} WHERE deleted_at IS NULL GROUP BY poll_id, ip_hash HAVING COUNT(*) > 1 LIMIT 1`, { transaction });
      if (dupes.length) {
        throw new Error('pulse_poll_votes has two live votes from one IP on a poll; the one-per-IP index cannot be restored without deleting votes.');
      }
      await sequelize.query('DROP INDEX IF EXISTS pulse_poll_votes_ip', { transaction });
      if (!(await indexExists(sequelize, 'pulse_poll_votes_one_per_ip', transaction))) {
        await sequelize.query(
          `CREATE UNIQUE INDEX pulse_poll_votes_one_per_ip ON ${VOTES} (poll_id, ip_hash) WHERE deleted_at IS NULL`, { transaction });
      }
      if (columns.signed_in) await queryInterface.removeColumn(VOTES, 'signed_in', { transaction });
    });
  },
};
