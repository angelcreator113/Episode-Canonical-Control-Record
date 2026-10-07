/**
 * Amber's push_page_to_brain action (src/routes/memories/assistant.js)
 * writes Show Bible entries for review. Its raw INSERT put gen_random_uuid()
 * into franchise_knowledge.id (an INTEGER) and 'amber_push' into
 * extracted_by (an ENUM without it), so every push failed and no entry was
 * ever saved; the Amber activity count queried the same bad names (wiring
 * map, docs/reads/2026-10-06-lalaverse-wiring-map.md §5 finding 5b,
 * fix-list item 9).
 *
 * Both Claude calls are stubbed (the command, then the extraction); the
 * database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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
const reply = (obj) => ({ content: [{ text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('Amber push_page_to_brain saves its entries', () => {
  let token;
  const KEY = 'AMBER_PUSH_TEST';

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-amber-push', email: 'test@amber-push.dev', name: 'Amber Push Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    // page_content.id's UUID default is Sequelize's, not the database's.
    await run(`INSERT INTO page_content (id, page_name, constant_key, data, created_at, updated_at)
               VALUES (gen_random_uuid(), 'influencer_systems', :key, '["The Peer: relatable and close"]'::jsonb, NOW(), NOW())`, { key: KEY });
  });

  afterAll(async () => {
    await run(`DELETE FROM page_content WHERE constant_key = :key`, { key: KEY });
    await run(`DELETE FROM franchise_knowledge WHERE title LIKE 'Amber push test%'`);
  });

  it('writes pending entries with allowed values, marked as Amber, and the activity count finds them', async () => {
    mockCreate
      .mockResolvedValueOnce(reply({ reply: 'Pushing.', action: 'push_page_to_brain', actionParams: { page_name: 'influencer_systems' } }))
      .mockResolvedValueOnce(reply({ entries: [
        { title: 'Amber push test: The Peer', content: 'Relatable and close.', category: 'character', severity: 'important' },
        // An AI value the column does not accept falls back instead of failing the insert.
        { title: 'Amber push test: Odd one', content: 'Off-list values.', category: 'vibes', severity: 'huge', always_inject: 'yes' },
      ] }));

    const res = await request(app).post('/api/v1/memories/assistant-command')
      .set('Authorization', `Bearer ${token}`).send({ message: 'push the social systems page to the brain' });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeFalsy();
    expect(res.body.reply).toMatch(/2 entries extracted/);

    const rows = await q(`SELECT title, category::text, severity::text, always_inject, extracted_by::text, status::text, review_note, source_document
                          FROM franchise_knowledge WHERE title LIKE 'Amber push test%' ORDER BY title`);
    expect(rows).toEqual([
      expect.objectContaining({ title: 'Amber push test: Odd one', category: 'world', severity: 'important', always_inject: false }),
      expect.objectContaining({ title: 'Amber push test: The Peer', category: 'character', severity: 'important' }),
    ]);
    for (const r of rows) {
      expect(r).toMatchObject({ extracted_by: 'conversation_extraction', status: 'pending_review', source_document: 'influencer-systems-v1.0' });
      expect(r.review_note).toBe('Amber: pushed from influencer_systems');
    }

    const activity = await request(app).get('/api/v1/franchise-brain/amber-activity').set('Authorization', `Bearer ${token}`);
    expect(activity.status).toBe(200);
    const titles = activity.body.amber.recent_entries.map((e) => e.title);
    expect(titles).toEqual(expect.arrayContaining(['Amber push test: The Peer', 'Amber push test: Odd one']));
  });
});
