/**
 * The Phone Hub's header tiles and phone caption (Evoni's mock, 2026-10-07):
 * counted by the screen cards' Ready rule, icons apart from screens.
 */
import { describe, test, expect } from 'vitest';
import { phoneHubTiles, screenCaption, homeScreenOf, incomingById } from './phoneHubSummary';

const scr = (id, over = {}) => ({ id, name: id, category: 'phone', generated: true, url: `https://x/${id}.png`, screen_links: [], ...over });
const HOME = scr('home', { is_home: true, screen_links: [{ id: 'z1', target: 'feed', icon_overlay_id: 'i1' }] });
const FEED = scr('feed');
const LOST = scr('lost');
const BLANK = scr('blank', { generated: false, url: null });
const ICON = { id: 'i1', name: 'Feed icon', category: 'phone_icon', generated: true, url: 'https://x/i1.png' };
const diag = new Map([
  ['home', { counts: { tap: 0, icon: 1, content: 0 }, missingTarget: 0, brokenTarget: 0 }],
  ['feed', { counts: { tap: 2, icon: 0, content: 0 }, missingTarget: 0, brokenTarget: 0 }],
  ['lost', { counts: { tap: 0, icon: 0, content: 0 }, missingTarget: 0, brokenTarget: 0 }],
]);

describe('phoneHubTiles', () => {
  test('ready counts screens by the card rule; icons are counted apart', () => {
    const tiles = phoneHubTiles([HOME, FEED, LOST, BLANK, ICON], diag);
    // home: home screen, all zones linked → ready; feed: linked from home → ready;
    // lost: nothing links here; blank: no image.
    expect(tiles).toEqual([
      { key: 'ready', value: '2/4', label: 'screens ready' },
      { key: 'screens', value: '4', label: 'screens' },
      { key: 'icons', value: '1', label: 'icon' },
    ]);
  });

  test('a zone with no destination keeps its screen out of ready', () => {
    const d = new Map(diag); d.set('home', { ...diag.get('home'), missingTarget: 1 });
    expect(phoneHubTiles([HOME, FEED], d)[0].value).toBe('1/2');
  });

  test('no rows reads 0/0', () => {
    expect(phoneHubTiles([], new Map()).map(t => t.value)).toEqual(['0/0', '0', '0']);
  });
});

describe('screenCaption', () => {
  test('tap zones and icons from the diagnostics', () => {
    expect(screenCaption(FEED, diag)).toBe('2 tap zones');
    expect(screenCaption(HOME, diag)).toBe('1 icon');
    const both = new Map([['feed', { counts: { tap: 1, icon: 3 } }]]);
    expect(screenCaption(FEED, both)).toBe('1 tap zone · 3 icons');
  });

  test('says when there is nothing yet', () => {
    expect(screenCaption(LOST, diag)).toBe('No tap zones yet');
    expect(screenCaption(BLANK, diag)).toBe('No image yet');
    expect(screenCaption(null, diag)).toBeNull();
  });
});

describe('homeScreenOf and incomingById', () => {
  test('home is the marked screen, else the first with an image', () => {
    expect(homeScreenOf([FEED, HOME]).id).toBe('home');
    expect(homeScreenOf([BLANK, FEED]).id).toBe('feed');
  });

  test('incoming counts zones that lead to each screen', () => {
    expect(incomingById([HOME, FEED]).get('feed')).toBe(1);
    expect(incomingById([HOME, FEED]).get('home')).toBeUndefined();
  });
});
