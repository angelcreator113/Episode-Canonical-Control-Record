// ============================================================================
// Production coverage (§8(o) item 2; episode creation step 8). Pure helper
// and the loader with mocked models; no database, no network.
// ============================================================================

const { beatRequirements, computeCoverage } = require('../../../src/utils/productionCoverage');
const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');

const beat = (n) => CANONICAL_BEATS.find((b) => b.number === n);
const allPlanned = () => CANONICAL_BEATS.map((b) => ({ beat_number: b.number }));

describe('beatRequirements', () => {
  test('§8(o) item 3: beats 1-2 need a JustAWoman clip; beat 2 also the login interface', () => {
    expect(beatRequirements(beat(1))).toEqual({ environment: 'per_episode', host: 'required', character: 'not_required', interface: 'not_required' });
    expect(beatRequirements(beat(2))).toEqual({ environment: 'per_episode', host: 'required', character: 'not_required', interface: 'required' });
  });

  test('Lala\'s World on screen needs the set; a Lala actor needs her clip; the phone or full screen needs an interface', () => {
    expect(beatRequirements(beat(6))).toEqual({ environment: 'required', host: 'not_required', character: 'required', interface: 'not_required' });
    // Beat 5 moves from Lala's Phone to Full Screen: an interface either way.
    expect(beatRequirements(beat(5)).interface).toBe('required');
    expect(beatRequirements(beat(13))).toEqual({ environment: 'not_required', host: 'not_required', character: 'not_required', interface: 'required' });
  });
});

describe('computeCoverage', () => {
  test('environment from plan readiness, interface from beat-anchored overlays, clips not tracked when unread', () => {
    const c = computeCoverage({
      planRows: allPlanned(),
      readiness: { not_ready: [{ beat_number: 4, text: 'Bedroom has no base image' }] },
      overlays: [{ beat_number: 2, label: 'Title — Beat 2' }],
    });
    const b2 = c.beats.find((b) => b.number === 2);
    expect(b2.indicators.interface).toEqual({ requirement: 'required', met: true, text: 'Title — Beat 2' });
    expect(b2.indicators.host).toEqual({ requirement: 'required', met: null, text: 'Clips could not be read' });
    expect(b2.covered).toBe(false);
    const b4 = c.beats.find((b) => b.number === 4);
    expect(b4.indicators.environment).toEqual({ requirement: 'required', met: false, text: 'Bedroom has no base image' });
    // Beat 3 asks for nothing, so it is covered.
    expect(c.beats.find((b) => b.number === 3).covered).toBe(true);
    // The first missing thing that can be checked, in beat order: beat 4's set.
    expect(c.next).toEqual({ beat_number: 4, beat_name: 'Interruption Pulse 1', indicator: 'environment', label: 'Environment', text: 'Bedroom has no base image' });
  });

  test('counts: required, met, and required-but-untracked are separate; a beat missing from the plan is unmet', () => {
    const c = computeCoverage({ planRows: [], readiness: { not_ready: [] }, overlays: [] });
    const required = c.beats.reduce((s, b) => s + Object.values(b.indicators).filter((i) => i.requirement === 'required').length, 0);
    expect(c.required).toBe(required);
    expect(c.met).toBe(0);
    expect(c.untracked).toBe(6); // JustAWoman: beats 1, 2, 5, 8; Lala: beats 6, 12
    expect(c.beats.find((b) => b.number === 4).indicators.environment.text).toBe('Not in the beat plan');
  });

  test('everything trackable met: next is null, and only the clip-bearing beats are uncovered', () => {
    const c = computeCoverage({
      planRows: allPlanned(),
      readiness: { not_ready: [] },
      overlays: CANONICAL_BEATS.map((b) => ({ beat_number: b.number, label: `O${b.number}` })),
    });
    expect(c.next).toBeNull();
    expect(c.met).toBe(c.required - c.untracked);
    expect(c.beats.filter((b) => !b.covered).map((b) => b.number)).toEqual([1, 2, 5, 6, 8, 12]);
  });
});

