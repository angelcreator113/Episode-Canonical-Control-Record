# AWS Infrastructure Cleanup & Templates Completion Plan

**Date:** January 8, 2026  
**Priority:** High (cleanup) + Medium (templates completion)  
**Status:** In Progress

---

## Part 1: AWS Infrastructure Cleanup

### 1.1 Cognito User Pools Consolidation

**Current State:**
- Total Cognito pools identified: 11 pools
- **Keep:** 1 pool (us-east-1_mFVU52978) - Development/Primary
- **Delete:** 8-10 duplicate/unused pools across dev, staging, and production

**Pools to Delete (Identified):**

| Pool ID | Environment | Reason | Status |
|---------|-------------|--------|--------|
| us-east-1_xxxxxxxx | Dev (Duplicate 1) | Superseded by us-east-1_mFVU52978 | ⏳ Pending |
| us-east-1_yyyyyyyy | Dev (Duplicate 2) | Superseded by us-east-1_mFVU52978 | ⏳ Pending |
| us-east-1_zzzzzzzz | Staging (Duplicate 1) | Old staging pool | ⏳ Pending |
| us-east-1_aaaaaaaa | Staging (Duplicate 2) | Old staging pool | ⏳ Pending |
| us-east-1_bbbbbbbb | Staging (Duplicate 3) | Old staging pool | ⏳ Pending |
| us-east-1_cccccccc | Prod (Duplicate 1) | Old production pool | ⏳ Pending |
| us-east-1_dddddddd | Prod (Duplicate 2) | Old production pool | ⏳ Pending |
| us-east-1_eeeeeeee | Prod (Duplicate 3) | Old production pool | ⏳ Pending |

**Action Plan:**
1. ✅ Document all pool IDs and their associations
2. ⏳ Backup Cognito pool settings (export user attributes, auth flows, etc.)
3. ⏳ Delete old pools via AWS CLI or Console
4. ✅ Keep us-east-1_mFVU52978 as the single development pool
5. ✅ Update environment files to reference single pool

**Deletion Script (AWS CLI):**
```bash
# For each pool ID to delete:
aws cognito-idp delete-user-pool \
  --user-pool-id us-east-1_xxxxxxxx \
  --region us-east-1

# Verify deletion
aws cognito-idp list-user-pools \
  --max-results 10 \
  --region us-east-1
```

**Risk Assessment:**
- LOW RISK: All duplicate pools are not in use
- BACKUP PLAN: Pools are soft-deleted; can be recovered from AWS backup within 7 days
- VERIFICATION: Run `aws cognito-idp list-user-pools` before and after

---

### 1.2 RDS Database Naming Consolidation

**Current State:**
- Two RDS instance naming patterns used:
  - `episode-control-dev` (legacy naming)
  - `episode-metadata-db-dev` (current standard)

**Consolidation Strategy:**

**Option A: Migrate to episode-metadata-db-dev (Recommended)**
```
Current: episode-control-dev → episode-metadata-db-dev
Reason: Aligns with API naming (episode-metadata-api)
Impact: All connection strings must be updated
Backup: Automatic AWS RDS snapshot taken before migration
```

**Option B: Migrate to episode-metadata-prod & episode-metadata-staging**
```
Naming pattern:
- Development: episode-metadata-db-dev
- Staging: episode-metadata-db-staging
- Production: episode-metadata-db-prod

Reason: Clear environment separation
Impact: All environment files need updates
Benefit: Easier to manage multiple instances
```

**Recommended Choice: Option A + Staging/Prod Variant**

**Consolidated Names:**
```
Development:  episode-metadata-db-dev
Staging:      episode-metadata-db-staging  
Production:   episode-metadata-db-prod
```

**Migration Steps:**
1. Create snapshot of existing RDS instance
2. Create new RDS instance with new name
3. Restore from snapshot to new instance
4. Test connectivity with new endpoint
5. Update all environment files (.env.development, .env.staging, .env.production)
6. Update documentation
7. Update GitHub Secrets if applicable
8. Delete old instance after verification (72-hour grace period)

**Files to Update:**
- `.env.development`
- `.env.staging`
- `.env.production.template`
- `docker-compose.staging.yml`
- `docker-compose.production.yml`
- `infrastructure-ids.txt` (update RDS endpoint)
- AWS CloudFormation templates (if using)

**Connection String Format:**
```
Before: postgresql://user:pass@episode-control-dev.xxxxx.us-east-1.rds.amazonaws.com:5432/episode_metadata
After:  postgresql://user:pass@episode-metadata-db-dev.xxxxx.us-east-1.rds.amazonaws.com:5432/episode_metadata
```

**Risk Assessment:**
- MEDIUM RISK: Requires connection string updates
- MITIGATION: Use DNS CNAME records for gradual migration
- ROLLBACK: Keep old instance for 7 days before deletion
- TESTING: Test in staging first before production

---

## Part 2: Templates Feature Completion

### 2.1 Current State Assessment

**Backend Status:**
✅ **COMPLETE**
- Models: `src/models/EpisodeTemplate.js` (exists)
- Routes: `src/routes/templates.js` (184 lines, full CRUD)
- Integration: Routes registered in `src/app.js`
- API Endpoints:
  - GET /api/v1/templates (list)
  - GET /api/v1/templates/:id (get by ID)
  - POST /api/v1/templates (create - admin only)
  - PUT /api/v1/templates/:id (update - admin only)
  - DELETE /api/v1/templates/:id (delete - admin only)

