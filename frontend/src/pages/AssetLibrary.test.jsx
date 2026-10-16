/**
 * AssetLibrary — folder and orientation helpers.
 */
import { vi, describe, test, expect } from 'vitest';

vi.mock('../services/assetService', () => ({ assetService: {} }));
vi.mock('../services/showService', () => ({ default: {} }));
vi.mock('../components/Assets/AssetUploader', () => ({ default: () => null }));

import { assetCategory, orientationOf } from './AssetLibrary';

describe('assetCategory — the folder an asset lands in', () => {
  test.each([
    ['background', 'locations'],
    ['wardrobe_outfit', 'wardrobe'],
    ['wardrobe_shoes', 'wardrobe'],
    ['prop', 'props'],
    ['ui_element', 'ui'],
    ['overlay', 'overlays'],
    ['music', 'music'],
    ['sfx', 'music'],
  ])('category %s → %s', (category, folder) => {
    expect(assetCategory({ category })).toBe(folder);
  });

  test('older uploads with no category fall back to asset_type', () => {
    expect(assetCategory({ asset_type: 'BRAND_LOGO' })).toBe('branding');
    expect(assetCategory({ asset_type: 'PROMO_INTRO' })).toBe('overlays');
    expect(assetCategory({ asset_role: 'BACKGROUND.MAIN' })).toBe('locations');
    expect(assetCategory({ asset_type: 'EPISODE_FRAME' })).toBe('other');
    expect(assetCategory({})).toBe('other');
  });

  test('category wins over asset_type', () => {
    expect(assetCategory({ category: 'prop', asset_type: 'BRAND_LOGO' })).toBe('props');
  });
});

describe('orientationOf', () => {
  test('landscape, portrait, square, unknown', () => {
    expect(orientationOf({ width: 1920, height: 1080 })).toBe('landscape');
    expect(orientationOf({ width: 1080, height: 1920 })).toBe('portrait');
    expect(orientationOf({ width: 1000, height: 1020 })).toBe('square');
    expect(orientationOf({})).toBe(null);
  });
});
