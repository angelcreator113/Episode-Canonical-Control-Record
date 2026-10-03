/**
 * UniversePage.jsx — LalaVerse World Overview
 *
 * Shows the show's world at a glance: stats, characters, locations,
 * series/books, and links to the production pipeline.
 *
 * No hardcoded universe ID: it loads the active show (useActiveShow,
 * audit CTX-01) and asks which show when several exist and none is active.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import ShowChooser from '../components/ShowChooser';

export default function UniversePage() {
  const navigate = useNavigate();
  // Audit CTX-01 (2026-10-03): the active show, never the first one the
  // API returned; with several and none active, Evoni chooses.
  const { shows, show, showId, loaded, failed, needsChoice, choose } = useActiveShow();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [universe, setUniverse] = useState(null);
  const [series, setSeries] = useState([]);
  const [books, setBooks] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    if (!show) { setStats(null); return; }
    setStatsLoading(true);
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
      setStatsLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || statsLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading LalaVerse...</div>;
  if (needsChoice) return <ShowChooser shows={shows} onChoose={choose} purpose="to open its LalaVerse overview" />;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{toast.msg}</div>}

      {failed && <div role="alert" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#FBEFF3', border: '1px solid #C06E87', fontSize: 13 }}>The shows could not be loaded, so this overview has no show to describe.</div>}
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE4D3)', borderRadius: 12, padding: '24px 28px', marginBottom: 16, border: '1px solid rgba(184,150,46,0.15)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#B8962E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          {universe?.name || 'The LalaVerse'}
        </div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>
          {show?.name || 'Styling Adventures with Lala'}
        </h1>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6B5E4F', lineHeight: 1.5 }}>
          {show?.description || universe?.description || 'A narrative-driven luxury fashion life simulator. Fashion is strategy. Reputation is currency. Legacy is built episode by episode.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {showId && <button onClick={() => navigate(`/shows/${showId}/world?tab=overview`)} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🎭 Producer Mode</button>}
          {showId && <button onClick={() => navigate(`/shows/${showId}`)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #D4C5A0', background: '#fff', color: '#8B7D6B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📺 Show Dashboard</button>}
          <button onClick={() => navigate('/show-bible')} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #D4C5A0', background: '#fff', color: '#8B7D6B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📖 Show Bible</button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Episodes', value: stats.episodes, icon: '📺', color: '#6366f1' },
            { label: 'Events', value: stats.events, icon: '💌', color: '#f59e0b' },
            { label: 'Characters', value: stats.characters, icon: '👥', color: '#ec4899' },
            { label: 'Wardrobe', value: stats.wardrobe, icon: '👗', color: '#B8962E' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Production Overview */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🎬 Production</h3>
          {[
            { label: 'Episodes Created', value: stats?.episodes || 0 },
            { label: 'Episodes Completed', value: stats?.completed || 0 },
            { label: "Lala's Phone", value: `${stats?.overlays || 0}/${stats?.overlaysTotal || 0}` },
            { label: 'Wardrobe Value', value: `$${(stats?.wardrobeValue || 0).toLocaleString()}` },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: '#1a1a2e' }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* World Context */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🌍 World</h3>
          {universe ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {universe.core_themes?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Core Themes</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {universe.core_themes.map(t => (
                      <span key={t} style={{ padding: '2px 8px', background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 6, fontSize: 11, color: '#B8962E' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {universe.pnos_beliefs && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Story Laws</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{universe.pnos_beliefs.slice(0, 200)}...</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Universe not configured yet. World rules are managed in the Show Bible.
              <button onClick={() => navigate('/show-bible?tab=knowledge')} style={{ display: 'block', marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #D4C5A0', background: '#fff', color: '#8B7D6B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>📖 Open Show Bible</button>
            </div>
          )}
        </div>
      </div>

      {/* Series & Books */}
      {(series.length > 0 || books.length > 0) && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📚 Series & Books</h3>
          {series.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Series ({series.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {series.map(s => (
                  <span key={s.id} style={{ padding: '4px 12px', background: '#f1f5f9', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{s.name}</span>
                ))}
              </div>
            </div>
          )}
          {books.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Books ({books.length})</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {books.map(b => (
                  <span key={b.id} style={{ padding: '4px 12px', background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 6, fontSize: 12, color: '#B8962E' }}>{b.title}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Links — auto-fit so the row wraps instead of overflowing at 375px */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {[
          { icon: '🎭', label: 'Producer Mode', route: showId ? `/shows/${showId}/world?tab=overview` : '/shows' },
          { icon: '👥', label: 'Characters', route: '/character-registry?view=world' },
          { icon: '🔗', label: 'Relationships', route: '/world-studio?tab=relationships' },
          { icon: '📖', label: 'Show Bible', route: '/show-bible' },
          { icon: <LayoutDashboard size={22} color="#B8962E" aria-hidden="true" style={{ display: 'block', margin: '6px 0 5px' }} />, label: 'World Dashboard', route: '/world-dashboard' },
        ].map(link => (
          <button key={link.label} onClick={() => navigate(link.route)} style={{
            background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#B8962E'; e.currentTarget.style.background = '#FAFAF7'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
          >
            <span style={{ fontSize: 22 }}>{link.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
