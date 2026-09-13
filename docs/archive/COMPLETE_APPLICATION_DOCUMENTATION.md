# 🎬 Episode Canonical Control Record - Complete Application Documentation
## "Styling Adventures w Lala" - Prime Studios Content Management System

**Document Created:** February 4, 2026  
**Application Status:** ✅ PRODUCTION READY  
**Version:** 1.0.1  
**Team:** Prime Studios Development

---

## 📋 Executive Summary

**Episode Canonical Control Record** is a comprehensive, full-stack content management system specifically designed for Prime Studios' "Styling Adventures w Lala" video production series. It provides end-to-end management of episodes, assets, wardrobe, scenes, scripts, thumbnails, and distribution metadata with seamless AWS cloud integration.

### **Quick Facts**
- **Project Type:** Full-stack web application
- **Scale:** Enterprise-grade content management
- **Tech Stack:** React + Node.js + PostgreSQL + AWS
- **Total Files:** 600+ files
- **Documentation:** 200+ markdown files
- **Backend APIs:** 27 route modules, 100+ endpoints
- **Frontend Pages:** 50+ React components
- **Database:** 33+ tables
- **Cloud Services:** 6 AWS services integrated

### **Primary Use Cases**
1. Episode metadata management across multiple seasons
2. Asset library (images, videos, documents)
3. Wardrobe catalog and assignment tracking
4. Scene composition and timeline management
5. Thumbnail generation and distribution
6. Script management with full-text search
7. Search and discovery across all content
8. Audit trails and activity logging

---

## 🏗️ System Architecture

### **High-Level Overview**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              React SPA (Vite + TailwindCSS)                │    │
│  │  • 50+ Pages & Components  • State Management              │    │
│  │  • Real-time Updates       • Responsive Design             │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP/REST + WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │          Node.js + Express.js Backend API                  │    │
│  │  • Authentication/Authorization  • Business Logic          │    │
│  │  • File Upload Processing       • Real-time Events         │    │
│  │  • API Gateway                   • Error Handling          │    │
│  └──────────────┬─────────────────────┬───────────────────────┘    │
└─────────────────┼─────────────────────┼──────────────────────────────┘
                  │                     │
                  ▼                     ▼
┌────────────────────────────┐  ┌─────────────────────────────────────┐
│      DATA LAYER            │  │       CLOUD SERVICES LAYER          │
│                            │  │                                     │
│  ┌──────────────────────┐  │  │  ┌────────────────────────────┐   │
│  │   PostgreSQL (RDS)   │  │  │  │      AWS S3 Buckets        │   │
│  │   • 33+ Tables       │  │  │  │  • Assets Storage          │   │
│  │   • JSONB Support    │  │  │  │  • Thumbnails              │   │
│  │   • Full-text Search │  │  │  │  • Scripts                 │   │
│  │   • Relationships    │  │  │  └────────────────────────────┘   │
│  └──────────────────────┘  │  │                                     │
│                            │  │  ┌────────────────────────────┐   │
│  ┌──────────────────────┐  │  │  │   AWS Lambda Functions     │   │
│  │   Sequelize ORM      │  │  │  │  • Thumbnail Generation    │   │
│  │   • Models           │  │  │  │  • Image Processing        │   │
│  │   • Migrations       │  │  │  │  • Background Jobs         │   │
│  │   • Associations     │  │  │  └────────────────────────────┘   │
│  └──────────────────────┘  │  │                                     │
│                            │  │  ┌────────────────────────────┐   │
└────────────────────────────┘  │  │    AWS Cognito             │   │
                                │  │  • User Authentication      │   │
                                │  │  • JWT Token Management     │   │
                                │  └────────────────────────────┘   │
                                │                                     │
                                │  ┌────────────────────────────┐   │
                                │  │      AWS SQS Queues        │   │
                                │  │  • Processing Queue         │   │
                                │  │  • Job Notifications        │   │
                                │  └────────────────────────────┘   │
                                │                                     │
                                └─────────────────────────────────────┘
```

### **Technology Stack**

#### **Frontend**
- **Framework:** React 18
- **Build Tool:** Vite 5.x
- **Styling:** TailwindCSS 3.x + Custom CSS
- **State Management:** React Context API + Hooks
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **UI Components:** Custom component library
- **File Upload:** React Dropzone
- **Rich Text:** Draft.js / Quill
- **Charts:** Recharts / Chart.js

#### **Backend**
- **Runtime:** Node.js 20.x
- **Framework:** Express.js 4.x
- **ORM:** Sequelize 6.x
- **Authentication:** JWT + AWS Cognito
- **File Upload:** Multer + AWS SDK
- **Validation:** Joi / Express-validator
- **Testing:** Jest + Supertest
- **Process Manager:** PM2
- **Logging:** Winston

#### **Database**
- **RDBMS:** PostgreSQL 15.x
- **Hosted:** AWS RDS
- **Features Used:**
  - JSONB columns for flexible data
  - Full-text search (tsvector)
  - GIN indexes
  - Foreign key constraints
  - Soft deletes
  - Timestamps

#### **Cloud Services (AWS)**
- **S3:** Asset storage (images, videos, documents)
- **RDS:** PostgreSQL database hosting
- **Cognito:** User authentication and authorization
- **Lambda:** Serverless image processing
- **SQS:** Background job queues
- **CloudFront:** CDN for asset delivery

#### **DevOps**
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Version Control:** Git + GitHub
- **Environment Management:** dotenv
- **Code Quality:** ESLint + Prettier
- **Package Manager:** npm

---

## 📦 Core Modules & Features

### **1. Episode Management** 📺

**Purpose:** Complete lifecycle management of video episodes

**Files:**
- Backend: `src/models/Episode.js`, `src/routes/episodes.js`, `src/controllers/episodes.js`
- Frontend: `frontend/src/pages/Episodes.jsx`, `CreateEpisode.jsx`, `EditEpisode.jsx`, `EpisodeDetail.jsx`

**Features:**
- ✅ Create, edit, delete episodes
- ✅ Episode metadata management
  - Title, season, episode number
  - Air date, production date
  - Duration, status
  - Description, notes
- ✅ Category/tag system
- ✅ Episode status workflow (draft → review → approved → published)
- ✅ Template-based episode creation
- ✅ Batch operations on multiple episodes
- ✅ Episode search with filters
- ✅ Episode duplication/cloning
- ✅ Version history tracking
- ✅ Distribution metadata

**API Endpoints:** (9)
```
GET    /api/episodes           - List episodes with filters
GET    /api/episodes/:id       - Get single episode
POST   /api/episodes           - Create new episode
PUT    /api/episodes/:id       - Update episode
DELETE /api/episodes/:id       - Delete episode (soft)
GET    /api/episodes/:id/assets     - Get episode assets
POST   /api/episodes/:id/assets     - Add asset to episode
GET    /api/episodes/:id/wardrobe   - Get episode wardrobe
POST   /api/episodes/:id/wardrobe   - Add wardrobe to episode
```

**Database Tables:**
- `episodes` - Main episode data (20+ columns)
- `episode_assets` - Episode-asset relationships
- `episode_wardrobe` - Episode-wardrobe assignments
- `episode_templates` - Reusable episode templates
- `episode_scripts` - Episode scripts

---

### **2. Show Management** 📺🎬

**Purpose:** Organize episodes into shows/series

**Files:**
- Backend: `src/models/Show.js`, `src/routes/shows.js`
- Frontend: `frontend/src/pages/ShowManagement.jsx`, `components/ShowCard.jsx`

**Features:**
- ✅ Show/series creation and editing
- ✅ Show metadata (name, description, cover image)
- ✅ Season organization
- ✅ Show-level asset management
- ✅ Show statistics (episode count, total duration)
- ✅ Multi-show support

**API Endpoints:** (5)
```
GET    /api/shows              - List all shows
GET    /api/shows/:id          - Get single show
POST   /api/shows              - Create show
PUT    /api/shows/:id          - Update show
DELETE /api/shows/:id          - Delete show
```

**Database Tables:**
- `shows` - Show metadata
- `show_assets` - Show-level assets

---

### **3. Asset Management** 🖼️

**Purpose:** Centralized media asset library

**Files:**
- Backend: `src/models/Asset.js`, `src/routes/assets.js`, `src/controllers/assets.js`
- Frontend: `frontend/src/pages/AssetManager.jsx`, `AssetGallery.jsx`, `components/AssetCard.jsx`

**Features:**
- ✅ File upload to S3
- ✅ Asset types: Image, Video, Audio, Document
- ✅ Thumbnail generation (automatic)
- ✅ Asset metadata (name, type, size, dimensions)
- ✅ Asset labeling and tagging system
- ✅ Asset organization by type/category
- ✅ Asset approval workflow
- ✅ Usage tracking (where asset is used)
- ✅ Advanced search and filtering
- ✅ Bulk operations
- ✅ Asset versioning
- ✅ Asset preview/download
- ✅ Access control

**Asset Types Supported:**
- **Images:** JPG, PNG, GIF, WebP, SVG
- **Videos:** MP4, MOV, AVI, WebM
- **Audio:** MP3, WAV, AAC
- **Documents:** PDF, DOC, DOCX, TXT

**API Endpoints:** (15+)
```
GET    /api/assets                    - List assets (with filters)
GET    /api/assets/:id                - Get single asset
POST   /api/assets/upload             - Upload new asset
PUT    /api/assets/:id                - Update asset metadata
DELETE /api/assets/:id                - Delete asset
GET    /api/assets/:id/labels         - Get asset labels
POST   /api/assets/:id/labels         - Add labels to asset
DELETE /api/assets/:id/labels/:labelId - Remove label
GET    /api/assets/:id/usage          - Get usage stats
POST   /api/assets/:id/approve        - Approve asset
POST   /api/assets/batch-upload       - Bulk upload
GET    /api/assets/search             - Advanced search
```

**Database Tables:**
- `assets` - Main asset data
- `asset_labels` - Labels/tags for assets
- `asset_usage` - Usage tracking
- `episode_assets` - Episode-asset links
- `show_assets` - Show-asset links
- `scene_assets` - Scene-asset links

**AWS Integration:**
- S3 bucket for file storage
- CloudFront for CDN delivery
- Lambda for thumbnail generation

---

### **4. Wardrobe Management** 👗

**Purpose:** Comprehensive wardrobe/costume tracking system

**Files:**
- Backend: `src/models/Wardrobe.js`, `src/models/WardrobeLibrary.js`, `src/routes/wardrobe.js`, `src/routes/wardrobeLibrary.js`
- Frontend: `frontend/src/pages/WardrobeBrowser.jsx`, `WardrobeAnalytics.jsx`, `WardrobeLibraryDetail.jsx`, `OutfitSets.jsx`

**Features:**

**Tier 1: Episode-Specific Wardrobe**
- ✅ Wardrobe item cataloging
- ✅ Image upload with background removal
- ✅ Rich metadata (brand, color, season, occasion)
- ✅ Episode assignment tracking
- ✅ Character assignment
- ✅ Favorites system
- ✅ Search and filtering
- ✅ Budget tracking

**Tier 2: Wardrobe Library**
- ✅ Centralized wardrobe library
- ✅ Reusable items across episodes
- ✅ Outfit set composition
- ✅ Usage tracking across shows
- ✅ Analytics dashboard
- ✅ Most/least used items
- ✅ Cross-show usage reports
- ✅ Timeline view
- ✅ Calendar view
- ✅ Approval workflow

**Wardrobe Categories:**
- Dresses, Tops, Bottoms
- Shoes, Accessories
- Jewelry, Perfume

**Characters:**
- Lala
- JustAWoman
- Guest

**API Endpoints:** (40+)
```
# Episode Wardrobe
GET    /api/wardrobe                  - List wardrobe items
POST   /api/wardrobe                  - Create wardrobe item
GET    /api/wardrobe/:id              - Get item details
PUT    /api/wardrobe/:id              - Update item
DELETE /api/wardrobe/:id              - Delete item (soft)
GET    /api/wardrobe/staging          - Get unassigned items
POST   /api/wardrobe/:id/process-background - Remove background

