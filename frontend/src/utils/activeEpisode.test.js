/**
 * The official production episode and the episode to resume (PR-03 of
 * docs/design/2026-11-studio-home-episode-command-center.md; Evoni's rulings
 * of 2026-11-17): two answers that are never confused, one browser key, and
 * nothing that reads a season slot.
 */
import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  IN_PRODUCTION, episodesInProduction, productionEpisode, resumeEpisode, rememberedEpisodeId, rememberEpisode,
  RESUMABLE_TABS, MAX_EPISODE_LOCATIONS, rememberEpisodeLocation, episodeLocation, forgetEpisode,
} from './activeEpisode';
import * as fromShowOverview from '../components/Show/ShowOverview';

const ep = (id, number, status, extra = {}) => ({ id, show_id: 'show-a', season_number: 1, episode_number: number, status, title: `Episode ${number}`, ...extra });
const E1 = ep('e1', 1, 'in_build');
const E2 = ep('e2', 2, 'draft');
const E3 = ep('e3', 3, 'scripted');
const DONE = ep('done', 4, 'draft', { evaluation_status: 'accepted' });
const OUT = ep('out', 5, 'published');
const SCHEDULED = ep('sched', 6, 'scheduled');
const GONE = ep('gone', 7, 'archived');
const SHOW_A = [OUT, E3, E1, DONE, E2, SCHEDULED, GONE];
// Another show's episodes; its ids never appear in SHOW_A.
const SHOW_B = [ep('b1', 1, 'draft', { show_id: 'show-b' }), ep('b2', 2, 'in_review', { show_id: 'show-b' })];

