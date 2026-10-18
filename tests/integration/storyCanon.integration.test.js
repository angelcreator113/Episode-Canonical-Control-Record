/**
 * Canon approval for short stories (stage D; services/storyCanon, routes in
 * routes/bookFromShowRoutes): what a short story adds is proposed, kept to
 * the episode's people, secrets and threads; accepting moves a secret on,
 * opens or advances a thread, or makes a fact canon; a contradiction can
 * only be dismissed; the chapter writer reads what was decided.
 *
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });
jest.mock('../../src/middleware/auth', () => ({ requireAuth: (req, _res, next) => { req.user = { id: 'u1', email: 'evoni@canon.dev' }; next(); } }));
jest.mock('../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { sequelize } = require('../../src/models');
const router = require('../../src/routes/bookFromShowRoutes');
const { canonBlock } = require('../../src/services/storyCanon');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const answer = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('canon approval for short stories', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), ep: crypto.randomUUID(), ev: crypto.randomUUID(), reg: crypto.randomUUID(), maren: crypto.randomUUID(),
    ring: crypto.randomUUID(), rent: crypto.randomUUID(), gone: crypto.randomUUID(), thread: crypto.randomUUID(), story: crypto.randomUUID(),
    book: crypto.randomUUID(), ch: crypto.randomUUID(),
  };
  let profile;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/book-from-show', router);
  const api = '/api/v1/book-from-show';
  const list = () => request(app).get(`${api}/episodes/${ids.ep}/canon`);
  const proposals = async () => (await list()).body.stories[0].proposals;

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Canon ${TAG}`, slug: `canon-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'The Gala', 4, 'draft', 'MAREN hides her hand.', NOW(), NOW())`, ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, created_at, updated_at)
                             VALUES (:h, 'instagram', 'test', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `canon${TAG}` });
    profile = p.id;
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Canon ${TAG}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, feed_profile_id, created_at, updated_at)
               VALUES (:maren, :reg, :k, 'Maren', 'Maren', 'support', 'accepted', :profile, NOW(), NOW())`, { ...ids, profile, k: `canon-${TAG}` });
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, known_by, state, permissions, created_at, updated_at) VALUES
               (:ring, :maren, 'She sold the ring', '[]'::jsonb, 'hinted', '{"episode":"hint","short_story":"hint","chapter":"reveal"}'::jsonb, NOW(), NOW()),
               (:rent, :maren, 'She owes rent', '[]'::jsonb, 'hidden', '{"episode":"hint","short_story":"hint","chapter":"hint"}'::jsonb, NOW(), NOW()),
               (:gone, :maren, 'She was fired once', '[]'::jsonb, 'revealed', '{"episode":"hint","short_story":"reveal","chapter":"reveal"}'::jsonb, NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, source_profile_id, created_at, updated_at)
               VALUES (:ev, :show, 'Velvet Gala', 'gala', 7, 'used', :ep, :profile, NOW(), NOW())`, { ...ids, profile });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status) VALUES (:thread, :show, 'Who saw the ring?', 'open')`, ids);
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, approved_at, created_at, updated_at)
               VALUES (:ep, :show, 'approved', 'Maren hid her hand at the Velvet Gala. Lala left alone.', NOW(), NOW(), NOW())`, ids);
    await run(`INSERT INTO stories (id, show_id, episode_id, title, content, word_count, format, source_type, status, created_at, updated_at)
               VALUES (:story, :show, :ep, 'The Gala', 'Maren counted the debt again. Lala and Mo left together. The ring had gone to a pawnshop on Ninth.', 20, 'short_story', 'episode', 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO storyteller_books (id, title, show_id, status, created_at, updated_at) VALUES (:book, :title, :show, 'draft', NOW(), NOW())`, { ...ids, title: `Book ${TAG}` });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, sort_order, title, created_at, updated_at) VALUES (:ch, :book, 1, 1, 'One', NOW(), NOW())`, ids);
    await run('UPDATE storyteller_chapters SET episode_id = :ep WHERE id = :ch', ids);
  });

  afterAll(async () => {
    await run('DELETE FROM story_canon_proposals WHERE episode_id = :ep', ids);
    await run('DELETE FROM episode_story_records WHERE episode_id = :ep', ids);
    await run('DELETE FROM storyteller_chapters WHERE book_id = :book', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
    await run('DELETE FROM stories WHERE id = :story', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id = :maren', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :profile', { profile });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  beforeEach(() => mockCreate.mockReset());

  it('not read yet: the story, no proposals', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.stories.map((s) => [s.id, s.reviewed_at, s.proposals])).toEqual([[ids.story, null, []]]);
    expect(res.body.pending).toBe(0);
  });

  it('reads the story against the record, kept to the episode\'s secrets and threads', async () => {
    mockCreate.mockResolvedValueOnce(answer({
      secrets: [
        { secret_id: ids.ring, what: 'revealed', how: 'The pawnshop on Ninth' },
        { secret_id: ids.rent, what: 'hinted', how: 'She counts the debt' },
        { secret_id: ids.gone, what: 'revealed', how: 'already known' },
        { secret_id: crypto.randomUUID(), what: 'revealed' },
      ],
      facts: [{ text: 'The ring went to a pawnshop on Ninth' }, { text: 'Maren lives above the shop' }, { text: '' }],
      threads: [{ thread_id: ids.thread, title: 'Who saw the ring?', note: 'The pawnbroker knows' }, { thread_id: null, title: 'Will Lala find out?', note: '' }],
      contradictions: [{ text: 'The record says Lala left alone; the story has her leave with Mo' }],
    }));
    const res = await request(app).post(`${api}/stories/${ids.story}/canon/review`);
    expect(res.status).toBe(200);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('THE EPISODE STORY RECORD (approved');
    expect(prompt).toContain(`[${ids.ring}] She sold the ring (the audience: hinted; a short story may: hint)`);
    expect(prompt).toContain('pawnshop on Ninth');

    const got = res.body.stories[0];
    expect(got.reviewed_at).toBeTruthy();
    expect(got.proposals.map((p) => [p.kind, p.text || p.title, p.what || null, p.over_budget ?? null])).toEqual([
      ['secret', 'She sold the ring', 'revealed', true],
      ['secret', 'She owes rent', 'hinted', false],
      ['fact', 'The ring went to a pawnshop on Ninth', null, null],
      ['fact', 'Maren lives above the shop', null, null],
      ['thread', 'Who saw the ring?', null, null],
      ['thread', 'Will Lala find out?', null, null],
      ['contradiction', 'The record says Lala left alone; the story has her leave with Mo', null, null],
    ]);
    expect(res.body.pending).toBe(6);
  });

  it('accepting makes it canon; dismissing does not; a contradiction is only dismissed', async () => {
    const all = await proposals();
    const find = (kind, text) => all.find((p) => p.kind === kind && (p.text === text || p.title === text));

    expect((await request(app).post(`${api}/canon/${find('secret', 'She sold the ring').id}/accept`)).status).toBe(200);
    const [[ring]] = await run('SELECT state, state_where FROM character_secrets WHERE id = :ring', ids);
    expect([ring.state, ring.state_where.note]).toEqual(['revealed', 'Short story: The Gala']);

    expect((await request(app).post(`${api}/canon/${find('thread', 'Who saw the ring?').id}/accept`)).status).toBe(200);
    expect((await request(app).post(`${api}/canon/${find('thread', 'Will Lala find out?').id}/accept`)).status).toBe(200);
    const [threads] = await run('SELECT title, status, opened_episode_id, last_advanced_episode_id FROM show_story_threads WHERE show_id = :show ORDER BY title', ids);
    expect(threads.map((t) => [t.title, t.status])).toEqual([['Who saw the ring?', 'advanced'], ['Will Lala find out?', 'open']]);
    expect(threads[0].last_advanced_episode_id).toBe(ids.ep);

    expect((await request(app).post(`${api}/canon/${find('fact', 'The ring went to a pawnshop on Ninth').id}/accept`)).status).toBe(200);
    expect((await request(app).post(`${api}/canon/${find('fact', 'Maren lives above the shop').id}/dismiss`)).status).toBe(200);

    const flag = find('contradiction', 'The record says Lala left alone; the story has her leave with Mo');
    expect((await request(app).post(`${api}/canon/${flag.id}/accept`)).status).toBe(409);
    expect((await request(app).post(`${api}/canon/${flag.id}/dismiss`)).status).toBe(200);
    const again = await request(app).post(`${api}/canon/${flag.id}/dismiss`);
    expect([again.status, again.body.error]).toEqual([409, 'That proposal has already been decided.']);
    expect((await request(app).post(`${api}/canon/nope/accept`)).status).toBe(400);
  });

  it('the chapter writer builds on what was accepted, not on what was dismissed', async () => {
    const block = await canonBlock(sequelize, ids.ep);
    expect(block).toBe([
      'CANON THE SHORT STORY ADDED (approved; build on it):',
      '- Revealed: She sold the ring',
      '- The ring went to a pawnshop on Ninth',
      'NOT CANON (the short story said it, but it was not approved; do not build on it):',
      '- Maren lives above the shop',
    ].join('\n'));
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Chapter prose.' }] });
    const res = await request(app).post(`${api}/chapters/${ids.ch}/write-from-episode`);
    expect(res.status).toBe(200);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('CANON THE SHORT STORY ADDED (approved; build on it):');
  });

  it('reading again replaces only what is still pending', async () => {
    mockCreate.mockResolvedValueOnce(answer({ secrets: [], facts: [{ text: 'Mo drove her home' }], threads: [], contradictions: [] }));
    const res = await request(app).post(`${api}/stories/${ids.story}/canon/review`);
    const kept = res.body.stories[0].proposals;
    expect(kept.filter((p) => p.status === 'pending').map((p) => p.text)).toEqual(['Mo drove her home']);
    expect(kept.filter((p) => p.status !== 'pending')).toHaveLength(6);
  });
});
