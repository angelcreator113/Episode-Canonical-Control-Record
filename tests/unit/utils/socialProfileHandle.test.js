// ============================================================================
// Task #1893 — the shared handle-uniqueness module (moved out of
// socialProfileRoutes.js, Task #1886 semantics unchanged). The lookup is
// rendered against the real SocialProfile model (never connected) to show the
// SQL: both @ forms, ILIKE with wildcards escaped, and — for a rename — the
// profile's own id excluded.
// ============================================================================

const { Sequelize, DataTypes } = require('sequelize');
const {
  normaliseHandle,
  handleKey,
  escapeLike,
  findHandleHolder,
  handleHolderIsDeleted,
  handleTakenMessage,
  handleTakenBody,
} = require('../../../src/utils/socialProfileHandle');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', {
  logging: false,
  define: { underscored: true, timestamps: true, paranoid: true, freezeTableName: true },
});
const Model = require('../../../src/models/SocialProfile')(sequelize, DataTypes);

async function renderedLookup(handle, opts) {
  const findOne = jest.fn().mockResolvedValue(null);
  await findHandleHolder({ SocialProfile: { findOne } }, handle, opts);
  const query = findOne.mock.calls[0][0];
  const sql = sequelize.getQueryInterface().queryGenerator.selectQuery(
    'social_profiles', { ...query, attributes: [['id', 'id']], limit: 1 }, Model,
  );
  return { query, sql };
}

describe('socialProfileHandle (Task #1893)', () => {
  it('normalises, keys and escapes as #1886 ruled', () => {
    expect(normaliseHandle('sable')).toBe('@sable');
    expect(normaliseHandle('@sable')).toBe('@sable');
    expect(handleKey('@StudioBySable')).toBe(handleKey('studiobysable'));
    expect(escapeLike('glow_theory%\\')).toBe('glow\\_theory\\%\\\\');
  });

  it('looks up both @ forms case-insensitively, soft-deleted rows included', async () => {
    const { query, sql } = await renderedLookup('@glow_theory');
    expect(query.paranoid).toBe(false);
    expect(sql).toContain(`"handle" ILIKE '@glow\\_theory'`);
    expect(sql).toContain(`"handle" ILIKE 'glow\\_theory'`);
    expect(sql).not.toContain('"id" !=');
  });

  it('excludes the renamed profile\'s own id when excludeId is given', async () => {
    const { query, sql } = await renderedLookup('My_Handle', { excludeId: 30 });
    expect(query.paranoid).toBe(false);
    expect(sql).toContain(`"handle" ILIKE '@My\\_Handle'`);
    expect(sql).toContain('"id" != 30');
  });

  it('describes live and deleted holders', () => {
    expect(handleHolderIsDeleted({ id: 1, deletedAt: null })).toBe(false);
    expect(handleHolderIsDeleted({ id: 1, deletedAt: new Date() })).toBe(true);
    expect(handleTakenMessage('sable', { id: 4, deletedAt: null }))
      .toBe('@sable is already taken by an existing creator (id 4) — pick another handle.');
    expect(handleTakenBody('sable', { id: 4, deletedAt: new Date() })).toEqual({
      error: '@sable belongs to a deleted creator (id 4) — restore or purge it to reuse the handle.',
      handleTaken: true,
      handle: '@sable',
      holder: { id: 4, deleted: true },
    });
  });
});
