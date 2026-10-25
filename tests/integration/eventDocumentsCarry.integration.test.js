/**
 * Event documents PR 3: Start Episode (generateEpisodeFromEvent) carries the
 * event's approved shopping list into the episode's wardrobe list, and links
 * the approved offer letter's overlay to the episode (beat 5, directly
 * after the invitation; Evoni, 2026-10-24). A career plan saved before the offer letter replaced it is
 * no longer carried: Lala's goals are written from the event. A draft is
 * not carried; deliverables stay required. S3 and the AI client are mocked,
 * as in goalTasksScaleWithEvent.integration.test.js.
 */
jest.unmock('uuid');

const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input) => input),
}));

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

const crypto = require('crypto');
const models = require('../../src/models');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { insertEventDeliverables } = require('../../src/services/eventTermsService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const documents = (status, offerAssetId = null) => ({
  shopping_list: {
    type: 'shopping_list', status, version: 2, source: 'edited',
    items: [
      { slot: 'dress', label: 'The pink satin gown', description: 'Black tie florals', required: true },
      { slot: 'purse', label: 'A crystal clutch', description: '', required: false },
    ],
    history: [],
  },
  career_plan: {
    type: 'career_plan', status, version: 1, source: 'draft',
    items: [
      { slot: 'net_1', label: 'Meet the Maison Rue buyer', description: 'Bring the lookbook', required: false, section: 'this_event' },
      { slot: 'goal_1', label: 'Land a brand partnership', description: '', required: false, section: 'bigger_goals', goal_id: 'g-1' },
    ],
    history: [],
  },
  ...(offerAssetId ? {
    offer_letter: {
      type: 'offer_letter', status, version: 1, source: 'draft', items: [],
      letter: { greeting: 'Dear Lala,', opening: 'Maison Rue is pleased to offer you a partnership.', opportunity: 'Front our launch.' },
      overlay: { asset_id: offerAssetId, url: 'https://x/offer.png', version: 1 },
      history: [],
    },
  } : {}),
});

(shouldSkip ? describe.skip : describe)("Start Episode carries the event's approved documents", () => {
  const shows = [];

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockRejectedValue(new Error('no AI in this test'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['assets', 'episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.error(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show })
        .catch((err) => console.error('cleanup event_deliverables:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function seedEvent(docs, offerAssetId = null) {
    const ids = { show: uuid(), event: uuid(), cc: JSON.stringify({ documents: docs }) };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Docs show ${ids.show.slice(0, 8)}`, slug: `docs-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, description, dress_code,
                 venue_name, host, host_brand, status, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Maison Rue Launch', 'brand_deal', 3,
                 'The spring collection unveiled on the rooftop.', 'Black tie florals', 'The Glasshouse',
                 'Celeste Rue', 'Maison Rue', 'ready', CAST(:cc AS jsonb), NOW(), NOW())`, ids);
    if (offerAssetId) {
      await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
                 VALUES (:id, 'Offer letter: Maison Rue Launch', 'DOCUMENT_OVERLAY', :show, 'https://x/offer.png',
                         CAST(:meta AS jsonb), NOW(), NOW())`,
      { id: offerAssetId, show: ids.show, meta: JSON.stringify({ source: 'event_document', event_id: ids.event, document_type: 'offer_letter', document_version: 1 }) });
    }
    return ids;
  }

  async function startEpisode(ids) {
    const [event] = await q(`SELECT * FROM world_events WHERE id = :event`, ids);
    const result = await generateEpisodeFromEvent(event, models, { showId: ids.show });
    const [todo] = await q(`SELECT tasks, social_tasks FROM episode_todo_lists WHERE episode_id = :ep`, { ep: result.episode.id });
    return { wardrobe: parse(todo.tasks), social: parse(todo.social_tasks), episodeId: result.episode.id };
  }

  it('approved: the shopping list is the wardrobe list; the offer letter is linked to the episode; an old career plan is not carried; deliverables stay required', async () => {
    const offerAssetId = uuid();
    const ids = await seedEvent(documents('approved', offerAssetId), offerAssetId);
    await insertEventDeliverables(sequelize, ids.event, [
      { description: 'One reel in the Maison Rue coat', deliverable_type: 'reel', required: true, owed_to: 'brand' },
    ]);
    const { wardrobe, social, episodeId } = await startEpisode(ids);
    expect(wardrobe.map((t) => [t.slot, t.label, t.required])).toEqual([
      ['dress', 'The pink satin gown', true],
      ['purse', 'A crystal clutch', false],
    ]);
    expect(wardrobe[0].from_event_document).toEqual({ type: 'shopping_list', version: 2 });
    // Lala's goals are written from the event, not from the old career plan.
    const goals = social.filter((t) => !t.deliverable_id);
    expect(goals.map((t) => t.label)).not.toContain('Meet the Maison Rue buyer');
    expect(goals.some((t) => t.from_event_document)).toBe(false);
    expect(social.filter((t) => t.required).map((t) => t.label)).toEqual(['One reel in the Maison Rue coat']);
    // The approved offer letter's overlay is the episode's.
    const [offer] = await q('SELECT episode_id FROM assets WHERE id = :id', { id: offerAssetId });
    expect(offer.episode_id).toBe(episodeId);
  });

  it('draft: nothing is carried; the standard wardrobe slots and the goals written from the event are used', async () => {
    const { wardrobe, social } = await startEpisode(await seedEvent(documents('draft')));
    // The standard lines a draft has with no look (todoListService
    // defaultShoppingTasks, 2026-10-24), not the old five fixed lines.
    expect(wardrobe.map((t) => t.slot)).toEqual(['dress', 'shoes', 'purse', 'accessories', 'jewelry', 'perfume', 'hair']);
    expect(wardrobe.some((t) => t.from_event_document)).toBe(false);
    const labels = social.map((t) => t.label);
    expect(labels).not.toContain('Meet the Maison Rue buyer');
    expect(social.length).toBeGreaterThanOrEqual(2);
  });
});
