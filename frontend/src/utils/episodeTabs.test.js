import { describe, test, expect } from 'vitest';
import { resolveEpisodeTab, withEpisodeTab, EP_TABS } from './episodeTabs';

describe('resolveEpisodeTab (audit LINK-04)', () => {
  test('a main tab opens its first sub-tab; a sub-tab opens under its main tab', () => {
    expect(resolveEpisodeTab('overview')).toEqual({ main: 'overview', sub: null, key: 'overview' });
    expect(resolveEpisodeTab('scripts')).toEqual({ main: 'scripts', sub: null, key: 'scripts' });
    expect(resolveEpisodeTab('production')).toEqual({ main: 'production', sub: 'checklist', key: 'production.checklist' });
    expect(resolveEpisodeTab('assets')).toEqual({ main: 'production', sub: 'assets', key: 'production.assets' });
    expect(resolveEpisodeTab('money')).toEqual({ main: 'production', sub: 'money', key: 'production.money' });
    expect(resolveEpisodeTab('wardrobe')).toEqual({ main: 'production', sub: 'wardrobe', key: 'production.wardrobe' });
    expect(resolveEpisodeTab('results')).toEqual({ main: 'results', sub: 'evaluation', key: 'results.evaluation' });
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
