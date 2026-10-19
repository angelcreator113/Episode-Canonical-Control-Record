// ============================================================================
// Beat 14's routes (Script page audit, 2026-10-19): ids that are not UUIDs
// are a 400, and two attaches at once (the unique index on
// offered_in_episode_id) a 409, not a 500. No database.
// ============================================================================

const express = require('express');
const request = require('supertest');

const SHOW = '11111111-1111-4111-8111-111111111111';
const EP = '22222222-2222-4222-8222-222222222222';
const OPP = '33333333-3333-4333-8333-333333333333';

function app(attach) {
  jest.resetModules();
  jest.doMock('../../../src/middleware/auth', () => ({ requireAuth: (req, res, next) => next() }));
  jest.doMock('../../../src/services/beat14Opportunity', () => ({
    getBeat14: jest.fn(async () => ({ opportunity: null, people: [], candidates: [], event: null })),
    attachBeat14: attach,
    detachBeat14: jest.fn(async () => ({ opportunity: null })),
  }));
  const a = express();
  a.use(express.json());
  a.set('models', {});
  a.use('/api/v1', require('../../../src/routes/opportunityRoutes'));
  return a;
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('a non-UUID episodeId, showId or opportunity_id is a 400', async () => {
  const attach = jest.fn();
  const a = app(attach);
  expect((await request(a).get(`/api/v1/opportunities/${SHOW}/episode/not-an-id/beat14`)).status).toBe(400);
  expect((await request(a).delete(`/api/v1/opportunities/abc/episode/${EP}/beat14`)).status).toBe(400);
  const res = await request(a).put(`/api/v1/opportunities/${SHOW}/episode/${EP}/beat14`).send({ opportunity_id: '42', connector_profile_id: 1 });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('opportunity_id');
  expect(attach).not.toHaveBeenCalled();
});

test('good ids reach the service', async () => {
  const attach = jest.fn(async () => ({ id: OPP, name: 'Sable Campaign Shoot' }));
  const a = app(attach);
  expect((await request(a).get(`/api/v1/opportunities/${SHOW}/episode/${EP}/beat14`)).status).toBe(200);
  const res = await request(a).put(`/api/v1/opportunities/${SHOW}/episode/${EP}/beat14`).send({ opportunity_id: OPP, connector_profile_id: 1 });
  expect(res.status).toBe(200);
  expect(res.body.data.opportunity.id).toBe(OPP);
});

test('a concurrent attach that hits the unique index is a 409', async () => {
  const err = Object.assign(new Error('Validation error'), { name: 'SequelizeUniqueConstraintError' });
  const a = app(jest.fn(async () => { throw err; }));
  const res = await request(a).put(`/api/v1/opportunities/${SHOW}/episode/${EP}/beat14`).send({ create: { name: 'VIP', connector_profile_id: 1 } });
  expect(res.status).toBe(409);
  expect(res.body.success).toBe(false);
  expect(console.error).toHaveBeenCalled();
});
