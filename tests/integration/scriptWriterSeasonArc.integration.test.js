/**
 * The script writer's SEASON ARC prompt block (docs/SEASON_ARC_READ.md §3).
 *
 * loadScriptContext's season step asked show_arcs for `name` and
 * `phase_title`, columns the table does not have, so the query failed, the
 * empty catch swallowed it, and the SEASON ARC block was never written.
 * On the test database: a seeded Season 1 reaches the prompt, the active
 * arc is the one read, and a show with no arc gets no block.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');
const { seedArc } = require('../../src/services/arcProgressionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('script writer — SEASON ARC block', () => {
  const shows = [];

  async function seedShow() {
    const show = uuid();
    const episode = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Arc ${show.slice(0, 8)}`, slug: `arc-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Arc episode', 1, 'draft', NOW(), NOW())`, { episode, show });
    return { show, episode };
  }

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('a seeded Season 1 reaches the context and the prompt', async () => {
    const { show, episode } = await seedShow();
    await seedArc(show, models);

    const context = await loadScriptContext(episode, show, models);

    expect(context.arcPhase).toEqual(expect.objectContaining({
      name: 'Soft Luxury Ascension',
      current_phase: 1,
      phase_title: 'Foundation',
      emotional_temperature: 'rising',
    }));
    const prompt = buildFullPrompt(context);
    expect(prompt).toContain('═══ SEASON ARC ═══');
    expect(prompt).toContain('Soft Luxury Ascension — Phase 1: Foundation');
    expect(prompt).toContain('curiosity → first stumble → finding her footing');
    expect(prompt).toContain('Emotional Temperature: rising');
  });

  test('the active arc is read, not a newer inactive one', async () => {
    const { show, episode } = await seedShow();
    await seedArc(show, models);
    await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                 phases, current_phase, status, narrative_debt, progression_log, emotional_temperature,
                 created_at, updated_at)
               VALUES (:id, :show, 2, 'Not yet', 2, 25, 48, '[]', 1, 'upcoming', '[]', '[]', 'anxious',
                 NOW() + INTERVAL '1 day', NOW())`, { id: uuid(), show });

    const context = await loadScriptContext(episode, show, models);

    expect(context.arcPhase).toEqual(expect.objectContaining({ name: 'Soft Luxury Ascension', phase_title: 'Foundation' }));
  });

  test('a show with no arc gets no SEASON ARC block', async () => {
    const { show, episode } = await seedShow();

    const context = await loadScriptContext(episode, show, models);

    expect(context.arcPhase).toBeNull();
    expect(buildFullPrompt(context)).not.toContain('SEASON ARC');
  });
});
