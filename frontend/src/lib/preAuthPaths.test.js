/**
 * Which pages a signed-out visitor may open (Evoni, 2026-11-15): the landing
 * page, sign-in, the teleprompter's phone remote, and the two public
 * sections (the weekly recap and Shop the Look) with one item under each.
 * Every studio page is refused.
 */
import { describe, test, expect } from 'vitest';
import { isPreAuthPath, REMOTE_PATH } from './preAuthPaths';

describe('isPreAuthPath', () => {
  test('the public pages, by direct link, with or without a trailing slash', () => {
    for (const path of [
      '/', '/login', REMOTE_PATH,
      '/shop-the-look', '/shop-the-look/', '/shop-the-look/Ab3_k9-Zq1Lm', '/shop-the-look/-W7G0OL19j9G', '/shop-the-look/Ab3_k9-Zq1Lm/',
      '/pulse-recap', '/pulse-recap/', '/pulse-recap/0b7d3a52-6f0e-4c1e-9c35-2f6a1d7e8b90',
    ]) expect([path, isPreAuthPath(path)]).toEqual([path, true]);
  });

  test('every studio page is refused', () => {
    for (const path of [
      '/pulse', '/admin', '/admin?tab=pulse', '/episodes', '/episodes/0b7d3a52-6f0e-4c1e-9c35-2f6a1d7e8b90', '/shows', '/wardrobe', '/wardrobe/calendar',
      '/phone-hub', '/universe', '/characters', '/settings', '/search', '/template-studio', '/ai-costs', '/cfo', '/recycle-bin',
      '/teleprompter', '/teleprompter/remote/extra', '/api/v1/wardrobe', '/unknown',
    ]) expect([path, isPreAuthPath(path)]).toEqual([path, false]);
  });

  test('nothing rides in on a public section: no deeper path, no look-alike, no traversal', () => {
    for (const path of [
      '/shop-the-looks', '/shop-the-look-admin', '/shop-the-look/a/b', '/shop-the-look/../admin', '/shop-the-look/..', '/shop-the-look/.',
      '/shop-the-look/%2e%2e', '/shop-the-look/a b', '/shop-the-look/a?b', `/shop-the-look/${'a'.repeat(65)}`,
      '/pulse-recaps', '/pulse-recap/a/b', '/pulse-recap/../episodes', '/pulse-recap//admin', '//shop-the-look', '/Shop-The-Look', 'shop-the-look',
      '/login/extra', '/dev-token', '/__dev-token-carrier',
    ]) expect([path, isPreAuthPath(path)]).toEqual([path, false]);
  });

  test('what is not a path is refused', () => {
    for (const value of [undefined, null, '', 0, {}, []]) expect(isPreAuthPath(value)).toBe(false);
  });
});
