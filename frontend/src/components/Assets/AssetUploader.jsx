// Maps AssetUploader "category key" -> backend assets.category enum
const SHOW_CATEGORY_TO_BACKEND = {
  logos: "ui_element",
  backgrounds: "background",
  intros: "overlay",
  outros: "overlay",
  music: "music",
  character_outfit: "wardrobe_outfit",
  character_hair: "wardrobe_hairstyle",
  character_pose: "wardrobe_pose",
  accessories: "wardrobe_accessory",
  graphics: "ui_element",
  other: "prop"
};

const EPISODE_CATEGORY_TO_BACKEND = {
  thumbnail: "ui_element",
  guest_photo: "prop",
  character_outfit: "wardrobe_outfit",
  character_hair: "wardrobe_hairstyle",
  character_pose: "wardrobe_pose",
  custom_graphic: "ui_element",
  b_roll: "background",
  other: "prop"
};

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
  character_outfit: { icon: '👗', label: 'Character Outfit' },
  character_hair: { icon: '💇', label: 'Character Hair' },
  character_pose: { icon: '🕺', label: 'Character Pose' },
  accessories: { icon: '👜', label: 'Accessories' },
  graphics: { icon: '✨', label: 'Graphics & Overlays' },
  other: { icon: '📎', label: 'Other' }
};

