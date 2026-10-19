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

// ============================================================================
// Beat 14 is final once completion has offered or expired it (Script page
// audit, 2026-10-19): detaching or replacing it then deleted an offered
// opportunity or rolled back an accepted one, and one attached after
// completion stayed held for good. Mocked models; no database.
// ============================================================================
jest.mock('../../../src/services/episodeMoneyService', () => ({
  findSourceEvent: jest.fn(async () => ({ id: 'ev-1', name: 'Studio Session', canon_consequences: { automation: { guest_profiles: [{ profile_id: 7 }] } } })),
}));

describe('attach and detach after completion', () => {
  const { attachBeat14, detachBeat14, Beat14Error } = require('../../../src/services/beat14Opportunity');

  const opp = (status, history = []) => ({
    id: 'opp-1', name: 'Sable Campaign Shoot', status, status_history: history,
    update: jest.fn(async function update(v) { Object.assign(this, v); return this; }),
    destroy: jest.fn(async () => {}),
  });
  const models = ({ evaluationStatus = 'draft', current = null } = {}) => ({
    sequelize: {
      QueryTypes: { SELECT: 'SELECT' },
      query: jest.fn(async (sql) => {
        if (/FROM episodes/.test(sql)) return [{ id: 'ep-1', show_id: 'show-1', title: 'The Studio', evaluation_status: evaluationStatus }];
        if (/FROM social_profiles/.test(sql)) return [{ id: 7, handle: 'sable', display_name: 'Sable Reyes' }];
        return [];
      }),
      transaction: async (fn) => fn({ id: 'tx' }),
    },
    Opportunity: {
      findOne: jest.fn(async ({ where }) => (where.offered_in_episode_id ? current : null)),
      create: jest.fn(async (row) => ({ id: 'opp-new', ...row })),
    },
  });
  const ids = { showId: 'show-1', episodeId: 'ep-1' };

  test.each(['offered', 'accepted', 'expired'])('detaching one already %s answers 409 and changes nothing', async (status) => {
    const current = opp(status, [{ status: 'held', source: 'beat14' }, { status }]);
    const m = models({ evaluationStatus: 'accepted', current });
    const err = await detachBeat14(m, ids).catch((e) => e);
    expect(err).toBeInstanceOf(Beat14Error);
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/^The episode is completed: its beat 14 opportunity was already (offered|expired)/);
    expect(current.update).not.toHaveBeenCalled();
    expect(current.destroy).not.toHaveBeenCalled();
  });

  test('replacing an offered one answers 409, even before the episode reads as completed', async () => {
    const current = opp('offered', [{ status: 'held', source: 'beat14' }, { status: 'offered' }]);
    const m = models({ current });
    const err = await attachBeat14(m, { ...ids, create: { name: 'Another', connector_profile_id: 7 } }).catch((e) => e);
    expect(err).toBeInstanceOf(Beat14Error);
    expect(err.status).toBe(409);
    expect(current.destroy).not.toHaveBeenCalled();
    expect(m.Opportunity.create).not.toHaveBeenCalled();
  });

  test('nothing is attached to a completed episode', async () => {
    const m = models({ evaluationStatus: 'accepted' });
    const err = await attachBeat14(m, { ...ids, create: { name: 'Late', connector_profile_id: 7 } }).catch((e) => e);
    expect(err).toBeInstanceOf(Beat14Error);
    expect(err.status).toBe(409);
    expect(err.message).toContain('The episode is completed');
    expect(m.Opportunity.create).not.toHaveBeenCalled();
  });

  test('while it is held, detaching and replacing work as before', async () => {
    const held = opp('held', [{ status: 'held', source: 'beat14' }]);
    await expect(detachBeat14(models({ current: held }), ids)).resolves.toEqual({ opportunity: null });
    expect(held.destroy).toHaveBeenCalled();
    const again = opp('held', [{ status: 'held', previous_status: 'considering' }]);
    const out = await attachBeat14(models({ current: again }), { ...ids, create: { name: 'New one', connector_profile_id: 7 } });
    expect(out).toMatchObject({ name: 'New one', status: 'held' });
    expect(again.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'considering', offered_in_episode_id: null }), expect.anything());
  });
});
