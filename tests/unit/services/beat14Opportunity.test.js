// ============================================================================
// Beat 14's opportunity in the writer (Evoni, 2026-10-19): the invitation
// someone at the event offers ends the episode, unless the episode is designed
// to fail; and a script that leaves it out is written again. No database.
// ============================================================================

const { beat14Context } = require('../../../src/services/beat14Opportunity');
const { scriptCoverage, beatRequirements } = require('../../../src/utils/scriptCoverage');

const OPP = { name: 'Sable Campaign Shoot', opportunity_type: 'campaign', brand_or_company: 'Studio by Sable', contact_name: 'Sable Reyes', connector_handle: 'sablereyes', narrative_stakes: 'Lead the spring campaign' };

describe('beat14Context', () => {
  test('the invitation arrives from the person at the event, naming it, with the answer left open', () => {
    const text = beat14Context(OPP, 'pass');
    expect(text).toContain('═══ BEAT 14 OPPORTUNITY ═══');
    expect(text).toContain('Sable Campaign Shoot, with Studio by Sable (campaign): offered by Sable Reyes (@sablereyes), who was at the event.');
    expect(text).toContain('What it is about: Lead the spring campaign');
    expect(text).toContain('[UI:DM Sable Reyes: …] or [UI:NOTIFY Sable Reyes: …]');
    expect(text).toContain('Whether Lala says yes stays open');
    expect(text).toContain('never a coin line');
  });
  test('an episode designed to fail does not deliver it; nothing attached, nothing said', () => {
    expect(beat14Context(OPP, 'fail')).toContain('the invitation does not come');
    expect(beat14Context(OPP, 'fail')).not.toContain('[UI:DM');
    expect(beat14Context(null, 'pass')).toBe('');
  });
});

describe('coverage', () => {
  const script = '## BEAT: 14 · Cliffhanger\nMe: and then her phone buzzes';
  test('a beat 14 that leaves the invitation out is a gap for beat 14', () => {
    const { missing } = scriptCoverage(script, { opportunity: { name: 'Sable Campaign Shoot', from: 'Sable Reyes' } });
    const gap = missing.find((g) => g.kind === 'opportunity');
    expect(gap).toMatchObject({ label: 'Sable Campaign Shoot', target: 14, from: 'Sable Reyes' });
    expect(beatRequirements([gap])[0]).toBe('End on the invitation from Sable Reyes, as one private message or notification that names it: "Sable Campaign Shoot".');
  });
  test('named in the script, it is covered', () => {
    const named = '## BEAT: 14 · Cliffhanger\n[UI:DM Sable Reyes: The Sable campaign shoot is yours if you want it.]';
    expect(scriptCoverage(named, { opportunity: { name: 'Sable Campaign Shoot' } }).missing.some((g) => g.kind === 'opportunity')).toBe(false);
  });
});

// After completion its status says what happened (Script page audit,
// 2026-10-19): expired never comes; offered (or after) came.
describe('beat14Context after completion', () => {
  test('expired: the invitation does not come, whatever the intent', () => {
    const text = beat14Context({ ...OPP, status: 'expired' }, 'pass');
    expect(text).toContain('This episode did not land, so the invitation does not come');
    expect(text).toContain('no other offer comes in its place');
    expect(text).not.toContain('[UI:DM');
  });
  test('offered: it came, even when the episode was designed to fail', () => {
    expect(beat14Context({ ...OPP, status: 'offered' }, 'fail')).toContain('[UI:DM Sable Reyes: …]');
  });
  test('held follows the designed intent', () => {
    expect(beat14Context({ ...OPP, status: 'held' }, 'fail')).toContain('designed not to land');
    expect(beat14Context({ ...OPP, status: 'held' }, 'pass')).toContain('Beat 14 ends on it');
  });
});

