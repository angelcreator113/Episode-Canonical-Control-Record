import { useState, useEffect } from 'react';
import { episodeAPI } from '../services/api';

export const useSearch = (query, page = 1, limit = 20) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const performSearch = async (searchQuery, searchPage = 1) => {
    if (!searchQuery || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Simple client-side search on episodes endpoint
      // In production, use /api/v1/search endpoint
      const response = await episodeAPI.getAll({
        page: searchPage,
        limit: limit,
      });

      // Filter results based on query
      const searchQuery_lower = searchQuery.toLowerCase();
      const filtered = response.data.data.filter(episode => {
        // Handle both new field names (title) and old field names (episodeTitle)
        const title = (episode.title || episode.episodeTitle || '').toLowerCase();
        const description = (episode.description || episode.plotSummary || '').toLowerCase();
        const showName = (episode.showName || '').toLowerCase();
        
        return (
          title.includes(searchQuery_lower) ||
          description.includes(searchQuery_lower) ||
          showName.includes(searchQuery_lower)
        );
      });

      setResults(filtered);
      setPagination({
        page: searchPage,
        limit: limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / limit),
      });
    } catch (err) {
      setError(err.message || 'Search failed');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch(query, page);
  }, [query, page]);

  const goToPage = (newPage) => {
    performSearch(query, newPage);
  };

  return {
    results,
    loading,
    error,
    pagination,
    goToPage,
    performSearch,
  };
};