const EPISODE_ASSET_TYPES = {
  thumbnail: { icon: '🖼️', label: 'Thumbnail' },
  guest_photo: { icon: '👤', label: 'Guest Photo' },
  character_outfit: { icon: '👗', label: 'Character Outfit' },
  character_hair: { icon: '💇', label: 'Character Hair' },
  character_pose: { icon: '🕺', label: 'Character Pose' },
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
  const [wardrobeSubcategory, setWardrobeSubcategory] = useState('wardrobe_outfit');
  const [uploading, setUploading] = useState(false);

  // Wardrobe/Background metadata fields
  const [assetMeta, setAssetMeta] = useState({
    character_name: '',
    outfit_name: '',
    outfit_era: '',
    transformation_stage: 'neutral',
    entity_type: 'character',
    location_name: '',
    location_version: '',
    mood_tags: '',
    color_palette: '',
  });

  const isWardrobeCategory = category === 'wardrobe';
  const isBackgroundCategory = category === 'backgrounds';
  const showMetaFields = isWardrobeCategory || isBackgroundCategory;
  
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
    
    // Map UI category to backend enum
    let backendCategory = null;
    if (destination === 'show') {
      backendCategory = SHOW_CATEGORY_TO_BACKEND[category];
    } else {
      backendCategory = EPISODE_CATEGORY_TO_BACKEND[category];
    }
    // If wardrobe, use subcategory
    if (category === 'wardrobe') {
      backendCategory = wardrobeSubcategory;
    }

    if (!backendCategory) {
      alert('Upload category mapping missing. Please pick a valid category.');
      return;
    }

    // Validate wardrobe requires character_name
    if (category === 'wardrobe' && !assetMeta.character_name.trim()) {
      alert('Character name is required for wardrobe assets');
      return;
    }

    // Validate background requires location_name
    if (isBackgroundCategory && !assetMeta.location_name.trim()) {
      alert('Location name is required for background assets (used for grouping).');
      return;
    }

    setUploading(true);

    // Build metadata object for wardrobe/background categories
    const extraMeta = {};
    extraMeta.category = backendCategory;
    if (category === 'wardrobe') {
      extraMeta.entity_type = assetMeta.entity_type || 'character';
      extraMeta.character_name = assetMeta.character_name;
      extraMeta.outfit_name = assetMeta.outfit_name;
      extraMeta.outfit_era = assetMeta.outfit_era;
      extraMeta.transformation_stage = assetMeta.transformation_stage;
      if (assetMeta.color_palette) extraMeta.color_palette = assetMeta.color_palette;
    } else if (isBackgroundCategory) {
      extraMeta.entity_type = 'environment';
      extraMeta.location_name = assetMeta.location_name;
      extraMeta.location_version = assetMeta.location_version;
      if (assetMeta.mood_tags) extraMeta.mood_tags = assetMeta.mood_tags;
      if (assetMeta.color_palette) extraMeta.color_palette = assetMeta.color_palette;
    }

    try {
      await onUpload(selectedFiles, backendCategory, destination, extraMeta);
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

        {/* Wardrobe Subcategory Picker */}


        {/* Wardrobe Metadata Fields */}
        {isWardrobeCategory && (
          <div className="metadata-fields">
            <label className="section-label">👗 Wardrobe Details</label>
            <div className="meta-grid">
              <div className="meta-field">
                <label>Character Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Layla, Marcus"
                  value={assetMeta.character_name}
                  onChange={(e) => setAssetMeta({...assetMeta, character_name: e.target.value})}
                />
              </div>
              <div className="meta-field">
                <label>Outfit Name</label>
                <input
                  type="text"
                  placeholder="e.g. Red Gala Dress"
                  value={assetMeta.outfit_name}
                  onChange={(e) => setAssetMeta({...assetMeta, outfit_name: e.target.value})}
                />
              </div>
              <div className="meta-field">
                <label>Era / Season</label>
                <input
                  type="text"
                  placeholder="e.g. Season 1, Flashback"
                  value={assetMeta.outfit_era}
                  onChange={(e) => setAssetMeta({...assetMeta, outfit_era: e.target.value})}
                />
              </div>
              <div className="meta-field">
                <label>Transformation Stage</label>
                <select
                  value={assetMeta.transformation_stage}
                  onChange={(e) => setAssetMeta({...assetMeta, transformation_stage: e.target.value})}
                >
                  <option value="neutral">Neutral</option>
                  <option value="before">Before</option>
                  <option value="during">During</option>
                  <option value="after">After</option>
                </select>
              </div>
              <div className="meta-field">
                <label>Entity Type</label>
                <select
                  value={assetMeta.entity_type}
                  onChange={(e) => setAssetMeta({...assetMeta, entity_type: e.target.value})}
                >
                  <option value="character">Character</option>
                  <option value="creator">Creator</option>
                  <option value="prop">Prop</option>
                </select>
              </div>
              <div className="meta-field">
                <label>Color Palette</label>
                <input
                  type="text"
                  placeholder="e.g. #ff0000, #00ff00"
                  value={assetMeta.color_palette}
                  onChange={(e) => setAssetMeta({...assetMeta, color_palette: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}

        {/* Background Metadata Fields */}
        {isBackgroundCategory && (
          <div className="metadata-fields">
            <label className="section-label">🖼️ Background Details</label>
            <div className="meta-grid">
              <div className="meta-field">
                <label>Location Name <span style={{color: 'red'}}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. City Skyline, Coffee Shop"
                  value={assetMeta.location_name}
                  onChange={(e) => setAssetMeta({...assetMeta, location_name: e.target.value})}
                  required
                />
              </div>
              <div className="meta-field">
                <label>Version</label>
                <input
                  type="text"
                  placeholder="e.g. v1, Night, Winter"
                  value={assetMeta.location_version}
                  onChange={(e) => setAssetMeta({...assetMeta, location_version: e.target.value})}
                />
              </div>
              <div className="meta-field">
                <label>Mood Tags</label>
                <input
                  type="text"
                  placeholder="e.g. dramatic, warm, cozy"
                  value={assetMeta.mood_tags}
                  onChange={(e) => setAssetMeta({...assetMeta, mood_tags: e.target.value})}
                />
              </div>
              <div className="meta-field">
                <label>Color Palette</label>
                <input
                  type="text"
                  placeholder="e.g. #ff0000, #00ff00"
                  value={assetMeta.color_palette}
                  onChange={(e) => setAssetMeta({...assetMeta, color_palette: e.target.value})}
                />
              </div>
            </div>
          </div>
        )}
        
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
