/**
 * Episodes List Page - MODERN REDESIGN
 * Mobile-first, clean, convenient layout
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiMenu, HiX, HiViewGrid, HiViewList, HiFilter, HiPlus, HiSearch } from 'react-icons/hi';
import { useAuth } from '../contexts/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { useBulkSelection } from '../contexts/BulkSelectionContext';
import { useSearchFilters } from '../contexts/SearchFiltersContext';
import episodeService from '../services/episodeService';
import EpisodeCard from '../components/EpisodeCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { PAGINATION } from '../utils/constants';
import '../styles/Episodes.css';

const Episodes = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { toggleEpisode, selectAll, deselectAll, isSelected, getSelectedIds, getSelectionCount } = useBulkSelection();
  
  // State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGINATION.DEFAULT_LIMIT);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default on mobile
  const [searchQuery, setSearchQuery] = useState('');


  // Fetch episodes
  const fetcher = async () => {
    const filters = {};
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    filters.sort = `${sortBy}:${sortOrder}`;
    return await episodeService.getEpisodes(page, limit, filters);
  };

  const { data: episodes, loading, error: fetchError } = useFetch(
    fetcher,
    [page, limit, refreshTrigger, statusFilter, sortBy, sortOrder]
  );

  // Auth redirect
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    if (sidebarOpen && window.innerWidth <= 1024) {
      const handleClickOutside = (e) => {
        if (!e.target.closest('.episodes-sidebar') && !e.target.closest('.mobile-menu-btn')) {
          setSidebarOpen(false);
        }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [sidebarOpen]);

  // Handlers
  const handleDelete = async (episodeId) => {
    if (!window.confirm('Delete this episode?')) return;
    try {
      await episodeService.deleteEpisode(episodeId);
      setRefreshTrigger(prev => prev + 1);
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

    const filtered = episodes.data.filter(ep =>
      ep.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return { ...episodes, data: filtered, total: filtered.length };
  }, [episodes, searchQuery]);

  if (authLoading) return <LoadingSpinner />;

  return (
    <div className="episodes-page-modern">
      {/* Header */}
      <header className="episodes-header-modern" style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="header-left">
          <h1 style={{ color: '#111827', fontWeight: '700' }}>Episodes</h1>
          <span className="episode-count" style={{ background: '#f3f4f6', color: '#111827', fontWeight: '600' }}>{filteredEpisodes?.total || 0}</span>
        </div>

        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid"
            >
              <HiViewGrid size={20} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List"
            >
              <HiViewList size={20} />
            </button>
          </div>

          <button className="btn-create" onClick={() => navigate('/episodes/create')}>
            <HiPlus size={20} />
            <span>Create</span>
          </button>
        </div>
      </header>

      <div className="episodes-container" style={{ display: 'flex', flexDirection: 'row', flex: 1 }}>
        {/* Filters Sidebar */}
        <aside className="episodes-sidebar-modern" style={{ background: '#ffffff', color: '#111827', width: '280px' }}>
          {/* Search */}
          <div className="sidebar-section">
            <div className="search-box" style={{ background: '#f9fafb', border: '2px solid #e5e7eb' }}>
              <HiSearch size={20} style={{ color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Search episodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ color: '#111827', fontSize: '15px' }}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="sidebar-section">
            <h3 style={{ color: '#111827', fontWeight: '700', fontSize: '14px' }}>Filters</h3>
            
            <div className="filter-group">
              <label style={{ color: '#111827', fontWeight: '600', fontSize: '14px' }}>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ color: '#111827', fontSize: '15px', background: '#ffffff' }}>
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className="filter-group">
              <label style={{ color: '#111827', fontWeight: '600', fontSize: '14px' }}>Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ color: '#111827', fontSize: '15px', background: '#ffffff' }}>
                <option value="title">Title</option>
                <option value="episode_number">Episode #</option>
                <option value="created_at">Date Created</option>
              </select>
            </div>

            <div className="filter-group">
              <label style={{ color: '#111827', fontWeight: '600', fontSize: '14px' }}>Order</label>
              <button
                className="btn-sort"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                style={{ color: '#111827', fontWeight: '500', fontSize: '15px', background: '#ffffff' }}
              >
                {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
              </button>
            </div>

            <button
              className="btn-reset"
              onClick={() => {
                setStatusFilter('all');
                setSortBy('title');
                setSortOrder('asc');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </button>
          </div>

          {/* Stats */}
          <div className="sidebar-section stats" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#ffffff' }}>
            <h3 style={{ color: '#ffffff', fontWeight: '700', fontSize: '14px', marginBottom: '1rem' }}>Stats</h3>
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-value" style={{ color: '#ffffff', fontSize: '2rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>{episodes?.total || 0}</span>
                <span className="stat-label" style={{ color: '#ffffff', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.9, fontWeight: '600' }}>Total</span>
              </div>
              <div className="stat">
                <span className="stat-value" style={{ color: '#ffffff', fontSize: '2rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>
                  {episodes?.data?.filter(ep => ep.status === 'draft').length || 0}
                </span>
                <span className="stat-label" style={{ color: '#ffffff', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.9, fontWeight: '600' }}>Draft</span>
              </div>
              <div className="stat">
                <span className="stat-value" style={{ color: '#ffffff', fontSize: '2rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>
                  {episodes?.data?.filter(ep => ep.status === 'published').length || 0}
                </span>
                <span className="stat-label" style={{ color: '#ffffff', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.9, fontWeight: '600' }}>Published</span>
              </div>
              <div className="stat">
                <span className="stat-value" style={{ color: '#ffffff', fontSize: '2rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>{getSelectionCount()}</span>
                <span className="stat-label" style={{ color: '#ffffff', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.9, fontWeight: '600' }}>Selected</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="episodes-content-modern" style={{ flex: 1, padding: '1.5rem' }}>
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

          {loading ? (
            <LoadingSpinner />
          ) : filteredEpisodes?.data && filteredEpisodes.data.length > 0 ? (
            <>
              {/* Selection Bar */}
              {getSelectionCount() > 0 && (
                <div className="selection-bar">
                  <span>{getSelectionCount()} selected</span>
                  <button onClick={deselectAll}>Clear</button>
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
                  onClick={() => setPage(p => p - 1)}
                  className="pagination-btn"
                >
                  ← Prev
                </button>
                
                <span className="pagination-info">
                  Page {page} of {Math.ceil((filteredEpisodes?.total || 0) / limit) || 1}
                </span>
                
                <button
                  disabled={page >= Math.ceil((filteredEpisodes?.total || 0) / limit)}
                  onClick={() => setPage(p => p + 1)}
                  className="pagination-btn"
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state-modern">
              <div className="empty-icon">📺</div>
              <h2 style={{ color: '#111827', fontWeight: '700' }}>No Episodes Yet</h2>
              <p style={{ color: '#6b7280', fontSize: '16px' }}>Create your first episode to get started</p>
              <button className="btn-create-large" onClick={() => navigate('/episodes/create')} style={{ background: '#3b82f6', color: '#ffffff', fontWeight: '600' }}>
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

