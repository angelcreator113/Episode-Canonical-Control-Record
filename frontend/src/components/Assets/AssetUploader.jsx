// frontend/src/components/Assets/AssetUploader.jsx
import React, { useState, useRef } from 'react';
import './AssetUploader.css';

/**
 * AssetUploader - Context-aware file upload component
 * 
 * Features:
 * - Drag & drop or click to upload
 * - "Where should this live?" destination selector
 * - Smart defaults based on context
 * - Category selection
 * - Multiple file support
 * - File preview before upload
 * - Progress indication
 */

const SHOW_ASSET_CATEGORIES = {
  logos: { icon: '🎬', label: 'Logos & Branding' },
  backgrounds: { icon: '🖼️', label: 'Backgrounds' },
  intros: { icon: '🎵', label: 'Intros' },
  outros: { icon: '🎬', label: 'Outros' },
  music: { icon: '🎵', label: 'Music & Audio' },
  wardrobe: { icon: '👗', label: 'Wardrobe Library' },
  graphics: { icon: '✨', label: 'Graphics & Overlays' },
  other: { icon: '📎', label: 'Other' }
};

const EPISODE_ASSET_TYPES = {
  thumbnail: { icon: '🖼️', label: 'Thumbnail' },
  guest_photo: { icon: '👤', label: 'Guest Photo' },
  custom_graphic: { icon: '✨', label: 'Custom Graphic' },
  b_roll: { icon: '🎥', label: 'B-Roll Footage' },
  other: { icon: '📎', label: 'Other' }
};

function AssetUploader({ 
  context = 'show', // 'show' | 'episode'
  contextLabel,
  onUpload,
  onClose,
  allowDestinationChoice = true
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [destination, setDestination] = useState(context); // 'show' | 'episode'
  const [category, setCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const categories = destination === 'show' 
    ? SHOW_ASSET_CATEGORIES 
    : EPISODE_ASSET_TYPES;
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };
  
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };
  
  const handleFiles = (files) => {
    // Filter valid files (images, videos, audio)
    const validFiles = files.filter(file => {
      const validTypes = [
        'image/', 'video/', 'audio/',
        'application/pdf', 'application/msword'
      ];
      return validTypes.some(type => file.type.startsWith(type));
    });
    
    setSelectedFiles(validFiles);
  };
  
  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }
    
    if (!category) {
      alert('Please select a category');
      return;
    }
    
    setUploading(true);
    
    try {
      await onUpload(selectedFiles, category, destination);
      // Success - close modal
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <div className="asset-uploader-modal" onClick={onClose}>
      <div className="uploader-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="uploader-header">
          <h3>📤 Upload Assets</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        
        {/* Destination Selector (if allowed) */}
        {allowDestinationChoice && (
          <div className="destination-selector">
            <label className="section-label">Where should this live?</label>
            <p className="section-hint">
              Choose where to save these assets
            </p>
            
            <div className="destination-options">
              <button
                className={`destination-option ${destination === 'show' ? 'selected' : ''}`}
                onClick={() => {
                  setDestination('show');
                  setCategory(''); // Reset category when changing destination
                }}
              >
                <span className="dest-icon">📁</span>
                <div className="dest-info">
                  <span className="dest-label">Show Library</span>
                  <span className="dest-hint">Reusable across all episodes</span>
                </div>
                {destination === 'show' && <span className="dest-check">✓</span>}
              </button>
              
              <button
                className={`destination-option ${destination === 'episode' ? 'selected' : ''}`}
                onClick={() => {
                  setDestination('episode');
                  setCategory('');
                }}
              >
                <span className="dest-icon">📎</span>
                <div className="dest-info">
                  <span className="dest-label">Episode Only</span>
                  <span className="dest-hint">Just for this episode</span>
                </div>
                {destination === 'episode' && <span className="dest-check">✓</span>}
              </button>
            </div>
          </div>
        )}
        
        {/* Category Selector */}
        <div className="category-selector">
          <label className="section-label">
            Category {destination === 'show' ? '(Show Asset)' : '(Episode Asset)'}
          </label>
          <div className="category-grid">
            {Object.entries(categories).map(([key, cat]) => (
              <button
                key={key}
                className={`category-option ${category === key ? 'selected' : ''}`}
                onClick={() => setCategory(key)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
                {category === key && <span className="cat-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
        
        {/* File Drop Zone */}
        <div
          className={`drop-zone ${dragActive ? 'drag-active' : ''} ${selectedFiles.length > 0 ? 'has-files' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          
          {selectedFiles.length === 0 ? (
            <>
              <div className="drop-icon">📤</div>
              <p className="drop-text">
                Drag & drop files here or click to browse
              </p>
              <p className="drop-hint">
                Supports images, videos, audio, and documents
              </p>
            </>
          ) : (
            <>
              <div className="drop-icon">✓</div>
              <p className="drop-text">
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
              </p>
              <p className="drop-hint">
                Click to add more files
              </p>
            </>
          )}
        </div>
        
        {/* File Preview */}
        {selectedFiles.length > 0 && (
          <div className="file-preview">
            <label className="section-label">Files to Upload</label>
            <div className="file-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">
                      {file.type.startsWith('image/') ? '🖼️' :
                       file.type.startsWith('video/') ? '🎥' :
                       file.type.startsWith('audio/') ? '🎵' : '📄'}
                    </span>
                    <div className="file-details">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    className="btn-remove-file"
                    onClick={() => removeFile(index)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="uploader-actions">
          <button 
            className="btn-secondary"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={uploading || selectedFiles.length === 0 || !category}
          >
            {uploading ? 'Uploading...' : `Upload to ${destination === 'show' ? 'Show Library' : 'Episode'}`}
          </button>
        </div>
        
        {/* Context Label */}
        {contextLabel && (
          <div className="context-label">
            {contextLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetUploader;
