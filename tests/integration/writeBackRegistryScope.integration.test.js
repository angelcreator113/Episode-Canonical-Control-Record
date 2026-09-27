jest.unmock('uuid');

/**
 * Integration Tests - POST /api/v1/memories/write-back, registry scope
 *
 * F-Reg-2 Fix Plan v1.0, fix group 1 (O-e). The write-back applies
 * confirmed_registry_updates by finding each character with
 * `where: { character_key }` alone. character_key is unique only within a
 * registry, and production holds one key in two registries
 * (the-almost-mentor, F-Reg-2_Fix_Plan_v1.0.md §2.3), so a write-back can
 * update another registry's character.
 *
 * The story's registry is the one its dossiers were loaded from:
 * generate-story-multi stores fetchSceneContext's rows (each carrying its own
 * `id`, all loaded `WHERE registry_id = :registryId`) as
 * registry_dossiers_used. These tests pin that the write-back updates only the
 * character in that registry, and writes nothing for a key when the story's
 * registry cannot be resolved.
 *
 * Test-only fixtures, as in registryJsonWrites.integration.test.js: columns
 * that a model declares and production has (the 2026-09-17 canon capture) but
 * no migration creates, so a migration-built database fails to load the model.
 * Each is added for this file's run only, when missing, and removed after:
 *   - registry_characters.world (owed to F-Reg-2, Task #2101);
 *   - storyteller_chapters.sections (jsonb) and chapter_template
 *     (varchar(100)), which StorytellerChapter declares and the write-back
 *     loads; not yet homed.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
// The post-commit enrichment pipeline is fire-and-forget and out of scope here.
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

// Two registries holding the same character_key. The other registry's
// character is inserted first, so a key-only lookup meets it first.
async function seed({ dossiers }) {
  const ids = {
    regStory: uuid(), regOther: uuid(), rcStory: uuid(), rcOther: uuid(),
    book: uuid(), chapter: uuid(), story: uuid(),
  };
  const key = `shared-${ids.story.slice(0, 8)}`;
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at)
             VALUES (:regOther, 'Other registry', NOW(), NOW()), (:regStory, 'Story registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, core_desire, created_at, updated_at)
             VALUES (:rcOther, :regOther, :key, 'Other copy', 'other desire', NOW(), NOW())`, { ...ids, key });
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, core_desire, created_at, updated_at)
             VALUES (:rcStory, :regStory, :key, 'Story copy', 'story desire', NOW(), NOW())`, { ...ids, key });
  await run(`INSERT INTO storyteller_books (id, title, created_at, updated_at) VALUES (:book, 'Write-back book', NOW(), NOW())`, ids);
  await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, title, created_at, updated_at)
             VALUES (:chapter, :book, 1, 'Write-back chapter', NOW(), NOW())`, ids);
  const used = dossiers === 'story' ? [{ id: ids.rcStory, character_key: key, display_name: 'Story copy' }] : dossiers;
  await run(`INSERT INTO storyteller_stories (id, character_key, story_number, title, text, status, registry_dossiers_used, created_at, updated_at)
             VALUES (:story, :key, 1, 'Write-back story', 'First paragraph.', 'approved', CAST(:used AS jsonb), NOW(), NOW())`,
    { ...ids, key, used: used === null ? null : JSON.stringify(used) });
  return { ...ids, key };
}

async function desires(ids) {
  const rows = await q(`SELECT id, core_desire FROM registry_characters WHERE id IN (:rcStory, :rcOther)`, ids);
  return Object.fromEntries(rows.map(r => [r.id === ids.rcStory ? 'story' : 'other', r.core_desire]));
}

async function cleanup(ids) {
  await run(`DELETE FROM storyteller_stories WHERE id = :story`, ids);
  await run(`DELETE FROM storyteller_books WHERE id = :book`, ids); // cascades chapters, lines
  await run(`DELETE FROM character_registries WHERE id IN (:regStory, :regOther)`, ids); // cascades characters
}

(shouldSkip ? describe.skip : describe)('POST /write-back updates only its own registry\'s character (F-Reg-2 O-e)', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;
  let addedWorld = false;
  let addedWorldType = false;
  const addedChapterColumns = [];

  beforeAll(async () => {
    const [col] = await q(`SELECT 1 AS present FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = 'registry_characters' AND column_name = 'world'`);
    if (!col) {
      const [type] = await q(`SELECT 1 AS present FROM pg_type WHERE typname = 'enum_registry_characters_world'`);
      if (!type) {
        await run(`CREATE TYPE enum_registry_characters_world AS ENUM ('book-1', 'lalaverse', 'series-2')`);
        addedWorldType = true;
      }
      await run(`ALTER TABLE registry_characters ADD COLUMN world enum_registry_characters_world`);
      addedWorld = true;
    }
    for (const [name, type] of [['sections', 'jsonb'], ['chapter_template', 'character varying(100)']]) {
      const [present] = await q(`SELECT 1 AS present FROM information_schema.columns
                                 WHERE table_schema = 'public' AND table_name = 'storyteller_chapters' AND column_name = :name`, { name });
      if (!present) {
        await run(`ALTER TABLE storyteller_chapters ADD COLUMN ${name} ${type}`);
        addedChapterColumns.push(name);
      }
    }

    token = TokenService.generateTokenPair({
      id: 'test-user-write-back-scope',
      email: 'test@write-back-scope.dev',
      name: 'Write-back Scope Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const ids of seeded) await cleanup(ids);
    if (addedWorld) await run(`ALTER TABLE registry_characters DROP COLUMN world`);
    if (addedWorldType) await run(`DROP TYPE enum_registry_characters_world`);
    for (const name of addedChapterColumns) await run(`ALTER TABLE storyteller_chapters DROP COLUMN ${name}`);
  });

  const writeBack = (ids) =>
    request(app).post('/api/v1/memories/write-back')
      .set('Authorization', auth())
      .send({
        story_id: ids.story,
        chapter_id: ids.chapter,
        confirmed_registry_updates: [{ character_key: ids.key, field: 'core_desire', proposed_value: 'new desire' }],
      });

  it('updates the character in the story\'s registry, not the other registry\'s copy', async () => {
    const ids = await seed({ dossiers: 'story' });
    seeded.push(ids);

    const res = await writeBack(ids);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, story_id: ids.story, chapter_id: ids.chapter }));

    expect(await desires(ids)).toEqual({ story: 'new desire', other: 'other desire' });
  });

  it('writes nothing for the key when the story\'s registry cannot be resolved', async () => {
    const ids = await seed({ dossiers: null });
    seeded.push(ids);

    const res = await writeBack(ids);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(await desires(ids)).toEqual({ story: 'story desire', other: 'other desire' });
    const [story] = await q(`SELECT status FROM storyteller_stories WHERE id = :story`, ids);
    expect(story.status).toBe('written_back');
  });
});
