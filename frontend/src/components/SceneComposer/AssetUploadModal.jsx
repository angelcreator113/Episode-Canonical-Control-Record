import React, { useState, useRef, useCallback } from 'react';
import { assetService } from '../../services/assetService';
import './AssetUploadModal.css';

const ASSET_TYPE_CONFIG = {
  background: {
    label: 'Background',
    icon: '🎨',
    accept: '.jpg,.jpeg,.png,.webp',
    hint: 'JPG, PNG, or WebP images',
    backendType: 'BACKGROUND_IMAGE',
  },
  character: {
    label: 'Character',
    icon: '👤',
    accept: '.png,.webp',
    hint: 'PNG or WebP with transparency recommended',
    backendType: 'EPISODE_FRAME',
  },
  ui_element: {
    label: 'UI Element',
    icon: '📝',
    accept: '.png,.webp,.svg',
    hint: 'PNG, WebP, or SVG images',
    backendType: 'EPISODE_FRAME',
  },
  audio: {
    label: 'Audio',
    icon: '🎵',
    accept: '.mp3,.wav,.m4a',
    hint: 'MP3, WAV, or M4A audio',
    backendType: 'EPISODE_FRAME',
  },
  video: {
    label: 'Video',
    icon: '🎬',
    accept: '.mp4,.mov,.webm',
    hint: 'MP4, MOV, or WebM video',
    backendType: 'PROMO_VIDEO',
  },
};

function AssetUploadModal({ assetType = 'background', onUploadComplete, onClose }) {
  const [mode, setMode] = useState('choose'); // 'choose' | 'upload' | 'url'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const config = ASSET_TYPE_CONFIG[assetType] || ASSET_TYPE_CONFIG.background;

  const generatePreview = useCallback((selectedFile) => {
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('audio/')) {
      setPreview('audio');
    } else if (selectedFile.type.startsWith('video/')) {
      setPreview('video');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setError(null);
    
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.');
      return;
    }

    setFile(selectedFile);
    generatePreview(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;
    setError(null);

    if (droppedFile.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.');
      return;
    }

    setFile(droppedFile);
    generatePreview(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 8, 90));
    }, 250);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetType', config.backendType);

      const result = await assetService.uploadAsset(formData);
      clearInterval(progressInterval);
      setProgress(100);

      const fileUrl = result?.data?.s3_url || result?.data?.url || result?.file?.url;
      
      setTimeout(() => {
        onUploadComplete(fileUrl, result?.data || result?.file);
      }, 400);
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Upload failed:', err);
      setError(err?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    
    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      setError('Please enter a valid URL');
      return;
    }
    
    onUploadComplete(url, null);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="aum-overlay" onClick={onClose}>
      <div className="aum-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="aum-header">
          <span className="aum-header-icon">{config.icon}</span>
          <h2>Add {config.label}</h2>
          <button className="aum-close" onClick={onClose}>×</button>
        </div>

        {/* Mode Chooser */}
        {mode === 'choose' && !file && (
          <div className="aum-body">
            <div className="aum-mode-grid">
              <button className="aum-mode-card" onClick={() => setMode('upload')}>
                <span className="aum-mode-icon">📤</span>
                <span className="aum-mode-label">Upload File</span>
                <span className="aum-mode-hint">From your computer</span>
              </button>
              <button className="aum-mode-card" onClick={() => setMode('url')}>
                <span className="aum-mode-icon">🔗</span>
                <span className="aum-mode-label">Paste URL</span>
                <span className="aum-mode-hint">From the web or S3</span>
              </button>
            </div>
          </div>
        )}

        {/* Upload Mode */}
        {mode === 'upload' && !file && (
          <div className="aum-body">
            <div
              className={`aum-dropzone ${dragOver ? 'aum-dropzone-active' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="aum-dropzone-icon">{dragOver ? '📥' : '📁'}</div>
              <p className="aum-dropzone-text">
                {dragOver ? 'Drop it here!' : 'Drag & drop or click to browse'}
              </p>
              <p className="aum-dropzone-hint">{config.hint} — Max 50MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={config.accept}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
            <button className="aum-back-link" onClick={() => setMode('choose')}>
              ← Back to options
            </button>
          </div>
        )}

        {/* URL Mode */}
        {mode === 'url' && (
          <div className="aum-body">
            <div className="aum-url-input-group">
              <label className="aum-url-label">Image URL</label>
              <input
                type="text"
                className="aum-url-input"
                placeholder="https://example.com/image.png"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                autoFocus
              />
              {urlInput && urlInput.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) && (
                <div className="aum-url-preview">
                  <img 
                    src={urlInput} 
                    alt="Preview" 
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
            <button className="aum-back-link" onClick={() => { setMode('choose'); setUrlInput(''); }}>
              ← Back to options
            </button>
          </div>
        )}

        {/* File Selected / Upload Preview */}
        {file && (
          <div className="aum-body">
            <div className="aum-preview">
              {preview && preview !== 'audio' && preview !== 'video' ? (
                <img className="aum-preview-img" src={preview} alt="Preview" />
              ) : preview === 'audio' ? (
                <div className="aum-preview-placeholder">🎵</div>
              ) : preview === 'video' ? (
                <div className="aum-preview-placeholder">🎬</div>
              ) : null}
            </div>

            <div className="aum-file-info">
              <span className="aum-file-name">{file.name}</span>
              <span className="aum-file-size">{formatFileSize(file.size)}</span>
            </div>

            {uploading && (
              <div className="aum-progress">
                <div className="aum-progress-bar">
                  <div className="aum-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="aum-progress-text">{progress}%</span>
              </div>
            )}

            {!uploading && (
              <button
                className="aum-change-btn"
                onClick={() => { setFile(null); setPreview(null); setError(null); }}
              >
                Choose Different File
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && <div className="aum-error">{error}</div>}

        {/* Footer */}
        <div className="aum-footer">
          <button className="aum-btn-cancel" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          {mode === 'url' ? (
            <button
              className="aum-btn-primary"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
            >
              Use URL
            </button>
          ) : (
            <button
              className="aum-btn-primary"
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssetUploadModal;
