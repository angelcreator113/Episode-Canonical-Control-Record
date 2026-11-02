import { useState, useEffect, useRef, useCallback } from 'react';
import { saveEpisodeData } from '../services/api';

/**
 * useSaveManager — Auto-save + manual save hook for editors
 * 
 * Features:
 * - Auto-saves after a configurable delay when data changes (debounced)
 * - Manual save via Ctrl+S keyboard shortcut
 * - Manual save button callback
 * - Tracks save status: 'saved' | 'saving' | 'unsaved' | 'error'
 * - Tracks last saved timestamp
 * - beforeunload guard (warns user if unsaved changes)
 * 
 * @param {Object} options
 * @param {string} options.episodeId - Episode UUID
 * @param {Function} options.getSavePayload - Returns { episode, scenes, ...extras } to save
 * @param {number} [options.autoSaveDelay=3000] - Ms to debounce auto-save
 * @param {boolean} [options.enabled=true] - Whether anything may be saved.
 *   While false, nothing saves: not the auto-save timer, not save(), not
 *   Ctrl+S. The Timeline passes false until its episode, scenes and timeline
 *   have all loaded, so a failed or partial load can never be saved over the
 *   stored data (Timeline Editor redesign P0, 2026-11-02).
 * @param {Function} [options.onSaved] - Called with the save response's body
 *   (the Timeline adopts the ids of scenes the save created, L12a)
 */
export default function useSaveManager({
  episodeId,
  getSavePayload,
  autoSaveDelay = 3000,
  enabled = true,
  onSaved = null,
}) {
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [lastSaved, setLastSaved] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const timerRef = useRef(null);
  const changeCounterRef = useRef(0);
  const isMountedRef = useRef(true);

  // ── Refs to avoid stale closures in timers ──
  // When markDirty() sets a setTimeout, the timer callback must always
  // read the LATEST getSavePayload and episodeId, not the ones captured
  // at the time the timer was created. Without refs, the timer would
  // save the state from BEFORE the change that triggered markDirty().
  const getSavePayloadRef = useRef(getSavePayload);
  const episodeIdRef = useRef(episodeId);
  const onSavedRef = useRef(onSaved);
  const enabledRef = useRef(enabled);
  // One save at a time: a change made while a save is in flight saves once
  // more after it, with the basis the first save returned.
  const inFlightRef = useRef(false);
  const againRef = useRef(false);

  // Keep refs in sync with latest values every render
  useEffect(() => { getSavePayloadRef.current = getSavePayload; }, [getSavePayload]);
  useEffect(() => { episodeIdRef.current = episodeId; }, [episodeId]);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => {
    enabledRef.current = enabled;
    // Switched off (a reload started, or the load failed): a pending
    // auto-save is dropped, never sent from what is on screen now.
    if (!enabled && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Perform the actual save — always reads latest payload via ref
  const doSave = useCallback(async () => {
    if (!enabledRef.current) {
      console.warn('[SaveManager] Not saving: the editor has not loaded this episode');
      return;
    }
    if (inFlightRef.current) {
      againRef.current = true;
      return;
    }
    const currentEpisodeId = episodeIdRef.current;
    const currentGetPayload = getSavePayloadRef.current;
    if (!currentEpisodeId || !currentGetPayload) {
      console.warn('[SaveManager] Cannot save — missing episodeId or getSavePayload');
      return;
    }

    const payload = currentGetPayload();
    if (!payload) {
      console.warn('[SaveManager] Cannot save — getSavePayload returned null/undefined');
      return;
    }

    const sceneCount = payload.scenes?.length || 0;
    const sceneSummary = (payload.scenes || []).map(s => `#${s.scene_number} "${s.title}"`).join(', ');
    console.log(`[SaveManager] Saving ${sceneCount} scenes for episode ${currentEpisodeId}: ${sceneSummary}`);
    console.log('[SaveManager] Payload preview:', JSON.stringify(payload).substring(0, 300));

    setSaveStatus('saving');
    setErrorMessage(null);

    inFlightRef.current = true;
    try {
      // Use unified save endpoint for atomic saves
      const response = await saveEpisodeData(currentEpisodeId, payload);

      if (isMountedRef.current) {
        onSavedRef.current?.(response?.data || null);
        setSaveStatus('saved');
        setLastSaved(new Date());
        console.log(`[SaveManager] ✅ Save successful — ${sceneCount} scenes saved at ${new Date().toLocaleTimeString()}`);
      }
    } catch (error) {
      console.error('[SaveManager] ❌ Save FAILED:', error.message);
      console.error('[SaveManager] Error details:', error.response?.status, error.response?.data);
      if (isMountedRef.current) {
        setSaveStatus('error');
        setErrorMessage(error.response?.data?.error || error.message);
      }
      // A refused save is not retried behind the producer's back.
      againRef.current = false;
    } finally {
      inFlightRef.current = false;
    }
    if (againRef.current && isMountedRef.current) {
      againRef.current = false;
      doSaveRef.current?.();
    }
  }, []); // No deps needed — reads everything from refs
  const doSaveRef = useRef(doSave);
  useEffect(() => { doSaveRef.current = doSave; }, [doSave]);

  // Manual save
  const save = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabledRef.current) return;
    doSave();
  }, [doSave]);

  // Mark data as changed (triggers auto-save timer)
  const markDirty = useCallback(() => {
    if (!enabled) return;
    changeCounterRef.current += 1;
    setSaveStatus('unsaved');

    // Debounce auto-save
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSave();
    }, autoSaveDelay);
  }, [doSave, autoSaveDelay, enabled]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  // Warn on leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus === 'unsaved' || saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  return {
    saveStatus,    // 'saved' | 'saving' | 'unsaved' | 'error'
    lastSaved,     // Date or null
    errorMessage,  // string or null
    save,          // manual save function
    markDirty      // call when data changes
  };
}
