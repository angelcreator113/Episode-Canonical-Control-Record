# PROJECT STRUCTURE AUDIT REPORT

> **Generated:** June 2025  
> **Updated:** February 14, 2026 — **ALL CLEANUP COMPLETED**  
> **Purpose:** Full inventory of connected, disconnected, old, and unused files  
> **Goal:** "Make sure no one breaks anything"

---

## EXECUTIVE SUMMARY

### Current State (Post-Cleanup)

| Area | Total Files | Active/Connected | Archived to `_unused/` | Status |
|------|-----------|-----------------|----------------------|--------|
| **Root directory** | 34 | 34 (100%) | 0 | ✅ Clean |
| **`docs/`** | 494 | — | — | ✅ Organized |
| **`scripts/migrations/`** | 249 | — | — | ✅ Organized |
| **`scripts/tests/`** | 128 | — | — | ✅ Organized |
| **`scripts/deploy/`** | 93 | — | — | ✅ Organized |
| **Frontend (`frontend/src/`)** | 286 | ~186 | 100 in `_unused/` | ✅ Clean |
| **Backend (`src/`)** | 256 | ~252 | 4 in `_unused_models/` | ✅ Clean |
| **Backend (`backend/`)** | 0 | — | — | ✅ Deleted |

**Bottom line:** Root reduced from **847 → 34 files**. All dead files deleted. 100 orphaned frontend files archived to `frontend/src/_unused/`. 4 orphaned backend models archived to `src/_unused_models/`. Application builds and runs correctly.

---

## 1. WHAT YOU MUST NOT TOUCH (ACTIVE FILES)

### Frontend — Entry Chain
```
frontend/src/main.jsx
  └── frontend/src/App.jsx (45 imports, 41 routes)
        ├── Contexts: AuthContext, BulkSelectionContext, SearchFiltersContext
        ├── Layout: Header, Sidebar, ToastContainer, ErrorBoundary
        └── 38 Page routes (see list below)
```

### Backend — Entry Chain
```
package.json → "start": "node src/server.js"
  └── src/server.js → src/app.js
        ├── src/models/index.js (loads 55 models)
        ├── 51 route files mounted
        ├── 10 middleware files
        └── 39 service files
```

### Root — Only These 14 Files Are Active
| File | Purpose |
|------|---------|
| `app.js` | Re-export of `src/app.js` |
| `package.json` / `package-lock.json` | Dependencies |
| `.env` / `.env.production` / `.env.staging.local` | Environment config |
| `ecosystem.config.js` | PM2 process manager |
| `VERSION.txt` | Version tracking |
| `start-servers.ps1` / `start.bat` / `start.ps1` / `start.sh` / `START_APP.bat` / `START_APP.ps1` | App launchers |

---

## 2. FRONTEND — CONNECTED vs ORPHANED

### ✅ Connected Pages (38 routed in App.jsx)
Login, Home, EpisodeDetail, CreateEpisode, IconCueTimeline, SearchResults, ThumbnailGallery, CompositionLibrary, CompositionDetail, SceneLibrary, SceneDetail, AdminPanel, TemplateManagement, AuditLogViewer, AuditLog, ShowManagement, ShowDetail, CreateShow, EditShow, Wardrobe, WardrobeBrowser, WardrobeAnalytics, OutfitSets, WardrobeLibraryUpload, WardrobeLibraryDetail, TemplateStudio, TemplateDesigner, DiagnosticPage, DecisionAnalyticsDashboard, TimelineEditor, ExportPage, AnimaticPreview (+ 3 inline "Coming Soon" routes)

### ✅ Connected Components (imported by active pages)
Header, Sidebar, ErrorBoundary, ToastContainer, Toast, ShowForm, EpisodeCard, LoadingSpinner, ErrorMessage, TagInput, SceneComposerFull, SceneControlsPanel, Stage (index/Stage/StageFrame/StageRenderer), SaveIndicator, ExportDropdown, AnimaticPreview, LayoutEditor, SceneLibraryPicker, SceneLinking, WardrobeAssignmentModal, AdvancedSearchFilters, SearchHistory, EpisodeAssetsTab, EpisodeOverviewTab, EpisodeScriptTab, EpisodeSceneComposerTab, EpisodeDistributionTab, EpisodeKanbanBoard, EpisodeStatusBadge, AssetUploader, AssetLinkModal, MissingAssetPlaceholder, ShowAssetsTab, ShowDistributionTab, ShowInsightsTab, ShowWardrobeTab, StudioTab, LabelSelector, PreviewMonitor, Timeline

### ✅ Connected Hooks
useDecisionLogger, useSaveManager, useSearch

