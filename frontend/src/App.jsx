import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Contexts
import { BulkSelectionProvider } from './contexts/BulkSelectionContext';
import { SearchFiltersProvider } from './contexts/SearchFiltersContext';

// Eager-loaded: critical path pages (login, landing, home)
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import Home from './pages/Home';

// Lazy-loaded: all other pages (code-split into separate chunks)
const EpisodeDetail = lazy(() => import('./pages/EpisodeDetail'));
const CreateEpisode = lazy(() => import('./pages/CreateEpisode'));
const IconCueTimeline = lazy(() => import('./pages/IconCueTimeline'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const ThumbnailGallery = lazy(() => import('./pages/ThumbnailGallery'));
const CompositionLibrary = lazy(() => import('./pages/CompositionLibrary'));
const CompositionDetail = lazy(() => import('./pages/CompositionDetail'));
const SceneLibrary = lazy(() => import('./pages/SceneLibrary'));
const SceneDetail = lazy(() => import('./pages/SceneDetail'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const TemplateManagement = lazy(() => import('./pages/TemplateManagement'));
const AuditLogViewer = lazy(() => import('./pages/AuditLogViewer'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const ShowManagement = lazy(() => import('./pages/ShowManagement'));
const ShowDetail = lazy(() => import('./pages/ShowDetail'));
const CreateShow = lazy(() => import('./pages/CreateShow'));
const EditShow = lazy(() => import('./pages/EditShow'));
const Wardrobe = lazy(() => import('./pages/Wardrobe'));
const WardrobeBrowser = lazy(() => import('./pages/WardrobeBrowser'));
const WardrobeAnalytics = lazy(() => import('./pages/WardrobeAnalytics'));
const OutfitSets = lazy(() => import('./pages/OutfitSets'));
const WardrobeLibraryUpload = lazy(() => import('./pages/WardrobeLibraryUpload'));
const WardrobeLibraryDetail = lazy(() => import('./pages/WardrobeLibraryDetail'));
const TemplateStudio = lazy(() => import('./pages/TemplateStudio'));
const TemplateDesigner = lazy(() => import('./pages/TemplateDesigner'));
const DiagnosticPage = lazy(() => import('./pages/DiagnosticPage'));
const DecisionAnalyticsDashboard = lazy(() => import('./pages/DecisionAnalyticsDashboard'));
const TimelineEditor = lazy(() => import('./pages/TimelineEditor'));
const EvaluateEpisode = lazy(() => import('./pages/EvaluateEpisode'));
const WorldAdmin = lazy(() => import('./pages/WorldAdmin'));
const ShowSettings = lazy(() => import('./pages/ShowSettings'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const AssetLibrary = lazy(() => import('./pages/AssetLibrary'));
const StorytellerPage = lazy(() => import('./pages/StorytellerPage'));
const PlanWithVoicePage = lazy(() => import('./pages/PlanWithVoicePage'));
// Redirect from /book/:id → WriteMode (first chapter)
const BookToWriteRedirect = () => {
  const { id } = useParams();
  const [loading, setLoading] = React.useState(true);
  const nav = useNavigate();
  React.useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    fetch(`/api/v1/storyteller/books/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const chapters = Array.isArray(data.chapters) ? data.chapters : [];
        if (chapters.length > 0) {
          const sorted = [...chapters].sort((a, b) => (a.order ?? a.chapter_number ?? 0) - (b.order ?? b.chapter_number ?? 0));
          nav(`/chapter/${id}/${sorted[0].id}`, { replace: true });
        } else {
          nav('/storyteller', { replace: true });
        }
      })
      .catch(() => nav('/storyteller', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, nav]);
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Lora,serif',color:'rgba(28,24,20,0.4)'}}>Opening book…</div>;
  return null;
};
const CharacterRegistryPage = lazy(() => import('./pages/CharacterRegistryPage'));
const ContinuityEnginePage = lazy(() => import('./pages/ContinuityEnginePage'));
const UniversePage = lazy(() => import('./pages/UniversePage'));
const ReadingMode = lazy(() => import('./pages/ReadingMode'));
const WriteMode = lazy(() => import('./pages/WriteMode'));
const BookOverview = lazy(() => import('./pages/BookOverview'));
const RelationshipMap = lazy(() => import('./pages/RelationshipMap'));
const SessionStart = lazy(() => import('./pages/SessionStart'));
const CharacterTherapy = lazy(() => import('./pages/CharacterTherapy'));
const PressPublisher = lazy(() => import('./pages/PressPublisher'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RecycleBin = lazy(() => import('./pages/RecycleBin'));
const ChapterJourney = lazy(() => import('./pages/ChapterJourney'));
const EpisodeWorkspace = lazy(() => import('./pages/EpisodeWorkspace'));
const ChapterStructureEditor = lazy(() => import('./pages/ChapterStructureEditor'));
const QuickEpisodeCreator = lazy(() => import('./components/QuickEpisodeCreator'));

// Heavy components — lazy loaded
const SceneComposerFull = lazy(() => import('./components/SceneComposer/SceneComposerFull'));
const AnimaticPreview = lazy(() => import('./components/Episodes/SceneComposer/AnimaticPreview'));

// Layout components — eager loaded (always visible)
import Sidebar from './components/layout/Sidebar';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastContainer';
import OrientationToast from './components/OrientationToast';
import LoadingSkeleton from './components/LoadingSkeleton';
import AppAssistant from './components/AppAssistant';

import './App.css';

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><LoadingSkeleton variant="page" /></div>;
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
    if (!loading && !isAuthenticated && location.pathname !== '/login' && location.pathname !== '/' && !isNavigatingRef.current) {
      console.log('[AppContent] User not authenticated, redirecting to landing...');
      isNavigatingRef.current = true;
      navigate('/', { replace: true });
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
          <LoadingSkeleton variant="page" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Check if current route is Timeline Editor, Scene Composer, Export, Storyteller, or WriteMode (full-screen modes)
  const isTimelineEditor = location.pathname.includes('/timeline');
  const isSceneComposer = location.pathname.includes('/scene-composer');
  const isExportPage = location.pathname.includes('/export');
  const isStorytellerPage = location.pathname.includes('/storyteller');
  const isPlanWithVoice = location.pathname === '/plan-with-voice';
  const isReadingMode = location.pathname.includes('/books/') && location.pathname.includes('/read');
  const isWriteMode = location.pathname.startsWith('/write/');
  const isChapterJourney = location.pathname.startsWith('/chapter/');
  const isFullScreen = isTimelineEditor || isSceneComposer || isExportPage || isReadingMode || isWriteMode || isChapterJourney || isStorytellerPage || isPlanWithVoice;
  const hideFooter = isFullScreen;

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
          <Suspense fallback={<LoadingSkeleton variant="page" />}>
          <Routes>
          {/* ===== DASHBOARD ===== */}
          <Route path="/" element={<Home />} />
          <Route path="/start" element={<SessionStart />} />
          
          {/* Universe */}
          <Route path="/universe" element={<UniversePage />} />
          
          {/* ===== PRE-PRODUCTION ROUTES ===== */}
          
          {/* Episodes */}
          <Route path="/episodes" element={<EpisodeWorkspace />} />
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
          <Route path="/plan-with-voice" element={<PlanWithVoicePage />} />
          <Route path="/book/:id" element={<BookToWriteRedirect />} />
          <Route path="/books/:bookId/read" element={<ReadingMode />} />
          <Route path="/chapter/:bookId/:chapterId" element={<ChapterJourney />} />
          <Route path="/write/:bookId/:chapterId" element={<WriteMode />} />
          <Route path="/chapter-structure/:bookId/:chapterId" element={<ChapterStructureEditor />} />
          
          {/* PNOS Character Registry */}
          <Route path="/character-registry" element={<CharacterRegistryPage />} />
          
          {/* PNOS Character Therapy — Psychological Narrative Engine */}
          <Route path="/therapy/:registryId" element={<CharacterTherapy />} />
          
          {/* PNOS Continuity Engine */}
          <Route path="/continuity" element={<ContinuityEnginePage />} />
          
          {/* PNOS Character Relationship Map */}
          <Route path="/relationships" element={<RelationshipMap />} />
          
          {/* PNOS LalaVerse Press — Publisher Dashboard */}
          <Route path="/press" element={<PressPublisher />} />
          
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
          
          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          
          {/* Recycle Bin */}
          <Route path="/recycle-bin" element={<RecycleBin />} />

          {/* If authenticated user tries to access login, redirect to home */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          
          {/* Fallback - redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </Suspense>
      </main>

      {/* Hide footer on editor routes for immersive experience */}
      {!hideFooter && (
        <footer className="app-footer">
          <p>&copy; 2026 Episode Control System. Built with React + Vite</p>
        </footer>
      )}
      </div>

      {/* Orientation awareness toast */}
      <OrientationToast />

      {/* AI Assistant — floating chat bubble */}
      <AppAssistant
        appContext={{ currentView: location.pathname }}
        onNavigate={(path) => navigate(path)}
        onRefresh={() => window.dispatchEvent(new Event('app-refresh'))}
      />
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
