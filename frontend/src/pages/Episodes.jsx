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
  const [sidebarOpen, setSidebarOpen] = useState(false); // closed by default on mobile/tablet
  const [searchQuery, setSearchQuery] = useState('');

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
        const response = await fetch(import.meta.env.VITE_API_URL || '/api/v1/shows', {
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

  // Filter episodes by search
  const filteredEpisodes = React.useMemo(() => {
    if (!episodes?.data) return episodes;
    if (!searchQuery) return episodes;

    const q = searchQuery.toLowerCase();
    const filtered = episodes.data.filter(
      (ep) =>
        ep.title?.toLowerCase().includes(q) ||
        ep.description?.toLowerCase().includes(q)
    );

    return { ...episodes, data: filtered, total: filtered.length };
  }, [episodes, searchQuery]);

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
          {/* Search */}
          <div className="sidebar-section">
            <div className="search-box">
              <HiSearch size={20} />
              <input
                type="text"
                placeholder="Search episodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
              {/* Selection Bar */}
              {getSelectionCount() > 0 && (
                <div className="selection-bar">
                  <span>{getSelectionCount()} selected</span>
                  <button onClick={deselectAll} type="button">
                    Clear
                  </button>
                </div>
              )}

              {/* Episodes Grid/List */}
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

              {/* Pagination */}
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