describe('computeCoverage with performance clips (the clip home)', () => {
  test('a clip for the beat\'s performer meets it; the wrong performer or beat does not', () => {
    const c = computeCoverage({
      planRows: allPlanned(),
      readiness: { not_ready: [] },
      overlays: [],
      clips: [
        { canonical_beat_number: 1, performer: 'justawoman', label: 'Headphones on', status: 'approved' },
        { canonical_beat_number: 6, performer: 'justawoman', label: 'Wrong performer', status: 'draft' },
        { canonical_beat_number: 12, performer: 'lala', label: null, status: 'draft' },
      ],
    });
    const at = (n) => c.beats.find((b) => b.number === n).indicators;
    expect(at(1).host).toEqual({ requirement: 'required', met: true, text: 'Headphones on · approved' });
    expect(at(6).character).toEqual({ requirement: 'required', met: false, text: 'No clip attached' });
    expect(at(12).character).toEqual({ requirement: 'required', met: true, text: 'Lala clip' });
    expect(c.untracked).toBe(0);
  });

  test('with clips read, a missing clip can be next', () => {
    const c = computeCoverage({
      planRows: allPlanned(),
      readiness: { not_ready: [] },
      overlays: CANONICAL_BEATS.map((b) => ({ beat_number: b.number, label: `O${b.number}` })),
      clips: [],
    });
    expect(c.next).toEqual({ beat_number: 1, beat_name: 'Opening Ritual', indicator: 'host', label: 'JustAWoman clip', text: 'No clip attached' });
  });
});

describe('loadCoverage', () => {
  jest.resetModules();
  jest.doMock('../../../src/services/planLocationsService', () => ({
    planWithAngles: jest.fn(async (_s, rows) => rows),
    planReadiness: jest.fn(() => ({ ready: 0, total: 0, not_ready: [] })),
  }));
  const { loadCoverage } = require('../../../src/services/productionCoverageService');

  test('reads the plan and the beat-anchored overlays for the episode only', async () => {
    const query = jest.fn(async (sql) => (/episode_performance_clips/.test(sql)
      ? [[{ canonical_beat_number: 5, performer: 'justawoman', label: 'Opens the letter', status: 'draft' }]]
      : [[{ label: 'Invitation — Beat 5: Reveal', beat_number: '5' }]]));
    const models = {
      ScenePlan: { findAll: jest.fn(async () => allPlanned().map((r) => ({ toJSON: () => r }))) },
      SceneSet: {},
      sequelize: { query },
    };
    const c = await loadCoverage(models, 'ep-1');
    expect(models.ScenePlan.findAll.mock.calls[0][0].where).toEqual({ episode_id: 'ep-1', deleted_at: null });
    expect(query.mock.calls[0][0]).toMatch(/properties->>'anchor' = 'beat'/);
    expect(query.mock.calls[0][0]).toMatch(/deleted_at IS NULL/);
    expect(query.mock.calls[0][1]).toEqual({ replacements: { episodeId: 'ep-1' } });
    expect(c.beats.find((b) => b.number === 5).indicators.interface.met).toBe(true);
    expect(c.beats.find((b) => b.number === 5).indicators.host).toMatchObject({ met: true, text: 'Opens the letter' });
  });

  test('a failed clip read is logged and leaves the clip indicators untracked', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const query = jest.fn(async (sql) => {
      if (/episode_performance_clips/.test(sql)) throw new Error('relation does not exist');
      return [[]];
    });
    const models = { ScenePlan: { findAll: jest.fn(async () => []) }, SceneSet: {}, sequelize: { query } };
    const c = await loadCoverage(models, 'ep-1');
    expect(spy).toHaveBeenCalledWith('[ProductionCoverage] clip read failed:', 'relation does not exist');
    expect(c.untracked).toBe(6);
    spy.mockRestore();
  });

  test('a failed overlay read (no timeline_placements table) is logged and leaves the interface indicator untracked', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const query = jest.fn(async (sql) => {
      if (/timeline_placements/.test(sql)) throw new Error('relation "timeline_placements" does not exist');
      return [[]];
    });
    const models = { ScenePlan: { findAll: jest.fn(async () => []) }, SceneSet: {}, sequelize: { query } };
    const c = await loadCoverage(models, 'ep-1');
    expect(spy).toHaveBeenCalledWith('[ProductionCoverage] overlay read failed:', 'relation "timeline_placements" does not exist');
    expect(c.beats.find((b) => b.number === 2).indicators.interface).toEqual({ requirement: 'required', met: null, text: 'Overlays could not be read' });
    expect(c.beats.find((b) => b.number === 6).indicators.character).toEqual({ requirement: 'required', met: false, text: 'No clip attached' });
    spy.mockRestore();
  });
});
