# 📁 PROJECT STRUCTURE & FILE GUIDE

## Complete Directory Layout

```
Episode-Canonical-Control-Record/
│
├── 📄 Configuration Files
│   ├── .env.example                    # Environment variables template
│   ├── .env                           # (local only, git-ignored)
│   ├── .gitignore                     # Git ignore rules
│   ├── .eslintrc.js                   # Linting configuration
│   ├── .prettierrc.js                 # Code formatting config
│   ├── package.json                   # Dependencies & scripts
│   ├── jest.config.js                 # Testing configuration
│   ├── Dockerfile                     # Docker image definition
│   └── docker-compose.yml             # Local dev containers
│
├── 🚀 Source Code
│   └── src/
│       ├── app.js                     # Express app entry point
│       ├── config/
│       │   ├── database.js            # PostgreSQL pool
│       │   ├── aws.js                 # AWS SDK setup
│       │   └── environment.js         # Config management
│       ├── middleware/                # Express middleware (auth, errors)
│       ├── routes/                    # API route definitions
│       ├── controllers/               # Request handlers
│       ├── services/                  # Business logic & DB access
│       ├── models/                    # Database schemas
│       └── utils/                     # Helper functions
│
├── 🗄️ Database
│   └── migrations/                    # Database migration files
│
├── 🧪 Tests
│   └── tests/
│       ├── setup.js                   # Test configuration
│       ├── unit/                      # Unit tests
│       │   └── app.test.js            # Example test
│       ├── integration/               # Integration tests
│       └── fixtures/                  # Test data
│
├── 📋 Scripts
│   └── scripts/
│       └── seed.js                    # Database seeding script
│
├── 📚 Documentation
│   └── docs/
│       ├── AWS_SETUP.md               # AWS infrastructure commands
│       ├── ENV_VARIABLES.md           # Complete variable reference
│       ├── DEPLOYMENT.md              # Deployment procedures
│       └── TROUBLESHOOTING.md         # (to be created)
│
├── 🔄 CI/CD
│   └── .github/
│       └── workflows/
│           └── ci-cd.yml              # GitHub Actions pipeline
│
├── ⚡ Serverless
│   └── lambda/
│       └── thumbnail-generator/       # Thumbnail generation function
│
├── 📖 Main Documentation
│   ├── README.md                      # Project overview & quick start
│   ├── PHASE_0_CHECKLIST.md          # Week 1 implementation checklist
│   └── [Future phases...]
│
└── 🔒 Git
    └── .git/                          # Git repository data
```

---

## 📄 File Descriptions

### Configuration Files

