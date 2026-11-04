/**
 * "Make one for me" on The Cast (services/castGenerate; Evoni, 2026-10-19),
 * through the routes, against the test database, with the AI faked:
 *   - propose saves nothing; Try again (a second propose) saves nothing
 *   - Keep makes the registry character and its linked Pulse profile, not
 *     following Lala (it was not made from the feed)
 *   - the same name again is refused; ADMIN only; the budget is a 429; the AI
 *     down is a 502 with a plain message
 *   - who the story needs (Task #3200): propose reads the story's gaps
 *     (services/castStoryGaps) into the prompt and returns them; each
 *     proposal carries its reason; a kept LalaVerse character starts at
 *     Active with its profile, the condition the hourly voice queue reads
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (obj) => ({ content: [{ text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('Make one for me on The Cast', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const name = `Sienna ${tag}`;
  const handle = `sienna_${tag}`;
  const proposal = (extra = {}) => ({
    display_name: name, real_name: 'Sienna Okafor-Vale', role: 'shadow', role_label: 'rival stylist',
    summary: 'She dresses the women Lala wants to be.', city: 'Dazzle District', age: 29, icon: '🦹',
    signature_trait: 'Never pays retail.', core_desire: 'To be the name.', core_fear: 'Being copied.',
    pulse: { handle, bio: 'Styling the uninvited.', follower_count: 48000 }, ...extra,
  });
  let admin;
  let user;
  const post = (path, body, token = admin) => request(app).post(`/api/v1/character-generation/cast/${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const inRegistry = () => q('SELECT * FROM registry_characters WHERE registry_id = :reg AND deleted_at IS NULL', ids);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-castgen', email: 'evoni@castgen.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-castgen', email: 'u@castgen.dev', name: 'U', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Castgen ${tag}`, slug: `castgen-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Castgen', :show, NOW(), NOW())", ids);
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_storylines WHERE show_id = :show', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    const rows = await inRegistry();
    const feed = rows.map((r) => r.feed_profile_id).filter(Boolean);
    if (feed.length) await run('DELETE FROM social_profiles WHERE id IN (:feed)', { feed });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => mockCreate.mockReset());

  it('proposes without saving, and Try again saves nothing either', async () => {
    mockCreate.mockResolvedValue(reply([proposal()]));
    const first = await post('propose', { registry_id: ids.reg, idea: 'a rival stylist', count: 1 });
    expect(first.status).toBe(200);
    expect(first.body.proposals).toHaveLength(1);
    expect(first.body.proposals[0]).toMatchObject({ display_name: name, role_type: 'shadow', current_city: 'dazzle_district', pulse: { handle } });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('a rival stylist');
    const again = await post('propose', { registry_id: ids.reg, count: 1 });
    expect(again.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2); // one call per click
    expect(await inRegistry()).toHaveLength(0);
  });

  it('Make 3 is one call for three', async () => {
    mockCreate.mockResolvedValue(reply([proposal(), proposal({ display_name: `Two ${tag}` }), proposal({ display_name: `Three ${tag}` })]));
    const res = await post('propose', { registry_id: ids.reg, count: 3 });
    expect(res.status).toBe(200);
    expect(res.body.proposals).toHaveLength(3);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('Keep makes the character and its linked Pulse profile, with no follow of Lala', async () => {
    mockCreate.mockResolvedValue(reply([proposal()]));
    const { body } = await post('propose', { registry_id: ids.reg, count: 1 });
    const res = await post('keep', { registry_id: ids.reg, proposal: body.proposals[0] });
    expect(res.status).toBe(201);
    const [c] = await inRegistry();
    expect(c).toMatchObject({ display_name: name, selected_name: 'Sienna Okafor-Vale', role_type: 'shadow', current_city: 'dazzle_district', world: 'lalaverse', social_presence: true });
    expect(c.extra_fields.made_by).toBe('cast_generate');
    // Active with a feed profile: what queueVoiceBuilds (services/pulseVoices) builds a voice for (Task #3200).
    expect(c.depth_level).toBe('active');
    const queued = await q(`SELECT rc.id FROM registry_characters rc
      WHERE rc.id = :id AND rc.depth_level::text IN ('active', 'alive') AND rc.feed_profile_id IS NOT NULL AND rc.deleted_at IS NULL`, { id: c.id });
    expect(queued).toHaveLength(1);
    const [profile] = await q('SELECT * FROM social_profiles WHERE id = :id', { id: c.feed_profile_id });
    expect(profile).toMatchObject({ handle: `@${handle}`, platform: 'pulse', feed_layer: 'lalaverse', city: 'dazzle_district', display_name: name });
    const follows = await q('SELECT * FROM social_profile_followers WHERE character_key = :key', { key: c.character_key });
    expect(follows).toHaveLength(0);
  });

  it('reads what the story needs into the prompt, returns it, and carries each proposal\'s reason (Task #3200)', async () => {
    await run(`INSERT INTO show_story_threads (show_id, title, status, source) VALUES (:show, :t, 'open', 'evoni'), (:show, :closed, 'closed', 'evoni')`,
      { show: ids.show, t: `The missing invitation ${tag}`, closed: `Settled ${tag}` });
    await run(`INSERT INTO pulse_storylines (show_id, title, status) VALUES (:show, :t, 'planned'), (:show, :done, 'paid_off')`,
      { show: ids.show, t: `The feud at the gala ${tag}`, done: `Old news ${tag}` });
    const reason = `The storyline "The feud at the gala ${tag}" has no face yet; she starts it`;
    mockCreate.mockResolvedValue(reply([proposal({ display_name: `Needed ${tag}`, reason, pulse: { handle: `needed_${tag}`, bio: 'x', follower_count: 900 } })]));
    const res = await post('propose', { registry_id: ids.reg, count: 1 });
    expect(res.status).toBe(200);
    const labels = res.body.gaps.map((g) => g.label);
    expect(labels).toContain(`The story thread "The missing invitation ${tag}" is still open`);
    expect(labels).toContain(`The storyline "The feud at the gala ${tag}" has no face yet`);
    expect(labels.join(' ')).not.toContain(`Settled ${tag}`);
    expect(labels.join(' ')).not.toContain(`Old news ${tag}`);
    expect(res.body.gaps.every((g) => g.kind && g.label)).toBe(true);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('WHAT THE STORY NEEDS');
    expect(prompt).toContain(`The feud at the gala ${tag}`);
    expect(prompt).toContain('"reason"');
    expect(res.body.proposals[0].reason).toBe(reason);
    expect(await q('SELECT id FROM registry_characters WHERE registry_id = :reg AND display_name = :n', { reg: ids.reg, n: `Needed ${tag}` })).toHaveLength(0);
  });

  it('the same name again is refused, and nothing more is written', async () => {
    const before = (await inRegistry()).length;
    const res = await post('keep', { registry_id: ids.reg, proposal: { display_name: name, role_type: 'support' } });
    expect(res.status).toBe(409);
    expect((await inRegistry()).length).toBe(before);
  });

  it('a taken handle is refused before anything is written', async () => {
    const before = (await inRegistry()).length;
    const res = await post('keep', { registry_id: ids.reg, proposal: { display_name: `Other ${tag}`, role_type: 'support', pulse: { handle } } });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already taken/);
    expect((await inRegistry()).length).toBe(before);
  });

  it('is ADMIN only', async () => {
    expect((await post('propose', { registry_id: ids.reg }, user)).status).toBe(403);
    expect((await post('keep', { registry_id: ids.reg, proposal: proposal() }, user)).status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('a budget refusal is a 429 saying nothing was made', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const res = await post('propose', { registry_id: ids.reg });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Nothing was made/);
  });

  it('the AI down is a 502 with a plain message, not the SDK text', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error('Could not resolve authentication method. Expected either apiKey or authToken to be set.'));
    const res = await post('propose', { registry_id: ids.reg });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not be reached/);
    expect(JSON.stringify(res.body)).not.toMatch(/authentication method/);
  });
});
