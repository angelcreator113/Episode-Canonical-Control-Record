/**
 * overlayUtils — zone icons and bounds for the zones workspace (Task #2014).
 */
import { describe, test, expect } from 'vitest';
import {
  describeZoneIcon, pickZoneLibraryIcon, isZoneOutOfBounds, moveZoneInside, ZONE_DEFAULT_SIZE,
} from './overlayUtils';

const CALL = { id: 'call_icon', name: 'Call Icon', category: 'phone_icon', url: 'https://x/call-v2.png', opens_screen: 'calls' };
const MAIL = { id: 'mail_icon', name: 'Mail', category: 'icon', url: 'https://x/mail.png' };
const ICONS = [CALL, MAIL];

describe('describeZoneIcon', () => {
  test('a keyed zone is its library icon, drawn with the icon\'s current image', () => {
    expect(describeZoneIcon({ icon_overlay_id: 'call_icon', icon_url: 'https://x/call-v1.png' }, ICONS))
      .toEqual({ kind: 'library', key: 'call_icon', icon: CALL, url: CALL.url });
  });
  test('a legacy zone whose address is an icon\'s current image is that icon', () => {
    expect(describeZoneIcon({ icon_url: MAIL.url }, ICONS)).toMatchObject({ kind: 'library', key: 'mail_icon' });
  });
  test('an address no icon holds is a custom image; nothing is no icon', () => {
    expect(describeZoneIcon({ icon_url: 'https://x/upload.png' }, ICONS)).toEqual({ kind: 'custom', url: 'https://x/upload.png' });
    expect(describeZoneIcon({ icon_urls: ['https://x/u2.png'] }, ICONS)).toEqual({ kind: 'custom', url: 'https://x/u2.png' });
    expect(describeZoneIcon({ icon_url: null, icon_urls: [] }, ICONS)).toEqual({ kind: 'none' });
  });
});

describe('pickZoneLibraryIcon', () => {
  test('stores the key at once and makes the icon the zone\'s one icon', () => {
    expect(pickZoneLibraryIcon({ label: 'Phone', target: 'dms', icon_urls: ['https://x/a.png', 'https://x/b.png'] }, CALL, ICONS))
      .toEqual({ icon_overlay_id: 'call_icon', icon_url: CALL.url, icon_urls: [CALL.url] });
  });
  test('a zone with no label or target takes the icon\'s name and opens_screen', () => {
    expect(pickZoneLibraryIcon({}, CALL, ICONS)).toMatchObject({ label: 'Call', target: 'calls' });
  });
  test('picking the icon the zone already has removes it', () => {
    const changes = pickZoneLibraryIcon({ icon_overlay_id: 'call_icon', icon_url: CALL.url }, CALL, ICONS);
    expect(changes).toEqual({ icon_overlay_id: undefined, icon_url: null, icon_urls: [] });
    expect(JSON.parse(JSON.stringify({ id: 'z', ...changes }))).toEqual({ id: 'z', icon_url: null, icon_urls: [] });
  });
});

describe('isZoneOutOfBounds / moveZoneInside', () => {
  test.each([
    [{ x: 10, y: 10, w: 20, h: 20 }, false],
    [{ x: 0, y: 0, w: 100, h: 100 }, false],
    [{ x: 90, y: 10, w: 20, h: 10 }, true],
    [{ x: -5, y: 10, w: 20, h: 10 }, true],
    [{ x: 10, y: 95, w: 20, h: 10 }, true],
    [{ x: 10, y: 10, w: 0, h: 10 }, true],
    [{ x: 10, y: 10, w: 20 }, true],
    [{ x: NaN, y: 10, w: 20, h: 10 }, true],
  ])('%o out of bounds: %s', (zone, out) => {
    expect(isZoneOutOfBounds(zone)).toBe(out);
  });

  test('moving inside clamps the position and keeps the size', () => {
    expect(moveZoneInside({ id: 'z', x: 90, y: 95, w: 20, h: 10, label: 'Call' }))
      .toEqual({ id: 'z', x: 80, y: 90, w: 20, h: 10, label: 'Call' });
    expect(moveZoneInside({ x: -5, y: -1, w: 20, h: 10 })).toMatchObject({ x: 0, y: 0, w: 20, h: 10 });
  });

  test('a zone larger than the screen shrinks to fit; a missing or zero size takes the default', () => {
    expect(moveZoneInside({ x: 10, y: 0, w: 140, h: 10 })).toMatchObject({ x: 0, w: 100 });
    expect(moveZoneInside({ x: 95, y: 95, w: 0 })).toMatchObject({ ...ZONE_DEFAULT_SIZE, x: 100 - ZONE_DEFAULT_SIZE.w, y: 100 - ZONE_DEFAULT_SIZE.h });
  });

  test('every zone moved inside is in bounds', () => {
    for (const z of [{ x: 90, y: 10, w: 20, h: 10 }, { x: -5, y: 10, w: 20 }, { x: NaN, y: 200, w: -3, h: 150 }]) {
      expect(isZoneOutOfBounds(moveZoneInside(z))).toBe(false);
    }
  });
});
