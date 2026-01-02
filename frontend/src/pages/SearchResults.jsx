import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import './SearchResults.css';

export const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const { results, loading, error, pagination } = useSearch(query, page);

  const handleViewDetails = (episodeId) => {
    navigate(`/episodes/${episodeId}`);
  };

  const handlePageChange = (newPage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(`/search?q=${encodeURIComponent(query)}&page=${newPage}`);
  };

  if (loading && results.length === 0) {
    return (
      <div className="search-results">
        <div className="loading">Searching...</div>
      </div>
    );
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <h1>Search Results</h1>
        <p className="search-query">
          Results for: <strong>"{query}"</strong>
        </p>
        {pagination.total > 0 && (
          <p className="result-count">
            Found {pagination.total} result{pagination.total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
        </div>
      )}

      {pagination.total === 0 ? (
        <div className="no-results">
          <span className="icon">🔍</span>
          <p>No episodes found matching "{query}"</p>
          <p className="suggestion">Try searching for different keywords</p>
        </div>
      ) : (
        <>
          <div className="results-grid">
            {results.map((episode) => (
              <div key={episode.id} className="result-card">
                <div className="result-header">
                  <h3 className="result-title">{episode.episodeTitle || 'Untitled'}</h3>
                  <span className="result-show">{episode.showName || 'Unknown Show'}</span>
                </div>

                <div className="result-meta">
                  <span className="meta-item">
                    Season {episode.seasonNumber || 'N/A'}, Ep {episode.episodeNumber || 'N/A'}
                  </span>
                  {episode.airDate && (
                    <span className="meta-item">
                      {new Date(episode.airDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {episode.description && (
                  <p className="result-description">{episode.description}</p>
                )}

                <div className="result-tags">
                  {episode.tags && Array.isArray(episode.tags) && (
                    episode.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))
                  )}
                </div>

                <div className="result-status">
                  <span className={`status-badge ${episode.processingStatus || 'pending'}`}>
                    {(episode.processingStatus || 'Pending').charAt(0).toUpperCase() +
                      (episode.processingStatus || 'Pending').slice(1)}
                  </span>
                </div>

                <button
                  className="view-button"
                  onClick={() => handleViewDetails(episode.id)}
                >
                  View Details →
                </button>
              </div>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                ← Previous
              </button>

              <div className="pagination-info">
                Page {page} of {pagination.pages}
              </div>

              <button
                className="pagination-btn"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= pagination.pages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResults;
