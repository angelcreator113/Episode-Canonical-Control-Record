import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  startExport,
  getExportStatus,
  getExportDownload,
  cancelExport,
  subscribeToExportProgress,
  disconnectSocket,
} from '../services/exportService';
import api from '../services/api';
import './ExportPage.css';

// Simple inline preview component (replaces old Stage from deprecated SceneComposer)
function ScenePreview({ scene, platform }) {
  return (
    <div className="scene-preview-placeholder" style={{ 
      width: '100%', 
      height: '100%', 
      background: `url(${scene?.thumbnail || scene?.backgroundUrl || ''}) center/cover no-repeat`,
      backgroundColor: '#1a1a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      <div className="platform-badge" style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
      }}>
        {platform?.icon} {platform?.name}
      </div>
      {scene?.title && (
        <div style={{
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '14px',
        }}>
          {scene.title}
        </div>
      )}
    </div>
  );
}

function ExportPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();

  const [episode, setEpisode] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [platform, setPlatform] = useState('youtube');
  const [quality, setQuality] = useState('1080p');
  const [format, setFormat] = useState('mp4');
  const [loading, setLoading] = useState(true);

  // Export state
  const [exportState, setExportState] = useState('idle'); // idle | exporting | completed | failed
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [exportJobId, setExportJobId] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);

  // Cleanup ref for socket unsubscribe
  const unsubRef = useRef(null);

  const platforms = {
    youtube: { width: 1920, height: 1080, ratio: '16:9', name: 'YouTube', icon: '📺' },
    instagram: { width: 1080, height: 1920, ratio: '9:16', name: 'Instagram', icon: '📱' },
    tiktok: { width: 1080, height: 1920, ratio: '9:16', name: 'TikTok', icon: '🎵' },
    twitter: { width: 1200, height: 675, ratio: '16:9', name: 'Twitter', icon: '𝕏' },
    square: { width: 1080, height: 1080, ratio: '1:1', name: 'Square', icon: '⬛' },
    cinema: { width: 2560, height: 1440, ratio: '16:9', name: '4K', icon: '🎬' },
  };

  const qualities = {
    '4k': { width: 3840, height: 2160, label: '4K (3840×2160)' },
    '1080p': { width: 1920, height: 1080, label: '1080p (1920×1080)' },
    '720p': { width: 1280, height: 720, label: '720p (1280×720)' },
    '480p': { width: 854, height: 480, label: '480p (854×480)' },
  };

  // Progress step labels
  const exportStages = [
    { key: 'queued', label: 'Queued' },
    { key: 'downloading', label: 'Loading Assets' },
    { key: 'rendering', label: 'Rendering Frames' },
    { key: 'encoding', label: 'Encoding Video' },
    { key: 'uploading', label: 'Uploading' },
    { key: 'complete', label: 'Complete' },
  ];

  // ─── Load Episode Data from API ──────────────────────────────────────
  useEffect(() => {
    loadEpisodeData();
  }, [episodeId]);

  // ─── Playback Loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.016;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // ─── Cleanup socket on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
      disconnectSocket();
    };
  }, []);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadEpisodeData = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

      // Fetch episode
      const epRes = await api.get(`/api/v1/episodes/${episodeId}`);
      const ep = epRes.data?.episode || epRes.data;

      // Fetch scenes
      let fetchedScenes = [];
      try {
        const scRes = await api.get(`/api/v1/episodes/${episodeId}/scenes`);
        fetchedScenes = scRes.data?.data || scRes.data?.scenes || (Array.isArray(scRes.data) ? scRes.data : []);
      } catch (e) {
        console.warn('Could not fetch scenes:', e.message);
      }

      const totalDur = fetchedScenes.reduce((sum, s) => sum + (s.duration_seconds || 5), 0);

      setEpisode({
        ...ep,
        total_duration: totalDur || ep.total_duration || 0,
      });
      setScenes(fetchedScenes);
      setTotalDuration(totalDur);
      setPlatform(ep.platform || 'youtube');
    } catch (error) {
      console.error('Failed to load episode:', error);
      // Fallback to minimal data so page still renders
      setEpisode({
        id: episodeId,
        episode_number: '?',
        title: 'Episode',
        total_duration: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Export Handlers ─────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExportState('exporting');
    setExportProgress(0);
    setExportStage('queued');
    setExportResult(null);
    setExportError(null);

    try {
      const result = await startExport(episodeId, { platform, quality, format });
      const jobId = result.jobId;
      setExportJobId(jobId);

      // Subscribe to real-time progress via Socket.io
      const unsub = subscribeToExportProgress(jobId, {
        onProgress: (data) => {
          setExportProgress(data.percent || data.progress || 0);
          setExportStage(data.stage || 'rendering');
        },
        onComplete: (data) => {
          setExportState('completed');
          setExportProgress(100);
          setExportStage('complete');
          setExportResult(data);
        },
        onFailed: (data) => {
          setExportState('failed');
          setExportError(data.error || data.message || 'Export failed');
        },
      });

      unsubRef.current = unsub;

      // Also poll status as fallback (in case socket misses events)
      pollExportStatus(jobId);
    } catch (error) {
      console.error('Failed to start export:', error);
      setExportState('failed');
      setExportError(error.response?.data?.message || error.message || 'Failed to start export');
    }
  }, [episodeId, platform, quality, format]);

  const pollExportStatus = useCallback(async (jobId) => {
    const poll = async () => {
      try {
        const status = await getExportStatus(jobId);

        if (status.state === 'completed') {
          setExportState('completed');
          setExportProgress(100);
          setExportStage('complete');
          setExportResult(status.result);
          return; // stop polling
        }

        if (status.state === 'failed') {
          setExportState('failed');
          setExportError(status.error || 'Export failed');
          return; // stop polling
        }

        // Update progress from poll if socket hasn't provided it
        if (status.progress > 0) {
          setExportProgress((prev) => Math.max(prev, status.progress));
        }
        if (status.stage) {
          setExportStage(status.stage);
        }

        // Continue polling
        setTimeout(poll, 3000);
      } catch (e) {
        // Don't fail on poll errors — socket is primary
        console.warn('Poll error:', e.message);
        setTimeout(poll, 5000);
      }
    };

    // Start polling after a short delay (socket should be faster)
    setTimeout(poll, 2000);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!exportJobId) return;
    try {
      await cancelExport(exportJobId);
      setExportState('idle');
      setExportProgress(0);
      setExportStage('');
      setExportJobId(null);
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  }, [exportJobId]);

  const handleDownload = useCallback(async () => {
    if (!exportJobId) return;
    try {
      const dlData = await getExportDownload(exportJobId);
      if (dlData.downloadUrl) {
        window.open(dlData.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [exportJobId]);

  const handleExportAnother = useCallback(() => {
    setExportState('idle');
    setExportProgress(0);
    setExportStage('');
    setExportJobId(null);
    setExportResult(null);
    setExportError(null);
  }, []);

  // ─── Computed ────────────────────────────────────────────────────────
  const currentPlatform = platforms[platform];
  const isExporting = exportState === 'exporting';

  // Determine which step is active
  const getStepStatus = (stepKey) => {
    const stageOrder = exportStages.map((s) => s.key);
    const currentIdx = stageOrder.indexOf(exportStage);
    const stepIdx = stageOrder.indexOf(stepKey);

    if (exportState !== 'exporting' && exportState !== 'completed') return 'pending';
    if (stepIdx < currentIdx) return 'complete';
    if (stepIdx === currentIdx) return exportState === 'completed' ? 'complete' : 'active';
    return 'pending';
  };

  if (loading) {
    return (
      <div className="export-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading export options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="export-page">
      {/* Header */}
      <header className="export-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(`/episodes/${episodeId}/timeline`)}>
            ← Back to Timeline
          </button>
          <div className="page-title">
            <h1>Export Episode</h1>
            <span className="episode-meta">
              Episode {episode?.episode_number}: {episode?.title}
            </span>
          </div>
        </div>
      </header>

      <div className="export-content">
        {/* Preview Section - Interactive Video Player */}
        <section className="export-preview-section">
          <h2>📺 Final Video Preview</h2>
          <div className="preview-container">
            <div 
              className="export-preview-canvas"
              style={{ aspectRatio: currentPlatform.ratio.replace(':', ' / ') }}
            >
              {scenes.length > 0 ? (
                <>
                  <ScenePreview
                    platform={currentPlatform}
                    scene={scenes[0]}
                  />
                </>
              ) : (
                <div className="preview-frame">
                  <div className="platform-badge">
                    {currentPlatform.icon} {currentPlatform.name}
                  </div>
                  <div className="preview-placeholder">
                    <span className="preview-icon">🎬</span>
                    <p className="preview-title">No Scenes Yet</p>
                    <p className="preview-info">{currentPlatform.width} × {currentPlatform.height}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Playback Controls */}
            {scenes.length > 0 && (
              <div className="preview-controls">
                <button 
                  className="play-pause-btn"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>

                <div className="time-display">
                  <span className="time-label">{formatTime(currentTime)}</span>
                  <input 
                    type="range"
                    className="time-scrubber"
                    min="0"
                    max={totalDuration || 0}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  />
                  <span className="time-label">{formatTime(totalDuration)}</span>
                </div>
              </div>
            )}

            <div className="platform-info">
              <p>
                <strong>Platform:</strong> {currentPlatform.icon} {currentPlatform.name} 
                <span className="ratio-badge">{currentPlatform.ratio}</span>
              </p>
              <p>
                <strong>Resolution:</strong> {currentPlatform.width} × {currentPlatform.height} px
                <span className="duration-badge">{formatTime(totalDuration)} total</span>
              </p>
            </div>
          </div>
        </section>

        {/* Export Settings */}
        <section className="export-settings-section">
          <h2>Export Settings</h2>

          <div className="settings-grid">
            {/* Platform */}
            <div className="setting-group">
              <label className="setting-label">
                <span className="label-icon">📱</span>
                Platform
              </label>
              <select 
                className="setting-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={isExporting}
              >
                {Object.entries(platforms).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.icon} {p.name} ({p.ratio})
                  </option>
                ))}
              </select>
              <p className="setting-hint">
                Selected in Scene Composer: {currentPlatform.icon} {currentPlatform.name}
              </p>
            </div>

            {/* Quality */}
            <div className="setting-group">
              <label className="setting-label">
                <span className="label-icon">🎞️</span>
                Quality
              </label>
              <select 
                className="setting-select"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                disabled={isExporting}
              >
                {Object.entries(qualities).map(([key, q]) => (
                  <option key={key} value={key}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div className="setting-group">
              <label className="setting-label">
                <span className="label-icon">💾</span>
                Format
              </label>
              <select 
                className="setting-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                disabled={isExporting}
              >
                <option value="mp4">MP4 (Recommended)</option>
                <option value="mov">MOV</option>
                <option value="webm">WebM</option>
              </select>
            </div>

            {/* Duration */}
            <div className="setting-group">
              <label className="setting-label">
                <span className="label-icon">⏱️</span>
                Duration
              </label>
              <div className="setting-value">
                {Math.floor(episode?.total_duration / 60)}:
                {(episode?.total_duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Export Info */}
          <div className="export-info">
            <h3>Export Details</h3>
            <ul className="export-details-list">
              <li>
                <span>Resolution:</span>
                <strong>{currentPlatform.width} × {currentPlatform.height}</strong>
              </li>
              <li>
                <span>Aspect Ratio:</span>
                <strong>{currentPlatform.ratio}</strong>
              </li>
              <li>
                <span>Estimated File Size:</span>
                <strong>~{Math.round(episode?.total_duration * 5)}MB</strong>
              </li>
              <li>
                <span>Estimated Time:</span>
                <strong>~{Math.round(episode?.total_duration * 2)}s</strong>
              </li>
            </ul>
          </div>

          {/* Export Progress Steps */}
          {(exportState === 'exporting' || exportState === 'completed') && (
            <div className="export-progress">
              <div className="progress-steps">
                {exportStages.map((step, i) => (
                  <div key={step.key} className={`progress-step ${getStepStatus(step.key)}`}>
                    <div className="step-indicator">
                      {getStepStatus(step.key) === 'complete' ? '✓' : i + 1}
                    </div>
                    <span className="step-label">{step.label}</span>
                  </div>
                ))}
              </div>
              <div className="progress-bar-wrapper">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <p className="progress-text">
                {exportState === 'completed'
                  ? 'Export complete!'
                  : `${exportStage ? exportStage.charAt(0).toUpperCase() + exportStage.slice(1) : 'Processing'}... ${Math.round(exportProgress)}%`}
              </p>
            </div>
          )}

          {/* Export Complete State */}
          {exportState === 'completed' && (
            <div className="export-complete">
              <div className="complete-icon">✅</div>
              <h3>Export Complete!</h3>
              <p className="complete-details">
                {currentPlatform.icon} {currentPlatform.name} &bull; {quality} &bull; {format.toUpperCase()}
              </p>
              <div className="complete-actions">
                <button className="download-btn" onClick={handleDownload}>
                  📥 Download Video
                </button>
                <button className="export-another-btn" onClick={handleExportAnother}>
                  🔄 Export Another
                </button>
              </div>
            </div>
          )}

          {/* Export Error State */}
          {exportState === 'failed' && (
            <div className="export-error">
              <div className="error-icon">❌</div>
              <h3>Export Failed</h3>
              <p className="error-message">{exportError || 'An unexpected error occurred'}</p>
              <div className="error-actions">
                <button className="retry-btn" onClick={handleExport}>
                  🔄 Retry Export
                </button>
                <button className="export-another-btn" onClick={handleExportAnother}>
                  ← Back to Settings
                </button>
              </div>
            </div>
          )}

          {/* Export Button (idle state) */}
          {exportState === 'idle' && (
            <button
              className="export-action-btn"
              onClick={handleExport}
              disabled={!episode || scenes.length === 0}
            >
              📥 Export Video
            </button>
          )}

          {/* Cancel Button (exporting state) */}
          {exportState === 'exporting' && (
            <button className="cancel-export-btn" onClick={handleCancel}>
              ✖ Cancel Export
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

export default ExportPage;
