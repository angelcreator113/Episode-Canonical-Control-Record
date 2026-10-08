/**
 * UniversePage.jsx — the LalaVerse hub
 *
 * The world in one place (2026-10-04): an Overview of the active show's
 * world at a glance, then the world pages as tabs — Show Bible (the canon:
 * knowledge, decisions, documents, guard), World (the DREAM map and
 * locations), Society (archetypes, legends, rules, trends), Culture (the
 * calendar, awards and media, history) and State (snapshots, timeline,
 * tensions). Each tab mounts its page in embedded mode; `?tab=` names the
 * tab and `?sub=` the page's own tab (utils/worldRedirects.js). The
 * Sidebar's LalaVerse row opens the hub; the Bible is its Bible tab.
 *
 * To Evoni's mock (Lalas_Social_Media_Page_3, 2026-10-06): the tabs are
 * six colored cards, and every tab opens on a banner in its color (kicker,
 * title, one line). The three-line orientation strip (components/
 * TabOrientation, copy in lalaverseOrientation.js) stays under the banner,
 * dismissable per tab. The Overview is four tiles that open where the
 * work is, "Build the world" (components/WorldSetupProgress), what the
 * world is handing you, what happened lately and the books (lib/
 * lalaverseOverview.js), each from real data or an honest empty line.
 *
 * No hardcoded universe ID: it loads the active show (useActiveShow,
 * audit CTX-01) and asks which show when several exist and none is active.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { fetchAllEpisodes } from '../lib/fetchAllPages';
import { fetchClosetWithTotal } from '../lib/closetGrouping';
import { worldIdeas, latelyItems, bookSummary } from '../lib/lalaverseOverview';
import { castCounts } from '../lib/theCast';
import useActiveShow from '../hooks/useActiveShow';
import ShowChooser from '../components/ShowChooser';
import ShowBiblePage from './ShowBiblePage';
import WorldFoundation from './WorldFoundation';
import SocialSystems from './SocialSystems';
import CultureEvents from './CultureEvents';
import WorldDashboard from './WorldDashboard';
import WorldSetupProgress from '../components/WorldSetupProgress';
import TabOrientation from '../components/TabOrientation';
import { ORIENTATION } from './lalaverseOrientation';
import './LalaVerseHub.css';

export const HUB_TABS = [
  { key: 'overview', label: 'Overview', desc: 'The world at a glance' },
  { key: 'bible', label: 'Show Bible', desc: 'Canon, decisions, guard',
    title: 'The rules of the world', line: 'What is always true, what you decided and when, and anything that breaks the rules.' },
  { key: 'world', label: 'World', desc: 'Map, cities, venues',
    title: 'The five DREAM cities', line: 'The cities, their places, companies and people. Everything an event needs a location for starts here.' },
  { key: 'society', label: 'Society', desc: 'Archetypes, legends, trends',
    title: 'How influence works', line: 'Who people are, how they rise, and what everyone is talking about this season.' },
  { key: 'culture', label: 'Culture', desc: 'Calendar, awards, history',
    title: 'The yearly rhythm', line: 'What happens when, in every season: the calendar, the awards and the history the world remembers.' },
  { key: 'state', label: 'State', desc: 'Snapshots, timeline, tensions',
    title: 'How the world is right now', line: 'Snapshots after each episode, a timeline of what changed, and the tensions that could become stories.' },
];

/** The banner every tab opens on, in the tab's color. */
function HubBanner({ tab, title, line }) {
  const label = HUB_TABS.find((t) => t.key === tab)?.label;
  return (
    <header className={`lvh-banner lvh-tone-${tab}`} data-testid="lalaverse-banner">
      <div className="lvh-kicker">The LalaVerse · {label}</div>
      <h1 className="lvh-banner-title">{title}</h1>
      {line && <p className="lvh-banner-line">{line}</p>}
      <span className="lvh-banner-mark" aria-hidden="true">✦</span>
    </header>
  );
}

