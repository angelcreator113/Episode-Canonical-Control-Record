/**
 * /api/v1/wardrobe/outfit-score/:episodeId — the styling game's score comes
 * from the canonical scorer, for a draft (POST) and for the locked outfit
 * (GET), with the inputs episode completion uses (Task #1943; Evoni's
 * ruling, 2026-09-26: one scorer, one number).
 *
 * The real getOutfitScore and scoreOutfitForEvent run; scoreOutfitForEvent
 * is spied to see what it is given. sequelize.query is a recording stub
 * over a small in-memory world. No database.
 */
const mockModels = {};
jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, { get: () => (req, res) => res.json({}) }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));
jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { total_income: 0, total_expenses: 0 }, balance_before: 500, balance_after: 500,
    milestones_triggered: [], transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));

const express = require('express');
const request = require('supertest');
const wis = require('../../../src/services/wardrobeIntelligenceService');
const wardrobeRoutes = require('../../../src/routes/wardrobe');
const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const SHOW_ID = 'show-1';
const OTHER_SHOW = 'show-2';
const EPISODE_ID = 'ep-1';

const EVENTS = [
  // The event completion uses: the episode's highest-prestige linked event.
  { id: 'ev-gala', show_id: SHOW_ID, used_in_episode_id: EPISODE_ID, name: 'Gold Gala', prestige: 8, strictness: 6,
    event_type: 'gala', dress_code: 'black tie', dress_code_keywords: ['gold'], host_brand: 'Maison Belle',
    canon_consequences: { automation: {} }, outfit_pieces: [] },
  { id: 'ev-brunch', show_id: SHOW_ID, used_in_episode_id: EPISODE_ID, name: 'Sunday Brunch', prestige: 3, strictness: 2,
    event_type: 'brunch', dress_code: 'casual', dress_code_keywords: [], host_brand: null, outfit_pieces: [] },
  { id: 'ev-elsewhere', show_id: OTHER_SHOW, name: 'Other Show Party', prestige: 9, event_type: 'party' },
];
const STATE = { id: 'state-lala', show_id: SHOW_ID, character_key: 'lala', coins: 900, reputation: 3, brand_trust: 2, influence: 2, stress: 1 };
const WARDROBE = [
  { id: 'w-dress', show_id: SHOW_ID, name: 'Gold gown', clothing_category: 'dress', tier: 'luxury', brand: 'Maison Belle', price: 400, aesthetic_tags: '["glam"]', event_types: '["gala"]' },
  { id: 'w-heels', show_id: SHOW_ID, name: 'Heels', clothing_category: 'shoes', tier: 'luxury', brand: 'Aurelia', price: 150, aesthetic_tags: '[]', event_types: '[]' },
  { id: 'w-shared', show_id: null, name: 'Pearl drops', clothing_category: 'jewelry', tier: 'mid', brand: null, price: 40, aesthetic_tags: '[]', event_types: '[]' },
  { id: 'w-foreign', show_id: OTHER_SHOW, name: 'Other show bag', clothing_category: 'bag', tier: 'elite', brand: 'X', price: 900, aesthetic_tags: '[]', event_types: '[]' },
];
// The locked, approved outfit.
const LINKED = ['w-dress', 'w-heels'];

let queries;
function answer(sql, opts = {}) {
  queries.push({ sql, opts });
  const r = opts.replacements || {};
  const flat = opts.type === 'SELECT';
  const out = (rows) => (flat ? rows : [rows]);

  if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
    return out([{ id: EPISODE_ID, show_id: SHOW_ID, title: 'Ep', episode_number: 3, evaluation_status: 'draft' }]);
  }
  if (/FROM world_events WHERE used_in_episode_id = :episodeId ORDER BY prestige DESC/.test(sql)) {
    const evs = EVENTS.filter((e) => e.used_in_episode_id === r.episodeId).sort((a, b) => b.prestige - a.prestige);
    return out(evs.slice(0, 1));
  }
  if (/FROM world_events\s+WHERE id = :eventId AND \(show_id = :showId OR show_id IS NULL\)/.test(sql)) {
    return out(EVENTS.filter((e) => e.id === r.eventId && (e.show_id === r.showId || e.show_id == null)));
  }
  if (/SELECT \* FROM character_state WHERE show_id = :showId AND character_key = 'lala'/.test(sql)) {
    return out(r.showId === SHOW_ID ? [{ ...STATE }] : []);
  }
  if (/FROM wardrobe w\s+WHERE w\.id IN \(:ids\)/.test(sql)) {
    const scoped = /w\.show_id = :showId OR w\.show_id IS NULL/.test(sql);
    return out(WARDROBE.filter((w) => r.ids.includes(w.id) && (!scoped || w.show_id === r.showId || w.show_id == null)).map((w) => ({ ...w })));
  }
  if (/FROM episode_wardrobe ew\s+JOIN wardrobe w/.test(sql) && /SELECT w\.\*/.test(sql)) {
    return out(WARDROBE.filter((w) => LINKED.includes(w.id)).map((w) => ({ ...w })));
  }
  if (/FROM episode_wardrobe ew/.test(sql) && /w\.brand, w\.name, w\.price/.test(sql)) {
    return out(WARDROBE.filter((w) => LINKED.includes(w.id)).map((w) => ({ brand: w.brand, name: w.name, price: w.price, tier: w.tier, category: w.clothing_category })));
  }
  if (/UPDATE character_state\b[\s\S]*RETURNING coins/.test(sql)) return [[{ coins: 900 }], 1];
  if (/^\s*SELECT/i.test(sql)) return out([]);
  return [[], 0];
}

