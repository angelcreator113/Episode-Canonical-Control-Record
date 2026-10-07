// ============================================================================
// PhoneMission and PhonePlaythroughState on the models export (#1720)
// ============================================================================
// Both were registered with Sequelize but missing from src/models/index.js's
// export, so every models.PhoneMission / models.PhonePlaythroughState read in
// the routes was undefined. These tests load the real models module (no query
// runs at load) and spy on the model methods, so they exercise the export
// itself, not a mock of it. No database.

const express = require('express');
const request = require('supertest');

jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      if (req.headers['x-test-auth'] === undefined) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'u1', groups: ['editor'] };
      next();
    },
  };
});

const db = require('../../../src/models');
const missionRoutes = require('../../../src/routes/phoneMissionRoutes');
const playthroughRoutes = require('../../../src/routes/phonePlaythroughRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/ui-overlays/:showId/missions', missionRoutes);
app.use('/api/v1/episodes/:episodeId/phone-state', playthroughRoutes);

const SHOW = 'show-1';
const EP = 'ep-1';
const MISSIONS = `/api/v1/ui-overlays/${SHOW}/missions`;
const as = (r) => r.set('x-test-auth', '1');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the export', () => {
  test.each(['PhoneMission', 'PhonePlaythroughState'])('%s is on the export and is the registered model', (name) => {
    expect(typeof db[name]).toBe('function');
    expect(db[name]).toBe(db.sequelize.models[name]);
  });
});

describe('mission create, edit and delete reach PhoneMission instead of throwing', () => {
  test('POST creates through PhoneMission.create', async () => {
    const create = jest.spyOn(db.PhoneMission, 'create').mockResolvedValue({ id: 'm1', name: 'Find the key' });
    const res = await as(request(app).post(MISSIONS)).send({ name: 'Find the key', episode_id: EP });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, mission: { id: 'm1', name: 'Find the key' } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Find the key', show_id: SHOW, episode_id: EP }));
  });

  // Missions belong to an episode (Evoni, 2026-10-07, Lala's Phone step 2).
  test('POST without an episode is refused', async () => {
    const create = jest.spyOn(db.PhoneMission, 'create');
    const res = await as(request(app).post(MISSIONS)).send({ name: 'Follow Lala' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('A mission belongs to an episode: episode_id is required.');
    expect(create).not.toHaveBeenCalled();
  });

  test("PUT can't make an episode's mission show-wide, but can move an older show-wide one to an episode", async () => {
    const scoped = { id: 'm1', episode_id: EP, update: jest.fn(async () => {}) };
    jest.spyOn(db.PhoneMission, 'findOne').mockResolvedValueOnce(scoped);
    const refused = await as(request(app).put(`${MISSIONS}/m1`)).send({ name: 'X', episode_id: null });
    expect(refused.status).toBe(400);
    expect(scoped.update).not.toHaveBeenCalled();

    const older = { id: 'm2', episode_id: null, update: jest.fn(async () => {}) };
    jest.spyOn(db.PhoneMission, 'findOne').mockResolvedValueOnce(older);
    const moved = await as(request(app).put(`${MISSIONS}/m2`)).send({ name: 'Y', episode_id: EP });
    expect(moved.status).toBe(200);
    expect(older.update).toHaveBeenCalledWith(expect.objectContaining({ episode_id: EP }));
  });

  test('PUT finds and updates through PhoneMission.findOne', async () => {
    const mission = { id: 'm1', update: jest.fn(async () => {}) };
    const findOne = jest.spyOn(db.PhoneMission, 'findOne').mockResolvedValue(mission);
    const res = await as(request(app).put(`${MISSIONS}/m1`)).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'm1', show_id: SHOW, deleted_at: null } });
    expect(mission.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }));
  });

  test('DELETE finds and soft-deletes through PhoneMission.findOne', async () => {
    const mission = { id: 'm1', destroy: jest.fn(async () => {}) };
    jest.spyOn(db.PhoneMission, 'findOne').mockResolvedValue(mission);
    const res = await as(request(app).delete(`${MISSIONS}/m1`));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mission.destroy).toHaveBeenCalled();
  });

  test('GET no longer returns the fail-soft empty list: it reads PhoneMission.findAll', async () => {
    const rows = [{ id: 'm1', name: 'Find the key' }];
    const findAll = jest.spyOn(db.PhoneMission, 'findAll').mockResolvedValue(rows);
    const res = await as(request(app).get(MISSIONS));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, missions: rows });
    expect(findAll).toHaveBeenCalled();
  });
});

describe('the playthrough no longer takes the not-available branch', () => {
  test('GET phone-state loads the state row instead of answering 404 "not yet available"', async () => {
    jest.spyOn(db.sequelize, 'query').mockResolvedValue([[{ id: EP, show_id: SHOW }]]);
    const findOne = jest.spyOn(db.PhonePlaythroughState, 'findOne').mockResolvedValue({
      id: 's1', user_id: 'u1', episode_id: EP, show_id: SHOW, state_flags: { met_lala: true }, visited_screens: ['home'],
    });
    const res = await as(request(app).get(`/api/v1/episodes/${EP}/phone-state`));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.state).toMatchObject({ id: 's1', state_flags: { met_lala: true }, visited_screens: ['home'] });
    expect(JSON.stringify(res.body)).not.toMatch(/not yet available/);
    expect(findOne).toHaveBeenCalledWith({ where: { user_id: 'u1', episode_id: EP, deleted_at: null } });
  });

  test('a first visit creates the state row', async () => {
    jest.spyOn(db.sequelize, 'query').mockResolvedValue([[{ id: EP, show_id: SHOW }]]);
    jest.spyOn(db.PhonePlaythroughState, 'findOne').mockResolvedValue(null);
    const create = jest.spyOn(db.PhonePlaythroughState, 'create').mockResolvedValue({ id: 's2', user_id: 'u1', episode_id: EP, show_id: SHOW });
    const res = await as(request(app).get(`/api/v1/episodes/${EP}/phone-state`));
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', episode_id: EP, show_id: SHOW }));
  });

  // Back, Home and icon taps change screens without /tap; PUT /screen saves
  // them so a reopened play-through resumes there (Evoni, 2026-10-07).
  test('PUT /screen saves the screen the player is on, once in visited', async () => {
    jest.spyOn(db.sequelize, 'query').mockResolvedValue([[{ id: EP, show_id: SHOW }]]);
    const row = { id: 's1', user_id: 'u1', episode_id: EP, show_id: SHOW, state_flags: {}, visited_screens: ['home'], save: jest.fn(async () => {}) };
    jest.spyOn(db.PhonePlaythroughState, 'findOne').mockResolvedValue(row);
    const res = await as(request(app).put(`/api/v1/episodes/${EP}/phone-state/screen`)).send({ screen_id: 'chat' });
    expect(res.status).toBe(200);
    expect(row.last_screen_id).toBe('chat');
    expect(row.visited_screens).toEqual(['home', 'chat']);
    expect(row.save).toHaveBeenCalled();
    const again = await as(request(app).put(`/api/v1/episodes/${EP}/phone-state/screen`)).send({ screen_id: 'home' });
    expect(again.status).toBe(200);
    expect(row.visited_screens).toEqual(['home', 'chat']);
    const bad = await as(request(app).put(`/api/v1/episodes/${EP}/phone-state/screen`)).send({});
    expect(bad.status).toBe(400);
  });
});
