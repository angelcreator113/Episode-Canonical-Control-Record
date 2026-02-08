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
console.log('📋 Environment:', process.env.NODE_ENV || 'development');
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

      console.log('🔍 CORS Check - Origin:', origin, 'Allowed:', allowedOrigins.includes(origin));

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
app.options('*', cors());

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

// Debug endpoint to check environment (should be removed in production)
app.get('/debug/env', (req, res) => {
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

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================
let authRoutes;
try {
  authRoutes = require('./routes/auth');
  console.log('✓ Auth routes loaded');
} catch (e) {
  console.error('✗ Failed to load auth routes:', e.message);
  authRoutes = (req, res) => res.status(500).json({ error: 'Auth routes not available' });
}
app.use('/api/v1/auth', authRoutes);

// ============================================================================
// API ROUTES
// ============================================================================
let episodeRoutes, thumbnailRoutes, metadataRoutes, processingRoutes;
let filesRoutes, searchRoutes, jobsRoutes;
let assetRoutes, compositionRoutes, templateRoutes;
let sceneRoutes, wardrobeRoutes;

try {
  episodeRoutes = require('./routes/episodes');
  console.log('✓ Episodes routes loaded');
} catch (e) {
  console.error('✗ Failed to load episodes routes:', e.message);
  episodeRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  thumbnailRoutes = require('./routes/thumbnails');
  console.log('✓ Thumbnails routes loaded');
} catch (e) {
  console.error('✗ Failed to load thumbnails routes:', e.message);
  thumbnailRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  metadataRoutes = require('./routes/metadata');
  console.log('✓ Metadata routes loaded');
} catch (e) {
  console.error('✗ Failed to load metadata routes:', e.message);
  metadataRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  processingRoutes = require('./routes/processing');
  console.log('✓ Processing routes loaded');
} catch (e) {
  console.error('✗ Failed to load processing routes:', e.message);
  processingRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Phase 2 routes (file storage, search, job management)
try {
  filesRoutes = require('./routes/files');
  console.log('✓ Files routes loaded');
} catch (e) {
  console.error('✗ Failed to load files routes:', e.message);
  filesRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  searchRoutes = require('./routes/search');
  console.log('✓ Search routes loaded');
} catch (e) {
  console.error('✗ Failed to load search routes:', e.message);
  searchRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  jobsRoutes = require('./routes/jobs');
  console.log('✓ Jobs routes loaded');
} catch (e) {
  console.error('✗ Failed to load jobs routes:', e.message);
  jobsRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Phase 2.5 routes (composite thumbnails)
try {
  assetRoutes = require('./routes/assets');
  console.log('✓ Assets routes loaded');
} catch (e) {
  console.error('✗ Failed to load assets routes:', e.message);
  assetRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Asset roles routes
let rolesRoutes;
try {
  rolesRoutes = require('./routes/roles');
  console.log('✓ Asset roles routes loaded');
} catch (e) {
  console.error('✗ Failed to load asset roles routes:', e.message);
  rolesRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  compositionRoutes = require('./routes/compositions');
  console.log('✓ Compositions routes loaded');
} catch (e) {
  console.error('✗ Failed to load compositions routes:', e.message);
  console.error('Full error:', e);
  compositionRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  templateRoutes = require('./routes/templates');
  console.log('✓ Templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load templates routes:', e.message);
  templateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Scene routes
try {
  sceneRoutes = require('./routes/scenes');
  console.log('✓ Scenes routes loaded');
} catch (e) {
  console.error('✗ Failed to load scenes routes:', e.message);
  sceneRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Scene template routes
let sceneTemplateRoutes;
try {
  sceneTemplateRoutes = require('./routes/sceneTemplates');
  console.log('✓ Scene templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load scene templates routes:', e.message);
  sceneTemplateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Scene Library routes (new system)
let sceneLibraryRoutes;
try {
  sceneLibraryRoutes = require('./routes/sceneLibrary');
  console.log('✓ Scene Library routes loaded');
} catch (e) {
  console.error('✗ Failed to load scene library routes:', e.message);
  sceneLibraryRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Wardrobe routes
try {
  wardrobeRoutes = require('./routes/wardrobe');
  console.log('✓ Wardrobe routes loaded');
} catch (e) {
  console.error('✗ Failed to load wardrobe routes:', e.message);
  wardrobeRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Wardrobe Library routes
let wardrobeLibraryRoutes;
try {
  wardrobeLibraryRoutes = require('./routes/wardrobeLibrary');
  console.log('✓ Wardrobe Library routes loaded');
} catch (e) {
  console.error('✗ Failed to load wardrobe library routes:', e.message);
  wardrobeLibraryRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

// Outfit sets routes
let outfitSetsRoutes;
try {
  outfitSetsRoutes = require('./routes/outfitSets');
  console.log('✓ Outfit sets routes loaded');
} catch (e) {
  console.error('✗ Failed to load outfit sets routes:', e.message);
  outfitSetsRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

let scriptsRoutes;
try {
  scriptsRoutes = require('./routes/scripts');
  console.log('✓ Scripts routes loaded');
} catch (e) {
  console.error('✗ Failed to load scripts routes:', e.message);
  scriptsRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

let footageRoutes;
try {
  footageRoutes = require('./routes/footage');
  console.log('✓ Footage routes loaded');
} catch (e) {
  console.error('✗ Failed to load footage routes:', e.message);
  footageRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

let sceneLinksRoutes;
try {
  sceneLinksRoutes = require('./routes/sceneLinks');
  console.log('✓ Scene links routes loaded');
} catch (e) {
  console.error('✗ Failed to load scene links routes:', e.message);
  sceneLinksRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

let scriptAnalysisRoutes;
try {
  scriptAnalysisRoutes = require('./routes/scriptAnalysis');
  console.log('✓ Script analysis routes loaded');
} catch (e) {
  console.error('✗ Failed to load script analysis routes:', e.message);
  scriptAnalysisRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

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

app.use('/api/v1/episodes', episodeRoutes);
app.use('/api/v1/thumbnails', thumbnailRoutes);
app.use('/api/v1/metadata', metadataRoutes);
app.use('/api/v1/processing-queue', processingRoutes);

// Admin routes for migrations/setup
const adminRoutes = require('./routes/admin');
app.use('/api/v1/admin', adminRoutes);

// Phase 2 routes
app.use('/api/v1/files', filesRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/jobs', jobsRoutes);

// Phase 2.5 routes (composite thumbnails)
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/assets', imageProcessingRoutes); // Image processing endpoints
app.use('/api/v1/roles', rolesRoutes); // Asset roles registry
app.use('/api/v1/compositions', compositionRoutes);
app.use('/api/v1/templates', templateRoutes);

// Scene routes
app.use('/api/v1/scenes', sceneRoutes);
app.use('/api/v1/scene-templates', sceneTemplateRoutes);

// Scene Library routes (new system)
app.use('/api/v1/scene-library', sceneLibraryRoutes);

// Wardrobe routes
app.use('/api/v1/wardrobe', wardrobeRoutes);

// Debug middleware BEFORE wardrobe-library
app.use('/api/v1/wardrobe-library', (req, res, next) => {
  console.log(`🚨 APP.JS: Request to /api/v1/wardrobe-library${req.path}`);
  next();
});

// Wardrobe Library routes
app.use('/api/v1/wardrobe-library', wardrobeLibraryRoutes);

// Wardrobe Approval routes
const wardrobeApprovalRoutes = require('./routes/wardrobeApproval');
app.use('/api/v1/episodes', wardrobeApprovalRoutes);

// Outfit sets routes
app.use('/api/v1/outfit-sets', outfitSetsRoutes);

// Scripts routes
app.use('/api/v1/scripts', scriptsRoutes);

// Script analysis routes (AI)
app.use('/api/scripts', scriptAnalysisRoutes);

// Footage upload routes
app.use('/api/footage', footageRoutes);

// Scene linking routes
app.use('/api/scene-links', sceneLinksRoutes);

// Phase 6 routes (Shows)
const showRoutes = require('./routes/shows');
app.use('/api/v1/shows', showRoutes);

// Thumbnail template routes
const thumbnailTemplateRoutes = require('./routes/thumbnailTemplates');
app.use('/api/v1/thumbnail-templates', thumbnailTemplateRoutes);

// Decision Analytics routes
const decisionAnalyticsRoutes = require('./routes/decisionAnalytics');
app.use('/api/decision-analytics', decisionAnalyticsRoutes);
console.log('✓ Decision Analytics routes loaded');

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
const decisionsRoutes = require('./routes/decisions');
app.use('/api/v1/decisions', decisionsRoutes);
console.log('✓ Decisions routes loaded');

// Layer Management routes (Week 4 Day 1)
const layersRoutes = require('./routes/layers');
app.use('/api/v1/layers', layersRoutes);
console.log('✓ Layer Management routes loaded');

// YouTube Training routes
const youtubeRoutes = require('./routes/youtube');
app.use('/api/youtube', youtubeRoutes);
console.log('✓ YouTube training routes loaded');

// Development seed routes
app.use('/api/v1/seed', seedRoutes);

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
    },
  });
});

// ============================================================================
// STATIC FRONTEND SERVING (Production/Development)
// ============================================================================
const path = require('path');
const fs = require('fs');

const frontendDistPath = path.join(__dirname, '../dist');
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
  app.get('*', (req, res, next) => {
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
