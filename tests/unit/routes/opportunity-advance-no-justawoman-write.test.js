// ============================================================================
// Advancing an opportunity never touches a SocialProfile (Task #1834).
// Mocked, no database. A prestige-8 opportunity advanced to booked or
// completed must make no SocialProfile lookup or write, and still return
// success with the new status.
// ============================================================================

const express = require('express');
const request = require('supertest');

const mockOnOpportunityAdvanced = jest.fn(async () => ({ goals_completed: [], unlocks: [] }));

jest.mock('../../../src/services/careerPipelineService', () => ({
  onOpportunityAdvanced: (...args) => mockOnOpportunityAdvanced(...args),
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/opportunityRoutes');

function makeOpp(status) {
  const opp = {
    id: 'opp-1',
    show_id: 'show-1',
    status,
    prestige: 8,
    status_history: [],
    update: jest.fn(async (fields) => { Object.assign(opp, fields); return opp; }),
    toJSON: () => ({ id: opp.id, show_id: opp.show_id, status: opp.status, prestige: opp.prestige, booking_date: opp.booking_date }),
  };
  return opp;
}

const justawoman = { id: 'jaw-1', is_justawoman_record: true, current_state: 'rising', update: jest.fn(async () => {}) };

const models = {
  Opportunity: { findOne: jest.fn() },
  SocialProfile: {
    findOne: jest.fn(async () => justawoman),
    update: jest.fn(async () => [1]),
  },
};

const app = express();
app.use(express.json());
app.set('models', models);
app.use('/api/v1', router);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /opportunities/:showId/:id/advance — no SocialProfile write', () => {
  it('prestige-8 negotiating → booked: no SocialProfile lookup or write, success with new status', async () => {
    const opp = makeOpp('negotiating');
    models.Opportunity.findOne.mockResolvedValue(opp);

    const res = await request(app).post('/api/v1/opportunities/show-1/opp-1/advance').send({ to_status: 'booked' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.opportunity.status).toBe('booked');
    expect(res.body.advanced).toEqual({ from: 'negotiating', to: 'booked' });
    expect(models.SocialProfile.findOne).not.toHaveBeenCalled();
    expect(models.SocialProfile.update).not.toHaveBeenCalled();
    expect(justawoman.update).not.toHaveBeenCalled();
    expect(mockOnOpportunityAdvanced).not.toHaveBeenCalled();
  });

  it('prestige-8 active → completed: no SocialProfile lookup or write, success with new status, pipeline still runs', async () => {
    const opp = makeOpp('active');
    models.Opportunity.findOne.mockResolvedValue(opp);

    const res = await request(app).post('/api/v1/opportunities/show-1/opp-1/advance').send({ to_status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.opportunity.status).toBe('completed');
    expect(res.body.advanced).toEqual({ from: 'active', to: 'completed' });
    expect(models.SocialProfile.findOne).not.toHaveBeenCalled();
    expect(models.SocialProfile.update).not.toHaveBeenCalled();
    expect(justawoman.update).not.toHaveBeenCalled();
    expect(mockOnOpportunityAdvanced).toHaveBeenCalledWith('opp-1', 'completed', models);
  });
});