describe('the official production episode', () => {
  test('the first unfinished episode in story order, whatever order the list arrives in', () => {
    expect(productionEpisode(SHOW_A)).toBe(E1);
    expect(productionEpisode([E3, E2])).toBe(E2);
    expect(productionEpisode([...SHOW_A].reverse())).toBe(E1);
  });

  test('unfinished is one of the four working statuses, and not completed', () => {
    expect(IN_PRODUCTION).toEqual(['draft', 'scripted', 'in_build', 'in_review']);
    expect(episodesInProduction(SHOW_A).map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    for (const status of IN_PRODUCTION) expect(productionEpisode([ep('x', 1, status)]).id).toBe('x');
    // Completed, scheduled, published, archived, and a status the app does not know.
    for (const one of [DONE, OUT, SCHEDULED, GONE, ep('p', 1, 'processing'), ep('r', 1, 'review'), ep('n', 1, null), ep('u', 1, undefined)]) {
      expect(productionEpisode([one])).toBeNull();
    }
  });

  test('several seasons: by episode number, as Producer Mode has always ordered them', () => {
    const s1 = ep('s1-late', 3, 'draft', { season_number: 1 });
    const s2 = ep('s2-first', 25, 'draft', { season_number: 2 });
    expect(productionEpisode([s2, s1])).toBe(s1);
    // Season 1 finished: the first unfinished episode is in season 2.
    expect(productionEpisode([ep('s1-done', 24, 'published'), s2, ep('s2-next', 26, 'draft', { season_number: 2 })])).toBe(s2);
    // The season is not part of the order: only the episode number is (unchanged behaviour).
    const lowNumberInLaterSeason = ep('s2-low', 1, 'draft', { season_number: 2 });
    expect(productionEpisode([s1, lowNumberInLaterSeason])).toBe(lowNumberInLaterSeason);
  });

  test('no number sorts first, and the order of equal numbers is the list\'s own', () => {
    const unnumbered = ep('nn', undefined, 'draft');
    expect(productionEpisode([E2, unnumbered])).toBe(unnumbered);
    const twinA = ep('twin-a', 2, 'draft');
    const twinB = ep('twin-b', 2, 'draft');
    expect(productionEpisode([twinA, twinB])).toBe(twinA);
    expect(productionEpisode([twinB, twinA])).toBe(twinB);
  });

  test('nothing unfinished, no episodes, or no list: null', () => {
    expect(productionEpisode([OUT, DONE, SCHEDULED, GONE])).toBeNull();
    expect(productionEpisode([])).toBeNull();
    expect(productionEpisode(null)).toBeNull();
    expect(productionEpisode(undefined)).toBeNull();
  });

  test('it does not change or reorder the list it is given', () => {
    const list = [E3, E1, E2];
    productionEpisode(list);
    episodesInProduction(list);
    expect(list.map((e) => e.id)).toEqual(['e3', 'e1', 'e2']);
  });
});

describe('the episode to resume', () => {
  test('E1 officially in production, E2 remembered: resume is E2, and production is still E1', () => {
    expect(resumeEpisode(SHOW_A, 'e2')).toBe(E2);
    expect(productionEpisode(SHOW_A)).toBe(E1);
    expect(resumeEpisode(SHOW_A, 'e3')).toBe(E3);
  });

  test('nothing remembered, or the production episode remembered: the official production episode', () => {
    for (const none of [null, undefined, '', 0, false]) expect(resumeEpisode(SHOW_A, none)).toBe(E1);
    expect(resumeEpisode(SHOW_A, 'e1')).toBe(E1);
    expect(resumeEpisode(SHOW_A)).toBe(E1);
  });

  test('a remembered episode that is finished is passed over', () => {
    for (const id of ['done', 'out', 'sched', 'gone']) expect(resumeEpisode(SHOW_A, id)).toBe(E1);
  });

  test('a remembered id that is not in the list (deleted, unreadable, or never real) is passed over', () => {
    for (const id of ['deleted-episode', 'e', 'E2', ' e2', 'e2 ', '00000000-0000-4000-8000-000000000000', 'null', 'undefined', '[object Object]', {}, [], 12]) {
      expect(resumeEpisode(SHOW_A, id)).toBe(E1);
    }
  });

  test('another show\'s episode is passed over: each show resumes against its own list', () => {
    // Remembered: show B's second episode.
    expect(resumeEpisode(SHOW_A, 'b2')).toBe(E1);
    expect(resumeEpisode(SHOW_B, 'b2').id).toBe('b2');
    // Remembered: show A's second episode.
    expect(resumeEpisode(SHOW_B, 'e2').id).toBe('b1');
    expect(resumeEpisode(SHOW_A, 'e2')).toBe(E2);
  });

  test('ids are matched as text, so a number and its text are the same episode', () => {
    const numbered = [ep(11, 1, 'draft'), ep(12, 2, 'draft')];
    expect(resumeEpisode(numbered, '12').id).toBe(12);
    expect(resumeEpisode(numbered, 12).id).toBe(12);
  });

  test('nothing unfinished: null, even when a finished episode is remembered', () => {
    expect(resumeEpisode([OUT, DONE, GONE], 'out')).toBeNull();
    expect(resumeEpisode([OUT, DONE, GONE], null)).toBeNull();
    expect(resumeEpisode([], 'e2')).toBeNull();
    expect(resumeEpisode(null, 'e2')).toBeNull();
  });
});

describe('a season slot is never an episode', () => {
  test('a show with a planned season and no episode records has nothing to produce or resume', () => {
    // What the season roadmap holds for unstarted slots: no episode at all.
    const slots = [
      { id: 'slot-1', slot_number: 1, label: 'S1 · E1', state: 'event_ready', event: { id: 'ev-1' }, episode: null },
      { id: 'slot-2', slot_number: 2, label: 'S1 · E2', state: 'needs_event', episode: null },
    ];
    const episodes = slots.map((s) => s.episode).filter(Boolean);
    expect(productionEpisode(episodes)).toBeNull();
    expect(resumeEpisode(episodes, 'slot-1')).toBeNull();
  });

  test('a slot handed in by mistake is not taken for an episode (it has no working status)', () => {
    const slot = { id: 'slot-2', slot_number: 2, label: 'S1 · E2', state: 'needs_event', episode: null };
    expect(productionEpisode([slot])).toBeNull();
    expect(resumeEpisode([slot], 'slot-2')).toBeNull();
    expect(resumeEpisode([slot, E2], 'slot-2')).toBe(E2);
  });
});

describe('the remembered episode: one browser key', () => {
  let warn;
  beforeEach(() => { window.localStorage.clear(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  test('remembering writes the existing key and the title beside it; reading gives the id back', () => {
    expect(rememberedEpisodeId()).toBeNull();
    rememberEpisode({ id: 'e2', title: 'Second Look' });
    expect(window.localStorage.getItem('working-episode-id')).toBe('e2');
    expect(window.localStorage.getItem('working-episode-title')).toBe('Second Look');
    expect(rememberedEpisodeId()).toBe('e2');
    expect(Object.keys(window.localStorage).sort()).toEqual(['working-episode-id', 'working-episode-title']);
  });

  test('the title falls back as it always did', () => {
    rememberEpisode({ id: 'a', episodeTitle: 'Old field' });
    expect(window.localStorage.getItem('working-episode-title')).toBe('Old field');
    rememberEpisode({ id: 'b' });
    expect(window.localStorage.getItem('working-episode-title')).toBe('Untitled');
  });

  test('nothing to remember writes nothing', () => {
    rememberEpisode(null);
    rememberEpisode({});
    rememberEpisode({ title: 'No id' });
    expect(window.localStorage.length).toBe(0);
  });

  test('opening another episode does not change the official production episode', () => {
    rememberEpisode(E2);
    expect(productionEpisode(SHOW_A)).toBe(E1);
    expect(episodesInProduction(SHOW_A)[0]).toBe(E1);
    rememberEpisode(E3);
    expect(productionEpisode(SHOW_A)).toBe(E1);
    expect(resumeEpisode(SHOW_A, rememberedEpisodeId())).toBe(E3);
  });

  test('storage that cannot be read: nothing remembered, no error, so resume is the production episode', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(rememberedEpisodeId()).toBeNull();
    expect(resumeEpisode(SHOW_A, rememberedEpisodeId())).toBe(E1);
    expect(warn).toHaveBeenCalled();
  });

  test('storage that cannot be written: remembering does not throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => rememberEpisode(E2)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  test('an empty remembered value reads as nothing remembered', () => {
    window.localStorage.setItem('working-episode-id', '');
    expect(rememberedEpisodeId()).toBeNull();
  });
});

describe('one definition, one reader and writer', () => {
  test('Producer Mode\'s Overview exports the same working statuses and the same list', () => {
    expect(fromShowOverview.IN_PRODUCTION).toBe(IN_PRODUCTION);
    expect(fromShowOverview.episodesInProduction).toBe(episodesInProduction);
  });

  test('no other source file names the browser key', () => {
    const root = path.resolve(__dirname, '..');
    const hits = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) continue;
        if (fs.readFileSync(full, 'utf8').includes('working-episode')) hits.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(hits).toEqual([path.join('utils', 'activeEpisode.js')]);
  });
});

// PR-04 (Evoni, 2026-11-18): the last working location inside each episode.
describe('the resume location: the last working tab inside an episode', () => {
  const KEY = 'working-episode-locations';
  const stored = () => JSON.parse(window.localStorage.getItem(KEY) || '{}');
  const OPEN = { voiceStudio: true };
  let warn;
  beforeEach(() => { window.localStorage.clear(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  test('the places of work are Script and every view of Production and Results; the Overview is not one', () => {
    expect(RESUMABLE_TABS).toEqual([
      'scripts',
      'wardrobe', 'lookbook', 'phone', 'overlays', 'money', 'checklist', 'scenes', 'beatplan', 'files', 'voice', 'edit',
      'summary', 'evaluation', 'story', 'distribution',
    ]);
    expect(RESUMABLE_TABS).not.toContain('overview');
  });

  test('each place of work is remembered and read back, with when', () => {
    for (const tab of RESUMABLE_TABS) {
      window.localStorage.clear();
      expect(rememberEpisodeLocation('e1', tab, OPEN, 1000)).toBe(true);
      expect(episodeLocation('e1', OPEN)).toEqual({ tab, at: 1000 });
    }
  });

  test('the Overview is never remembered, and does not replace what was', () => {
    expect(rememberEpisodeLocation('e1', 'overview')).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBeNull();
    rememberEpisodeLocation('e1', 'wardrobe', {}, 1000);
    expect(rememberEpisodeLocation('e1', 'overview', {}, 2000)).toBe(false);
    expect(episodeLocation('e1')).toEqual({ tab: 'wardrobe', at: 1000 });
  });

  test('what is not a tab is not remembered: a main tab\'s own key, an old key, a misspelling, nothing', () => {
    rememberEpisodeLocation('e1', 'money', {}, 1000);
    for (const bad of ['production', 'results', 'brief', 'assets', 'Wardrobe', 'wardrobe ', 'nonsense', '', null, undefined, 7, {}, ['wardrobe']]) {
      expect(rememberEpisodeLocation('e1', bad, OPEN, 2000)).toBe(false);
    }
    expect(episodeLocation('e1')).toEqual({ tab: 'money', at: 1000 });
    expect(rememberEpisodeLocation('', 'wardrobe')).toBe(false);
    expect(rememberEpisodeLocation(null, 'wardrobe')).toBe(false);
    expect(Object.keys(stored())).toEqual(['e1']);
  });

  test('Voice is remembered only while it is open, and what was remembered before stays', () => {
    rememberEpisodeLocation('e1', 'files', {}, 1000);
    expect(rememberEpisodeLocation('e1', 'voice', {}, 2000)).toBe(false);
    expect(rememberEpisodeLocation('e1', 'voice', { voiceStudio: false }, 2000)).toBe(false);
    expect(rememberEpisodeLocation('e1', 'voice', { voiceStudio: 'yes' }, 2000)).toBe(false);
    expect(episodeLocation('e1', OPEN)).toEqual({ tab: 'files', at: 1000 });
    expect(rememberEpisodeLocation('e1', 'voice', OPEN, 3000)).toBe(true);
    expect(episodeLocation('e1', OPEN)).toEqual({ tab: 'voice', at: 3000 });
  });

  test('a saved Voice location is passed over while Voice is not open, and is not deleted', () => {
    rememberEpisodeLocation('e1', 'voice', OPEN, 1000);
    const before = window.localStorage.getItem(KEY);
    expect(episodeLocation('e1')).toBeNull();
    expect(episodeLocation('e1', { voiceStudio: false })).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBe(before);
    // Open again: it is there.
    expect(episodeLocation('e1', OPEN)).toEqual({ tab: 'voice', at: 1000 });
  });

  test('each episode keeps its own, across episodes and shows', () => {
    rememberEpisodeLocation('show-a-e1', 'wardrobe', {}, 1000);
    rememberEpisodeLocation('show-a-e2', 'scripts', {}, 2000);
    rememberEpisodeLocation('show-b-e1', 'distribution', {}, 3000);
    rememberEpisodeLocation('show-a-e1', 'beatplan', {}, 4000);
    expect(episodeLocation('show-a-e1')).toEqual({ tab: 'beatplan', at: 4000 });
    expect(episodeLocation('show-a-e2')).toEqual({ tab: 'scripts', at: 2000 });
    expect(episodeLocation('show-b-e1')).toEqual({ tab: 'distribution', at: 3000 });
    expect(episodeLocation('never-opened')).toBeNull();
    expect(episodeLocation(null)).toBeNull();
    // One browser key holds them all.
    expect(Object.keys(window.localStorage)).toEqual([KEY]);
  });

  test('an id is matched as text', () => {
    rememberEpisodeLocation(12, 'money', {}, 1000);
    expect(episodeLocation('12')).toEqual({ tab: 'money', at: 1000 });
    expect(episodeLocation(12)).toEqual({ tab: 'money', at: 1000 });
  });

  test('only the 20 most recently visited episodes are kept', () => {
    expect(MAX_EPISODE_LOCATIONS).toBe(20);
    for (let i = 1; i <= 25; i += 1) rememberEpisodeLocation(`e${i}`, 'wardrobe', {}, i * 1000);
    expect(Object.keys(stored())).toHaveLength(20);
    for (let i = 1; i <= 5; i += 1) expect(episodeLocation(`e${i}`)).toBeNull();
    for (let i = 6; i <= 25; i += 1) expect(episodeLocation(`e${i}`)).toEqual({ tab: 'wardrobe', at: i * 1000 });
    // Visiting an old one again keeps it, and the least recent goes.
    rememberEpisodeLocation('e6', 'money', {}, 99000);
    rememberEpisodeLocation('e-new', 'scripts', {}, 100000);
    expect(episodeLocation('e6')).toEqual({ tab: 'money', at: 99000 });
    expect(episodeLocation('e7')).toBeNull();
    expect(Object.keys(stored())).toHaveLength(20);
  });

  test('a stored location that is no longer a tab reads as none, and is left as it is', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ e1: { tab: 'retired-tab', at: 5 }, e2: { tab: 'overview', at: 6 }, e3: { tab: 'money', at: 7 } }));
    const before = window.localStorage.getItem(KEY);
    expect(episodeLocation('e1')).toBeNull();
    expect(episodeLocation('e2')).toBeNull();
    expect(episodeLocation('e3')).toEqual({ tab: 'money', at: 7 });
    expect(window.localStorage.getItem(KEY)).toBe(before);
  });

  test('a stored value that is not what this file wrote reads as nothing, without an error', () => {
    for (const junk of ['not json', '[]', '"text"', '42', 'null', '{"e1":"wardrobe"}', '{"e1":{"tab":7}}', '{"e1":null}']) {
      window.localStorage.setItem(KEY, junk);
      expect(episodeLocation('e1')).toBeNull();
    }
    // The next visit writes a clean value.
    window.localStorage.setItem(KEY, 'not json');
    expect(rememberEpisodeLocation('e1', 'wardrobe', {}, 1000)).toBe(true);
    expect(stored()).toEqual({ e1: { tab: 'wardrobe', at: 1000 } });
  });

  test('storage that cannot be read or written: nothing remembered, nothing thrown', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(episodeLocation('e1')).toBeNull();
    expect(() => forgetEpisode('e1')).not.toThrow();
    vi.restoreAllMocks();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => rememberEpisodeLocation('e1', 'wardrobe')).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  test('forgetting an episode removes its location and "last opened", and nothing else', () => {
    window.localStorage.setItem('primeStudios.activeShowId', 'show-a');
    window.localStorage.setItem('esp-draft-e2', 'an unsaved script');
    window.localStorage.setItem('authToken', 'token');
    rememberEpisode({ id: 'e2', title: 'Second Look' });
    rememberEpisodeLocation('e1', 'wardrobe', {}, 1000);
    rememberEpisodeLocation('e2', 'scripts', {}, 2000);
    rememberEpisodeLocation('e3', 'money', {}, 3000);

    forgetEpisode('e2');

    expect(episodeLocation('e2')).toBeNull();
    expect(rememberedEpisodeId()).toBeNull();
    expect(window.localStorage.getItem('working-episode-title')).toBeNull();
    // The other episodes, and the rest of the browser's state.
    expect(episodeLocation('e1')).toEqual({ tab: 'wardrobe', at: 1000 });
    expect(episodeLocation('e3')).toEqual({ tab: 'money', at: 3000 });
    expect(window.localStorage.getItem('primeStudios.activeShowId')).toBe('show-a');
    expect(window.localStorage.getItem('esp-draft-e2')).toBe('an unsaved script');
    expect(window.localStorage.getItem('authToken')).toBe('token');
  });

  test('forgetting an episode that is not the one last opened leaves "last opened" alone', () => {
    rememberEpisode({ id: 'e1', title: 'Episode One' });
    rememberEpisodeLocation('e1', 'wardrobe', {}, 1000);
    rememberEpisodeLocation('e2', 'scripts', {}, 2000);
    forgetEpisode('e2');
    expect(rememberedEpisodeId()).toBe('e1');
    expect(window.localStorage.getItem('working-episode-title')).toBe('Episode One');
    expect(episodeLocation('e1')).toEqual({ tab: 'wardrobe', at: 1000 });
    // Nothing to forget: no change, no error.
    forgetEpisode('never-opened');
    forgetEpisode(null);
    expect(rememberedEpisodeId()).toBe('e1');
  });

  test('forgetting the last location removes the key, so nothing empty is left behind', () => {
    rememberEpisodeLocation('e1', 'wardrobe', {}, 1000);
    forgetEpisode('e1');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  test('a location changes neither the official production episode nor the episode to resume', () => {
    rememberEpisode(E2);
    rememberEpisodeLocation('e3', 'wardrobe', {}, 1000);
    rememberEpisodeLocation('e1', 'scripts', {}, 2000);
    expect(productionEpisode(SHOW_A)).toBe(E1);
    expect(resumeEpisode(SHOW_A, rememberedEpisodeId())).toBe(E2);
    forgetEpisode('e3');
    expect(productionEpisode(SHOW_A)).toBe(E1);
    expect(resumeEpisode(SHOW_A, rememberedEpisodeId())).toBe(E2);
  });
});