describe('loadForScript', () => {
  test('returns the attached opportunity with its status, whatever the status', async () => {
    const { loadForScript } = require('../../../src/services/beat14Opportunity');
    const row = { id: 'o1', name: 'Sable Campaign Shoot', opportunity_type: 'campaign', status: 'expired' };
    const models = { Opportunity: { findOne: jest.fn(async () => row) } };
    expect(await loadForScript(models, { episodeId: 'ep1' })).toMatchObject({ id: 'o1', status: 'expired' });
    expect(models.Opportunity.findOne).toHaveBeenCalledWith({ where: { offered_in_episode_id: 'ep1' } });
  });
});

describe('coverage: a mention outside beat 14', () => {
  test('named in beat 11 only, it is still a gap for beat 14', () => {
    const script = '## BEAT: 11 · Event Outcome\n[UI:DM Sable Reyes: The Sable campaign shoot is yours.]\n\n## BEAT: 14 · Cliffhanger\nMe: bye';
    const gap = scriptCoverage(script, { opportunity: { name: 'Sable Campaign Shoot' } }).missing.find((g) => g.kind === 'opportunity');
    expect(gap).toMatchObject({ beat: null, target: 14 });
  });
});

// Negotiating is open too (Evoni, 2026-10-19: the show tab's opportunities
// are attached from there); held stays out.
describe('open statuses: offered, considering, negotiating', () => {
  const SHOW = 'show-1';
  const EVENT = { id: 'ev1', name: 'The Gala' };
  const load = () => {
    jest.resetModules();
    jest.doMock('../../../src/services/episodeMoneyService', () => ({ findSourceEvent: async () => EVENT }));
    jest.doMock('../../../src/utils/eventAttendees', () => ({ eventAttendees: () => [7] }));
    jest.doMock('../../../src/utils/eventOrganizer', () => ({ eventCreatorOrganizer: () => ({ profileId: 7 }) }));
    return require('../../../src/services/beat14Opportunity');
  };
  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    query: async (sql) => (/FROM episodes/.test(sql) ? [{ id: 'ep1', show_id: SHOW, title: 'Ep' }] : [{ id: 7, handle: 'sable', display_name: 'Sable Reyes' }]),
    transaction: async (fn) => fn({}),
  };
  const opp = (status) => {
    const o = { id: 'o1', name: 'Velour Cover', status, status_history: [], offered_in_episode_id: null };
    o.update = jest.fn(async (u) => Object.assign(o, u));
    return o;
  };
  const models = (o) => ({ sequelize, Opportunity: { findOne: jest.fn(async ({ where }) => (where.id ? o : null)), findAll: jest.fn(async () => []) } });
  afterEach(() => jest.resetModules());

  test('a negotiating one is held for beat 14, its previous status kept', async () => {
    const { attachBeat14 } = load();
    const o = opp('negotiating');
    const out = await attachBeat14(models(o), { showId: SHOW, episodeId: 'ep1', opportunity_id: 'o1', connector_profile_id: 7 });
    expect(out.status).toBe('held');
    expect(o.status_history[o.status_history.length - 1]).toMatchObject({ status: 'held', previous_status: 'negotiating' });
  });

  test('booked or held is refused, naming the open statuses', async () => {
    const { attachBeat14 } = load();
    await expect(attachBeat14(models(opp('booked')), { showId: SHOW, episodeId: 'ep1', opportunity_id: 'o1', connector_profile_id: 7 }))
      .rejects.toMatchObject({ status: 409, message: 'Only an opportunity that is offered, considering or negotiating can be offered in beat 14; this one is booked.' });
    await expect(attachBeat14(models(opp('held')), { showId: SHOW, episodeId: 'ep1', opportunity_id: 'o1', connector_profile_id: 7 }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('the candidates are the open ones, negotiating among them', async () => {
    const { getBeat14 } = load();
    const m = models(null);
    await getBeat14(m, { showId: SHOW, episodeId: 'ep1' });
    const { Op } = require('sequelize');
    expect(m.Opportunity.findAll.mock.calls[0][0].where.status[Op.in]).toEqual(['offered', 'considering', 'negotiating']);
  });
});
