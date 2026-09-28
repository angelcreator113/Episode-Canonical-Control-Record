/**
 * F-Reg-2 fix group 1b (v1.2 R1): the four other sites that read
 * registry_dossiers_used[0].registry_id — a field the stored dossiers never
 * carry — now resolve the story's registry the way the write-back's registry
 * update does since #2113 (O-e): from the dossier rows' own ids.
 *
 *   evaluate-stories          author notes loaded for the story's registry
 *   propose-memory            existing memories scoped to the story's character
 *   propose-registry-update   the story registry's profiles are loaded
 *   write-back (memories)     linked to the story registry's character, and to
 *                             no character when the registry is not resolved
 *
 * Two registries hold the same character_key; the other registry's copy is
 * inserted first, so a key-only lookup meets it first.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
jest.mock('../../src/services/storyEnrichmentService', () => ({ enrichAfterWriteBack: jest.fn().mockResolvedValue() }));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

async function seed({ dossiers }) {
  const ids = {
    regStory: uuid(), regOther: uuid(), rcStory: uuid(), rcOther: uuid(),
    book: uuid(), chapter: uuid(), story: uuid(), tag: uuid().slice(0, 8),
  };
  const key = `scoped-${ids.tag}`;
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at)
             VALUES (:regOther, 'Other registry', NOW(), NOW()), (:regStory, 'Story registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, core_desire, created_at, updated_at)
             VALUES (:rcOther, :regOther, :key, 'Other copy', 'other desire', NOW(), NOW())`, { ...ids, key });
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, core_desire, created_at, updated_at)
             VALUES (:rcStory, :regStory, :key, 'Story copy', 'story desire', NOW(), NOW())`, { ...ids, key });
  await run(`INSERT INTO storyteller_books (id, title, created_at, updated_at) VALUES (:book, 'Group 1b book', NOW(), NOW())`, ids);
  await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, title, created_at, updated_at)
             VALUES (:chapter, :book, 1, 'Group 1b chapter', NOW(), NOW())`, ids);
  const used = dossiers === 'story' ? [{ id: ids.rcStory, character_key: key, display_name: 'Story copy' }] : dossiers;
  await run(`INSERT INTO storyteller_stories (id, character_key, story_number, title, text, story_a, story_b, story_c,
                                              characters_in_scene, status, registry_dossiers_used, created_at, updated_at)
             VALUES (:story, :key, 1, 'Group 1b story', 'First paragraph.', 'Voice A.', 'Voice B.', 'Voice C.',
                     CAST(:scene AS jsonb), 'approved', CAST(:used AS jsonb), NOW(), NOW())`,
    { ...ids, key, scene: JSON.stringify([key]), used: used === null ? null : JSON.stringify(used) });
  return { ...ids, key };
}

async function cleanup(ids) {
  await run(`DELETE FROM author_notes WHERE entity_id IN (:rcStory, :rcOther)`, ids);
  await run(`DELETE FROM storyteller_memories WHERE character_id IN (:rcStory, :rcOther) OR statement LIKE :like`,
    { ...ids, like: `%${ids.tag}%` });
  await run(`DELETE FROM storyteller_stories WHERE id = :story`, ids);
  await run(`DELETE FROM storyteller_books WHERE id = :book`, ids); // cascades chapters, lines
  await run(`DELETE FROM character_registries WHERE id IN (:regStory, :regOther)`, ids); // cascades characters
}

const lastPrompt = () => mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0].messages[0].content;

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 1b: the four registry_dossiers_used sites resolve the story\'s registry', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;
  const addedChapterColumns = [];
  let relaxedLineId = false;

  beforeAll(async () => {
    // Test-only fixtures for migration-tree drift: the write-back loads
    // StorytellerChapter (as in #2113's test), and it creates memories with no
    // line_id, which the migration tree declares NOT NULL while the model and
    // the 2026-09-17 canon capture have it nullable.
    for (const [name, type] of [['sections', 'jsonb'], ['chapter_template', 'character varying(100)']]) {
      const [present] = await q(`SELECT 1 AS present FROM information_schema.columns
                                 WHERE table_schema = 'public' AND table_name = 'storyteller_chapters' AND column_name = :name`, { name });
      if (!present) {
        await run(`ALTER TABLE storyteller_chapters ADD COLUMN ${name} ${type}`);
        addedChapterColumns.push(name);
      }
    }
    const [lineId] = await q(`SELECT is_nullable FROM information_schema.columns
                              WHERE table_schema = 'public' AND table_name = 'storyteller_memories' AND column_name = 'line_id'`);
    if (lineId?.is_nullable === 'NO') {
      await run(`ALTER TABLE storyteller_memories ALTER COLUMN line_id DROP NOT NULL`);
      relaxedLineId = true;
    }

    token = TokenService.generateTokenPair({
      id: 'test-user-group-1b-scope',
      email: 'test@group-1b-scope.dev',
      name: 'Group 1b Scope Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ content: [{ text: '{}' }], usage: { input_tokens: 0, output_tokens: 0 } });
  });

  afterAll(async () => {
    for (const ids of seeded) await cleanup(ids);
    if (relaxedLineId) await run(`ALTER TABLE storyteller_memories ALTER COLUMN line_id SET NOT NULL`);
    for (const name of addedChapterColumns) await run(`ALTER TABLE storyteller_chapters DROP COLUMN ${name}`);
  });

  it('evaluate-stories loads the author notes of the story registry\'s character', async () => {
    const ids = await seed({ dossiers: 'story' });
    seeded.push(ids);
    for (const [entity, text] of [[ids.rcStory, `story intent ${ids.tag}`], [ids.rcOther, `other intent ${ids.tag}`]]) {
      await run(`INSERT INTO author_notes (entity_type, entity_id, note_text, note_type, visible_to_amber, created_by, created_at, updated_at)
                 VALUES ('character', :entity, :text, 'intent', true, 'evoni', NOW(), NOW())`, { entity, text });
    }

    const res = await request(app).post('/api/v1/memories/evaluate-stories').set('Authorization', auth()).send({ story_id: ids.story });
    expect(res.status).toBe(200);

    expect(lastPrompt()).toContain(`story intent ${ids.tag}`);
    expect(lastPrompt()).not.toContain(`other intent ${ids.tag}`);
  });

  it('propose-memory shows only the story registry\'s character\'s existing memories', async () => {
    const ids = await seed({ dossiers: 'story' });
    seeded.push(ids);
    for (const [character, text] of [[ids.rcStory, `story memory ${ids.tag}`], [ids.rcOther, `other memory ${ids.tag}`]]) {
      await run(`INSERT INTO storyteller_memories (id, character_id, type, statement, confidence, created_at, updated_at)
                 VALUES (:id, :character, 'event', :text, 0.9, NOW(), NOW())`,
        { id: uuid(), character, text });
    }

    const res = await request(app).post('/api/v1/memories/propose-memory').set('Authorization', auth()).send({ story_id: ids.story });
    expect(res.status).toBe(200);

    expect(lastPrompt()).toContain(`story memory ${ids.tag}`);
    expect(lastPrompt()).not.toContain(`other memory ${ids.tag}`);
  });

  it('propose-registry-update loads the story registry\'s profile, not the other registry\'s', async () => {
    const ids = await seed({ dossiers: 'story' });
    seeded.push(ids);

    const res = await request(app).post('/api/v1/memories/propose-registry-update').set('Authorization', auth()).send({ story_id: ids.story });
    expect(res.status).toBe(200);

    expect(lastPrompt()).toContain(`Story copy (${ids.key}): desire="story desire"`);
    expect(lastPrompt()).not.toContain('Other copy');
  });

  const writeBackMemory = (ids) =>
    request(app).post('/api/v1/memories/write-back')
      .set('Authorization', auth())
      .send({
        story_id: ids.story,
        chapter_id: ids.chapter,
        confirmed_memories: [{ type: 'event', content: `written back ${ids.tag}` }],
      });
  const memoryCharacter = async (ids) => {
    const [mem] = await q(`SELECT character_id FROM storyteller_memories WHERE statement = :s`, { s: `written back ${ids.tag}` });
    return mem;
  };

  it('write-back links a confirmed memory to the story registry\'s character', async () => {
    const ids = await seed({ dossiers: 'story' });
    seeded.push(ids);

    const res = await writeBackMemory(ids);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(await memoryCharacter(ids)).toEqual({ character_id: ids.rcStory });
  });

  it('write-back links a confirmed memory to no character when the story\'s registry cannot be resolved', async () => {
    const ids = await seed({ dossiers: null });
    seeded.push(ids);

    const res = await writeBackMemory(ids);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(await memoryCharacter(ids)).toEqual({ character_id: null });
  });
});
