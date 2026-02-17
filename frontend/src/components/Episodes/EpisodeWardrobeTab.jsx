import React, { useState, useEffect } from 'react';
import wardrobeService from '../../services/wardrobeService';
import './EpisodeWardrobeTab.css';

function EpisodeWardrobeTab({ episodeId, episode }) {
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [showWardrobe, setShowWardrobe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    if (episodeId) loadWardrobeData();
  }, [episodeId]);

  const loadWardrobeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await wardrobeService.getEpisodeWardrobe(episodeId);
      const items = res?.data?.data || res?.data || [];
      setWardrobeItems(Array.isArray(items) ? items : []);

      // Also load show wardrobe for the assignment modal
      if (episode?.show_id || episode?.showId) {
        try {
          const showRes = await wardrobeService.getShowWardrobe(episode.show_id || episode.showId);
          const showItems = showRes?.data?.data || showRes?.data || [];
          setShowWardrobe(Array.isArray(showItems) ? showItems : []);
        } catch {
          // Show wardrobe optional
        }
      }
    } catch (err) {
      console.error('Failed to load wardrobe:', err);
      setError('Failed to load wardrobe data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (wardrobeId) => {
    if (!confirm('Remove this wardrobe item from the episode?')) return;
    try {
      await wardrobeService.unlinkFromEpisode(episodeId, wardrobeId);
      await loadWardrobeData();
    } catch (err) {
      console.error('Failed to unlink wardrobe item:', err);
    }
  };

  // Group items by character
  const groupedByCharacter = wardrobeItems.reduce((acc, item) => {
    const char = item.character || item.character_name || 'Unassigned';
    if (!acc[char]) acc[char] = [];
    acc[char].push(item);
    return acc;
  }, {});

  const categories = ['all', ...new Set(wardrobeItems.map(i => i.category || i.garment_type || 'Other').filter(Boolean))];
  const filteredItems = filterCategory === 'all'
    ? wardrobeItems
    : wardrobeItems.filter(i => (i.category || i.garment_type) === filterCategory);

  if (loading) {
    return (
      <div className="ewt-loading">
        <div className="ewt-spinner" />
        <p>Loading wardrobe...</p>
      </div>
    );
  }

  return (
    <div className="episode-wardrobe-tab">
      {/* Header */}
      <div className="ewt-header">
        <div className="ewt-header-left">
          <h2>👗 Episode Wardrobe</h2>
          <p className="ewt-subtitle">Manage character outfits for this episode</p>
        </div>
        <div className="ewt-header-actions">
          <div className="ewt-view-toggle">
            <button
              className={`ewt-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >▦</button>
            <button
              className={`ewt-view-btn ${viewMode === 'character' ? 'active' : ''}`}
              onClick={() => setViewMode('character')}
              title="By character"
            >👤</button>
          </div>
          <button
            className="ewt-assign-btn"
            onClick={() => setShowAssignModal(true)}
          >
            + Add Wardrobe Item
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="ewt-stats">
        <div className="ewt-stat">
          <span className="ewt-stat-value">{wardrobeItems.length}</span>
          <span className="ewt-stat-label">Items Assigned</span>
        </div>
        <div className="ewt-stat">
          <span className="ewt-stat-value">{Object.keys(groupedByCharacter).length}</span>
          <span className="ewt-stat-label">Characters</span>
        </div>
        <div className="ewt-stat">
          <span className="ewt-stat-value">{showWardrobe.length}</span>
          <span className="ewt-stat-label">Show Library</span>
        </div>
      </div>

      {error && <div className="ewt-error">{error}</div>}

      {/* Category Filter */}
      {categories.length > 2 && (
        <div className="ewt-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`ewt-filter-chip ${filterCategory === cat ? 'active' : ''}`}
              onClick={() => setFilterCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {wardrobeItems.length === 0 ? (
        <div className="ewt-empty">
          <div className="ewt-empty-icon">👗</div>
          <h3>No Wardrobe Items Yet</h3>
          <p>Add wardrobe items from your show's library to this episode</p>
          <button
            className="ewt-assign-btn"
            onClick={() => setShowAssignModal(true)}
          >
            + Add First Item
          </button>
        </div>
      ) : viewMode === 'character' ? (
        /* Character-grouped view */
        <div className="ewt-character-groups">
          {Object.entries(groupedByCharacter).map(([charName, items]) => (
            <div key={charName} className="ewt-char-group">
              <div className="ewt-char-header">
                <span className="ewt-char-avatar">👤</span>
                <h3>{charName}</h3>
                <span className="ewt-char-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="ewt-char-items">
                {items.map(item => (
                  <WardrobeCard
                    key={item.id}
                    item={item}
                    onView={() => setSelectedItem(item)}
                    onRemove={() => handleUnlink(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid view */
        <div className="ewt-grid">
          {filteredItems.map(item => (
            <WardrobeCard
              key={item.id}
              item={item}
              onView={() => setSelectedItem(item)}
              onRemove={() => handleUnlink(item.id)}
            />
          ))}
        </div>
      )}

      {/* Show Wardrobe Picker Modal */}
      {showAssignModal && (
        <div className="ewt-picker-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="ewt-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="ewt-picker-header">
              <h3>Add from Show Wardrobe</h3>
              <button className="ewt-picker-close" onClick={() => setShowAssignModal(false)}>×</button>
            </div>
            <div className="ewt-picker-body">
              {showWardrobe.length === 0 ? (
                <div className="ewt-picker-empty">
                  <p>No wardrobe items in show library yet.</p>
                  <p>Upload items to the show's wardrobe first.</p>
                </div>
              ) : (
                <div className="ewt-picker-grid">
                  {showWardrobe
                    .filter(item => !wardrobeItems.some(w => w.id === item.id))
                    .map(item => (
                      <div key={item.id} className="ewt-picker-item" onClick={async () => {
                        try {
                          await wardrobeService.linkToEpisode(episodeId, item.id);
                          await loadWardrobeData();
                          setShowAssignModal(false);
                        } catch (err) {
                          console.error('Failed to link wardrobe item:', err);
                          alert('Failed to add wardrobe item');
                        }
                      }}>
                        <div className="ewt-picker-thumb">
                          {item.thumbnail_url || item.s3_url || item.s3_url_processed ? (
                            <img src={item.thumbnail_url || item.s3_url || item.s3_url_processed} alt={item.name} />
                          ) : (
                            <span className="ewt-placeholder">👗</span>
                          )}
                        </div>
                        <div className="ewt-picker-info">
                          <span className="ewt-picker-name">{item.name || 'Untitled'}</span>
                          <span className="ewt-picker-type">{item.clothing_category || 'Wardrobe'}</span>
                        </div>
                      </div>
                    ))}
                  {showWardrobe.filter(item => !wardrobeItems.some(w => w.id === item.id)).length === 0 && (
                    <div className="ewt-picker-empty">
                      <p>All show wardrobe items have been added to this episode.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Drawer */}
      {selectedItem && !showAssignModal && (
        <div className="ewt-drawer-overlay" onClick={() => setSelectedItem(null)}>
          <div className="ewt-drawer" onClick={e => e.stopPropagation()}>
            <div className="ewt-drawer-header">
              <h3>{selectedItem.name}</h3>
              <button className="ewt-drawer-close" onClick={() => setSelectedItem(null)}>×</button>
            </div>
            <div className="ewt-drawer-body">
              {(selectedItem.thumbnail_url || selectedItem.s3_url || selectedItem.s3_url_processed) && (
                <div className="ewt-drawer-image">
                  <img
                    src={selectedItem.thumbnail_url || selectedItem.s3_url || selectedItem.s3_url_processed}
                    alt={selectedItem.name}
                  />
                </div>
              )}
              <div className="ewt-drawer-details">
                {selectedItem.character && (
                  <div className="ewt-detail-row">
                    <span className="ewt-detail-label">Character</span>
                    <span className="ewt-detail-value">{selectedItem.character}</span>
                  </div>
                )}
                {selectedItem.clothing_category && (
                  <div className="ewt-detail-row">
                    <span className="ewt-detail-label">Category</span>
                    <span className="ewt-detail-value">{selectedItem.clothing_category}</span>
                  </div>
                )}
                {selectedItem.style && (
                  <div className="ewt-detail-row">
                    <span className="ewt-detail-label">Style</span>
                    <span className="ewt-detail-value">{selectedItem.style}</span>
                  </div>
                )}
                {selectedItem.description && (
                  <div className="ewt-detail-row">
                    <span className="ewt-detail-label">Description</span>
                    <span className="ewt-detail-value">{selectedItem.description}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Wardrobe Card sub-component */
function WardrobeCard({ item, onView, onRemove }) {
  const imageUrl = item.thumbnail_url || item.s3_url || item.s3_url_processed;
  const name = item.name || 'Wardrobe Item';
  const category = item.clothing_category || '';

  return (
    <div className="ewt-card" onClick={onView}>
      <div className="ewt-card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={name} />
        ) : (
          <div className="ewt-card-placeholder">👗</div>
        )}
      </div>
      <div className="ewt-card-info">
        <div className="ewt-card-name">{name}</div>
        {item.character && <div className="ewt-card-character">👤 {item.character}</div>}
        {category && <div className="ewt-card-category">{category}</div>}
      </div>
      <button
        className="ewt-card-remove"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        title="Remove from episode"
      >
        ×
      </button>
    </div>
  );
}

export default EpisodeWardrobeTab;
