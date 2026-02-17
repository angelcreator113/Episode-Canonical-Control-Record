import React, { useState, useEffect, useRef } from 'react';
import wardrobeService from '../../services/wardrobeService';
import api from '../../services/api';
import './SceneWardrobePicker.css';

/**
 * SceneWardrobePicker — upload OR pick a wardrobe item for a character in a scene.
 * Two tabs: "Upload" (quick add, no name required) and "Library" (existing items).
 */
function SceneWardrobePicker({ episodeId, showId, characters = [], onAssign, onClose }) {
  const [tab, setTab] = useState('upload');
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState(characters[0]?.id || '');
  const [selectedOutfitId, setSelectedOutfitId] = useState(null);
  const [selectedOutfitUrl, setSelectedOutfitUrl] = useState(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (tab === 'library') loadOutfits();
  }, [tab, episodeId, showId]);

  const loadOutfits = async () => {
    setLoading(true);
    try {
      let items = [];
      if (episodeId) {
        const res = await wardrobeService.getEpisodeWardrobe(episodeId);
        items = res?.data?.data || res?.data || [];
      }
      if ((!items.length) && showId) {
        const res = await wardrobeService.getShowWardrobe(showId);
        items = res?.data?.data || res?.data || [];
      }
      if (!items.length) {
        const res = await api.get('/api/v1/wardrobe?limit=100');
        items = res?.data?.data || res?.data || [];
      }
      setOutfits(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load outfits:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const charName = selectedChar?.name || selectedChar?.id || 'character';

  // ---- File handling ----
  const handleFileSelect = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setUploadPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  const handleUploadAndAssign = async () => {
    if (!uploadFile || !selectedCharId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('character', charName);
      formData.append('clothingCategory', 'general');
      if (showId) formData.append('showId', showId);

      const res = await api.post('/api/v1/wardrobe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newItem = res?.data?.data;
      if (newItem) {
        const imgUrl = newItem.s3_url_processed || newItem.s3_url;

        if (episodeId) {
          try {
            await wardrobeService.linkToEpisode(episodeId, newItem.id);
          } catch (linkErr) {
            console.warn('Could not link to episode:', linkErr.message);
          }
        }

        onAssign(selectedCharId, newItem.id, imgUrl);
      }
    } catch (err) {
      console.error('Failed to upload wardrobe:', err);
      alert('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmLibrary = () => {
    if (selectedCharId && selectedOutfitId) {
      onAssign(selectedCharId, selectedOutfitId, selectedOutfitUrl);
    }
  };

  return (
    <div className="swp-overlay" onClick={onClose}>
      <div className="swp-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="swp-header">
          <h2>👗 Add Wardrobe</h2>
          <button className="swp-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="swp-tabs">
          <button className={`swp-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
            📤 Upload New
          </button>
          <button className={`swp-tab ${tab === 'library' ? 'active' : ''}`} onClick={() => setTab('library')}>
            📂 Library
          </button>
        </div>

        <div className="swp-body">
          {/* Character selector */}
          {characters.length > 1 && (
            <div className="swp-section">
              <label className="swp-label">Character</label>
              <div className="swp-char-row">
                {characters.map(c => (
                  <button
                    key={c.id}
                    className={`swp-char-btn ${selectedCharId === c.id ? 'active' : ''}`}
                    onClick={() => setSelectedCharId(c.id)}
                  >
                    <span className="swp-char-icon">👤</span>
                    <span>{c.name || c.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {characters.length === 1 && (
            <div className="swp-section">
              <div className="swp-single-char">
                Adding outfit for <strong>{characters[0].name || characters[0].id}</strong>
              </div>
            </div>
          )}

          {/* ── UPLOAD TAB ── */}
          {tab === 'upload' && (
            <div className="swp-upload-area">
              {!uploadPreview ? (
                <div
                  className={`swp-dropzone ${dragOver ? 'dragover' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="swp-dropzone-icon">📷</div>
                  <div className="swp-dropzone-text">Drop an image here or click to browse</div>
                  <div className="swp-dropzone-hint">PNG, JPG up to 10MB</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  />
                </div>
              ) : (
                <div className="swp-upload-preview">
                  <img src={uploadPreview} alt="Preview" />
                  <button
                    className="swp-upload-clear"
                    onClick={() => { setUploadPreview(null); setUploadFile(null); }}
                    title="Remove"
                  >×</button>
                </div>
              )}
            </div>
          )}

          {/* ── LIBRARY TAB ── */}
          {tab === 'library' && (
            <>
              {loading ? (
                <div className="swp-loading">Loading outfits...</div>
              ) : outfits.length === 0 ? (
                <div className="swp-empty">
                  <p>No wardrobe items yet.</p>
                  <p className="swp-hint">Switch to Upload to add one now.</p>
                </div>
              ) : (
                <div className="swp-grid">
                  {outfits.map(outfit => {
                    const imgUrl = outfit.s3_url_processed || outfit.s3_url || outfit.processed_url || outfit.original_url || outfit.thumbnail_url || outfit.image_url;
                    const isSelected = selectedOutfitId === outfit.id;
                    return (
                      <div
                        key={outfit.id}
                        className={`swp-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => { setSelectedOutfitId(outfit.id); setSelectedOutfitUrl(imgUrl); }}
                      >
                        <div className="swp-card-img">
                          {imgUrl
                            ? <img src={imgUrl} alt={outfit.name} />
                            : <div className="swp-card-ph">👗</div>
                          }
                        </div>
                        {isSelected && <div className="swp-card-check">✓</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="swp-footer">
          <button className="swp-cancel" onClick={onClose}>Cancel</button>
          {tab === 'upload' ? (
            <button
              className="swp-confirm"
              disabled={!uploadFile || !selectedCharId || uploading}
              onClick={handleUploadAndAssign}
            >
              {uploading ? 'Uploading...' : 'Upload & Apply'}
            </button>
          ) : (
            <button
              className="swp-confirm"
              disabled={!selectedCharId || !selectedOutfitId}
              onClick={handleConfirmLibrary}
            >
              Apply Outfit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SceneWardrobePicker;
