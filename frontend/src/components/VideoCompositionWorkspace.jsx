import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';

// Clean minimal CSS for Scene Composer
import './SceneComposer/SceneComposer.css';
import './VideoCompositionWorkspace/timeline.css';

// Components
import SourcePanel from './SceneComposer/components/SourcePanel';

// Constants and utilities
import {
  VIDEO_FORMATS,
  SCENE_ROLES,
  ASSET_ROLES,
  WARDROBE_ROLES,
  SNAP_THRESHOLD,
  GRID_SIZE,
  DEFAULT_ELEMENT_TRANSFORM
} from './VideoCompositionWorkspace/constants';
import { getCanvasDimensions } from './VideoCompositionWorkspace/utils/elementHelpers';

/**
 * ⚠️ DEPRECATED - This file is being phased out
 * 
 * Use the new standalone Scene Composer v1 instead:
 * Location: /components/SceneComposer/SceneComposer.jsx
 * Routes: /episodes/:episodeId/scene-templates/new
 *         /episodes/:episodeId/scene-templates/:templateId/edit
 * 
 * This legacy version remains for backward compatibility with the Episode Detail tab.
 * It will be removed once the migration is complete.
 */

/**
 * SceneComposer Component (LEGACY - Tab Version)
 * Unified scene template interface that pulls from Scenes, Assets, and Scripts
 * to create curated scene templates with multi-element editing
 */
