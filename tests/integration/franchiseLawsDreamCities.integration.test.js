/**
 * The franchise laws name the five DREAM cities: migration
 * 20261008110000-franchise-laws-dream-city-names renames the legacy cities
 * (and the institutions and house named after them) in every row of the
 * four seeded law documents, leaves other documents and borrowed names
 * (Velvet Season, Glow Week, Pulse Media Network) alone, and changes
 * nothing on a second run (wiring map, docs/reads/2026-10-06-lalaverse-
 * wiring-map.md §2c, fix-list item 20).
 */
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261008110000-franchise-laws-dream-city-names');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const TAG = 'Dream city law test';

(shouldSkip ? describe.skip : describe)('franchise laws: DREAM city names', () => {
  const insert = (title, content, source) => run(
    `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, source_document, extracted_by, status, created_at, updated_at)
     VALUES (:title, :content, 'franchise_law', 'critical', true, :source, 'system', 'active', NOW(), NOW())`,
    { title, content, source });
  const read = async (title) => (await q('SELECT title, content FROM franchise_knowledge WHERE title = :title', { title }))[0];

  beforeAll(async () => {
    await insert(`${TAG}: The City System`, JSON.stringify({
      cities: [{ name: 'Velvet City', majorEvents: ['Velvet Season'] }, { name: 'Pulse City' }, { name: 'Horizon City' }],
      schools: ['The Velvet Academy', 'The Glow Institute', 'Horizon Tech Institute'],
      houses: ['Velvet House', 'Glow Labs', 'Pulse Media Network'],
    }), 'world-infrastructure-v1.0');
    await insert(`${TAG}: Migration`, 'Creator Harbor → Velvet City; started in Glow District salons', 'character-life-simulation-v1.0');
    await insert(`${TAG}: Other document`, 'A note that mentions Velvet City', 'amber-push');
  });

  afterAll(async () => {
    await run(`DELETE FROM franchise_knowledge WHERE title LIKE :tag`, { tag: `${TAG}%` });
  });

  it('renames the cities, schools and house in the law documents; borrowed names stay', async () => {
    await migration.up(sequelize.getQueryInterface());

    const city = JSON.parse((await read(`${TAG}: The City System`)).content);
    expect(city.cities.map((c) => c.name)).toEqual(['Dazzle District', 'Echo Park', 'Ascent Tower']);
    expect(city.cities[0].majorEvents).toEqual(['Velvet Season']);
    expect(city.schools).toEqual(['The Dazzle Academy', 'The Radiance Institute', 'Ascent Tech Institute']);
    expect(city.houses).toEqual(['Dazzle House', 'Glow Labs', 'Pulse Media Network']);

    expect((await read(`${TAG}: Migration`)).content).toBe('Maverick Harbor → Dazzle District; started in Radiance Row salons');
  });

  it('leaves other documents alone, and a second run changes nothing', async () => {
    expect((await read(`${TAG}: Other document`)).content).toBe('A note that mentions Velvet City');
    const before = await read(`${TAG}: The City System`);
    await migration.up(sequelize.getQueryInterface());
    expect(await read(`${TAG}: The City System`)).toEqual(before);
  });
});
