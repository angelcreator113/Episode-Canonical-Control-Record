import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
import EpisodeAssetsTab from '../components/Episodes/EpisodeAssetsTab';
import EpisodeOverviewTab from '../components/Episodes/EpisodeOverviewTab';
import ScriptEditor from '../components/ScriptEditor';
import EpisodeSceneComposerTab from '../components/Episodes/EpisodeSceneComposerTab';
import EpisodeDistributionTab from '../components/Episodes/EpisodeDistributionTab';
import EpisodeWardrobeTab from '../components/Episodes/EpisodeWardrobeTab';
import EpisodeWardrobeGameplay from '../components/EpisodeWardrobeGameplay';
import SceneLibraryPicker from '../components/SceneLibraryPicker';
import SceneLinking from '../components/SceneLinking';
import useOrientation from '../hooks/useOrientation';
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
  const { isMobile, isPortrait } = useOrientation();
  const needsLandscape = isMobile && isPortrait;
  const [sceneView, setSceneView] = useState('composer');
  const [tabLoading, setTabLoading] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [episodeScenes, setEpisodeScenes] = useState([]);

  // Tab management with URL persistence
  const setActiveTab = (tab) => {
    setTabLoading(true);
    setActiveTabState(tab);
    setSearchParams({ tab });
    setTimeout(() => setTabLoading(false), 300);
  };

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
      steps.push({ title: 'Add Scenes', status: 'pending', action: () => setActiveTab('scenes') });
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
            </div>
          </div>
        </div>
        <div className="ed-header-actions">
          <Link
            to={`/episodes/${episode.id}/evaluate`}
            style={{padding:'8px 16px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'6px'}}
          >
            🎯 Evaluate
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
                    if (window.confirm('Delete this episode? This cannot be undone.')) {
                      // TODO: Implement delete
                      console.log('Delete episode:', episode.id);
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

        {/* Compact Tabs with Icons */}
        <div className="ed-tabs-modern">
          <button
            className={`ed-tab ${activeTab === 'overview' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('overview')}
            title="Overview"
          >
            <span className="ed-tab-icon">📋</span>
            <span className="ed-tab-label">Overview</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'scripts' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('scripts')}
            title="Scripts"
          >
            <span className="ed-tab-icon">📝</span>
            <span className="ed-tab-label">Script</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'scenes' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('scenes')}
            title="Scene Composer"
          >
            <span className="ed-tab-icon">🎬</span>
            <span className="ed-tab-label">Scene Composer</span>
            {needsLandscape && <span className="ed-tab-landscape-badge" title="Landscape only">↻</span>}
          </button>
          <button
            className={`ed-tab ${activeTab === 'timeline' ? 'ed-tab-active' : ''}`}
            onClick={() => {
              if (needsLandscape) {
                setActiveTab('timeline');
              } else {
                navigate(`/episodes/${episodeId}/timeline`);
              }
            }}
            title="Timeline Editor"
          >
            <span className="ed-tab-icon">⏱️</span>
            <span className="ed-tab-label">Timeline</span>
            {needsLandscape && <span className="ed-tab-landscape-badge" title="Landscape only">↻</span>}
          </button>
          <button
            className={`ed-tab ${activeTab === 'assets' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('assets')}
            title="Assets"
          >
            <span className="ed-tab-icon">🎨</span>
            <span className="ed-tab-label">Assets</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'wardrobe' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('wardrobe')}
            title="Wardrobe"
          >
            <span className="ed-tab-icon">👗</span>
            <span className="ed-tab-label">Wardrobe</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'distribution' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('distribution')}
            title="Distribution"
          >
            <span className="ed-tab-icon">📤</span>
            <span className="ed-tab-label">Distribution</span>
          </button>
          {/* TEMPORARILY DISABLED - YouTube Training feature in development
          <button
            className={`ed-tab ${activeTab === 'youtube' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('youtube')}
            title="YouTube Training"
          >
            <span className="ed-tab-icon">🎬</span>
            <span className="ed-tab-label">YouTube Training</span>
          </button>
          */}
        </div>

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
          <ScriptEditor 
            key={episode.id}
            episodeId={episode.id}
            episode={episode}
            onScriptSaved={(newScript) => {
              setEpisode(prev => ({ ...prev, script_content: newScript }));
            }}
          />
        )}

        {/* Scenes Tab - Scene Composer */}
        {activeTab === 'scenes' && (
          needsLandscape ? (
            <div className="ed-landscape-prompt">
              <div className="ed-landscape-prompt-inner">
                <div className="ed-landscape-phone-icon">
                  <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                    <rect x="14" y="8" width="36" height="48" rx="4" stroke="#ec4899" strokeWidth="2.5" fill="none" />
                    <circle cx="32" cy="50" r="2" fill="#ec4899" />
                    <path d="M50 32 C50 20 42 12 32 12" stroke="#ec4899" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <path d="M50 32 L47 27 M50 32 L54 28" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <h3>Rotate for Scene Composer</h3>
                <p>The Scene Composer works best in landscape mode. Please turn your device sideways to use this feature.</p>
              </div>
            </div>
          ) : (
            <EpisodeSceneComposerTab episode={episode} show={episode.show} />
          )
        )}

        {/* Timeline Tab - Landscape prompt on mobile portrait */}
        {activeTab === 'timeline' && needsLandscape && (
          <div className="ed-landscape-prompt">
            <div className="ed-landscape-prompt-inner">
              <div className="ed-landscape-phone-icon">
                <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                  <rect x="14" y="8" width="36" height="48" rx="4" stroke="#ec4899" strokeWidth="2.5" fill="none" />
                  <circle cx="32" cy="50" r="2" fill="#ec4899" />
                  <path d="M50 32 C50 20 42 12 32 12" stroke="#ec4899" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M50 32 L47 27 M50 32 L54 28" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Rotate for Timeline Editor</h3>
              <p>The Timeline Editor works best in landscape mode. Please turn your device sideways to use this feature.</p>
            </div>
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
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

        {/* Wardrobe Tab */}
        {activeTab === 'wardrobe' && (
          <div>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, padding: '4px', background: '#f1f5f9', borderRadius: 10, width: 'fit-content' }}>
              <button
                onClick={() => setWardrobeMode('inventory')}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: wardrobeMode === 'inventory' ? '#fff' : 'transparent',
                  color: wardrobeMode === 'inventory' ? '#6366f1' : '#64748b',
                  boxShadow: wardrobeMode === 'inventory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                📋 Assigned Items
              </button>
              <button
                onClick={() => setWardrobeMode('gameplay')}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: wardrobeMode === 'gameplay' ? '#fff' : 'transparent',
                  color: wardrobeMode === 'gameplay' ? '#ec4899' : '#64748b',
                  boxShadow: wardrobeMode === 'gameplay' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                🎮 Browse & Select
              </button>
            </div>

            {/* Inventory mode — existing tab */}
            {wardrobeMode === 'inventory' && (
              <EpisodeWardrobeTab episodeId={episodeId} episode={episode} />
            )}

            {/* Gameplay mode */}
            {wardrobeMode === 'gameplay' && (
              <div>
                {/* Event picker */}
                {episodeEvents.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    {episodeEvents.length > 1 && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                          SELECT EVENT TO STYLE FOR
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
                      Inject an event from the Events Library in Producer Mode first,<br />
                      then come back here to browse & select outfits.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Distribution Tab */}
        {activeTab === 'distribution' && (
          <EpisodeDistributionTab episode={episode} onUpdate={handleUpdateEpisode} />
        )}
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
