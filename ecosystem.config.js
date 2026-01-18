module.exports = {
  apps: [{
    name: 'episode-api',
    script: '/home/ubuntu/episode-metadata/src/app.js',
    cwd: '/home/ubuntu/episode-metadata',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ubuntu/episode-metadata/logs/error.log',
    out_file: '/home/ubuntu/episode-metadata/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'staging',
      PORT: 3002,
      HOST: '0.0.0.0',
      API_VERSION: 'v1',
      APP_NAME: 'Episode Metadata API (Development)',
      ALLOWED_ORIGINS: 'https://dev.episodes.primestudios.dev,http://localhost:3000,http://localhost:3002,http://localhost:5173,http://127.0.0.1:3002,http://127.0.0.1:5173,https://dev.primepisodes.com',
      
      // Database Config - AWS RDS Development
      DATABASE_URL: 'postgresql://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata',
      DB_HOST: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
      DB_PORT: 5432,
      DB_NAME: 'episode_metadata',
      DB_USER: 'postgres',
      DB_PASSWORD: 'Ayanna123!!',
      DATABASE_POOL_MIN: 2,
      DATABASE_POOL_MAX: 10,
      DATABASE_TIMEOUT: 30000,
      DATABASE_SSL: true,
      DB_SSL: 'true',
      
      // AWS Config
      AWS_REGION: 'us-east-1',
      AWS_ACCOUNT_ID: '637423256673',
      AWS_ACCESS_KEY_ID: 'dummy-key-for-dev',
      AWS_SECRET_ACCESS_KEY: 'dummy-secret-for-dev',
      
      // S3 Buckets - Development
      AWS_S3_BUCKET: 'episode-metadata-storage-dev',
      S3_PRIMARY_BUCKET: 'episode-metadata-storage-dev',
      S3_THUMBNAIL_BUCKET: 'episode-metadata-thumbnails-dev',
      MAX_FILE_UPLOAD_SIZE_MB: 500,
      
      // Cognito Auth - Development Pool
      COGNITO_USER_POOL_ID: 'us-east-1_mFVU52978',
      COGNITO_CLIENT_ID: 'lgtf3odnar8c456iehqfck1au',
      COGNITO_REGION: 'us-east-1',
      
      // JWT Tokens
      JWT_SECRET: 'dev-secret-minimum-32-characters-long-for-security',
      JWT_EXPIRATION: '24h'
    }
  }]
};
