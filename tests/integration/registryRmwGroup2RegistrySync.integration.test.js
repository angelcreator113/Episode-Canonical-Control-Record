/**
 * F-Reg-2 fix group 2 (v1.2 R2), src/services/registrySync.js: rows 70, 71,
 * 72 and 73 of the scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2).
 * characterRegistry.js was #2179 and #2181.
 *
 * Each test interleaves a second write between a trigger's read of the
 * character and its update, deterministically:
 *   - rows 70, 71, 73: the first trigger's read is held until a second call
 *     of the same trigger has run (or, when the fix locks the row, until a
 *     short timeout shows the second is waiting on the lock);
 *   - row 72: a note is appended during the (mocked) AI call.
 * On origin/main one of the two writes is lost; with the fix both survive.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const models = require('../../src/models');
const registrySync = require('../../src/services/registrySync');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seed({ personalityMatrix = null, showId = null } = {}) {
  const ids = { reg: uuid(), rc: uuid(), name: `Sync ${uuid().slice(0, 8)}` };
  await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at)
             VALUES (:reg, 'RMW registrySync registry', :showId, NOW(), NOW())`, { ...ids, showId });
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, personality_matrix, created_at, updated_at)
             VALUES (:rc, :reg, :key, :name, :name, CAST(:pm AS jsonb), NOW(), NOW())`,
    { ...ids, key: `sync-${ids.rc.slice(0, 8)}`, pm: personalityMatrix === null ? null : JSON.stringify(personalityMatrix) });
  return ids;
}

const rowOf = async (ids, cols) => {
  const [row] = await q(`SELECT ${cols} FROM registry_characters WHERE id = :rc`, ids);
  return row;
};

// Hold the first RegistryCharacter.findByPk after it returns, until `second()`
// has finished or `waitMs` has passed, whichever is first.
function interleave(second, waitMs = 600) {
  const original = models.RegistryCharacter.findByPk.bind(models.RegistryCharacter);
  let secondPromise = null;
  let first = true;
  jest.spyOn(models.RegistryCharacter, 'findByPk').mockImplementation(async (...args) => {
    const result = await original(...args);
    if (first) {
      first = false;
      secondPromise = second();
      await Promise.race([secondPromise.then(() => {}, () => {}), sleep(waitMs)]);
    }
    return result;
  });
  return () => secondPromise;
}

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, registrySync.js: interleaved writes are not lost', () => {
  const cleanups = [];

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const fn of cleanups) await fn();
  });
  const track = (ids) => cleanups.push(() => run(`DELETE FROM character_registries WHERE id = :reg`, ids));

  it('row 70: two concurrent therapy-session closes both keep their breakthrough note and wound activation', async () => {
    const ids = await seed();
    track(ids);
    const close = (n, moment) => registrySync.onTherapySessionClose(
      { character_id: ids.rc, session_number: n, wound_activated: true, breakthrough_moment: moment }, models);

    const secondDone = interleave(() => close(2, 'second breakthrough'));
    await close(1, 'first breakthrough');
    await secondDone();

    const row = await rowOf(ids, 'writer_notes, wound_depth');
    expect(row.writer_notes).toContain('first breakthrough');
    expect(row.writer_notes).toContain('second breakthrough');
    expect(row.wound_depth).toBe(2);
  });

  it('row 71: two concurrent memory confirmations both keep their note', async () => {
    const ids = await seed();
    track(ids);
    const confirm = (statement) => registrySync.onMemoryConfirmed(
      { character_id: ids.rc, type: 'constraint', statement }, models);

    const secondDone = interleave(() => confirm('second constraint'));
    await confirm('first constraint');
    await secondDone();

    const { writer_notes: notes } = await rowOf(ids, 'writer_notes');
    expect(notes).toContain('first constraint');
    expect(notes).toContain('second constraint');
  });

  it('row 72: a line-approval moment is appended to the notes as they are after the AI call', async () => {
    const show = uuid();
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'RMW show', :slug, NOW(), NOW())`,
      { show, slug: `rmw-${show.slice(0, 8)}` });
    const ids = await seed({ showId: show });
    const book = uuid();
    const chapter = uuid();
    await run(`INSERT INTO storyteller_books (id, title, created_at, updated_at) VALUES (:book, 'RMW book', NOW(), NOW())`, { book });
    await run(`INSERT INTO storyteller_chapters (id, book_id, chapter_number, title, created_at, updated_at)
               VALUES (:chapter, :book, 1, 'RMW chapter', NOW(), NOW())`, { chapter, book });
    for (let i = 1; i <= 5; i += 1) {
      await run(`INSERT INTO storyteller_lines (id, chapter_id, text, status, sort_order, created_at, updated_at)
                 VALUES (:id, :chapter, :text, 'approved', :i, NOW(), NOW())`, { id: uuid(), chapter, text: `Line ${i}.`, i });
    }
    cleanups.push(async () => {
      await run(`DELETE FROM storyteller_books WHERE id = :book`, { book });
      await run(`DELETE FROM character_registries WHERE id = :reg`, ids);
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    });

    mockCreate.mockImplementationOnce(async () => {
      await run(`UPDATE registry_characters SET writer_notes = 'written during the call' WHERE id = :rc`, ids);
      return { content: [{ text: JSON.stringify({ moments: [{ character_name: ids.name, moment: 'story moment', field: 'behavior' }] }) }] };
    });

    await registrySync.onLineApproved({ content: 'Line 5.', chapter_id: chapter }, { show_id: show }, models);

    const { writer_notes: notes } = await rowOf(ids, 'writer_notes');
    expect(notes).toContain('written during the call');
    expect(notes).toContain('story moment');
  });

  it('row 73: two concurrent pain points both count toward wound depth, notes and the personality matrix', async () => {
    const ids = await seed({ personalityMatrix: { confidence: 10 } });
    track(ids);
    const tag = (statement) => registrySync.onPainPointTagged(
      { character_id: ids.rc, category: 'comparison_spiral', statement }, models);

    const secondDone = interleave(() => tag('second pain'));
    await tag('first pain');
    await secondDone();

    const row = await rowOf(ids, 'writer_notes, wound_depth, personality_matrix');
    expect(row.wound_depth).toBe(1);
    expect(row.writer_notes).toContain('first pain');
    expect(row.writer_notes).toContain('second pain');
    expect(row.personality_matrix).toEqual({ confidence: 9 });
  });
});
