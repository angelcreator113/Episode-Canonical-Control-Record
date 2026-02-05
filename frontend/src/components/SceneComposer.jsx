import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './SceneComposer.css';

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

const COMPOSITION_TYPE = 'scene_template';

/**
 * SceneComposer Component (LEGACY - Tab Version)
 * Unified scene template interface that pulls from Scenes, Assets, and Scripts
 * to create curated scene templates with multi-element editing
 */
export default function SceneComposer({ 
  episodeId, 
  episode, 
  episodeScenes = [], 
  episodeAssets = [],
  episodeWardrobes = []
}) {
  const navigate = useNavigate();
  
  // View mode: 'gallery' shows all templates, 'editor' shows active template workspace
  const [viewMode, setViewMode] = useState('gallery');
  
  // Composition state
  const [compositions, setCompositions] = useState([]);
  const [activeComposition, setActiveComposition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCompositionName, setNewCompositionName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Asset processing state
  const [processingAsset, setProcessingAsset] = useState(null); // { assetId, type: 'bg_removal' | 'enhancement' }
  const [processingStatus, setProcessingStatus] = useState({}); // { [assetId]: { bg_removed, enhanced } }
  
  // Panels always visible in fixed layout (no collapse)
  
  // Source material from episode with roles
  const [selectedScenes, setSelectedScenes] = useState([]); // { scene, role: 'primary' | 'b-roll' | 'transition' | 'overlay' }
  const [selectedAssets, setSelectedAssets] = useState([]); // { asset, role: 'primary' | 'overlay' | 'background' | 'effect' }
  const [selectedWardrobes, setSelectedWardrobes] = useState([]); // { wardrobe, role: 'costume' }
  const [selectedScript, setSelectedScript] = useState(null);
  
  // Active tab in source panel
  const [sourceTab, setSourceTab] = useState('scenes');
  
  // Role selection for current item
  const [pendingScene, setPendingScene] = useState(null);
  const [pendingAsset, setPendingAsset] = useState(null);
  const [pendingWardrobe, setPendingWardrobe] = useState(null);
  
  // Canvas scene element management
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [elementTransforms, setElementTransforms] = useState({}); // { elementId: { x, y, width, height, scale, opacity, rotation, visible, locked } }
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
  const [dragInfo, setDragInfo] = useState(null); // { x, y, width, height } - for visual feedback
  
  // Snap guides
  const [snapGuides, setSnapGuides] = useState({ vertical: [], horizontal: [] });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const SNAP_THRESHOLD = 5; // pixels - tighter for precision
  const GRID_SIZE = 20; // pixels
  
  // Canvas controls
  const [canvasZoom, setCanvasZoom] = useState(1); // 0.25, 0.5, 1, 2
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  
  // Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Layer panel
  const [showLayersPanel, setShowLayersPanel] = useState(true);
  
  // Video format / platform selection
  const [selectedFormat, setSelectedFormat] = useState('youtube'); // youtube, instagram, tiktok, twitter, linkedin

  // Social media platform formats
  const VIDEO_FORMATS = [
    { id: 'youtube', name: 'YouTube', icon: '📺', ratio: '16:9', width: 1920, height: 1080, color: '#FF0000' },
    { id: 'instagram', name: 'Instagram', icon: '📷', ratio: '1:1', width: 1080, height: 1080, color: '#E1306C' },
    { id: 'instagram-story', name: 'IG Story', icon: '📱', ratio: '9:16', width: 1080, height: 1920, color: '#C13584' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', ratio: '9:16', width: 1080, height: 1920, color: '#000000' },
    { id: 'twitter', name: 'Twitter', icon: '🐦', ratio: '16:9', width: 1280, height: 720, color: '#1DA1F2' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', ratio: '16:9', width: 1920, height: 1080, color: '#0077B5' },
    { id: 'facebook', name: 'Facebook', icon: '👥', ratio: '16:9', width: 1280, height: 720, color: '#1877F2' },
  ];

  useEffect(() => {
    loadTemplates();
  }, [episodeId]);

  // Auto-save when selections change (debounced)
  useEffect(() => {
    if (!activeComposition) return;
    
    const timeout = setTimeout(() => {
      handleSaveComposition();
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [selectedScenes, selectedAssets, selectedWardrobes, elementTransforms, selectedFormat]);

  const loadCompositions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/episodes/${episodeId}/video-compositions?type=${COMPOSITION_TYPE}`
      );
      const data = await response.json();
      
      if (data.success) {
        setCompositions(data.data || []);
        console.log('✅ Loaded compositions:', data.data);
      }
    } catch (error) {
      console.error('Error loading compositions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComposition = async () => {
    if (!activeComposition) return;
    
    try {
      setSaving(true);
      
      const response = await fetch(
        `/api/v1/episodes/${episodeId}/video-compositions/${activeComposition.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeComposition.id,
            type: COMPOSITION_TYPE,
            name: activeComposition.name,

            scenes: selectedScenes.map((s, i) => ({
              scene_id: s.scene.id,
              role: s.role,
              order: i,
            })),
            assets: selectedAssets.map((a, i) => ({
              asset_id: a.asset.id,
              role: a.role,
              order: i,
            })),
            wardrobes: selectedWardrobes.map((w, i) => ({
              wardrobe_id: w.wardrobe.id,
              role: w.role,
              order: i,
            })),

            layer_transforms: elementTransforms,
            settings: {
              ...(activeComposition.settings || {}),
              format: selectedFormat,
              platform: VIDEO_FORMATS.find((f) => f.id === selectedFormat)?.name,
            },
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Saved composition:', data.data);
        setCompositions((prev) => prev.map((c) => (c.id === activeComposition.id ? data.data : c)));
        setActiveComposition(data.data);
      }
    } catch (error) {
      console.error('Error saving composition:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateComposition = () => {
    console.log('🎬 handleCreateComposition called');
    // Generate default name
    const defaultName = `Composition ${compositions.length + 1}`;
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
      alert('Please enter a composition name');
      return;
    }

    try {
      setCreating(true);
      
      const response = await fetch(`/api/v1/episodes/${episodeId}/video-compositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: COMPOSITION_TYPE,
          name: newCompositionName,
          scenes: [],
          assets: [],
          wardrobes: [],
          layer_transforms: {},
          settings: { format: selectedFormat }
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create composition');
      }
      
      const newComp = data.data;
      console.log('✅ Created composition:', newComp);
      
      setCompositions((prev) => [...prev, newComp]);
      setActiveComposition(newComp);
      
      setShowCreateDialog(false);
      setNewCompositionName('');
      
      // Reset selections for new composition
      setSelectedScenes([]);
      setSelectedAssets([]);
      setSelectedWardrobes([]);
      setElementTransforms({});
      setSelectedElementId(null);
      
      // Switch to editor mode
      setViewMode('editor');
      
    } catch (error) {
      console.error('Error creating composition:', error);
      alert('Failed to create composition: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSceneToggle = (scene) => {
    const isSelected = selectedScenes.find(s => s.scene.id === scene.id);
    if (isSelected) {
      setSelectedScenes(prev => prev.filter(s => s.scene.id !== scene.id));
    } else {
      // Open role dialog
      setPendingScene(scene);
    }
  };

  const handleAssetToggle = (asset) => {
    const isSelected = selectedAssets.find(a => a.asset.id === asset.id);
    if (isSelected) {
      setSelectedAssets(prev => prev.filter(a => a.asset.id !== asset.id));
    } else {
      // Open role dialog
      setPendingAsset(asset);
    }
  };

  const handleRoleSelect = (type, roleId) => {
    if (type === 'scene' && pendingScene) {
      setSelectedScenes(prev => [...prev, { scene: pendingScene, role: roleId }]);
      setPendingScene(null);
    } else if (type === 'asset' && pendingAsset) {
      setSelectedAssets(prev => [...prev, { asset: pendingAsset, role: roleId }]);
      setPendingAsset(null);
    } else if (type === 'wardrobe' && pendingWardrobe) {
      setSelectedWardrobes(prev => [...prev, { wardrobe: pendingWardrobe, role: roleId }]);
      setPendingWardrobe(null);
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
    const elements = getAllElements();
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
    const otherElements = getAllElements()
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

  const handleMouseMove = (e) => {
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
      const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
      const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
      
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
  };

  const handleMouseUp = () => {
    if (isDragging || isResizing) {
      saveToHistory();
    }
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragInfo(null);
    setSnapGuides({ vertical: [], horizontal: [] });
  };

  const handleBringForward = () => {
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
  };

  const handleSendBackward = () => {
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
  };

  const handleDeleteLayer = () => {
    if (!selectedElementId) return;
    
    // Remove from appropriate list
    if (selectedElementId.startsWith('scene-')) {
      const sceneId = Number(selectedElementId.replace('scene-', ''));
      setSelectedScenes(prev => prev.filter(s => Number(s.scene.id) !== sceneId));
    } else if (selectedElementId.startsWith('asset-')) {
      const assetId = Number(selectedElementId.replace('asset-', ''));
      setSelectedAssets(prev => prev.filter(a => Number(a.asset.id) !== assetId));
    } else if (selectedElementId.startsWith('wardrobe-')) {
      const wardrobeId = Number(selectedElementId.replace('wardrobe-', ''));
      setSelectedWardrobes(prev => prev.filter(w => Number(w.wardrobe.id) !== wardrobeId));
    }
    
    // Remove from transforms
    setElementTransforms(prev => {
      const newTransforms = { ...prev };
      delete newTransforms[selectedElementId];
      return newTransforms;
    });
    
    setSelectedElementId(null);
    saveToHistory();
  };

  const handleOpacityChange = (opacity) => {
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
  };

  const handleRotationChange = (rotation) => {
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
  };

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

  const SCENE_ROLES = [
    { id: 'primary', label: 'Primary Content', icon: '🎬', color: '#3b82f6', hint: 'Main video content' },
    { id: 'b-roll', label: 'B-Roll', icon: '📹', color: '#8b5cf6', hint: 'Supporting footage' },
    { id: 'transition', label: 'Transition', icon: '➡️', color: '#06b6d4', hint: 'Scene transitions' },
    { id: 'overlay', label: 'Video Overlay', icon: '🎞️', color: '#ec4899', hint: 'Overlay clip' },
  ];

  const ASSET_ROLES = [
    { id: 'primary', label: 'Primary Visual', icon: '🖼️', color: '#3b82f6', hint: 'Main visual element' },
    { id: 'background', label: 'Background', icon: '🌄', color: '#10b981', hint: 'Background layer' },
    { id: 'overlay', label: 'Overlay', icon: '✨', color: '#ec4899', hint: 'Foreground overlay' },
    { id: 'effect', label: 'Effect/Filter', icon: '🎨', color: '#f59e0b', hint: 'Visual effect' },
  ];

  const WARDROBE_ROLES = [
    { id: 'costume', label: 'Costume Reference', icon: '👗', color: '#8b5cf6', hint: 'Character costume/outfit' },
    { id: 'overlay', label: 'Wardrobe Overlay', icon: '✨', color: '#ec4899', hint: 'Overlay wardrobe item' },
    { id: 'background', label: 'Background Item', icon: '🎨', color: '#6366f1', hint: 'Background wardrobe element' },
  ];

  // Helper: Get all elements sorted by render order (background → primary → overlay)
  const getAllElements = () => {
    const elements = [];
    
    // Define element order (lower z-index first)
    const elementOrder = {
      background: 0,
      primary: 1,
      'b-roll': 2,
      costume: 2,
      transition: 3,
      overlay: 4,
      effect: 5
    };
    
    // Add scenes
    selectedScenes.forEach(item => {
      elements.push({
        id: `scene-${item.scene.id}`,
        type: 'scene',
        role: item.role,
        data: item.scene,
        zIndex: elementOrder[item.role] || 1,
        thumbnail: item.scene.libraryScene?.thumbnail_url || item.scene.thumbnail_url || item.scene.image_url
      });
    });
    
    // Add assets
    selectedAssets.forEach(item => {
      elements.push({
        id: `asset-${item.asset.id}`,
        type: 'asset',
        role: item.role,
        data: item.asset,
        zIndex: elementOrder[item.role] || 1,
        thumbnail: item.asset.s3_url_processed || item.asset.s3_url_raw || item.asset.thumbnail_url || item.asset.url
      });
    });
    
    // Add wardrobe
    selectedWardrobes.forEach(item => {
      elements.push({
        id: `wardrobe-${item.wardrobe.id}`,
        type: 'wardrobe',
        role: item.role,
        data: item.wardrobe,
        zIndex: elementOrder[item.role] || 2,
        thumbnail: item.wardrobe.image_url || item.wardrobe.thumbnail_url
      });
    });
    
    // Sort by z-index
    return elements.sort((a, b) => a.zIndex - b.zIndex);
  };

  // Render canvas elements
  const renderSceneElements = () => {
    const elements = getAllElements();
    
    return elements.map((element, index) => {
      // Background elements should fill the entire canvas
      const isBackground = element.role === 'background';
      const isPrimary = element.role === 'primary';
      
      const transform = elementTransforms[element.id];
      
      // Check visibility and lock status
      const isVisible = transform?.visible !== false;
      const isLocked = transform?.locked === true;
      
      // Don't render hidden elements
      if (!isVisible) return null;
      
      // Determine element style - merge transform with defaults to ensure all properties exist
      const defaultStyle = (!isBackground && !isPrimary) ? {
        x: 50 + (index * 20),
        y: 50 + (index * 20),
        width: 200,
        height: 150,
        scale: 1,
        opacity: 100,
        rotation: 0,
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
      const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
      const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
      
      return (
        <div
          key={element.id}
          className={`vw-canvas-layer ${isSelected && !isBackground && !isPrimary ? 'vw-layer-selected' : ''} ${isBackground ? 'vw-layer-background' : ''} ${isPrimary ? 'vw-layer-primary' : ''} ${isLocked ? 'vw-layer-locked' : ''}`}
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
          <div className="vw-layer-content" style={isBackground || isPrimary ? {
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          } : undefined}>
            {element.thumbnail ? (
              <img 
                src={element.thumbnail} 
                alt={element.data.title || element.data.name}
                style={isBackground || isPrimary ? {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                } : undefined}
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
            )}
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
              <div className="vw-resize-handle vw-resize-nw" onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')} />
              <div className="vw-resize-handle vw-resize-n" onMouseDown={(e) => handleResizeStart(e, element.id, 'n')} />
              <div className="vw-resize-handle vw-resize-ne" onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')} />
              <div className="vw-resize-handle vw-resize-e" onMouseDown={(e) => handleResizeStart(e, element.id, 'e')} />
              <div className="vw-resize-handle vw-resize-se" onMouseDown={(e) => handleResizeStart(e, element.id, 'se')} />
              <div className="vw-resize-handle vw-resize-s" onMouseDown={(e) => handleResizeStart(e, element.id, 's')} />
              <div className="vw-resize-handle vw-resize-sw" onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')} />
              <div className="vw-resize-handle vw-resize-w" onMouseDown={(e) => handleResizeStart(e, element.id, 'w')} />
            </>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="vw-loading">
        <div className="vw-spinner"></div>
        <p>Loading compositions...</p>
      </div>
    );
  }

  // console.log('🎬 VideoCompositionWorkspace render:', { 
  //   compositions: compositions.length,
  //   activeComposition: activeComposition?.id,
  //   showCreateDialog 
  // });

  return (
    <div className="video-workspace">
      {/* Header */}
      <div className="vw-header">
        <div className="vw-header-left">
          {viewMode === 'editor' && activeComposition && (
            <button 
              className="vw-back-btn"
              onClick={() => {
                setViewMode('gallery');
                setActiveComposition(null);
              }}
              title="Back to gallery"
            >
              ← 
            </button>
          )}
          <div>
            <h2 className="vw-title">
              🎬 {viewMode === 'editor' && activeComposition ? activeComposition.name : 'Video Compositions'}
            </h2>
            <p className="vw-subtitle">
              {episode?.episodeTitle || episode?.title || `Episode ${episode?.episode_number || ''}`}
            </p>
          </div>
        </div>
        
        <div className="vw-header-right">
          {viewMode === 'editor' && activeComposition && (
            <>
              {/* Canvas Controls Toolbar */}
              <div className="vw-toolbar">
                <div className="vw-toolbar-group">
                  <label className="vw-toolbar-label">Zoom:</label>
                  <button 
                    className={`vw-toolbar-btn ${canvasZoom === 0.25 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(0.25)}
                    title="25%"
                  >
                    25%
                  </button>
                  <button 
                    className={`vw-toolbar-btn ${canvasZoom === 0.5 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(0.5)}
                    title="50%"
                  >
                    50%
                  </button>
                  <button 
                    className={`vw-toolbar-btn ${canvasZoom === 1 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(1)}
                    title="100%"
                  >
                    100%
                  </button>
                  <button 
                    className={`vw-toolbar-btn ${canvasZoom === 2 ? 'active' : ''}`}
                    onClick={() => setCanvasZoom(2)}
                    title="200%"
                  >
                    200%
                  </button>
                </div>
                
                <div className="vw-toolbar-divider"></div>
                
                <div className="vw-toolbar-group">
                  <button 
                    className={`vw-toolbar-btn ${showGrid ? 'active' : ''}`}
                    onClick={() => setShowGrid(!showGrid)}
                    title="Toggle Grid"
                  >
                    Grid
                  </button>
                  <button 
                    className={`vw-toolbar-btn ${showRulers ? 'active' : ''}`}
                    onClick={() => setShowRulers(!showRulers)}
                    title="Toggle Rulers"
                  >
                    Rulers
                  </button>
                  <button 
                    className={`vw-toolbar-btn ${snapEnabled ? 'active' : ''}`}
                    onClick={() => setSnapEnabled(!snapEnabled)}
                    title="Toggle Snap (Hold Shift)"
                  >
                    Snap
                  </button>
                </div>
                
                <div className="vw-toolbar-divider"></div>
              </div>
              
              {/* Platform Format Selector */}
              <div className="vw-format-selector">
                <label className="vw-format-label">Platform:</label>
                <select 
                  className="vw-format-select"
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
                className="vw-btn"
                onClick={handleSaveComposition}
                disabled={saving}
                title="Save composition"
              >
                <span>{saving ? '⏳' : '💾'}</span>
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
              
              <button 
                className="vw-btn vw-btn-primary"
                onClick={() => navigate(`/episodes/${episodeId}/timeline?composition=${activeComposition.id}`)}
                title="Open in full timeline editor"
              >
                <span>🎞️</span>
                <span>Open in Timeline</span>
              </button>
            </>
          )}
          
          {viewMode === 'gallery' && (
            <button 
              className="vw-btn vw-btn-primary"
              onClick={handleCreateComposition}
            >
              <span>✨</span>
              <span>New Composition</span>
            </button>
          )}
        </div>
      </div>

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <div className="vw-gallery">
          {compositions.length > 0 ? (
            <div className="vw-compositions-grid">
              {compositions.map(comp => (
                <div 
                  key={comp.id} 
                  className="vw-composition-card"
                  onClick={() => {
                    setActiveComposition(comp);
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
                  <div className="vw-card-preview">
                    {comp.scenes?.[0] ? (
                      <img 
                        src={episodeScenes.find(s => s.id === comp.scenes[0].scene_id)?.thumbnail_url || '/placeholder.jpg'}
                        alt={comp.name}
                        className="vw-card-thumb"
                      />
                    ) : (
                      <div className="vw-card-placeholder">
                        <span>🎬</span>
                      </div>
                    )}
                    <div className={`vw-card-status vw-status-${comp.status || 'draft'}`}>
                      {comp.status || 'draft'}
                    </div>
                  </div>
                  
                  <div className="vw-card-body">
                    <h3 className="vw-card-title">{comp.name}</h3>
                    <div className="vw-card-meta">
                      <span>{(comp.scenes?.length || 0)} scenes</span>
                      <span>•</span>
                      <span>{(comp.assets?.length || 0)} assets</span>
                    </div>
                    <div className="vw-card-date">
                      {new Date(comp.updated_at || comp.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Create New Card */}
              <div 
                className="vw-composition-card vw-card-create"
                onClick={handleCreateComposition}
              >
                <div className="vw-card-create-content">
                  <div className="vw-create-icon">✨</div>
                  <h3 className="vw-create-title">Create New</h3>
                  <p className="vw-create-hint">Start a new composition</p>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="vw-empty-workspace">
              <div className="vw-empty-card">
                <div className="vw-empty-icon-large">🎬</div>
                <h3 className="vw-empty-title">Create Your First Video Composition</h3>
                <p className="vw-empty-description">
                  Compositions let you curate scenes, assets, and scripts into a final video.
                  Think of it as your "director's cut" workspace.
                </p>
                
                <button 
                  className="vw-btn vw-btn-primary vw-btn-large"
                  onClick={handleCreateComposition}
                >
                  <span>✨</span>
                  <span>Create Composition</span>
                </button>

                <div className="vw-feature-list">
                  <div className="vw-feature">
                    <span className="vw-feature-icon">🎬</span>
                    <div className="vw-feature-text">
                      <div className="vw-feature-title">Select Scenes</div>
                      <div className="vw-feature-hint">Choose from your episode's scene library</div>
                    </div>
                  </div>
                  <div className="vw-feature">
                    <span className="vw-feature-icon">🎨</span>
                    <div className="vw-feature-text">
                      <div className="vw-feature-title">Layer Assets</div>
                      <div className="vw-feature-hint">Add logos, overlays, and graphics</div>
                    </div>
                  </div>
                  <div className="vw-feature">
                    <span className="vw-feature-icon">📤</span>
                    <div className="vw-feature-text">
                      <div className="vw-feature-title">Export Multiple Formats</div>
                      <div className="vw-feature-hint">Generate for YouTube, Instagram, TikTok</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'editor' && activeComposition && (
        <div className="vw-editor">
          <React.Fragment>
          {/* Source Panel - Left (Fixed, always visible) */}
          <div className="vw-source-panel">
              <div className="vw-panel-header">
                <div className="vw-panel-tabs">
                <button 
                  className={`vw-tab ${sourceTab === 'scenes' ? 'vw-tab-active' : ''}`}
                  onClick={() => setSourceTab('scenes')}
                >
                  <span>🎬</span>
                  <span>Scenes</span>
                  <span className="vw-badge">{episodeScenes?.length || 0}</span>
                </button>
                <button 
                  className={`vw-tab ${sourceTab === 'assets' ? 'vw-tab-active' : ''}`}
                  onClick={() => setSourceTab('assets')}
                >
                  <span>🎨</span>
                  <span>Assets</span>
                  <span className="vw-badge">{episodeAssets?.length || 0}</span>
                </button>
                <button 
                  className={`vw-tab ${sourceTab === 'wardrobe' ? 'vw-tab-active' : ''}`}
                  onClick={() => setSourceTab('wardrobe')}
                >
                  <span>👗</span>
                  <span>Wardrobe</span>
                  <span className="vw-badge">{episodeWardrobes?.length || 0}</span>
                </button>
              </div>
              </div>

              <div className="vw-panel-content">
                {sourceTab === 'scenes' && (
                  <div className="vw-source-list">
                    {episodeScenes?.length > 0 ? (
                      episodeScenes.map(scene => {
                        const selected = selectedScenes.find(s => s.scene.id === scene.id);
                        const roleInfo = selected ? SCENE_ROLES.find(r => r.id === selected.role) : null;
                        return (
                          <div 
                            key={scene.id}
                            className={`vw-source-item ${selected ? 'vw-source-item-selected' : ''}`}
                            onClick={() => handleSceneToggle(scene)}
                          >
                            <div className="vw-source-thumb">
                              {scene.libraryScene?.thumbnail_url ? (
                                <img src={scene.libraryScene.thumbnail_url} alt={scene.title} />
                              ) : (
                                <div className="vw-source-thumb-fallback">🎬</div>
                              )}
                              {roleInfo && (
                                <div className="vw-role-badge" style={{ background: roleInfo.color }}>
                                  {roleInfo.icon}
                                </div>
                              )}
                            </div>
                            <div className="vw-source-info">
                              <div className="vw-source-title">{scene.title || `Scene ${scene.scene_number}`}</div>
                              <div className="vw-source-meta">
                                {scene.duration_seconds}s · {scene.scene_type}
                                {roleInfo && ` · ${roleInfo.label}`}
                              </div>
                            </div>
                            <div className="vw-source-check">
                              {selected && '✓'}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="vw-empty-state">
                        <div className="vw-empty-icon">🎬</div>
                        <div className="vw-empty-text">No scenes yet</div>
                        <div className="vw-empty-hint">Add scenes in the Scenes tab</div>
                      </div>
                    )}
                  </div>
                )}

                {sourceTab === 'assets' && (
                  <div className="vw-source-list">
                    {episodeAssets?.length > 0 ? (
                      episodeAssets.map(asset => {
                        const selected = selectedAssets.find(a => a.asset.id === asset.id);
                        const roleInfo = selected ? ASSET_ROLES.find(r => r.id === selected.role) : null;
                        return (
                          <div 
                            key={asset.id}
                            className={`vw-source-item ${selected ? 'vw-source-item-selected' : ''}`}
                            onClick={() => handleAssetToggle(asset)}
                          >
                            <div className="vw-source-thumb">
                              {asset.s3_url_processed || asset.s3_url_raw ? (
                                <img src={asset.s3_url_processed || asset.s3_url_raw} alt={asset.name} />
                              ) : (
                                <div className="vw-source-thumb-fallback">🎨</div>
                              )}
                              {roleInfo && (
                                <div className="vw-role-badge" style={{ background: roleInfo.color }}>
                                  {roleInfo.icon}
                                </div>
                              )}
                            </div>
                            <div className="vw-source-info">
                              <div className="vw-source-title">{asset.name}</div>
                              <div className="vw-source-meta">
                                {asset.asset_type} · {asset.media_type}
                                {roleInfo && ` · ${roleInfo.label}`}
                              </div>
                            </div>
                            <div className="vw-source-check">
                              {selected && '✓'}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="vw-empty-state">
                        <div className="vw-empty-icon">🎨</div>
                        <div className="vw-empty-text">No assets yet</div>
                        <div className="vw-empty-hint">Add assets in the Assets tab</div>
                      </div>
                    )}
                  </div>
                )}

                {sourceTab === 'wardrobe' && (
                  <div className="vw-source-list">
                    {episodeWardrobes?.length > 0 ? (
                      episodeWardrobes.map(wardrobe => {
                        const isSelected = selectedWardrobes.some(w => w.wardrobe.id === wardrobe.id);
                        return (
                        <div 
                          key={wardrobe.id}
                          className={`vw-source-item ${isSelected ? 'vw-source-item-selected' : ''}`}
                          onClick={() => {
                            console.log('Wardrobe clicked:', wardrobe);
                            if (isSelected) {
                              // Deselect
                              setSelectedWardrobes(prev => prev.filter(w => w.wardrobe.id !== wardrobe.id));
                            } else {
                              // Open role dialog
                              setPendingWardrobe(wardrobe);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="vw-source-thumb">
                            {wardrobe.image_url ? (
                              <img src={wardrobe.image_url} alt={wardrobe.name} />
                            ) : (
                              <div className="vw-source-thumb-fallback">👗</div>
                            )}
                          </div>
                          <div className="vw-source-info">
                            <div className="vw-source-title">{wardrobe.name}</div>
                            <div className="vw-source-meta">
                              {wardrobe.type} · {wardrobe.character || 'Character'}
                            </div>
                          </div>
                          {isSelected && (() => {
                            const selected = selectedWardrobes.find(w => w.wardrobe.id === wardrobe.id);
                            const roleInfo = selected ? WARDROBE_ROLES.find(r => r.id === selected.role) : null;
                            return (
                            <div className="vw-source-selected-badge">
                              <span className="vw-source-checkmark">✓</span>
                              {roleInfo && (
                                <span className="vw-source-role-badge" style={{ background: roleInfo.color }}>
                                  {roleInfo.icon} {roleInfo.label}
                                </span>
                              )}
                            </div>
                            );
                          })()}
                        </div>
                        );
                      })
                    ) : (
                      <div className="vw-empty-state">
                        <div className="vw-empty-icon">👗</div>
                        <div className="vw-empty-text">No wardrobe items yet</div>
                        <div className="vw-empty-hint">Add wardrobe in the Wardrobe tab</div>
                      </div>
                  )}
                </div>
              )}
              </div>
            </div>

          <div className="vw-main">
              {/* Center - Canvas Workspace (Fixed, always visible) */}
              <div className="vw-canvas">
              {/* Format indicator */}
              {viewMode === 'editor' && (
                <div className="vw-canvas-format-badge">
                  <span>{VIDEO_FORMATS.find(f => f.id === selectedFormat)?.icon}</span>
                  <span>{VIDEO_FORMATS.find(f => f.id === selectedFormat)?.name}</span>
                  <span>({VIDEO_FORMATS.find(f => f.id === selectedFormat)?.ratio})</span>
                </div>
              )}
              
              {(selectedScenes.length === 0 && selectedAssets.length === 0 && selectedWardrobes.length === 0) ? (
                <div className="vw-canvas-placeholder">
                  <div className="vw-canvas-icon">🎥</div>
                  <div className="vw-canvas-title">Composition Canvas</div>
                  <div className="vw-canvas-subtitle">
                    Select scenes, assets, and wardrobe to build your composition
                  </div>
                  <div className="vw-canvas-format-info">
                    Editing for: {VIDEO_FORMATS.find(f => f.id === selectedFormat)?.name} ({VIDEO_FORMATS.find(f => f.id === selectedFormat)?.ratio})
                  </div>
                </div>
              ) : (
                <div className="vw-canvas-container">
                  {/* Rulers */}
                  {showRulers && (
                    <>
                      <div className="vw-ruler vw-ruler-horizontal">
                        {[...Array(40)].map((_, i) => (
                          <div key={i} className="vw-ruler-mark" style={{ left: `${i * 20}px` }}>
                            {i % 5 === 0 && <span className="vw-ruler-label">{i * 20}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="vw-ruler vw-ruler-vertical">
                        {[...Array(30)].map((_, i) => (
                          <div key={i} className="vw-ruler-mark" style={{ top: `${i * 20}px` }}>
                            {i % 5 === 0 && <span className="vw-ruler-label">{i * 20}</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  
                  <div 
                    className="vw-canvas-active"
                    data-format={selectedFormat}
                    style={{
                      aspectRatio: VIDEO_FORMATS.find(f => f.id === selectedFormat)?.ratio.replace(':', '/'),
                      transform: `scale(${canvasZoom})`,
                      transformOrigin: 'center center'
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div className="vw-canvas-viewport" style={{
                      backgroundImage: showGrid ? `
                        linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
                      ` : 'none',
                      backgroundSize: showGrid ? '20px 20px' : 'auto',
                      backgroundPosition: showGrid ? '-1px -1px' : '0 0'
                    }}>
                    {/* Render layers in order: backgrounds → primary → overlays */}
                    {renderSceneElements()}
                    
                    {/* Snap guide lines */}
                    {snapGuides.vertical.map((x, i) => (
                      <div 
                        key={`v-${i}`}
                        className="vw-snap-guide vw-snap-guide-vertical"
                        style={{ left: `${x}px` }}
                      />
                    ))}
                    {snapGuides.horizontal.map((y, i) => (
                      <div 
                        key={`h-${i}`}
                        className="vw-snap-guide vw-snap-guide-horizontal"
                        style={{ top: `${y}px` }}
                      />
                    ))}
                    
                    {/* Visual feedback during drag/resize */}
                    {dragInfo && (isDragging || isResizing) && (
                      <div className="vw-drag-feedback">
                        <div className="vw-drag-info">
                          <div className="vw-drag-label">Position</div>
                          <div className="vw-drag-value">X: {dragInfo.x}px, Y: {dragInfo.y}px</div>
                        </div>
                        <div className="vw-drag-info">
                          <div className="vw-drag-label">Size</div>
                          <div className="vw-drag-value">{dragInfo.width} × {dragInfo.height}px</div>
                        </div>
                      </div>
                    )}
                    </div>
                  
                  {/* Layer controls moved to inspector panel */}
                  </div>
                </div>
              )}
            </div>

              {/* Bottom Timeline/Layers Area (Fixed, always visible) */}
              <div className="vw-timeline-area">
                <div className="vw-layers-panel">
                <div className="vw-layers-header">
                  <h3 className="vw-layers-title">🎨 Scene Elements</h3>
                </div>
                  
                  <div className="vw-layers-list">
                    {getAllElements().length === 0 ? (
                      <div className="vw-layers-empty">
                        <span className="vw-layers-empty-icon">📋</span>
                        <p>No elements yet. Add scenes, assets, or wardrobe to begin.</p>
                      </div>
                    ) : (
                      getAllElements().reverse().map((element) => {
                        const transform = elementTransforms[element.id] || {};
                        const isVisible = transform.visible !== false;
                        const isLocked = transform.locked === true;
                        const isSelected = selectedElementId === element.id;
                        const roleInfo = 
                          element.type === 'scene' ? SCENE_ROLES.find(r => r.id === element.role) :
                          element.type === 'asset' ? ASSET_ROLES.find(r => r.id === element.role) :
                          WARDROBE_ROLES.find(r => r.id === element.role);
                        
                        return (
                          <div 
                            key={element.id}
                            className={`vw-layer-item ${isSelected ? 'vw-layer-item-selected' : ''} ${!isVisible ? 'vw-layer-item-hidden' : ''}`}
                            onClick={() => !isLocked && setSelectedElementId(element.id)}
                          >
                            <div className="vw-layer-thumbnail">
                              {element.thumbnail ? (
                                <img src={element.thumbnail} alt={element.data.title || element.data.name} />
                              ) : (
                                <div className="vw-layer-thumbnail-placeholder" style={{ background: roleInfo?.color }}>
                                  {roleInfo?.icon || '📷'}
                                </div>
                              )}
                            </div>
                            
                            <div className="vw-layer-info">
                              <div className="vw-layer-name">
                                {element.data.title || element.data.name || 'Untitled'}
                              </div>
                              <div className="vw-layer-role">
                                {roleInfo?.icon} {roleInfo?.label}
                              </div>
                            </div>
                            
                            <div className="vw-layer-actions">
                              <button
                                className={`vw-layer-action-btn ${!isVisible ? 'vw-layer-action-active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setElementTransforms(prev => ({
                                    ...prev,
                                    [element.id]: { ...prev[element.id], visible: !isVisible }
                                  }));
                                  saveToHistory();
                                }}
                                title={isVisible ? 'Hide element' : 'Show element'}
                              >
                                {isVisible ? '👁️' : '👁️‍🗨️'}
                              </button>
                              <button
                                className={`vw-layer-action-btn ${isLocked ? 'vw-layer-action-active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setElementTransforms(prev => ({
                                    ...prev,
                                    [element.id]: { ...prev[element.id], locked: !isLocked }
                                  }));
                                  saveToHistory();
                                }}
                                title={isLocked ? 'Unlock element' : 'Lock element'}
                              >
                                {isLocked ? '🔒' : '🔓'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

          <div className="vw-inspector-panel">
              {/* Inspector Panel - Right (Fixed, always visible) */}
              <div className="vw-panel-header">
              <h3 className="vw-panel-title">Properties</h3>
              </div>

              <div className="vw-panel-content">
                {/* Element Properties - Only show when an element is selected */}
                {selectedElementId && (() => {
                  const transform = elementTransforms[selectedElementId] || { x: 50, y: 50, width: 200, height: 150, scale: 1, opacity: 100, rotation: 0 };
                  const element = getAllElements().find(el => el.id === selectedElementId);
                  const isBackground = element?.role === 'background';
                  const isPrimary = element?.role === 'primary';
                  
                  if (isBackground || isPrimary) return null; // Don't show controls for background/primary
                  
                  return (
                    <div className="vw-inspector-section vw-layer-properties">
                      <h4 className="vw-inspector-heading">🎨 Element Properties</h4>
                      
                      {/* Element Name */}
                      <div className="vw-property-group">
                        <div className="vw-property-label">Layer</div>
                        <div className="vw-property-value" style={{ fontWeight: 600, color: '#111827' }}>
                          {element?.data?.title || element?.data?.name || 'Layer'}
                        </div>
                      </div>
                      
                      {/* Position */}
                      <div className="vw-property-group">
                        <div className="vw-property-label">Position</div>
                        <div className="vw-property-inputs">
                          <div className="vw-input-group">
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
                              className="vw-number-input"
                            />
                          </div>
                          <div className="vw-input-group">
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
                              className="vw-number-input"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Size */}
                      <div className="vw-property-group">
                        <div className="vw-property-label">Size</div>
                        <div className="vw-property-inputs">
                          <div className="vw-input-group">
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
                              className="vw-number-input"
                              min="50"
                            />
                          </div>
                          <div className="vw-input-group">
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
                              className="vw-number-input"
                              min="50"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Resize Presets */}
                      <div className="vw-property-group">
                        <div className="vw-property-label" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#3b82f6' }}>
                          📐 Social Media Sizes
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button
                            className="vw-btn vw-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
                              const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
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
                            className="vw-btn vw-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
                              const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
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
                            className="vw-btn vw-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
                              const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
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
                            className="vw-btn vw-btn-secondary"
                            onClick={() => {
                              const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                              const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
                              const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
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
                              className="vw-btn vw-btn-secondary"
                              onClick={() => {
                                const format = VIDEO_FORMATS.find(f => f.id === selectedFormat);
                                const canvasWidth = format ? format.width / (format.width > 1920 ? 2 : 1) : 800;
                                const canvasHeight = format ? format.height / (format.height > 1080 ? 2 : 1) : 600;
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
                              className="vw-btn vw-btn-secondary"
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
                      
                      {/* Opacity */}
                      <div className="vw-property-group">
                        <div className="vw-property-label">
                          Opacity
                          <span className="vw-property-value-badge">{Math.round(transform.opacity || 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={transform.opacity || 100}
                          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                          className="vw-slider"
                        />
                      </div>
                      
                      {/* Rotation */}
                      <div className="vw-property-group">
                        <div className="vw-property-label">
                          Rotation
                          <span className="vw-property-value-badge">{Math.round(transform.rotation || 0)}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="-180" 
                          max="180" 
                          value={transform.rotation || 0}
                          onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
                          className="vw-slider"
                        />
                      </div>
                      
                      {/* Layer Controls */}
                      <div className="vw-property-group">
                        <div className="vw-property-label">Layer Order</div>
                        <div className="vw-layer-control-buttons">
                          <button 
                            className="vw-btn vw-btn-secondary" 
                            title="Bring Forward"
                            onClick={() => handleBringForward(selectedElementId)}
                          >
                            ⬆️ Bring Forward
                          </button>
                          <button 
                            className="vw-btn vw-btn-secondary" 
                            title="Send Backward"
                            onClick={() => handleSendBackward(selectedElementId)}
                          >
                            ⬇️ Send Backward
                          </button>
                        </div>
                      </div>
                      
                      {/* Asset Processing (Background Removal) */}
                      {element?.type === 'asset' && element?.data && (
                        <div className="vw-property-group">
                          <div className="vw-property-label" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#8b5cf6' }}>
                            🎨 Asset Processing
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {processingStatus[element.data.id]?.bg_removed || element.data.has_bg_removed ? (
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
                                className="vw-btn vw-btn-secondary"
                                onClick={() => handleRemoveBackground(element.data.id)}
                                disabled={processingAsset?.assetId === element.data.id}
                                style={{ 
                                  background: processingAsset?.assetId === element.data.id ? '#9ca3af' : '#8b5cf6',
                                  color: 'white',
                                  border: 'none'
                                }}
                                title="Remove background from this asset"
                              >
                                {processingAsset?.assetId === element.data.id ? (
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
                      <div className="vw-layer-actions">
                        <button 
                          className="vw-btn-reset"
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
                          className="vw-btn vw-btn-danger"
                          onClick={() => handleDeleteLayer(selectedElementId)}
                        >
                          🗑️ Delete Layer
                        </button>
                      </div>
                    </div>
                  );
                })()}
                
                <div className="vw-inspector-section">
                  <h4 className="vw-inspector-heading">Selected Items</h4>
                  <div className="vw-inspector-stats">
                    <div className="vw-stat">
                      <span className="vw-stat-label">Scenes:</span>
                      <span className="vw-stat-value">{selectedScenes.length}</span>
                    </div>
                    <div className="vw-stat">
                      <span className="vw-stat-label">Assets:</span>
                      <span className="vw-stat-value">{selectedAssets.length}</span>
                    </div>
                    <div className="vw-stat">
                      <span className="vw-stat-label">Wardrobe:</span>
                      <span className="vw-stat-value">{selectedWardrobes.length}</span>
                    </div>
                  </div>
                </div>

                {selectedScenes.length > 0 && (
                  <div className="vw-inspector-section">
                    <h4 className="vw-inspector-heading">Scene Roles</h4>
                    <div className="vw-role-list">
                      {selectedScenes.map(item => (
                        <div key={item.scene.id} className="vw-role-item">
                          <div className="vw-role-item-info">
                            <div className="vw-role-item-name">
                              {item.scene.title || `Scene ${item.scene.scene_number}`}
                            </div>
                            <select 
                              className="vw-role-select"
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
                  <div className="vw-inspector-section">
                    <h4 className="vw-inspector-heading">Asset Roles</h4>
                    <div className="vw-role-list">
                      {selectedAssets.map(item => (
                        <div key={item.asset.id} className="vw-role-item">
                          <div className="vw-role-item-info">
                            <div className="vw-role-item-name">{item.asset.name}</div>
                            <select 
                              className="vw-role-select"
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

                <div className="vw-inspector-section">
                  <h4 className="vw-inspector-heading">Export Settings</h4>
                  <div className="vw-format-list">
                    <label className="vw-format-option">
                      <input type="checkbox" />
                      <span>📺 YouTube (16:9)</span>
                    </label>
                    <label className="vw-format-option">
                      <input type="checkbox" />
                      <span>📱 Instagram (1:1)</span>
                    </label>
                    <label className="vw-format-option">
                      <input type="checkbox" />
                      <span>🎵 TikTok (9:16)</span>
                    </label>
                  </div>
                </div>
              </div>
          </div>
          </React.Fragment>
        </div>
      )}

      {/* Create Composition Dialog */}
      {showCreateDialog && ReactDOM.createPortal(
        <div 
          className="vw-dialog-overlay" 
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
            className="vw-dialog" 
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
            <div className="vw-dialog-header">
              <h3 className="vw-dialog-title">✨ Create New Composition</h3>
              <button 
                className="vw-dialog-close"
                onClick={handleCancelCreate}
                title="Close"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="vw-dialog-body">
              <div className="vw-form-group">
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
                <div className="vw-keyboard-hint">
                  <span>Press <kbd>Enter</kbd> to create or <kbd>Esc</kbd> to cancel</span>
                </div>
              </div>
            </div>
            <div className="vw-dialog-footer">
              <button 
                className="vw-btn vw-btn-secondary"
                onClick={handleCancelCreate}
              >
                Cancel
              </button>
              <button 
                className="vw-btn vw-btn-primary"
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
          className="vw-dialog-overlay" 
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
            className="vw-dialog" 
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
            <div className="vw-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="vw-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Select Scene Role</h3>
              <button 
                className="vw-dialog-close"
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
            <div className="vw-dialog-body" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                How will this scene be used in your composition?
              </p>
              <div className="vw-role-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {SCENE_ROLES.map(role => (
                  <button
                    key={role.id}
                    className="vw-role-card"
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
          className="vw-dialog-overlay" 
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
            className="vw-dialog" 
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
            <div className="vw-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="vw-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Select Asset Role</h3>
              <button 
                className="vw-dialog-close"
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
            <div className="vw-dialog-body" style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                How will this asset be used in your composition?
              </p>
              <div className="vw-role-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {ASSET_ROLES.map(role => (
                  <button
                    key={role.id}
                    className="vw-role-card"
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
