/**
 * WorldEvent — event_date/event_time/venue_* fields (Task #1646)
 *
 * Two things are proven here, deliberately kept separate:
 *
 * 1. The model itself: event_date, event_time, venue_location_id,
 *    venue_name, and venue_address are declared attributes, with types
 *    matching the 2026-09-17 canon capture and migration 20260709 exactly
 *    (STRING(50) / STRING(50) / UUID / STRING(200) / STRING(255), all
 *    nullable) — and WorldEvent.CURRENT_ATTRIBUTES carries all five.
 *
 * 2. GET /world/:showId/events actually returns event_date in its JSON
 *    response — not just that the model "knows" the field. The mocked
 *    models.WorldEvent.findAll below only returns the keys present in
 *    whatever `attributes` array it's called with (exactly how Sequelize
 *    itself behaves), and that array is WorldEvent's own real, live
 *    CURRENT_ATTRIBUTES — not a hand-copied list in this test file. If a
 *    future edit declares a field on the model but forgets to add it to
 *    CURRENT_ATTRIBUTES (the exact "second copy" failure mode this task
 *    exists to close), this test fails on the route assertion even though
 *    part 1's model-shape assertions still pass.
 */
const path = require('path');
const { Sequelize } = require('sequelize');

function defineRealWorldEvent() {
  // No connection is ever opened — .define() is a pure in-memory operation;
  // only .authenticate()/.sync()/an actual query would touch the network.
  const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', { logging: false });
  const defineWorldEvent = require(path.join('..', '..', '..', 'src', 'models', 'WorldEvent.js'));
  return defineWorldEvent(sequelize);
}

describe('WorldEvent model — event_date/event_time/venue_* fields', () => {
  let WorldEvent;
  beforeAll(() => {
    WorldEvent = defineRealWorldEvent();
  });

  test.each([
    ['venue_location_id', 'UUID', undefined],
    ['venue_name', 'STRING', 200],
    ['venue_address', 'STRING', 255],
    ['event_date', 'STRING', 50],
    ['event_time', 'STRING', 50],
  ])('%s is declared as %s(%s), nullable', (field, typeName, length) => {
    const attr = WorldEvent.rawAttributes[field];
    expect(attr).toBeDefined();
    expect(attr.type.constructor.name).toBe(typeName);
    if (length !== undefined) expect(attr.type.options.length).toBe(length);
    expect(attr.allowNull).not.toBe(false);
  });

  test('CURRENT_ATTRIBUTES includes all five fields', () => {
    for (const field of ['venue_location_id', 'venue_name', 'venue_address', 'event_date', 'event_time']) {
      expect(WorldEvent.CURRENT_ATTRIBUTES).toContain(field);
    }
  });

  test('CURRENT_ATTRIBUTES still excludes category/format (unrelated to this task)', () => {
    expect(WorldEvent.CURRENT_ATTRIBUTES).not.toContain('category');
    expect(WorldEvent.CURRENT_ATTRIBUTES).not.toContain('format');
  });
});

describe('GET /world/:showId/events — returns event_date (Task #1646)', () => {
  let request;
  let app;
  let findAllMock;

  beforeAll(() => {
    jest.resetModules();

    jest.doMock('../../../src/middleware/auth', () => ({
      requireAuth: (req, res, next) => { req.user = { id: 'test-user' }; next(); },
    }));

    findAllMock = jest.fn(async ({ attributes }) => {
      // Simulates real Sequelize: a row only carries the keys it was asked for.
      const fullRow = {
        id: 'evt-1', show_id: 'show-1', name: 'Fashion Mystery Box', event_type: 'invite',
        event_date: '2026-10-01', event_time: '20:00',
        venue_location_id: 'loc-1', venue_name: 'The Underground', venue_address: '13 Warehouse Alley',
        category: 'fashion', format: 'gala',
        canon_consequences: {},
      };
      const scoped = {};
      for (const key of attributes) if (key in fullRow) scoped[key] = fullRow[key];
      return [{ toJSON: () => scoped }];
    });

    jest.doMock('../../../src/models', () => {
      const realWorldEvent = defineRealWorldEvent();
      return {
        WorldEvent: { CURRENT_ATTRIBUTES: realWorldEvent.CURRENT_ATTRIBUTES, findAll: findAllMock },
        sequelize: { query: jest.fn() },
      };
    });

    const express = require('express');
    request = require('supertest');
    const worldEventsRouter = require('../../../src/routes/worldEvents');
    app = express();
    app.use(express.json());
    app.use('/api/v1', worldEventsRouter);
  });

  afterAll(() => {
    jest.dontMock('../../../src/middleware/auth');
    jest.dontMock('../../../src/models');
    jest.resetModules();
  });

  test('response includes event_date (and event_time/venue fields), not just success', async () => {
    const res = await request(app).get('/api/v1/world/show-1/events');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].event_date).toBe('2026-10-01');
    expect(res.body.events[0].event_time).toBe('20:00');
    expect(res.body.events[0].venue_name).toBe('The Underground');
    expect(res.body.events[0].venue_address).toBe('13 Warehouse Alley');
    expect(res.body.events[0].venue_location_id).toBe('loc-1');
  });

  test('findAll was called with the real CURRENT_ATTRIBUTES, not a hand-picked list', () => {
    const calledAttributes = findAllMock.mock.calls[0][0].attributes;
    expect(calledAttributes).toContain('event_date');
    expect(calledAttributes).toContain('venue_name');
  });
});
