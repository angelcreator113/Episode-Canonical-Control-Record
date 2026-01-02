const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================
const db = require('./models');

let isDbConnected = false;
let isOpenSearchReady = false;

// Initialize database - non-blocking, runs in background
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await db.authenticate();
      console.log('✅ Database connection authenticated');
      isDbConnected = true;
    } catch (err) {
      console.warn('⚠ Database not available:', err.message.split('\n')[0]);
      isDbConnected = true; // Allow degraded mode
    }
  })().catch(err => console.error('⚠ DB init error:', err.message));
} else {
  isDbConnected = true;
}

// ============================================================================
// PROCESS ERROR HANDLERS (Set up early)
// ============================================================================
process.on('unhandledRejection', (reason, promise) => {
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

try {
// ============================================================================
// SECURITY & MIDDLEWARE
// ============================================================================
// Add a basic ping route BEFORE all middleware to test connectivity
app.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================================
const { optionalAuth } = require('./middleware/auth');
const { attachRBAC } = require('./middleware/rbac');
const { captureResponseData } = require('./middleware/auditLog');

// Optional auth for all routes (user info attached if valid token provided)
app.use(optionalAuth);

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
    environment: process.env.NODE_ENV || 'development'
  };

  // Only check DB in non-test environment or if DB is available
  if (process.env.NODE_ENV !== 'test' || process.env.TEST_DATABASE_URL) {
    try {
      await db.sequelize.authenticate();
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.status = 'degraded'; // Not fully unhealthy, just degraded
      return res.status(200).json(health); // Still return 200, not 503
    }
  } else {
    health.database = 'skipped'; // In test mode without DB
  }

  res.status(200).json(health);
});

// ============================================================================
// API ROUTES
// ============================================================================
let episodeRoutes, thumbnailRoutes, metadataRoutes, processingRoutes;
let filesRoutes, searchRoutes, jobsRoutes;
let assetRoutes, compositionRoutes, templateRoutes;

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

try {
  compositionRoutes = require('./routes/compositions');
  console.log('✓ Compositions routes loaded');
} catch (e) {
  console.error('✗ Failed to load compositions routes:', e.message);
  compositionRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

try {
  templateRoutes = require('./routes/templates');
  console.log('✓ Templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load templates routes:', e.message);
  templateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}

app.use('/api/v1/episodes', episodeRoutes);
app.use('/api/v1/thumbnails', thumbnailRoutes);
app.use('/api/v1/metadata', metadataRoutes);
app.use('/api/v1/processing-queue', processingRoutes);

// Phase 2 routes
app.use('/api/v1/files', filesRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/jobs', jobsRoutes);

// Phase 2.5 routes (composite thumbnails)
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/compositions', compositionRoutes);
app.use('/api/v1/templates', templateRoutes);

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
      health: '/health',
    },
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/errorHandler');

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

} catch (error) {
  console.error('❌ FATAL ERROR during startup:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// Export app for use in server.js or testing
module.exports = app;