### ✅ Connected Services
api.js, assetService, authService, decisionService, episodeService, footageService, iconCueService, sceneLibraryService, sceneLinksService, sceneService, scriptsService, showService, templateService, thumbnailService, wardrobeLibraryService

### ✅ Connected Utils
constants.js, formatters.js, urlUtils.js, wardrobeEnhancements.js, workflowRouter.js

### ✅ Connected Contexts
AuthContext, BulkSelectionContext, SearchFiltersContext

### ✅ Connected Config / Constants
config/api.js, constants/canonicalRoles.js

---

### 🗑️ Dead Code (DELETE IMMEDIATELY)
| File | Location |
|------|----------|
| `ThumbnailComposer.jsx.backup` | pages/ |
| `WardrobeGallery.jsx.old` | pages/ |
| `WardrobeGallery.css.old` | pages/ |
| `WardrobeLibraryBrowser.jsx.old` | pages/ |
| `WardrobeLibraryBrowser.css.old` | pages/ |

### ⚠️ Orphaned Page (exists but NOT routed)
| File | Notes |
|------|-------|
| `ThumbnailComposer.jsx` + `.css` | No route in App.jsx |

### ⚠️ Orphaned Components — 44 files (not imported anywhere)

**Root components/ directory (35):**
| Component | Has CSS? |
|-----------|----------|
| AnalysisDashboard.jsx | No |
| AssetCard.jsx | Yes |
| AssetDetailsModal.jsx | Yes |
| AssetLibrary.jsx | Yes |
| AssetLibraryModal.jsx | No |
| AssetOverlay.jsx | No |
| AssetPreviewModal.jsx | Yes |
| AssetRolePicker.jsx | Yes |
| BatchCategoryModal.jsx | No |
| CategoryFilter.jsx | No |
| CharacterProfileEditor.jsx | No |
| CompositionCard.jsx | Yes |
| CompositionEditor.jsx | No |
| DecisionHistory.jsx | No |
| DecisionHistoryWithAnalytics.jsx | No |
| DecisionStats.jsx | No |
| EpisodeOverviewEnhanced.jsx | No |
| EpisodeTemplateSelector.jsx | No |
| EpisodeWardrobe.jsx | Yes |
| FilterPanel.jsx | Yes |
| GameShowComposer.jsx | No |
| LalaScriptGenerator.jsx | No |
| RawFootageUpload.jsx | No |
| SceneTimeline.jsx | No |
| ScriptAIAnalysis.jsx | No |
| ScriptGeneratorSmart.jsx | No |
| SearchWithCategoryFilter.jsx | No |
| ShowCard.jsx | No |
| TemplateSelector.jsx | No |
| ThumbnailSection.jsx | No |
| VersionHistoryPanel.jsx | Yes |
| WardrobeApprovalPanel.jsx | Yes |
| WardrobeCalendarView.jsx | No |
| WardrobeItemDrawer.jsx | Yes |
| YouTubeAnalyzer.jsx | No |

**Subdirectory components (9):**
| Component | Location |
|-----------|----------|
| EnhancedAssetPicker.jsx + .css | Assets/ |
| ClipPreviewPanel.jsx + .css | Episodes/ |
| ClipSequenceItem.jsx + .css | Episodes/ |
| ClipSequenceManager.css (no JSX) | Episodes/ |
| EpisodesList.jsx + .css | Episodes/ |
| ProductionPackageExporter.jsx | Episodes/ |
| SearchBar.jsx + .css | Search/ |
| ThumbnailGallery.jsx + .css | Thumbnails/ |
| Lightbox.jsx + .css | Thumbnails/ |

### ⚠️ Orphaned Hooks (6)
| Hook | Notes |
|------|-------|
| useAuth.js | Re-exports AuthContext — nobody uses this re-export |
| useEpisodeDetail.js | Not imported |
| useEpisodes.js | Only used by orphaned EpisodesList |
| useFetch.js | Not imported |
| useIconCues.js | Not imported |
| useThumbnails.js | Only used by orphaned ThumbnailGallery |

### ⚠️ Orphaned Services (5)
| Service | Notes |
|---------|-------|
| episodeAssetsService.js | Not imported |
| markerService.js | Not imported |
| sceneTemplateService.js | Not imported |
| testLogin.js | Standalone test script |
| wardrobeService.js | Referenced only in comments |

### ⚠️ Orphaned Utils (3)
assetUrlUtils.js, decisionLogger.js, validators.js

### ⚠️ Orphaned Constants (3)
assetRoles.js, roleLabels.js, thumbnailFormats.js

### ⚠️ Orphaned Contexts/Models/Mocks (3)
SceneContext.jsx, models/Show.js, mocks/mockEpisodes.js