# Wardrobe Library
GET    /api/wardrobe-library          - List library items
POST   /api/wardrobe-library          - Upload to library
GET    /api/wardrobe-library/:id      - Get library item
PUT    /api/wardrobe-library/:id      - Update library item
DELETE /api/wardrobe-library/:id      - Delete library item
POST   /api/wardrobe-library/:id/assign - Assign to episode
GET    /api/wardrobe-library/:id/usage - Get usage history
GET    /api/wardrobe-library/stats    - Get statistics
GET    /api/wardrobe-library/analytics/most-used - Most used items
GET    /api/wardrobe-library/analytics/never-used - Never used items

# Outfit Sets
GET    /api/wardrobe-library/:id/items - Get outfit items
POST   /api/wardrobe-library/:id/items - Add items to outfit
DELETE /api/wardrobe-library/:setId/items/:itemId - Remove item

# Tracking
POST   /api/wardrobe-library/:id/track-view - Track view
POST   /api/wardrobe-library/:id/track-selection - Track selection
GET    /api/wardrobe-library/:id/usage/shows - Cross-show usage
GET    /api/wardrobe-library/:id/usage/timeline - Usage timeline
```

**Database Tables:**
- `wardrobe` - Episode-specific items (26 columns)
- `wardrobe_library` - Reusable library (25+ columns)
- `episode_wardrobe` - Episode assignments (13 columns)
- `outfit_sets` - Outfit set definitions
- `outfit_set_items` - Outfit composition
- `wardrobe_usage_history` - Usage tracking
- `wardrobe_library_references` - S3 file references

**Special Features:**
- Background removal processing
- Budget tracking per character
- Approval workflow
- Calendar view of wardrobe usage
- Timeline view of item history
- Analytics dashboards

---

### **5. Scene Management** 🎬

**Purpose:** Scene-level organization and composition

**Files:**
- Backend: `src/models/Scene.js`, `src/routes/scenes.js`, `src/routes/sceneLibrary.js`, `src/routes/sceneTemplates.js`
- Frontend: `frontend/src/pages/Scenes/`, `SceneLibrary.jsx`, `SceneDetail.jsx`, `components/SceneComposer/`

**Features:**
- ✅ Scene creation and editing
- ✅ Scene templates
- ✅ Scene library (reusable scenes)
- ✅ Timeline organization
- ✅ Drag-and-drop scene ordering
- ✅ Scene asset associations
- ✅ Scene duration tracking
- ✅ Scene notes and metadata
- ✅ Scene search and filtering

**API Endpoints:** (12+)
```
# Scenes
GET    /api/scenes                - List scenes
POST   /api/scenes                - Create scene
GET    /api/scenes/:id            - Get scene
PUT    /api/scenes/:id            - Update scene
DELETE /api/scenes/:id            - Delete scene

# Scene Library
GET    /api/scene-library         - List library scenes
POST   /api/scene-library         - Add to library
GET    /api/scene-library/:id     - Get library scene

# Scene Templates
GET    /api/scene-templates       - List templates
POST   /api/scene-templates       - Create template
```

**Database Tables:**
- `scenes` - Scene data
- `scene_assets` - Scene-asset links
- `scene_templates` - Reusable templates

---

### **6. Thumbnail & Composition System** 🖼️

**Purpose:** Thumbnail generation and video composition management

**Files:**
- Backend: `src/models/Thumbnail.js`, `src/models/ThumbnailComposition.js`, `src/routes/thumbnails.js`, `src/routes/compositions.js`
- Frontend: `frontend/src/pages/ThumbnailComposer.jsx`, `ThumbnailGallery.jsx`, `CompositionLibrary.jsx`, `CompositionDetail.jsx`

**Features:**
- ✅ Thumbnail composition editor
- ✅ Layer-based composition
- ✅ Template system
- ✅ Asset selection and placement
- ✅ Text overlays
- ✅ Effects and filters
- ✅ Version history
- ✅ Export formats (PNG, JPG, PDF)
- ✅ Lambda-based processing
- ✅ Batch generation
- ✅ Template designer

**Composition Features:**
- Multiple layers support
- Asset positioning (x, y, width, height, rotation)
- Z-index ordering
- Opacity control
- Blending modes
- Text formatting
- Background customization

**API Endpoints:** (10+)
```
# Thumbnails
GET    /api/thumbnails            - List thumbnails
POST   /api/thumbnails            - Generate thumbnail
GET    /api/thumbnails/:id        - Get thumbnail
DELETE /api/thumbnails/:id        - Delete thumbnail

