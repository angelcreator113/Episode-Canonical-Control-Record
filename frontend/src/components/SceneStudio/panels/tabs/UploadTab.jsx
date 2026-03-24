import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Image, X, Loader } from 'lucide-react';
import assetService from '../../../../services/assetService';
import { computeInsertionRect } from './insertionUtils';

/**
 * UploadTab — Inline drag-drop upload zone within the CreationPanel.
 * Uploads files and immediately places them on the canvas.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

export default function UploadTab({ showId, episodeId, canvasWidth, canvasHeight, onAddAsset, focusTarget, onClearFocus }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const fileInputRef = useRef(null);

  // Focus file picker when requested
  useEffect(() => {
    if (focusTarget === 'upload-zone' && fileInputRef.current) {
      fileInputRef.current.click();
      if (onClearFocus) onClearFocus();
    }
  }, [focusTarget, onClearFocus]);

  const processFile = useCallback(async (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, or WebM.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum 50MB.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'prop');
      if (showId) formData.append('show_id', showId);
      if (episodeId) formData.append('episode_id', episodeId);

      const { data } = await assetService.uploadAsset(formData);
      const asset = data.data || data.asset || data;

      // Add to recent uploads
      setRecentUploads((prev) => [asset, ...prev].slice(0, 6));

      // Place on canvas
      if (onAddAsset) {
        const isVideo = (asset.content_type || '').startsWith('video/');
        const objType = isVideo ? 'video' : 'image';
        const rect = computeInsertionRect({
          srcWidth: asset.width || 400,
          srcHeight: asset.height || 400,
          canvasWidth: canvasWidth || 1920,
          canvasHeight: canvasHeight || 1080,
          assetRole: 'prop',
          objectType: objType,
        });
        onAddAsset({
          id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: objType,
          assetId: asset.id,
          assetUrl: asset.s3_url_processed || asset.s3_url_raw || '',
          ...rect,
          rotation: 0,
          opacity: 1,
          isVisible: true,
          isLocked: false,
          label: file.name.replace(/\.[^.]+$/, ''),
          assetRole: 'prop',
          usageType: 'overlay',
          _asset: asset,
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [showId, episodeId, onAddAsset]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleAddRecent = useCallback((asset) => {
    if (!onAddAsset) return;
    const isVideo = (asset.content_type || '').startsWith('video/');
    const objType = isVideo ? 'video' : 'image';
    const rect = computeInsertionRect({
      srcWidth: asset.width || 400,
      srcHeight: asset.height || 400,
      canvasWidth: canvasWidth || 1920,
      canvasHeight: canvasHeight || 1080,
      assetRole: 'prop',
      objectType: objType,
    });
    onAddAsset({
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: objType,
      assetId: asset.id,
      assetUrl: asset.s3_url_processed || asset.s3_url_raw || '',
      ...rect,
      rotation: 0,
      opacity: 1,
      isVisible: true,
      isLocked: false,
      label: asset.original_filename || 'Upload',
      assetRole: 'prop',
      usageType: 'overlay',
      _asset: asset,
    });
  }, [onAddAsset, canvasWidth, canvasHeight]);

  return (
    <div className="scene-studio-upload-tab">
      {/* Drop zone */}
      <div
        className={`scene-studio-drop-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader size={24} className="scene-studio-spin-icon" />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <Upload size={24} />
            <span>Drop file here or click to upload</span>
            <span className="scene-studio-drop-hint">JPG, PNG, WebP, GIF, MP4 — 50MB max</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {error && (
        <div className="scene-studio-upload-error">
          <span>{error}</span>
          <button className="scene-studio-icon-btn" onClick={() => setError(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Recent uploads */}
      {recentUploads.length > 0 && (
        <div className="scene-studio-recent-section">
          <div className="scene-studio-section-label">Recent Uploads</div>
          <div className="scene-studio-asset-grid">
            {recentUploads.map((asset) => {
              const thumbUrl = asset.s3_url_processed || asset.s3_url_raw || '';
              return (
                <div
                  key={asset.id}
                  className="scene-studio-asset-thumb"
                  onClick={() => handleAddRecent(asset)}
                  title={asset.original_filename || 'Upload'}
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="scene-studio-no-thumb"><Image size={20} /></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
