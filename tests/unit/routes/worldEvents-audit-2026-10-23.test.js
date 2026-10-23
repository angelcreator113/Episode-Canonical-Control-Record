// ============================================================================
// World events server audit fixes (2026-10-23). Mocked, no database.
//   - outfit GET/PUT and wardrobe-options are scoped to the show (404 for
//     another show's event; the wardrobe lookup is limited to the show)
//   - generate-script refuses another show's episode (404)
//   - the event PUT: 404 for an event not in the show; enum, range and
//     reference checks (400); terms lock checked inside the locked write;
//     a failed core-only retry is a 500
//   - generate-episode's 500 carries no stack; DELETE never hard-deletes
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';
const OTHER = 'show-2';
const EP_SAME = '11111111-1111-4111-8111-111111111111';
const EP_OTHER = '22222222-2222-4222-8222-222222222222';
const EV_PARENT = '33333333-3333-4333-8333-333333333333';

const mockEvents = {};
const mockEpisodes = {};
const mockBriefs = {};
const mockCalls = [];
let mockFail = {};

function mockRowFor(r) {
  const ev = mockEvents[r.eventId];
  if (!ev || ev.deleted_at) return null;
  if (r.showId !== undefined && ev.show_id !== r.showId) return null;
  return ev;
}

const mockQuery = jest.fn(async (sql, opts = {}) => {
  const r = opts.replacements || {};
  mockCalls.push({ sql, replacements: r, transaction: opts.transaction || null });
  if (mockFail.update?.length && /^UPDATE world_events SET /.test(sql)) throw new Error(mockFail.update.shift());
  if (mockFail.softDelete && /^UPDATE world_events SET deleted_at/.test(sql)) throw new Error('soft delete failed');
  // The PUT's row lock and every other scoped read of one event.
  if (/FROM world_events WHERE id = :eventId AND show_id = :showId/.test(sql)) {
    const ev = mockRowFor(r);
    return [ev ? [{ ...ev }] : []];
  }
  // References: an episode / event / arc in this show, or a location / profile.
  if (/^SELECT id FROM (episodes|world_events|show_arcs) WHERE id = :id AND show_id = :showId AND deleted_at IS NULL/.test(sql)) {
    const table = sql.match(/FROM (\w+)/)[1];
    const source = table === 'episodes' ? mockEpisodes : table === 'world_events' ? mockEvents : {};
    const row = source[r.id];
    return [row && row.show_id === r.showId && !row.deleted_at ? [{ id: row.id }] : []];
  }
  if (/^SELECT id FROM (world_locations|social_profiles) WHERE id = :id AND deleted_at IS NULL/.test(sql)) return [[]];
  // The terms lock (findTermsLockEpisode / findLiveLinkedEpisode / readTermsReopen).
  if (/FROM episode_briefs b\s+JOIN episodes e/.test(sql)) {
    const epId = mockBriefs[r.eventId];
    return [epId && mockEpisodes[epId] ? [mockEpisodes[epId]] : []];
  }
  if (/^SELECT used_in_episode_id FROM world_events WHERE id = :eventId/.test(sql)) {
    const ev = mockEvents[r.eventId];
    return [[{ used_in_episode_id: ev?.used_in_episode_id || null }]];
  }
  if (/FROM episodes WHERE id = :episodeId AND deleted_at IS NULL/.test(sql)) {
    const ep = mockEpisodes[r.episodeId];
    return [ep && !ep.deleted_at ? [ep] : []];
  }
  if (/^SELECT canon_consequences FROM world_events WHERE id = :eventId AND deleted_at IS NULL/.test(sql)) return [[{ canon_consequences: {} }]];
  if (/^UPDATE world_events SET /.test(sql)) {
    const ev = mockRowFor(r);
    if (ev) for (const [k, v] of Object.entries(r)) if (!['eventId', 'showId'].includes(k)) ev[k] = v;
    return [ev ? [{ id: ev.id }] : [], ev ? 1 : 0];
  }
  if (/FROM wardrobe WHERE id IN/.test(sql)) return [[]];
  return [[]];
});

