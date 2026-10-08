'use strict';

// P10 (Evoni, 2026-09-30; Task #2386): the approved invitation is the
// episode's invitation overlay — tagged, listed in the episode's overlays,
// placed on the invitation beat; approving a new one replaces it.
const {
  INVITATION_BEAT,
  isInvitationOverlayType,
  mergeInvitationIntoOverlayStatus,
  syncEpisodeInvitationOverlay,
  placeInvitationOnBeat,
} = require('../../../src/services/episodeInvitationOverlayService');

// These cover placing overlays on beats, off for now (Evoni, 2026-10-07:
// "none of the overlays should be beats for now"); the rule is kept for
// when it is turned back on.
const { setOverlaysOnBeats } = require('../../../src/services/episodeBeatPlacement');
beforeAll(() => setOverlaysOnBeats(true));
afterAll(() => setOverlaysOnBeats(false));

describe('invitation beat and type identity', () => {
  test('the invitation beat is the canonical beat that opens the invite letter overlay (beat 5, Reveal)', () => {
    expect(INVITATION_BEAT).toMatchObject({ number: 5, name: 'Reveal', screen_action: 'OPEN_LETTER_INVITE_OVERLAY' });
  });

  test('recognises the invitation overlay type in its spellings, and nothing else', () => {
    expect(isInvitationOverlayType('InviteLetterOverlay')).toBe(true);
    expect(isInvitationOverlayType('invite_letter')).toBe(true);
    expect(isInvitationOverlayType('custom_7', 'Invitation')).toBe(true);
    expect(isInvitationOverlayType('mail_panel', 'MailPanel')).toBe(false);
    expect(isInvitationOverlayType('event_card', 'Garden Event')).toBe(false);
  });
});

describe('mergeInvitationIntoOverlayStatus', () => {
  const invitation = { id: 'inv-2', url: 'https://x/inv2.png', overlay_type: 'InviteLetterOverlay' };
  const types = [
    { id: 'mail_panel', name: 'Mail Panel', category: 'phone', generated: true, asset_id: 'mp' },
    { id: 'invite_letter', name: 'Invite Letter', category: 'phone', generated: false, asset_id: null },
  ];

  test('fills the show\'s invitation type entry as the episode\'s own', () => {
    const out = mergeInvitationIntoOverlayStatus(types, invitation);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(types[0]);
    expect(out[1]).toMatchObject({ id: 'invite_letter', generated: true, asset_id: 'inv-2', url: 'https://x/inv2.png', is_episode_override: true, is_episode_invitation: true });
    expect(types[1].generated).toBe(false); // input untouched
  });

  test('appends its own entry when the show has no invitation type', () => {
    const out = mergeInvitationIntoOverlayStatus([types[0]], invitation);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: 'InviteLetterOverlay', category: 'phone', generated: true, asset_id: 'inv-2', lifecycle: 'per_episode', is_episode_invitation: true });
  });

  // Phone audit (Evoni, 2026-10-07): the invitation replaced the screen's
  // zones with nothing, so its Back zone vanished in the episode.
  test("keeps the show invitation screen's zones, content areas and fit", () => {
    const zoned = { ...types[1], screen_links: [{ id: 'z-back', target: 'mail_panel' }], content_zones: [{ id: 'c1' }], image_fit: { scale: 1.1 } };
    const out = mergeInvitationIntoOverlayStatus([types[0], zoned], invitation);
    expect(out[1]).toMatchObject({ url: 'https://x/inv2.png', screen_links: zoned.screen_links, content_zones: zoned.content_zones, image_fit: zoned.image_fit });
  });

  test('no invitation leaves the list as it is', () => {
    expect(mergeInvitationIntoOverlayStatus(types, null)).toBe(types);
  });
});

function buildModels({ event, beat = { id: 'plan-5', beat_number: 5, beat_name: 'Reveal' }, types = [], others = [], existingPlacement = null }) {
  const calls = [];
  const sequelize = {
    QueryTypes: { SELECT: 'SELECT' },
    query: jest.fn(async (sql, opts = {}) => {
      calls.push({ sql, replacements: opts.replacements });
      if (sql.includes('FROM world_events e')) return event ? [event] : [];
      if (sql.includes('FROM ui_overlay_types')) return [types];
      if (sql.includes('FROM scene_plans')) return [beat ? [beat] : []];
      if (sql.includes('RETURNING id')) return [others.map((id) => ({ id }))];
      if (sql.includes('SELECT id FROM assets')) return [others.map((id) => ({ id }))];
      if (sql.includes('FROM scenes')) return [[{ id: 'scene-1' }]];
      return [[]];
    }),
  };
  const created = [];
  const TimelinePlacement = {
    findOne: jest.fn(async () => existingPlacement),
    create: jest.fn(async (row) => { const p = { id: `pl-${created.length + 1}`, ...row }; created.push(p); return p; }),
    destroy: jest.fn(async () => others.length),
  };
  return { models: { sequelize, TimelinePlacement }, calls, created };
}

const approvedEvent = { id: 'ev-1', show_id: 'show-1', used_in_episode_id: 'ep-1', invitation_asset_id: 'inv-2', asset_id: 'inv-2', asset_show_id: 'show-1', approval_status: 'approved' };

