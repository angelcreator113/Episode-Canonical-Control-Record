import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CompositionCard from '../components/CompositionCard';
import './CompositionLibrary.css';

/**
 * CompositionLibrary Component
 * Browse and manage all thumbnail compositions with filters and search
 */
export default function CompositionLibrary() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [compositions, setCompositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedShow, setSelectedShow] = useState(searchParams.get('show') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'created_desc');
  
  // Filter options
  const [shows, setShows] = useState([]);
  
  useEffect(() => {
    loadShows();
    loadCompositions();
  }, []);

  useEffect(() => {
    // Update URL params when filters change
    const params = {};
    if (searchQuery) params.search = searchQuery;
    if (selectedShow) params.show = selectedShow;
    if (selectedStatus) params.status = selectedStatus;
    if (sortBy !== 'created_desc') params.sort = sortBy;
    
    setSearchParams(params);
    loadCompositions();
  }, [searchQuery, selectedShow, selectedStatus, sortBy]);

  const loadShows = async () => {
    try {
      const response = await fetch('/api/v1/shows');
      const data = await response.json();
      setShows(data.data || data || []);
    } catch (err) {
      console.error('Failed to load shows:', err);
    }
  };

  const loadCompositions = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/v1/compositions';
      const params = new URLSearchParams();
      
      if (selectedShow) {
        // Filter by show's episodes
        url = `/api/v1/compositions?showId=${selectedShow}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load compositions');
      
      const data = await response.json();
      let compositionsList = data.data || data || [];

      // Apply client-side filters
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        compositionsList = compositionsList.filter(comp => 
          (comp.name && comp.name.toLowerCase().includes(query)) ||
          (comp.episode?.episodeTitle && comp.episode.episodeTitle.toLowerCase().includes(query)) ||
          (comp.episode?.title && comp.episode.title.toLowerCase().includes(query))
        );
      }

      if (selectedStatus) {
        compositionsList = compositionsList.filter(comp => 
          (comp.status || 'DRAFT').toUpperCase() === selectedStatus.toUpperCase()
        );
      }

      // Apply sorting
      compositionsList.sort((a, b) => {
        switch (sortBy) {
          case 'created_desc':
            return new Date(b.created_at) - new Date(a.created_at);
          case 'created_asc':
            return new Date(a.created_at) - new Date(b.created_at);
          case 'name_asc':
            return (a.name || '').localeCompare(b.name || '');
          case 'name_desc':
            return (b.name || '').localeCompare(a.name || '');
          default:
            return 0;
        }
      });

      setCompositions(compositionsList);
    } catch (err) {
      console.error('Failed to load compositions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (composition) => {
    if (!window.confirm(`Delete composition "${composition.name || 'Untitled'}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/compositions/${composition.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete composition');
      
      setCompositions(prev => prev.filter(c => c.id !== composition.id));
    } catch (err) {
      console.error('Failed to delete composition:', err);
      alert('Failed to delete composition: ' + err.message);
    }
  };

  const handleGenerate = async (composition) => {
    try {
      const formats = composition.selected_formats || ['YOUTUBE'];
      
      const response = await fetch(`/api/v1/compositions/${composition.id}/outputs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formats, regenerate: true }),
      });

      if (!response.ok) throw new Error('Failed to queue generation');
      
      alert(`Queued ${formats.length} format(s) for generation`);
      loadCompositions(); // Refresh to show PROCESSING status
    } catch (err) {
      console.error('Failed to generate:', err);
      alert('Failed to queue generation: ' + err.message);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedShow('');
    setSelectedStatus('');
    setSortBy('created_desc');
  };

  if (loading) {
    return (
      <div className="composition-library">
        <div className="composition-library__loading">
          <div className="composition-library__loading-spinner"></div>
          <p>Loading compositions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="composition-library">
      {/* Header */}
      <div className="composition-library__header">
        <div className="composition-library__title-section">
          <h1 className="composition-library__title">
            <span className="composition-library__title-icon">📚</span>
            Composition Library
          </h1>
          <p className="composition-library__subtitle">
            Browse and manage thumbnail compositions
          </p>
        </div>
        
        <div className="composition-library__header-actions">
          <a href="/composer/default" className="composition-library__create-btn">
            <span>➕</span> New Composition
          </a>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="composition-library__filters">
        <div className="composition-library__filter-group">
          <input
            type="text"
            placeholder="Search compositions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="composition-library__search-input"
          />
        </div>

        <div className="composition-library__filter-group">
          <select
            value={selectedShow}
            onChange={(e) => setSelectedShow(e.target.value)}
            className="composition-library__select"
          >
            <option value="">All Shows</option>
            {shows.map(show => (
              <option key={show.id} value={show.id}>{show.name}</option>
            ))}
          </select>
        </div>

        <div className="composition-library__filter-group">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="composition-library__select"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="APPROVED">Approved</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div className="composition-library__filter-group">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="composition-library__select"
          >
            <option value="created_desc">Newest First</option>
            <option value="created_asc">Oldest First</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
          </select>
        </div>

        {(searchQuery || selectedShow || selectedStatus) && (
          <button
            onClick={clearFilters}
            className="composition-library__clear-btn"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results Count */}
      <div className="composition-library__results-info">
        <p className="composition-library__results-count">
          {compositions.length} {compositions.length === 1 ? 'composition' : 'compositions'} found
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="composition-library__error">
          <p>❌ {error}</p>
          <button onClick={loadCompositions}>Retry</button>
        </div>
      )}

      {/* Empty State */}
      {!error && compositions.length === 0 && (
        <div className="composition-library__empty">
          <div className="composition-library__empty-icon">🎨</div>
          <h3 className="composition-library__empty-title">No Compositions Found</h3>
          <p className="composition-library__empty-text">
            {searchQuery || selectedShow || selectedStatus
              ? 'Try adjusting your filters'
              : 'Create your first composition to get started'}
          </p>
          <a href="/composer/default" className="composition-library__empty-btn">
            Create Composition
          </a>
        </div>
      )}

      {/* Compositions Grid */}
      {!error && compositions.length > 0 && (
        <div className="composition-library__grid">
          {compositions.map(composition => (
            <CompositionCard
              key={composition.id}
              composition={composition}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
