import React, { useState } from 'react';
import './ExportModal.css';

/**
 * ExportModal - Video export/render settings
 */
const ExportModal = ({ isOpen, onClose, onExport, totalDuration }) => {
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('high');
  const [resolution, setResolution] = useState('1920x1080');
  const [codec, setCodec] = useState('h264');
  const [frameRate, setFrameRate] = useState(30);
  const [audioCodec, setAudioCodec] = useState('aac');
  const [audioBitrate, setAudioBitrate] = useState(192);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      format,
      quality,
      resolution,
      codec,
      frameRate,
      audioCodec,
      audioBitrate
    });
  };

  const qualityPresets = {
    low: { videoBitrate: '2 Mbps', size: '~180 MB' },
    medium: { videoBitrate: '5 Mbps', size: '~450 MB' },
    high: { videoBitrate: '10 Mbps', size: '~900 MB' },
    ultra: { videoBitrate: '20 Mbps', size: '~1.8 GB' }
  };

  const estimatedSize = qualityPresets[quality]?.size || '—';

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h2>🎬 Export Video</h2>
          <button onClick={onClose} className="export-close-btn">✕</button>
        </div>

        <div className="export-modal-body">
          {/* Format Section */}
          <div className="export-section">
            <h3>Format</h3>
            <div className="export-button-group">
              <button
                className={`export-option-btn ${format === 'mp4' ? 'active' : ''}`}
                onClick={() => setFormat('mp4')}
              >
                <span className="option-icon">🎥</span>
                <span>MP4</span>
                <span className="option-badge">Recommended</span>
              </button>
              <button
                className={`export-option-btn ${format === 'mov' ? 'active' : ''}`}
                onClick={() => setFormat('mov')}
              >
                <span className="option-icon">🎞️</span>
                <span>MOV</span>
              </button>
              <button
                className={`export-option-btn ${format === 'webm' ? 'active' : ''}`}
                onClick={() => setFormat('webm')}
              >
                <span className="option-icon">🌐</span>
                <span>WebM</span>
              </button>
            </div>
          </div>

          {/* Quality Section */}
          <div className="export-section">
            <h3>Quality</h3>
            <div className="export-quality-grid">
              {Object.entries(qualityPresets).map(([key, preset]) => (
                <button
                  key={key}
                  className={`export-quality-card ${quality === key ? 'active' : ''}`}
                  onClick={() => setQuality(key)}
                >
                  <div className="quality-name">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                  <div className="quality-bitrate">{preset.videoBitrate}</div>
                  <div className="quality-size">{preset.size}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution Section */}
          <div className="export-section">
            <h3>Resolution</h3>
            <div className="export-button-group">
              <button
                className={`export-option-btn ${resolution === '3840x2160' ? 'active' : ''}`}
                onClick={() => setResolution('3840x2160')}
              >
                <span>4K (3840×2160)</span>
              </button>
              <button
                className={`export-option-btn ${resolution === '1920x1080' ? 'active' : ''}`}
                onClick={() => setResolution('1920x1080')}
              >
                <span>1080p (1920×1080)</span>
                <span className="option-badge">Recommended</span>
              </button>
              <button
                className={`export-option-btn ${resolution === '1280x720' ? 'active' : ''}`}
                onClick={() => setResolution('1280x720')}
              >
                <span>720p (1280×720)</span>
              </button>
            </div>
          </div>

          {/* Advanced Settings */}
          <details className="export-advanced">
            <summary>⚙️ Advanced Settings</summary>
            <div className="export-advanced-content">
              <div className="export-field">
                <label>Video Codec</label>
                <select value={codec} onChange={(e) => setCodec(e.target.value)}>
                  <option value="h264">H.264 (Recommended)</option>
                  <option value="h265">H.265 (HEVC)</option>
                  <option value="vp9">VP9</option>
                </select>
              </div>
              <div className="export-field">
                <label>Frame Rate</label>
                <select value={frameRate} onChange={(e) => setFrameRate(Number(e.target.value))}>
                  <option value={24}>24 fps</option>
                  <option value={30}>30 fps (Recommended)</option>
                  <option value={60}>60 fps</option>
                </select>
              </div>
              <div className="export-field">
                <label>Audio Codec</label>
                <select value={audioCodec} onChange={(e) => setAudioCodec(e.target.value)}>
                  <option value="aac">AAC (Recommended)</option>
                  <option value="mp3">MP3</option>
                  <option value="opus">Opus</option>
                </select>
              </div>
              <div className="export-field">
                <label>Audio Bitrate</label>
                <select value={audioBitrate} onChange={(e) => setAudioBitrate(Number(e.target.value))}>
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps (Recommended)</option>
                  <option value={320}>320 kbps</option>
                </select>
              </div>
            </div>
          </details>

          {/* Summary */}
          <div className="export-summary">
            <div className="summary-row">
              <span className="summary-label">Duration:</span>
              <span className="summary-value">{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toFixed(0).padStart(2, '0')}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Estimated Size:</span>
              <span className="summary-value">{estimatedSize}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Format:</span>
              <span className="summary-value">{format.toUpperCase()} • {resolution} • {frameRate}fps</span>
            </div>
          </div>
        </div>

        <div className="export-modal-footer">
          <button onClick={onClose} className="export-btn export-btn-secondary">
            Cancel
          </button>
          <button onClick={handleExport} className="export-btn export-btn-primary">
            🎬 Start Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
