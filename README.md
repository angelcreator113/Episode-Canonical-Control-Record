// ============================================================================
// COMPREHENSIVE PROJECT DOCUMENTATION
// ============================================================================

# Prime Studios - Episode Metadata API
## "Styling Adventures w Lala"

---

## 📋 Quick Start

### Prerequisites
- Node.js 20.x
- npm 9.x
- Docker & Docker Compose
- Git

### Local Development Setup

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git
   cd Episode-Canonical-Control-Record
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Setup environment variables**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your development values
   \`\`\`

4. **Start Docker services (PostgreSQL + Redis)**
   \`\`\`bash
   docker-compose up -d
   \`\`\`

5. **Run migrations**
   \`\`\`bash
   npm run migrate:up
   \`\`\`

6. **Seed sample data**
   \`\`\`bash
   npm run seed
   \`\`\`

7. **Start development server**
   \`\`\`bash
   npm run dev
   \`\`\`

   API will be available at: http://localhost:3000

---

## 📁 Project Structure

\`\`\`
episode-metadata-api/
├── src/
│   ├── app.js                 # Express app initialization
│   ├── config/
│   │   ├── database.js        # PostgreSQL connection pool
│   │   ├── aws.js             # AWS SDK configuration
│   │   └── environment.js     # Environment config
│   ├── middleware/            # Express middleware (auth, error handling, etc)
│   ├── routes/                # API route handlers
│   ├── controllers/           # Business logic for routes
│   ├── services/              # Database & external service calls
│   ├── models/                # Database model definitions
│   └── utils/                 # Helper functions
├── migrations/                # Database migration files
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── fixtures/              # Test data
├── scripts/
│   └── seed.js                # Seed data script
├── docs/                      # Documentation files
├── .github/workflows/         # CI/CD pipeline
├── Dockerfile                 # Container image definition
├── docker-compose.yml         # Local development containers
├── package.json               # Dependencies & scripts
├── .env.example               # Environment template
└── README.md                  # This file
\`\`\`

---

## 🚀 Available Commands

### Development
\`\`\`bash
npm run dev              # Start development server with hot reload
npm run lint            # Check code quality with ESLint
npm run lint:fix        # Fix linting issues automatically
npm run format          # Format code with Prettier
\`\`\`

### Testing
\`\`\`bash
npm test                # Run all tests with coverage
npm run test:unit       # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:watch      # Run tests in watch mode
\`\`\`

### Database
\`\`\`bash
npm run migrate:up      # Run pending migrations
npm run migrate:down    # Rollback last migration
npm run migrate:create <name>  # Create new migration
npm run seed            # Seed sample data
\`\`\`

### Production
\`\`\`bash
npm start               # Start production server
npm run docker:build    # Build Docker image
npm run docker:run      # Run Docker container
\`\`\`

---

## 🗄️ Database

### Local Development
PostgreSQL is automatically started via Docker Compose:
- Host: localhost
- Port: 5432
- Database: episode_metadata_dev
- Username: postgres
- Password: postgres

### AWS (Staging & Production)
Database connections configured via \`DATABASE_URL\` environment variable.

---

## 🔐 Authentication & Authorization

### Cognito Integration
User authentication via AWS Cognito with three user groups:
- **admin**: Full system access
- **editor**: Can create/edit episodes, clips, and outfits
- **viewer**: Read-only access

### Test Accounts
- admin@episodeidentityform.com (admin group)
- editor@episodeidentityform.com (editor group)
- viewer@episodeidentityform.com (viewer group)

---

## 📦 Seed Data

The system comes with sample data for testing:
- **Show**: "Styling Adventures w Lala"
- **Episodes**: 10 sample episodes
- **Clips**: 30 (10 from Lala, 10 from Woman In Her Prime, 10 from guests)
- **Outfits**: 20 sample wardrobe items
- **UI Elements**: 5 sample UI components
- **Backgrounds**: 3 sample backgrounds

Load seed data: \`npm run seed\`

---

## 🔄 API Endpoints (Coming Phase 1-2)

### Episodes
- \`GET /api/v1/episodes\` - List all episodes
- \`POST /api/v1/episodes\` - Create episode
- \`GET /api/v1/episodes/:id\` - Get episode details
- \`PUT /api/v1/episodes/:id\` - Update episode
- \`DELETE /api/v1/episodes/:id\` - Delete episode

### Scripts
- \`GET /api/v1/episodes/:id/scripts\` - Get episode script
- \`POST /api/v1/episodes/:id/scripts\` - Upload script

### Clips
- \`GET /api/v1/clips\` - List all clips
- \`POST /api/v1/clips\` - Create clip
- \`GET /api/v1/clips/:id\` - Get clip details

### Outfits
- \`GET /api/v1/outfits\` - List all outfits
- \`POST /api/v1/outfits\` - Create outfit
- \`GET /api/v1/outfits/:id\` - Get outfit details

---

## 📊 Environment Configurations

### Development (Local)
- Node: npm run dev
- Database: Local PostgreSQL
- AWS: Local credentials
- Debug: Verbose logging

### Staging (AWS)
- Deployed via: develop branch
- Database: RDS db.t3.small
- Auto-deployment: Yes
- Load testing: Enabled

### Production (AWS)
- Deployed via: main branch
- Database: RDS db.t3.medium with Multi-AZ
- Auto-deployment: Requires manual approval
- Monitoring: CloudWatch + alarms

---

## 📝 Deployment

### Local → Staging
1. Create feature branch: \`git checkout -b feature/xyz\`
2. Make changes and commit
3. Push to GitHub: \`git push origin feature/xyz\`
4. Create Pull Request to \`develop\` branch
5. After review, merge to \`develop\`
6. Automatic deployment to staging

### Staging → Production
1. Create Pull Request from \`develop\` to \`main\`
2. After testing in staging, get approval
3. Merge to \`main\` branch
4. Manual approval in GitHub Actions
5. Automatic deployment to production

---

## 🐛 Troubleshooting

### Database Connection Errors
\`\`\`bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View database logs
docker logs episode-metadata-postgres-dev
\`\`\`

### Port Already in Use
\`\`\`bash
# Change port in .env
PORT=3001

# Or kill process on port 3000
lsof -i :3000 | grep -v PID | awk '{print $2}' | xargs kill -9
\`\`\`

### Test Failures
\`\`\`bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/unit/services/episode.test.js
\`\`\`

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [AWS Documentation](https://docs.aws.amazon.com)
- [Jest Testing](https://jestjs.io)

---

## 🤝 Contributing

1. Create a feature branch from \`develop\`
2. Follow ESLint & Prettier rules
3. Write tests for new features
4. Submit PR with description
5. Request review from team

---

## 📅 Timeline

**Target Launch**: February 14, 2026
**Team**: 2 Full-Stack Developers
**Duration**: 8-10 weeks

**Phase Timeline**:
- Week 1: Phase 0 - Infrastructure Setup
- Weeks 2-3: Phase 1 - Database & Core API
- Weeks 4-5: Phase 2 - Authentication & Authorization
- Weeks 6-7: Phase 3 - File Upload & S3 Integration
- Weeks 8-9: Phase 4 - Advanced Features
- Week 10: Testing, Optimization & Launch Prep

---

**Last Updated**: January 1, 2026
**Status**: READY FOR EXECUTION ✓

# Test automated deployment
