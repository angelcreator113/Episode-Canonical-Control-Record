# 🧹 Repository Cleanup Plan

## Overview

This repository has accumulated significant technical debt with **352 markdown files** in the root directory. This document outlines a comprehensive cleanup plan to improve repository organization and maintainability.

---

## 📊 Current State Analysis

### Root Directory Issues

**Problem**: 352+ markdown documentation files in root directory, making navigation difficult.

**Categories of files found:**
- Phase documentation (PHASE_*.md) - ~80 files
- Session reports (SESSION_*.md) - ~20 files
- Completion reports (*_COMPLETE.md) - ~40 files
- Quick reference guides (QUICK_*.md) - ~15 files
- Implementation guides (*_IMPLEMENTATION*.md) - ~30 files
- Testing guides (TEST_*.md) - ~25 files
- Deployment guides (DEPLOYMENT_*.md) - ~20 files
- Various status, summary, and report files - ~122 files

### Additional Clutter

**Temporary/Test Files:**
- `debug-output.txt`
- `lint_output.txt`, `lint_output2.txt`
- `test-output.txt`, `test-output2.txt`, `test-output3.txt`
- `eslint-report.json`
- Various `test-*.txt` files

**Utility Scripts:**
- ~150+ `.js` and `.ps1` utility scripts in root
- Many are one-off migration/fix scripts
- Some appear to be duplicates or outdated

**Build/Deploy Artifacts:**
- `frontend-dist.zip`, `dist.tar.gz`
- Various backup files

---

## 🎯 Cleanup Goals

1. **Organize documentation** into logical folders
2. **Remove obsolete files** (completed phases, old reports)
3. **Archive historical documentation** for reference
4. **Consolidate duplicate documentation**
5. **Create clear navigation** structure
6. **Improve discoverability**

---

## 📁 Proposed Directory Structure

```
Episode-Canonical-Control-Record/
├── README.md                          # Main entry point
├── SECURITY.md                        # Security policies & contact
├── CONTRIBUTING.md                    # How to contribute
├── CHANGELOG.md                       # Version history
├── LICENSE                            # License file
│
├── docs/                              # All documentation
│   ├── README.md                      # Documentation index
│   ├── getting-started/
│   │   ├── quick-start.md
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   └── first-deployment.md
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── database-schema.md
│   │   ├── api-design.md
│   │   └── infrastructure.md
│   ├── guides/
│   │   ├── deployment/
│   │   │   ├── aws-setup.md
│   │   │   ├── staging.md
│   │   │   └── production.md
│   │   ├── development/
│   │   │   ├── local-setup.md
│   │   │   ├── testing.md
│   │   │   └── debugging.md
│   │   └── features/
│   │       ├── authentication.md
│   │       ├── asset-management.md
│   │       ├── wardrobe-system.md
│   │       └── composition-system.md
│   ├── api/
│   │   ├── reference.md
│   │   ├── episodes.md
│   │   ├── assets.md
│   │   └── wardrobe.md
│   ├── migration/
│   │   ├── database-migrations.md
│   │   └── data-migrations.md
│   └── archive/                       # Historical docs
│       ├── phases/                    # Phase documentation
│       │   ├── phase-0/
│       │   ├── phase-1/
│       │   ├── phase-2/
│       │   ├── phase-3/
│       │   ├── phase-4/
│       │   └── phase-5/
│       └── sessions/                  # Session reports
│           └── 2026/
│               ├── january/
│               └── february/
│
├── scripts/                           # Utility scripts
│   ├── README.md                      # Script documentation
│   ├── setup/                         # Setup scripts
│   ├── migration/                     # Migration scripts
│   ├── deployment/                    # Deployment scripts
│   ├── testing/                       # Test scripts
│   ├── utils/                         # Utility scripts
│   └── archive/                       # Old/obsolete scripts
│
├── src/                               # Application code
├── frontend/                          # Frontend code
├── migrations/                        # Database migrations
├── tests/                             # Test files
├── backend/                           # Backend code
└── infrastructure/                    # IaC files
    ├── terraform/                     # If using Terraform
    └── cloudformation/                # If using CloudFormation
```

---

## 🗂️ File Organization Plan

### Phase 1: Archive Historical Documentation

**Move to `docs/archive/phases/`:**

