/**
 * Create Episode Page - Simplified
 * Minimal form to create new episode quickly
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
import thumbnailService from '../services/thumbnailService';
import AssetPicker from '../components/Scenes/AssetPicker';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import TagInput from '../components/TagInput';
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
  
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailId, setThumbnailId] = useState(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, thumbnail: 'Please select an image file' }));
        toast.showError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, thumbnail: 'Image must be less than 5MB' }));
        toast.showError('Image must be less than 5MB');
        return;
      }
      
      setThumbnailFile(file);
      setErrors((prev) => ({ ...prev, thumbnail: null }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailSelect = async (selectedThumbnailId) => {
    try {
      setThumbnailId(selectedThumbnailId);
      const thumbnail = await thumbnailService.getThumbnail(selectedThumbnailId);
      setThumbnailPreview(thumbnail.url || thumbnail.s3Url);
      setErrors((prev) => ({ ...prev, thumbnail: null }));
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
      toast.showError('Failed to load thumbnail');
    }
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailId(null);
    const fileInput = document.getElementById('thumbnailFile');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    const newErrors = {};
    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!thumbnailFile && !thumbnailId) {
      newErrors.thumbnail = 'Thumbnail is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.showError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      // Create episode first
      const response = await episodeService.createEpisode({
        title: formData.title,
        episode_number: formData.episodeNumber || null,
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate || null,
        categories: formData.categories,
        thumbnail_id: thumbnailId || null,
      });
      
      const newEpisode = response.data || response;
      
      // Upload thumbnail if file selected
      if (thumbnailFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('file', thumbnailFile);
        formDataToSend.append('episodeId', newEpisode.id);
        formDataToSend.append('type', 'thumbnail');
        
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          await fetch('http://localhost:3002/api/v1/files/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formDataToSend,
          });
        } catch (uploadErr) {
          console.warn('Thumbnail upload failed:', uploadErr);
          // Don't fail the whole operation if thumbnail upload fails
        }
      }
      
      toast.showSuccess('Episode created successfully!');
      setLoading(false);
      
      // Redirect to episode detail page
      navigate(`/episodes/${newEpisode.id}`);
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

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="thumbnailFile" style={{ fontWeight: '500', fontSize: '0.95rem' }}>
              Thumbnail Image <span className="required" style={{ color: '#dc2626' }}>*</span>
            </label>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAssetPicker(true)}
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flex: '1',
                }}
              >
                📁 Choose from Gallery
              </button>
              
              <label
                htmlFor="thumbnailFile"
                style={{
                  padding: '10px 16px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                  flex: '1',
                }}
              >
                ⬆️ Upload New
              </label>
            </div>
            
            {thumbnailPreview ? (
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '300px' }}>
                <img 
                  src={thumbnailPreview} 
                  alt="Thumbnail preview" 
                  style={{ width: '100%', height: 'auto', borderRadius: '6px', border: '2px solid #e5e7eb' }}
                />
                <button
                  type="button"
                  onClick={handleRemoveThumbnail}
                  disabled={loading}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    lineHeight: '1',
                    padding: '0',
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="file"
                  id="thumbnailFile"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  disabled={loading}
                  style={{ 
                    padding: '0.75rem', 
                    border: errors.thumbnail ? '1px solid #dc2626' : '1px solid #e5e7eb', 
                    borderRadius: '6px', 
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>or</span>
                  <button
                    type="button"
                    onClick={() => window.open('/composer/default', '_blank')}
                    disabled={loading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Use Thumbnail Composer
                  </button>
                </div>
              </div>
            )}
            {errors.thumbnail && <span className="error-text" style={{ color: '#dc2626', fontSize: '0.875rem' }}>{errors.thumbnail}</span>}
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              Upload an image file (JPG, PNG, etc.) - Max 5MB
            </p>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
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
          </div>
        </form>
      </div>

      {/* Asset Picker Modal */}
      <AssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleThumbnailSelect}
        multiSelect={false}
        selectedIds={[]}
        allowUpload={true}
      />
    </div>
  );
};

export default CreateEpisode;
