// frontend/src/pages/EditShow.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './CreateShow.css'; // Reuse same CSS

function EditShow() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    category: '',
    coverImage: null,
    logo: null,
    primaryColor: '#667eea',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [coverPreview, setCoverPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  // Redirect if no showId
  useEffect(() => {
    if (!showId) {
      console.error('[EditShow] No show ID in URL, redirecting to /shows');
      navigate('/shows', { replace: true });
      return;
    }
    loadShow();
  }, [showId, navigate]);
  
  const loadShow = async () => {
    if (!showId) {
      console.error('[EditShow] Cannot load show without ID');
      return;
    }
    
    try {
      // TODO: Replace with actual API call
      // const response = await showService.getShow(showId);
      
      // Mock data
      const mockShow = {
        id: showId,
        name: 'Just a Woman in Her Prime',
        tagline: 'Fashion, life, and everything in between',
        description: 'Join me as I navigate life, style, and entrepreneurship.',
        category: 'Lifestyle',
        coverImageUrl: null,
        logoUrl: null,
        primaryColor: '#667eea',
        status: 'active',
        updatedAt: '2026-02-10T15:30:00Z'
      };
      
      setShow(mockShow);
      setFormData({
        name: mockShow.name,
        tagline: mockShow.tagline || '',
        description: mockShow.description || '',
        category: mockShow.category,
        coverImage: null,
        logo: null,
        primaryColor: mockShow.primaryColor,
        status: mockShow.status
      });
      setCoverPreview(mockShow.coverImageUrl);
      setLogoPreview(mockShow.logoUrl);
    } catch (error) {
      console.error('Error loading show:', error);
      alert('Failed to load show');
      navigate('/shows');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'cover') {
        setCoverPreview(reader.result);
        setFormData(prev => ({ ...prev, coverImage: file }));
      } else {
        setLogoPreview(reader.result);
        setFormData(prev => ({ ...prev, logo: file }));
      }
    };
    reader.readAsDataURL(file);
  };
  
  const removeImage = (type) => {
    if (type === 'cover') {
      setCoverPreview(null);
      setFormData(prev => ({ ...prev, coverImage: null }));
    } else {
      setLogoPreview(null);
      setFormData(prev => ({ ...prev, logo: null }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Show name is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    try {
      // TODO: Replace with actual API call
      // const formDataToSend = new FormData();
      // Object.keys(formData).forEach(key => {
      //   if (formData[key]) formDataToSend.append(key, formData[key]);
      // });
      // const response = await showService.updateShow(showId, formDataToSend);
      
      // Mock success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Show updated successfully!');
      navigate(`/shows/${showId}`);
    } catch (error) {
      console.error('Error updating show:', error);
      alert('Failed to update show. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this show? This action cannot be undone.')) {
      return;
    }
    
    try {
      // TODO: await showService.deleteShow(showId);
      await new Promise(resolve => setTimeout(resolve, 500));
      alert('Show deleted successfully');
      navigate('/shows');
    } catch (error) {
      console.error('Error deleting show:', error);
      alert('Failed to delete show');
    }
  };
  
  if (loading) {
    return <div className="loading">Loading show...</div>;
  }
  
  return (
    <div className="create-show-page">
      {/* Header */}
      <div className="create-header">
        <button className="back-btn" onClick={() => navigate(`/shows/${showId}`)}>
          ← Back to Show
        </button>
        
        <div className="header-content">
          <h1>Edit Show</h1>
          <p>Update your show's identity and branding</p>
          {show?.updatedAt && (
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Last updated: {new Date(show.updatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      
      {/* Form */}
      <form className="create-form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="section-icon">📝</span>
            Basic Information
          </h2>
          
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Show Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className={`form-input ${errors.name ? 'error' : ''}`}
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your show's name"
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="tagline">
              Tagline
            </label>
            <input
              type="text"
              id="tagline"
              name="tagline"
              className="form-input"
              value={formData.tagline}
              onChange={handleChange}
              placeholder="A catchy one-liner about your show"
            />
            <span className="form-hint">Optional: A short, memorable phrase that captures your show's essence</span>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="category">
              Category *
            </label>
            <select
              id="category"
              name="category"
              className={`form-select ${errors.category ? 'error' : ''}`}
              value={formData.category}
              onChange={handleChange}
            >
              <option value="Lifestyle">Lifestyle</option>
              <option value="Fashion">Fashion</option>
              <option value="Beauty">Beauty</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Education">Education</option>
              <option value="Business">Business</option>
              <option value="Technology">Technology</option>
              <option value="Other">Other</option>
            </select>
            {errors.category && <span className="error-message">{errors.category}</span>}
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              className={`form-textarea ${errors.description ? 'error' : ''}`}
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell us about your show..."
              rows="5"
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
            <span className="form-hint">Describe what your show is about and what viewers can expect</span>
          </div>
        </div>
        
        {/* Visual Branding */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="section-icon">🎨</span>
            Visual Branding
          </h2>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cover Image</label>
              <div className="image-upload cover-upload">
                {coverPreview ? (
                  <div className="image-preview">
                    <img src={coverPreview} alt="Cover preview" />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={() => removeImage('cover')}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="upload-placeholder">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'cover')}
                      style={{ display: 'none' }}
                    />
                    <span className="upload-icon">🖼️</span>
                    <span className="upload-text">Upload Cover Image</span>
                    <span className="upload-hint">1920x1080 recommended • Max 5MB</span>
                  </label>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Logo</label>
              <div className="image-upload logo-upload">
                {logoPreview ? (
                  <div className="image-preview">
                    <img src={logoPreview} alt="Logo preview" />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={() => removeImage('logo')}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="upload-placeholder">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'logo')}
                      style={{ display: 'none' }}
                    />
                    <span className="upload-icon">⭐</span>
                    <span className="upload-text">Upload Logo</span>
                    <span className="upload-hint">Square format • Max 5MB</span>
                  </label>
                )}
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="primaryColor">
              Primary Brand Color
            </label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="primaryColor"
                name="primaryColor"
                className="color-picker"
                value={formData.primaryColor}
                onChange={handleChange}
              />
              <input
                type="text"
                className="form-input color-text"
                value={formData.primaryColor}
                onChange={handleChange}
                name="primaryColor"
                placeholder="#667eea"
              />
            </div>
            <span className="form-hint">This color will be used across your show's branding</span>
          </div>
        </div>
        
        {/* Settings */}
        <div className="form-section">
          <h2 className="section-title">
            <span className="section-icon">⚙️</span>
            Settings
          </h2>
          
          <div className="form-group">
            <label className="form-label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="form-select"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <span className="form-hint">Active shows are visible and can be worked on</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate(`/shows/${showId}`)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={saving}
          >
            {saving ? 'Updating...' : 'Update Show'}
          </button>
        </div>
      </form>
      
      {/* Danger Zone */}
      <div className="danger-zone">
        <h3>🚨 Danger Zone</h3>
        <p style={{ color: '#991b1b', marginBottom: '1rem' }}>
          Once you delete a show, there is no going back. This will permanently delete all episodes, assets, and data associated with this show.
        </p>
        <button className="btn-delete" onClick={handleDelete}>
          Delete Show
        </button>
      </div>
    </div>
  );
}

export default EditShow;
