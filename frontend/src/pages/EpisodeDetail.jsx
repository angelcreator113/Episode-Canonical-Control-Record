import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import episodeService from '../services/episodeService';
import EpisodeWardrobe from '../components/EpisodeWardrobe';
import EpisodeAssetsTab from '../components/EpisodeAssetsTab';
import EpisodeScripts from '../components/EpisodeScripts';
import RawFootageUpload from '../components/RawFootageUpload';
import SceneLibraryPicker from '../components/SceneLibraryPicker';
import SceneLinking from '../components/SceneLinking';
import DecisionHistory from '../components/DecisionHistory';
import DecisionStats from '../components/DecisionStats';
import YouTubeAnalyzer from '../components/YouTubeAnalyzer';
import DecisionHistoryWithAnalytics from '../components/DecisionHistoryWithAnalytics';
import LayerStudioFinal from '../components/LayerStudio/LayerStudioFinal';
import './EpisodeDetail.css';


const EpisodeDetail = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'overview');
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
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [episodeWardrobes, setEpisodeWardrobes] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [editingTrim, setEditingTrim] = useState({});
  const [savingScenes, setSavingScenes] = useState({});
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showOtherSteps, setShowOtherSteps] = useState(false);
  const [primaryScript, setPrimaryScript] = useState(null);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Episode loading
  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await episodeService.getEpisode(episodeId);
        setEpisode(data);
      } catch (err) {
        setError(err.message || 'Failed to load episode');
      } finally {
        setLoading(false);
      }
    };

    if (episodeId) {
      fetchEpisode();
    }
  }, [episodeId]);

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

  // Load episode assets
  useEffect(() => {
    const fetchEpisodeAssets = async () => {
      if (!episodeId || activeTab !== 'assets') return;
      
      try {
        const response = await fetch(`/api/v1/episodes/${episodeId}/assets`);
        const data = await response.json();
        setEpisodeAssets(data.data || data.assets || []);
      } catch (err) {
        console.error('Failed to load episode assets:', err);
      }
    };

    fetchEpisodeAssets();
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
        action: () => navigate(`/episodes/${episode.id}/timeline`),
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
      steps.push({ title: 'Create Thumbnail', status: 'pending', action: () => navigate(`/episodes/${episode.id}/timeline`) });
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
          <button onClick={() => navigate('/episodes')} className="ed-btn ed-btn-primary">
            ← Back to Episodes
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
          <button onClick={() => navigate('/episodes')} className="ed-back-btn">
            ← Episodes
          </button>
          <div className="ed-header-info">
            <h1 className="ed-header-title">{episode.title || episode.episodeTitle || 'Untitled Episode'}</h1>
            <div className="ed-header-meta">
              <span className="ed-meta-item">
                <span className="ed-meta-label">Episode</span>
                <span className="ed-meta-value">{episode.episode_number || episode.episodeNumber || '?'}</span>
              </span>
              <span className={`ed-status-badge ed-status-${episode.status?.toLowerCase() || 'draft'}`}>
                {episode.status || 'Draft'}
              </span>
            </div>
          </div>
        </div>
        <div className="ed-header-actions">
          <button
            onClick={() => navigate(`/episodes/${episode.id}/edit`)}
            className="ed-btn-primary-action"
          >
            <span>✏️</span>
            <span>Edit Episode</span>
          </button>
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
                    navigate(`/episodes/${episode.id}/timeline`);
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
            className={`ed-tab ${activeTab === 'wardrobe' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('wardrobe')}
            title="Wardrobe"
          >
            <span className="ed-tab-icon">👔</span>
            <span className="ed-tab-label">Wardrobe</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'scripts' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('scripts')}
            title="Scripts"
          >
            <span className="ed-tab-icon">📝</span>
            <span className="ed-tab-label">Scripts</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'footage' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('footage')}
            title="Raw Footage"
          >
            <span className="ed-tab-icon">🎬</span>
            <span className="ed-tab-label">Raw Footage</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'scenes' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('scenes')}
            title="Scenes"
          >
            <span className="ed-tab-icon">🎬</span>
            <span className="ed-tab-label">Scenes</span>
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
            className={`ed-tab ${activeTab === 'metadata' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('metadata')}
            title="Metadata"
          >
            <span className="ed-tab-icon">📊</span>
            <span className="ed-tab-label">Meta</span>
          </button>
          <button
            className={`ed-tab ${activeTab === 'history' ? 'ed-tab-active' : ''}`}
            onClick={() => setActiveTab('history')}
            title="Decisions & Analytics"
          >
            <span className="ed-tab-icon">🎯</span>
            <span className="ed-tab-label">Decisions</span>
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
          <div className="ed-stack">
            {/* Primary Next Action */}
            {getPrimaryNextAction() && (
              <div className="ed-card ed-next-primary">
                <div className="ed-next-icon">→</div>
                <div className="ed-next-body">
                  <h3 className="ed-next-title">{getPrimaryNextAction().title}</h3>
                  <p className="ed-next-desc">{getPrimaryNextAction().description}</p>
                </div>
                <button 
                  onClick={getPrimaryNextAction().action}
                  className="ed-btn ed-btn-primary"
                >
                  {getPrimaryNextAction().buttonText}
                </button>
              </div>
            )}

            {/* Other Steps (Collapsible) */}
            {getOtherSteps().length > 0 && (
              <div className="ed-card ed-compact">
                <button 
                  className="ed-expand-trigger"
                  onClick={() => setShowOtherSteps(!showOtherSteps)}
                >
                  <span className="ed-expand-label">Other steps</span>
                  <span className="ed-expand-count">({getOtherSteps().filter(s => s.status === 'complete').length}/{getOtherSteps().length})</span>
                  <span className={`ed-expand-arrow ${showOtherSteps ? 'is-open' : ''}`}>▼</span>
                </button>
                {showOtherSteps && (
                  <div className="ed-other-steps">
                    {getOtherSteps().map((step, idx) => (
                      <div key={idx} className={`ed-step-item ${step.status}`}>
                        <span className="ed-step-icon">{step.status === 'complete' ? '✓' : '○'}</span>
                        <span className="ed-step-text">
                          {step.title}
                          {step.count && <span className="ed-step-badge">{step.count}</span>}
                        </span>
                        {step.action && step.status === 'pending' && (
                          <button onClick={step.action} className="ed-step-btn">→</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description Section */}
            {episode.description && (
              <div className="ed-card ed-compact">
                <h3 className="ed-section-title">Description</h3>
                <p className="ed-bodytext">{episode.description}</p>
              </div>
            )}

            {/* Categories */}
            {episode.categories && Array.isArray(episode.categories) && episode.categories.length > 0 && (
              <div className="ed-card ed-compact">
                <h3 className="ed-section-title">Categories</h3>
                <div className="ed-tags">
                  {episode.categories.map((cat, idx) => (
                    <span key={idx} className="ed-tag">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wardrobe Tab */}
        {activeTab === 'wardrobe' && (
          <div className="ed-fullbleed">
            <EpisodeWardrobe
              episodeId={episode.id}
              episodeNumber={episode.episode_number}
            />
          </div>
        )}

        {/* Scripts Tab */}
        {activeTab === 'scripts' && (
          <EpisodeScripts episodeId={episode.id} showId={episode.show_id} />
        )}

        {/* Raw Footage Tab */}
        {activeTab === 'footage' && (
          <div className="ed-card">
            <div className="ed-cardhead">
              <h2 className="ed-cardtitle">🎬 Raw Footage Upload</h2>
              <p className="text-sm text-gray-600 mt-2">
                Upload raw video clips for this episode. Files will be stored in S3 and metadata extracted automatically.
              </p>
            </div>
            <div className="ed-cardbody">
              <RawFootageUpload 
                episodeId={episode.id} 
                onUploadComplete={() => {
                  console.log('Upload complete');
                }}
              />
            </div>
          </div>
        )}

        {/* Scenes Tab - Consolidated (Composer + Linking) */}
        {activeTab === 'scenes' && (
          <div className="ed-fullbleed">
            {/* Scene Subtabs */}
            <div style={{
              display: 'flex',
              gap: '1px',
              borderBottom: '1px solid #1f2937',
              backgroundColor: '#111827',
              padding: '0 1.5rem'
            }}>
              <button
                onClick={() => setSceneView('composer')}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: sceneView === 'composer' ? '600' : '500',
                  color: sceneView === 'composer' ? '#ec4899' : '#9ca3af',
                  borderBottom: sceneView === 'composer' ? '2px solid #ec4899' : 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s'
                }}
              >
                🎬 Scene Composer
              </button>
              <button
                onClick={() => setSceneView('linking')}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: sceneView === 'linking' ? '600' : '500',
                  color: sceneView === 'linking' ? '#ec4899' : '#9ca3af',
                  borderBottom: sceneView === 'linking' ? '2px solid #ec4899' : 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s'
                }}
              >
                🔗 Scene Linking
              </button>
            </div>

            {/* Composer View */}
            {sceneView === 'composer' && (
              <div className="ed-layers-tab-container">
                <LayerStudioFinal episodeId={episodeId} />
              </div>
            )}

            {/* Linking View */}
            {sceneView === 'linking' && (
              <div className="ed-card">
                <div className="ed-cardhead">
                  <h2 className="ed-cardtitle">🔗 Scene Linking</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Link uploaded footage clips to AI-detected scenes from your script.
                  </p>
                </div>
                <div className="ed-cardbody">
                  <SceneLinking 
                    episodeId={episode.id} 
                    scriptId={primaryScript?.id}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <EpisodeAssetsTab episodeId={episode.id} />
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="ed-stack">
            {/* Quick Stats */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">📊 Episode Stats</h2>
                <button 
                  onClick={() => navigate(`/episodes/${episode.id}/edit`)}
                  className="ed-btn ed-btn-primary ed-btn-sm">
                  <span>✏️</span>
                  <span>Edit</span>
                </button>
              </div>
              <div className="ed-statgrid">
                <div className="ed-stat">
                  <div className="k">Status</div>
                  <div className="v">
                    <span className={`ed-badge ed-badge-${episode.status?.toLowerCase() === 'published' ? 'success' : episode.status?.toLowerCase() === 'pending' ? 'warning' : 'neutral'}`}>
                      {episode.status || 'Draft'}
                    </span>
                  </div>
                </div>
                <div className="ed-stat">
                  <div className="k">Episode Number</div>
                  <div className="v">
                    {episode.episode_number || episode.episodeNumber || 'N/A'}
                  </div>
                </div>
                {(episode.air_date || episode.airDate) && (
                  <div className="ed-stat">
                    <div className="k">Air Date</div>
                    <div className="v">
                      {formatDate(episode.air_date || episode.airDate)}
                    </div>
                  </div>
                )}
                {episode.duration && (
                  <div className="ed-stat">
                    <div className="k">Duration</div>
                    <div className="v">{episode.duration} minutes</div>
                  </div>
                )}
                <div className="ed-stat">
                  <div className="k">Scenes</div>
                  <div className="v">{episodeScenes.length || 0}</div>
                </div>
                <div className="ed-stat">
                  <div className="k">Thumbnail</div>
                  <div className="v">
                    <span className={`ed-badge ${episode.thumbnailUrl || episode.thumbnail_url ? 'ed-badge-success' : 'ed-badge-warning'}`}>
                      {episode.thumbnailUrl || episode.thumbnail_url ? '✓ Ready' : '⚠ Missing'}
                    </span>
                  </div>
                </div>
                <div className="ed-stat">
                  <div className="k">Wardrobe Items</div>
                  <div className="v">{episode.wardrobeCount || 0}</div>
                </div>
              </div>
            </div>

            {/* System Information */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🔐 System Information</h2>
              </div>
              <div className="ed-infogrid">
                <div className="ed-info">
                  <div className="k">Episode ID</div>
                  <div className="v ed-mono">{episode.id}</div>
                </div>
                {episode.show_id && (
                  <div className="ed-info">
                    <div className="k">Show ID</div>
                    <div className="v ed-mono">{episode.show_id}</div>
                  </div>
                )}
                {(episode.created_at || episode.createdAt) && (
                  <div className="ed-info">
                    <div className="k">Created</div>
                    <div className="v">
                      {formatDateTime(episode.created_at || episode.createdAt)}
                    </div>
                  </div>
                )}
                {(episode.updated_at || episode.updatedAt) && (
                  <div className="ed-info">
                    <div className="k">Last Updated</div>
                    <div className="v">
                      {formatDateTime(episode.updated_at || episode.updatedAt)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Episode Metadata Card */}
            <div className="ed-card">
              <div className="ed-cardhead">
                <h2 className="ed-cardtitle">🔧 Raw JSON Metadata</h2>
              </div>
              {episode.metadata && Object.keys(episode.metadata).length > 0 ? (
                <div className="ed-codebox">
                  <pre>
                    {JSON.stringify(episode.metadata, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="ed-empty ed-empty-tight">
                  <div className="ed-empty-ic">📋</div>
                  <h3>No Additional Metadata</h3>
                  <p>Custom metadata fields will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* YouTube Training Tab - TEMPORARILY DISABLED
        {activeTab === 'youtube' && (
          <YouTubeAnalyzer episodeId={episodeId} />
        )}
        */}

        {/* Decisions Tab - Analytics + History */}
        {activeTab === 'history' && (
          <div className="ed-stack">
            <DecisionHistoryWithAnalytics episodeId={episodeId} />
          </div>
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
