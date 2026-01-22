import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import AdvancedSearchFilters from '../components/Search/AdvancedSearchFilters';
import SearchHistory from '../components/Search/SearchHistory';
import './SearchResults.css';

export const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [filters, setFilters] = useState({});
  const { results, loading, error, pagination } = useSearch(initialQuery, page);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}&page=1`);
    }
  };

  const handleViewDetails = (episodeId) => {
    navigate(`/episodes/${episodeId}`);
  };

  const handlePageChange = (newPage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(`/search?q=${encodeURIComponent(initialQuery)}&page=${newPage}`);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    navigate('/search');
  };

  return (
    <div className="search-page">
      {/* Search Header */}
      <div className="search-header">
        <div className="search-header-content">
          <h1>🔍 Search Episodes</h1>
          <p className="search-subtitle">Find episodes by title, description, or metadata</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search episodes..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            {searchInput && (
              <button
                type="button"
                className="clear-button"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="search-button" disabled={!searchInput.trim()}>
            Search
          </button>
        </form>
      </div>

      {/* Search History */}
      <div className="search-bar-section">
        <SearchHistory 
          onQueryClick={(query) => {
            setSearchInput(query);
            navigate(`/search?q=${encodeURIComponent(query)}&page=1`);
          }} 
        />
      </div>

      {/* Advanced Filters */}
      {initialQuery && (
        <div className="search-bar-section">
          <AdvancedSearchFilters
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              // Reset to page 1 when filters change
              const params = new URLSearchParams({
                q: initialQuery,
                page: '1',
                ...Object.fromEntries(
                  Object.entries(newFilters).filter(([_, value]) => value)
                ),
              });
              navigate(`/search?${params.toString()}`);
            }}
            initialFilters={filters}
          />
        </div>
      )}

      {/* Results Section */}
      <div className="search-results-container">
        {loading && (
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Searching...</p>
          </div>
        )}

        {error && !loading && (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && initialQuery && (
          <>
            {/* Results Header */}
            <div className="results-header">
              <div className="results-info">
                <h2>Results for "{initialQuery}"</h2>
                {pagination.total > 0 && (
                  <p className="result-count">
                    {pagination.total} result{pagination.total !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>
            </div>

            {/* No Results */}
            {pagination.total === 0 && (
              <div className="no-results">
                <span className="empty-icon">📭</span>
                <h3>No episodes found</h3>
                <p>No episodes match "{initialQuery}"</p>
                <p className="suggestion">Try different keywords or check your spelling</p>
              </div>
            )}

            {/* Results Grid */}
            {pagination.total > 0 && (
              <>
                <div className="results-grid">
                  {results.map((episode) => (
                    <div key={episode.id} className="result-card">
                      <div className="card-header">
                        <h3 className="episode-title">
                          {episode.title || episode.episodeTitle || 'Untitled Episode'}
                        </h3>
                        <span className="episode-number">
                          Episode {episode.episode_number || episode.episodeNumber || '?'}
                        </span>
                      </div>

                      {episode.description && (
                        <p className="episode-description">
                          {episode.description.length > 150
                            ? `${episode.description.substring(0, 150)}...`
                            : episode.description}
                        </p>
                      )}

                      <div className="card-meta">
                        {episode.air_date || episode.airDate ? (
                          <span className="meta-item">
                            📅 {new Date(episode.air_date || episode.airDate).toLocaleDateString()}
                          </span>
                        ) : null}
                        
                        {episode.status && (
                          <span className={`status-badge status-${episode.status.toLowerCase()}`}>
                            {episode.status}
                          </span>
                        )}
                      </div>

                      {episode.categories && Array.isArray(episode.categories) && episode.categories.length > 0 && (
                        <div className="card-tags">
                          {episode.categories.slice(0, 3).map((cat, idx) => (
                            <span key={idx} className="tag">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        className="view-button"
                        onClick={() => handleViewDetails(episode.id)}
                      >
                        View Details →
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
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
                      <span className="current-page">{page}</span>
                      <span className="separator">/</span>
                      <span className="total-pages">{pagination.pages}</span>
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
          </>
        )}

        {/* Initial State - No Search Yet */}
        {!loading && !initialQuery && (
          <div className="initial-state">
            <span className="initial-icon">🔍</span>
            <h3>Start Searching</h3>
            <p>Enter keywords above to search for episodes</p>
            <div className="search-tips">
              <h4>Search Tips:</h4>
              <ul>
                <li>Search by episode title or description</li>
                <li>Use quotes for exact phrases</li>
                <li>Try different keywords if you don't find what you're looking for</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
