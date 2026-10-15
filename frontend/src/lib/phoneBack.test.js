/**
 * Back with no history (Task #3165): the screen whose icon opens the page
 * (Closet for a section page), else home.
 */
import { test, expect } from 'vitest';
import { backTargetOf, ownBackZone } from './phoneBack';

const S = (id, links = [], extra = {}) => ({ id, name: id, category: 'phone', generated: true, url: `https://x/${id}.png`, screen_links: links, ...extra });
const I = (id) => ({ id, name: id, category: 'phone_icon', url: `https://x/${id}.png` });
const ICONS = [I('closet_icon'), I('shoe_icon'), I('purse_icon')];
const HOME = S('homepage', [{ id: 'h1', target: 'closet', icon_overlay_id: 'closet_icon' }, { id: 'h2', target: 'purse_page', icon_overlay_id: 'purse_icon' }], { is_home: true });
const CLOSET = S('closet', [
  { id: 'c1', target: 'shoe_page', icon_overlay_id: 'shoe_icon' },
  { id: 'c2', target: 'purse_page', icon_url: 'https://x/purse_icon.png' },
  { id: 'c3', target: 'notes' },   // a plain tap zone, not an icon
]);
const SHOES = S('shoe_page');
const PURSE = S('purse_page');
const NOTES = S('notes');
const SCREENS = [HOME, CLOSET, SHOES, PURSE, NOTES];

test("a section page goes back to the screen whose icon opens it, by the icon's key or image", () => {
  expect(backTargetOf(SHOES, SCREENS, ICONS, HOME).id).toBe('closet');
  // Opened from the home's icon too: the non-home parent wins.
  expect(backTargetOf(PURSE, SCREENS, ICONS, HOME).id).toBe('closet');
});

test('Closet itself, a page only a plain zone opens, and a page nothing opens go home', () => {
  expect(backTargetOf(CLOSET, SCREENS, ICONS, HOME).id).toBe('homepage');
  expect(backTargetOf(NOTES, SCREENS, ICONS, HOME).id).toBe('homepage');
  expect(backTargetOf(S('lonely'), SCREENS, ICONS, HOME).id).toBe('homepage');
});

test('no Back target on the home, or with no screen', () => {
  expect(backTargetOf(HOME, SCREENS, ICONS, HOME)).toBeNull();
  expect(backTargetOf(null, SCREENS, ICONS, HOME)).toBeNull();
});

test('ownBackZone: a zone labelled Back that opens a screen', () => {
  const z = (label, extra = {}) => S('p', [{ id: 'z', target: 'homepage', label, ...extra }]);
  for (const label of ['Back', '‹ back', '← Back', 'Back home', 'Go back', 'Back to Closet']) {
    expect(ownBackZone(z(label))?.id).toBe('z');
  }
  for (const label of ['Backpack', 'Feedback', 'Home', '', undefined]) {
    expect(ownBackZone(z(label))).toBeNull();
  }
  expect(ownBackZone(z('Back', { target: null }))).toBeNull();
  expect(ownBackZone(z('Back', { persistent: true }))).toBeNull();
  expect(ownBackZone({ id: 'p', metadata: { screen_links: [{ id: 'm', target: 'homepage', label: 'Back' }] } })?.id).toBe('m');
  expect(ownBackZone(null)).toBeNull();
});
