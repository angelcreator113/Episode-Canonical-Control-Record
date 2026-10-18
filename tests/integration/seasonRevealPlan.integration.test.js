/**
 * The season's reveal plan (stage E; services/seasonRevealPlan, routes in
 * routes/arcRoutes): which kept secret is hinted at or revealed in which
 * slot, what is wrong with the plan, the plan as the episode's permission in
 * the story brief, and the season the chapter writer reads.
 *
 * The database is the local migrated test DB; the AI is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: (...a) => mockCreate(...a) } }; });

const request = require('supertest');
const crypto = require('crypto');
const express = require('express');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');
const { planForEpisode, withPlan, seasonBlock } = require('../../src/services/seasonRevealPlan');
const { secretsFor } = require('../../src/services/characterSecrets');
const { storyBrief } = require('../../src/services/characterStoryBrief');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the season reveal plan', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), other: crypto.randomUUID(), reg: crypto.randomUUID(), maren: crypto.randomUUID(),
    ring: crypto.randomUUID(), rent: crypto.randomUUID(), fired: crypto.randomUUID(), stranger: crypto.randomUUID(),
    ep3: crypto.randomUUID(), book: crypto.randomUUID(), ch: crypto.randomUUID(),
  };
  const slot = {};
  let token;
  const base = `/api/v1/world/${ids.show}/season/reveals`;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const put = (body) => auth(request(app).put(base)).send(body);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-reveals', email: 'evoni@reveals.dev', name: 'Evoni', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const show of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
        { show, name: `Reveals ${show.slice(0, 8)}`, slug: `reveals-${show.slice(0, 8)}` });
    }
    await seedArc(ids.show, models);
    const [rows] = await run('SELECT id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) slot[r.slot_number] = r.id;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep3, :show, 'The Gala', 3, 'draft', NOW(), NOW())`, ids);
    await run('UPDATE season_slots SET episode_id = :ep3, story_purpose = :purpose WHERE id = :id', { ...ids, id: slot[3], purpose: 'Maren is pushed into the open' });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Reveals ${TAG}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, created_at, updated_at)
               VALUES (:maren, :reg, :k, 'Maren', 'Maren', 'support', 'accepted', NOW(), NOW())`, { ...ids, k: `rev-${TAG}` });
    await run(`INSERT INTO character_secrets (id, registry_character_id, text, known_by, state, permissions, created_at, updated_at) VALUES
               (:ring, :maren, 'She sold the ring', '[]'::jsonb, 'hidden', '{"episode":"hidden","short_story":"hint","chapter":"hint"}'::jsonb, NOW(), NOW()),
               (:rent, :maren, 'She owes rent', '[]'::jsonb, 'hidden', '{"episode":"hint","short_story":"hint","chapter":"hint"}'::jsonb, NOW(), NOW()),
               (:fired, :maren, 'She was fired once', '[]'::jsonb, 'revealed', '{"episode":"hint","short_story":"hint","chapter":"hint"}'::jsonb, NOW(), NOW())`, ids);
    await run(`INSERT INTO storyteller_books (id, title, show_id, status, created_at, updated_at) VALUES (:book, :title, :show, 'draft', NOW(), NOW())`, { ...ids, title: `Book ${TAG}` });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, sort_order, title, created_at, updated_at) VALUES (:ch, :book, 1, 1, 'One', NOW(), NOW())`, ids);
    await run('UPDATE storyteller_chapters SET episode_id = :ep3 WHERE id = :ch', ids);
  });

  afterAll(async () => {
    await run('DELETE FROM season_reveals WHERE show_id IN (:show, :other)', ids);
    await run('DELETE FROM storyteller_chapters WHERE book_id = :book', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id = :maren', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id IN (:show, :other)`, ids).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id IN (:show, :other)', ids);
    await sequelize.close();
  });

  it('the season, the show\'s kept secrets, and an empty plan', async () => {
    const res = await auth(request(app).get(base));
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(24);
    expect(res.body.slots[2]).toMatchObject({ slot_number: 3, label: 'S1 · E3', episode: { id: ids.ep3, title: 'The Gala' } });
    expect(res.body.secrets.map((s) => s.text)).toEqual(['She sold the ring', 'She owes rent', 'She was fired once']);
    expect(res.body.reveals).toEqual([]);
    expect((await request(app).get(base)).status).toBe(401);
  });

  it('plans hints and reveals and says what is wrong with them', async () => {
    expect((await put({ slot_id: slot[5], secret_id: ids.ring, intent: 'reveal', note: 'Mo finds the ticket' })).status).toBe(200);
    let res = await put({ slot_id: slot[3], secret_id: ids.rent, intent: 'reveal' });
    res = await put({ slot_id: slot[6], secret_id: ids.rent, intent: 'hint' });
    res = await put({ slot_id: slot[4], secret_id: ids.fired, intent: 'reveal' });
    expect(res.body.reveals.map((r) => [r.label, r.intent])).toEqual([['S1 · E3', 'reveal'], ['S1 · E4', 'reveal'], ['S1 · E5', 'reveal'], ['S1 · E6', 'hint']]);
    expect(res.body.warnings.map((w) => w.text).sort()).toEqual([
      'Maren: She owes rent is revealed in S1 · E3 with no hint before it.',
      'Maren: She owes rent is hinted in S1 · E6, after it is revealed in S1 · E3.',
      'Maren: She was fired once: the audience already knows it; S1 · E4 cannot reveal it again.',
      'Maren: She sold the ring is revealed in S1 · E5 with no hint before it.',
    ].sort());

    // The same slot and secret again changes it, not adds it; a hint at E3 clears the ring's warning.
    res = await put({ slot_id: slot[3], secret_id: ids.ring, intent: 'hint', note: 'She hides her hand' });
    res = await put({ slot_id: slot[3], secret_id: ids.ring, intent: 'hint', note: 'She hides her bare hand' });
    expect(res.body.reveals.filter((r) => r.secret_id === ids.ring).map((r) => [r.label, r.intent, r.note])).toEqual([
      ['S1 · E3', 'hint', 'She hides her bare hand'], ['S1 · E5', 'reveal', 'Mo finds the ticket'],
    ]);
    expect(res.body.warnings.map((w) => w.text).join('\n')).not.toMatch(/She sold the ring/);

    const fired = res.body.reveals.find((r) => r.secret_id === ids.fired);
    res = await auth(request(app).delete(`${base}/${fired.id}`));
    expect(res.status).toBe(200);
    expect(res.body.reveals.some((r) => r.secret_id === ids.fired)).toBe(false);
  });

  it('refuses what is not this show\'s, or not a plan', async () => {
    expect((await put({ slot_id: slot[3], secret_id: ids.ring, intent: 'shout' })).status).toBe(400);
    expect((await put({ slot_id: crypto.randomUUID(), secret_id: ids.ring })).status).toBe(404);
    expect((await put({ slot_id: slot[3], secret_id: crypto.randomUUID() })).status).toBe(404);
    await run('UPDATE season_slots SET accepted_at = NOW() WHERE id = :id', { id: slot[2] });
    expect((await put({ slot_id: slot[2], secret_id: ids.ring })).status).toBe(409);
    expect((await auth(request(app).delete(`${base}/${crypto.randomUUID()}`))).status).toBe(404);
  });

  it('the plan is the episode\'s permission in the brief, marked planned', async () => {
    const plan = await planForEpisode(sequelize, ids.ep3);
    expect([...plan.entries()].sort()).toEqual([
      [ids.rent, { intent: 'reveal', note: null }], [ids.ring, { intent: 'hint', note: 'She hides her bare hand' }],
    ].sort());
    const secrets = withPlan((await secretsFor(sequelize, [ids.maren])).get(ids.maren), plan, 'episode');
    const { text } = storyBrief({ core_fear: 'Being seen' }, { layer: 'episode', secrets });
    // The ring is "keep hidden" for episodes on its own; the plan makes it a hint here.
    expect(text).toContain('- She sold the ring [HINT ONLY: show it in what they do; nobody explains it. No one else knows. Planned for this episode: She hides her bare hand.]');
    expect(text).toContain('- She owes rent [MAY BE REVEALED in this story. No one else knows. Planned for this episode.]');
    expect(text).toContain('CLEARED TO REVEAL in this story (the audience may learn these; everything else stays subtext):\n- She owes rent');
    expect(await planForEpisode(sequelize, crypto.randomUUID())).toEqual(new Map());
  });

  it('the chapter writer reads the season around its episode', async () => {
    const block = await seasonBlock(sequelize, ids.ep3);
    expect(block).toMatch(/^THE SEASON \(.+\)\. This is S1 · E3, in the phase ".+"\./);
    expect(block).toContain('What this episode is for in the season: Maren is pushed into the open');
    // Within a slot, in the order they were planned.
    expect(block).toContain("Planned for this episode:\n- S1 · E3: reveal Maren's secret: She owes rent\n- S1 · E3: hint at Maren's secret: She sold the ring (She hides her bare hand)");
    expect(block).toContain("Coming later in the season (let the chapter foreshadow it; never reveal it before its episode):\n- S1 · E5: reveal Maren's secret: She sold the ring (Mo finds the ticket)");

    const router = require('../../src/routes/bookFromShowRoutes');
    const book = express();
    book.use(express.json());
    book.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
    book.use('/api/v1/book-from-show', router);
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Chapter prose.' }] });
    const res = await auth(request(book).post(`/api/v1/book-from-show/chapters/${ids.ch}/write-from-episode`));
    expect(res.status).toBe(200);
    expect(res.body.used_season).toBe(true);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('Coming later in the season');
  });
});
