# MANUAL UI TESTING GUIDE
## Episode Control Record Application

**Test URL:** http://localhost:5173  
**Test User:** test@example.com / password123  
**Duration:** ~20 minutes

---

## TEST 1: LOGIN PAGE
**Expected:** Login form with email/password fields

**Steps:**
1. ✅ Open http://localhost:5173 in browser
2. ✅ Verify login form displays
3. ✅ Enter email: `test@example.com`
4. ✅ Enter password: `password123`
5. ✅ Click "Login" button
6. ✅ **Expected Result:** Redirected to dashboard

**What to Check:**
- [ ] Form fields are visible and editable
- [ ] Login button is clickable
- [ ] No error messages appear
- [ ] Loading indicator shows (if implemented)
- [ ] Redirects to dashboard after login
- [ ] URL changes to `/dashboard` or `/episodes`

---

## TEST 2: DASHBOARD PAGE
**Expected:** Stats about episodes (total, published, draft)

**Steps:**
1. ✅ After login, verify dashboard displays
2. ✅ Look for episode statistics
3. ✅ Verify numbers match (8 total, 5 published, 3 draft)
4. ✅ Check navigation menu appears

**What to Check:**
- [ ] Dashboard displays statistics correctly
- [ ] Counts match: Total=8, Published=5, Draft=3
- [ ] Navigation bar is visible
- [ ] Logout button visible in header
- [ ] User email displayed (test@example.com)
- [ ] All stat cards display without errors

---

## TEST 3: EPISODES LIST PAGE
**Expected:** Table/list of all episodes with action buttons

**Steps:**
1. ✅ Click "Episodes" in navigation or go to `/episodes`
2. ✅ Verify list loads
3. ✅ Verify 8 episodes display

**What to Check:**
- [ ] Episodes table displays all 8 episodes
- [ ] Each episode shows: Title, Episode #, Status, Air Date
- [ ] Each episode has action buttons (View, Edit, Delete)
- [ ] Status shown as "published" or "draft" with different styling
- [ ] Pagination controls visible (if showing <8)
- [ ] Search bar visible at top
- [ ] "Create New Episode" button visible
- [ ] No 404 or error messages

**Episode Should Display:**
- Title
- Episode Number
- Air Date
- Status (draft/published)
- View button
- Edit button
- Delete button (may be disabled if no permission)

---

## TEST 4: CREATE EPISODE
**Expected:** Form to create new episode

**Steps:**
1. ✅ Click "Create New Episode" button
2. ✅ Verify form displays with fields:
   - Title (required)
   - Episode Number
   - Air Date
   - Description
   - Status (dropdown: draft/published)
3. ✅ Fill in test data:
   - Title: "Test Episode UI"
   - Episode Number: 77
   - Air Date: 2026-01-20
   - Description: "Created during manual testing"
   - Status: "draft"
4. ✅ Click "Save" button

**What to Check:**
- [ ] All form fields visible and editable
- [ ] Date picker works when clicking date field
- [ ] Status dropdown shows options
- [ ] Save button is clickable
- [ ] Form validates (try empty title - should show error)
- [ ] Success message appears after save
- [ ] Redirects to episode detail view

---

## TEST 5: VIEW EPISODE DETAIL
**Expected:** Full episode information page

**Steps:**
1. ✅ From created episode, verify detail page displays
2. ✅ Check all fields are displayed:
   - Title
   - Episode Number
   - Air Date
   - Description
   - Status
   - Created date
   - Updated date

**What to Check:**
- [ ] All fields display correctly
- [ ] Dates formatted properly
- [ ] Edit button visible
- [ ] Delete button visible
- [ ] Back button or navigation link visible
- [ ] No console errors

---

## TEST 6: EDIT EPISODE
**Expected:** Form pre-populated with current episode data

**Steps:**
1. ✅ Click "Edit" button from detail page
2. ✅ Verify form shows current data
3. ✅ Change title to: "Updated Test Episode UI"
4. ✅ Change status to: "published"
5. ✅ Click "Save"

