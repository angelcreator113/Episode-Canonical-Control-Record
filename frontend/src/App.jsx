import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import authService from './services/authService';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Episodes from './pages/Episodes';
import EpisodeDetail from './pages/EpisodeDetail';
import CreateEpisode from './pages/CreateEpisode';
import EditEpisode from './pages/EditEpisode';
import SearchResults from './pages/SearchResults';
import AssetManager from './pages/AssetManager';
// import CompositionManagement from './pages/CompositionManagement'; // Not needed for episode creation
import ThumbnailComposer from './pages/ThumbnailComposer';
import ThumbnailGallery from './pages/ThumbnailGallery';
import AdminPanel from './pages/AdminPanel';
import TemplateManagement from './pages/TemplateManagement';
import AuditLogViewer from './pages/AuditLogViewer';

// Components
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastContainer';
// import AssetLibraryTest from './components/AssetLibraryTest'; // Removed - using AssetLibrary

import './App.css';

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Main App Component
 * Handles routing and layout
 */
function App() {
  const { isAuthenticated, loading } = useAuth();

  // Always render Router at top level to prevent re-mounting
  // This prevents flickering between login and app screens
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {loading ? (
            // Show loading state while checking authentication
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100vh',
              fontSize: '18px',
              backgroundColor: '#f5f5f5'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p>Loading...</p>
              </div>
            </div>
          ) : !isAuthenticated ? (
            // Show login page if not authenticated
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          ) : (
            // Show main app with header, navigation, and content
            <div className="app-layout">
              <Header />
              
              <main className="app-content">
                <Routes>
                  {/* Core Pages */}
                  <Route path="/" element={<Home />} />
                  <Route path="/episodes" element={<Episodes />} />
                  <Route path="/episodes/create" element={<CreateEpisode />} />
                  <Route path="/episodes/:episodeId/edit" element={<EditEpisode />} />
                  <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
                  <Route path="/assets" element={<AssetManager />} />

                  {/* Additional Pages */}
                  <Route path="/search" element={<SearchResults />} />
                  {/* <Route path="/compositions/:compositionId" element={<CompositionManagement />} /> */}
                  <Route path="/composer/:episodeId" element={<ThumbnailComposer />} />
                  <Route path="/thumbnails/:episodeId" element={<ThumbnailGallery />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/admin/templates" element={<TemplateManagement />} />
                  <Route path="/audit-log" element={<AuditLogViewer />} />
                  
                  {/* Test Routes */}
                  {/* <Route path="/test/assets" element={<AssetLibraryTest />} /> */}

                  {/* Fallback */}
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>

              <footer className="app-footer">
                <p>&copy; 2026 Episode Control System. Built with React + Vite</p>
              </footer>
            </div>
          )}
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
