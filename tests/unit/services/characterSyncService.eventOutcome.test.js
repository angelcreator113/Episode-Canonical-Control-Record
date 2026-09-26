/**
 * characterSyncService — tier-based sync runs after evaluation, once per event
 * (Task #1818)
 *
 * Evoni's rulings:
 *   - the host's relevance boost moves to completion (it reflects what
 *     happened);
 *   - hosted/attended history stays at generation (the event happened
 *     regardless of score);
 *   - regeneration skips what was already applied; it never reverses.
 *
 * recordEventHistory runs at generation, applyEventOutcome and
 * generatePostEventOpportunities at completion (completeEpisode step 19).
 * Models and sequelize are mocked with a small in-memory store; no DB.
 */

let mockTier = 'slay';

jest.mock('../../../src/utils/evaluationFormula', () => {
  const actual = jest.requireActual('../../../src/utils/evaluationFormula');
  return {
    ...actual,
    evaluate: jest.fn((...args) => ({ ...actual.evaluate(...args), tier_final: mockTier })),
  };
});
jest.mock('../../../src/services/financialTransactionService', () => ({
  finalizeEpisodeFinancials: jest.fn(async () => ({
    summary: { total_income: 0, total_expenses: 0 },
    balance_before: 500,
    balance_after: 500,
    milestones_triggered: [],
    transactions: [],
  })),
  getFinancialGoals: jest.fn(async () => []),
}));
jest.mock('../../../src/routes/wardrobe', () => ({}));
jest.mock('../../../src/services/careerPipelineService', () => ({
  onEpisodeCompleted: jest.fn(async () => ({ opportunities_advanced: [] })),
  spawnGoalUnlocks: jest.fn(async () => []),
}));
const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const fs = require('fs');
const path = require('path');
const {
  recordEventHistory,
  applyEventOutcome,
  generatePostEventOpportunities,
} = require('../../../src/services/characterSyncService');
const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const SHOW_ID = 'show-1';
const EVENT_ID = 'event-1';
const HOST_ID = 7;
const GUEST_ID = 8;
const recent = () => new Date().toISOString();

// ── in-memory profile + opportunity store ──

function makeProfile(row) {
  const profile = { ...row };
  profile.update = jest.fn(async (updates) => {
    // Store what a Sequelize write would store: a detached copy.
    Object.assign(profile, JSON.parse(JSON.stringify(updates)));
    return profile;
  });
  return profile;
}

function makeStore({ host = {}, guest = {} } = {}) {
  const profiles = {
    [HOST_ID]: makeProfile({
      id: HOST_ID, handle: 'mika', current_state: 'rising', lala_relevance_score: 3, clout_score: 20,
      // One earlier hosted event, so this one is not the host's first
      // (calculateAutoState returns 'rising' for a first event whatever the tier).
      full_profile: { bio: 'kept', hosted_events: [{ event_id: 'older', date: recent() }] },
      ...host,
    }),
    [GUEST_ID]: makeProfile({
      id: GUEST_ID, handle: 'noor', current_state: 'controversial', lala_relevance_score: 2,
      full_profile: { attended_events: [{ event_id: 'older', date: recent() }] },
      ...guest,
    }),
  };
  const opportunities = [];
  const models = {
    SocialProfile: { findByPk: jest.fn(async (id) => profiles[id] || null) },
    Opportunity: {
      create: jest.fn(async (row) => { const saved = JSON.parse(JSON.stringify(row)); opportunities.push(saved); return saved; }),
    },
    sequelize: {
      QueryTypes: { SELECT: 'SELECT' },
      query: jest.fn(async (sql, opts = {}) => {
        if (/FROM opportunities/.test(sql)) {
          const [byId] = JSON.parse(opts.replacements.byEventId);
          const [byNote] = JSON.parse(opts.replacements.byNote);
          return opportunities
            .filter(o => o.show_id === opts.replacements.showId)
            .filter(o => (o.status_history || []).some(h => h.source_event_id === byId.source_event_id || h.note === byNote.note))
            .map(o => ({ id: o.id }));
        }
        return [];
      }),
    },
  };
  return { profiles, opportunities, models };
}

function makeEvent(overrides = {}) {
  return {
    id: EVENT_ID,
    show_id: SHOW_ID,
    name: 'Velour Garden Night',
    prestige: 5,
    source_profile_id: HOST_ID,
    host_brand: 'Velour',
    canon_consequences: { automation: { guest_profiles: [{ profile_id: GUEST_ID, handle: 'noor' }] } },
    ...overrides,
  };
}