**What to Check:**
- [ ] Form pre-populated with current values
- [ ] All fields are editable
- [ ] Changes save successfully
- [ ] Detail page updates with new data
- [ ] Timestamp (updated_at) changes
- [ ] Success message shown

---

## TEST 7: SEARCH FUNCTIONALITY
**Expected:** Search filters episodes by title/description

**Steps:**
1. ✅ Go back to Episodes list
2. ✅ Find search bar at top
3. ✅ Type "Test" in search
4. ✅ Press Enter or wait for results

**What to Check:**
- [ ] Search results appear (should find our created episode)
- [ ] Results filter in real-time or on submit
- [ ] Shows count of results
- [ ] Can clear search and see all episodes again
- [ ] Search works for partial matches

---

## TEST 8: DELETE EPISODE
**Expected:** Episode removed from list (or soft deleted)

**Steps:**
1. ✅ Find the "Test Episode UI" we created
2. ✅ Click "Delete" button
3. ✅ Verify confirmation dialog appears
4. ✅ Click "Confirm" or "Yes"

**What to Check:**
- [ ] Confirmation dialog appears before delete
- [ ] Dialog shows which episode will be deleted
- [ ] "Cancel" button cancels the action
- [ ] After confirm, episode disappears from list
- [ ] Success message shown
- [ ] Episode count updates (now 7 instead of 8)

---

## TEST 9: LOGOUT
**Expected:** Clear session and return to login

**Steps:**
1. ✅ Click "Logout" button in header
2. ✅ Verify redirected to login page

**What to Check:**
- [ ] Session cleared (no token in localStorage)
- [ ] Redirected to login page (`/login`)
- [ ] Cannot access dashboard without logging in again
- [ ] All user data cleared

---

## TEST 10: ERROR SCENARIOS
**Expected:** Proper error handling

**Steps:**
1. ✅ Try creating episode with empty title - should show error
2. ✅ Try invalid date - should show error or reject
3. ✅ Refresh page while on detail - should still load
4. ✅ Try accessing `/episodes/invalid-id` - should show 404 or error

**What to Check:**
- [ ] Error messages display clearly
- [ ] Form doesn't submit with invalid data
- [ ] 404 pages handled gracefully
- [ ] Network errors show friendly messages

---

## SUMMARY CHECKLIST

### UI/UX Verification
- [ ] All pages load without console errors
- [ ] Navigation works between all pages
- [ ] Buttons are clickable and responsive
- [ ] Forms are user-friendly
- [ ] Status badges have appropriate colors
- [ ] Timestamps display in readable format
- [ ] Page layout is responsive

### Functionality Verification
- [ ] Login/logout working
- [ ] Create episode working
- [ ] Edit episode working
- [ ] View episode details working
- [ ] Search filtering working
- [ ] Delete working
- [ ] Navigation between pages working
- [ ] Pagination working (if implemented)

### Data Integrity
- [ ] Created data persists after refresh
- [ ] Edited data updates correctly
- [ ] Deleted data removed from list
- [ ] Counts update correctly
- [ ] Timestamps accurate

### Error Handling
- [ ] Invalid input rejected
- [ ] Network errors handled
- [ ] 404 pages handled
- [ ] Permissions enforced (can't delete as non-admin)

---

## TESTING NOTES

Write observations here:

**Session Duration:** __________  
**Total Episodes Tested:** __________  
**Issues Found:**

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Positive Observations:**

1. _______________________________________________
2. _______________________________________________

---

## NEXT STEPS

After manual testing, advanced features to implement:

1. ✅ Filtering (by status, date range)
2. ✅ Sorting (by title, episode #, date)
3. ✅ Pagination controls on frontend
4. ✅ Episode categories/tags
5. ✅ User roles management
6. ✅ Audit log viewer
7. ✅ Batch operations
