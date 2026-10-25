/**
 * The Season page (Evoni's mockup, 2026-10-25). Route: /shows/:showId/season,
 * reached from Producer Mode's banner (its Season entry) and every in-app
 * link to the season (lib/seasonPage seasonPageHref); Producer Mode's old
 * Season Plan tab, ?tab=season and ?tab=goals, redirect here.
 *
 * The season, laid out to read: the hero (the
 * cover from Files, "SEASON N", the title, tagline and chips; Edit season and
 * a ⋯ menu), four stat cards (episode slots, goals, events, Lala's budget
 * from the ledger), and eight tabs addressed by `?tab=` (lib/seasonPage
 * SEASON_TABS), each opening on a one-line note of what it is for:
 * Overview, Roadmap, Episodes (the production board, from Producer Mode),
 * Events (the event library, from Producer Mode's ?tab=events: In this
 * season · Not placed yet · All), Opportunities (from Producer Mode), Story, Goals (Lala's career
 * goals and the brands she has worked with, from the Season Plan) and
 * Results (the Episode Ledger, from Producer Mode, then Planning Insights).
 * Producer Mode's old ?tab=episodes, episodes-production, episodes-ledger,
 * opportunities and events (with &event=<id>, which opens that event's
 * editor here) links open these tabs (WorldAdmin SEASON_PAGE_KEYS).
 *
 * Everything is read and written through the Season Plan's own pieces
 * (components/Show/SeasonPlan: useSeasonPlan, the roadmap controls, SlotPanel,
 * the threads card, Planning Insights; SeasonSetup's form, placement, draft
 * and checklist).
 *
 * What is waiting (Evoni, 2026-10-25, "I want them all"): the Overview
 * opens on "Needs attention" (components/Show/SeasonAttention, ranked by
 * lib/seasonAttention), the tabs carry small counts of the same things
 * (Events "17 need setup", Goals "2 gaps", Episodes "1 due Sunday",
 * Opportunities "1 held"), the stat cards open their tab and a fifth says
 * the next release; Episodes and Results show this season's episodes
 * (`?seasons=all` shows every season's); a show with two or more seasons
 * gets a season switcher in the hero (`?season=N`), and a past season reads
 * as it was, without the setup actions that write the season in progress.
 * The page reads the goal coverage, the release schedule and the
 * opportunities once, for the list, the counts and the card together.
 *
 * Colours: the mockup's pinks and purples, page-scoped (--sp-* in
 * SeasonPage.css). Text is plum or ink; pink is for fills and accents.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Clapperboard, Target, CalendarHeart, Coins as CoinsIcon, MoreHorizontal, Pencil, ArrowLeft, CalendarClock, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { fetchAllEpisodes } from '../lib/fetchAllPages';
import { useSeasonPlan, SeasonLoadError, BalanceTrend, coins, signedCoins } from '../components/Show/SeasonPlan';
import { SeasonSetupForm, SeasonPlacement, SeasonDraft, formFromArc } from '../components/Show/SeasonSetup';
import { PLAN_S } from '../components/Show/planStyles';
import { SeasonBar as Bar } from '../components/Show/SeasonPageParts';
import { SeasonOverviewTab, SeasonStoryTab, SeasonResultsTab } from '../components/Show/SeasonPageOverview';
import { SeasonRoadmapTab, SeasonEventsTab } from '../components/Show/SeasonPageRoadmap';
import ShowEpisodesBoard from '../components/Show/ShowEpisodesBoard';
import OpportunitiesTab from '../components/Show/OpportunitiesTab';
import { S as PRODUCER_S } from '../components/Show/producerStyles';
import CareerGoals, { NarrativeDebt, SeasonPhasesHistory } from '../components/Show/CareerGoals';
import CareerBrands from '../components/Career/CareerBrands';
import { SEASON_TABS, tabFrom, seasonStats, heroChips, slotsLine, goalsLine, eventsLine, seasonPageHref } from '../lib/seasonPage';
import { useReleaseSchedule, nextReleaseOf } from '../lib/releaseSchedule';
import { useGoalCoverage } from '../lib/goalCoverage';
import { attentionItems, tabBadges, seasonEpisodes, showsAllSeasons, ALL_SEASONS_PARAM } from '../lib/seasonAttention';
import './SeasonPage.css';

const S = PLAN_S;
// The tabs a show without a season still has (they read the show, not the
// season); Events is the whole event library there.
const SEASONLESS_TABS = ['episodes', 'events', 'opportunities', 'results'];


/** The release card's lines: "Sun, Nov 1 · E3", or "Not releasing yet". */
function NextReleaseCard({ next, href }) {
  return (
    <Link className="szn-stat is-link is-release" to={href} data-testid="szn-stat-release">
      <span className="szn-stat-icon is-purple" aria-hidden="true"><CalendarClock size={22} /></span>
      <div className="szn-stat-body">
        <span className="szn-stat-label is-top">Next release</span>
        {!next ? <span className="szn-stat-line">Reading the schedule…</span>
          : next.state === 'next' ? (
            <span className="szn-stat-num is-release" data-testid="szn-next-release">
              {next.text}{next.code && <small> · {next.code}</small>}
            </span>
          ) : <span className="szn-stat-num is-release is-none" data-testid="szn-next-release-none">{next.text}</span>}
      </div>
      <span className="szn-stat-line">{next?.overdue ? <span className="is-neg">Overdue</span> : 'Release schedule'}<ChevronRight size={14} aria-hidden="true" /></span>
      <span className="szn-sr">: open the Release tab</span>
    </Link>
  );
}

