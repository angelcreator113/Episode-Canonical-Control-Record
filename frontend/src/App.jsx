import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import authService from './services/authService';

// Contexts
import { BulkSelectionProvider } from './contexts/BulkSelectionContext';
import { SearchFiltersProvider } from './contexts/SearchFiltersContext';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import EpisodeDetail from './pages/EpisodeDetail';
import CreateEpisode from './pages/CreateEpisode';
import IconCueTimeline from './pages/IconCueTimeline';
import SearchResults from './pages/SearchResults';
import ThumbnailGallery from './pages/ThumbnailGallery';
import CompositionLibrary from './pages/CompositionLibrary';
import CompositionDetail from './pages/CompositionDetail';
import SceneLibrary from './pages/SceneLibrary';
import SceneDetail from './pages/SceneDetail';
import AdminPanel from './pages/AdminPanel';
import TemplateManagement from './pages/TemplateManagement';
import AuditLogViewer from './pages/AuditLogViewer';
import AuditLog from './pages/AuditLog';
import ShowManagement from './pages/ShowManagement';
import ShowDetail from './pages/ShowDetail';
import ShowForm from './components/ShowForm';
import CreateShow from './pages/CreateShow';
import EditShow from './pages/EditShow';
import Wardrobe from './pages/Wardrobe';
import WardrobeBrowser from './pages/WardrobeBrowser';
import WardrobeAnalytics from './pages/WardrobeAnalytics';
import OutfitSets from './pages/OutfitSets';
import WardrobeLibraryUpload from './pages/WardrobeLibraryUpload';
import WardrobeLibraryDetail from './pages/WardrobeLibraryDetail';
import TemplateStudio from './pages/TemplateStudio';
import TemplateDesigner from './pages/TemplateDesigner';
import DiagnosticPage from './pages/DiagnosticPage';
import DecisionAnalyticsDashboard from './pages/DecisionAnalyticsDashboard';
import TimelineEditor from './pages/TimelineEditor';
import EvaluateEpisode from './pages/EvaluateEpisode';
import WorldAdmin from './pages/WorldAdmin';
import ShowSettings from './pages/ShowSettings';
import ExportPage from './pages/ExportPage';
import AssetLibrary from './pages/AssetLibrary';
import StorytellerPage from './pages/StorytellerPage';
import CharacterRegistryPage from './pages/CharacterRegistryPage';
import QuickEpisodeCreator from './components/QuickEpisodeCreator';

