/**
 * script_line_keys on the Episode and EpisodeScriptVersion models
 * (architecture A1b). No database: the models are defined on an unconnected
 * Sequelize whose query is captured. Pins: the attribute is nullable JSONB;
 * no default query (findAll, findByPk, the active and deleted scopes, an
 * include) selects it; a query that names it does; toJSON never carries it,
 * while the instance can still read it.
 */
const { Sequelize, DataTypes } = require('sequelize');

function setup() {
  const sequelize = new Sequelize('postgres://u:p@localhost:5432/none', { logging: false });
  const Episode = require('../../../src/models/Episode')(sequelize, DataTypes);
  const EpisodeScriptVersion = require('../../../src/models/EpisodeScriptVersion')(sequelize, DataTypes);
  EpisodeScriptVersion.belongsTo(Episode, { foreignKey: 'episode_id', as: 'episode' });
  const sql = [];
  jest.spyOn(sequelize, 'query').mockImplementation(async (q) => { sql.push(typeof q === 'string' ? q : q.query); return []; });
  return { sequelize, Episode, EpisodeScriptVersion, sql };
}

describe('A1b: script_line_keys is stored but internal', () => {
  afterEach(() => jest.restoreAllMocks());

  test('both models declare it as nullable JSONB', () => {
    const { Episode, EpisodeScriptVersion } = setup();
    for (const M of [Episode, EpisodeScriptVersion]) {
      const attr = M.rawAttributes.script_line_keys;
      expect(attr).toBeDefined();
      expect(attr.type.key).toBe('JSONB');
      expect(attr.allowNull).toBe(true);
      expect(attr.defaultValue).toBeUndefined();
    }
  });

  test('no default Episode query selects it; a query that names it does', async () => {
    const { Episode, sql } = setup();
    await Episode.findAll();
    await Episode.findByPk('11111111-1111-4111-8111-111111111111');
    await Episode.findActive();
    await Episode.scope('deleted').findAll();
    await Episode.findAll({ attributes: ['id', 'script_line_keys'] });
    expect(sql).toHaveLength(5);
    for (const q of sql.slice(0, 4)) {
      expect(q).toMatch(/"script_content"/);
      expect(q).not.toMatch(/script_line_keys/);
    }
    expect(sql[4]).toMatch(/"script_line_keys"/);
  });

  test('no default EpisodeScriptVersion query selects it, nor an Episode include', async () => {
    const { EpisodeScriptVersion, Episode, sql } = setup();
    await EpisodeScriptVersion.findAll();
    await EpisodeScriptVersion.findOne({ where: { id: '11111111-1111-4111-8111-111111111111' } });
    await EpisodeScriptVersion.findAll({ include: [{ model: Episode, as: 'episode' }] });
    for (const q of sql) expect(q).not.toMatch(/script_line_keys/);
    await EpisodeScriptVersion.findAll({ attributes: ['id', 'script_line_keys'] });
    expect(sql[3]).toMatch(/"script_line_keys"/);
  });

  test('toJSON never carries it; the instance still reads it', () => {
    const { Episode, EpisodeScriptVersion } = setup();
    const keys = { v: 1, text_hash: '00000000', lines: [], retired: [] };
    const ep = Episode.build({ title: 'Studio Day', script_content: 'Lala: Hi.', script_line_keys: keys });
    expect(ep.toJSON()).not.toHaveProperty('script_line_keys');
    expect(ep.toJSON()).toMatchObject({ title: 'Studio Day', script_content: 'Lala: Hi.' });
    expect(JSON.stringify(ep)).not.toMatch(/script_line_keys/);
    expect(ep.get('script_line_keys')).toEqual(keys);
    const v = EpisodeScriptVersion.build({ episode_id: '11111111-1111-4111-8111-111111111111', script_content: 'Lala: Hi.', script_line_keys: keys });
    expect(v.toJSON()).not.toHaveProperty('script_line_keys');
    expect(v.toJSON()).toMatchObject({ script_content: 'Lala: Hi.', source: 'save' });
    expect(v.get('script_line_keys')).toEqual(keys);
  });
});
