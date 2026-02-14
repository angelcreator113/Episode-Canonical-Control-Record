# 🎯 FRONTEND TESTING CHECKLIST

## 🚀 Quick Start

### Start Frontend Dev Server
```bash
cd frontend
npm run dev
```

The frontend should start on: **http://localhost:5173**

---

## ✅ CORE FEATURES TESTING

### 1. 🏠 Home Page
**URL:** http://localhost:5173/

- [ ] Page loads without errors
- [ ] Navigation menu is visible
- [ ] All links work

### 2. 📺 Shows Management
**URL:** http://localhost:5173/shows

- [ ] Shows list displays
- [ ] Can create new show
- [ ] Can edit existing show
- [ ] Show config editor works
- [ ] Show template selector works
- [ ] Icon and color pickers work

### 3. 🎬 Episodes List
**URL:** http://localhost:5173/episodes

- [ ] Episodes list displays
- [ ] Shows correct episode count
- [ ] Filter by show works
- [ ] Search works
- [ ] Pagination works (if applicable)

### 4. ➕ Create Episode
**URL:** http://localhost:5173/episodes/new

- [ ] Form loads correctly
- [ ] Can select show
- [ ] Can enter episode title
- [ ] Can enter description
- [ ] Can set episode number
- [ ] Can set status
- [ ] Submit creates new episode
- [ ] Redirects to episode detail on success

### 5. 📝 Episode Detail Page
**URL:** http://localhost:5173/episodes/[episodeId]

#### Basic Info Tab
- [ ] Episode details display correctly
- [ ] Can edit episode title
- [ ] Can edit description
- [ ] Can change status
- [ ] Changes save successfully

#### **NEW:** AI Script Generator Tab
- [ ] Tab is visible
- [ ] Can select script template
- [ ] Can configure template variables
- [ ] Generate button works
- [ ] Generated script displays
- [ ] Can edit generated script
- [ ] Can save script changes
- [ ] Script versions are tracked

#### **NEW:** Scene Composer Tab
- [ ] Tab is visible
- [ ] Scene list displays
- [ ] Can add new scene
- [ ] Can reorder scenes (drag & drop)
- [ ] Can edit scene details
- [ ] Timeline view works
- [ ] Can add assets to scenes
- [ ] Can preview scene arrangement

#### **NEW:** Character Profiles Tab
- [ ] Tab is visible
- [ ] Character list displays
- [ ] Can add new character
- [ ] Can edit character details:
  - [ ] Name
  - [ ] Role
  - [ ] Description
  - [ ] Visual notes
- [ ] Can assign voice profile
- [ ] Character avatar upload works

#### **NEW:** Voice Samples Tab
- [ ] Tab is visible
- [ ] Voice samples list displays
- [ ] Can upload new voice sample
- [ ] Audio player works for each sample
- [ ] Can link voice to character
- [ ] Voice match confidence shows
- [ ] Can delete voice samples

### 6. 🎨 Assets Manager
**URL:** http://localhost:5173/assets

- [ ] Assets list displays
- [ ] Asset thumbnails load
- [ ] Filter by type works:
  - [ ] Images
  - [ ] Videos
  - [ ] Audio
  - [ ] Graphics
- [ ] Search works
- [ ] Can upload new asset
- [ ] Asset upload progress shows
- [ ] Can edit asset metadata
- [ ] Can delete assets
- [ ] Asset preview/modal works

### 7. 👗 Wardrobe Library
**URL:** http://localhost:5173/wardrobe

- [ ] Wardrobe items display
- [ ] Grid view works
- [ ] List view works
- [ ] Filter by character works
- [ ] Filter by category works:
  - [ ] Dress
  - [ ] Top
  - [ ] Bottom
  - [ ] Accessory
  - [ ] Shoes
- [ ] Can upload new wardrobe item
- [ ] Image preview works
- [ ] Can edit wardrobe details
- [ ] Color picker works
- [ ] Season selector works
- [ ] Tags system works
- [ ] Can mark as favorite
- [ ] Can delete items

### 8. 🎥 Raw Footage Upload
**URL:** http://localhost:5173/raw-footage

- [ ] Upload interface displays
- [ ] Can select video file
- [ ] Can select episode
- [ ] Upload progress bar works
- [ ] Upload completes successfully
- [ ] Creates scene automatically
- [ ] Video thumbnail generates
- [ ] Can view uploaded footage list

---

## 🆕 NEW FEATURES TO TEST

### Lala Formula Generator
**URL:** http://localhost:5173/shows/[showId]/edit → Lala Formula Tab

- [ ] Formula generator tab exists
- [ ] Can define episode structure:
  - [ ] Hook duration
  - [ ] Problem setup duration
  - [ ] Tutorial/solution duration
  - [ ] Wrap-up duration
- [ ] Micro-goals system works:
  - [ ] Can add micro-goals
  - [ ] Can set completion criteria
  - [ ] Visual progress indicator
- [ ] Friend archetypes manager:
  - [ ] Can add friend characters
  - [ ] Personality traits selector
  - [ ] Interaction patterns defined
