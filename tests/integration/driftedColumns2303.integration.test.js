/**
 * Integration Tests - one guarded migration for four drifted columns
 * (Task #2303; 20261001090000-add-drifted-columns-2303).
 *
 * The test database is built by the migration tree, so before this migration
 * it lacks assets.processing_status, assets.s3_key_processed and
 * scene_sets.base_still_url, and has storyteller_memories.line_id NOT NULL.
 * Running up twice must succeed (every step is guarded) and leave the four
 * columns as the canon capture has them
 * (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt L136, L138,
 * L1568, L2146).
 */
const { Sequelize } = require('sequelize');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261001090000-add-drifted-columns-2303');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const EXPECTED = [
  { table_name: 'assets', column_name: 'processing_status', data_type: 'character varying', is_nullable: 'YES' },
  { table_name: 'assets', column_name: 's3_key_processed', data_type: 'character varying', is_nullable: 'YES' },
  { table_name: 'scene_sets', column_name: 'base_still_url', data_type: 'text', is_nullable: 'YES' },
  { table_name: 'storyteller_memories', column_name: 'line_id', data_type: 'uuid', is_nullable: 'YES' },
];

const readColumns = () => sequelize.query(
  `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (('assets','processing_status'), ('assets','s3_key_processed'),
                                        ('scene_sets','base_still_url'), ('storyteller_memories','line_id'))
    ORDER BY table_name, column_name`,
  { type: sequelize.QueryTypes.SELECT },
);

(shouldSkip ? describe.skip : describe)('Drifted columns migration (Task #2303)', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('up runs twice without error and leaves the four columns as production has them', async () => {
    const qi = sequelize.getQueryInterface();
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize);
    expect(await readColumns()).toEqual(EXPECTED);
  });

  it('down is a no-op: the columns production already had are kept', async () => {
    await migration.down(sequelize.getQueryInterface(), Sequelize);
    expect(await readColumns()).toEqual(EXPECTED);
  });
});
