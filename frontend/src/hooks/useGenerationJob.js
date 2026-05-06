import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Track 6 CP9 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 5 helpers covering 5 fetch sites on /memories/* (pipeline + batch
// generation + status polling). Hook exports these as named exports so
// behavioral tests can import them directly per Pattern D + E. The hook
// itself (default export) consumes the helpers; consumer components
// (callers of useGenerationJob) are unchanged.
export const getPipelineStatusApi = (jobId) =>
  apiClient.get(`${API_BASE}/memories/pipeline-generate-status/${jobId}`);
export const getBatchStatusApi = (jobId) =>
  apiClient.get(`${API_BASE}/memories/batch-generate-status/${jobId}`);
export const getBatchStoryApi = (jobId, storyNum) =>
  apiClient.get(`${API_BASE}/memories/batch-generate-story/${jobId}/${storyNum}`);
export const startPipelineBackgroundApi = (payload) =>
  apiClient.post(`${API_BASE}/memories/pipeline-generate-background`, payload);
export const startBatchBackgroundApi = (payload) =>
  apiClient.post(`${API_BASE}/memories/batch-generate-background`, payload);

/**
 * Encapsulates the entire story-generation polling lifecycle.
 *
 * Handles:
 *  - Single story background generation + polling
 *  - Batch generation + polling
 *  - Timer (elapsed seconds)
 *  - Persisting/resuming jobs across page navigations (localStorage)
 *  - Browser notifications
 *
 * Returns { status, progress, elapsed, generate, batchGenerate, cancel }
 */