export default function SceneComposer({ 
  episodeId, 
  episode, 
  episodeScenes: propsScenes = [], 
  episodeAssets = [],
  episodeWardrobes = []
}) {
  const navigate = useNavigate();
  
  // Fetch episodeScenes internally if not provided
  const [episodeScenes, setEpisodeScenes] = useState(propsScenes);
  
  useEffect(() => {
    if (propsScenes.length === 0 && episodeId) {
      (async () => {
        try {
          const res = await fetch(`/api/v1/episodes/${episodeId}/scenes`);
          const json = await res.json();
          if (json?.success) setEpisodeScenes(json.data || []);
        } catch (err) {
          console.error('Failed to load scenes:', err);
        }
      })();
    } else {
      setEpisodeScenes(propsScenes);
    }
  }, [episodeId, propsScenes]);
  
  // View mode: 'gallery' shows all templates, 'editor' shows active template workspace
  const [viewMode, setViewMode] = useState('gallery');
  
  // Template state
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCompositionName, setNewCompositionName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Video Editor - Playback State
  const [playbackState, setPlaybackState] = useState({
    currentTime: 0,        // Current playhead position in seconds
    duration: 60,          // Total composition duration in seconds
    isPlaying: false,      // Whether video is playing
    playbackRate: 1.0,     // Playback speed
    isLooping: false       // Whether to loop
  });
  
  const currentTime = playbackState.currentTime;
  const setCurrentTime = (time) => setPlaybackState(prev => ({ ...prev, currentTime: time }));
  const setIsPlaying = (playing) => setPlaybackState(prev => ({ ...prev, isPlaying: playing }));
  const setDuration = (duration) => setPlaybackState(prev => ({ ...prev, duration }));
  
  // Asset processing state
  const [processingAsset, setProcessingAsset] = useState(null); // { assetId, type: 'bg_removal' | 'enhancement' }
  const [processingStatus, setProcessingStatus] = useState({}); // { [assetId]: { bg_removed, enhanced } }
  
  // Panels always visible in fixed layout (no collapse)
  
  // Consolidated selection state
  const [selectionState, setSelectionState] = useState({
    scenes: [], // { scene, role: 'primary' | 'b-roll' | 'transition' | 'overlay' }
    assets: [], // { asset, role: 'primary' | 'overlay' | 'background' | 'effect' }
    wardrobes: [], // { wardrobe, role: 'costume' }
    script: null
  });
  
  // Backward-compatible setters for existing code
  const selectedScenes = selectionState.scenes;
  const selectedAssets = selectionState.assets;
  const selectedWardrobes = selectionState.wardrobes;
  const selectedScript = selectionState.script;
  
  const setSelectedScenes = (value) => {
    setSelectionState(prev => ({
      ...prev,
      scenes: typeof value === 'function' ? value(prev.scenes) : value
    }));
  };
  
  const setSelectedAssets = (value) => {
    setSelectionState(prev => ({
      ...prev,
      assets: typeof value === 'function' ? value(prev.assets) : value
    }));
  };
  
  const setSelectedWardrobes = (value) => {
    setSelectionState(prev => ({
      ...prev,
      wardrobes: typeof value === 'function' ? value(prev.wardrobes) : value
    }));
  };
  
  const setSelectedScript = (value) => {
    setSelectionState(prev => ({
      ...prev,
      script: typeof value === 'function' ? value(prev.script) : value
    }));
  };
  
  // Active tab in source panel
  const [sourceTab, setSourceTab] = useState('scenes');
  
  // Collapsible panel state
  const [panelCollapsed, setPanelCollapsed] = useState({
    scenes: false,
    assets: false,
    wardrobe: false,
    position: false,
    scale: false,
    rotation: false,
    effects: false,
    layering: false
  });
  
  // Consolidated dialog state
  const [dialogState, setDialogState] = useState({
    showCreateDialog: false,
    pendingScene: null,
    pendingAsset: null,
    pendingWardrobe: null
  });
  
  // Backward-compatible getters/setters
  const showCreateDialog = dialogState.showCreateDialog;
  const pendingScene = dialogState.pendingScene;
  const pendingAsset = dialogState.pendingAsset;
  const pendingWardrobe = dialogState.pendingWardrobe;
  
  const setShowCreateDialog = (value) => {
    setDialogState(prev => ({
      ...prev,
      showCreateDialog: typeof value === 'function' ? value(prev.showCreateDialog) : value
    }));
  };
  
  const setPendingScene = (value) => {
    setDialogState(prev => ({
      ...prev,
      pendingScene: typeof value === 'function' ? value(prev.pendingScene) : value
    }));
  };
  
  const setPendingAsset = (value) => {
    setDialogState(prev => ({
      ...prev,
      pendingAsset: typeof value === 'function' ? value(prev.pendingAsset) : value
    }));
  };
  
  const setPendingWardrobe = (value) => {
    setDialogState(prev => ({
      ...prev,
      pendingWardrobe: typeof value === 'function' ? value(prev.pendingWardrobe) : value
    }));
  };
  
  // Canvas scene element management
  // Multi-select support
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const selectedElementId = selectedElementIds[0] || null; // Backward compatibility - primary selection
  const setSelectedElementId = (id) => {
    if (id === null) {
      setSelectedElementIds([]);
    } else {
      setSelectedElementIds([id]);
    }
  };
  
  // Element transforms now include temporal data
  // { [elementId]: { x, y, width, height, rotation, opacity, zIndex, visible, locked, startTime, endTime, track } }
  const [elementTransforms, setElementTransforms] = useState({});
  
  // Drag/resize state - consolidated
  const [interactionState, setInteractionState] = useState({
    isDragging: false,
    isResizing: false,
    dragStart: { x: 0, y: 0 },
    initialPosition: { x: 0, y: 0, width: 0, height: 0 },
    resizeHandle: null,
    dragInfo: null
  });
  
  // Helper setters for backward compatibility
  const isDragging = interactionState.isDragging;
  const isResizing = interactionState.isResizing;
  const dragInfo = interactionState.dragInfo;
  const resizeHandle = interactionState.resizeHandle;
  const dragStart = interactionState.dragStart;
  const initialPosition = interactionState.initialPosition;
  
  const setIsDragging = useCallback((val) => setInteractionState(prev => ({ ...prev, isDragging: val })), []);
  const setIsResizing = useCallback((val) => setInteractionState(prev => ({ ...prev, isResizing: val })), []);
  const setDragInfo = useCallback((val) => setInteractionState(prev => ({ ...prev, dragInfo: val })), []);
  const setResizeHandle = useCallback((val) => setInteractionState(prev => ({ ...prev, resizeHandle: val })), []);
  const setDragStart = useCallback((val) => setInteractionState(prev => ({ ...prev, dragStart: val })), []);
  const setInitialPosition = useCallback((val) => setInteractionState(prev => ({ ...prev, initialPosition: val })), []);
  
  // Snap guides
  const [snapGuides, setSnapGuides] = useState({ vertical: [], horizontal: [] });
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  // Canvas controls - consolidated
  const [canvasControls, setCanvasControls] = useState({
    zoom: 1,
    showGrid: true,
    showRulers: true
  });
  
  // Helper setters for backward compatibility
  const setCanvasZoom = useCallback((zoom) => setCanvasControls(prev => ({ ...prev, zoom })), []);
  const setShowGrid = useCallback((showGrid) => setCanvasControls(prev => ({ ...prev, showGrid })), []);
  const setShowRulers = useCallback((showRulers) => setCanvasControls(prev => ({ ...prev, showRulers })), []);
  const canvasZoom = canvasControls.zoom;
  const showGrid = canvasControls.showGrid;
  const showRulers = canvasControls.showRulers;
  
  // Timeline ref for width calculation
  const timelineRef = useRef(null);
  
  // Timeline zoom levels (seconds visible on screen)
  const [timelineZoomLevel, setTimelineZoomLevel] = useState('fit'); // 'fit' | 10 | 30 | 60
  
  // Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Undo/Redo functions (defined before keyboard shortcuts that use them)
  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      transforms: { ...elementTransforms },
      scenes: [...selectedScenes],
      assets: [...selectedAssets],
      wardrobes: [...selectedWardrobes]
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setElementTransforms(prevState.transforms);
      setSelectedScenes(prevState.scenes);
      setSelectedAssets(prevState.assets);
      setSelectedWardrobes(prevState.wardrobes);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setElementTransforms(nextState.transforms);
      setSelectedScenes(nextState.scenes);
      setSelectedAssets(nextState.assets);
      setSelectedWardrobes(nextState.wardrobes);
      setHistoryIndex(historyIndex + 1);
    }
  };
  
  // Layer panel
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  
  // Video format / platform selection
  const [selectedFormat, setSelectedFormat] = useState('youtube');
  
  // ✅ CRITICAL: Get accurate canvas dimensions matching the actual stage
  // This MUST match the calculation used in canvas rendering (lines ~1900)
  const getActualCanvasDimensions = useCallback(() => {
    const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
    const formatWidth = format?.width || 1920;
    const formatHeight = format?.height || 1080;
    const aspectRatio = formatWidth / formatHeight;
    const baseWidth = formatWidth > 1920 ? formatWidth / 2 : (formatWidth <= 1280 ? formatWidth * 0.8 : formatWidth * 0.7);
    const canvasWidth = baseWidth;
    const canvasHeight = baseWidth / aspectRatio;
    return { canvasWidth, canvasHeight, formatWidth, formatHeight, aspectRatio };
  }, [selectedFormat]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      
      // Delete selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault();
        // Remove from transforms
        const newTransforms = { ...elementTransforms };
        delete newTransforms[selectedElementId];
        setElementTransforms(newTransforms);
        
        // Remove from selection arrays
        setSelectedScenes(prev => prev.filter(s => s.scene?.scene_id !== selectedElementId));
        setSelectedAssets(prev => prev.filter(a => a.asset?.asset_id !== selectedElementId));
        setSelectedWardrobes(prev => prev.filter(w => w.wardrobe?.wardrobe_id !== selectedElementId));
        
        setSelectedElementId(null);
        saveToHistory();
        return;
      }
      
      switch(e.key) {
        case ' ': // Space - Play/Pause
          e.preventDefault();
          setIsPlaying(!playbackState.isPlaying);
          break;
        case 'Home': // Home - Go to start
          e.preventDefault();
          setCurrentTime(0);
          break;
        case 'End': // End - Go to end
          e.preventDefault();
          setCurrentTime(playbackState.duration);
          break;
        case 'ArrowLeft': // Left arrow - Back 1s (5s with Shift)
          e.preventDefault();
          setCurrentTime(Math.max(0, currentTime - (e.shiftKey ? 5 : 1)));
          break;
        case 'ArrowRight': // Right arrow - Forward 1s (5s with Shift)
          e.preventDefault();
          setCurrentTime(Math.min(playbackState.duration, currentTime + (e.shiftKey ? 5 : 1)));
          break;
        case 'g': // G - Toggle grid
        case 'G':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setShowGrid(!showGrid);
          }
          break;
        case 'r': // R - Toggle rulers
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setShowRulers(!showRulers);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState.isPlaying, currentTime, playbackState.duration, showGrid, showRulers, selectedElementId, elementTransforms, handleUndo, handleRedo]);

  // Playback loop
  useEffect(() => {
    if (!playbackState.isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prevTime => {
        const newTime = prevTime + (1/60) * playbackState.playbackRate; // 60fps
        
        if (newTime >= playbackState.duration) {
          if (playbackState.isLooping) {
            return 0; // Loop back to start
          } else {
            setIsPlaying(false); // Stop at end
            return playbackState.duration;
          }
        }
        
        return newTime;
      });
    }, 1000/60); // 60fps
    
    return () => clearInterval(interval);
  }, [playbackState.isPlaying, playbackState.duration, playbackState.playbackRate, playbackState.isLooping]);

  useEffect(() => {
    loadTemplates();
  }, [episodeId]);

  // Auto-save when selections change (debounced)
  useEffect(() => {
    if (!activeTemplate) return;
    
    const timeout = setTimeout(() => {
      handleSaveTemplate();
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [selectedScenes, selectedAssets, selectedWardrobes]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/episodes/${episodeId}/video-compositions?type=scene_template`);
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.data || []);
        console.log('✅ Loaded templates:', data.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    
    try {
      setSaving(true);
      
      const response = await fetch(`/api/v1/episodes/${episodeId}/video-compositions/${activeTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeTemplate.name,
          type: 'scene_template',
          scenes: selectedScenes.map((s, i) => ({
            scene_id: s.scene.id,
            role: s.role,
            order: i
          })),
          assets: selectedAssets.map((a, i) => ({
            asset_id: a.asset.id,
            role: a.role,
            order: i
          })),
          wardrobes: selectedWardrobes.map((w, i) => ({
            wardrobe_id: w.wardrobe.id,
            role: w.role,
            order: i
          })),
          layer_transforms: elementTransforms,
          settings: {
            ...activeTemplate.settings,
            format: selectedFormat,
            platform: VIDEO_FORMATS.find(f => f.id === selectedFormat)?.name
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Saved template:', data.data);
        // Update in local state
        setTemplates(prev => 
          prev.map(c => c.id === activeTemplate.id ? data.data : c)
        );
        setActiveTemplate(data.data);
      }
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = () => {
    console.log('🎬 handleCreateTemplate called');
    // Generate default name
    const defaultName = `Template ${templates.length + 1}`;
    setNewCompositionName(defaultName);
    setShowCreateDialog(true);
    console.log('🎬 Dialog should open now, showCreateDialog:', true);
  };

  const handleCancelCreate = () => {
    setShowCreateDialog(false);
    setNewCompositionName('');
  };

  const handleConfirmCreate = async () => {
    console.log('🎬 handleConfirmCreate called, name:', newCompositionName);
    
    if (!newCompositionName.trim()) {
      alert('Please enter a template name');
      return;
    }

    try {
      setCreating(true);
      
      const response = await fetch(`/api/v1/episodes/${episodeId}/video-compositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newCompositionName,
          type: 'scene_template',
          scenes: [],
          assets: [],
          wardrobes: [],
          layer_transforms: {},
          settings: {}
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create template');
      }
      
      const newTemplate = data.data;
      console.log('✅ Created template:', newTemplate);
      
      setTemplates(prev => {
        const updated = [...prev, newTemplate];
        console.log('🎬 Updated templates:', updated);
        return updated;
      });
      
      setActiveTemplate(newTemplate);
      console.log('🎬 Set active template:', newTemplate);
      
      setShowCreateDialog(false);
      setNewCompositionName('');
      
      // Reset selections for new template
      setSelectedScenes([]);
      setSelectedAssets([]);
      
      // Switch to editor mode
      setViewMode('editor');
      
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSceneToggle = useCallback((scene) => {
    const isSelected = selectedScenes.find(s => s.scene.id === scene.id);
    if (isSelected) {
      setSelectedScenes(prev => prev.filter(s => s.scene.id !== scene.id));
    } else {
      // Open role dialog
      setPendingScene(scene);
    }
  }, [selectedScenes]);

  const handleAssetToggle = useCallback((asset) => {
    console.log('🔍 Asset clicked:', asset);
    const isSelected = selectedAssets.find(a => a.asset.id === asset.id);
    if (isSelected) {
      setSelectedAssets(prev => prev.filter(a => a.asset.id !== asset.id));
    } else {
      // Auto-assign role for BACKGROUND_IMAGE assets
      const isBackgroundImage = asset.asset_type === 'BACKGROUND_IMAGE';
      
      console.log('🖼️ Is background image?', isBackgroundImage);
      
      if (isBackgroundImage) {
        const elementId = `asset-${asset.id}`;
        setSelectedAssets(prev => [...prev, { asset, role: 'background' }]);
        
        // Initialize transform - calculate last end time from elementTransforms
        setElementTransforms(prev => {
          const lastEndTime = Object.values(prev).reduce((max, transform) => {
            return Math.max(max, transform?.endTime || 0);
          }, 0);
          
          const trackCount = Object.keys(prev).length;
          
          return {
            ...prev,
            [elementId]: {
              ...DEFAULT_ELEMENT_TRANSFORM,
              startTime: lastEndTime,
              endTime: lastEndTime + 5,
              track: trackCount,
              visible: true,
              zIndex: 0 // Background gets z-index 0
            }
          };
        });
      } else {
        // Open role dialog for other assets
        setPendingAsset(asset);
      }
    }
  }, [selectedAssets]);

  const handleWardrobeToggle = useCallback((wardrobe) => {
    const isSelected = selectedWardrobes.some(w => w.wardrobe.id === wardrobe.id);
    if (isSelected) {
      setSelectedWardrobes(prev => prev.filter(w => w.wardrobe.id !== wardrobe.id));
    } else {
      setPendingWardrobe(wardrobe);
    }
  }, [selectedWardrobes]);

  const handleRoleSelect = (type, roleId) => {
    let elementId = null;
    let defaultDuration = 5; // Default 5 seconds
    
    if (type === 'scene' && pendingScene) {
      elementId = `scene-${pendingScene.id}`;
      defaultDuration = pendingScene.duration_seconds || 5;
      setSelectedScenes(prev => [...prev, { scene: pendingScene, role: roleId }]);
      setPendingScene(null);
    } else if (type === 'asset' && pendingAsset) {
      elementId = `asset-${pendingAsset.id}`;
      defaultDuration = 5; // Assets default to 5s
      setSelectedAssets(prev => [...prev, { asset: pendingAsset, role: roleId }]);
      setPendingAsset(null);
    } else if (type === 'wardrobe' && pendingWardrobe) {
      elementId = `wardrobe-${pendingWardrobe.id}`;
      defaultDuration = 5;
      setSelectedWardrobes(prev => [...prev, { wardrobe: pendingWardrobe, role: roleId }]);
      setPendingWardrobe(null);
    }
    
    // Initialize temporal data for new element
    if (elementId) {
      const existingElements = getAllElements;
      const lastEndTime = existingElements.reduce((max, el) => {
        const transform = elementTransforms[el.id];
        return Math.max(max, transform?.endTime || 0);
      }, 0);
      
      // Assign z-index based on role
      const roleZIndex = {
        background: 0,
        primary: 1,
        'b-roll': 2,
        overlay: 10,
        effect: 15,
        costume: 5,
        transition: 3
      };
      
      setElementTransforms(prev => ({
        ...prev,
        [elementId]: {
          ...DEFAULT_ELEMENT_TRANSFORM,
          startTime: lastEndTime, // Start after last element
          endTime: lastEndTime + defaultDuration,
          track: existingElements.length, // Each element gets its own track
          visible: true,
          zIndex: roleZIndex[roleId] || 1
        }
      }));
      
      // Update composition duration if needed
      const newEndTime = lastEndTime + defaultDuration;
      if (newEndTime > playbackState.duration) {
        setDuration(newEndTime + 5); // Add 5s padding
      }
    }
  };

  const handleChangeRole = (item, type, newRole) => {
    if (type === 'scene') {
      setSelectedScenes(prev => 
        prev.map(s => s.scene.id === item.scene.id ? { ...s, role: newRole } : s)
      );
    } else if (type === 'asset') {
      setSelectedAssets(prev => 
        prev.map(a => a.asset.id === item.asset.id ? { ...a, role: newRole } : a)
      );
    } else if (type === 'wardrobe') {
      setSelectedWardrobes(prev => 
        prev.map(w => w.wardrobe.id === item.wardrobe.id ? { ...w, role: newRole } : w)
      );
    }
  };

  // Canvas interaction handlers
  const handleElementMouseDown = (e, elementId, isBackground) => {
    if (isBackground) return; // Don't allow dragging background elements
    e.stopPropagation();
    
    // Get the actual rendered position
    const elements = getAllElements();
    const elementIndex = elements.findIndex(el => el.id === elementId);
    const transform = elementTransforms[elementId];
    
    let actualX, actualY, actualWidth, actualHeight;
    
    if (transform) {
      // Layer has custom transforms
      actualX = transform.x || 0;
      actualY = transform.y || 0;
      actualWidth = transform.width || 200;
      actualHeight = transform.height || 150;
    } else {
      // Layer is using default positioning
      actualX = 50 + (elementIndex * 20);
      actualY = 50 + (elementIndex * 20);
      actualWidth = 200;
      actualHeight = 150;
    }
    
    setInitialPosition({ 
      x: actualX, 
      y: actualY, 
      width: actualWidth, 
      height: actualHeight 
    });
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeStart = (e, elementId, handle) => {
    e.stopPropagation();
    
    // Get the actual rendered position
    const elements = getAllElements;
    const elementIndex = elements.findIndex(el => el.id === elementId);
    const transform = elementTransforms[elementId];
    
    let actualX, actualY, actualWidth, actualHeight;
    
    if (transform) {
      // Element has custom transforms
      actualX = transform.x || 0;
      actualY = transform.y || 0;
      actualWidth = transform.width || 200;
      actualHeight = transform.height || 150;
    } else {
      // Element is using default positioning
      actualX = 50 + (elementIndex * 20);
      actualY = 50 + (elementIndex * 20);
      actualWidth = 200;
      actualHeight = 150;
    }
    
    setInitialPosition({ 
      x: actualX, 
      y: actualY, 
      width: actualWidth, 
      height: actualHeight 
    });
    
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Calculate snap positions and guide lines
  const calculateSnap = (x, y, width, height, canvasWidth = 800, canvasHeight = 600) => {
    if (!snapEnabled) return { x, y, guides: { vertical: [], horizontal: [] } };
    
    // Constrain to canvas boundaries
    x = Math.max(0, Math.min(x, canvasWidth - width));
    y = Math.max(0, Math.min(y, canvasHeight - height));
    
    let snappedX = x;
    let snappedY = y;
    const guides = { vertical: [], horizontal: [] };
    
    // Get all other elements for smart guides
    const otherElements = getAllElements
      .filter(el => el.id !== selectedElementId && elementTransforms[el.id]?.visible !== false)
      .map(el => {
        const t = elementTransforms[el.id] || {};
        return {
          x: t.x || 0,
          y: t.y || 0,
          width: t.width || 200,
          height: t.height || 150,
          centerX: (t.x || 0) + (t.width || 200) / 2,
          centerY: (t.y || 0) + (t.height || 150) / 2,
          right: (t.x || 0) + (t.width || 200),
          bottom: (t.y || 0) + (t.height || 150)
        };
      });
    
    const currentCenterX = x + width / 2;
    const currentCenterY = y + height / 2;
    const currentRight = x + width;
    const currentBottom = y + height;
    
    // Canvas center and edge snaps
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    
    // Check snap to canvas center
    if (Math.abs(currentCenterX - canvasCenterX) < SNAP_THRESHOLD) {
      snappedX = canvasCenterX - width / 2;
      guides.vertical.push(canvasCenterX);
    }
    if (Math.abs(currentCenterY - canvasCenterY) < SNAP_THRESHOLD) {
      snappedY = canvasCenterY - height / 2;
      guides.horizontal.push(canvasCenterY);
    }
    
    // Check snap to canvas edges
    if (Math.abs(x) < SNAP_THRESHOLD) {
      snappedX = 0;
      guides.vertical.push(0);
    }
    if (Math.abs(y) < SNAP_THRESHOLD) {
      snappedY = 0;
      guides.horizontal.push(0);
    }
    if (Math.abs(currentRight - canvasWidth) < SNAP_THRESHOLD) {
      snappedX = canvasWidth - width;
      guides.vertical.push(canvasWidth);
    }
    if (Math.abs(currentBottom - canvasHeight) < SNAP_THRESHOLD) {
      snappedY = canvasHeight - height;
      guides.horizontal.push(canvasHeight);
    }
    
    // Check snap to grid
    const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;
    if (Math.abs(x - gridX) < SNAP_THRESHOLD) snappedX = gridX;
    if (Math.abs(y - gridY) < SNAP_THRESHOLD) snappedY = gridY;
    
    // Check snap to other elements
    otherElements.forEach(element => {
      // Vertical alignment
      if (Math.abs(x - element.x) < SNAP_THRESHOLD) {
        snappedX = element.x;
        guides.vertical.push(element.x);
      }
      if (Math.abs(currentCenterX - element.centerX) < SNAP_THRESHOLD) {
        snappedX = element.centerX - width / 2;
        guides.vertical.push(element.centerX);
      }
      if (Math.abs(currentRight - element.right) < SNAP_THRESHOLD) {
        snappedX = element.right - width;
        guides.vertical.push(element.right);
      }
      
      // Horizontal alignment
      if (Math.abs(y - element.y) < SNAP_THRESHOLD) {
        snappedY = element.y;
        guides.horizontal.push(element.y);
      }
      if (Math.abs(currentCenterY - element.centerY) < SNAP_THRESHOLD) {
        snappedY = element.centerY - height / 2;
        guides.horizontal.push(element.centerY);
      }
      if (Math.abs(currentBottom - element.bottom) < SNAP_THRESHOLD) {
        snappedY = element.bottom - height;
        guides.horizontal.push(element.bottom);
      }
    });
    
    return { x: snappedX, y: snappedY, guides };
  };

  const handleMouseMove = useCallback((e) => {
    if (!selectedElementId) return;

    if (isDragging) {
      // Calculate total delta from initial drag start
      // Divide by canvasZoom to convert screen pixels to canvas coordinates
      const deltaX = (e.clientX - dragStart.x) / canvasZoom;
      const deltaY = (e.clientY - dragStart.y) / canvasZoom;
      
      // Calculate new position from initial position
      let newX = initialPosition.x + deltaX;
      let newY = initialPosition.y + deltaY;
      
      // Get canvas dimensions from selected format
      const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
      const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
      
      // HARD BOUNDARY: Clamp position to canvas bounds
      newX = Math.max(0, Math.min(newX, canvasWidth - initialPosition.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - initialPosition.height));
      
      // Apply snapping (after boundary clamping)
      const snapped = calculateSnap(newX, newY, initialPosition.width, initialPosition.height, canvasWidth, canvasHeight);
      newX = snapped.x;
      newY = snapped.y;
      setSnapGuides(snapped.guides);
      
      // Update visual feedback
      setDragInfo({ 
        x: Math.round(newX), 
        y: Math.round(newY), 
        width: Math.round(initialPosition.width), 
        height: Math.round(initialPosition.height) 
      });
      
      // Update element position
      setElementTransforms(prev => {
        const current = prev[selectedElementId] || {};
        return {
          ...prev,
          [selectedElementId]: {
            ...current,
            x: newX,
            y: newY
          }
        };
      });
    } else if (isResizing && resizeHandle) {
      // Calculate total delta from initial resize start
      // Divide by canvasZoom to convert screen pixels to canvas coordinates
      const deltaX = (e.clientX - dragStart.x) / canvasZoom;
      const deltaY = (e.clientY - dragStart.y) / canvasZoom;
      
      let newX = initialPosition.x;
      let newY = initialPosition.y;
      let newWidth = initialPosition.width;
      let newHeight = initialPosition.height;
      
      // Handle different resize directions
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(50, initialPosition.width + deltaX);
      }
      if (resizeHandle.includes('w')) {
        newWidth = Math.max(50, initialPosition.width - deltaX);
        newX = initialPosition.x + deltaX;
        if (newWidth === 50) {
          newX = initialPosition.x + initialPosition.width - 50;
        }
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(50, initialPosition.height + deltaY);
      }
      if (resizeHandle.includes('n')) {
        newHeight = Math.max(50, initialPosition.height - deltaY);
        newY = initialPosition.y + deltaY;
        if (newHeight === 50) {
          newY = initialPosition.y + initialPosition.height - 50;
        }
      }
      
      // Update visual feedback
      setDragInfo({ 
        x: Math.round(newX), 
        y: Math.round(newY), 
        width: Math.round(newWidth), 
        height: Math.round(newHeight) 
      });
      
      // Update element transform
      setElementTransforms(prev => {
        const current = prev[selectedElementId] || {};
        return {
          ...prev,
          [selectedElementId]: {
            ...current,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
          }
        };
      });
    }
  }, [selectedElementId, isDragging, isResizing, resizeHandle, dragStart, canvasZoom, initialPosition, selectedFormat]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      saveToHistory();
    }
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragInfo(null);
    setSnapGuides({ vertical: [], horizontal: [] });
  }, [isDragging, isResizing, saveToHistory]);

  const handleBringForward = useCallback(() => {
    if (!selectedElementId) return;
    // Increase z-index
    setElementTransforms(prev => {
      const current = prev[selectedElementId] || {};
      return {
        ...prev,
        [selectedElementId]: {
          ...current,
          zIndex: (current.zIndex || 0) + 1
        }
      };
    });
    saveToHistory();
  }, [selectedElementId, saveToHistory]);

  const handleSendBackward = useCallback(() => {
    if (!selectedElementId) return;
    // Decrease z-index
    setElementTransforms(prev => {
      const current = prev[selectedElementId] || {};
      return {
        ...prev,
        [selectedElementId]: {
          ...current,
          zIndex: Math.max(0, (current.zIndex || 0) - 1)
        }
      };
    });
    saveToHistory();
  }, [selectedElementId, saveToHistory]);

  const handleDeleteLayer = useCallback(() => {
    if (!selectedElementId) return;
    
    // Remove from appropriate list
    if (selectedElementId.startsWith('scene-')) {
      const sceneId = selectedElementId.replace('scene-', '');
      setSelectedScenes(prev => prev.filter(s => s.scene.id !== sceneId));
    } else if (selectedElementId.startsWith('asset-')) {
      const assetId = selectedElementId.replace('asset-', '');
      setSelectedAssets(prev => prev.filter(a => a.asset.id !== assetId));
    } else if (selectedElementId.startsWith('wardrobe-')) {
      const wardrobeId = selectedElementId.replace('wardrobe-', '');
      setSelectedWardrobes(prev => prev.filter(w => w.wardrobe.id !== wardrobeId));
    }
    
    // Remove from transforms
    setElementTransforms(prev => {
      const newTransforms = { ...prev };
      delete newTransforms[selectedElementId];
      return newTransforms;
    });
    
    setSelectedElementId(null);
    saveToHistory();
  }, [selectedElementId, setSelectedScenes, setSelectedAssets, setSelectedWardrobes, saveToHistory]);

  const handleOpacityChange = useCallback((opacity) => {
    if (!selectedElementId) return;
    setElementTransforms(prev => {
      const current = prev[selectedElementId] || {};
      return {
        ...prev,
        [selectedElementId]: {
          ...current,
          opacity
        }
      };
    });
    saveToHistory();
  }, [selectedElementId, saveToHistory]);

  const handleRotationChange = useCallback((rotation) => {
    if (!selectedElementId) return;
    setElementTransforms(prev => {
      const current = prev[selectedElementId] || {};
      return {
        ...prev,
        [selectedElementId]: {
          ...current,
          rotation
        }
      };
    });
    saveToHistory();
  }, [selectedElementId, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const ctrl = e.ctrlKey || e.metaKey;
      
      // Toggle snap with Shift key
      if (e.key === 'Shift') {
        setSnapEnabled(false);
      }
      
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          handleDeleteLayer();
        }
      } else if (e.key === 'ArrowUp' && selectedElementId) {
        e.preventDefault();
        handleBringForward();
      } else if (e.key === 'ArrowDown' && selectedElementId) {
        e.preventDefault();
        handleSendBackward();
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setSnapEnabled(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementId, history, historyIndex]);

  // Background removal handler
  const handleRemoveBackground = async (assetId) => {
    try {
      console.log('🎨 Removing background for asset:', assetId);
      setProcessingAsset({ assetId, type: 'bg_removal' });
      
      const response = await fetch(`/api/v1/assets/${assetId}/remove-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to remove background: ${error}`);
      }
      
      const result = await response.json();
      console.log('✅ Background removed:', result);
      
      setProcessingStatus(prev => ({
        ...prev,
        [assetId]: { ...prev[assetId], bg_removed: true }
      }));
      
      // Reload to get updated asset
      await loadCompositions();
      alert('✅ Background removed successfully!');
      
    } catch (error) {
      console.error('❌ Background removal error:', error);
      alert('Failed to remove background: ' + error.message);
    } finally {
      setProcessingAsset(null);
    }
  };

  // Memoized: Get all elements sorted by render order
  const getAllElements = useMemo(() => {
    const elements = [
      ...selectedScenes.map(s => ({
        ...s.scene,
        type: 'scene',
        id: `scene-${s.scene.id}`,
        role: s.role
      })),
      ...selectedAssets.map(a => ({
        ...a.asset,
        type: 'asset',
        id: `asset-${a.asset.id}`,
        role: a.role
      })),
      ...selectedWardrobes.map(w => ({
        ...w.wardrobe,
        type: 'wardrobe',
        id: `wardrobe-${w.wardrobe.id}`,
        role: w.role
      }))
    ];
    
    // Sort by z-index
    return elements.sort((a, b) => {
      const zIndexA = (elementTransforms[a.id]?.zIndex || 0);
      const zIndexB = (elementTransforms[b.id]?.zIndex || 0);
      return zIndexA - zIndexB;
    });
  }, [selectedScenes, selectedAssets, selectedWardrobes, elementTransforms]);

  // Render canvas elements
  const renderSceneElements = () => {
    const elements = getAllElements;
    
    console.log('🎨 Rendering canvas elements:', {
      count: elements.length,
      currentTime,
      elements: elements.map(e => ({ 
        id: e.id, 
        type: e.type, 
        role: e.role, 
        title: e.title || e.name,
        startTime: elementTransforms[e.id]?.startTime,
        endTime: elementTransforms[e.id]?.endTime
      }))
    });
    
    return elements.map((element, index) => {
      // Background elements should fill the entire canvas
      const isBackground = element.role === 'background';
      const isPrimary = element.role === 'primary';
      
      const transform = elementTransforms[element.id];
      
      // Check visibility and lock status
      const isVisible = transform?.visible !== false;
      const isLocked = transform?.locked === true;
      
      // Check temporal visibility - only show if currentTime is within element's time range
      const startTime = transform?.startTime ?? 0;
      const endTime = transform?.endTime ?? Infinity;
      const isInTimeRange = currentTime >= startTime && currentTime < endTime;
      
      // Don't render hidden elements or elements outside time range
      if (!isVisible || !isInTimeRange) return null;
      
      // Determine element style - merge transform with defaults to ensure all properties exist
      const defaultStyle = (!isBackground && !isPrimary) ? {
        x: 50 + (index * 30),
        y: 50 + (index * 30),
        width: 300,
        height: 225,
        scale: 1,
        opacity: 100,
        rotation: 0,
        zIndex: index,
        ...transform  // Spread transform after defaults to override with actual values
      } : {};
      
      const isSelected = selectedElementId === element.id;
      const roleInfo = 
        element.type === 'scene' ? SCENE_ROLES.find(r => r.id === element.role) :
        element.type === 'asset' ? ASSET_ROLES.find(r => r.id === element.role) :
        WARDROBE_ROLES.find(r => r.id === element.role);
      
      const layerOpacity = defaultStyle.opacity !== undefined ? defaultStyle.opacity / 100 : 1;
      const layerRotation = defaultStyle.rotation || 0;
      
      // Get canvas dimensions for background/primary layers
      const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
      const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
      
      return (
        <div
          key={element.id}
          className={`sc-canvas-layer ${isSelected && !isBackground && !isPrimary ? 'sc-layer-selected' : ''} ${isBackground ? 'sc-layer-background' : ''} ${isPrimary ? 'sc-layer-primary' : ''} ${isLocked ? 'sc-layer-locked' : ''}`}
          style={!isBackground && !isPrimary ? {
            position: 'absolute',
            left: defaultStyle.x,
            top: defaultStyle.y,
            width: defaultStyle.width,
            height: defaultStyle.height,
            transform: `scale(${defaultStyle.scale || 1}) rotate(${layerRotation}deg)`,
            transformOrigin: 'center center',
            cursor: isLocked ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
            zIndex: defaultStyle.zIndex || element.zIndex,
            opacity: layerOpacity
          } : {
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasWidth,
            height: canvasHeight,
            opacity: layerOpacity,
            overflow: 'hidden'
          }}
          onMouseDown={(e) => !isLocked && handleElementMouseDown(e, element.id, isBackground || isPrimary)}
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked) setSelectedElementId(element.id);
          }}
        >
          {/* Element image */}
          <div className="sc-layer-content" style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}>
            {(() => {
              // Get image URL from various possible properties
              const imageUrl = 
                element.s3_url_processed || 
                element.s3_url_raw || 
                element.thumbnail_url || 
                element.thumbnail || 
                element.image_url ||
                element.s3_url;
              
              return imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={element.title || element.name}
                  style={(isBackground || isPrimary) ? {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  } : {
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('Failed to load image:', imageUrl);
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: roleInfo?.color || '#6b7280',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3rem',
                  opacity: 0.6
                }}>
                  {roleInfo?.icon || '📷'}
                </div>
              );
            })()}
          </div>
          
          {/* Selection border and resize handles */}
          {isSelected && !isBackground && !isPrimary && (
            <>
              <div style={{
                position: 'absolute',
                inset: 0,
                border: '3px solid #3b82f6',
                borderRadius: '8px',
                pointerEvents: 'none',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.2)'
              }} />
              
              {/* Resize handles */}
              <div className="sc-resize-handle sc-resize-nw" onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')} />
              <div className="sc-resize-handle sc-resize-n" onMouseDown={(e) => handleResizeStart(e, element.id, 'n')} />
              <div className="sc-resize-handle sc-resize-ne" onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')} />
              <div className="sc-resize-handle sc-resize-e" onMouseDown={(e) => handleResizeStart(e, element.id, 'e')} />
              <div className="sc-resize-handle sc-resize-se" onMouseDown={(e) => handleResizeStart(e, element.id, 'se')} />
              <div className="sc-resize-handle sc-resize-s" onMouseDown={(e) => handleResizeStart(e, element.id, 's')} />
              <div className="sc-resize-handle sc-resize-sw" onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')} />
              <div className="sc-resize-handle sc-resize-w" onMouseDown={(e) => handleResizeStart(e, element.id, 'w')} />
            </>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="sc-loading">
        <div className="sc-spinner"></div>
        <p>Loading compositions...</p>
      </div>
    );
  }

  // console.log('🎬 VideoCompositionWorkspace render:', { 
  //   compositions: compositions.length,
  //   activeTemplate: activeTemplate?.id,
  //   showCreateDialog 
  // });

  return (
    <div className="video-workspace">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-header-left">
          {viewMode === 'editor' && activeTemplate && (
            <button 
              className="sc-back-btn"
              onClick={() => {
                setViewMode('gallery');
                setActiveTemplate(null);
              }}
              title="Back to gallery"
            >
              ← 
            </button>
          )}
          <div>
            {viewMode === 'editor' && activeTemplate ? (
              <input
                className="vw-title-input"
                value={activeTemplate.name || ''}
                onChange={(e) =>
                  setActiveTemplate((prev) => ({ ...prev, name: e.target.value }))
                }
                onBlur={() => handleSaveTemplate()}
                placeholder="Composition name"
              />
            ) : (
              <h2 className="sc-title">🎬 Video Compositions</h2>
            )}
            <p className="sc-subtitle">
              {episode?.episodeTitle || episode?.title || `Episode ${episode?.episode_number || ''}`}
            </p>
          </div>
        </div>
        
        <div className="sc-header-right">
          {viewMode === 'editor' && activeTemplate && (
            <>
              {/* Canvas Controls Toolbar */}
              <div className="sc-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Zoom Controls */}
                <div className="sc-toolbar-group" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '4px 8px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <label className="sc-toolbar-label" style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginRight: '4px' }}>🔍 Zoom:</label>
                  <button 
                    className={`sc-toolbar-btn ${canvasZoom === 0.25 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(0.25)}
                    title="Zoom to 25%"
                    style={{ minWidth: '48px' }}
                  >
                    25%
                  </button>
                  <button 
                    className={`sc-toolbar-btn ${canvasZoom === 0.5 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(0.5)}
                    title="Zoom to 50%"
                    style={{ minWidth: '48px' }}
                  >
                    50%
                  </button>
                  <button 
                    className={`sc-toolbar-btn ${canvasZoom === 1 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(1)}
                    title="Zoom to 100% (Actual Size)"
                    style={{ minWidth: '48px' }}
                  >
                    100%
                  </button>
                  <button 
                    className={`sc-toolbar-btn ${canvasZoom === 2 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(2)}
                    title="Zoom to 200%"
                    style={{ minWidth: '48px' }}
                  >
                    200%
                  </button>
                </div>
                
                {/* View Options */}
                <div className="sc-toolbar-group" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '4px 8px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <button 
                    className={`sc-toolbar-btn ${showGrid ? 'active' : ''}`}
                    onClick={() => setShowGrid(!showGrid)}
                    title="Toggle Grid (G)"
                    style={{ minWidth: '60px' }}
                  >
                    📐 Grid
                  </button>
                  <button 
                    className={`sc-toolbar-btn ${showRulers ? 'active' : ''}`}
                    onClick={() => setShowRulers(!showRulers)}
                    title="Toggle Rulers (R)"
                    style={{ minWidth: '70px' }}
                  >
                    📏 Rulers
                  </button>
                  <button 
                    className={`sc-toolbar-btn ${snapEnabled ? 'active' : ''}`}
                    onClick={() => setSnapEnabled(!snapEnabled)}
                    title="Toggle Snap to Grid (Hold Shift to temporarily disable)"
                    style={{ minWidth: '60px' }}
                  >
                    🧲 Snap
                  </button>
                </div>
              </div>
              
              {/* Platform Format Selector */}
              <div className="sc-format-selector">
                <label className="sc-format-label">Platform:</label>
                <select 
                  className="sc-format-select"
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  title="Select video format for social media platform"
                >
                  {VIDEO_FORMATS.map(format => (
                    <option key={format.id} value={format.id}>
                      {format.icon} {format.name} ({format.ratio})
                    </option>
                  ))}
                </select>
              </div>
              
              <button 
                className="sc-btn"
                onClick={handleSaveTemplate}
                disabled={saving}
                title="Save composition"
              >
                <span>{saving ? '⏳' : '💾'}</span>
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
          
          {viewMode === 'gallery' && (
            <button 
              className="sc-btn sc-btn-primary"
              onClick={handleCreateTemplate}
            >
              <span>✨</span>
              <span>New Composition</span>
            </button>
          )}
        </div>
      </div>

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <div className="sc-gallery">
          {templates.length > 0 && (
            <div style={{ 
              background: '#f0f9ff', 
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              textAlign: 'center',
              fontSize: '15px',
              fontWeight: '600',
              color: '#1e40af'
            }}>
              👆 Click on a composition card below to open the video editor canvas
            </div>
          )}
          {templates.length > 0 ? (
            <div className="sc-compositions-grid">
              {templates.map(comp => (
                <div 
                  key={comp.id} 
                  className="sc-composition-card"
                  onClick={() => {
                    setActiveTemplate(comp);
                    // Load composition data
                    if (comp.scenes && Array.isArray(comp.scenes)) {
                      const scenesWithData = comp.scenes.map(s => {
                        const sceneData = episodeScenes.find(es => es.id === s.scene_id);
                        return sceneData ? { scene: sceneData, role: s.role } : null;
                      }).filter(Boolean);
                      setSelectedScenes(scenesWithData);
                    }
                    if (comp.assets && Array.isArray(comp.assets)) {
                      const assetsWithData = comp.assets.map(a => {
                        const assetData = episodeAssets.find(ea => ea.id === a.asset_id);
                        return assetData ? { asset: assetData, role: a.role } : null;
                      }).filter(Boolean);
                      setSelectedAssets(assetsWithData);
                    }
                    setViewMode('editor');
                  }}
                >
                  <div className="sc-card-preview">
                    {comp.scenes?.[0] ? (
                      <img 
                        src={episodeScenes.find(s => s.id === comp.scenes[0].scene_id)?.thumbnail_url || '/placeholder.jpg'}
                        alt={comp.name}
                        className="sc-card-thumb"
                      />
                    ) : (
                      <div className="sc-card-placeholder">
                        <span>🎬</span>
                      </div>
                    )}
                    <div className={`sc-card-status sc-status-${comp.status || 'draft'}`}>
                      {comp.status || 'draft'}
                    </div>
                  </div>
                  
                  <div className="sc-card-body">
                    <h3 className="sc-card-title">{comp.name}</h3>
                    <div className="sc-card-meta">
                      <span>{(comp.scenes?.length || 0)} scenes</span>
                      <span>•</span>
                      <span>{(comp.assets?.length || 0)} assets</span>
                    </div>
                    <div className="sc-card-date">
                      {new Date(comp.updated_at || comp.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Create New Card */}
              <div 
                className="sc-composition-card sc-card-create"
                onClick={handleCreateTemplate}
              >
                <div className="sc-card-create-content">
                  <div className="sc-create-icon">✨</div>
                  <h3 className="sc-create-title">Create New</h3>
                  <p className="sc-create-hint">Start a new composition</p>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="sc-empty-workspace">
              <div className="sc-empty-card">
                <div className="sc-empty-icon-large">🎬</div>
                <h3 className="sc-empty-title">Create Your First Video Composition</h3>
                <p className="sc-empty-description">
                  Start editing videos with our timeline-based video editor.
                  Arrange scenes, assets, and wardrobe on a timeline to create your final video.
                </p>
                
                <button 
                  className="sc-btn sc-btn-primary sc-btn-large"
                  onClick={handleCreateTemplate}
                  style={{ fontSize: '16px', padding: '14px 28px' }}
                >
                  <span>✨</span>
                  <span>Create Composition to Access Video Editor</span>
                </button>

                <div className="sc-feature-list">
                  <div className="sc-feature">
                    <span className="sc-feature-icon">🎬</span>
                    <div className="sc-feature-text">
                      <div className="sc-feature-title">Select Scenes</div>
                      <div className="sc-feature-hint">Choose from your episode's scene library</div>
                    </div>
                  </div>
                  <div className="sc-feature">
                    <span className="sc-feature-icon">🎨</span>
                    <div className="sc-feature-text">
                      <div className="sc-feature-title">Layer Assets</div>
                      <div className="sc-feature-hint">Add logos, overlays, and graphics</div>
                    </div>
                  </div>
                  <div className="sc-feature">
                    <span className="sc-feature-icon">📤</span>
                    <div className="sc-feature-text">
                      <div className="sc-feature-title">Export Multiple Formats</div>
                      <div className="sc-feature-hint">Generate for YouTube, Instagram, TikTok</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'editor' && activeTemplate && (
        <div className="sc-editor">
          {/* Source Panel - Left (Fixed, always visible) */}
          <SourcePanel
            episodeScenes={episodeScenes}
            episodeAssets={episodeAssets}
            episodeWardrobes={episodeWardrobes}
            onAddScene={handleSceneToggle}
            onAddAsset={handleAssetToggle}
            onAddWardrobe={handleWardrobeToggle}
          />

          {/* Center - Canvas Workspace (Fixed, always visible) */}
          <div className="sc-canvas-container">
            <div className="sc-canvas">
              {/* Format indicator */}
              {viewMode === 'editor' && (
                <div className="sc-canvas-format-badge">
                  <span>{VIDEO_FORMATS.find(f => f.id === selectedFormat)?.icon}</span>
                  <span>{VIDEO_FORMATS.find(f => f.id === selectedFormat)?.name}</span>
                  <span>({VIDEO_FORMATS.find(f => f.id === selectedFormat)?.ratio})</span>
                </div>
              )}
              
              {(selectedScenes.length === 0 && selectedAssets.length === 0 && selectedWardrobes.length === 0) ? (
                <div className="sc-canvas-placeholder">
                  <div className="sc-canvas-icon">�</div>
                  <div className="sc-canvas-title">Video Editing Canvas</div>
                  <div className="sc-canvas-subtitle">
                    👈 Select scenes, assets, or wardrobe from the left panel to get started
                  </div>
                  <div className="sc-canvas-format-info">
                    Format: {VIDEO_FORMATS.find(f => f.id === selectedFormat)?.name} ({VIDEO_FORMATS.find(f => f.id === selectedFormat)?.ratio})
                  </div>
                  <div className="sc-canvas-format-info" style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                    Elements will appear here and on the timeline below 👇
                  </div>
                </div>
              ) : (
                <>
                  {/* Video Stage - Fixed Aspect Ratio */}
                  {(() => {
                    const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                    const formatWidth = format?.width || 1920;
                    const formatHeight = format?.height || 1080;
                    const aspectRatio = formatWidth / formatHeight;
                    
                    // Fixed base size for canvas editing (scaled down from template resolution)
                    // CRITICAL: Canvas must maintain EXACT aspect ratio of selected platform
                    const baseWidth = formatWidth > 1920 ? formatWidth / 2 : (formatWidth <= 1280 ? formatWidth * 0.8 : formatWidth * 0.7);
                    const baseHeight = baseWidth / aspectRatio; // ENFORCE aspect ratio
                    
                    // Apply zoom on top of base size (NOT via transform, via actual dimensions)
                    const stageWidth = baseWidth * canvasZoom;
                    const stageHeight = baseHeight * canvasZoom;
                    
                    return (
                      <div 
                        className="sc-canvas-active"
                        data-format={format?.ratio}
                        style={{
                          width: `${stageWidth}px`,
                          height: `${stageHeight}px`,
                          position: 'relative',
                          background: '#000',
                          boxShadow: '0 0 0 4px #3b82f6, 0 0 0 6px rgba(255, 255, 255, 0.3), 0 10px 40px rgba(0, 0, 0, 0.7)',
                          border: '3px solid #60a5fa',
                          flexShrink: 0,
                          borderRadius: '8px'
                        }}
                      >
                        {/* Format Label Badge */}
                        <div style={{
                          position: 'absolute',
                          top: '-32px',
                          left: '0',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: '#fff',
                          padding: '4px 12px',
                          borderRadius: '6px 6px 0 0',
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          zIndex: 100,
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                        }}>
                          {format?.icon} {format?.name} • {format?.ratio} • {formatWidth}×{formatHeight}
                        </div>
                        
                        {/* Video Preview Stage - Composited Final Output */}
                        <div 
                          key={`preview-${currentTime}`}
                          className="sc-video-preview"
                          onClick={(e) => {
                            try {
                              e.stopPropagation();
                              setSelectedElementIds([]);
                            } catch (error) {
                              console.error('Canvas background click error:', error);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            background: '#000',
                            cursor: 'default'
                          }}
                        >
                          {/* Render all visible layers composited together at current time */}
                          {getAllElements.map((element) => {
                            const transform = elementTransforms[element.id];
                            const startTime = transform?.startTime ?? 0;
                            const endTime = transform?.endTime ?? Infinity;
                        const isInTimeRange = currentTime >= startTime && currentTime < endTime;
                        const isVisible = transform?.visible !== false;
                        
                        if (!isVisible || !isInTimeRange) return null;
                        
                        const isBackground = element.role === 'background';
                        const isPrimary = element.role === 'primary';
                        const layerOpacity = (transform?.opacity ?? 100) / 100;
                        
                        // Get image URL
                        const imageUrl = 
                          element.s3_url_processed || 
                          element.s3_url_raw || 
                          element.thumbnail_url || 
                          element.thumbnail || 
                          element.image_url ||
                          element.s3_url;
                        
                        const roleInfo = 
                          element.type === 'scene' ? SCENE_ROLES.find(r => r.id === element.role) :
                          element.type === 'asset' ? ASSET_ROLES.find(r => r.id === element.role) :
                          WARDROBE_ROLES.find(r => r.id === element.role);
                        
                        // Background/Primary fills entire frame
                        if (isBackground || isPrimary) {
                          const isSelected = selectedElementIds.includes(element.id);
                          return (
                            <div
                              key={element.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (e.shiftKey) {
                                  // Multi-select with Shift
                                  setSelectedElementIds(prev => 
                                    prev.includes(element.id) 
                                      ? prev.filter(id => id !== element.id)
                                      : [...prev, element.id]
                                  );
                                } else {
                                  setSelectedElementId(element.id);
                                }
                              }}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                opacity: layerOpacity,
                                zIndex: transform?.zIndex || 0,
                                cursor: 'pointer',
                                outline: isSelected ? '3px solid #3b82f6' : 'none',
                                outlineOffset: '-3px',
                                boxShadow: isSelected ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), inset 0 0 40px rgba(59, 130, 246, 0.3)' : 'none',
                                transition: 'outline 0.15s, box-shadow 0.15s'
                              }}
                            >
                              {imageUrl ? (
                                <img 
                                  src={imageUrl}
                                  alt={element.title || element.name}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    objectPosition: 'center',
                                    display: 'block',
                                    pointerEvents: 'none'
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  background: roleInfo?.color || '#1a1a1a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '4rem'
                                }}>
                                  {roleInfo?.icon || '🎬'}
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        // Overlay elements with transform
                        const x = transform?.x ?? 50;
                        const y = transform?.y ?? 50;
                        const width = transform?.width ?? 300;
                        const height = transform?.height ?? 225;
                        const rotation = transform?.rotation ?? 0;
                        const scale = transform?.scale ?? 1;
                        const isSelected = selectedElementIds.includes(element.id);
                        
                        return (
                          <div
                            key={element.id}
                            onClick={(e) => {
                              try {
                                e.stopPropagation();
                                if (e.shiftKey) {
                                  // Multi-select with Shift
                                  setSelectedElementIds(prev => 
                                    prev.includes(element.id) 
                                      ? prev.filter(id => id !== element.id)
                                      : [...prev, element.id]
                                  );
                                } else {
                                  setSelectedElementId(element.id);
                                }
                              } catch (error) {
                                console.error('Element click error:', error);
                              }
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedElementId(element.id);
                              
                              const startX = e.clientX;
                              const startY = e.clientY;
                              const startPos = { x, y };
                              
                              const handleMouseMove = (moveEvent) => {
                                const deltaX = (moveEvent.clientX - startX) / canvasZoom;
                                const deltaY = (moveEvent.clientY - startY) / canvasZoom;
                                
                                let newX = startPos.x + deltaX;
                                let newY = startPos.y + deltaY;
                                
                                // Snap to grid
                                if (showGrid) {
                                  const snapX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                                  const snapY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
                                  if (Math.abs(newX - snapX) < SNAP_THRESHOLD) newX = snapX;
                                  if (Math.abs(newY - snapY) < SNAP_THRESHOLD) newY = snapY;
                                }
                                
                                // Snap to canvas center
                                const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                                const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                                const centerX = canvasWidth / 2 - width / 2;
                                const centerY = canvasHeight / 2 - height / 2;
                                
                                if (Math.abs(newX - centerX) < SNAP_THRESHOLD) newX = centerX;
                                if (Math.abs(newY - centerY) < SNAP_THRESHOLD) newY = centerY;
                                
                                // Snap to edges
                                if (Math.abs(newX) < SNAP_THRESHOLD) newX = 0;
                                if (Math.abs(newY) < SNAP_THRESHOLD) newY = 0;
                                if (Math.abs(newX + width - canvasWidth) < SNAP_THRESHOLD) newX = canvasWidth - width;
                                if (Math.abs(newY + height - canvasHeight) < SNAP_THRESHOLD) newY = canvasHeight - height;
                                
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [element.id]: {
                                    ...prev[element.id],
                                    x: newX,
                                    y: newY
                                  }
                                }));
                              };
                              
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                                saveToHistory();
                              };
                              
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                            style={{
                              position: 'absolute',
                              left: `${x}px`,
                              top: `${y}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                              transform: `scale(${scale}) rotate(${rotation}deg)`,
                              transformOrigin: 'center center',
                              opacity: layerOpacity,
                              zIndex: transform?.zIndex || 0,
                              cursor: 'move',
                              outline: isSelected ? '3px solid #3b82f6' : 'none',
                              boxShadow: isSelected ? '0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 20px rgba(59, 130, 246, 0.5)' : 'none',
                              transition: 'outline 0.15s, box-shadow 0.15s'
                            }}
                          >
                            {imageUrl ? (
                              <img 
                                src={imageUrl}
                                alt={element.title || element.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  display: 'block'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                background: roleInfo?.color || '#6b7280',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2rem'
                              }}>
                                {roleInfo?.icon || '📷'}
                              </div>
                            )}
                            
                            {/* Resize Handles (only for selected overlay elements) */}
                            {isSelected && (
                              <>
                                {/* Corner handles */}
                                {['nw', 'ne', 'sw', 'se'].map(pos => (
                                  <div
                                    key={pos}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      const startX = e.clientX;
                                      const startY = e.clientY;
                                      const startTransform = { x, y, width, height };
                                      const aspectRatio = width / height;
                                      
                                      const handleMouseMove = (moveEvent) => {
                                        const deltaX = (moveEvent.clientX - startX) / canvasZoom;
                                        const deltaY = (moveEvent.clientY - startY) / canvasZoom;
                                        const maintainAspect = moveEvent.shiftKey;
                                        
                                        let newX = startTransform.x;
                                        let newY = startTransform.y;
                                        let newWidth = startTransform.width;
                                        let newHeight = startTransform.height;
                                        
                                        if (pos.includes('e')) { // East (right)
                                          newWidth = Math.max(20, startTransform.width + deltaX);
                                        } else if (pos.includes('w')) { // West (left)
                                          newWidth = Math.max(20, startTransform.width - deltaX);
                                          newX = startTransform.x + deltaX;
                                        }
                                        
                                        if (pos.includes('s')) { // South (bottom)
                                          newHeight = Math.max(20, startTransform.height + deltaY);
                                        } else if (pos.includes('n')) { // North (top)
                                          newHeight = Math.max(20, startTransform.height - deltaY);
                                          newY = startTransform.y + deltaY;
                                        }
                                        
                                        // Maintain aspect ratio with Shift key
                                        if (maintainAspect) {
                                          if (Math.abs(deltaX) > Math.abs(deltaY)) {
                                            newHeight = newWidth / aspectRatio;
                                            if (pos.includes('n')) {
                                              newY = startTransform.y + startTransform.height - newHeight;
                                            }
                                          } else {
                                            newWidth = newHeight * aspectRatio;
                                            if (pos.includes('w')) {
                                              newX = startTransform.x + startTransform.width - newWidth;
                                            }
                                          }
                                        }
                                        
                                        setElementTransforms(prev => ({
                                          ...prev,
                                          [element.id]: {
                                            ...prev[element.id],
                                            x: newX,
                                            y: newY,
                                            width: newWidth,
                                            height: newHeight
                                          }
                                        }));
                                      };
                                      
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                        saveToHistory();
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      width: '12px',
                                      height: '12px',
                                      background: '#fff',
                                      border: '2px solid #3b82f6',
                                      borderRadius: '50%',
                                      cursor: `${pos}-resize`,
                                      zIndex: 10,
                                      ...(pos === 'nw' && { top: '-6px', left: '-6px' }),
                                      ...(pos === 'ne' && { top: '-6px', right: '-6px' }),
                                      ...(pos === 'sw' && { bottom: '-6px', left: '-6px' }),
                                      ...(pos === 'se' && { bottom: '-6px', right: '-6px' })
                                    }}
                                  />
                                ))}
                                
                                {/* Edge handles */}
                                {['n', 'e', 's', 'w'].map(pos => (
                                  <div
                                    key={pos}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      const startX = e.clientX;
                                      const startY = e.clientY;
                                      const startTransform = { x, y, width, height };
                                      
                                      const handleMouseMove = (moveEvent) => {
                                        const deltaX = (moveEvent.clientX - startX) / canvasZoom;
                                        const deltaY = (moveEvent.clientY - startY) / canvasZoom;
                                        
                                        let newX = startTransform.x;
                                        let newY = startTransform.y;
                                        let newWidth = startTransform.width;
                                        let newHeight = startTransform.height;
                                        
                                        if (pos === 'e') {
                                          newWidth = Math.max(20, startTransform.width + deltaX);
                                        } else if (pos === 'w') {
                                          newWidth = Math.max(20, startTransform.width - deltaX);
                                          newX = startTransform.x + deltaX;
                                        } else if (pos === 's') {
                                          newHeight = Math.max(20, startTransform.height + deltaY);
                                        } else if (pos === 'n') {
                                          newHeight = Math.max(20, startTransform.height - deltaY);
                                          newY = startTransform.y + deltaY;
                                        }
                                        
                                        setElementTransforms(prev => ({
                                          ...prev,
                                          [element.id]: {
                                            ...prev[element.id],
                                            x: newX,
                                            y: newY,
                                            width: newWidth,
                                            height: newHeight
                                          }
                                        }));
                                      };
                                      
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                        saveToHistory();
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                    style={{
                                      position: 'absolute',
                                      background: '#fff',
                                      border: '2px solid #3b82f6',
                                      cursor: `${pos}-resize`,
                                      zIndex: 10,
                                      ...(pos === 'n' && { top: '-6px', left: '50%', transform: 'translateX(-50%)', width: '24px', height: '8px', borderRadius: '4px' }),
                                      ...(pos === 's' && { bottom: '-6px', left: '50%', transform: 'translateX(-50%)', width: '24px', height: '8px', borderRadius: '4px' }),
                                      ...(pos === 'e' && { top: '50%', right: '-6px', transform: 'translateY(-50%)', width: '8px', height: '24px', borderRadius: '4px' }),
                                      ...(pos === 'w' && { top: '50%', left: '-6px', transform: 'translateY(-50%)', width: '8px', height: '24px', borderRadius: '4px' })
                                    }}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Timecode overlay */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.75) 100%)',
                      backdropFilter: 'blur(8px)',
                      color: '#fff',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '700',
                      fontFamily: 'monospace',
                      letterSpacing: '0.5px',
                      zIndex: 1000,
                      pointerEvents: 'none',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <span style={{ color: '#3b82f6', marginRight: '4px' }}>⏱</span>
                      {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                    </div>
                    
                    {/* Format indicator overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.75) 100%)',
                      backdropFilter: 'blur(8px)',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      zIndex: 1000,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <span style={{ fontSize: '14px' }}>{format?.icon}</span>
                      <span style={{ fontWeight: '700' }}>{format?.name}</span>
                      <span style={{ 
                        opacity: 0.7, 
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px'
                      }}>
                        {format?.ratio}
                      </span>
                    </div>
                  </div>
                  );
                })()}
                </>
              )}
            </div>
          </div>

          {/* Bottom Timeline/Layers Area - Video Timeline */}
          <div className="sc-timeline-area">
            <div className="sc-timeline-panel">
              {/* Playback Controls */}
              <div className="sc-timeline-controls">
                <button 
                  className="sc-timeline-btn"
                  onClick={() => setIsPlaying(!playbackState.isPlaying)}
                  title={playbackState.isPlaying ? "Pause (Space)" : "Play (Space)"}
                  style={{ fontSize: '18px', width: '40px', height: '40px' }}
                >
                  {playbackState.isPlaying ? "⏸" : "▶"}
                </button>
                <button 
                  className="sc-timeline-btn"
                  onClick={() => setCurrentTime(0)}
                  title="Go to Start (Home)"
                  style={{ fontSize: '16px' }}
                >
                  ⏮
                </button>
                <button 
                  className="sc-timeline-btn"
                  onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                  title="Back 5 seconds (←)"
                  style={{ fontSize: '14px' }}
                >
                  ⏪
                </button>
                <button 
                  className="sc-timeline-btn"
                  onClick={() => setCurrentTime(Math.min(playbackState.duration, currentTime + 5))}
                  title="Forward 5 seconds (→)"
                  style={{ fontSize: '14px' }}
                >
                  ⏩
                </button>
                <span className="sc-timeline-time" style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: '600',
                  padding: '0 12px',
                  fontSize: '14px'
                }}>
                  {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(playbackState.duration / 60)}:{String(Math.floor(playbackState.duration % 60)).padStart(2, '0')}
                </span>
                
                {/* Timeline Zoom Controls */}
                <div style={{ 
                  marginLeft: 'auto', 
                  display: 'flex', 
                  gap: '4px', 
                  alignItems: 'center',
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  paddingLeft: '12px'
                }}>
                  <span style={{ fontSize: '12px', color: '#888', marginRight: '4px' }}>Zoom:</span>
                  <button 
                    className={`sc-timeline-btn ${timelineZoomLevel === 'fit' ? 'active' : ''}`}
                    onClick={() => setTimelineZoomLevel('fit')}
                    title="Fit all clips"
                    style={{ 
                      fontSize: '11px', 
                      padding: '4px 8px',
                      background: timelineZoomLevel === 'fit' ? '#3b82f6' : 'transparent',
                      color: timelineZoomLevel === 'fit' ? '#fff' : '#888'
                    }}
                  >
                    Fit
                  </button>
                  <button 
                    className={`sc-timeline-btn ${timelineZoomLevel === 10 ? 'active' : ''}`}
                    onClick={() => setTimelineZoomLevel(10)}
                    title="10 seconds per screen"
                    style={{ 
                      fontSize: '11px', 
                      padding: '4px 8px',
                      background: timelineZoomLevel === 10 ? '#3b82f6' : 'transparent',
                      color: timelineZoomLevel === 10 ? '#fff' : '#888'
                    }}
                  >
                    10s
                  </button>
                  <button 
                    className={`sc-timeline-btn ${timelineZoomLevel === 30 ? 'active' : ''}`}
                    onClick={() => setTimelineZoomLevel(30)}
                    title="30 seconds per screen"
                    style={{ 
                      fontSize: '11px', 
                      padding: '4px 8px',
                      background: timelineZoomLevel === 30 ? '#3b82f6' : 'transparent',
                      color: timelineZoomLevel === 30 ? '#fff' : '#888'
                    }}
                  >
                    30s
                  </button>
                  <button 
                    className={`sc-timeline-btn ${timelineZoomLevel === 60 ? 'active' : ''}`}
                    onClick={() => setTimelineZoomLevel(60)}
                    title="60 seconds per screen"
                    style={{ 
                      fontSize: '11px', 
                      padding: '4px 8px',
                      background: timelineZoomLevel === 60 ? '#3b82f6' : 'transparent',
                      color: timelineZoomLevel === 60 ? '#fff' : '#888'
                    }}
                  >
                    60s
                  </button>
                </div>
              </div>
              
              {/* Timeline Ruler and Tracks */}
              <div className="sc-timeline-content">
                {/* Time Ruler */}
                <div 
                  className="sc-timeline-ruler"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percent = Math.max(0, Math.min(1, x / rect.width));
                    setCurrentTime(percent * playbackState.duration);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="sc-timeline-ruler-track">
                    {Array.from({ length: Math.ceil(playbackState.duration) + 1 }, (_, i) => (
                      <div 
                        key={i} 
                        className="sc-timeline-marker"
                        style={{ left: `${(i / playbackState.duration) * 100}%` }}
                      >
                        {i % 5 === 0 && (
                          <span className="sc-timeline-marker-label">
                            {Math.floor(i / 60)}:{String(i % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Playhead */}
                  <div 
                    className="sc-timeline-playhead"
                    style={{ left: `${(currentTime / playbackState.duration) * 100}%` }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.parentElement.getBoundingClientRect();
                      const handleDrag = (e) => {
                        const x = e.clientX - rect.left;
                        const percent = Math.max(0, Math.min(1, x / rect.width));
                        setCurrentTime(percent * playbackState.duration);
                      };
                      const handleUp = () => {
                        document.removeEventListener('mousemove', handleDrag);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleDrag);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  >
                    <div className="sc-timeline-playhead-line"></div>
                    <div className="sc-timeline-playhead-handle"></div>
                  </div>
                </div>
                
                {/* Timeline Tracks */}
                <div className="sc-timeline-tracks" ref={timelineRef}>
                  {getAllElements.map((element, index) => {
                    const transform = elementTransforms[element.id];
                    const startTime = transform?.startTime || 0;
                    const endTime = transform?.endTime || 5;
                    const duration = endTime - startTime;
                    const startPercent = (startTime / playbackState.duration) * 100;
                    const widthPercent = (duration / playbackState.duration) * 100;
                    const isSelected = selectedElementIds.includes(element.id);
                    
                    const roleInfo = 
                      element.type === 'scene' ? SCENE_ROLES.find(r => r.id === element.role) :
                      element.type === 'asset' ? ASSET_ROLES.find(r => r.id === element.role) :
                      WARDROBE_ROLES.find(r => r.id === element.role);
                    
                    const imageUrl = 
                      element.s3_url_processed || 
                      element.s3_url_raw || 
                      element.thumbnail_url || 
                      element.thumbnail || 
                      element.image_url ||
                      element.s3_url;
                    
                    return (
                      <div key={element.id} className="sc-timeline-track">
                        <div className="sc-timeline-track-label">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt=""
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '4px',
                                objectFit: 'cover',
                                marginRight: '8px',
                                border: '1px solid rgba(0,0,0,0.1)'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '4px',
                              background: roleInfo?.color || '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: '8px',
                              fontSize: '16px'
                            }}>
                              {roleInfo?.icon}
                            </div>
                          )}
                          <span className="sc-timeline-track-name">
                            {element.title || element.name || 'Untitled'}
                          </span>
                        </div>
                        <div className="sc-timeline-track-content">
                          <div
                            className={`sc-timeline-clip ${isSelected ? 'sc-timeline-clip-selected' : ''}`}
                            style={{
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                              backgroundColor: roleInfo?.color || '#6b7280',
                              backgroundImage: imageUrl && widthPercent > 8 ? `url(${imageUrl})` : (isSelected ? `linear-gradient(135deg, ${roleInfo?.color || '#3b82f6'} 0%, ${roleInfo?.color || '#2563eb'} 100%)` : 'none'),
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              position: 'relative',
                              overflow: 'visible'
                            }}
                            onClick={(e) => {
                              if (e.shiftKey) {
                                // Multi-select with Shift
                                setSelectedElementIds(prev => 
                                  prev.includes(element.id) 
                                    ? prev.filter(id => id !== element.id)
                                    : [...prev, element.id]
                                );
                              } else {
                                setSelectedElementId(element.id);
                              }
                            }}
                          >
                            {imageUrl && widthPercent > 8 && (
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: `linear-gradient(to right, ${roleInfo?.color || 'rgba(0,0,0,0.5)'} 0%, transparent 50%)`,
                                pointerEvents: 'none'
                              }}></div>
                            )}
                            <div className="sc-timeline-clip-label" style={{ position: 'relative', zIndex: 1 }}>
                              {element.title || element.name}
                            </div>
                            <div className="sc-timeline-clip-duration" style={{ position: 'relative', zIndex: 1 }}>
                              {duration.toFixed(1)}s
                            </div>
                            
                            {/* Trim handles */}
                            {isSelected && (
                              <>
                                {/* Left trim handle */}
                                <div
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    const startClientX = e.clientX;
                                    const startTime = transform?.startTime ?? 0;
                                    const endTime = transform?.endTime ?? playbackState.duration;
                                    const timelineWidth = timelineRef.current?.offsetWidth || 800;
                                    
                                    const handleMouseMove = (moveEvent) => {
                                      const deltaTime = ((moveEvent.clientX - startClientX) / timelineWidth) * playbackState.duration;
                                      const newStartTime = Math.max(0, Math.min(endTime - 0.1, startTime + deltaTime));
                                      
                                      setElementTransforms(prev => ({
                                        ...prev,
                                        [element.id]: {
                                          ...prev[element.id],
                                          startTime: newStartTime
                                        }
                                      }));
                                    };
                                    
                                    const handleMouseUp = () => {
                                      document.removeEventListener('mousemove', handleMouseMove);
                                      document.removeEventListener('mouseup', handleMouseUp);
                                      saveToHistory();
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: '8px',
                                    background: 'rgba(255, 255, 255, 0.3)',
                                    borderLeft: '2px solid #fff',
                                    cursor: 'ew-resize',
                                    zIndex: 10,
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                />
                                
                                {/* Right trim handle */}
                                <div
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    const startClientX = e.clientX;
                                    const startTime = transform?.startTime ?? 0;
                                    const endTime = transform?.endTime ?? playbackState.duration;
                                    const timelineWidth = timelineRef.current?.offsetWidth || 800;
                                    
                                    const handleMouseMove = (moveEvent) => {
                                      const deltaTime = ((moveEvent.clientX - startClientX) / timelineWidth) * playbackState.duration;
                                      const newEndTime = Math.max(startTime + 0.1, Math.min(playbackState.duration, endTime + deltaTime));
                                      
                                      setElementTransforms(prev => ({
                                        ...prev,
                                        [element.id]: {
                                          ...prev[element.id],
                                          endTime: newEndTime
                                        }
                                      }));
                                    };
                                    
                                    const handleMouseUp = () => {
                                      document.removeEventListener('mousemove', handleMouseMove);
                                      document.removeEventListener('mouseup', handleMouseUp);
                                      saveToHistory();
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: '8px',
                                    background: 'rgba(255, 255, 255, 0.3)',
                                    borderRight: '2px solid #fff',
                                    cursor: 'ew-resize',
                                    zIndex: 10,
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {getAllElements.length === 0 && (
                    <div className="sc-timeline-empty">
                      <p>No elements in timeline. Select scenes or assets to begin.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inspector Panel - Right (Fixed, always visible) */}
          <div className="sc-inspector-panel">
              <div className="sc-panel-header">
              <h3 className="sc-panel-title">Properties</h3>
              </div>

              <div className="sc-panel-content">
                {/* Element Properties - Only show when an element is selected */}
                {selectedElementId && (() => {
                  const transform = elementTransforms[selectedElementId] || { x: 50, y: 50, width: 200, height: 150, scale: 1, opacity: 100, rotation: 0 };
                  const element = getAllElements.find(el => el.id === selectedElementId);
                  const isBackground = element?.role === 'background';
                  const isPrimary = element?.role === 'primary';
                  
                  if (isBackground || isPrimary) return null; // Don't show controls for background/primary
                  
                  return (
                    <>
                      {/* Element Info Header */}
                      <div style={{
                        background: '#f8fafc',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '20px' }}>🎨</span>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1f2937' }}>Element Properties</h4>
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                          {element?.title || element?.name || 'Untitled'}
                        </div>
                      </div>
                      
                      <div className="sc-inspector-section sc-layer-properties">
                        {/* Section Header - Collapsible */}
                        <div 
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => setPanelCollapsed(prev => ({ ...prev, layering: !prev.layering }))}
                        >
                          <span>LAYER</span>
                          <span style={{ 
                            transform: panelCollapsed.layering ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '10px'
                          }}>▼</span>
                        </div>
                        
                        {!panelCollapsed.layering && (
                        <>
                        {/* Layer Ordering Controls */}
                        <div className="sc-property-group">
                          <div className="sc-property-label">Layer Order</div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                const currentZ = transform?.zIndex || 0;
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], zIndex: currentZ + 1 }
                                }));
                                saveToHistory();
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                              title="Bring layer forward (increase z-index)"
                            >
                              ⬆️ Forward
                            </button>
                            <button
                              onClick={() => {
                                const currentZ = transform?.zIndex || 0;
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], zIndex: Math.max(0, currentZ - 1) }
                                }));
                                saveToHistory();
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                background: '#6b7280',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#4b5563'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#6b7280'}
                              title="Send layer backward (decrease z-index)"
                            >
                              ⬇️ Back
                            </button>
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                            Current z-index: {transform?.zIndex || 0}
                          </div>
                        </div>
                      
                      {/* Element Name */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">Name</div>
                        <div className="sc-property-value" style={{ fontWeight: 600, color: '#111827' }}>
                          {element?.data?.title || element?.data?.name || 'Layer'}
                        </div>
                      </div>
                      </>
                      )}
                      </div>
                      
                      {/* Position Section - Collapsible */}
                      <div className="sc-inspector-section">
                        <div 
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => setPanelCollapsed(prev => ({ ...prev, position: !prev.position }))}
                        >
                          <span>POSITION & SIZE</span>
                          <span style={{ 
                            transform: panelCollapsed.position ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '10px'
                          }}>▼</span>
                        </div>
                        
                        {!panelCollapsed.position && (
                        <>
                      {/* Position */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">Position</div>
                        <div className="sc-property-inputs">
                          <div className="sc-input-group">
                            <label>X</label>
                            <input 
                              type="number" 
                              value={Math.round(transform.x || 0)}
                              onChange={(e) => {
                                const newX = parseFloat(e.target.value) || 0;
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], x: newX }
                                }));
                              }}
                              onBlur={() => saveToHistory()}
                              className="sc-number-input"
                            />
                          </div>
                          <div className="sc-input-group">
                            <label>Y</label>
                            <input 
                              type="number" 
                              value={Math.round(transform.y || 0)}
                              onChange={(e) => {
                                const newY = parseFloat(e.target.value) || 0;
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], y: newY }
                                }));
                              }}
                              onBlur={() => saveToHistory()}
                              className="sc-number-input"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Size */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">Size</div>
                        <div className="sc-property-inputs">
                          <div className="sc-input-group">
                            <label>W</label>
                            <input 
                              type="number" 
                              value={Math.round(transform.width || 200)}
                              onChange={(e) => {
                                const newWidth = Math.max(50, parseFloat(e.target.value) || 200);
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], width: newWidth }
                                }));
                              }}
                              onBlur={() => saveToHistory()}
                              className="sc-number-input"
                              min="50"
                            />
                          </div>
                          <div className="sc-input-group">
                            <label>H</label>
                            <input 
                              type="number" 
                              value={Math.round(transform.height || 150)}
                              onChange={(e) => {
                                const newHeight = Math.max(50, parseFloat(e.target.value) || 150);
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], height: newHeight }
                                }));
                              }}
                              onBlur={() => saveToHistory()}
                              className="sc-number-input"
                              min="50"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Thumbnail Preview */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">Preview</div>
                        <div style={{
                          width: '100%',
                          height: '140px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #e5e7eb'
                        }}>
                          {(() => {
                            const imageUrl = 
                              element?.s3_url_processed || 
                              element?.s3_url_raw || 
                              element?.thumbnail_url || 
                              element?.thumbnail || 
                              element?.image_url ||
                              element?.s3_url;
                            
                            if (imageUrl) {
                              return (
                                <img 
                                  src={imageUrl}
                                  alt={element?.title || element?.name}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                              );
                            } else {
                              const roleInfo = 
                                element?.type === 'scene' ? SCENE_ROLES.find(r => r.id === element?.role) :
                                element?.type === 'asset' ? ASSET_ROLES.find(r => r.id === element?.role) :
                                WARDROBE_ROLES.find(r => r.id === element?.role);
                              
                              return (
                                <div style={{
                                  fontSize: '48px',
                                  color: '#9ca3af'
                                }}>
                                  {roleInfo?.icon || '📷'}
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      
                      {/* Position Presets */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">Position Presets</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          {[
                            { label: '↖', pos: { x: 0, y: 0 }, tooltip: 'Top Left' },
                            { label: '↑', pos: 'topCenter', tooltip: 'Top Center' },
                            { label: '↗', pos: 'topRight', tooltip: 'Top Right' },
                            { label: '←', pos: 'middleLeft', tooltip: 'Middle Left' },
                            { label: '◉', pos: 'center', tooltip: 'Center' },
                            { label: '→', pos: 'middleRight', tooltip: 'Middle Right' },
                            { label: '↙', pos: 'bottomLeft', tooltip: 'Bottom Left' },
                            { label: '↓', pos: 'bottomCenter', tooltip: 'Bottom Center' },
                            { label: '↘', pos: 'bottomRight', tooltip: 'Bottom Right' }
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                                const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                                const w = transform.width || 200;
                                const h = transform.height || 150;
                                
                                let pos;
                                if (typeof preset.pos === 'object') {
                                  pos = preset.pos;
                                } else {
                                  const positions = {
                                    topCenter: { x: canvasWidth / 2 - w / 2, y: 0 },
                                    topRight: { x: canvasWidth - w, y: 0 },
                                    middleLeft: { x: 0, y: canvasHeight / 2 - h / 2 },
                                    center: { x: canvasWidth / 2 - w / 2, y: canvasHeight / 2 - h / 2 },
                                    middleRight: { x: canvasWidth - w, y: canvasHeight / 2 - h / 2 },
                                    bottomLeft: { x: 0, y: canvasHeight - h },
                                    bottomCenter: { x: canvasWidth / 2 - w / 2, y: canvasHeight - h },
                                    bottomRight: { x: canvasWidth - w, y: canvasHeight - h }
                                  };
                                  pos = positions[preset.pos];
                                }
                                
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], x: pos.x, y: pos.y }
                                }));
                                saveToHistory();
                              }}
                              title={preset.tooltip}
                              style={{
                                padding: '10px',
                                background: '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                transition: 'all 0.15s',
                                fontWeight: '600'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#3b82f6';
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.borderColor = '#3b82f6';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                                e.currentTarget.style.color = '#000';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      </>
                      )}
                      </div>
                      
                      {/* Scale Section - Collapsible */}
                      <div className="sc-inspector-section">
                        <div 
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => setPanelCollapsed(prev => ({ ...prev, scale: !prev.scale }))}
                        >
                          <span>SCALE</span>
                          <span style={{ 
                            transform: panelCollapsed.scale ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '10px'
                          }}>▼</span>
                        </div>
                        
                        {!panelCollapsed.scale && (
                        <>
                      {/* Scale */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">
                          Scale
                          <span className="sc-property-value-badge">{Math.round((transform.scale || 1) * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="300" 
                          value={(transform.scale || 1) * 100}
                          onChange={(e) => {
                            const newScale = parseFloat(e.target.value) / 100;
                            setElementTransforms(prev => ({
                              ...prev,
                              [selectedElementId]: { ...prev[selectedElementId], scale: newScale }
                            }));
                          }}
                          onMouseUp={() => saveToHistory()}
                          className="sc-slider"
                        />
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          {[0.5, 0.75, 1, 1.5, 2].map(scale => (
                            <button
                              key={scale}
                              onClick={() => {
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], scale }
                                }));
                                saveToHistory();
                              }}
                              style={{
                                flex: 1,
                                padding: '6px 4px',
                                background: Math.abs((transform.scale || 1) - scale) < 0.01 ? '#3b82f6' : '#f3f4f6',
                                color: Math.abs((transform.scale || 1) - scale) < 0.01 ? '#fff' : '#6b7280',
                                border: '1px solid',
                                borderColor: Math.abs((transform.scale || 1) - scale) < 0.01 ? '#3b82f6' : '#e5e7eb',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '600',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                if (Math.abs((transform.scale || 1) - scale) >= 0.01) {
                                  e.currentTarget.style.background = '#e5e7eb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (Math.abs((transform.scale || 1) - scale) >= 0.01) {
                                  e.currentTarget.style.background = '#f3f4f6';
                                }
                              }}
                            >
                              {scale * 100}%
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Quick Resize Presets */}
                      <div className="sc-property-group">
                        <div className="sc-property-label" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#3b82f6' }}>
                          📐 Social Media Sizes
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button
                            className="sc-btn sc-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                              // Instagram Post 1:1 ratio - 25% of canvas
                              const size = Math.min(canvasWidth, canvasHeight) * 0.25;
                              setElementTransforms(prev => ({
                                ...prev,
                                [selectedElementId]: { 
                                  ...prev[selectedElementId], 
                                  width: size, 
                                  height: size 
                                }
                              }));
                              saveToHistory();
                            }}
                            title="Instagram Post 1:1 square"
                            style={{ justifyContent: 'space-between' }}
                          >
                            <span>📷 Instagram Post</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>1:1</span>
                          </button>
                          <button
                            className="sc-btn sc-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                              // Story/TikTok 9:16 ratio - 20% of canvas width
                              const width = canvasWidth * 0.2;
                              const height = width * (16 / 9);
                              setElementTransforms(prev => ({
                                ...prev,
                                [selectedElementId]: { 
                                  ...prev[selectedElementId], 
                                  width: width, 
                                  height: height 
                                }
                              }));
                              saveToHistory();
                            }}
                            title="Instagram Story / TikTok 9:16"
                            style={{ justifyContent: 'space-between' }}
                          >
                            <span>📱 Story/TikTok</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>9:16</span>
                          </button>
                          <button
                            className="sc-btn sc-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                              // YouTube 16:9 ratio - 30% of canvas
                              const width = canvasWidth * 0.3;
                              const height = width * (9 / 16);
                              setElementTransforms(prev => ({
                                ...prev,
                                [selectedElementId]: { 
                                  ...prev[selectedElementId], 
                                  width: width, 
                                  height: height 
                                }
                              }));
                              saveToHistory();
                            }}
                            title="YouTube / Facebook 16:9"
                            style={{ justifyContent: 'space-between' }}
                          >
                            <span>📺 YouTube/FB</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>16:9</span>
                          </button>
                          <button
                            className="sc-btn sc-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                              // Twitter/LinkedIn 1.91:1 ratio - 35% of canvas width
                              const width = canvasWidth * 0.35;
                              const height = width * (628 / 1200);
                              setElementTransforms(prev => ({
                                ...prev,
                                [selectedElementId]: { 
                                  ...prev[selectedElementId], 
                                  width: width, 
                                  height: height 
                                }
                              }));
                              saveToHistory();
                            }}
                            title="Twitter / LinkedIn 1.91:1"
                            style={{ justifyContent: 'space-between' }}
                          >
                            <span>🐦 Twitter/LinkedIn</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>1.91:1</span>
                          </button>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                            <button
                              className="sc-btn sc-btn-secondary"
                              onClick={() => {
                                const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                                const { canvasWidth, canvasHeight } = getActualCanvasDimensions();
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { 
                                    ...prev[selectedElementId], 
                                    x: 0,
                                    y: 0,
                                    width: canvasWidth, 
                                    height: canvasHeight 
                                  }
                                }));
                                saveToHistory();
                              }}
                              title="Fill entire canvas"
                            >
                              Fill Canvas
                            </button>
                            <button
                              className="sc-btn sc-btn-secondary"
                              onClick={() => {
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { 
                                    ...prev[selectedElementId], 
                                    width: 200, 
                                    height: 150 
                                  }
                                }));
                                saveToHistory();
                              }}
                              title="Reset to default size"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                      </>
                      )}
                      </div>
                      
                      {/* Rotation Section - Collapsible */}
                      <div className="sc-inspector-section">
                        <div 
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => setPanelCollapsed(prev => ({ ...prev, rotation: !prev.rotation }))}
                        >
                          <span>ROTATION & OPACITY</span>
                          <span style={{ 
                            transform: panelCollapsed.rotation ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '10px'
                          }}>▼</span>
                        </div>
                        
                        {!panelCollapsed.rotation && (
                        <>
                      {/* Opacity */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">
                          Opacity
                          <span className="sc-property-value-badge">{Math.round(transform.opacity || 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={transform.opacity || 100}
                          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                          className="sc-slider"
                        />
                      </div>
                      
                      {/* Rotation */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">
                          Rotation
                          <span className="sc-property-value-badge">{Math.round(transform.rotation || 0)}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="-180" 
                          max="180" 
                          value={transform.rotation || 0}
                          onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
                          className="sc-slider"
                        />
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          {[-90, -45, 0, 45, 90, 180].map(angle => (
                            <button
                              key={angle}
                              onClick={() => {
                                setElementTransforms(prev => ({
                                  ...prev,
                                  [selectedElementId]: { ...prev[selectedElementId], rotation: angle }
                                }));
                                saveToHistory();
                              }}
                              style={{
                                flex: 1,
                                padding: '6px 4px',
                                background: (transform.rotation || 0) === angle ? '#3b82f6' : '#f3f4f6',
                                color: (transform.rotation || 0) === angle ? '#fff' : '#6b7280',
                                border: '1px solid',
                                borderColor: (transform.rotation || 0) === angle ? '#3b82f6' : '#e5e7eb',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: '600',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                if ((transform.rotation || 0) !== angle) {
                                  e.currentTarget.style.background = '#e5e7eb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if ((transform.rotation || 0) !== angle) {
                                  e.currentTarget.style.background = '#f3f4f6';
                                }
                              }}
                            >
                              {angle}°
                            </button>
                          ))}
                        </div>
                      </div>
                      </>
                      )}
                      </div>
                      
                      {/* Effects Section - Collapsible */}
                      <div className="sc-inspector-section">
                        <div 
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#9ca3af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => setPanelCollapsed(prev => ({ ...prev, effects: !prev.effects }))}
                        >
                          <span>EFFECTS & PROCESSING</span>
                          <span style={{ 
                            transform: panelCollapsed.effects ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '10px'
                          }}>▼</span>
                        </div>
                        
                        {!panelCollapsed.effects && (
                        <>
                      {/* Layer Controls */}
                      <div className="sc-property-group">
                        <div className="sc-property-label">Layer Order</div>
                        <div className="sc-layer-control-buttons">
                          <button 
                            className="sc-btn sc-btn-secondary" 
                            title="Bring Forward"
                            onClick={() => handleBringForward(selectedElementId)}
                          >
                            ⬆️ Bring Forward
                          </button>
                          <button 
                            className="sc-btn sc-btn-secondary" 
                            title="Send Backward"
                            onClick={() => handleSendBackward(selectedElementId)}
                          >
                            ⬇️ Send Backward
                          </button>
                        </div>
                      </div>
                      
                      {/* Asset Processing (Background Removal) */}
                      {element?.type === 'asset' && (
                        <div className="sc-property-group">
                          <div className="sc-property-label" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#8b5cf6' }}>
                            🎨 Asset Processing
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {processingStatus[element.id]?.bg_removed || element.has_bg_removed ? (
                              <div style={{ 
                                padding: '8px 12px', 
                                background: '#10b981', 
                                color: 'white', 
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                textAlign: 'center'
                              }}>
                                ✅ Background Removed
                              </div>
                            ) : (
                              <button
                                className="sc-btn sc-btn-secondary"
                                onClick={() => handleRemoveBackground(element.id)}
                                disabled={processingAsset?.assetId === element.id}
                                style={{ 
                                  background: processingAsset?.assetId === element.id ? '#9ca3af' : '#8b5cf6',
                                  color: 'white',
                                  border: 'none'
                                }}
                                title="Remove background from this asset"
                              >
                                {processingAsset?.assetId === element.id ? (
                                  <>⏳ Processing...</>
                                ) : (
                                  <>🎨 Remove Background</>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Reset and Delete Buttons */}
                      <div className="sc-layer-actions">
                        <button 
                          className="sc-btn-reset"
                          onClick={() => {
                            setElementTransforms(prev => {
                              const newTransforms = { ...prev };
                              delete newTransforms[selectedElementId];
                              return newTransforms;
                            });
                            saveToHistory();
                          }}
                        >
                          🔄 Reset Transform
                        </button>
                        <button 
                          className="sc-btn sc-btn-danger"
                          onClick={() => handleDeleteLayer(selectedElementId)}
                        >
                          🗑️ Delete Layer
                        </button>
                      </div>
                      </>
                      )}
                      </div>
                    </>
                  );
                })()}
                
                {/* Selected Items Summary */}
                <div className="sc-inspector-section" style={{
                  borderTop: '2px solid #e5e7eb',
                  paddingTop: '16px',
                  marginTop: '16px'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px'
                  }}>Timeline Summary</div>
                  <div className="sc-inspector-stats">
                    <div className="sc-stat">
                      <span className="sc-stat-label">🎬 Scenes:</span>
                      <span className="sc-stat-value">{selectedScenes.length}</span>
                    </div>
                    <div className="sc-stat">
                      <span className="sc-stat-label">🎨 Assets:</span>
                      <span className="sc-stat-value">{selectedAssets.length}</span>
                    </div>
                    <div className="sc-stat">
                      <span className="sc-stat-label">👗 Wardrobe:</span>
                      <span className="sc-stat-value">{selectedWardrobes.length}</span>
                    </div>
                  </div>
                </div>

                {selectedScenes.length > 0 && (
                  <div className="sc-inspector-section" style={{
                    borderTop: '2px solid #e5e7eb',
                    paddingTop: '16px',
                    marginTop: '16px'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '12px'
                    }}>Scene Roles</div>
                    <div className="sc-role-list">
                      {selectedScenes.map(item => (
                        <div key={item.scene.id} className="sc-role-item">
                          <div className="sc-role-item-info">
                            <div className="sc-role-item-name">
                              {item.scene.title || `Scene ${item.scene.scene_number}`}
                            </div>
                            <select 
                              className="sc-role-select"
                              value={item.role}
                              onChange={(e) => handleChangeRole(item, 'scene', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {SCENE_ROLES.map(role => (
                                <option key={role.id} value={role.id}>
                                  {role.icon} {role.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAssets.length > 0 && (
                  <div className="sc-inspector-section" style={{
                    borderTop: '2px solid #e5e7eb',
                    paddingTop: '16px',
                    marginTop: '16px'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '12px'
                    }}>Asset Roles</div>
                    <div className="sc-role-list">
                      {selectedAssets.map(item => (
                        <div key={item.asset.id} className="sc-role-item">
                          <div className="sc-role-item-info">
                            <div className="sc-role-item-name">{item.asset.name}</div>
                            <select 
                              className="sc-role-select"
                              value={item.role}
                              onChange={(e) => handleChangeRole(item, 'asset', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ASSET_ROLES.map(role => (
                                <option key={role.id} value={role.id}>
                                  {role.icon} {role.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sc-inspector-section">
                  <h4 className="sc-inspector-heading">Export Settings</h4>
                  <div className="sc-format-list">
                    <label className="sc-format-option">
                      <input type="checkbox" />
                      <span>📺 YouTube (16:9)</span>
                    </label>
                    <label className="sc-format-option">
                      <input type="checkbox" />
                      <span>📱 Instagram (1:1)</span>
                    </label>
                    <label className="sc-format-option">
                      <input type="checkbox" />
                      <span>🎵 TikTok (9:16)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Create Composition Dialog */}
      {showCreateDialog && ReactDOM.createPortal(
        <div 
          className="sc-dialog-overlay" 
          onClick={handleCancelCreate}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '2rem'
          }}
        >
          <div 
            className="sc-dialog" 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              zIndex: 1000000,
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              minWidth: '450px',
              maxWidth: '550px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="sc-dialog-header">
              <h3 className="sc-dialog-title">✨ Create New Composition</h3>
              <button 
                className="sc-dialog-close"
                onClick={handleCancelCreate}
                title="Close"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="sc-dialog-body">
              <div className="sc-form-group">
                <label htmlFor="composition-name">Composition name</label>
                <input
                  id="composition-name"
                  type="text"
                  value={newCompositionName}
                  onChange={(e) => setNewCompositionName(e.target.value)}
                  placeholder="Main Edit, YouTube Version, Instagram Cut..."
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newCompositionName.trim()) {
                      handleConfirmCreate();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleCancelCreate();
                    }
                  }}
                />
                <div className="sc-keyboard-hint">
                  <span>Press <kbd>Enter</kbd> to create or <kbd>Esc</kbd> to cancel</span>
                </div>
              </div>
            </div>
            <div className="sc-dialog-footer">
              <button 
                className="sc-btn sc-btn-secondary"
                onClick={handleCancelCreate}
              >
                Cancel
              </button>
              <button 
                className="sc-btn sc-btn-primary"
                onClick={handleConfirmCreate}
                disabled={!newCompositionName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}

      {/* Scene Role Selection Dialog */}
      {pendingScene && ReactDOM.createPortal(
        <div 
          className="sc-dialog-overlay" 
          onClick={() => setPendingScene(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div 
            className="sc-dialog" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15)',
              minWidth: '480px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="sc-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="sc-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Select Scene Role</h3>
              <button 
                className="sc-dialog-close"
                onClick={() => setPendingScene(null)}
                title="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#6b7280',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ✕
              </button>
            </div>
            <div className="sc-dialog-body" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                How will this scene be used in your composition?
              </p>
              <div className="sc-role-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {SCENE_ROLES.map(role => (
                  <button
                    key={role.id}
                    className="sc-role-card"
                    onClick={() => handleRoleSelect('scene', role.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = role.color;
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{role.icon}</span>
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>{role.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{role.hint}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}

      {/* Asset Role Selection Dialog */}
      {pendingAsset && ReactDOM.createPortal(
        <div 
          className="sc-dialog-overlay" 
          onClick={() => setPendingAsset(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div 
            className="sc-dialog" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15)',
              minWidth: '480px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="sc-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="sc-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Select Asset Role</h3>
              <button 
                className="sc-dialog-close"
                onClick={() => setPendingAsset(null)}
                title="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#6b7280',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ✕
              </button>
            </div>
            <div className="sc-dialog-body" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                How will this asset be used in your composition?
              </p>
              <div className="sc-role-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {ASSET_ROLES.map(role => (
                  <button
                    key={role.id}
                    className="sc-role-card"
                    onClick={() => handleRoleSelect('asset', role.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = role.color;
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{role.icon}</span>
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>{role.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{role.hint}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}

      {/* Wardrobe Role Selection Dialog */}
      {pendingWardrobe && ReactDOM.createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '2rem'
          }}
          onClick={() => setPendingWardrobe(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#111827'
              }}>
                Select Wardrobe Role
              </h3>
              <button
                onClick={() => setPendingWardrobe(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#6b7280',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                  {pendingWardrobe.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {pendingWardrobe.type} · {pendingWardrobe.character || 'Character'}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(1, 1fr)',
                gap: '0.75rem'
              }}>
                {WARDROBE_ROLES.map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect('wardrobe', role.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = role.color;
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{role.icon}</span>
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>{role.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{role.hint}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}
    </div>
  );
}






