import React, { useState, useEffect } from 'react';
import './SearchHistory.css';

export default function SearchHistory({ onQueryClick }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Don't attempt to load if no token
      if (!token) {
        console.log('No auth token available, skipping history load');
        setHistory([]);
        setLoading(false);
        return;
      }

      const response = await fetch(
        'http://localhost:3002/api/v1/search/history?limit=10',
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHistory(data.data || []);
      } else if (response.status === 401) {
        console.log('Unauthorized - token may be expired');
        setHistory([]);
      } else {
        console.warn('Failed to load search history:', response.status);
        setHistory([]);
      }
    } catch (err) {
      console.warn('Failed to load search history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Clear all search history?')) return;

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Please log in to clear history');
        return;
      }

      const response = await fetch(
        'http://localhost:3002/api/v1/search/history',
        {
          method: 'DELETE',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        setHistory([]);
        alert('Search history cleared');
      } else if (response.status === 401) {
        alert('Session expired. Please log in again.');
      } else {
        alert('Failed to clear history');
      }
    } catch (err) {
      alert('Failed to clear history: ' + err.message);
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
