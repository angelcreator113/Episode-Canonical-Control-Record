import { describe, test, expect } from 'vitest';
import { resolveEpisodeTab, withEpisodeTab, EP_TABS, pillsOf, pillGroups, pillFor } from './episodeTabs';

describe('resolveEpisodeTab (audit LINK-04)', () => {
  test('a main tab opens its first sub-tab; a sub-tab opens under its main tab', () => {
    expect(resolveEpisodeTab('overview')).toEqual({ main: 'overview', sub: null, key: 'overview' });
    expect(resolveEpisodeTab('scripts')).toEqual({ main: 'scripts', sub: null, key: 'scripts' });
    // Evoni, 2026-10-17: Production is the workspace and opens on Scenes;
    // the old Assets link lands there too.
    expect(resolveEpisodeTab('production')).toEqual({ main: 'production', sub: 'scenes', key: 'production.scenes' });
    expect(resolveEpisodeTab('assets')).toEqual({ main: 'production', sub: 'scenes', key: 'production.scenes' });
    expect(resolveEpisodeTab('beatplan')).toEqual({ main: 'production', sub: 'beatplan', key: 'production.beatplan' });
    expect(resolveEpisodeTab('checklist')).toEqual({ main: 'production', sub: 'checklist', key: 'production.checklist' });
    expect(resolveEpisodeTab('files')).toEqual({ main: 'production', sub: 'files', key: 'production.files' });
    expect(resolveEpisodeTab('money')).toEqual({ main: 'production', sub: 'money', key: 'production.money' });
    expect(resolveEpisodeTab('wardrobe')).toEqual({ main: 'production', sub: 'wardrobe', key: 'production.wardrobe' });
    expect(resolveEpisodeTab('lookbook')).toEqual({ main: 'production', sub: 'lookbook', key: 'production.lookbook' });
    expect(resolveEpisodeTab('results')).toEqual({ main: 'results', sub: 'summary', key: 'results.summary' });
    expect(resolveEpisodeTab('evaluation')).toEqual({ main: 'results', sub: 'evaluation', key: 'results.evaluation' });
    expect(resolveEpisodeTab('story')).toEqual({ main: 'results', sub: 'story', key: 'results.story' });
  });

  test('no tab, an unknown tab and the old brief link all land somewhere with a body', () => {
    expect(resolveEpisodeTab(null)).toEqual({ main: 'production', sub: 'scenes', key: 'production.scenes' });
    expect(resolveEpisodeTab('nope')).toEqual({ main: 'production', sub: 'scenes', key: 'production.scenes' });
    expect(resolveEpisodeTab('brief')).toEqual({ main: 'overview', sub: null, key: 'overview' });
  });

  test('every tab key resolves to a body key of its own', () => {
    for (const t of EP_TABS) {
      for (const s of t.subs || []) expect(resolveEpisodeTab(s.key).key).toBe(`${t.key}.${s.key}`);
      if (!t.subs) expect(resolveEpisodeTab(t.key).key).toBe(t.key);
    }
  });

  test('withEpisodeTab keeps the page\'s other parameters', () => {
    expect(withEpisodeTab(new URLSearchParams('tab=overview&from=%2Fshows%2F1'), 'money').toString()).toBe('tab=money&from=%2Fshows%2F1');
    expect(withEpisodeTab(new URLSearchParams(''), 'scenes').toString()).toBe('tab=scenes');
  });
});

describe('the Style Page tab (was Lookbook; Tasks #2813, #2876)', () => {
  test('sits between Wardrobe and Phone under Production, keeping its key for links', () => {
    const subs = EP_TABS.find((t) => t.key === 'production').subs;
    const keys = subs.map((s) => s.key);
    expect(keys.slice(keys.indexOf('wardrobe'), keys.indexOf('wardrobe') + 3)).toEqual(['wardrobe', 'lookbook', 'phone']);
    expect(subs.find((s) => s.key === 'lookbook').label).toBe('Style Page');
  });
});

// Evoni, 2026-10-17: Overview, Script, Production, Results; Production is
// the workspace with the episode's pieces, the checklist last.
describe('the tab layout', () => {
  test('main tabs in order, Production sub-tabs in order', () => {
    expect(EP_TABS.map((t) => t.label)).toEqual(['Overview', 'Script', 'Production', 'Results']);
    const production = EP_TABS.find((t) => t.key === 'production');
    expect(production.subs.map((s) => s.label))
      .toEqual(['Scenes', 'Plan', 'Files', 'Wardrobe', 'Style Page', 'Phone', 'Overlays', 'Money', 'Checklist']);
    // Evoni, 2026-10-22: Beat Plan is Scenes' Plan view; the pills in four groups.
    expect(pillsOf(production).map((s) => s.label)).toEqual(['Scenes', 'Files', 'Wardrobe', 'Style Page', 'Phone', 'Overlays', 'Money', 'Checklist']);
    expect(pillGroups(production).map((g) => [g.group, g.pills.map((p) => p.key)])).toEqual([
      ['Make', ['scenes', 'files']], ['Look', ['wardrobe', 'lookbook']], ['On screen', ['phone', 'overlays']], ['Track', ['money', 'checklist']],
    ]);
    expect(pillFor(production, 'beatplan')).toBe('scenes');
    expect(pillFor(production, 'files')).toBe('files');
    // Evoni, 2026-10-22 (Results layout): the evaluation is part of Summary.
    const results = EP_TABS.find((t) => t.key === 'results');
    expect(pillsOf(results).map((s) => s.label)).toEqual(['Summary', 'Story', 'Distribution']);
    expect(pillFor(results, 'evaluation')).toBe('summary');
    expect(resolveEpisodeTab('evaluation')).toEqual({ main: 'results', sub: 'evaluation', key: 'results.evaluation' });
  });
});
