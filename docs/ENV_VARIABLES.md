# Environment Variables Reference

## Complete Guide to All Required Environment Variables

### Application Configuration

```env
NODE_ENV=development              # development | staging | production
PORT=3000                         # Server port
API_VERSION=v1                    # API version
APP_NAME=Episode Metadata API     # Application name
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

### Database Configuration

**Local Development:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/episode_metadata_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

**AWS RDS (Staging):**
```env
DATABASE_URL=postgresql://postgres:PASSWORD@episode-metadata-db-staging.xxxxx.us-east-1.rds.amazonaws.com:5432/postgres
```

**AWS RDS (Production):**
```env
DATABASE_URL=postgresql://postgres:PASSWORD@episode-metadata-db-production.xxxxx.us-east-1.rds.amazonaws.com:5432/postgres
```

---

### AWS Configuration

```env
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=637423256673
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

#### S3 Buckets
```env
# Development
S3_PRIMARY_BUCKET=episode-metadata-storage-dev
S3_THUMBNAIL_BUCKET=episode-metadata-thumbnails-dev

# Staging
S3_PRIMARY_BUCKET=episode-metadata-storage-staging
S3_THUMBNAIL_BUCKET=episode-metadata-thumbnails-staging

# Production
S3_PRIMARY_BUCKET=episode-metadata-storage-production
S3_THUMBNAIL_BUCKET=episode-metadata-thumbnails-production

MAX_FILE_UPLOAD_SIZE_MB=500
```

#### SQS Queue
```env
# Development
THUMBNAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/637423256673/episode-metadata-thumbnail-queue-dev

# Staging
THUMBNAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/637423256673/episode-metadata-thumbnail-queue-staging

# Production
THUMBNAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/637423256673/episode-metadata-thumbnail-queue-production
```

---

### AWS Cognito Configuration

```env
# Cognito User Pool & Client
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
```

---

### Redis Configuration (Optional)

```env
REDIS_URL=redis://localhost:6379
```

---

### Logging Configuration

```env
LOG_LEVEL=debug                              # debug | info | warn | error
CLOUDWATCH_LOG_GROUP=/ecs/episode-metadata-api-dev
CLOUDWATCH_LOG_STREAM=api-local
```

---

### Features

```env
ENABLE_THUMBNAIL_GENERATION=true
ENABLE_AUDIT_LOGGING=true
```

---

## Setting Up Environment Variables

### Local Development

1. Copy template: `cp .env.example .env`
2. Edit `.env` with your values
3. For local PostgreSQL, use defaults:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/episode_metadata_dev
   ```

### AWS Staging / Production

1. Store in AWS Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name episode-metadata/database-staging \
     --secret-string '{"host":"...","password":"..."}'
   ```

2. Reference in CloudFormation/Terraform:
   ```yaml
   DatabaseUrl:
     Fn::Sub: "{{resolve:secretsmanager:episode-metadata/database-staging}}"
   ```

### GitHub Actions Secrets

Store sensitive values in GitHub repo settings:

```
Secrets → New repository secret
```

Required secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_PROD_ACCESS_KEY_ID`
- `AWS_PROD_SECRET_ACCESS_KEY`

---

## Validation

All environment variables are validated on startup. The application will fail to start if required variables are missing.

Check validation in: `src/config/environment.js`
