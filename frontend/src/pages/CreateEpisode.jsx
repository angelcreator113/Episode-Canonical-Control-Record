/**
 * Create Episode Page - Enhanced
 * Form to create new episode with validation and error handling
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import TagInput from '../components/TagInput';
import AssetLibrary from '../components/AssetLibrary';
import EpisodeTemplateSelector from '../components/EpisodeTemplateSelector';
import { validators } from '../utils/validators';
import { STATUS_OPTIONS } from '../utils/constants';
import '../styles/EpisodeForm.css';

/**
 * ThumbnailSection Component
 * Display thumbnails for an episode within the create/edit page
 */
const ThumbnailSection = ({ episodeId }) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);

  useEffect(() => {
    if (!episodeId) {
      setThumbnailLoading(false);
      return;
    }

    let isMounted = true;

    const loadThumbnails = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `http://localhost:3002/api/v1/thumbnails/episode/${episodeId}/all`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (isMounted) {
          if (response.ok) {
            const data = await response.json();
            setThumbnails(data.data || []);
          } else {
            setThumbnails([]);
          }
          setThumbnailLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setThumbnails([]);
          setThumbnailLoading(false);
        }
      }
    };

    loadThumbnails();

    return () => {
      isMounted = false;
    };
  }, [episodeId]);

  if (!episodeId) {
    return (
      <div className="form-group">
        <label>Generated Thumbnails</label>
        <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Thumbnails will be available after creating the episode
        </p>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label>Generated Thumbnails</label>
      {thumbnailLoading ? (
        <p style={{ color: '#999', fontSize: '0.9rem' }}>Loading thumbnails...</p>
      ) : thumbnails.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          {thumbnails.map((thumb) => (
            <div 
              key={thumb.id} 
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                padding: '0.75rem',
                textAlign: 'center',
                backgroundColor: '#fafafa',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ marginBottom: '0.5rem', color: '#333', fontWeight: '500' }}>
                {thumb.thumbnailType || 'thumbnail'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                {thumb.publishStatus || 'DRAFT'}
              </div>
              {thumb.widthPixels && thumb.heightPixels && (
                <div style={{ fontSize: '0.75rem', color: '#999' }}>
                  {thumb.widthPixels}x{thumb.heightPixels}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          No thumbnails generated yet
        </p>
      )}
    </div>
  );
};

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
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [createdEpisodeId, setCreatedEpisodeId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const validateForm = () => {
    const newErrors = {};

    const titleError = validators.required(formData.title, 'Title');
    if (titleError) newErrors.title = titleError;

    const numberError = validators.episodeNumber(formData.episodeNumber);
    if (numberError) newErrors.episodeNumber = numberError;

    const airDateError = validators.airDate(formData.airDate);
    if (airDateError) newErrors.airDate = airDateError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateField = (name, value) => {
    let error = null;
    
    switch (name) {
      case 'title':
        error = validators.required(value, 'Title');
        break;
      case 'episodeNumber':
        error = validators.episodeNumber(value);
        break;
      case 'airDate':
        error = validators.airDate(value);
        break;
      default:
        break;
    }
    
    return error;
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      const fieldError = validateField(name, value);
      setErrors((prev) => ({
        ...prev,
        [name]: fieldError,
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    
    const fieldError = validateField(name, value);
    setErrors((prev) => ({
      ...prev,
      [name]: fieldError,
    }));
  };

  const handleCategoriesChange = (categories) => {
    setFormData((prev) => ({
      ...prev,
      categories: categories,
    }));
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    if (template) {
      // Apply template fields to form
      setFormData((prev) => ({
        ...prev,
        categories: template.defaultCategories || template.default_categories || [],
        status: template.defaultStatus || template.default_status || prev.status,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      toast.showError('Please fix the errors in the form');
      return;
    }

    try {
      setLoading(true);
      const submitData = {
        title: formData.title,
        episode_number: formData.episodeNumber,
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate,
        categories: formData.categories,
      };
      
      const response = await episodeService.createEpisode(submitData);
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
    <div className="episode-form-page">
      <div className="form-container">
        <h1>Create New Episode</h1>

        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        <EpisodeTemplateSelector
          selectedTemplate={selectedTemplate}
          onTemplateSelect={handleTemplateSelect}
        />

        <form onSubmit={handleSubmit} className="episode-form">
          <div className="form-group">
            <label htmlFor="title">
              Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter episode title"
              className={errors.title ? 'input-error' : ''}
              disabled={loading}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="episodeNumber">
                Episode Number <span className="required">*</span>
              </label>
              <input
                type="number"
                id="episodeNumber"
                name="episodeNumber"
                value={formData.episodeNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g., 1"
                className={errors.episodeNumber ? 'input-error' : ''}
                disabled={loading}
              />
              {errors.episodeNumber && (
                <span className="error-text">{errors.episodeNumber}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select 
                id="status"
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                disabled={loading}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="airDate">Air Date</label>
            <input
              type="date"
              id="airDate"
              name="airDate"
              value={formData.airDate}
              onChange={handleChange}
              onBlur={handleBlur}
              className={errors.airDate ? 'input-error' : ''}
              disabled={loading}
            />
            {errors.airDate && (
              <span className="error-text">{errors.airDate}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter episode description"
              rows="5"
              disabled={loading}
            ></textarea>
          </div>

          <div className="form-group">
            <label>Categories/Tags</label>
            <TagInput
              tags={formData.categories}
              onChange={handleCategoriesChange}
              placeholder="Add categories (e.g., fashion, tutorial, shopping)"
              disabled={loading}
              maxTags={10}
            />
          </div>

          {createdEpisodeId && (
            <>
              <div className="form-group">
                <label>Assets & Resources</label>
                <AssetLibrary
                  episodeId={createdEpisodeId}
                  onAssetSelect={(asset) => console.log('Asset selected:', asset)}
                  readOnly={false}
                />
              </div>

              <ThumbnailSection episodeId={createdEpisodeId} />
            </>
          )}

          <div className="form-actions">
            {createdEpisodeId ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/episodes/${createdEpisodeId}`)}
                  className="btn btn-primary"
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
                    setSelectedTemplate(null);
                  }}
                  className="btn btn-secondary"
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
                >
                  {loading ? 'Creating...' : 'Create Episode'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/episodes')}
                  className="btn btn-secondary"
                  disabled={loading}
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
