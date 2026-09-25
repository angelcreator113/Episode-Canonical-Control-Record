/**
 * SocialProfile.destroy() is a soft delete (Task #1833).
 *
 * The Feed's delete confirms (SocialProfileGenerator.jsx: BulkDeleteDialog
 * and deleteProfile) say a deleted profile is hidden and can be restored.
 * That is only true because SocialProfile sets no `paranoid` option and so
 * inherits `paranoid: true` from the app's `define` in
 * src/config/sequelize.js. This test pins that fact: destroy() must generate
 * an UPDATE that sets deleted_at, never a DELETE.
 *
 * No database: the model is defined on an unconnected Sequelize instance
 * and sequelize.query is stubbed to capture the generated SQL.
 */
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const appConfig = require(path.join('..', '..', '..', 'src', 'config', 'sequelize.js'));

function defineSocialProfileWithAppDefine() {
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', {
    logging: false,
    define: appConfig.test.define,
  });
  const defineSocialProfile = require(path.join('..', '..', '..', 'src', 'models', 'SocialProfile.js'));
  const SocialProfile = defineSocialProfile(sequelize, DataTypes);
  const captured = [];
  sequelize.query = jest.fn(async (sql) => {
    captured.push(typeof sql === 'string' ? sql : sql.query);
    return [[], 0];
  });
  return { SocialProfile, captured };
}

describe('SocialProfile soft delete', () => {
  it('the app define sets paranoid: true and the model does not override it', () => {
    expect(appConfig.test.define.paranoid).toBe(true);
    expect(appConfig.production.define.paranoid).toBe(true);
    const { SocialProfile } = defineSocialProfileWithAppDefine();
    expect(SocialProfile.options.paranoid).toBe(true);
    expect(SocialProfile.rawAttributes.deletedAt.field).toBe('deleted_at');
  });

  it('destroy() generates an UPDATE setting deleted_at, not a DELETE', async () => {
    const { SocialProfile, captured } = defineSocialProfileWithAppDefine();
    await SocialProfile.destroy({ where: { id: [1, 2] } });
    expect(captured).toHaveLength(1);
    const sql = captured[0];
    expect(sql).toMatch(/^UPDATE "social_profiles" SET "deleted_at"=/);
    expect(sql).toContain('"deleted_at" IS NULL');
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });
});
