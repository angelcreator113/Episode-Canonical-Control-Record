/**
 * Step 1 of the Character Consistency Engine (Evoni, 2026-10-16): the
 * profile shows one handle, one follower number and an honest presence
 * label. Maren's page said "@@slowsift", "Active" beside "Gone Dark", and
 * the number on her character page could differ from her Pulse card.
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { atHandle, followersOf } from './feedConstants';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return files(p);
  return /\.(jsx|js)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
});

describe('one handle', () => {
  test('atHandle never doubles the @', () => {
    expect(atHandle('@slowsift')).toBe('@slowsift');
    expect(atHandle('@@slowsift')).toBe('@slowsift');
    expect(atHandle('slowsift')).toBe('@slowsift');
    expect(atHandle('')).toBe('');
  });
  test('no screen puts "@" in front of a raw handle', () => {
    const offenders = files(SRC).filter((f) => !f.endsWith('feedConstants.js'))
      .filter((f) => /@\{[\w.?]*handle\}|@\$\{[\w.?]*handle\}/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});

describe('one follower number', () => {
  test('the column wins, the generated copy is the fallback', () => {
    expect(followersOf({ follower_count_approx: '1.2M', full_profile: { follower_count_approx: '2M' } })).toBe('1.2M');
    expect(followersOf({ full_profile: { follower_count_approx: '2M' } })).toBe('2M');
    expect(followersOf(null)).toBe('');
  });
  test('the character page and the Pulse card both read followersOf', () => {
    expect(read('pages/CharacterProfilePage.jsx')).toMatch(/followersOf\(feedProfile\)/);
    expect(read('pages/feed/ProfileCard.jsx')).toMatch(/followersOf\(p\)/);
    expect(read('pages/CharacterProfilePage.jsx')).not.toMatch(/follower_count\?\.toLocaleString/);
  });
});

describe('presence is not account status', () => {
  test('the Social Presence badge says whether they are on the feed, not "Active"', () => {
    const page = read('pages/CharacterProfilePage.jsx');
    expect(page).toMatch(/'On the feed' : 'Not on the feed'/);
    expect(page).not.toMatch(/\? 'Active' : 'None'/);
  });
  test('every account status has a label', () => {
    const page = read('pages/CharacterProfilePage.jsx');
    for (const s of ['rising', 'peaking', 'plateauing', 'controversial', 'cancelled', 'reinventing', 'gone_dark', 'posthumous']) {
      expect(page).toMatch(new RegExp(`\\n  ${s}:\\s+\\{ label:`));
    }
  });
});
