'use strict';

/**
 * Feed profiles made since the July unification carry the old city names.
 *
 * The unify migration (20260725000000-unify-dream-cities.js) renamed every
 * social_profiles.city to its DREAM city, but the Feed scheduler kept
 * offering the old five (nova_prime, velour_city, the_drift, solenne,
 * cascade_row), so each LalaVerse profile it made since got one. The
 * scheduler now offers the DREAM cities (utils/feedCities), and this
 * renames the rest as July did, by July's mapping.
 *
 * Only social_profiles.city. The scheduler makes no world_locations, and
 * the Feed's create form already sends DREAM cities.
 *
 * down: none. Reversing the renames would also rewrite DREAM cities that
 * were there before this ran.
 */

// July's mapping, inlined (a migration does not read app code).
const RENAMES = [
  ['nova_prime', 'dazzle_district'],
  ['solenne', 'radiance_row'],
  ['velour_city', 'echo_park'],
  ['cascade_row', 'ascent_tower'],
  ['the_drift', 'maverick_harbor'],
];

module.exports = {
  RENAMES,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const [from, to] of RENAMES) {
        await sequelize.query(
          'UPDATE social_profiles SET city = :to WHERE city = :from',
          { replacements: { from, to }, transaction });
      }
    });
  },

  async down() {
    // None: see the header.
  },
};
