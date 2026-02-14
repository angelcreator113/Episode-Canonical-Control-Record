import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CompositionLibrary.css';

export default function CompositionLibrary() {
  const navigate = useNavigate();

  const [compositions, setCompositions] = useState([]);
  const [filteredCompositions, setFilteredCompositions] = useState([]);
  const [view, setView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const allTags = ['Intro', 'Tutorial', 'Outro', 'Fashion', 'Lifestyle', 'Behind-Scenes'];

  useEffect(() => {
    loadCompositions();
  }, []);

  useEffect(() => {
    filterCompositions();
  }, [view, searchQuery, selectedTags, compositions]);

  const loadCompositions = async () => {
    setLoading(true);
    try {
      const mockCompositions = [
        {
          id: '1',
          name: 'Standard Intro Layout',
          description: 'Clean intro layout with LaLa center',
          tags: ['Intro', 'Fashion'],
          thumbnail_preview: null,
          usage_count: 12,
          is_favorite: true,
          created_at: '2026-01-15',
          updated_at: '2026-02-10',
          layers: []
        },
        {
          id: '2',
          name: 'Tutorial Title Card',
          description: 'Bold title with step number',
          tags: ['Tutorial'],
          thumbnail_preview: null,
          usage_count: 8,
          is_favorite: false,
          created_at: '2026-01-20',
          updated_at: '2026-02-08',
          layers: []
        },
        {
          id: '3',
          name: 'Behind the Scenes',
          description: 'Raw, authentic styling',
          tags: ['Behind-Scenes', 'Lifestyle'],
          thumbnail_preview: null,
          usage_count: 5,
          is_favorite: true,
          created_at: '2026-02-01',
          updated_at: '2026-02-11',
          layers: []
        }
      ];
      setCompositions(mockCompositions);
    } catch (error) {
      console.error('Failed to load compositions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCompositions = () => {
    let filtered = [...compositions];

    if (view === 'recent') {
      filtered = filtered.sort((a, b) =>
        new Date(b.updated_at) - new Date(a.updated_at)
      ).slice(0, 10);
    } else if (view === 'favorites') {
      filtered = filtered.filter(c => c.is_favorite);
    }

    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(c =>
        selectedTags.some(tag => c.tags.includes(tag))
      );
    }

    setFilteredCompositions(filtered);
  };

  const handleToggleFavorite = async (compositionId) => {
    try {
      setCompositions(compositions.map(c =>
        c.id === compositionId ? { ...c, is_favorite: !c.is_favorite } : c
      ));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleApply = (composition) => {
    navigate('/episodes/new/thumbnail/new', {
      state: { compositionId: composition.id }
    });
  };

  const handleEdit = (composition) => {
    navigate('/episodes/new/thumbnail/new', {
      state: { compositionId: composition.id, mode: 'edit' }
    });
  };

  const handleDuplicate = async (composition) => {
    try {
      alert(`Duplicating "${composition.name}"...`);
      loadCompositions();
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  };

  const handleDelete = async (composition) => {
    if (!confirm(`Delete "${composition.name}"?`)) {
      return;
    }

    try {
      alert(`Deleted "${composition.name}"`);
      loadCompositions();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  if (loading) {
    return (
      <div className="composition-library">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading compositions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="composition-library">
      <header className="library-header">
        <div className="header-left">
          <h1>Composition Library</h1>
          <span className="count">{filteredCompositions.length} compositions</span>
        </div>
        <div className="header-right">
          <button className="create-btn" onClick={() => navigate('/episodes/new/thumbnail/new')}>
            + New Composition
          </button>
        </div>
      </header>

      <div className="view-tabs">
        <button
          className={`view-tab ${view === 'all' ? 'active' : ''}`}
          onClick={() => setView('all')}
        >
          All Compositions
        </button>
        <button
          className={`view-tab ${view === 'recent' ? 'active' : ''}`}
          onClick={() => setView('recent')}
        >
          Recent
        </button>
        <button
          className={`view-tab ${view === 'favorites' ? 'active' : ''}`}
          onClick={() => setView('favorites')}
        >
          ⭐ Favorites
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search compositions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="tags-filter">
          <span className="filter-label">Tags:</span>
          <div className="tags-list">
            {allTags.map(tag => (
              <button
                key={tag}
                className={`tag-btn ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="library-content">
        {filteredCompositions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h2>No compositions found</h2>
            <p>
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your filters'
                : 'Create your first composition to reuse across episodes'}
            </p>
            <button className="create-btn" onClick={() => navigate('/episodes/new/thumbnail/new')}>
              Create Composition
            </button>
          </div>
        ) : (
          <div className="compositions-grid">
            {filteredCompositions.map((composition) => (
              <div key={composition.id} className="composition-card">
                <div className="composition-preview">
                  {composition.thumbnail_preview ? (
                    <img src={composition.thumbnail_preview} alt={composition.name} />
                  ) : (
                    <div className="placeholder-preview">
                      <span className="placeholder-icon">🎨</span>
                      <span className="placeholder-text">No Preview</span>
                    </div>
                  )}

                  <button
                    className={`favorite-btn ${composition.is_favorite ? 'active' : ''}`}
                    onClick={() => handleToggleFavorite(composition.id)}
                  >
                    {composition.is_favorite ? '⭐' : '☆'}
                  </button>
                </div>

                <div className="composition-info">
                  <h3 className="composition-name">{composition.name}</h3>
                  <p className="composition-description">{composition.description}</p>

                  {composition.tags.length > 0 && (
                    <div className="composition-tags">
                      {composition.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="composition-stats">
                    <span className="stat">
                      📊 Used in {composition.usage_count} episodes
                    </span>
                    <span className="stat">
                      📅 {new Date(composition.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="composition-actions">
                    <button
                      className="action-btn primary"
                      onClick={() => handleApply(composition)}
                    >
                      Apply
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleEdit(composition)}
                    >
                      Edit
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleDuplicate(composition)}
                    >
                      Duplicate
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(composition)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
