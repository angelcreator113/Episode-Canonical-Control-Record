/**
 * Episodes List Page - MODERN REDESIGN
 * Mobile-first, clean, convenient layout
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiMenu,
  HiX,
  HiViewGrid,
  HiViewList,
  HiPlus,
  HiSearch,
} from 'react-icons/hi';
import { useAuth } from '../contexts/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { useBulkSelection } from '../contexts/BulkSelectionContext';
import episodeService from '../services/episodeService';
import EpisodeCard from '../components/EpisodeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { PAGINATION } from '../utils/constants';
import { API_URL } from '../config/api';
import '../styles/Episodes.css';

const Episodes = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    toggleEpisode,
    deselectAll,
    isSelected,
    getSelectionCount,
  } = useBulkSelection();

  // Check for show filter in URL params
  const searchParams = new URLSearchParams(window.location.search);
  const showIdFromUrl = searchParams.get('show');

  // State
  const [page, setPage] = useState(1);
  const [limit] = useState(PAGINATION.DEFAULT_LIMIT);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(showIdFromUrl || 'all');
  const [shows, setShows] = useState([]);
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('episodes'); // New: search scope
  const [groupByShow, setGroupByShow] = useState(false); // New: show grouping
  const [allEpisodes, setAllEpisodes] = useState([]); // New: for load more
  const [hasMore, setHasMore] = useState(true); // New: load more tracking
  const [loadingMore, setLoadingMore] = useState(false); // New: loading state
  const [showBulkActions, setShowBulkActions] = useState(false); // New: bulk actions menu
  const [savedFilters, setSavedFilters] = useState([]); // New: saved filters

  // Fetch episodes
  const fetcher = async () => {
    const filters = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (showFilter !== 'all') filters.show_id = showFilter;
    filters.sort = `${sortBy}:${sortOrder}`;
    return await episodeService.getEpisodes(page, limit, filters);
  };

  const { data: episodes, loading } = useFetch(fetcher, [
    page,
    limit,
    refreshTrigger,
    statusFilter,
    showFilter,
    sortBy,
    sortOrder,
  ]);

  // Auth redirect
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load shows for filter
  useEffect(() => {
    const fetchShows = async () => {
      try {
        const response = await fetch(`${API_URL}/shows`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setShows(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load shows:', err);
      }
    };
    fetchShows();
  }, []);

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedEpisodeFilters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
  }, []);

  // Close sidebar on route-size changes (desktop -> tablet etc.)
  useEffect(() => {
    const handleResize = () => {
      // If we moved to desktop, force sidebar open visually via CSS (no overlay needed)
      // But we still keep state for mobile/tablet behavior.
      if (window.innerWidth >= 1025) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  // Handlers
  const handleDelete = async (episodeId) => {
    if (!window.confirm('Delete this episode?')) return;
    try {
      await episodeService.deleteEpisode(episodeId);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleView = (episodeId) => navigate(`/episodes/${episodeId}`);
  const handleEdit = (episodeId) => navigate(`/episodes/${episodeId}/edit`);

  // Load more episodes
  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const filters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (showFilter !== 'all') filters.show_id = showFilter;
      filters.sort = `${sortBy}:${sortOrder}`;
      
      const moreEpisodes = await episodeService.getEpisodes(nextPage, limit, filters);
      
      if (moreEpisodes?.data?.length > 0) {
        setAllEpisodes(prev => [...prev, ...moreEpisodes.data]);
        setPage(nextPage);
        setHasMore(moreEpisodes.data.length === limit);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Bulk actions
  const handleBulkPublish = async () => {
    if (!window.confirm(`Publish ${getSelectionCount()} episodes?`)) return;
    setShowBulkActions(false);
    // TODO: Implement bulk publish API call
    console.log('Bulk publish:', getSelectionCount(), 'episodes');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${getSelectionCount()} episodes? This cannot be undone.`)) return;
    setShowBulkActions(false);
    // TODO: Implement bulk delete API call
    console.log('Bulk delete:', getSelectionCount(), 'episodes');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleBulkMoveToShow = async (showId) => {
    setShowBulkActions(false);
    // TODO: Implement bulk move API call
    console.log('Bulk move to show:', showId);
    setRefreshTrigger(prev => prev + 1);
  };

  // Save current filter
  const handleSaveFilter = () => {
    const filterName = prompt('Name this filter:');
    if (!filterName) return;
    
    const newFilter = {
      id: Date.now(),
      name: filterName,
      status: statusFilter,
      show: showFilter,
      sortBy,
      sortOrder,
    };
    
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('savedEpisodeFilters', JSON.stringify(updated));
  };

  const handleApplyFilter = (filter) => {
    setStatusFilter(filter.status);
    setShowFilter(filter.show);
    setSortBy(filter.sortBy);
    setSortOrder(filter.sortOrder);
    setPage(1);
  };

  const handleDeleteFilter = (filterId) => {
    const updated = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem('savedEpisodeFilters', JSON.stringify(updated));
  };

  // Filter episodes by search
  const filteredEpisodes = React.useMemo(() => {
    if (!episodes?.data) return episodes;
    
    let filtered = episodes.data;

    // Apply search if query exists
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ep) =>
          ep.title?.toLowerCase().includes(q) ||
          ep.description?.toLowerCase().includes(q)
      );
    }

    // Group by show if enabled
    if (groupByShow) {
      const grouped = {};
      filtered.forEach(ep => {
        const showId = ep.show_id || 'unassigned';
        if (!grouped[showId]) grouped[showId] = [];
        grouped[showId].push(ep);
      });
      return { ...episodes, grouped, data: filtered, total: filtered.length };
    }

    return { ...episodes, data: filtered, total: filtered.length };
  }, [episodes, searchQuery, groupByShow]);

  const totalPages =
    Math.max(1, Math.ceil((filteredEpisodes?.total || 0) / limit)) || 1;

  if (authLoading) return <LoadingSpinner />;

  return (
    <div className="episodes-page-modern">
      {/* Header */}
      <header className="episodes-header-modern">
        <div className="header-left">
          {/* Mobile/Tablet Sidebar Toggle */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label={sidebarOpen ? 'Close filters' : 'Open filters'}
          >
            {sidebarOpen ? <HiX size={22} /> : <HiMenu size={22} />}
          </button>

          <h1>Episodes</h1>
          <span className="episode-count">{episodes?.data?.length || 0}</span>
        </div>

        <div className="header-actions">
          <div className="view-toggle" role="tablist" aria-label="View mode">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid"
              aria-label="Grid view"
              type="button"
            >
              <HiViewGrid size={20} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List"
              aria-label="List view"
              type="button"
            >
              <HiViewList size={20} />
            </button>
          </div>

          <button
            className="btn-create"
            onClick={() => navigate('/episodes/create')}
            type="button"
          >
            <HiPlus size={20} />
            <span>Create</span>
          </button>
        </div>
      </header>

      {/* Mobile/Tablet Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <div className="episodes-container">
        {/* Filters Sidebar */}
        <aside
          className={`episodes-sidebar-modern ${sidebarOpen ? 'open' : ''}`}
          aria-label="Filters"
        >
          {/* Search with Scope Dropdown */}
          <div className="sidebar-section">
            <div className="search-container-scoped">
              <select 
                className="search-scope-select"
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value)}
                title="Search scope"
              >
                <option value="episodes">📺 Episodes</option>
                <option value="scenes">🎬 Scenes</option>
                <option value="wardrobe">👔 Wardrobe</option>
                <option value="assets">🎨 Assets</option>
                <option value="scripts">📝 Scripts</option>
              </select>
              <div className="search-box">
                <HiSearch size={18} />
                <input
                  type="text"
                  placeholder={`Search ${searchScope}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {searchScope !== 'episodes' && searchQuery && (
              <div className="search-scope-notice">
                <span>🔍 Searching across {searchScope}</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="sidebar-section">
            <h3>Filters</h3>

            <div className="filter-group">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value);
                }}
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Show</label>
              <select
                value={showFilter}
                onChange={(e) => {
                  setPage(1);
                  setShowFilter(e.target.value);
                }}
              >
                <option value="all">All Shows</option>
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.icon || '📺'} {show.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setPage(1);
                  setSortBy(e.target.value);
                }}
              >
                <option value="title">Title</option>
                <option value="episode_number">Episode #</option>
                <option value="created_at">Date Created</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Order</label>
              <button
                className="btn-sort"
                onClick={() => {
                  setPage(1);
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                }}
                type="button"
              >
                {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
              </button>
            </div>

            <button
              className="btn-reset"
              onClick={() => {
                setPage(1);
                setStatusFilter('all');
                setShowFilter('all');
                setSortBy('title');
                setSortOrder('asc');
                setSearchQuery('');
              }}
              type="button"
            >
              Reset Filters
            </button>

            <button
              className="btn-save-filter"
              onClick={handleSaveFilter}
              type="button"
              title="Save current filter"
            >
              💾 Save Filter
            </button>
          </div>

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="sidebar-section">
              <h3>Saved Filters</h3>
              <div className="saved-filters-list">
                {savedFilters.map(filter => (
                  <div key={filter.id} className="saved-filter-item">
                    <button
                      className="saved-filter-btn"
                      onClick={() => handleApplyFilter(filter)}
                      type="button"
                    >
                      <span>🔖 {filter.name}</span>
                    </button>
                    <button
                      className="saved-filter-delete"
                      onClick={() => handleDeleteFilter(filter.id)}
                      title="Delete filter"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group by Show Toggle */}
          <div className="sidebar-section">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={groupByShow}
                onChange={(e) => setGroupByShow(e.target.checked)}
              />
              <span>Group by Show</span>
            </label>
          </div>

          {/* Stats */}
          <div className="sidebar-section episode-stats-card">
            <h3 className="episode-stats-title">📊 Episode Stats</h3>

            <div className="episode-stats-stack">
              <div className="episode-stats-total">
                <div className="episode-stats-total-value">
                  {episodes?.data?.length || 0}
                </div>
                <div className="episode-stats-total-label">Total Episodes</div>
              </div>

              <div className="episode-stats-grid">
                <div className="episode-stat draft">
                  <div className="value">
                    {episodes?.data?.filter((ep) => ep.status === 'draft')
                      .length || 0}
                  </div>
                  <div className="label">Draft</div>
                </div>

                <div className="episode-stat published">
                  <div className="value">
                    {episodes?.data?.filter((ep) => ep.status === 'published')
                      .length || 0}
                  </div>
                  <div className="label">Published</div>
                </div>

                <div className="episode-stat progress">
                  <div className="value">
                    {episodes?.data?.filter((ep) =>
                      (ep.status || '').toLowerCase().includes('progress')
                    ).length || 0}
                  </div>
                  <div className="label">In Progress</div>
                </div>

                <div className="episode-stat selected">
                  <div className="value">{getSelectionCount()}</div>
                  <div className="label">Selected</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="episodes-content-modern">
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

          {loading ? (
            <LoadingSpinner />
          ) : filteredEpisodes?.data && filteredEpisodes.data.length > 0 ? (
            <>
              {/* Selection Bar with Bulk Actions */}
              {getSelectionCount() > 0 && (
                <div className="selection-bar">
                  <span className="selection-count">
                    {getSelectionCount()} selected
                  </span>
                  <div className="selection-actions">
                    <div className="bulk-actions-dropdown">
                      <button
                        className="btn-bulk-actions"
                        onClick={() => setShowBulkActions(!showBulkActions)}
                        type="button"
                      >
                        Actions ▼
                      </button>
                      {showBulkActions && (
                        <div className="bulk-actions-menu">
                          <button onClick={handleBulkPublish} type="button">
                            ✓ Publish Selected
                          </button>
                          <button onClick={() => {
                            const showId = prompt('Enter Show ID:');
                            if (showId) handleBulkMoveToShow(showId);
                          }} type="button">
                            → Move to Show
                          </button>
                          <button onClick={handleBulkDelete} className="danger" type="button">
                            🗑 Delete Selected
                          </button>
                        </div>
                      )}
                    </div>
                    <button onClick={deselectAll} className="btn-clear" type="button">
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Episodes Grid/List with Grouping */}
              {groupByShow && filteredEpisodes.grouped ? (
                // Grouped by show
                <div className="episodes-grouped">
                  {Object.entries(filteredEpisodes.grouped).map(([showId, eps]) => {
                    const show = shows.find(s => s.id.toString() === showId);
                    return (
                      <div key={showId} className="episode-group">
                        <h3 className="group-header">
                          {show ? `${show.icon || '📺'} ${show.name}` : '📺 Unassigned'}
                          <span className="group-count">({eps.length})</span>
                        </h3>
                        <div className={`episodes-${viewMode}`}>
                          {eps.map((episode) => (
                            <EpisodeCard
                              key={episode.id}
                              episode={episode}
                              onView={handleView}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              isSelected={isSelected(episode.id)}
                              onSelect={() => toggleEpisode(episode.id)}
                              viewMode={viewMode}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Normal flat list
                <div className={`episodes-${viewMode}`}>
                  {filteredEpisodes.data.map((episode) => (
                    <EpisodeCard
                      key={episode.id}
                      episode={episode}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isSelected={isSelected(episode.id)}
                      onSelect={() => toggleEpisode(episode.id)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}

              {/* Load More Button (Phase 1 Pagination) */}
              {hasMore && filteredEpisodes.data.length >= limit && (
                <div className="load-more-container">
                  <button
                    className="btn-load-more"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    type="button"
                  >
                    {loadingMore ? 'Loading...' : '↓ Load More Episodes'}
                  </button>
                  <p className="load-more-hint">
                    Showing {filteredEpisodes.data.length} episodes
                  </p>
                </div>
              )}

              {/* Traditional Pagination (fallback, hidden when load more active) */}
              {!hasMore && totalPages > 1 && (
                <div className="pagination-modern">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="pagination-btn"
                    type="button"
                  >
                    ← Prev
                  </button>

                  <span className="pagination-info">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="pagination-btn"
                    type="button"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state-modern">
              <div className="empty-icon">📺</div>
              <h2>No Episodes Yet</h2>
              <p>Create your first episode to get started</p>
              <button
                className="btn-create-large"
                onClick={() => navigate('/episodes/create')}
                type="button"
              >
                <HiPlus size={24} />
                Create Episode
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Episodes;