/** One stat card: a link to its tab, or (without hrefFor, an older caller) plain, as before. */
function StatCard({ hrefFor, tab, className, testId, label, children }) {
  return hrefFor
    ? <Link className={`${className} is-link`} to={hrefFor(tab)} data-testid={testId}>{children}<span className="szn-sr">{label}</span></Link>
    : <article className={className} data-testid={testId}>{children}</article>;
}

/**
 * The stat cards (the mockup's row under the hero), each opening its tab:
 * Episode Slots → Roadmap, Season Goals → Goals, Major Events → Events, the
 * budget → Results (Planning Insights' money); then Next release → Producer
 * Mode's Release tab. hrefFor(tab) is the tab's address on this page.
 */
export function SeasonStats({ stats, hrefFor = null, nextRelease = undefined, releaseHref = null, goalsAreCurrent = false }) {
  const b = stats.budget;
  return (
    <section className={`szn-stats${nextRelease !== undefined ? ' has-five' : ''}`} aria-label="The season at a glance" data-testid="szn-stats">
      <StatCard hrefFor={hrefFor} tab="roadmap" className="szn-stat" testId="szn-stat-slots" label=": open the Roadmap">
        <span className="szn-stat-icon" aria-hidden="true"><Clapperboard size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-num">{stats.slots.total}</span>
          <span className="szn-stat-label">Episode Slots</span>
        </div>
        <Bar done={stats.slots.done} total={stats.slots.total} label="Episode slots done" />
        <span className="szn-stat-line">{slotsLine(stats)}</span>
      </StatCard>
      <StatCard hrefFor={hrefFor} tab="goals" className="szn-stat" testId="szn-stat-goals" label=": open Goals">
        <span className="szn-stat-icon is-gold" aria-hidden="true"><Target size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-num">{stats.goals.total}</span>
          {/* Goals are the show's, not kept per season: a past season says so rather than claim them. */}
          <span className="szn-stat-label">{goalsAreCurrent ? 'Goals now' : 'Season Goals'}</span>
        </div>
        <Bar done={stats.goals.done} total={stats.goals.total} label="Season goals complete" />
        <span className="szn-stat-line" data-testid="szn-stat-goals-line">{goalsAreCurrent ? `The season in progress: ${goalsLine(stats)}` : goalsLine(stats)}</span>
      </StatCard>
      <StatCard hrefFor={hrefFor} tab="events" className="szn-stat" testId="szn-stat-events" label=": open Events">
        <span className="szn-stat-icon is-purple" aria-hidden="true"><CalendarHeart size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-num">{stats.events.scheduled}</span>
          <span className="szn-stat-label">Major Events</span>
        </div>
        <Bar done={stats.events.scheduled} total={stats.slots.total} label="Slots with an event or episode" />
        <span className="szn-stat-line">{eventsLine(stats)}</span>
      </StatCard>
      {/* Prime Budget: Lala's coins from the ledger, never cost_coins (Planning Insights' money). */}
      <StatCard hrefFor={hrefFor} tab="results" className="szn-stat is-budget" testId="szn-stat-budget" label=": open Results">
        <span className="szn-stat-icon is-gold" aria-hidden="true"><CoinsIcon size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-label is-top">Prime Budget</span>
          {!b ? (
            <span className="szn-stat-line" data-testid="szn-budget-missing">The ledger could not be read.</span>
          ) : !b.has_ledger ? (
            <span className="szn-stat-line" data-testid="szn-budget-empty">No ledger rows yet: nothing earned or spent.</span>
          ) : (
            <span className="szn-stat-num" data-testid="szn-budget-balance">{coins(b.balance)} <small>balance</small></span>
          )}
        </div>
        {b?.has_ledger && b.trend.length >= 2 && (
          <span className="szn-spark" data-testid="szn-budget-trend"><BalanceTrend trend={b.trend} /></span>
        )}
        {b?.has_ledger && (
          <span className="szn-stat-line szn-budget-line" data-testid="szn-budget-season">
            This season: {coins(b.spend)} spend · {coins(b.income)} income · <span className={b.net < 0 ? 'is-neg' : ''}>{signedCoins(b.net)} net</span>
          </span>
        )}
      </StatCard>
      {nextRelease !== undefined && <NextReleaseCard next={nextRelease} href={releaseHref} />}
    </section>
  );
}

