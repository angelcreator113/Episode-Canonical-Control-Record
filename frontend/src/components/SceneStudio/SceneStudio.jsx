import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Plus, Image as ImageIcon, Upload, Sparkles, Pentagon, Type, Eraser, ImagePlus, Undo2, Scissors, ChevronUp, Layers, Settings, Merge } from 'lucide-react';
import StudioCanvas from './Canvas/StudioCanvas';
import MaskLayer from './Canvas/MaskLayer';
import EraseBrushCanvas from './EraseBrushCanvas';
import Toolbar, { PLATFORM_PRESETS } from './Toolbar';
import CreationPanel from './panels/CreationPanel';
import InspectorPanel from './panels/InspectorPanel';
import SmartSuggestions from './panels/SmartSuggestions';
import useSceneStudioState from './useSceneStudioState';
import sceneService from '../../services/sceneService';
import assetService from '../../services/assetService';
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

function getNetworkAwareApiError(err, fallbackMessage, actionLabel = 'Request') {
  const serverError = err?.response?.data?.error;
  if (serverError) return serverError;

  const status = err?.response?.status;
  if (typeof status === 'number') {
    return `${actionLabel} failed (${status})`;
  }

  const code = String(err?.code || '');
  const message = String(err?.message || '');
  const causeMessage = String(err?.cause?.message || '');
  const combined = `${code} ${message} ${causeMessage}`.toUpperCase();
  const isNetworkError = code === 'ERR_NETWORK' || /NETWORK\s+ERROR/i.test(message);
  const isAddressIssue = /ERR_ADDRESS_UNREACHABLE|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ENOTFOUND|EHOSTUNREACH|ECONNREFUSED/.test(combined);

  if (isNetworkError || isAddressIssue || !err?.response) {
    return 'Network path to dev.primepisodes.com is unreachable right now. Try a hard refresh, disable VPN/proxy/extensions, and retry.';
  }

  return err?.message || fallbackMessage;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Data URLs don't need CORS; remote URLs try with CORS first, fallback without
    if (src.startsWith('data:')) {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load data URL image'));
      img.src = src;
    } else {
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        // CORS failed — retry without crossOrigin (canvas will be tainted but image loads)
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
        fallback.src = src;
      };
      img.src = src;
    }
  });
}

