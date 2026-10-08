/**
 * Onboarding's protagonist and core cast steps send the author to the
 * Character Registry, the cast list (navigation ruling C4). They sent them
 * to /character-generator, which has had no route since #1544, so the
 * link landed on the home page.
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('onboarding sends the cast steps to the Character Registry', () => {
  let token;
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID() };
  const auth = () => `Bearer ${token}`;

  const addCharacter = (roleType, status) => run(
    `INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, created_at, updated_at)
     VALUES (:id, :reg, :key, :name, :name, :roleType, :status, NOW(), NOW())`,
    { id: crypto.randomUUID(), reg: ids.reg, key: `onb-${crypto.randomUUID().slice(0, 8)}`, name: `Onboarding ${TAG}`, roleType, status });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-onboarding-cast', email: 'test@onboarding-cast.dev', name: 'Onboarding Cast Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Onboarding ${TAG}`, slug: `onboarding-${TAG}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`,
      { ...ids, title: `Onboarding ${TAG}` });
    // A universe exists, so the first step is the protagonist.
    await run(`INSERT INTO universes (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: ids.show, name: `Onboarding ${TAG}`, slug: `onboarding-${TAG}` });
    await addCharacter('support', 'accepted');
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM universes WHERE id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const status = () => request(app).get(`/api/v1/onboarding/status/${ids.show}`).set('Authorization', auth());
  const sessionState = () => request(app).post('/api/v1/onboarding/session-state').set('Authorization', auth()).send({ show_id: ids.show });

  it('no protagonist yet: "Set up your protagonist" opens the Character Registry', async () => {
    const res = await status();
    expect(res.status).toBe(200);
    expect(res.body.next_action).toEqual({ label: 'Set up your protagonist', route: '/character-registry', priority: 'critical' });
    const state = await sessionState();
    expect(state.status).toBe(200);
    expect(state.body.primary_action).toEqual({ label: 'Set up your protagonist', route: '/character-registry', priority: 'critical' });
  });

  it('a protagonist but a cast under three: "Generate your core cast" opens the Character Registry', async () => {
    await addCharacter('special', 'accepted');
    const res = await status();
    expect(res.body.next_action).toEqual({ label: 'Generate your core cast', route: '/character-registry', priority: 'high' });
    const state = await sessionState();
    expect(state.body.primary_action).toEqual({ label: 'Generate your core cast', route: '/character-registry', priority: 'high' });
  });
});
