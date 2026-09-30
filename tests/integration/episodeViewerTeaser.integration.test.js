/**
 * Viewer teaser (Task #2386; Evoni's P12 and P13, 2026-09-30).
 *
 * Start Episode drafts the teaser in its one Claude call from the event's
 * concept and description, writes it to episodes.teaser with a saved copy
 * in teaser_drafted (rule 14: Auto-drafted until edited), and asks for
 * episodes.description as the internal synopsis. With no AI teaser, the
 * teaser stays null and is never copied from the event description.
 * PUT /api/v1/episodes/:id edits the teaser and never touches the draft copy.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const CONCEPT = 'A candlelit fitting where the last guest to arrive chooses who leaves.';
const EVENT_DESCRIPTION = 'An evening fitting at the Maison Rue atelier: champagne, first looks at the winter line, and one surprise guest.';
const TEASER = 'Everyone at the fitting got the same invitation. Only one of them knows why Lala is really there. By midnight, someone leaves the atelier without their coat.';

const aiReturns = (payload) => mockCreate.mockResolvedValueOnce({ content: [{ text: JSON.stringify(payload) }] });

(shouldSkip ? describe.skip : describe)('viewer teaser at Start Episode and on edit (P12, P13)', () => {
  const shows = [];
  const originalKey = process.env.ANTHROPIC_API_KEY;
  let token;

  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    token = TokenService.generateTokenPair({
      id: 'test-user-viewer-teaser', email: 'test@viewer-teaser.dev', name: 'Viewer Teaser',
      groups: ['USER', 'EDITOR', 'ADMIN'], role: 'ADMIN',
    }).accessToken;
  });

  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.error(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedEvent() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Teaser show ${ids.show.slice(0, 8)}`, slug: `teaser-${ids.show.slice(0, 8)}` });
    const cc = JSON.stringify({ automation: { concept: CONCEPT } });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, description, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Fitting', 'invite', :desc, :cc, 'ready', NOW(), NOW())`,
      { ...ids, desc: EVENT_DESCRIPTION, cc });
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    return { ids, event };
  }

  const episodeRow = async (id) => (await q(`SELECT description, teaser, teaser_drafted FROM episodes WHERE id = :id`, { id }))[0];

  it('Start Episode writes the drafted teaser and its saved copy, and asks for an internal synopsis', async () => {
    const { ids, event } = await seedEvent();
    aiReturns({
      title: 'The Fitting',
      description: 'Lala attends the Maison Rue fitting, is fitted for the winter coat, and meets the surprise guest.',
      teaser: `  "${TEASER}"  `,
      tags: ['fashion'],
      beats: [],
      forward_hook: 'She left her number.',
    });

    const { episode } = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    const row = await episodeRow(episode.id);

    expect(row.teaser).toBe(TEASER);
    expect(row.teaser_drafted).toBe(TEASER);
    expect(row.description).toBe('Lala attends the Maison Rue fitting, is fitted for the winter coat, and meets the surprise guest.');

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain(`EVENT CONCEPT: ${CONCEPT}`);
    expect(prompt).toContain(`EVENT DESCRIPTION (guest copy for attendees): ${EVENT_DESCRIPTION}`);
    expect(prompt).toContain('"teaser": "Viewer teaser, guest-facing');
    expect(prompt).toContain('"description": "Internal synopsis for the production team');
    expect(prompt).not.toContain('YouTube description');
  });

  it('no AI teaser: teaser stays null, never copied from the event description', async () => {
    const { ids, event } = await seedEvent();
    aiReturns({ title: 'The Fitting', description: 'Internal: she goes.', tags: [], beats: [] });

    const { episode } = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    const row = await episodeRow(episode.id);

    expect(row.teaser).toBeNull();
    expect(row.teaser_drafted).toBeNull();
  });

  it('a drafted teaser that only restates the event description is dropped', async () => {
    const { ids, event } = await seedEvent();
    aiReturns({ title: 'The Fitting', description: 'Internal.', teaser: EVENT_DESCRIPTION, tags: [], beats: [] });

    const { episode } = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    expect((await episodeRow(episode.id)).teaser).toBeNull();
  });

  it('PUT /episodes/:id edits the teaser (trimmed), leaves teaser_drafted, and an empty teaser clears it', async () => {
    const { ids, event } = await seedEvent();
    aiReturns({ title: 'The Fitting', description: 'Internal.', teaser: TEASER, tags: [], beats: [] });
    const { episode } = await generateEpisodeFromEvent(event, models, { showId: ids.show });

    const edited = 'Who invited the one guest nobody expected?';
    const res = await request(app)
      .put(`/api/v1/episodes/${episode.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teaser: `  ${edited}  `, teaser_drafted: 'client cannot write this' });
    expect(res.status).toBe(200);

    let row = await episodeRow(episode.id);
    expect(row.teaser).toBe(edited);
    expect(row.teaser_drafted).toBe(TEASER);

    const cleared = await request(app)
      .put(`/api/v1/episodes/${episode.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teaser: '   ' });
    expect(cleared.status).toBe(200);
    row = await episodeRow(episode.id);
    expect(row.teaser).toBeNull();
    expect(row.teaser_drafted).toBe(TEASER);
  });

  it('PUT without a token is refused', async () => {
    const { ids, event } = await seedEvent();
    aiReturns({ title: 'The Fitting', description: 'Internal.', teaser: TEASER, tags: [], beats: [] });
    const { episode } = await generateEpisodeFromEvent(event, models, { showId: ids.show });

    const res = await request(app).put(`/api/v1/episodes/${episode.id}`).send({ teaser: 'nope' });
    expect(res.status).toBe(401);
    expect((await episodeRow(episode.id)).teaser).toBe(TEASER);
  });
});