describe('syncEpisodeInvitationOverlay', () => {
  test('does nothing without an approved invitation', async () => {
    const { models, calls } = buildModels({ event: { ...approvedEvent, approval_status: 'pending_review' } });
    const out = await syncEpisodeInvitationOverlay(models, { eventId: 'ev-1' });
    expect(out.tagged).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('UPDATE') || c.sql.includes('UPDATE assets'))).toBe(false);
  });

  test('does nothing before the event has an episode', async () => {
    const { models, calls } = buildModels({ event: { ...approvedEvent, used_in_episode_id: null } });
    const out = await syncEpisodeInvitationOverlay(models, { eventId: 'ev-1' });
    expect(out.tagged).toBe(false);
    expect(calls.some((c) => c.sql.includes('UPDATE assets'))).toBe(false);
  });

  test('tags the current invitation with the show\'s invitation type key and the episode', async () => {
    const { models, calls } = buildModels({ event: approvedEvent, types: [{ type_key: 'invite_letter', name: 'Invite Letter' }] });
    const out = await syncEpisodeInvitationOverlay(models, { eventId: 'ev-1', place: false });
    expect(out).toMatchObject({ tagged: true, assetId: 'inv-2', episodeId: 'ep-1', overlayType: 'invite_letter' });
    const tag = calls.find((c) => c.sql.includes("'episode_invitation', true"));
    expect(tag.replacements).toEqual({ episodeId: 'ep-1', overlayType: 'invite_letter', assetId: 'inv-2' });
    expect(models.TimelinePlacement.create).not.toHaveBeenCalled();
  });

  test('falls back to InviteLetterOverlay when the show has no invitation type', async () => {
    const { models } = buildModels({ event: approvedEvent, types: [{ type_key: 'mail_panel', name: 'Mail Panel' }] });
    const out = await syncEpisodeInvitationOverlay(models, { eventId: 'ev-1', place: false });
    expect(out.overlayType).toBe('InviteLetterOverlay');
  });

  test('replacing: other versions are untagged, their placements removed, the new one placed on the beat', async () => {
    const { models, calls, created } = buildModels({ event: approvedEvent, others: ['inv-1'] });
    const out = await syncEpisodeInvitationOverlay(models, { eventId: 'ev-1' });
    const untag = calls.find((c) => c.sql.includes("'superseded_by'") && c.sql.includes('RETURNING id'));
    expect(untag.replacements).toEqual({ eventId: 'ev-1', assetId: 'inv-2' });
    expect(out.superseded).toBe(1);
    expect(models.TimelinePlacement.destroy).toHaveBeenCalledWith({ where: { episode_id: 'ep-1', asset_id: ['inv-1'] } });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      episode_id: 'ep-1', asset_id: 'inv-2', scene_id: null, label: 'Invitation — Beat 5: Reveal',
      properties: expect.objectContaining({ kind: 'invitation', anchor: 'beat', beat_number: 5, scene_plan_id: 'plan-5' }),
    });
    expect(out.anchor).toBe('beat');
  });
});

describe('placeInvitationOnBeat', () => {
  test('moves an existing first-scene placement onto the beat instead of adding one', async () => {
    const existing = { id: 'pl-old', scene_id: 'scene-1', properties: { kind: 'invitation', source: 'approve-invitation' } };
    existing.update = jest.fn(async (patch) => Object.assign(existing, patch));
    const { models } = buildModels({ event: approvedEvent, existingPlacement: existing });
    const out = await placeInvitationOnBeat(models, { episodeId: 'ep-1', assetId: 'inv-2' });
    expect(models.TimelinePlacement.create).not.toHaveBeenCalled();
    expect(out.placement.id).toBe('pl-old');
    expect(out.placement.scene_id).toBeNull();
    expect(out.placement.properties).toMatchObject({ anchor: 'beat', beat_number: 5 });
  });

  test('an already beat-anchored placement is returned untouched (idempotent)', async () => {
    const existing = { id: 'pl-1', scene_id: null, properties: { anchor: 'beat', beat_number: 5, scene_plan_id: 'plan-5' }, update: jest.fn() };
    const { models } = buildModels({ event: approvedEvent, existingPlacement: existing });
    await placeInvitationOnBeat(models, { episodeId: 'ep-1', assetId: 'inv-2' });
    expect(existing.update).not.toHaveBeenCalled();
    expect(models.TimelinePlacement.create).not.toHaveBeenCalled();
  });

  test('no invitation beat: falls back to the first scene', async () => {
    const { models, created } = buildModels({ event: approvedEvent, beat: null });
    const out = await placeInvitationOnBeat(models, { episodeId: 'ep-1', assetId: 'inv-2' });
    expect(out.anchor).toBe('first-scene');
    expect(created[0]).toMatchObject({ scene_id: 'scene-1', properties: expect.objectContaining({ anchor: 'first-scene' }) });
  });
});

describe('overlays kept off beats (Evoni, 2026-10-07: "none of the overlays should be beats for now")', () => {
  const { isOverlaysOnBeats } = require('../../../src/services/episodeBeatPlacement');
  beforeEach(() => setOverlaysOnBeats(false));
  afterEach(() => setOverlaysOnBeats(true));

  test('off by default, so approving an invitation places it nowhere: not on its beat, not on the first scene', async () => {
    jest.isolateModules(() => {
      expect(require('../../../src/services/episodeBeatPlacement').isOverlaysOnBeats()).toBe(false);
    });
    expect(isOverlaysOnBeats()).toBe(false);
    const { models, created } = buildModels({ event: approvedEvent });
    const out = await placeInvitationOnBeat(models, { episodeId: 'ep-1', assetId: 'inv-2' });
    expect(out).toEqual({ placement: null, anchor: null, beat: null });
    expect(created).toEqual([]);
    expect(models.TimelinePlacement.create).not.toHaveBeenCalled();
  });
});
