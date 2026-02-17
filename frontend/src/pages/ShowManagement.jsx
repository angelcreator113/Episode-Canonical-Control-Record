/**
 * Show Management Page
 * Create, edit, and manage shows
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import './Shows.css';

const ShowManagement = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const formRef = useRef(null);
  
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📺',
    color: '#667eea',
    status: 'active',
  });

  const [coverImage, setCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load shows
  useEffect(() => {
    fetchShows();
  }, []);

  const fetchShows = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/shows`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load shows');
      
      const data = await response.json();
      setShows(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching shows:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '📺',
      color: '#667eea',
      status: 'active',
    });
    setEditingShow(null);
    setShowForm(false);
    setCoverImage(null);
    setCoverImagePreview(null);
  };

  const handleCoverImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadCoverImage = async (showId) => {
    if (!coverImage) return null;

    const coverFormData = new FormData();
    coverFormData.append('image', coverImage);

    setUploadingCover(true);
    try {
      const response = await fetch(`${API_URL}/shows/${showId}/cover-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: coverFormData,
      });

      if (!response.ok) throw new Error('Failed to upload cover image');

      const data = await response.json();
      return data.data.coverImageUrl;
    } catch (err) {
      console.error('Error uploading cover:', err);
      throw err;
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Show name is required');
      return;
    }

    try {
      setError(null);
      
      const url = editingShow
        ? `${API_URL}/shows/${editingShow.id}`
        : `${API_URL}/shows`;
      
      const method = editingShow ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save show');

      const result = await response.json();
      const savedShow = result.data;

      // Upload cover image if provided
      if (coverImage) {
        try {
          await uploadCoverImage(savedShow.id);
        } catch (coverError) {
          console.error('Cover upload failed:', coverError);
          // Continue anyway - show was created
        }
      }

      alert(`Show ${editingShow ? 'updated' : 'created'} successfully!`);
      await fetchShows();
      resetForm();
    } catch (err) {
      console.error('Error saving show:', err);
      setError(err.message || `Failed to ${editingShow ? 'update' : 'create'} show`);
    }
  };

  const handleEdit = (show) => {
    setEditingShow(show);
    setFormData({
      name: show.name,
      description: show.description || '',
      icon: show.icon || '📺',
      color: show.color || '#667eea',
      status: show.status || 'active',
    });
    setShowForm(true);
  };

  const handleDelete = async (showId) => {
    if (!window.confirm('Are you sure you want to delete this show?')) return;

    try {
      setError(null);
      const response = await fetch(`${API_URL}/shows/${showId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete show');

      await fetchShows();
      alert('Show deleted successfully!');
    } catch (err) {
      console.error('Error deleting show:', err);
      setError(err.message || 'Failed to delete show');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="shows-page">
        <div className="shows-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading shows...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shows-page">
      <div className="shows-container">
        {/* Header */}
        <div className="shows-header">
          <h1 className="shows-title">All Shows</h1>
          <button
            onClick={() => navigate('/shows/create')}
            className="btn-create-show"
          >
            + Create Show
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="error-close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Summary Stats */}
        {shows.length > 0 && (
          <div className="shows-stats">
            <div className="stat-card">
              <div className="stat-label">Total Shows</div>
              <div className="stat-value">{shows.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active</div>
              <div className="stat-value">
                {shows.filter(s => s.status === 'active').length}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Coming Soon</div>
              <div className="stat-value">
                {shows.filter(s => s.status === 'coming_soon').length}
              </div>
            </div>
          </div>
        )}

        {/* Shows Grid */}
        {!loading && shows.length === 0 && (
          <div className="empty-shows">
            <div className="empty-icon">📺</div>
            <h3 className="empty-title">No shows yet</h3>
            <p className="empty-message">
              Create your first show to get started
            </p>
            <button
              onClick={() => navigate('/shows/create')}
              className="btn-create-show"
            >
              + Create First Show
            </button>
          </div>
        )}

        {!loading && shows.length > 0 && (
          <div className="shows-grid">
            {shows.map((show) => (
              <div key={show.id} className="show-card">
                {/* Poster (3:4 ratio) */}
                <div className="show-poster">
                  {show.coverImageUrl ? (
                    <img
                      src={show.coverImageUrl}
                      alt={show.name}
                      className="poster-image"
                    />
                  ) : (
                    <div 
                      className="poster-placeholder"
                      style={{ background: show.color || '#6366f1' }}
                    >
                      <span className="poster-icon">
                        {show.icon || '📺'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="show-content">
                  {/* Top Section */}
                  <div className="show-header-section">
                    <h3 className="show-name">{show.name}</h3>

                    <div className="show-meta">
                      <span className={`status-badge status-${show.status || 'active'}`}>
                        {show.status === 'coming_soon' ? 'Coming Soon' : 
                         show.status === 'active' ? 'Active' : 
                         show.status || 'Active'}
                      </span>
                      <span className="meta-separator" style={{ color: '#64748b' }}>·</span>
                      <span className="meta-item" style={{ color: '#1e293b' }}>
                        {show.episodeCount || show.episode_count || 0} Episodes
                      </span>
                      <span className="meta-separator" style={{ color: '#64748b' }}>·</span>
                      <span className="meta-item" style={{ color: '#1e293b' }}>
                        {show.updatedAt ? `Updated ${new Date(show.updatedAt).toLocaleDateString()}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="show-actions">
                    <button
                      onClick={() => {
                        console.log('[Shows] Opening show:', show.name, 'ID:', show.id);
                        navigate(`/shows/${show.id}`);
                      }}
                      className="action-btn action-primary"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => navigate(`/shows/${show.id}/edit`)}
                      className="action-btn action-secondary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${show.name}"? This cannot be undone.`)) {
                          handleDelete(show.id);
                        }
                      }}
                      className="action-btn action-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show Form */}
        {showForm && (
          <div ref={formRef} className="show-form-container">
            <h2 className="form-title">
              {editingShow ? '✏️ Edit Show' : '🆕 Create New Show'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label htmlFor="name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Show Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Styling Adventures with Lala"
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.875rem',
                      fontSize: '0.95rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="icon" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Icon (Emoji)
                  </label>
                  <input
                    type="text"
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleInputChange}
                    placeholder="📺"
                    maxLength={2}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.875rem',
                      fontSize: '0.95rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white'
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this show is about..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.875rem',
                    fontSize: '0.875rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: 'white',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Cover Image Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Cover Image (Portrait 2:3 ratio - like Netflix)
                </label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {coverImagePreview && (
                    <div style={{ width: '150px', height: '225px', border: '2px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={coverImagePreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverImageSelect}
                      id="coverImage"
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="coverImage"
                      style={{
                        display: 'inline-block',
                        padding: '0.65rem 1.25rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 6px rgba(102, 126, 234, 0.3)'
                      }}
                    >
                      📸 Choose Cover Image
                    </label>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      Recommended: 800x1200px (2:3 ratio). Max 10MB. JPG, PNG, or WebP.
                    </p>
                    {coverImage && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
                        ✓ {coverImage.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label htmlFor="color" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Theme Color
                  </label>
                  <input
                    type="color"
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0.25rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="status" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.875rem',
                      fontSize: '0.95rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="coming_soon">Coming Soon</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="submit"
                  disabled={uploadingCover}
                  style={{
                    flex: '1',
                    padding: '0.75rem 1.5rem',
                    background: uploadingCover ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: uploadingCover ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  {uploadingCover ? '⏳ Uploading...' : (editingShow ? '💾 Update Show' : '✨ Create Show')}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{
                    flex: '1',
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#374151',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowManagement;
