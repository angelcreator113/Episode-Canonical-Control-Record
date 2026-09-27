jest.unmock('uuid');

/**
 * Integration Tests - registry_characters JSONB writes that are silently not saved
 *
 * F-Reg-2 Fix Plan v1.0, fix group 1 (O-b, the three confirmed sites).
 *
 * POST /api/v1/memories/memories/:memoryId/confirm appends the confirmed memory
 * to the character's extra_fields.memories. POST
 * /api/v1/character-registry/characters/:id/generate-section with section
 * 'dilemma' or 'plot_threads' sets extra_fields.dilemma or
 * extra_fields.plot_threads. On main each edits the loaded extra_fields in
 * place and then assigns an equal copy, so Sequelize sees no change and the
 * save writes nothing: a second confirmed memory is lost, and generate-section
 * loses its result whenever extra_fields was already non-null.
 *
 * These tests pin the saved state: every confirmed memory is in
 * extra_fields.memories, generate-section's result is in extra_fields, other
 * extra_fields keys survive, and two concurrent calls on one character both
 * land.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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

const DILEMMA = {
  central_dilemma: 'Stay loyal or tell the truth',
  option_a: 'Stay loyal, and lose herself',
  option_b: 'Tell the truth, and lose them',
  trigger_scenarios: [],
};
const THREADS = [
  { thread: 'The unpaid debt', status: 'open', activation_condition: 'The lender returns' },
  { thread: 'The unsent letter', status: 'open', activation_condition: 'Someone finds it' },
];

// The mocked model answers by section: the dilemma prompt names a "moral dilemma".
function aiAnswer({ messages }) {
  const prompt = messages[0].content;
  const body = prompt.includes('moral dilemma') ? DILEMMA : THREADS;
  return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(body) }] });
}

async function seedRegistry(extraFields) {
  const ids = { registry: uuid(), rc: uuid() };
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registry, 'JSON writes test registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, extra_fields, created_at, updated_at)
             VALUES (:rc, :registry, :key, 'JSON Writes', CAST(:extra AS jsonb), NOW(), NOW())`,
    { ...ids, key: `json-writes-${ids.rc.slice(0, 8)}`, extra: extraFields === null ? null : JSON.stringify(extraFields) });
  return ids;
}

// A book, chapter and line to hang unconfirmed memories on.
async function seedMemories(ids, statements) {
  const book = uuid();
  const chapter = uuid();
  const line = uuid();
  await run(`INSERT INTO storyteller_books (id, created_at, updated_at) VALUES (:book, NOW(), NOW())`, { book });
  await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, title, created_at, updated_at) VALUES (:chapter, :book, 1, 'JSON writes chapter', NOW(), NOW())`, { chapter, book });
  await run(`INSERT INTO storyteller_lines (id, chapter_id, text, created_at, updated_at) VALUES (:line, :chapter, 'A line.', NOW(), NOW())`, { line, chapter });
  const memoryIds = [];
  for (const statement of statements) {
    const id = uuid();
    await run(`INSERT INTO storyteller_memories (id, line_id, type, statement, confidence, confirmed, protected, created_at, updated_at)
               VALUES (:id, :line, 'belief', :statement, 0.8, false, false, NOW(), NOW())`, { id, line, statement });
    memoryIds.push(id);
  }
  Object.assign(ids, { book });
  return memoryIds;
}

async function extraFields(ids) {
  const [row] = await q(`SELECT extra_fields FROM registry_characters WHERE id = :rc`, ids);
  return row.extra_fields;
}

async function cleanup(ids) {
  if (ids.book) await run(`DELETE FROM storyteller_books WHERE id = :book`, ids); // cascades chapters, lines, memories
  await run(`DELETE FROM character_registries WHERE id = :registry`, ids); // cascades registry characters
}

(shouldSkip ? describe.skip : describe)('registry_characters JSONB writes are saved (F-Reg-2 fix group 1)', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-registry-json',
      email: 'test@registry-json.dev',
      name: 'Registry JSON Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockImplementation(aiAnswer);
  });

  afterAll(async () => {
    for (const ids of seeded) await cleanup(ids);
  });

  const confirm = (memoryId, ids) =>
    request(app).post(`/api/v1/memories/memories/${memoryId}/confirm`)
      .set('Authorization', auth()).send({ character_id: ids.rc });

  const generate = (section, ids) =>
    request(app).post(`/api/v1/character-registry/characters/${ids.rc}/generate-section`)
      .set('Authorization', auth()).send({ section });

  describe('POST /memories/:memoryId/confirm', () => {
    it('saves every confirmed memory, not just the first', async () => {
      const ids = await seedRegistry(null);
      seeded.push(ids);
      const [first, second] = await seedMemories(ids, ['She fears the water.', 'She trusts no one.']);

      expect((await confirm(first, ids)).status).toBe(200);
      expect((await confirm(second, ids)).status).toBe(200);

      const memories = (await extraFields(ids)).memories;
      expect(memories).toHaveLength(2);
      expect(memories[0]).toMatch(/\[BELIEF · \d{4}-\d{2}-\d{2}\] She fears the water\.$/);
      expect(memories[1]).toMatch(/\[BELIEF · \d{4}-\d{2}-\d{2}\] She trusts no one\.$/);
    });

    it('appends to an existing memories list and keeps other extra_fields keys', async () => {
      const ids = await seedRegistry({ memories: ['[EVENT · 2026-01-01] Earlier.'], plot_threads: [{ id: 'pt-1' }] });
      seeded.push(ids);
      const [memoryId] = await seedMemories(ids, ['She left town.']);

      const res = await confirm(memoryId, ids);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ character_updated: true, character_id: ids.rc }));

      const extra = await extraFields(ids);
      expect(extra.memories).toHaveLength(2);
      expect(extra.memories[0]).toBe('[EVENT · 2026-01-01] Earlier.');
      expect(extra.memories[1]).toMatch(/She left town\.$/);
      expect(extra.plot_threads).toEqual([{ id: 'pt-1' }]);
    });

    it('keeps both memories when two confirmations run concurrently', async () => {
      const ids = await seedRegistry({ memories: ['[EVENT · 2026-01-01] Earlier.'] });
      seeded.push(ids);
      const [a, b] = await seedMemories(ids, ['Concurrent one.', 'Concurrent two.']);

      const [ra, rb] = await Promise.all([confirm(a, ids), confirm(b, ids)]);
      expect(ra.status).toBe(200);
      expect(rb.status).toBe(200);

      const memories = (await extraFields(ids)).memories;
      expect(memories).toHaveLength(3);
      expect(memories.some(m => m.endsWith('Concurrent one.'))).toBe(true);
      expect(memories.some(m => m.endsWith('Concurrent two.'))).toBe(true);
    });
  });

  describe('POST /characters/:id/generate-section', () => {
    it('saves the dilemma when extra_fields was non-null, keeping other keys', async () => {
      const ids = await seedRegistry({ memories: ['[EVENT · 2026-01-01] Earlier.'] });
      seeded.push(ids);

      const res = await generate('dilemma', ids);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ success: true, section: 'dilemma', character_id: ids.rc, updated: ['extra_fields.dilemma'] }));

      const extra = await extraFields(ids);
      expect(extra.dilemma).toEqual(DILEMMA);
      expect(extra.memories).toEqual(['[EVENT · 2026-01-01] Earlier.']);
    });

    it('saves plot threads when extra_fields was non-null, keeping other keys', async () => {
      const ids = await seedRegistry({ dilemma: { central_dilemma: 'Old' }, memories: ['[EVENT · 2026-01-01] Earlier.'] });
      seeded.push(ids);

      const res = await generate('plot_threads', ids);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ success: true, section: 'plot_threads', updated: ['plot_threads'] }));

      const extra = await extraFields(ids);
      expect(extra.plot_threads).toHaveLength(2);
      expect(extra.plot_threads[0]).toEqual(expect.objectContaining({
        title: 'The unpaid debt', description: 'The lender returns', status: 'open', source: 'ai-generated',
      }));
      expect(extra.plot_threads[0].id).toMatch(/^pt-\d+-0$/);
      expect(extra.dilemma).toEqual({ central_dilemma: 'Old' });
      expect(extra.memories).toEqual(['[EVENT · 2026-01-01] Earlier.']);
    });

    it('keeps both sections when dilemma and plot threads are generated concurrently', async () => {
      const ids = await seedRegistry({ memories: ['[EVENT · 2026-01-01] Earlier.'] });
      seeded.push(ids);

      const [rd, rp] = await Promise.all([generate('dilemma', ids), generate('plot_threads', ids)]);
      expect(rd.status).toBe(200);
      expect(rp.status).toBe(200);

      const extra = await extraFields(ids);
      expect(extra.dilemma).toEqual(DILEMMA);
      expect(extra.plot_threads).toHaveLength(2);
      expect(extra.memories).toEqual(['[EVENT · 2026-01-01] Earlier.']);
    });
  });
});
