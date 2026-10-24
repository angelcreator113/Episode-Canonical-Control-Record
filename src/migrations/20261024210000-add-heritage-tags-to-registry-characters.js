'use strict';

/**
 * Heritage in the family trees (Evoni, 2026-10-24: "how can we be sure race
 * makes sense in the family trees?"; "I want them all and show me first").
 *
 *   registry_characters.heritage_tags   JSONB array of strings, nullable: a
 *       person's heritage as short tags, the way they describe themselves
 *       (utils/heritageTags). ethnicity stays as Evoni's own free text.
 *   character_relationships.heritage_ok JSONB, nullable: "This is intended"
 *       on a family tie whose blood relatives share no heritage tag
 *       (services/familyHeritage): { at, by, a_tags, b_tags }. The check
 *       stays quiet for the tie until either person's tags change.
 *
 * Backfill: a character with no tags whose ethnicity text is exactly one of
 * the starter tags, or a list of them ("Black and Korean"), gets those tags.
 * Anything else ("Mixed-race", a sentence) gets none and is left for Evoni.
 * Counts are logged. Real families include mixed heritage, adoption, step
 * and chosen family: these columns help Evoni notice, they never enforce
 * sameness.
 *
 * The matcher and list are a frozen copy here, not a require of
 * utils/heritageTags: a migration must run the same way on an empty
 * database years from now, whatever the live code becomes.
 *
 * Added columns, so no deleted_at. down drops both.
 */

const STARTER = [
  'Black', 'African American', 'Afro-Caribbean', 'African',
  'White', 'Irish', 'Italian', 'Jewish',
  'Latine', 'Mexican', 'Puerto Rican', 'Dominican',
  'East Asian', 'Korean', 'Chinese', 'Japanese', 'Filipino', 'Vietnamese',
  'South Asian', 'Indian', 'Middle Eastern', 'Arab',
  'Indigenous', 'Pacific Islander',
];
const key = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const BY_KEY = new Map(STARTER.map((t) => [key(t), t]));

/** The starter tags an ethnicity text names exactly, or [] (never a guess). */
function exactTags(text) {
  const words = String(text ?? '').trim().replace(/[.!]+$/, '');
  if (!words) return [];
  const parts = words.split(/\s*(?:,|\/|&|\+|\band\b)\s*/i).map(key).filter(Boolean);
  if (!parts.length) return [];
  const hits = parts.map((p) => BY_KEY.get(p));
  if (hits.some((h) => !h)) return [];
  return [...new Set(hits)];
}

const columnExists = async (sequelize, table, column, transaction) => {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column',
    { replacements: { table, column }, transaction });
  return rows.length > 0;
};

/** Tags from exact ethnicity matches, for characters with none. Returns the counts. */
async function backfill(sequelize, transaction) {
  const [rows] = await sequelize.query(
    `SELECT id, ethnicity FROM registry_characters
      WHERE heritage_tags IS NULL AND ethnicity IS NOT NULL AND BTRIM(ethnicity) <> ''`, { transaction });
  let tagged = 0;
  let left = 0;
  for (const r of rows) {
    const tags = exactTags(r.ethnicity);
    if (!tags.length) { left += 1; continue; }
    await sequelize.query('UPDATE registry_characters SET heritage_tags = CAST(:tags AS jsonb) WHERE id = :id',
      { replacements: { tags: JSON.stringify(tags), id: r.id }, transaction });
    tagged += 1;
  }
  return { read: rows.length, tagged, left };
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, 'registry_characters', 'heritage_tags', transaction))) {
        await queryInterface.addColumn('registry_characters', 'heritage_tags', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
      if (!(await columnExists(sequelize, 'character_relationships', 'heritage_ok', transaction))) {
        await queryInterface.addColumn('character_relationships', 'heritage_ok', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
      const counts = await backfill(sequelize, transaction);
      console.log(`[heritage_tags] ${counts.read} characters with ethnicity text and no tags: ${counts.tagged} tagged from an exact match, ${counts.left} left for Evoni`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await columnExists(sequelize, 'character_relationships', 'heritage_ok', transaction)) {
        await queryInterface.removeColumn('character_relationships', 'heritage_ok', { transaction });
      }
      if (await columnExists(sequelize, 'registry_characters', 'heritage_tags', transaction)) {
        await queryInterface.removeColumn('registry_characters', 'heritage_tags', { transaction });
      }
    });
  },

  // For the tests: the matcher and the backfill, as the migration runs them.
  exactTags,
  backfill,
};
