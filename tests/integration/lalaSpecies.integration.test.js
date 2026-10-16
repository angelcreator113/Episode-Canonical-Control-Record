/**
 * Migration 20261016070000: Lala's species becomes 'sentient AI' where it is
 * still 'human' or empty; a chosen species stays; down restores exactly
 * those (Evoni, 2026-10-16; docs/CANON.md). The local migrated test DB.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const Sequelize = require('sequelize');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261016070000-lala-species');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("Lala's species", () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const regs = [crypto.randomUUID(), crypto.randomUUID()];
  const human = crypto.randomUUID();
  const chosen = crypto.randomUUID();
  const other = crypto.randomUUID();
  const qi = () => sequelize.getQueryInterface();
  const species = async (id) => (await run('SELECT species FROM registry_characters WHERE id = :id', { id }))[0][0].species;

  beforeAll(async () => {
    await migration.down(qi());
    for (const [i, reg] of regs.entries()) {
      await run('INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, :t, NOW(), NOW())', { reg, t: `Species ${TAG} ${i}` });
    }
    const add = (id, reg, key, sp) => run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, species, created_at, updated_at)
      VALUES (:id, :reg, :key, :name, 'special', 'draft', :sp, NOW(), NOW())`, { id, reg, key, name: `S ${TAG}`, sp });
    await add(human, regs[0], 'lala', 'human');
    await add(chosen, regs[1], 'lala', 'digital being');
    await add(other, regs[0], `not-lala-${TAG}`, 'human');
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id IN (:regs)', { regs });
    await run('DELETE FROM character_registries WHERE id IN (:regs)', { regs });
    await migration.up(qi(), Sequelize);
    await sequelize.close();
  });

  it("sets Lala's species only where it was human, and down puts it back", async () => {
    await migration.up(qi(), Sequelize);
    expect(await species(human)).toBe('sentient AI');
    expect(await species(chosen)).toBe('digital being');
    expect(await species(other)).toBe('human');
    await migration.down(qi());
    expect(await species(human)).toBe('human');
    expect(await species(chosen)).toBe('digital being');
  });
});
