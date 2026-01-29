import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import sceneLibraryService from '../services/sceneLibraryService';
import { normalizeSceneThumbnail } from '../utils/urlUtils';
import './SceneLibrary.css';

const SceneLibrary = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState([]);
  const [processingStatus, setProcessingStatus] = useState(searchParams.get('status') || 'all');
  const [showId, setShowId] = useState(searchParams.get('showId') || '');

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [uploadThumbDataUrl, setUploadThumbDataUrl] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 24,
    offset: 0,
    hasMore: false,
  });

  // Load scenes
  const loadScenes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit: pagination.limit,
        offset: pagination.offset,
      };

      if (showId) params.showId = showId;
      if (searchQuery) params.search = searchQuery;
      if (selectedTags.length > 0) params.tags = selectedTags;
      if (processingStatus !== 'all') params.processingStatus = processingStatus;

      const response = await sceneLibraryService.listScenes(params);

      setScenes(response.data || []);
      setPagination(response.pagination || pagination);
    } catch (err) {
      console.error('Error loading scenes:', err);
      setError(err.message || 'Failed to load scene library');
    } finally {
      setLoading(false);
    }
  }, [showId, searchQuery, selectedTags, processingStatus, pagination.limit, pagination.offset]);

  // Generate video thumbnail
  const generateVideoThumbnail = (videoUrl) =>
    new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      video.addEventListener('loadeddata', () => {
        video.currentTime = Math.min(1, video.duration || 1); // grab frame at ~1s
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
        resolve(null); // fallback on error
      });
    });

  // Load on mount and filter changes
  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadFile(file);
    const previewUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(previewUrl);

    // Generate thumbnail frame
    const thumb = await generateVideoThumbnail(previewUrl);
    setUploadThumbDataUrl(thumb);
  };

  // Handle drag and drop
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        setUploadFile(file);
        const previewUrl = URL.createObjectURL(file);
        setUploadPreviewUrl(previewUrl);

        // Generate thumbnail frame
        generateVideoThumbnail(previewUrl).then((thumb) => {
          setUploadThumbDataUrl(thumb);
        });
      } else {
        setError('Please drop a video file');
      }
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    if (!showId) {
      setError('Please select a show first');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      const metadata = {
        showId,
        title: uploadFile.name.replace(/\.[^/.]+$/, ''), // Remove extension
      };

      await sceneLibraryService.uploadScene(uploadFile, metadata, (progress) => {
        setUploadProgress(progress);
      });

      setSuccess('Video uploaded successfully! Processing in background...');
      setUploadFile(null);
      setUploadProgress(0);
      setUploadPreviewUrl(null);
      setUploadThumbDataUrl(null);

      // Reload scenes after short delay
      setTimeout(() => {
        loadScenes();
        setSuccess(null);
      }, 2000);
    } catch (err) {
      console.error('Error uploading:', err);
      setError(err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchParams({ ...Object.fromEntries(searchParams), search: value });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '-- MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      uploading: { icon: '⏳', label: 'Uploading', class: 'status-uploading' },
      processing: { icon: '⚙️', label: 'Processing', class: 'status-processing' },
      ready: { icon: '✅', label: 'Ready', class: 'status-ready' },
      failed: { icon: '❌', label: 'Failed', class: 'status-failed' },
    };
    return badges[status] || badges.processing;
  };

  return (
    <div className="scene-library-page">
      {/* Header */}
      <div className="library-header">
        <div className="header-left">
          <h1>🎬 Scene Library</h1>
          <p>Master repository of scene clips</p>
        </div>
        <div className="header-right">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <div
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''} ${uploadFile ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {!uploadFile ? (
            <>
              <div className="dropzone-icon">📹</div>
              <h3>Upload Scene Clip</h3>
              <p>Drag & drop video file or click to browse</p>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-input"
              />
              <label htmlFor="file-input" className="btn-primary">
                Select Video
              </label>
            </>
          ) : (
            <>
              {uploadThumbDataUrl && (
                <div className="upload-thumb-preview">
                  <img src={uploadThumbDataUrl} alt="Upload preview" />
                </div>
              )}

              <div className="file-preview">
                <div className="file-icon">🎥</div>
                <div className="file-info">
                  <h4>{uploadFile.name}</h4>
                  <p>{formatFileSize(uploadFile.size)}</p>
                </div>
                <button
                  className="btn-remove"
                  onClick={() => {
                    setUploadFile(null);
                    setUploadPreviewUrl(null);
                    setUploadThumbDataUrl(null);
                  }}
                  disabled={uploading}
                >
                  ✕
                </button>
              </div>

              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span>{uploadProgress}%</span>
                </div>
              )}

              <button
                className="btn-primary btn-upload"
                onClick={handleUpload}
                disabled={uploading || !showId}
              >
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </button>

              {!showId && (
                <p className="warning-text">⚠️ Please select a show using the filter below</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>🔍 Search</label>
          <input
            type="text"
            placeholder="Search by title or description..."
            value={searchQuery}
            onChange={handleSearch}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>📺 Show</label>
          <select
            value={showId}
            onChange={(e) => setShowId(e.target.value)}
            className="filter-select"
          >
            <option value="">All Shows</option>
            <option value="show-1">Styling Adventures w Lala</option>
            {/* TODO: Load shows dynamically */}
          </select>
        </div>

        <div className="filter-group">
          <label>⚙️ Status</label>
          <select
            value={processingStatus}
            onChange={(e) => setProcessingStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="uploading">Uploading</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error">
          ❌ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          ✅ {success}
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {/* Scene Grid */}
      <div className="scenes-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading scene library...</p>
          </div>
        ) : scenes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎬</div>
            <h3>No scenes in library</h3>
            <p>Upload your first video clip to get started</p>
          </div>
        ) : (
          <>
            <div className="scenes-grid">
              {scenes.map((scene) => {
                const status = getStatusBadge(scene.processingStatus || scene.processing_status);
                return (
                  <div
                    key={scene.id}
                    className="scene-card"
                    onClick={() => navigate(`/scene-library/${scene.id}`)}
                  >
                    {/* Thumbnail */}
                    <div className="scene-thumbnail">
                      {(() => {
                        const thumbnailUrl = normalizeSceneThumbnail(scene);
                        return thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={scene.title} />
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
                      <div className={`status-badge ${status.class}`}>
                        {status.icon} {status.label}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="scene-info">
                      <h4 className="scene-title">{scene.title || 'Untitled Scene'}</h4>
                      {scene.description && (
                        <p className="scene-description">{scene.description}</p>
                      )}

                      <div className="scene-meta">
                        <span className="meta-item">
                          ⏱️ {formatDuration(scene.durationSeconds || scene.duration_seconds)}
                        </span>
                        <span className="meta-item">
                          📏 {scene.resolution || '--'}
                        </span>
                      </div>

                      {/* Tags */}
                      {scene.tags && scene.tags.length > 0 && (
                        <div className="scene-tags">
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

                      {/* Characters */}
                      {scene.characters && scene.characters.length > 0 && (
                        <div className="scene-characters">
                          👥 {scene.characters.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.hasMore && (
              <div className="pagination">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
                  }}
                  disabled={loading}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SceneLibrary;