#### `.env.example`
- **Purpose**: Template for environment variables
- **What it contains**: All required env vars with descriptions
- **How to use**: `cp .env.example .env` then edit `.env` with real values
- **Keep in git**: YES (it's a template)
- **Never commit**: The actual `.env` file

#### `.eslintrc.js`
- **Purpose**: Code quality rules
- **Enforces**: Consistent code style, no unused variables, best practices
- **How to run**: `npm run lint`

#### `.prettierrc.js`
- **Purpose**: Auto-formatting configuration
- **Enforces**: Consistent formatting (indentation, quotes, spacing)
- **How to run**: `npm run format`

#### `package.json`
- **Purpose**: Project metadata and dependencies
- **Contains**: 
  - Dependencies (express, pg, aws-sdk, etc)
  - Dev dependencies (jest, eslint, prettier, etc)
  - npm scripts (dev, test, lint, etc)
- **Modify when**: Adding new packages or npm scripts

#### `jest.config.js`
- **Purpose**: Test framework configuration
- **Sets**: Coverage thresholds (75%), test environment
- **Don't modify unless**: Changing test requirements

#### `Dockerfile`
- **Purpose**: Production Docker image definition
- **Uses**: Node 20 Alpine Linux
- **Includes**: Multi-stage build, non-root user, health checks
- **Built by**: CI/CD pipeline

#### `docker-compose.yml`
- **Purpose**: Local development environment
- **Includes**: PostgreSQL 15, Redis 7, Application container
- **How to use**: `docker-compose up -d` (starts all services)

---

### Source Code

#### `src/app.js`
- **Purpose**: Express application entry point
- **Contains**:
  - Security middleware (helmet, cors)
  - Health check endpoint
  - Error handling
  - Server startup
- **Key functions**: `app.listen()` starts the server on port 3000

#### `src/config/database.js`
- **Purpose**: PostgreSQL connection pool management
- **Exports**:
  - `getPool()`: Get or create connection pool
  - `closePool()`: Gracefully close connections
- **Used by**: All database operations

#### `src/config/aws.js`
- **Purpose**: AWS SDK initialization
- **Initializes**: S3, SQS, Cognito clients
- **Configuration**: AWS region from environment

#### `src/config/environment.js`
- **Purpose**: Centralized configuration management
- **Validates**: All required environment variables on startup
- **Exports**: `config` object with all settings

#### `src/middleware/`
**To be created in Phase 2:**
- `auth.js`: JWT/Cognito authentication
- `errorHandler.js`: Global error handling
- `validation.js`: Request validation
- `logging.js`: Request/response logging

#### `src/routes/`
**To be created in Phase 2:**
- `episodes.js`: Episode endpoints
- `clips.js`: Clip endpoints
- `outfits.js`: Outfit endpoints
- `index.js`: Route aggregator

#### `src/controllers/`
**To be created in Phase 2:**
- `episodeController.js`: Episode business logic
- `clipController.js`: Clip business logic
- `outfitController.js`: Outfit business logic

#### `src/services/`
**To be created in Phase 2:**
- `episodeService.js`: Database queries for episodes
- `clipService.js`: Database queries for clips
- `outfitService.js`: Database queries for outfits
- `s3Service.js`: S3 file upload/download logic
- `cognitoService.js`: Cognito user management

#### `src/models/`
**To be created in Phase 1:**
- `Episode.js`: Episode schema definition
- `Clip.js`: Clip schema definition
- `Outfit.js`: Outfit schema definition

#### `src/utils/`
**To be created as needed:**
- `logger.js`: Logging utility
- `validators.js`: Validation helpers
- `formatters.js`: Response formatting

---

### Database & Scripts

#### `migrations/`
**To be created in Phase 1:**
- `001_create_shows_table.sql`
- `002_create_episodes_table.sql`
- `003_create_clips_table.sql`
- `004_create_outfits_table.sql`
- (and more for other tables)

#### `scripts/seed.js`
- **Purpose**: Populate database with test data
- **Includes**: 10 episodes, 30 clips, 20 outfits, etc
- **Show name**: "Styling Adventures w Lala"
- **How to run**: `npm run seed`
- **Idempotent**: Safe to run multiple times (clears old data first)

---

### Tests

#### `tests/setup.js`
- **Purpose**: Test environment configuration
- **Sets**: NODE_ENV=test, database URL for tests
- **Adds**: Custom matchers (e.g., `toBeValidUUID()`)

#### `tests/unit/app.test.js`
- **Purpose**: Example unit test
- **Tests**: Health check endpoint
- **Pattern**: Use this as template for other tests

#### `tests/integration/`
**To be created in Phase 2:**
- `episodes.integration.test.js`
- `clips.integration.test.js`
- `outfits.integration.test.js`

---

### Documentation

#### `README.md`
- **Purpose**: Project overview
- **Contains**:
  - Quick start guide
  - Project structure explanation
  - Available commands
  - API endpoint overview (coming)
  - Troubleshooting basics

#### `docs/AWS_SETUP.md`
- **Purpose**: Detailed AWS infrastructure setup
- **Contains**: Step-by-step commands for all AWS services
- **Who needs it**: DevOps lead during Phase 0

#### `docs/ENV_VARIABLES.md`
- **Purpose**: Complete environment variables reference
- **Contains**: What each variable does, examples, validation
- **Who needs it**: All developers for local setup

#### `docs/DEPLOYMENT.md`
- **Purpose**: How to deploy to staging and production
- **Contains**: Complete deployment procedures, rollback steps
- **Who needs it**: All developers before first deployment

#### `PHASE_0_CHECKLIST.md`
- **Purpose**: Week 1 implementation checklist
- **Contains**: Every task for Phase 0 with time estimates
- **Who needs it**: Both developers daily during Week 1

---

### CI/CD

#### `.github/workflows/ci-cd.yml`
- **Purpose**: GitHub Actions pipeline
- **Triggered by**: Push to main/develop, Pull Requests
- **Runs**:
  1. **Test job**: Linting, unit tests, coverage
  2. **Build job**: Docker image build & ECR push
  3. **Staging deploy**: Auto-deploy on develop merge
  4. **Production deploy**: Manual approval on main merge
- **Status**: Visible in GitHub PR checks

---

## 🔄 File Dependencies

```
app.js
  ├─→ config/environment.js
  ├─→ config/database.js (in Phase 2)
  ├─→ config/aws.js (in Phase 3)
  ├─→ routes/* (in Phase 2)
  └─→ middleware/* (in Phase 2)

config/database.js
  ├─→ .env
  └─→ package.json (pg driver)

config/aws.js
  ├─→ .env
  └─→ package.json (aws-sdk)

scripts/seed.js
  ├─→ config/database.js
  ├─→ src/models/* (in Phase 1)
  └─→ .env

jest.config.js & tests/*
  ├─→ src/app.js
  ├─→ src/controllers/* (Phase 2)
  ├─→ src/services/* (Phase 2)
  └─→ package.json (jest, supertest)

.github/workflows/ci-cd.yml
  ├─→ package.json (npm scripts)
  ├─→ Dockerfile
  └─→ AWS credentials (GitHub Secrets)
```

---

## 📥 How Files Are Created

### ✅ Already Created (Phase 0)
- [x] `.env.example` - Environment template
- [x] `.gitignore` - Git ignore rules
- [x] `.eslintrc.js` - Linting rules
- [x] `.prettierrc.js` - Formatting config
- [x] `package.json` - Dependencies
- [x] `jest.config.js` - Test config
- [x] `Dockerfile` - Docker image
- [x] `docker-compose.yml` - Dev containers
- [x] `src/app.js` - Express app
- [x] `src/config/*.js` - Configuration
- [x] `tests/setup.js` - Test setup
- [x] `tests/unit/app.test.js` - Example test
- [x] `scripts/seed.js` - Seed data
- [x] `.github/workflows/ci-cd.yml` - CI/CD pipeline
- [x] `README.md` - Project overview
- [x] `docs/AWS_SETUP.md` - AWS commands
- [x] `docs/ENV_VARIABLES.md` - Env reference
- [x] `docs/DEPLOYMENT.md` - Deployment guide
- [x] `PHASE_0_CHECKLIST.md` - Week 1 tasks

### 📝 To Be Created (Phase 1 - Weeks 2-3)
- [ ] `migrations/001_*.sql` - Database schema
- [ ] `src/models/` - Entity definitions
- [ ] `src/routes/` - API route handlers
- [ ] `src/controllers/` - Request handlers
- [ ] `src/services/` - Business logic
- [ ] `src/middleware/` - Auth, validation, error handling
- [ ] `src/utils/` - Helper functions
- [ ] `tests/integration/` - Integration tests
- [ ] `docs/TROUBLESHOOTING.md` - Troubleshooting guide
- [ ] `PHASE_1_CHECKLIST.md` - Weeks 2-3 checklist

### 🔮 Future (Phases 2-5)
- [ ] Lambda functions (Phase 4)
- [ ] Advanced features documentation
- [ ] Performance optimization guides
- [ ] Monitoring & alerting setup

---

## 🔐 What NOT To Commit

These files should NEVER be in git:

```
.env                           # Real environment variables
.env.local                     # Local overrides
node_modules/                  # Dependencies (generated by npm)
coverage/                      # Test coverage reports
dist/ & build/                 # Build outputs
.DS_Store                      # macOS system files
*.log                          # Log files
.vscode/settings.json          # Personal IDE settings
.idea/                         # IntelliJ IDE files
.aws/credentials               # AWS credentials
SAM_CACHE/                     # Serverless build cache
```

These are handled by `.gitignore` ✓

---

## 🎯 How to Navigate

**To get started:**
1. Start with `README.md` for overview
2. Follow `PHASE_0_CHECKLIST.md` for Week 1 tasks
3. Reference `docs/AWS_SETUP.md` for AWS commands
4. Use `.env.example` as a template

**When developing:**
1. Check `docs/ENV_VARIABLES.md` for config
2. Look at example test in `tests/unit/app.test.js`
3. Reference `package.json` for available commands
4. Use `docs/DEPLOYMENT.md` before deploying

**When debugging:**
1. Check `README.md` Troubleshooting section
2. Review `docs/DEPLOYMENT.md` rollback procedures
3. Search GitHub Issues for similar problems
4. Ask in Slack #episode-metadata channel

---

**Last Updated**: January 1, 2026  
**Total Files**: ~30 (core), grows with code  
**Git Repo**: `angelcreator113/Episode-Canonical-Control-Record`
