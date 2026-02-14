import React, { useState, useEffect } from 'react';
import wardrobeService from '../../services/wardrobeService';
import './SceneWardrobePicker.css';

/**
 * SceneWardrobePicker — pick a wardrobe item per character in a scene.
 * Loads outfits from the episode (already assigned) or show library.
 */
function SceneWardrobePicker({ episodeId, showId, characters = [], onAssign, onClose }) {
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharId, setSelectedCharId] = useState(characters[0]?.id || '');
  const [selectedOutfitId, setSelectedOutfitId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    loadOutfits();
  }, [episodeId, showId]);

  const loadOutfits = async () => {
    setLoading(true);
    try {
      // Try episode wardrobe first, fall back to show wardrobe
      let items = [];
      if (episodeId) {
        const res = await wardrobeService.getEpisodeWardrobe(episodeId);
        items = res?.data?.data || res?.data || [];
      }
      if ((!items.length || items.length === 0) && showId) {
        const res = await wardrobeService.getShowWardrobe(showId);
        items = res?.data?.data || res?.data || [];
      }
      setOutfits(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load outfits:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...new Set(outfits.map(o => o.category || o.garment_type || 'Other').filter(Boolean))];
  const filtered = filterCategory === 'all'
    ? outfits
    : outfits.filter(o => (o.category || o.garment_type) === filterCategory);

  const handleConfirm = () => {
    if (selectedCharId && selectedOutfitId) {
      onAssign(selectedCharId, selectedOutfitId);
    }
  };

  return (
    <div className="swp-overlay" onClick={onClose}>
      <div className="swp-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="swp-header">
          <h2>👗 Assign Wardrobe</h2>
          <button className="swp-close" onClick={onClose}>×</button>
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
                Assigning outfit to <strong>{characters[0].name || characters[0].id}</strong>
              </div>
            </div>
          )}

          {/* Category filter */}
          {categories.length > 2 && (
            <div className="swp-filters">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`swp-filter ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          )}

          {/* Outfit grid */}
          {loading ? (
            <div className="swp-loading">Loading outfits...</div>
          ) : filtered.length === 0 ? (
            <div className="swp-empty">
              <p>No wardrobe items available.</p>
              <p className="swp-hint">Add items in the Wardrobe tab or Show Wardrobe page first.</p>
            </div>
          ) : (
            <div className="swp-grid">
              {filtered.map(outfit => {
                const imgUrl = outfit.processed_url || outfit.original_url || outfit.thumbnail_url;
                return (
                  <div
                    key={outfit.id}
                    className={`swp-card ${selectedOutfitId === outfit.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOutfitId(outfit.id)}
                  >
                    <div className="swp-card-img">
                      {imgUrl
                        ? <img src={imgUrl} alt={outfit.name} />
                        : <div className="swp-card-ph">👗</div>
                      }
                    </div>
                    <div className="swp-card-info">
                      <div className="swp-card-name">{outfit.name || outfit.original_filename || 'Outfit'}</div>
                      {outfit.character && <div className="swp-card-char">{outfit.character}</div>}
                    </div>
                    {selectedOutfitId === outfit.id && (
                      <div className="swp-card-check">✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="swp-footer">
          <button className="swp-cancel" onClick={onClose}>Cancel</button>
          <button
            className="swp-confirm"
            disabled={!selectedCharId || !selectedOutfitId}
            onClick={handleConfirm}
          >
            Assign Outfit
          </button>
        </div>
      </div>
    </div>
  );
}

export default SceneWardrobePicker;
