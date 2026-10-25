// frontend/src/pages/Home.jsx — the homepage: the show's front page and today's work
//
// Evoni, 2026-10-23: "combine the homepage and daily update page", laid out
// like her mockup (hero, tiles, Continue Episode + Upcoming Event, Trending in
// LalaVerse, then Lala's journey, Today's To-Do and Shop the Look). Every card
// is the creator's real data and opens where it is worked on:
//
//   Hero            the active show (utils/activeShow, else the one with the most
//                   episodes), its cover and Lala's portrait; Continue, Refresh
//   Tiles           Episodes, Closet, Style Page, The Cast, Map, Lala's Bank, Shop, The Pulse
//   Continue        the episode most recently worked on, at its stage (episodePipeline)
//   Upcoming event  the next ready event (ShowOverview's nextReadyEvent)
//   Your numbers    today's AI spend against the budget; the show's money (balance,
//                   income, expenses, runway: shows/:id/financial-summary); storytelling
//                   (each book's chapters and approved lines, episodes by stage)
//   Trending        the show's live Pulse posts with the most likes
//   Lala's journey  Prime Coins, reputation and brand trust (characters/lala/state)
//   Today's To-Do   the daily update's "waiting for you", decided here (DailyUpdate's DECIDE);
//                   since yesterday and today's AI spend as one line; /today has the rest
//   Shop the Look   the newest published look
//
// Each read fails on its own: a card whose read fails shows its empty line.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Play, Wallet, Cpu, PenLine, Clapperboard, Shirt, Sparkles, Users, Map as MapIcon, Coins, ShoppingBag, Radio,
  Heart, ChevronRight, CalendarDays, Star, Check, X, BookOpen, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { episodeService } from '../services/episodeService';
import { showService } from '../services/showService';
import storytellerService from '../services/storytellerService';
import apiClient from '../services/api';
import { STAGES, stageOf, episodeCode } from '../lib/episodePipeline';
import { nextReadyEvent } from '../components/Show/ShowOverview';
import { computeEventState } from '../utils/eventReadinessSections';
import { DECIDE } from './DailyUpdate';
import { activeShowId } from '../utils/activeShow';
import { seasonPageHref } from '../lib/seasonPage';
import PageLayout from '../components/layout/PageLayout';
import './Home.css';

// ─── Track 6 CP7 module-scope helper (Pattern F prophylactic — Api suffix) ───
// listRegistriesApi duplicated locally per v2.12 §9.11 file-local convention
// (CP3 WriteMode.jsx + CP6 CharacterTherapy.jsx also have it).
export const listRegistriesApi = () => apiClient.get('/api/v1/character-registry/registries');

const TODO_SHOWN = 5;
const TRENDING_SHOWN = 5;

const usd = (n) => `$${Number(n || 0).toFixed(2)}`;
const count = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n || 0));
const time = (d) => (d ? new Date(d).getTime() || 0 : 0);

/** Days from today to a free-text event date, or null when it doesn't read as a date. */
export function daysUntil(text, now = new Date()) {
  const t = Date.parse(text || '');
  if (Number.isNaN(t)) return null;
  const day = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(new Date(t)) - day(now)) / 864e5);
}

/**
 * The event to show: the next ready one, else the soonest dated event not yet
 * used in an episode (still being set up), else any unused one.
 */
export function upcomingEvent(events) {
  const ready = nextReadyEvent(events);
  if (ready) return { event: ready, ready: true };
  const open = (events || []).filter((ev) => !ev.used_in_episode_id && ev.status !== 'used' && ev.status !== 'archived');
  const dated = open.filter((ev) => !Number.isNaN(Date.parse(ev.event_date || ''))).sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date));
  const event = dated[0] || open[0] || null;
  return event ? { event, ready: computeEventState(event) === 'ready' } : null;
}

