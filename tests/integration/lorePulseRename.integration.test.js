/**
 * The seeded lore calls its social web The Pulse (Evoni, 2026-10-19):
 * migration 20261019210000-lore-the-pulse renames "the Feed", "Feed
 * Behavior" and "Feed profile" in the LalaVerse franchise laws and the
 * system cultural calendar, leaves other documents and look-alike words
 * ("the Feedback", "Instagram Feed") alone, changes nothing on a second
 * run, and down restores the exact old text.
 */
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261019210000-lore-the-pulse');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const TAG = 'Lore Pulse rename test';

const LAW = 'The Feed has a memory. Her opinion reshapes the Feed. Feed Behavior: invisible. No Feed profile for a child. the Feedback loop. Instagram Feed 4:5.';
const LAW_AFTER = 'The Pulse has a memory. Her opinion reshapes The Pulse. Pulse Behavior: invisible. No Pulse profile for a child. the Feedback loop. Instagram Feed 4:5.';

(shouldSkip ? describe.skip : describe)('lore: the Feed becomes The Pulse', () => {
  const insertLaw = (title, content, source) => run(
    `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, source_document, extracted_by, status, created_at, updated_at)
     VALUES (:title, :content, 'franchise_law', 'critical', true, :source, 'system', 'active', NOW(), NOW())`,
    { title, content, source });
  const law = async (title) => (await q('SELECT title, content FROM franchise_knowledge WHERE title = :title', { title }))[0];
  const day = async (title) => (await q(
    'SELECT title, what_world_knows, what_only_we_know, phrases FROM story_calendar_events WHERE title = :title', { title }))[0];

  beforeAll(async () => {
    await insertLaw(`${TAG}: law`, LAW, 'cultural-memory-v1.0');
    await insertLaw(`${TAG}: other`, 'A note on the Feed', 'amber-push');
    await run(
      `INSERT INTO story_calendar_events (id, title, event_type, start_datetime, logged_by, what_world_knows, what_only_we_know, phrases, created_at, updated_at)
       VALUES (gen_random_uuid(), :title, 'lalaverse_cultural', NOW(), 'system', 'Viral pet moments dominate the Feed',
               'The Creator King''s birthday is the one day the Feed is grateful.', CAST(:phrases AS jsonb), NOW(), NOW())`,
      { title: `${TAG}: day`, phrases: JSON.stringify(['across the Feed', 'Instagram Feed']) });
    await run(
      `INSERT INTO story_calendar_events (id, title, event_type, start_datetime, logged_by, what_world_knows, created_at, updated_at)
       VALUES (gen_random_uuid(), :title, 'lalaverse_cultural', NOW(), 'evoni', 'Her own note on the Feed', NOW(), NOW())`,
      { title: `${TAG}: hers` });
  });

  afterAll(async () => {
    await run('DELETE FROM franchise_knowledge WHERE title LIKE :tag', { tag: `${TAG}%` });
    await run('DELETE FROM story_calendar_events WHERE title LIKE :tag', { tag: `${TAG}%` });
    await run('DROP TABLE IF EXISTS lore_pulse_rename_backups');
  });

  it('renames the phrases in the lore and the system calendar; look-alikes and other rows stay', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await migration.up(sequelize.getQueryInterface(), require('sequelize'));

    expect((await law(`${TAG}: law`)).content).toBe(LAW_AFTER);
    expect((await law(`${TAG}: other`)).content).toBe('A note on the Feed');

    const d = await day(`${TAG}: day`);
    expect(d.what_world_knows).toBe('Viral pet moments dominate The Pulse');
    expect(d.what_only_we_know).toBe("The Creator King's birthday is the one day The Pulse is grateful.");
    expect(d.phrases).toEqual(['across The Pulse', 'Instagram Feed']);
    expect((await day(`${TAG}: hers`)).what_world_knows).toBe('Her own note on the Feed');
  });

  it('changes nothing on a second run', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const before = [await law(`${TAG}: law`), await day(`${TAG}: day`)];
    const [[{ n: kept }]] = await run('SELECT COUNT(*)::int AS n FROM lore_pulse_rename_backups');
    await migration.up(sequelize.getQueryInterface(), require('sequelize'));
    expect([await law(`${TAG}: law`), await day(`${TAG}: day`)]).toEqual(before);
    const [[{ n: after }]] = await run('SELECT COUNT(*)::int AS n FROM lore_pulse_rename_backups');
    expect(after).toBe(kept);
  });

  it('down restores the exact old text', async () => {
    await migration.down(sequelize.getQueryInterface());
    expect((await law(`${TAG}: law`)).content).toBe(LAW);
    const d = await day(`${TAG}: day`);
    expect(d.what_world_knows).toBe('Viral pet moments dominate the Feed');
    expect(d.phrases).toEqual(['across the Feed', 'Instagram Feed']);
    const [[{ reg }]] = await run("SELECT to_regclass('public.lore_pulse_rename_backups') AS reg");
    expect(reg).toBeNull();
  });
});
