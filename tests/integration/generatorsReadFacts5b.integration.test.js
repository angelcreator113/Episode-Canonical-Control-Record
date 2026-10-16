/**
 * The secondary generators read the facts (Character Consistency Engine step
 * 5b), with the Anthropic calls mocked. A character whose facts are: 2M
 * followers (the ledger), gone dark, a slow-fashion creator, income not
 * decided yet; linked to a world character whose occupation says otherwise.
 * - depth dimensions, the character AI profile builder, the legacy deep
 *   profile and the writer paragraph get the FACTS block;
 * - World Studio "deepen" gets it, and its re-sync keeps the decided
 *   occupation instead of the world character's.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (body) => ({ content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptsSent = () => mockCreate.mock.calls.map(([arg]) => [
  typeof arg.system === 'string' ? arg.system : JSON.stringify(arg.system || ''),
  ...(arg.messages || []).map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))),
].join('\n')).join('\n');

(shouldSkip ? describe.skip : describe)('the secondary generators read the facts', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), world: crypto.randomUUID() };
  let pid;
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);

  const keyWas = process.env.ANTHROPIC_API_KEY;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // World Studio refuses without a key; the SDK is mocked here.
    process.env.ANTHROPIC_API_KEY = keyWas || 'test-key';
    token = TokenService.generateTokenPair({ id: 'test-admin-genfacts-b', email: 'evoni@genfacts-b.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `GenFactsB ${TAG}`, slug: `genfacts-b-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `GenFactsB ${TAG}` });
    const [[p]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, current_state, display_name, created_at, updated_at)
       VALUES (:h, 'instagram', 'Slow fashion.', 'lalaverse', '1.2M', 'gone_dark', :name, NOW(), NOW()) RETURNING id`,
      { h: `@genfactsb${TAG}`, name: `GenFactsB ${TAG}` });
    pid = p.id;
    await run(`INSERT INTO world_characters (id, name, character_type, occupation, created_at, updated_at)
      VALUES (:world, 'Maren World', 'rival', 'Runway model', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, world_character_id, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren Test', 'support', 'accepted', :pid, :world, :facts, NOW(), NOW())`,
    { ...ids, key: `genfacts-b-${TAG}`, pid, facts: JSON.stringify({ occupation: 'Slow-fashion creator', undecided: ['income'] }) });
    await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
      VALUES (:show, :pid, 0, 2000000, 2000000, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    if (keyWas === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = keyWas;
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM world_characters WHERE id = :world', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const expectFacts = () => {
    const prompt = promptsSent();
    expect(prompt).toContain('FACTS (canon, the one source of truth)');
    expect(prompt).toContain('- followers: 2M (2,000,000)');
    expect(prompt).toContain('- what they do: Slow-fashion creator');
    expect(prompt).toContain('NOT DECIDED YET: income.');
  };

  it('depth dimensions', async () => {
    mockCreate.mockResolvedValue(reply({ de_money_behavior: 'Careful.' }));
    const res = await as(request(app).post(`/api/v1/character-depth/${ids.char}/generate`)).send({});
    expect(res.status).toBe(200);
    expectFacts();
  });

  it('the character AI profile builder', async () => {
    mockCreate.mockResolvedValue(reply({ description: 'A slow-fashion creator.' }));
    await as(request(app).post('/api/v1/character-ai/build-profile')).send({ character_id: ids.char });
    expect(mockCreate).toHaveBeenCalled();
    expectFacts();
  });

  it('the legacy deep profile and the writer paragraph', async () => {
    mockCreate.mockResolvedValue(reply({ class_and_money: { current_class: 'comfortable' } }));
    await as(request(app).post(`/api/v1/character-registry/characters/${ids.char}/deep-profile/generate`)).send({});
    expect(mockCreate).toHaveBeenCalled();
    expectFacts();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply('She keeps the linen.'));
    await as(request(app).post(`/api/v1/character-registry/characters/${ids.char}/writer-paragraph/generate`)).send({});
    expect(mockCreate).toHaveBeenCalled();
    expectFacts();
  });

  it('World Studio deepen: the block in the prompt, and the re-sync keeps the decided occupation', async () => {
    mockCreate.mockResolvedValue(reply({ career_goal: 'Own a linen house.' }));
    const res = await as(request(app).post(`/api/v1/world/characters/${ids.world}/deepen`)).send({});
    expect(res.status).toBe(200);
    expectFacts();
    const [[row]] = await run('SELECT career_status, description, subtitle FROM registry_characters WHERE id = :char', ids);
    expect(row.career_status.profession).toBe('Slow-fashion creator');
    expect(row.description).toMatch(/^Slow-fashion creator/);
    expect(row.subtitle).toContain('Slow-fashion creator');
    expect(row.subtitle).not.toContain('Runway model');
  });
});
