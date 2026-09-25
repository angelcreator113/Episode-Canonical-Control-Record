/**
 * episodeCompletionService.completeEpisode — the episode's look (Task #1924).
 *
 * Before #1924 the look query named ew.approval_status and ew.deleted_at,
 * which episode_wardrobe did not have (Evoni's production read, ATTESTED
 * 2026-09-25). It failed inside `catch { /* non-blocking *\/ }` and the
 * wardrobe bonuses were scored on the event's outfit_pieces, every time,
 * with nothing in the evaluation saying so. The outfit match
 * (getOutfitScore) scored every episode_wardrobe row, approved or not.
 *
 * Now: the approved look is counted and labelled as the episode's own; a
 * failing query is logged; an episode with no approved look is scored on
 * the event's pieces only with an explicit label (the PROPOSAL; Evoni
 * rules), and the outfit match scores only the approved look.
 *
 * sequelize.query is mocked; getOutfitScore is a jest.fn. No database.
 */

jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { total_income: 0, total_expenses: 0 }, balance_before: 500, balance_after: 500,
    milestones_triggered: [], transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));

const mockGetOutfitScore = jest.fn();
jest.mock('../../../src/routes/wardrobe', () => ({ getOutfitScore: (...a) => mockGetOutfitScore(...a) }));
jest.mock('../../../src/services/wardrobeIntelligenceService', () => ({ getWardrobeGrowthArc: jest.fn(async () => null) }));

const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const SHOW_ID = 'show-1';
const EPISODE_ID = 'episode-1';

const LOOK = [
  { brand: 'Maison Belle', name: 'Gold gown', price: 400, tier: 'luxury', category: 'dress' },
  { brand: 'Aurelia', name: 'Heels', price: 150, tier: 'luxury', category: 'shoes' },
];
const EVENT_PIECES = [{ id: 'w-x', name: 'Event dress', brand: 'Other', price: 20, tier: 'basic' }];

const isLookQuery = (sql) => /FROM episode_wardrobe ew/.test(sql) && /w\.brand, w\.name, w\.price/.test(sql);

function makeSequelize({ look = LOOK, lookError = null, eventPieces = EVENT_PIECES } = {}) {
  const queries = [];
  const query = jest.fn(async (sql, opts = {}) => {
    queries.push({ sql, opts });
    if (isLookQuery(sql)) {
      if (lookError) throw lookError;
      // Only an approved, not-removed look is the episode's look.
      if (!/ew\.approval_status = 'approved'/.test(sql) || !/ew\.deleted_at IS NULL/.test(sql)) return [];
      return look.map((r) => ({ ...r }));
    }
    if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
      return [{ id: EPISODE_ID, title: 'Ep', episode_number: 3, show_id: SHOW_ID, evaluation_status: 'draft' }];
    }
    if (/FROM world_events WHERE used_in_episode_id = :episodeId/.test(sql)) {
      return [{ id: 'ev-1', show_id: SHOW_ID, name: 'Gala', prestige: 7, dress_code: 'black tie', outfit_pieces: eventPieces }];
    }
    if (/SELECT \* FROM character_state/.test(sql)) {
      return [{ id: 'state-lala', coins: 900, reputation: 3, brand_trust: 2, influence: 2, stress: 1 }];
    }
    if (/^\s*SELECT/.test(sql)) return [];
    return [[], 0];
  });
  return { queries, sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

function resetModels() {
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  Object.assign(mockModels, {
    Episode: { findByPk: jest.fn(async () => ({ id: EPISODE_ID, episode_number: 3, total_income: 0, total_expenses: 0 })) },
    WorldEvent: { findOne: jest.fn(async () => null) },
    Opportunity: { findByPk: jest.fn(async () => null), findOne: jest.fn(async () => null) },
    CareerGoal: { findAll: jest.fn(async () => []) },
    sequelize: { query: jest.fn(async () => [[], 0]) },
  });
}

const savedEvaluation = (queries) => {
  const q = queries.find((x) => /UPDATE episodes SET evaluation_json/.test(x.sql));
  return JSON.parse(q.opts.replacements.evalJson);
};

describe('completeEpisode — the episode\'s look (Task #1924)', () => {
  let error; let warn;
  beforeEach(() => {
    resetModels();
    mockGetOutfitScore.mockReset();
    mockGetOutfitScore.mockImplementation(async () => ({ hasOutfit: true, score: 80, breakdown: { aesthetic: 8, coverage: 6 } }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('counts the approved look as the episode\'s own, and says so', async () => {
    const { sequelize, queries } = makeSequelize();
    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    // On main there was no `outfit` in the result: nothing said which
    // pieces were scored.
    expect(result.outfit).toEqual({ source: 'episode_look', label: null, pieces: 2, reason: null, match_scored: true });
    expect(result.wardrobe.brands).toEqual(['Maison Belle', 'Aurelia']);
    expect(savedEvaluation(queries).outfit.source).toBe('episode_look');
    // The outfit match scores the same approved look.
    expect(mockGetOutfitScore).toHaveBeenCalledTimes(1);
    expect(mockGetOutfitScore.mock.calls[0][1]).toBe(EPISODE_ID);
    expect(mockGetOutfitScore.mock.calls[0][5]).toEqual({ approvedOnly: true });
    expect(error).not.toHaveBeenCalled();
  });

  test('a failing look query is logged, and the event\'s pieces are never scored silently', async () => {
    const { sequelize, queries } = makeSequelize({ lookError: new Error('column ew.approval_status does not exist') });
    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    // On main: no log at all (catch { /* non-blocking */ }).
    expect(error).toHaveBeenCalledWith(
      `[episodeCompletion] episode ${EPISODE_ID}: the look query failed:`,
      'column ew.approval_status does not exist'
    );
    expect(result.outfit).toMatchObject({ source: 'event_pieces', label: "scored on the event's pieces", pieces: 1, reason: 'look_query_failed' });
    expect(result.wardrobe.brands).toEqual(['Other']);
    const history = queries.find((q) => /INSERT INTO character_state_history/.test(q.sql));
    expect(history.opts.replacements.notes).toMatch(/Outfit: 1 pieces \(scored on the event's pieces\)/);
    expect(savedEvaluation(queries).outfit.label).toBe("scored on the event's pieces");
  });

  test('no approved look: scored on the event\'s pieces with the label, and a warning', async () => {
    const { sequelize } = makeSequelize({ look: [] });
    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(result.outfit).toMatchObject({ source: 'event_pieces', label: "scored on the event's pieces", reason: 'no_approved_look' });
    expect(warn.mock.calls.some(([m]) => /no_approved_look; wardrobe bonuses scored on the event's pieces/.test(m))).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  test('no approved look and no event pieces: not scored for outfit, and it says so', async () => {
    mockGetOutfitScore.mockImplementation(async () => ({ hasOutfit: false, score: 0, breakdown: {} }));
    const { sequelize } = makeSequelize({ look: [], eventPieces: null });
    const result = await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);

    expect(result.outfit).toEqual({
      source: 'none', label: 'no approved look; not scored for outfit', pieces: 0, reason: 'no_approved_look', match_scored: false,
    });
    expect(result.wardrobe).toBeUndefined();
  });

  test('a failing outfit match is logged, not swallowed', async () => {
    mockGetOutfitScore.mockImplementation(async () => { throw new Error('scorer boom'); });
    const { sequelize } = makeSequelize();
    await completeEpisode(EPISODE_ID, SHOW_ID, sequelize);
    expect(error).toHaveBeenCalledWith('[episodeCompletion] outfit match scoring failed; outfit_match is 0:', 'scorer boom');
  });
});
