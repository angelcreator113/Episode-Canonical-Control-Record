// frontend/src/pages/CreateShow.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateShow.css';

function CreateShow() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    category: 'Lifestyle',
    coverImage: null,
    logo: null,
    primaryColor: '#667eea',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [coverPreview, setCoverPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
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
      // const response = await showService.createShow(formDataToSend);
      
      // Mock success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Show created successfully!');
      navigate('/shows');
    } catch (error) {
      console.error('Error creating show:', error);
      alert('Failed to create show. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="create-show-page">
      {/* Header */}
      <div className="create-header">
        <button className="back-btn" onClick={() => navigate('/shows')}>
          ← Back to Shows
        </button>
        
        <div className="header-content">
          <h1>Create New Show</h1>
          <p>Set up your show's identity and branding</p>
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
            onClick={() => navigate('/shows')}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-submit"
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create Show'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateShow;
