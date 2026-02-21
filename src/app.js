/* eslint-disable no-console */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Only load .env if not running via PM2 with ecosystem config
if (!process.env.PM2_HOME) {
  require('dotenv').config();
  console.log('📋 Loaded environment from .env file');
} else {
  console.log('📋 Using PM2 environment variables');
}

console.log('🚀 Starting application... [VERSION 2026-01-23-19:25]');
console.log('🔍 This log confirms latest code is running!');
console.log('�🚨🚨 [2026-02-10 05:17] - NEW CODE WITH ULTRA-EARLY LOGGING 🚨🚨🚨');
console.log('�📋 Environment:', process.env.NODE_ENV || 'development');
console.log('📋 Database URL:', process.env.DATABASE_URL ? '***SET***' : '❌ NOT SET');
console.log('📋 Port:', process.env.PORT || 3002);
console.log('📋 DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('📋 DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('📋 DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('📋 DB_SSL:', process.env.DB_SSL || 'NOT SET');

const app = express();

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================
console.log('📦 Loading database models...');
let db;
try {
  db = require('./models');
  console.log('✅ Models loaded successfully');
} catch (err) {
  console.error('❌ FATAL: Failed to load models:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

let isDbConnected = false;
const isOpenSearchReady = false;

// Initialize database - non-blocking, runs in background
if (process.env.NODE_ENV !== 'test') {
  console.log('🔌 Initializing database connection...');
  (async () => {
    try {
      await db.authenticate();
      console.log('✅ Database connection authenticated');

      // Check if DB sync is enabled via environment variable
      console.log('DEBUG: ENABLE_DB_SYNC =', process.env.ENABLE_DB_SYNC);
      console.log('DEBUG: DB_SYNC_FORCE =', process.env.DB_SYNC_FORCE);
      if (process.env.ENABLE_DB_SYNC === 'true') {
        console.log('🔄 Syncing database models...');
        const syncOptions = {
          force: process.env.DB_SYNC_FORCE === 'true',
          alter: process.env.DB_SYNC_ALTER === 'true',
        };
        await db.sequelize.sync(syncOptions);
        console.log('✅ Database models synchronized');
      } else {
        // Skip model sync - database already exists
        // Sync errors indicate schema mismatches that we don't want to auto-fix
        console.log('⏭️  Skipping model sync (database already initialized)');
      }

      isDbConnected = true;
    } catch (err) {
      console.error('❌ Database initialization error:', err.message);
      console.error('Full error:', err);
      // Don't exit - allow app to start in degraded mode
    }
  })();
} else {
  console.log('⏭️  Skipping database initialization (test mode)');
}

// ============================================================================
// PROCESS ERROR HANDLERS (Set up early)
// ============================================================================
process.on('unhandledRejection', (reason, _promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// ============================================================================
// STARTUP LOGGING
// ============================================================================
console.log('🚀 Starting Episode Metadata API...');
console.log(`📦 Node version: ${process.version}`);
console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

// ============================================================================
// SECURITY & MIDDLEWARE
// ============================================================================
// Add a basic ping route BEFORE all middleware to test connectivity
app.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

// CORS MUST come BEFORE helmet
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow all localhost origins and specified domains
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        'http://127.0.0.1:5176',
        'http://127.0.0.1:3000',
        'http://primepisodes.com',
        'https://primepisodes.com',
        'http://www.primepisodes.com',
        'https://www.primepisodes.com',
        'http://api.primepisodes.com',
        'https://api.primepisodes.com',
        'http://dev.primepisodes.com',
        'https://dev.primepisodes.com',
        'http://primepisodes-alb-1912818060.us-east-1.elb.amazonaws.com',
        'http://52.91.217.230',
        'http://3.94.166.174',
      ];

      // Allow requests without origin (like from curl or development environments)
      // or if origin is in the allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('❌ CORS Rejected - Origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200, // Some legacy browsers (IE11) require this
  })
);

// Handle preflight requests for all routes
app.options(/(.*)/, cors());

// 🚨 ULTRA-EARLY DEBUG MIDDLEWARE - Log EVERY request
app.use((req, res, next) => {
  console.log(`\n🌍 INCOMING REQUEST: ${req.method} ${req.path}`);
  console.log(`   Original URL: ${req.originalUrl}`);
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for development to avoid content type issues
  })
);
// Important: express.json() should only parse request bodies, not affect response content-type
app.use(express.json({ limit: '10mb', type: 'application/json' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================================
const { attachRBAC } = require('./middleware/rbac');
const { captureResponseData } = require('./middleware/auditLog');
const { optionalAuth } = require('./middleware/auth');

// Optional auth for all routes (user info attached if valid token provided)
// Real Cognito authentication enabled
app.use(optionalAuth);

// DEV MODE (uncomment to bypass authentication for testing)
// app.use((req, res, next) => {
//   req.user = { id: 'dev-user', email: 'dev@example.com', name: 'Dev User' };
//   next();
// });

// Attach RBAC info to request
app.use(attachRBAC);

// Capture response data for audit logging
app.use(captureResponseData);

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development',
    config: {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      DB_HOST: process.env.DB_HOST || 'NOT SET',
      DB_NAME: process.env.DB_NAME || 'NOT SET',
      DB_SSL: process.env.DB_SSL || 'NOT SET',
    },
  };

  // Only check DB in non-test environment or if DB is available
  if (process.env.NODE_ENV !== 'test' || process.env.TEST_DATABASE_URL) {
    try {
      await db.sequelize.authenticate();
      health.database = 'connected';

      // Check if shows table exists
      try {
        const [results] = await db.sequelize.query(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shows')"
        );
        health.showsTableExists = results[0].exists;
      } catch (err) {
        health.showsTableExists = false;
        health.tableCheckError = err.message;
      }
    } catch (error) {
      health.database = 'disconnected';
      health.databaseError = error.message;
      health.status = 'degraded';
      return res.status(503).json(health);
    }
  } else {
    health.database = 'skipped'; // In test mode without DB
  }

  res.status(200).json(health);
});

// Alias so /api/v1/health also works (nginx only proxies /api to backend)
app.get('/api/v1/health', (req, res) => res.redirect('/health'));

// Debug endpoint to check environment (should be removed in production)
app.get('/api/v1/debug/env', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? '***SET***' : 'NOT SET',
    DB_SSL: process.env.DB_SSL,
    AWS_REGION: process.env.AWS_REGION,
    cwd: process.cwd(),
    __dirname,
  });
});

