/**
 * Show Management Page
 * Create, edit, and manage shows
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/ShowManagement.css';

const ShowManagement = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
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
      const response = await fetch('http://localhost:3002/api/v1/shows', {
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
        ? `http://localhost:3002/api/v1/shows/${editingShow.id}`
        : 'http://localhost:3002/api/v1/shows';
      
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
      const response = await fetch(`http://localhost:3002/api/v1/shows/${showId}`, {
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
      <div className="show-management-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading shows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="show-management-page">
      <div className="show-container">
        <div className="show-header">
          <h1>🎬 Show Management</h1>
          <p className="show-subtitle">Manage your content shows</p>
          <button
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : '+ Create Show'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Show Form */}
        {showForm && (
          <div className="show-form-container">
            <h2>{editingShow ? 'Edit Show' : 'Create New Show'}</h2>
            <form onSubmit={handleSubmit} className="show-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Show Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Styling Adventures with Lala"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="icon">Icon (Emoji)</label>
                  <input
                    type="text"
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleInputChange}
                    placeholder="📺"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this show is about..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="color">Theme Color</label>
                  <input
                    type="color"
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="coming_soon">Coming Soon</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingShow ? 'Update Show' : 'Create Show'}
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Shows List */}
        <div className="shows-list">
          {!loading && shows.length === 0 && (
            <div className="empty-state">
              <p>📭 No shows yet</p>
              <p className="empty-text">Create your first show to get started</p>
            </div>
          )}

          {!loading && shows.length > 0 && (
            <>
              <h2>Your Shows ({shows.length})</h2>
              <div className="shows-grid">
                {shows.map((show) => (
                  <div 
                    key={show.id} 
                    className="show-card"
                    style={{ borderLeftColor: show.color }}
                  >
                    <div className="show-card-header">
                      <div className="show-title-row">
                        <span className="show-icon">{show.icon}</span>
                        <h3>{show.name}</h3>
                      </div>
                      <div className="show-actions">
                        <button
                          onClick={() => handleEdit(show)}
                          className="btn-edit"
                          title="Edit show"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(show.id)}
                          className="btn-delete"
                          title="Delete show"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <p className="show-desc">{show.description}</p>

                    <div className="show-meta">
                      <span className={`status-badge status-${show.status}`}>
                        {show.status}
                      </span>
                      <span className="show-slug">{show.slug}</span>
                    </div>

                    <div className="show-footer">
                      <small>Created: {new Date(show.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowManagement;