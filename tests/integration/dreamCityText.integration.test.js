/**
 * One DREAM city list (Evoni, 2026-10-18: "start the one DREAM city list"):
 * a city's words saved through World Foundation's save (PUT
 * /page-content/world_infrastructure/DREAM_CITIES) are what the post
 * drafter tells the model about the city, at once (the save clears the
 * writers' cache); reverting the list brings the built-in text back. The
 * saved list the database had is put back afterwards.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const models = require('../../src/models');
const TokenService = require('../../src/services/tokenService');
const { posterWorldLines } = require('../../src/services/posterWorld');
const { DREAM_CITY_CULTURE } = require('../../src/utils/feedCities');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const URL = '/api/v1/page-content/world_infrastructure/DREAM_CITIES';

(shouldSkip ? describe.skip : describe)('one DREAM city list', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  let before;
  let profile;
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-cities', email: 'evoni@cities.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    [[before]] = await run("SELECT data FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'");
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, city, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'lalaverse', 'echo_park', NOW(), NOW()) RETURNING id`, { h: `cities${tag}` });
    profile = row.id;
  });

  afterAll(async () => {
    await run('DELETE FROM social_profiles WHERE id = :profile', { profile });
    if (before) {
      await run("UPDATE page_content SET data = CAST(:data AS jsonb) WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'", { data: JSON.stringify(before.data) });
    } else {
      await run("DELETE FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'");
    }
    await sequelize.close();
  });

  it('a saved city\'s words reach the drafter at once; reverting brings back the built-in text', async () => {
    // Read once, so the writers' cache holds the old words.
    await posterWorldLines(models, profile);
    const list = (Array.isArray(before?.data) ? before.data : [{ key: 'echo_park', name: 'Echo Park' }])
      .map((c) => (c.key === 'echo_park' ? { ...c, culture: `Karaoke capital ${tag}.`, energy: '', famousFor: '', whoLivesHere: '', majorEvents: [] } : c));
    const res = await request(app).put(URL).set('Authorization', `Bearer ${token}`).send({ data: list });
    expect(res.status).toBe(200);
    expect(await posterWorldLines(models, profile)).toContain(`They live in Echo Park, a DREAM city: Karaoke capital ${tag}.`);

    const del = await request(app).delete(URL).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(await posterWorldLines(models, profile)).toContain(`They live in Echo Park, a DREAM city: ${DREAM_CITY_CULTURE.echo_park}`);
  });
});
