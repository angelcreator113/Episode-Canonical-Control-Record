'use strict';

/**
 * world_state_snapshots.world_facts is a list (review item 8, 2026-10-04;
 * src/services/worldFacts.js).
 *
 * The temperature service wrote an object ({ worldTemperature,
 * temperatureUpdatedAt }) into world_facts on its 'temperature_update'
 * snapshots while everything else stored and read a list of facts. This
 * moves that object into metadata.world_temperature ({ value, updated_at })
 * on every row where world_facts is an object, sets those rows'
 * world_facts to [], and adds a check constraint so world_facts is NULL
 * or a JSON array from now on. down drops the constraint only; the moved
 * temperatures stay in metadata, where the service now reads them.
 */

const TABLE = 'world_state_snapshots';
const CONSTRAINT = `${TABLE}_world_facts_is_list`;

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `UPDATE ${TABLE}
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                  'world_temperature', jsonb_strip_nulls(jsonb_build_object(
                    'value', world_facts -> 'worldTemperature',
                    'updated_at', world_facts -> 'temperatureUpdatedAt'))),
                world_facts = '[]'::jsonb,
                updated_at = NOW()
          WHERE jsonb_typeof(world_facts) = 'object'`,
        { transaction });
      await sequelize.query(
        `UPDATE ${TABLE} SET world_facts = '[]'::jsonb, updated_at = NOW()
          WHERE world_facts IS NOT NULL AND jsonb_typeof(world_facts) NOT IN ('array', 'object')`,
        { transaction });
      await sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`, { transaction });
      await sequelize.query(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${CONSTRAINT}
           CHECK (world_facts IS NULL OR jsonb_typeof(world_facts) = 'array')`,
        { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);
  },
};
