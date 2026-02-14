import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';

export const SearchBar = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setQuery(''); // Clear input after search
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search episodes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
          aria-label="Search episodes"
        />
        <button type="submit" className="search-button" title="Search">
          🔍
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
