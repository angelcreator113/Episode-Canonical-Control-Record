/**
 * Wardrobe Library Upload
 * Upload wardrobe items with AI auto-fill from image analysis
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Sparkles, Loader, X, ArrowLeft, Camera } from 'lucide-react';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import TagInput from '../components/TagInput';
import './WardrobeLibraryUpload.css';

const WardrobeLibraryUpload = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [shows, setShows] = useState([]);

  const [formData, setFormData] = useState({
    name: '', type: 'item', item_type: '', description: '',
    character: 'Lala', occasion: '', season: '', color: '',
    tags: [], website_url: '', price: '', vendor: '', show_id: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const itemTypes = ['dress', 'top', 'bottom', 'shoes', 'accessory', 'jewelry', 'bag', 'outerwear', 'swimwear', 'activewear'];
  const seasons = ['spring', 'summer', 'fall', 'winter', 'all-season'];
  const occasions = ['casual', 'formal', 'business', 'party', 'athletic', 'brunch', 'date_night', 'resort'];

  useEffect(() => {
    fetch(`${API_URL}/shows`).then(r => r.json()).then(d => setShows(d.data || [])).catch(() => {});
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const processImageFile = (file) => {
    if (!file.type.startsWith('image/')) { setError('Please select a valid image file'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be less than 10MB'); return; }

    setImageFile(file);
    setAiAnalysis(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setError(null);
  };

  // ── AI ANALYZE ──────────────────────────────────────────────────────
  const analyzeImage = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/wardrobe-library/analyze-image`, {
        method: 'POST', body: fd,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await res.json();

      if (data.success && data.data) {
        const ai = data.data;
        setAiAnalysis(ai);

        // Auto-fill form fields from AI
        setFormData(prev => ({
          ...prev,
          name: ai.name || prev.name,
          item_type: ai.item_type || prev.item_type,
          color: ai.color || prev.color,
          description: ai.description || prev.description,
          season: ai.season || prev.season,
          occasion: ai.occasion || prev.occasion,
          vendor: ai.brand_guess || prev.vendor,
          tags: ai.aesthetic_tags || prev.tags,
          price: ai.price_estimate ? ai.price_estimate.replace(/[^0-9.]/g, '').split('-')[0] || '' : prev.price,
        }));
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Analysis failed: ' + err.message);
    }
    setAnalyzing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setError('Name is required'); return; }
    if (!imageFile) { setError('Please select an image'); return; }

    try {
      setLoading(true);
      setError(null);
      const data = new FormData();
      data.append('image', imageFile);
      Object.keys(formData).forEach(key => {
        if (key === 'tags') data.append(key, JSON.stringify(formData[key]));
        else if (formData[key]) data.append(key, formData[key]);
      });
      await wardrobeLibraryService.uploadToLibrary(data);
      setSuccess(true);
      setTimeout(() => navigate('/wardrobe-library'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to upload');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="wlu-success">
        <div className="wlu-success-icon">✓</div>
        <h2>Uploaded!</h2>
        <p>Redirecting to library...</p>
      </div>
    );
  }

  return (
    <div className="wlu-page">
      <div className="wlu-header">
        <button className="wlu-back" onClick={() => navigate('/wardrobe-library')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>Upload Wardrobe Item</h1>
      </div>

      {error && <div className="wlu-error">{error}</div>}

      <form onSubmit={handleSubmit} className="wlu-form">
        <div className="wlu-layout">
          {/* ── LEFT: Image + AI ── */}
          <div className="wlu-left">
            <div
              className={`wlu-dropzone ${dragActive ? 'drag-active' : ''} ${imagePreview ? 'has-image' : ''}`}
              onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) processImageFile(e.dataTransfer.files[0]); }}
            >
              {imagePreview ? (
                <div className="wlu-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="wlu-remove" onClick={() => { setImageFile(null); setImagePreview(null); setAiAnalysis(null); }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="wlu-placeholder">
                  <Camera size={24} />
                  <span>Drop image or click to browse</span>
                  <span className="wlu-hint">JPG, PNG, WebP · Max 10MB</span>
                  <input type="file" accept="image/*" onChange={e => e.target.files[0] && processImageFile(e.target.files[0])} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* AI Analyze Button */}
            {imageFile && (
              <button type="button" className="wlu-analyze-btn" onClick={analyzeImage} disabled={analyzing}>
                {analyzing ? (
                  <><Loader size={14} className="spin" /> Analyzing with Claude Vision...</>
                ) : aiAnalysis ? (
                  <><Sparkles size={14} /> Re-analyze Image</>
                ) : (
                  <><Sparkles size={14} /> Auto-fill from Image</>
                )}
              </button>
            )}

            {/* AI Analysis Summary */}
            {aiAnalysis && (
              <div className="wlu-ai-summary">
                <div className="wlu-ai-label">AI Detected</div>
                {aiAnalysis.style_notes && <p className="wlu-ai-notes">{aiAnalysis.style_notes}</p>}
                <div className="wlu-ai-chips">
                  {aiAnalysis.tier && <span className={`wlu-chip tier-${aiAnalysis.tier}`}>{aiAnalysis.tier}</span>}
                  {aiAnalysis.price_estimate && <span className="wlu-chip">{aiAnalysis.price_estimate}</span>}
                  {(aiAnalysis.colors || []).map(c => <span key={c} className="wlu-chip">{c}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Form Fields ── */}
          <div className="wlu-right">
            <div className="wlu-field">
              <label>Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                     placeholder="e.g., Floral Smocked Sundress" required />
            </div>

            <div className="wlu-row">
              <div className="wlu-field">
                <label>Category</label>
                <select name="item_type" value={formData.item_type} onChange={handleInputChange}>
                  <option value="">Select...</option>
                  {itemTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="wlu-field">
                <label>Color</label>
                <input type="text" name="color" value={formData.color} onChange={handleInputChange} placeholder="e.g., blush pink" />
              </div>
            </div>

            <div className="wlu-field">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange}
                        placeholder="Material, style, fit..." rows="3" />
            </div>

            <div className="wlu-row">
              <div className="wlu-field">
                <label>Season</label>
                <select name="season" value={formData.season} onChange={handleInputChange}>
                  <option value="">Any</option>
                  {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="wlu-field">
                <label>Occasion</label>
                <select name="occasion" value={formData.occasion} onChange={handleInputChange}>
                  <option value="">Any</option>
                  {occasions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div className="wlu-field">
              <label>Tags</label>
              <TagInput tags={formData.tags} onChange={tags => setFormData(p => ({ ...p, tags }))} placeholder="Add tags (Enter)" />
            </div>

            <div className="wlu-row">
              <div className="wlu-field">
                <label>Brand</label>
                <input type="text" name="vendor" value={formData.vendor} onChange={handleInputChange} placeholder="Brand name" />
              </div>
              <div className="wlu-field">
                <label>Price</label>
                <input type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder="0.00" step="0.01" min="0" />
              </div>
            </div>

            <div className="wlu-row">
              <div className="wlu-field">
                <label>Show</label>
                <select name="show_id" value={formData.show_id} onChange={handleInputChange}>
                  <option value="">Not linked</option>
                  {shows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="wlu-field">
                <label>Character</label>
                <input type="text" name="character" value={formData.character} onChange={handleInputChange} placeholder="Lala" />
              </div>
            </div>

            <div className="wlu-field">
              <label>Website URL</label>
              <input type="url" name="website_url" value={formData.website_url} onChange={handleInputChange} placeholder="https://..." />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="wlu-actions">
          <button type="button" className="wlu-btn-cancel" onClick={() => navigate('/wardrobe-library')} disabled={loading}>Cancel</button>
          <button type="submit" className="wlu-btn-submit" disabled={loading || !imageFile}>
            {loading ? <><Loader size={14} className="spin" /> Uploading...</> : <><Upload size={14} /> Upload Item</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WardrobeLibraryUpload;
