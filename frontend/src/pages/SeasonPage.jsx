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
 * Colours: the mockup's pinks and purples, page-scoped (--sp-* in
 * SeasonPage.css). Text is plum or ink; pink is for fills and accents.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Clapperboard, Target, CalendarHeart, Coins as CoinsIcon, MoreHorizontal, Pencil, ArrowLeft } from 'lucide-react';
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
import { SEASON_TABS, tabFrom, seasonStats, heroChips, slotsLine, goalsLine, eventsLine } from '../lib/seasonPage';
import './SeasonPage.css';

const S = PLAN_S;
// The tabs a show without a season still has (they read the show, not the
// season); Events is the whole event library there.
const SEASONLESS_TABS = ['episodes', 'events', 'opportunities', 'results'];


/** The four stat cards (the mockup's row under the hero). */
export function SeasonStats({ stats }) {
  const b = stats.budget;
  return (
    <section className="szn-stats" aria-label="The season at a glance" data-testid="szn-stats">
      <article className="szn-stat" data-testid="szn-stat-slots">
        <span className="szn-stat-icon" aria-hidden="true"><Clapperboard size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-num">{stats.slots.total}</span>
          <span className="szn-stat-label">Episode Slots</span>
        </div>
        <Bar done={stats.slots.done} total={stats.slots.total} label="Episode slots done" />
        <span className="szn-stat-line">{slotsLine(stats)}</span>
      </article>
      <article className="szn-stat" data-testid="szn-stat-goals">
        <span className="szn-stat-icon is-gold" aria-hidden="true"><Target size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-num">{stats.goals.total}</span>
          <span className="szn-stat-label">Season Goals</span>
        </div>
        <Bar done={stats.goals.done} total={stats.goals.total} label="Season goals complete" />
        <span className="szn-stat-line">{goalsLine(stats)}</span>
      </article>
      <article className="szn-stat" data-testid="szn-stat-events">
        <span className="szn-stat-icon is-purple" aria-hidden="true"><CalendarHeart size={22} /></span>
        <div className="szn-stat-body">
          <span className="szn-stat-num">{stats.events.scheduled}</span>
          <span className="szn-stat-label">Major Events</span>
        </div>
        <Bar done={stats.events.scheduled} total={stats.slots.total} label="Slots with an event or episode" />
        <span className="szn-stat-line">{eventsLine(stats)}</span>
      </article>
      {/* Prime Budget: Lala's coins from the ledger, never cost_coins (Planning Insights' money). */}
      <article className="szn-stat is-budget" data-testid="szn-stat-budget">
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
      </article>
    </section>
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

/** Episodes: the production board, as Producer Mode had it (its Episodes › Production). */
export function SeasonEpisodesTab({ showId, episodes, episodesTotal, reloadShowData }) {
  return <ShowEpisodesBoard showId={showId} episodes={episodes} total={episodesTotal} onChanged={reloadShowData} />;
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

export function SeasonHero({ arc, roadmap, showName, nextSeason, onEdit, onPick }) {
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
        <div className="szn-hero-actions">
          <button type="button" className="szn-btn" onClick={onEdit} data-testid="szn-edit-season">
            <Pencil size={16} aria-hidden="true" /> Edit Season
          </button>
          <HeroMenu arc={arc} nextSeason={nextSeason} onPick={onPick} />
        </div>
      </div>
    </header>
  );
}

export default function SeasonPage() {
  const { showId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get('tab'));
  const [toast, setToast] = useState(null);
  const plan = useSeasonPlan({ showId, api, setToast });
  const { arc, roadmap, goals, insights, panel, setPanel, setupNote, setSetupNote, loading, nextSeason } = plan;
  const [showName, setShowName] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesTotal, setEpisodesTotal] = useState(null);
  const [events, setEvents] = useState([]);
  const panelRef = useRef(null);
  const tabsRef = useRef(null);

  // The show's name for the hero, and its episodes and events for the cards'
  // pictures, the slot panel, the production board and the ledger (the same
  // reads as Producer Mode); the board and Opportunities reload them.
  const loadShowData = useCallback(async () => {
    await Promise.all([
      api.get(`/api/v1/shows/${showId}`).then((r) => setShowName(r.data?.data?.name || r.data?.name || null))
        .catch((err) => console.error('[SeasonPage] show load failed:', err)),
      fetchAllEpisodes(api, showId).then((list) => { setEpisodes(list.items || []); setEpisodesTotal(list.total ?? (list.items || []).length); })
        .catch((err) => console.error('[SeasonPage] episodes load failed:', err)),
      api.get(`/api/v1/world/${showId}/events`).then((r) => setEvents(r.data?.events || []))
        .catch((err) => console.error('[SeasonPage] events load failed:', err)),
    ]);
  }, [showId]);
  useEffect(() => { loadShowData(); }, [loadShowData]);

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

  if (loading) return <div className="szn-page"><p className="szn-loading" role="status">Loading the season…</p></div>;

  const back = (
    <Link className="szn-back" to={`/shows/${showId}/world?tab=overview`} data-testid="szn-back">
      <ArrowLeft size={16} aria-hidden="true" /> Producer Mode
    </Link>
  );

  const tabProps = {
    plan, S, api, showId, setToast, episodes, episodesTotal, events, arc, roadmap, stats, goTab, params, setParams,
    reloadShowData: loadShowData,
    onEdit: () => openPanel('edit'), onPanel: openPanel,
  };

  const tabBar = (tabs) => (
    <nav className="szn-tabs" role="tablist" aria-label="Season sections" ref={tabsRef}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" id={`szn-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="szn-tabpanel"
          className={`szn-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => goTab(t.key)} data-testid={`szn-tab-${t.key}`}>
          {t.label}
        </button>
      ))}
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
        onEdit={() => openPanel(panel === 'edit' ? null : 'edit')} onPick={openPanel} />

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

      <SeasonStats stats={stats} />

      {tabBar(SEASON_TABS)}

      <section id="szn-tabpanel" role="tabpanel" aria-labelledby={`szn-tab-${tab}`} className="szn-tabpanel" data-testid={`szn-panel-${tab}`}>
        {/* What the tab is for, in a line (Evoni, 2026-10-25). */}
        {note}
        {tab === 'overview' && <SeasonOverviewTab {...tabProps} />}
        {tab === 'roadmap' && <SeasonRoadmapTab {...tabProps} />}
        {tab === 'episodes' && <SeasonEpisodesTab {...tabProps} />}
        {tab === 'events' && <SeasonEventsTab {...tabProps} />}
        {tab === 'opportunities' && <SeasonOpportunitiesTab {...tabProps} />}
        {tab === 'story' && <SeasonStoryTab {...tabProps} />}
        {tab === 'goals' && <SeasonGoalsTab {...tabProps} />}
        {tab === 'results' && <SeasonResultsTab {...tabProps} />}
      </section>
    </div>
  );
}
