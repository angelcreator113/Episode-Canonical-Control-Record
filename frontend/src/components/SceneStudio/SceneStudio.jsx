import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Plus, Image, Upload, Sparkles, Pentagon, Type } from 'lucide-react';
import StudioCanvas from './Canvas/StudioCanvas';
import MaskLayer from './Canvas/MaskLayer';
import Toolbar, { PLATFORM_PRESETS } from './Toolbar';
import GuidedFlow from './GuidedFlow';
import CreationPanel from './panels/CreationPanel';
import InspectorPanel from './panels/InspectorPanel';
import SmartSuggestions from './panels/SmartSuggestions';
import EraseBrushCanvas from './EraseBrushCanvas';
import useSceneStudioState from './useSceneStudioState';
import sceneService from '../../services/sceneService';
import './SceneStudio.css';

/**
 * SceneStudio — Main orchestrator component for the Canva-like scene editor.
 *
 * Works with both scenes (sceneId) and scene sets (sceneSetId).
 * Loads canvas state from API, manages all panels, handles keyboard shortcuts,
 * and auto-saves.
 */

function slugify(str) {
  return (str || 'scene')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/\s--\s/g, ' — ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const QUICK_ADD_OPTIONS = [
  { key: 'generate', label: 'Generate', icon: Sparkles },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'library', label: 'Library', icon: Image },
  { key: 'text', label: 'Text', icon: Type },
  { key: 'shapes', label: 'Shapes', icon: Pentagon },
];

