/**
 * The Map stage's reading of the phone (Evoni's mockup, 2026-10-08).
 */
import { test, expect } from 'vitest';
import { phoneFlowMap } from './phoneHubSummary';

const S = (id, links = [], extra = {}) => ({ id, name: id[0].toUpperCase() + id.slice(1), category: 'phone', generated: true, url: `https://x/${id}.png`, screen_links: links, ...extra });
const Z = (id, target, extra = {}) => ({ id, target, x: 1, y: 1, w: 5, h: 5, ...extra });
const ICONS = [{ id: 'ico-closet', name: 'Closet icon', category: 'phone_icon', url: 'https://x/i.png' }];

test('taps out of home, each marked onward, end or missing; no dead ends (Task #3162)', () => {
  const map = phoneFlowMap([
    S('home', [Z('z1', 'closet', { icon_overlay_id: 'ico-closet' }), Z('z2', 'camera', { label: 'Camera' }), Z('z3', 'gone')], { is_home: true }),
    S('closet', [Z('z4', 'home'), Z('z5', 'camera')]),
    S('camera'),
  ], ICONS);
  expect(map.home.id).toBe('home');
  expect(map.taps.map((t) => [t.label, t.state, t.onward])).toEqual([['Closet', 'onward', 2], ['Camera', 'end', 0], ['Zone 3', 'missing', 0]]);
  // Camera leads nowhere, but the phone's own Back brings Lala out.
  expect(map).not.toHaveProperty('deadEnds');
});

test('a screen nothing leads to is not reachable; a screen without an image is left out', () => {
  const map = phoneFlowMap([
    S('home', [Z('z1', 'closet')], { is_home: true }),
    S('closet', [Z('z2', 'home')]),
    S('hair'),
    { ...S('messages'), generated: false, url: null },
  ]);
  expect(map.unreachable.map((s) => s.id)).toEqual(['hair']);
});

test('two zones on one screen opening the same screen are named', () => {
  const map = phoneFlowMap([
    S('home', [Z('z1', 'closet', { label: 'wallet' }), Z('z2', 'closet', { label: 'closet' })], { is_home: true }),
    S('closet', [Z('z3', 'home')]),
  ]);
  expect(map.openedTwice).toEqual([{ screen: expect.objectContaining({ id: 'home' }), target: expect.objectContaining({ id: 'closet' }), labels: ['wallet', 'closet'], zoneIds: ['z1', 'z2'] }]);
});

test('a screen with no taps of its own is an end, pinned home icon or not', () => {
  const map = phoneFlowMap([
    S('home', [Z('z1', 'camera'), Z('z2', 'home', { persistent: true })], { is_home: true }),
    S('camera'),
  ]);
  expect(map.taps[0].state).toBe('end');
});

test('no home screen: nothing to map', () => {
  expect(phoneFlowMap([]).home).toBeNull();
});
