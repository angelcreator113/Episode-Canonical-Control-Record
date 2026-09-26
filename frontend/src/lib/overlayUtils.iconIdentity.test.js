import { describe, test, expect } from 'vitest';
import { resolveZoneIconKey, resolveZoneIcon, withResolvedIconKey } from './overlayUtils';

const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', url: 'https://x/call-v2.png' };
const DM = { id: 'dm_icon', name: 'DM', category: 'icon', url: 'https://x/dm.png' };
const SCREEN = { id: 'home', name: 'Home', category: 'phone', url: 'https://x/call-v2.png' };
const ICONS = [CALL, DM, SCREEN];

describe('icon identity (doctrine rule 17, Task #2005)', () => {
  test('a keyed zone draws its icon\'s current image, whatever address it stored', () => {
    const zone = { id: 'z1', icon_overlay_id: 'call_icon', icon_url: 'https://x/call-v1.png' };
    expect(resolveZoneIconKey(zone, ICONS)).toBe('call_icon');
    expect(resolveZoneIcon(zone, ICONS)).toBe('https://x/call-v2.png');
  });

  test('a legacy zone resolves when its address is an icon\'s current image', () => {
    const zone = { id: 'z2', icon_url: 'https://x/dm.png' };
    expect(resolveZoneIconKey(zone, ICONS)).toBe('dm_icon');
    expect(resolveZoneIcon(zone, ICONS)).toBe('https://x/dm.png');
  });

  test('a stale legacy zone and a custom zone keep their own address', () => {
    const stale = { id: 'z3', icon_url: 'https://x/call-v1.png' };
    const custom = { id: 'z4', icon_url: 'https://x/custom.png', icon_urls: ['https://x/custom.png'] };
    expect(resolveZoneIconKey(stale, ICONS)).toBeNull();
    expect(resolveZoneIcon(stale, ICONS)).toBe('https://x/call-v1.png');
    expect(resolveZoneIcon(custom, ICONS)).toBe('https://x/custom.png');
  });

  test('only icons count: a screen sharing the address is not a match', () => {
    const zone = { id: 'z5', icon_url: 'https://x/call-v2.png' };
    expect(resolveZoneIconKey(zone, [SCREEN])).toBeNull();
  });

  test('a keyed zone whose icon is gone, or has no image, falls back to its address', () => {
    const zone = { id: 'z6', icon_overlay_id: 'deleted_icon', icon_url: 'https://x/old.png' };
    expect(resolveZoneIcon(zone, ICONS)).toBe('https://x/old.png');
    const noImage = { id: 'z7', icon_overlay_id: 'blank', icon_url: 'https://x/old.png' };
    expect(resolveZoneIcon(noImage, [{ id: 'blank', category: 'phone_icon', url: null }])).toBe('https://x/old.png');
  });

  test('a zone with no icon resolves to null', () => {
    expect(resolveZoneIcon({ id: 'z8', target: 'dms' }, ICONS)).toBeNull();
  });

  test('withResolvedIconKey stamps a resolved legacy zone and leaves others alone', () => {
    const legacy = { id: 'z2', icon_url: 'https://x/dm.png' };
    expect(withResolvedIconKey(legacy, ICONS)).toEqual({ ...legacy, icon_overlay_id: 'dm_icon' });
    const keyed = { id: 'z1', icon_overlay_id: 'call_icon', icon_url: 'https://x/call-v1.png' };
    expect(withResolvedIconKey(keyed, ICONS)).toBe(keyed);
    const stale = { id: 'z3', icon_url: 'https://x/call-v1.png' };
    expect(withResolvedIconKey(stale, ICONS)).toBe(stale);
    const tap = { id: 'z9', target: 'dms' };
    expect(withResolvedIconKey(tap, ICONS)).toBe(tap);
  });
});
