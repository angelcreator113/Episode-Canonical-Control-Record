/**
 * Season arc proposals from the feed (Evoni, 2026-10-17: "as the feed
 * characters grow so does the story arc"; proposals she approves). On the
 * test database. The AI client is a fake: no network call is made.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const proposalsMigration = require('../../src/migrations/20261018030000-create-season-arc-proposals');
const { seedArc } = require('../../src/services/arcProgressionService');
const proposals = require('../../src/services/seasonArcProposals');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

function fakeClient(json) {
  const create = jest.fn(async () => ({ content: [{ text: JSON.stringify(json) }] }));
  return { client: { messages: { create } }, create };
}
const ANSWER = {
  summary: 'The copied-look storyline paid off; the season can lean into rivalry.',
  changes: [
    { kind: 'phase_theme', phase: 2, tagline: 'Rivals rising', why: 'The copied look paid off' },
    { kind: 'thread_open', title: 'The rival studio', description: 'Someone copies Lala', why: 'storyline paid off' },
    { kind: 'slot_intention', slot_number: 3, story_purpose: 'Lala confronts the copycat at a pop-up', why: 'storyline paid off' },
  ],
};

(shouldSkip ? describe.skip : describe)('Season arc proposals from the feed', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Proposals ${show.slice(0, 8)}`, slug: `proposals-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    await run(`INSERT INTO pulse_storylines (id, show_id, title, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :show, 'The copied look', 'paid_off', NOW(), NOW())`, { show });
    return { show, arcId };
  }
  const slot = async (arcId, n) => (await rows(
    'SELECT id, story_purpose, intention_source FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0];
  const phaseOf = async (arcId, n) => {
    const [arc] = await rows('SELECT phases FROM show_arcs WHERE id = :arcId', { arcId });
    return arc.phases.find((p) => Number(p.phase) === n);
  };

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    await proposalsMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-proposals', email: 'user@season-proposals.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      for (const table of ['season_arc_proposals', 'show_story_threads', 'pulse_storylines', 'career_goals', 'season_slots', 'show_arcs']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('a proposal reads the feed, keeps its signals, and is not asked again while the feed stands still', async () => {
    const { show } = await seedSeason();
    const { client, create } = fakeClient(ANSWER);
    const { proposal } = await proposals.propose(models, show, { trigger: 'episode_accepted', anthropic: client });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].messages[0].content).toContain('The copied look (paid_off)');
    expect(proposal.status).toBe('proposed');
    expect(proposal.changes.map((c) => c.kind)).toEqual(['phase_theme', 'thread_open', 'slot_intention']);
    expect(proposal.signals.storylines[0]).toMatchObject({ title: 'The copied look', status: 'paid_off' });

    // Unchanged feed: no second call.
    expect(await proposals.propose(models, show, { anthropic: client })).toEqual({ skipped: 'unchanged' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('accepting applies only the chosen changes, through the season’s own services; a second decision is refused', async () => {
    const { show, arcId } = await seedSeason();
    const { proposal } = await proposals.propose(models, show, { anthropic: fakeClient(ANSWER).client });

    const list = await auth(request(app).get(`/api/v1/world/${show}/season/proposals`));
    expect(list.status).toBe(200);
    expect(list.body.open.id).toBe(proposal.id);

    const res = await auth(request(app).post(`/api/v1/world/${show}/season/proposals/${proposal.id}/accept`)).send({ changes: [0, 2] });
    expect(res.status).toBe(200);
    expect(res.body.applied.map((a) => [a.index, a.ok])).toEqual([[0, true], [1, false], [2, true]]);

    expect((await phaseOf(arcId, 2)).tagline).toBe('Rivals rising');
    expect(await slot(arcId, 3)).toMatchObject({ story_purpose: 'Lala confronts the copycat at a pop-up', intention_source: 'edited' });
    expect(await rows('SELECT id FROM show_story_threads WHERE show_id = :show', { show })).toHaveLength(0);
    const [row] = await rows('SELECT status, decided_by FROM season_arc_proposals WHERE id = :id', { id: proposal.id });
    expect(row).toEqual({ status: 'accepted', decided_by: 'user@season-proposals.dev' });

    const again = await auth(request(app).post(`/api/v1/world/${show}/season/proposals/${proposal.id}/dismiss`));
    expect(again.status).toBe(409);
  });

  test('a slot Evoni edited is never offered, and an edit made after the proposal wins', async () => {
    const { show, arcId } = await seedSeason();
    await run("UPDATE season_slots SET story_purpose = 'Her own words', intention_source = 'edited' WHERE arc_id = :arcId AND slot_number = 4", { arcId });
    const { client, create } = fakeClient(ANSWER);
    const { proposal } = await proposals.propose(models, show, { anthropic: client });
    expect(create.mock.calls[0][0].messages[0].content).not.toContain('E4:');

    // Edited after the proposal was made: accepting keeps her words.
    await run("UPDATE season_slots SET story_purpose = 'Edited meanwhile', intention_source = 'edited' WHERE arc_id = :arcId AND slot_number = 3", { arcId });
    const { applied } = await proposals.accept(models, show, proposal.id, { indexes: [2] });
    expect(applied[2]).toMatchObject({ ok: false, error: expect.stringMatching(/edited since/) });
    expect((await slot(arcId, 3)).story_purpose).toBe('Edited meanwhile');
  });

  test('dismissing closes it; a newer proposal replaces an open one', async () => {
    const { show } = await seedSeason();
    const first = (await proposals.propose(models, show, { anthropic: fakeClient(ANSWER).client })).proposal;
    const second = (await proposals.propose(models, show, { force: true, anthropic: fakeClient(ANSWER).client })).proposal;
    const [old] = await rows('SELECT status FROM season_arc_proposals WHERE id = :id', { id: first.id });
    expect(old.status).toBe('superseded');

    const res = await auth(request(app).post(`/api/v1/world/${show}/season/proposals/${second.id}/dismiss`));
    expect(res.status).toBe(200);
    const list = await proposals.listProposals(models, show);
    expect(list.open).toBeNull();
    expect(list.recent[0]).toMatchObject({ id: second.id, status: 'dismissed' });
  });
});
