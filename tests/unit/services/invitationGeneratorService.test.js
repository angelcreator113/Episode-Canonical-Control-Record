/**
 * invitationGeneratorService unit tests
 *
 * The invitation as a run of versions (2026-10-24): every entry point is
 * scoped to the show's live event and to that event's own versions; edits
 * and re-rolls make new pending versions and never change the source;
 * approve runs in one transaction (approved, linked, words mirrored to
 * canon_consequences.invitation_text, other versions superseded); reject
 * refuses the approved version; delete of the approved version unlinks it;
 * the print export uses the card's own words with no AI call; files shared
 * with a live version stay in S3.
 *
 * Regression coverage kept from Task #1425: generate reaches
 * compositeInvitation.
 */
jest.mock('axios');

const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: (...args) => mockS3Send(...args) })),
  PutObjectCommand: jest.fn((args) => ({ put: args })),
  DeleteObjectCommand: jest.fn((args) => ({ del: args })),
}));

let mockUuid = 0;
jest.mock('uuid', () => ({ v4: jest.fn(() => `uuid-${++mockUuid}`) }));

const mockGenerateImage = jest.fn();
const mockGenerateFromImage = jest.fn();
jest.mock('../../../src/services/imageGenerationService', () => ({
  generateImage: (...args) => mockGenerateImage(...args),
  generateImageFromImage: (...args) => mockGenerateFromImage(...args),
  estimateGenerationCost: jest.fn(() => ({ usd: 0.05, priced: true, model: 'fal-ai/flux-pro/v1.1' })),
  estimateImageFromImageCost: jest.fn(() => ({ usd: 0.04, priced: true, model: 'fal-ai/flux-pro/kontext' })),
}));

const mockComposite = jest.fn().mockResolvedValue(Buffer.from('card-png'));
const mockCompositePrint = jest.fn().mockResolvedValue(Buffer.from('print-png'));
const mockBuildContent = jest.fn();
jest.mock('../../../src/services/invitationCompositingService', () => {
  const actual = jest.requireActual('../../../src/services/invitationCompositingService');
  return {
    ...actual,
    buildInvitationContent: (...args) => mockBuildContent(...args),
    compositeInvitation: (...args) => mockComposite(...args),
    compositeInvitationPrint: (...args) => mockCompositePrint(...args),
  };
});

jest.mock('../../../src/services/episodeInvitationOverlayService', () => ({
  supersedeOtherInvitationVersions: jest.fn().mockResolvedValue(2),
  syncEpisodeInvitationOverlay: jest.fn().mockResolvedValue({ placement: { id: 'pl-1' }, anchor: 'beat' }),
}));

process.env.S3_PRIMARY_BUCKET = 'test-bucket';
process.env.AWS_REGION = 'us-east-1';

const axios = require('axios');
const overlay = require('../../../src/services/episodeInvitationOverlayService');
const svc = require('../../../src/services/invitationGeneratorService');

const SHOW = 'show-1';
const BUCKET_URL = (key) => `https://test-bucket.s3.us-east-1.amazonaws.com/${key}`;

function words(extra = {}) {
  return {
    eventName: 'Golden Hour Gala', eventSubtitle: null, opening: 'You were chosen.',
    body: 'Join us at Club Noir. We will pay you an appearance fee of 500 Prime Coins.',
    closing: 'Until then.', hostName: 'Maison Lumi', hostBrand: 'Lumi', prestige: 7,
    source: 'claude', moneyCheck: { ok: true, missing: [], invented: [] }, ...extra,
  };
}

function version(id, meta = {}, row = {}) {
  return {
    id,
    asset_type: 'INVITATION_LETTER',
    s3_url_raw: BUCKET_URL(`invitations/evt-1/${id}-bg.jpg`),
    s3_url_processed: BUCKET_URL(`invitations/evt-1/${id}.png`),
    approval_status: 'pending_review',
    deleted_at: null,
    metadata: { event_id: 'evt-1', version: 1, text: { opening: 'Old.', body: 'Old body.', closing: 'Bye.' }, ...meta },
    ...row,
  };
}

/** A fake sequelize answering the service's queries from an in-memory event and assets. */
function fakeModels({ event, assets = [] }) {
  const state = { event, assets, updates: [], transactions: 0 };
  const match = (sql, re) => re.test(sql.replace(/\s+/g, ' '));
  const query = jest.fn(async (sql, opts = {}) => {
    const r = opts.replacements || {};
    const select = opts.type === 'SELECT';
    if (match(sql, /FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL/)) {
      const rows = state.event && state.event.id === r.eventId && state.event.show_id === r.showId ? [state.event] : [];
      return [rows];
    }
    if (match(sql, /SELECT \* FROM assets WHERE id = :assetId AND asset_type = :type/)) {
      return state.assets.filter((a) => a.id === r.assetId && !a.deleted_at && a.metadata?.event_id === r.eventId);
    }
    if (match(sql, /GREATEST\(/)) return [{ next: state.assets.length + 1 }];
    if (match(sql, /SELECT COUNT\(\*\)::int AS n FROM assets/)) {
      const n = state.assets.filter((a) => a.id !== r.assetId && !a.deleted_at && (a.s3_url_processed === r.url || a.s3_url_raw === r.url)).length;
      return [{ n }];
    }
    if (match(sql, /FROM world_events e JOIN assets a ON a.id = e.invitation_asset_id/)) return state.brandRef ? [{ s3_url_raw: state.brandRef }] : [];
    if (match(sql, /FROM assets WHERE metadata->>'event_id' = :eventId AND asset_type = :type AND deleted_at IS NULL ORDER BY/)) {
      return state.assets.filter((a) => !a.deleted_at && a.metadata?.event_id === r.eventId);
    }
    if (/^\s*UPDATE/.test(sql)) {
      state.updates.push({ sql: sql.replace(/\s+/g, ' ').trim(), r, transaction: opts.transaction || null });
      const a = state.assets.find((x) => x.id === r.assetId);
      if (a && /deleted_at = NOW\(\)/.test(sql)) a.deleted_at = new Date();
      if (a && /approval_status = 'approved'/.test(sql)) a.approval_status = 'approved';
      if (/UPDATE world_events/.test(sql) && /invitation_asset_id = :assetId/.test(sql)) state.event.invitation_asset_id = r.assetId;
      if (/UPDATE world_events/.test(sql) && /invitation_asset_id = NULL/.test(sql)) state.event.invitation_asset_id = null;
      return [[], 0];
    }
    return select ? [] : [[], 0];
  });
  const sequelize = {
    query,
    QueryTypes: { SELECT: 'SELECT' },
    transaction: jest.fn(async (fn) => { state.transactions += 1; return fn({ id: `tx-${state.transactions}` }); }),
  };
  const Asset = {
    create: jest.fn(async (row) => { state.assets.push(row); return row; }),
  };
  const TimelinePlacement = { destroy: jest.fn().mockResolvedValue(1) };
  return { models: { sequelize, Asset, TimelinePlacement }, state };
}

function baseEvent(extra = {}) {
  return {
    id: 'evt-1', show_id: SHOW, name: 'Golden Hour Gala', prestige: 7, host_brand: 'Lumi',
    canon_consequences: {}, invitation_asset_id: null, used_in_episode_id: null, ...extra,
  };
}

beforeAll(() => {
  process.env.FAL_KEY = 'test-fal';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid = 0;
  axios.get.mockResolvedValue({ data: Buffer.from('image-bytes') });
  mockGenerateImage.mockResolvedValue({ url: 'https://fal.example/bg.jpg', model: 'fal-ai/flux-pro/v1.1', seed: 42 });
  mockGenerateFromImage.mockResolvedValue({ url: 'https://fal.example/bg-ref.jpg', model: 'fal-ai/flux-pro/kontext', seed: 7 });
  mockBuildContent.mockResolvedValue(words());
});

describe('generateInvitation', () => {
  it('writes once, makes one pending version per variant under the same words, and composites each (Task #1425)', async () => {
    const { models, state } = fakeModels({ event: baseEvent() });
    const out = await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1', variants: 2 });

    expect(mockBuildContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
    expect(mockComposite).toHaveBeenCalledTimes(2);
    expect(out.versions).toHaveLength(2);
    const created = state.assets;
    expect(created.map((a) => a.approval_status)).toEqual(['pending_review', 'pending_review']);
    expect(created[0].metadata.variant_group).toBeTruthy();
    expect(created[0].metadata.variant_group).toBe(created[1].metadata.variant_group);
    expect(created[0].metadata.text.body).toContain('500 Prime Coins');
    expect(created[0].metadata.text).not.toHaveProperty('source');
    expect(created[0].metadata.image_seed).toBe(42);
    // Nothing is written to the event until approval.
    expect(state.updates.filter((u) => /world_events/.test(u.sql))).toHaveLength(0);
  });

  it('takes each version number under the event row lock, inside a transaction', async () => {
    const { models } = fakeModels({ event: baseEvent() });
    await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1' });
    const lockCall = models.sequelize.query.mock.calls.find(([sql]) => /FOR UPDATE/.test(sql));
    expect(lockCall).toBeTruthy();
    expect(lockCall[1].transaction).toBeTruthy();
    expect(models.Asset.create.mock.calls[0][1].transaction).toBe(lockCall[1].transaction);
  });

  it('caps variants at three', async () => {
    const { models } = fakeModels({ event: baseEvent() });
    const out = await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1', variants: 9 });
    expect(out.versions).toHaveLength(3);
  });

  it('refuses an event from another show with a 404 and spends nothing', async () => {
    const { models } = fakeModels({ event: baseEvent({ show_id: 'other-show' }) });
    await expect(svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1' })).rejects.toMatchObject({ status: 404 });
    expect(mockBuildContent).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('applies this run\'s style to the image and records it on the version, never on the event', async () => {
    const { models, state } = fakeModels({ event: baseEvent() });
    await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1', style: { theme: 'soft glam', floral_style: 'none', bogus: 'x' } });
    const prompt = mockGenerateImage.mock.calls[0][0];
    expect(prompt).toMatch(/blush pink/);
    expect(prompt).toMatch(/no florals at all/);
    expect(state.assets[0].metadata.style).toEqual({ theme: 'soft glam', floral_style: 'none' });
    expect(state.event.theme).toBeUndefined();
  });

  it('uses the host brand\'s last approved background as a Kontext reference', async () => {
    const { models, state } = fakeModels({ event: baseEvent() });
    state.brandRef = BUCKET_URL('invitations/evt-0/ref-bg.jpg');
    await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1' });
    expect(mockGenerateFromImage).toHaveBeenCalledWith(state.brandRef, expect.stringMatching(/same house style/), expect.any(Object));
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(state.assets[0].metadata.brand_reference).toBe(true);
  });

  it('skips the brand reference when asked', async () => {
    const { models, state } = fakeModels({ event: baseEvent() });
    state.brandRef = BUCKET_URL('invitations/evt-0/ref-bg.jpg');
    await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1', useBrandStyle: false });
    expect(mockGenerateFromImage).not.toHaveBeenCalled();
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it('retries a black (flagged) background once and never keeps it', async () => {
    const { models } = fakeModels({ event: baseEvent() });
    mockGenerateImage
      .mockResolvedValueOnce({ url: 'https://fal.example/black.jpg', nsfw_flagged: true })
      .mockResolvedValueOnce({ url: 'https://fal.example/ok.jpg', seed: 1 });
    await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1' });
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenCalledWith('https://fal.example/ok.jpg', expect.any(Object));
  });

  it('answers 503 when the image provider has no key', async () => {
    const { models } = fakeModels({ event: baseEvent() });
    delete process.env.FAL_KEY;
    try {
      await expect(svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1' })).rejects.toMatchObject({ status: 503 });
    } finally {
      process.env.FAL_KEY = 'test-fal';
    }
  });

  it('reports progress steps', async () => {
    const { models } = fakeModels({ event: baseEvent() });
    const steps = [];
    await svc.generateInvitation(models, { showId: SHOW, eventId: 'evt-1', onProgress: (s) => steps.push(s) });
    expect(steps).toEqual(['writing', 'background', 'saving']);
  });
});

describe('edits and re-rolls make new versions from a source', () => {
  it('edit text saves her words on the source background as a new pending version; the source is untouched', async () => {
    const source = version('v-approved', {}, { approval_status: 'approved' });
    const { models, state } = fakeModels({ event: baseEvent({ invitation_asset_id: 'v-approved' }), assets: [source] });
    const out = await svc.editInvitationText(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v-approved', opening: 'Hi.', body: 'Come at 8. Entry is free.', closing: 'x' });

    expect(state.assets).toHaveLength(2);
    const created = state.assets[1];
    expect(created.approval_status).toBe('pending_review');
    expect(created.metadata).toMatchObject({ kind: 'edited', parent_asset_id: 'v-approved', text_source: 'edited' });
    expect(created.s3_url_raw).toBe(source.s3_url_raw);
    expect(created.metadata.text.body).toBe('Come at 8. Entry is free.');
    expect(source.s3_url_processed).toBe(BUCKET_URL('invitations/evt-1/v-approved.png'));
    expect(state.updates.filter((u) => /UPDATE assets/.test(u.sql))).toHaveLength(0);
    expect(mockBuildContent).not.toHaveBeenCalled();
    expect(out.moneyCheck).toBeTruthy();
  });

  it('edit text reports words that drop the terms\' amount', async () => {
    const source = version('v1');
    const event = baseEvent({ deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true });
    const { models } = fakeModels({ event, assets: [source] });
    const out = await svc.editInvitationText(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v1', opening: 'Hi.', body: 'Come at 8.' });
    expect(out.moneyCheck).toMatchObject({ ok: false, missing: [500] });
  });

  it('refuses a version of another event', async () => {
    const foreign = version('v-foreign', { event_id: 'evt-2' });
    const { models } = fakeModels({ event: baseEvent(), assets: [foreign] });
    await expect(svc.editInvitationText(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v-foreign', opening: 'a', body: 'b' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('re-roll text writes new words on the source background with no image call', async () => {
    const source = version('v1');
    const { models, state } = fakeModels({ event: baseEvent(), assets: [source] });
    await svc.rerollText(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v1' });
    expect(mockBuildContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(state.assets[1]).toMatchObject({ s3_url_raw: source.s3_url_raw });
    expect(state.assets[1].metadata).toMatchObject({ kind: 'text_reroll', parent_asset_id: 'v1' });
  });

  it('re-roll background keeps the source words and makes no text call', async () => {
    const source = version('v1');
    const { models, state } = fakeModels({ event: baseEvent(), assets: [source] });
    await svc.rerollBackground(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v1', variants: 2 });
    expect(mockBuildContent).not.toHaveBeenCalled();
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
    expect(state.assets.slice(1).map((a) => a.metadata.text.body)).toEqual(['Old body.', 'Old body.']);
    expect(state.assets[1].metadata.kind).toBe('background_reroll');
  });

  it('re-roll background refuses a version whose words were never saved', async () => {
    const legacy = version('v-legacy', { text: undefined });
    const { models } = fakeModels({ event: baseEvent(), assets: [legacy] });
    await expect(svc.rerollBackground(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v-legacy' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('approveInvitation', () => {
  it('approves, links, mirrors the words and supersedes the rest in one transaction', async () => {
    const v = version('v2', { text: { opening: 'New.', body: 'Body.', closing: 'Bye.' } });
    const { models, state } = fakeModels({ event: baseEvent(), assets: [v] });
    const r = await svc.approveInvitation(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v2' });

    expect(models.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(v.approval_status).toBe('approved');
    expect(state.event.invitation_asset_id).toBe('v2');
    const eventUpdate = state.updates.find((u) => /UPDATE world_events/.test(u.sql));
    expect(eventUpdate.sql).toMatch(/invitation_text/);
    expect(JSON.parse(eventUpdate.r.words)).toEqual({ opening: 'New.', body: 'Body.', closing: 'Bye.' });
    expect(state.updates.every((u) => u.transaction)).toBe(true);
    expect(overlay.supersedeOtherInvitationVersions).toHaveBeenCalledWith(models.sequelize, expect.objectContaining({ eventId: 'evt-1', assetId: 'v2', transaction: expect.anything() }));
    // No episode yet: Start Episode syncs the overlay later.
    expect(overlay.syncEpisodeInvitationOverlay).not.toHaveBeenCalled();
    expect(r).toMatchObject({ episodeId: null, superseded: 2 });
  });

  it('syncs the episode overlay after commit when the event has an episode', async () => {
    const { models } = fakeModels({ event: baseEvent({ used_in_episode_id: 'ep-9' }), assets: [version('v2')] });
    const r = await svc.approveInvitation(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v2' });
    expect(overlay.syncEpisodeInvitationOverlay).toHaveBeenCalledWith(models, { eventId: 'evt-1', episodeId: 'ep-9' });
    expect(r.placementId).toBe('pl-1');
  });

  it('refuses an asset that is not one of the event\'s versions', async () => {
    const { models, state } = fakeModels({ event: baseEvent(), assets: [version('v-x', { event_id: 'evt-2' })] });
    await expect(svc.approveInvitation(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v-x' })).rejects.toMatchObject({ status: 404 });
    expect(state.updates).toHaveLength(0);
  });

  it('refuses a missing assetId with a 400', async () => {
    const { models } = fakeModels({ event: baseEvent() });
    await expect(svc.approveInvitation(models, { showId: SHOW, eventId: 'evt-1' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('reject, delete, unlink', () => {
  it('reject refuses the approved version', async () => {
    const { models } = fakeModels({ event: baseEvent({ invitation_asset_id: 'v1' }), assets: [version('v1', {}, { approval_status: 'approved' })] });
    await expect(svc.rejectInvitation(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v1' })).rejects.toMatchObject({ status: 409 });
  });

  it('reject soft-deletes a pending version and removes its own files, keeping a background a live version shares', async () => {
    const parent = version('v1');
    const child = version('v2', { kind: 'edited' }, { s3_url_raw: parent.s3_url_raw });
    const { models } = fakeModels({ event: baseEvent(), assets: [parent, child] });
    await svc.rejectInvitation(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v2' });
    expect(child.deleted_at).toBeTruthy();
    const deleted = mockS3Send.mock.calls.map(([c]) => c.del?.Key).filter(Boolean);
    expect(deleted).toEqual(['invitations/evt-1/v2.png']);
  });

  it('deleting the approved version unlinks it from the event, its words and the episode', async () => {
    const { models, state } = fakeModels({ event: baseEvent({ invitation_asset_id: 'v1' }), assets: [version('v1', {}, { approval_status: 'approved' })] });
    const r = await svc.deleteInvitationVersion(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v1' });
    expect(r.wasCurrent).toBe(true);
    expect(state.event.invitation_asset_id).toBeNull();
    expect(state.updates.find((u) => /UPDATE world_events/.test(u.sql)).sql).toMatch(/- 'invitation_text'/);
    expect(models.TimelinePlacement.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { asset_id: 'v1' } }));
  });

  it('delete refuses a version of another event and removes nothing', async () => {
    const { models } = fakeModels({ event: baseEvent(), assets: [version('v-x', { event_id: 'evt-2' })] });
    await expect(svc.deleteInvitationVersion(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v-x' })).rejects.toMatchObject({ status: 404 });
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it('unlink is scoped to the event\'s versions', async () => {
    const { models } = fakeModels({ event: baseEvent(), assets: [version('v-x', { event_id: 'evt-2' })] });
    await expect(svc.unlinkInvitation(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v-x' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('history, text and print', () => {
  it('lists versions with current / superseded status and their words', async () => {
    const { models } = fakeModels({
      event: baseEvent({ invitation_asset_id: 'v2' }),
      assets: [version('v2', { version: 2 }, { approval_status: 'approved' }), version('v1', { superseded_by: 'v2' }, { approval_status: 'approved' })],
    });
    const list = await svc.listInvitationVersions(models, { showId: SHOW, eventId: 'evt-1' });
    expect(list.map((v) => [v.id, v.status])).toEqual([['v2', 'current'], ['v1', 'superseded']]);
    expect(list[0].text.body).toBe('Old body.');
  });

  it('reads a version\'s own words for the edit box', async () => {
    const { models } = fakeModels({ event: baseEvent(), assets: [version('v1', { text: { opening: 'Mine.', body: 'B', closing: 'C' } })] });
    expect(await svc.getInvitationText(models, { showId: SHOW, eventId: 'evt-1', assetId: 'v1' })).toMatchObject({ opening: 'Mine.' });
  });

  it('prints the approved card with its own words and no AI call', async () => {
    const { models } = fakeModels({ event: baseEvent({ invitation_asset_id: 'v1' }), assets: [version('v1', {}, { approval_status: 'approved' })] });
    const png = await svc.exportInvitationPrint(models, { showId: SHOW, eventId: 'evt-1' });
    expect(png.toString()).toBe('print-png');
    expect(mockBuildContent).not.toHaveBeenCalled();
    expect(mockCompositePrint.mock.calls[0][2]).toMatchObject({ opening: 'Old.', body: 'Old body.' });
  });

  it('returns a legacy card unchanged when its words or background were not kept', async () => {
    const legacy = version('v1', { text: undefined }, { approval_status: 'approved' });
    legacy.s3_url_raw = legacy.s3_url_processed;
    const { models } = fakeModels({ event: baseEvent({ invitation_asset_id: 'v1' }), assets: [legacy] });
    await svc.exportInvitationPrint(models, { showId: SHOW, eventId: 'evt-1' });
    expect(mockCompositePrint).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledWith(legacy.s3_url_processed, expect.any(Object));
  });
});

describe('estimateInvitation', () => {
  it('prices the variants from the rate table and shows the look, spending nothing', async () => {
    const { models } = fakeModels({ event: baseEvent({ theme: 'honey luxe', floral_style: 'roses' }) });
    const e = await svc.estimateInvitation(models, { showId: SHOW, eventId: 'evt-1', variants: 3 });
    expect(e.imagesUsd).toBeCloseTo(0.15);
    expect(e.brandReference).toBe(false);
    expect(e.direction).toMatchObject({ theme: 'honey luxe', themeSource: 'manual' });
    expect(e.direction.florals).toMatch(/roses/);
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(mockBuildContent).not.toHaveBeenCalled();
  });

  it('prices Kontext when the host brand\'s style will be used', async () => {
    const { models, state } = fakeModels({ event: baseEvent() });
    state.brandRef = BUCKET_URL('invitations/evt-0/ref-bg.jpg');
    const e = await svc.estimateInvitation(models, { showId: SHOW, eventId: 'evt-1' });
    expect(e.brandReference).toBe(true);
    expect(e.perImage.model).toBe('fal-ai/flux-pro/kontext');
  });
});

describe('cleanStyle', () => {
  it('keeps the style fields only, trims, and splits a palette string', () => {
    expect(svc.cleanStyle({ theme: ' soft glam ', color_palette: 'blush, gold ,', evil: 'x', mood: '' }))
      .toEqual({ theme: 'soft glam', color_palette: ['blush', 'gold'] });
  });
});
