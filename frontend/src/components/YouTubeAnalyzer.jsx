import React, { useState, useEffect } from 'react';
import { FaYoutube, FaPlay, FaSpinner, FaCheck, FaTrash, FaEye, FaDownload } from 'react-icons/fa';
import axios from 'axios';

const YouTubeAnalyzer = ({ episodeId }) => {
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [library, setLibrary] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [viewingVideo, setViewingVideo] = useState(null);

  // Load existing training videos
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      setLoadingLibrary(true);
      const response = await axios.get('/api/youtube/library');
      setLibrary(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load training library:', err);
      setLibrary([]); // Set empty array on error
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handlePreview = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      setError(null);
      setMetadata(null);
      setProgress('Fetching video metadata...');

      const response = await axios.get('/api/youtube/metadata', {
        params: { url: url.trim() }
      });

      setMetadata(response.data);
      setProgress('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch video metadata');
      setProgress('');
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      setError(null);
      setResult(null);
      setAnalyzing(true);
      setProgress('Starting analysis...');

      const response = await axios.post('/api/youtube/analyze', {
        url: url.trim()
      });

      setResult(response.data);
      setProgress('');
      setUrl('');
      setMetadata(null);
      
      // Reload library to show new video
      await loadLibrary();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to analyze video');
      setProgress('');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (videoId) => {
    if (!confirm('Are you sure you want to delete this training video?')) {
      return;
    }

    try {
      await axios.delete(`/api/youtube/${videoId}`);
      await loadLibrary();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete video');
    }
  };

  const handleView = async (videoId) => {
    try {
      const response = await axios.get(`/api/youtube/${videoId}`);
      setViewingVideo(response.data.data || response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load video details');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatJsonField = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      // Try to create a readable string from object
      return JSON.stringify(field).substring(0, 50);
    }
    return String(field);
  };

  const displayJsonField = (field) => {
    if (!field) return 'N/A';
    if (typeof field === 'string') return field;
    if (typeof field === 'boolean') return field ? 'Yes' : 'No';
    if (typeof field === 'object') {
      return JSON.stringify(field, null, 2);
    }
    return String(field);
  };

  return (
    <div className="ed-stack">
      {/* Analyze New Video */}
      <div className="ed-card">
        <div className="ed-cardhead">
          <h2 className="ed-cardtitle">
            <FaYoutube style={{ marginRight: '8px', color: '#FF0000' }} />
            Analyze YouTube Video
          </h2>
        </div>
        <div className="ed-cardbody">
          <div style={{ marginBottom: '16px' }}>
            <p style={{ marginBottom: '12px', color: '#6b7280' }}>
              Paste a YouTube URL to analyze the video's content style, pacing, and tone.
              This will help train the AI to match your preferred editing style.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                disabled={analyzing}
              />
              <button
                onClick={handlePreview}
                disabled={analyzing || !url.trim()}
                style={{
                  padding: '10px 20px',
                  background: analyzing ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FaEye /> Preview
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !url.trim()}
                style={{
                  padding: '10px 20px',
                  background: analyzing ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {analyzing ? <FaSpinner className="fa-spin" /> : <FaPlay />}
                Analyze
              </button>
            </div>
          </div>

          {/* Metadata Preview */}
          {metadata && (
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              borderRadius: '12px',
              marginTop: '16px'
            }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                {metadata.thumbnail && (
                  <img
                    src={metadata.thumbnail}
                    alt="Video thumbnail"
                    style={{
                      width: '160px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid rgba(255,255,255,0.3)'
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>
                    {metadata.title}
                  </h3>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
                    {metadata.author} • {formatDuration(metadata.length)} • {metadata.views?.toLocaleString()} views
                  </p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#9ca3af' }}>
                    <span>📊 Quality: {metadata.quality}</span>
                    <span>🎬 Format: {metadata.container}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div style={{
              padding: '12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <FaSpinner className="fa-spin" style={{ color: '#3b82f6' }} />
              <span style={{ color: '#1e40af' }}>{progress}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginTop: '16px'
            }}>
              {error}
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #10b98115 0%, #059669 15 100%)',
              border: '2px solid #10b981',
              borderRadius: '12px',
              marginTop: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FaCheck style={{ color: '#10b981', fontSize: '24px' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#065f46' }}>
                    Analysis Complete!
                  </h3>
                  <p style={{ fontSize: '14px', color: '#047857', marginTop: '4px' }}>
                    Video analyzed and saved to training library
                  </p>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#065f46', marginTop: '12px' }}>
                <div><strong>Video ID:</strong> {result?.video_id || result?.video?.video_id || 'N/A'}</div>
                <div><strong>Duration:</strong> {formatDuration(result?.duration_seconds || result?.video?.duration_seconds || 0)}</div>
                <div><strong>Analyzed:</strong> {formatDate(result?.analyzed_at || result?.video?.analyzed_at || new Date())}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Training Library */}
      <div className="ed-card">
        <div className="ed-cardhead">
          <h2 className="ed-cardtitle">
            📚 Training Library ({library.length})
          </h2>
        </div>
        <div className="ed-cardbody">
          {loadingLibrary ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <FaSpinner className="fa-spin" style={{ fontSize: '24px', marginBottom: '12px' }} />
              <p>Loading training videos...</p>
            </div>
          ) : library.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <FaYoutube style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }} />
              <p>No training videos yet. Analyze your first video above!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {library.map(video => {
                const thumbnailUrl = `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`;
                
                return (
                <div
                  key={video.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    background: 'white',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = '#667eea';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                  onClick={() => handleView(video.id)}
                >
                  {/* Thumbnail */}
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000' }}>
                    <img
                      src={thumbnailUrl}
                      alt={video.video_title || 'Video thumbnail'}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <FaYoutube style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'white',
                      fontSize: '48px',
                      opacity: 0.8,
                      pointerEvents: 'none'
                    }} />
                  </div>
                  
                  <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {video.video_title || 'Untitled Video'}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {formatDuration(video.duration_seconds || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Analysis Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {video.pacing_rhythm && (
                      <span style={{
                        padding: '4px 8px',
                        background: '#ede9fe',
                        color: '#7c3aed',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        ⚡ {video.pacing_rhythm}
                      </span>
                    )}
                    {video.text_style && (
                      <span style={{
                        padding: '4px 8px',
                        background: '#dbeafe',
                        color: '#2563eb',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        📝 {typeof video.text_style === 'object' ? `${video.text_style.font || 'text'}` : video.text_style}
                      </span>
                    )}
                    {video.music_presence && (
                      <span style={{
                        padding: '4px 8px',
                        background: '#fef3c7',
                        color: '#d97706',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        🎵 Music
                      </span>
                    )}
                  </div>

                  <div style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    Added {formatDate(video.created_at)}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(video.id);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#f3f4f6',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <FaEye /> View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(video.id);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#fee2e2',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FaTrash />
                    </button>
                  </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Video Details Modal */}
      {viewingVideo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setViewingVideo(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '24px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
                  {viewingVideo.video_title}
                </h2>
                <div style={{ display: 'flex', gap: '12px', fontSize: '14px', color: '#6b7280' }}>
                  <span>📊 {formatDuration(viewingVideo.duration_seconds)}</span>
                  <span>🔗 Video ID: {viewingVideo.video_id}</span>
                </div>
              </div>
              <button
                onClick={() => setViewingVideo(null)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Analysis Results */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                  📊 Analysis Results
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Pacing Rhythm</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{viewingVideo.pacing_rhythm || 'N/A'}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Transition Patterns</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{displayJsonField(viewingVideo.transition_patterns)}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Overlay Usage</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{displayJsonField(viewingVideo.overlay_usage)}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Text Style</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{displayJsonField(viewingVideo.text_style)}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Music Presence</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{displayJsonField(viewingVideo.music_presence)}</div>
                  </div>
                </div>
              </div>

              {/* Storage Info */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                  💾 Storage Info
                </h3>
                <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
                  <div><strong>S3 Key:</strong> {viewingVideo.s3_key}</div>
                  <div><strong>Analyzed:</strong> {formatDate(viewingVideo.analyzed_at)}</div>
                  <div><strong>Created:</strong> {formatDate(viewingVideo.created_at)}</div>
                  {viewingVideo.video_url && (
                    <div>
                      <strong>Original URL:</strong>{' '}
                      <a href={viewingVideo.video_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                        Open in YouTube
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeAnalyzer;