- [ ] Cash grab quests feature:
  - [ ] Product placement spots
  - [ ] Brand integration points
  - [ ] Sponsorship timing markers
- [ ] Timeline preview shows structure
- [ ] Can save formula
- [ ] Formula applies to new episodes

### Edit Maps / AI Analysis
**Location:** Episode Detail → Raw Footage Section

- [ ] Can trigger AI analysis
- [ ] Processing status shows
- [ ] Edit map displays when complete:
  - [ ] Scene boundaries detected
  - [ ] Suggested cuts marked
  - [ ] B-roll opportunities highlighted
  - [ ] Character presence timeline
  - [ ] Audio events timeline
- [ ] Can accept/reject suggestions
- [ ] Can manually adjust boundaries
- [ ] Edit decisions are saved

### Game Show Features
**Location:** Show Config → Interactive Elements

- [ ] Interactive elements config visible
- [ ] Layout templates available:
  - [ ] Split screen
  - [ ] Picture-in-picture
  - [ ] Full screen
  - [ ] Custom layouts
- [ ] Episode phases definition:
  - [ ] Intro phase
  - [ ] Challenge phase
  - [ ] Judging phase
  - [ ] Results phase
- [ ] AI interaction points:
  - [ ] Question prompts
  - [ ] Response handling
  - [ ] Scoring system

---

## 🐛 CONSOLE ERRORS CHECK

Open browser DevTools (F12) and check for:

- [ ] No JavaScript errors
- [ ] No 404 errors for assets
- [ ] No CORS errors
- [ ] No broken API calls
- [ ] No React warnings in console

---

## 🎨 UI/UX CHECKS

### Navigation
- [ ] All menu items work
- [ ] Back button works correctly
- [ ] Breadcrumbs work
- [ ] Mobile menu works (resize browser)

### Forms
- [ ] All form fields are accessible
- [ ] Validation works
- [ ] Error messages display correctly
- [ ] Success messages display
- [ ] Loading states show during saves

### Performance
- [ ] Pages load quickly (< 2 seconds)
- [ ] Images load progressively
- [ ] No layout shifts (CLS)
- [ ] Smooth scrolling
- [ ] No jank during interactions

### Responsive Design
- [ ] Desktop view works (1920x1080)
- [ ] Laptop view works (1366x768)
- [ ] Tablet view works (768x1024)
- [ ] Mobile view works (375x667)

---

## 🔧 BACKEND INTEGRATION

### API Calls
- [ ] All endpoints respond correctly
- [ ] Loading states show during API calls
- [ ] Error handling works for failed calls
- [ ] Success notifications show
- [ ] Data refreshes after mutations

### File Uploads
- [ ] Image uploads work
- [ ] Video uploads work
- [ ] Progress tracking works
- [ ] Large files handle correctly (100MB+)
- [ ] File validation works
- [ ] Error handling for failed uploads

### Real-time Features (if implemented)
- [ ] WebSocket connection establishes
- [ ] Real-time updates work
- [ ] Connection loss handling works

---

## 📊 DATA INTEGRITY

### CRUD Operations
- [ ] Create works for all entities
- [ ] Read/List works for all entities
- [ ] Update works for all entities
- [ ] Delete works (with confirmation)
- [ ] Soft delete works where applicable

### Relationships
- [ ] Episodes link to shows correctly
- [ ] Scenes link to episodes correctly
- [ ] Assets link to scenes correctly
- [ ] Wardrobe links to characters correctly
- [ ] Character profiles link to shows correctly

---

## 🚨 CRITICAL ISSUES TO WATCH FOR

1. **CORS Issues**: Check that API calls from frontend don't get blocked
2. **Authentication**: If auth is enabled, login/logout works
3. **S3 Upload**: Ensure pre-signed URLs work for file uploads
4. **Database Connection**: Backend stays connected to database
5. **Memory Leaks**: No memory warnings in long sessions
6. **Race Conditions**: Rapid clicks don't cause duplicate actions

---

## ✅ DEPLOYMENT READINESS

- [ ] All tests above pass
- [ ] No critical bugs found
- [ ] Performance is acceptable
- [ ] Browser compatibility checked:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
- [ ] Mobile browsers checked:
  - [ ] iOS Safari
  - [ ] Chrome Mobile
- [ ] Environment variables set correctly
- [ ] Build process works (`npm run build`)
- [ ] Production build tested locally

---

## 📝 NOTES

Use this section to document any issues found:

```
Issue 1: [Description]
- Location: [URL or component]
- Severity: [Critical/High/Medium/Low]
- Steps to reproduce:
  1. 
  2. 
  3. 

Issue 2: [Description]
...
```

---

## 🎉 NEXT STEPS

Once all tests pass:

1. ✅ Fix any critical issues
2. ✅ Document any workarounds
3. ✅ Update deployment documentation
4. ✅ Create production deployment plan
5. ✅ Proceed with deployment

**Good luck with testing! 🚀**
