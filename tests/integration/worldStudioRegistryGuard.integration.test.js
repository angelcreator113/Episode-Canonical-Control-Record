/**
 * World Studio no longer overwrites Character Registry fields edited there.
 *
 * Evoni's ruling (2026-11-04): the Character Registry is the authoritative
 * owner of a character's identity; World Studio must not overwrite Registry
 * fields through broad saves. PUT /world/characters/:id (and deepen) re-wrote
 * every registry identity field from the world character after each save,
 * so an edit made in the Registry was lost at the next World Studio save.
 *
 * Now (services/registryWriteGuard): the first link fills the registry; after
 * it, a World Studio edit writes a registry field only when the edit changed
 * it and the registry still holds the value World Studio last gave it.
 * Otherwise the registry keeps its value and the response names the field
 * in registry_conflicts.
 *
 * The AI is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ text: JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const registryRow = async (id) => (await q('SELECT * FROM registry_characters WHERE id = :id', { id }))[0];
const worldRow = async (id) => (await q('SELECT * FROM world_characters WHERE id = :id', { id }))[0];

const TAG = crypto.randomUUID().slice(0, 8);
const WORLD = `guard-test-${TAG}`;
const name = (n) => `Guard Test ${TAG} ${n}`;

(shouldSkip ? describe.skip : describe)('World Studio does not overwrite Character Registry edits', () => {
  let token;
  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    token = TokenService.generateTokenPair({
      id: 'test-user-registry-guard', email: 'test@registry-guard.dev', name: 'Registry Guard Test',
      groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
  });

  afterAll(async () => {
    const like = `Guard Test ${TAG}%`;
    const mine = 'SELECT id FROM registry_characters WHERE world_character_id IN (SELECT id FROM world_characters WHERE name LIKE :like)';
    await run(`DELETE FROM character_relationships WHERE character_id_a IN (${mine}) OR character_id_b IN (${mine})`, { like });
    await run(`DELETE FROM registry_characters WHERE id IN (${mine})`, { like });
    const batches = await q('SELECT DISTINCT batch_id FROM world_characters WHERE name LIKE :like AND batch_id IS NOT NULL', { like });
    await run('DELETE FROM world_characters WHERE name LIKE :like', { like });
    for (const { batch_id: id } of batches) await run('DELETE FROM world_character_batches WHERE id = :id', { id });
    await run('DELETE FROM character_registries WHERE book_tag = :tag', { tag: WORLD });
  });

  beforeEach(() => mockCreate.mockReset());

  const make = async (n, extra = {}) => {
    const res = await request(app).post('/api/v1/world/generate-ecosystem-confirm').set('Authorization', auth())
      .send({ world_tag: WORLD, characters: [{
        name: name(n), character_type: 'rival', real_want: 'to be first', core_fear: 'being ordinary',
        public_persona: 'effortless', aesthetic: 'sharp tailoring', color_palette: 'black and gold', ...extra,
      }] });
    expect(res.status).toBe(201);
    return res.body.characters[0];
  };
  const worldPut = (id, body) => request(app).put(`/api/v1/world/characters/${id}`).set('Authorization', auth()).send(body);
  const registryPut = (id, body) => request(app).put(`/api/v1/character-registry/characters/${id}`).set('Authorization', auth()).send(body);

  it('the first link fills the registry character from the world character', async () => {
    const c = await make('First');
    expect(c.registry_character_id).toBeTruthy();
    const rc = await registryRow(c.registry_character_id);
    expect(rc.display_name).toBe(name('First'));
    expect(rc.core_desire).toBe('to be first');
    expect(rc.core_fear).toBe('being ordinary');
    expect(rc.mask_persona).toBe('effortless');
    expect(rc.aesthetic_dna.color_palette).toBe('black and gold');
    expect(rc.world_character_id).toBe(c.id);
  });

  it('an edit to a field unchanged in the registry reaches it', async () => {
    const c = await make('Propagate');
    const res = await worldPut(c.id, { core_fear: 'being forgotten', color_palette: 'oxblood' });
    expect(res.status).toBe(200);
    expect(res.body.registry_conflicts).toEqual([]);
    expect(res.body.registry_sync).toBe('synced');
    expect(res.body.registry_synced).toBe(true);
    expect(res.body.registry_conflicts).toEqual([]);
    expect(res.body.registry_fields_written).toEqual(expect.arrayContaining(
      ['core_fear', 'personality_matrix.fear_line', 'aesthetic_dna.color_palette']));
    const rc = await registryRow(c.registry_character_id);
    expect(rc.core_fear).toBe('being forgotten');
    expect(rc.personality_matrix.fear_line).toBe('being forgotten');
    expect(rc.aesthetic_dna.color_palette).toBe('oxblood');
  });

  it('an edit to a field edited in the registry does not overwrite it and is reported', async () => {
    const c = await make('Conflict');
    expect((await registryPut(c.registry_character_id, { display_name: name('Conflict Canon'), core_desire: 'to be loved, quietly' })).status).toBe(200);

    const res = await worldPut(c.id, { name: name('Conflict Renamed'), real_want: 'to win outright' });
    expect(res.status).toBe(200);
    expect(res.body.registry_sync).toBe('conflicts');
    expect(res.body.registry_character_id).toBe(c.registry_character_id);
    expect(res.body.registry_conflicts).toEqual(expect.arrayContaining([
      { field: 'display_name', registry_value: name('Conflict Canon'), world_value: name('Conflict Renamed') },
      { field: 'core_desire', registry_value: 'to be loved, quietly', world_value: 'to win outright' },
    ]));
    const rc = await registryRow(c.registry_character_id);
    expect(rc.display_name).toBe(name('Conflict Canon'));
    expect(rc.core_desire).toBe('to be loved, quietly');
    // Fields the Registry did not touch still follow the edit.
    expect(rc.selected_name).toBe(name('Conflict Renamed'));
    expect(rc.personality_matrix.desire_line).toBe('to win outright');
    // The world character itself saved.
    expect((await worldRow(c.id)).real_want).toBe('to win outright');
  });

  it('fields the edit did not change are never written, even when the editor sends the whole character', async () => {
    const c = await make('Untouched');
    // Edited in the Registry: a column and a key of a JSON column, plus a key World Studio does not own.
    expect((await registryPut(c.registry_character_id, { mask_persona: 'registry mask', core_fear: 'registry fear' })).status).toBe(200);
    await run(`UPDATE registry_characters
                  SET aesthetic_dna = aesthetic_dna || '{"glam_energy":"Maximal","registry_note":"kept"}'::jsonb
                WHERE id = :id`, { id: c.registry_character_id });
    const before = await registryRow(c.registry_character_id);

    // The World Studio editor sends the whole character back; only aesthetic changed.
    const whole = await worldRow(c.id);
    const body = {};
    for (const f of ['name', 'character_type', 'real_want', 'core_fear', 'public_persona', 'color_palette', 'glam_energy']) body[f] = whole[f];
    body.aesthetic = 'soft knits now';
    const res = await worldPut(c.id, body);
    expect(res.status).toBe(200);
    expect(res.body.registry_conflicts).toEqual([]);
    expect(res.body.registry_fields_written.sort()).toEqual(['aesthetic_dna.era_aesthetic', 'physical_presence']);

    const rc = await registryRow(c.registry_character_id);
    expect(rc.mask_persona).toBe('registry mask');
    expect(rc.core_fear).toBe('registry fear');
    expect(rc.aesthetic_dna).toEqual({ ...before.aesthetic_dna, era_aesthetic: 'soft knits now' });
    expect(rc.aesthetic_dna.registry_note).toBe('kept');
    expect(rc.aesthetic_dna.glam_energy).toBe('Maximal');
    expect(rc.physical_presence).toBe('soft knits now');
    for (const col of ['display_name', 'core_desire', 'personality_matrix', 'career_status', 'extra_fields', 'current_city']) {
      expect(rc[col]).toEqual(before[col]);
    }

    // An edit that changes nothing in the registry writes nothing.
    const again = await worldPut(c.id, { ...body, status: 'draft' });
    expect(again.body.registry_sync).toBe('unchanged');
    expect(again.body.registry_fields_written).toEqual([]);
  });

  it('deepen fills the registry where it still holds World Studio\'s value, and reports a field the Registry filled itself', async () => {
    const c = await make('Deepen', { core_fear: null });
    expect((await registryPut(c.registry_character_id, { core_fear: 'filled in the registry' })).status).toBe(200);
    mockCreate.mockResolvedValue(reply({ core_fear: 'ai fear', at_their_best: 'ai best' }));

    const res = await request(app).post(`/api/v1/world/characters/${c.id}/deepen`).set('Authorization', auth()).send({});
    expect(res.status).toBe(200);
    expect(res.body.deepened).toBe(true);
    expect(res.body.registry_conflicts).toEqual(expect.arrayContaining([
      { field: 'core_fear', registry_value: 'filled in the registry', world_value: 'ai fear' },
    ]));
    expect(res.body.registry_fields_written).toEqual(expect.arrayContaining(['personality_matrix.at_their_best']));
    const rc = await registryRow(c.registry_character_id);
    expect(rc.core_fear).toBe('filled in the registry');
    expect(rc.personality_matrix.at_their_best).toBe('ai best');
  });

  it('a world character with no registry link still saves', async () => {
    const id = crypto.randomUUID();
    await run(`INSERT INTO world_characters (id, name, character_type, status, world_tag, created_at, updated_at)
               VALUES (:id, :name, 'rival', 'draft', :tag, NOW(), NOW())`, { id, name: name('Unlinked'), tag: WORLD });
    const res = await worldPut(id, { core_fear: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.registry_sync).toBe('not_linked');
    expect(res.body.registry_synced).toBe(false);
  });
});