export default function UniversePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const wanted = searchParams.get('tab');
  const tab = HUB_TABS.some((t) => t.key === wanted) ? wanted : 'overview';
  const current = HUB_TABS.find((t) => t.key === tab);
  const switchTab = (key) => setSearchParams({ tab: key });

  return (
    <div className="lvh">
      <div role="tablist" aria-label="LalaVerse" className="lvh-tabs">
        {HUB_TABS.map((t) => (
          <button key={t.key} type="button" id={`lalaverse-tab-${t.key}`} role="tab" aria-selected={tab === t.key} aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => switchTab(t.key)} className={`lvh-tab lvh-tone-${t.key}${tab === t.key ? ' is-active' : ''}`}>
            <span className="lvh-tab-label"><span className="lvh-dot" aria-hidden="true" />{t.label}</span>
            <span className="lvh-tab-desc">{t.desc}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-labelledby={`lalaverse-tab-${tab}`}>
        {tab !== 'overview' && <HubBanner tab={tab} title={current.title} line={current.line} />}
        {tab !== 'overview' && <TabOrientation key={tab} id={tab} {...ORIENTATION[tab]} />}
        {tab === 'overview' && <Overview />}
        {tab === 'bible' && <ShowBiblePage embedded />}
        {tab === 'world' && <WorldFoundation embedded />}
        {tab === 'society' && <SocialSystems embedded />}
        {tab === 'culture' && <CultureEvents embedded />}
        {tab === 'state' && <WorldDashboard embedded />}
      </div>
    </div>
  );
}

const IDEA_TONE = { culture: 'culture', society: 'society', state: 'state' };

/** The active show's world at a glance: tiles, setup, ideas, lately. */
function Overview() {
  // Audit CTX-01 (2026-10-03): the active show, never the first one the
  // API returned; with several and none active, Evoni chooses.
  const { shows, show, loaded, failed, needsChoice, choose } = useActiveShow();
  const [data, setData] = useState(null);
  // The show the data was loaded for. The content shows only once the data
  // is in for the current show, whatever order the hook's and this page's
  // state updates land in; a loading flag flipped by the previous show (or
  // by "no show yet") let the content render once, hide behind the loader,
  // then swap back, remounting the setup section and refiring its checks.
  const [dataFor, setDataFor] = useState(null);

  const load = useCallback(async () => {
    if (!show) { setData(null); return; }
    try {
      const [eventsRes, wardrobeRes, episodesRes, charsRes, calendarRes, trendingRes, tensionRes, booksRes, profilesRes] = await Promise.allSettled([
        api.get(`/api/v1/world/${show.id}/events`),
        // Every piece and episode, not the first 500 and 100 (lib/fetchAllPages).
        fetchClosetWithTotal(api, show.id),
        fetchAllEpisodes(api, show.id),
        // The cast, counted as the Characters page (The cast) counts it:
        // every registry, the one it would open on, and the feed people.
        api.get('/api/v1/character-registry/registries?limit=100'),
        api.get('/api/v1/calendar/events?event_type=lalaverse_cultural'),
        api.get(`/api/v1/feed-enhanced/${show.id}/trending`),
        // The show's tensions: pairs in its registries or in one with no show yet.
        api.get(`/api/v1/world/tension-scanner?show_id=${encodeURIComponent(show.id)}`),
        // The novel's books (Before Lala), every one: they are not per show.
        api.get('/api/v1/storyteller/books'),
        api.get('/api/v1/social-profiles?feed_layer=lalaverse&limit=100'),
      ]);
      const ok = (r) => r.status === 'fulfilled';
      for (const [name, r] of [['events', eventsRes], ['closet', wardrobeRes], ['episodes', episodesRes], ['registries', charsRes], ['calendar', calendarRes], ['trending', trendingRes], ['tensions', tensionRes], ['books', booksRes], ['feed people', profilesRes]]) {
        if (!ok(r)) console.error(`[LalaVerse] the ${name} could not be read:`, r.reason?.response?.status || r.reason?.message);
      }

      const events = ok(eventsRes) ? (eventsRes.value.data?.events || []) : [];
      const episodes = ok(episodesRes) ? (episodesRes.value.items || []) : [];
      const registries = ok(charsRes) ? (charsRes.value.data?.registries || []) : [];
      const profiles = ok(profilesRes) ? (profilesRes.value.data?.profiles || []) : [];
      let cast = null;
      if (ok(charsRes) && ok(profilesRes)) {
        cast = castCounts({ registries, profiles, showId: show.id });
        // The kept ones are reviewed, not "to review" (GET /api/v1/cast/review).
        if (cast.registryId) {
          try {
            const rev = await api.get(`/api/v1/cast/review?registry_id=${cast.registryId}`);
            const byId = Object.fromEntries((rev.data?.characters || []).map((c) => [c.id, c]));
            cast = castCounts({ registries, profiles, showId: show.id, review: { byId } });
          } catch (err) { console.error('[LalaVerse] the cast review could not be read:', err?.response?.status || err?.message); }
        }
      }
      const tensionBody = ok(tensionRes) ? tensionRes.value.data : null;
      const ideaFailures = [
        !ok(calendarRes) && 'culture',
        !ok(trendingRes) && 'society',
        (!tensionBody || tensionBody.status === 'scan_failed') && 'state',
      ].filter(Boolean);

      setData({
        counts: {
          episodes: ok(episodesRes) ? episodes.length : null,
          events: ok(eventsRes) ? events.length : null,
          characters: cast ? cast.people : null,
          oldToReview: cast ? cast.toReview : null,
          wardrobe: ok(wardrobeRes) ? (wardrobeRes.value.items || []).length : null,
        },
        ideas: worldIdeas({
          calendarEvents: ok(calendarRes) ? calendarRes.value.data?.events : [],
          trending: ok(trendingRes) ? trendingRes.value.data?.data : [],
          tensions: tensionBody?.pairs || [],
          showId: show.id,
          failed: ideaFailures,
        }),
        lately: latelyItems({ episodes, events }),
        books: ok(booksRes) ? (booksRes.value.data?.books || []).map(bookSummary) : null,
      });
    } catch (err) {
      console.error('UniversePage load error:', err);
    } finally {
      setDataFor(String(show.id));
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || (show && dataFor !== String(show.id))) return <div className="lvh-loading">Loading LalaVerse...</div>;
  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to open its LalaVerse overview" />;

  const producer = (sub) => (show ? `/shows/${show.id}/world?tab=${sub}` : '/universe');
  const counts = data?.counts || {};
  const tiles = [
    { key: 'episodes', label: 'Episodes', value: counts.episodes, link: 'Open Season Plan', to: producer('season'), tone: 'overview' },
    { key: 'events', label: 'Events', value: counts.events, link: 'Open Events library', to: producer('events'), tone: 'culture' },
    { key: 'characters', label: 'Characters', value: counts.characters, note: 'in Lala’s world',
      extra: counts.oldToReview > 0 ? `${counts.oldToReview.toLocaleString()} from the old system to review` : null,
      link: 'Open The cast', to: '/character-registry', tone: 'society' },
    { key: 'wardrobe', label: 'Wardrobe', value: counts.wardrobe, link: 'Open Full Closet', to: producer('wardrobe-items'), tone: 'world' },
  ];

  return (
    <div>
      {failed && <div role="alert" className="lvh-alert">The shows could not be loaded, so this overview has no show to describe.</div>}
      <HubBanner tab="overview" title={show?.name || 'Styling Adventures with Lala'}
        line={show?.description || 'No description for this show yet. Add one in the show’s settings.'} />
      <TabOrientation id="overview" {...ORIENTATION.overview} />

      {data && (
        <div className="lvh-tiles">
          {tiles.map((t) => (
            <Link key={t.key} to={t.to} className={`lvh-tile lvh-tone-${t.tone}`} data-testid={`lalaverse-tile-${t.key}`}>
              <span className="lvh-tile-label">{t.label}{t.note && <span className="lvh-tile-note"> · {t.note}</span>}</span>
              <span className="lvh-tile-value">{t.value == null ? '—' : t.value.toLocaleString()}</span>
              {t.value == null && <span className="lvh-tile-note">Could not be counted just now</span>}
              {t.value != null && t.extra && <span className="lvh-tile-note" data-testid={`lalaverse-tile-${t.key}-extra`}>{t.extra}</span>}
              <span className="lvh-tile-link">{t.link} →</span>
            </Link>
          ))}
        </div>
      )}

      {/* World setup: the seven steps and which are done (was World Dashboard's Setup Progress tab) */}
      <WorldSetupProgress showId={show?.id} />

      {data && (
        <div className="lvh-columns">
          <section className="lvh-card" aria-labelledby="lvh-ideas-heading">
            <div className="lvh-card-head">
              <h2 id="lvh-ideas-heading" className="lvh-card-title">What the world is handing you</h2>
              <span className="lvh-card-sub">Ideas from the calendar, the Feed and the tensions</span>
            </div>
            <ul className="lvh-ideas">
              {data.ideas.map((idea) => (
                <li key={idea.key} className={`lvh-idea lvh-tone-${IDEA_TONE[idea.key]}${idea.empty ? ' is-empty' : ''}`} data-testid={`lalaverse-idea-${idea.key}`}>
                  <span className="lvh-idea-from">{idea.from}</span>
                  <span className="lvh-idea-text">
                    {idea.empty || idea.text}
                    {idea.detail && <span className="lvh-idea-detail"> · {idea.detail}</span>}
                  </span>
                  {!idea.empty && <Link className="lvh-idea-action" to={idea.to}>{idea.action} →</Link>}
                </li>
              ))}
            </ul>
          </section>

          <section className="lvh-card" aria-labelledby="lvh-lately-heading">
            <div className="lvh-card-head">
              <h2 id="lvh-lately-heading" className="lvh-card-title">Lately in the LalaVerse</h2>
            </div>
            {data.lately.length ? (
              <ul className="lvh-lately" data-testid="lalaverse-lately">
                {data.lately.map((item) => (
                  <li key={item.key} className={`lvh-lately-item is-${item.kind}`}>
                    <span className="lvh-dot" aria-hidden="true" />
                    <span><strong>{item.name}</strong> {item.verb}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lvh-empty" data-testid="lalaverse-lately">No episodes or events yet.</p>
            )}
            <p className="lvh-footnote">From the dates episodes and events were made; the world keeps no activity log yet.</p>
          </section>
        </div>
      )}

      {data && (
        <section className="lvh-card lvh-books" aria-labelledby="lvh-books-heading">
          <div className="lvh-card-head">
            <h2 id="lvh-books-heading" className="lvh-card-title">The books</h2>
            <span className="lvh-card-sub">The novel side of the LalaVerse</span>
            <Link className="lvh-card-link" to="/start">Open the writing desk →</Link>
          </div>
          {data.books == null ? (
            <p className="lvh-empty" data-testid="lalaverse-books">The books could not be read just now.</p>
          ) : data.books.length === 0 ? (
            <p className="lvh-empty" data-testid="lalaverse-books">No books yet. A book started from the writing desk shows here.</p>
          ) : (
            <ul className="lvh-book-list" data-testid="lalaverse-books">
              {data.books.map((b) => (
                <li key={b.id} className="lvh-book">
                  <div className="lvh-book-head">
                    <span className="lvh-book-spine" aria-hidden="true" />
                    <div className="lvh-book-titles">
                      <h3 className="lvh-book-title">{b.title}</h3>
                      {b.subtitle && <span className="lvh-book-subtitle">{b.subtitle}</span>}
                    </div>
                    <span className={`lvh-book-status is-${b.statusKey}`}>{b.status}</span>
                  </div>
                  {b.whose && <span className="lvh-book-whose">{b.whose}</span>}
                  <span className="lvh-book-counts">{b.counts}</span>
                  {b.total > 0 ? (
                    <div className="lvh-book-progress">
                      <div className="lvh-book-bar" role="progressbar" aria-label={`${b.title}: lines approved`} aria-valuemin={0} aria-valuemax={b.total} aria-valuenow={b.approved}>
                        <span style={{ width: `${Math.round((b.approved / b.total) * 100)}%` }} />
                      </div>
                      <span className="lvh-book-approved">{b.approved.toLocaleString()} of {b.total.toLocaleString()} lines approved</span>
                    </div>
                  ) : (
                    <span className="lvh-book-approved">Nothing written yet</span>
                  )}
                  {b.lastChapter && <span className="lvh-book-last">Last worked on: {b.lastChapter}</span>}
                  {b.insight && <blockquote className="lvh-book-insight">{b.insight}</blockquote>}
                  <span className="lvh-book-actions">
                    <Link to={`/book/${b.id}`}>Write →</Link>
                    {b.total > 0 && <Link to={`/books/${b.id}/read`}>Read</Link>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