### ⚠️ Orphaned Styles (9 standalone CSS files in styles/)
Assets-Bulk.css, Assets.css, AssetUpload.css, CompositionManagement.css, EpisodeForm.css, editor-layout.css, global.css, Home.css, ShowManagement.css

---

## 3. BACKEND — CONNECTED vs ORPHANED

### ✅ All 51 Route Files Mounted in app.js
(See full mount table in detailed audit. Every route file except `testS3.js` is mounted.)

### ⚠️ Unmounted Route File
| File | Notes |
|------|-------|
| `src/routes/testS3.js` | Exists but NOT mounted in app.js |

### ⚠️ Orphaned Model Files (6 — exist but NOT loaded by models/index.js)
| Model | Notes |
|-------|-------|
| `AssetRole.js` | File exists, not loaded |
| `AssetUsage.js` | Commented out: "Table doesn't exist" |
| `AuditLog.js` | File exists, not loaded |
| `file.js` | Lowercase duplicate — `FileStorage.js` is used instead |
| `job.js` | Lowercase — not loaded |
| `VideoComposition.js` | File exists, not loaded |

### ⚠️ `backend/` Directory (10 duplicate files — STALE)
The `backend/` directory at root contains copies of files already in `src/`:
```
backend/
├── migrations/
│   └── 20260125000001-add-asset-role-system.js
├── models/
│   ├── CompositionAsset.js    (duplicate of src/models/)
│   └── ThumbnailTemplate.js   (duplicate of src/models/)
└── src/
    ├── models/ (5 files, all duplicates of src/models/)
    ├── routes/ (2 files, all duplicates of src/routes/)
    └── utils/
        └── scriptParser.js     (duplicate of src/utils/)
```
**The app loads exclusively from `src/`.** The `backend/` directory is unused.

---

## 4. ROOT DIRECTORY — 875 FILES

### Breakdown
| Category | Count | Can Delete? |
|----------|------:|-------------|
| **Active runtime files** | 14 | ❌ NO |
| **Config files** | 39 | ❌ Keep |
| **Migration/setup scripts** | 163 | ⚠️ Move to `scripts/migrations/` |
| **Documentation (.md)** | 339 | ⚠️ Move to `docs/` |
| **Deployment scripts** | 37 | ⚠️ Move to `scripts/deploy/` |
| **Test/debug scripts** | 251 | ⚠️ Move to `scripts/tests/` |
| **Dead/obsolete** | 32 | ✅ DELETE |

### ⚠️ SECURITY CONCERN
`primepisodes-debug-key.pem` — **Private key file in root directory.** Check if this is committed to git. Should be added to `.gitignore` and removed from version control.

### 🗑️ Root Dead Files (DELETE)
- **Log files (8):** debug-middleware.log, debug-server.log, live-server.log, server-debug.log, server-full.log, server-output.log, server-startup.log, server-test.log
- **Build artifacts (4):** frontend-build.tar.gz, function.zip, lambda-deployment.zip, lambda_function.zip
- **Stale output (11):** eslint-report.json, id-token.txt, lint_output.txt, lint_output2.txt, project_files.txt, replace_episode_detail.txt, START_HERE_SYNC.txt, trigger-deploy.txt, test-final.txt, test-full-output.txt, TEST_RESULTS_FINAL.txt
- **Backup files (3):** src_app.js.bak, ThumbnailComposer-BACKUP-2026-01-27-1635.jsx, ANALYSIS_INTEGRATION_TEMPLATE.jsx
- **Test artifacts (2):** test-thumbnail.txt, test-image-upload.png
- **Stale SQL (1):** temp-query.sql
- **Sensitive (1):** primepisodes-debug-key.pem (move to secrets management)

---

## 5. SAFE TO DELETE — COMPLETE LIST

### Immediate deletion (won't break anything):

**Frontend (5 dead files):**
```
frontend/src/pages/ThumbnailComposer.jsx.backup
frontend/src/pages/WardrobeGallery.jsx.old
frontend/src/pages/WardrobeGallery.css.old
frontend/src/pages/WardrobeLibraryBrowser.jsx.old
frontend/src/pages/WardrobeLibraryBrowser.css.old
```

**Root (32 dead files):**
```
debug-middleware.log
debug-server.log
live-server.log
server-debug.log
server-full.log
server-output.log
server-startup.log
server-test.log
frontend-build.tar.gz
function.zip
lambda-deployment.zip
lambda_function.zip
eslint-report.json
id-token.txt
lint_output.txt
lint_output2.txt
project_files.txt
replace_episode_detail.txt
START_HERE_SYNC.txt
trigger-deploy.txt
test-final.txt
test-full-output.txt
TEST_RESULTS_FINAL.txt
src_app.js.bak
ThumbnailComposer-BACKUP-2026-01-27-1635.jsx
ANALYSIS_INTEGRATION_TEMPLATE.jsx
test-thumbnail.txt
test-image-upload.png
temp-query.sql
primepisodes-debug-key.pem (MOVE TO SECRETS — do not leave in repo)
```

