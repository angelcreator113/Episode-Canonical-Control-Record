import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import TimelineRuler from './TimelineRuler';
import { SortableTimelineScene } from './SortableTimelineScene';
import AssetOverlay from './AssetOverlay';
import TimelineLibraryPanel from './Timeline/TimelineLibraryPanel';
import TimelinePlacementTrack from './Timeline/TimelinePlacementTrack';
import TimelineInspectorPanel from './Timeline/TimelineInspectorPanel';
import TimelineLanes from './Timeline/TimelineLanes';
import CanvasEditor from './Timeline/CanvasEditor';
import TimelineModeBar from './Timeline/TimelineModeBar';
import TimelineContextPanel from './Timeline/TimelineContextPanel';
import TimelinePlayhead, { TimelinePlayheadLine } from './Timeline/TimelinePlayhead';
import KeyboardShortcutsModal from './Timeline/KeyboardShortcutsModal';
import ToolDock from './Timeline/ToolDock';
import ExportModal from './Timeline/ExportModal';
import KeyframePanel from './Timeline/KeyframePanel';
import { ToastContainer } from './Timeline/ToastNotification';
import sceneService from '../services/sceneService';
import episodeAssetsService from '../services/episodeAssetsService';
import timelinePlacementsService from '../services/timelinePlacementsService';
import './Timeline.css';

/**
 * Video Editor Component - Professional video editing interface
 * Multi-track editing with drag/drop, snapping, effects, and export
 * Features: playback controls, cut/split tools, transitions, keyframes
 */
