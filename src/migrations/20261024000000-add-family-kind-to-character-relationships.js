'use strict';

/**
 * Family on a relationship (Evoni, 2026-10-23: "how can we give family to
 * characters? It helps with relationships", then "I want them all").
 *
 *   family_kind          blood | step | adoptive | married | chosen, or NULL
 *                        when the row is not family. Backfilled from
 *                        is_blood_relation (true → blood) and family_role
 *                        (a "step" role → step, an "adopt" role → adoptive,
 *                        "chosen" → chosen, an in-law → married).
 *   reverse_family_role  the role read the other way. family_role reads
 *                        "A is B's <role>"; this reads "B is A's <role>", so
 *                        one row holds both directions
 *                        (services/familyTies familyRoleFor). NULL on old
 *                        rows: the reader works it out from family_role.
 *
 * is_blood_relation stays, written alongside family_kind (blood ⇔ true),
 * for the readers that still use it. down drops both columns.
 */

const TABLE = 'character_relationships';
const KINDS = ['blood', 'step', 'adoptive', 'married', 'chosen'];

const columnExists = async (sequelize, column, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column',
    { replacements: { table: TABLE, column }, transaction });
  return rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, 'family_kind', transaction))) {
        await queryInterface.addColumn(TABLE, 'family_kind', { type: Sequelize.STRING(20), allowNull: true }, { transaction });
        await sequelize.query(
          `ALTER TABLE ${TABLE} ADD CONSTRAINT ${TABLE}_family_kind_check CHECK (family_kind IS NULL OR family_kind IN (${KINDS.map((k) => `'${k}'`).join(', ')}))`,
          { transaction });
      }
      if (!(await columnExists(sequelize, 'reverse_family_role', transaction))) {
        await queryInterface.addColumn(TABLE, 'reverse_family_role', { type: Sequelize.STRING(120), allowNull: true }, { transaction });
      }
      // The order matters: a step role is step even when marked blood.
      await sequelize.query(
        `UPDATE ${TABLE} SET family_kind = CASE
            WHEN family_role ILIKE '%step%' THEN 'step'
            WHEN family_role ILIKE '%adopt%' THEN 'adoptive'
            WHEN family_role ILIKE '%chosen%' THEN 'chosen'
            WHEN family_role ILIKE '%in-law%' OR family_role ILIKE '%in law%' THEN 'married'
            WHEN is_blood_relation = true THEN 'blood'
            ELSE NULL END
          WHERE family_kind IS NULL AND (family_role IS NOT NULL OR is_blood_relation = true)`,
        { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${TABLE}_family_kind_check`, { transaction });
      if (await columnExists(sequelize, 'reverse_family_role', transaction)) {
        await queryInterface.removeColumn(TABLE, 'reverse_family_role', { transaction });
      }
      if (await columnExists(sequelize, 'family_kind', transaction)) {
        await queryInterface.removeColumn(TABLE, 'family_kind', { transaction });
      }
    });
  },
};