# Compositions
GET    /api/compositions          - List compositions
POST   /api/compositions          - Create composition
GET    /api/compositions/:id      - Get composition
PUT    /api/compositions/:id      - Update composition
DELETE /api/compositions/:id      - Delete composition
POST   /api/compositions/:id/export - Export composition
```

**Database Tables:**
- `thumbnails` - Thumbnail metadata
- `thumbnail_compositions` - Composition data
- `thumbnail_templates` - Reusable templates

**AWS Integration:**
- Lambda function for image processing
- S3 for thumbnail storage

---

### **7. Script Management** 📝

**Purpose:** Episode script management and collaboration

**Files:**
- Backend: `src/routes/scripts.js`, `src/models/Script.js`
- Frontend: `frontend/src/components/EpisodeScripts.jsx`

**Features:**
- ✅ Script upload and storage
- ✅ Full-text search in scripts
- ✅ Script versioning
- ✅ Edit tracking
- ✅ Script approval workflow
- ✅ Script templates
- ✅ Script comparison (diff)

**API Endpoints:** (8)
```
GET    /api/scripts                      - List scripts
POST   /api/scripts/upload               - Upload script
GET    /api/scripts/:id                  - Get script
PUT    /api/scripts/:id                  - Update script
DELETE /api/scripts/:id                  - Delete script
GET    /api/scripts/:id/versions         - Get versions
POST   /api/scripts/:id/approve          - Approve script
GET    /api/scripts/search               - Full-text search
```

**Database Tables:**
- `episode_scripts` - Scripts
- `script_edits` - Edit history

---

### **8. Search System** 🔍

**Purpose:** Global search across all content

**Files:**
- Backend: `src/routes/search.js`, `src/controllers/search.js`
- Frontend: `frontend/src/pages/SearchResults.jsx`, `components/Search/`

**Features:**
- ✅ Global search across episodes, assets, wardrobe, scenes
- ✅ Full-text search with relevance ranking
- ✅ Advanced filtering
- ✅ Search history tracking
- ✅ Saved searches
- ✅ Search suggestions/autocomplete
- ✅ Search analytics
- ✅ Category filtering
- ✅ Date range filtering
- ✅ Real-time search

**Search Targets:**
- Episodes (title, description, notes)
- Assets (name, labels, metadata)
- Wardrobe (name, brand, color, tags)
- Scenes (name, notes)
- Scripts (full-text content)

**API Endpoints:** (10)
```
GET    /api/search                       - Global search
GET    /api/search/episodes              - Search episodes
GET    /api/search/assets                - Search assets
GET    /api/search/wardrobe              - Search wardrobe
GET    /api/search/history               - Get search history
POST   /api/search/save                  - Save search
GET    /api/search/saved                 - Get saved searches
DELETE /api/search/saved/:id            - Delete saved search
GET    /api/search/suggestions           - Get suggestions
GET    /api/search/analytics             - Get analytics
```

**Database Tables:**
- `search_history` - Search history
- `saved_searches` - Saved searches
- `search_analytics` - Search metrics
- `search_suggestions` - Autocomplete data

**Implementation:**
- PostgreSQL full-text search (tsvector)
- GIN indexes for performance
- Relevance ranking
- Fuzzy matching (optional)

---

### **9. Template Management** 📋

**Purpose:** Reusable templates for episodes, scenes, and thumbnails

**Files:**
- Backend: `src/routes/templates.js`, `src/routes/templateStudio.js`
- Frontend: `frontend/src/pages/TemplateManagement.jsx`, `TemplateDesigner.jsx`, `TemplateStudio.jsx`

**Features:**
- ✅ Episode templates
- ✅ Scene templates
- ✅ Thumbnail templates
- ✅ Template creation and editing
- ✅ Template categorization
- ✅ Template preview
- ✅ Template usage tracking
- ✅ Template versioning

**Template Types:**
- **Episode Templates:** Predefined episode structures
- **Scene Templates:** Reusable scene configurations
- **Thumbnail Templates:** Design templates for thumbnails

**API Endpoints:** (12)
```
# General Templates
GET    /api/templates                    - List all templates
POST   /api/templates                    - Create template
GET    /api/templates/:id                - Get template
PUT    /api/templates/:id                - Update template
DELETE /api/templates/:id                - Delete template

# Template Studio
GET    /api/template-studio              - Get studio interface
POST   /api/template-studio/save         - Save template design

# Episode Templates
GET    /api/templates/episodes           - List episode templates
# Scene Templates
GET    /api/templates/scenes             - List scene templates
# Thumbnail Templates
GET    /api/templates/thumbnails         - List thumbnail templates
```

**Database Tables:**
- `episode_templates`
- `scene_templates`
- `thumbnail_templates`

---

### **10. Audit & Logging** 📊

**Purpose:** System activity tracking and audit trails

**Files:**
- Backend: `src/models/AuditLog.js`, `src/routes/auditLogs.js`
- Frontend: `frontend/src/pages/AuditLog.jsx`, `AuditLogViewer.jsx`

**Features:**
- ✅ User activity logging
- ✅ Data change tracking (CRUD operations)
- ✅ Login/logout tracking
- ✅ File access logging
- ✅ Search history
- ✅ Error logging
- ✅ Performance metrics
- ✅ Admin audit viewer
- ✅ Export audit logs

**Logged Events:**
- User authentication events
- CRUD operations on all entities
- File uploads/downloads
- Permission changes
- System configuration changes

**API Endpoints:** (6)
```
GET    /api/audit-logs                   - List audit logs
GET    /api/audit-logs/:id               - Get single log
GET    /api/audit-logs/user/:userId      - User activity
GET    /api/audit-logs/entity/:type/:id  - Entity history
GET    /api/audit-logs/export            - Export logs
POST   /api/audit-logs/query             - Advanced query
```

**Database Tables:**
- `audit_logs` - Complete audit trail
- `activity_logs` - User activity

---

### **11. Authentication & Authorization** 🔐

**Purpose:** User management and access control

**Files:**
- Backend: `src/routes/auth.js`, `src/middleware/auth.js`, `src/middleware/rbac.js`
- Frontend: `frontend/src/pages/Login.jsx`, `contexts/AuthContext.jsx`

**Features:**
- ✅ AWS Cognito integration
- ✅ User registration
- ✅ User login/logout
- ✅ Password reset
- ✅ Email verification
- ✅ JWT token management
- ✅ Token refresh
- ✅ Role-based access control (RBAC)
- ✅ Permission management
- ✅ Protected routes

**User Roles:**
- **Admin:** Full system access
- **Editor:** Content editing
- **Viewer:** Read-only access
- **Producer:** Episode management
- **Stylist:** Wardrobe management

**API Endpoints:** (10)
```
POST   /api/auth/register                - User registration
POST   /api/auth/login                   - User login
POST   /api/auth/logout                  - User logout
POST   /api/auth/refresh                 - Refresh token
POST   /api/auth/forgot-password         - Password reset request
POST   /api/auth/reset-password          - Reset password
GET    /api/auth/verify                  - Verify token
GET    /api/auth/me                      - Get current user
PUT    /api/auth/profile                 - Update profile
GET    /api/auth/roles                   - List roles
```

**AWS Integration:**
- AWS Cognito User Pool
- JWT token validation
- User attribute management

---

### **12. File Processing & Jobs** ⚙️

**Purpose:** Background job processing and file management

**Files:**
- Backend: `src/routes/processing.js`, `src/routes/jobs.js`, `src/models/ProcessingQueue.js`
- Frontend: `frontend/src/pages/ProcessingStatus.jsx`

**Features:**
- ✅ Background job queue (SQS)
- ✅ File upload processing
- ✅ Thumbnail generation
- ✅ Video transcoding (future)
- ✅ Background removal processing
- ✅ Bulk operations
- ✅ Job status tracking
- ✅ Job retry logic
- ✅ Job prioritization

**Job Types:**
- Image processing (resize, crop, optimize)
- Thumbnail generation
- Background removal
- Metadata extraction
- Bulk operations

**API Endpoints:** (8)
```
GET    /api/jobs                         - List jobs
GET    /api/jobs/:id                     - Get job status
POST   /api/jobs/process                 - Create processing job
DELETE /api/jobs/:id                     - Cancel job
POST   /api/jobs/:id/retry               - Retry failed job
GET    /api/processing/status            - System status
GET    /api/processing/queue             - Queue status
POST   /api/processing/bulk              - Bulk operation
```

**Database Tables:**
- `processing_queue` - Job queue
- `files` - File metadata
- `file_storage` - Storage tracking

**AWS Integration:**
- SQS for job queue
- Lambda for processing
- S3 for file storage

---

### **13. Admin Panel** 👤

**Purpose:** System administration and configuration

**Files:**
- Backend: `src/routes/admin.js`, `src/routes/roles.js`
- Frontend: `frontend/src/pages/AdminPanel.jsx`

**Features:**
- ✅ User management
- ✅ Role management
- ✅ Permission assignment
- ✅ System configuration
- ✅ Database management
- ✅ Cache management
- ✅ System health monitoring
- ✅ Backup management

**API Endpoints:** (15+)
```
# User Management
GET    /api/admin/users                  - List users
POST   /api/admin/users                  - Create user
PUT    /api/admin/users/:id              - Update user
DELETE /api/admin/users/:id              - Delete user

