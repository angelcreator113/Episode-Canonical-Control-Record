/**
 * The generators read the facts (Character Consistency Engine step 5a; the
 * spec's Piece 2: "prose generates FROM the facts"), with the Anthropic calls
 * mocked. A character whose facts are: 2M followers (the ledger), gone dark,
 * a slow-fashion creator, income not decided yet. Their feed profile still
 * says 1.2M (the drift the spec found).
 * - regenerating the feed profile puts the FACTS block in the prompt and keeps
 *   the decided count (2M, mega) whatever the answer says;
 * - the registry fill-ins (backfill-sections, generate-section) get the block,
 *   and a decided fact sets its field while an undecided one is cleared;
 * - interior generation and voice building get the block.
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
/** Every prompt text the mock was sent: system and messages. */
const promptsSent = () => mockCreate.mock.calls.map(([arg]) => [
  typeof arg.system === 'string' ? arg.system : JSON.stringify(arg.system || ''),
  ...(arg.messages || []).map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))),
].join('\n'));

(shouldSkip ? describe.skip : describe)('the generators read the facts', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  let pid;
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-admin-genfacts', email: 'evoni@genfacts.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `GenFacts ${TAG}`, slug: `genfacts-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `GenFacts ${TAG}` });
    const [[p]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, follower_tier, current_state, display_name, status, created_at, updated_at)
       VALUES (:h, 'instagram', 'Slow fashion.', 'lalaverse', '1.2M', 'mega', 'gone_dark', :name, 'generated', NOW(), NOW()) RETURNING id`,
      { h: `@genfacts${TAG}`, name: `GenFacts ${TAG}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, depth_level, feed_profile_id, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren Test', 'support', 'accepted', 'active', :pid, :facts, NOW(), NOW())`,
    { ...ids, key: `genfacts-${TAG}`, pid, facts: JSON.stringify({ occupation: 'Slow-fashion creator', undecided: ['income'] }) });
    await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
      VALUES (:show, :pid, 0, 2000000, 2000000, 'start', 'test', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :char', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM social_profile_followers WHERE social_profile_id = :pid', { pid });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const expectFactsIn = (prompt) => {
    expect(prompt).toContain('FACTS (canon, the one source of truth)');
    expect(prompt).toContain('- followers: 2M (2,000,000)');
    expect(prompt).toContain('- account status: gone dark (they stopped posting)');
    expect(prompt).toContain('- what they do: Slow-fashion creator');
    expect(prompt).toContain('NOT DECIDED YET: income.');
  };

  it('regenerating the feed profile states the facts and keeps the decided count', async () => {
    mockCreate.mockResolvedValue(reply({ display_name: 'GenFacts', follower_tier: 'macro', follower_count_approx: '1.2M', archetype: 'the_peer', current_trajectory: 'rising' }));
    const res = await as(request(app).post(`/api/v1/social-profiles/${pid}/regenerate`)).send({});
    expect(res.status).toBe(200);
    expectFactsIn(promptsSent()[0]);
    expect(promptsSent()[0]).toContain('follower_count_approx is "2M".');
    const [[row]] = await run('SELECT follower_count_approx, follower_tier, current_state, full_profile FROM social_profiles WHERE id = :pid', { pid });
    expect(row).toMatchObject({ follower_count_approx: '2M', follower_tier: 'mega', current_state: 'gone_dark' });
    expect(row.full_profile.follower_count_approx).toBe('2M');
  });

  it('backfill-sections: the block in the prompt; profession from the facts, the undecided income cleared', async () => {
    mockCreate.mockImplementation(async ({ system }) => (String(system).startsWith('Generate 2-4 plot threads')
      ? reply('[]')
      : reply({ career_status: { profession: 'Supermodel', financial_status: 'Very rich', career_goal: 'Be seen' },
        living_context: { financial_reality: 'Loaded', home_environment: 'A linen studio' } })));
    const res = await as(request(app).post(`/api/v1/character-registry/characters/${ids.char}/backfill-sections`)).send({});
    expect(res.status).toBe(200);
    expectFactsIn(promptsSent()[0]);
    const [[row]] = await run('SELECT career_status, living_context FROM registry_characters WHERE id = :char', ids);
    expect(row.career_status).toMatchObject({ profession: 'Slow-fashion creator', financial_status: '', career_goal: 'Be seen' });
    expect(row.living_context).toMatchObject({ financial_reality: '', home_environment: 'A linen studio' });
  });

  it('generate-section demographics: the follower tier comes from the facts', async () => {
    mockCreate.mockResolvedValue(reply({ gender: 'Female', follower_tier: 'micro' }));
    const res = await as(request(app).post(`/api/v1/character-registry/characters/${ids.char}/generate-section`)).send({ section: 'demographics' });
    expect(res.status).toBe(200);
    expectFactsIn(promptsSent()[0]);
    const [[row]] = await run('SELECT follower_tier, gender FROM registry_characters WHERE id = :char', ids);
    expect(row).toMatchObject({ follower_tier: 'mega', gender: 'Female' });
  });

  it('interior generation and voice building get the block', async () => {
    mockCreate.mockResolvedValue(reply({ dilemma: 'Whether to post again.' }));
    await as(request(app).post(`/api/v1/character-registry/characters/${ids.char}/interior/generate`)).send({ fields: ['dilemma'] });
    expect(promptsSent().length).toBeGreaterThan(0);
    expectFactsIn(promptsSent().join('\n'));

    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply({ case: 'lowercase', punctuation: '', emoji: { use: 'never', favorites: [] }, sentence_length: 'short', topics: ['linen'], never_says: [], signature_phrases: [] }));
    const voice = await as(request(app).post(`/api/v1/pulse-voices/${ids.char}/build`));
    expect(voice.status).toBe(200);
    expectFactsIn(promptsSent()[0]);
    expect(promptsSent()[0]).toContain('Their topics and phrases stay inside these facts.');
  });
});
