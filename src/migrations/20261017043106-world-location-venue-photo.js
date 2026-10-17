'use strict';

/**
 * A venue's own photo (Evoni, 2026-10-17: "the main photo and the venue
 * photo maybe different ... the venue has its own photo"). The scene set's
 * main photo is the place inside, as the set's views are made from it; the
 * venue photo is the venue as people know it, e.g. the building from the
 * street, uploaded on its own.
 *
 *   world_locations.venue_photo_url  the venue's photo (S3), or null
 *
 * Added only when missing and tagged, so down drops only what this
 * migration added. world_locations already has deleted_at.
 */

const TABLE = 'world_locations';
const COLUMN = 'venue_photo_url';
const MARK = 'added by 20261017043106-world-location-venue-photo';

const exists = async (sequelize, sql, replacements, transaction) => (await sequelize.query(sql, { replacements, transaction }))[0].length > 0;
const tableExists = (sequelize, t) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name: TABLE }, t);
const columnExists = (sequelize, t) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table: TABLE, column: COLUMN }, t);
const ourColumn = (sequelize, t) => exists(sequelize,
  `SELECT 1 FROM pg_description d JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE d.objoid = :table::regclass AND a.attname = :column AND d.description = :mark`,
  { table: TABLE, column: COLUMN, mark: MARK }, t);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (await columnExists(sequelize, transaction)) return;
      await queryInterface.addColumn(TABLE, COLUMN, { type: Sequelize.TEXT, allowNull: true }, { transaction });
      await sequelize.query(`COMMENT ON COLUMN ${TABLE}.${COLUMN} IS '${MARK}'`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (await columnExists(sequelize, transaction) && await ourColumn(sequelize, transaction)) {
        await queryInterface.removeColumn(TABLE, COLUMN, { transaction });
      }
    });
  },
};
