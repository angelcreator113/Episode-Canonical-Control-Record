import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
import EpisodeAssetsTab from '../components/Episodes/EpisodeAssetsTab';
import EpisodeOverviewTab from '../components/Episodes/EpisodeOverviewTab';
import EpisodeScriptTab from '../components/Episodes/EpisodeScriptTab';
import EpisodeDistributionTab from '../components/Episodes/EpisodeDistributionTab';
import EpisodeWardrobeTab from '../components/Episodes/EpisodeWardrobeTab';
import EpisodeWardrobeGameplay from '../components/EpisodeWardrobeGameplay';
import EpisodeTodoList from '../components/Episodes/EpisodeTodoList';
import SceneLibraryPicker from '../components/SceneLibraryPicker';
import SceneLinking from '../components/SceneLinking';
import EpisodeScenesTab from '../components/Episodes/EpisodeScenesTab';
import './EpisodeDetail.css';


const EpisodeDetail = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'overview');
  const [epSubTab, setEpSubTab] = useState(null);

  const [sceneView, setSceneView] = useState('composer');
  const [tabLoading, setTabLoading] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [episodeScenes, setEpisodeScenes] = useState([]);

  // Tab structure: 4 main tabs with sub-tabs
  const EP_TABS = [
    { key: 'overview', icon: '📋', label: 'Overview' },
    { key: 'scripts', icon: '📝', label: 'Script' },
    { key: 'production', icon: '🎬', label: 'Production', subs: [
      { key: 'assets', label: 'Assets' },
      { key: 'scenes', label: 'Scenes' },
      { key: 'wardrobe', label: 'Wardrobe' },
      { key: 'checklist', label: 'Checklist' },
    ]},
    { key: 'results', icon: '👑', label: 'Results', subs: [
      { key: 'evaluation', label: 'Evaluation' },
      { key: 'story', label: 'Story' },
      { key: 'distribution', label: 'Distribution' },
    ]},
  ];

  // Map old tab keys to new structure
  const resolveEpTab = (tab) => {
    const map = {
      'assets': ['production', 'assets'],
      'scenes': ['production', 'scenes'],
      'wardrobe': ['production', 'wardrobe'],
      'checklist': ['production', 'checklist'],
      'production': ['production', 'assets'],
      'evaluation': ['results', 'evaluation'],
      'story': ['results', 'story'],
      'distribution': ['results', 'distribution'],
    };
    return map[tab] || [tab, null];
  };

  // Tab management with URL persistence
  const setActiveTab = (tab) => {
    setTabLoading(true);
    setActiveTabState(tab);
    const epTab = EP_TABS.find(t => t.key === tab);
    setEpSubTab(epTab?.subs?.[0]?.key || null);
    setSearchParams({ tab });
    setTimeout(() => setTabLoading(false), 300);
  };

  // Resolve initial tab on mount
  React.useEffect(() => {
    const initial = searchParams.get('tab') || 'overview';
    const [main, sub] = resolveEpTab(initial);
    if (main !== initial) {
      setActiveTabState(main);
      if (sub) setEpSubTab(sub);
    } else {
      const epTab = EP_TABS.find(t => t.key === main);
      if (epTab?.subs && !epSubTab) setEpSubTab(epTab.subs[0].key);
    }
  }, []);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            setActiveTab('overview');
            break;
          case '2':
            e.preventDefault();
            setActiveTab('wardrobe');
            break;
          case '3':
            e.preventDefault();
            setActiveTab('scripts');
            break;
          case 's':
            e.preventDefault();
            setActiveTab('scenes');
            break;
          default:
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Sync with URL params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTabState(tab);
    }
  }, [searchParams]);

  const [loadingScenes, setLoadingScenes] = useState(false);
  const [episodeWardrobes, setEpisodeWardrobes] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [editingTrim, setEditingTrim] = useState({});
  const [savingScenes, setSavingScenes] = useState({});
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showOtherSteps, setShowOtherSteps] = useState(false);
  const [primaryScript, setPrimaryScript] = useState(null);
  const [wardrobeMode, setWardrobeMode] = useState('inventory'); // inventory | gameplay
  const [episodeEvents, setEpisodeEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [characterState, setCharacterState] = useState({});

  // Fetch episode data - extracted for reuse
  const fetchEpisode = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await episodeService.getEpisode(episodeId);
      setEpisode(data);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Not Found') || msg.includes('404')) {
        toast.showError('Episode not found — it may have been deleted.');
        navigate('/shows', { replace: true });
        return;
      }
      setError(msg || 'Failed to load episode');
    } finally {
      setLoading(false);
    }
  }, [episodeId, navigate, toast]);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Episode loading
  useEffect(() => {
    if (episodeId) {
      fetchEpisode();
    }
  }, [episodeId, fetchEpisode]);

  // Set this as the "working episode" for Studio tools (Timeline, Scene Composer)
  useEffect(() => {
    if (episodeId && episode) {
      localStorage.setItem('working-episode-id', episodeId);
      localStorage.setItem('working-episode-title', episode.title || episode.episodeTitle || 'Untitled');
    }
  }, [episodeId, episode]);

  // Handle episode updates from Overview tab
  const handleUpdateEpisode = async (updates) => {
    try {
      await episodeService.updateEpisode(episode.id, updates);
      // Refresh episode data
      await fetchEpisode();
    } catch (error) {
      console.error('Error updating episode:', error);
      throw error;
    }
  };

  // Load primary script for scene linking
  useEffect(() => {
    const fetchPrimaryScript = async () => {
      if (!episodeId) return;
      
      try {
        const response = await fetch(`/api/v1/episodes/${episodeId}/scripts?includeAllVersions=false`);
        const data = await response.json();
        const scripts = data.data || data.scripts || [];
        const primary = scripts.find(s => s.is_primary === true);
        setPrimaryScript(primary || scripts[0]); // Use first script if no primary
      } catch (err) {
        console.error('Failed to load primary script:', err);
      }
    };

    fetchPrimaryScript();
  }, [episodeId]);

  // Load episode scenes
  useEffect(() => {
    const fetchEpisodeScenes = async () => {
      if (!episodeId || activeTab !== 'scenes') return;
      
      try {
        setLoadingScenes(true);
        const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`);
        const data = await response.json();
        setEpisodeScenes(data.data || []);
      } catch (err) {
        console.error('Failed to load episode scenes:', err);
        toast.showError('Failed to load scenes');
      } finally {
        setLoadingScenes(false);
      }
    };

    fetchEpisodeScenes();
  }, [episodeId, activeTab]);

  // Load episode wardrobe
  useEffect(() => {
    const fetchEpisodeWardrobe = async () => {
      if (!episodeId || activeTab !== 'wardrobe') return;
      
      try {
        const response = await fetch(`/api/v1/episodes/${episodeId}/wardrobe`);
        const data = await response.json();
        setEpisodeWardrobes(data.data || data.items || []);
      } catch (err) {
        console.error('Failed to load episode wardrobe:', err);
        toast.showError('Failed to load wardrobe');
      }
    };

    fetchEpisodeWardrobe();
  }, [episodeId, activeTab]);

  // Load events + character state for wardrobe gameplay
  useEffect(() => {
    if (!episode || activeTab !== 'wardrobe') return;
    const showId = episode.show_id || episode.showId;
    if (!showId) return;

    // Fetch events injected into this episode
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/v1/world/${showId}/events`);
        const data = await res.json();
        const allEvents = data.events || [];
        const linked = allEvents.filter(e => e.used_in_episode_id === episodeId);
        setEpisodeEvents(linked);
        if (linked.length > 0 && !selectedEvent) setSelectedEvent(linked[0]);
      } catch (err) {
        console.error('Failed to load episode events:', err);
      }
    };

    // Fetch Lala's character state
    const fetchCharState = async () => {
      try {
        const res = await fetch(`/api/v1/characters/lala/state?show_id=${showId}`);
        const data = await res.json();
        setCharacterState(data.state || {});
      } catch (err) {
        console.error('Failed to load character state:', err);
      }
    };

    fetchEvents();
    fetchCharState();
  }, [episode, activeTab, episodeId]);

  // Handle scene selection from library
  const handleSceneSelect = async (libraryScene) => {
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneLibraryId: libraryScene.id,
          trimStart: 0,
          trimEnd: libraryScene.durationSeconds || libraryScene.duration_seconds,
        }),
      });

      if (response.ok) {
        // Reload scenes
        const data = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`);
        const scenesData = await data.json();
        setEpisodeScenes(scenesData.data || []);
      }
    } catch (err) {
      console.error('Failed to add scene to episode:', err);
      alert('Failed to add scene. Please try again.');
    }
  };

  // Select scene for preview
  const handleSelectSceneForPreview = (sceneId) => {
    setSelectedSceneId(sceneId);
  };

  // Update trim times
  const handleTrimChange = (sceneId, field, value) => {
    setEditingTrim({
      ...editingTrim,
      [sceneId]: {
        ...editingTrim[sceneId],
        [field]: parseFloat(value) || 0,
      },
    });
  };

  // Save trim changes
  const handleSaveTrim = async (sceneId) => {
    const trimData = editingTrim[sceneId];
    if (!trimData) return;

    try {
      setSavingScenes({ ...savingScenes, [sceneId]: true });

      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trimStart: trimData.trimStart,
          trimEnd: trimData.trimEnd,
        }),
      });

      if (response.ok) {
        // Reload scenes
        const data = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`);
        const scenesData = await data.json();
        setEpisodeScenes(scenesData.data || []);
        setEditingTrim({ ...editingTrim, [sceneId]: undefined });
      } else {
        alert('Failed to save trim changes');
      }
    } catch (err) {
      console.error('Failed to save trim:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSavingScenes({ ...savingScenes, [sceneId]: false });
    }
  };

  // Reorder scenes
  const handleReorderScene = async (index, direction) => {
    const newScenes = [...episodeScenes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newScenes.length) return;

    // Swap scenes
    [newScenes[index], newScenes[targetIndex]] = [newScenes[targetIndex], newScenes[index]];

    // Update scene_order for both scenes
    try {
      await Promise.all([
        fetch(`/api/v1/episodes/${episodeId}/library-scenes/${newScenes[index].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneOrder: index + 1 }),
        }),
        fetch(`/api/v1/episodes/${episodeId}/library-scenes/${newScenes[targetIndex].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneOrder: targetIndex + 1 }),
        }),
      ]);

      // Reload scenes
      const data = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`);
      const scenesData = await data.json();
      setEpisodeScenes(scenesData.data || []);
    } catch (err) {
      console.error('Failed to reorder scenes:', err);
      alert('Failed to reorder scenes. Please try again.');
    }
  };

  // Remove scene from episode
  const handleRemoveScene = async (sceneId) => {
    if (!confirm('Remove this scene from the episode?')) return;

    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes/${sceneId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload scenes
        const data = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`);
        const scenesData = await data.json();
        setEpisodeScenes(scenesData.data || []);
      }
    } catch (err) {
      console.error('Failed to remove scene:', err);
      alert('Failed to remove scene. Please try again.');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      published: 'green',
      pending: 'yellow',
      archived: 'red'
    };
    return colors[status?.toLowerCase()] || 'gray';
  };

  // Determine the primary next action
  const getPrimaryNextAction = () => {
    if (episodeScenes.length === 0) {
      return {
        title: 'Add your first scene',
        description: 'Start building your episode by adding scenes from the library',
        action: () => setActiveTab('scenes'),
        buttonText: 'Go to Scenes'
      };
    }
    if (!episode.thumbnailUrl && !episode.thumbnail_url) {
      return {
        title: 'Create a thumbnail',
        description: 'Design a compelling thumbnail to represent this episode',
        action: () => navigate(`/episodes/${episode.id}/scene-composer`),
        buttonText: 'Create Thumbnail'
      };
    }
    if (episode.wardrobeCount === 0) {
      return {
        title: 'Add wardrobe items',
        description: 'Configure wardrobe items for your characters',
        action: () => setActiveTab('wardrobe'),
        buttonText: 'Go to Wardrobe'
      };
    }
    if (episode.status !== 'published') {
      return {
        title: 'Publish your episode',
        description: 'Everything looks good! Ready to publish?',
        action: () => navigate(`/episodes/${episode.id}/edit`),
        buttonText: 'Update Status'
      };
    }
    return null;
  };

  // Get remaining steps (not the primary one)
  const getOtherSteps = () => {
    const steps = [];
    const primaryAction = getPrimaryNextAction();
    
    if (episodeScenes.length === 0 && primaryAction?.title !== 'Add your first scene') {
      steps.push({ title: 'Add Scenes', status: 'pending', action: () => navigate(`/episodes/${episode.id}/scene-composer`) });
    } else if (episodeScenes.length > 0) {
      steps.push({ title: 'Add Scenes', status: 'complete', count: episodeScenes.length });
    }
    
    if (!episode.thumbnailUrl && !episode.thumbnail_url && primaryAction?.title !== 'Create a thumbnail') {
      steps.push({ title: 'Create Thumbnail', status: 'pending', action: () => navigate(`/episodes/${episode.id}/scene-composer`) });
    } else if (episode.thumbnailUrl || episode.thumbnail_url) {
      steps.push({ title: 'Create Thumbnail', status: 'complete' });
    }
    
    if (episode.wardrobeCount === 0 && primaryAction?.title !== 'Add wardrobe items') {
      steps.push({ title: 'Add Wardrobe', status: 'pending', action: () => setActiveTab('wardrobe') });
    } else if (episode.wardrobeCount > 0) {
      steps.push({ title: 'Add Wardrobe', status: 'complete', count: episode.wardrobeCount });
    }
    
    if (episode.status !== 'published' && primaryAction?.title !== 'Publish your episode') {
      steps.push({ title: 'Publish Episode', status: 'pending', action: () => navigate(`/episodes/${episode.id}/edit`) });
    } else if (episode.status === 'published') {
      steps.push({ title: 'Publish Episode', status: 'complete' });
    }
    
    return steps;
  };

  if (authLoading || loading) {
    return (
      <div className="ed-page">
        <div className="ed-state">
          <div className="ed-spinner"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="ed-page">
        <div className="ed-state ed-state-error">
          <span className="ed-error-icon">⚠️</span>
          <h2>Episode Not Found</h2>
          <p>{error || 'The episode you\'re looking for doesn\'t exist.'}</p>
          <button onClick={() => navigate(episode?.show_id ? `/shows/${episode.show_id}` : '/episodes')} className="ed-btn ed-btn-primary">
            ← Back to Show
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ed-page">
      {/* Simplified Header: Identity + Action */}
      <div className="ed-header-new">
        <div className="ed-header-left">
          <button onClick={() => navigate(episode?.show_id || episode?.showId ? `/shows/${episode.show_id || episode.showId}` : '/episodes')} className="ed-back-btn">
            ← Back to Show
          </button>
          <div className="ed-header-info">
            <h1 className="ed-header-title">{episode.title || episode.episodeTitle || 'Untitled Episode'}</h1>
            <div className="ed-header-meta">
              {(episode.episode_number || episode.episodeNumber) && (
                <span className="ed-meta-item">
                  <span className="ed-meta-label">Episode</span>
                  <span className="ed-meta-value">{episode.episode_number || episode.episodeNumber}</span>
                </span>
              )}
              {episode.show && (
                <Link 
                  to={`/shows/${episode.show.id}`} 
                  className="ed-show-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="ed-show-icon">📺</span>
                  <span className="ed-show-name">{episode.show.name}</span>
                </Link>
              )}
              <span className={`ed-status-badge ed-status-${episode.status?.toLowerCase() || 'draft'}`}>
                {episode.status || 'Draft'}
              </span>
              <span className="ed-working-badge" title="Studio tools (Timeline, Scene Composer) will open this episode">
                ◆ Working Episode
              </span>
            </div>
          </div>
        </div>
        <div className="ed-header-actions">
          <Link
            to={`/episodes/${episode.id}/todo`}
            style={{padding:'5px 10px', background:'#FAF7F0', border:'1px solid #e8e0d0', borderRadius:6, color:'#B8962E', fontSize:12, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'4px'}}
          >
            Todo List
          </Link>
          <Link
            to={`/episodes/${episode.id}/evaluate`}
            style={{padding:'5px 10px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:6, color:'#fff', fontSize:12, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'4px'}}
          >
            Evaluate
          </Link>
          <div className="ed-more-menu">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="ed-btn-more"
              aria-label="More actions"
            >
              ⋯
            </button>
            {showMoreActions && (
              <div className="ed-dropdown">
                <button
                  onClick={() => {
                    navigate(`/episodes/${episode.id}/edit`);
                    setShowMoreActions(false);
                  }}
                  className="ed-dropdown-item"
                >
                  <span>✏️</span>
                  <span>Edit Episode</span>
                </button>
                <button
                  onClick={() => {
                    navigate(`/episodes/${episode.id}/scene-composer`);
                    setShowMoreActions(false);
                  }}
                  className="ed-dropdown-item"
                >
                  <span>🎨</span>
                  <span>Create Thumbnail</span>
                </button>
                <button
                  onClick={() => {
                    navigate(`/episodes/${episode.id}/plan`);
                    setShowMoreActions(false);
                  }}
                  className="ed-dropdown-item"
                >
                  <span>🎬</span>
                  <span>Scene Planner</span>
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('Delete this episode? This cannot be undone.')) {
                      try {
                        await episodeService.deleteEpisode(episode.id);
                        toast.showSuccess('Episode deleted');
                        navigate('/episodes');
                      } catch (err) {
                        toast.showError(err.message || 'Failed to delete episode');
                      }
                    }
                    setShowMoreActions(false);
                  }}
                  className="ed-dropdown-item ed-dropdown-danger"
                >
                  <span>🗑️</span>
                  <span>Delete Episode</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="ed-wrap">

        {/* Main Tabs */}
        <div className="ed-tabs-modern">
          {EP_TABS.map(t => (
            <button key={t.key}
              className={`ed-tab ${activeTab === t.key ? 'ed-tab-active' : ''}`}
              onClick={() => setActiveTab(t.key)}
              title={t.label}
            >
              <span className="ed-tab-icon">{t.icon}</span>
              <span className="ed-tab-label">{t.label}</span>
            </button>
          ))}
        </div>
        {/* Sub-tabs */}
        {(() => {
          const currentTab = EP_TABS.find(t => t.key === activeTab);
          if (!currentTab?.subs) return null;
          return (
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,0,0,0.04)', paddingLeft: 8 }}>
              {currentTab.subs.map(s => (
                <button key={s.key} onClick={() => setEpSubTab(s.key)} style={{
                  padding: '6px 14px', background: 'transparent', border: 'none',
                  borderBottom: epSubTab === s.key ? '2px solid #6366f1' : '2px solid transparent',
                  color: epSubTab === s.key ? '#6366f1' : '#94a3b8',
                  fontSize: 12, fontWeight: epSubTab === s.key ? 600 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Content Area */}
        <div className="ed-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <EpisodeOverviewTab 
            episode={episode} 
            show={episode.show}
            onUpdate={handleUpdateEpisode}
          />
        )}

        {/* Scripts Tab */}
        {activeTab === 'scripts' && (
          <EpisodeScriptTab
            key={episode.id}
            episode={episode}
            show={episode.show || show}
          />
        )}

        {/* Assets Tab */}
        {activeTab === 'production' && epSubTab === 'assets' && (
          episode.show ? (
            <EpisodeAssetsTab episode={episode} show={episode.show} />
          ) : (
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🎨 Episode Assets</h2>
              </div>
              <div className="ed-cardbody">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                  <p style={{ color: '#64748b' }}>
                    This episode needs to be linked to a show to use the asset system.
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '1rem' }}>
                    Please edit the episode and select a show.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {/* Scenes Tab */}
        {activeTab === 'production' && epSubTab === 'scenes' && (
          <EpisodeScenesTab
            episode={episode}
            onToast={(msg, type) => toast && toast[type] ? toast[type](msg) : console.log(msg)}
          />
        )}

        {/* Wardrobe Tab */}
        {activeTab === 'production' && epSubTab === 'wardrobe' && (
          <div>
            {/* Unified wardrobe — event picker + outfit builder */}
            {episodeEvents.length > 0 ? (
              <div>
                {episodeEvents.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                      STYLING FOR EVENT
                    </label>
                    <select
                      value={selectedEvent?.id || ''}
                      onChange={(e) => {
                        const ev = episodeEvents.find(ev => ev.id === e.target.value);
                        setSelectedEvent(ev || null);
                      }}
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                        fontSize: 13, color: '#1a1a2e', background: '#fff', width: '100%', maxWidth: 400,
                      }}
                    >
                      {episodeEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} — {ev.dress_code || 'No dress code'} (Prestige {ev.prestige || '?'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedEvent && (
                  <EpisodeWardrobeGameplay
                    episodeId={episodeId}
                    showId={episode?.show_id || episode?.showId}
                    event={selectedEvent}
                    characterState={characterState}
                    onOutfitComplete={(result) => {
                      console.log('Outfit locked:', result.slots, 'Synergy:', result.synergy.total);
                    }}
                  />
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💌</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No events linked to this episode</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Inject an event from the Events Library first, then come back to build your outfit.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Story Tab — links to Stories page */}
        {activeTab === 'results' && epSubTab === 'story' && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Episode Stories</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={async (e) => {
                  const btn = e.currentTarget; btn.disabled = true; btn.textContent = '⏳ Generating...';
                  try {
                    const sid = episode?.show_id || episode?.showId;
                    await api.post(`/api/v1/world/${sid}/episodes/${episode.id}/generate-story`, { format: 'short_story' });
                    btn.textContent = '✓ Generated — open Stories'; setTimeout(() => { btn.textContent = '✦ Generate Short Story'; btn.disabled = false; }, 2000);
                  } catch { btn.textContent = 'Failed'; btn.disabled = false; }
                }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✦ Generate Short Story
                </button>
                <button onClick={() => window.location.href = '/stories'} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  ✍️ Open Stories Library
                </button>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a2e' }}>Generate Stories</h3>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, maxWidth: 400, margin: '0 auto 16px' }}>
                Transform this episode into prose — short story, social fiction, snippet, or recap.
                Each format tells the same story differently.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { format: 'short_story', icon: '📖', label: 'Short Story', desc: '2-3K words' },
                  { format: 'social_fiction', icon: '📱', label: 'Social Fiction', desc: 'Posts & DMs' },
                  { format: 'snippet', icon: '✂️', label: 'Snippet', desc: '400-600 words' },
                  { format: 'recap', icon: '🔄', label: 'Recap', desc: 'Casual retelling' },
                ].map(f => (
                  <button key={f.format} onClick={async (e) => {
                    const btn = e.currentTarget; btn.disabled = true; const orig = btn.textContent; btn.textContent = '⏳...';
                    try {
                      const sid = episode?.show_id || episode?.showId;
                      await api.post(`/api/v1/world/${sid}/episodes/${episode.id}/generate-story`, { format: f.format });
                      btn.textContent = '✓'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
                    } catch { btn.textContent = '✗'; btn.disabled = false; }
                  }} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fafafa', cursor: 'pointer', textAlign: 'center', minWidth: 120 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e' }}>{f.label}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Distribution Tab */}
        {activeTab === 'results' && epSubTab === 'distribution' && (
          <EpisodeDistributionTab episode={episode} onUpdate={handleUpdateEpisode} />
        )}

        {/* Production Tab */}
        {activeTab === 'production' && epSubTab === 'checklist' && (
          <EpisodeTodoList
            episodeId={episode.id}
            showId={episode?.show_id || episode?.showId}
            onAllRequiredComplete={() => console.log('Episode ready!')}
          />
        )}

        {/* Evaluation Tab */}
        {activeTab === 'results' && epSubTab === 'evaluation' && (() => {
          const evalJson = episode.evaluation_json
            ? (typeof episode.evaluation_json === 'string' ? JSON.parse(episode.evaluation_json) : episode.evaluation_json)
            : null;

          const TIER_STYLES = {
            slay: { color: '#FFD700', bg: '#FFFBEB', emoji: '👑', label: 'SLAY' },
            pass: { color: '#22c55e', bg: '#f0fdf4', emoji: '✨', label: 'PASS' },
            safe: { color: '#eab308', bg: '#fefce8', emoji: '😐', label: 'SAFE' },
            fail: { color: '#dc2626', bg: '#fef2f2', emoji: '💔', label: 'FAIL' },
          };

          if (!evalJson) {
            return (
              <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👑</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#1a1a2e' }}>Not Evaluated Yet</h3>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  Complete this episode from the event panel to evaluate it.
                  Evaluation scores outfit match, event performance, social tasks, and financials.
                </p>
              </div>
            );
          }

          const tier = TIER_STYLES[evalJson.tier_final] || TIER_STYLES.safe;
          const breakdown = evalJson.breakdown || {};
          const deltas = evalJson.stat_deltas || {};
          const narrative = evalJson.narrative_lines || {};
          const socialBonuses = evalJson.social_task_bonuses?.detail || {};
          const wardrobeBonuses = evalJson.wardrobe_bonuses?.detail || {};
          const financials = evalJson.financial_summary || {};

          return (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              {/* Tier Banner */}
              <div style={{ background: tier.bg, border: `2px solid ${tier.color}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 48 }}>{tier.emoji}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: tier.color }}>{tier.label}</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: '#1a1a2e', margin: '4px 0' }}>{evalJson.score}/100</div>
                <p style={{ fontSize: 14, color: '#64748b', margin: '8px 0 0', fontStyle: 'italic' }}>
                  {narrative.short || narrative.dramatic || ''}
                </p>
              </div>

              {/* Score Breakdown */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Score Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(breakdown).map(([key, entry]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <span style={{ fontSize: 13, color: '#1a1a2e', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{entry.detail}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: entry.value >= 0 ? '#16a34a' : '#dc2626', minWidth: 40, textAlign: 'right' }}>
                          {entry.value >= 0 ? '+' : ''}{entry.value}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Total</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: tier.color }}>{evalJson.score}</span>
                  </div>
                </div>
              </div>

              {/* Stat Deltas */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Character Stat Changes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {[
                    { key: 'coins', label: 'Coins', icon: '🪙' },
                    { key: 'reputation', label: 'Reputation', icon: '⭐' },
                    { key: 'brand_trust', label: 'Brand Trust', icon: '🤝' },
                    { key: 'influence', label: 'Influence', icon: '📣' },
                    { key: 'stress', label: 'Stress', icon: '😰' },
                  ].map(stat => {
                    const val = deltas[stat.key] || 0;
                    const isGood = stat.key === 'stress' ? val < 0 : val > 0;
                    const isBad = stat.key === 'stress' ? val > 0 : val < 0;
                    return (
                      <div key={stat.key} style={{ textAlign: 'center', padding: '8px 0', borderRadius: 8, background: isGood ? '#f0fdf4' : isBad ? '#fef2f2' : '#f8f8f8' }}>
                        <div style={{ fontSize: 16 }}>{stat.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: isGood ? '#16a34a' : isBad ? '#dc2626' : '#94a3b8' }}>
                          {val > 0 ? '+' : ''}{val}
                        </div>
                        <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>{stat.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Social + Wardrobe + Financial Context */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {socialBonuses.total > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>📱 Social Tasks</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{socialBonuses.completed}/{socialBonuses.total}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      {socialBonuses.completion_rate}% complete
                      {socialBonuses.all_required_done && <span style={{ color: '#16a34a' }}> · All required done</span>}
                    </div>
                  </div>
                )}
                {wardrobeBonuses.brands?.length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>👗 Outfit</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Brands: {wardrobeBonuses.brands.join(', ')}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                      Tier gap: {wardrobeBonuses.tier_gap > 0 ? 'overdressed' : wardrobeBonuses.tier_gap < 0 ? 'underdressed' : 'perfect match'}
                    </div>
                  </div>
                )}
                {financials.total_income > 0 || financials.total_expenses > 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>💰 Financials</div>
                    <div style={{ fontSize: 11, color: '#16a34a' }}>+{financials.total_income || 0} income</div>
                    <div style={{ fontSize: 11, color: '#dc2626' }}>-{financials.total_expenses || 0} expenses</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: (financials.total_income || 0) - (financials.total_expenses || 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                      Net: {(financials.total_income || 0) - (financials.total_expenses || 0) >= 0 ? '+' : ''}{(financials.total_income || 0) - (financials.total_expenses || 0)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Scene Library Picker Modal */}
      <SceneLibraryPicker
        isOpen={showScenePicker}
        onClose={() => setShowScenePicker(false)}
        onSelect={handleSceneSelect}
        showId={episode?.show_id || episode?.showId}
        episodeId={episodeId}
      />
    </div>
    </div>
  );
};

export default EpisodeDetail;
