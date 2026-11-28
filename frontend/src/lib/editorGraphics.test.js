/**
 * The Graphics catalogue (Gate 2b PR 1b): the two lists that already own
 * the episode's and the show's pictures, offered once each.
 */
import { describe, test, expect } from 'vitest';
import { graphicsCatalogue, episodePieceGraphics, showOverlayGraphics } from './editorGraphics';

const piece = (over = {}) => ({ key: 'title_overlay', label: 'Title overlay', status: 'approved', asset_id: 'a-title', image_url: 'https://cdn/title.png', ...over });
const overlay = (over = {}) => ({ id: 'messages', name: 'Messages', category: 'phone', asset_id: 'a-msg', url: 'https://cdn/msg.png', variants: null, is_episode_override: false, ...over });

describe('the episode’s own pieces', () => {
  test('a made piece is offered; one that was never made is not', () => {
    expect(episodePieceGraphics([piece(), piece({ key: 'framed_card', label: 'Framed card', status: 'not_made', asset_id: null, image_url: null })]))
      .toEqual([{ asset_id: 'a-title', url: 'https://cdn/title.png', label: 'Title overlay', meta: 'Episode' }]);
  });

  test('an outdated piece is still offered, and says so', () => {
    expect(episodePieceGraphics([piece({ status: 'outdated' })])[0].meta).toBe('Episode · outdated');
  });
});

describe('the show’s overlay images', () => {
  test('a screen, its variants, and an icon', () => {
    const list = showOverlayGraphics([
      overlay({ variants: [{ asset_id: 'a-msg', url: 'https://cdn/msg.png', variant_label: 'Default' }, { asset_id: 'a-msg-2', url: 'https://cdn/msg2.png', variant_label: 'Night' }] }),
      overlay({ id: 'camera_icon', name: 'Camera Icon', category: 'phone_icon', asset_id: 'a-cam', url: 'https://cdn/cam.png' }),
    ]);
    expect(list.map((g) => [g.asset_id, g.label, g.meta])).toEqual([
      ['a-msg', 'Messages', 'Show · phone screen'],
      ['a-msg-2', 'Messages · Night', 'Show · phone screen'],
      ['a-cam', 'Camera Icon', 'Show · phone icon'],
    ]);
  });

  test("an episode's own version of a screen says so", () => {
    expect(showOverlayGraphics([overlay({ is_episode_override: true })])[0].meta).toBe('Episode override · phone screen');
  });
});

describe('the catalogue', () => {
  test('one entry per picture: the same asset in both lists is offered once, by its episode name', () => {
    // An episode's title overlay IS a UI_OVERLAY row, so it arrives twice.
    const out = graphicsCatalogue({
      pieces: [piece({ asset_id: 'shared' })],
      overlays: [overlay({ asset_id: 'shared', name: 'Title overlay (asset)' }), overlay()],
    });
    expect(out.map((g) => g.asset_id)).toEqual(['shared', 'a-msg']);
    expect(out[0].label).toBe('Title overlay');
    expect(out[0].meta).toBe('Episode');
  });

  test('a picture with no image address is not offered: there is nothing to place', () => {
    expect(graphicsCatalogue({ overlays: [overlay({ url: null })] })).toEqual([]);
  });

  test('empty lists, or none at all, give an empty catalogue', () => {
    expect(graphicsCatalogue()).toEqual([]);
    expect(graphicsCatalogue({ pieces: [], overlays: [] })).toEqual([]);
  });
});