# Role Management
GET    /api/roles                        - List roles
POST   /api/roles                        - Create role
PUT    /api/roles/:id                    - Update role
DELETE /api/roles/:id                    - Delete role

# System
GET    /api/admin/health                 - System health
GET    /api/admin/stats                  - System statistics
POST   /api/admin/cache/clear            - Clear cache
```

---

## 🗄️ Complete Database Schema

### **Database Overview**

**Total Tables:** 33+  
**Relationships:** Complex many-to-many with junction tables  
**Indexes:** 100+ indexes for performance  
**Features:** JSONB, full-text search, soft deletes, timestamps

### **Table Categories**

#### **1. Content Management (5 tables)**
```
shows
├── id (UUID)
├── name (VARCHAR)
├── description (TEXT)
├── cover_image_url (TEXT)
├── created_at, updated_at, deleted_at

episodes
├── id (UUID)
├── show_id (FK → shows)
├── title (VARCHAR)
├── season (INTEGER)
├── episode_number (INTEGER)
├── air_date (DATE)
├── duration (INTEGER)
├── status (VARCHAR) - draft, review, approved, published
├── description (TEXT)
├── notes (TEXT)
├── metadata (JSONB)
├── created_at, updated_at, deleted_at

scenes
├── id (UUID)
├── episode_id (FK → episodes)
├── name (VARCHAR)
├── scene_number (INTEGER)
├── duration (INTEGER)
├── notes (TEXT)
├── created_at, updated_at, deleted_at

thumbnails
├── id (UUID)
├── episode_id (FK → episodes)
├── url (TEXT)
├── format (VARCHAR)
├── size (INTEGER)
├── metadata (JSONB)
├── created_at, updated_at

thumbnail_compositions
├── id (UUID)
├── episode_id (FK → episodes)
├── template_id (FK → thumbnail_templates)
├── composition_data (JSONB)
├── preview_url (TEXT)
├── version (INTEGER)
├── created_at, updated_at
```

#### **2. Asset Management (6 tables)**
```
assets
├── id (UUID)
├── name (VARCHAR)
├── type (VARCHAR) - image, video, audio, document
├── url (TEXT)
├── s3_key (VARCHAR)
├── thumbnail_url (TEXT)
├── size (BIGINT)
├── mime_type (VARCHAR)
├── dimensions (JSONB) - width, height
├── duration (INTEGER) - for video/audio
├── metadata (JSONB)
├── status (VARCHAR) - pending, approved, rejected
├── created_at, updated_at, deleted_at

asset_labels
├── id (UUID)
├── asset_id (FK → assets)
├── label (VARCHAR)
├── created_at

asset_usage
├── id (UUID)
├── asset_id (FK → assets)
├── entity_type (VARCHAR) - episode, show, scene
├── entity_id (UUID)
├── usage_count (INTEGER)
├── last_used_at (TIMESTAMP)

episode_assets (Junction)
├── id (UUID)
├── episode_id (FK → episodes)
├── asset_id (FK → assets)
├── role (VARCHAR) - thumbnail, cover, promotional
├── created_at

show_assets (Junction)
├── id (UUID)
├── show_id (FK → shows)
├── asset_id (FK → assets)
├── role (VARCHAR)
├── created_at

scene_assets (Junction)
├── id (UUID)
├── scene_id (FK → scenes)
├── asset_id (FK → assets)
├── role (VARCHAR)
├── created_at
```

#### **3. Wardrobe System (7 tables)**
```
wardrobe
├── id (UUID)
├── name (VARCHAR)
├── character (VARCHAR) - lala, justawoman, guest
├── clothing_category (VARCHAR)
├── description (TEXT)
├── s3_url (TEXT)
├── s3_url_processed (TEXT) - background removed
├── thumbnail_url (TEXT)
├── color (VARCHAR)
├── season (VARCHAR)
├── tags (TEXT[])
├── notes (TEXT)
├── is_favorite (BOOLEAN)
├── created_at, updated_at, deleted_at

wardrobe_library
├── id (SERIAL)
├── name (VARCHAR)
├── description (TEXT)
├── type (VARCHAR) - item, set
├── item_type (VARCHAR)
├── image_url (TEXT)
├── thumbnail_url (TEXT)
├── s3_key (VARCHAR)
├── default_character (VARCHAR)
├── default_occasion (VARCHAR)
├── default_season (VARCHAR)
├── color (VARCHAR)
├── tags (JSONB)
├── website (TEXT)
├── price (DECIMAL)
├── vendor (VARCHAR)
├── show_id (FK → shows)
├── total_usage_count (INTEGER)
├── last_used_at (TIMESTAMP)
├── view_count (INTEGER)
├── selection_count (INTEGER)
├── created_by, updated_by
├── created_at, updated_at, deleted_at

episode_wardrobe (Junction)
├── id (UUID)
├── episode_id (FK → episodes)
├── wardrobe_id (FK → wardrobe)
├── scene (VARCHAR)
├── worn_at (TIMESTAMP)
├── notes (TEXT)
├── approval_status (VARCHAR)
├── approved_by, approved_at
├── rejection_reason (TEXT)
├── override_character (VARCHAR)
├── override_occasion (VARCHAR)
├── override_season (VARCHAR)
├── created_at, updated_at

outfit_sets
├── id (UUID)
├── name (VARCHAR)
├── description (TEXT)
├── created_at, updated_at, deleted_at

outfit_set_items (Junction)
├── id (SERIAL)
├── outfit_set_id (FK → wardrobe_library)
├── wardrobe_item_id (FK → wardrobe_library)
├── position (INTEGER)
├── layer (VARCHAR) - base, mid, outer, accessory
├── is_optional (BOOLEAN)
├── notes (TEXT)
├── created_at

wardrobe_usage_history
├── id (SERIAL)
├── library_item_id (FK → wardrobe_library)
├── episode_id (FK → episodes)
├── scene_id (FK → scenes)
├── show_id (FK → shows)
├── usage_type (VARCHAR)
├── character (VARCHAR)
├── occasion (VARCHAR)
├── user_id (VARCHAR)
├── notes (TEXT)
├── metadata (JSONB)
├── created_at

wardrobe_library_references
├── id (SERIAL)
├── library_item_id (FK → wardrobe_library)
├── s3_key (VARCHAR)
├── reference_count (INTEGER)
├── file_size (BIGINT)
├── content_type (VARCHAR)
├── created_at, updated_at
```

#### **4. Script Management (2 tables)**
```
episode_scripts
├── id (UUID)
├── episode_id (FK → episodes)
├── content (TEXT)
├── format (VARCHAR) - pdf, txt, docx
├── s3_key (VARCHAR)
├── url (TEXT)
├── version (INTEGER)
├── status (VARCHAR)
├── created_at, updated_at, deleted_at

script_edits
├── id (UUID)
├── script_id (FK → episode_scripts)
├── edited_by (VARCHAR)
├── changes (JSONB)
├── notes (TEXT)
├── created_at
```

#### **5. Template System (3 tables)**
```
episode_templates
├── id (UUID)
├── name (VARCHAR)
├── description (TEXT)
├── template_data (JSONB)
├── created_at, updated_at

scene_templates
├── id (UUID)
├── name (VARCHAR)
├── description (TEXT)
├── template_data (JSONB)
├── created_at, updated_at

thumbnail_templates
├── id (UUID)
├── name (VARCHAR)
├── description (TEXT)
├── layout_data (JSONB)
├── preview_url (TEXT)
├── created_at, updated_at
```

#### **6. Search System (4 tables)**
```
search_history
├── id (UUID)
├── user_id (VARCHAR)
├── query (TEXT)
├── filters (JSONB)
├── result_count (INTEGER)
├── created_at

saved_searches
├── id (UUID)
├── user_id (VARCHAR)
├── name (VARCHAR)
├── query (TEXT)
├── filters (JSONB)
├── created_at, updated_at

search_analytics
├── id (UUID)
├── query (TEXT)
├── result_count (INTEGER)
├── click_through_rate (DECIMAL)
├── avg_position_clicked (DECIMAL)
├── created_at

