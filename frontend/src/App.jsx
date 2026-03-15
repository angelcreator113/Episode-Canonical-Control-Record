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
const BeatGeneration = lazy(() => import('./pages/BeatGeneration'));
const EpisodeReview = lazy(() => import('./pages/EpisodeReview'));
const EvaluateEpisode = lazy(() => import('./pages/EvaluateEpisode'));
const WorldAdmin = lazy(() => import('./pages/WorldAdmin'));
const WorldStudio = lazy(() => import('./pages/WorldStudio'));
const SceneStudio = lazy(() => import('./pages/SceneStudio'));
const ShowSettings = lazy(() => import('./pages/ShowSettings'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const AssetLibrary = lazy(() => import('./pages/AssetLibrary'));
const StorytellerPage = lazy(() => import('./pages/StorytellerPage'));
// Redirect from /book/:id → WriteMode (first chapter)
const BookToWriteRedirect = () => {
  const { id } = useParams();
  const [loading, setLoading] = React.useState(true);
  const nav = useNavigate();
  React.useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
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
const SeriesPage = lazy(() => import('./pages/SeriesPage'));
const UniverseProductionPage = lazy(() => import('./pages/UniverseProductionPage'));
const UniverseSocialImportPage = lazy(() => import('./pages/UniverseSocialImportPage'));
const UniverseWardrobePage = lazy(() => import('./pages/UniverseWardrobePage'));
const UniverseAssetsPage = lazy(() => import('./pages/UniverseAssetsPage'));
const UniverseWorldStatePage = lazy(() => import('./pages/UniverseWorldStatePage'));
const UniverseTensionsPage = lazy(() => import('./pages/UniverseTensionsPage'));
const StoryDashboardPage = lazy(() => import('./pages/StoryDashboardPage'));
const FranchiseBrainPage = lazy(() => import('./pages/FranchiseBrainPage'));
const WritingRhythmPage = lazy(() => import('./pages/WritingRhythmPage'));
const ReadingMode = lazy(() => import('./pages/ReadingMode'));
const WriteMode = lazy(() => import('./pages/WriteMode'));
const RelationshipEngine = lazy(() => import('./pages/RelationshipEngine'));
const SessionStart = lazy(() => import('./pages/SessionStart'));
const CharacterTherapy = lazy(() => import('./pages/CharacterTherapy'));
const PressPublisher = lazy(() => import('./pages/PressPublisher'));
const StoryEngine = lazy(() => import('./pages/StoryEngine'));
const StoryEvaluationEngine = lazy(() => import('./pages/StoryEvaluationEngine'));
const StoryProposer = lazy(() => import('./pages/StoryProposer'));
const NovelAssembler = lazy(() => import('./pages/NovelAssembler'));
const StoryThreadTracker = lazy(() => import('./pages/StoryThreadTracker'));
const StoryCalendar = lazy(() => import('./pages/StoryCalendar'));
const StoryHealthDashboard = lazy(() => import('./pages/StoryHealthDashboard'));
const CharacterGenerator = lazy(() => import('./pages/CharacterGenerator'));
const CharacterProfile = lazy(() => import('./pages/CharacterProfilePage'));
const SetupWizard = lazy(() => import('./pages/SetupWizard'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RecycleBin = lazy(() => import('./pages/RecycleBin'));
const ChapterJourney = lazy(() => import('./pages/ChapterJourney'));
const ChapterStructureEditor = lazy(() => import('./pages/ChapterStructureEditor'));
const QuickEpisodeCreator = lazy(() => import('./components/QuickEpisodeCreator'));
const StudioTimelinePage = lazy(() => import('./pages/StudioTimelinePage'));
const StudioSceneComposerPage = lazy(() => import('./pages/StudioSceneComposerPage'));
const SocialProfileGenerator = lazy(() => import('./pages/SocialProfileGenerator'));
const NarrativeControlCenter = lazy(() => import('./pages/NarrativeControlCenter'));
const AmberCommandCenter = lazy(() => import('./pages/AmberCommandCenter'));
const AICostTracker = lazy(() => import('./pages/AICostTracker'));
const CFOAgent = lazy(() => import('./pages/CFOAgent'));
const SiteOrganizer = lazy(() => import('./pages/SiteOrganizer'));
const DesignAgent = lazy(() => import('./pages/DesignAgent'));
const NarrativePressureDashboard = lazy(() => import('./pages/NarrativePressureDashboard'));
const FeedRelationshipMap = lazy(() => import('./pages/FeedRelationshipMap'));
const CulturalCalendar = lazy(() => import('./pages/CulturalCalendar'));
const InfluencerSystems = lazy(() => import('./pages/InfluencerSystems'));
const WorldInfrastructure = lazy(() => import('./pages/WorldInfrastructure'));
const SocialTimeline = lazy(() => import('./pages/SocialTimeline'));
const SocialPersonality = lazy(() => import('./pages/SocialPersonality'));
const CharacterLifeSimulation = lazy(() => import('./pages/CharacterLifeSimulation'));
const CulturalMemory = lazy(() => import('./pages/CulturalMemory'));
const CharacterDepthEngine = lazy(() => import('./pages/CharacterDepthEngine'));
const WorldLocations = lazy(() => import('./pages/WorldLocations'));
const ShowBrain = lazy(() => import('./pages/ShowBrain'));
// WorldView merged into CharacterRegistryPage

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
import PullToRefresh from './components/PullToRefresh';
import CommandPalette from './components/CommandPalette';

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

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed(c => !c);

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
  // Also check localStorage directly to survive React state races on refresh
  React.useEffect(() => {
    const hasToken = !!localStorage.getItem('authToken');
    if (!loading && !isAuthenticated && !hasToken && location.pathname !== '/login' && location.pathname !== '/' && !isNavigatingRef.current) {
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
  // Only match episode-scoped URLs for full-screen (not /studio/* picker pages)
  const isTimelineEditor = /\/episodes\/[^/]+\/timeline/.test(location.pathname);
  const isSceneComposer = /\/episodes\/[^/]+\/scene-composer/.test(location.pathname);
  const isExportPage = location.pathname.includes('/export');
  const isStorytellerPage = location.pathname.includes('/storyteller');
  const isReadingMode = location.pathname.includes('/books/') && location.pathname.includes('/read');
  const isWriteMode = location.pathname.startsWith('/write/');
  const isChapterJourney = location.pathname.startsWith('/chapter/');
  const isStoryEngine = location.pathname === '/story-engine';
  const isStoryEval = location.pathname === '/story-evaluation';
  const isStoryThreads = location.pathname === '/story-threads';
  const isStoryCalendar = location.pathname === '/story-calendar';
  // Social Import is now embedded in Universe page as a tab
  const isSetupWizard = location.pathname === '/setup';
  const isFullScreen = isTimelineEditor || isSceneComposer || isExportPage || isReadingMode || isWriteMode || isChapterJourney || isStorytellerPage || isStoryEngine || isStoryEval || isStoryThreads || isStoryCalendar || isSetupWizard;
  const hideFooter = isFullScreen;

  return (
    <div className="app-layout">
      {/* Sidebar Navigation (hidden on full-screen modes) */}
      {!isFullScreen && (
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      )}
      
      <div className={`app-main-wrapper ${isFullScreen ? 'full-screen' : ''}`}>
        {!isFullScreen && (
          <Header
            navOpen={!sidebarCollapsed}
            onNavToggle={toggleSidebar}
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
          <Route path="/universe/social-import" element={<UniverseSocialImportPage />} />
          <Route path="/universe/series" element={<SeriesPage />} />
          <Route path="/universe/production" element={<UniverseProductionPage />} />
          <Route path="/universe/wardrobe" element={<UniverseWardrobePage />} />
          <Route path="/universe/assets" element={<UniverseAssetsPage />} />
          <Route path="/universe/world-state" element={<UniverseWorldStatePage />} />
          <Route path="/universe/tensions" element={<UniverseTensionsPage />} />
          <Route path="/universe/story-dashboard" element={<StoryDashboardPage />} />
          <Route path="/universe/knowledge" element={<FranchiseBrainPage />} />
          <Route path="/universe/writing-rhythm" element={<WritingRhythmPage />} />

          {/* ===== PRE-PRODUCTION ROUTES ===== */}
          
          {/* Episodes — listing redirects to Universe Production page */}
          <Route path="/episodes" element={<Navigate to="/universe/production" replace />} />
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
          
          {/* Studio — universe-level entry points */}
          <Route path="/studio/timeline" element={<StudioTimelinePage />} />
          <Route path="/studio/scene-composer" element={<StudioSceneComposerPage />} />
          
          {/* Scene Library */}
          <Route path="/scene-library" element={<SceneLibrary />} />
          <Route path="/scene-library/:sceneId" element={<SceneDetail />} />
          
          {/* ===== ANIMATIC SYSTEM ROUTES ===== */}
          
          {/* Beat Generation */}
          <Route path="/episodes/:episodeId/beats" element={<BeatGeneration />} />
          
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
          
          {/* Review & Approve */}
          <Route path="/episodes/:episodeId/review" element={<EpisodeReview />} />
          
          {/* ===== MANAGEMENT ROUTES ===== */}
          
          {/* StoryTeller Book Editor */}
          <Route path="/storyteller" element={<StorytellerPage />} />
          <Route path="/book/:id" element={<BookToWriteRedirect />} />
          <Route path="/books/:bookId/read" element={<ReadingMode />} />
          <Route path="/chapter/:bookId/:chapterId" element={<ChapterJourney />} />
          <Route path="/write/:bookId/:chapterId" element={<WriteMode />} />
          <Route path="/chapter-structure/:bookId/:chapterId" element={<ChapterStructureEditor />} />
          
          {/* PNOS Character Registry */}
          <Route path="/character-registry" element={<CharacterRegistryPage />} />
          <Route path="/character/:id" element={<CharacterProfile />} />
          <Route path="/character-generator" element={<Navigate to="/world-studio" replace />} />
          <Route path="/setup" element={<SetupWizard />} />
          
          {/* PNOS Character Therapy — Psychological Narrative Engine */}
          <Route path="/therapy/:registryId" element={<CharacterTherapy />} />
          
          {/* PNOS Continuity Engine */}
          <Route path="/continuity" element={<ContinuityEnginePage />} />
          
          {/* PNOS Relationships — Unified Tree + Web + Candidates + List */}
          <Route path="/relationships" element={<RelationshipEngine />} />

          {/* Cultural Calendar — LalaVerse Social & Industry Calendar */}
          <Route path="/cultural-calendar" element={<CulturalCalendar />} />

          {/* Influencer Systems — Archetypes, Relationships, Economy, Trends, Momentum, Legacy */}
          <Route path="/influencer-systems" element={<InfluencerSystems />} />

          {/* World Infrastructure — Cities, Universities, Corporations, 50 Legends, The Loop */}
          <Route path="/world-infrastructure" element={<WorldInfrastructure />} />

          {/* Social Timeline Engine — Feed layers, viral spread, engagement, drama, cultural memory */}
          <Route path="/social-timeline" element={<SocialTimeline />} />

          {/* Social Personality Engine — Traits, archetypes, motivations, reputation, arcs, algorithm */}
          <Route path="/social-personality" element={<SocialPersonality />} />

          {/* Character Life Simulation — Career stages, paths, relationships, rivalries, migration, persona */}
          <Route path="/character-life-simulation" element={<CharacterLifeSimulation />} />

          {/* Cultural Memory System — Archives, legends, feuds, nostalgia, time capsules, influence rankings */}
          <Route path="/cultural-memory" element={<CulturalMemory />} />

          {/* Character Depth Engine — Body, money, time, cosmology, blind spot, joy, change capacity */}
          <Route path="/character-depth-engine" element={<CharacterDepthEngine />} />

          {/* World Locations — Places and spaces of the universe */}
          <Route path="/world-locations" element={<WorldLocations />} />

          {/* Show Brain — Master Intelligence Document: identity, world rules, stats, economy, beats, 5 brains, canon */}
          <Route path="/show-brain" element={<ShowBrain />} />
          
          {/* Narrative Control Center — Continuity, Arcs, Timeline, Pipeline, Threads */}
          <Route path="/narrative-control" element={<NarrativeControlCenter />} />

          {/* PNOS Story Engine — 50-Story Arc System */}
          <Route path="/story-engine" element={<StoryEngine />} />

          {/* PNOS Story Evaluation Engine — Multi-voice generation + editorial scoring */}
          <Route path="/story-evaluation" element={<StoryEvaluationEngine />} />

          {/* Scene Intelligence Engine — Propose + Character Growth */}
          <Route path="/scene-proposer" element={<StoryProposer />} />

          {/* Story Thread Tracker — Threads, Memories, Continuity, Voice */}
          <Route path="/story-threads" element={<StoryThreadTracker />} />

          {/* Story Calendar — Timeline events + clock markers */}
          <Route path="/story-calendar" element={<StoryCalendar />} />

          {/* Story Health Dashboard — Quality metrics + velocity + arc progress */}
          <Route path="/story-health" element={<StoryHealthDashboard />} />

          {/* World Studio — LalaVerse world character hub */}
          <Route path="/world-studio" element={<WorldStudio />} />

          {/* Book Scene Studio — Intimate scene generation + reader */}
          <Route path="/scene-studio" element={<SceneStudio />} />

          {/* The Feed — Parasocial Creator Profile Generator */}
          <Route path="/feed" element={<SocialProfileGenerator />} />

          {/* Narrative Pressure Dashboard — Feed Nervous System */}
          <Route path="/pressure" element={<NarrativePressureDashboard />} />
          <Route path="/feed-relationships" element={<FeedRelationshipMap />} />
          
          {/* PNOS Social Import Pipeline — redirects to Universe page */}
          <Route path="/social-import" element={<Navigate to="/universe/social-import" replace />} />

          {/* Franchise Brain — redirects to Universe page */}
          <Route path="/franchise-brain" element={<Navigate to="/universe/knowledge" replace />} />
          
          {/* PNOS Novel Assembler */}
          <Route path="/assembler" element={<NovelAssembler />} />
          
          {/* PNOS LalaVerse Press — Publisher Dashboard */}
          <Route path="/press" element={<PressPublisher />} />
          
          {/* Search */}
          <Route path="/search" element={<SearchResults />} />
          
          {/* Analytics */}
          <Route path="/analytics/decisions" element={<DecisionAnalyticsDashboard />} />
          <Route path="/ai-costs" element={<AICostTracker />} />
          <Route path="/cfo" element={<CFOAgent />} />
          <Route path="/site-organizer" element={<SiteOrganizer />} />
          <Route path="/design-agent" element={<DesignAgent />} />
          
          {/* Admin */}
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/audit-log" element={<AuditLogViewer />} />
          
          {/* Diagnostics */}
          <Route path="/diagnostics" element={<DiagnosticPage />} />

          {/* Amber Command Center */}
          <Route path="/amber" element={<AmberCommandCenter />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          
          {/* Recycle Bin */}
          <Route path="/recycle-bin" element={<RecycleBin />} />

          {/* World View — redirect to merged Characters page */}
          <Route path="/world" element={<Navigate to="/character-registry?view=world" replace />} />

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

      {/* Pull-to-refresh for standalone PWA (no browser refresh button) */}
      <PullToRefresh />

      {/* Global Command Palette — Ctrl+K cross-system search */}
      <CommandPalette />

      {/* AI Assistant — top-right corner */}
      <AppAssistant
        appContext={(() => {
          const p = location.pathname;
          const pageNames = {
            '/': 'Home Dashboard',
            '/universe': 'Universe Hub',
            '/universe/social-import': 'Social Import',
            '/universe/series': 'Series',
            '/universe/production': 'Production',
            '/universe/wardrobe': 'Wardrobe',
            '/universe/assets': 'Assets',
            '/universe/world-state': 'World State',
            '/universe/tensions': 'Tensions',
            '/universe/story-dashboard': 'Story Dashboard',
            '/universe/knowledge': 'Franchise Brain',
            '/universe/writing-rhythm': 'Writing Rhythm',
            '/character-registry': 'Character Registry',
            '/relationships': 'Relationship Engine',
            '/continuity': 'Continuity Engine',
            '/story-engine': 'Story Engine',
            '/story-evaluation': 'Story Evaluation Engine',
            '/storyteller': 'Storyteller Book Editor',
            '/world-studio': 'World Studio',
            '/scene-studio': 'Book Scene Studio',
            '/feed': 'Social Feed Profiles',
            '/social-timeline': 'Social Timeline Engine',
            '/social-personality': 'Social Personality Engine',
            '/feed-relationships': 'Feed Relationship Map',
            '/cultural-calendar': 'Cultural Calendar',
            '/influencer-systems': 'Influencer Systems',
            '/world-infrastructure': 'World Infrastructure',
            '/character-life-simulation': 'Character Life Simulation',
            '/cultural-memory': 'Cultural Memory',
            '/character-depth-engine': 'Character Depth Engine',
            '/show-brain': 'Show Brain',
            '/narrative-control': 'Narrative Control Center',
            '/scene-proposer': 'Scene Proposer',
            '/pressure': 'Narrative Pressure Dashboard',
            '/assembler': 'Novel Assembler',
            '/press': 'LalaVerse Press',
            '/wardrobe': 'Wardrobe',
            '/template-studio': 'Template Studio',
            '/amber': 'Amber Command Center',
            '/settings': 'Settings',
            '/setup': 'Setup Wizard',
          };
          // Extract IDs from URL for deeper context
          const charMatch = p.match(/\/character\/([^/]+)/);
          const bookMatch = p.match(/\/(?:books?|write|chapter)\/([^/]+)/);
          const chapterMatch = p.match(/\/(?:write|chapter)\/[^/]+\/([^/]+)/);
          const showMatch = p.match(/\/shows\/([^/]+)/);
          const therapyMatch = p.match(/\/therapy\/([^/]+)/);
          const episodeMatch = p.match(/\/episodes\/([^/]+)/);
          const ctx = {
            currentView: p,
            pageName: pageNames[p] || (charMatch ? 'Character Profile' : bookMatch ? 'Book Editor' : showMatch ? 'Show Detail' : episodeMatch ? 'Episode Detail' : p),
          };
          if (charMatch) ctx.activeCharacterId = charMatch[1];
          if (bookMatch) ctx.activeBookId = bookMatch[1];
          if (chapterMatch) ctx.activeChapterId = chapterMatch[1];
          if (showMatch) ctx.activeShowId = showMatch[1];
          if (therapyMatch) ctx.activeRegistryId = therapyMatch[1];
          if (episodeMatch && episodeMatch[1] !== 'create') ctx.activeEpisodeId = episodeMatch[1];
          if (currentEpisodeId) ctx.currentEpisodeId = currentEpisodeId;
          // Pass URL search params for tab context
          const sp = new URLSearchParams(location.search);
          if (sp.get('tab')) ctx.activeTab = sp.get('tab');
          if (sp.get('view')) ctx.activeView = sp.get('view');
          return ctx;
        })()}
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