**Backend duplicates (entire directory):**
```
backend/    (10 files — all duplicates of src/)
```

---

## 6. DO NOT DELETE (FUTURE USE / CAUTION)

The ~97 orphaned frontend components are NOT actively used but some may be **planned features**. Before deleting any orphaned component, check if it represents upcoming functionality:

| Likely Planned Features | Component |
|------------------------|-----------|
| Game show mode | GameShowComposer.jsx |
| YouTube integration | YouTubeAnalyzer.jsx |
| Script AI features | ScriptAIAnalysis.jsx, ScriptGeneratorSmart.jsx |
| Wardrobe approval workflow | WardrobeApprovalPanel.jsx |
| Version history | VersionHistoryPanel.jsx |
| Asset role system | AssetRolePicker.jsx |
| Character profiles | CharacterProfileEditor.jsx |
| Production packages | ProductionPackageExporter.jsx |
| Lala script generation | LalaScriptGenerator.jsx |

**Recommendation:** Move orphaned components to `frontend/src/components/_unused/` instead of deleting, so they're clearly marked but recoverable.

---

## 7. CLEANUP ACTIONS — ✅ ALL COMPLETED (Feb 14, 2026)

### Priority 1 — Security ✅
- [x] `.gitignore` already had `*.pem` and `*.key` — verified
- [x] `primepisodes-debug-key.pem` — file does not exist in project

### Priority 2 — Delete Dead Files ✅
- [x] 5 frontend `.old`/`.backup` files — already deleted in prior session
- [x] 32 root dead files (logs, zips, stale output) — already deleted in prior session
- [x] `backend/` directory (10 duplicate files) — already deleted in prior session

### Priority 3 — Organize Root ✅ (847 → 34 files)
- [x] 350 `.md` docs + text files → `docs/`
- [x] 249 migration/SQL scripts → `scripts/migrations/`
- [x] 128 test/debug scripts → `scripts/tests/`
- [x] 93 deploy scripts + infra configs → `scripts/deploy/`

### Priority 4 — Frontend Cleanup ✅ (100 files archived)
- [x] 46 orphaned root components → `frontend/src/_unused/components/`
- [x] 16 orphaned subdirectory components → `frontend/src/_unused/components/{Assets,Episodes,Search,Thumbnails}/`
- [x] 6 orphaned hooks → `frontend/src/_unused/hooks/`
- [x] 4 orphaned services → `frontend/src/_unused/services/`
- [x] 3 orphaned utils → `frontend/src/_unused/utils/`
- [x] 3 orphaned constants → `frontend/src/_unused/constants/`
- [x] 17 orphaned CSS → `frontend/src/_unused/styles/`
- [x] 2 orphaned pages + 1 context + 1 mock + 1 model → `frontend/src/_unused/`
- [x] Restored `wardrobeService.js` — was actively imported by EpisodeWardrobeTab

### Priority 5 — Backend Cleanup ✅ (4 files archived)
- [x] `AssetUsage.js`, `AuditLog.js`, `VideoComposition.js` → `src/_unused_models/`
- [x] `testS3.js` (unmounted route) → `src/_unused_models/`
- [x] Restored `job.js`, `file.js`, `AssetRole.js` — were actively referenced by routes/controllers

### Post-Cleanup Verification ✅
- [x] Frontend build: **passes** (`npx vite build` — 9.64s)
- [x] Backend server: **starts clean**, API returns HTTP 200
- [x] No broken imports or missing module errors

---

## 8. ROOT DIRECTORY — CURRENT STATE (34 files)

```
.env                        .env.example                .env.phase2.example
.env.production             .env.production.template    .env.staging.local
.eslintignore               .eslintrc.js                .eslintrc.json
.gitignore                  .pgmrc.json                 .prettierrc.js
.sequelizerc                app.js                      docker-compose.prod.yml
docker-compose.production.yml  docker-compose.staging.yml  docker-compose.test.yml
docker-compose.yml          Dockerfile                  Dockerfile.prod
ecosystem.config.js         jest.config.js              package.json
package-lock.json           PROJECT_AUDIT_REPORT.md     README.md
start.bat                   start.ps1                   start.sh
START_APP.bat               START_APP.ps1               start-servers.ps1
VERSION.txt
```