// Components
import Sidebar from './components/layout/Sidebar';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastContainer';
import SceneComposerFull from './components/SceneComposer/SceneComposerFull';
import AnimaticPreview from './components/Episodes/SceneComposer/AnimaticPreview';
import OrientationToast from './components/OrientationToast';

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
  const [currentEpisodeId, setCurrentEpisodeId] = React.useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isNavigatingRef = React.useRef(false);

  // Extract episode ID from URL if present (skip non-ID segments like 'create')
  React.useEffect(() => {
    const match = location.pathname.match(/\/episodes\/([^/]+)/);
    if (match && match[1] && match[1] !== 'create') {
      setCurrentEpisodeId(match[1]);
    }
  }, [location.pathname]);

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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

  // Check if current route is Timeline Editor, Scene Composer, or Export (full-screen modes)
  const isTimelineEditor = location.pathname.includes('/timeline');
  const isSceneComposer = location.pathname.includes('/scene-composer');
  const isExportPage = location.pathname.includes('/export');
  const isFullScreen = isTimelineEditor || isSceneComposer || isExportPage;

  return (
    <div className="app-layout">
      {/* Sidebar Navigation (hidden on full-screen modes) */}
      {!isFullScreen && (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      
      <div className={`app-main-wrapper ${isFullScreen ? 'full-screen' : ''}`}>
        {!isFullScreen && (
          <Header
            navOpen={sidebarOpen}
            onNavToggle={() => setSidebarOpen(prev => !prev)}
          />
        )}
        
        <main className="app-content">
          <Routes>
          {/* ===== DASHBOARD ===== */}
          <Route path="/" element={<Home />} />
          
          {/* ===== PRE-PRODUCTION ROUTES ===== */}
          
          {/* Episodes */}

          <Route path="/episodes/create" element={<CreateEpisode />} />
          <Route path="/episodes/:episodeId/edit" element={<QuickEpisodeCreator />} />
          <Route path="/episodes/:id/evaluate" element={<EvaluateEpisode />} />
          <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
          
          {/* Assets */}
          <Route path="/assets" element={<AssetLibrary />} />
          
          {/* Shows */}
          <Route path="/shows" element={<ShowManagement />} />
          <Route path="/shows/create" element={<CreateShow />} />
          <Route path="/shows/:id" element={<ShowDetail />} />
          <Route path="/shows/:id/edit" element={<EditShow />} />
          <Route path="/shows/:id/world" element={<WorldAdmin />} />
          <Route path="/shows/:showId/quick-episode" element={<QuickEpisodeCreator />} />
          <Route path="/shows/:id/settings" element={<ShowSettings />} />
          {/* Scene Composer */}
          <Route path="/episodes/:episodeId/scene-composer" element={<SceneComposerFull />} />
          
          {/* Scene Library */}
          <Route path="/scene-library" element={<SceneLibrary />} />
          <Route path="/scene-library/:sceneId" element={<SceneDetail />} />
          
          {/* ===== ANIMATIC SYSTEM ROUTES ===== */}
          
          {/* Beat Generation (Coming Soon) */}
          <Route path="/episodes/:episodeId/beats" element={
            <div className="page-wrapper">
              <h1>Beat Generation</h1>
              <p>Coming soon - Beat auto-generation interface</p>
            </div>
          } />
          
          {/* Timeline Editor */}
          <Route path="/episodes/:episodeId/timeline" element={<TimelineEditor />} />
          <Route path="/episodes/:episodeId/icon-cues" element={<IconCueTimeline />} />
          
          {/* Animatic Preview */}
          <Route path="/episodes/:episodeId/animatic-preview" element={<AnimaticPreview />} />
          
          {/* ===== PRODUCTION ROUTES ===== */}
          
          {/* Wardrobe */}
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/wardrobe/analytics" element={<WardrobeAnalytics />} />
          <Route path="/wardrobe/outfits" element={<OutfitSets />} />
          <Route path="/wardrobe-library" element={<WardrobeBrowser mode="library" />} />
          <Route path="/wardrobe-library/upload" element={<WardrobeLibraryUpload />} />
          <Route path="/wardrobe-library/:id" element={<WardrobeLibraryDetail />} />
          
          {/* Thumbnail Composer / Template Studio */}
          <Route path="/episodes/:episodeId/composer" element={<TemplateStudio />} />
          <Route path="/template-studio" element={<TemplateStudio />} />
          <Route path="/template-studio/designer" element={<TemplateDesigner />} />
          <Route path="/template-studio/designer/:templateId" element={<TemplateDesigner />} />
          
          {/* Compositions */}
          <Route path="/library" element={<CompositionLibrary />} />
          <Route path="/compositions/:id" element={<CompositionDetail />} />
          
          {/* Templates */}
          <Route path="/admin/templates" element={<TemplateManagement />} />
          
          {/* ===== POST-PRODUCTION ROUTES ===== */}
          
          {/* Thumbnail Gallery */}
          <Route path="/thumbnails/:episodeId" element={<ThumbnailGallery />} />
          
          {/* Export */}
          <Route path="/episodes/:episodeId/export" element={<ExportPage />} />
          
          {/* Review (Coming Soon) */}
          <Route path="/episodes/:episodeId/review" element={
            <div className="page-wrapper">
              <h1>Review & Approve</h1>
              <p>Coming soon - Review workflow</p>
            </div>
          } />
          
          {/* ===== MANAGEMENT ROUTES ===== */}
          
          {/* StoryTeller Book Editor */}
          <Route path="/storyteller" element={<StorytellerPage />} />
          
          {/* PNOS Character Registry */}
          <Route path="/character-registry" element={<CharacterRegistryPage />} />
          
          {/* Search */}
          <Route path="/search" element={<SearchResults />} />
          
          {/* Analytics */}
          <Route path="/analytics/decisions" element={<DecisionAnalyticsDashboard />} />
          
          {/* Admin */}
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/audit-log" element={<AuditLogViewer />} />
          
          {/* Diagnostics */}
          <Route path="/diagnostics" element={<DiagnosticPage />} />
          
          {/* Settings (Coming Soon) */}
          <Route path="/settings" element={
            <div className="page-wrapper">
              <h1>Settings</h1>
              <p>Coming soon - App settings</p>
            </div>
          } />

          {/* If authenticated user tries to access login, redirect to home */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          
          {/* Fallback - redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Hide footer on editor routes for immersive experience */}
      {!isFullScreen && (
        <footer className="app-footer">
          <p>&copy; 2026 Episode Control System. Built with React + Vite</p>
        </footer>
      )}
      </div>

      {/* Orientation awareness toast */}
      <OrientationToast />
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
