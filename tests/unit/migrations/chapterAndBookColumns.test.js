/**
 * Migration 20261016040000-chapter-and-book-columns: the columns the chapter
 * and book models declare, which production has but no migration created.
 * Added only when missing; never dropped by down (production data).
 */
const mig = require('../../../src/migrations/20261016040000-chapter-and-book-columns');

function fakeQueryInterface(present) {
  const added = [];
  const sequelize = {
    query: jest.fn(async (sql, { replacements }) => {
      if (sql.includes('pg_class')) return [[{ ok: 1 }]];
      return [present.has(`${replacements.table}.${replacements.column}`) ? [{ ok: 1 }] : []];
    }),
  };
  return { added, qi: { sequelize, addColumn: jest.fn(async (t, c, def) => added.push([t, c, def.type.key || def.type.constructor.name])) } };
}
const Sequelize = require('sequelize');

test('adds every missing column with production\'s type', async () => {
  const { qi, added } = fakeQueryInterface(new Set());
  await mig.up(qi, Sequelize);
  expect(added.map(([t, c]) => `${t}.${c}`)).toEqual([
    'storyteller_chapters.sections', 'storyteller_chapters.chapter_template',
    'storyteller_books.theme', 'storyteller_books.pov', 'storyteller_books.tone',
    'storyteller_books.setting', 'storyteller_books.conflict', 'storyteller_books.stakes',
  ]);
  expect(added.find(([, c]) => c === 'sections')[2]).toBe('JSONB');
  expect(added.find(([, c]) => c === 'pov')[2]).toBe('TEXT');
});

test('a database that has them (production) is left as it is', async () => {
  const all = ['storyteller_chapters.sections', 'storyteller_chapters.chapter_template',
    ...['theme', 'pov', 'tone', 'setting', 'conflict', 'stakes'].map((c) => `storyteller_books.${c}`)];
  const { qi, added } = fakeQueryInterface(new Set(all));
  await mig.up(qi, Sequelize);
  expect(added).toEqual([]);
});

test('down drops nothing', async () => {
  const qi = { removeColumn: jest.fn(), sequelize: { query: jest.fn() } };
  await mig.down(qi);
  expect(qi.removeColumn).not.toHaveBeenCalled();
  expect(qi.sequelize.query).not.toHaveBeenCalled();
});