search_suggestions
├── id (UUID)
├── term (VARCHAR)
├── frequency (INTEGER)
├── updated_at
```

#### **7. File & Processing (3 tables)**
```
files
├── id (UUID)
├── name (VARCHAR)
├── type (VARCHAR)
├── s3_key (VARCHAR)
├── url (TEXT)
├── size (BIGINT)
├── metadata (JSONB)
├── created_at, updated_at, deleted_at

file_storage
├── id (UUID)
├── file_id (FK → files)
├── storage_type (VARCHAR) - s3, local
├── location (TEXT)
├── created_at

processing_queue
├── id (UUID)
├── job_type (VARCHAR)
├── entity_type (VARCHAR)
├── entity_id (UUID)
├── status (VARCHAR) - pending, processing, completed, failed
├── priority (INTEGER)
├── data (JSONB)
├── error (TEXT)
├── started_at, completed_at
├── created_at, updated_at
```

#### **8. System Tables (3 tables)**
```
audit_logs
├── id (UUID)
├── user_id (VARCHAR)
├── action (VARCHAR)
├── entity_type (VARCHAR)
├── entity_id (UUID)
├── old_values (JSONB)
├── new_values (JSONB)
├── ip_address (VARCHAR)
├── user_agent (TEXT)
├── created_at

activity_logs
├── id (UUID)
├── user_id (VARCHAR)
├── activity_type (VARCHAR)
├── description (TEXT)
├── metadata (JSONB)
├── created_at

metadata_storage
├── id (UUID)
├── entity_type (VARCHAR)
├── entity_id (UUID)
├── key (VARCHAR)
├── value (JSONB)
├── created_at, updated_at
```

### **Key Database Features**

#### **Soft Deletes**
All major tables include `deleted_at` column:
```sql
WHERE deleted_at IS NULL  -- Active records only
```

#### **JSONB Usage**
Flexible data storage:
- `metadata` - Extended attributes
- `composition_data` - Complex layouts
- `template_data` - Template configurations
- `tags` - Array of tags

#### **Full-Text Search**
```sql
CREATE INDEX idx_episodes_search ON episodes 
USING GIN(to_tsvector('english', title || ' ' || description));
```

#### **Relationships**
- **One-to-Many:** Show → Episodes, Episode → Scenes
- **Many-to-Many:** Episodes ↔ Assets, Episodes ↔ Wardrobe
- **Polymorphic:** asset_usage references multiple entity types

---

## 📡 Complete API Reference

### **API Overview**

**Base URL:** `http://localhost:3002/api` (development)  
**Authentication:** JWT Bearer Token  
**Content-Type:** `application/json` (except file uploads: `multipart/form-data`)

### **Authentication Endpoints** (10)
```http
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/verify
GET    /api/auth/me
PUT    /api/auth/profile
GET    /api/auth/roles
```

### **Episode Endpoints** (9)
```http
GET    /api/episodes
GET    /api/episodes/:id
POST   /api/episodes
PUT    /api/episodes/:id
DELETE /api/episodes/:id
GET    /api/episodes/:id/assets
POST   /api/episodes/:id/assets
GET    /api/episodes/:id/wardrobe
POST   /api/episodes/:id/wardrobe
```

### **Show Endpoints** (5)
```http
GET    /api/shows
GET    /api/shows/:id
POST   /api/shows
PUT    /api/shows/:id
DELETE /api/shows/:id
```

### **Asset Endpoints** (15+)
```http
GET    /api/assets
GET    /api/assets/:id
POST   /api/assets/upload
PUT    /api/assets/:id
DELETE /api/assets/:id
GET    /api/assets/:id/labels
POST   /api/assets/:id/labels
DELETE /api/assets/:id/labels/:labelId
GET    /api/assets/:id/usage
POST   /api/assets/:id/approve
POST   /api/assets/batch-upload
GET    /api/assets/search
```

### **Wardrobe Endpoints** (40+)
```http
# Episode Wardrobe
GET    /api/wardrobe
POST   /api/wardrobe
GET    /api/wardrobe/:id
PUT    /api/wardrobe/:id
DELETE /api/wardrobe/:id
GET    /api/wardrobe/staging
POST   /api/wardrobe/:id/process-background
GET    /api/wardrobe/:id/usage

# Wardrobe Library
GET    /api/wardrobe-library
POST   /api/wardrobe-library
GET    /api/wardrobe-library/:id
PUT    /api/wardrobe-library/:id
DELETE /api/wardrobe-library/:id
POST   /api/wardrobe-library/:id/assign
GET    /api/wardrobe-library/:id/usage
GET    /api/wardrobe-library/:id/usage/shows
GET    /api/wardrobe-library/:id/usage/timeline
POST   /api/wardrobe-library/:id/track-view
POST   /api/wardrobe-library/:id/track-selection
GET    /api/wardrobe-library/stats
GET    /api/wardrobe-library/analytics/most-used
GET    /api/wardrobe-library/analytics/never-used
GET    /api/wardrobe-library/advanced-search
GET    /api/wardrobe-library/suggestions
GET    /api/wardrobe-library/check-duplicates
POST   /api/wardrobe-library/bulk-assign

# Outfit Sets
GET    /api/wardrobe-library/:id/items
POST   /api/wardrobe-library/:id/items
DELETE /api/wardrobe-library/:setId/items/:itemId
GET    /api/outfit-sets
POST   /api/outfit-sets
```

### **Scene Endpoints** (12+)
```http
GET    /api/scenes
POST   /api/scenes
GET    /api/scenes/:id
PUT    /api/scenes/:id
DELETE /api/scenes/:id
GET    /api/scene-library
POST   /api/scene-library
GET    /api/scene-library/:id
GET    /api/scene-templates
POST   /api/scene-templates
GET    /api/scene-templates/:id
PUT    /api/scene-templates/:id
```

### **Thumbnail & Composition Endpoints** (10+)
```http
GET    /api/thumbnails
POST   /api/thumbnails
GET    /api/thumbnails/:id
DELETE /api/thumbnails/:id
GET    /api/compositions
POST   /api/compositions
GET    /api/compositions/:id
PUT    /api/compositions/:id
DELETE /api/compositions/:id
POST   /api/compositions/:id/export
GET    /api/thumbnail-templates
POST   /api/thumbnail-templates
```

### **Script Endpoints** (8)
```http
GET    /api/scripts
POST   /api/scripts/upload
GET    /api/scripts/:id
PUT    /api/scripts/:id
DELETE /api/scripts/:id
GET    /api/scripts/:id/versions
POST   /api/scripts/:id/approve
GET    /api/scripts/search
```

### **Search Endpoints** (10)
```http
GET    /api/search
GET    /api/search/episodes
GET    /api/search/assets
GET    /api/search/wardrobe
GET    /api/search/history
POST   /api/search/save
GET    /api/search/saved
DELETE /api/search/saved/:id
GET    /api/search/suggestions
GET    /api/search/analytics
```

### **Template Endpoints** (12)
```http
GET    /api/templates
POST   /api/templates
GET    /api/templates/:id
PUT    /api/templates/:id
DELETE /api/templates/:id
GET    /api/template-studio
POST   /api/template-studio/save
GET    /api/templates/episodes
GET    /api/templates/scenes
GET    /api/templates/thumbnails
```

### **Audit Log Endpoints** (6)
```http
GET    /api/audit-logs
GET    /api/audit-logs/:id
GET    /api/audit-logs/user/:userId
GET    /api/audit-logs/entity/:type/:id
GET    /api/audit-logs/export
POST   /api/audit-logs/query
```

### **Processing & Jobs Endpoints** (8)
```http
GET    /api/jobs
GET    /api/jobs/:id
POST   /api/jobs/process
DELETE /api/jobs/:id
POST   /api/jobs/:id/retry
GET    /api/processing/status
GET    /api/processing/queue
POST   /api/processing/bulk
```

### **Admin Endpoints** (15+)
```http
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
GET    /api/roles
POST   /api/roles
PUT    /api/roles/:id
DELETE /api/roles/:id
GET    /api/admin/health
GET    /api/admin/stats
POST   /api/admin/cache/clear
```

### **Total API Endpoints: 100+**

---

## 🎨 Frontend Application

### **Frontend Overview**

**Framework:** React 18  
**Build Tool:** Vite 5  
**Styling:** TailwindCSS 3 + Custom CSS  
**Routing:** React Router v6  
**State:** Context API + Hooks