function getInpaintCooldownMs(err) {
  if (err?.response?.status !== 429) return 0;

  const dataRetryAfter = Number.parseInt(String(err?.response?.data?.retry_after || ''), 10);
  if (Number.isFinite(dataRetryAfter) && dataRetryAfter > 0) {
    return dataRetryAfter * 1000;
  }

  const headers = err?.response?.headers || {};
  const retryAfterRaw = headers['retry-after'];
  const retryAfterSec = Number.parseInt(String(retryAfterRaw || ''), 10);
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return retryAfterSec * 1000;
  }

  const resetRaw = headers['ratelimit-reset'] || headers['x-ratelimit-reset'];
  const resetValue = Number.parseInt(String(resetRaw || ''), 10);
  if (Number.isFinite(resetValue) && resetValue > 0) {
    // Some servers emit epoch seconds, others emit seconds-until-reset.
    if (resetValue > 1000000000) {
      const untilMs = (resetValue * 1000) - Date.now();
      if (untilMs > 0) return untilMs;
    }
    return resetValue * 1000;
  }

  const serverError = String(err?.response?.data?.error || '');
  const retryAfterMatch = serverError.match(/retry_after["':\s]+(\d+)/i);
  if (retryAfterMatch) {
    return Number.parseInt(retryAfterMatch[1], 10) * 1000;
  }

  const minutesMatch = serverError.match(/resets\s+in\s+(\d+)\s+minutes?/i);
  if (minutesMatch) {
    return Number.parseInt(minutesMatch[1], 10) * 60 * 1000;
  }

  if (/in\s+progress/i.test(serverError)) {
    return 8000;
  }

  return 20000;
}

async function getMaskBoundingBoxFromDataUrl(maskDataUrl) {
  const maskImg = await loadImage(maskDataUrl);
  const w = maskImg.naturalWidth || maskImg.width;
  const h = maskImg.naturalHeight || maskImg.height;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(maskImg, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx] || 0;
      const g = data[idx + 1] || 0;
      const b = data[idx + 2] || 0;
      const a = data[idx + 3] || 0;
      const lum = (r + g + b) / 3;
      const on = a > 8 && lum > 8;
      if (!on) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

const QUICK_ADD_OPTIONS = [
  { key: 'generate', label: 'Generate', icon: Sparkles },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'library', label: 'Library', icon: ImageIcon },
  { key: 'text', label: 'Text', icon: Type },
  { key: 'shapes', label: 'Shapes', icon: Pentagon },
];

export default function SceneStudio({ sceneId, sceneSetId, showId, episodeId, onBack }) {
  const state = useSceneStudioState();
  const canvasContainerRef = useRef(null);
  const stageRef = useRef(null);
  const [platform, setPlatform] = useState('youtube');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const eraseBrushRef = useRef(null);
  const isSavingRef = useRef(false);
  const saveStatusTimerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTextId, setEditingTextId] = useState(null);
  const [error, setError] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState(null);
  const [bannerErrorKind, setBannerErrorKind] = useState('save');
  const saveTimerRef = useRef(null);
  const saveRef = useRef(null);
  const pendingSaveRef = useRef(false);

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
  const pendingMaskRef = useRef(null); // Stores mask data URL when erase tool has strokes
  const handleEraseApplyRef = useRef(null); // Ref to handleEraseApply for use in save()
  const [brushSize, setBrushSize] = useState(30);
  const [maskMode, setMaskMode] = useState('add');
  const [maskExpand, setMaskExpand] = useState(10);
  const [maskFeather, setMaskFeather] = useState(2);
  const [isInpainting, setIsInpainting] = useState(false);
  const isInpaintingRef = useRef(false);
  const [inpaintPrompt, setInpaintPrompt] = useState('');
  const [inpaintNotice, setInpaintNotice] = useState(null);
  const [inpaintError, setInpaintError] = useState('');
  const [inpaintCooldownUntil, setInpaintCooldownUntil] = useState(0);
  const inpaintCooldownRef = useRef(0);
  const [inpaintCooldownSeconds, setInpaintCooldownSeconds] = useState(0);
  const [exportScale, setExportScale] = useState(2);
  const [backgroundLayout, setBackgroundLayout] = useState(null);
  const handleBackgroundLayoutChange = useCallback((nextLayout) => {
    setBackgroundLayout((prev) => {
      if (!nextLayout && !prev) return prev;
      if (!nextLayout || !prev) return nextLayout;
      if (
        prev.sourceWidth === nextLayout.sourceWidth &&
        prev.sourceHeight === nextLayout.sourceHeight &&
        prev.drawX === nextLayout.drawX &&
        prev.drawY === nextLayout.drawY &&
        prev.drawWidth === nextLayout.drawWidth &&
        prev.drawHeight === nextLayout.drawHeight
      ) {
        return prev;
      }
      return nextLayout;
    });
  }, []);

  // Background removal state
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isRemoveBgConfigured, setIsRemoveBgConfigured] = useState(null);

  // UX guidance state
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showFirstHint, setShowFirstHint] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [backgroundSelected, setBackgroundSelected] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null); // null | 'left' | 'right'
  const prevObjectCountRef = useRef(0);

  useEffect(() => {
    if (!inpaintCooldownUntil || inpaintCooldownUntil <= Date.now()) {
      setInpaintCooldownSeconds(0);
      return undefined;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((inpaintCooldownUntil - Date.now()) / 1000));
      setInpaintCooldownSeconds(remaining);
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [inpaintCooldownUntil]);

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

  useEffect(() => {
    let alive = true;

    async function loadFeatureConfig() {
      try {
        const result = await assetService.getConfigCheck();
        const status = String(result?.data?.data?.removeBgApiKey || '').toLowerCase();
        if (alive) {
          setIsRemoveBgConfigured(status === 'configured');
        }
      } catch {
        if (alive) {
          setIsRemoveBgConfigured(false);
        }
      }
    }

    loadFeatureConfig();
    return () => { alive = false; };
  }, []);

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
    console.log('Save button clicked', { 
      isSaving: isSavingRef.current, 
      contextId: state.contextId,
      contextType: state.contextType,
      isDirty: state.isDirty
    });
    
    if (isSavingRef.current) {
      console.log('Already saving, queueing...');
      pendingSaveRef.current = true;
      return;
    }
    if (!state.contextId) {
      console.error('Scene Studio save: no contextId — scene not loaded');
      setSaveStatus('error');
      setSaveErrorMsg('Scene not loaded — try refreshing');
      return;
    }
    // Auto-apply pending erase mask before saving so the user doesn't lose
    // their erase work when they click Save instead of Apply.
    // The mask data is stored in pendingMaskRef by EraseBrushCanvas's
    // onMaskDataChange callback, so it survives even if the erase tool
    // is closed before Save runs.
    const pendingMask = pendingMaskRef.current;
    console.log('Scene Studio save: erase check', {
      activeTool: state.activeTool,
      hasPendingMask: !!pendingMask,
      hasRef: !!eraseBrushRef.current,
    });
    if (pendingMask && handleEraseApplyRef.current) {
      console.log('Scene Studio save: auto-applying pending erase mask before save');
      try {
        const eraseResult = await handleEraseApplyRef.current(pendingMask, {});
        if (eraseResult?.applied) {
          pendingMaskRef.current = null;
          console.log('Scene Studio save: erase mask applied and saved');
        } else {
          console.warn('Scene Studio save: erase was skipped —', eraseResult?.reason || 'unknown reason');
          // Don't clear pendingMaskRef — keep the mask so next save can retry
        }
      } catch (eraseErr) {
        console.error('Scene Studio save: erase apply failed:', eraseErr?.message || eraseErr);
        // Don't clear pendingMaskRef — keep the mask so the user can retry
        setSaveStatus('error');
        setSaveErrorMsg('Erase failed — ' + (eraseErr?.response?.data?.error || eraseErr?.message || 'try again'));
        isSavingRef.current = false;
        return; // Don't proceed with canvas save if erase failed
      }
    }
    isSavingRef.current = true;
    setBannerErrorKind('save');
    setSaveErrorMsg(null);
    // Cancel any pending auto-save to avoid double-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    setSaveStatus('saving');
    const startTime = Date.now();
    try {
      console.log('Creating save payload...');
      const payload = state.serializeForSave();
      // Capture the change version at serialization time so we only
      // clear the dirty flag if no new edits arrived while saving.
      const savedVersion = payload._changeVersion;
      delete payload._changeVersion;
      console.log('Payload created:', { objectCount: payload.objects?.length, hasCanvasSettings: !!payload.canvas_settings });
      // Include platform in canvas_settings for persistence
      if (payload.canvas_settings) {
        payload.canvas_settings.platform = platform;
        if (mood) payload.canvas_settings.mood = mood;
        if (timeOfDay) payload.canvas_settings.timeOfDay = timeOfDay;
      }
      console.log('Calling API with:', { contextType: state.contextType, contextId: state.contextId, payloadSize: JSON.stringify(payload).length });
      let result;
      if (state.contextType === 'scene') {
        console.log('Saving scene canvas...');
        result = await sceneService.saveCanvas(state.contextId, payload);
      } else {
        console.log('Saving scene set canvas...');
        result = await sceneService.saveSceneSetCanvas(state.contextId, payload);
      }
      console.log('Scene Studio save result:', result);
      // Sync client-generated IDs with server-assigned UUIDs so subsequent
      // saves can match by primary key instead of falling through to the
      // composite-key fallback (which can't handle text/shape objects).
      const idMap = result?.idMap;
      if (idMap && Object.keys(idMap).length > 0) {
        state.setObjects((prev) =>
          prev.map((o) => (idMap[o.id] ? { ...o, id: idMap[o.id] } : o))
        );
      }
      state.markClean(savedVersion);
      // Ensure "Saving..." shows for at least 600ms so it doesn't flicker
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 600 - elapsed);
      await new Promise((r) => setTimeout(r, remaining));
      if (!mountedRef.current) return;
      console.log('Save completed successfully');
      setSaveStatus('saved');
      // Show "Saved" confirmation for 2s then go back to idle
      saveStatusTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Scene Studio save error caught:', err);
      console.error('Error details:', { 
        message: err.message, 
        status: err?.response?.status,
        responseData: err?.response?.data,
        stack: err.stack 
      });
      const details = Array.isArray(err?.response?.data?.details) ? err.response.data.details : [];
      const detailText = details.length ? ` (${details.join('; ')})` : '';
      const msg = (err.response?.data?.error || err.message || 'Save failed') + detailText;
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

      const status = err?.response?.status;
      const isClientValidationError = typeof status === 'number' && status >= 400 && status < 500;

      if (mountedRef.current) {
        setBannerErrorKind('save');
        setSaveStatus('error');
        setSaveErrorMsg(msg);
        if (!isClientValidationError) {
          // Auto-retry after 10s for server/network failures only.
          saveTimerRef.current = setTimeout(() => {
            if (mountedRef.current && state.isDirty && saveRef.current) {
              console.log('Scene Studio: auto-retrying save...');
              saveRef.current();
            }
          }, 10000);
        }
      }
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        if (saveRef.current) {
          saveRef.current();
        }
      }
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
    // Clamp to viewport so menu doesn't go off-screen
    const menuW = 180;
    const menuH = 220;
    const clampedX = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const clampedY = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setContextMenu({ x: Math.max(8, clampedX), y: Math.max(8, clampedY) });
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

  // ── Background URL (from scene or scene set angle) ──

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
        time_of_day: effectiveTime,
        current_background_url: backgroundUrl,
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
    // Ref guard is synchronous — prevents double-click race before React batches state
    if (isInpaintingRef.current) return;
    if (isInpainting || !state.contextId) return;
    if (!hasMask) return;
    if (inpaintCooldownRef.current > Date.now()) {
      const seconds = Math.ceil((inpaintCooldownRef.current - Date.now()) / 1000);
      setInpaintNotice(`Too many requests. Please wait ${seconds}s and try again.`);
      return;
    }

    // Determine target: selected object's image or the scene background
    const selectedObj = state.selectedIds.size === 1
      ? state.objects.find((o) => state.selectedIds.has(o.id))
      : null;
    const targetUrl = (selectedObj?.type === 'image' && selectedObj?.assetUrl)
      ? selectedObj.assetUrl
      : backgroundUrl;

    if (!targetUrl) {
      setInpaintNotice('No image to erase from. Select an image object or ensure background is set.');
      return;
    }

    isInpaintingRef.current = true;
    setIsInpainting(true);
    setInpaintNotice(null);
    setInpaintError('');
    try {
      const selectedImageExport = selectedObj?.type === 'image' && selectedObj?.assetUrl
        ? {
            targetObject: {
              x: selectedObj.x || 0,
              y: selectedObj.y || 0,
              width: selectedObj.width || 1,
              height: selectedObj.height || 1,
              rotation: selectedObj.rotation || 0,
              scaleX: selectedObj.scaleX || 1,
              scaleY: selectedObj.scaleY || 1,
              flipX: selectedObj.flipX === true,
              flipY: selectedObj.flipY === true,
              cropData: selectedObj.cropData || null,
              sourceWidth: selectedObj._asset?.width || selectedObj.width || 1,
              sourceHeight: selectedObj._asset?.height || selectedObj.height || 1,
            },
          }
        : null;

      const exportOptions = selectedImageExport
        || ((!selectedObj && backgroundLayout) ? { targetLayout: backgroundLayout } : {});

      const preciseMaskDataUrl = MaskLayer._exportMask(exportOptions);
      if (!preciseMaskDataUrl) {
        isInpaintingRef.current = false;
        setIsInpainting(false);
        setInpaintError('Failed to export mask. Please try painting again.');
        return;
      }

      const isBackgroundTarget = !(selectedObj?.type === 'image' && selectedObj?.assetUrl);
      const trimmedPrompt = inpaintPrompt.trim();
      const result = await sceneService.inpaintScene(state.contextId, {
        imageUrl: targetUrl,
        isBackground: isBackgroundTarget,
        maskDataUrl: preciseMaskDataUrl,
        prompt: trimmedPrompt || undefined,
        mode: trimmedPrompt ? 'fill' : 'remove',
        strictRemove: !trimmedPrompt,
        maskExpand,
        maskFeather,
      });

      if (result?.success && result.data?.inpainted_url) {
        if (selectedObj?.type === 'image' && selectedObj?.assetUrl) {
          // Persist the rendered URL in metadata so reload keeps the edit.
          state.updateObject(selectedObj.id, {
            assetUrl: result.data.inpainted_url,
            metadata: {
              ...(selectedObj.metadata || {}),
              renderUrl: result.data.inpainted_url,
            },
          });
        } else {
          // Update the scene background
          state.setSceneData((prev) => prev ? { ...prev, background_url: result.data.inpainted_url } : prev);
        }
        // Clear the mask and prompt
        if (typeof MaskLayer._clearMask === 'function') MaskLayer._clearMask();
        setHasMask(false);
        setInpaintPrompt('');
      }
    } catch (err) {
      if (err?.response?.status === 429) {
        console.warn('Inpaint rate-limited (429):', err?.response?.data?.error || err.message);
        const cooldownMs = getInpaintCooldownMs(err);
        if (cooldownMs > 0) {
          const cooldownUntil = Date.now() + cooldownMs;
          inpaintCooldownRef.current = cooldownUntil;
          setInpaintCooldownUntil(cooldownUntil);
        }
        // Surface the server's specific reason (e.g. "limit reached 15/hour",
        // "operation in progress", "provider rate-limited") rather than generic text.
        const serverMsg = err?.response?.data?.error;
        setInpaintError(serverMsg || 'Too many requests. Please wait and try again.');
      } else {
        console.error('Inpaint error:', err);
        setInpaintError(getNetworkAwareApiError(err, 'Inpainting failed', 'Inpaint'));
      }
    } finally {
      isInpaintingRef.current = false;
      setIsInpainting(false);
    }
  }, [isInpainting, state, backgroundUrl, hasMask, maskExpand, maskFeather, inpaintPrompt]);

  const handleClearMask = useCallback(() => {
    if (typeof MaskLayer._clearMask === 'function') MaskLayer._clearMask();
    setHasMask(false);
    setInpaintNotice(null);
    setInpaintError('');
  }, []);

  // ── EraseBrushCanvas apply handler ──
  // Bridges from EraseBrushCanvas's onApply(maskDataUrl, { prompt, strength }) to the API.
  const handleEraseApply = useCallback(async (maskDataUrl, options = {}) => {
    if (isInpaintingRef.current) {
      console.warn('Scene Studio handleEraseApply: skipped — already inpainting');
      return { applied: false, reason: 'already_inpainting' };
    }
    if (!state.contextId) {
      console.warn('Scene Studio handleEraseApply: skipped — no contextId');
      return { applied: false, reason: 'no_context' };
    }
    if (inpaintCooldownRef.current > Date.now()) {
      const seconds = Math.ceil((inpaintCooldownRef.current - Date.now()) / 1000);
      console.warn('Scene Studio handleEraseApply: skipped — cooldown active, ', seconds, 's remaining');
      setInpaintError(`Too many requests. Please wait ${seconds}s and try again.`);
      return { applied: false, reason: 'cooldown' };
    }

    const selectedObj = state.selectedIds.size === 1
      ? state.objects.find((o) => state.selectedIds.has(o.id))
      : null;
    const targetUrl = (selectedObj?.type === 'image' && selectedObj?.assetUrl)
      ? selectedObj.assetUrl
      : backgroundUrl;

    if (!targetUrl) {
      console.warn('Scene Studio handleEraseApply: skipped — no target URL');
      setInpaintError('No image to erase from — select an image object or ensure background is set');
      return { applied: false, reason: 'no_target_url' };
    }

    const isBackgroundTarget = !(selectedObj?.type === 'image' && selectedObj?.assetUrl);
    isInpaintingRef.current = true;
    setIsInpainting(true);
    setInpaintNotice(null);
    setInpaintError('');
    try {
      const trimmedPrompt = (options.prompt || '').trim();
      console.log('Scene Studio handleEraseApply: calling inpaint API', { isBackground: isBackgroundTarget, mode: trimmedPrompt ? 'fill' : 'remove' });
      const result = await sceneService.inpaintScene(state.contextId, {
        imageUrl: targetUrl,
        isBackground: isBackgroundTarget,
        maskDataUrl,
        prompt: trimmedPrompt || undefined,
        mode: trimmedPrompt ? 'fill' : 'remove',
        strength: options.strength,
        strictRemove: !trimmedPrompt,
        maskExpand,
        maskFeather,
      });

      if (result?.success && result.data?.inpainted_url) {
        if (selectedObj?.type === 'image' && selectedObj?.assetUrl) {
          state.updateObject(selectedObj.id, {
            assetUrl: result.data.inpainted_url,
            metadata: {
              ...(selectedObj.metadata || {}),
              renderUrl: result.data.inpainted_url,
            },
          });
        } else {
          state.setSceneData((prev) => prev ? { ...prev, background_url: result.data.inpainted_url } : prev);
          state.markDirty();
        }
        // Exit erase mode on success
        state.setActiveTool('select');
        return { applied: true };
      }
      console.warn('Scene Studio handleEraseApply: inpaint returned no URL', result);
      return { applied: false, reason: 'no_inpainted_url' };
    } catch (err) {
      if (err?.response?.status === 429) {
        console.warn('Inpaint rate-limited (429):', err?.response?.data?.error || err.message);
        const cooldownMs = getInpaintCooldownMs(err);
        if (cooldownMs > 0) {
          const cooldownUntil = Date.now() + cooldownMs;
          inpaintCooldownRef.current = cooldownUntil;
          setInpaintCooldownUntil(cooldownUntil);
        }
        const serverMsg = err?.response?.data?.error;
        setInpaintError(serverMsg || 'Too many requests. Please wait and try again.');
      } else {
        console.error('Inpaint error:', err);
        setInpaintError(getNetworkAwareApiError(err, 'Inpainting failed', 'Inpaint'));
      }
      // Re-throw so callers (like auto-apply in save) know the inpaint failed
      throw err;
    } finally {
      isInpaintingRef.current = false;
      setIsInpainting(false);
    }
  }, [state, backgroundUrl, maskExpand, maskFeather]);

  // Keep ref in sync so save() can call handleEraseApply without circular deps
  useEffect(() => { handleEraseApplyRef.current = handleEraseApply; }, [handleEraseApply]);

  // ── Use Image — just add as a layer with optional bg removal ──
  // No erasing, no blending. User does those separately:
  //   Apply = erase (LaMa removes the object)
  //   Use Image = add replacement layer (with bg removed)
  //   Merge & Blend = flatten layer into background (when happy with position)
  const handleReplaceWithImage = useCallback(async (maskDataUrl, options = {}) => {
    if (isInpaintingRef.current) return;
    const { imageDataUrl, removeBg: shouldRemoveBg, assetId } = options;
    if (!imageDataUrl) {
      setInpaintError('No image selected');
      return;
    }

    isInpaintingRef.current = true;
    setIsInpainting(true);
    setInpaintError('');
    setInpaintNotice(shouldRemoveBg ? 'Removing background and placing image...' : 'Placing image...');

    try {
      // Get mask bounds to know where to place the image
      const maskBox = await getMaskBoundingBoxFromDataUrl(maskDataUrl);

      // Determine placement area — use mask bounds if available, otherwise center of canvas
      const placeX = maskBox ? maskBox.x : canvasWidth / 4;
      const placeY = maskBox ? maskBox.y : canvasHeight / 4;
      const placeW = maskBox ? maskBox.width : canvasWidth / 2;
      const placeH = maskBox ? maskBox.height : canvasHeight / 2;

      // Optionally remove background via backend rembg
      let finalImageUrl = imageDataUrl;
      if (shouldRemoveBg && assetId) {
        try {
          setInpaintNotice('Removing background from image...');
          const bgResult = await assetService.removeBackground(assetId);
          const removedUrl = bgResult?.data?.url || bgResult?.url;
          if (removedUrl) finalImageUrl = removedUrl;
        } catch (bgErr) {
          console.warn('BG removal failed, using original:', bgErr.message);
        }
      }

      // Scale to fit placement area
      const refImg = await loadImage(finalImageUrl);
      const refW = refImg.naturalWidth || refImg.width || placeW;
      const refH = refImg.naturalHeight || refImg.height || placeH;
      const refAspect = refW / Math.max(1, refH);
      const boxAspect = placeW / Math.max(1, placeH);

      let targetW = placeW;
      let targetH = placeH;
      if (refAspect > boxAspect) {
        targetH = Math.max(8, Math.round(placeW / refAspect));
      } else {
        targetW = Math.max(8, Math.round(placeH * refAspect));
      }

      // Add as movable layer
      const objId = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.addObject({
        id: objId,
        type: 'image',
        assetId: assetId || undefined,
        assetUrl: finalImageUrl,
        x: Math.round(placeX + (placeW - targetW) / 2),
        y: Math.round(placeY + (placeH - targetH) / 2),
        width: targetW,
        height: targetH,
        rotation: 0,
        opacity: 1,
        label: 'Replacement',
      });

      state.setActiveTool('select');
      state.selectObject(objId);
    } catch (err) {
      console.error('Use Image error:', err);
      setInpaintError(err.message || 'Failed to add image');
    } finally {
      isInpaintingRef.current = false;
      setIsInpainting(false);
      setInpaintNotice(null);
    }
  }, [state, canvasWidth, canvasHeight]);

  // ── Smart Select (SAM segmentation) ──
  const handleSegment = useCallback(async (segmentInput) => {
    const contextId = state.contextId;
    if (!contextId) return null;

    const normalizedX = Number(segmentInput?.pointX);
    const normalizedY = Number(segmentInput?.pointY);
    const pointLabel = Number.isFinite(Number(segmentInput?.label)) ? Number(segmentInput.label) : 1;
    const points = Array.isArray(segmentInput?.points) ? segmentInput.points : [];

    const selectedObj = state.selectedIds.size === 1
      ? state.objects.find((o) => state.selectedIds.has(o.id))
      : null;
    const targetUrl = (selectedObj?.type === 'image' && selectedObj?.assetUrl)
      ? selectedObj.assetUrl
      : backgroundUrl;

    try {
      const result = await sceneService.segmentObject(contextId, {
        imageUrl: targetUrl,
        pointX: normalizedX,
        pointY: normalizedY,
        pointLabel,
        imageWidth: backgroundLayout?.sourceWidth,
        imageHeight: backgroundLayout?.sourceHeight,
      });
      if (result?.success && result.data?.maskUrl) {
        if (result.data.fallback) {
          console.warn('[SmartSelect] SAM unavailable, using approximate selection:', result.data.fallback_reason || 'unknown');
          setInpaintError('Smart select is using approximate selection — SAM segmentation service may be unavailable. Try the text "Find" option or brush/lasso instead.');
        }
        return { maskUrl: result.data.maskUrl, inverted: result.data.inverted || false };
      }
      return null;
    } catch (err) {
      if (err?.response?.status === 429) {
        console.warn('Segment rate-limited (429):', err?.response?.data?.error || err.message);
        setInpaintError(err?.response?.data?.error || 'Too many requests. Wait a few seconds and try again.');
      } else {
        console.error('Segment error:', err);
        setInpaintError(err?.response?.data?.error || 'Smart select failed. Try brush or lasso instead.');
      }
      return null;
    }
  }, [state, backgroundUrl, backgroundLayout]);

  // Multi-point segment — sends all accumulated points to SAM in one call
  const handleMultiPointSegment = useCallback(async (points, labels) => {
    const contextId = state.contextId;
    if (!contextId || !points?.length) return null;

    const selectedObj = state.selectedIds.size === 1
      ? state.objects.find((o) => state.selectedIds.has(o.id))
      : null;
    const targetUrl = (selectedObj?.type === 'image' && selectedObj?.assetUrl)
      ? selectedObj.assetUrl
      : backgroundUrl;

    try {
      const result = await sceneService.segmentObject(contextId, {
        imageUrl: targetUrl,
        points,
        labels,
        imageWidth: backgroundLayout?.sourceWidth,
        imageHeight: backgroundLayout?.sourceHeight,
      });
      if (result?.success && result.data?.maskUrl) {
        if (result.data.fallback) {
          console.warn('[SmartSelect] SAM unavailable, using approximate selection:', result.data.fallback_reason || 'unknown');
          setInpaintError('Smart select is using approximate selection — SAM segmentation service may be unavailable. Try the text "Find" option or brush/lasso instead.');
        }
        return { maskUrl: result.data.maskUrl, inverted: result.data.inverted || false };
      }
      return null;
    } catch (err) {
      if (err?.response?.status === 429) {
        setInpaintError(err?.response?.data?.error || 'Too many requests. Wait a few seconds and try again.');
      } else {
        setInpaintError(err?.response?.data?.error || 'Smart select failed. Try brush or lasso instead.');
      }
      return null;
    }
  }, [state, backgroundUrl, backgroundLayout]);

  // Smart Find — text-based object detection via Grounded SAM
  const handleTextSegment = useCallback(async (textPrompt) => {
    const contextId = state.contextId;
    if (!contextId || !textPrompt?.trim()) return null;

    const selectedObj = state.selectedIds.size === 1
      ? state.objects.find((o) => state.selectedIds.has(o.id))
      : null;
    const targetUrl = (selectedObj?.type === 'image' && selectedObj?.assetUrl)
      ? selectedObj.assetUrl
      : backgroundUrl;

    try {
      const result = await sceneService.segmentObject(contextId, {
        imageUrl: targetUrl,
        textPrompt: textPrompt.trim(),
      });
      if (result?.success && result.data?.maskUrl) {
        return result.data.maskUrl;
      }
      return null;
    } catch (err) {
      if (err?.response?.status === 429) {
        setInpaintError(err?.response?.data?.error || 'Too many requests. Wait a few seconds and try again.');
      } else {
        setInpaintError(err?.response?.data?.error || 'Could not find that object. Try a different description.');
      }
      return null;
    }
  }, [state, backgroundUrl]);

  // ── Extract selection as movable object ──
  // Cuts the masked area from the background and adds it as a canvas object
  const handleExtractSelection = useCallback(async (maskDataUrl) => {
    if (!backgroundUrl) return;
    try {
      const [bgImg, maskImg] = await Promise.all([
        loadImage(backgroundUrl),
        loadImage(maskDataUrl),
      ]);

      // Create canvas with just the masked area
      const canvas = document.createElement('canvas');
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Draw background
      ctx.drawImage(bgImg, 0, 0);

      // Apply mask: keep only where mask is white
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);

      // Find bounding box of non-transparent pixels
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (imageData.data[(y * canvas.width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX <= minX || maxY <= minY) return;

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      // Crop to bounding box
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

      const extractedDataUrl = croppedCanvas.toDataURL('image/png');

      // Scale to canvas coordinates
      const scaleX = canvasWidth / bgImg.width;
      const scaleY = canvasHeight / bgImg.height;

      // Add as object
      const objId = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      state.addObject({
        id: objId,
        type: 'image',
        assetUrl: extractedDataUrl,
        x: Math.round(minX * scaleX),
        y: Math.round(minY * scaleY),
        width: Math.round(cropW * scaleX),
        height: Math.round(cropH * scaleY),
        rotation: 0,
        opacity: 1,
        label: 'Extracted',
        usageType: 'overlay',
      });

      state.setActiveTool('select');
    } catch (err) {
      console.error('Extract selection error:', err);
    }
  }, [backgroundUrl, canvasWidth, canvasHeight, state]);

  // ── Merge & Blend — flatten selected object into background with AI edge blending ──
  const [isMerging, setIsMerging] = useState(false);

  const handleMergeAndBlend = useCallback(async (objectId) => {
    if (isInpaintingRef.current || isMerging) return;
    const obj = state.objects.find((o) => o.id === objectId);
    if (!obj || obj.type !== 'image' || !obj.assetUrl || !backgroundUrl) return;

    setIsMerging(true);
    setInpaintError('');
    setInpaintNotice('Merging and blending edges...');
    try {
      // Create a mask around the object's position for server-side compositing
      const margin = 20;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvasWidth;
      maskCanvas.height = canvasHeight;
      const maskCtx = maskCanvas.getContext('2d');

      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, canvasWidth, canvasHeight);

      maskCtx.fillStyle = '#ffffff';
      const bx = Math.max(0, (obj.x || 0) - margin);
      const by = Math.max(0, (obj.y || 0) - margin);
      const bw = Math.min(canvasWidth - bx, (obj.width || 100) + margin * 2);
      const bh = Math.min(canvasHeight - by, (obj.height || 100) + margin * 2);
      const radius = Math.min(15, bw / 4, bh / 4);
      maskCtx.beginPath();
      maskCtx.moveTo(bx + radius, by);
      maskCtx.lineTo(bx + bw - radius, by);
      maskCtx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
      maskCtx.lineTo(bx + bw, by + bh - radius);
      maskCtx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
      maskCtx.lineTo(bx + radius, by + bh);
      maskCtx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
      maskCtx.lineTo(bx, by + radius);
      maskCtx.quadraticCurveTo(bx, by, bx + radius, by);
      maskCtx.closePath();
      maskCtx.fill();

      const maskDataUrl = maskCanvas.toDataURL('image/png');

      // Use server-side compositing + SDXL blend (no toDataURL needed)
      const result = await sceneService.inpaintScene(state.contextId, {
        imageUrl: backgroundUrl,
        maskDataUrl,
        referenceImageUrl: obj.assetUrl,
        prompt: 'Seamless blend, match surrounding lighting, texture and perspective. Photorealistic continuity.',
        mode: 'fill',
        strength: 0.35,
      });

      if (result?.success && result.data?.inpainted_url) {
        state.removeObject(objectId);
        state.setSceneData((prev) => prev ? { ...prev, background_url: result.data.inpainted_url } : prev);
      }
    } catch (err) {
      console.error('Merge and blend error:', err);
      setInpaintError(err?.response?.data?.error || err.message || 'Merge failed');
    } finally {
      setIsMerging(false);
      setInpaintNotice(null);
    }
  }, [state, backgroundUrl, canvasWidth, canvasHeight, isMerging]);

  // ── Remove Background from selected object ──

  const handleRemoveBackground = useCallback(async (objectId, assetId) => {
    if (isRemoveBgConfigured === false) {
      setBannerErrorKind('remove-bg');
      setSaveErrorMsg('Background removal service is not configured');
      return;
    }
    if (isRemovingBg || !assetId) return;
    setIsRemovingBg(true);
    setBannerErrorKind('remove-bg');
    setSaveErrorMsg(null);
    try {
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
        setSaveErrorMsg('Background removal returned no URL');
      }
    } catch (err) {
      console.error('Remove background error:', err);
      setSaveErrorMsg(err.message || 'Background removal failed');
    } finally {
      setIsRemovingBg(false);
    }
  }, [isRemovingBg, state, isRemoveBgConfigured]);

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
          {bannerErrorKind === 'remove-bg' ? 'Background removal failed' : 'Save failed'}: {saveErrorMsg}
          <button
            className="scene-studio-icon-btn"
            onClick={() => {
              setSaveErrorMsg(null);
              setBannerErrorKind('save');
            }}
            style={{ marginLeft: 'auto' }}
          >
            ×
          </button>
        </div>
      )}
      {/* Guided Flow Stepper */}
      <div className="scene-studio-body">
        {/* Mobile panel backdrop */}
        {mobilePanel && (
          <div className="scene-studio-mobile-backdrop" onClick={() => setMobilePanel(null)} />
        )}

        {/* Left Panel */}
        {isCreationPanelOpen && (
          <div className={`scene-studio-left-panel ${mobilePanel === 'left' ? 'mobile-open' : ''}`}>
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
            maskMode={maskMode}
            onMaskChange={setHasMask}
            onBackgroundLayoutChange={handleBackgroundLayoutChange}
          />

          {/* Advanced erase tool overlay */}
          {state.activeTool === 'erase' && (
            <EraseBrushCanvas
              ref={eraseBrushRef}
              onMaskDataChange={(data) => { pendingMaskRef.current = data; }}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              zoom={state.canvasSettings.zoom}
              panX={state.canvasSettings.panX}
              panY={state.canvasSettings.panY}
              backgroundUrl={backgroundUrl}
              backgroundLayout={backgroundLayout}
              onApply={handleEraseApply}
              onReplaceWithImage={handleReplaceWithImage}
              onSegment={handleSegment}
              onMultiPointSegment={handleMultiPointSegment}
              onTextSegment={handleTextSegment}
              onExtractSelection={handleExtractSelection}
              onCancel={() => state.setActiveTool('select')}
              isProcessing={isInpainting}
              sceneId={sceneId || sceneSetId}
              showId={showId}
              episodeId={episodeId}
            />
          )}
          {inpaintError && (
            <div className="scene-studio-erase-error">{inpaintError}</div>
          )}

          {/* Empty canvas guidance overlay — hide when background is already set */}
          {state.objects.length === 0 && !hasInteracted && !backgroundUrl && (
            <div className="scene-studio-canvas-overlay">
              <div className="scene-studio-canvas-overlay-inner">
                <p className="scene-studio-overlay-title">Start building your scene</p>
                <div className="scene-studio-overlay-ctas">
                  <button className="scene-studio-overlay-cta" onClick={() => handleOverlayCta('library')}>
                    <ImageIcon size={16} /> Add from Library
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

        </div>

        {/* Right Panel */}
        <div className={`scene-studio-right-panel ${mobilePanel === 'right' ? 'mobile-open' : ''}`}>
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
            removeBgConfigured={isRemoveBgConfigured}
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

      {/* ── Bottom Action Bar ── */}
      {state.activeTool !== 'erase' && (
        <div className="scene-studio-action-bar">
          {/* Add menu */}
          <div className="scene-studio-action-bar-group">
            <div className="scene-studio-action-bar-add" onMouseDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="scene-studio-action-btn accent"
                onClick={() => setQuickAddOpen(!quickAddOpen)}
              >
                <Plus size={14} />
                <span>Add</span>
                <ChevronUp size={10} />
              </button>
              {quickAddOpen && (
                <div className="scene-studio-action-bar-popup">
                  {QUICK_ADD_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className="scene-studio-action-bar-popup-item"
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

          <div className="scene-studio-action-bar-divider" />

          {/* Editing actions */}
          <div className="scene-studio-action-bar-group">
            {(() => {
              const selObj = state.selectedIds.size === 1
                ? state.objects.find((o) => state.selectedIds.has(o.id))
                : null;
              const canRemoveBg = selObj?.type === 'image' && selObj?.assetUrl && selObj?._asset?.id;
              return (
                <>
                  <button
                    type="button"
                    className="scene-studio-action-btn"
                    onClick={() => {
                      if (canRemoveBg) {
                        handleRemoveBackground(selObj.id, selObj._asset.id);
                      }
                    }}
                    disabled={!canRemoveBg || isRemovingBg}
                    title={canRemoveBg ? 'Remove background from selected image' : 'Select an image object first'}
                  >
                    <Scissors size={14} />
                    <span>{isRemovingBg ? 'Removing...' : 'Remove BG'}</span>
                  </button>
                  <button
                    type="button"
                    className="scene-studio-action-btn"
                    onClick={() => {
                      if (selObj) handleMergeAndBlend(selObj.id);
                    }}
                    disabled={!selObj || isMerging || isInpainting}
                    title={selObj ? 'Merge selected object into background with AI edge blending' : 'Select an image object to merge'}
                  >
                    <Merge size={14} />
                    <span>{isMerging ? 'Blending...' : 'Merge & Blend'}</span>
                  </button>
                  <button
                    type="button"
                    className="scene-studio-action-btn"
                    onClick={() => state.setActiveTool('erase')}
                    disabled={!backgroundUrl && state.objects.length === 0}
                    title="Erase areas and fill with AI or an image"
                  >
                    <Eraser size={14} />
                    <span>Erase & Fill</span>
                  </button>
                </>
              );
            })()}
          </div>

          <div className="scene-studio-action-bar-divider" />

          {/* Undo */}
          <div className="scene-studio-action-bar-group">
            <button
              type="button"
              className="scene-studio-action-btn"
              onClick={() => state.undo?.()}
              disabled={!state.canUndo}
              title="Undo last action (Ctrl+Z)"
            >
              <Undo2 size={14} />
              <span>Undo</span>
            </button>
          </div>

          {/* Mobile panel toggles — visible on small screens via CSS */}
          <div className="scene-studio-action-bar-group scene-studio-mobile-toggles">
            <button
              type="button"
              className="scene-studio-action-btn"
              onClick={() => setMobilePanel(mobilePanel === 'left' ? null : 'left')}
              title="Objects & Library"
            >
              <Layers size={14} />
            </button>
            <button
              type="button"
              className="scene-studio-action-btn"
              onClick={() => setMobilePanel(mobilePanel === 'right' ? null : 'right')}
              title="Inspector"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      )}

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