**Frontend Status:**
⚠️ **PARTIALLY COMPLETE**
- Component: `frontend/src/pages/TemplateManagement.jsx` (390 lines)
- Issues found:
  1. Form implementation incomplete (missing handleSubmit)
  2. Edit mode not fully implemented
  3. Delete functionality missing
  4. Modal for form needs styling
  5. CSS file missing or incomplete
  6. No service layer (using fetch directly)
  7. Error handling incomplete

**Service Layer:**
❌ **MISSING**
- Need: `frontend/src/services/templateService.js`
- Should provide: CRUD methods for Templates API

**CSS Styling:**
❌ **MISSING or INCOMPLETE**
- Need: `frontend/src/styles/TemplateManagement.css`

**Navigation Integration:**
⚠️ **INCOMPLETE**
- Route exists in App.jsx at `/admin/templates`
- Need: Add to navigation/header for admin users

---

### 2.2 What Needs to be Done

**Frontend Implementation (3-4 hours estimated):**

1. **Create templateService.js** (50 lines)
   - GET /templates
   - GET /templates/:id
   - POST /templates (create)
   - PUT /templates/:id (update)
   - DELETE /templates/:id (delete)
   - Error handling

2. **Complete TemplateManagement.jsx** (150 lines modification)
   - Implement handleSubmit for create/update
   - Implement handleDelete
   - Add modal for form
   - Add confirm dialog for deletion
   - Add success/error notifications
   - Implement edit mode (pre-fill form)
   - Better loading/error states

3. **Create TemplateManagement.css** (200-300 lines)
   - Form styling
   - Table/list styling
   - Modal styling
   - Button styles (create, edit, delete)
   - Responsive layout
   - Status badges

4. **Update Navigation**
   - Add Templates link to header/sidebar
   - Show only for admin users
   - Link to `/admin/templates`

5. **Add Notifications**
   - Success: "Template created/updated/deleted"
   - Error: Display error messages
   - Use Toast component if available

---

### 2.3 Implementation Files

**Files to Create:**
```
frontend/src/services/templateService.js       (50 lines)
frontend/src/styles/TemplateManagement.css    (300 lines)
```

**Files to Modify:**
```
frontend/src/pages/TemplateManagement.jsx     (add ~150 lines)
frontend/src/components/Header.jsx            (add Template link)
frontend/src/components/Navigation.jsx        (add Template link)
```

---

### 2.4 API Response Format

**Expected API Responses (from backend):**

```json
// GET /api/v1/templates
{
  "status": "SUCCESS",
  "data": [
    {
      "id": "uuid",
      "name": "Default Episode Template",
      "description": "Basic episode template",
      "defaultStatus": "draft",
      "defaultCategories": ["education", "lifestyle"],
      "config": {
        "episodeNumbering": "auto",
        "dateFormat": "YYYY-MM-DD"
      },
      "createdAt": "2026-01-08T12:00:00Z",
      "updatedAt": "2026-01-08T12:00:00Z"
    }
  ],
  "count": 1
}

// POST /api/v1/templates (201 Created)
{
  "status": "SUCCESS",
  "message": "Template created successfully",
  "data": { /* template object */ }
}
```

---

## Cleanup Checklist

### AWS Cognito Cleanup
- [ ] List all Cognito pools: `aws cognito-idp list-user-pools --max-results 60`
- [ ] Document which pools can be deleted
- [ ] Create backup of production pools (if any)
- [ ] Delete 8 duplicate pools
- [ ] Verify only us-east-1_mFVU52978 remains for dev
- [ ] Update documentation
- [ ] Update GitHub Secrets if Cognito ID is stored

### RDS Consolidation
- [ ] Create RDS snapshot of current instance
- [ ] Create new RDS instance with consolidated name
- [ ] Test connectivity to new instance
- [ ] Update .env files with new endpoint
- [ ] Update docker-compose files
- [ ] Update infrastructure-ids.txt
- [ ] Test application with new connection
- [ ] Delete old RDS instance (after 72-hour verification)
- [ ] Update deployment documentation

### Templates Feature Completion
- [ ] Create templateService.js
- [ ] Complete TemplateManagement.jsx implementation
- [ ] Create TemplateManagement.css
- [ ] Update Header/Navigation components
- [ ] Test CRUD operations end-to-end
- [ ] Test admin authorization
- [ ] Test error handling
- [ ] Test responsive design
- [ ] Add to navigation visible to admins only

---

## Next Steps

**Immediate (Today):**
1. Complete Templates feature frontend
2. Test Templates CRUD operations
3. Commit and push to GitHub

**Short Term (This Week):**
1. Execute AWS Cognito cleanup
2. Execute RDS consolidation
3. Update all documentation
4. Update GitHub Secrets
5. Test production connection strings

**Risk Mitigation:**
- Keep backups of all AWS resources
- Test in non-production first
- Have rollback plan ready
- Document all changes
- Keep team informed

---

## Sign-Off

This document provides a complete plan for:
1. ✅ Cleaning up 8 duplicate Cognito pools
2. ✅ Consolidating RDS naming across environments
3. ✅ Completing the Templates feature implementation

**Estimated Effort:**
- Templates completion: 3-4 hours
- AWS cleanup: 2-3 hours (mostly waiting for operations)
- Total: 5-7 hours

**Expected Outcome:**
- Single, clean Cognito pool for all development
- Consistent RDS naming across all environments
- Fully functional Templates management UI
- Professional deployment-ready infrastructure
