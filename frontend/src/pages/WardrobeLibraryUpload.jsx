/**
 * Wardrobe Library Upload
 * Upload new wardrobe items to the library
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import TagInput from '../components/TagInput';
import LoadingSpinner from '../components/LoadingSpinner';
import './WardrobeLibraryUpload.css';

const WardrobeLibraryUpload = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [shows, setShows] = useState([]);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    type: 'item',
    item_type: '',
    description: '',
    character: '',
    occasion: '',
    season: '',
    color: '',
    tags: [],
    website_url: '',
    price: '',
    vendor: '',
    show_id: ''
  });
  
  // Image handling
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Options
  const itemTypes = ['dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear'];
  const seasons = ['spring', 'summer', 'fall', 'winter'];
  const occasions = ['casual', 'formal', 'business', 'party', 'athletic'];
  const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'brown', 'pink', 'purple'];
  
  useEffect(() => {
    loadShows();
  }, []);
  
  const loadShows = async () => {
    try {
      const response = await fetch(`${API_URL}/shows`);
      if (response.ok) {
        const data = await response.json();
        setShows(data.data || []);
      }
    } catch (err) {
      console.error('Error loading shows:', err);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };
  
  const handleTagsChange = (tags) => {
    setFormData(prev => ({ ...prev, tags }));
  };
  
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processImageFile(file);
    }
  };
  
  const processImageFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image file must be less than 10MB');
      return;
    }
    
    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    setError(null);
  };
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };
  
  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    
    if (!imageFile) {
      setError('Please select an image');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Create FormData
      const data = new FormData();
      data.append('image', imageFile);
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (key === 'tags') {
          data.append(key, JSON.stringify(formData[key]));
        } else if (formData[key]) {
          data.append(key, formData[key]);
        }
      });
      
      await wardrobeLibraryService.uploadToLibrary(data);
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/wardrobe-library');
      }, 2000);
    } catch (err) {
      console.error('Error uploading item:', err);
      setError(err.message || 'Failed to upload item');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/wardrobe-library');
  };
  
  if (success) {
    return (
      <div className="upload-success">
        <div className="success-message">
          <div className="success-icon">✓</div>
          <h2>Item Uploaded Successfully!</h2>
          <p>Redirecting to library...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="wardrobe-library-upload">
      <div className="upload-header">
        <h1>Upload Wardrobe Item</h1>
        <button 
          className="btn btn-secondary"
          onClick={handleCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="upload-form">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="form-section image-section">
          <h2>Image *</h2>
          
          <div 
            className={`image-upload-area ${dragActive ? 'drag-active' : ''} ${imagePreview ? 'has-image' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {imagePreview ? (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  type="button"
                  className="btn-remove"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">📸</div>
                <p>Drag and drop an image here</p>
                <p className="upload-or">or</p>
                <label className="btn btn-secondary">
                  Choose File
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                </label>
                <p className="upload-hint">Maximum file size: 10MB</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label>Name *</label>
            <input 
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Red Cocktail Dress"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Type *</label>
              <select 
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                required
              >
                <option value="item">Individual Item</option>
                <option value="set">Outfit Set</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Item Type</label>
              <select 
                name="item_type"
                value={formData.item_type}
                onChange={handleInputChange}
              >
                <option value="">Select type...</option>
                {itemTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the item, materials, style notes..."
              rows="4"
            />
          </div>
        </div>
        
        <div className="form-section">
          <h2>Metadata</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Character</label>
              <input 
                type="text"
                name="character"
                value={formData.character}
                onChange={handleInputChange}
                placeholder="Character name"
              />
            </div>
            
            <div className="form-group">
              <label>Color</label>
              <select 
                name="color"
                value={formData.color}
                onChange={handleInputChange}
              >
                <option value="">Select color...</option>
                {colors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Season</label>
              <select 
                name="season"
                value={formData.season}
                onChange={handleInputChange}
              >
                <option value="">Select season...</option>
                {seasons.map(season => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Occasion</label>
              <select 
                name="occasion"
                value={formData.occasion}
                onChange={handleInputChange}
              >
                <option value="">Select occasion...</option>
                {occasions.map(occasion => (
                  <option key={occasion} value={occasion}>{occasion}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Tags</label>
            <TagInput 
              tags={formData.tags}
              onChange={handleTagsChange}
              placeholder="Add tags (press Enter)"
            />
          </div>
          
          <div className="form-group">
            <label>Show (Optional)</label>
            <select 
              name="show_id"
              value={formData.show_id}
              onChange={handleInputChange}
            >
              <option value="">Not associated with a show</option>
              {shows.map(show => (
                <option key={show.id} value={show.id}>{show.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-section">
          <h2>Commerce (Optional)</h2>
          
          <div className="form-group">
            <label>Website URL</label>
            <input 
              type="url"
              name="website_url"
              value={formData.website_url}
              onChange={handleInputChange}
              placeholder="https://..."
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Price</label>
              <input 
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label>Vendor</label>
              <input 
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleInputChange}
                placeholder="Store or brand name"
              />
            </div>
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          
          <button 
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" /> Uploading...
              </>
            ) : (
              'Upload Item'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WardrobeLibraryUpload;
