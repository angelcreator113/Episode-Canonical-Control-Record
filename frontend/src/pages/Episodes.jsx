/**
 * Episodes List Page
 * Display and manage episodes
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import episodeService from '../services/episodeService';
import EpisodeCard from '../components/EpisodeCard';
import CategoryFilter from '../components/CategoryFilter';
import BatchCategoryModal from '../components/BatchCategoryModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { PAGINATION } from '../utils/constants';
import '../styles/Episodes.css';

const Episodes = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGINATION.DEFAULT_LIMIT);
  const [error, setError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [localEpisodes, setLocalEpisodes] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  const [batchAction, setBatchAction] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchCategoryModal, setShowBatchCategoryModal] = useState(false);

  // Fetch episodes data
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

  // Sync remote episodes with local state
  useEffect(() => {
    if (episodes?.data) {
      setLocalEpisodes(episodes);
    }
  }, [episodes]);

  // Filter episodes by categories on the client side
  const filteredEpisodes = React.useMemo(() => {
    const episodesToFilter = localEpisodes || episodes;
    if (!episodesToFilter?.data || categoryFilter.length === 0) {
      return episodesToFilter;
    }

    const filtered = episodesToFilter.data.filter((episode) => {
      if (!episode.categories || !Array.isArray(episode.categories)) {
        return false;
      }
      return categoryFilter.some((cat) => episode.categories.includes(cat));
    });

    return {
      ...episodesToFilter,
      data: filtered,
      total: filtered.length,
    };
  }, [localEpisodes, episodes, categoryFilter]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (fetchError) {
      setError(fetchError);
    }
  }, [fetchError]);

  const handleDelete = async (episodeId) => {
    if (!window.confirm('Are you sure you want to delete this episode?')) {
      return;
    }

    try {
      setDeleteError(null);
      console.log('🗑️  Deleting episode:', episodeId);
      
      // Remove from local state immediately (optimistic update)
      if (localEpisodes?.data) {
        setLocalEpisodes({
          ...localEpisodes,
          data: localEpisodes.data.filter(ep => ep.id !== episodeId),
          total: localEpisodes.total - 1,
        });
      }
      
      // Call the delete API
      await episodeService.deleteEpisode(episodeId);
      console.log('✅ Episode deleted successfully');
      
    } catch (err) {
      console.error('❌ Delete failed:', err);
      setDeleteError(err.message || 'Failed to delete episode');
      // Refetch on error to restore the deleted episode
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleEdit = (episodeId) => {
    if (!episodeId) {
      return;
    }
    navigate(`/episodes/${episodeId}/edit`);
  };

  const handleView = (episodeId) => {
    navigate(`/episodes/${episodeId}`);
  };

  const handleSelectEpisode = (episodeId) => {
    setSelectedEpisodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(episodeId)) {
        newSet.delete(episodeId);
      } else {
        newSet.add(episodeId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedEpisodes.size === episodes?.data?.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(episodes?.data?.map((ep) => ep.id)));
    }
  };

  const handleBatchAction = async () => {
    if (!batchAction || selectedEpisodes.size === 0) {
      setDeleteError('Please select an action and episodes');
      return;
    }

    if (!window.confirm(`Are you sure you want to ${batchAction} ${selectedEpisodes.size} episode(s)?`)) {
      return;
    }

    try {
      setBatchLoading(true);
      setDeleteError(null);

      // Perform batch action
      const episodeIds = Array.from(selectedEpisodes);
      
      if (batchAction === 'delete') {
        for (const id of episodeIds) {
          await episodeService.deleteEpisode(id);
        }
        setSelectedEpisodes(new Set());
        setBatchAction('');
        setRefreshTrigger((prev) => prev + 1);
      } else if (batchAction === 'publish') {
        // For demo, just update status in list
        setSelectedEpisodes(new Set());
        setBatchAction('');
      } else if (batchAction === 'archive') {
        // For demo, just update status in list
        setSelectedEpisodes(new Set());
        setBatchAction('');
      } else if (batchAction === 'categories') {
        // Open category modal
        setShowBatchCategoryModal(true);
        return;
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to perform batch action');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchCategoryApply = async ({ action, categories }) => {
    try {
      setBatchLoading(true);
      setDeleteError(null);

      const episodeIds = Array.from(selectedEpisodes);

      // For client-side demo, we'll just clear the selection
      // In a real app, this would call the backend
      for (const id of episodeIds) {
        // Backend call would be:
        // await episodeService.updateEpisodeCategories(id, { action, categories });
      }

      // Clear selection and reset
      setSelectedEpisodes(new Set());
      setBatchAction('');
      setShowBatchCategoryModal(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setDeleteError(err.message || 'Failed to apply category changes');
      throw err;
    } finally {
      setBatchLoading(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="episodes-page">
      <div className="episodes-container">
        <div className="episodes-header">
          <h1>Episodes</h1>
          <button
            onClick={() => navigate('/episodes/create')}
            className="btn btn-primary"
          >
            ➕ Create Episode
          </button>
        </div>

        {/* Filters & Sorting */}
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="statusFilter">Filter by Status:</label>
            <select 
              id="statusFilter"
              value={statusFilter} 
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="all">All Episodes</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="filter-group">
            <CategoryFilter
              episodes={episodes?.data || []}
              selectedCategories={categoryFilter}
              onCategoryChange={(categories) => {
                setCategoryFilter(categories);
                setPage(1);
              }}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="sortBy">Sort by:</label>
            <select 
              id="sortBy"
              value={sortBy} 
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="title">Title</option>
              <option value="episode_number">Episode Number</option>
              <option value="air_date">Air Date</option>
              <option value="created_at">Created Date</option>
            </select>
          </div>

          <div className="filter-group">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn btn-secondary"
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>

          <div className="filter-group">
            <button
              onClick={() => {
                setStatusFilter('all');
                setSortBy('title');
                setSortOrder('asc');
                setPage(1);
              }}
              className="btn btn-outline"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {(error || deleteError) && (
          <ErrorMessage
            message={error || deleteError}
            onDismiss={() => {
              setError(null);
              setDeleteError(null);
            }}
          />
        )}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {episodes?.data && episodes.data.length > 0 ? (
              <>
                {selectedEpisodes.size > 0 && (
                  <div className="batch-actions">
                    <div className="batch-info">
                      <input
                        type="checkbox"
                        checked={selectedEpisodes.size === episodes.data.length}
                        onChange={handleSelectAll}
                        aria-label="Select all episodes"
                      />
                      <span>{selectedEpisodes.size} episode(s) selected</span>
                    </div>
                    <div className="batch-controls">
                      <select
                        value={batchAction}
                        onChange={(e) => setBatchAction(e.target.value)}
                        className="batch-select"
                      >
                        <option value="">Choose action...</option>
                        <option value="publish">Publish</option>
                        <option value="archive">Archive</option>
                        <option value="categories">Manage Categories</option>
                        <option value="delete">Delete</option>
                      </select>
                      <button
                        onClick={handleBatchAction}
                        disabled={!batchAction || batchLoading}
                        className="btn btn-primary"
                      >
                        {batchLoading ? 'Processing...' : 'Apply Action'}
                      </button>
                      <button
                        onClick={() => setSelectedEpisodes(new Set())}
                        className="btn btn-secondary"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                )}

                <div className="episodes-grid">
                  {filteredEpisodes?.data?.map((episode, idx) => {
                    return (
                      <EpisodeCard
                        key={episode.id || `episode-${idx}`}
                        episode={episode}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isSelected={selectedEpisodes.has(episode.id)}
                        onSelect={handleSelectEpisode}
                      />
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="pagination-section">
                  <div className="pagination-controls">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="btn btn-secondary"
                    >
                      &#8592; Previous
                    </button>

                    <span className="page-info">
                      Page {page} of {filteredEpisodes?.pagination?.pages || filteredEpisodes?.totalPages || 1}
                    </span>

                    <button
                      disabled={page >= (filteredEpisodes?.pagination?.pages || filteredEpisodes?.totalPages || 1)}
                      onClick={() => setPage(page + 1)}
                      className="btn btn-secondary"
                    >
                      Next &#8594;
                    </button>
                  </div>

                  <div className="pagination-options">
                    <div className="pagination-item">
                      <label htmlFor="limit">Items per page:</label>
                      <select
                        id="limit"
                        value={limit}
                        onChange={(e) => {
                          setLimit(parseInt(e.target.value));
                          setPage(1);
                        }}
                        className="pagination-select"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="pagination-item">
                      <label htmlFor="jumpPage">Go to page:</label>
                      <input
                        id="jumpPage"
                        type="number"
                        min="1"
                        max={filteredEpisodes?.pagination?.pages || filteredEpisodes?.totalPages || 1}
                        defaultValue={page}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const pageNum = parseInt(e.target.value);
                            const maxPage = filteredEpisodes?.pagination?.pages || filteredEpisodes?.totalPages || 1;
                            if (pageNum >= 1 && pageNum <= maxPage) {
                              setPage(pageNum);
                            }
                          }
                        }}
                        className="pagination-input"
                        placeholder="Page #"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>📺 No episodes found</p>
                <button
                  onClick={() => navigate('/episodes/create')}
                  className="btn btn-primary"
                >
                  Create your first episode
                </button>
              </div>
            )}
          </>
        )}

        {/* Batch Category Modal */}
        <BatchCategoryModal
          isOpen={showBatchCategoryModal}
          selectedCount={selectedEpisodes.size}
          availableCategories={
            filteredEpisodes?.data
              ?.flatMap((ep) => ep.categories || [])
              .filter((cat, idx, arr) => arr.indexOf(cat) === idx)
              .sort() || []
          }
          onClose={() => setShowBatchCategoryModal(false)}
          onApply={handleBatchCategoryApply}
          isLoading={batchLoading}
        />
      </div>
    </div>
  );
};

export default Episodes;
