'use strict';

/**
 * Registry characters live in the five DREAM cities.
 *
 * registry_characters.current_city is an ENUM made in March
 * (20260313200000-character-demographics) with the old five cities
 * (nova_prime, velour_city, the_drift, solenne, cascade_row),
 * outside_lalaverse and unknown. The July unification
 * (20260725000000-unify-dream-cities) renamed the cities on Feed profiles
 * but never reached this column, so it refuses every DREAM city: World
 * Studio's sync and the registry's own generators, which now write DREAM
 * cities (utils/registryDemographics), would fail against it.
 *
 * This adds the five DREAM cities to the column's type, then renames the
 * old five by July's mapping, on every row (a deleted one too, as July
 * did). The old values stay in the type, unused, as they do for Feed
 * profiles.
 *
 * ALTER TYPE ... ADD VALUE runs outside the transaction: a value added
 * inside one cannot be used until it commits. Each is IF NOT EXISTS, so a
 * second run adds nothing. A column that is not an ENUM is left as it is
 * and only renamed.
 *
 * down: none. Reversing the renames would also rewrite DREAM cities that
 * were there before this ran, and Postgres cannot drop an ENUM value.
 */

const DREAM_CITIES = ['dazzle_district', 'radiance_row', 'echo_park', 'ascent_tower', 'maverick_harbor'];

// July's mapping, inlined (a migration does not read app code).
const RENAMES = [
  ['nova_prime', 'dazzle_district'],
  ['solenne', 'radiance_row'],
  ['velour_city', 'echo_park'],
  ['cascade_row', 'ascent_tower'],
  ['the_drift', 'maverick_harbor'],
];

module.exports = {
  DREAM_CITIES,
  RENAMES,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const [column] = await sequelize.query(
      `SELECT data_type, udt_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'registry_characters' AND column_name = 'current_city'`,
      { type: sequelize.QueryTypes.SELECT });
    if (!column) throw new Error('registry_characters.current_city not found');

    if (column.data_type === 'USER-DEFINED') {
      const type = column.udt_name.replace(/"/g, '""');
      for (const city of DREAM_CITIES) {
        await sequelize.query(`ALTER TYPE "${type}" ADD VALUE IF NOT EXISTS '${city}'`);
      }
    }

    await sequelize.transaction(async (transaction) => {
      for (const [from, to] of RENAMES) {
        await sequelize.query(
          'UPDATE registry_characters SET current_city = :to WHERE current_city = :from',
          { replacements: { from, to }, transaction });
      }
    });
  },

  async down() {
    // None: see the header.
  },
};
