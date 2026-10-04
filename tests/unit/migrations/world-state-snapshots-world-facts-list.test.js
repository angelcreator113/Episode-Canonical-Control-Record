/**
 * 20261004140000-world-state-snapshots-world-facts-list (review item 8).
 * queryInterface is a recorder; no database. Pins: the object-shaped
 * temperature rows are moved into metadata.world_temperature and emptied,
 * any other non-list value is emptied, and the check constraint is
 * (re)added; down drops only the constraint.
 */
const migration = require('../../../src/migrations/20261004140000-world-state-snapshots-world-facts-list');

function makeQI() {
  const statements = [];
  const query = jest.fn(async (sql) => { statements.push(sql.replace(/\s+/g, ' ').trim()); return [[], 0]; });
  return { qi: { sequelize: { query, transaction: async (fn) => fn('tx') } }, statements };
}

describe('world_facts list migration', () => {
  test('up moves the temperature object into metadata, empties non-lists, adds the check', async () => {
    const { qi, statements } = makeQI();
    await migration.up(qi);
    expect(statements[0]).toMatch(/UPDATE world_state_snapshots SET metadata = COALESCE\(metadata, '\{\}'::jsonb\) \|\| jsonb_build_object\( 'world_temperature'/);
    expect(statements[0]).toMatch(/'value', world_facts -> 'worldTemperature'/);
    expect(statements[0]).toMatch(/'updated_at', world_facts -> 'temperatureUpdatedAt'/);
    expect(statements[0]).toMatch(/world_facts = '\[\]'::jsonb/);
    expect(statements[0]).toMatch(/WHERE jsonb_typeof\(world_facts\) = 'object'/);
    expect(statements[1]).toMatch(/WHERE world_facts IS NOT NULL AND jsonb_typeof\(world_facts\) NOT IN \('array', 'object'\)/);
    expect(statements[2]).toMatch(/DROP CONSTRAINT IF EXISTS world_state_snapshots_world_facts_is_list/);
    expect(statements[3]).toMatch(/ADD CONSTRAINT world_state_snapshots_world_facts_is_list CHECK \(world_facts IS NULL OR jsonb_typeof\(world_facts\) = 'array'\)/);
    expect(statements).toHaveLength(4);
  });

  test('down drops only the constraint', async () => {
    const { qi, statements } = makeQI();
    await migration.down(qi);
    expect(statements).toEqual(['ALTER TABLE world_state_snapshots DROP CONSTRAINT IF EXISTS world_state_snapshots_world_facts_is_list']);
  });
});
