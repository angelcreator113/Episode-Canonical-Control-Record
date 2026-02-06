import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sceneLibraryService from '../services/sceneLibraryService';
import './SceneDetail.css';

const SceneDetail = () => {
  const { sceneId } = useParams();
  const navigate = useNavigate();

  const [scene, setScene] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    characters: [],
    tags: [],
  });

  const [newCharacter, setNewCharacter] = useState('');
  const [newTag, setNewTag] = useState('');

  // Load scene details
  useEffect(() => {
    loadScene();
  }, [sceneId]);

  const loadScene = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sceneLibraryService.getScene(sceneId);
      setScene(data);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        characters: data.characters || [],
        tags: data.tags || [],
      });
    } catch (err) {
      console.error('Error loading scene:', err);
      setError(err.message || 'Failed to load scene');
    } finally {
      setLoading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);
      await sceneLibraryService.updateScene(sceneId, formData);
      await loadScene();
      setEditing(false);
    } catch (err) {
      console.error('Error saving scene:', err);
      alert('Failed to save changes: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scene from the library?')) {
      return;
    }

    try {
      await sceneLibraryService.deleteScene(sceneId);
      navigate('/scene-library');
    } catch (err) {
      console.error('Error deleting scene:', err);
      if (err.message.includes('used in episodes')) {
        alert('Cannot delete: This scene is currently used in one or more episodes. Remove it from all episodes first.');
      } else {
        alert('Failed to delete scene: ' + err.message);
      }
    }
  };

  // Add character
  const handleAddCharacter = () => {
    if (newCharacter.trim() && !formData.characters.includes(newCharacter.trim())) {
      setFormData({
        ...formData,
        characters: [...formData.characters, newCharacter.trim()],
      });
      setNewCharacter('');
    }
  };

  // Remove character
  const handleRemoveCharacter = (character) => {
    setFormData({
      ...formData,
      characters: formData.characters.filter((c) => c !== character),
    });
  };

  // Add tag
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      });
      setNewTag('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
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

  if (loading) {
    return (
      <div className="scene-detail-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading scene...</p>
        </div>
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="scene-detail-page">
        <div className="error-state">
          <div className="error-icon">❌</div>
          <h3>Error Loading Scene</h3>
          <p>{error || 'Scene not found'}</p>
          <button className="btn-primary" onClick={() => navigate('/scene-library')}>
            ← Back to Library
          </button>
        </div>
      </div>
    );
  }

  const status = getStatusBadge(scene.processingStatus || scene.processing_status);

  return (
    <div className="scene-detail-page">
      {/* Header */}
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/scene-library')}>
          ← Back to Library
        </button>
        <div className="header-actions">
          {!editing ? (
            <>
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                ✏️ Edit
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                🗑️ Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="detail-content">
        {/* Left Column - Video Player */}
        <div className="detail-left">
          <div className="video-section">
            <video
              controls
              poster={scene.thumbnailUrl || scene.thumbnail_url}
              style={{ width: '100%', borderRadius: '8px' }}
            >
              <source src={scene.videoAssetUrl || scene.video_asset_url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Technical Details */}
          <div className="detail-card">
            <h3>📊 Technical Details</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">Duration</span>
                <span className="value">
                  {formatDuration(scene.durationSeconds || scene.duration_seconds)}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Resolution</span>
                <span className="value">{scene.resolution || 'Unknown'}</span>
              </div>
              <div className="detail-item">
                <span className="label">File Size</span>
                <span className="value">
                  {formatFileSize(scene.fileSizeBytes || scene.file_size_bytes)}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Status</span>
                <span className={`badge ${status.class}`}>
                  {status.icon} {status.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Metadata */}
        <div className="detail-right">
          {/* Title & Description */}
          <div className="detail-card">
            <h3>📝 Scene Information</h3>
            
            {editing ? (
              <>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Scene title..."
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this scene..."
                    rows={4}
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="scene-title">{scene.title || 'Untitled Scene'}</h2>
                {scene.description && <p className="scene-description">{scene.description}</p>}
              </>
            )}
          </div>

          {/* Characters */}
          <div className="detail-card">
            <h3>👥 Characters</h3>
            {editing ? (
              <>
                <div className="tags-input">
                  <input
                    type="text"
                    value={newCharacter}
                    onChange={(e) => setNewCharacter(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCharacter())}
                    placeholder="Add character..."
                  />
                  <button onClick={handleAddCharacter} className="btn-add">
                    Add
                  </button>
                </div>
                <div className="tags-list">
                  {formData.characters.map((character) => (
                    <span key={character} className="tag tag-character">
                      {character}
                      <button onClick={() => handleRemoveCharacter(character)}>✕</button>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="tags-list">
                {scene.characters && scene.characters.length > 0 ? (
                  scene.characters.map((character) => (
                    <span key={character} className="tag tag-character">
                      {character}
                    </span>
                  ))
                ) : (
                  <p className="empty-text">No characters tagged</p>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="detail-card">
            <h3>🏷️ Tags</h3>
            {editing ? (
              <>
                <div className="tags-input">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tag..."
                  />
                  <button onClick={handleAddTag} className="btn-add">
                    Add
                  </button>
                </div>
                <div className="tags-list">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="tag tag-normal">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)}>✕</button>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="tags-list">
                {scene.tags && scene.tags.length > 0 ? (
                  scene.tags.map((tag) => (
                    <span key={tag} className="tag tag-normal">
                      {tag}
                    </span>
                  ))
                ) : (
                  <p className="empty-text">No tags</p>
                )}
              </div>
            )}
          </div>

          {/* Episode Usage */}
          <div className="detail-card">
            <h3>📺 Used in Episodes</h3>
            {scene.episodeUsage && scene.episodeUsage.length > 0 ? (
              <div className="episode-usage-list">
                {scene.episodeUsage.map((usage) => (
                  <div key={usage.episodeId} className="episode-usage-item">
                    <div className="episode-info">
                      <h4>Episode {usage.episodeNumber || usage.episode_number}</h4>
                      <p className="usage-details">
                        Scene #{usage.sceneOrder || usage.scene_order} • 
                        {formatDuration(usage.trimStart || usage.trim_start)} - 
                        {formatDuration(usage.trimEnd || usage.trim_end)}
                      </p>
                    </div>
                    <button
                      className="btn-view"
                      onClick={() => navigate(`/episodes/${usage.episodeId}`)}
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-text">Not used in any episodes yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneDetail;
