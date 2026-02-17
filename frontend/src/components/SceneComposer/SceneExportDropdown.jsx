import React, { useState } from 'react';
import '../ExportDropdown/ExportDropdown.css';

/**
 * SceneExportDropdown — Scene Composer-specific export menu.
 * Focused on scene-level operations (image export, thumbnail, batch export,
 * and video export with format/quality selection).
 */
function SceneExportDropdown({
  onSaveAsImage,
  onSaveAsJpeg,
  onSetAsThumbnail,
  onExportAllScenes,
  onCopyToClipboard,
  onExportVideo,
  videoExporting,
  sceneName,
}) {
  const [open, setOpen] = useState(false);
  const [showVideoOptions, setShowVideoOptions] = useState(false);
  const [videoFormat, setVideoFormat] = useState('mp4');
  const [videoQuality, setVideoQuality] = useState('1080p');

  const handle = (fn) => {
    setOpen(false);
    if (fn) fn();
  };

  const handleStartVideoExport = () => {
    setOpen(false);
    setShowVideoOptions(false);
    if (onExportVideo) onExportVideo({ format: videoFormat, quality: videoQuality });
  };

  return (
    <div className="export-dropdown-wrapper">
      <button
        className="export-dropdown-btn"
        onClick={() => setOpen(!open)}
      >
        Export ▾
      </button>

      {open && (
        <>
          <div className="export-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="export-dropdown-menu">

            {/* ── Current Scene (Images) ── */}
            <div className="export-dropdown-section">Current Scene</div>

            <button className="export-dropdown-item" onClick={() => handle(onSaveAsImage)}>
              <span className="edi">📸</span>
              <div className="item-content">
                <span className="item-label">Save as PNG</span>
              </div>
            </button>

            <button className="export-dropdown-item" onClick={() => handle(onSaveAsJpeg)}>
              <span className="edi">🖼️</span>
              <div className="item-content">
                <span className="item-label">Save as JPEG</span>
              </div>
            </button>

            <button className="export-dropdown-item" onClick={() => handle(onCopyToClipboard)}>
              <span className="edi">📋</span>
              <div className="item-content">
                <span className="item-label">Copy to Clipboard</span>
              </div>
            </button>

            <div className="export-dropdown-divider" />

            {/* ── Video Export ── */}
            <div className="export-dropdown-section">Video</div>

            {!showVideoOptions ? (
              <button
                className="export-dropdown-item"
                onClick={() => setShowVideoOptions(true)}
                disabled={videoExporting}
              >
                <span className="edi">🎬</span>
                <div className="item-content">
                  <span className="item-label">
                    {videoExporting ? 'Export in Progress…' : 'Export as Video'}
                  </span>
                  <span className="item-desc" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                    MP4, WebM — all scenes
                  </span>
                </div>
              </button>
            ) : (
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Format selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', minWidth: '50px' }}>Format</label>
                  <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                    {['mp4', 'webm', 'mov'].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setVideoFormat(fmt)}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: videoFormat === fmt ? 600 : 400,
                          background: videoFormat === fmt ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.06)',
                          border: videoFormat === fmt ? '1px solid rgba(102,126,234,0.6)' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: videoFormat === fmt ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                        }}
                      >{fmt}</button>
                    ))}
                  </div>
                </div>

                {/* Quality selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', minWidth: '50px' }}>Quality</label>
                  <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                    {['480p', '720p', '1080p', '4k'].map(q => (
                      <button
                        key={q}
                        onClick={() => setVideoQuality(q)}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: videoQuality === q ? 600 : 400,
                          background: videoQuality === q ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)',
                          border: videoQuality === q ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: videoQuality === q ? '#34d399' : 'rgba(255,255,255,0.5)',
                          cursor: 'pointer',
                        }}
                      >{q}</button>
                    ))}
                  </div>
                </div>

                {/* Start button */}
                <button
                  onClick={handleStartVideoExport}
                  style={{
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  🚀 Start Export ({videoFormat.toUpperCase()} · {videoQuality})
                </button>
              </div>
            )}

            <div className="export-dropdown-divider" />

            {/* ── Thumbnail ── */}
            <div className="export-dropdown-section">Thumbnail</div>

            <button className="export-dropdown-item" onClick={() => handle(onSetAsThumbnail)}>
              <span className="edi">🎞️</span>
              <div className="item-content">
                <span className="item-label">Set as Episode Thumbnail</span>
              </div>
            </button>

            <div className="export-dropdown-divider" />

            {/* ── Batch ── */}
            <div className="export-dropdown-section">Batch</div>

            <button className="export-dropdown-item" onClick={() => handle(onExportAllScenes)}>
              <span className="edi">📦</span>
              <div className="item-content">
                <span className="item-label">Export All Scenes as PNG</span>
              </div>
            </button>

          </div>
        </>
      )}
    </div>
  );
}

export default SceneExportDropdown;