function resetModels() {
  for (const k of Object.keys(mockModels)) delete mockModels[k];
  Object.assign(mockModels, {
    Episode: { findByPk: jest.fn(async () => ({ id: EPISODE_ID, episode_number: 3, total_income: 0, total_expenses: 0 })) },
    WorldEvent: { findOne: jest.fn(async () => null) },
    Opportunity: { findByPk: jest.fn(async () => null), findOne: jest.fn(async () => null) },
    CareerGoal: { findAll: jest.fn(async () => []) },
    sequelize: { query: jest.fn(async (sql, opts) => answer(sql, opts)), QueryTypes: { SELECT: 'SELECT' } },
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/wardrobe', wardrobeRoutes);
  return app;
}

const WRITE = /^\s*(INSERT|UPDATE|DELETE|UPSERT|ALTER|CREATE|DROP|TRUNCATE)\b/i;

let scoreSpy;
beforeEach(() => {
  queries = [];
  resetModels();
  scoreSpy = jest.spyOn(wis, 'scoreOutfitForEvent');
  jest.spyOn(wis, 'getWardrobeGrowthArc').mockImplementation(async () => ({ arc_stage: 'rising' }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('POST /outfit-score/:episodeId — a draft, scored by the canonical scorer', () => {
  test('scores the draft through scoreOutfitForEvent and writes nothing', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['w-dress', 'w-heels'], event_id: 'ev-gala' });

    expect(res.status).toBe(200);
    expect(scoreSpy).toHaveBeenCalledTimes(1);
    const [items] = scoreSpy.mock.calls[0];
    expect(items.map((i) => i.id).sort()).toEqual(['w-dress', 'w-heels']);
    expect(res.body.hasOutfit).toBe(true);
    expect(res.body.score).toBe(Math.round(scoreSpy.mock.results[0].value.match_score));
    expect(res.body.items.map((i) => i.id).sort()).toEqual(['w-dress', 'w-heels']);
    // Nothing written: every statement is a read.
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.filter((q) => WRITE.test(q.sql))).toEqual([]);
    // The draft never reads episode_wardrobe — it scores what is on screen.
    expect(queries.some((q) => /episode_wardrobe/.test(q.sql))).toBe(false);
  });

  test('ids that match no wardrobe row: hasOutfit false, no invented pieces', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['nope-1', 'nope-2'], event_id: 'ev-gala' });

    expect(res.status).toBe(200);
    expect(res.body.hasOutfit).toBe(false);
    expect(res.body.score).toBe(0);
    expect(res.body.items).toEqual([]);
    expect(scoreSpy).not.toHaveBeenCalled();
  });

  test('an empty draft is not scored', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: [] });
    expect(res.status).toBe(200);
    expect(res.body.hasOutfit).toBe(false);
    expect(scoreSpy).not.toHaveBeenCalled();
  });

  test("ids from another show are excluded; show-less rows count", async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['w-dress', 'w-shared', 'w-foreign'], event_id: 'ev-gala' });

    expect(res.status).toBe(200);
    const [items] = scoreSpy.mock.calls[0];
    expect(items.map((i) => i.id).sort()).toEqual(['w-dress', 'w-shared']);
    const lookup = queries.find((q) => /FROM wardrobe w\s+WHERE w\.id IN/.test(q.sql));
    expect(lookup.opts.replacements.showId).toBe(SHOW_ID);
  });

  test('only ids from another show: hasOutfit false', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['w-foreign'] });
    expect(res.body.hasOutfit).toBe(false);
    expect(scoreSpy).not.toHaveBeenCalled();
  });

  test('the explicit event_id is the event scored', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['w-dress', 'w-heels'], event_id: 'ev-brunch' });

    expect(res.status).toBe(200);
    const [, event] = scoreSpy.mock.calls[0];
    expect(event).toMatchObject({ prestige: 3, event_type: 'brunch', dress_code: 'casual' });
    expect(res.body.event).toEqual({ id: 'ev-brunch', name: 'Sunday Brunch' });
  });

  test("an event_id outside the episode's show is refused", async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['w-dress'], event_id: 'ev-elsewhere' });
    expect(res.status).toBe(404);
    expect(scoreSpy).not.toHaveBeenCalled();
  });

  test('a malformed body is refused', async () => {
    const app = buildApp();
    expect((await request(app).post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`).send({ wardrobe_ids: 'w-dress' })).status).toBe(400);
    expect((await request(app).post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`).send({ wardrobe_ids: [42] })).status).toBe(400);
    expect(scoreSpy).not.toHaveBeenCalled();
  });
});