const Timeline = ({ episodeId, composition }) => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [zoom, setZoom] = useState(100); // Zoom percentage
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [assets, setAssets] = useState([]); // OLD: For AssetOverlay
  const [showAssets, setShowAssets] = useState(true); // OLD: Toggle asset overlay
  const [currentTime, setCurrentTime] = useState(0); // NEW: Current playback time
  const [compositionLoaded, setCompositionLoaded] = useState(false);
  
  // NEW: Timeline placement system
  const [libraryAssets, setLibraryAssets] = useState([]); // Episode library assets
  const [placements, setPlacements] = useState([]); // Timeline placements
  const [activeToolTab, setActiveToolTab] = useState('assets'); // Tool Dock active tab
  const [showContextPanel, setShowContextPanel] = useState(true); // Context panel visibility - OPEN by default
  const [showPreviewPanel, setShowPreviewPanel] = useState(true); // Preview panel visibility
  const [selectedScene, setSelectedScene] = useState(null); // Selected scene for inspector
  const [selectedPlacement, setSelectedPlacement] = useState(null); // Selected placement for inspector
  
  // Layout state
  const [previewLayout, setPreviewLayout] = useState('default'); // 'hidden', 'default', 'split', 'maximized'
  const [headerPinned, setHeaderPinned] = useState(true); // Header pin state
  const [headerVisible, setHeaderVisible] = useState(true); // Header visibility (auto-hide)
  const [lastScrollY, setLastScrollY] = useState(0);

  // NEW: History/Undo system
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // NEW: Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackIntervalRef = useRef(null);

  // NEW: Keyboard shortcuts modal
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // NEW: Snapping
  const [snapEnabled, setSnapEnabled] = useState(true);
  const SNAP_THRESHOLD = 0.5; // seconds

  // NEW: Multi-select
  const [selectedPlacements, setSelectedPlacements] = useState(new Set());
  const [isMultiSelecting, setIsMultiSelecting] = useState(false);

  // NEW: Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, asset, wardrobe, audio
  const [visibleTracks, setVisibleTracks] = useState(new Set(['scenes', 'placements']));

  // NEW: Toast notifications
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // VIDEO EDITOR: Tools & Features
  const [activeTool, setActiveTool] = useState('select'); // select, razor, trim
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.25, 0.5, 1, 1.5, 2
  const [showExportModal, setShowExportModal] = useState(false);
  const [showKeyframePanel, setShowKeyframePanel] = useState(false);
  const [volume, setVolume] = useState(100); // Master volume
  const [showWaveforms, setShowWaveforms] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [markers, setMarkers] = useState([]); // Timeline markers
  const [trackHeight, setTrackHeight] = useState('normal'); // compact, normal, expanded
  const [timelineZoom, setTimelineZoom] = useState(1); // 0.5, 1, 2, 4
  
  // LAYER SYSTEM: Dynamic layers instead of fixed tracks
  const [layers, setLayers] = useState([
    { id: 1, name: 'Layer 1', color: '#3b82f6', muted: false, locked: false }, // Background
    { id: 2, name: 'Layer 2', color: '#10b981', muted: false, locked: false },
    { id: 3, name: 'Layer 3', color: '#f59e0b', muted: false, locked: false },
    { id: 4, name: 'Layer 4', color: '#8b5cf6', muted: false, locked: false },
  ]);

  // Handle layer updates
  const handleLayerUpdate = async (action, data) => {
    if (action === 'reorder') {
      // Reorder layers array
      setLayers(data);
    } else if (action === 'delete') {
      // Delete layer and move clips to Layer 1
      const layerId = data;
      setLayers(prev => prev.filter(l => l.id !== layerId));
      
      // Move all clips from deleted layer to Layer 1
      const clipsToMove = [...scenes.filter(s => s.layer_id === layerId), ...placements.filter(p => p.layer_id === layerId)];
      for (const clip of clipsToMove) {
        if (clip.type === 'scene' || !clip.type) {
          await sceneService.updateScene(clip.id, { layer_id: 1 });
        } else {
          await timelinePlacementsService.updatePlacement(episodeId, clip.id, { layer_id: 1 });
        }
      }
      loadScenes();
      loadPlacements();
    } else if (action === 'moveClip') {
      // Move clip to different layer
      const { clipId, clipType, targetLayerId } = data;
      if (clipType === 'scene') {
        await sceneService.updateScene(clipId, { layer_id: targetLayerId });
        loadScenes();
      } else {
        await timelinePlacementsService.updatePlacement(episodeId, clipId, { layer_id: targetLayerId });
        loadPlacements();
      }
      showToast('Clip moved to ' + layers.find(l => l.id === targetLayerId)?.name);
    } else if (action === null) {
      // Add new layer
      setLayers(prev => [...prev, data]);
    } else {
      // Update layer properties
      setLayers(prev => prev.map(l => l.id === action ? { ...l, ...data } : l));
    }
  };

  // Configure drag sensors with activation constraint to prevent clicks from triggering drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement to activate drag
      },
    })
  );

  // Calculate total episode duration - AUTO-EXPAND from all clips across ALL tracks
  const totalDuration = React.useMemo(() => {
    let maxEndTime = 0;
    
    // Check scene clips (Video track) - using absolute start_time_seconds
    scenes.forEach((scene) => {
      const startTime = scene.start_time_seconds || 0;
      const duration = scene.duration_seconds || 0;
      const endTime = startTime + duration;
      if (endTime > maxEndTime) maxEndTime = endTime;
    });
    
    // Check all placements (Overlays, Voice, Music, SFX)
    placements.forEach(placement => {
      const startTime = placement.start_time_seconds || 0;
      const duration = placement.duration_seconds || placement.duration || 0;
      const endTime = startTime + duration;
      if (endTime > maxEndTime) maxEndTime = endTime;
    });
    
    // Add buffer: minimum 10s, add 2s tail padding for easy drop-at-end UX
    const withBuffer = Math.max(10, maxEndTime + 2);
    return withBuffer;
  }, [scenes, placements]);

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if editing input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Check for modifier keys
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Handle special keys first
      if (e.key === '?' && !ctrl && !shift && !alt) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
        setSelectedPlacements(new Set());
        setSelectedPlacement(null);
        return;
      }

      // Undo/Redo
      if (ctrl && e.key === 'z' && !shift) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && shift))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Copy/Paste/Cut
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (ctrl && e.key === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      // Select All/Deselect
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        setSelectedPlacements(new Set());
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPlacements.size > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // Playback
      if (e.key === ' ' && !ctrl && !shift) {
        e.preventDefault();
        handlePlayPause();
        return;
      }
      if (e.key === 'Home') {
        handleSeek(0);
        return;
      }
      if (e.key === 'End') {
        handleSeek(totalDuration);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepBackward();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepForward();
        return;
      }

      // Zoom
      if (e.key === '+' || e.key === '=') {
        handleZoomIn();
        return;
      }
      if (e.key === '-' || e.key === '_') {
        handleZoomOut();
        return;
      }
      if (e.key === '0' && !ctrl) {
        handleZoomReset();
        return;
      }

      // Panel toggles
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowContextPanel(prev => !prev);
        return;
      }
      if (e.key === '`') {
        e.preventDefault();
        setShowPreviewPanel(prev => !prev);
        return;
      }

      // Export
      if (ctrl && e.key === 'e') {
        e.preventDefault();
        handleExportTimeline();
        return;
      }

      // Save
      if (ctrl && e.key === 's') {
        e.preventDefault();
        showToast('Timeline auto-saves', 'info');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editingSceneId, selectedPlacements, canUndo, canRedo, isPlaying, scenes]);

  // Auto-hide header on vertical scroll
  useEffect(() => {
    if (headerPinned) return;

    const handleScroll = (e) => {
      const scrollContainer = e.target;
      if (!scrollContainer.classList.contains('timeline-scroll-area')) return;
      
      const currentScrollY = scrollContainer.scrollTop;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down & past threshold - hide header
        setHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show header
        setHeaderVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    // Listen on document for bubbled scroll events
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', handleScroll, { capture: true });
  }, [headerPinned, lastScrollY]);

  // Show header on hover near top (desktop only)
  useEffect(() => {
    if (headerPinned || headerVisible) return;

    const handleMouseMove = (e) => {
      if (e.clientY < 100 && window.innerWidth >= 768) {
        setHeaderVisible(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [headerPinned, headerVisible]);

  // Simulate playback time updates (placeholder until video player integrated)
  useEffect(() => {
    // This will be replaced with actual video player time updates
    // For now, currentTime only updates on seek
    return () => {};
  }, [currentTime]);

  // Load scenes
  useEffect(() => {
    if (episodeId) {
      loadScenes();
      loadAssets();
      loadLibraryAssets(); // NEW
      loadPlacements(); // NEW
    }
  }, [episodeId]);

  const loadScenes = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await sceneService.getEpisodeScenes(episodeId);
      // Response structure: { success, data: [...], count, ... }
      let scenesData = response.data || [];
      
      // Transform: calculate duration from trim values or use explicit duration
      scenesData = scenesData.map(scene => {
        const libraryScene = scene.libraryScene;
        const isImage = libraryScene?.mime_type?.startsWith('image/');
        const hasVideo = libraryScene?.id;
        
        let calculatedDuration;
        
        if (!hasVideo) {
          // Empty scene - use explicit duration or default
          calculatedDuration = scene.duration_seconds || 30;
        } else if (isImage) {
          // Image - use explicit duration (default 5s)
          calculatedDuration = scene.duration_seconds || 5.0;
        } else {
          // Video - calculate from trim values
          const trimStart = scene.trim_start || 0;
          const trimEnd = scene.trim_end || libraryScene?.duration_seconds || 30;
          calculatedDuration = trimEnd - trimStart;
        }
        
        return {
          ...scene,
          // Flatten common properties from libraryScene
          title: scene.libraryScene?.title || scene.title || 'Untitled Scene',
          duration_seconds: calculatedDuration,
          thumbnail_url: scene.libraryScene?.thumbnail_url || scene.thumbnail_url,
          video_asset_url: scene.libraryScene?.video_asset_url || scene.video_asset_url,
          description: scene.libraryScene?.description || scene.description,
          // Keep original libraryScene for reference
          libraryScene: scene.libraryScene
        };
      });
      
      setScenes(scenesData);
      console.log('Loaded episode scenes:', scenesData.length, scenesData);
    } catch (error) {
      console.error('Error loading scenes:', error);
      setLoadError(error.message || 'Failed to load timeline scenes');
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      // Mock assets for now - replace with actual API call
      // const response = await assetService.getEpisodeAssets(episodeId);
      const mockAssets = [
        {
          id: '1',
          name: 'Lala Promo',
          type: 'PROMO_LALA',
          start_time: 0,
          url: '/assets/lala-promo.png'
        },
        {
          id: '2',
          name: 'Guest Intro',
          type: 'PROMO_GUEST',
          start_time: 120,
          url: '/assets/guest-promo.png'
        },
        {
          id: '3',
          name: 'Brand Logo',
          type: 'BRAND_LOGO',
          start_time: 300,
          url: '/assets/brand-logo.png'
        }
      ];
      setAssets(mockAssets);
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  // NEW: Load episode library assets
  const loadLibraryAssets = async () => {
    try {
      const response = await episodeAssetsService.listEpisodeAssets(episodeId);
      setLibraryAssets(response.data || []);
    } catch (error) {
      console.error('Error loading library assets:', error);
    }
  };

  // NEW: Load timeline placements
  const loadPlacements = async () => {
    try {
      const response = await timelinePlacementsService.listPlacements(episodeId);
      setPlacements(response.data || []);
    } catch (error) {
      console.error('Error loading placements:', error);
    }
  };

  // Load composition data when provided
  useEffect(() => {
    if (!composition || compositionLoaded || scenes.length === 0) return;
    
    console.log('📦 Loading composition into timeline:', composition);
    
    // If composition has scenes, ensure they're loaded in timeline
    if (composition.scenes && Array.isArray(composition.scenes) && composition.scenes.length > 0) {
      console.log('📦 Composition has', composition.scenes.length, 'scenes');
      
      // Filter scenes that exist in timeline
      const compositionScenes = composition.scenes
        .map(cs => scenes.find(s => s.id === cs.scene_id))
        .filter(Boolean);
      
      console.log('📦 Found', compositionScenes.length, 'matching scenes in timeline');
      
      // Show toast notification
      if (compositionScenes.length > 0) {
        showToast(`Loaded composition "${composition.name}" with ${compositionScenes.length} scenes`);
      }
    }
    
    // If composition has assets, load them as placements
    if (composition.assets && Array.isArray(composition.assets) && composition.assets.length > 0) {
      console.log('📦 Composition has', composition.assets.length, 'assets');
      // Note: Assets would need to be created as placements if they don't exist yet
      // This would require additional API integration
    }
    
    setCompositionLoaded(true);
  }, [composition, scenes, compositionLoaded]);

  // Handle zoom
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 400));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleZoomReset = () => {
    setZoom(100);
  };

  const handleZoomToFit = () => {
    setZoom(50);
  };

  const handleZoomToMax = () => {
    setZoom(400);
  };

  // Handle timeline seeking
  const handleSeek = (time) => {
    const newTime = Math.max(0, Math.min(time, totalDuration));
    setCurrentTime(newTime);
    // TODO: Update video player position when preview component is integrated
  };

  // Toast notification helper
  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // History/Undo system
  const saveToHistory = useCallback((action) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      action,
      timestamp: Date.now(),
      scenes: JSON.parse(JSON.stringify(scenes)),
      placements: JSON.parse(JSON.stringify(placements)),
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCanUndo(true);
    setCanRedo(false);
  }, [history, historyIndex, scenes, placements]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setScenes(state.scenes);
      setPlacements(state.placements);
      setHistoryIndex(newIndex);
      setCanUndo(newIndex > 0);
      setCanRedo(true);
      showToast(`Undid: ${state.action}`, 'info', 2000);
    }
  }, [history, historyIndex, showToast]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setScenes(state.scenes);
      setPlacements(state.placements);
      setHistoryIndex(newIndex);
      setCanUndo(true);
      setCanRedo(newIndex < history.length - 1);
      showToast(`Redid: ${state.action}`, 'info', 2000);
    }
  }, [history, historyIndex, showToast]);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
    showToast(isPlaying ? 'Paused' : 'Playing', 'info', 1000);
  }, [isPlaying, showToast]);

  const handleStepForward = useCallback(() => {
    const frameTime = 1 / 30; // 30fps
    handleSeek(currentTime + frameTime);
  }, [currentTime]);

  const handleStepBackward = useCallback(() => {
    const frameTime = 1 / 30; // 30fps
    handleSeek(currentTime - frameTime);
  }, [currentTime]);

  // VIDEO EDITOR: Razor/Split Tool
  const handleSplitClipAtPlayhead = useCallback(async () => {
    const clipToSplit = scenes.find(scene => {
      const start = scene.start_time_seconds || 0;
      const duration = scene.manual_duration_seconds || scene.duration_seconds || 0;
      return currentTime >= start && currentTime <= start + duration;
    });

    if (!clipToSplit) {
      showToast('No clip at playhead to split', 'warning');
      return;
    }

    try {
      const splitTime = currentTime - (clipToSplit.start_time_seconds || 0);
      const originalDuration = clipToSplit.manual_duration_seconds || clipToSplit.duration_seconds || 0;
      
      // Update first clip duration
      await sceneService.updateScene(clipToSplit.id, {
        manual_duration_seconds: splitTime
      });

      // Create second clip
      await sceneService.createScene(episodeId, {
        scene_library_id: clipToSplit.scene_library_id,
        start_time_seconds: currentTime,
        manual_duration_seconds: originalDuration - splitTime,
        scene_order: clipToSplit.scene_order + 0.5
      });

      await loadScenes();
      showToast('Clip split successfully', 'success');
      saveToHistory('Split clip');
    } catch (error) {
      console.error('Error splitting clip:', error);
      showToast('Failed to split clip', 'error');
    }
  }, [scenes, currentTime, episodeId, showToast, saveToHistory]);

  // VIDEO EDITOR: Speed controls
  const handleChangeSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
    showToast(`Playback speed: ${speed}x`, 'info', 1500);
  }, [showToast]);

  // VIDEO EDITOR: Markers
  const handleAddMarker = useCallback(() => {
    const newMarker = {
      id: Date.now().toString(),
      time: currentTime,
      label: `Marker ${markers.length + 1}`,
      color: '#3b82f6'
    };
    setMarkers(prev => [...prev, newMarker]);
    showToast('Marker added', 'success', 1500);
  }, [currentTime, markers.length, showToast]);

  const handleDeleteMarker = useCallback((markerId) => {
    setMarkers(prev => prev.filter(m => m.id !== markerId));
    showToast('Marker deleted', 'success', 1500);
  }, [showToast]);

  // VIDEO EDITOR: Export/Render
  const handleExport = useCallback(async (settings) => {
    showToast('Starting export...', 'info', 2000);
    setShowExportModal(false);
    
    try {
      // TODO: Implement actual export API call
      const response = await fetch(`/api/v1/episodes/${episodeId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: settings.format,
          quality: settings.quality,
          resolution: settings.resolution,
          scenes: scenes.map(s => s.id),
          placements: placements.map(p => p.id)
        })
      });
      
      if (response.ok) {
        showToast('Export started! Check status in notifications.', 'success', 5000);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed. Please try again.', 'error');
    }
  }, [episodeId, scenes, placements, showToast]);

  // VIDEO EDITOR: Effects
  const handleApplyEffect = useCallback(async (effectType, effectSettings) => {
    if (selectedPlacements.size === 0 && !selectedScene) {
      showToast('Select a clip to apply effects', 'warning');
      return;
    }

    try {
      // Apply to selected scene or placements
      if (selectedScene) {
        await sceneService.updateScene(selectedScene.id, {
          effects: { ...selectedScene.effects, [effectType]: effectSettings }
        });
      }
      
      for (const placementId of selectedPlacements) {
        const placement = placements.find(p => p.id === placementId);
        if (placement) {
          await timelinePlacementsService.updatePlacement(episodeId, placementId, {
            effects: { ...placement.effects, [effectType]: effectSettings }
          });
        }
      }

      await loadScenes();
      await loadPlacements();
      showToast(`${effectType} applied`, 'success');
      saveToHistory(`Apply ${effectType}`);
    } catch (error) {
      console.error('Error applying effect:', error);
      showToast('Failed to apply effect', 'error');
    }
  }, [selectedScene, selectedPlacements, placements, episodeId, showToast, saveToHistory]);

  // VIDEO EDITOR: Transitions
  const handleAddTransition = useCallback(async (transitionType, duration = 1) => {
    if (!selectedScene) {
      showToast('Select a scene to add transition', 'warning');
      return;
    }

    try {
      await sceneService.updateScene(selectedScene.id, {
        transition_out: {
          type: transitionType,
          duration: duration
        }
      });

      await loadScenes();
      showToast(`${transitionType} transition added`, 'success');
      saveToHistory(`Add ${transitionType} transition`);
    } catch (error) {
      console.error('Error adding transition:', error);
      showToast('Failed to add transition', 'error');
    }
  }, [selectedScene, showToast, saveToHistory]);

  // Playback loop effect
  useEffect(() => {
    if (isPlaying && currentTime < totalDuration) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.033; // ~30fps
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }, 33);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, totalDuration]);

  // Multi-select handlers
  const handleSelectAll = useCallback(() => {
    const allIds = new Set(placements.map(p => p.id));
    setSelectedPlacements(allIds);
    showToast(`Selected ${allIds.size} placements`, 'info', 2000);
  }, [placements, showToast]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedPlacements.size === 0) return;
    
    const count = selectedPlacements.size;
    if (!window.confirm(`Delete ${count} selected placement(s)?`)) return;

    try {
      for (const id of selectedPlacements) {
        await timelinePlacementsService.deletePlacement(episodeId, id);
      }
      await loadPlacements();
      setSelectedPlacements(new Set());
      showToast(`Deleted ${count} placement(s)`, 'success');
      saveToHistory(`Delete ${count} placements`);
    } catch (error) {
      console.error('Error deleting placements:', error);
      showToast('Failed to delete placements', 'error');
    }
  }, [selectedPlacements, episodeId, showToast, saveToHistory]);

  // Copy/Paste handlers (simplified)
  const copiedDataRef = useRef(null);

  const handleCopy = useCallback(() => {
    if (selectedPlacements.size === 0) return;
    const toCopy = placements.filter(p => selectedPlacements.has(p.id));
    copiedDataRef.current = JSON.parse(JSON.stringify(toCopy));
    showToast(`Copied ${toCopy.length} placement(s)`, 'info');
  }, [selectedPlacements, placements, showToast]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDeleteSelected();
  }, [handleCopy, handleDeleteSelected]);

  const handlePaste = useCallback(async () => {
    if (!copiedDataRef.current || copiedDataRef.current.length === 0) {
      showToast('Nothing to paste', 'warning');
      return;
    }

    try {
      const newPlacements = [];
      for (const placement of copiedDataRef.current) {
        const { id, created_at, updated_at, ...data } = placement;
        const response = await timelinePlacementsService.createPlacement(episodeId, data);
        newPlacements.push(response.data);
      }
      await loadPlacements();
      showToast(`Pasted ${newPlacements.length} placement(s)`, 'success');
      saveToHistory(`Paste ${newPlacements.length} placements`);
    } catch (error) {
      console.error('Error pasting:', error);
      showToast('Failed to paste', 'error');
    }
  }, [episodeId, showToast, saveToHistory]);

  // Snapping helper
  const snapToNearestPoint = useCallback((time) => {
    if (!snapEnabled) return time;

    // Get all snap points (scene boundaries, other placements, playhead)
    const snapPoints = [];
    
    // Scene boundaries
    let accumulatedTime = 0;
    scenes.forEach(scene => {
      snapPoints.push(accumulatedTime); // Scene start
      accumulatedTime += scene.duration_seconds || 0;
      snapPoints.push(accumulatedTime); // Scene end
    });

    // Playhead
    snapPoints.push(currentTime);

    // Find closest snap point
    let closest = time;
    let minDist = SNAP_THRESHOLD;
    
    for (const point of snapPoints) {
      const dist = Math.abs(time - point);
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    }

    return closest;
  }, [snapEnabled, scenes, currentTime, SNAP_THRESHOLD]);

  // Scene duration edit
  const handleEditDuration = async (sceneId, newDuration) => {
    try {
      await sceneService.updateScene(sceneId, {
        duration_seconds: newDuration
      });
      await loadScenes(); // Reload to get updated data
      setEditingSceneId(null);
    } catch (error) {
      console.error('Error updating scene duration:', error);
      alert('Failed to update scene duration');
    }
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // NEW: Handle dropping library asset onto scene or lane
  const handleLibraryDrop = async (active, over) => {
    console.log('handleLibraryDrop called with:', { activeId: active.id, overId: over.id, overData: over.data?.current });
    
    const dragData = active.data.current;
    const draggedItem = dragData.item;
    const overData = over.data?.current;
    
    // Check if dropped onto a lane (not a specific scene)
    if (overData?.type === 'lane') {
      console.log('Dropped onto lane:', overData.laneId);
      const laneId = overData.laneId;
      
      // Validate drop compatibility
      const asset = draggedItem;
      const assetType = asset.asset_type || asset.type;
      const dragType = dragData.type;
      
      // Type validation
      let isValid = false;
      if (dragType === 'library-asset') {
        if (assetType === 'video' || assetType === 'image') {
          isValid = laneId === 'video' || laneId === 'overlays';
        } else if (assetType === 'audio') {
          isValid = ['voice', 'music', 'sfx'].includes(laneId);
        }
      } else if (dragType === 'wardrobe-item') {
        isValid = laneId === 'overlays';
      }
      
      if (!isValid) {
        showToast(`Cannot drop ${assetType || 'this item'} on ${overData.laneTitle} track`, 'error');
        return;
      }
      
      // Need to create placement on the first scene or show an error
      if (scenes.length === 0) {
        showToast('Add at least one scene before adding overlays/assets', 'error');
        return;
      }
      
      // Use first scene as default
      const scene = scenes[0];
      
      // Determine visual_role based on lane
      let visualRole = 'overlay';
      let audioRole = null;
      
      if (laneId === 'primary') {
        visualRole = 'primary-visual';
      } else if (laneId === 'overlays') {
        visualRole = 'overlay';
      } else if (laneId === 'voice') {
        audioRole = 'voice';
        visualRole = null;
      } else if (laneId === 'music') {
        audioRole = 'music';
        visualRole = null;
      } else if (laneId === 'sfx') {
        audioRole = 'sfx';
        visualRole = null;
      }
      
      // Create placement on the lane
      const placementType = dragData.type === 'wardrobe-item' ? 'wardrobe' : 'asset';
      
      try {
        const placementData = {
          placementType: placementType,
          sceneId: scene.id,
          attachmentPoint: 'scene-start',
          offsetSeconds: 0,
          trackNumber: 2,
        };
        
        if (visualRole) placementData.visualRole = visualRole;
        if (audioRole) placementData.audioRole = audioRole;

        if (placementType === 'wardrobe') {
          placementData.wardrobeItemId = draggedItem.id;
          placementData.character = dragData.character || draggedItem.character;
        } else {
          placementData.assetId = draggedItem.id;
        }

        console.log('Creating placement on lane with data:', placementData);

        const response = await timelinePlacementsService.createPlacement(episodeId, placementData);
        
        // Add to local state
        setPlacements(prev => [...prev, response.data]);
        
        // Select the new placement
        setSelectedPlacement(response.data);
        setSelectedScene(scene);
        
        showToast(`${overData.laneTitle} clip created`, 'success');
        return;
      } catch (error) {
        console.error('Error creating placement on lane:', error);
        showToast(`Failed to create clip: ${error.message}`, 'error');
        return;
      }
    }
    
    // Extract scene ID from drop target (format: "scene-{id}")
    const sceneId = over.id.toString().replace('scene-', '');
    const scene = scenes.find(s => s.id === sceneId);
    
    console.log('Extracted sceneId:', sceneId, 'Found scene:', scene?.id);
    
    if (!scene) {
      console.error('Invalid drop target - no scene found');
      return;
    }
    
    // Check if this is a video/image being dropped onto an empty scene (set as primary)
    const isVideoOrImage = draggedItem?.mime_type?.startsWith('video/') || draggedItem?.mime_type?.startsWith('image/');
    const sceneHasNoPrimary = !scene.scene_library_id;
    
    if (isVideoOrImage && sceneHasNoPrimary) {
      console.log('Setting primary video for empty scene:', draggedItem);
      
      try {
        const isImage = draggedItem.mime_type?.startsWith('image/');
        const sourceDuration = draggedItem.duration_seconds || (isImage ? 5.0 : 30.0);
        
        // Update scene with primary video
        const updateData = {
          scene_library_id: draggedItem.scene_library_id || draggedItem.id,
          trim_start: 0.0,
          trim_end: sourceDuration,
          duration_seconds: isImage ? 5.0 : sourceDuration // Images default to 5s
        };
        
        await sceneService.updateScene(scene.id, updateData);
        
        // Reload scenes to show updated clip
        await loadScenes();
        
        // Select the scene
        setSelectedScene(scene);
        
        showToast(`Primary video set for Scene ${scene.scene_order}`, 'success');
        
        return;
      } catch (error) {
        console.error('Error setting primary video:', error);
        showToast(`Failed to set primary video: ${error.message}`, 'error');
        return;
      }
    }
    
    // Otherwise, create a placement (overlay, wardrobe, etc.)
    const placementType = dragData.type === 'wardrobe-item' ? 'wardrobe' : 'asset';

    try {
      const placementData = {
        placementType: placementType,
        sceneId: sceneId,
        attachmentPoint: 'scene-start',
        offsetSeconds: 0,
        trackNumber: 2,
        visualRole: placementType === 'wardrobe' ? 'overlay' : 'primary-visual', // Smart default
      };

      if (placementType === 'wardrobe') {
        placementData.wardrobeItemId = dragData.item.id;
        placementData.character = dragData.character || dragData.item.character;
      } else {
        placementData.assetId = dragData.item.id;
      }

      console.log('Creating placement with data:', placementData);

      const response = await timelinePlacementsService.createPlacement(episodeId, placementData);
      
      // Add to local state
      setPlacements(prev => [...prev, response.data]);
      
      // Select the new placement
      setSelectedPlacement(response.data);
      setSelectedScene(scene);
      
      showToast('Placement created', 'success');
    } catch (error) {
      console.error('Error creating placement:', error);
      showToast(`Failed to place ${placementType}: ${error.message}`, 'error');
    }
  };

  // Calculate scene position (cumulative duration)
  const getScenePosition = (sceneIndex) => {
    return scenes.slice(0, sceneIndex).reduce((sum, scene) => {
      return sum + (scene.duration_seconds || 0);
    }, 0);
  };

  // Export timeline as JSON
  const handleExportTimeline = () => {
    const timelineData = {
      episode_id: episodeId,
      total_duration: totalDuration,
      exported_at: new Date().toISOString(),
      scenes: scenes.map((scene, index) => ({
        scene_number: scene.scene_number,
        id: scene.id,
        title: scene.title,
        scene_type: scene.scene_type,
        start_time: getScenePosition(index),
        duration_seconds: scene.duration_seconds,
        end_time: getScenePosition(index) + (scene.duration_seconds || 0),
      })),
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        start_time: asset.start_time,
      }))
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(timelineData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${episodeId}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Preview layout handlers
  const handlePreviewLayout = (layout) => {
    setPreviewLayout(layout);
    if (layout === 'hidden') {
      setShowPreviewPanel(false);
    } else if (layout === 'maximized') {
      setShowPreviewPanel(true);
      // Preview-only mode
    } else {
      setShowPreviewPanel(true);
    }
  };

  // Format time display
  const formatTimeDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle drag end - update clip positions
  const handleDragEnd = async (event) => {
    const { active, delta } = event;
    
    if (!active || !delta) return;
    
    const dragData = active.data.current;
    if (!dragData) return;
    
    // Calculate time delta from pixel delta
    // Timeline width scales with zoom, so we need to account for it
    const timelineWidth = window.innerWidth - 180; // Subtract track header width
    const zoomFactor = zoom / 100;
    const pixelToTimeRatio = (totalDuration / (timelineWidth * zoomFactor));
    const timeDelta = delta.x * pixelToTimeRatio;
    
    // Apply 10px snapping tolerance
    const snapThreshold = 10 * pixelToTimeRatio; // Convert 10px to time
    
    if (dragData.type === 'scene-clip') {
      // Scene clip drag
      const scene = dragData.scene;
      const currentStart = scene.start_time_seconds || 0;
      let newStart = currentStart + timeDelta;
      
      // Snap to playhead
      if (Math.abs(newStart - currentTime) < snapThreshold) {
        newStart = currentTime;
      }
      
      // Snap to other clip edges (VIDEO track only)
      for (const otherScene of scenes) {
        if (otherScene.id === scene.id) continue;
        const otherStart = otherScene.start_time_seconds || 0;
        const otherEnd = otherStart + (otherScene.effectiveDuration || 0);
        
        if (Math.abs(newStart - otherStart) < snapThreshold) {
          newStart = otherStart;
        } else if (Math.abs(newStart - otherEnd) < snapThreshold) {
          newStart = otherEnd;
        }
      }
      
      // Prevent negative time
      newStart = Math.max(0, newStart);
      
      // Update scene start_time_seconds
      try {
        console.log('Updating scene:', { sceneId: scene.id, newStart, scene });
        await sceneService.updateScene(scene.id, {
          start_time_seconds: newStart
        });
        
        // Update local state
        setScenes(prev => prev.map(s => 
          s.id === scene.id ? { ...s, start_time_seconds: newStart } : s
        ));
      } catch (error) {
        console.error('Error updating scene position:', error);
        console.error('Scene data:', scene);
        loadScenes(); // Reload on error
      }
    } else if (dragData.type === 'placement-clip') {
      // Placement drag (overlays, audio)
      const placement = dragData.placement;
      const currentStart = placement.start_time_seconds || 0;
      let newStart = currentStart + timeDelta;
      
      // Snap to playhead
      if (Math.abs(newStart - currentTime) < snapThreshold) {
        newStart = currentTime;
      }
      
      // Snap to scene boundaries
      for (const scene of scenes) {
        const sceneStart = scene.start_time_seconds || 0;
        const sceneEnd = sceneStart + (scene.effectiveDuration || 0);
        
        if (Math.abs(newStart - sceneStart) < snapThreshold) {
          newStart = sceneStart;
        } else if (Math.abs(newStart - sceneEnd) < snapThreshold) {
          newStart = sceneEnd;
        }
      }
      
      // Prevent negative time
      newStart = Math.max(0, newStart);
      
      // Update placement start_time_seconds
      try {
        await timelinePlacementsService.updatePlacement(episodeId, placement.id, {
          start_time_seconds: newStart
        });
        
        // Update local state
        setPlacements(prev => prev.map(p => 
          p.id === placement.id ? { ...p, start_time_seconds: newStart } : p
        ));
      } catch (error) {
        console.error('Error updating placement position:', error);
        loadPlacements(); // Reload on error
      }
    }
  };

  if (loading) {
    return (
      <div className="timeline-loading">
        <div className="spinner"></div>
        <p>Loading timeline...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="timeline-error">
        <div className="error-icon">⚠️</div>
        <h3>Failed to Load Timeline</h3>
        <p>{loadError}</p>
        <button onClick={() => loadScenes()} className="retry-btn">
          🔄 Retry
        </button>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="timeline-empty">
        <p>📽️ No scenes yet. Add scenes to see the timeline.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`timeline-container-wrapper layout-${previewLayout}`}>
        {/* Preview Panel - Top */}
        <div className={`timeline-preview-area preview-${previewLayout}`}>
          {previewLayout !== 'hidden' ? (
            <>
              <CanvasEditor
                scenes={scenes}
                placements={placements}
                selectedScene={selectedScene}
                selectedPlacement={selectedPlacement}
                currentTime={currentTime}
                totalDuration={totalDuration}
                isPlaying={isPlaying}
                onSeek={handleSeek}
                onPlayPause={handlePlayPause}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                onOverlaySelect={(overlay) => {
                  setSelectedPlacement(overlay);
                  const scene = scenes.find(s => s.id === overlay.scene_id);
                  if (scene) setSelectedScene(scene);
                }}
                onOverlayUpdate={async (overlayId, updates) => {
                  try {
                    const response = await timelinePlacementsService.updatePlacement(
                      episodeId,
                      overlayId,
                      updates
                    );
                    setPlacements(prev => prev.map(p => 
                      p.id === overlayId ? response.data : p
                    ));
                  } catch (error) {
                    console.error('Error updating overlay:', error);
                  }
                }}
              />
              {previewLayout === 'maximized' && (
                <button
                  onClick={() => handlePreviewLayout('default')}
                  className="back-to-edit-btn"
                >
                  ← Back to Edit
                </button>
              )}
            </>
          ) : (
            <div className="preview-collapsed-bar">
              <button
                onClick={() => handlePreviewLayout('default')}
                className="preview-restore-btn"
              >
                ▼ Show Preview
              </button>
            </div>
          )}
          
          {/* Timeline Scrubber for Preview-Only Mode */}
          {previewLayout === 'maximized' && totalDuration > 0 && (
            <div className="preview-scrubber">
              <div className="scrubber-track" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = (x / rect.width) * 100;
                handleSeek((percent / 100) * totalDuration);
              }}>
                <div 
                  className="scrubber-progress" 
                  style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
                />
                <div 
                  className="scrubber-handle"
                  style={{ left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
                />
              </div>
              <div className="scrubber-time">
                {formatTimeDisplay(currentTime)} / {formatTimeDisplay(totalDuration)}
              </div>
            </div>
          )}
        </div>

        {/* Central Playback Controls - Below Canvas */}
        {previewLayout !== 'maximized' && (
          <div className="central-playback-controls">
            <button
              className="playback-control-btn"
              onClick={handleStepBackward}
              title="Previous Frame (←)"
            >
              ⏮️
            </button>
            <button
              className="playback-control-btn play-pause-main"
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <button
              className="playback-control-btn"
              onClick={handleStepForward}
              title="Next Frame (→)"
            >
              ⏭️
            </button>
            <div className="playback-divider" />
            <div className="timecode-display-main">
              {formatTimeDisplay(currentTime)} / {formatTimeDisplay(totalDuration)}
            </div>
            <div className="playback-divider" />
            <div className="speed-controls-main">
              {[0.25, 0.5, 1, 1.5, 2].map(speed => (
                <button
                  key={speed}
                  className={`speed-btn-main ${playbackSpeed === speed ? 'active' : ''}`}
                  onClick={() => handleChangeSpeed(speed)}
                  title={`${speed}x speed`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Editor Area - Canvas + ToolDock + Timeline */}
        <div className={`timeline-main-area ${previewLayout === 'maximized' ? 'hidden' : ''}`}>
          
          {/* Tool Dock - Between Canvas and Timeline */}
          <ToolDock
            activeTab={activeToolTab}
            onTabChange={setActiveToolTab}
            libraryAssets={libraryAssets}
            onAssetUpdate={loadLibraryAssets}
            episodeId={episodeId}
          />

          {/* VIDEO EDITOR TOOLBAR */}
          <div className="video-editor-toolbar">
            {/* Left Section - Tools */}
            <div className="toolbar-section toolbar-left">
              <button
                className={`toolbar-btn tool-btn ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select Tool (V)"
              >
                <span>↖️</span>
                <span className="btn-label">Select</span>
              </button>
              <button
                className={`toolbar-btn tool-btn ${activeTool === 'razor' ? 'active' : ''}`}
                onClick={() => setActiveTool('razor')}
                title="Razor Tool (C)"
              >
                <span>✂️</span>
                <span className="btn-label">Razor</span>
              </button>
              {activeTool === 'razor' && (
                <button
                  className="toolbar-btn action-btn"
                  onClick={handleSplitClipAtPlayhead}
                  title="Split at Playhead"
                >
                  <span>🔪</span>
                  <span className="btn-label">Split</span>
                </button>
              )}
              <div className="toolbar-divider" />
              <button
                className="toolbar-btn"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <span>↶</span>
                <span className="btn-label">Undo</span>
              </button>
              <button
                className="toolbar-btn"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <span>↷</span>
                <span className="btn-label">Redo</span>
              </button>
            </div>

            {/* Center Section - Editing Actions */}
            <div className="toolbar-section toolbar-center">
              <button
                className="toolbar-btn"
                onClick={handleAddMarker}
                title="Add Marker (M)"
              >
                <span>📍</span>
                <span className="btn-label">Marker</span>
              </button>
              <div className="toolbar-divider" />
              <button
                className="toolbar-btn"
                onClick={() => setShowKeyframePanel(true)}
                title="Keyframe Animation (K)"
              >
                <span>🎯</span>
                <span className="btn-label">Keyframes</span>
              </button>
              <button
                className={`toolbar-btn ${snapEnabled ? 'active' : ''}`}
                onClick={() => setSnapEnabled(!snapEnabled)}
                title="Snap to Grid (S)"
              >
                <span>🧲</span>
                <span className="btn-label">Snap</span>
              </button>
            </div>

            {/* Right Section - View Controls */}
            <div className="toolbar-section toolbar-right">
              <div className="zoom-control-group">
                <button
                  className="toolbar-btn toolbar-btn-sm"
                  onClick={() => setTimelineZoom(Math.max(0.25, timelineZoom / 2))}
                  title="Zoom Out (-)"
                >
                  <span>🔍-</span>
                </button>
                <span className="zoom-label">{Math.round(timelineZoom * 100)}%</span>
                <button
                  className="toolbar-btn toolbar-btn-sm"
                  onClick={() => setTimelineZoom(Math.min(4, timelineZoom * 2))}
                  title="Zoom In (+)"
                >
                  <span>🔍+</span>
                </button>
              </div>
              <div className="toolbar-divider" />
              <div className="track-height-control">
                <button
                  className={`toolbar-btn toolbar-btn-sm ${trackHeight === 'compact' ? 'active' : ''}`}
                  onClick={() => setTrackHeight('compact')}
                  title="Compact Tracks"
                >
                  <span>▬</span>
                </button>
                <button
                  className={`toolbar-btn toolbar-btn-sm ${trackHeight === 'normal' ? 'active' : ''}`}
                  onClick={() => setTrackHeight('normal')}
                  title="Normal Tracks"
                >
                  <span>☰</span>
                </button>
                <button
                  className={`toolbar-btn toolbar-btn-sm ${trackHeight === 'expanded' ? 'active' : ''}`}
                  onClick={() => setTrackHeight('expanded')}
                  title="Expanded Tracks"
                >
                  <span>☷</span>
                </button>
              </div>
            </div>
          </div>

          {/* Timeline Container - NO SCROLL */}
          <div className="timeline-container">
            {/* Timeline Canvas Wrapper - NO SCROLL */}
            <div className="timeline-canvas-wrapper">
              {/* Horizontal Scroll Shell - Shared by ruler + tracks */}
              <div className="timeline-horizontal-scroll">
                {/* Timeline Ruler - Sticky at top, scrolls horizontally */}
                <div className="timeline-ruler-sticky">
                  <TimelineRuler 
                    totalDuration={totalDuration}
                    zoom={zoom}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    scenes={scenes}
                  />
                </div>

                {/* Tracks Viewport - VERTICAL SCROLL ONLY */}
                <div className="timeline-tracks-viewport">
                    {/* Multi-Lane Timeline */}
                    <TimelineLanes
                      layers={layers}
                      onLayerUpdate={handleLayerUpdate}
                      scenes={scenes}
                      placements={placements}
                      totalDuration={totalDuration}
                      zoom={zoom}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                      selectedScene={selectedScene}
                      selectedPlacementId={selectedPlacement?.id}
                      onSceneClick={(scene) => {
                        setSelectedScene(scene);
                        setSelectedPlacement(null);
                        setShowPreviewPanel(true);
                        // Seek to scene start time to show it on canvas
                        const sceneStartTime = scene.start_time_seconds || 0;
                        handleSeek(sceneStartTime);
                      }}
                      onPlacementClick={(placement) => {
                        const scene = scenes.find(s => s.id === placement.scene_id);
                        setSelectedPlacement(placement);
                        setSelectedScene(scene);
                        // Seek to placement start time to show it on canvas
                        const placementStartTime = placement.start_time_seconds || 0;
                        handleSeek(placementStartTime);
                      }}
                      onSceneDrag={handleDragEnd}
                      onPlacementDrag={handleDragEnd}
                      onPlacementResize={async (placementId, newValue, resizeType) => {
            try {
              const placement = placements.find(p => p.id === placementId);
              if (!placement) return;

              if (resizeType === 'duration') {
                // Right-edge resize: change duration_seconds
                // newValue is width percentage relative to timeline
                const newDurationSeconds = (newValue / 100) * totalDuration;
                
                await timelinePlacementsService.updatePlacement(episodeId, placementId, {
                  duration_seconds: newDurationSeconds
                });

                // Update local state
                setPlacements(prev => prev.map(p => 
                  p.id === placementId ? { ...p, duration_seconds: newDurationSeconds } : p
                ));
              } else if (resizeType === 'offset') {
                // Left-edge resize: change both start_time_seconds and duration_seconds
                // newValue is { left, width } percentages
                const newStartTime = (newValue.left / 100) * totalDuration;
                const newDurationSeconds = (newValue.width / 100) * totalDuration;

                await timelinePlacementsService.updatePlacement(episodeId, placementId, {
                  start_time_seconds: newStartTime,
                  duration_seconds: newDurationSeconds
                });

                // Update local state
                setPlacements(prev => prev.map(p => 
                  p.id === placementId ? { ...p, start_time_seconds: newStartTime, duration_seconds: newDurationSeconds } : p
                ));
              }
            } catch (error) {
              console.error('Error resizing placement:', error);
              loadPlacements(); // Reload on error
            }
          }}
              />
                </div> {/* .timeline-tracks-viewport */}
              </div> {/* .timeline-horizontal-scroll */}
            </div> {/* .timeline-canvas-wrapper */}

            {/* Timeline Footer - Outside scroll area */}
            <div className="timeline-footer">
              <span>💡 Press <kbd>?</kbd> for shortcuts • <kbd>Space</kbd> to play • <kbd>Tab</kbd> to toggle panel • Shift+Click to multi-select</span>
            </div>
          </div> {/* .timeline-container */}
        </div> {/* .timeline-main-area */}
      </div> {/* .timeline-container-wrapper */}

      {/* Modals & Overlays */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        totalDuration={totalDuration}
      />

      {/* Keyframe Animation Panel */}
      <KeyframePanel
        isOpen={showKeyframePanel}
        onClose={() => setShowKeyframePanel(false)}
        selectedItem={selectedPlacement || selectedScene}
        onUpdateKeyframes={async (keyframes) => {
          try {
            if (selectedPlacement) {
              await timelinePlacementsService.updatePlacement(episodeId, selectedPlacement.id, { keyframes });
            } else if (selectedScene) {
              await sceneService.updateScene(selectedScene.id, { keyframes });
            }
            await loadScenes();
            await loadPlacements();
            showToast('Keyframes updated', 'success');
          } catch (error) {
            console.error('Error updating keyframes:', error);
            showToast('Failed to update keyframes', 'error');
          }
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onRemoveToast={removeToast}
      />
    </DndContext>
  );
};

export default Timeline;
