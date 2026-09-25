/**
 * StoryTaskArc is not paranoid (Task #1841).
 *
 * The app's global define (src/config/sequelize.js) sets paranoid: true.
 * Production story_task_arcs has no deleted_at column, so StoryTaskArc
 * must opt out; otherwise every read adds `"deleted_at" IS NULL` and every
 * upsert asks for `RETURNING ... "deleted_at"`, and both fail.
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
    if (options.type === QueryTypes.UPSERT) return [options.instance, null];
    return [];
  };
  const defineStoryTaskArc = require(path.join('..', '..', '..', 'src', 'models', 'StoryTaskArc.js'));
  return { StoryTaskArc: defineStoryTaskArc(sequelize), captured };
}

describe('StoryTaskArc generated SQL has no deleted_at', () => {
  it('the app define is still paranoid (the premise of this test)', () => {
    expect(appConfig.test.define.paranoid).toBe(true);
  });

  it('findOne', async () => {
    const { StoryTaskArc, captured } = defineWithAppDefine();
    await StoryTaskArc.findOne({ where: { character_key: 'justawoman' } });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/FROM "story_task_arcs"/);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('findOne with order', async () => {
    const { StoryTaskArc, captured } = defineWithAppDefine();
    await StoryTaskArc.findOne({
      where: { character_key: 'justawoman' },
      order: [['updated_at', 'DESC']],
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('unscoped().findOne', async () => {
    const { StoryTaskArc, captured } = defineWithAppDefine();
    await StoryTaskArc.unscoped().findOne({ where: { character_key: 'justawoman' } });
    expect(captured).toHaveLength(1);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('upsert', async () => {
    const { StoryTaskArc, captured } = defineWithAppDefine();
    await StoryTaskArc.upsert({
      character_key: 'justawoman',
      display_name: 'JustAWoman',
      world: 'book-1',
      narrative_spine: null,
      tasks: [],
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/INSERT INTO "story_task_arcs"/);
    expect(captured[0]).toMatch(/ON CONFLICT/);
    expect(captured[0]).not.toMatch(/deleted_at/);
  });

  it('the model reports paranoid off', () => {
    const { StoryTaskArc } = defineWithAppDefine();
    expect(StoryTaskArc.options.paranoid).toBe(false);
    expect(StoryTaskArc.rawAttributes.deleted_at).toBeUndefined();
  });
});