describe('GET /outfit-score/:episodeId — the locked outfit', () => {
  test('?event_id= is the event scored', async () => {
    const res = await request(buildApp()).get(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}?event_id=ev-brunch`);
    expect(res.status).toBe(200);
    expect(scoreSpy.mock.calls[0][1]).toMatchObject({ prestige: 3, event_type: 'brunch' });
  });

  test('without event_id, the event completion uses (highest prestige)', async () => {
    const res = await request(buildApp()).get(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`);
    expect(res.status).toBe(200);
    expect(scoreSpy.mock.calls[0][1]).toMatchObject({ prestige: 8, event_type: 'gala' });
    expect(res.body.event).toEqual({ id: 'ev-gala', name: 'Gold Gala' });
  });

  test('the draft of the locked pieces and the locked outfit get the same score', async () => {
    const app = buildApp();
    const locked = await request(app).get(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}?event_id=ev-gala`);
    const draft = await request(app).post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`).send({ wardrobe_ids: LINKED, event_id: 'ev-gala' });
    expect(draft.body.score).toBe(locked.body.score);
    expect(draft.body.confidence).toEqual(locked.body.confidence);
  });
});

describe('display and completion score with the same inputs', () => {
  test("GET's scorer call matches completion's: event, character state, arc stage", async () => {
    await completeEpisode(EPISODE_ID, SHOW_ID, mockModels.sequelize);
    expect(scoreSpy).toHaveBeenCalledTimes(1);
    const completionCall = scoreSpy.mock.calls[0];

    scoreSpy.mockClear();
    const res = await request(buildApp()).get(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`);
    expect(res.status).toBe(200);
    expect(scoreSpy).toHaveBeenCalledTimes(1);
    const displayCall = scoreSpy.mock.calls[0];

    expect(displayCall[0].map((i) => i.id)).toEqual(completionCall[0].map((i) => i.id));
    expect(displayCall[1]).toEqual(completionCall[1]);
    expect(displayCall[2]).toEqual(completionCall[2]);
    expect(displayCall[2].characterState).toMatchObject({ coins: 900, reputation: 3, stress: 1 });
    expect(displayCall[2].arcStage).toBe('rising');
  });

  test('a show with no character_state: display scores with the values completion would seed, and writes nothing', async () => {
    const { loadDisplayCharacterState, DEFAULT_LALA_STATE } = require('../../../src/services/outfitScoreContext');
    const state = await loadDisplayCharacterState(mockModels.sequelize, 'show-without-state');
    expect(state).toEqual(DEFAULT_LALA_STATE);
    expect(queries.filter((q) => WRITE.test(q.sql))).toEqual([]);
  });
});

describe("Lala's lines live with the confidence bands", () => {
  test('every band carries its lala line', () => {
    const { CONFIDENCE_LEVELS } = wardrobeRoutes;
    expect(CONFIDENCE_LEVELS.map((c) => [c.label, c.lala])).toEqual([
      ['Nervous', "I don't know about this..."],
      ['Unsure', "It's... something."],
      ['Okay', 'This could work.'],
      ['Confident', 'I feel good about this.'],
      ['Slaying', "They're not ready for me."],
    ]);
  });

  test('the score response carries it', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/wardrobe/outfit-score/${EPISODE_ID}`)
      .send({ wardrobe_ids: ['w-dress', 'w-heels'], event_id: 'ev-gala' });
    expect(typeof res.body.confidence.lala).toBe('string');
    expect(res.body.confidence.lala.length).toBeGreaterThan(0);
  });
});