const coins = (n) => Number(n || 0).toLocaleString();
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** Storytelling totals across the books, and the episodes by stage. */
export function storyNumbers(books, episodes) {
  const list = books || [];
  const sum = (k) => list.reduce((n, b) => n + (Number(b[k]) || 0), 0);
  const eps = episodes || [];
  const released = eps.filter((e) => stageOf(e) === 'released').length;
  return {
    books: list.length, chapters: sum('chapter_count'), lines: sum('line_count'),
    approved: sum('approved_count'), pending: sum('pending_count'),
    episodes: eps.length, released, inProgress: eps.filter((e) => stageOf(e) && stageOf(e) !== 'released').length,
  };
}

function Numbers({ cost, money, books, episodes, characters, financesTo }) {
  const story = storyNumbers(books, episodes);
  const share = cost ? Math.min(1, cost.share ?? (cost.budget_usd ? cost.spent_usd / cost.budget_usd : 0)) : 0;
  const features = [...(cost?.features || [])].sort((a, b) => (b.usd || 0) - (a.usd || 0)).slice(0, 3);
  const t = money?.totals;
  return (
    <section className="hp-numbers" aria-labelledby="hp-num-h" data-testid="home-numbers">
      <h2 id="hp-num-h" className="hp-numbers__title">Your numbers</h2>
      <div className="hp-numbers__grid">
        <article className="hp-card hp-num" data-testid="home-num-ai">
          <h3 className="hp-num__head"><Cpu size={16} aria-hidden /> AI budget today</h3>
          {cost ? (
            <>
              <p className="hp-num__big">{usd(cost.spent_usd)} <small>of {usd(cost.budget_usd)}</small></p>
              <span className={`hp-meter${share >= 0.9 ? ' is-high' : share >= 0.7 ? ' is-mid' : ''}`} role="img" aria-label={`${pct(cost.spent_usd, cost.budget_usd)}% of today's AI budget used`}>
                <span style={{ width: `${share * 100}%` }} />
              </span>
              <dl className="hp-num__rows">
                <div><dt>Left today</dt><dd>{usd(cost.left_usd ?? (cost.budget_usd - cost.spent_usd))}</dd></div>
                {cost.image_budget_usd != null && <div><dt>Pictures</dt><dd>{usd(cost.image_spent_usd)} of {usd(cost.image_budget_usd)}</dd></div>}
                {features.map((f) => <div key={f.feature}><dt>{f.feature.replace(/[_-]/g, ' ')}</dt><dd>{usd(f.usd)}{f.calls ? <small> · {f.calls} call{f.calls === 1 ? '' : 's'}</small> : null}</dd></div>)}
              </dl>
              {(cost.alerts || []).length > 0 && <p className="hp-num__alert" role="status">{cost.alerts[0]?.message || cost.alerts[0]}</p>}
            </>
          ) : <p className="hp-empty-line">Today&apos;s AI spend shows here for an admin.</p>}
        </article>

        <article className="hp-card hp-num" data-testid="home-num-money">
          <h3 className="hp-num__head"><Wallet size={16} aria-hidden /> The show&apos;s money</h3>
          {t ? (
            <>
              <p className="hp-num__big">{coins(t.current_balance)} <small>Prime Coins on hand</small></p>
              <dl className="hp-num__rows">
                <div><dt>Earned, all time</dt><dd className="is-in">+{coins(t.lifetime_income)}</dd></div>
                <div><dt>Spent, all time</dt><dd className="is-out">−{coins(t.lifetime_expenses)}</dd></div>
                <div><dt>Net</dt><dd className={Number(t.net) < 0 ? 'is-out' : 'is-in'}>{Number(t.net) < 0 ? '−' : '+'}{coins(Math.abs(t.net))}</dd></div>
                {money.burn_rate_per_episode > 0 && <div><dt>Burn per episode</dt><dd>{coins(money.burn_rate_per_episode)}</dd></div>}
                <div><dt>Runway</dt><dd>{money.runway_episodes == null ? 'Not burning' : `${money.runway_episodes} episode${money.runway_episodes === 1 ? '' : 's'}`}</dd></div>
              </dl>
              <Link className="hp-see" to={financesTo}>Open finances</Link>
            </>
          ) : <p className="hp-empty-line">The show&apos;s money shows once it has a ledger.</p>}
        </article>

        <article className="hp-card hp-num" data-testid="home-num-story">
          <h3 className="hp-num__head"><PenLine size={16} aria-hidden /> Storytelling</h3>
          <p className="hp-num__big">{coins(story.approved)} <small>of {coins(story.lines)} lines approved{story.lines ? ` · ${pct(story.approved, story.lines)}%` : ''}</small></p>
          <dl className="hp-num__rows">
            <div><dt>Books · chapters</dt><dd>{story.books} · {story.chapters}</dd></div>
            <div><dt>Lines waiting</dt><dd>{coins(story.pending)}</dd></div>
            <div><dt>Episodes</dt><dd>{story.released} released · {story.inProgress} in progress</dd></div>
            <div><dt>Characters</dt><dd>{characters}</dd></div>
          </dl>
          {(books || []).length > 0 && (
            <ul className="hp-books">
              {(books || []).slice(0, 3).map((b) => (
                <li key={b.id}>
                  <Link to="/storyteller" className="hp-book">
                    <span className="hp-book__title">{b.title}</span>
                    <span className="hp-book__meta">{b.chapter_count || 0} ch · {pct(b.approved_count, b.line_count)}%</span>
                    <span className="hp-meter is-thin"><span style={{ width: `${pct(b.approved_count, b.line_count)}%` }} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}

/** The show the page is about: the active one, else the one with the most episodes. */
export function homeShow(shows) {
  const list = shows || [];
  const id = activeShowId({ shows: list });
  return list.find((s) => String(s.id) === String(id))
    || [...list].sort((a, b) => (b.episodeCount || 0) - (a.episodeCount || 0))[0] || null;
}

/** The live posts with the most likes, highest first. */
export function trending(posts, n = TRENDING_SHOWN) {
  return [...(posts || [])].sort((a, b) => (b.likes || 0) - (a.likes || 0) || time(b.posted_at) - time(a.posted_at)).slice(0, n);
}

/** The episode most recently worked on: in progress first, else the newest. */
export function continueEpisode(episodes) {
  const live = (episodes || []).filter((e) => stageOf(e) && stageOf(e) !== 'released');
  const pool = live.length ? live : (episodes || []).filter((e) => stageOf(e));
  return [...pool].sort((a, b) => time(b.updated_at) - time(a.updated_at))[0] || null;
}

/** The daily update's waiting items as one list, in the update's group order. */
export function todoItems(waiting) {
  return (waiting || []).flatMap((g) => (g.items || []).map((item) => ({ group: g.key, label: g.label, read_only: g.read_only, link: g.link, item })));
}

const pictureOf = (p) => p.image_url || p.photos?.[0]?.url || p.author_portrait_url || null;

function todoText(group, it) {
  if (group === 'drafts') return `${it.handle || it.name || 'A post'}: ${it.text || 'no words yet'}`;
  if (group === 'voices') return `${it.name}'s voice is ready`;
  if (group === 'secrets') return `${it.name}: ${it.text}`;
  if (group === 'deals') return `${it.brand || it.name}${it.amount ? ` · ${usd(it.amount)}` : ''}`;
  if (group === 'findings') return `${it.name}: ${it.open} open finding${it.open === 1 ? '' : 's'}`;
  return it.name || it.text || '';
}

function Todo({ update, onDecided }) {
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState(null);
  const rows = todoItems(update?.waiting);
  const total = (update?.waiting || []).reduce((n, g) => n + (g.total || 0), 0);

  const decide = async (row, how) => {
    const id = `${row.group}:${row.item.id}`;
    setBusy(id);
    try {
      await how.call(row.item);
      setDone((d) => ({ ...d, [id]: { text: how.done } }));
      onDecided?.();
    } catch (err) {
      console.error('[Home] To-Do decision failed:', err?.response?.status || err?.message);
      setDone((d) => ({ ...d, [id]: { text: err?.response?.data?.error || 'That didn’t go through. Try again.', error: true } }));
    } finally {
      setBusy(null);
    }
  };

  const since = update?.since_yesterday;
  const cost = update?.cost;
  return (
    <section className="hp-card hp-todo" aria-labelledby="hp-todo-h" data-testid="home-todo">
      <div className="hp-card__head">
        <h2 id="hp-todo-h">Today&apos;s To-Do {total > 0 && <span className="hp-count">{total}</span>}</h2>
        <Link className="hp-see" to="/today">See all</Link>
      </div>
      {since && (
        <p className="hp-since" data-testid="home-since">
          {since.went_live?.total || 0} went live · {since.scheduled?.total || 0} scheduled · {since.new_characters?.total || 0} new
          {cost && <> · AI {usd(cost.spent_usd)} of {usd(cost.budget_usd)}</>}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="hp-empty-line">Nothing waiting for you.</p>
      ) : (
        <ul className="hp-todo-list">
          {rows.slice(0, TODO_SHOWN).map((row) => {
            const id = `${row.group}:${row.item.id}`;
            const how = DECIDE[row.group];
            const d = done[id];
            return (
              <li key={id} className={`hp-todo-row${d && !d.error ? ' is-done' : ''}`} data-testid={`home-todo-${id}`}>
                <span className="hp-todo-kind">{row.label}</span>
                <span className="hp-todo-text">{todoText(row.group, row.item)}</span>
                <span className="hp-todo-actions">
                  {d && !d.error ? (
                    <span className="hp-todo-done"><Check size={14} aria-hidden /> {d.text}</span>
                  ) : row.read_only || !how ? (
                    <Link className="hp-todo-btn" to={row.item.character_id ? `/character/${row.item.character_id}` : (row.link || '/today')}>Open</Link>
                  ) : (
                    <>
                      {how.yes && <button type="button" className="hp-todo-btn is-yes" disabled={!!busy} onClick={() => decide(row, how.yes)}><Check size={14} aria-hidden /> {how.yes.label}</button>}
                      {how.no && <button type="button" className="hp-todo-btn" disabled={!!busy} onClick={() => decide(row, how.no)}><X size={14} aria-hidden /> {how.no.label}</button>}
                    </>
                  )}
                </span>
                {d?.error && <p className="hp-todo-error" role="alert">{d.text}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <Link className="hp-pill-btn" to="/today">Open tasks</Link>
    </section>
  );
}

function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  // A refresh keeps the page on screen and reloads its data (Evoni, 2026-10-23:
  // pull-to-refresh is off on phones, so the page has its own Refresh).
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({});

  const loadingRef = useRef(false);

  const loadAll = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    const ok = (r) => (r.status === 'fulfilled' ? r.value : undefined);
    const showsRes = await Promise.allSettled([showService.getAllShows()]);
    const shows = Array.isArray(ok(showsRes[0])) ? ok(showsRes[0]) : undefined;
    const show = homeShow(shows);
    const sid = show?.id;
    const [epRes, evRes, postRes, stateRes, updRes, looksRes, regRes, booksRes, moneyRes] = await Promise.allSettled([
      episodeService.getEpisodes(1, 100).then((r) => r?.data || []),
      sid ? apiClient.get(`/api/v1/world/${sid}/events`).then((r) => r.data?.events || []) : Promise.resolve([]),
      sid ? apiClient.get(`/api/v1/feed-posts?show_id=${sid}&status=live&limit=50`).then((r) => r.data?.data || []) : Promise.resolve([]),
      sid ? apiClient.get(`/api/v1/characters/lala/state?show_id=${sid}`).then((r) => r.data?.state || null) : Promise.resolve(null),
      apiClient.get('/api/v1/daily-update').then((r) => r.data),
      apiClient.get('/api/v1/public/looks').then((r) => r.data?.looks || []),
      listRegistriesApi().then((r) => (r.data?.registries || []).flatMap((reg) => reg.characters || [])),
      storytellerService.getBooks(),
      sid ? apiClient.get(`/api/v1/shows/${sid}/financial-summary`).then((r) => r.data || null) : Promise.resolve(null),
    ]);
    setData((prev) => {
      // A read that failed keeps what the card showed.
      const keep = (r, key) => (r.status === 'fulfilled' ? r.value : prev[key]);
      return {
        shows: shows ?? prev.shows,
        show: shows ? show : prev.show,
        episodes: keep(epRes, 'episodes'),
        events: keep(evRes, 'events'),
        posts: keep(postRes, 'posts'),
        lala: keep(stateRes, 'lala'),
        update: keep(updRes, 'update'),
        looks: keep(looksRes, 'looks'),
        characters: keep(regRes, 'characters'),
        books: keep(booksRes, 'books'),
        money: keep(moneyRes, 'money'),
      };
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    loadAll().finally(() => { loadingRef.current = false; });
  }, [loadAll]);

  const refresh = () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    loadAll({ quiet: true }).finally(() => {
      loadingRef.current = false;
      setRefreshing(false);
    });
  };

  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-spinner" />
        <p>Loading your workspace…</p>
      </div>
    );
  }

  const { show, update, lala } = data;
  const sid = show?.id;
  const episodes = (data.episodes || []).filter((e) => !sid || !e.show_id || e.show_id === sid);
  const characters = Array.isArray(data.characters) ? data.characters : [];
  const books = Array.isArray(data.books) ? data.books : [];
  const lalaChar = characters.find((c) => c.character_key === 'lala') || characters.find((c) => /^lala$/i.test(c.display_name || ''));
  const current = continueEpisode(episodes);
  const upcoming = upcomingEvent(data.events || []);
  const event = upcoming?.event || null;
  const hot = trending(data.posts);
  const look = (data.looks || [])[0] || null;
  const userName = user?.name || user?.email?.split('@')[0] || 'Creator';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const world = (tab) => (sid ? `/shows/${sid}/world?tab=${tab}` : '/shows');
  // The production board is the Season page's Episodes tab (2026-10-25).
  const board = sid ? seasonPageHref(sid, 'episodes') : '/shows';

  const tiles = [
    { key: 'episodes', label: 'Episodes', icon: Clapperboard, to: board },
    { key: 'closet', label: 'Closet', icon: Shirt, to: world('wardrobe-items') },
    { key: 'style', label: 'Style Page', icon: Sparkles, to: current ? `/episodes/${current.id}?tab=lookbook` : board },
    { key: 'cast', label: 'The Cast', icon: Users, to: '/character-registry?view=world' },
    { key: 'map', label: 'Map', icon: MapIcon, to: '/universe?tab=world&sub=map' },
    { key: 'bank', label: "Lala's Bank", icon: Coins, to: world('finances') },
    { key: 'shop', label: 'Shop', icon: ShoppingBag, to: '/shop-the-look' },
    { key: 'pulse', label: 'The Pulse', icon: Radio, to: '/pulse' },
  ];

  const stageIdx = current ? STAGES.findIndex((s) => s.key === stageOf(current)) : -1;
  const eventDays = event ? daysUntil(event.event_date) : null;
  const eventPicture = event?.invitation_url || event?.sceneSet?.base_still_url || null;
  const heroPicture = show?.coverImageUrl || show?.cover_image_url || null;
  const portrait = lalaChar?.portrait_url || null;

  return (
    <div className="home-page">
      <PageLayout variant="wide" className="home-container">

        {/* ─── Hero ─── */}
        <header className={`hp-hero${heroPicture ? ' has-picture' : ''}`} data-testid="home-hero"
          style={heroPicture ? { '--hp-hero-img': `url("${heroPicture}")` } : undefined}>
          {portrait && <img className="hp-hero__portrait" src={portrait} alt="Lala" />}
          <div className="hp-hero__body">
            <p className="hp-hero__hello">Welcome back, {userName} · {today}</p>
            <h1 className="hp-hero__title">{show?.name || show?.title || 'Your studio'}</h1>
            {show?.description && <p className="hp-hero__tagline">{show.description}</p>}
            <div className="hp-hero__actions">
              {current && (
                <Link className="hp-hero__play" to={`/episodes/${current.id}`} data-testid="home-continue-top">
                  <Play size={16} aria-hidden /> Continue {episodeCode(current)}
                </Link>
              )}
              <button type="button" className="home-refresh" onClick={refresh} disabled={refreshing}
                aria-busy={refreshing} data-testid="home-refresh">
                <RefreshCw size={16} aria-hidden="true" className={refreshing ? 'is-spinning' : undefined} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </header>

        {/* ─── Tiles ─── */}
        <nav className="hp-tiles" aria-label="Go to">
          {tiles.map(({ key, label, icon: Icon, to }) => (
            <Link key={key} className={`hp-tile hp-tile--${key}`} to={to} data-testid={`home-tile-${key}`}>
              <span className="hp-tile__icon"><Icon size={26} aria-hidden /></span>
              <span className="hp-tile__label">{label}</span>
            </Link>
          ))}
        </nav>

        {/* ─── Continue + Upcoming event ─── */}
        <div className="hp-pair">
          <section className="hp-feature hp-feature--episode" aria-labelledby="hp-cont-h" data-testid="home-continue"
            style={current?.thumbnail_url ? { '--hp-feature-img': `url("${current.thumbnail_url}")` } : undefined}>
            <h2 id="hp-cont-h" className="hp-feature__kicker">Continue Episode</h2>
            {current ? (
              <>
                <p className="hp-feature__code">{episodeCode(current)}</p>
                <p className="hp-feature__title">{current.title || 'Untitled'}</p>
                <div className="hp-progress" role="img" aria-label={`Stage ${stageIdx + 1} of ${STAGES.length}: ${STAGES[stageIdx]?.label}`}>
                  <span className="hp-progress__bar"><span style={{ width: `${((stageIdx + 1) / STAGES.length) * 100}%` }} /></span>
                  <span className="hp-progress__label">{STAGES[stageIdx]?.label} · stage {stageIdx + 1} of {STAGES.length}</span>
                </div>
                <Link className="hp-feature__go" to={`/episodes/${current.id}`} aria-label={`Open ${current.title || 'the episode'}`}>
                  <Play size={22} aria-hidden />
                </Link>
              </>
            ) : (
              <p className="hp-feature__empty">No episode yet. <Link to={board}>Start one</Link></p>
            )}
          </section>

          <section className="hp-feature hp-feature--event" aria-labelledby="hp-ev-h" data-testid="home-event"
            style={eventPicture ? { '--hp-feature-img': `url("${eventPicture}")` } : undefined}>
            <h2 id="hp-ev-h" className="hp-feature__kicker">Upcoming Event</h2>
            {event ? (
              <>
                {eventDays != null && eventDays >= 0 && (
                  <span className="hp-feature__when">{eventDays === 0 ? 'Today' : eventDays === 1 ? 'Tomorrow' : `In ${eventDays} days`}</span>
                )}
                {!upcoming.ready && <span className="hp-feature__setup">Still being set up</span>}
                <p className="hp-feature__title">{event.name}</p>
                <p className="hp-feature__sub">{[event.event_date, event.venue_name, event.host || event.host_brand].filter(Boolean).join(' · ')}</p>
                <ul className="hp-chips">
                  {[event.event_type?.replace(/_/g, ' '), event.dress_code, event.theme].filter(Boolean).slice(0, 3).map((t) => <li key={t}>{t}</li>)}
                </ul>
                <Link className="hp-pill-btn hp-feature__btn" to={sid ? seasonPageHref(sid, 'events', { event: event.id }) : '/shows'}>View event</Link>
              </>
            ) : (
              <p className="hp-feature__empty">No event yet. <Link to={sid ? seasonPageHref(sid, 'events') : '/shows'}>Open Events</Link></p>
            )}
          </section>
        </div>

        <Numbers cost={update?.cost} money={data.money} books={books} episodes={episodes}
          characters={characters.length} financesTo={world('finances')} />

        {/* ─── Trending ─── */}
        <section className="hp-card hp-trending" aria-labelledby="hp-tr-h" data-testid="home-trending">
          <div className="hp-card__head">
            <h2 id="hp-tr-h">Trending in LalaVerse</h2>
            <Link className="hp-see" to="/pulse">See all</Link>
          </div>
          {hot.length === 0 ? (
            <p className="hp-empty-line">Nothing live on The Pulse yet.</p>
          ) : (
            <ul className="hp-trend-row">
              {hot.map((p) => {
                const pic = pictureOf(p);
                return (
                  <li key={p.id} className="hp-trend">
                    <Link to="/pulse" className="hp-trend__link">
                      <span className="hp-trend__pic">
                        {pic ? <img src={pic} alt="" loading="lazy" /> : <span className="hp-trend__blank" aria-hidden>{(p.poster_display_name || p.poster_handle || '?')[0]}</span>}
                        <span className="hp-trend__likes"><Heart size={13} aria-hidden /> {count(p.likes)}</span>
                      </span>
                      <span className="hp-trend__text">{p.content_text}</span>
                      <span className="hp-trend__who">@{p.poster_handle || p.socialProfile?.handle || 'someone'}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ─── Lala's journey · Today's To-Do · Shop the Look ─── */}
        <div className="hp-trio">
          <section className="hp-card hp-journey" aria-labelledby="hp-jr-h" data-testid="home-journey">
            <div className="hp-card__head"><h2 id="hp-jr-h">Lala&apos;s Journey</h2></div>
            <div className="hp-journey__who">
              {portrait ? <img src={portrait} alt="" /> : <span className="hp-journey__initial" aria-hidden>L</span>}
              <span>{lalaChar?.display_name || 'Lala'}{current && <span className="hp-muted"> · {episodeCode(current)}</span>}</span>
            </div>
            {lala ? (
              <dl className="hp-journey__stats">
                <div><dt><Coins size={16} aria-hidden /> Prime Coins</dt><dd>{Number(lala.coins || 0).toLocaleString()}</dd></div>
                <div><dt><Star size={16} aria-hidden /> Reputation</dt><dd>{lala.reputation ?? 0}<small>/10</small></dd></div>
                <div><dt><Heart size={16} aria-hidden /> Brand trust</dt><dd>{lala.brand_trust ?? 0}<small>/10</small></dd></div>
              </dl>
            ) : (
              <p className="hp-empty-line">Her numbers show once the show has an episode.</p>
            )}
            <Link className="hp-pill-btn" to={world('finances')}>View finances</Link>
          </section>

          {update ? <Todo update={update} onDecided={undefined} /> : (
            <section className="hp-card hp-todo" aria-labelledby="hp-todo-h" data-testid="home-todo">
              <div className="hp-card__head"><h2 id="hp-todo-h">Today&apos;s To-Do</h2></div>
              <p className="hp-empty-line">The daily update isn&apos;t available right now.</p>
              <Link className="hp-pill-btn" to="/today">Open tasks</Link>
            </section>
          )}

          <section className="hp-card hp-shop" aria-labelledby="hp-sh-h" data-testid="home-shop">
            <div className="hp-card__head">
              <h2 id="hp-sh-h">Shop the Look</h2>
              <Link className="hp-see" to="/shop-the-look">See all</Link>
            </div>
            {look ? (
              <>
                {look.image?.url && <img className="hp-shop__img" src={look.image.url} alt={look.image.alt || look.title} loading="lazy" />}
                <p className="hp-shop__title">{look.title}</p>
                <Link className="hp-pill-btn" to={`/shop-the-look/${look.key}`}>Shop Lala&apos;s closet</Link>
              </>
            ) : (
              <>
                <p className="hp-empty-line">No look published yet. Send an approved style sheet to Distribution.</p>
                <Link className="hp-pill-btn" to="/shop-the-look">Shop the Look</Link>
              </>
            )}
          </section>
        </div>

        {/* ─── The rest of the universe ─── */}
        <nav className="hp-more" aria-label="Also in your universe">
          <Link to="/storyteller"><BookOpen size={16} aria-hidden /> {books.length} book{books.length === 1 ? '' : 's'} <ArrowRight size={14} aria-hidden /></Link>
          <Link to="/character-registry"><Users size={16} aria-hidden /> {characters.length} character{characters.length === 1 ? '' : 's'} <ArrowRight size={14} aria-hidden /></Link>
          <Link to="/universe"><Sparkles size={16} aria-hidden /> Universe <ArrowRight size={14} aria-hidden /></Link>
          {(data.shows || []).length > 1 && <Link to="/shows"><CalendarDays size={16} aria-hidden /> All shows <ChevronRight size={14} aria-hidden /></Link>}
        </nav>

      </PageLayout>
    </div>
  );
}

export default Home;
