'use strict';

/**
 * "Also known as" for a social profile (Evoni, 2026-10-23): the other names
 * a person goes by, nicknames like "Truth" for Truthville, so a goal about
 * them ticks when the script calls them that (utils/scriptRuleChecks
 * goalPerson). social_profiles gains `aliases` JSONB NOT NULL DEFAULT '[]',
 * a list of names. No existing column fits: full_profile is the generated
 * profile, rebrand_history is the handles they had before.
 *
 * Guarded: nothing happens when the table is absent; IF NOT EXISTS / IF
 * EXISTS make it safe to run twice. down drops the column.
 */

const TABLE = 'social_profiles';

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS aliases`, { transaction });
    });
  },
};