/**
 * The season switcher (2026-10-25, before Season 2): one pill per season
 * when the show has two or more, the one shown pressed, the one in progress
 * marked. Picking one changes `?season=` (the one in progress clears it).
 */
export function SeasonSwitcher({ seasons = [], arc, currentArcId, onPick }) {
  if ((seasons || []).length < 2) return null;
  const sorted = [...seasons].sort((a, b) => a.season_number - b.season_number);
  return (
    <nav className="szn-switch" aria-label="Seasons" data-testid="szn-season-switcher">
      {sorted.map((x) => {
        const on = x.id === arc?.id;
        const current = x.id === currentArcId;
        return (
          <button key={x.id} type="button" className={`szn-switch-btn${on ? ' is-on' : ''}`} aria-pressed={on}
            onClick={() => onPick(current ? null : x.season_number)} data-testid={`szn-season-${x.season_number}`}
            title={x.title || undefined}>
            Season {x.season_number}
            {current ? <span className="szn-switch-tag">Now</span> : x.status === 'completed' ? <span className="szn-switch-tag is-done">Done</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

/** "This season" or "All seasons" on the Episodes and Results tabs (`?seasons=all`). */
export function SeasonScopeToggle({ all, seasonNumber, shown, total, onChange }) {
  return (
    <div className="szn-scope" data-testid="szn-scope">
      <span className="szn-scope-line" data-testid="szn-scope-line">
        {all ? `Every season: ${total} ${total === 1 ? 'episode' : 'episodes'}` : `Season ${seasonNumber}: ${shown} of ${total} ${total === 1 ? 'episode' : 'episodes'}`}
      </span>
      <label className="szn-scope-toggle">
        <input type="checkbox" checked={all} onChange={(e) => onChange(e.target.checked)} data-testid="szn-scope-all" />
        <span>Show all seasons</span>
      </label>
    </div>
  );
}

/**
 * Goals: Lala's career goals (their own editor, sync, suggestions and seed),
 * the brands she has worked with, the narrative debt and the phases with
 * their goals and history. A goal change reloads the page's goals, so the
 * stat card and the Overview count it at once.
 */
export function SeasonGoalsTab({ plan, api, showId, arc }) {
  return (
    <div className="szn-goals" data-testid="szn-goals">
      <CareerGoals showId={showId} api={api} goals={plan.goals} onChanged={plan.loadGoals} loadError={plan.failed.goals || null} />
      <CareerBrands showId={showId} />
      <NarrativeDebt debt={arc?.narrative_debt || []} />
      <SeasonPhasesHistory arc={arc} goals={plan.goals} />
    </div>
  );
}

/**
 * Episodes: the production board, as Producer Mode had it (its Episodes ›
 * Production), with this season's episodes unless `?seasons=all`; the
 * board's open slots are this season's (the page's roadmap).
 */
export function SeasonEpisodesTab({ showId, episodes, episodesTotal, reloadShowData, scope, roadmap }) {
  return (
    <>
      {scope}
      <ShowEpisodesBoard showId={showId} episodes={episodes} total={episodesTotal} onChanged={reloadShowData} roadmap={roadmap} />
    </>
  );
}

/** Opportunities: a brand's offers and bookings (Producer Mode's old Opportunities tab). */
export function SeasonOpportunitiesTab({ showId, api, setToast, episodes, reloadShowData }) {
  return <OpportunitiesTab showId={showId} api={api} S={PRODUCER_S} setToast={setToast} loadData={reloadShowData} episodes={episodes} />;
}

/** The hero's ⋯ menu: the season's other actions. */
function HeroMenu({ arc, nextSeason, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  const complete = arc?.status === 'completed';
  const pick = (panel) => { setOpen(false); onPick(panel); };
  return (
    <div className="szn-menu-wrap" ref={ref}>
      <button type="button" className="szn-hero-more" aria-label="More season actions" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} data-testid="szn-hero-more">
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="szn-menu" role="menu" data-testid="szn-hero-menu">
          <button type="button" role="menuitem" disabled={complete} onClick={() => pick('place')}>Use events and episodes</button>
          <button type="button" role="menuitem" disabled={complete} onClick={() => pick('draft')}>Draft with AI</button>
          <button type="button" role="menuitem" disabled={!complete} onClick={() => pick('new')}
            title={complete ? undefined : 'Once this season is complete'}>
            Start Season {nextSeason}{complete ? '' : ' (when this one is complete)'}
          </button>
        </div>
      )}
    </div>
  );
}

export function SeasonHero({ arc, roadmap, showName, nextSeason, onEdit, onPick, readOnly = false, switcher = null }) {
  const cover = arc?.cover_url || null;
  return (
    <header className={`szn-hero${cover ? ' has-cover' : ''}`} data-testid="szn-hero"
      style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
      <div className="szn-hero-shade">
        {showName && <p className="szn-hero-show">{showName}</p>}
        <p className="szn-hero-eyebrow">Season {arc?.season_number || 1}</p>
        <h1 className="szn-hero-title">{arc?.title}</h1>
        {arc?.tagline && <p className="szn-hero-tagline">{arc.tagline}</p>}
        <ul className="szn-hero-chips" aria-label="The season">
          {heroChips({ roadmap, arc }).map((c) => <li key={c}>{c}</li>)}
          {arc?.status === 'completed' && <li className="is-done">Complete</li>}
        </ul>
        {switcher}
        {/* A past season is read here; its setup actions would write the season in progress. */}
        {!readOnly && (
          <div className="szn-hero-actions">
            <button type="button" className="szn-btn" onClick={onEdit} data-testid="szn-edit-season">
              <Pencil size={16} aria-hidden="true" /> Edit Season
            </button>
            <HeroMenu arc={arc} nextSeason={nextSeason} onPick={onPick} />
          </div>
        )}
      </div>
    </header>
  );
}

export default function SeasonPage() {
  const { showId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get('tab'));
  // ?season=N: another season of the show (the switcher); absent is the one in progress.
  const season = /^[1-9]\d{0,2}$/.test(params.get('season') || '') ? params.get('season') : null;
  const [toast, setToast] = useState(null);
  const plan = useSeasonPlan({ showId, api, setToast, season });
  const { arc, roadmap, goals, insights, panel, setPanel, setupNote, setSetupNote, loading, nextSeason, isCurrent } = plan;
  const [showName, setShowName] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesTotal, setEpisodesTotal] = useState(null);
  const [events, setEvents] = useState([]);
  // The opportunities, once, for "Needs attention" and the tab's count (the tab reads its own).
  const [opps, setOpps] = useState([]);
  // Whether the events and episodes have been read, and which reads failed:
  // the Events tab's library uses these instead of fetching its own.
  const [showData, setShowData] = useState({ loaded: false, failed: [] });
  const panelRef = useRef(null);
  const tabsRef = useRef(null);

  // The show's name for the hero, and its episodes and events for the cards'
  // pictures, the slot panel, the production board and the ledger (the same
  // reads as Producer Mode); the board and Opportunities reload them.
  const loadShowData = useCallback(async () => {
    const failed = [];
    await Promise.all([
      api.get(`/api/v1/shows/${showId}`).then((r) => setShowName(r.data?.data?.name || r.data?.name || null))
        .catch((err) => console.error('[SeasonPage] show load failed:', err)),
      fetchAllEpisodes(api, showId).then((list) => { setEpisodes(list.items || []); setEpisodesTotal(list.total ?? (list.items || []).length); })
        .catch((err) => { console.error('[SeasonPage] episodes load failed:', err); failed.push('episodes'); }),
      api.get(`/api/v1/world/${showId}/events`).then((r) => setEvents(r.data?.events || []))
        .catch((err) => { console.error('[SeasonPage] events load failed:', err); failed.push('events'); }),
      api.get(`/api/v1/opportunities/${showId}`).then((r) => setOpps(r.data?.opportunities || []))
        .catch((err) => console.error('[SeasonPage] opportunities load failed:', err)),
    ]);
    setShowData({ loaded: true, failed: failed.sort().reverse() });
  }, [showId]);
  useEffect(() => { loadShowData(); }, [loadShowData]);
  // The release schedule and the goal coverage, read once for the list, the
  // counts, the Next release card and the Overview's Releases line; a slot
  // change (the roadmap) reloads them.
  const release = useReleaseSchedule({ api, showId, reloadKey: roadmap });
  const coverage = useGoalCoverage({ api, showId, reloadKey: roadmap });

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const goTab = useCallback((key, extra = {}) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', key);
      // A need's "Add a deal" company opens the Opportunities form once, not on every return.
      if (key !== 'opportunities') next.delete('deal_with');
      for (const [k, v] of Object.entries(extra)) {
        if (v == null || v === 'all') next.delete(k); else next.set(k, String(v));
      }
      return next;
    });
  }, [setParams]);

  const openPanel = useCallback((name) => {
    setSetupNote(null);
    setPanel(name);
  }, [setPanel, setSetupNote]);
  // The form or preview opens under the hero, scrolled into view.
  useEffect(() => {
    if (panel) panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [panel]);

  // On a phone the tab row scrolls sideways: keep the open tab in sight
  // (an old link to Results otherwise opens with its tab off the edge).
  useEffect(() => {
    const nav = tabsRef.current;
    const on = nav?.querySelector('.szn-tab.is-on');
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2);
  }, [tab, loading, arc]);

  const stats = useMemo(() => seasonStats({ roadmap, goals, insights }), [roadmap, goals, insights]);
  const seasonNumber = roadmap?.season_number ?? arc?.season_number ?? null;
  const sources = { showId, arc, roadmap, events, episodes, coverage: coverage.data, release: release.view, opps, isCurrent };
  const attention = useMemo(() => (arc ? attentionItems(sources) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showId, arc, roadmap, events, episodes, coverage.data, release.view, opps, isCurrent]);
  const badges = useMemo(() => (arc ? tabBadges(sources) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arc, roadmap, events, episodes, coverage.data, release.view, opps, isCurrent]);
  const nextRelease = useMemo(() => nextReleaseOf(release.view, seasonNumber), [release.view, seasonNumber]);

  // Episodes and Results: this season's episodes unless "Show all seasons".
  const allSeasons = showsAllSeasons(params);
  const inSeason = useMemo(() => seasonEpisodes(episodes, { arc, roadmap }), [episodes, arc, roadmap]);
  const scopedEpisodes = arc && !allSeasons ? inSeason : episodes;

  // A tab's address, keeping the season shown.
  const hrefFor = useCallback((link) => {
    if (link?.href) return link.href;
    return seasonPageHref(showId, link?.tab || link, { ...(link?.extra || {}), season });
  }, [showId, season]);
  const pickSeason = useCallback((n) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (n == null) next.delete('season'); else next.set('season', String(n));
      // A slot or event from the other season means nothing here.
      next.delete('slot');
      next.delete('event');
      return next;
    });
  }, [setParams]);
  const setAllSeasons = useCallback((on) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (on) next.set(ALL_SEASONS_PARAM, 'all'); else next.delete(ALL_SEASONS_PARAM);
      return next;
    });
  }, [setParams]);

  if (loading) return <div className="szn-page"><p className="szn-loading" role="status">Loading the season…</p></div>;

  const back = (
    <Link className="szn-back" to={`/shows/${showId}/world?tab=overview`} data-testid="szn-back">
      <ArrowLeft size={16} aria-hidden="true" /> Producer Mode
    </Link>
  );

  const tabProps = {
    plan, S, api, showId, setToast, episodes, episodesTotal, events, arc, roadmap, stats, goTab, params, setParams, showData,
    reloadShowData: loadShowData,
    onEdit: () => openPanel('edit'), onPanel: openPanel,
    release, attention, hrefFor, readOnly: !isCurrent,
  };
  // The Episodes and Results tabs read this season's episodes (or every season's).
  const scope = arc ? (
    <SeasonScopeToggle all={allSeasons} seasonNumber={seasonNumber || 1} shown={inSeason.length} total={episodes.length} onChange={setAllSeasons} />
  ) : null;
  const scopedProps = arc ? { ...tabProps, episodes: scopedEpisodes, episodesTotal: allSeasons ? episodesTotal : null, scope } : tabProps;

  const tabBar = (tabs, counts = {}) => (
    <nav className="szn-tabs" role="tablist" aria-label="Season sections" ref={tabsRef}>
      {tabs.map((t) => {
        const badge = counts[t.key];
        return (
          <button key={t.key} type="button" role="tab" id={`szn-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="szn-tabpanel"
            className={`szn-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => goTab(t.key)} data-testid={`szn-tab-${t.key}`}>
            <span className="szn-tab-label">{t.label}</span>
            {/* What is waiting there; on a phone the number alone. */}
            {badge && (
              <span className={`szn-tab-badge is-${badge.tone}`} data-testid={`szn-tab-badge-${t.key}`} aria-label={`(${badge.text})`}>
                <span aria-hidden="true">{badge.count}</span>
                <span className="szn-tab-badge-text" aria-hidden="true">{badge.text.replace(/^\d+\s*/, '')}</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
  const note = <p className="szn-tab-note" data-testid="szn-tab-note">{SEASON_TABS.find((t) => t.key === tab)?.note}</p>;

  // No season yet: the setup, and the tabs that need no season (the
  // production board, opportunities, the ledger), so Producer Mode's old
  // Episodes, Opportunities and Results links still land somewhere useful.
  if (!arc) {
    const open = SEASONLESS_TABS.includes(tab) ? tab : 'overview';
    return (
      <div className="szn-page" data-testid="season-page">
        {back}
        <SeasonLoadError plan={plan} />
        {toast && <p className="szn-note" role="status" data-testid="szn-toast">{toast}</p>}
        {!plan.failed.season && tabBar([{ key: 'overview', label: 'Set up the season' }, ...SEASON_TABS.filter((t) => SEASONLESS_TABS.includes(t.key))])}
        <section id="szn-tabpanel" role="tabpanel" aria-labelledby={`szn-tab-${open}`} className="szn-tabpanel" data-testid={`szn-panel-${open}`}>
          {open !== 'overview' && note}
          {open === 'episodes' && <SeasonEpisodesTab {...tabProps} />}
          {open === 'events' && <SeasonEventsTab {...tabProps} />}
          {open === 'opportunities' && <SeasonOpportunitiesTab {...tabProps} />}
          {open === 'results' && <SeasonResultsTab {...tabProps} />}
          {open === 'overview' && !plan.failed.season && (
            <>
              <section className="szn-empty" data-testid="szn-empty">
                <h1 className="szn-empty-title">No season set up yet</h1>
                <p>Name the season and its three parts, then place the episodes and events you already have.</p>
              </section>
              <SeasonSetupForm mode="create" showId={showId} seasonNumber={nextSeason} onSubmit={plan.handleSeed} />
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="szn-page" data-testid="season-page">
      {back}
      <SeasonHero arc={arc} roadmap={roadmap} showName={showName} nextSeason={nextSeason}
        onEdit={() => openPanel(panel === 'edit' ? null : 'edit')} onPick={openPanel} readOnly={!isCurrent}
        switcher={<SeasonSwitcher seasons={plan.seasons} arc={arc} currentArcId={plan.currentArcId} onPick={pickSeason} />} />
      {!isCurrent && (
        <p className="szn-note is-past" role="status" data-testid="szn-past-season">
          You are looking at Season {arc.season_number || 1}{arc.status === 'completed' ? ', which is complete' : ''}. Its roadmap, episodes and results are its own; Story and Goals follow the season in progress.
          {' '}<button type="button" className="szn-link-btn" onClick={() => pickSeason(null)} data-testid="szn-past-season-back">Back to the season in progress</button>
        </p>
      )}

      <SeasonLoadError plan={plan} />
      {setupNote && <p className="szn-note" role="status" data-testid="szn-setup-note">{setupNote}</p>}
      {toast && <p className="szn-note" role="status" data-testid="szn-toast">{toast}</p>}

      <div ref={panelRef} className="szn-panel-slot">
        {panel === 'edit' && (
          <SeasonSetupForm key={`edit-${arc.id}`} mode="edit" showId={showId} seasonNumber={arc.season_number || 1}
            initial={formFromArc(arc)} onSubmit={plan.handleEdit} onCancel={() => setPanel(null)} />
        )}
        {panel === 'place' && (
          <SeasonPlacement showId={showId} api={api} onClose={() => setPanel(null)}
            onSaved={async (text) => { setPanel(null); setSetupNote(text); await plan.loadArc(); }} />
        )}
        {panel === 'draft' && (
          <SeasonDraft showId={showId} api={api} phases={roadmap?.phases || arc.phases || []} onClose={() => setPanel(null)} onSaved={plan.loadRoadmap} />
        )}
        {panel === 'new' && (
          <SeasonSetupForm mode="create" showId={showId} seasonNumber={nextSeason} onSubmit={plan.handleSeed} onCancel={() => setPanel(null)} />
        )}
      </div>

      <SeasonStats stats={stats} hrefFor={hrefFor} nextRelease={nextRelease} goalsAreCurrent={!isCurrent} releaseHref={`/shows/${encodeURIComponent(showId)}/world?tab=release`} />

      {tabBar(SEASON_TABS, badges)}

      <section id="szn-tabpanel" role="tabpanel" aria-labelledby={`szn-tab-${tab}`} className="szn-tabpanel" data-testid={`szn-panel-${tab}`}>
        {/* What the tab is for, in a line (Evoni, 2026-10-25). */}
        {note}
        {tab === 'overview' && <SeasonOverviewTab {...tabProps} />}
        {tab === 'roadmap' && <SeasonRoadmapTab {...tabProps} />}
        {tab === 'episodes' && <SeasonEpisodesTab {...scopedProps} />}
        {tab === 'events' && <SeasonEventsTab {...tabProps} />}
        {tab === 'opportunities' && <SeasonOpportunitiesTab {...tabProps} />}
        {tab === 'story' && <SeasonStoryTab {...tabProps} />}
        {tab === 'goals' && <SeasonGoalsTab {...tabProps} />}
        {tab === 'results' && <SeasonResultsTab {...scopedProps} />}
      </section>
    </div>
  );
}
