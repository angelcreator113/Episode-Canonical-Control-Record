import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EpisodesList from './components/Episodes/EpisodesList';
import EpisodeDetail from './pages/EpisodeDetail';
import SearchResults from './pages/SearchResults';
import SearchBar from './components/Search/SearchBar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1>📺 Episode Canonical Control</h1>
            <p>Phase 2 Integration</p>
          </div>
          <SearchBar />
        </header>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<EpisodesList />} />
            <Route path="/episodes/:id" element={<EpisodeDetail />} />
            <Route path="/search" element={<SearchResults />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>&copy; 2026 Episode Management System. API v1.0 | Frontend v0.3.0</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
