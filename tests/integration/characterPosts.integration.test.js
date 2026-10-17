/**
 * Generate Posts (Character Consistency Engine step 4):
 * POST /api/v1/cast/characters/:id/posts/generate, with the Anthropic calls
 * mocked. The database is the local migrated test DB.
 * - drafts the posts as drafts, each load-bearing or ambient, all waiting in
 *   Review ('on_request'), at the present story moment, one manual request;
 * - the prompt carries the facts, what is not decided yet, the mask, the
 *   latest posts, and the wound only as private context;
 * - refuses without a Voice Profile, for a dead account, for a bad count,
 *   for an editor, and when the day's manual requests are used.
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

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

/** The drafting answer for the generate call; a passing voice score for the gate's. */
function answer(items) {
  mockCreate.mockImplementation(async ({ messages }) => {
    const prompt = messages[0].content;
    if (prompt.startsWith('Score how well')) return say({ score: 0.92, why: 'her' });
    return say({ items });
  });
}
const generatePrompt = () => mockCreate.mock.calls.map(([arg]) => arg.messages[0].content).find((p) => p.startsWith('You write'));

(shouldSkip ? describe.skip : describe)('Generate Posts', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), novoice: crypto.randomUUID() };
  const pids = {};
  let admin;
  let editor;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-gen', email: 'evoni@gen.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-gen', email: 'e@gen.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Gen ${TAG}`, slug: `gen-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Gen ${TAG}` });
    for (const key of ['maren', 'novoice']) {
      const [[p]] = await run(
        `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, current_state, public_persona, display_name, created_at, updated_at)
         VALUES (:h, 'pulse', 'Slow fashion.', 'lalaverse', '2M', 'peaking', 'Effortless slow-fashion purist', :name, NOW(), NOW()) RETURNING id`,
        { h: `@${key}${TAG}`, name: `${key} ${TAG}` });
      pids[key] = p.id;
    }
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, core_wound, mask_persona, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren', 'support', 'accepted', :pid, 'Worthless without achievement.', 'Never tries; always arrives.', :facts, NOW(), NOW())`,
    { ...ids, key: `maren-${TAG}`, pid: pids.maren, facts: JSON.stringify({ occupation: 'Slow-fashion creator', undecided: ['income'] }) });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, created_at, updated_at)
      VALUES (:novoice, :reg, :key, 'No Voice', 'support', 'accepted', :pid, NOW(), NOW())`, { ...ids, key: `novoice-${TAG}`, pid: pids.novoice });
    await models.PulseVoice.create({
      registry_character_id: ids.char, social_profile_id: pids.maren, habits_json: { temperament: 'measured' },
      examples_json: [{ text: 'Linen again. Always linen.' }], status: 'built', approved_at: new Date(), approved_by: 'evoni',
    });
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, created_at, updated_at)
               VALUES (:id, :show, :h, :pid, 'Retook this eleven times. Still beautiful.', 'live', NOW(), NOW())`,
    { id: crypto.randomUUID(), show: ids.show, h: `maren${TAG}`, pid: pids.maren });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, source_profile_id, event_date, created_at, updated_at)
               VALUES (:id, :show, 'Linen Swap', 'invite', 'ready', :pid, '2026-11-12', NOW(), NOW())`,
    { id: crypto.randomUUID(), show: ids.show, pid: pids.maren });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:char, :novoice)', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(pids) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const generate = (id, body, token = admin) => request(app).post(`/api/v1/cast/characters/${id}/posts/generate`).set('Authorization', `Bearer ${token}`).send(body);

  it('drafts each post for Review, load-bearing or ambient, and releases none', async () => {
    answer([
      { n: 1, text: 'Counting down to the linen swap.', hashtag: '#SlowSift', weight: 'load_bearing', why: 'Builds to her swap', reveals_story: false },
      { n: 2, text: 'Morning light, one cup, no hurry.', hashtag: null, weight: 'ambient', why: 'ignored for ambient', reveals_story: false },
      { n: 3, text: 'Mended a hem today.', weight: 'something else' },
    ]);
    const res = await generate(ids.char, { count: 3, about: 'The week before her linen swap' });
    expect(res.status).toBe(201);
    expect(res.body.drafted.map((d) => [d.weight, d.why])).toEqual([['load_bearing', 'Builds to her swap'], ['ambient', null], ['ambient', null]]);
    const [rows] = await run(`SELECT status, post_weight, post_weight_why, gate_json, story_order, poster_handle FROM feed_posts
      WHERE show_id = :show AND status = 'draft' ORDER BY content_text`, ids);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.status).toBe('draft');
      expect(r.gate_json.review).toContain('on_request');
      expect(r.poster_handle).toBe(`maren${TAG}`);
      expect(Number.isInteger(r.story_order)).toBe(true);
    }
    const [[{ n }]] = await run(`SELECT COUNT(*)::int AS n FROM pulse_requests WHERE show_id = :show AND lane = 'manual' AND kind = 'character_posts'`, ids);
    expect(n).toBe(1);
  });

  it('the prompt carries the facts, what is not decided, the mask, the latest posts, and the wound only as private', async () => {
    answer([{ n: 1, text: 'Linen.', weight: 'ambient' }]);
    expect((await generate(ids.char, { count: 1 })).status).toBe(201);
    const prompt = generatePrompt();
    expect(prompt).toContain('- followers: 2M');
    expect(prompt).toContain('- what they do: Slow-fashion creator');
    expect(prompt).toContain('Not decided yet: income.');
    expect(prompt).toContain('mask persona: Never tries; always arrives.');
    expect(prompt).toContain('public persona: Effortless slow-fashion purist');
    expect(prompt).toContain('- Retook this eleven times. Still beautiful.');
    const [, privateBlock] = prompt.split('PRIVATE (');
    expect(privateBlock).toContain('Worthless without achievement.');
    expect(prompt.split('PRIVATE (')[0]).not.toContain('Worthless without achievement.');
  });

  it('ideas come from their own story, with no AI call, and say when they cannot post yet', async () => {
    const ideas = (id) => request(app).get(`/api/v1/cast/characters/${id}/posts/ideas`).set('Authorization', `Bearer ${editor}`);
    const res = await ideas(ids.char);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ready: true, blocker: null, next: null });
    expect(res.body.ideas.map((i) => i.key)).toEqual([expect.stringMatching(/^event:/), 'status', 'work', 'mask', 'ordinary']);
    const [event, status, work, mask, ordinary] = res.body.ideas;
    expect(event).toMatchObject({ label: 'Before Linen Swap' });
    expect(event.about).toMatch(/The days before Linen Swap \(2026-11-12\), which Maren is hosting/);
    expect(status.label).toBe('At the top');
    expect(work.about).toBe('Maren at work as Slow-fashion creator: a small moment from the day.');
    expect(mask.about).not.toContain('Worthless');
    expect(ordinary.about).toBe('');
    expect(mockCreate).not.toHaveBeenCalled();
    const none = await ideas(ids.novoice);
    expect(none.body.ready).toBe(false);
    expect(none.body).toMatchObject({ next: 'make_active', blocker: 'No Voice has no Voice Profile yet, and one is built only from the Active stage. Make them Active, then build it.' });
    expect((await ideas(crypto.randomUUID())).status).toBe(404);
  });

  it('refuses an editor, a bad count, a character with no Voice Profile, and a dead account', async () => {
    expect((await generate(ids.char, { count: 1 }, editor)).status).toBe(403);
    expect((await generate(ids.char, { count: 6 })).status).toBe(400);
    const noVoice = await generate(ids.novoice, { count: 1 });
    expect(noVoice.status).toBe(409);
    expect(noVoice.body.error).toMatch(/no Voice Profile/);
    await run("UPDATE social_profiles SET current_state = 'posthumous' WHERE id = :pid", { pid: pids.maren });
    expect((await generate(ids.char, { count: 1 })).status).toBe(409);
    await run("UPDATE social_profiles SET current_state = 'peaking' WHERE id = :pid", { pid: pids.maren });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses when the day's manual requests are used", async () => {
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { manual_requests: 0 });
    const res = await generate(ids.char, { count: 1 });
    expect(res.status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { manual_requests: 15 });
  });
});
