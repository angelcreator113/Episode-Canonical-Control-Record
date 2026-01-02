import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EpisodesList from './components/Episodes/EpisodesList';
import EpisodeDetail from './pages/EpisodeDetail';
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
        </header>
        
        <main className="app-main">
          <Routes>
            <Route path="/" element={<EpisodesList />} />
            <Route path="/episodes/:id" element={<EpisodeDetail />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>&copy; 2026 Episode Management System. API v1.0 | Frontend v0.2.0</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