// Route load diagnostics tracker
const routeLoadResults = {};
function trackRouteLoad(name, loadFn) {
  try {
    const mod = loadFn();
    routeLoadResults[name] = { status: 'ok' };
    console.log(`✓ ${name} loaded`);
    return mod;
  } catch (e) {
    routeLoadResults[name] = { status: 'error', message: e.message, code: e.code };
    console.error(`✗ Failed to load ${name}:`, e.message);
    return (req, res) => res.status(500).json({ error: 'Routes not available', route: name, reason: e.message });
  }
}

app.get('/api/v1/debug/routes', (req, res) => {
  const failed = Object.entries(routeLoadResults).filter(([,v]) => v.status === 'error');
  res.json({
    total: Object.keys(routeLoadResults).length,
    loaded: Object.keys(routeLoadResults).length - failed.length,
    failed: failed.length,
    details: routeLoadResults,
  });
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================
let authRoutes;
authRoutes = trackRouteLoad('auth', () => require('./routes/auth'));
app.use('/api/v1/auth', authRoutes);

// ============================================================================
// API ROUTES
// ============================================================================
let episodeRoutes, thumbnailRoutes, metadataRoutes, processingRoutes;
let filesRoutes, searchRoutes, jobsRoutes;
let assetRoutes, compositionRoutes, templateRoutes;
let sceneRoutes, scenesFixedRoutes, wardrobeRoutes;

// Characters routes
let characterRoutes;
characterRoutes = trackRouteLoad('characters', () => require('./routes/characters'));

episodeRoutes = trackRouteLoad('episodes', () => require('./routes/episodes'));

thumbnailRoutes = trackRouteLoad('thumbnails', () => require('./routes/thumbnails'));

metadataRoutes = trackRouteLoad('metadata', () => require('./routes/metadata'));

processingRoutes = trackRouteLoad('processing', () => require('./routes/processing'));

// Phase 2 routes (file storage, search, job management)
filesRoutes = trackRouteLoad('files', () => require('./routes/files'));

searchRoutes = trackRouteLoad('search', () => require('./routes/search'));

jobsRoutes = trackRouteLoad('jobs', () => require('./routes/jobs'));

// Phase 2.5 routes (composite thumbnails)
assetRoutes = trackRouteLoad('assets', () => require('./routes/assets'));

// Asset roles routes
let rolesRoutes;
rolesRoutes = trackRouteLoad('roles', () => require('./routes/roles'));

compositionRoutes = trackRouteLoad('compositions', () => require('./routes/compositions'));

templateRoutes = trackRouteLoad('templates', () => require('./routes/templates'));

// Scene routes
sceneRoutes = trackRouteLoad('scenes', () => {
  delete require.cache[require.resolve('./routes/scenes')];
  return require('./routes/scenes');
});

// FIXED Scene routes (temporary workaround)
scenesFixedRoutes = trackRouteLoad('scenes-fixed', () => require('./routes/scenes-fixed'));

let sceneTemplateRoutes;
sceneTemplateRoutes = trackRouteLoad('sceneTemplates', () => require('./routes/sceneTemplates'));

let sceneLibraryRoutes;
sceneLibraryRoutes = trackRouteLoad('sceneLibrary', () => require('./routes/sceneLibrary'));

// Wardrobe routes
wardrobeRoutes = trackRouteLoad('wardrobe', () => require('./routes/wardrobe'));

let wardrobeLibraryRoutes;
wardrobeLibraryRoutes = trackRouteLoad('wardrobeLibrary', () => require('./routes/wardrobeLibrary'));

let outfitSetsRoutes;
outfitSetsRoutes = trackRouteLoad('outfitSets', () => require('./routes/outfitSets'));

let scriptsRoutes;
scriptsRoutes = trackRouteLoad('scripts', () => require('./routes/scripts'));

let footageRoutes;
footageRoutes = trackRouteLoad('footage', () => require('./routes/footage'));

let sceneLinksRoutes;
sceneLinksRoutes = trackRouteLoad('sceneLinks', () => require('./routes/sceneLinks'));

let scriptAnalysisRoutes;
scriptAnalysisRoutes = trackRouteLoad('scriptAnalysis', () => require('./routes/scriptAnalysis'));

// Phase 3A controllers (real-time notifications)
let notificationController, activityController, presenceController, socketController;

try {
  notificationController = require('./controllers/notificationController');
  console.log('✓ Notifications controller loaded');
} catch (e) {
  console.error('✗ Failed to load notifications controller:', e.message);
  notificationController = (req, res) =>
    res.status(500).json({ error: 'Controller not available' });
}

try {
  activityController = require('./controllers/activityController');
  console.log('✓ Activity controller loaded');
} catch (e) {
  console.error('✗ Failed to load activity controller:', e.message);
  activityController = (req, res) => res.status(500).json({ error: 'Controller not available' });
}

try {
  presenceController = require('./controllers/presenceController');
  console.log('✓ Presence controller loaded');
} catch (e) {
  console.error('✗ Failed to load presence controller:', e.message);
  presenceController = (req, res) => res.status(500).json({ error: 'Controller not available' });
}

try {
  socketController = require('./controllers/socketController');
  console.log('✓ Socket controller loaded');
} catch (e) {
  console.error('✗ Failed to load socket controller:', e.message);
  socketController = (req, res) => res.status(500).json({ error: 'Controller not available' });
}

// Audit logging routes
let auditLogsRoutes;
try {
  auditLogsRoutes = require('./routes/auditLogs');
  console.log('✓ Audit logs routes loaded');
} catch (e) {
  console.error('✗ Failed to load audit logs routes:', e.message);
  auditLogsRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Development seed routes
let seedRoutes;
try {
  seedRoutes = require('./routes/seed');
  console.log('✓ Seed routes loaded (development only)');
} catch (e) {
  console.error('✗ Failed to load seed routes:', e.message);
  seedRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Template Studio routes
let templateStudioRoutes;
try {
  templateStudioRoutes = require('./routes/templateStudio');
  console.log('✓ Template Studio routes loaded');
} catch (e) {
  console.error('✗ Failed to load Template Studio routes:', e.message);
  templateStudioRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Image Processing routes
let imageProcessingRoutes;
try {
  imageProcessingRoutes = require('./routes/imageProcessing');
  console.log('✓ Image Processing routes loaded');
} catch (e) {
  console.error('✗ Failed to load Image Processing routes:', e.message);
  imageProcessingRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Script Generator routes
let scriptGeneratorRoutes;
try {
  scriptGeneratorRoutes = require('./routes/scriptGenerator');
  console.log('✓ Script Generator routes loaded');
} catch (e) {
  console.error('✗ Failed to load Script Generator routes:', e.message);
  scriptGeneratorRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Edit Maps / AI Analysis routes
let editMapsRoutes;
try {
  editMapsRoutes = require('./routes/editMaps');
  console.log('✓ Edit Maps routes loaded');
} catch (e) {
  console.error('✗ Failed to load Edit Maps routes:', e.message);
  editMapsRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// ============================================================================
// ICON CUE TIMELINE SYSTEM ROUTES (Week 4 - Production System)
// ============================================================================

// Icon Cue routes (icon timeline management)
let iconCueRoutes;
try {
  iconCueRoutes = require('./routes/iconCues');
  console.log('✓ Icon Cue routes loaded');
} catch (e) {
  console.error('✗ Failed to load Icon Cue routes:', e.message);
  iconCueRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Cursor Path routes (cursor action timeline)
let cursorPathRoutes;
try {
  cursorPathRoutes = require('./routes/cursorPaths');
  console.log('✓ Cursor Path routes loaded');
} catch (e) {
  console.error('✗ Failed to load Cursor Path routes:', e.message);
  cursorPathRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Music Cue routes (music timeline)
let musicCueRoutes;
try {
  musicCueRoutes = require('./routes/musicCues');
  console.log('✓ Music Cue routes loaded');
} catch (e) {
  console.error('✗ Failed to load Music Cue routes:', e.message);
  musicCueRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Production Package routes (export bundles)
let productionPackageRoutes;
try {
  productionPackageRoutes = require('./routes/productionPackage');
  console.log('✓ Production Package routes loaded');
} catch (e) {
  console.error('✗ Failed to load Production Package routes:', e.message);
  productionPackageRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Icon Slot Mapping routes (icon role → slot mappings)
let iconSlotRoutes;
try {
  iconSlotRoutes = require('./routes/iconSlots');
  console.log('✓ Icon Slot routes loaded');
} catch (e) {
  console.error('✗ Failed to load Icon Slot routes:', e.message);
  iconSlotRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

app.use('/api/v1/episodes', episodeRoutes);

// Timeline Data routes (scene composer & timeline editor)
const timelineDataRoutes = trackRouteLoad('timelineData', () => require('./routes/timelineData'));
app.use('/api/v1/episodes', timelineDataRoutes);

app.use('/api/v1/thumbnails', thumbnailRoutes);
app.use('/api/v1/metadata', metadataRoutes);
app.use('/api/v1/processing-queue', processingRoutes);

// Admin routes for migrations/setup
const adminRoutes = trackRouteLoad('admin', () => require('./routes/admin'));
app.use('/api/v1/admin', adminRoutes);

// Phase 2 routes
app.use('/api/v1/files', filesRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/jobs', jobsRoutes);

// Phase 2.5 routes (composite thumbnails)
app.use('/api/v1/assets', assetRoutes);
// Register the characters API route
app.use('/api/v1/characters', characterRoutes);
app.use('/api/v1/assets', imageProcessingRoutes); // Image processing endpoints
app.use('/api/v1/roles', rolesRoutes); // Asset roles registry
app.use('/api/v1/compositions', compositionRoutes);
app.use('/api/v1/templates', templateRoutes);

// DEBUG: Direct DB test route (disabled)
// Uncomment if you need to debug database directly
// const testDbDirectRoutes = require('./routes/test-db-direct');
// app.use('/api/v1/debug', testDbDirectRoutes);

// 🚨 DEBUG MIDDLEWARE - Log ALL requests to /api/v1/scenes* (disabled)
// app.use('/api/v1/scenes', (req, res, next) => {
//   console.log('\n🚨🚨🚨 REQUEST TO /api/v1/scenes*:');
//   console.log('  Method:', req.method);
//   console.log('  Path:', req.path);
//   console.log('  Full URL:', req.originalUrl);
//   console.log('  Query:', req.query);
//   console.log('  Params:', req.params);
//   next();
// });

// Scene routes
app.use('/api/v1/scenes-fixed', scenesFixedRoutes); // TEMPORARY WORKAROUND
app.use('/api/v1/scenes', sceneRoutes);
app.use('/api/v1/scene-templates', sceneTemplateRoutes);

// Scene Library routes (new system)
app.use('/api/v1/scene-library', sceneLibraryRoutes);

// Marker routes (Phase 2 Timeline)
try {
  const markerRoutes = require('./routes/markers');
  app.use('/api/v1', markerRoutes);
  console.log('✓ Marker routes mounted (Phase 2)');
} catch (e) {
  console.error('✗ Failed to load marker routes:', e.message);
}

// Export routes (Phase 3 - Video Export System)
try {
  const exportRoutes = require('./routes/export');
  app.use('/api/v1', exportRoutes);
  console.log('✓ Export routes mounted (Phase 3)');
} catch (e) {
  console.error('✗ Failed to load export routes:', e.message);
}

// Phase 2.5 Animatic System routes
try {
  const beatRoutes = require('./routes/beats');
  const characterClipRoutes = require('./routes/character-clips');
  const audioClipRoutes = require('./routes/audio-clips');
  const animaticRoutes = require('./routes/animatic');
  app.use('/api/v1', beatRoutes);
  app.use('/api/v1', characterClipRoutes);
  app.use('/api/v1', audioClipRoutes);
  app.use('/api/v1', animaticRoutes);
  console.log('✓ Phase 2.5 Animatic System routes mounted');
} catch (e) {
  console.error('✗ Failed to load Animatic System routes:', e.message);
}

// Wardrobe routes
app.use('/api/v1/wardrobe', wardrobeRoutes);

// Wardrobe Library routes
app.use('/api/v1/wardrobe-library', wardrobeLibraryRoutes);

// Wardrobe Approval routes
try {
  const wardrobeApprovalRoutes = require('./routes/wardrobeApproval');
  app.use('/api/v1/episodes', wardrobeApprovalRoutes);
  console.log('✓ Wardrobe Approval routes loaded');
} catch (e) {
  console.error('✗ Failed to load wardrobe approval routes:', e.message);
}

// Evaluation routes (scoring engine)
const evaluationRoutes = trackRouteLoad('evaluation', () => require('./routes/evaluation'));
app.use('/api/v1', evaluationRoutes);

// World Admin routes (dashboard, decisions, browse-pool)
const worldRoutes = trackRouteLoad('world', () => require('./routes/world'));
app.use('/api/v1', worldRoutes);

// World Events routes (event library CRUD + inject)
const worldEventRoutes = trackRouteLoad('worldEvents', () => require('./routes/worldEvents'));
app.use('/api/v1', worldEventRoutes);

// Career Goals routes (goal CRUD + sync + suggest-events)
try {
  const careerGoalRoutes = require('./routes/careerGoals');
  app.use('/api/v1', careerGoalRoutes);
  console.log('✓ Career goal routes loaded');
} catch (e) {
  console.error('✗ Failed to load career goal routes:', e.message);
}

// Outfit sets routes
app.use('/api/v1/outfit-sets', outfitSetsRoutes);

// Scripts routes
app.use('/api/v1/scripts', scriptsRoutes);

// Script Generator routes
app.use('/api/v1/episodes', scriptGeneratorRoutes);
app.use('/api/v1/templates', scriptGeneratorRoutes);

// Lala Script Generation routes
try {
  const lalaScriptRoutes = require('./routes/lalaScripts');
  app.use('/api/v1/episodes', lalaScriptRoutes);
  console.log('✓ Lala Script routes loaded');
} catch (e) {
  console.error('✗ Failed to load lala script routes:', e.message);
}

// Edit Maps / AI Analysis routes
app.use('/api/v1/raw-footage', editMapsRoutes);
app.use('/api/v1/edit-maps', editMapsRoutes);

// Script analysis routes (AI)
app.use('/api/scripts', scriptAnalysisRoutes);

// Script Beat Parser routes (Scene Plan from script)
try {
  const scriptParseRoutes = require('./routes/scriptParse');
  app.use('/api/v1/scripts', scriptParseRoutes);   // POST /api/v1/scripts/parse
  app.use('/api/v1/episodes', scriptParseRoutes);   // POST /api/v1/episodes/:id/parse-script, apply-scene-plan
  console.log('✓ Script parse routes loaded');
} catch (e) {
  console.error('✗ Failed to load script parse routes:', e.message);
}

// Footage upload routes
app.use('/api/footage', footageRoutes);

// Scene linking routes
app.use('/api/scene-links', sceneLinksRoutes);

// Phase 6 routes (Shows)
let showRoutes;
try {
  showRoutes = require('./routes/shows');
  console.log('✓ Shows routes loaded');
} catch (e) {
  console.error('✗ Failed to load Shows routes:', e.message);
  console.error('Stack:', e.stack);
  showRoutes = (req, res) => res.status(500).json({ error: 'Routes not available', details: e.message });
}
app.use('/api/v1/shows', showRoutes);
console.log('✅ Shows routes MOUNTED at /api/v1/shows');

// Game Show routes (phases, layouts, interactive elements)
let gameShowRoutes;
try {
  gameShowRoutes = require('./routes/gameShows');
  console.log('✓ Game Show routes loaded');
} catch (e) {
  console.error('✗ Failed to load Game Show routes:', e.message);
}
if (gameShowRoutes) {
  app.use('/api/v1/episodes', gameShowRoutes);
  app.use('/api/v1/shows', gameShowRoutes);
}

// Thumbnail template routes
try {
  const thumbnailTemplateRoutes = require('./routes/thumbnailTemplates');
  app.use('/api/v1/thumbnail-templates', thumbnailTemplateRoutes);
  console.log('✓ Thumbnail Template routes loaded');
} catch (e) {
  console.error('✗ Failed to load thumbnail template routes:', e.message);
}

// Decision Analytics routes
try {
  const decisionAnalyticsRoutes = require('./routes/decisionAnalytics');
  app.use('/api/decision-analytics', decisionAnalyticsRoutes);
  console.log('✓ Decision Analytics routes loaded');
} catch (e) {
  console.error('✗ Failed to load decision analytics routes:', e.message);
}

// Template Studio routes (new system)
app.use('/api/v1/template-studio', templateStudioRoutes);

// Phase 3A routes (real-time notifications)
app.use('/api/v1/notifications', notificationController);
app.use('/api/v1/activity', activityController);
app.use('/api/v1/presence', presenceController);
app.use('/api/v1/socket', socketController);

// Audit logging routes
app.use('/api/v1/audit-logs', auditLogsRoutes);
console.log('✓ Audit logs routes loaded');

// Decision logging routes
try {
  const decisionsRoutes = require('./routes/decisions');
  app.use('/api/v1/decisions', decisionsRoutes);
  console.log('✓ Decisions routes loaded');
} catch (e) {
  console.error('✗ Failed to load decisions routes:', e.message);
}

// Decision Logs routes (for AI training)
try {
  const decisionLogsRoutes = require('./routes/decisionLogs');
  app.use('/api/v1/decision-logs', decisionLogsRoutes);
  console.log('✓ Decision Logs routes loaded');
} catch (e) {
  console.error('✗ Failed to load decision logs routes:', e.message);
}

// Layer Management routes (Week 4 Day 1)
try {
  const layersRoutes = require('./routes/layers');
  app.use('/api/v1/layers', layersRoutes);
  console.log('✓ Layer Management routes loaded');
} catch (e) {
  console.error('✗ Failed to load layers routes:', e.message);
}

// YouTube Training routes
try {
  const youtubeRoutes = require('./routes/youtube');
  app.use('/api/youtube', youtubeRoutes);
  console.log('✓ YouTube training routes loaded');
} catch (e) {
  console.error('✗ Failed to load youtube routes:', e.message);
}

// Development seed routes
app.use('/api/v1/seed', seedRoutes);

// Icon Cue Timeline System routes (Week 4 - Production System)
app.use('/api/v1/episodes', iconCueRoutes);
app.use('/api/v1/episodes', cursorPathRoutes);
app.use('/api/v1/episodes', musicCueRoutes);
app.use('/api/v1/episodes', productionPackageRoutes);
app.use('/api/v1/icon-slots', iconSlotRoutes); // Global icon slot mappings
console.log('✓ Icon Cue Timeline System routes registered');

// StoryTeller Book Editor routes
try {
  const storytellerRoutes = require('./routes/storyteller');
  app.use('/api/v1/storyteller', storytellerRoutes);
  console.log('✓ StoryTeller routes loaded at /api/v1/storyteller');
} catch (e) {
  console.error('✗ Failed to load StoryTeller routes:', e.message);
}

// Character Registry routes
try {
  const characterRegistryRoutes = require('./routes/characterRegistry');
  app.use('/api/v1/character-registry', characterRegistryRoutes);
  console.log('✓ Character Registry routes loaded at /api/v1/character-registry');
} catch (e) {
  console.error('✗ Failed to load Character Registry routes:', e.message);
}

// Memory Bank routes (PNOS Storyteller Memories — Phase 1)
try {
  const memoriesRoutes = require('./routes/memories');
  app.use('/api/v1/memories', memoriesRoutes);
  console.log('✓ Memories routes loaded at /api/v1/memories');
} catch (e) {
  console.error('✗ Failed to load Memories routes:', e.message);
}

// Continuity Engine routes
try {
  const continuityEngineRoutes = require('./routes/continuityEngine');
  app.use('/api/v1/continuity', continuityEngineRoutes);
  console.log('✓ Continuity Engine routes loaded at /api/v1/continuity');
} catch (e) {
  console.error('✗ Failed to load Continuity Engine routes:', e.message);
}

// Export Queue Monitor (Bull Board dashboard + stats API)
let queueMonitorRoutes;
try {
  queueMonitorRoutes = require('./routes/queue-monitor');
  app.use('/admin/queues', queueMonitorRoutes);
  console.log('✓ Queue Monitor routes loaded at /admin/queues');
} catch (e) {
  console.error('✗ Failed to load Queue Monitor routes:', e.message);
}

// API info endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Episode Metadata API',
    version: process.env.API_VERSION || 'v1',
    status: isDbConnected ? 'operational' : 'degraded',
    environment: process.env.NODE_ENV || 'development',
    opensearch: isOpenSearchReady ? 'ready' : 'initializing',
    endpoints: {
      episodes: '/api/v1/episodes',
      thumbnails: '/api/v1/thumbnails',
      metadata: '/api/v1/metadata',
      'processing-queue': '/api/v1/processing-queue',
      files: '/api/v1/files',
      search: '/api/v1/search',
      jobs: '/api/v1/jobs',
      assets: '/api/v1/assets',
      compositions: '/api/v1/compositions',
      templates: '/api/v1/templates',
      notifications: '/api/v1/notifications',
      activity: '/api/v1/activity',
      presence: '/api/v1/presence',
      socket: '/api/v1/socket',
      health: '/health',
      'queue-monitor': '/admin/queues',
    },
  });
});

// ============================================================================
// STATIC FRONTEND SERVING (Production/Development)
// ============================================================================
const path = require('path');
const fs = require('fs');

const frontendDistPath = path.join(__dirname, '../frontend/dist');
const indexHtmlPath = path.join(frontendDistPath, 'index.html');

console.log('🔍 Frontend serving check:');
console.log('  - Looking for dist at:', frontendDistPath);
console.log('  - Dist exists:', fs.existsSync(frontendDistPath));
console.log('  - Index.html exists:', fs.existsSync(indexHtmlPath));

// Serve static files from frontend/dist if it exists
if (fs.existsSync(frontendDistPath) && fs.existsSync(indexHtmlPath)) {
  console.log('✓ Serving frontend from:', frontendDistPath);
  console.log('✓ Dist contents:', fs.readdirSync(frontendDistPath));

  const assetsPath = path.join(frontendDistPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    console.log('✓ Assets found:', fs.readdirSync(assetsPath).slice(0, 5));
  } else {
    console.warn('⚠️ No assets directory found in dist');
  }

  // Explicitly serve /assets folder FIRST with correct MIME types
  app.use(
    '/assets',
    express.static(path.join(frontendDistPath, 'assets'), {
      maxAge: 0,
      etag: true,
      lastModified: true,
      fallthrough: false, // Don't continue if assets route is matched
      setHeaders: (res, filePath) => {
        console.log('📦 Serving asset file:', filePath);

        // Set correct MIME types
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.set('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.css')) {
          res.set('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.json')) {
          res.set('Content-Type', 'application/json; charset=utf-8');
        } else if (filePath.endsWith('.svg')) {
          res.set('Content-Type', 'image/svg+xml');
        } else if (filePath.endsWith('.png')) {
          res.set('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.set('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.woff') || filePath.endsWith('.woff2')) {
          res.set('Content-Type', 'font/woff2');
        }

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  // Serve other static files from root dist (like index.html)
  app.use(
    express.static(frontendDistPath, {
      maxAge: 0,
      etag: true,
      lastModified: true,
      index: false,
      fallthrough: true,
      setHeaders: (res, filePath) => {
        console.log('📦 Serving static file:', filePath);

        if (filePath.endsWith('.html')) {
          res.set('Content-Type', 'text/html; charset=utf-8');
        }

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  // Handle React Router - serve index.html for all non-API/file routes (MUST be last)
  // Express 5 requires named wildcard syntax instead of bare '*'
  app.get('/{*splat}', (req, res, next) => {
    try {
      console.log(`📄 Catch-all route: ${req.path}`);

      // Skip API routes
      if (
        req.path.startsWith('/api/') ||
        req.path === '/health' ||
        req.path === '/ping' ||
        req.path === '/debug'
      ) {
        console.log('  → Skipping (API route)');
        return next();
      }

      // CRITICAL: Skip requests for static assets folder
      if (req.path.startsWith('/assets/')) {
        console.log('  → Skipping (assets folder)');
        return next();
      }

      // If file has extension and doesn't exist, 404 instead of serving index.html
      if (path.extname(req.path)) {
        console.log('  → Skipping (has extension)');
        return next();
      }

      // Serve index.html for SPA routes
      const indexPath = path.join(frontendDistPath, 'index.html');
      console.log(`  → Serving index.html from: ${indexPath}`);

      if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexPath);
      } else {
        console.log('  ⚠️ index.html not found!');
        next();
      }
    } catch (error) {
      console.error('❌ Error in catch-all route:', error);
      next(error);
    }
  });
} else {
  console.log('⚠ Frontend dist not found or index.html missing!');
  console.log('  - frontendDistPath:', frontendDistPath);
  console.log('  - indexHtmlPath:', indexHtmlPath);
  console.log('  - Dist exists:', fs.existsSync(frontendDistPath));
  console.log('  - Index exists:', fs.existsSync(indexHtmlPath));
  if (fs.existsSync(frontendDistPath)) {
    console.log('  - Dist contents:', fs.readdirSync(frontendDistPath));
  }
  console.log('  -> Frontend will NOT be served, API-only mode');
}

// ============================================================================
// ERROR HANDLING
// ============================================================================
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Export app for use in server.js or testing
module.exports = app;