### **Page Components** (50+)

#### **Authentication**
- `Login.jsx` - Login page

#### **Episode Management**
- `Episodes.jsx` - Episode listing
- `CreateEpisode.jsx` - Create new episode
- `EditEpisode.jsx` - Edit existing episode
- `EpisodeDetail.jsx` - Episode details view

#### **Show Management**
- `ShowManagement.jsx` - Show listing and management
- `ShowCard.jsx` - Show card component

#### **Asset Management**
- `AssetManager.jsx` - Main asset manager
- `AssetGallery.jsx` - Asset gallery view
- `AssetCard.jsx` - Asset card component
- `AssetDetailsModal.jsx` - Asset details popup
- `AssetPreviewModal.jsx` - Asset preview

#### **Wardrobe**
- `Wardrobe.jsx` - Wardrobe main page
- `WardrobeBrowser.jsx` - Browse wardrobe items
- `WardrobeLibraryDetail.jsx` - Library item details
- `WardrobeLibraryUpload.jsx` - Upload to library
- `WardrobeAnalytics.jsx` - Analytics dashboard
- `OutfitSets.jsx` - Outfit set management
- `WardrobeCalendarView.jsx` - Calendar view
- `WardrobeTimelineView.jsx` - Timeline view

#### **Scene Management**
- `ScenesPage.jsx` - Scenes listing
- `SceneDetail.jsx` - Scene details
- `SceneLibrary.jsx` - Scene library
- `SceneComposePage.jsx` - Scene composition

#### **Thumbnails & Compositions**
- `ThumbnailComposer.jsx` - Thumbnail editor
- `ThumbnailGallery.jsx` - Thumbnail gallery
- `CompositionLibrary.jsx` - Composition library
- `CompositionDetail.jsx` - Composition details
- `TemplateDesigner.jsx` - Template designer
- `TemplateStudio.jsx` - Template studio

#### **Search**
- `SearchResults.jsx` - Search results page

#### **Templates**
- `TemplateManagement.jsx` - Template management

#### **Timeline**
- `TimelineEditor.jsx` - Timeline editor

#### **Admin**
- `AdminPanel.jsx` - Admin dashboard
- `AuditLog.jsx` - Audit log viewer
- `AuditLogViewer.jsx` - Detailed log viewer

#### **Misc**
- `Home.jsx` - Home/dashboard
- `DiagnosticPage.jsx` - System diagnostics

### **Reusable Components** (60+)

#### **Asset Components**
- `AssetCard.jsx`
- `AssetLibrary.jsx`
- `AssetOverlay.jsx`
- `AssetRolePicker.jsx`

#### **Episode Components**
- `EpisodeCard.jsx`
- `EpisodeAssetsTab.jsx`
- `EpisodeScripts.jsx`
- `EpisodeTemplateSelector.jsx`
- `EpisodeWardrobe.jsx`

#### **Wardrobe Components**
- `WardrobeApprovalPanel.jsx`
- `WardrobeAssignmentModal.jsx`
- `WardrobeItemDrawer.jsx`
- `OutfitSetComposer.jsx`

#### **Scene Components**
- `SceneComposer.jsx`
- `SceneLibraryPicker.jsx`
- `SortableTimelineScene.jsx`

#### **Composition Components**
- `CompositionCard.jsx`
- `CompositionEditor.jsx`
- `LayoutEditor.jsx`
- `VersionHistoryPanel.jsx`

#### **Timeline Components**
- `Timeline.jsx`
- `TimelineRuler.jsx`
- `TimelineScene.jsx`

#### **Search Components**
- `SearchWithCategoryFilter.jsx`
- `CategoryFilter.jsx`
- `FilterPanel.jsx`

#### **UI Components**
- `Header.jsx`
- `Navigation.jsx`
- `LoadingSpinner.jsx`
- `ErrorMessage.jsx`
- `ErrorBoundary.jsx`
- `Toast.jsx`
- `ToastContainer.jsx`
- `TagInput.jsx`
- `LabelSelector.jsx`
- `TemplateSelector.jsx`
- `VideoPlayer.jsx`
- `BatchCategoryModal.jsx`

### **Services** (API Layer)
```
services/
├── episodeService.js      - Episode API calls
├── assetService.js        - Asset API calls
├── wardrobeService.js     - Wardrobe API calls
├── sceneService.js        - Scene API calls
├── searchService.js       - Search API calls
├── authService.js         - Authentication
└── api.js                 - Base API client (Axios)
```

### **Contexts** (State Management)
```
contexts/
├── AuthContext.jsx        - Authentication state
├── ThemeContext.jsx       - Theme management
└── ToastContext.jsx       - Toast notifications
```

### **Hooks** (Custom Hooks)
```
hooks/
├── useAuth.js             - Authentication hook
├── useEpisodes.js         - Episodes data hook
├── useAssets.js           - Assets data hook
├── useWardrobe.js         - Wardrobe data hook
├── useSearch.js           - Search functionality
└── useFetch.js            - Generic fetch hook
```

---

## 🔄 How Everything Works Together

### **User Flow Example: Creating an Episode**

1. **User navigates to Episodes page**
   - Frontend: `Episodes.jsx` loads
   - API call: `GET /api/episodes`
   - Database: Query `episodes` table
   - Response: Episode list rendered

2. **User clicks "Create Episode"**
   - Frontend: Navigate to `CreateEpisode.jsx`
   - Form fields: title, season, episode number, etc.
   - Optional: Select from episode templates

3. **User fills form and clicks "Save"**
   - Frontend: `episodeService.createEpisode(data)`
   - API call: `POST /api/episodes`
   - Backend: `episodesController.create()`
   - Validation: Check required fields
   - Database: INSERT into `episodes` table
   - Audit log: Log creation event
   - Response: New episode object

4. **Episode created - User adds assets**
   - Frontend: Navigate to `EpisodeDetail.jsx`
   - Tab: "Assets"
   - Component: `EpisodeAssetsTab.jsx`
   - Click "Add Asset"

5. **User uploads asset**
   - Frontend: File picker (React Dropzone)
   - API call: `POST /api/assets/upload` (multipart/form-data)
   - Backend: Multer middleware processes file
   - AWS: Upload to S3 bucket
   - Lambda: Thumbnail generation triggered
   - Database: INSERT into `assets` table
   - Database: INSERT into `episode_assets` junction table
   - SQS: Job queued for processing
   - Response: Asset object with S3 URL

6. **User adds wardrobe**
   - Tab: "Wardrobe"
   - Component: `EpisodeWardrobe.jsx`
   - Browse: Wardrobe library
   - Select items: From library or create new
   - API call: `POST /api/episodes/:id/wardrobe/:wardrobeId`
   - Database: INSERT into `episode_wardrobe` junction table
   - Tracking: Log in `wardrobe_usage_history`

7. **User creates thumbnail**
   - Navigate to `ThumbnailComposer.jsx`
   - Select template or create from scratch
   - Add assets, text, effects
   - API call: `POST /api/compositions`
   - Database: INSERT into `thumbnail_compositions`
   - Lambda: Generate thumbnail image
   - S3: Store generated thumbnail
   - Database: UPDATE episode with thumbnail_url

8. **User publishes episode**
   - Backend: Change status to "published"
   - Database: UPDATE episode SET status = 'published'
   - Audit log: Log status change
   - Notifications: Send to subscribers (future)

### **Data Flow for Search**

1. **User types in search bar**
   - Frontend: `SearchWithCategoryFilter.jsx`
   - Real-time: Debounced input
   - API call: `GET /api/search/suggestions?q=...`
   - Response: Autocomplete suggestions

2. **User submits search**
   - API call: `GET /api/search?q=...&filters={...}`
   - Backend: `searchController.globalSearch()`
   - Database: Full-text search across multiple tables
   ```sql
   SELECT * FROM episodes 
   WHERE to_tsvector('english', title || ' ' || description) 
   @@ plainto_tsquery('english', 'search term')
   ORDER BY ts_rank(...)
   ```
   - Database: Log search in `search_history`
   - Response: Results with relevance scores

3. **User clicks result**
   - Navigate to detail page
   - Database: Log click in `search_analytics`
   - Database: UPDATE usage tracking

### **Wardrobe Assignment Workflow**

1. **Stylist uploads item to library**
   - Page: `WardrobeLibraryUpload.jsx`
   - Upload image
   - Fill metadata
   - API: `POST /api/wardrobe-library`
   - S3: Upload image
   - Database: INSERT `wardrobe_library`

