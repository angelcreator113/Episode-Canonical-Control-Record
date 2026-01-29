import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import authService from './services/authService';

// Contexts
import { BulkSelectionProvider } from './contexts/BulkSelectionContext';
import { SearchFiltersProvider } from './contexts/SearchFiltersContext';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Episodes from './pages/Episodes';
import EpisodeDetail from './pages/EpisodeDetail';
import CreateEpisode from './pages/CreateEpisode';
import EditEpisode from './pages/EditEpisode';
import SearchResults from './pages/SearchResults';
import AssetGallery from './pages/AssetGallery';
import AssetManager from './pages/AssetManager';
// import CompositionManagement from './pages/CompositionManagement'; // Not needed for episode creation
import ThumbnailComposer from './pages/ThumbnailComposer';
import ThumbnailGallery from './pages/ThumbnailGallery';
import CompositionLibrary from './pages/CompositionLibrary';
import CompositionDetail from './pages/CompositionDetail';
import SceneComposer from './pages/Scenes/SceneComposer';
import ScenesList from './pages/Scenes/ScenesList';
import SceneLibrary from './pages/SceneLibrary';
import SceneDetail from './pages/SceneDetail';
import TimelineEditor from './pages/TimelineEditor';
import AdminPanel from './pages/AdminPanel';
import TemplateManagement from './pages/TemplateManagement';
import AuditLogViewer from './pages/AuditLogViewer';
import AuditLog from './pages/AuditLog';
import ShowManagement from './pages/ShowManagement';
import ShowForm from './components/ShowForm';
import Wardrobe from './pages/Wardrobe';
import WardrobeBrowser from './pages/WardrobeBrowser';
import WardrobeAnalytics from './pages/WardrobeAnalytics';
import OutfitSets from './pages/OutfitSets';
import WardrobeLibraryUpload from './pages/WardrobeLibraryUpload';
import WardrobeLibraryDetail from './pages/WardrobeLibraryDetail';
import TemplateStudio from './pages/TemplateStudio';
import TemplateDesigner from './pages/TemplateDesigner';

// Components
import Navigation from './components/Navigation';
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
 * AppContent Component (inside Router)
 * Handles routing and layout
 */
function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [navOpen, setNavOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isNavigatingRef = React.useRef(false);

  // Debug logging - disabled to reduce console noise
  // React.useEffect(() => {
  //   console.log('[AppContent] Auth state changed:', { isAuthenticated, loading, pathname: location.pathname });
  // }, [isAuthenticated, loading, location.pathname]);

  // Redirect to home when logged in from login page (but allow direct navigation to other authenticated pages)
  React.useEffect(() => {
    if (!loading && isAuthenticated && location.pathname === '/login' && !isNavigatingRef.current) {
      console.log('[AppContent] User authenticated on login page, redirecting to home...');
      isNavigatingRef.current = true;
      navigate('/', { replace: true });
      setTimeout(() => { isNavigatingRef.current = false; }, 100);
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);

  // Only redirect to login if not authenticated AND not currently loading auth state
  // This preserves deep links on page refresh
  React.useEffect(() => {
    if (!loading && !isAuthenticated && location.pathname !== '/login' && !isNavigatingRef.current) {
      console.log('[AppContent] User not authenticated, redirecting to login...');
      isNavigatingRef.current = true;
      navigate('/login', { replace: true });
      setTimeout(() => { isNavigatingRef.current = false; }, 100);
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);

  // Close nav when window resizes to desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setNavOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
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
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Navigation isOpen={navOpen} onClose={() => setNavOpen(false)} />
      
      <Header onMenuClick={() => setNavOpen(!navOpen)} />
      
      <main className="app-content">
        <Routes>
          {/* Core Pages */}
          <Route path="/" element={<Home />} />
          <Route path="/episodes" element={<Episodes />} />
          <Route path="/episodes/create" element={<CreateEpisode />} />
          <Route path="/episodes/:episodeId/edit" element={<EditEpisode />} />
          <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
          <Route path="/episodes/:episodeId/timeline" element={<TimelineEditor />} />
          <Route path="/assets" element={<AssetGallery />} />
          <Route path="/assets/manager" element={<AssetManager />} />

          {/* Additional Pages */}
          <Route path="/search" element={<SearchResults />} />
          {/* <Route path="/compositions/:compositionId" element={<CompositionManagement />} /> */}
          <Route path="/library" element={<CompositionLibrary />} />
          <Route path="/compositions/:id" element={<CompositionDetail />} />
          <Route path="/composer/:episodeId" element={<ThumbnailComposer />} />
          <Route path="/thumbnails/:episodeId" element={<ThumbnailGallery />} />
          <Route path="/scene-library" element={<SceneLibrary />} />
          <Route path="/scene-library/:sceneId" element={<SceneDetail />} />
          <Route path="/episodes/:episodeId/scenes" element={<SceneComposer />} />
          <Route path="/episodes/:episodeId/scenes/list" element={<ScenesList />} />
          <Route path="/shows" element={<ShowManagement />} />
          <Route path="/shows/create" element={<ShowForm />} />
          <Route path="/shows/:id/edit" element={<ShowForm />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/wardrobe-library" element={<WardrobeBrowser mode="library" />} />
          <Route path="/wardrobe-library/upload" element={<WardrobeLibraryUpload />} />
          <Route path="/wardrobe-library/:id" element={<WardrobeLibraryDetail />} />
          <Route path="/template-studio" element={<TemplateStudio />} />
          <Route path="/template-studio/designer" element={<TemplateDesigner />} />
          <Route path="/template-studio/designer/:templateId" element={<TemplateDesigner />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/templates" element={<TemplateManagement />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/audit-log" element={<AuditLogViewer />} />
          
          {/* Test Routes */}
          {/* <Route path="/test/assets" element={<AssetLibraryTest />} /> */}

          {/* If authenticated user tries to access login, redirect to home */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          
          {/* Fallback - redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Episode Control System. Built with React + Vite</p>
      </footer>
    </div>
  );
}

/**
 * Main App Component
 * Wraps everything with providers and router
 */
function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BulkSelectionProvider>
            <SearchFiltersProvider>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppContent />
              </Router>
            </SearchFiltersProvider>
          </BulkSelectionProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
