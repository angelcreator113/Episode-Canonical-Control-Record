import { useState, useCallback, useRef } from 'react';

/**
 * useSceneStudioState — Central state management for Scene Studio.
 *
 * Manages objects, selection, tool state, undo/redo, and canvas settings.
 * Works with both scenes (scene_id) and scene sets (scene_set_id).
 */

const MAX_HISTORY = 50;

// Normalize API object → frontend object shape
function normalizeObject(raw) {
  const asset = raw.asset || {};
  const assetUrl = asset.s3_url_processed || asset.s3_url_raw || '';
  const contentType = asset.content_type || '';

  // Determine type from object_type or content_type
  let type = raw.object_type || 'image';
  if (type === 'image' && contentType.startsWith('video/')) {
    type = 'video';
  }

  return {
    id: raw.id,
    type,
    assetId: raw.asset_id,
    assetUrl,
    x: raw.position_x || 0,
    y: raw.position_y || 0,
    width: raw.width || asset.width || 200,
    height: raw.height || asset.height || 200,
    rotation: parseFloat(raw.rotation) || 0,
    scaleX: 1,
    scaleY: 1,
    opacity: raw.opacity != null ? parseFloat(raw.opacity) : 1,
    layerOrder: raw.layer_order || 0,
    zIndex: raw.z_index || 0,
    isVisible: raw.is_visible !== false,
    isLocked: raw.is_locked === true,
    flipX: raw.flip_x === true,
    flipY: raw.flip_y === true,
    label: raw.object_label || asset.character_name || asset.location_name || `Object ${raw.layer_order || 0}`,
    assetRole: raw.asset_role || null,
    characterName: raw.character_name || null,
    usageType: raw.usage_type || 'overlay',
    cropData: raw.crop_data || null,
    styleData: raw.style_data || null,
    groupId: raw.group_id || null,
    variantGroupId: raw.variant_group_id || null,
    variantLabel: raw.variant_label || null,
    isActiveVariant: raw.is_active_variant !== false,
    sceneAngleId: raw.scene_angle_id || null,
    startTimecode: raw.start_timecode || null,
    endTimecode: raw.end_timecode || null,
    metadata: raw.metadata || {},
    // Keep raw asset reference for inspector
    _asset: asset,
  };
}

// Convert frontend object back to API shape for saving
function serializeObject(obj) {
  return {
    id: obj.id,
    asset_id: obj.assetId,
    object_type: obj.type,
    object_label: obj.label,
    usage_type: obj.usageType,
    x: Math.round(obj.x),
    y: Math.round(obj.y),
    width: obj.width ? Math.round(obj.width) : null,
    height: obj.height ? Math.round(obj.height) : null,
    rotation: obj.rotation || 0,
    scale: 1.0,
    opacity: obj.opacity,
    layer_order: obj.layerOrder,
    z_index: obj.zIndex,
    is_visible: obj.isVisible,
    is_locked: obj.isLocked,
    flip_x: obj.flipX,
    flip_y: obj.flipY,
    crop_data: obj.cropData,
    style_data: obj.styleData,
    group_id: obj.groupId,
    variant_group_id: obj.variantGroupId,
    variant_label: obj.variantLabel,
    is_active_variant: obj.isActiveVariant,
    asset_role: obj.assetRole,
    character_name: obj.characterName,
    scene_angle_id: obj.sceneAngleId,
    start_timecode: obj.startTimecode,
    end_timecode: obj.endTimecode,
    position: null,
    metadata: obj.metadata,
  };
}

