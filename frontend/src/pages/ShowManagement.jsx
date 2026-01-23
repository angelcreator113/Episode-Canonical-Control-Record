/**
 * Show Management Page
 * Create, edit, and manage shows
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import '../styles/ShowManagement.css';

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
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p style={{ fontSize: '1.1rem', color: '#6b7280' }}>Loading shows...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎬 Show Management
              </h1>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#6b7280' }}>
                Create and manage your content shows
              </p>
            </div>
            <button
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setShowForm(true);
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: showForm ? '#6b7280' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s'
              }}
            >
              {showForm ? '✕ Cancel' : '+ Create Show'}
            </button>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: '0.375rem' }}>TOTAL SHOWS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{shows.length}</div>
            </div>
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: '0.375rem' }}>ACTIVE SHOWS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{shows.filter(s => s.status === 'active').length}</div>
            </div>
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: '0.375rem' }}>COMING SOON</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{shows.filter(s => s.status === 'coming_soon').length}</div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.875rem 1rem',
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#991b1b',
            fontSize: '0.95rem',
            fontWeight: '600'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#991b1b',
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '0.25rem',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Show Form */}
        {showForm && (
          <div ref={formRef} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
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

        {/* Shows List */}
        <div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📚 All Shows
            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({shows.length})
            </span>
          </h2>
          
          {!loading && shows.length === 0 && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>📺</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                No shows yet
              </h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', color: '#6b7280' }}>
                Create your first show to get started
              </p>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
              >
                + Create First Show
              </button>
            </div>
          )}

          {!loading && shows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {shows.map((show) => (
                <div
                  key={show.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }}
                >
                  {/* Cover Image (Portrait 2:3) */}
                  <div style={{ 
                    width: '100%', 
                    paddingTop: '150%', /* 2:3 aspect ratio */
                    position: 'relative',
                    background: show.coverImageUrl 
                      ? `url(${show.coverImageUrl}) center/cover` 
                      : `linear-gradient(135deg, ${show.color || '#667eea'} 0%, ${show.color || '#764ba2'} 100%)`,
                    overflow: 'hidden'
                  }}>
                    {!show.coverImageUrl && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)',
                        fontSize: '5rem',
                        opacity: 0.3
                      }}>
                        {show.icon || '📺'}
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      background: show.status === 'active' ? 'rgba(16, 185, 129, 0.95)' :
                                 show.status === 'coming_soon' ? 'rgba(245, 158, 11, 0.95)' :
                                 'rgba(107, 114, 128, 0.95)',
                      color: 'white',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {show.status === 'coming_soon' ? 'Coming Soon' : show.status}
                    </div>
                  </div>

                  {/* Show Info */}
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{show.icon || '📺'}</span>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '1rem', 
                        fontWeight: '700', 
                        color: '#1f2937',
                        lineHeight: '1.3',
                        flex: 1
                      }}>
                        {show.name}
                      </h3>
                    </div>
                    
                    {show.description && (
                      <p style={{
                        margin: '0 0 0.75rem 0',
                        fontSize: '0.8rem',
                        color: '#6b7280',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {show.description}
                      </p>
                    )}
                    
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/episodes?show=${show.id}`);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        📺 Episodes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingShow(show);
                          setFormData(show);
                          setCoverImage(null);
                          setShowForm(true);
                          setTimeout(() => {
                            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${show.name}"? This cannot be undone.`)) {
                            handleDelete(show.id);
                          }
                        }}
                        style={{
                          padding: '0.5rem',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowManagement;
