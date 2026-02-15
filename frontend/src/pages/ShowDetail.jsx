// frontend/src/pages/ShowDetail.jsx - UPDATED with Tabs
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import showService from '../services/showService';
import episodeService from '../services/episodeService';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [show, setShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
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
    navigate(`/episodes/create?show_id=${showId}`);
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
        <h2>Show not found</h2>
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
          
          <div className="show-actions">
            <Link to={`/shows/${showId}/edit`} className="btn-secondary">
              ✏️ Edit Show
            </Link>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveTab('studio')}
          title="Studio (Ctrl+1)"
        >
          <span className="tab-icon">🎬</span>
          <span className="tab-label">Studio</span>
        </button>
        
        <button
          className={`tab-button ${activeTab === 'episodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('episodes')}
          title="Episodes (Ctrl+2)"
        >
          <span className="tab-icon">📺</span>
          <span className="tab-label">Episodes</span>
          <span className="tab-count">{episodes.length}</span>
        </button>
        
        <button
          className={`tab-button ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
          title="Assets (Ctrl+3)"
        >
          <span className="tab-icon">📁</span>
          <span className="tab-label">Assets</span>
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
          <span className="tab-icon">📊</span>
          <span className="tab-label">Insights</span>
        </button>
      </div>
      
      {/* Tab Content */}
      <div className={`tab-content ${tabLoading ? 'tab-loading' : ''}`}>
        {activeTab === 'studio' && (
          <StudioTab show={show} episodes={episodes} />
        )}
        
        {activeTab === 'episodes' && (
          <div className="episodes-tab">
            {/* Header row - aligned */}
            <div className="episodes-header">
              <div className="header-left">
                <h2 className="episodes-title">Episodes</h2>
                <span className="episodes-count">({episodes.length})</span>
              </div>
              
              <div className="header-right">
                {/* View toggle */}
                <div className="view-toggle">
                  <button 
                    className={`view-btn ${episodeView === 'kanban' ? 'active' : ''}`}
                    onClick={() => setEpisodeView('kanban')}
                    title="Pipeline view"
                  >
                    Pipeline
                  </button>
                  <button 
                    className={`view-btn ${episodeView === 'grid' ? 'active' : ''}`}
                    onClick={() => setEpisodeView('grid')}
                    title="Grid view"
                  >
                    Grid
                  </button>
                </div>
                
                <button 
                  onClick={handleCreateEpisode}
                  className="btn-primary"
                >
                  + New Episode
                </button>
              </div>
            </div>
            
            {episodes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📺</div>
                <h3>No episodes yet</h3>
                <p>Create your first episode to get started</p>
                <button 
                  onClick={handleCreateEpisode}
                  className="btn-primary"
                >
                  + Create First Episode
                </button>
              </div>
            ) : episodeView === 'kanban' ? (
              <EpisodeKanbanBoard
                episodes={episodes}
                onStatusChange={handleStatusChange}
                onCreateEpisode={handleCreateEpisode}
              />
            ) : (
              <div className="episodes-grid">
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
