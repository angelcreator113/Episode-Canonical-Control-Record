/**
 * Season 2 readiness (season-AI audit, Evoni's approval, 2026-10-25), on the
 * test database. Episode numbers count across the whole show, and several
 * readers took "the season" to be the show: the seeds' twists, the script
 * writer's arc, the loader's fallback, the event suggestions, the episode
 * codes and the thumbnail grid, the suggestions' narrative debt, and every
 * season's part moods (Season 1's, copied).
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');
const { normaliseSetup, updateSetup, PART_DEFAULTS } = require('../../src/services/seasonSetupService');
const { placeEpisode } = require('../../src/services/seasonSlotService');
const { loadSeason } = require('../../src/services/seasonLoader');
const { loadSeedContext } = require('../../src/services/seedContext');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');
const { suggestNextEvents } = require('../../src/services/feedEventPipelineService');
const { loadSeasonInputs } = require('../../src/services/seasonSuggestionService');
const { seasonEpisodes } = require('../../src/services/youtubeThumbnailService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const form = (title, parts = ['Arrival', 'The Climb', 'Crown']) => ({
  title, tagline: `${title} tagline`, phases: parts.map((t) => ({ title: t })), split: [6, 10, 8],
});

(shouldSkip ? describe.skip : describe)('Season 2 readiness', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Season Two ${show.slice(0, 8)}`, slug: `season-two-${show.slice(0, 8)}` });
    return show;
  }
  async function seedEpisode(show, n, title = `Episode ${n}`) {
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, :title, :n, 'draft', NOW(), NOW())`, { episode, show, n, title });
    return episode;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const finish = (arcId) => run(`UPDATE show_arcs SET status = 'completed' WHERE id = :arcId`, { arcId });
  /** Season 1 (completed) and Season 2 (active), with their arc ids. */
  async function twoSeasons(show) {
    const { arc_id: s1 } = await seedArc(show, models, { setup: normaliseSetup(form('First Light', ['Foundation', 'Ascension', 'Legacy'])) });
    await finish(s1);
    const { arc_id: s2, season_number: n } = await seedArc(show, models, { setup: normaliseSetup(form('Velvet Ladder')) });
    expect(n).toBe(2);
    return { s1, s2 };
  }

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-season-two', email: 'evoni@season-two.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_twists WHERE show_id = :show', { show });
      await run(`DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test("the seeds read the season's twists, not Season 1's", async () => {
    const show = await seedShow();
    const { s1, s2 } = await twoSeasons(show);
    for (const [arcId, title] of [[s1, 'Old unpaid twist'], [s2, 'This season twist']]) {
      await run(`INSERT INTO season_twists (show_id, arc_id, title, plant_slot_id, status) VALUES (:show, :arcId, :title, :slot, 'planted')`,
        { show, arcId, title, slot: await slotId(arcId, 1) });
    }
    const ctx = await loadSeedContext(sequelize, { showId: show });
    expect(ctx.twists.map((t) => t.title)).toEqual(['This season twist']);
  });

  test("the script writer reads an episode's own season while Season 2 is active", async () => {
    const show = await seedShow();
    const { arc_id: s1 } = await seedArc(show, models, { setup: normaliseSetup(form('First Light', ['Foundation', 'Ascension', 'Legacy'])) });
    const old = await seedEpisode(show, 3);
    await placeEpisode(sequelize, show, await slotId(s1, 3), old);
    await finish(s1);
    await seedArc(show, models, { setup: normaliseSetup(form('Velvet Ladder')) });

    const context = await loadScriptContext(old, show, models);
    expect(context.arcPhase.name).toBe('First Light');
    expect(buildFullPrompt(context)).toContain('First Light — Phase');
    // An episode in no slot reads the active season.
    const loose = await seedEpisode(show, 30);
    expect((await loadScriptContext(loose, show, models)).arcPhase.name).toBe('Velvet Ladder');
  });

  test("with no active season, the loader's fallback is the latest season, not the first", async () => {
    const show = await seedShow();
    const { s2 } = await twoSeasons(show);
    await finish(s2);
    expect((await loadSeason(sequelize, show, { anyStatus: true, slots: false })).arc.id).toBe(s2);
    expect(await loadSeason(sequelize, show, { slots: false })).toBeNull();
  });

  test("the event suggestions read Season 2's next slot and its own parts, not the show's 24 episodes", async () => {
    const show = await seedShow();
    await twoSeasons(show);
    for (let n = 1; n <= 24; n += 1) await seedEpisode(show, n);

    const suggestions = (await suggestNextEvents(show, models)).filter((s) => s.source === 'narrative');
    expect(suggestions.map((s) => s.name)).toEqual(['Introductory social gathering']);
    expect(suggestions[0].reason).toMatch(/^Part 1: Arrival — /);
    expect(JSON.stringify(suggestions)).not.toMatch(/Legacy|Foundation/);
  });

  test("Season 2's first episode is \"S2 · E1\" in its snapshot, the episodes list and the thumbnail grid", async () => {
    const show = await seedShow();
    const { s1, s2 } = await twoSeasons(show);
    const first = await seedEpisode(show, 1, 'Pilot');
    await run('UPDATE season_slots SET episode_id = :first WHERE arc_id = :s1 AND slot_number = 1', { first, s1 });
    const opener = await seedEpisode(show, 25, 'New City');
    await placeEpisode(sequelize, show, await slotId(s2, 1), opener);
    const loose = await seedEpisode(show, 26, 'Unslotted');

    const [{ season_context: sc }] = await rows('SELECT season_context FROM episodes WHERE id = :opener', { opener });
    expect(sc.label).toBe('S2 · E1');

    const res = await auth(request(app).get(`/api/v1/episodes?show_id=${show}&page=1&limit=100`));
    expect(res.status).toBe(200);
    const listed = (res.body.data || []).find((e) => e.id === opener);
    expect(listed.season_context.label).toBe('S2 · E1');

    const grid = await seasonEpisodes(sequelize, show);
    expect(grid.map((e) => [e.title, e.label])).toEqual([['New City', 'S2 · E1'], ['Unslotted', null]]);
    expect(grid.map((e) => e.id)).not.toContain(first);
    expect(loose).toBeTruthy();
    // A chosen season: Season 1's slots.
    expect((await seasonEpisodes(sequelize, show, { arcId: s1 })).map((e) => [e.title, e.label])).toEqual([['Pilot', 'S1 · E1'], ['Unslotted', null]]);
    await expect(seasonEpisodes(sequelize, show, { arcId: uuid() })).rejects.toThrow('Season not found');
  });

  test("the suggestions read the season's narrative debt with no slot open", async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models, { setup: normaliseSetup(form('Velvet Ladder')) });
    await run(`UPDATE show_arcs SET narrative_debt = :debt WHERE id = :arcId`,
      { arcId, debt: JSON.stringify([{ goal_title: 'Gala', narrative_weight: 'She froze at the gala.' }]) });
    await run('UPDATE season_slots SET locked_at = NOW() WHERE arc_id = :arcId', { arcId });
    const inputs = await loadSeasonInputs(sequelize, show);
    expect(inputs.slot).toBeNull();
    expect(inputs.debt.map((d) => d.narrative_weight)).toEqual(['She froze at the gala.']);
  });

  test("each season's part moods: its own when given, the default when empty, kept when left out, refused when too long", async () => {
    const show = await seedShow();
    const setup = normaliseSetup({ ...form('Velvet Ladder'), phases: [
      { title: 'Arrival', emotional_arc: 'wonder → doubt', feed_tone: 'Loud and new.' }, { title: 'The Climb' }, { title: 'Crown', emotional_arc: '' },
    ] });
    await seedArc(show, models, { setup });
    const phases = async () => (await loadSeason(sequelize, show, { slots: false })).arc.phases;
    let p = await phases();
    expect([p[0].emotional_arc, p[0].feed_behavior.feed_tone]).toEqual(['wonder → doubt', 'Loud and new.']);
    expect(p[1].emotional_arc).toBe(PART_DEFAULTS[1].emotional_arc);
    expect(p[2].emotional_arc).toBe(PART_DEFAULTS[2].emotional_arc);

    await updateSetup(sequelize, show, { ...form('Velvet Ladder'), phases: [
      { title: 'Arrival' }, { title: 'The Climb', emotional_arc: 'hunger → rivalry', feed_tone: 'Sharp.' }, { title: 'Crown', feed_tone: '' },
    ] });
    p = await phases();
    expect([p[0].emotional_arc, p[0].feed_behavior.feed_tone]).toEqual(['wonder → doubt', 'Loud and new.']);
    expect([p[1].emotional_arc, p[1].feed_behavior.feed_tone]).toEqual(['hunger → rivalry', 'Sharp.']);
    expect(p[2].feed_behavior.feed_tone).toBe(PART_DEFAULTS[2].feed_behavior.feed_tone);

    const res = await auth(request(app).put(`/api/v1/world/${show}/arc/setup`)).send({ ...form('Velvet Ladder'), phases: [
      { title: 'Arrival', emotional_arc: 'x'.repeat(301) }, { title: 'The Climb' }, { title: 'Crown' },
    ] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Part 1's emotional arc is 301 characters; keep it to 300.");
    expect((await phases())[0].emotional_arc).toBe('wonder → doubt');
  });
});
