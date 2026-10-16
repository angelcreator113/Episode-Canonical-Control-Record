import { describe, test, expect } from 'vitest';
import { resolveEpisodeTab, withEpisodeTab, EP_TABS } from './episodeTabs';

describe('resolveEpisodeTab (audit LINK-04)', () => {
  test('a main tab opens its first sub-tab; a sub-tab opens under its main tab', () => {
    expect(resolveEpisodeTab('overview')).toEqual({ main: 'overview', sub: null, key: 'overview' });
    expect(resolveEpisodeTab('scripts')).toEqual({ main: 'scripts', sub: null, key: 'scripts' });
    expect(resolveEpisodeTab('production')).toEqual({ main: 'production', sub: 'checklist', key: 'production.checklist' });
    // Evoni, 2026-10-16: Assets is a top tab; ?tab=assets opens it on Scenes.
    expect(resolveEpisodeTab('assets')).toEqual({ main: 'assets', sub: 'scenes', key: 'assets.scenes' });
    expect(resolveEpisodeTab('files')).toEqual({ main: 'assets', sub: 'files', key: 'assets.files' });
    expect(resolveEpisodeTab('money')).toEqual({ main: 'assets', sub: 'money', key: 'assets.money' });
    expect(resolveEpisodeTab('wardrobe')).toEqual({ main: 'assets', sub: 'wardrobe', key: 'assets.wardrobe' });
    expect(resolveEpisodeTab('lookbook')).toEqual({ main: 'assets', sub: 'lookbook', key: 'assets.lookbook' });
    expect(resolveEpisodeTab('results')).toEqual({ main: 'results', sub: 'summary', key: 'results.summary' });
    expect(resolveEpisodeTab('evaluation')).toEqual({ main: 'results', sub: 'evaluation', key: 'results.evaluation' });
    expect(resolveEpisodeTab('story')).toEqual({ main: 'results', sub: 'story', key: 'results.story' });
  });

  test('no tab, an unknown tab and the old brief link all land somewhere with a body', () => {
    expect(resolveEpisodeTab(null)).toEqual({ main: 'production', sub: 'checklist', key: 'production.checklist' });
    expect(resolveEpisodeTab('nope')).toEqual({ main: 'production', sub: 'checklist', key: 'production.checklist' });
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
  test('sits between Wardrobe and Phone under Assets, keeping its key for links', () => {
    const subs = EP_TABS.find((t) => t.key === 'assets').subs;
    const keys = subs.map((s) => s.key);
    expect(keys.slice(keys.indexOf('wardrobe'), keys.indexOf('wardrobe') + 3)).toEqual(['wardrobe', 'lookbook', 'phone']);
    expect(subs.find((s) => s.key === 'lookbook').label).toBe('Style Page');
  });
});

// Evoni, 2026-10-16: Overview, Assets, Script, Production, Results; the
// episode's pieces under Assets; Production is the checklist alone.
describe('the tab layout', () => {
  test('main tabs in order, Assets sub-tabs in order, Production the checklist', () => {
    expect(EP_TABS.map((t) => t.label)).toEqual(['Overview', 'Assets', 'Script', 'Production', 'Results']);
    expect(EP_TABS.find((t) => t.key === 'assets').subs.map((s) => s.label))
      .toEqual(['Scenes', 'Wardrobe', 'Style Page', 'Phone', 'Overlays', 'Money', 'Files']);
    expect(EP_TABS.find((t) => t.key === 'production').subs.map((s) => s.key)).toEqual(['checklist']);
  });
});