```bash
# Phase 0 files
PHASE_0_*.md → docs/archive/phases/phase-0/

# Phase 1 files  
PHASE_1_*.md → docs/archive/phases/phase-1/
README_PHASE_1.md → docs/archive/phases/phase-1/

# Phase 2 files
PHASE_2_*.md, PHASE_2A_*.md, PHASE_2B_*.md, etc. → docs/archive/phases/phase-2/

# Phase 3 files
PHASE_3_*.md, PHASE_3A_*.md, PHASE_3B_*.md → docs/archive/phases/phase-3/

# Phase 4 files
PHASE_4_*.md, PHASE_4A_*.md → docs/archive/phases/phase-4/

# Phase 5 files
PHASE_5_*.md → docs/archive/phases/phase-5/
```

**Move to `docs/archive/sessions/`:**
```bash
SESSION_*.md → docs/archive/sessions/2026/
*_SESSION_*.md → docs/archive/sessions/2026/
```

### Phase 2: Consolidate Current Documentation

**Active Documentation** (keep in root or move to docs/):

1. **README.md** - Main entry point ✅ Keep in root
2. **SECURITY_AUDIT_FINDINGS.md** - Current security issues ✅ Keep in root temporarily
3. **REPOSITORY_CLEANUP_PLAN.md** - This file ✅ Keep in root temporarily

**Move to `docs/`:**

```bash
# Getting Started
START_HERE.md → docs/getting-started/quick-start.md
QUICK_START.md → docs/getting-started/ (merge with quick-start.md)
000_READ_ME_FIRST.md → docs/getting-started/

# Architecture & Design
FILE_STRUCTURE.md → docs/architecture/structure.md
DATABASE_SETUP_GUIDE.md → docs/architecture/database.md

# Deployment Guides
DEPLOYMENT_GUIDE.md → docs/guides/deployment/overview.md
AWS_INFRASTRUCTURE_SETUP.md → docs/guides/deployment/aws-setup.md
STAGING_PRODUCTION_SETUP_COMPLETE.md → docs/guides/deployment/environments.md

# Feature Guides
WARDROBE_SYSTEM_IMPLEMENTATION.md → docs/guides/features/wardrobe.md
ASSET_MANAGER_COMPLETE.md → docs/guides/features/assets.md
COMPOSITION_SYSTEM_COMPLETE.md → docs/guides/features/compositions.md

# API Documentation
API_QUICK_REFERENCE.md → docs/api/reference.md

# Testing
TESTING_CHECKLIST.txt → docs/guides/development/testing.md
MANUAL_TESTING_GUIDE.md → docs/guides/development/manual-testing.md
```

### Phase 3: Organize Scripts

**Move scripts to organized folders:**

```bash
# Setup scripts
setup-*.ps1 → scripts/setup/
setup-*.sh → scripts/setup/
phase0*.ps1 → scripts/setup/

# Migration scripts
migrate-*.js → scripts/migration/
add-*.js → scripts/migration/
fix-*.js → scripts/migration/ (review each, many may be obsolete)
create-*-table.js → scripts/migration/

# Database scripts
check-*.js → scripts/utils/ (if still needed)
verify-*.js → scripts/utils/

# Deployment scripts
deploy-*.ps1 → scripts/deployment/
deploy-*.sh → scripts/deployment/

# Testing scripts
test-*.js → scripts/testing/ (except test files that should be in tests/)
test-*.ps1 → scripts/testing/
```

### Phase 4: Remove Obsolete Files

**Candidates for deletion** (review before deleting):

1. **Temporary output files:**
   ```bash
   debug-output.txt
   lint_output.txt, lint_output2.txt
   test-output.txt, test-output2.txt, test-output3.txt
   test-final.txt, test-results.txt
   eslint-report.json
   ```

2. **Completed/obsolete docs:**
   ```bash
   ALL_ISSUES_FIXED.md
   APPLICATION_RUNNING.md
   COMPLETE_PROJECT_STATUS.md
   SUCCESS_PACKAGE.md
   FULL_STACK_READY.md
   *_COMPLETE.md (if content is outdated)
   ```

3. **Duplicate or redundant docs:**
   - Multiple "QUICK_START" files
   - Multiple "START_HERE" files
   - Duplicate implementation guides

4. **Build artifacts:**
   ```bash
   frontend-dist.zip
   dist.tar.gz
   lambda_function.zip
   ThumbnailComposer-BACKUP-*.jsx
   ```

