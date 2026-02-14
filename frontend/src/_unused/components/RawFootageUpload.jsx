import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiVideo, FiCheckCircle, FiX, FiLoader, FiAlertCircle, FiFolder, FiMoreVertical, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';
import footageService from '../services/footageService';
import AssetLibraryModal from './AssetLibraryModal';
import AnalysisDashboard from './AnalysisDashboard';

// Add spinner animation
const spinnerStyle = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Inject the style if not already present
if (typeof document !== 'undefined' && !document.getElementById('footage-upload-styles')) {
  const style = document.createElement('style');
  style.id = 'footage-upload-styles';
  style.textContent = spinnerStyle;
  document.head.appendChild(style);
}

/**
 * Raw Footage Upload Component
 * Handles video file uploads to S3 with progress tracking
 */
export default function RawFootageUpload({ episodeId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [errors, setErrors] = useState([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [importedAssets, setImportedAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFootage, setSelectedFootage] = useState(null);
  const [editMap, setEditMap] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Load existing footage on mount
  useEffect(() => {
    loadExistingFootage();
    loadImportedAssets();
  }, [episodeId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) {
        setOpenMenuId(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const loadExistingFootage = async () => {
    try {
      setLoading(true);
      const response = await footageService.getScenes(episodeId);
      console.log('Loaded scenes response:', response);
      
      // Extract scenes array from response object
      const scenesArray = response.scenes || response || [];
      console.log('Scenes array:', scenesArray);
      
      if (Array.isArray(scenesArray) && scenesArray.length > 0) {
        // Filter out scenes without S3 keys
        const validScenes = scenesArray.filter(scene => scene.rawFootageS3Key || scene.raw_footage_s3_key);
        console.log('Valid scenes with S3 keys:', validScenes);
        
        setUploadedFiles(validScenes.map(scene => ({
          id: scene.id,
          filename: scene.title || 'Untitled',
          size: 0, // Unknown for existing
          s3_key: scene.rawFootageS3Key || scene.raw_footage_s3_key,
          duration: scene.durationSeconds || scene.duration_seconds,
          status: 'complete'
        })));
      } else {
        console.log('No scenes found or invalid response format');
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error('Failed to load existing footage:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadImportedAssets = async () => {
    try {
      const response = await footageService.getEpisodeAssets(episodeId);
      if (response.success && response.assets) {
        setImportedAssets(response.assets);
        console.log('Loaded imported assets:', response.assets);
      }
    } catch (error) {
      console.error('Failed to load imported assets:', error);
    }
  };

  const handleImportAssets = async (assets) => {
    try {
      // Link assets to episode via API
      const assetIds = assets.map(asset => asset.id);
      const response = await footageService.linkAssetsToEpisode(episodeId, assetIds);
      
      if (response.success) {
        setImportedAssets(prev => [...prev, ...assets]);
        console.log('Successfully linked assets:', assets.map(a => a.name));
      }
    } catch (error) {
      console.error('Failed to link assets:', error);
      setErrors(prev => [...prev, {
        filename: 'Asset Import',
        message: 'Failed to link assets to episode'
      }]);
    }
  };

  const handleAnalyze = async (footageId) => {
    try {
      setAnalyzing(true);
      setSelectedFootage(uploadedFiles.find(f => f.id === footageId));
      
      // Trigger analysis
      await axios.post(`/api/v1/raw-footage/${footageId}/analyze`);
      console.log('✅ Analysis started for:', footageId);
      
      // Poll for results every 10 seconds
      const interval = setInterval(async () => {
        try {
          const res = await axios.get(`/api/v1/raw-footage/${footageId}/edit-map`);
          const map = res.data.data;
          
          if (map) {
            setEditMap(map);
            
            if (map.processing_status === 'completed') {
              clearInterval(interval);
              console.log('✅ Analysis complete!');
            }
          }
        } catch (err) {
          console.log('Waiting for analysis results...', err.message);
        }
      }, 10000); // Poll every 10 seconds
      
    } catch (error) {
      console.error('Failed to start analysis:', error);
      alert('Failed to start analysis: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteUpload = async (sceneId, filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      await footageService.deleteScene(sceneId);
      // Reload the full list from server to ensure consistency
      await loadExistingFootage();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error deleting upload:', error);
      alert('Failed to delete file');
    }
  };

  // Generate video thumbnail from file
  const generateVideoThumbnail = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Add timeout to prevent hanging on slow devices
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      }, 5000); // 5 second timeout
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadedmetadata = () => {
        // Seek to 1 second or 10% of duration
        video.currentTime = Math.min(1, video.duration * 0.1);
      };
      
      video.onseeked = () => {
        try {
          clearTimeout(timeout);
          
          // Limit canvas size for better mobile performance
          const maxWidth = 400;
          const maxHeight = 300;
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          // Scale down if needed
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw scaled frame
          ctx.drawImage(video, 0, 0, width, height);
          
          // Convert to data URL with lower quality for mobile
          const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
          
          // Clean up
          URL.revokeObjectURL(video.src);
          resolve(thumbnail);
        } catch (error) {
          clearTimeout(timeout);
          console.error('Error generating thumbnail:', error);
          URL.revokeObjectURL(video.src);
          resolve(null);
        }
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        console.error('Error loading video for thumbnail');
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
      
      // Create object URL from file
      video.src = URL.createObjectURL(file);
    });
  };

  // Video file validation - includes mobile formats
  const acceptedFormats = {
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],           // iOS MOV files
    'video/x-m4v': ['.m4v'],              // iOS M4V files
    'video/3gpp': ['.3gp'],               // Android 3GP files
    'video/3gpp2': ['.3g2'],              // Android 3G2 files
    'video/x-msvideo': ['.avi'],          // Desktop AVI
    'video/webm': ['.webm'],              // Desktop WebM
    'video/x-matroska': ['.mkv']          // Desktop MKV
  };

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const newErrors = rejectedFiles.map(({ file, errors }) => ({
        filename: file.name,
        message: errors.map(e => e.message).join(', ')
      }));
      setErrors(prev => [...prev, ...newErrors]);
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      setUploading(true);
      setErrors([]);

      // Upload all files in parallel for better performance
      const uploadPromises = acceptedFiles.map(file => uploadFile(file));
      await Promise.allSettled(uploadPromises);

      setUploading(false);
      if (onUploadComplete) onUploadComplete();
    }
  }, [episodeId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats,
    maxSize: 500 * 1024 * 1024, // 500MB max per file
    multiple: true
  });

  const uploadFile = async (file) => {
    const fileId = `${Date.now()}-${Math.random()}-${file.name}`;
    
    try {
      // Initialize progress immediately
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 0, status: 'uploading' }
      }));

      // Generate thumbnail asynchronously without blocking upload
      let localThumbnail = null;
      generateVideoThumbnail(file).then(thumb => {
        // Update with thumbnail when ready
        setUploadedFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, localThumbnail: thumb } : f)
        );
      }).catch(err => {
        console.warn('Thumbnail generation failed:', err);
      });

      // Upload using service
      const result = await footageService.uploadFootage(file, episodeId);

      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 100, status: 'complete' }
      }));

      // Add to uploaded files (thumbnail will be added asynchronously)
      setUploadedFiles(prev => [...prev, {
        id: result.scene?.id || fileId,
        filename: file.name,
        size: file.size,
        s3_key: result.scene?.raw_footage_s3_key,
        duration: result.scene?.duration_seconds,
        status: 'complete',
        localThumbnail: localThumbnail // Will be updated when generation completes
      }]);

      // Clear upload progress after 1 second to show success state
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 1000);

    } catch (error) {
      console.error('Upload error:', error);
      
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 0, status: 'error' }
      }));

      setErrors(prev => [...prev, {
        filename: file.name,
        message: error.response?.data?.message || error.message
      }]);
    }
  };

  const removeError = (index) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <FiLoader style={{ animation: 'spin 1s linear infinite', fontSize: '2rem', color: '#9b59b6', margin: '0 auto' }} />
          <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>Loading footage...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            style={{
              border: '2px dashed',
              borderColor: isDragActive ? '#9b59b6' : '#ddd',
              borderRadius: '8px',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: isDragActive ? '#f8f4fb' : '#fff',
            }}
            onMouseEnter={(e) => {
              if (!isDragActive) e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              if (!isDragActive) e.currentTarget.style.backgroundColor = '#fff';
            }}
          >
            <input {...getInputProps()} />
            <FiUploadCloud style={{ fontSize: '3rem', color: '#999', margin: '0 auto 1rem' }} />
            {isDragActive ? (
              <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#9b59b6' }}>Drop video files here...</p>
            ) : (
              <>
                <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#333', marginBottom: '0.5rem' }}>
                  Drag & drop video files here
                </p>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  or click to browse (MP4, MOV, AVI, WebM • Max 500MB per file)
                </p>
              </>
            )}
          </div>

          {/* OR Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, borderTop: '1px solid #d1d5db' }}></div>
            <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>OR</span>
            <div style={{ flex: 1, borderTop: '1px solid #d1d5db' }}></div>
          </div>

          {/* Import from Library Button */}
          <button
            onClick={() => setShowLibraryModal(true)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '2px dashed #c084fc',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              color: '#9b59b6',
              fontWeight: '500',
              fontSize: '0.875rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3e8ff';
              e.currentTarget.style.borderColor = '#9b59b6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#c084fc';
            }}
          >
            <FiFolder style={{ fontSize: '1.25rem' }} />
            <span>Import from Asset Library</span>
          </button>
        </>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {errors.map((error, idx) => (
            <div key={idx} style={{ 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px', 
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <FiAlertCircle style={{ color: '#ef4444', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#991b1b' }}>{error.filename}</p>
                  <p style={{ fontSize: '0.75rem', color: '#dc2626' }}>{error.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeError(idx)}
                style={{ color: '#f87171', cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <FiX />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Uploading...</h4>
          {Object.entries(uploadProgress).map(([fileId, { progress, status }]) => (
            <div key={fileId} style={{ 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px', 
              padding: '0.75rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileId.split('-').slice(1).join('-')}
                </span>
                {status === 'uploading' && (
                  <FiLoader style={{ animation: 'spin 1s linear infinite', color: '#9b59b6' }} />
                )}
                {status === 'complete' && (
                  <FiCheckCircle style={{ color: '#10b981' }} />
                )}
                {status === 'error' && (
                  <FiAlertCircle style={{ color: '#ef4444' }} />
                )}
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
                <div
                  style={{
                    height: '8px',
                    borderRadius: '9999px',
                    transition: 'width 0.3s',
                    backgroundColor: status === 'complete' ? '#10b981' : '#9b59b6',
                    width: `${progress}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
            Uploaded Files ({uploadedFiles.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', position: 'relative' }}>
            {uploadedFiles.map((file, idx) => {
              const videoUrl = file.s3_key ? `https://episode-metadata-raw-footage-dev.s3.amazonaws.com/${file.s3_key}` : null;
              const thumbnailId = `video-thumb-${file.id || idx}`;
              
              return (
                <div key={idx} style={{ 
                  backgroundColor: '#fff', 
                  border: '2px solid #9b59b6', 
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {/* Kebab menu */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 50
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === file.id ? null : file.id);
                      }}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <FiMoreVertical style={{ fontSize: '16px', color: '#374151' }} />
                    </button>
                    
                    {/* Dropdown menu */}
                    {openMenuId === file.id && (
                      <div style={{
                        position: 'absolute',
                        top: '40px',
                        right: '0',
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        minWidth: '150px',
                        zIndex: 100,
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUpload(file.id, file.filename);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.875rem',
                            color: '#dc2626',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <FiTrash2 style={{ fontSize: '14px' }} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ 
                    width: '100%', 
                    height: '150px', 
                    backgroundColor: '#1e1b4b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {file.localThumbnail ? (
                      <>
                        {/* Display local thumbnail */}
                        <img 
                          src={file.localThumbnail}
                          alt={file.filename}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }}
                        />
                        {/* Play icon overlay */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'rgba(155, 89, 182, 0.9)',
                          borderRadius: '50%',
                          width: '56px',
                          height: '56px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                          <FiVideo style={{ color: '#fff', fontSize: '28px' }} />
                        </div>
                      </>
                    ) : videoUrl ? (
                      <>
                        {/* Hidden video element for thumbnail generation */}
                        <video 
                          id={thumbnailId}
                          src={videoUrl}
                          style={{ display: 'none' }}
                          preload="metadata"
                          muted
                          playsInline
                          crossOrigin="anonymous"
                          onLoadedMetadata={(e) => {
                            // Seek to 1 second
                            e.target.currentTime = 1;
                          }}
                          onSeeked={(e) => {
                            // Capture frame to canvas
                            const canvas = document.getElementById(`canvas-${thumbnailId}`);
                            const video = e.target;
                            if (canvas && video) {
                              const ctx = canvas.getContext('2d');
                              canvas.width = video.videoWidth;
                              canvas.height = video.videoHeight;
                              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            }
                          }}
                          onError={() => {
                            // On error, canvas will remain empty and show play icon
                          }}
                        />
                        {/* Canvas to display the thumbnail */}
                        <canvas
                          id={`canvas-${thumbnailId}`}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }}
                        />
                        {/* Play icon overlay */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'rgba(155, 89, 182, 0.9)',
                          borderRadius: '50%',
                          width: '56px',
                          height: '56px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                          <FiVideo style={{ color: '#fff', fontSize: '28px' }} />
                        </div>
                      </>
                    ) : (
                      <FiVideo style={{ color: '#9b59b6', fontSize: '3rem' }} />
                    )}
                  </div>
                  
                  <div style={{ padding: '0.75rem' }}>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '600', 
                      color: '#111827',
                      marginBottom: '0.25rem',
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {file.filename}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                      {formatFileSize(file.size)} • {formatDuration(file.duration)}
                    </p>
                    <button
                      onClick={() => handleAnalyze(file.id)}
                      disabled={analyzing}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: analyzing ? '#d1d5db' : '#9b59b6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: analyzing ? 'not-allowed' : 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (!analyzing) e.currentTarget.style.backgroundColor = '#8b4ba8';
                      }}
                      onMouseLeave={(e) => {
                        if (!analyzing) e.currentTarget.style.backgroundColor = '#9b59b6';
                      }}
                    >
                      {analyzing ? (
                        <>
                          <FiLoader style={{ animation: 'spin 1s linear infinite' }} />
                          Analyzing...
                        </>
                      ) : (
                        <>🤖 Analyze</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Helper Text */}
      <div style={{ 
        backgroundColor: '#eff6ff', 
        border: '1px solid #bfdbfe', 
        borderRadius: '8px', 
        padding: '0.75rem' 
      }}>
        <p style={{ fontSize: '0.75rem', color: '#1e40af' }}>
          <strong>💡 Tip:</strong> Name files like EPISODE-SCENE-TAKE-1.mp4 for automatic scene linking (e.g., EP01-INTRO-TAKE-1.mp4)
        </p>
      </div>

      {/* Asset Library Modal */}
      <AssetLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onImport={handleImportAssets}
        episodeId={episodeId}
      />

      {/* Analysis Dashboard Modal */}
      {selectedFootage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}
        onClick={() => {
          setSelectedFootage(null);
          setEditMap(null);
        }}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px rgba(0, 0, 0, 0.3)',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: '#fff',
              borderBottom: '1px solid #e5e7eb',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10
            }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Analysis Results</h2>
              <button
                onClick={() => {
                  setSelectedFootage(null);
                  setEditMap(null);
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '1rem' }}>
              <AnalysisDashboard
                rawFootageId={selectedFootage.id}
                editMap={editMap}
                onRefresh={() => handleAnalyze(selectedFootage.id)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Imported Assets */}
      {importedAssets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
            Imported from Library ({importedAssets.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', position: 'relative' }}>
            {importedAssets.map((asset, idx) => {
              // Use full-size images, not thumbnails
              const thumbnailUrl = asset.s3_url_raw || 
                                   asset.s3_url_processed || 
                                   asset.metadata?.thumbnail_url || 
                                   asset.thumbnail_url;
              const isVideo = asset.asset_type?.includes('VIDEO') || asset.type?.includes('VIDEO');
              
              console.log('Asset:', asset.name, 'URL:', thumbnailUrl, 'Type:', asset.asset_type);
              
              return (
                <div key={asset.id || idx} style={{ 
                  backgroundColor: '#fff', 
                  border: '2px solid #93c5fd', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}>
                  {/* Thumbnail */}
                  <div style={{ 
                    width: '100%', 
                    height: '150px', 
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {thumbnailUrl ? (
                      isVideo ? (
                        // For videos, use video element with poster
                        <video 
                          src={thumbnailUrl}
                          poster={asset.metadata?.thumbnail_url || asset.thumbnail_url}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }}
                          preload="metadata"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div style="color: #9ca3af; font-size: 3rem;"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg></div>';
                          }}
                        />
                      ) : (
                        // For images, use img element
                        <img 
                          src={thumbnailUrl} 
                          alt={asset.name}
                          loading="lazy"
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            imageRendering: 'high-quality'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div style="color: #9ca3af; font-size: 3rem;"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>';
                          }}
                        />
                      )
                    ) : (
                      <FiFolder style={{ color: '#9ca3af', fontSize: '3rem' }} />
                    )}
                    {/* Play icon overlay for videos */}
                    {isVideo && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '50%',
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}>
                        <FiVideo style={{ color: '#fff', fontSize: '24px' }} />
                      </div>
                    )}
                  </div>
                  
                  {/* Asset Info */}
                  <div style={{ padding: '0.75rem' }}>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '600', 
                      color: '#111827', 
                      marginBottom: '0.25rem',
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {asset.name}
                    </p>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '500'
                    }}>
                      {(asset.asset_type || asset.type || '').replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