const EPISODE_1 = { id: 'episode-1', episode_number: 1, evaluation_json: null };
const EPISODE_2 = { id: 'episode-2', episode_number: 1, evaluation_json: null };

beforeEach(() => {
  mockTier = 'slay';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('generation — recordEventHistory', () => {
  it('records hosted/attended history and a pending boost, but changes no relevance score and no state', async () => {
    const { profiles, models } = makeStore();
    const result = await recordEventHistory(makeEvent(), EPISODE_1, models);

    const host = profiles[HOST_ID];
    const guest = profiles[GUEST_ID];
    expect(result.updated).toBe(2);
    expect(host.full_profile.hosted_events.map(e => e.event_id)).toEqual(['older', EVENT_ID]);
    expect(host.full_profile.bio).toBe('kept');
    expect(host.full_profile.relevance_boosts[EVENT_ID]).toMatchObject({ status: 'pending', episode_id: 'episode-1' });
    expect(guest.full_profile.attended_events.map(e => e.event_id)).toEqual(['older', EVENT_ID]);

    for (const p of [host, guest]) {
      const written = Object.assign({}, ...p.update.mock.calls.map(c => c[0]));
      expect(Object.keys(written)).toEqual(['full_profile']);
    }
    expect(host.lala_relevance_score).toBe(3);
    expect(host.current_state).toBe('rising');
    expect(guest.current_state).toBe('controversial');
  });

  it('writes a new full_profile object (a JSONB mutated in place is never saved by Sequelize)', async () => {
    const { profiles, models } = makeStore();
    const before = profiles[HOST_ID].full_profile;
    await recordEventHistory(makeEvent(), EPISODE_1, models);
    const written = profiles[HOST_ID].update.mock.calls[0][0].full_profile;
    expect(before.hosted_events).toHaveLength(1);
    expect(written.hosted_events).toHaveLength(2);
  });

  it('regeneration adds no history entry and no second pending boost (no write at all)', async () => {
    const { profiles, models } = makeStore();
    await recordEventHistory(makeEvent(), EPISODE_1, models);
    profiles[HOST_ID].update.mockClear();
    profiles[GUEST_ID].update.mockClear();

    const again = await recordEventHistory(makeEvent(), EPISODE_2, models);

    expect(again).toMatchObject({ updated: 0, skipped: 2 });
    expect(profiles[HOST_ID].update).not.toHaveBeenCalled();
    expect(profiles[GUEST_ID].update).not.toHaveBeenCalled();
    expect(profiles[HOST_ID].full_profile.hosted_events.filter(e => e.event_id === EVENT_ID)).toHaveLength(1);
    expect(profiles[HOST_ID].full_profile.relevance_boosts[EVENT_ID].episode_id).toBe('episode-1');
  });

  it('an event recorded before the Task #1818 split (history, no marker) gets no pending boost', async () => {
    const { profiles, models } = makeStore({
      host: { full_profile: { hosted_events: [{ event_id: 'older', date: recent() }, { event_id: EVENT_ID, date: recent() }] } },
    });
    await recordEventHistory(makeEvent(), EPISODE_2, models);
    expect(profiles[HOST_ID].update).not.toHaveBeenCalled();
    expect(profiles[HOST_ID].full_profile.relevance_boosts).toBeUndefined();
  });
});

describe('completion — applyEventOutcome', () => {
  it("with tier_final 'slay' the host becomes peaking and gets the relevance boost once", async () => {
    const { profiles, models } = makeStore();
    await recordEventHistory(makeEvent(), EPISODE_1, models);

    const outcome = await applyEventOutcome(makeEvent(), 'slay', models);

    const host = profiles[HOST_ID];
    expect(outcome.host_boosted).toBe(true);
    expect(outcome.host_state).toEqual({ from: 'rising', to: 'peaking' });
    expect(host.current_state).toBe('peaking');
    expect(host.previous_state).toBe('rising');
    expect(host.lala_relevance_score).toBe(3.5); // + min(1, 5/10), formula unchanged
    expect(host.full_profile.relevance_boosts[EVENT_ID]).toMatchObject({ status: 'applied', tier: 'slay', boost: 0.5 });
    expect(host.full_profile.hosted_events.filter(e => e.event_id === EVENT_ID)).toHaveLength(1);
  });

  it("with tier_final 'fail' a controversial guest becomes cancelled; guests get no relevance change", async () => {
    const { profiles, models } = makeStore();
    await recordEventHistory(makeEvent(), EPISODE_1, models);

    const outcome = await applyEventOutcome(makeEvent(), 'fail', models);

    expect(outcome.guest_states).toEqual([{ profile_id: GUEST_ID, from: 'controversial', to: 'cancelled' }]);
    expect(profiles[GUEST_ID].current_state).toBe('cancelled');
    expect(profiles[GUEST_ID].lala_relevance_score).toBe(2);
  });

  it('a second completion (regenerated episode) adds no second boost, and applies the latest state', async () => {
    const { profiles, models } = makeStore();
    await recordEventHistory(makeEvent(), EPISODE_1, models);
    await applyEventOutcome(makeEvent(), 'slay', models);
    // Regenerate, then complete the new episode with a worse result.
    await recordEventHistory(makeEvent(), EPISODE_2, models);
    const second = await applyEventOutcome(makeEvent(), 'fail', models);

    const host = profiles[HOST_ID];
    expect(second.host_boosted).toBe(false);
    expect(host.lala_relevance_score).toBe(3.5);
    expect(host.full_profile.relevance_boosts[EVENT_ID].tier).toBe('slay');
    // Latest outcome: a failed hosted event, host not a drama magnet.
    expect(host.current_state).toBe('plateauing');
    expect(host.previous_state).toBe('peaking');
  });

  it('no pending marker (an event generated before the split, already boosted) → no boost at completion', async () => {
    const { profiles, models } = makeStore({
      host: { full_profile: { hosted_events: [{ event_id: 'older', date: recent() }, { event_id: EVENT_ID, date: recent() }] } },
    });
    const outcome = await applyEventOutcome(makeEvent(), 'slay', models);
    expect(outcome.host_boosted).toBe(false);
    expect(profiles[HOST_ID].lala_relevance_score).toBe(3);
    expect(profiles[HOST_ID].current_state).toBe('peaking');
  });
});

describe('completion — generatePostEventOpportunities', () => {
  it('uses the real tier and is not generated twice for the same event', async () => {
    const { opportunities, models } = makeStore();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const first = await generatePostEventOpportunities(makeEvent(), 'slay', models);
    const second = await generatePostEventOpportunities(makeEvent(), 'slay', models);

    expect(first).toHaveLength(1); // prestige 5 → one
    expect(first[0].name).toBe('Velour Campaign Shoot'); // a slay template, not safe
    expect(first[0].status_history[0]).toMatchObject({ source_event_id: EVENT_ID, note: 'From event: Velour Garden Night', tier: 'slay' });
    expect(second).toEqual([]);
    expect(opportunities).toHaveLength(1);
  });

  it('opportunities generated at generation time before the split (note only) count as already generated', async () => {
    const { opportunities, models } = makeStore();
    opportunities.push({ id: 'legacy', show_id: SHOW_ID, status_history: [{ status: 'offered', note: 'From event: Velour Garden Night' }] });
    const created = await generatePostEventOpportunities(makeEvent(), 'slay', models);
    expect(created).toEqual([]);
    expect(models.Opportunity.create).not.toHaveBeenCalled();
  });

  it('fails closed when the once-per-event check cannot run', async () => {
    const { models } = makeStore();
    models.sequelize.query = jest.fn(async () => { throw new Error('db down'); });
    const created = await generatePostEventOpportunities(makeEvent(), 'slay', models);
    expect(created).toEqual([]);
    expect(models.Opportunity.create).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      '[CharSync] Post-event opportunity check failed; not generating:', 'db down'
    );
  });

  it('a fail tier generates nothing and issues no query', async () => {
    const { models } = makeStore();
    expect(await generatePostEventOpportunities(makeEvent(), 'fail', models)).toEqual([]);
    expect(models.sequelize.query).not.toHaveBeenCalled();
  });
});

describe('completeEpisode step 19 — the completion part runs with the real tier', () => {
  // The raw world_events row completeEpisode loads in step 2.
  function makeCompletionSequelize({ episodeId, event, evaluationStatus = 'draft' }) {
    const query = jest.fn(async (sql) => {
      if (/FROM episodes WHERE id = :episodeId/.test(sql)) {
        return [{ id: episodeId, title: 'Ep', episode_number: 1, show_id: SHOW_ID, evaluation_status: evaluationStatus, evaluation_json: null }];
      }
      if (/SELECT \* FROM world_events WHERE used_in_episode_id/.test(sql)) return event ? [event] : [];
      if (/SELECT \* FROM character_state/.test(sql)) {
        return [{ id: 'state-lala', coins: 900, reputation: 3, brand_trust: 2, influence: 2, stress: 1 }];
      }
      if (/^\s*SELECT/.test(sql)) return [];
      // Task #1933: the character_state write is conditional and returns the new balance.
      if (/UPDATE character_state\b[\s\S]*RETURNING coins/.test(sql)) return [[{ coins: 500 }], 1];
      return [[], 0];
    });
    return { query, QueryTypes: { SELECT: 'SELECT' } };
  }

  function useStore(store) {
    for (const k of Object.keys(mockModels)) delete mockModels[k];
    Object.assign(mockModels, store.models);
  }

  it('slay: host peaking + boosted once, slay opportunities once; the regenerated episode completed again boosts nothing', async () => {
    const store = makeStore();
    useStore(store);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    // Canon consequences as a raw row may arrive as a string.
    const rawEvent = { ...makeEvent(), canon_consequences: JSON.stringify(makeEvent().canon_consequences) };

    await recordEventHistory(rawEvent, EPISODE_1, store.models);
    const r1 = await completeEpisode('episode-1', SHOW_ID, makeCompletionSequelize({ episodeId: 'episode-1', event: rawEvent }));

    const host = store.profiles[HOST_ID];
    expect(r1.evaluation.tier).toBe('slay');
    expect(r1.event_sync.host_boosted).toBe(true);
    expect(r1.event_sync.host_state).toEqual({ from: 'rising', to: 'peaking' });
    expect(host.current_state).toBe('peaking');
    expect(host.lala_relevance_score).toBe(3.5);
    expect(r1.event_sync.opportunities_generated).toHaveLength(1);
    expect(store.opportunities.map(o => o.status_history[0].tier)).toEqual(['slay']);

    // Regenerate (new episode id, fresh evaluation) and complete again.
    await recordEventHistory(rawEvent, EPISODE_2, store.models);
    mockTier = 'pass';
    const r2 = await completeEpisode('episode-2', SHOW_ID, makeCompletionSequelize({ episodeId: 'episode-2', event: rawEvent }));

    expect(r2.event_sync.host_boosted).toBe(false);
    expect(host.lala_relevance_score).toBe(3.5);
    expect(host.full_profile.hosted_events.filter(e => e.event_id === EVENT_ID)).toHaveLength(1);
    expect(r2.event_sync.opportunities_generated).toEqual([]);
    expect(store.opportunities).toHaveLength(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('an already-accepted episode returns early and runs no event sync', async () => {
    const store = makeStore();
    useStore(store);
    const r = await completeEpisode('episode-1', SHOW_ID, makeCompletionSequelize({ episodeId: 'episode-1', event: makeEvent(), evaluationStatus: 'accepted' }));
    expect(r.already_completed).toBe(true);
    expect(store.models.SocialProfile.findByPk).not.toHaveBeenCalled();
    expect(store.models.Opportunity.create).not.toHaveBeenCalled();
  });

  it('an event-sync failure is logged with [EpisodeCompletion] and completion still succeeds', async () => {
    const store = makeStore();
    useStore(store);
    const svc = require('../../../src/services/characterSyncService');
    jest.spyOn(svc, 'applyEventOutcome').mockRejectedValue(new Error('profiles down'));
    const r = await completeEpisode('episode-1', SHOW_ID, makeCompletionSequelize({ episodeId: 'episode-1', event: makeEvent() }));
    expect(r.episode_id).toBe('episode-1');
    expect(console.error).toHaveBeenCalledWith('[EpisodeCompletion] Event outcome sync failed (non-blocking):', 'profiles down');
  });
});

describe('episodeGeneratorService — generation records history only', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../src/services/episodeGeneratorService.js'), 'utf8');
  it('calls recordEventHistory and neither the old syncAfterEvent nor generatePostEventOpportunities', () => {
    expect(src).toMatch(/characterSync\.recordEventHistory\(event, episode, models\)/);
    expect(src).not.toMatch(/syncAfterEvent/);
    expect(src).not.toMatch(/generatePostEventOpportunities\(/);
    expect(src).not.toMatch(/applyEventOutcome\(/);
  });
});