5. **One-off fix scripts** (after verifying they're not needed):
   ```bash
   fix-branding-emoji.py
   fix-emojis.ps1
   quick-fix.js
   clean-fix-app.js
   ```

---

## 🚀 Implementation Steps

### Step 1: Backup

```bash
# Create backup branch
git checkout -b backup/pre-cleanup
git push origin backup/pre-cleanup

# Or create archive
git archive -o repository-backup-$(date +%Y%m%d).tar.gz HEAD
```

### Step 2: Create New Structure

```bash
# Create new directories
mkdir -p docs/{getting-started,architecture,guides/{deployment,development,features},api,archive/{phases,sessions}}
mkdir -p scripts/{setup,migration,deployment,testing,utils,archive}
mkdir -p infrastructure
```

### Step 3: Move Files (Gradually)

```bash
# Example: Move phase documentation
git mv PHASE_0_*.md docs/archive/phases/phase-0/
git mv PHASE_1_*.md docs/archive/phases/phase-1/
# etc...

# Commit after each logical group
git commit -m "docs: organize phase 0 documentation"
git commit -m "docs: organize phase 1 documentation"
```

### Step 4: Update References

After moving files, update references in:
- [ ] README.md links
- [ ] Other documentation links
- [ ] CI/CD scripts that reference docs
- [ ] GitHub wiki (if exists)

### Step 5: Create Index Files

Create `README.md` in each new directory:
- `docs/README.md` - Documentation index
- `scripts/README.md` - Script documentation
- `docs/archive/README.md` - Archive note

### Step 6: Remove Obsolete Files

```bash
# Remove temporary files
git rm debug-output.txt lint_output*.txt test-output*.txt

# Remove completed milestone docs (after archiving)
git rm ALL_ISSUES_FIXED.md COMPLETE_PROJECT_STATUS.md

# Remove build artifacts
git rm frontend-dist.zip dist.tar.gz
```

---

## 📋 Priority Order

### 🔴 High Priority (Do First)

1. ✅ Move environment files to .gitignore (DONE)
2. Create backup branch
3. Move phase documentation to archive
4. Consolidate getting started guides
5. Remove temporary output files

### 🟡 Medium Priority (Do Soon)

6. Organize scripts into folders
7. Consolidate deployment documentation
8. Create documentation index
9. Update README with new structure
10. Remove duplicate documentation

### 🟢 Low Priority (Do Eventually)

11. Clean up old migration scripts
12. Review and remove obsolete scripts
13. Create comprehensive API docs
14. Add CONTRIBUTING.md guidelines
15. Update CI/CD documentation

---

## 🎓 Best Practices Going Forward

### Documentation

1. **Keep root clean**: Only essential files (README, LICENSE, CONTRIBUTING, SECURITY)
2. **Use docs/ folder**: All documentation goes in organized structure
3. **Archive old content**: Don't delete, move to archive with date
4. **One source of truth**: Consolidate duplicate documentation
5. **Update index**: Keep docs/README.md current with all documentation

### Scripts

1. **Organize by purpose**: setup, migration, deployment, testing, utils
2. **Document scripts**: Add README.md in scripts/ explaining each
3. **Archive old scripts**: Move to scripts/archive/ instead of deleting
4. **Use consistent naming**: `{action}-{resource}.{ext}`
   - Good: `deploy-staging.sh`, `migrate-database.js`
   - Bad: `script1.js`, `temp-fix.sh`

### Commits

1. **Incremental cleanup**: Small, logical commits
2. **Clear messages**: Use conventional commits
   - `docs: organize phase documentation`
   - `chore: remove temporary output files`
   - `refactor: reorganize scripts`
3. **Test after changes**: Ensure nothing breaks

---

## ✅ Success Metrics

After cleanup, we should have:
- ✅ < 10 files in root directory
- ✅ All documentation in docs/ with clear structure
- ✅ All scripts in scripts/ with clear organization
- ✅ No temporary or output files committed
- ✅ No duplicate documentation
- ✅ Clear navigation via README files
- ✅ Updated references and links

---

## 📞 Questions?

If unsure about any file:
1. Check Git history: `git log --follow <file>`
2. Check references: `git grep <filename>`
3. Ask team if file is still needed
4. When in doubt, archive instead of delete

---

**Created**: February 5, 2026
**Status**: 📋 Ready to implement
**Estimated Time**: 4-6 hours spread over several sessions
