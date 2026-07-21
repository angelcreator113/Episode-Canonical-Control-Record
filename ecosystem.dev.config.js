// ecosystem.dev.config.js — dev-box PM2 manifest (episode-dev-backend ONLY)
// Split from ecosystem.config.js per F-Deploy-1 G2 s4.5.1 (RF-1 symmetry):
// the root manifest is prod-only so the shared box can never replay a dev
// process; this file is dev-only so the dev box can never materialize a
// prod-configured process. NO env_production blocks belong in this file.
// Deployed by deploy-dev.yml; started via:
//   pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker

// Load .env so API keys are available when PM2 evaluates this config
try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch {}

const sharedEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PATH: '/home/ubuntu/.nvm/versions/node/v20.20.0/bin:' + process.env.PATH,
  NODE_VERSION: '20.20.0',
  DB_HOST: process.env.DB_HOST || '',
  DB_PORT: process.env.DB_PORT || '5432',
  DB_NAME: process.env.DB_NAME || '',
  DB_USER: process.env.DB_USER || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DATABASE_POOL_MIN: process.env.DATABASE_POOL_MIN || '2',
  DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX || '10',
  DATABASE_TIMEOUT: process.env.DATABASE_TIMEOUT || '30000',
  DB_SSL: process.env.DB_SSL || 'true',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  S3_PRIMARY_BUCKET: process.env.S3_PRIMARY_BUCKET || '',
  S3_THUMBNAIL_BUCKET: process.env.S3_THUMBNAIL_BUCKET || '',
  MAX_FILE_UPLOAD_SIZE_MB: process.env.MAX_FILE_UPLOAD_SIZE_MB || '500',
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || '',
  COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '',
  COGNITO_REGION: process.env.COGNITO_REGION || 'us-east-1',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '24h',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: process.env.REDIS_PORT || '6379',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  RUNWAY_ML_API_KEY: process.env.RUNWAY_ML_API_KEY || '',
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN || '',
  REPLICATE_SAM_MODEL: process.env.REPLICATE_SAM_MODEL || '',
  FAL_KEY: process.env.FAL_KEY || '',
  REMOVEBG_API_KEY: process.env.REMOVEBG_API_KEY || '',
};

module.exports = {
  apps: [
    // === DEV app (port 3002) — serves dev.primepisodes.com ===
    {
      name: 'episode-api',
      script: '/home/ubuntu/episode-metadata/src/server.js',
      cwd: '/home/ubuntu/episode-metadata',
      interpreter: 'node',
      interpreter_args: '',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/home/ubuntu/episode-metadata/logs/dev-error.log',
      out_file: '/home/ubuntu/episode-metadata/logs/dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        ...sharedEnv,
        PORT: 3002,
        HOST: '0.0.0.0',
        API_VERSION: 'v1',
        APP_NAME: 'Episode Metadata API (Development)',
        ALLOWED_ORIGINS: 'https://dev.episodes.primestudios.dev,http://localhost:3000,http://localhost:3002,http://localhost:5173,http://127.0.0.1:3002,http://127.0.0.1:5173,https://dev.primepisodes.com',
      },
    },
    // === Worker (per-box instantiation; Track B DB-2 semantics unchanged) ===
    {
      name: 'episode-worker',
      script: '/home/ubuntu/episode-metadata/src/workers/start.js',
      cwd: '/home/ubuntu/episode-metadata',
      interpreter: 'node',
      interpreter_args: '',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      error_file: '/home/ubuntu/episode-metadata/logs/worker-error.log',
      out_file: '/home/ubuntu/episode-metadata/logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        ...sharedEnv,
        EXPORT_TEMP_DIR: '/home/ubuntu/episode-metadata/exports-temp',
        EXPORT_MAX_CONCURRENT_JOBS: '1',
      },
    }
  ]
};