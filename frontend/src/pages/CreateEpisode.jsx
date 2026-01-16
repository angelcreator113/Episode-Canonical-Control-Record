/**
 * Create Episode Page - Simplified
 * Minimal form to create new episode quickly
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import TagInput from '../components/TagInput';
import ThumbnailSection from '../components/ThumbnailSection';
import { validators } from '../utils/validators';
import { STATUS_OPTIONS } from '../utils/constants';
import '../styles/EpisodeForm.css';

const CreateEpisode = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();
  
  const [formData, setFormData] = useState({
    title: '',
    episodeNumber: '',
    status: 'draft',
    description: '',
    airDate: '',
    categories: [],
  });
  
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createdEpisodeId, setCreatedEpisodeId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCategoriesChange = (categories) => {
    setFormData((prev) => ({ ...prev, categories }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Simple validation
    if (!formData.title?.trim()) {
      setErrors({ title: 'Title is required' });
      toast.showError('Title is required');
      return;
    }

    try {
      setLoading(true);
      const response = await episodeService.createEpisode({
        title: formData.title,
        episode_number: formData.episodeNumber || null,
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate || null,
        categories: formData.categories,
      });
      // Backend returns { data: {...episode...}, message: "..." }
      const newEpisode = response.data || response;
      toast.showSuccess('Episode created successfully!');
      
      // Set the episode ID to show assets and thumbnails
      setCreatedEpisodeId(newEpisode.id);
      setLoading(false);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create episode';
      setError(errorMessage);
      toast.showError(errorMessage);
      setLoading(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="episode-form-page ce-page">
      <div className="form-container" style={{ maxWidth: '800px', margin: '2rem auto', padding: '2rem', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.75rem', fontWeight: '600' }}>Create New Episode</h1>
        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="episode-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="title" style={{ fontWeight: '500', fontSize: '0.95rem' }}>
              Title <span className="required" style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter episode title"
              className={errors.title ? 'input-error' : ''}
              disabled={loading}
              required
              style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '1rem' }}
            />
            {errors.title && <span className="error-text" style={{ color: '#dc2626', fontSize: '0.875rem' }}>{errors.title}</span>}
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="episodeNumber" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Episode Number (Optional)</label>
              <input
                type="number"
                id="episodeNumber"
                name="episodeNumber"
                value={formData.episodeNumber}
                onChange={handleChange}
                placeholder="e.g., 1"
                disabled={loading}
                style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="status" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Status</label>
              <select 
                id="status"
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                disabled={loading}
                style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '1rem', background: 'white' }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="airDate" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Air Date (Optional)</label>
            <input
              type="date"
              id="airDate"
              name="airDate"
              value={formData.airDate}
              onChange={handleChange}
              disabled={loading}
              style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '1rem' }}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="description" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter episode description"
              rows="4"
              disabled={loading}
              style={{ padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '1rem', resize: 'vertical' }}
            ></textarea>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '500', fontSize: '0.95rem' }}>Categories/Tags</label>
            <TagInput
              tags={formData.categories}
              onChange={handleCategoriesChange}
              placeholder="Add categories (e.g., fashion, tutorial)"
              disabled={loading}
              maxTags={10}
            />
          </div>

          {createdEpisodeId && <ThumbnailSection episodeId={createdEpisodeId} />}

          <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            {createdEpisodeId ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/episodes/${createdEpisodeId}`)}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}
                >
                  View Episode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedEpisodeId(null);
                    setFormData({
                      title: '',
                      episodeNumber: '',
                      status: 'draft',
                      description: '',
                      airDate: '',
                      categories: [],
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Create Another
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ padding: '0.75rem 1.5rem', background: loading ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Creating...' : 'Create Episode'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/episodes')}
                  className="btn btn-secondary"
                  disabled={loading}
                  style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEpisode;
