'use strict';

// Task #1668 — the overlay picker (frontend/src/pages/WorldAdmin.jsx:3977,3992)
// and uiOverlayService.suggestOverlaysForEvent (:139) write the snake_case
// 'mail_panel', while world_events.required_ui_overlays' own model/migration
// default and every other producer write PascalCase 'MailPanel'. The old
// SQL match (`type_key = ANY(:keys) OR name = ANY(:keys)`) was an exact
// Postgres `=`, so whichever spelling didn't match the real
// ui_overlay_types row was silently skipped. These tests exercise the fixed
// matching logic — normalizeOverlayKey folds both spellings to the same
// value, and autoPlaceRequiredOverlays now compares normalized forms in JS
// after fetching the show's types, rather than an exact SQL equality.
const {
  autoPlaceRequiredOverlays,
  normalizeOverlayKey,
} = require('../../../src/services/timelinePlacementService');

describe('normalizeOverlayKey', () => {
  test('folds PascalCase and snake_case spellings to the same value', () => {
    expect(normalizeOverlayKey('MailPanel')).toBe('mailpanel');
    expect(normalizeOverlayKey('mail_panel')).toBe('mailpanel');
    expect(normalizeOverlayKey('MailPanel')).toBe(normalizeOverlayKey('mail_panel'));
  });

  test('is null/undefined-safe', () => {
    expect(normalizeOverlayKey(null)).toBe('');
    expect(normalizeOverlayKey(undefined)).toBe('');
  });
});

describe('autoPlaceRequiredOverlays — mail panel name mismatch (Task #1668)', () => {
  function buildModels(overlayTypeRows, { hasAsset = true, hasPlacement = true } = {}) {
    const sequelize = {
      query: jest.fn(async (sql) => {
        if (sql.includes('FROM ui_overlay_types')) return [overlayTypeRows];
        if (sql.includes('FROM assets')) return [hasAsset ? [{ id: 'asset-1' }] : []];
        // findFirstSceneId's "FROM scenes" query and anything else
        return [[]];
      }),
    };
    const TimelinePlacement = {
      findOne: jest.fn(async () => null),
      create: jest.fn(async (data) => (hasPlacement ? { id: 'placement-1', ...data } : null)),
    };
    return { sequelize, TimelinePlacement };
  }

  test('a PascalCase requiredKey matches a snake_case type_key', async () => {
    const models = buildModels([
      { id: 'type-1', type_key: 'mail_panel', name: 'Mail Panel', category: 'phone' },
    ]);
    const placed = await autoPlaceRequiredOverlays(models, {
      showId: 'show-1', episodeId: 'ep-1', requiredKeys: ['MailPanel', 'InviteLetterOverlay'],
    });
    expect(placed).toHaveLength(1);
    expect(placed[0].type_key).toBe('mail_panel');
    expect(models.TimelinePlacement.create).toHaveBeenCalledTimes(1);
  });

  test('a snake_case requiredKey matches a PascalCase name', async () => {
    const models = buildModels([
      { id: 'type-2', type_key: 'invite_letter', name: 'MailPanel', category: 'phone' },
    ]);
    const placed = await autoPlaceRequiredOverlays(models, {
      showId: 'show-1', episodeId: 'ep-1', requiredKeys: ['mail_panel'],
    });
    expect(placed).toHaveLength(1);
  });

  test('no match when no normalized key overlaps — not every type is placed', async () => {
    const models = buildModels([
      { id: 'type-3', type_key: 'wardrobe_list', name: 'Wardrobe List', category: 'phone' },
    ]);
    const placed = await autoPlaceRequiredOverlays(models, {
      showId: 'show-1', episodeId: 'ep-1', requiredKeys: ['MailPanel'],
    });
    expect(placed).toHaveLength(0);
    expect(models.TimelinePlacement.create).not.toHaveBeenCalled();
  });

  test('missing asset for a matched type is silently skipped, not an error', async () => {
    const models = buildModels(
      [{ id: 'type-1', type_key: 'mail_panel', name: 'Mail Panel', category: 'phone' }],
      { hasAsset: false }
    );
    const placed = await autoPlaceRequiredOverlays(models, {
      showId: 'show-1', episodeId: 'ep-1', requiredKeys: ['MailPanel'],
    });
    expect(placed).toHaveLength(0);
  });
});
