// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const env = process.env.NODE_ENV || 'development';

const config = {
  app: {
    name: process.env.APP_NAME || 'Episode Metadata API',
    version: process.env.API_VERSION || 'v1',
    env,
    port: parseInt(process.env.PORT || 3000),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },
  database: {
    url: process.env.DATABASE_URL,
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || 2),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || 10),
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID,
    s3: {
      primaryBucket: process.env.S3_PRIMARY_BUCKET,
      thumbnailBucket: process.env.S3_THUMBNAIL_BUCKET,
      maxUploadSizeMb: parseInt(process.env.MAX_FILE_UPLOAD_SIZE_MB || 500),
    },
    sqs: {
      thumbnailQueueUrl: process.env.THUMBNAIL_QUEUE_URL,
    },
  },
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
    clientSecret: process.env.COGNITO_CLIENT_SECRET,
    region: process.env.COGNITO_REGION || 'us-east-1',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    cloudwatch: {
      logGroup: process.env.CLOUDWATCH_LOG_GROUP,
      logStream: process.env.CLOUDWATCH_LOG_STREAM,
    },
  },
};

module.exports = config;
