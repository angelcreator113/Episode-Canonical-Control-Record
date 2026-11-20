/**
 * Producer Mode's six tabs, as one navigation for the pages that belong to
 * it (Evoni, 2026-11-20): Producer Mode itself (pages/WorldAdmin) and the
 * Season page (pages/SeasonPage), so the other five stay in reach while a
 * season is open.
 *
 * PRODUCER_TABS is the one list. Producer Mode adds its own sub-tabs to it
 * (WorldAdmin's TABS); nothing else defines these six.
 *
 * Props:
 *   showId    the show, kept in every address.
 *   active    the open tab's key ('season-page' on the Season page).
 *   onSelect  Producer Mode's own switch: with it, the five tabs that are
 *             its own are buttons that switch in place, as they always have.
 *             Without it (the Season page) they are links to Producer Mode
 *             on that tab, at the address the switch itself writes.
 *   counts    { [key]: number } waiting, drawn on a tab. Producer Mode
 *             passes the one it has already read; the Season page passes
 *             none, so opening a season reads nothing for this bar.
 *
 * Nothing is read or written here.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CalendarRange, Gem, Crown, Globe2, Heart } from 'lucide-react';
import useSideScroll from '../../hooks/useSideScroll';
import { seasonPageHref } from '../../lib/seasonPage';
import '../../pages/WorldAdmin.css';

// `landing` is the ?tab= Producer Mode opens the tab on: its first sub-tab, or the tab itself.
export const PRODUCER_TABS = [
  { key: 'overview', Icon: Sparkles, label: 'Overview', landing: 'overview' },
  { key: 'season-page', Icon: CalendarRange, label: 'Season', page: 'season' },
  { key: 'wardrobe', Icon: Gem, label: 'Assets', landing: 'scene-sets' },
  { key: 'characters', Icon: Crown, label: 'Cast & Continuity', landing: 'characters-list' },
  { key: 'world', Icon: Globe2, label: 'World', landing: 'feed' },
  { key: 'release', Icon: Heart, label: 'Release', landing: 'release-next' },
];

/** A tab's own address: the Season page, or Producer Mode opened on that tab. */
export function producerTabHref(showId, key) {
  const tab = PRODUCER_TABS.find((t) => t.key === key);
  if (!tab) return null;
  if (tab.page === 'season') return seasonPageHref(showId);
  return `/shows/${encodeURIComponent(showId)}/world?tab=${encodeURIComponent(tab.landing)}`;
}

export default function ProducerNav({ showId, active = null, onSelect = null, counts = null }) {
  const [scrollRef, , scrollClass] = useSideScroll();
  const barRef = useRef(null);
  const setRefs = (el) => { barRef.current = el; scrollRef(el); };

  // The open tab is brought into view when the row is wider than the screen (a phone).
  useEffect(() => {
    const bar = barRef.current;
    const on = bar?.querySelector('[aria-current="page"]');
    if (!bar || !on || bar.scrollWidth <= bar.clientWidth) return;
    const left = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
    bar.scrollLeft = Math.max(0, left);
  }, [active]);

  return (
    <nav className={`wa-tab-bar ${scrollClass}`} ref={setRefs} aria-label="Producer Mode" data-testid="producer-nav">
      {PRODUCER_TABS.map((t) => {
        const on = active === t.key;
        const n = counts?.[t.key] || 0;
        const inner = (
          <>
            <t.Icon size={15} aria-hidden="true" />
            <span className="wa-tab-label">{t.label}</span>
            {n > 0 && <span className="wa-tab-count" aria-label={`${n} waiting`}>{n}</span>}
          </>
        );
        const className = `wa-tab${on ? ' active' : ''}`;
        // Season is a page of its own, so its entry is always a link; so is every entry seen from outside Producer Mode.
        if (t.page === 'season' || !onSelect) {
          return (
            <Link key={t.key} to={producerTabHref(showId, t.key)} className={className} aria-current={on ? 'page' : undefined}
              data-testid={t.page === 'season' ? 'wa-tab-season' : `wa-tab-${t.key}`}>
              {inner}
            </Link>
          );
        }
        return (
          <button key={t.key} type="button" onClick={() => onSelect(t.key)} className={className} aria-current={on ? 'page' : undefined}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
