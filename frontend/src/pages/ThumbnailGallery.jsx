import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ThumbnailGallery.css';

function ThumbnailGallery() {
  const navigate = useNavigate();

  const [thumbnails, setThumbnails] = useState([]);
  const [filteredThumbnails, setFilteredThumbnails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThumbnails();
  }, []);

  useEffect(() => {
    filterThumbnails();
  }, [searchQuery, platformFilter, statusFilter, thumbnails]);

  const loadThumbnails = async () => {
    setLoading(true);
    try {
      const mockThumbnails = [
        {
          id: '1',
          episode_id: 'ep-1',
          episode_number: 6,
          episode_title: 'Brunch Outfit Styling',
          platform: 'youtube',
          status: 'published',
          thumbnail_url: null,
          created_at: '2026-02-10',
          updated_at: '2026-02-11'
        },
        {
          id: '2',
          episode_id: 'ep-1',
          episode_number: 6,
          episode_title: 'Brunch Outfit Styling',
          platform: 'instagram',
          status: 'draft',
          thumbnail_url: null,
          created_at: '2026-02-10',
          updated_at: '2026-02-11'
        },
        {
          id: '3',
          episode_id: 'ep-2',
          episode_number: 5,
          episode_title: 'Capsule Wardrobe',
          platform: 'youtube',
          status: 'published',
          thumbnail_url: null,
          created_at: '2026-02-08',
          updated_at: '2026-02-09'
        }
      ];
      setThumbnails(mockThumbnails);
    } catch (error) {
      console.error('Failed to load thumbnails:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterThumbnails = () => {
    let filtered = [...thumbnails];

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.episode_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.episode_number.toString().includes(searchQuery)
      );
    }

    if (platformFilter !== 'all') {
      filtered = filtered.filter(t => t.platform === platformFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    setFilteredThumbnails(filtered);
  };

  const handleEdit = (thumbnail) => {
    navigate(`/episodes/${thumbnail.episode_id}/thumbnail/${thumbnail.id}`);
  };

  const handleDuplicate = async (thumbnail) => {
    try {
      alert(`Duplicating thumbnail ${thumbnail.id}...`);
      loadThumbnails();
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  };

  const handleDelete = async (thumbnail) => {
    if (!confirm(`Delete thumbnail for Episode ${thumbnail.episode_number}?`)) {
      return;
    }

    try {
      alert(`Deleted thumbnail ${thumbnail.id}`);
      loadThumbnails();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      youtube: '📺',
      instagram: '📸',
      tiktok: '🎵'
    };
    return icons[platform] || '📱';
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { label: 'Draft', class: 'draft' },
      published: { label: 'Published', class: 'published' },
      archived: { label: 'Archived', class: 'archived' }
    };
    return badges[status] || badges.draft;
  };

  if (loading) {
    return (
      <div className="thumbnail-gallery">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading thumbnails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="thumbnail-gallery">
      <header className="gallery-header">
        <div className="header-left">
          <h1>Thumbnail Gallery</h1>
          <span className="count">{filteredThumbnails.length} thumbnails</span>
        </div>
        <div className="header-right">
          <button className="create-btn" onClick={() => navigate('/episodes')}>
            + New Thumbnail
          </button>
        </div>
      </header>

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by episode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
        >
          <option value="all">All Platforms</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="gallery-content">
        {filteredThumbnails.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎨</div>
            <h2>No thumbnails found</h2>
            <p>
              {searchQuery || platformFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first thumbnail to get started'}
            </p>
            <button className="create-btn" onClick={() => navigate('/episodes')}>
              Create Thumbnail
            </button>
          </div>
        ) : (
          <div className="thumbnails-grid">
            {filteredThumbnails.map((thumbnail) => (
              <div key={thumbnail.id} className="thumbnail-card">
                <div className="thumbnail-preview">
                  {thumbnail.thumbnail_url ? (
                    <img src={thumbnail.thumbnail_url} alt={thumbnail.episode_title} />
                  ) : (
                    <div className="placeholder-thumbnail">
                      <span className="placeholder-icon">🎨</span>
                      <span className="placeholder-text">No Preview</span>
                    </div>
                  )}

                  <div className="platform-badge">
                    {getPlatformIcon(thumbnail.platform)}
                  </div>

                  <div className="quick-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleEdit(thumbnail)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleDuplicate(thumbnail)}
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(thumbnail)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="thumbnail-info">
                  <div className="info-header">
                    <h3 className="episode-title">
                      Ep. {thumbnail.episode_number}: {thumbnail.episode_title}
                    </h3>
                    <span className={`status-badge ${getStatusBadge(thumbnail.status).class}`}>
                      {getStatusBadge(thumbnail.status).label}
                    </span>
                  </div>

                  <div className="info-meta">
                    <span className="meta-item">
                      {getPlatformIcon(thumbnail.platform)} {thumbnail.platform}
                    </span>
                    <span className="meta-item">
                      📅 {new Date(thumbnail.updated_at).toLocaleDateString()}
                    </span>
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

export default ThumbnailGallery;
