/**
 * One home for each part of a character's inner life (Evoni, 2026-10-17:
 * approved table; migration 20261017240000, services/characterDepthFields).
 * The merge moves each copy into its home, archives a different value,
 * backs up what it changed and puts it back on down; afterwards the Depth
 * Engine reads and saves its twins through those homes, the profile save
 * route does too, and the blind spot stays the author's.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { mergeCharacters, restoreCharacters } = require('../../src/migrations/20261017240000-merge-character-depth-fields');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (id) => (await run('SELECT * FROM registry_characters WHERE id = :id', { id }))[0][0];

(shouldSkip ? describe.skip : describe)('the merge of the depth fields', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), kai: uuid() };
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-merge', email: 'evoni@merge.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-merge', email: 'ed@merge.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Merge ${tag}`, slug: `merge-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Merge', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, extra_fields,
                 de_blind_spot, de_time_orientation, change_capacity, de_change_capacity, de_change_capacity_score, de_change_condition,
                 money_behavior_pattern, money_behavior_note, created_at, updated_at)
               VALUES (:id, :reg, :key, 'Maren', 'alive', CAST(:extra AS jsonb),
                 'She mistakes control for calm.', 'cyclical', CAST(:cc AS jsonb), 'highly_rigid', 25, 'Being seen unfinished',
                 'spends_to_feel_powerful', 'Buys rooms she never sits in.', NOW(), NOW())`,
    { id: ids.maren, reg: ids.reg, key: `maren-${tag}`, extra: JSON.stringify({ keep: 'me' }), cc: JSON.stringify('She softens slowly.') });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, blind_spot, de_blind_spot, time_orientation, created_at, updated_at)
               VALUES (:id, :reg, :key, 'Kai', 'alive', 'He thinks he is generous.', 'He keeps score.', 'waiting', NOW(), NOW())`,
    { id: ids.kai, reg: ids.reg, key: `kai-${tag}` });
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('each copy moves to its home; a different one is archived; then the Depth Engine and the profile save through the homes; down puts it all back', async () => {
    const before = { maren: await one(ids.maren), kai: await one(ids.kai) };
    expect(await mergeCharacters(sequelize, { ids: [ids.maren, ids.kai] })).toEqual({ moved: 2, archived: 2 });

    const maren = await one(ids.maren);
    expect(maren).toMatchObject({
      blind_spot: 'She mistakes control for calm.', de_blind_spot: null, time_orientation: 'cyclical', de_time_orientation: null,
      de_change_capacity: null, de_change_capacity_score: null, de_change_condition: null,
      de_money_behavior: 'spend_to_feel', money_behavior_pattern: null, money_behavior_note: null,
    });
    expect(maren.change_capacity).toEqual({ description: 'She softens slowly.', mobility: 'highly_rigid', score: 25, conditions_for_change: 'Being seen unfinished' });
    expect(maren.extra_fields).toMatchObject({ keep: 'me', depth_archive: { money_behavior_note: 'Buys rooms she never sits in.' } });

    const kai = await one(ids.kai);
    expect(kai).toMatchObject({ blind_spot: 'He thinks he is generous.', de_blind_spot: null, time_orientation: 'perpetual_waiter' });
    expect(kai.extra_fields.depth_archive).toEqual({ de_blind_spot: 'He keeps score.' });

    // A second run moves nothing.
    expect(await mergeCharacters(sequelize, { ids: [ids.maren, ids.kai] })).toEqual({ moved: 0, archived: 0 });

    // The Depth Engine reads its twins from their homes; the blind spot is the author's.
    const view = await as(admin, request(app).get(`/api/v1/character-depth/${ids.maren}`));
    expect(view.status).toBe(200);
    expect(view.body.depth).toMatchObject({
      de_blind_spot: 'She mistakes control for calm.', de_time_orientation: 'cyclical',
      de_change_capacity: 'highly_rigid', de_change_capacity_score: 25, de_change_condition: 'Being seen unfinished', de_money_behavior: 'spend_to_feel',
    });
    const hidden = await as(editor, request(app).get(`/api/v1/character-depth/${ids.maren}`));
    expect(hidden.body.depth).not.toHaveProperty('de_blind_spot');

    // Confirming saves the twins in their homes.
    const confirm = await as(admin, request(app).post(`/api/v1/character-depth/${ids.maren}/confirm`))
      .send({ proposed: { de_change_capacity_score: 55, de_time_orientation: 'past_anchored', de_blind_spot: 'Calm is her costume.', de_joy_trigger: 'Raw seams' } });
    expect(confirm.status).toBe(200);
    const saved = await one(ids.maren);
    expect(saved).toMatchObject({ blind_spot: 'Calm is her costume.', de_blind_spot: null, time_orientation: 'past_anchored', de_time_orientation: null, de_joy_trigger: 'Raw seams' });
    expect(saved.change_capacity.score).toBe(55);

    // The profile save route: twins to their homes, old time names renamed, the blind spot the author's.
    const put = await as(admin, request(app).put(`/api/v1/character-registry/characters/${ids.kai}`)).send({ de_change_witness: 'His sister', time_orientation: 'future_obsessed' });
    expect(put.status).toBe(200);
    const kai2 = await one(ids.kai);
    expect(kai2.change_capacity).toEqual({ witness: 'His sister' });
    expect(kai2.time_orientation).toBe('future_oriented');
    expect(kai2.de_change_witness).toBeNull();
    await as(editor, request(app).put(`/api/v1/character-registry/characters/${ids.kai}`)).send({ blind_spot: 'not yours to write' });
    expect((await one(ids.kai)).blind_spot).toBe('He thinks he is generous.');
    const profile = await as(editor, request(app).get(`/api/v1/character-registry/characters/${ids.kai}`));
    expect(JSON.stringify(profile.body)).not.toContain('He thinks he is generous.');

    // down: what the merge changed comes back; later edits to other fields stay.
    await restoreCharacters(sequelize, { ids: [ids.maren, ids.kai] });
    const back = await one(ids.maren);
    expect(back).toMatchObject({
      de_blind_spot: before.maren.de_blind_spot, de_time_orientation: 'cyclical', de_change_capacity: 'highly_rigid', money_behavior_pattern: 'spends_to_feel_powerful',
      money_behavior_note: 'Buys rooms she never sits in.', de_money_behavior: null,
    });
    expect(back.extra_fields).toEqual({ keep: 'me' });
    expect((await one(ids.kai)).de_blind_spot).toBe('He keeps score.');
  });
});