2. **Producer assigns to episode**
   - Page: `EpisodeDetail.jsx` → Wardrobe tab
   - Browse library
   - Select item
   - API: `POST /api/wardrobe-library/:id/assign`
   - Database: INSERT `episode_wardrobe`
   - Database: INSERT `wardrobe_usage_history`
   - Database: UPDATE `wardrobe_library` usage counts

3. **Approval workflow (if enabled)**
   - Component: `WardrobeApprovalPanel.jsx`
   - Reviewer sees pending items
   - Approve/reject
   - API: `POST /api/wardrobe-approval/:id/approve`
   - Database: UPDATE `episode_wardrobe` SET approval_status

4. **Analytics tracking**
   - Every view: `POST /api/wardrobe-library/:id/track-view`
   - Every selection: `POST /api/wardrobe-library/:id/track-selection`
   - Database: UPDATE `wardrobe_library` counters
   - Database: INSERT `wardrobe_usage_history`

### **Background Processing Flow**

1. **User uploads large file**
   - Frontend: Upload with progress bar
   - API: `POST /api/assets/upload`
   - Backend: Save to S3
   - Database: INSERT `files` table
   - SQS: Send message to processing queue

2. **Lambda function processes**
   - Trigger: SQS message received
   - Lambda: Read file from S3
   - Processing: Resize, optimize, generate thumbnails
   - S3: Save processed files
   - Database: UPDATE `files` with processed URLs
   - SQS: Send completion notification

3. **Frontend polls for status**
   - API: `GET /api/jobs/:id`
   - Database: Query `processing_queue`
   - Response: Status (pending, processing, completed, failed)
   - Frontend: Update UI when completed

---

## 🔐 Security & Authentication

### **Authentication Flow**

1. **User Login**
   - Frontend: `Login.jsx`
   - API: `POST /api/auth/login`
   - AWS Cognito: Verify credentials
   - Backend: Generate JWT token
   - Response: Token + user data
   - Frontend: Store token in localStorage/cookies
   - Frontend: Set Authorization header for all requests

2. **Protected Routes**
   - Frontend: `PrivateRoute` wrapper
   - Check: Token exists
   - API: `GET /api/auth/verify`
   - Backend: Validate JWT
   - If valid: Render component
   - If invalid: Redirect to login

3. **Authorization (RBAC)**
   - Middleware: `checkPermission(resource, action)`
   - Check user role
   - Check permissions for role
   - Allow/deny request

### **Security Features**

- ✅ JWT token authentication
- ✅ Token refresh mechanism
- ✅ Password hashing (bcrypt)
- ✅ HTTPS only (production)
- ✅ CORS configuration
- ✅ Rate limiting (recommended)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (input sanitization)
- ✅ File upload validation
- ✅ S3 bucket permissions
- ✅ API key management
- ✅ Environment variable security

---

## 🚀 Deployment & Infrastructure

### **Development Environment**

```bash
# Backend
npm install
npm run dev  # Port 3002

# Frontend
cd frontend
npm install
npm run dev  # Port 5173

# Database
docker-compose up -d  # PostgreSQL on port 5432
```

### **Production Environment**

**Backend Deployment:**
- Docker container
- Deployed to AWS ECS/EC2
- PM2 process manager
- Port: 3000 (internal)

**Frontend Deployment:**
- Static build: `npm run build`
- Deploy to S3 + CloudFront
- Or containerized with Nginx

**Database:**
- AWS RDS PostgreSQL
- Multi-AZ deployment
- Automated backups
- Read replicas (optional)

### **AWS Services Used**

1. **S3 Buckets:**
   - `assets-bucket` - User uploaded assets
   - `thumbnails-bucket` - Generated thumbnails
   - `scripts-bucket` - Episode scripts
   - `frontend-bucket` - Static frontend (optional)

2. **RDS:**
   - PostgreSQL 15.x
   - Instance: t3.medium (staging) / t3.large (prod)
   - Storage: 100GB SSD

3. **Lambda:**
   - `thumbnail-generator` - Image processing
   - Runtime: Node.js 20
   - Memory: 1024MB
   - Timeout: 30s

4. **Cognito:**
   - User Pool for authentication
   - OAuth 2.0 / OpenID Connect

5. **SQS:**
   - `processing-queue` - Background jobs
   - FIFO queue for ordering

6. **CloudFront:** (Optional)
   - CDN for asset delivery
   - Origin: S3 buckets

---

## 📊 Performance & Optimization

### **Database Optimization**

- **Indexes:** 100+ indexes on foreign keys, search fields
- **JSONB Indexes:** GIN indexes for JSONB columns
- **Full-text Search:** tsvector indexes
- **Query Optimization:** EXPLAIN ANALYZE for slow queries
- **Connection Pooling:** Max 20 connections
- **Query Caching:** Redis (optional)

### **Frontend Optimization**

- **Code Splitting:** React.lazy() for routes
- **Bundle Size:** Vite tree-shaking
- **Image Optimization:** Lazy loading, srcset
- **Caching:** Service worker (optional)
- **CDN:** CloudFront for static assets

### **API Optimization**

- **Pagination:** All list endpoints
- **Compression:** gzip/brotli
- **Caching:** ETag headers
- **Rate Limiting:** Redis-based (recommended)
- **Load Balancing:** ALB (production)

---

## 🧪 Testing

### **Backend Testing**

**Framework:** Jest + Supertest

**Test Coverage:**
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- API tests: Route testing

**Run Tests:**
```bash
npm test
npm run test:unit
npm run test:integration
```

### **Frontend Testing**

**Framework:** React Testing Library + Jest

**Test Types:**
- Component tests
- Integration tests
- E2E tests (Cypress - optional)

---

## 📁 Project File Structure

