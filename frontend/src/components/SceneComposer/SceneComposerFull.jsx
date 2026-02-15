import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Stage from './Stage';
import SceneControlsPanel from './SceneControlsPanel';
import SaveIndicator from '../SaveIndicator/SaveIndicator';
import ExportDropdown from '../ExportDropdown/ExportDropdown';
import { episodeAPI, platformAPI, sceneAPI, saveEpisodeData } from '../../services/api';
import useSaveManager from '../../hooks/useSaveManager';
import LandscapeRequired from '../LandscapeRequired';
import SceneWardrobePicker from './SceneWardrobePicker';
import AssetUploadModal from './AssetUploadModal';
import './SceneComposerFull.css';

function SceneComposerFull() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  
  // Platform selection with multiple format presets
  const [platform, setPlatform] = useState('youtube');
  const platforms = {
    youtube: { width: 1920, height: 1080, ratio: '16:9', name: 'YouTube', icon: '📺' },
    instagram: { width: 1080, height: 1920, ratio: '9:16', name: 'Instagram', icon: '📱' },
    tiktok: { width: 1080, height: 1920, ratio: '9:16', name: 'TikTok', icon: '🎵' },
    twitter: { width: 1200, height: 675, ratio: '16:9', name: 'Twitter', icon: '𝕏' },
    square: { width: 1080, height: 1080, ratio: '1:1', name: 'Square', icon: '⬛' },
    cinema: { width: 2560, height: 1440, ratio: '16:9', name: '4K', icon: '🎬' }
  };
  const currentPlatform = platforms[platform];
  
  // State
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [episode, setEpisode] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selection & Edit Mode State
  const [selected, setSelected] = useState(null); // { type: 'character' | 'ui' | 'background', id }
  const [editLayoutEnabled, setEditLayoutEnabled] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true); // Safe zones toggle

  // Drag-and-drop state for scene reordering
  const [draggedSceneIndex, setDraggedSceneIndex] = useState(null);
  const [dragOverSceneIndex, setDragOverSceneIndex] = useState(null);
  const [showWardrobePicker, setShowWardrobePicker] = useState(false);
  const [uploadModal, setUploadModal] = useState(null); // null | 'background' | 'character' | 'ui_element'

  // ── Undo / Redo history ──
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const MAX_UNDO = 50;

  // Auto-save + manual save
  const getSavePayload = useCallback(() => ({
    episode: episode ? { title: episode.title, episode_number: episode.episode_number } : {},
    platform: {
      platform,
      width: currentPlatform.width,
      height: currentPlatform.height,
      aspect_ratio: currentPlatform.ratio,
    },
    scenes: scenes.map((scene, idx) => ({
      id: scene.id,
      scene_number: scene.scene_number || idx + 1,
      title: scene.title,
      duration_seconds: scene.duration_seconds,
      background_url: scene.background_url,
      characters: scene.characters,
      ui_elements: scene.ui_elements,
      dialogue_clips: scene.dialogue_clips,
    })),
  }), [episode, platform, scenes, currentPlatform]);

  const { saveStatus, lastSaved, errorMessage, save, markDirty } = useSaveManager({
    episodeId,
    getSavePayload,
    autoSaveDelay: 3000,
    enabled: true
  });

  // Undo / Redo helpers — must be after useSaveManager so markDirty is available
  const getSnapshot = useCallback(() => ({
    scenes: JSON.parse(JSON.stringify(scenes)),
    currentSceneIndex,
  }), [scenes, currentSceneIndex]);

  const pushHistory = useCallback(() => {
    undoStackRef.current.push(getSnapshot());
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(0);
  }, [getSnapshot]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(getSnapshot());
    const prev = undoStackRef.current.pop();
    setScenes(prev.scenes);
    setCurrentSceneIndex(prev.currentSceneIndex);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    markDirty();
  }, [getSnapshot, markDirty]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(getSnapshot());
    const next = redoStackRef.current.pop();
    setScenes(next.scenes);
    setCurrentSceneIndex(next.currentSceneIndex);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    markDirty();
  }, [getSnapshot, markDirty]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    loadEpisodeData();
  }, [episodeId]);


  const loadEpisodeData = async () => {
    setLoading(true);
    try {
      // Load episode, platform, and scenes from real API
      const [episodeRes, platformRes, scenesRes] = await Promise.all([
        episodeAPI.getById(episodeId),
        platformAPI.get(episodeId),
        sceneAPI.getAll(episodeId),
      ]);

      const ep = episodeRes.data.episode || episodeRes.data;
      setEpisode(ep);

      const plat = platformRes.data;
      setPlatform(plat.platform || 'youtube');

      const loadedScenes = scenesRes.data;
      if (loadedScenes && loadedScenes.length > 0) {
        setScenes(loadedScenes.map((s, i) => ({
          id: s.id,
          scene_number: s.sceneNumber || s.scene_number || i + 1,
          title: s.title || `Scene ${i + 1}`,
          duration_seconds: parseFloat(s.durationSeconds || s.duration_seconds) || 5.0,
          background_url: s.background_url || s.backgroundUrl || null,
          characters: s.characters || [],
          ui_elements: s.uiElements || s.ui_elements || [],
          dialogue_clips: s.dialogueClips || s.dialogue_clips || [],
        })));
      } else {
        // Default starter scene if none exist
        setScenes([{
          id: 'scene-new-1',
          scene_number: 1,
          title: 'Scene 1',
          duration_seconds: 5,
          background_url: null,
          characters: [],
          ui_elements: [],
          dialogue_clips: [],
        }]);
      }
    } catch (error) {
      console.warn('API unavailable, using defaults:', error.message);
      setEpisode({ id: episodeId, title: 'Untitled Episode', episode_number: 1 });
      setPlatform('youtube');
      setScenes([{
        id: 'scene-new-1',
        scene_number: 1,
        title: 'Scene 1',
        duration_seconds: 5,
        background_url: null,
        characters: [],
        ui_elements: [],
        dialogue_clips: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformChange = async (newPlatform) => {
    setPlatform(newPlatform);
    
    // Save platform choice to episode
    try {
      console.log('✅ Platform saved:', newPlatform);
      markDirty();
    } catch (error) {
      console.error('Failed to save platform:', error);
    }
  };

  const handleSetBackground = () => {
    setUploadModal('background');
  };

  const handleUploadComplete = (url, assetData) => {
    const type = uploadModal;
    setUploadModal(null);
    pushHistory();

    if (type === 'background') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        scene.background_url = url;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ Background set:', url);
    } else if (type === 'character') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        const chars = [...(scene.characters || [])];
        chars.push({
          id: `char-${Date.now()}`,
          name: assetData?.originalName || 'Character',
          imageUrl: url,
          position: { x: `${30 + Math.random() * 40}%`, y: '60%' }
        });
        scene.characters = chars;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ Character added with image:', url);
    } else if (type === 'ui_element') {
      setScenes(prev => {
        const next = [...prev];
        const scene = { ...next[currentSceneIndex] };
        const uiElements = [...(scene.ui_elements || [])];
        uiElements.push({
          id: `ui-${Date.now()}`,
          label: assetData?.originalName || 'UI Element',
          imageUrl: url,
          position: { x: '50%', y: `${10 + Math.random() * 80}%` },
          backgroundColor: 'rgba(102, 126, 234, 0.2)',
          padding: '12px 24px',
          borderRadius: '8px',
          width: '300px',
          height: 'auto'
        });
        scene.ui_elements = uiElements;
        next[currentSceneIndex] = scene;
        return next;
      });
      console.log('✅ UI Element added with image:', url);
    }
    markDirty();
  };

  const handleAddCharacterWithUndo = () => {
    setUploadModal('character');
  };

  const handleAddUIElement = () => {
    setUploadModal('ui_element');
  };

  // Update element position on canvas (drag-to-move)
  const handleUpdatePosition = (type, id, newPosition) => {
    setScenes(prev => {
      const next = [...prev];
      const scene = { ...next[currentSceneIndex] };
      if (type === 'character') {
        scene.characters = scene.characters.map((c, i) => {
          const cid = c.id || `char-${i}`;
          return cid === id ? { ...c, position: newPosition } : c;
        });
      } else if (type === 'ui') {
        scene.ui_elements = scene.ui_elements.map((u, i) => {
          const uid = u.id || `ui-${i}`;
          return uid === id ? { ...u, position: newPosition } : u;
        });
      }
      next[currentSceneIndex] = scene;
      return next;
    });
    markDirty();
  };

  // Resize element on canvas
  const handleResizeElement = (type, id, newSize) => {
    setScenes(prev => {
      const next = [...prev];
      const scene = { ...next[currentSceneIndex] };
      if (type === 'character') {
        scene.characters = scene.characters.map((c, i) => {
          const cid = c.id || `char-${i}`;
          return cid === id ? { ...c, ...newSize } : c;
        });
      } else if (type === 'ui') {
        scene.ui_elements = scene.ui_elements.map((u, i) => {
          const uid = u.id || `ui-${i}`;
          return uid === id ? { ...u, ...newSize } : u;
        });
      }
      next[currentSceneIndex] = scene;
      return next;
    });
    markDirty();
  };


  // Scene drag-and-drop handlers
  const handleSceneDragStart = (e, index) => {
    setDraggedSceneIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    e.currentTarget.style.opacity = '0.4';
  };

  const handleSceneDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedSceneIndex(null);
    setDragOverSceneIndex(null);
  };

  const handleSceneDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSceneIndex !== index) {
      setDragOverSceneIndex(index);
    }
  };

  const handleSceneDragLeave = () => {
    setDragOverSceneIndex(null);
  };

  const handleSceneDrop = (e, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    const fromIndex = draggedSceneIndex;
    setDraggedSceneIndex(null);
    setDragOverSceneIndex(null);

    if (fromIndex === null || fromIndex === toIndex) return;

    setScenes(prev => {
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      // Re-number scenes and update auto-generated titles
      return reordered.map((s, i) => ({
        ...s,
        scene_number: i + 1,
        title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
      }));
    });

    // Update currentSceneIndex to follow the moved scene
    if (currentSceneIndex === fromIndex) {
      setCurrentSceneIndex(toIndex);
    } else if (fromIndex < currentSceneIndex && toIndex >= currentSceneIndex) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    } else if (fromIndex > currentSceneIndex && toIndex <= currentSceneIndex) {
      setCurrentSceneIndex(currentSceneIndex + 1);
    }

    console.log('✅ Scenes reordered:', fromIndex, '→', toIndex);
    markDirty();
  };

  const handleDeleteScene = (index, e) => {
    e.stopPropagation();
    if (scenes.length <= 1) {
      alert('Cannot delete the last scene');
      return;
    }
    if (!confirm(`Delete "${scenes[index].title}"?`)) return;
    pushHistory();
    
    setScenes(prev => {
      const updated = prev.filter((_, i) => i !== index)
        .map((s, i) => ({
          ...s,
          scene_number: i + 1,
          title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
        }));
      return updated;
    });
    if (currentSceneIndex >= scenes.length - 1) {
      setCurrentSceneIndex(Math.max(0, scenes.length - 2));
    } else if (index < currentSceneIndex) {
      setCurrentSceneIndex(currentSceneIndex - 1);
    }
    console.log('✅ Scene deleted');
    markDirty();
  };

  const totalDuration = scenes.reduce((sum, scene) => 
    sum + (parseFloat(scene.duration_seconds) || 0), 0
  );

  const currentScene = scenes[currentSceneIndex] || null;

  if (loading) {
    return (
      <div className="scene-composer-full">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading episode...</p>
        </div>
      </div>
    );
  }

  return (
    <LandscapeRequired>
    <div className="scene-composer-full">
      {/* Header with Platform Selector and Export Dropdown */}
      <header className="composer-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(`/episodes/${episodeId}`)}>
            ← Back
          </button>
          <div className="episode-info">
            <h1>Scene Composer</h1>
            <span className="episode-meta">
              Episode {episode?.episode_number} · Scene {currentSceneIndex + 1}/{scenes.length}
            </span>
          </div>
        </div>

        {/* Platform Selector Dropdown */}
        <div className="header-center">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Undo / Redo */}
            <div className="undo-redo-group">
              <button
                className="undo-redo-btn"
                onClick={handleUndo}
                disabled={undoCount === 0}
                title="Undo (Ctrl+Z)"
              >↩</button>
              <button
                className="undo-redo-btn"
                onClick={handleRedo}
                disabled={redoCount === 0}
                title="Redo (Ctrl+Shift+Z)"
              >↪</button>
            </div>

            {/* Platform Selector Dropdown */}
            <div className="platform-dropdown-wrapper">
              <button 
                className="platform-dropdown-btn"
                onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                title={currentPlatform.name}
              >
                <span className="platform-icon">{currentPlatform.icon}</span>
                <span className="platform-dropdown-label">Format</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showPlatformMenu && (
                <div className="platform-menu">
                  {Object.entries(platforms).map(([key, p]) => (
                    <button
                      key={key}
                      className={`platform-menu-item ${platform === key ? 'active' : ''}`}
                      onClick={() => {
                        handlePlatformChange(key);
                        setShowPlatformMenu(false);
                      }}
                    >
                      <span className="menu-icon">{p.icon}</span>
                      <span className="menu-text">
                        <span className="menu-name">{p.name}</span>
                        <span className="menu-ratio">{p.ratio}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Export Dropdown */}
        <div className="header-right">
          <SaveIndicator
            saveStatus={saveStatus}
            lastSaved={lastSaved}
            errorMessage={errorMessage}
            onSave={save}
          />
          <ExportDropdown episodeId={episodeId} />
        </div>
      </header>

      {/* BUILD MODE */}
      <div className="build-mode">
        {/* Scene Flow (Left) */}
        <aside className="scene-flow-panel">
          <div className="panel-header">
            <h3>Scene Flow</h3>
            <button className="add-scene-btn" onClick={() => {
              pushHistory();
              const nextNum = scenes.length + 1;
              const newScene = {
                id: `scene-${Date.now()}`,
                scene_number: nextNum,
                title: `Scene ${nextNum}`,
                duration_seconds: 5,
                background_url: null,
                characters: [],
                ui_elements: [],
                dialogue_clips: []
              };
              setScenes([...scenes, newScene]);
              setCurrentSceneIndex(scenes.length);
              markDirty();
            }}>
              + Add Scene
            </button>
          </div>
          <div className="scene-list">
            {scenes.map((scene, index) => (
              <div 
                key={scene.id}
                className={`scene-card ${index === currentSceneIndex ? 'active' : ''} ${dragOverSceneIndex === index ? 'drag-over' : ''} ${draggedSceneIndex === index ? 'dragging' : ''}`}
                onClick={() => setCurrentSceneIndex(index)}
                draggable
                onDragStart={(e) => handleSceneDragStart(e, index)}
                onDragEnd={handleSceneDragEnd}
                onDragOver={(e) => handleSceneDragOver(e, index)}
                onDragLeave={handleSceneDragLeave}
                onDrop={(e) => handleSceneDrop(e, index)}
              >
                <div className="scene-drag-grip" title="Drag to reorder">⠿</div>
                <div className="scene-number">{scene.scene_number}</div>
                <div className="scene-details">
                  <div className="scene-title">{scene.title}</div>
                  <div className="scene-meta">{scene.duration_seconds}s</div>
                </div>
                {scenes.length > 1 && (
                  <button
                    className="scene-delete-btn"
                    onClick={(e) => handleDeleteScene(index, e)}
                    title="Delete scene"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas (Center) - Uses reusable Stage component */}
        <main className="scene-canvas">
          {currentScene ? (
            <Stage
              platform={currentPlatform}
              scene={currentScene}
              currentTime={currentTime}
              interactionMode="edit"
              selected={selected}
              onSelect={setSelected}
              onUpdatePosition={handleUpdatePosition}
              onResizeElement={handleResizeElement}
              showPlatformBadge={true}
              showSafeZones={showSafeZones}
            />
          ) : (
            <div className="stage-no-scene">
              <p>No scenes yet</p>
              <button onClick={() => {/* add scene */}}>Create First Scene</button>
            </div>
          )}
        </main>

        {/* Controls (Right) - Reusable control panel */}
        <SceneControlsPanel
          currentScene={currentScene}
          scenes={scenes}
          currentSceneIndex={currentSceneIndex}
          onSetBackground={handleSetBackground}
          onAddCharacter={handleAddCharacterWithUndo}
          onAddUIElement={handleAddUIElement}
          onAssignWardrobe={() => {
            if (!currentScene?.characters || currentScene.characters.length === 0) {
              alert('Please add a character first');
              return;
            }
            setShowWardrobePicker(true);
          }}
          onDurationChange={(e) => {
            setScenes(prev => {
              const next = [...prev];
              const scene = { ...next[currentSceneIndex] };
              scene.duration_seconds = parseInt(e.target.value) || 5;
              next[currentSceneIndex] = scene;
              return next;
            });
            markDirty();
          }}
          selected={selected}
          showSafeZones={showSafeZones}
          onToggleSafeZones={() => setShowSafeZones(!showSafeZones)}
        />
      </div>

      {/* Wardrobe Picker Modal */}
      {showWardrobePicker && (
        <SceneWardrobePicker
          episodeId={episodeId}
          showId={episode?.show_id || episode?.showId}
          characters={currentScene?.characters || []}
          onAssign={(characterId, outfitId) => {
            setScenes(prev => {
              const next = [...prev];
              const scene = { ...next[currentSceneIndex] };
              scene.characters = (scene.characters || []).map(c =>
                c.id === characterId ? { ...c, outfitId } : c
              );
              next[currentSceneIndex] = scene;
              return next;
            });
            markDirty();
            setShowWardrobePicker(false);
          }}
          onClose={() => setShowWardrobePicker(false)}
        />
      )}

      {/* Asset Upload Modal */}
      {uploadModal && (
        <AssetUploadModal
          assetType={uploadModal}
          onUploadComplete={handleUploadComplete}
          onClose={() => setUploadModal(null)}
        />
      )}

    </div>
    </LandscapeRequired>
  );
}

export default SceneComposerFull;
