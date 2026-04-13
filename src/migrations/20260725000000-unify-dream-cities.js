'use strict';

/**
 * Migration: Unify city names to DREAM system
 *
 * Old cities (SocialProfile):
 *   nova_prime → dazzle_district  (D - Fashion & Luxury)
 *   velour_city → echo_park       (E - Entertainment & Nightlife)
 *   the_drift → maverick_harbor   (M - Creator Economy & Counter-culture)
 *   solenne → radiance_row        (R - Beauty & Wellness)
 *   cascade_row → ascent_tower    (A - Tech & Innovation)
 *
 * DREAM = Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add new enum values to city column
    const newCities = ['dazzle_district', 'radiance_row', 'echo_park', 'ascent_tower', 'maverick_harbor'];

    // PostgreSQL: alter the enum type to add new values
    for (const city of newCities) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_social_profiles_city" ADD VALUE IF NOT EXISTS '${city}';`
      ).catch(() => {});
    }

    // 2. Migrate existing profiles to new city names
    const cityMap = [
      ['nova_prime', 'dazzle_district'],
      ['solenne', 'radiance_row'],
      ['velour_city', 'echo_park'],
      ['cascade_row', 'ascent_tower'],
      ['the_drift', 'maverick_harbor'],
    ];

    for (const [oldCity, newCity] of cityMap) {
      await queryInterface.sequelize.query(
        `UPDATE social_profiles SET city = '${newCity}' WHERE city = '${oldCity}';`
      );
    }

    // 3. Also update any world_locations that reference old city names in their city column
    for (const [oldCity, newCity] of cityMap) {
      const oldLabel = oldCity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const newLabel = newCity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      await queryInterface.sequelize.query(
        `UPDATE world_locations SET city = '${newLabel}' WHERE city = '${oldLabel}';`
      ).catch(() => {});
    }

    // Also update the Infrastructure-style city names in world_locations
    const infraMap = [
      ['Velvet City', 'Dazzle District'],
      ['Glow District', 'Radiance Row'],
      ['Pulse City', 'Echo Park'],
      ['Creator Harbor', 'Maverick Harbor'],
      ['Horizon City', 'Ascent Tower'],
    ];

    for (const [oldName, newName] of infraMap) {
      await queryInterface.sequelize.query(
        `UPDATE world_locations SET city = '${newName}' WHERE city = '${oldName}';`
      ).catch(() => {});
      // Also update location names if they match city names
      await queryInterface.sequelize.query(
        `UPDATE world_locations SET name = '${newName}' WHERE name = '${oldName}' AND location_type = 'city';`
      ).catch(() => {});
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverse the city name mappings
    const cityMap = [
      ['dazzle_district', 'nova_prime'],
      ['radiance_row', 'solenne'],
      ['echo_park', 'velour_city'],
      ['ascent_tower', 'cascade_row'],
      ['maverick_harbor', 'the_drift'],
    ];

    for (const [newCity, oldCity] of cityMap) {
      await queryInterface.sequelize.query(
        `UPDATE social_profiles SET city = '${oldCity}' WHERE city = '${newCity}';`
      );
    }
  },
};
