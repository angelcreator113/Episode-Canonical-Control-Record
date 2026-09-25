/**
 * CharacterState is not paranoid (Task #1832).
 *
 * The app's global define (src/config/sequelize.js) sets paranoid: true.
 * Production character_state has no deleted_at column, so CharacterState
 * must opt out; otherwise every read adds `"deleted_at" IS NULL` and every
 * create asks for `RETURNING ... "deleted_at"`, and both fail.
 *
 * No database: the model is loaded with the app's define on a Sequelize
 * instance whose query() is stubbed to record the generated SQL.
 */
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');

const appConfig = require(path.join('..', '..', '..', 'src', 'config', 'sequelize.js'));

function defineWithAppDefine() {
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', {
    dialect: 'postgres',
    logging: false,
    define: appConfig.test.define,
  });
  const captured = [];
  sequelize.query = async (sql, options = {}) => {
    captured.push(typeof sql === 'string' ? sql : sql.query);
    if (options.type === QueryTypes.INSERT) return [options.instance, 1];
    return [];
  };
  const defineCharacterState = require(path.join('..', '..', '..', 'src', 'models', 'CharacterState.js'));
  return { CharacterState: defineCharacterState(sequelize), captured };
}

describe('CharacterState generated SQL has no deleted_at', () => {
  it('the app define is still paranoid (the premise of this test)', () => {
    expect(appConfig.test.define.paranoid).toBe(true);
  });

  it('findOne', async () => {
    const { CharacterState, captured } = defineWithAppDefine();
    await CharacterState.findOne({ where: { show_id: 'a', character_key: 'lala' } });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/FROM "character_state"/);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('findOne with attributes and raw', async () => {
    const { CharacterState, captured } = defineWithAppDefine();
    await CharacterState.findOne({ where: { show_id: 'a' }, attributes: ['coins'], raw: true });
    expect(captured).toHaveLength(1);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('findAll', async () => {
    const { CharacterState, captured } = defineWithAppDefine();
    await CharacterState.findAll({ where: { show_id: 'a' }, limit: 1 });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/FROM "character_state"/);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('create', async () => {
    const { CharacterState, captured } = defineWithAppDefine();
    await CharacterState.create({ show_id: 'a', character_key: 'lala' });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/INSERT INTO "character_state"/);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('the model reports paranoid off', () => {
    const { CharacterState } = defineWithAppDefine();
    expect(CharacterState.options.paranoid).toBe(false);
    expect(CharacterState.rawAttributes.deleted_at).toBeUndefined();
  });
});
