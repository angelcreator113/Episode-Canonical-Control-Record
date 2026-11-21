/**
 * The way back from an episode's separate pages (PR-05 of
 * docs/design/2026-11-studio-home-episode-command-center.md): the Run Sheet,
 * Evaluate and Edit details return to the tab they were opened from.
 *
 * It is the hand-off Scene Sets already has (utils/sceneSets.js): the
 * address carries `from` (a path in this app) and `fromLabel` (words for
 * the link). Nothing is stored, so there is no history of its own, no
 * browser key and no request: a page with no `from` behaves as it always
 * did.
 *
 * `from` is only followed when it is a path in this app (isAppPath) and,
 * where it names an episode, that episode is the one the page is for.
 * `fromLabel` is only ever shown as text; it never decides where a link
 * goes.
 */
import { isAppPath } from './sceneSets';
import { EP_TABS, DEFAULT_EP_TAB } from './episodeTabs';

/** The longest `fromLabel` shown. */
export const MAX_RETURN_LABEL = 40;

/** The label as it is shown: one line, trimmed, capped; null when there is nothing to show. */
function cleanLabel(value) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_RETURN_LABEL).trim();
  return text || null;
}

/**
 * The episode a path is about ("/episodes/<id>…"): its id, null when the
 * path is not an episode's, and undefined when the id cannot be read.
 */
function episodeOfPath(path) {
  const m = /^\/episodes\/([^/?#]*)/.exec(path);
  if (!m) return /^\/episodes(?:[?#]|$)/.test(path) ? undefined : null;
  if (!m[1]) return undefined;
  try {
    return decodeURIComponent(m[1]);
  } catch (err) {
    console.warn('[returnPath] origin not read:', err?.message);
    return undefined;
  }
}

/**
 * Whether `from` can be followed from a page of this episode: a path in
 * this app that names no episode, or names this one.
 */
export function isReturnPath(from, episodeId) {
  if (!isAppPath(from)) return false;
  const named = episodeOfPath(from);
  if (named === null) return true;
  return named !== undefined && episodeId != null && named === String(episodeId);
}

/**
 * `href` carrying where it was opened from. The address's own parameters
 * and its #anchor are kept. An origin that is not a path in this app adds
 * nothing.
 */
export function withReturn(href, { from = null, fromLabel = null } = {}) {
  if (typeof href !== 'string' || !isAppPath(from)) return href;
  const hashAt = href.indexOf('#');
  const path = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const label = cleanLabel(fromLabel);
  const extra = `from=${encodeURIComponent(from)}${label ? `&fromLabel=${encodeURIComponent(label)}` : ''}`;
  return `${path}${path.includes('?') ? '&' : '?'}${extra}${hash}`;
}

/**
 * An episode tab as an origin, { from, fromLabel }, or null for the
 * Overview (a page with no origin already returns there) and for a key
 * that is not a tab.
 */
export function tabOrigin(episodeId, tab) {
  if (!episodeId || typeof tab !== 'string' || tab === DEFAULT_EP_TAB) return null;
  for (const t of EP_TABS) {
    const found = t.key === tab ? t : t.subs?.find((s) => s.key === tab);
    if (found) return { from: `/episodes/${encodeURIComponent(episodeId)}?tab=${found.key}`, fromLabel: found.label };
  }
  return null;
}

/**
 * The way back for a page of this episode, { href, text, origin }: the
 * address's `from` when it can be followed (isReturnPath), else `fallback`
 * ({ href, text }), which is what the page did before.
 */
export function readReturn(searchParams, { episodeId, fallback }) {
  const from = searchParams?.get?.('from') ?? null;
  if (!isReturnPath(from, episodeId)) return { href: fallback.href, text: fallback.text, origin: false };
  const label = cleanLabel(searchParams.get('fromLabel'));
  return { href: from, text: label ? `Back to ${label}` : 'Back', origin: true };
}
