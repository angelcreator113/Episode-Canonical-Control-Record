/**
 * UniversePage.jsx — the LalaVerse hub
 *
 * The world in one place (2026-10-04): an Overview of the active show's
 * world at a glance, then the world pages as tabs — Show Bible (the canon:
 * knowledge, decisions, documents, guard), World (the DREAM map and
 * locations), Society (archetypes, legends, rules, trends), Culture (the
 * calendar, awards and media, history) and State (snapshots, timeline,
 * tensions). The Overview carries the world's setup progress. Every tab
 * opens with a three-line orientation strip (components/TabOrientation,
 * copy in lalaverseOrientation.js): what it holds, what reads it, what to
 * do here. Each tab mounts its page in embedded mode; `?tab=`
 * names the tab and `?sub=` the page's own tab (utils/worldRedirects.js).
 * The Sidebar's LalaVerse row opens the hub; the Bible is its Bible tab
 * (the Sidebar's own Show Bible row is gone, 2026-10-04).
 *
 * No hardcoded universe ID: it loads the active show (useActiveShow,
 * audit CTX-01) and asks which show when several exist and none is active.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
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

export const HUB_TABS = [
  { key: 'overview', label: 'Overview', desc: 'The world at a glance' },
  { key: 'bible', label: 'Show Bible', desc: 'Canon, decisions, guard' },
  { key: 'world', label: 'World', desc: 'Map, locations' },
  { key: 'society', label: 'Society', desc: 'Archetypes, legends, trends' },
  { key: 'culture', label: 'Culture', desc: 'Calendar, awards, history' },
  { key: 'state', label: 'State', desc: 'Snapshots, timeline, tensions' },
];

// The tabs never shrink: the strip scrolls sideways instead. On touch screens
// styles/responsive.css gives every button min-width: 44px, which replaces
// the flex default (min-width: auto) and let the tabs squeeze to 44px, so
// their one-line descriptions ran into each other.
const tabStyle = (active) => ({
  padding: '10px 16px', fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace",
  flexShrink: 0, whiteSpace: 'nowrap',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
  border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
});

export default function UniversePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const wanted = searchParams.get('tab');
  const tab = HUB_TABS.some((t) => t.key === wanted) ? wanted : 'overview';
  const switchTab = (key) => setSearchParams({ tab: key });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--lala-gold-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        The LalaVerse
      </div>
      <div role="tablist" aria-label="LalaVerse" style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--lala-parchment-3)', overflowX: 'auto' }}>
        {HUB_TABS.map((t) => (
          <button key={t.key} id={`lalaverse-tab-${t.key}`} role="tab" aria-selected={tab === t.key} aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => switchTab(t.key)} style={tabStyle(tab === t.key)}>
            <span>{t.label}</span>
            <span style={{ fontSize: 10, fontWeight: 400, whiteSpace: 'nowrap' }}>{t.desc}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-labelledby={`lalaverse-tab-${tab}`}>
        <TabOrientation key={tab} id={tab} {...ORIENTATION[tab]} />
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

/** The active show's world at a glance: stats, production, world context, series and books. */
function Overview() {
  // Audit CTX-01 (2026-10-03): the active show, never the first one the
  // API returned; with several and none active, Evoni chooses.
  const { shows, show, loaded, failed, needsChoice, choose } = useActiveShow();
  const [stats, setStats] = useState(null);
  // The show the stats were loaded for. The content shows only once the stats
  // are in for the current show, whatever order the hook's and this page's
  // state updates land in; a loading flag flipped by the previous show (or
  // by "no show yet") let the content render once, hide behind the loader,
  // then swap back, remounting the setup section and refiring its checks.
  const [statsFor, setStatsFor] = useState(null);
  const [universe, setUniverse] = useState(null);
  const [series, setSeries] = useState([]);
  const [books, setBooks] = useState([]);

  const load = useCallback(async () => {
    if (!show) { setStats(null); return; }
    try {
      // Load stats in parallel
      const [eventsRes, wardrobeRes, episodesRes, overlaysRes, charsRes, booksRes] = await Promise.allSettled([
        api.get(`/api/v1/world/${show.id}/events?limit=100`),
        api.get(`/api/v1/wardrobe?show_id=${show.id}&limit=500`),
        api.get(`/api/v1/episodes?show_id=${show.id}&limit=100`),
        api.get(`/api/v1/ui-overlays/${show.id}`),
        api.get('/api/v1/character-registry/registries?limit=50').catch(() => ({ data: {} })),
        api.get('/api/v1/storyteller/books').catch(() => ({ data: {} })),
      ]);

      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.events || []) : [];
      const wardrobe = wardrobeRes.status === 'fulfilled' ? (wardrobeRes.value.data?.data || []) : [];
      const episodes = episodesRes.status === 'fulfilled' ? (episodesRes.value.data?.data || episodesRes.value.data || []) : [];
      const overlays = overlaysRes.status === 'fulfilled' ? (overlaysRes.value.data?.data || []) : [];
      const registries = charsRes.status === 'fulfilled' ? (charsRes.value.data?.registries || []) : [];
      const characters = registries.flatMap(r => r.characters || []);
      const booksData = booksRes.status === 'fulfilled' ? (booksRes.value.data?.books || []) : [];

      setBooks(booksData);

      setStats({
        events: events.length,
        wardrobe: wardrobe.length,
        episodes: Array.isArray(episodes) ? episodes.length : 0,
        overlays: overlays.filter(o => o.generated || o.url || o.asset_id).length,
        overlaysTotal: overlays.length,
        characters: Array.isArray(characters) ? characters.length : 0,
        books: booksData.length,
        wardrobeValue: wardrobe.reduce((s, w) => s + (parseFloat(w.price) || 0), 0),
        completed: (Array.isArray(episodes) ? episodes : []).filter(e => e.evaluation_status === 'accepted').length,
      });

      // Try loading universe from show's universe_id (or first available)
      try {
        const universeId = show.universe_id;
        if (universeId) {
          const uRes = await api.get(`/api/v1/universe/${universeId}`);
          setUniverse(uRes.data?.universe || null);
          const sRes = await api.get(`/api/v1/universe/series?universe_id=${universeId}`);
          setSeries(sRes.data?.series || []);
        }
      } catch { /* universe not seeded — that's fine */ }

    } catch (err) {
      console.error('UniversePage load error:', err);
    } finally {
      setStatsFor(String(show.id));
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || (show && statsFor !== String(show.id))) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading LalaVerse...</div>;
  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to open its LalaVerse overview" />;

  return (
    <div>
      {failed && <div role="alert" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--accent-subtle)', border: '1px solid var(--accent)', fontSize: 13 }}>The shows could not be loaded, so this overview has no show to describe.</div>}
      {/* Hero */}
      <div style={{ background: 'var(--lala-parchment-2)', borderRadius: 12, padding: '24px 28px', marginBottom: 16, border: '1px solid var(--lala-gold-line)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--lala-gold-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          {universe?.name || 'The LalaVerse'}
        </div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {show?.name || 'Styling Adventures with Lala'}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {show?.description || universe?.description || 'A narrative-driven luxury fashion life simulator. Fashion is strategy. Reputation is currency. Legacy is built episode by episode.'}
        </p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Episodes', value: stats.episodes, icon: '📺', color: 'var(--primary-text)' },
            { label: 'Events', value: stats.events, icon: '💌', color: 'var(--warning-text)' },
            { label: 'Characters', value: stats.characters, icon: '👥', color: 'var(--accent-dark)' },
            { label: 'Wardrobe', value: stats.wardrobe, icon: '👗', color: 'var(--lala-gold-text)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* World setup: the seven steps and which are done (was World Dashboard's Setup Progress tab) */}
      <WorldSetupProgress showId={show?.id} />

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {/* Production Overview */}
        <div style={{ background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🎬 Production</h3>
          {[
            { label: 'Episodes Created', value: stats?.episodes || 0 },
            { label: 'Episodes Completed', value: stats?.completed || 0 },
            { label: "Lala's Phone", value: `${stats?.overlays || 0}/${stats?.overlaysTotal || 0}` },
            { label: 'Wardrobe Value', value: `$${(stats?.wardrobeValue || 0).toLocaleString()}` },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* World Context */}
        <div style={{ background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🌍 World</h3>
          {universe ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {universe.core_themes?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Core Themes</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {universe.core_themes.map(t => (
                      <span key={t} style={{ padding: '2px 8px', background: 'var(--surface-bg)', border: '1px solid var(--lala-gold-line)', borderRadius: 6, fontSize: 11, color: 'var(--lala-gold-text)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {universe.pnos_beliefs && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Story Laws</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{universe.pnos_beliefs.slice(0, 200)}...</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Universe not configured yet. World rules are managed in the Show Bible.
            </div>
          )}
        </div>
      </div>

      {/* Series & Books */}
      {(series.length > 0 || books.length > 0) && (
        <div style={{ background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', padding: '16px 18px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>📚 Series & Books</h3>
          {series.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Series ({series.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {series.map(s => (
                  <span key={s.id} style={{ padding: '4px 12px', background: 'var(--lala-parchment-2)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                ))}
              </div>
            </div>
          )}
          {books.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Books ({books.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {books.map(b => (
                  <span key={b.id} style={{ padding: '4px 12px', background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, color: 'var(--lala-gold-text)' }}>{b.title}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
