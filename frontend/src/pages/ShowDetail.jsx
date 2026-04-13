// frontend/src/pages/ShowDetail.jsx - UPDATED with Tabs
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import showService from '../services/showService';
import episodeService from '../services/episodeService';
import { useToast } from '../components/ToastContainer';
import StudioTab from '../components/Show/StudioTab';
import ShowAssetsTab from '../components/Show/ShowAssetsTab';
import ShowWardrobeTab from '../components/Show/ShowWardrobeTab';
import ShowDistributionTab from '../components/Show/ShowDistributionTab';
import ShowInsightsTab from '../components/Show/ShowInsightsTab';
import EpisodeCard from '../components/EpisodeCard';
import EpisodeKanbanBoard from '../components/Episodes/EpisodeKanbanBoard';
import './ShowDetail.css';

/**
 * ShowDetail - Tabbed Show Management Interface
 * 
 * Tabs:
 * - Studio: Command center (current work, suggestions, health)
 * - Episodes: Episode list and pipeline
 * - Assets: Show-level asset management
 * - Distribution: Multi-platform tracking
 * - Insights: Analytics and performance
 */
function ShowDetail() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [show, setShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTabState, setActiveTabState] = useState(searchParams.get('tab') || 'studio');
  const [tabLoading, setTabLoading] = useState(false);
  const [episodeView, setEpisodeView] = useState('grid');

  // Tab management with URL persistence (matches EpisodeDetail)
  const setActiveTab = (tab) => {
    setTabLoading(true);
    setActiveTabState(tab);
    setSearchParams({ tab });
    setTimeout(() => setTabLoading(false), 300);
  };

  // Sync URL → tab (bidirectional)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTabState) {
      setActiveTabState(tab);
    }
  }, [searchParams]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1': e.preventDefault(); setActiveTab('studio'); break;
          case '2': e.preventDefault(); setActiveTab('episodes'); break;
          case '3': e.preventDefault(); setActiveTab('assets'); break;
          case '4': e.preventDefault(); setActiveTab('wardrobe'); break;
          case '5': e.preventDefault(); setActiveTab('distribution'); break;
          case '6': e.preventDefault(); setActiveTab('insights'); break;
          default: break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Load show data when showId is available
  useEffect(() => {
    if (!showId) {
      console.error('[ShowDetail] No show ID in URL, redirecting to /shows');
      navigate('/shows', { replace: true });
      return;
    }
    fetchShowData();
  }, [showId, navigate]);
  
  const fetchShowData = async () => {
    if (!showId) {
      console.error('[ShowDetail] Cannot fetch show data without ID');
      return;
    }
    
    try {
      setLoading(true);
      setNotFound(false);
      console.log('[ShowDetail] Fetching show with ID:', showId);
      // Fetch show details
      const showResponse = await showService.getShowById(showId);
      console.log('[ShowDetail] Got show:', showResponse?.name, 'ID:', showResponse?.id);
      setShow(showResponse);
      
      // Fetch episodes for this show
      const episodesResponse = await episodeService.getEpisodes(1, 100, { show_id: showId });
      setEpisodes(episodesResponse.data || episodesResponse || []);
    } catch (error) {
      console.error('Error fetching show:', error);
      // Detect 404 / "Not Found" errors — redirect to shows list with toast
      const msg = error.message || '';
      if (msg.includes('Not Found') || msg.includes('404')) {
        setNotFound(true);
        toast.showError('Show not found — it may have been deleted.');
        navigate('/shows', { replace: true });
        return;
      }
    } finally {
      setLoading(false);
    }
  };
  
  const activeTab = activeTabState;

  const handleStatusChange = async (episodeId, newStatus) => {
    try {
      await episodeService.updateEpisode(episodeId, { status: newStatus });
      fetchShowData();
    } catch (error) {
      console.error('Failed to update episode status:', error);
    }
  };

  const handleViewEpisode = (episodeId) => {
    navigate(`/episodes/${episodeId}`);
  };

  const handleEditEpisode = (episodeId) => {
    navigate(`/episodes/${episodeId}/edit`);
  };

  const handleDeleteEpisode = async (episodeId) => {
    if (!window.confirm('Are you sure you want to delete this episode?')) return;
    try {
      await episodeService.deleteEpisode(episodeId);
      fetchShowData();
    } catch (error) {
      console.error('Failed to delete episode:', error);
    }
  };

  const handleCreateEpisode = () => {
    navigate(`/shows/${showId}/quick-episode`);
  };
  
  const handleUpdateShow = async (updates) => {
    try {
      await showService.updateShow(showId, updates);
      await fetchShowData();
    } catch (error) {
      console.error('Failed to update show:', error);
      throw error;
    }
  };
  
  if (loading) {
    return (
      <div className="show-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading show...</p>
      </div>
    );
  }
  
  if (!show) {
    return (
      <div className="show-detail-error">
        <h2>😕 Show not found</h2>
        <p>This show may have been deleted or the link is no longer valid.</p>
        <Link to="/shows" className="btn-primary">← Back to Shows</Link>
      </div>
    );
  }
  
  return (
    <div className="show-detail">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/shows">Shows</Link>
        <span className="separator">›</span>
        <span>{show.name}</span>
      </div>
      
      {/* Show Header */}
      <div className="show-header">
        <div className="show-cover">
          {(show.coverImageUrl || show.cover_image_url) ? (
            <img src={show.coverImageUrl || show.cover_image_url} alt={show.name} />
          ) : (
            <div className="placeholder-cover">🎬</div>
          )}
        </div>
        
        <div className="show-info">
          <h1>{show.name}</h1>
          <div className="show-meta">
            {show.genre && <span className="meta-item">{show.genre}</span>}
            {show.network && (
              <>
                <span className="separator">•</span>
                <span className="meta-item">{show.network}</span>
              </>
            )}
            <span className="separator">•</span>
            <span className={`status-badge status-${show.status}`}>
              {show.status}
            </span>
          </div>
          
          {show.description && (
            <p className="show-description">{show.description}</p>
          )}

          <div className="show-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to={`/shows/${showId}/edit`} className="btn-secondary" style={{ fontSize: 11, padding: '5px 14px', background: '#fff', border: '1px solid #D4C5A0', color: '#8B7D6B', borderRadius: 6 }}>
              ✏️ Edit
            </Link>
            <Link to={`/shows/${showId}/world?tab=overview`} className="btn-secondary" style={{ fontSize: 11, padding: '5px 14px', background: '#B8962E', border: '1px solid #B8962E', color: '#fff', borderRadius: 6 }}>
              🎭 Producer Mode
            </Link>
            <span style={{ fontSize: 10, color: '#A69880', marginLeft: 4 }}>
              {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
              {show.premiereDate && ` · Premiered ${new Date(show.premiereDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
            </span>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveTab('studio')}
          title="Dashboard (Ctrl+1)"
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">Dashboard</span>
        </button>

        <button
          className={`tab-button ${activeTab === 'episodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('episodes')}
          title="Episodes (Ctrl+2)"
        >
          <span className="tab-icon">📺</span>
          <span className="tab-label">Episodes</span>
          {episodes.length > 0 && <span className="tab-count">{episodes.length}</span>}
        </button>

        <button
          className={`tab-button ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
          title="Production (Ctrl+3)"
        >
          <span className="tab-icon">🎬</span>
          <span className="tab-label">Production</span>
        </button>

        <button
          className={`tab-button ${activeTab === 'wardrobe' ? 'active' : ''}`}
          onClick={() => setActiveTab('wardrobe')}
          title="Wardrobe (Ctrl+4)"
        >
          <span className="tab-icon">👗</span>
          <span className="tab-label">Wardrobe</span>
        </button>

        <button
          className={`tab-button ${activeTab === 'distribution' ? 'active' : ''}`}
          onClick={() => setActiveTab('distribution')}
          title="Distribution (Ctrl+5)"
        >
          <span className="tab-icon">🚀</span>
          <span className="tab-label">Distribution</span>
        </button>

        <button
          className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
          title="Insights (Ctrl+6)"
        >
          <span className="tab-icon">📈</span>
          <span className="tab-label">Insights</span>
        </button>
      </div>
      
      {/* Tab Content */}
      <div className={`tab-content ${tabLoading ? 'tab-loading' : ''}`}>
        {activeTab === 'studio' && (
          <StudioTab show={show} episodes={episodes} />
        )}
        
        {activeTab === 'episodes' && (
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Episodes</h2>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
                  {episodes.filter(e => e.evaluation_status === 'accepted').length > 0 && ` · ${episodes.filter(e => e.evaluation_status === 'accepted').length} completed`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* View toggle */}
                <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  {['grid', 'list', 'kanban'].map(v => (
                    <button key={v} onClick={() => setEpisodeView(v)} style={{
                      padding: '4px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: episodeView === v ? '#6366f1' : '#fff',
                      color: episodeView === v ? '#fff' : '#64748b',
                    }}>
                      {v === 'grid' ? '⊞' : v === 'list' ? '≡' : '◫'} {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
                <button onClick={() => navigate(`/shows/${showId}/quick-episode`)} style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  + New Episode
                </button>
              </div>
            </div>

            {episodes.length === 0 ? (
              /* Empty state */
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a2e' }}>No episodes yet</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
                  Episodes are generated from events in Producer Mode. Create an event, pick an outfit, then generate the episode.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => navigate(`/shows/${showId}/world?tab=events`)} style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    🎭 Go to Producer Mode
                  </button>
                </div>
              </div>
            ) : episodeView === 'kanban' ? (
              <EpisodeKanbanBoard
                episodes={episodes}
                onStatusChange={handleStatusChange}
                onCreateEpisode={() => navigate(`/shows/${showId}/quick-episode`)}
              />
            ) : episodeView === 'list' ? (
              /* List view — compact table */
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>#</th>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Title</th>
                      <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Tier</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Net P&L</th>
                      <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {episodes.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0)).map(ep => {
                      let evalJson = ep.evaluation_json;
                      if (typeof evalJson === 'string') try { evalJson = JSON.parse(evalJson); } catch { evalJson = null; }
                      const tierKey = evalJson?.tier_final;
                      const tier = tierKey ? { slay: { e: '👑', c: '#FFD700' }, pass: { e: '✨', c: '#22c55e' }, safe: { e: '😐', c: '#eab308' }, fail: { e: '💔', c: '#dc2626' } }[tierKey] : null;
                      const net = (parseFloat(ep.total_income) || 0) - (parseFloat(ep.total_expenses) || 0);
                      const st = { draft: '✏️', scripted: '📜', in_build: '🎬', in_review: '👀', published: '✅', archived: '📦' }[ep.status] || '⚪';
                      return (
                        <tr key={ep.id} onClick={() => handleViewEpisode(ep.id)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <td style={{ padding: '8px 14px', fontWeight: 600, color: '#94a3b8' }}>{ep.episode_number || '—'}</td>
                          <td style={{ padding: '8px 14px', fontWeight: 600, color: '#1a1a2e', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title || 'Untitled'}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>{st}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>{tier ? <span style={{ color: tier.c }}>{tier.e}</span> : '—'}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: net > 0 ? '#16a34a' : net < 0 ? '#dc2626' : '#94a3b8' }}>
                            {net !== 0 ? `${net > 0 ? '+' : ''}${net.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: tier?.c || '#94a3b8' }}>
                            {evalJson?.score || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid view */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {episodes.map(episode => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    onView={handleViewEpisode}
                    onEdit={handleEditEpisode}
                    onDelete={handleDeleteEpisode}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'assets' && (
          <ShowAssetsTab show={show} />
        )}
        
        {activeTab === 'wardrobe' && (
          <ShowWardrobeTab show={show} />
        )}
        
        {activeTab === 'distribution' && (
          <ShowDistributionTab show={show} onUpdate={handleUpdateShow} />
        )}
        
        {activeTab === 'insights' && (
          <ShowInsightsTab show={show} />
        )}
      </div>
    </div>
  );
}

export default ShowDetail;
