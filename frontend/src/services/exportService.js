/**
 * Export Service
 * Frontend API client for the video export system
 * Uses the shared axios instance and Socket.io for real-time progress
 */

import api from './api';
import { io } from 'socket.io-client';

// Socket.io singleton
let socket = null;

/**
 * Get or create the Socket.io connection
 */
export function getSocket() {
  if (!socket) {
    const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:3002';
    socket = io(baseURL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Export socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Export socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('🔌 Export socket error:', err.message);
    });
  }
  return socket;
}

/**
 * Disconnect the socket (cleanup)
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Start an export job
 * @param {string} episodeId
 * @param {Object} settings - { platform, quality, format, compositionId? }
 * @returns {Promise<Object>} - { success, jobId, status, settings }
 */
export async function startExport(episodeId, settings) {
  const response = await api.post(`/api/v1/episodes/${episodeId}/export`, settings);
  return response.data;
}

/**
 * Get status of a specific export job
 * @param {string} jobId
 * @returns {Promise<Object>} - { jobId, state, progress, stage, result, error }
 */
export async function getExportStatus(jobId) {
  const response = await api.get(`/api/v1/export/status/${jobId}`);
  return response.data;
}

/**
 * List recent exports for the current user
 * @param {number} limit
 * @returns {Promise<Object>} - { exports, total, queueStats }
 */
export async function getAllExports(limit = 20) {
  const response = await api.get(`/api/v1/exports`, { params: { limit } });
  return response.data;
}

/**
 * Cancel a pending export job
 * @param {string} jobId
 * @returns {Promise<Object>}
 */
export async function cancelExport(jobId) {
  const response = await api.delete(`/api/v1/export/${jobId}`);
  return response.data;
}

/**
 * Get download URL for a completed export
 * @param {string} jobId
 * @returns {Promise<Object>} - { downloadUrl, fileName, fileSize, format }
 */
export async function getExportDownload(jobId) {
  const response = await api.get(`/api/v1/export/download/${jobId}`);
  return response.data;
}

/**
 * Subscribe to real-time export progress via Socket.io
 * @param {string} jobId - The export job ID to watch
 * @param {Object} callbacks - { onProgress, onComplete, onFailed }
 * @returns {Function} unsubscribe function
 */
export function subscribeToExportProgress(jobId, { onProgress, onComplete, onFailed }) {
  const sock = getSocket();

  // Join the export-specific room
  sock.emit('join-export', jobId);

  // Listen for progress updates
  const handleProgress = (data) => {
    if (onProgress) onProgress(data);
  };

  const handleComplete = (data) => {
    if (onComplete) onComplete(data);
    // Auto-leave room on completion
    sock.emit('leave-export', jobId);
  };

  const handleFailed = (data) => {
    if (onFailed) onFailed(data);
    // Auto-leave room on failure
    sock.emit('leave-export', jobId);
  };

  sock.on('export:progress', handleProgress);
  sock.on('export:complete', handleComplete);
  sock.on('export:failed', handleFailed);

  // Return unsubscribe function for cleanup
  return () => {
    sock.off('export:progress', handleProgress);
    sock.off('export:complete', handleComplete);
    sock.off('export:failed', handleFailed);
    sock.emit('leave-export', jobId);
  };
}

export default {
  startExport,
  getExportStatus,
  getAllExports,
  cancelExport,
  getExportDownload,
  getSocket,
  disconnectSocket,
  subscribeToExportProgress,
};