export default function useGenerationJob({ selectedChar, tasks, stories, approvedStories, onStoryReady, onStoriesBatchUpdate, addToast }) {
  const [generating, setGenerating] = useState(false);
  const [generatingNum, setGeneratingNum] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [batchGenProgress, setBatchGenProgress] = useState(null);

  const elapsedRef = useRef(null);
  const pollRef = useRef(null);

  // --- Timer ---
  const startTimer = useCallback(() => {
    setElapsed(0);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    const t0 = Date.now();
    elapsedRef.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // --- Browser notifications ---
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body, icon: '/favicon.ico' });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (_) { /* mobile may not support */ }
    }
  }

  // --- Cleanup polling on unmount ---
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // --- Single story poll ---
  const startSinglePoll = useCallback((jobId, storyNumber) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let notFoundCount = 0;
    const pollStartedAt = Date.now();
    const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes max

    pollRef.current = setInterval(async () => {
      // Safety: give up after 10 minutes of polling
      if (Date.now() - pollStartedAt > MAX_POLL_MS) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        localStorage.removeItem('storyEngine_activeJob');
        addToast('Story generation timed out — please try again.', 'error');
        setGenerating(false);
        setGeneratingNum(null);
        stopTimer();
        return;
      }

      try {
        let res;
        try {
          res = await getPipelineStatusApi(jobId);
        } catch (httpErr) {
          // Job not found (404) — server may have restarted and lost the in-memory job
          if (httpErr.response?.status === 404) {
            notFoundCount++;
            if (notFoundCount >= 3) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              localStorage.removeItem('storyEngine_activeJob');
              addToast('Story generation was lost — the server may have restarted. Please try again.', 'error');
              setGenerating(false);
              setGeneratingNum(null);
              stopTimer();
            }
          }
          return;
        }
        notFoundCount = 0; // reset on success
        const job = res.data;

        if (job.status === 'completed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          localStorage.removeItem('storyEngine_activeJob');

          if (job.result?.fallback) {
            addToast('Story generation failed — please try again.', 'error');
          } else {
            onStoryReady(storyNumber, job.result);
            addToast(`Story ${storyNumber} generated successfully!`, 'success');
            sendBrowserNotification('Story Ready', `Story ${storyNumber}: ${job.result?.title || 'Untitled'} is ready for review.`);
          }
          setGenerating(false);
          setGeneratingNum(null);
          stopTimer();
        } else if (job.status === 'failed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          localStorage.removeItem('storyEngine_activeJob');
          addToast(`Story ${storyNumber} generation failed: ${job.error}`, 'error');
          sendBrowserNotification('Generation Failed', `Story ${storyNumber} failed to generate.`);
          setGenerating(false);
          setGeneratingNum(null);
          stopTimer();
        }
      } catch (_) { /* network error — keep polling */ }
    }, 3000);
  }, [addToast, onStoryReady, stopTimer]);

  // --- Batch poll ---
  const startBatchPoll = useCallback((jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const fetchedStories = new Set();

    pollRef.current = setInterval(async () => {
      try {
        let statusRes;
        try {
          statusRes = await getBatchStatusApi(jobId);
        } catch {
          clearInterval(pollRef.current);
          pollRef.current = null;
          localStorage.removeItem('storyEngine_activeBatchJob');
          setGenerating(false);
          setBatchGenProgress(null);
          addToast('Batch job expired — server may have restarted', 'warning');
          return;
        }
        const job = statusRes.data;

        setBatchGenProgress({ current: job.completed, total: job.total, currentTitle: job.currentTitle });

        // Fetch newly completed stories
        const newlyCompleted = (job.completedStories || []).filter(n => !fetchedStories.has(n));
        for (const storyNum of newlyCompleted) {
          try {
            const storyRes = await getBatchStoryApi(jobId, storyNum);
            const storyData = storyRes.data;
            fetchedStories.add(storyNum);
            onStoriesBatchUpdate(storyNum, storyData);
          } catch { /* retry next poll */ }
        }

        if (job.status === 'completed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          localStorage.removeItem('storyEngine_activeBatchJob');
          setGenerating(false);
          setBatchGenProgress(null);
          const errorCount = job.errors?.length || 0;
          const successCount = job.total - errorCount;
          addToast(`Batch complete — ${successCount} stories generated${errorCount ? `, ${errorCount} failed` : ''}`, 'success');
          sendBrowserNotification('Batch Generation Complete', `${successCount}/${job.total} stories generated successfully.`);
        }
      } catch (_) { /* network error — keep polling */ }
    }, 4000);
  }, [addToast, onStoriesBatchUpdate]);

  // --- Generate single story ---
  const generate = useCallback(async (task) => {
    setGenerating(true);
    setGeneratingNum(task.story_number);
    startTimer();
    requestNotificationPermission();

    try {
      const previousStories = approvedStories
        .filter(n => n < task.story_number)
        .sort((a, b) => a - b)
        .map(n => ({
          number: n,
          title: stories[n]?.title || `Story ${n}`,
          summary: stories[n]?.text?.slice(0, 800) || '',
        }));

      const res = await startPipelineBackgroundApi({
        characterKey: selectedChar,
        storyNumber: task.story_number,
        taskBrief: task,
        previousStories,
      });
      const { jobId } = res.data;

      localStorage.setItem('storyEngine_activeJob', JSON.stringify({
        jobId, storyNumber: task.story_number, characterKey: selectedChar, startedAt: Date.now(),
      }));

      startSinglePoll(jobId, task.story_number);
    } catch (e) {
      console.error('handleGenerate error:', e);
      addToast('Story generation failed — please try again.', 'error');
      setGenerating(false);
      setGeneratingNum(null);
      stopTimer();
    }
  }, [selectedChar, approvedStories, stories, addToast, startTimer, stopTimer, startSinglePoll]);

  // --- Batch generate ---
  const batchGenerate = useCallback(async () => {
    const ungenerated = tasks.filter(t => !stories[t.story_number] && !approvedStories.includes(t.story_number));
    if (!ungenerated.length) {
      addToast('All stories already generated', 'info');
      return;
    }

    if (!window.confirm(`Generate ${ungenerated.length} remaining stories? This runs the full quality pipeline for each and continues in the background.`)) return;

    setGenerating(true);
    setBatchGenProgress({ current: 0, total: ungenerated.length, currentTitle: ungenerated[0]?.title });
    requestNotificationPermission();

    const previousStories = approvedStories
      .sort((a, b) => a - b)
      .map(n => ({
        number: n,
        title: stories[n]?.title || `Story ${n}`,
        summary: (stories[n]?.text || '').slice(0, 800),
      }));

    try {
      const response = await startBatchBackgroundApi({
        characterKey: selectedChar,
        taskBriefs: ungenerated,
        previousStories,
      });
      const { jobId, total } = response.data;

      localStorage.setItem('storyEngine_activeBatchJob', JSON.stringify({
        jobId, total, characterKey: selectedChar, startedAt: Date.now(),
      }));

      startBatchPoll(jobId);
    } catch (e) {
      console.error('Batch generate error:', e);
      addToast('Batch generation failed to start', 'error');
      setGenerating(false);
      setBatchGenProgress(null);
    }
  }, [selectedChar, tasks, stories, approvedStories, addToast, startBatchPoll]);

  // --- Cancel ---
  const cancel = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    localStorage.removeItem('storyEngine_activeJob');
    localStorage.removeItem('storyEngine_activeBatchJob');
    setGenerating(false);
    setGeneratingNum(null);
    setBatchGenProgress(null);
    stopTimer();
  }, [stopTimer]);

  // --- Resume on mount ---
  useEffect(() => {
    // Single story job
    try {
      const saved = localStorage.getItem('storyEngine_activeJob');
      if (saved) {
        const { jobId, storyNumber, startedAt } = JSON.parse(saved);
        if (Date.now() - startedAt > 30 * 60 * 1000) {
          localStorage.removeItem('storyEngine_activeJob');
        } else {
          setGenerating(true);
          setGeneratingNum(storyNumber);
          startTimer();
          addToast(`Resuming Story ${storyNumber} generation...`, 'info');
          startSinglePoll(jobId, storyNumber);
          return;
        }
      }
    } catch (_) {
      localStorage.removeItem('storyEngine_activeJob');
    }

    // Batch job
    try {
      const saved = localStorage.getItem('storyEngine_activeBatchJob');
      if (saved) {
        const { jobId, total, startedAt } = JSON.parse(saved);
        if (Date.now() - startedAt > 6 * 60 * 60 * 1000) {
          localStorage.removeItem('storyEngine_activeBatchJob');
          return;
        }
        setGenerating(true);
        setBatchGenProgress({ current: 0, total, currentTitle: 'Resuming...' });
        addToast('Resuming batch generation...', 'info');
        startBatchPoll(jobId);
      }
    } catch (_) {
      localStorage.removeItem('storyEngine_activeBatchJob');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    generating,
    generatingNum,
    elapsed,
    batchGenProgress,
    generate,
    batchGenerate,
    cancel,
  };
}
