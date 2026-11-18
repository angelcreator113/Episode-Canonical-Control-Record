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
