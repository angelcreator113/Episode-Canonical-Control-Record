import { describe, test, expect } from 'vitest';
import { overlayAssetIds, episodesUsing, usageLine, libraryTiles, overlayState } from './showOverlays';

const EP1 = { id: 'e1', episode_number: 1, title: 'The Opening' };
const EP3 = { id: 'e3', episode_number: 3, title: 'Studio Session' };
const USAGE = { a1: [EP3], a2: [EP1, EP3], b1: [EP1] };

describe('show overlays library helpers', () => {
  test('an overlay\'s images are its main one and its variants, once each', () => {
    expect(overlayAssetIds({ asset_id: 'a1', variants: [{ asset_id: 'a1' }, { asset_id: 'a2' }] })).toEqual(['a1', 'a2']);
    expect(overlayAssetIds({ asset_id: null, variants: null })).toEqual([]);
  });

  test('episodes using any of its images, once each, in episode order', () => {
    expect(episodesUsing({ asset_id: 'a1', variants: [{ asset_id: 'a2' }] }, USAGE)).toEqual([EP1, EP3]);
    expect(episodesUsing({ asset_id: 'zz' }, USAGE)).toEqual([]);
    expect(episodesUsing({ asset_id: 'a1' }, null)).toEqual([]);
  });

  test('the usage line', () => {
    expect(usageLine([])).toBe('Not used yet');
    expect(usageLine([EP3])).toBe('Used in Episode 3');
    expect(usageLine([{ id: 'x', episode_number: null }])).toBe('Used in 1 episode');
    expect(usageLine([EP1, EP3])).toBe('Used in 2 episodes');
  });

  test('the tiles: ready of all, and the episodes that use any overlay', () => {
    const overlays = [
      { asset_id: 'a1', variants: [{ asset_id: 'a2' }], generated: true },
      { asset_id: 'b1', generated: true },
      { asset_id: null, generated: false },
    ];
    expect(libraryTiles(overlays, USAGE)).toEqual([
      { key: 'ready', value: '2/3', label: 'ready' },
      { key: 'episodes', value: '2', label: 'episodes use them' },
    ]);
    expect(libraryTiles([], {})[1]).toEqual({ key: 'episodes', value: '0', label: 'episodes use them' });
  });

  test('state: ready only with an image', () => {
    expect(overlayState({ generated: true, url: 'u' })).toBe('ready');
    expect(overlayState({ generated: true, url: null })).toBe('not_made');
    expect(overlayState({ generated: false })).toBe('not_made');
  });
});