const mockEpisodeUpdate = jest.fn(async () => {});
jest.mock('../../../src/models', () => ({
  sequelize: {
    query: (...a) => mockQuery(...a),
    transaction: jest.fn(async (fn) => fn({ id: 'tx' })),
  },
  SceneSet: { findByPk: jest.fn() },
  Episode: {
    findByPk: jest.fn(async (id) => {
      const ep = mockEpisodes[id];
      return ep ? { ...ep, script_content: '', update: mockEpisodeUpdate } : null;
    }),
  },
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({ aiRateLimiter: (_req, _res, next) => next() }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
jest.mock('../../../src/services/episodeGeneratorService', () => ({
  loadFinancialWardrobeItems: jest.fn(async () => []),
  generateEpisodeFromEvent: jest.fn(async () => { throw new Error('generator exploded'); }),
}));

const router = require('../../../src/routes/worldEvents');
const models = require('../../../src/models');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const put = (body, eventId = 'ev-1', showId = SHOW) => request(app).put(`/api/v1/world/${showId}/events/${eventId}`).send(body);
const updates = () => mockCalls.filter((c) => /^UPDATE world_events SET /.test(c.sql));

beforeEach(() => {
  mockCalls.length = 0;
  mockFail = {};
  for (const o of [mockEvents, mockEpisodes, mockBriefs]) for (const k of Object.keys(o)) delete o[k];
  mockEvents['ev-1'] = { id: 'ev-1', show_id: SHOW, name: 'Gala', status: 'draft', used_in_episode_id: null, canon_consequences: {}, scene_set_id: null };
  mockEvents['ev-other'] = { id: 'ev-other', show_id: OTHER, name: 'Elsewhere', status: 'draft', used_in_episode_id: null, canon_consequences: {} };
  mockEvents[EV_PARENT] = { id: EV_PARENT, show_id: SHOW, name: 'Opening', status: 'draft' };
  mockEpisodes[EP_SAME] = { id: EP_SAME, show_id: SHOW, title: 'Gala Night', episode_number: 3, deleted_at: null };
  mockEpisodes[EP_OTHER] = { id: EP_OTHER, show_id: OTHER, title: 'Other Show', episode_number: 1, deleted_at: null };
  mockEpisodeUpdate.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('outfit routes are scoped to the show', () => {
  test('PUT outfit: another show\'s event is 404 and nothing is written', async () => {
    const res = await request(app).put(`/api/v1/world/${SHOW}/events/ev-other/outfit`).send({ wardrobe_ids: [] });
    expect(res.status).toBe(404);
    expect(updates()).toHaveLength(0);
  });

  test('GET outfit and wardrobe-options: another show\'s event is 404', async () => {
    expect((await request(app).get(`/api/v1/world/${SHOW}/events/ev-other/outfit`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/world/${SHOW}/events/ev-other/wardrobe-options`)).status).toBe(404);
  });

  test('PUT outfit reads the pieces this show can wear, and writes only this show\'s live event', async () => {
    await request(app).put(`/api/v1/world/${SHOW}/events/ev-1/outfit`).send({ wardrobe_ids: ['w-1'] });
    const pieces = mockCalls.find((c) => /FROM wardrobe WHERE id IN/.test(c.sql));
    expect(pieces.sql).toMatch(/\(show_id = :showId OR show_id IS NULL\)/);
    expect(pieces.replacements.showId).toBe(SHOW);
    const write = updates().find((c) => /outfit_pieces = :pieces/.test(c.sql));
    expect(write.sql).toMatch(/WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL/);
  });
});

describe('generate-script', () => {
  test('another show\'s episode is 404 and never written', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-1/generate-script`).send({ episode_id: EP_OTHER });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockEpisodeUpdate).not.toHaveBeenCalled();
  });

  test('this show\'s episode is written', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-1/generate-script`).send({ episode_id: EP_SAME });
    expect(res.status).toBe(200);
    expect(mockEpisodeUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('PUT /world/:showId/events/:eventId', () => {
  test('an event not in this show is 404 and nothing is written', async () => {
    const res = await put({ name: 'Taken' }, 'ev-other');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Event not found' });
    expect(updates()).toHaveLength(0);
    expect(mockEvents['ev-other'].name).toBe('Elsewhere');
  });

  test('a soft-deleted event is 404', async () => {
    mockEvents['ev-1'].deleted_at = new Date();
    expect((await put({ name: 'Ghost' })).status).toBe(404);
    expect(updates()).toHaveLength(0);
  });

  test('the write is in one transaction with the row locked, scoped to the show and live rows', async () => {
    const res = await put({ name: 'Gala Night' });
    expect(res.status).toBe(200);
    const lock = mockCalls.find((c) => /FOR UPDATE$/.test(c.sql));
    expect(lock.sql).toMatch(/WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE$/);
    expect(lock.transaction).toEqual({ id: 'tx' });
    expect(updates()[0].transaction).toEqual({ id: 'tx' });
    expect(updates()[0].sql).toMatch(/WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL$/);
  });

  test.each([
    [{ category: 'karaoke' }, 'category'],
    [{ format: 'rave' }, 'format'],
    [{ status: 'published' }, 'status'],
    [{ status: null }, 'status'],
    [{ prestige: 11 }, 'prestige'],
    [{ prestige: 0 }, 'prestige'],
    [{ strictness: 12 }, 'strictness'],
    [{ cost_coins: -5 }, 'cost_coins'],
    [{ payment_amount: -1 }, 'payment_amount'],
    [{ deadline_minutes: -10 }, 'deadline_minutes'],
    [{ chain_position: 1.5 }, 'chain_position'],
    [{ chain_position: 'two' }, 'chain_position'],
    [{ prestige: 'high' }, 'prestige'],
  ])('%j is a 400 naming %s, and nothing is written', async (body, field) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(`Invalid value for ${field}`);
    expect(updates()).toHaveLength(0);
  });

  test('an enum 400 lists the allowed values', async () => {
    const res = await put({ format: 'rave' });
    expect(res.body.allowed).toEqual(expect.arrayContaining(['gala', 'brunch']));
  });

  test('valid values save', async () => {
    const res = await put({ category: 'fashion', format: 'gala', status: 'ready', prestige: 10, strictness: 1, cost_coins: 0, chain_position: 2 });
    expect(res.status).toBe(200);
    expect(updates()).toHaveLength(1);
  });

  test('used_in_episode_id naming another show\'s episode is a 400', async () => {
    const res = await put({ used_in_episode_id: EP_OTHER });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'Invalid value for used_in_episode_id', code: 'INVALID_EVENT_REFERENCE' });
    expect(updates()).toHaveLength(0);
  });

  test('used_in_episode_id naming no episode, or not a UUID, is a 400', async () => {
    expect((await put({ used_in_episode_id: '44444444-4444-4444-8444-444444444444' })).status).toBe(400);
    expect((await put({ used_in_episode_id: 'ep-1' })).status).toBe(400);
    expect(updates()).toHaveLength(0);
  });

  test('the Episode page\'s link and unlink (used_in_episode_id) keep working', async () => {
    const link = await put({ used_in_episode_id: EP_SAME });
    expect(link.status).toBe(200);
    expect(mockEvents['ev-1'].used_in_episode_id).toBe(EP_SAME);
    // Unlinking a link to a deleted episode (the terms lock, unchanged,
    // still refuses moving an event off a live episode).
    mockEpisodes[EP_SAME].deleted_at = new Date();
    const unlink = await put({ used_in_episode_id: null });
    expect(unlink.status).toBe(200);
    expect(mockEvents['ev-1'].used_in_episode_id).toBeNull();
  });

  test('status \'used\' without an episode link is a 400', async () => {
    const res = await put({ status: 'used' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid value for status');
    expect(updates()).toHaveLength(0);
  });

  test('status \'used\' with a link sent in the same save is accepted', async () => {
    expect((await put({ status: 'used', used_in_episode_id: EP_SAME })).status).toBe(200);
  });

  test('parent_event_id must be a live event of this show, not the event itself', async () => {
    expect((await put({ parent_event_id: EV_PARENT })).status).toBe(200);
    mockEvents['ev-1'].parent_event_id = null;
    const other = await put({ parent_event_id: '55555555-5555-4555-8555-555555555555' });
    expect(other.status).toBe(400);
    expect(other.body.error).toBe('Invalid value for parent_event_id');
  });

  test('venue_location_id naming no location is a 400', async () => {
    const res = await put({ venue_location_id: '66666666-6666-4666-8666-666666666666' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid value for venue_location_id');
  });

  test('a locked term change is refused inside the locked transaction (409)', async () => {
    mockEvents['ev-1'].used_in_episode_id = EP_SAME;
    mockEvents['ev-1'].payment_amount = 100;
    const res = await put({ payment_amount: 500 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    expect(updates()).toHaveLength(0);
    const lockIdx = mockCalls.findIndex((c) => /FOR UPDATE$/.test(c.sql));
    const briefIdx = mockCalls.findIndex((c) => /FROM episode_briefs b/.test(c.sql));
    expect(lockIdx).toBeGreaterThanOrEqual(0);
    expect(briefIdx).toBeGreaterThan(lockIdx);
    expect(mockCalls[briefIdx].transaction).toEqual({ id: 'tx' });
  });

  test('a failed core-only retry is a 500, not a success', async () => {
    mockFail.update = ['column "theme" of relation "world_events" does not exist', 'connection reset'];
    const res = await put({ name: 'Gala Night', theme: 'noir' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/could not be saved/);
    expect(console.error).toHaveBeenCalledWith('[WorldEvents] Core-only retry also failed:', 'connection reset');
  });

  test('a core-only retry that succeeds reports the dropped field as a warning', async () => {
    mockFail.update = ['column "theme" of relation "world_events" does not exist'];
    const res = await put({ name: 'Gala Night', theme: 'noir' });
    expect(res.status).toBe(200);
    expect(res.body.warnings).toEqual([expect.stringMatching(/theme/)]);
  });
});

describe('generate-episode and DELETE', () => {
  test('a generate-episode 500 carries no stack', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-1/generate-episode`).send({});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'generator exploded' });
    expect(res.body).not.toHaveProperty('stack');
  });

  test('generate-episode reads only this show\'s live event (no unscoped fallback)', async () => {
    const res = await request(app).post(`/api/v1/world/${SHOW}/events/ev-other/generate-episode`).send({});
    expect(res.status).toBe(404);
    const read = mockCalls.find((c) => /FROM world_events WHERE id = :eventId/.test(c.sql));
    expect(read.sql).toMatch(/AND show_id = :showId AND deleted_at IS NULL/);
  });

  test('DELETE: a failed soft delete is a 500 and never a hard DELETE', async () => {
    mockFail.softDelete = true;
    const res = await request(app).delete(`/api/v1/world/${SHOW}/events/ev-1`);
    expect(res.status).toBe(500);
    expect(mockCalls.some((c) => /^DELETE FROM world_events/.test(c.sql))).toBe(false);
  });
});

test('the models mock is the one the router uses', () => {
  expect(models.sequelize.transaction).toBeDefined();
});
