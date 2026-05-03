import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import './SearchHistory.css';

// Track 4 module-scope helpers (Pattern D).
export const fetchSearchHistory = (limit = 10) =>
  apiClient.get(`/api/v1/search/history?limit=${limit}`);
export const clearSearchHistory = () =>
  apiClient.delete('/api/v1/search/history');

export default function SearchHistory({ onQueryClick }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await fetchSearchHistory(10);
      setHistory(response.data?.data || []);
    } catch (err) {
      // 401s flow through the apiClient interceptor; only log unexpected errors.
      console.warn('Failed to load search history:', err.response?.status || err.message);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Clear all search history?')) return;

    try {
      await clearSearchHistory();
      setHistory([]);
      alert('Search history cleared');
    } catch (err) {
      alert('Failed to clear history: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) return <div className="search-history-loading">Loading history...</div>;
  if (history.length === 0) return null;

  const displayHistory = showAll ? history : history.slice(0, 5);

  return (
    <div className="search-history">
      <div className="search-history-header">
        <h3>Recent Searches</h3>
        <button onClick={clearHistory} className="clear-history-btn">
          Clear All
        </button>
      </div>

      <div className="search-history-list">
        {displayHistory.map((item, idx) => (
          <button
            key={`${item.query}-${idx}`}
            className="history-item"
            onClick={() => onQueryClick(item.query)}
            title={`Searched ${item.search_count} time(s), ${item.result_count} results`}
          >
            <span className="history-query">{item.query}</span>
            <div className="history-meta">
              <span className="search-type">{item.search_type}</span>
              {item.search_count > 1 && (
                <span className="search-count">×{item.search_count}</span>
              )}
              <span className="result-count">{item.result_count} results</span>
            </div>
          </button>
        ))}
      </div>

      {history.length > 5 && (
        <button
          className="show-more-btn"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show Less' : `Show ${history.length - 5} More`}
        </button>
      )}
    </div>
  );
}
