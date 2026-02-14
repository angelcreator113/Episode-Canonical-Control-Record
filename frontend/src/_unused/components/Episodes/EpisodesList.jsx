import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEpisodes } from '../../hooks/useEpisodes';
import './EpisodesList.css';

export const EpisodesList = () => {
  const navigate = useNavigate();
  const {
    episodes,
    loading,
    error,
    pagination,
    changeStatus,
    goToPage,
    refresh,
  } = useEpisodes();

  const [selectedStatus, setSelectedStatus] = React.useState('');

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value);
    changeStatus(e.target.value);
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'complete':
        return '#4caf50';
      case 'processing':
        return '#ff9800';
      case 'pending':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const handleViewDetails = (episodeId) => {
    navigate(`/episodes/${episodeId}`);
  };

  if (loading && episodes.length === 0) {
    return <div className="episodes-container"><p>Loading episodes...</p></div>;
  }

  return (
    <div className="episodes-container">
      <div className="episodes-header">
        <h1>Episodes Library</h1>
        <div className="episodes-controls">
          <select 
            value={selectedStatus} 
            onChange={handleStatusChange}
            className="status-filter"
          >
            <option value="">All Episodes</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="complete">Complete</option>
          </select>
          <button onClick={refresh} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          Error loading episodes: {error}
        </div>
      )}

      <div className="episodes-grid">
        {episodes.map((episode) => (
          <div key={episode.id} className="episode-card">
            <div className="episode-header">
              <h3>{episode.title}</h3>
              <span 
                className="status-badge"
                style={{ backgroundColor: getStatusBadgeColor(episode.status) }}
              >
                {episode.status}
              </span>
            </div>
            
            <div className="episode-body">
              <p className="episode-description">{episode.description}</p>
              
              <div className="episode-meta">
                <div className="meta-item">
                  <span className="meta-label">Season:</span>
                  <span className="meta-value">{episode.season_number}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Episode:</span>
                  <span className="meta-value">{episode.episode_number}</span>
                </div>
              </div>

              {episode.air_date && (
                <div className="episode-date">
                  Aired: {new Date(episode.air_date).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="episode-footer">
              <button 
                className="view-btn"
                onClick={() => handleViewDetails(episode.id)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {episodes.length === 0 && !loading && (
        <div className="no-episodes">
          <p>No episodes found</p>
        </div>
      )}

      <div className="pagination">
        <button 
          disabled={pagination.page === 1}
          onClick={() => goToPage(pagination.page - 1)}
        >
          ← Previous
        </button>
        
        <span className="pagination-info">
          Page {pagination.page} of {pagination.pages} ({pagination.total} total)
        </span>
        
        <button 
          disabled={pagination.page >= pagination.pages}
          onClick={() => goToPage(pagination.page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default EpisodesList;
