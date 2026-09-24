// ============================================================================
// Event deliverable routes (Task #1814, slice 1a) —
// /world/:showId/events/:eventId/deliverables[/:deliverableId].
// requireAuth on every route (the real middleware's no-header 401 path);
// writes refused with 409 once Start Episode has set used_in_episode_id;
// status is not writable (fulfilment is slice 1b). Mocked, no database.
// ============================================================================

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const SHOW = 'show-1';
const mockEvents = {};
const mockDeliverables = {};
const mockCalls = [];

jest.mock('../../../src/models', () => ({
  sequelize: {
    query: jest.fn(async (sql, opts = {}) => {
      const r = opts.replacements || {};
      mockCalls.push({ sql, replacements: r });
      if (/FROM world_events WHERE id = :eventId AND show_id = :showId/.test(sql)) {
        const ev = mockEvents[r.eventId];
        return [ev && ev.show_id === r.showId ? [ev] : []];
      }
      if (/FROM event_deliverables\s+WHERE event_id = :eventId AND deleted_at IS NULL/.test(sql)) {
        return [Object.values(mockDeliverables).filter((d) => d.event_id === r.eventId && !d.deleted_at)];
      }
      if (/^INSERT INTO event_deliverables/.test(sql)) {
        const row = {
          id: r.id, event_id: r.eventId, description: r.description, deliverable_type: r.deliverable_type,
          due_date: r.due_date, required: r.required, status: 'pending', episode_id: null, deleted_at: null,
        };
        mockDeliverables[r.id] = row;
        return [[row]];
      }
      if (/^UPDATE event_deliverables SET deleted_at = NOW\(\)/.test(sql)) {
        const d = mockDeliverables[r.deliverableId];
        if (!d || d.event_id !== r.eventId || d.deleted_at) return [[]];
        d.deleted_at = new Date();
        return [[{ id: d.id }]];
      }
      if (/^UPDATE event_deliverables SET /.test(sql)) {
        const d = mockDeliverables[r.deliverableId];
        if (!d || d.event_id !== r.eventId || d.deleted_at) return [[]];
        for (const k of ['description', 'deliverable_type', 'due_date', 'required', 'status']) {
          if (r[k] !== undefined) d[k] = r[k];
        }
        return [[{ ...d }]];
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    }),
  },
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    // A request with a header is signed in; one without goes through the
    // real requireAuth, whose no-header path answers 401 AUTH_REQUIRED.
    requireAuth: (req, res, next) => {
      if (req.headers.authorization) { req.user = { id: 'u1' }; return next(); }
      return actual.requireAuth(req, res, next);
    },
  };
});

const router = require('../../../src/routes/eventDeliverables');

const app = express();
app.use(express.json());
app.use('/api/v1', router);

const base = (eventId) => `/api/v1/world/${SHOW}/events/${eventId}/deliverables`;
const AUTH = { Authorization: 'Bearer test' };
const writes = () => mockCalls.filter((c) => /^(INSERT|UPDATE) /.test(c.sql));

beforeEach(() => {
  mockCalls.length = 0;
  for (const k of Object.keys(mockEvents)) delete mockEvents[k];
  for (const k of Object.keys(mockDeliverables)) delete mockDeliverables[k];
  mockEvents['ev-open'] = { id: 'ev-open', show_id: SHOW, used_in_episode_id: null };
  mockEvents['ev-used'] = { id: 'ev-used', show_id: SHOW, used_in_episode_id: 'ep-1' };
  mockDeliverables.d1 = { id: 'd1', event_id: 'ev-open', description: 'Tagged post', deliverable_type: 'post', due_date: null, required: true, status: 'pending', episode_id: null, deleted_at: null };
  mockDeliverables.d2 = { id: 'd2', event_id: 'ev-used', description: 'Story', deliverable_type: null, due_date: null, required: true, status: 'pending', episode_id: 'ep-1', deleted_at: null };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('auth', () => {
  test('every route in the file uses requireAuth', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'eventDeliverables.js'), 'utf8');
    const routes = src.match(/router\.(get|post|put|patch|delete)\([^\n]*/g) || [];
    expect(routes).toHaveLength(4);
    routes.forEach((line) => expect(line).toMatch(/requireAuth/));
  });

  test.each([
    ['get', base('ev-open')],
    ['post', base('ev-open')],
    ['put', `${base('ev-open')}/d1`],
    ['delete', `${base('ev-open')}/d1`],
  ])('%s without a token is 401 and touches nothing', async (method, url) => {
    const res = await request(app)[method](url).send({ description: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(mockCalls).toHaveLength(0);
  });
});

describe('GET', () => {
  test('lists the event\'s live deliverables and whether they are locked', async () => {
    const res = await request(app).get(base('ev-open')).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.deliverables.map((d) => d.id)).toEqual(['d1']);
    expect(res.body.locked).toBe(false);
    const used = await request(app).get(base('ev-used')).set(AUTH);
    expect(used.body.locked).toBe(true);
  });

  test('404 for an event of another show or none', async () => {
    const res = await request(app).get(`/api/v1/world/other-show/events/ev-open/deliverables`).set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('POST', () => {
  test('adds a pending deliverable', async () => {
    const res = await request(app).post(base('ev-open')).set(AUTH)
      .send({ description: '  Walk the show ', deliverable_type: 'appearance', due_date: '2026-11-07', required: false, status: 'approved' });
    expect(res.status).toBe(201);
    expect(res.body.deliverable).toMatchObject({
      event_id: 'ev-open', description: 'Walk the show', deliverable_type: 'appearance',
      due_date: '2026-11-07', required: false, status: 'pending',
    });
    // status is not writable: the INSERT hard-codes 'pending'.
    const insert = mockCalls.find((c) => /^INSERT INTO event_deliverables/.test(c.sql));
    expect(insert.sql).toMatch(/'pending'/);
    expect(insert.replacements).not.toHaveProperty('status');
  });

  test('a description is required', async () => {
    const res = await request(app).post(base('ev-open')).set(AUTH).send({ description: '   ' });
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  test('locked after Start Episode: 409, nothing written', async () => {
    const res = await request(app).post(base('ev-used')).set(AUTH).send({ description: 'Late add' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'EVENT_TERMS_LOCKED', used_in_episode_id: 'ep-1' });
    expect(writes()).toHaveLength(0);
  });
});

describe('PUT', () => {
  test('edits description, type, due date and required', async () => {
    const res = await request(app).put(`${base('ev-open')}/d1`).set(AUTH)
      .send({ description: 'Two tagged posts', deliverable_type: null, due_date: '2026-12-01', required: false });
    expect(res.status).toBe(200);
    expect(res.body.deliverable).toMatchObject({ description: 'Two tagged posts', deliverable_type: null, due_date: '2026-12-01', required: false, status: 'pending' });
  });

  test('status is not an editable field', async () => {
    const res = await request(app).put(`${base('ev-open')}/d1`).set(AUTH).send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(writes()).toHaveLength(0);
    expect(mockDeliverables.d1.status).toBe('pending');
  });

  test('locked after Start Episode: 409, nothing written', async () => {
    const res = await request(app).put(`${base('ev-used')}/d2`).set(AUTH).send({ description: 'Changed' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    expect(writes()).toHaveLength(0);
    expect(mockDeliverables.d2.description).toBe('Story');
  });

  test('a deliverable of another event is 404', async () => {
    const res = await request(app).put(`${base('ev-open')}/d2`).set(AUTH).send({ description: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE', () => {
  test('soft-deletes', async () => {
    const res = await request(app).delete(`${base('ev-open')}/d1`).set(AUTH);
    expect(res.status).toBe(200);
    expect(mockDeliverables.d1.deleted_at).toBeInstanceOf(Date);
    const list = await request(app).get(base('ev-open')).set(AUTH);
    expect(list.body.deliverables).toEqual([]);
  });

  test('locked after Start Episode: 409, nothing written', async () => {
    const res = await request(app).delete(`${base('ev-used')}/d2`).set(AUTH);
    expect(res.status).toBe(409);
    expect(writes()).toHaveLength(0);
    expect(mockDeliverables.d2.deleted_at).toBeNull();
  });
});