```
Episode-Canonical-Control-Record-1/
│
├── 📁 src/                                 # Backend Source Code
│   ├── app.js                              # Express app setup
│   ├── server.js                           # Server entry point
│   ├── db.js                               # Database connection
│   │
│   ├── 📁 config/                          # Configuration
│   │   ├── database.js
│   │   ├── aws.js
│   │   └── environment.js
│   │
│   ├── 📁 constants/                       # Constants
│   │   └── index.js
│   │
│   ├── 📁 controllers/                     # Route Controllers (20+)
│   │   ├── episodes.js
│   │   ├── assets.js
│   │   ├── wardrobe.js
│   │   ├── wardrobeLibrary.js
│   │   ├── scenes.js
│   │   ├── thumbnails.js
│   │   ├── search.js
│   │   ├── auth.js
│   │   └── ...
│   │
│   ├── 📁 models/                          # Sequelize Models (29 files)
│   │   ├── index.js                        # Model associations
│   │   ├── Episode.js
│   │   ├── Show.js
│   │   ├── Asset.js
│   │   ├── Wardrobe.js
│   │   ├── WardrobeLibrary.js
│   │   ├── Scene.js
│   │   ├── Thumbnail.js
│   │   ├── Script.js
│   │   └── ...
│   │
│   ├── 📁 routes/                          # API Routes (27 files)
│   │   ├── episodes.js
│   │   ├── shows.js
│   │   ├── assets.js
│   │   ├── wardrobe.js
│   │   ├── wardrobeLibrary.js
│   │   ├── scenes.js
│   │   ├── sceneLibrary.js
│   │   ├── sceneTemplates.js
│   │   ├── thumbnails.js
│   │   ├── compositions.js
│   │   ├── scripts.js
│   │   ├── search.js
│   │   ├── auth.js
│   │   ├── admin.js
│   │   ├── roles.js
│   │   ├── auditLogs.js
│   │   ├── templates.js
│   │   ├── templateStudio.js
│   │   ├── processing.js
│   │   ├── jobs.js
│   │   └── ...
│   │
│   ├── 📁 middleware/                      # Express Middleware
│   │   ├── auth.js                         # Authentication
│   │   ├── rbac.js                         # Authorization
│   │   ├── errorHandler.js                 # Error handling
│   │   ├── validation.js                   # Input validation
│   │   └── upload.js                       # File upload (Multer)
│   │
│   ├── 📁 services/                        # Business Logic Services
│   │   ├── s3Service.js                    # S3 operations
│   │   ├── cognitoService.js               # Cognito auth
│   │   ├── sqsService.js                   # SQS queue
│   │   └── ...
│   │
│   ├── 📁 utils/                           # Helper Functions
│   │   ├── logger.js                       # Winston logger
│   │   ├── validators.js                   # Validation helpers
│   │   └── ...
│   │
│   └── 📁 migrations/                      # Database Migrations
│       └── [timestamp]-migration-name.js
│
├── 📁 frontend/                            # React Frontend
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   │
│   └── 📁 src/
│       ├── main.jsx                        # Entry point
│       ├── App.jsx                         # Main app component
│       │
│       ├── 📁 pages/                       # Page Components (50+)
│       │   ├── Home.jsx
│       │   ├── Login.jsx
│       │   ├── Episodes.jsx
│       │   ├── CreateEpisode.jsx
│       │   ├── EditEpisode.jsx
│       │   ├── EpisodeDetail.jsx
│       │   ├── ShowManagement.jsx
│       │   ├── AssetManager.jsx
│       │   ├── AssetGallery.jsx
│       │   ├── WardrobeBrowser.jsx
│       │   ├── WardrobeAnalytics.jsx
│       │   ├── OutfitSets.jsx
│       │   ├── ScenesPage.jsx
│       │   ├── SceneDetail.jsx
│       │   ├── SceneLibrary.jsx
│       │   ├── ThumbnailComposer.jsx
│       │   ├── ThumbnailGallery.jsx
│       │   ├── CompositionLibrary.jsx
│       │   ├── SearchResults.jsx
│       │   ├── TemplateManagement.jsx
│       │   ├── AdminPanel.jsx
│       │   ├── AuditLog.jsx
│       │   └── ...
│       │
│       ├── 📁 components/                  # Reusable Components (60+)
│       │   ├── Header.jsx
│       │   ├── Navigation.jsx
│       │   ├── LoadingSpinner.jsx
│       │   ├── ErrorBoundary.jsx
│       │   ├── Toast.jsx
│       │   │
│       │   ├── 📁 Assets/
│       │   │   ├── AssetCard.jsx
│       │   │   ├── AssetLibrary.jsx
│       │   │   └── ...
│       │   │
│       │   ├── 📁 Episodes/
│       │   │   ├── EpisodeCard.jsx
│       │   │   ├── EpisodeWardrobe.jsx
│       │   │   └── ...
│       │   │
│       │   ├── 📁 Scenes/
│       │   │   ├── SceneComposer.jsx
│       │   │   └── ...
│       │   │
│       │   ├── 📁 Search/
│       │   │   └── SearchWithCategoryFilter.jsx
│       │   │
│       │   └── 📁 Timeline/
│       │       ├── Timeline.jsx
│       │       └── ...
│       │
│       ├── 📁 services/                    # API Services
│       │   ├── api.js                      # Axios instance
│       │   ├── episodeService.js
│       │   ├── assetService.js
│       │   ├── wardrobeService.js
│       │   ├── authService.js
│       │   └── ...
│       │
│       ├── 📁 contexts/                    # React Contexts
│       │   ├── AuthContext.jsx
│       │   ├── ThemeContext.jsx
│       │   └── ToastContext.jsx
│       │
│       ├── 📁 hooks/                       # Custom Hooks
│       │   ├── useAuth.js
│       │   ├── useEpisodes.js
│       │   ├── useFetch.js
│       │   └── ...
│       │
│       └── 📁 utils/                       # Frontend Utils
│           └── helpers.js
│
├── 📁 tests/                               # Test Suite
│   ├── unit/
│   └── integration/
│
├── 📁 scripts/                             # Utility Scripts (100+)
│   ├── seed.js
│   ├── migrate-wardrobe.js
│   ├── check-schema.js
│   └── ...
│
├── 📁 docs/                                # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── ...
│
├── 📁 migrations/                          # Sequelize Migrations
│   └── [timestamp]-migration.js
│
├── 📄 Configuration Files
│   ├── package.json                        # Backend dependencies
│   ├── .env.example                        # Environment template
│   ├── .env.development                    # Dev environment
│   ├── .env.staging                        # Staging environment
│   ├── .env.production                     # Prod environment
│   ├── docker-compose.yml                  # Docker setup
│   ├── Dockerfile                          # Backend container
│   ├── ecosystem.config.js                 # PM2 config
│   ├── .eslintrc.js                        # ESLint config
│   └── .prettierrc.js                      # Prettier config
│
└── 📄 Documentation Files (200+)
    ├── README.md
    ├── 000_READ_ME_FIRST.md
    ├── WARDROBE_SYSTEM_HANDOFF_DOCUMENTATION.md
    ├── PROJECT_MANAGER_HANDOFF.md
    ├── COMPLETE_APPLICATION_DOCUMENTATION.md (this file)
    └── ...
```

---

## 🎯 Key Features Summary

### **Content Management**
✅ Episode creation and management  
✅ Show organization  
✅ Scene composition  
✅ Script management  
✅ Template system  

### **Asset Management**
✅ File upload to S3  
✅ Asset organization  
✅ Thumbnail generation  
✅ Usage tracking  
✅ Search and filtering  

### **Wardrobe System**
✅ Wardrobe cataloging  
✅ Library management  
✅ Outfit sets  
✅ Usage analytics  
✅ Approval workflow  
✅ Budget tracking  

### **Search & Discovery**
✅ Global search  
✅ Full-text search  
✅ Search history  
✅ Saved searches  
✅ Analytics  

### **Collaboration**
✅ Multi-user support  
✅ Role-based access  
✅ Approval workflows  
✅ Activity tracking  
✅ Audit logs  

### **Processing**
✅ Background jobs  
✅ Image processing  
✅ Thumbnail generation  
✅ Bulk operations  

---

## 📈 System Statistics

| Metric | Count |
|--------|-------|
| **Total Files** | 600+ |
| **Documentation Files** | 200+ |
| **Backend Routes** | 27 modules |
| **API Endpoints** | 100+ |
| **Database Tables** | 33+ |
| **Frontend Pages** | 50+ |
| **Reusable Components** | 60+ |
| **Sequelize Models** | 29 |
| **Middleware** | 10+ |
| **AWS Services** | 6 |
| **Lines of Code** | 50,000+ |

---

## 🚦 Quick Start Guide

### **For Developers**

```bash
# 1. Clone repository
git clone [repo-url]
cd Episode-Canonical-Control-Record-1

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Setup environment
cp .env.example .env
# Edit .env with your values

# 4. Start database
docker-compose up -d

# 5. Run migrations
npm run migrate:up

# 6. Seed data
npm run seed

# 7. Start backend
npm run dev  # Port 3002

# 8. Start frontend (new terminal)
cd frontend
npm run dev  # Port 5173

# 9. Access application
http://localhost:5173
```

### **For Project Managers**

1. **Access System:**
   - URL: http://localhost:5173 (dev) or production URL
   - Login with your credentials

2. **Create Episode:**
   - Navigate to Episodes → Create
   - Fill in metadata
   - Add assets, wardrobe, scenes
   - Publish

3. **Manage Wardrobe:**
   - Navigate to Wardrobe → Library
   - Upload items
   - Assign to episodes
   - Track usage

4. **View Analytics:**
   - Navigate to Wardrobe → Analytics
   - View usage statistics
   - Export reports

---

## 📞 Support & Resources

### **Documentation**
- [README.md](README.md) - Quick start
- [PROJECT_MANAGER_HANDOFF.md](PROJECT_MANAGER_HANDOFF.md) - PM guide
- [WARDROBE_SYSTEM_HANDOFF_DOCUMENTATION.md](WARDROBE_SYSTEM_HANDOFF_DOCUMENTATION.md) - Wardrobe docs
- [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) - API docs

### **Troubleshooting**
- Check logs: `logs/` directory
- Check console: Browser developer tools
- Check database: pgAdmin or psql
- Check AWS: CloudWatch logs

### **Contact**
- Backend Developer: [Contact Info]
- Frontend Developer: [Contact Info]
- DevOps: [Contact Info]
- Project Manager: [Contact Info]

---

## 🎉 Conclusion

**Episode Canonical Control Record** is a comprehensive, production-ready content management system with:

✅ Full-stack architecture (React + Node.js + PostgreSQL)  
✅ 100+ API endpoints across 12+ core modules  
✅ 33+ database tables with complex relationships  
✅ Complete wardrobe management system  
✅ Advanced search and filtering  
✅ AWS cloud integration  
✅ Role-based access control  
✅ Audit trails and logging  
✅ Background job processing  
✅ Thumbnail composition system  

**Ready for production deployment and active use!**

---

**Document Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** ✅ COMPLETE & PRODUCTION READY  
**Next Review:** As needed

---

*For specific module documentation, refer to individual module handoff documents. For technical questions, contact the development team.*
