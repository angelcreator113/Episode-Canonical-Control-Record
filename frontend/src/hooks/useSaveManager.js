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
 * @param {boolean} [options.enabled=true] - Enable/disable auto-save
 */
export default function useSaveManager({
  episodeId,
  getSavePayload,
  autoSaveDelay = 3000,
  enabled = true
}) {
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const [lastSaved, setLastSaved] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const timerRef = useRef(null);
  const changeCounterRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Perform the actual save
  const doSave = useCallback(async () => {
    if (!episodeId || !getSavePayload) return;

    const payload = getSavePayload();
    if (!payload) return;

    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      // Use unified save endpoint for atomic saves
      await saveEpisodeData(episodeId, payload);

      if (isMountedRef.current) {
        setSaveStatus('saved');
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Save failed:', error);
      if (isMountedRef.current) {
        setSaveStatus('error');
        setErrorMessage(error.response?.data?.error || error.message);
      }
    }
  }, [episodeId, getSavePayload]);

  // Manual save
  const save = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
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
