/**
 * The episode page's tabs (audit LINK-04, 2026-10-03): one parser for the
 * URL's ?tab=, used for clicks, shortcuts, deep links and history alike.
 * The URL is the only tab state, so Back/Forward, a legacy link and a
 * button all land on the same tab with the same body.
 */

// Four main tabs with sub-tabs. Brief was merged into Overview — the
// snapshot flows inline under Identity / Source / Stakes / Reference
// bands instead of living on its own tab.
export const EP_TABS = [
  { key: 'overview', icon: '📋', label: 'Overview' },
  { key: 'scripts', icon: '📝', label: 'Script' },
  // Evoni's Episode mock (2026-10-05): the checklist hub first, then the
  // pieces it tracks in its order; Assets, which the mock leaves out, stays
  // as the last pill (her ruling).
  { key: 'production', icon: '🎬', label: 'Production', subs: [
    { key: 'checklist', label: 'Checklist' },
    { key: 'scenes', label: 'Scenes' },
    { key: 'wardrobe', label: 'Wardrobe' },
    { key: 'phone', label: 'Phone' },
    // P15: every on-screen piece of the episode.
    { key: 'overlays', label: 'Overlays' },
    { key: 'money', label: 'Money' },
    { key: 'assets', label: 'Assets' },
  ]},
  { key: 'results', icon: '👑', label: 'Results', subs: [
    { key: 'evaluation', label: 'Evaluation' },
    { key: 'story', label: 'Story' },
    { key: 'distribution', label: 'Distribution' },
  ]},
];

/** Where the page opens with no ?tab=, and where an unknown one lands. */
export const DEFAULT_EP_TAB = 'checklist';

// Old ?tab= values, kept working.
const ALIASES = {
  // Brief was merged into Overview — old links land back on Overview.
  brief: 'overview',
};

/**
 * ?tab= → { main, sub, key }: a main tab's key opens its first sub-tab; a
 * sub-tab's key opens it under its main tab; anything else is the default.
 * key is `main` for a tab without sub-tabs, `main.sub` otherwise, so each
 * tab body checks one equality.
 */
function findEpisodeTab(tab) {
  for (const t of EP_TABS) {
    if (t.key === tab) {
      const sub = t.subs?.[0]?.key || null;
      return { main: t.key, sub, key: sub ? `${t.key}.${sub}` : t.key };
    }
    const sub = t.subs?.find((s) => s.key === tab);
    if (sub) return { main: t.key, sub: sub.key, key: `${t.key}.${sub.key}` };
  }
  return null;
}

export function resolveEpisodeTab(tabParam) {
  return findEpisodeTab(ALIASES[tabParam] || tabParam) || findEpisodeTab(DEFAULT_EP_TAB);
}

/** The URL for a tab, keeping the page's other parameters (a way back, a focus). */
export function withEpisodeTab(params, tab) {
  const next = new URLSearchParams(params);
  next.set('tab', tab);
  return next;
}
