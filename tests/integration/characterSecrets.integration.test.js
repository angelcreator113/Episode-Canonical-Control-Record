/**
 * A character's secrets and the revelation budget (stage B; routes/castRoutes,
 * services/characterSecrets): kept, suggested, retired and deleted secrets,
 * who knows them, and the brief WriteMode builds from them.
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { secretsFor } = require('../../src/services/characterSecrets');
const { getCharacterVoiceContext } = require('../../src/routes/memories/helpers');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('character secrets', () => {
  let admin;
  let editor;
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), maren: crypto.randomUUID(), mo: crypto.randomUUID(), other: crypto.randomUUID() };
  const base = `/api/v1/cast/characters/${ids.maren}/secrets`;

  const addCharacter = (id, name, extra = '') => run(
    `INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, core_fear, created_at, updated_at)
     VALUES (:id, :reg, :key, :name, :name, 'support', 'accepted', :fear, NOW(), NOW())`,
    { id, reg: ids.reg, key: `sec-${crypto.randomUUID().slice(0, 8)}`, name: `${name} ${TAG}`, fear: extra || null });

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-secrets', email: 'evoni@secrets.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-secrets-ed', email: 'ed@secrets.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Secrets ${TAG}`, slug: `secrets-${TAG}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`,
      { ...ids, title: `Secrets ${TAG}` });
    await addCharacter(ids.maren, 'Maren', 'Being seen before it is perfect');
    await addCharacter(ids.mo, 'Mo');
  });

  afterAll(async () => {
    await run('DELETE FROM character_secrets WHERE registry_character_id IN (:c)', { c: [ids.maren, ids.mo] });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const as = (token) => ({ Authorization: `Bearer ${token}` });

  it('needs a sign-in to read and the author to write', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).post(base).set(as(editor)).send({ text: 'x' })).status).toBe(403);
    expect((await request(app).get('/api/v1/cast/characters/nope/secrets').set(as(admin))).status).toBe(400);
    expect((await request(app).get(`/api/v1/cast/characters/${ids.other}/secrets`).set(as(admin))).status).toBe(404);
  });

  it('keeps a secret, hint only everywhere until changed, with who knows it', async () => {
    const empty = await request(app).get(base).set(as(editor));
    expect(empty.status).toBe(200);
    expect(empty.body.secrets).toEqual([]);
    expect(empty.body.cast).toEqual([{ id: ids.mo, name: `Mo ${TAG}` }]);

    expect((await request(app).post(base).set(as(admin)).send({ text: '  ' })).status).toBe(400);
    const made = await request(app).post(base).set(as(admin)).send({ text: 'She sold her mother’s ring', source_field: 'wound' });
    expect(made.status).toBe(200);
    const { secret } = made.body;
    expect(secret).toMatchObject({ text: 'She sold her mother’s ring', status: 'confirmed', state: 'hidden', known_by: [],
      permissions: { episode: 'hint', short_story: 'hint', chapter: 'hint' } });

    const bad = await request(app).put(`${base}/${secret.id}`).set(as(admin)).send({ permissions: { episode: 'shout' } });
    expect(bad.status).toBe(400);
    expect((await request(app).put(`${base}/${secret.id}`).set(as(admin)).send({ known_by: [ids.other] })).status).toBe(400);

    const changed = await request(app).put(`${base}/${secret.id}`).set(as(admin))
      .send({ permissions: { chapter: 'reveal' }, known_by: [ids.mo, ids.maren], state: 'hinted', where: 'episode 3' });
    expect(changed.status).toBe(200);
    expect(changed.body.secret).toMatchObject({
      permissions: { episode: 'hint', short_story: 'hint', chapter: 'reveal' }, known_by: [ids.mo], state: 'hinted', where: 'episode 3',
      known_by_people: [{ id: ids.mo, name: `Mo ${TAG}` }],
    });
  });

  it('gives writers only the kept ones, and WriteMode clears the chapter’s', async () => {
    const cand = await request(app).post(base).set(as(admin)).send({ text: 'A candidate only', status: 'candidate' });
    const gone = await request(app).post(base).set(as(admin)).send({ text: 'Retired one' });
    await request(app).put(`${base}/${gone.body.secret.id}`).set(as(admin)).send({ status: 'retired' });

    const list = await request(app).get(base).set(as(admin));
    expect(list.body.secrets.map((s) => s.text)).toEqual(['She sold her mother’s ring', 'A candidate only']);

    const map = await secretsFor(sequelize, [ids.maren, ids.mo, 'not-an-id']);
    expect(map.get(ids.maren).map((s) => s.text)).toEqual(['She sold her mother’s ring']);
    expect(map.has(ids.mo)).toBe(false);

    const { voiceBlock: voice } = await getCharacterVoiceContext(ids.maren);
    expect(voice).toContain(`- She sold her mother’s ring [MAY BE REVEALED in this story. Known to: Mo ${TAG}. Already hinted (episode 3).]`);
    expect(voice).toContain('CLEARED TO REVEAL in this story');
    expect(voice).not.toContain('A candidate only');

    const del = await request(app).delete(`${base}/${cand.body.secret.id}`).set(as(admin));
    expect(del.status).toBe(200);
    expect((await request(app).delete(`${base}/${cand.body.secret.id}`).set(as(admin))).status).toBe(404);
  });

  it('suggests candidates from their brief, skipping ones already written', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify({ secrets: [
      { text: 'She sold her mother’s ring!', source_field: 'wound' },
      { text: 'She never finished school', source_field: 'self_narrative' },
      { text: 'She rehearses apologies', source_field: 'made_up' },
    ] }) }] });
    const res = await request(app).post(`${base}/suggest`).set(as(admin));
    expect(res.status).toBe(200);
    expect(res.body.added.map((s) => [s.text, s.source_field, s.status])).toEqual([
      ['She never finished school', 'self_narrative', 'candidate'],
      ['She rehearses apologies', 'other', 'candidate'],
    ]);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Being seen before it is perfect');
    expect(prompt).toContain('- She sold her mother’s ring');

    // Nothing to read in Mo's inner life: no call.
    const none = await request(app).post(`/api/v1/cast/characters/${ids.mo}/secrets/suggest`).set(as(admin));
    expect(none.status).toBe(409);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