export default function SceneStudio({ sceneId, sceneSetId, showId, episodeId, onBack }) {
  const state = useSceneStudioState();
  const canvasContainerRef = useRef(null);
  const stageRef = useRef(null);
  const [platform, setPlatform] = useState('youtube');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const isSavingRef = useRef(false);
  const saveStatusTimerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTextId, setEditingTextId] = useState(null);
  const [error, setError] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState(null);
  const saveTimerRef = useRef(null);
  const saveRef = useRef(null);

  // Lifted creation panel state
  const [activeCreationTab, setActiveCreationTab] = useState('objects');
  const [isCreationPanelOpen, setCreationPanelOpen] = useState(true);
  const [focusTarget, setFocusTarget] = useState(null);

  // Depth estimation state
  const [isGeneratingDepth, setIsGeneratingDepth] = useState(false);
  const [depthError, setDepthError] = useState(null);

  // Background mood/time state
  const [mood, setMood] = useState(null);
  const [timeOfDay, setTimeOfDay] = useState(null);
  const [isRegeneratingBg, setIsRegeneratingBg] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, objectId }

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState('png');

  // Erase / inpaint state
  const [hasMask, setHasMask] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [isInpainting, setIsInpainting] = useState(false);
  const [inpaintPrompt, setInpaintPrompt] = useState('');
  const [exportScale, setExportScale] = useState(2);

  // Background removal state
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // UX guidance state
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showFirstHint, setShowFirstHint] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [backgroundSelected, setBackgroundSelected] = useState(false);
  const prevObjectCountRef = useRef(0);

  // Erase (inpainting) state
  const [isEraseProcessing, setIsEraseProcessing] = useState(false);
  const [eraseError, setEraseError] = useState(null);
  const [eraseVariations, setEraseVariations] = useState([]);
  const [inpaintHistory, setInpaintHistory] = useState([]);

  const canvasWidth = PLATFORM_PRESETS[platform]?.width || 1920;
  const canvasHeight = PLATFORM_PRESETS[platform]?.height || 1080;

  // ── Load canvas data ──

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        if (sceneId) {
          const result = await sceneService.getCanvas(sceneId);
          if (result.success) {
            state.loadFromApi(result.data, 'scene');
            const cs = result.data.scene?.canvas_settings;
            if (cs?.platform && PLATFORM_PRESETS[cs.platform]) setPlatform(cs.platform);
            if (cs?.mood) setMood(cs.mood);
            if (cs?.timeOfDay) setTimeOfDay(cs.timeOfDay);
          }
        } else if (sceneSetId) {
          const result = await sceneService.getSceneSetCanvas(sceneSetId);
          if (result.success) {
            state.loadFromApi(result.data, 'sceneSet');
            const savedPlatform = result.data.sceneSet?.canvas_settings?.platform;
            if (savedPlatform && PLATFORM_PRESETS[savedPlatform]) setPlatform(savedPlatform);
          }
        }
      } catch (err) {
        console.error('Scene Studio load error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [sceneId, sceneSetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const save = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!state.contextId) {
      console.error('Scene Studio save: no contextId — scene not loaded');
      setSaveStatus('error');
      setSaveErrorMsg('Scene not loaded — try refreshing');
      return;
    }
    isSavingRef.current = true;
    setSaveErrorMsg(null);
    // Cancel any pending auto-save to avoid double-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    setSaveStatus('saving');
    const startTime = Date.now();
    try {
      const payload = state.serializeForSave();
      // Include platform in canvas_settings for persistence
      if (payload.canvas_settings) {
        payload.canvas_settings.platform = platform;
        if (mood) payload.canvas_settings.mood = mood;
        if (timeOfDay) payload.canvas_settings.timeOfDay = timeOfDay;
      }
      console.log('Scene Studio saving:', { contextType: state.contextType, contextId: state.contextId, objectCount: payload.objects?.length });
      let result;
      if (state.contextType === 'scene') {
        result = await sceneService.saveCanvas(state.contextId, payload);
      } else {
        result = await sceneService.saveSceneSetCanvas(state.contextId, payload);
      }
      console.log('Scene Studio save result:', result);
      state.markClean();
      // Ensure "Saving..." shows for at least 600ms so it doesn't flicker
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 600 - elapsed);
      await new Promise((r) => setTimeout(r, remaining));
      if (!mountedRef.current) return;
      setSaveStatus('saved');
      // Show "Saved" confirmation for 2s then go back to idle
      saveStatusTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Scene Studio save error:', err);
      const msg = err.response?.data?.error || err.message || 'Save failed';
      console.error('Scene Studio save error detail:', msg);

      // Auto-retry once on network errors
      const isNetworkError = !err.response || err.code === 'ECONNABORTED';
      if (isNetworkError && !save._retried) {
        save._retried = true;
        console.log('Scene Studio: retrying save in 2s...');
        isSavingRef.current = false;
        await new Promise((r) => setTimeout(r, 2000));
        if (mountedRef.current) {
          save._retried = false;
          return save();
        }
      }
      save._retried = false;

      if (mountedRef.current) {
        setSaveStatus('error');
        setSaveErrorMsg(msg);
        // Auto-retry after 10s if still dirty
        saveTimerRef.current = setTimeout(() => {
          if (mountedRef.current && state.isDirty && saveRef.current) {
            console.log('Scene Studio: auto-retrying save...');
            saveRef.current();
          }
        }, 10000);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [state, platform, mood, timeOfDay]);

  // Keep a stable ref to the latest save function so auto-save never goes stale
  useEffect(() => { saveRef.current = save; }, [save]);

  // Auto-save (3s debounce)
  useEffect(() => {
    if (!state.isDirty || isLoading) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (saveRef.current) saveRef.current();
    }, 3000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.isDirty, state.objects, state.depthEffects, state.depthMapUrl, isLoading]);

  // ── Track first object add (for overlay + hint) ──

  useEffect(() => {
    const prevCount = prevObjectCountRef.current;
    const curCount = state.objects.length;
    prevObjectCountRef.current = curCount;

    if (prevCount === 0 && curCount > 0 && !hasInteracted) {
      setHasInteracted(true);
      setShowFirstHint(true);
      const timer = setTimeout(() => setShowFirstHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.objects.length, hasInteracted]);

  // Dismiss first hint on any click/keydown
  useEffect(() => {
    if (!showFirstHint) return;
    const dismiss = () => setShowFirstHint(false);
    window.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [showFirstHint]);

  // ── Quick Add helpers ──

  const handleQuickAdd = useCallback((tabKey) => {
    setCreationPanelOpen(true);
    setActiveCreationTab(tabKey);
    const focusMap = { library: 'library-search', upload: 'upload-zone', generate: 'generate-prompt' };
    if (focusMap[tabKey]) setFocusTarget(focusMap[tabKey]);
    setQuickAddOpen(false);
  }, []);

  const handleOverlayCta = useCallback((tabKey) => {
    handleQuickAdd(tabKey);
  }, [handleQuickAdd]);

  // Close Quick Add popup on outside click / Escape
  useEffect(() => {
    if (!quickAddOpen) return;
    const close = (e) => {
      if (e.key === 'Escape' || e.type === 'mousedown') setQuickAddOpen(false);
    };
    // Delay to avoid immediate close from the same click
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('keydown', close);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [quickAddOpen]);

  // ── Title editing ──

  const handleTitleChange = useCallback(async (newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    const trimmed = newTitle.trim();
    const id = sceneId || sceneSetId;
    if (!id) return;

    // Optimistic update via state setter (triggers re-render)
    if (state.contextType === 'scene') {
      state.setSceneData((prev) => prev ? { ...prev, title: trimmed } : prev);
    } else if (state.contextType === 'sceneSet') {
      state.setSceneSetData((prev) => prev ? { ...prev, name: trimmed } : prev);
    }

    try {
      if (state.contextType === 'scene') {
        await sceneService.updateScene(id, { title: trimmed });
      } else {
        await sceneService.updateSceneSet(id, { name: trimmed });
      }
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  }, [sceneId, sceneSetId, state]);

  // ── Background URL (from scene or scene set angle) ──
  // IMPORTANT: Must be defined BEFORE any callbacks that reference it (TDZ fix)

  const backgroundUrl = (() => {
    if (state.contextType === 'scene') {
      const s = state.sceneData;
      return s?.background_url
        || s?.sceneAngle?.enhanced_still_url
        || s?.sceneAngle?.still_image_url
        || s?.sceneSet?.base_still_url
        || null;
    }
    if (state.contextType === 'sceneSet') {
      const angle = state.angles?.find((a) => a.id === state.activeAngleId);
      return angle?.still_image_url || state.sceneSetData?.base_still_url || null;
    }
    return null;
  })();

  // ── Erase (Inpainting) ──

  const handleEraseApply = useCallback(async (maskDataUrl, options = {}) => {
    if (isEraseProcessing || !state.contextId || !backgroundUrl) return;

    const { prompt, strength = 0.85, variationCount = 1 } = options;

    setIsEraseProcessing(true);
    setEraseError(null);
    setEraseVariations([]);

    try {
      // Save current background to history before modifying
      const historyEntry = {
        url: backgroundUrl,
        thumbnail: backgroundUrl,
        timestamp: new Date().toLocaleTimeString(),
      };

      if (variationCount > 1) {
        // Generate multiple variations
        const variationPromises = [];
        for (let i = 0; i < variationCount; i++) {
          variationPromises.push(
            sceneService.inpaintScene(state.contextId, {
              imageUrl: backgroundUrl,
              maskDataUrl,
              prompt: prompt || 'Remove the selected area and fill with a natural continuation of the background',
              strength,
            })
          );
        }

        const results = await Promise.allSettled(variationPromises);
        const successfulVariations = results
          .filter((r) => r.status === 'fulfilled' && r.value?.success && r.value?.data?.inpainted_url)
          .map((r, i) => ({
            url: r.value.data.inpainted_url,
            score: r.value.data.quality_score || null,
          }));

        if (successfulVariations.length > 0) {
          setEraseVariations(successfulVariations);
          // Don't close erase mode yet - wait for user to pick a variation
        } else {
          setEraseError('All variations failed — please try again');
        }
      } else {
        // Single generation (original behavior)
        const result = await sceneService.inpaintScene(state.contextId, {
          imageUrl: backgroundUrl,
          maskDataUrl,
          prompt: prompt || 'Remove the selected area and fill with a natural continuation of the background',
          strength,
        });

        if (result?.success && result.data?.inpainted_url) {
          // Add to history
          setInpaintHistory((prev) => [historyEntry, ...prev].slice(0, 10));
          
          // Update the background with the inpainted image
          if (state.contextType === 'scene') {
            state.setSceneData((prev) => prev ? { ...prev, background_url: result.data.inpainted_url } : prev);
          }
          // Also save the canvas so the new background persists
          await save();
          state.setActiveTool('select');
        } else {
          setEraseError(result?.data?.error || 'Inpainting failed — please try again');
        }
      }
    } catch (err) {
      console.error('Erase/inpaint error:', err);
      setEraseError(err.response?.data?.error || err.message || 'Erase failed');
    } finally {
      setIsEraseProcessing(false);
    }
  }, [isEraseProcessing, state, backgroundUrl, save]);

  const handleSelectVariation = useCallback(async (index) => {
    const variation = eraseVariations[index];
    if (!variation) return;

    // Save current background to history
    const historyEntry = {
      url: backgroundUrl,
      thumbnail: backgroundUrl,
      timestamp: new Date().toLocaleTimeString(),
    };
    setInpaintHistory((prev) => [historyEntry, ...prev].slice(0, 10));

    // Apply selected variation
    if (state.contextType === 'scene') {
      state.setSceneData((prev) => prev ? { ...prev, background_url: variation.url } : prev);
    }
    await save();
    
    setEraseVariations([]);
    state.setActiveTool('select');
  }, [eraseVariations, backgroundUrl, state, save]);

  const handleEraseRevert = useCallback(async (historyIndex) => {
    const historyItem = inpaintHistory[historyIndex];
    if (!historyItem) return;

    // Restore the historical background
    if (state.contextType === 'scene') {
      state.setSceneData((prev) => prev ? { ...prev, background_url: historyItem.url } : prev);
    }
    await save();
    
    // Remove this and all newer items from history
    setInpaintHistory((prev) => prev.slice(historyIndex + 1));
    state.setActiveTool('select');
  }, [inpaintHistory, state, save]);

  const handleEraseCancel = useCallback(() => {
    state.setActiveTool('select');
    setEraseError(null);
    setEraseVariations([]);
  }, [state]);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
      if (isInput) return;

      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
      }
      // Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        state.redo();
      }
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.selectedIds.forEach((id) => state.removeObject(id));
      }
      // Arrow key nudge (1px, or 10px with shift)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.selectedIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        state.selectedIds.forEach((id) => {
          const obj = state.objects.find((o) => o.id === id);
          if (obj) state.updateObject(id, { x: (obj.x || 0) + dx, y: (obj.y || 0) + dy });
        });
      }
      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        state.copySelected();
      }
      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        state.pasteClipboard();
      }
      // Escape
      if (e.key === 'Escape') {
        state.deselectAll();
      }
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') state.setActiveTool('select');
      if (e.key === 'h' || e.key === 'H') state.setActiveTool('hand');
      if (e.key === 't' || e.key === 'T') state.setActiveTool('text');
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) state.setActiveTool('shape');
      if (e.key === 'e' || e.key === 'E') state.setActiveTool('erase');
      // Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, save]);

  // ── Context menu ──

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    // Find if we right-clicked on an object
    const target = e.target;
    const studioObj = target.closest?.('.scene-studio-object-row');
    if (studioObj) return; // Let ObjectsPanel handle its own context
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  // ── Tool actions (click on canvas to add text/shape) ──

  const handleCanvasClickForTool = useCallback(() => {
    if (state.activeTool === 'text') {
      state.addObject({
        id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        assetId: null,
        assetUrl: '',
        x: canvasWidth / 2 - 100,
        y: canvasHeight / 2 - 20,
        width: 200,
        height: 40,
        rotation: 0,
        opacity: 1,
        label: 'Text',
        styleData: {
          textContent: 'Double-click to edit',
          fontSize: 24,
          fontFamily: 'Lora, serif',
          fill: '#FFFFFF',
        },
      });
      state.setActiveTool('select');
    }
    if (state.activeTool === 'shape') {
      state.addObject({
        id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'shape',
        assetId: null,
        assetUrl: '',
        x: canvasWidth / 2 - 75,
        y: canvasHeight / 2 - 50,
        width: 150,
        height: 100,
        rotation: 0,
        opacity: 1,
        label: 'Shape',
        styleData: {
          shapeType: 'rect',
          fill: 'rgba(102, 126, 234, 0.3)',
          stroke: '#667eea',
          strokeWidth: 2,
          cornerRadius: 8,
        },
      });
      state.setActiveTool('select');
    }
  }, [state, canvasWidth, canvasHeight]);

  // ── Depth Map Generation ──

  const handleGenerateDepth = useCallback(async () => {
    if (isGeneratingDepth) return;

    if (!state.contextId) {
      setDepthError('Scene not loaded — cannot generate depth map');
      return;
    }
    if (!backgroundUrl) {
      setDepthError('No background image — add a background first');
      return;
    }

    setIsGeneratingDepth(true);
    setDepthError(null);
    try {
      let result;
      if (state.contextType === 'scene') {
        result = await sceneService.generateDepth(state.contextId, backgroundUrl);
      } else if (state.contextType === 'sceneSet' && state.activeAngleId) {
        result = await sceneService.generateAngleDepth(state.contextId, state.activeAngleId);
      } else {
        setDepthError('Select a camera angle first');
        setIsGeneratingDepth(false);
        return;
      }
      if (result?.success && result.data?.depth_map_url) {
        state.updateDepthMapUrl(result.data.depth_map_url);
      } else {
        setDepthError('Depth map generation returned no result');
      }
    } catch (err) {
      console.error('Depth generation error:', err);
      const msg = err.response?.data?.error || err.message || 'Depth generation failed';
      setDepthError(msg);
    } finally {
      setIsGeneratingDepth(false);
    }
  }, [isGeneratingDepth, state.contextType, state.contextId, state.activeAngleId, backgroundUrl, state]);

  const handleUpdateDepthEffects = useCallback((updates) => {
    state.updateDepthEffects((prev) => ({ ...prev, ...updates }));
  }, [state]);

  // ── Background mood/time ──

  // Core regeneration — accepts overrides so mood/time changes can trigger immediately
  const regenerateBackground = useCallback(async (overrides = {}) => {
    if (isRegeneratingBg || !state.contextId || !backgroundUrl) return;
    const effectiveMood = overrides.mood !== undefined ? overrides.mood : mood;
    const effectiveTime = overrides.timeOfDay !== undefined ? overrides.timeOfDay : timeOfDay;
    setIsRegeneratingBg(true);
    try {
      const result = await sceneService.regenerateBackground(state.contextId, {
        mood: effectiveMood,
        timeOfDay: effectiveTime,
        currentBackgroundUrl: backgroundUrl,
      });
      if (result?.success && result.data?.restyled_url) {
        const newBgUrl = result.data.restyled_url;
        // Backend already updates background_url, just update frontend state
        if (state.contextType === 'scene') {
          state.setSceneData((prev) => prev ? { ...prev, background_url: newBgUrl } : prev);
        }
      }
    } catch (err) {
      console.error('Background regeneration error:', err);
    } finally {
      setIsRegeneratingBg(false);
    }
  }, [isRegeneratingBg, state, mood, timeOfDay, backgroundUrl]);

  const handleMoodChange = useCallback((newMood) => {
    setMood(newMood);
    state.updateCanvasSettings({ mood: newMood });
    // Auto-regenerate background with new mood if we have a background
    if (newMood && backgroundUrl) {
      regenerateBackground({ mood: newMood });
    }
  }, [state, backgroundUrl, regenerateBackground]);

  const handleTimeOfDayChange = useCallback((newTime) => {
    setTimeOfDay(newTime);
    state.updateCanvasSettings({ timeOfDay: newTime });
    // Auto-regenerate background with new time of day if we have a background
    if (newTime && backgroundUrl) {
      regenerateBackground({ timeOfDay: newTime });
    }
  }, [state, backgroundUrl, regenerateBackground]);

  const handleRegenerateBackground = useCallback(() => {
    regenerateBackground();
  }, [regenerateBackground]);

  const handleChangeBackground = useCallback(() => {
    setCreationPanelOpen(true);
    setActiveCreationTab('library');
    setFocusTarget('library-search');
  }, []);

  const handleSuggestionClick = useCallback((prompt) => {
    setCreationPanelOpen(true);
    setActiveCreationTab('generate');
    setFocusTarget(`generate-prefill:${prompt}`);
  }, []);

  const handleSelectTemplate = useCallback(async (template) => {
    // Generate background from template prompt
    if (!state.contextId || !template.prompt) return;
    setIsRegeneratingBg(true);
    setSaveErrorMsg(null);
    try {
      // Use the objectGenerationService to create a scene background from the template
      const result = await sceneService.regenerateBackground(state.contextId, {
        mood: 'warm',
        timeOfDay: 'day',
        currentBackgroundUrl: null,
      });
      // If no restyle possible (no existing bg), generate fresh via the generate tab
      setCreationPanelOpen(true);
      setActiveCreationTab('generate');
      setFocusTarget(`generate-prefill:${template.prompt}`);
    } catch (err) {
      // Fallback: just prefill the generate tab with the template prompt
      setCreationPanelOpen(true);
      setActiveCreationTab('generate');
      setFocusTarget(`generate-prefill:${template.prompt}`);
    } finally {
      setIsRegeneratingBg(false);
    }
  }, [state]);

  // Proxy depth map URL through backend to avoid S3 CORS issues.
  // ParallaxLayer needs crossOrigin pixel access (getImageData) which
  // requires CORS headers that the S3 bucket may not provide.
  // Pass the raw S3 URL as ?url= fallback for freshly generated maps
  // that haven't been persisted to DB yet.
  const proxiedDepthMapUrl = useMemo(() => {
    if (!state.depthMapUrl) return null;
    const urlParam = encodeURIComponent(state.depthMapUrl);
    if (state.contextType === 'scene' && state.contextId) {
      return `/api/v1/scenes/${state.contextId}/depth-map?url=${urlParam}`;
    }
    if (state.contextType === 'sceneSet' && state.contextId && state.activeAngleId) {
      return `/api/v1/scene-sets/${state.contextId}/angles/${state.activeAngleId}/depth-map?url=${urlParam}`;
    }
    return state.depthMapUrl;
  }, [state.depthMapUrl, state.contextType, state.contextId, state.activeAngleId]);

  const rawTitle = state.contextType === 'scene'
    ? state.sceneData?.title || ''
    : state.sceneSetData?.name || '';
  const studioTitle = rawTitle || (state.contextType === 'scene' ? 'Scene Studio' : 'Scene Set Studio');

  // ── Export ──

  // ── Use in Timeline ──

  const handleUseInTimeline = useCallback(async () => {
    if (!state.contextId || state.contextType !== 'scene') return;
    try {
      // Save first to ensure latest state is persisted
      await save();
      // Mark scene as ready for timeline
      await sceneService.updateScene(state.contextId, { production_status: 'storyboarded' });
      state.setSceneData((prev) => prev ? { ...prev, production_status: 'storyboarded' } : prev);
    } catch (err) {
      console.error('Use in Timeline error:', err);
    }
  }, [state, save]);

  // ── Inpaint (erase) ──

  const handleInpaint = useCallback(async () => {
    if (isInpainting || !state.contextId) return;
    if (!hasMask) return;

    // Determine target: selected object's image or the scene background
    const selectedObj = state.selectedIds.size === 1
      ? state.objects.find((o) => state.selectedIds.has(o.id))
      : null;
    const targetUrl = (selectedObj?.type === 'image' && selectedObj?.assetUrl)
      ? selectedObj.assetUrl
      : backgroundUrl;

    if (!targetUrl) {
      setSaveErrorMsg('No image to erase from — select an image object or ensure background is set');
      return;
    }

    setIsInpainting(true);
    setSaveErrorMsg(null);
    try {
      const maskDataUrl = MaskLayer._exportMask();
      if (!maskDataUrl) {
        setIsInpainting(false);
        return;
      }

      const prompt = inpaintPrompt || 'clean seamless continuation of surrounding area, matching style and lighting';
      const result = await sceneService.inpaintScene(state.contextId, {
        imageUrl: targetUrl,
        maskDataUrl,
        prompt,
      });

      if (result?.success && result.data?.inpainted_url) {
        if (selectedObj?.type === 'image' && selectedObj?.assetUrl) {
          // Update the selected object's image
          state.setObjects((prev) => prev.map((o) =>
            o.id === selectedObj.id ? { ...o, assetUrl: result.data.inpainted_url } : o
          ));
        } else {
          // Update the scene background
          state.setSceneData((prev) => prev ? { ...prev, background_url: result.data.inpainted_url } : prev);
        }
        // Clear the mask
        if (typeof MaskLayer._clearMask === 'function') MaskLayer._clearMask();
        setHasMask(false);
        setInpaintPrompt('');
      }
    } catch (err) {
      console.error('Inpaint error:', err);
      setSaveErrorMsg(err.response?.data?.error || err.message || 'Inpainting failed');
    } finally {
      setIsInpainting(false);
    }
  }, [isInpainting, state, backgroundUrl, hasMask, inpaintPrompt]);

  // ── Remove Background from selected object ──

  const handleRemoveBackground = useCallback(async (objectId, assetId) => {
    if (isRemovingBg || !assetId) return;
    setIsRemovingBg(true);
    setSaveErrorMsg(null);
    try {
      const assetService = (await import('../../services/assetService')).default;
      const result = await assetService.removeBackground(assetId);
      // Backend returns { status: 'SUCCESS', data: { url } }
      const newUrl = result?.data?.url || result?.url;
      if (newUrl) {
        // Update the object's asset URL to the transparent version
        state.setObjects((prev) => prev.map((o) =>
          o.id === objectId ? {
            ...o,
            assetUrl: newUrl,
            _asset: { ...o._asset, s3_url_processed: newUrl },
          } : o
        ));
        state.markDirty?.() || (() => {})(); // trigger auto-save
      } else {
        setSaveErrorMsg('Background removal returned no URL — check REMOVEBG_API_KEY');
      }
    } catch (err) {
      console.error('Remove background error:', err);
      setSaveErrorMsg(err.message || 'Background removal failed — check REMOVEBG_API_KEY');
    } finally {
      setIsRemovingBg(false);
    }
  }, [isRemovingBg, state]);

  const handleExport = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const doExport = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const pixelRatio = exportScale;
    const mimeType = exportFormat === 'jpg' ? 'image/jpeg' : exportFormat === 'webp' ? 'image/webp' : 'image/png';
    const quality = exportFormat === 'png' ? undefined : 0.9;
    const ext = exportFormat;

    const dataUrl = stage.toDataURL({ pixelRatio, mimeType, quality });
    const link = document.createElement('a');
    link.download = `${slugify(rawTitle || 'scene')}.${ext}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportDialog(false);
  }, [exportScale, exportFormat, canvasWidth, rawTitle]);

  // ── Zoom handlers ──

  const handleZoomIn = useCallback(() => {
    state.setZoom(Math.min(5, state.canvasSettings.zoom * 1.2));
  }, [state]);

  const handleZoomOut = useCallback(() => {
    state.setZoom(Math.max(0.1, state.canvasSettings.zoom / 1.2));
  }, [state]);

  const handleFitToScreen = useCallback(() => {
    if (canvasContainerRef.current) {
      const { clientWidth, clientHeight } = canvasContainerRef.current;
      state.fitToScreen(clientWidth, clientHeight, canvasWidth, canvasHeight);
    }
  }, [state, canvasWidth, canvasHeight]);

  // Fit on first load — use ResizeObserver so we fit once the container
  // has its final dimensions (after panels finish rendering)
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (isLoading || hasFittedRef.current) return;
    const el = canvasContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0 && !hasFittedRef.current) {
        hasFittedRef.current = true;
        handleFitToScreen();
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="scene-studio-loading-screen">
        <div className="scene-studio-spinner" />
        <span>Loading Scene Studio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scene-studio-error-screen">
        <p>Failed to load: {error}</p>
        <button className="scene-studio-btn primary" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="scene-studio">
      {/* Toolbar */}
      <Toolbar
        activeTool={state.activeTool}
        onSetTool={state.setActiveTool}
        zoom={state.canvasSettings.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        undoCount={state.undoCount}
        redoCount={state.redoCount}
        onUndo={state.undo}
        onRedo={state.redo}
        isDirty={state.isDirty}
        saveStatus={saveStatus}
        onSave={save}
        onExport={handleExport}
        title={formatTitle(rawTitle) || studioTitle}
        rawTitle={rawTitle}
        onTitleChange={handleTitleChange}
        platform={platform}
        onPlatformChange={(p) => { setPlatform(p); state.updateCanvasSettings({ platform: p }); }}
        gridVisible={state.canvasSettings.gridVisible}
        onToggleGrid={() => state.updateCanvasSettings({ gridVisible: !state.canvasSettings.gridVisible })}
        onBack={onBack}
        onUseInTimeline={state.contextType === 'scene' ? handleUseInTimeline : undefined}
        productionStatus={state.sceneData?.production_status}
      />

      {/* Save error banner */}
      {saveErrorMsg && (
        <div className="scene-studio-save-error-banner">
          Save failed: {saveErrorMsg}
          <button className="scene-studio-icon-btn" onClick={() => setSaveErrorMsg(null)} style={{ marginLeft: 'auto' }}>×</button>
        </div>
      )}
      {/* Guided Flow Stepper */}
      <GuidedFlow
        hasBackground={!!backgroundUrl}
        objectCount={state.objects.length}
        hasEffects={state.objects.some((o) => o.styleData?.shadow?.enabled || o.styleData?.blur > 0)}
        dismissed={state.canvasSettings.guidedFlowDismissed}
        onDismiss={() => state.updateCanvasSettings({ guidedFlowDismissed: true })}
      />

      <div className="scene-studio-body">
        {/* Left Panel */}
        {isCreationPanelOpen && (
          <div className="scene-studio-left-panel">
            <CreationPanel
              showId={showId}
              episodeId={episodeId}
              sceneId={sceneId || sceneSetId}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              onAddAsset={state.addObject}
              onAddObject={state.addObject}
              objects={state.objects}
              selectedIds={state.selectedIds}
              onSelect={state.selectObject}
              onToggleVisibility={state.toggleVisibility}
              onToggleLock={state.toggleLock}
              onReorder={state.reorderObject}
              onDelete={state.removeObject}
              onDuplicate={state.duplicateObject}
              onRequestTextEdit={(id) => setEditingTextId(id)}
              activeTab={activeCreationTab}
              onTabChange={setActiveCreationTab}
              focusTarget={focusTarget}
              onClearFocus={() => setFocusTarget(null)}
              hasBackground={!!backgroundUrl}
              contextType={state.contextType}
              sceneStates={state.canvasSettings.sceneStates}
              activeSceneState={state.canvasSettings.activeSceneState}
              onCreateState={state.createSceneState}
              onActivateState={state.activateSceneState}
              onDeleteState={state.deleteSceneState}
              onRenameState={state.renameSceneState}
              onSelectTemplate={handleSelectTemplate}
            />
            <SmartSuggestions
              sceneId={sceneId}
              objectCount={state.objects.length}
              hasBackground={!!backgroundUrl}
              onSuggestionClick={handleSuggestionClick}
              contextType={state.contextType}
            />
          </div>
        )}

        {/* Canvas */}
        <div className="scene-studio-canvas-container" ref={canvasContainerRef} onContextMenu={handleContextMenu}>
          <StudioCanvas
            ref={stageRef}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            backgroundUrl={backgroundUrl}
            objects={state.objects}
            selectedIds={state.selectedIds}
            activeTool={state.activeTool}
            zoom={state.canvasSettings.zoom}
            panX={state.canvasSettings.panX}
            panY={state.canvasSettings.panY}
            snapGuides={state.snapGuides}
            gridVisible={state.canvasSettings.gridVisible}
            editingTextId={editingTextId}
            onClearEditingText={() => setEditingTextId(null)}
            backgroundSelected={backgroundSelected}
            onBackgroundSelect={() => {
              state.deselectAll();
              setBackgroundSelected(true);
            }}
            onSelect={(id, shiftKey) => {
              setBackgroundSelected(false);
              state.selectObject(id, shiftKey);
            }}
            onDeselect={() => {
              state.deselectAll();
              setBackgroundSelected(false);
              handleCanvasClickForTool();
            }}
            onUpdateObject={state.updateObject}
            onDragEnd={state.commitObjectChange}
            onTransformEnd={state.commitObjectChange}
            onZoom={state.setZoom}
            onPan={state.setPan}
            containerRef={canvasContainerRef}
            depthMapUrl={proxiedDepthMapUrl}
            depthEffects={state.depthEffects}
            brushSize={brushSize}
            onMaskChange={setHasMask}
          />

          {/* Erase brush overlay (visible when erase tool is active) */}
          {state.activeTool === 'erase' && backgroundUrl && (
            <EraseBrushCanvas
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              zoom={state.canvasSettings.zoom}
              panX={state.canvasSettings.panX}
              panY={state.canvasSettings.panY}
              backgroundUrl={backgroundUrl}
              onApply={handleEraseApply}
              onCancel={handleEraseCancel}
              isProcessing={isEraseProcessing}
              variations={eraseVariations}
              onSelectVariation={handleSelectVariation}
              inpaintHistory={inpaintHistory}
              onRevert={handleEraseRevert}
            />
          )}

          {/* Erase error toast */}
          {eraseError && (
            <div className="scene-studio-erase-error">
              {eraseError}
              <button onClick={() => setEraseError(null)}>×</button>
            </div>
          )}

          {/* Empty canvas guidance overlay — hide when background is already set */}
          {state.objects.length === 0 && !hasInteracted && !backgroundUrl && (
            <div className="scene-studio-canvas-overlay">
              <div className="scene-studio-canvas-overlay-inner">
                <p className="scene-studio-overlay-title">Start building your scene</p>
                <div className="scene-studio-overlay-ctas">
                  <button className="scene-studio-overlay-cta" onClick={() => handleOverlayCta('library')}>
                    <Image size={16} /> Add from Library
                  </button>
                  <button className="scene-studio-overlay-cta" onClick={() => handleOverlayCta('upload')}>
                    <Upload size={16} /> Upload
                  </button>
                  <button className="scene-studio-overlay-cta" onClick={() => handleOverlayCta('generate')}>
                    <Sparkles size={16} /> Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* First-object hint tooltip */}
          {showFirstHint && (
            <div className="scene-studio-first-hint">
              Drag to move &bull; Handles to resize &bull; Delete to remove
            </div>
          )}

          {/* Quick Add floating button */}
          <div className="scene-studio-quick-add-wrapper" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="scene-studio-quick-add-btn"
              onClick={() => setQuickAddOpen(!quickAddOpen)}
            >
              <Plus size={16} /> Add
            </button>
            {quickAddOpen && (
              <div className="scene-studio-quick-add-popup">
                {QUICK_ADD_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      className="scene-studio-quick-add-option"
                      onClick={() => handleQuickAdd(opt.key)}
                    >
                      <Icon size={14} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="scene-studio-right-panel">
          <InspectorPanel
            objects={state.objects}
            selectedIds={state.selectedIds}
            canvasSettings={state.canvasSettings}
            variantGroups={state.variantGroups}
            angles={state.angles}
            activeAngleId={state.activeAngleId}
            onUpdateObject={state.updateObjectWithHistory}
            onReorder={state.reorderObject}
            onDelete={state.removeObject}
            onDuplicate={state.duplicateObject}
            onToggleVisibility={state.toggleVisibility}
            onToggleLock={state.toggleLock}
            onUpdateCanvasSettings={state.updateCanvasSettings}
            onActivateVariant={state.activateVariant}
            onGroupObjects={state.groupObjects}
            onUngroupObjects={state.ungroupObjects}
            onSetActiveAngle={state.setActiveAngleId}
            contextType={state.contextType}
            onReplaceAsset={(objectId) => {
              handleChangeBackground();
            }}
            onRemoveBackground={handleRemoveBackground}
            isRemovingBg={isRemovingBg}
            backgroundSelected={backgroundSelected}
            backgroundUrl={backgroundUrl}
            depthMapUrl={proxiedDepthMapUrl}
            depthEffects={state.depthEffects}
            isGeneratingDepth={isGeneratingDepth}
            depthError={depthError}
            onGenerateDepth={handleGenerateDepth}
            onUpdateDepthEffects={handleUpdateDepthEffects}
            mood={mood}
            timeOfDay={timeOfDay}
            onChangeMood={handleMoodChange}
            onChangeTimeOfDay={handleTimeOfDayChange}
            onChangeBackground={handleChangeBackground}
            onRegenerateVariation={handleRegenerateBackground}
            isRegenerating={isRegeneratingBg}
          />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="scene-studio-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="scene-studio-context-item" onClick={() => { state.copySelected(); setContextMenu(null); }}>
            Copy <span className="scene-studio-context-shortcut">Ctrl+C</span>
          </button>
          <button className="scene-studio-context-item" onClick={() => { state.pasteClipboard(); setContextMenu(null); }}>
            Paste <span className="scene-studio-context-shortcut">Ctrl+V</span>
          </button>
          <div className="scene-studio-context-divider" />
          {state.selectedIds.size > 0 && (
            <>
              <button className="scene-studio-context-item" onClick={() => { state.selectedIds.forEach((id) => state.duplicateObject(id)); setContextMenu(null); }}>
                Duplicate <span className="scene-studio-context-shortcut">Ctrl+D</span>
              </button>
              <button className="scene-studio-context-item danger" onClick={() => { state.selectedIds.forEach((id) => state.removeObject(id)); setContextMenu(null); }}>
                Delete <span className="scene-studio-context-shortcut">Del</span>
              </button>
            </>
          )}
          <div className="scene-studio-context-divider" />
          <button className="scene-studio-context-item" onClick={() => { state.selectObject(null); state.deselectAll(); setContextMenu(null); }}>
            Deselect All <span className="scene-studio-context-shortcut">Esc</span>
          </button>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="scene-studio-export-dialog" onClick={() => setShowExportDialog(false)}>
          <div className="scene-studio-export-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Export Scene</h3>
            <div className="scene-studio-export-option">
              <label>Format</label>
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                <option value="png">PNG (lossless)</option>
                <option value="jpg">JPG (smaller)</option>
                <option value="webp">WebP (best)</option>
              </select>
            </div>
            <div className="scene-studio-export-option">
              <label>Scale</label>
              <select value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}>
                <option value={1}>1x ({canvasWidth}×{canvasHeight})</option>
                <option value={2}>2x ({canvasWidth * 2}×{canvasHeight * 2})</option>
                <option value={3}>3x ({canvasWidth * 3}×{canvasHeight * 3})</option>
              </select>
            </div>
            <div className="scene-studio-export-actions">
              <button className="scene-studio-btn ghost" onClick={() => setShowExportDialog(false)}>Cancel</button>
              <button className="scene-studio-btn primary" onClick={doExport}>Export</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