export default function useSceneStudioState() {
  // Core state
  const [objects, setObjects] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTool, setActiveTool] = useState('select');
  const [clipboard, setClipboard] = useState(null);

  // Canvas settings
  const [canvasSettings, setCanvasSettings] = useState({
    zoom: 1,
    panX: 0,
    panY: 0,
    gridVisible: false,
    snapEnabled: true,
    backgroundColor: '#1a1a2e',
    statePresets: [],
  });

  // Context info
  const [contextType, setContextType] = useState(null); // 'scene' | 'sceneSet'
  const [contextId, setContextId] = useState(null);
  const [sceneData, setSceneData] = useState(null);
  const [sceneSetData, setSceneSetData] = useState(null);
  const [angles, setAngles] = useState([]);
  const [activeAngleId, setActiveAngleId] = useState(null);
  const [variantGroups, setVariantGroups] = useState([]);

  // Depth map
  const [depthMapUrl, setDepthMapUrl] = useState(null);
  const [depthEffects, setDepthEffects] = useState({
    parallaxEnabled: false,
    focusDepth: 50,
    blurIntensity: 0,
  });

  // Dirty flag
  const [isDirty, setIsDirty] = useState(false);

  // Undo/Redo
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Snap guides
  const [snapGuides, setSnapGuides] = useState([]);

  // ── History ──

  const pushHistory = useCallback((snapshot) => {
    undoStack.current.push(snapshot);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
    setIsDirty(true);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(JSON.parse(JSON.stringify(objects)));
    setObjects(prev);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    setIsDirty(true);
  }, [objects]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    undoStack.current.push(JSON.parse(JSON.stringify(objects)));
    setObjects(next);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    setIsDirty(true);
  }, [objects]);

  // ── Load from API response ──

  const loadFromApi = useCallback((data, type) => {
    setContextType(type);

    if (type === 'scene') {
      setContextId(data.scene?.id);
      setSceneData(data.scene);
      setAngles([]);
      setActiveAngleId(null);
      // Load depth map from scene canvas_settings or extra_fields
      setDepthMapUrl(data.scene?.canvas_settings?.depth_map_url || data.scene?.extra_fields?.depth_map_url || null);
    } else {
      setContextId(data.sceneSet?.id);
      setSceneSetData(data.sceneSet);
      setAngles(data.angles || []);
      setActiveAngleId(data.activeAngleId || null);
      // Load depth map from active angle
      const activeAngle = (data.angles || []).find(a => a.id === data.activeAngleId);
      setDepthMapUrl(activeAngle?.depth_map_url || null);
    }

    const normalized = (data.objects || []).map(normalizeObject);
    setObjects(normalized);
    setVariantGroups(data.variantGroups || []);

    // Load canvas settings
    const settings = type === 'scene'
      ? data.scene?.canvas_settings
      : data.sceneSet?.canvas_settings;
    if (settings) {
      setCanvasSettings((prev) => ({ ...prev, ...settings }));
    }

    // Reset history
    undoStack.current = [];
    redoStack.current = [];
    setUndoCount(0);
    setRedoCount(0);
    setIsDirty(false);
    setSelectedIds(new Set());
  }, []);

  // ── Serialize for save ──

  const serializeForSave = useCallback(() => {
    return {
      objects: objects.map(serializeObject),
      canvas_settings: canvasSettings,
    };
  }, [objects, canvasSettings]);

  // ── Object CRUD ──

  const addObject = useCallback((newObj) => {
    pushHistory(JSON.parse(JSON.stringify(objects)));
    const maxOrder = objects.reduce((max, o) => Math.max(max, o.layerOrder || 0), 0);
    const obj = {
      ...newObj,
      layerOrder: maxOrder + 1,
      isVisible: true,
      isLocked: false,
      isActiveVariant: true,
    };
    setObjects((prev) => [...prev, obj]);
    setSelectedIds(new Set([obj.id]));
    setIsDirty(true);
  }, [objects, pushHistory]);

  const removeObject = useCallback((id) => {
    pushHistory(JSON.parse(JSON.stringify(objects)));
    setObjects((prev) => prev.filter((o) => o.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIsDirty(true);
  }, [objects, pushHistory]);

  const updateObject = useCallback((id, changes) => {
    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...changes } : o))
    );
    setIsDirty(true);
  }, []);

  const updateObjectWithHistory = useCallback((id, changes) => {
    pushHistory(JSON.parse(JSON.stringify(objects)));
    updateObject(id, changes);
  }, [objects, pushHistory, updateObject]);

  // Batch update (drag end, transform end)
  const commitObjectChange = useCallback((id, changes) => {
    pushHistory(JSON.parse(JSON.stringify(objects)));
    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...changes } : o))
    );
    setIsDirty(true);
  }, [objects, pushHistory]);

  const duplicateObject = useCallback((id) => {
    const source = objects.find((o) => o.id === id);
    if (!source) return;

    pushHistory(JSON.parse(JSON.stringify(objects)));
    const maxOrder = objects.reduce((max, o) => Math.max(max, o.layerOrder || 0), 0);
    const copy = {
      ...source,
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: (source.x || 0) + 20,
      y: (source.y || 0) + 20,
      label: source.label ? `${source.label} (copy)` : 'Copy',
      layerOrder: maxOrder + 1,
      variantGroupId: null,
      variantLabel: null,
    };
    setObjects((prev) => [...prev, copy]);
    setSelectedIds(new Set([copy.id]));
    setIsDirty(true);
  }, [objects, pushHistory]);

  // ── Selection ──

  const selectObject = useCallback((id, addToSelection = false) => {
    setSelectedIds((prev) => {
      if (addToSelection) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Layer ordering ──

  const reorderObject = useCallback((id, direction) => {
    pushHistory(JSON.parse(JSON.stringify(objects)));
    setObjects((prev) => {
      const sorted = [...prev].sort((a, b) => (a.layerOrder || 0) - (b.layerOrder || 0));
      const idx = sorted.findIndex((o) => o.id === id);
      if (idx < 0) return prev;

      let targetIdx;
      if (direction === 'front') targetIdx = sorted.length - 1;
      else if (direction === 'back') targetIdx = 0;
      else if (direction === 'up') targetIdx = Math.min(sorted.length - 1, idx + 1);
      else if (direction === 'down') targetIdx = Math.max(0, idx - 1);
      else return prev;

      const [moved] = sorted.splice(idx, 1);
      sorted.splice(targetIdx, 0, moved);

      return sorted.map((o, i) => ({ ...o, layerOrder: i }));
    });
    setIsDirty(true);
  }, [objects, pushHistory]);

  // ── Visibility / Lock ──

  const toggleVisibility = useCallback((id) => {
    updateObjectWithHistory(id, {
      isVisible: !objects.find((o) => o.id === id)?.isVisible,
    });
  }, [objects, updateObjectWithHistory]);

  const toggleLock = useCallback((id) => {
    updateObjectWithHistory(id, {
      isLocked: !objects.find((o) => o.id === id)?.isLocked,
    });
  }, [objects, updateObjectWithHistory]);

  // ── Clipboard ──

  const copySelected = useCallback(() => {
    const selected = objects.filter((o) => selectedIds.has(o.id));
    if (selected.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(selected)));
    }
  }, [objects, selectedIds]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    pushHistory(JSON.parse(JSON.stringify(objects)));

    const maxOrder = objects.reduce((max, o) => Math.max(max, o.layerOrder || 0), 0);
    const newIds = new Set();

    const pasted = clipboard.map((obj, i) => {
      const id = `obj-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      newIds.add(id);
      return {
        ...obj,
        id,
        x: (obj.x || 0) + 30,
        y: (obj.y || 0) + 30,
        layerOrder: maxOrder + i + 1,
      };
    });

    setObjects((prev) => [...prev, ...pasted]);
    setSelectedIds(newIds);
    setIsDirty(true);
  }, [clipboard, objects, pushHistory]);

  // ── Zoom / Pan ──

  const setZoom = useCallback((newZoom, newPan) => {
    setCanvasSettings((prev) => ({
      ...prev,
      zoom: newZoom,
      ...(newPan ? { panX: newPan.x, panY: newPan.y } : {}),
    }));
  }, []);

  const setPan = useCallback((x, y) => {
    setCanvasSettings((prev) => ({ ...prev, panX: x, panY: y }));
  }, []);

  const fitToScreen = useCallback((containerWidth, containerHeight, canvasWidth, canvasHeight) => {
    const scaleX = containerWidth / canvasWidth;
    const scaleY = containerHeight / canvasHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9;
    const panX = (containerWidth - canvasWidth * scale) / 2;
    const panY = (containerHeight - canvasHeight * scale) / 2;
    setCanvasSettings((prev) => ({ ...prev, zoom: scale, panX, panY }));
  }, []);

  // ── Variant operations ──

  const activateVariant = useCallback((variantGroupId, variantId) => {
    pushHistory(JSON.parse(JSON.stringify(objects)));
    setObjects((prev) =>
      prev.map((o) => {
        if (o.variantGroupId !== variantGroupId) return o;
        return { ...o, isActiveVariant: o.id === variantId };
      })
    );
    setIsDirty(true);
  }, [objects, pushHistory]);

  // ── Canvas settings ──

  const updateCanvasSettings = useCallback((changes) => {
    setCanvasSettings((prev) => ({ ...prev, ...changes }));
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  return {
    // State
    objects,
    selectedIds,
    activeTool,
    canvasSettings,
    contextType,
    contextId,
    sceneData,
    sceneSetData,
    angles,
    activeAngleId,
    variantGroups,
    isDirty,
    undoCount,
    redoCount,
    snapGuides,
    clipboard,
    depthMapUrl,
    depthEffects,

    // Actions
    loadFromApi,
    serializeForSave,
    addObject,
    removeObject,
    updateObject,
    updateObjectWithHistory,
    commitObjectChange,
    duplicateObject,
    selectObject,
    deselectAll,
    reorderObject,
    toggleVisibility,
    toggleLock,
    copySelected,
    pasteClipboard,
    undo,
    redo,
    setActiveTool,
    setZoom,
    setPan,
    fitToScreen,
    setActiveAngleId,
    activateVariant,
    updateCanvasSettings,
    setSnapGuides,
    markClean,
    setObjects,
    setSceneData,
    setSceneSetData,
    setDepthMapUrl,
    setDepthEffects,
  };
}

// Export normalize/serialize for use in service layer
export { normalizeObject, serializeObject };
