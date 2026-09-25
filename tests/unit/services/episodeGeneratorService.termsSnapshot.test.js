/**
 * Start Episode snapshots the accepted terms (Task #1814, slice 1a).
 *
 * generateEpisodeFromEvent stamps episode_id on the event's deliverables and
 * writes the four kinds of term into EpisodeBrief.event_metadata.terms =
 * { access_requirements, deliverables, restrictions, compensation }. A
 * failed read or stamp is logged and never fails generation.
 *
 * Runs the real function end to end with every side service mocked and no
 * ANTHROPIC_API_KEY (so no AI call). No database.
 */

jest.mock('../../../src/services/feedMomentsService', () => ({ generateFeedMoments: jest.fn(async () => ({})) }));
jest.mock('../../../src/services/characterSyncService', () => ({
  syncAfterEvent: jest.fn(async () => ({ updated: 0 })),
  generatePostEventOpportunities: jest.fn(async () => []),
}));
jest.mock('../../../src/services/feedActivityService', () => ({ generatePostEventActivity: jest.fn(async () => []) }));
jest.mock('../../../src/services/timelinePlacementService', () => ({ autoPlaceRequiredOverlays: jest.fn(async () => []) }));

const { generateEpisodeFromEvent } = require('../../../src/services/episodeGeneratorService');

const DELIVERABLES = [
  { id: 'd1', event_id: 'ev-1', description: 'Sponsored content', deliverable_type: null, due_date: null, required: true, status: 'pending', episode_id: null },
  { id: 'd2', event_id: 'ev-1', description: 'Story mentions', deliverable_type: 'story', due_date: '2026-11-07', required: false, status: 'pending', episode_id: null },
];

function makeModels({ deliverables = DELIVERABLES, failList = false, failStamp = false } = {}) {
  const queries = [];
  const briefs = [];
  const episode = {
    id: 'ep-new',
    update: jest.fn(async () => {}),
    toJSON: () => ({ id: 'ep-new' }),
  };
  const models = {
    sequelize: {
      QueryTypes: { SELECT: 'SELECT' },
      query: jest.fn(async (sql, opts = {}) => {
        queries.push({ sql, replacements: opts.replacements });
        if (/FROM event_deliverables/.test(sql)) {
          if (failList) throw new Error('relation "event_deliverables" does not exist');
          return [deliverables];
        }
        if (/^UPDATE event_deliverables SET episode_id/.test(sql)) {
          if (failStamp) throw new Error('stamp boom');
          return [[], { rowCount: deliverables.length }];
        }
        if (/MAX\(episode_number\)/.test(sql)) return [[{ next_num: 4 }]];
        // The event link stamp inside Start's transaction (Task #1906).
        if (/^UPDATE world_events SET status = 'used'/.test(sql)) return [[{ id: opts.replacements.eventId }]];
        if (/INSERT INTO episode_todo_lists/.test(sql)) return [[{ id: 'todo-1' }]];
        return [[]];
      }),
      // Start Episode's managed transaction (Task #1906).
      transaction: jest.fn(async (cb) => cb({ id: 'tx' })),
    },
    Episode: { create: jest.fn(async () => episode) },
    EpisodeBrief: {
      create: jest.fn(async (data) => { briefs.push(data); return { toJSON: () => data }; }),
    },
  };
  return { models, queries, briefs, episode };
}

const EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Maison Belle Campaign',
  event_type: 'brand_deal',
  prestige: 7,
  cost_coins: 0,
  requirements: { reputation_min: 3, coins_min: 100 },
  restrictions: [{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }],
  is_paid: true,
  payment_amount: 1500,
  rewards: { coins: 50 },
  canon_consequences: { automation: {} },
};

describe('generateEpisodeFromEvent — terms snapshot (Task #1814)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('the brief carries the four kinds of term, each from its own home', async () => {
    const { models, briefs } = makeModels();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });

    expect(briefs).toHaveLength(1);
    expect(briefs[0].event_metadata.terms).toEqual({
      access_requirements: { reputation_min: 3, coins_min: 100 },
      deliverables: [
        { id: 'd1', description: 'Sponsored content', deliverable_type: null, due_date: null, required: true, status: 'pending' },
        { id: 'd2', description: 'Story mentions', deliverable_type: 'story', due_date: '2026-11-07', required: false, status: 'pending' },
      ],
      restrictions: [{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }],
      compensation: { is_paid: true, payment_amount: 1500 },
    });
    // The older copies stay as they were; rewards are not a term.
    expect(briefs[0].event_metadata.requirements).toEqual({ reputation_min: 3, coins_min: 100 });
    expect(briefs[0].event_metadata.rewards).toEqual({ coins: 50 });
    expect(briefs[0].event_metadata.terms).not.toHaveProperty('rewards');
  });

  test('stamps the new episode on the event\'s deliverables', async () => {
    const { models, queries } = makeModels();
    await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    const stamps = queries.filter((q) => /^UPDATE event_deliverables SET episode_id/.test(q.sql));
    expect(stamps).toHaveLength(1);
    expect(stamps[0].replacements).toEqual({ eventId: 'ev-1', episodeId: 'ep-new' });
  });

  test('no deliverables: an empty list in the snapshot, and no stamp', async () => {
    const { models, queries, briefs } = makeModels({ deliverables: [] });
    await generateEpisodeFromEvent({ ...EVENT, restrictions: null, requirements: null, is_paid: false, payment_amount: 0 }, models, { showId: 'show-1' });
    expect(briefs[0].event_metadata.terms).toEqual({
      access_requirements: {}, deliverables: [], restrictions: [], compensation: { is_paid: false, payment_amount: 0 },
    });
    expect(queries.filter((q) => /^UPDATE event_deliverables/.test(q.sql))).toHaveLength(0);
  });

  test('a failed stamp is logged and generation still returns the episode and brief', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { models, briefs } = makeModels({ failStamp: true });
    const result = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(result.episode).toEqual({ id: 'ep-new' });
    expect(briefs[0].event_metadata.terms.deliverables).toHaveLength(2);
    expect(error).toHaveBeenCalledWith('[EpisodeGenerator] Deliverable episode stamp failed (non-blocking):', 'stamp boom');
  });

  test('a failed deliverables read is logged; the snapshot still has the other terms', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { models, briefs, queries } = makeModels({ failList: true });
    const result = await generateEpisodeFromEvent(EVENT, models, { showId: 'show-1' });
    expect(result.episode).toEqual({ id: 'ep-new' });
    expect(briefs[0].event_metadata.terms.deliverables).toEqual([]);
    expect(briefs[0].event_metadata.terms.compensation).toEqual({ is_paid: true, payment_amount: 1500 });
    expect(queries.filter((q) => /^UPDATE event_deliverables/.test(q.sql))).toHaveLength(0);
    expect(error).toHaveBeenCalledWith(
      '[EpisodeGenerator] Deliverables read failed (terms snapshot has none):',
      'relation "event_deliverables" does not exist'
    );
  });
});
