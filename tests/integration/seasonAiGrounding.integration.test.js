/**
 * The season reaches the AI (season-AI audit, Evoni's approval,
 * 2026-10-25), on the test database: distribution's season read (it named
 * columns show_arcs does not have, and the error was swallowed), the Start
 * Episode snapshot's new season fields (re-saved on Edit season), and
 * getArcContext's logline, description and own-arc read.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { seedArc, getArcContext } = require('../../src/services/arcProgressionService');
const { normaliseSetup, updateSetup } = require('../../src/services/seasonSetupService');
const { placeEpisode } = require('../../src/services/seasonSlotService');
const { gatherEpisodeContext, buildContextBlock } = require('../../src/services/distributionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const FORM = {
  title: 'Velvet Ladder', tagline: 'Up is the only way',
  logline: 'Lala moves to Velour City and learns that every invitation costs something.',
  description: 'A season about the price of access.',
  phases: [{ title: 'Arrival', tagline: 'New city' }, { title: 'The Climb', tagline: 'Every room has a price' }, { title: 'Crown', tagline: '' }],
  split: [6, 10, 8],
};

(shouldSkip ? describe.skip : describe)('the season reaches the AI', () => {
  const shows = [];

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Season AI ${show.slice(0, 8)}`, slug: `season-ai-${show.slice(0, 8)}` });
    return show;
  }
  async function seedEpisode(show, n = 1) {
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Gala', :n, 'draft', NOW(), NOW())`, { episode, show, n });
    return episode;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('distribution reads a seeded season: ctx.arc is set and the copy context names it', async () => {
    const show = await seedShow();
    await seedArc(show, models, { setup: normaliseSetup(FORM) });
    const episode = await seedEpisode(show);

    const error = jest.spyOn(console, 'error');
    const ctx = await gatherEpisodeContext(episode, show, sequelize);
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining('[distribution]'), expect.anything());
    error.mockRestore();

    expect(ctx.arc).toEqual(expect.objectContaining({ season_number: 1, title: 'Velvet Ladder', logline: FORM.logline }));
    expect(ctx.arc.part).toEqual(expect.objectContaining({ number: 1, title: 'Arrival', episode_start: 1, episode_end: 6 }));
    const block = buildContextBlock(ctx);
    expect(block).toContain(`Season 1: "Velvet Ladder" — Up is the only way. Logline: ${FORM.logline}`);
    expect(block).toContain('Current part: Part 1 of 3, "Arrival" (E1–E6, 6 episodes)');
    // The show is read by its name (shows has no title column), not the fallback name.
    expect(ctx.show.title).toBe(`Season AI ${show.slice(0, 8)}`);
    expect(block).toContain(`SHOW: "Season AI ${show.slice(0, 8)}"`);
  });

  test("a slotted episode's distribution reads its own part", async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models, { setup: normaliseSetup(FORM) });
    const episode = await seedEpisode(show);
    await placeEpisode(sequelize, show, await slotId(arcId, 9), episode);

    const block = buildContextBlock(await gatherEpisodeContext(episode, show, sequelize));
    expect(block).toContain("This episode's part: Part 2 of 3, \"The Climb\" (E7–E16, 10 episodes)");
  });

  test('a show with no season: distribution goes without, quietly', async () => {
    const show = await seedShow();
    const episode = await seedEpisode(show);
    const ctx = await gatherEpisodeContext(episode, show, sequelize);
    expect(ctx.arc).toBeNull();
    // No season line (the show's own name may contain the word).
    expect(buildContextBlock(ctx)).not.toMatch(/Season \d+:|Current part:/);
  });

  test("the Start Episode snapshot carries the season's tagline, logline, description and the part's range; Edit season re-saves it", async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models, { setup: normaliseSetup(FORM) });
    const episode = await seedEpisode(show);
    await placeEpisode(sequelize, show, await slotId(arcId, 9), episode);

    let [{ season_context: sc }] = await rows('SELECT season_context FROM episodes WHERE id = :episode', { episode });
    expect(sc).toEqual(expect.objectContaining({
      arc_id: arcId, arc_title: 'Velvet Ladder', arc_tagline: 'Up is the only way', arc_logline: FORM.logline,
      arc_description: FORM.description, phase_count: 3, position_in_phase: 3,
    }));
    expect(sc.phase).toEqual(expect.objectContaining({ number: 2, title: 'The Climb', episode_start: 7, episode_end: 16 }));

    await updateSetup(sequelize, show, { ...FORM, logline: 'A new logline.', description: 'x'.repeat(600) });
    [{ season_context: sc }] = await rows('SELECT season_context FROM episodes WHERE id = :episode', { episode });
    expect(sc.arc_logline).toBe('A new logline.');
    expect(sc.arc_description.length).toBeLessThanOrEqual(300);
  });

  test("getArcContext gives the logline, description and part count, and an episode's own arc by id", async () => {
    const show = await seedShow();
    const { arc_id: first } = await seedArc(show, models, { setup: normaliseSetup(FORM) });
    const ctx = await getArcContext(show, { sequelize });
    expect(ctx).toEqual(expect.objectContaining({ arc_id: first, arc_logline: FORM.logline, arc_description: FORM.description, phase_count: 3 }));
    expect(ctx.current_phase).toEqual(expect.objectContaining({ number: 1, title: 'Arrival', episode_range: [1, 6] }));

    // Season 1 done, Season 2 active: the active one by default, Season 1 by its id.
    await run(`UPDATE show_arcs SET status = 'completed' WHERE id = :first`, { first });
    const { arc_id: second } = await seedArc(show, models, { setup: normaliseSetup({ ...FORM, title: 'Second' }) });
    expect((await getArcContext(show, { sequelize })).arc_id).toBe(second);
    expect((await getArcContext(show, { sequelize }, { arcId: first })).arc_title).toBe('Velvet Ladder');
    // Another show's arc id is not read: the active one is.
    const other = await seedShow();
    expect((await getArcContext(other, { sequelize }, { arcId: first }))).toBeNull();
  });
});
