'use strict';

/**
 * Lala's home as World Foundation's "Seed Infrastructure" writes it (Evoni,
 * 2026-10-18: "call it Lala's Home"): her canon address in Echo Park
 * (utils/lalaHome). The seed wrote it as "Lala's Penthouse" in Dazzle
 * District, 88 Skyline Drive, described as JustAWoman's (JustAWoman is the
 * real-world book's; she is not in the LalaVerse).
 *
 *   LALAS_HOME  the seed's row
 *   homeAtAddress(WorldLocation)  the location already at her address, or
 *     null: the one "Fill in Lala's home" (services/characterPlacesService
 *     fillLalaHome) makes to hold her home and closet scene sets finds a
 *     location by this address, so there is one Lala's home, whichever ran
 *     first. The seed adds none when one is there.
 *   renameOldLalaHome(WorldLocation)  a row seeded the old way becomes
 *     Lala's Home: each field still as the old seed wrote it takes the new
 *     one, a field Evoni changed is kept. Nothing when there is no such row,
 *     or Lala's Home (or any location at her address) is already there.
 *     Returns the row it changed, or null.
 */

const LALAS_HOME = Object.freeze({
  name: 'Lala\'s Home', location_type: 'property', city: 'Echo Park', district: null, street_address: '246 Olddy Paveway Ln',
  property_type: null, narrative_role: 'sanctuary', description: 'Lala\'s home in Echo Park, at 246 Olddy Paveway Ln.',
});
const SLUG = 'lala-s-home';

// What the seed wrote before.
const OLD_LALA_HOME = Object.freeze({
  slug: 'lala-s-penthouse',
  fields: Object.freeze({
    name: 'Lala\'s Penthouse', city: 'Dazzle District', district: 'Runway Quarter', street_address: '88 Skyline Drive, PH-1',
    property_type: 'penthouse', description: 'JustAWoman\'s luxury penthouse overlooking the Runway Quarter. Floor-to-ceiling windows with city views.',
  }),
});

async function homeAtAddress(WorldLocation) {
  const { fn, col, where } = require('sequelize');
  return WorldLocation.findOne({
    where: where(fn('LOWER', fn('TRIM', col('street_address'))), LALAS_HOME.street_address.toLowerCase()),
    order: [['created_at', 'ASC']],
  });
}

async function renameOldLalaHome(WorldLocation) {
  const old = await WorldLocation.findOne({ where: { slug: OLD_LALA_HOME.slug } });
  if (!old || await WorldLocation.findOne({ where: { slug: SLUG } }) || await homeAtAddress(WorldLocation)) return null;
  const patch = { slug: SLUG };
  for (const [field, was] of Object.entries(OLD_LALA_HOME.fields)) {
    if ((old[field] ?? null) === was) patch[field] = LALAS_HOME[field] ?? null;
  }
  await old.update(patch);
  return old;
}

module.exports = { LALAS_HOME, OLD_LALA_HOME, homeAtAddress, renameOldLalaHome };
