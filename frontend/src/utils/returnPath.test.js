/**
 * The way back from an episode's separate pages (PR-05 of
 * docs/design/2026-11-studio-home-episode-command-center.md): which `from`
 * is followed, what is shown for `fromLabel`, and what an address keeps.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { withReturn, readReturn, isReturnPath, tabOrigin, MAX_RETURN_LABEL } from './returnPath';
import { RESUMABLE_TABS } from './activeEpisode';

const EP = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const FALLBACK = { href: `/episodes/${EP}`, text: 'Back to Episode' };
const read = (query, episodeId = EP) => readReturn(new URLSearchParams(query), { episodeId, fallback: FALLBACK });
const asked = (from, label) => `from=${encodeURIComponent(from)}${label == null ? '' : `&fromLabel=${encodeURIComponent(label)}`}`;

describe('returnPath', () => {
  let warn;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  describe('tabOrigin: an episode tab as an origin', () => {
    test('every working tab gives its address and its own label', () => {
      expect(tabOrigin(EP, 'checklist')).toEqual({ from: `/episodes/${EP}?tab=checklist`, fromLabel: 'Checklist' });
      expect(tabOrigin(EP, 'scripts')).toEqual({ from: `/episodes/${EP}?tab=scripts`, fromLabel: 'Script' });
      expect(tabOrigin(EP, 'lookbook')).toEqual({ from: `/episodes/${EP}?tab=lookbook`, fromLabel: 'Style Page' });
      expect(tabOrigin(EP, 'summary')).toEqual({ from: `/episodes/${EP}?tab=summary`, fromLabel: 'Summary' });
      for (const tab of RESUMABLE_TABS) expect(tabOrigin(EP, tab)?.from).toBe(`/episodes/${EP}?tab=${tab}`);
    });

    test('the Overview, a key that is not a tab, and no episode give no origin', () => {
      for (const tab of ['overview', 'brief', 'nope', '', null, undefined, 7]) expect(tabOrigin(EP, tab)).toBeNull();
      expect(tabOrigin(null, 'checklist')).toBeNull();
    });
  });

  describe('withReturn: an address carrying its origin', () => {
    test('the origin is added, encoded', () => {
      expect(withReturn(`/episodes/${EP}/todo`, tabOrigin(EP, 'checklist')))
        .toBe(`/episodes/${EP}/todo?from=${encodeURIComponent(`/episodes/${EP}?tab=checklist`)}&fromLabel=Checklist`);
    });

    test('the address keeps its own parameters and its #anchor', () => {
      const out = withReturn('/episodes/x/edit?step=2&mode=a#details', { from: '/episodes/x?tab=money', fromLabel: 'Money' });
      expect(out).toBe(`/episodes/x/edit?step=2&mode=a&from=${encodeURIComponent('/episodes/x?tab=money')}&fromLabel=Money#details`);
      expect(withReturn('/a#b', { from: '/c' })).toBe('/a?from=%2Fc#b');
    });

    test('no origin, or one that is not a path in this app, adds nothing', () => {
      const href = `/episodes/${EP}/edit`;
      for (const origin of [undefined, {}, null && {}, { from: null }, { from: 'https://evil.example/x' }, { from: '//evil.example' }, { from: '/\\evil.example' }, { from: 'episodes/x' }, { from: '/a\nb' }]) {
        expect(withReturn(href, origin || undefined)).toBe(href);
      }
    });

    test('a label is capped, and one that is only spaces is left out', () => {
      const long = 'x'.repeat(200);
      const out = new URLSearchParams(withReturn('/a', { from: '/b', fromLabel: long }).split('?')[1]);
      expect(out.get('fromLabel')).toHaveLength(MAX_RETURN_LABEL);
      expect(withReturn('/a', { from: '/b', fromLabel: '   ' })).toBe('/a?from=%2Fb');
    });
  });

  describe('readReturn: the way back a page shows', () => {
    test('a tab of this episode: its address, "Back to <label>"', () => {
      expect(read(asked(`/episodes/${EP}?tab=checklist`, 'Checklist'))).toEqual({ href: `/episodes/${EP}?tab=checklist`, text: 'Back to Checklist', origin: true });
    });

    test('what withReturn wrote is what readReturn reads', () => {
      for (const tab of RESUMABLE_TABS) {
        const href = withReturn(`/episodes/${EP}/evaluate`, tabOrigin(EP, tab));
        expect(read(href.split('?')[1]).href).toBe(`/episodes/${EP}?tab=${tab}`);
      }
    });

    test('the origin keeps its own parameters and anchor', () => {
      const from = `/episodes/${EP}?tab=voice&beat=3&line=2#take`;
      expect(read(asked(from, 'Voice')).href).toBe(from);
    });

    test('a path in this app that names no episode is followed', () => {
      expect(read(asked('/shows/show-1/season?tab=episodes', 'Episodes'))).toEqual({ href: '/shows/show-1/season?tab=episodes', text: 'Back to Episodes', origin: true });
    });

    test('no label: "Back"', () => {
      expect(read(asked(`/episodes/${EP}?tab=money`))).toEqual({ href: `/episodes/${EP}?tab=money`, text: 'Back', origin: true });
      expect(read(asked(`/episodes/${EP}?tab=money`, '  \n ')).text).toBe('Back');
    });

    test('no origin: what the page did before', () => {
      for (const query of ['', 'fromLabel=Checklist', 'from=', 'tab=checklist']) {
        expect(read(query)).toEqual({ href: FALLBACK.href, text: FALLBACK.text, origin: false });
      }
      expect(readReturn(null, { episodeId: EP, fallback: FALLBACK }).origin).toBe(false);
    });

    test('another episode\'s path is not followed', () => {
      for (const from of [`/episodes/${OTHER}?tab=checklist`, `/episodes/${OTHER}`, `/episodes/${OTHER}/todo`, `/episodes/${EP}x?tab=checklist`]) {
        expect(read(asked(from, 'Checklist'))).toEqual({ href: FALLBACK.href, text: FALLBACK.text, origin: false });
      }
    });

    test('ids are matched exactly, letter case included', () => {
      expect(read(asked('/episodes/ABC?tab=money'), 'abc').origin).toBe(false);
      expect(read(asked('/episodes/abc?tab=money'), 'abc').origin).toBe(true);
    });

    test('an episode path with no id, or an id that cannot be read, is not followed', () => {
      for (const from of ['/episodes', '/episodes/', '/episodes?tab=checklist', '/episodes/?tab=checklist', '/episodes/%E0%A4%A']) {
        expect(read(asked(from))).toEqual({ href: FALLBACK.href, text: FALLBACK.text, origin: false });
      }
      expect(read(asked(`/episodes/${EP}`), null).origin).toBe(false);
    });

    test('an encoded id that is this episode is followed', () => {
      expect(read(asked('/episodes/ep%201?tab=money'), 'ep 1').origin).toBe(true);
    });

    test('an address outside this app is not followed', () => {
      for (const from of ['https://evil.example/episodes/x', 'http://evil.example', '//evil.example/x', '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c', `episodes/${EP}`, `./episodes/${EP}`, ' /shows', `/episodes/${EP}\n?tab=money`, `/episodes/${EP}\u0000`]) {
        expect(read(asked(from, 'Checklist'))).toEqual({ href: FALLBACK.href, text: FALLBACK.text, origin: false });
      }
    });

    test('the label is text only: it never changes where the link goes', () => {
      for (const label of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '<img src=x onerror=alert(1)>', '/shows']) {
        const out = read(asked(`/episodes/${EP}?tab=checklist`, label));
        expect(out.href).toBe(`/episodes/${EP}?tab=checklist`);
        expect(out.text).toBe(`Back to ${label}`);
      }
      // A label alone, with an origin that is not followed, shows nothing of itself.
      expect(read(asked('https://evil.example', 'Checklist')).text).toBe(FALLBACK.text);
    });

    test('the label is one line and capped', () => {
      expect(read(asked(`/episodes/${EP}?tab=money`, ' Money\n\ttab  ')).text).toBe('Back to Money tab');
      const text = read(asked(`/episodes/${EP}?tab=money`, 'y'.repeat(500))).text;
      expect(text).toBe(`Back to ${'y'.repeat(MAX_RETURN_LABEL)}`);
    });
  });

  describe('isReturnPath', () => {
    test('this episode, or no episode; never another, never outside the app', () => {
      expect(isReturnPath(`/episodes/${EP}?tab=money`, EP)).toBe(true);
      expect(isReturnPath('/shows', EP)).toBe(true);
      expect(isReturnPath('/episodesboard', EP)).toBe(true);
      expect(isReturnPath(`/episodes/${OTHER}`, EP)).toBe(false);
      expect(isReturnPath('//x', EP)).toBe(false);
      for (const v of [null, undefined, 5, {}, '']) expect(isReturnPath(v, EP)).toBe(false);
    });
  });
});
