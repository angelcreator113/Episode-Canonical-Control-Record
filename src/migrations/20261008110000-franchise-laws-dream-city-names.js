'use strict';

/**
 * The franchise laws name the five DREAM cities (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md §2c, fix-list item 20).
 *
 * The unify migration (20260725000000-unify-dream-cities.js) renamed the
 * legacy cities in world_locations and social_profiles but not in
 * franchise_knowledge, so the always-inject laws seeded in March
 * (world-infrastructure, social-timeline, character-life-simulation,
 * cultural-memory) still told every generator about Velvet City, Glow
 * District, Pulse City, Creator Harbor and Horizon City.
 *
 * The renames are frontend/src/data/dreamCities.js's, the World tab's own
 * geography: the five cities, and the three institutions and one house
 * named after them (UNIVERSITIES, CORPORATIONS). Event, media and brand
 * names that only borrow the old words keep them there too (Velvet Season,
 * The Velvet Archive, Glow Week, Glow Labs, Glow Gazette, Pulse Media
 * Network), so only these exact phrases change.
 *
 * Rows: every franchise_knowledge row of those four source documents (the
 * seeded laws and the Brain Update cards synced under the same documents),
 * in title and content, by plain text replacement, so any edit made since
 * stays. A synced card whose names change shows once as changed in the
 * next Brain Update preview (its source_hash is of the old text).
 *
 * down: none. Reversing the renames would also rewrite DREAM names that
 * were there before this ran.
 */

const RENAMES = [
  ['Horizon Tech Institute', 'Ascent Tech Institute'],
  ['Velvet Academy', 'Dazzle Academy'],
  ['Glow Institute', 'Radiance Institute'],
  ['Velvet House', 'Dazzle House'],
  ['Velvet City', 'Dazzle District'],
  ['Glow District', 'Radiance Row'],
  ['Pulse City', 'Echo Park'],
  ['Creator Harbor', 'Maverick Harbor'],
  ['Horizon City', 'Ascent Tower'],
];

const SOURCE_DOCUMENTS = [
  'world-infrastructure-v1.0',
  'social-timeline-v1.0',
  'character-life-simulation-v1.0',
  'cultural-memory-v1.0',
];

module.exports = {
  RENAMES,
  SOURCE_DOCUMENTS,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const [from, to] of RENAMES) {
        await sequelize.query(
          `UPDATE franchise_knowledge
              SET title = REPLACE(title, :from, :to),
                  content = REPLACE(content, :from, :to),
                  updated_at = NOW()
            WHERE source_document IN (:docs)
              AND (STRPOS(title, :from) > 0 OR STRPOS(content, :from) > 0)`,
          { replacements: { from, to, docs: SOURCE_DOCUMENTS }, transaction });
      }
    });
  },

  async down() {
    // None: see the header.
  },
};
