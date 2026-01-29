import React, { useState, useEffect } from 'react';
import sceneLibraryService from '../services/sceneLibraryService';
import VideoPlayer from './VideoPlayer';
import { normalizeSceneThumbnail, normalizeSceneVideo } from '../utils/urlUtils';
import './SceneLibraryPicker.css';

const SceneLibraryPicker = ({ isOpen, onClose, onSelect, showId, episodeId }) => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  const [selectedScene, setSelectedScene] = useState(null);
  const [previewScene, setPreviewScene] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('device'); // 'device' | 'library'
  const [resolvedShowId, setResolvedShowId] = useState(showId);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [uploadThumbDataUrl, setUploadThumbDataUrl] = useState(null);

  // Resolve show_id from episode if not provided
  useEffect(() => {
    const fetchShowId = async () => {
      if (!showId && episodeId && isOpen) {
        try {
          const response = await fetch(`/api/v1/episodes/${episodeId}`);
          const data = await response.json();
          const fetchedShowId = data.data?.show_id || data.data?.showId;
          console.log('Fetched show_id from episode:', fetchedShowId);
          setResolvedShowId(fetchedShowId);
        } catch (err) {
          console.error('Failed to fetch episode show_id:', err);
        }
      } else {
        setResolvedShowId(showId);
      }
    };
    
    if (isOpen) {
      fetchShowId();
    }
  }, [isOpen, showId, episodeId]);

  // Load scenes when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('SceneLibraryPicker opened with:', { showId, episodeId, resolvedShowId });
      loadScenes();
      loadTags();
    }
  }, [isOpen, resolvedShowId, searchQuery, selectedTags]);

  // Load scenes from library
  const loadScenes = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        processingStatus: 'ready', // Only show ready scenes
        limit: 50,
      };

      // Only add showId if it's valid (not null/undefined)
      if (resolvedShowId) {
        params.showId = resolvedShowId;
      }

      if (searchQuery) params.search = searchQuery;
      if (selectedTags.length > 0) params.tags = selectedTags;

      const response = await sceneLibraryService.listScenes(params);
      setScenes(response.data || []);
    } catch (err) {
      console.error('Error loading scenes:', err);
      setError(err.message || 'Failed to load scenes');
    } finally {
      setLoading(false);
    }
  };

  // Load available tags
  const loadTags = async () => {
    try {
      const tags = await sceneLibraryService.getAllTags(resolvedShowId || null);
      setAvailableTags(tags || []);
    } catch (err) {
      console.error('Error loading tags:', err);
      // Don't set error state for tags, it's not critical
    }
  };

  // Handle scene selection
  const handleSceneClick = (scene) => {
    setSelectedScene(scene);
  };

  // Handle preview
  const handlePreview = (scene, e) => {
    e.stopPropagation();
    setPreviewScene(scene);
    setShowPreview(true);
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedScene && onSelect) {
      onSelect(selectedScene);
      handleClose();
    }
  };

  // Handle close
  const handleClose = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setSelectedScene(null);
    setPreviewScene(null);
    setShowPreview(false);
    onClose();
  };

  // Toggle tag filter
  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Generate video thumbnail
  const generateVideoThumbnail = (videoUrl) =>
    new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      video.addEventListener('loadeddata', () => {
        video.currentTime = Math.min(1, video.duration || 1);
      });

      video.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      });

      video.addEventListener('error', () => {
        resolve(null);
      });
    });

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await validateAndSetFile(file);
    }
  };

  // Validate and set file
  const validateAndSetFile = async (file) => {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a video file (MP4, MOV, AVI, MKV, WEBM)');
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 500MB');
      return;
    }

    setUploadFile(file);
    setError(null);

    // Generate preview
    const previewUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(previewUrl);

    // Generate thumbnail frame
    const thumb = await generateVideoThumbnail(previewUrl);
    setUploadThumbDataUrl(thumb);
  };

  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!resolvedShowId) {
      console.error('Upload failed: showId not available', { showId, episodeId, resolvedShowId });
      setError('This episode does not have a Show assigned. Please edit the episode and assign it to a Show first.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      const metadata = {
        showId: resolvedShowId,
        title: uploadFile.name.replace(/\.[^/.]+$/, ''), // Remove extension
        description: '',
        tags: [],
        characters: [],
      };

      const response = await sceneLibraryService.uploadScene(uploadFile, metadata, (progress) => {
        setUploadProgress(progress);
      });

      // Success - reload scenes
      setUploadFile(null);
      setUploadProgress(0);
      setUploadPreviewUrl(null);
      setUploadThumbDataUrl(null);
      setShowUpload(false);
      
      // If in Device tab, auto-add the uploaded scene to episode
      if (activeTab === 'device' && response?.data && onSelect) {
        console.log('Auto-adding uploaded scene to episode:', response.data);
        onSelect(response.data);
        handleClose();
        return;
      }
      
      // Otherwise, reload scenes and switch to Library tab
      await loadScenes();
      setActiveTab('library');
      setError(null);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload scene');
    } finally {
      setIsUploading(false);
    }
  };

  // Cancel upload
  const cancelUpload = () => {
    setUploadFile(null);
    setUploadProgress(0);
    setUploadPreviewUrl(null);
    setUploadThumbDataUrl(null);
    setShowUpload(false);
    setError(null);
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-container picker-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header with Tabs */}
          <div className="modal-header">
            <div>
              <h2>🎬 Scene Library</h2>
              <div className="tab-navigation">
                <button
                  className={`tab-btn ${activeTab === 'device' ? 'active' : ''}`}
                  onClick={() => setActiveTab('device')}
                >
                  📁 From Device
                </button>
                <button
                  className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
                  onClick={() => setActiveTab('library')}
                >
                  📚 From Library
                </button>
              </div>
            </div>
            <button className="btn-close" onClick={handleClose}>
              ✕
            </button>
          </div>

          {/* Filters (only in Library tab) */}
          {activeTab === 'library' && (
            <div className="picker-filters">
            <div className="filter-search">
              <input
                type="text"
                placeholder="🔍 Search scenes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {availableTags.length > 0 && (
              <div className="filter-tags">
                <label>Filter by Tags:</label>
                <div className="tags-list">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      className={`tag-btn ${selectedTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-error">
              ❌ {error}
            </div>
          )}

          {/* Tab Content */}
          <div className="modal-body picker-body">
            {activeTab === 'device' ? (
              // FROM DEVICE TAB - Direct upload
              <div className="upload-container">
                <div className="upload-header">
                  <h3>📤 Upload from Device</h3>
                  <p className="upload-subtitle">Select a video file to upload and add to this episode</p>
                </div>
                
                {!uploadFile ? (
                  // Drag & drop zone
                  <div
                    className={`dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="dropzone-content">
                      <div className="dropzone-icon">🎬</div>
                      <p className="dropzone-title">Drag & drop video here</p>
                      <p className="dropzone-subtitle">or</p>
                      <label className="btn-primary btn-upload">
                        Browse Files
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleFileSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <p className="dropzone-hint">
                        Supported: MP4, MOV, AVI, MKV, WEBM (Max 500MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  // File selected
                  <div className="upload-preview">
                    {uploadThumbDataUrl && (
                      <div className="upload-thumb-preview">
                        <img src={uploadThumbDataUrl} alt="Upload preview" />
                      </div>
                    )}

                    <div className="file-info">
                      <div className="file-icon">🎥</div>
                      <div className="file-details">
                        <h4>{uploadFile.name}</h4>
                        <p>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>

                    {isUploading && (
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p>{uploadProgress}% uploaded</p>
                      </div>
                    )}

                    <div className="upload-actions">
                      <button
                        className="btn-secondary"
                        onClick={cancelUpload}
                        disabled={isUploading}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        onClick={handleUpload}
                        disabled={isUploading}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Scene'}
                      </button>
                    </div>

                    <p className="upload-note">
                      💡 Scene will be uploaded, processed, and added to this episode automatically.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // FROM LIBRARY TAB - Select existing scenes
              <>
                {loading ? (
                  <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading scenes...</p>
                  </div>
                ) : scenes.length === 0 ? (
                  // Empty library state
                  <div className="empty-state-cta">
                    <div className="empty-icon">📚</div>
                    <h3>No Scenes in Library</h3>
                    <p className="empty-description">
                      Your scene library is empty. Upload a scene from the "From Device" tab.
                    </p>
                    <button
                      className="btn-primary btn-large"
                      onClick={() => setActiveTab('device')}
                    >
                      📁 Go to Device Tab
                    </button>
                  </div>
                ) : (
                  // Scene grid
                  <div className="picker-grid">
                    {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={`picker-card ${selectedScene?.id === scene.id ? 'selected' : ''}`}
                    onClick={() => handleSceneClick(scene)}
                  >
                    {/* Thumbnail */}
                    <div className="picker-thumbnail">
                      {(() => {
                        const thumbnailUrl = normalizeSceneThumbnail(scene);
                        return thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={scene.title}
                          />
                        ) : (
                          <div className="thumbnail-placeholder">
                            <div className="placeholder-icon">🎥</div>
                            {(scene.processingStatus === 'processing' || scene.processing_status === 'processing') && (
                              <div className="thumbnail-processing-label">
                                Generating thumbnail...
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Preview button */}
                      <button
                        className="btn-preview"
                        onClick={(e) => handlePreview(scene, e)}
                      >
                        ▶ Preview
                      </button>

                      {/* Duration badge */}
                      <div className="duration-badge">
                        {formatDuration(scene.durationSeconds || scene.duration_seconds)}
                      </div>

                      {/* Selection indicator */}
                      {selectedScene?.id === scene.id && (
                        <div className="selection-indicator">
                          <div className="check-icon">✓</div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="picker-info">
                      <h4>{scene.title || 'Untitled Scene'}</h4>
                      {scene.description && <p>{scene.description}</p>}

                      {/* Meta */}
                      <div className="picker-meta">
                        {scene.characters && scene.characters.length > 0 && (
                          <span className="meta-item">
                            👥 {scene.characters.slice(0, 2).join(', ')}
                            {scene.characters.length > 2 && ` +${scene.characters.length - 2}`}
                          </span>
                        )}
                        {scene.resolution && (
                          <span className="meta-item">📏 {scene.resolution}</span>
                        )}
                      </div>

                      {/* Tags */}
                      {scene.tags && scene.tags.length > 0 && (
                        <div className="picker-tags">
                          {scene.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="tag">
                              {tag}
                            </span>
                          ))}
                          {scene.tags.length > 3 && (
                            <span className="tag tag-more">+{scene.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            {activeTab === 'library' && (
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={!selectedScene}
              >
                {selectedScene ? `Add "${selectedScene.title}" to Episode` : 'Select a Scene'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewScene && (
        <div className="modal-overlay preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-container preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewScene.title || 'Preview'}</h3>
              <button className="btn-close" onClick={() => setShowPreview(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body preview-body">
              <VideoPlayer
                videoUrl={normalizeSceneVideo(previewScene)}
                thumbnailUrl={normalizeSceneThumbnail(previewScene)}
                showTrimControls={false}
                autoPlay={true}
              />
              {previewScene.description && (
                <div className="preview-description">
                  <p>{previewScene.description}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPreview(false)}>
                Close Preview
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setSelectedScene(previewScene);
                  setShowPreview(false);
                }}
              >
                Select This Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SceneLibraryPicker;
