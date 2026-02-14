# 🚀 PHASE 3: Frontend Development - Quick Start Guide

**Status**: Ready to Begin  
**Previous Phase**: PHASE 2 - AWS Staging ✅ COMPLETE  
**Target**: Build React UI with Vite

---

## What's Ready for You

### ✅ Backend is Complete
- API running and fully tested
- 823 tests passing
- All 12 routes operational
- Database connected
- AWS infrastructure ready

### ✅ You Can Focus On
- Frontend UI development
- React component creation
- User experience design
- Frontend testing

---

## Quick Start (5 Minutes)

### 1. Start API Server (Terminal 1)
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
npm start
```

**Expected Output:**
```
🚀 Starting Episode Metadata API...
Node version: v20.19.4
Environment: development
✓ Auth routes loaded
✓ Episodes routes loaded
✓ Thumbnails routes loaded
... (all 12 routes)
Server running on http://localhost:3002
```

### 2. Start Frontend Dev Server (Terminal 2)
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm run dev
```

**Expected Output:**
```
VITE v4.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

### 3. Open Browser
```
http://localhost:5173
```

✅ **Frontend dev server is running and can call API at http://localhost:3002**

---

## API Testing in Frontend

### Check API Connection
```javascript
// In any React component
fetch('http://localhost:3002/health')
  .then(r => r.json())
  .then(data => console.log('API Status:', data))
```

### Call API Endpoints
```javascript
// Get episodes
const response = await fetch('http://localhost:3002/api/v1/episodes?page=1&limit=10');
const data = await response.json();

// Create episode
const newEpisode = await fetch('http://localhost:3002/api/v1/episodes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'New Episode',
    description: 'Episode description',
    episode_number: 1
  })
});
```

---

## Frontend Architecture

### Project Structure
```
frontend/
├── src/
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   ├── components/          # Reusable components
│   │   ├── Header.jsx
│   │   ├── Navigation.jsx
│   │   ├── EpisodeList.jsx
│   │   └── ...
│   ├── pages/               # Page components
│   │   ├── Episodes.jsx
│   │   ├── Create.jsx
│   │   ├── Edit.jsx
│   │   └── ...
│   ├── services/            # API calls
│   │   ├── api.js           # Fetch wrapper
│   │   ├── episodeService.js
│   │   └── ...
│   ├── hooks/               # Custom hooks
│   ├── utils/               # Utilities
│   └── styles/              # CSS/styling
├── public/                  # Static assets
├── vite.config.js           # Vite configuration
├── package.json
└── index.html
```

### Key Technologies
- **Framework**: React 18
- **Build Tool**: Vite 4
- **Styling**: CSS/SCSS
- **HTTP Client**: Fetch API
- **Routing**: (TBD - React Router recommended)

---

## Component Development Checklist

### Phase 3A: Core Pages (Week 1)
- [ ] Login page
- [ ] Episode list page
- [ ] Episode detail page
- [ ] Create episode page
- [ ] Edit episode page

### Phase 3B: Components (Week 1-2)
- [ ] Header/Navigation
- [ ] Episode card
- [ ] Form components
- [ ] Search/Filter UI
- [ ] Pagination

### Phase 3C: Features (Week 2-3)
- [ ] Authentication flow
- [ ] File upload
- [ ] Thumbnail generation
- [ ] Search functionality
- [ ] Error handling

### Phase 3D: Polish (Week 3-4)
- [ ] Responsive design
- [ ] Loading states
- [ ] Error messages
- [ ] Confirmation dialogs
- [ ] Success notifications

---

## API Endpoints You'll Use

### Authentication
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### Episodes (Main Feature)
```
GET    /api/v1/episodes              # List all
POST   /api/v1/episodes              # Create
GET    /api/v1/episodes/:id          # Get one
PUT    /api/v1/episodes/:id          # Update
DELETE /api/v1/episodes/:id          # Delete
```

### Thumbnails
```
POST   /api/v1/thumbnails/generate   # Generate thumbnail
GET    /api/v1/thumbnails/:id        # Get thumbnail
DELETE /api/v1/thumbnails/:id        # Delete
```

### Search & Filter
```
GET    /api/v1/search                # Full-text search
GET    /api/v1/metadata/:id          # Get metadata
POST   /api/v1/metadata/:id          # Update metadata
```

### Files
```
POST   /api/v1/files/upload          # Upload file
GET    /api/v1/files/:id             # Download file
DELETE /api/v1/files/:id             # Delete file
```

**Full API Reference**: [API_QUICK_REFERENCE.md](../API_QUICK_REFERENCE.md)

---

## Testing in Frontend

### Set Up Testing
```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### Example Test
```javascript
import { render, screen } from '@testing-library/react';
import EpisodeList from './EpisodeList';

test('displays episode list', async () => {
  render(<EpisodeList />);
  const episodes = await screen.findAllByRole('article');
  expect(episodes).toBeDefined();
});
```

---

## Common Tasks

### Add a New Page
```javascript
// Create file: frontend/src/pages/NewPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function NewPage() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    api.get('/api/v1/episodes').then(r => setData(r.data));
  }, []);
  
  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
}
```

### Call API
```javascript
// In component
const handleCreate = async (formData) => {
  const response = await fetch('http://localhost:3002/api/v1/episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  const result = await response.json();
  console.log('Created:', result);
};
```

### Handle Loading States
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch('/api/v1/episodes')
    .then(r => r.json())
    .then(data => setLoading(false))
    .catch(err => { setError(err); setLoading(false); });
}, []);

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
```

---

## Development Workflow

### 1. Design
- Sketch UI/UX mockups
- Plan component hierarchy
- Map data flow

### 2. Implement
```bash
# Terminal 1: API
npm start

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Optional - Tests
cd frontend && npm test -- --watch
```

### 3. Test
```bash
# In frontend directory
npm test                    # Run tests
npm run build              # Build for production
npm run preview            # Preview build
```

### 4. Debug
- Use browser DevTools
- Check API calls in Network tab
- Use React DevTools extension
- Check console for errors

---

## Useful Resources

### React Documentation
- https://react.dev
- https://react.dev/learn

### Vite Documentation
- https://vitejs.dev
- https://vitejs.dev/guide

### Testing
- https://testing-library.com
- https://vitest.dev

### Styling
- CSS Modules
- Tailwind CSS (optional)
- Material-UI (optional)

---

## Environment Setup

### Frontend Environment Variables
Create `frontend/.env`:
```
VITE_API_URL=http://localhost:3002
VITE_APP_NAME=Episode Metadata Manager
```

Use in code:
```javascript
const API_URL = import.meta.env.VITE_API_URL;
```

---

## Common Issues & Solutions

### Port 5173 Already in Use
```bash
# Kill process
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or use different port
npm run dev -- --port 5174
```

### API CORS Error
✅ **Already fixed** - Backend allows localhost requests

### Hot Module Replacement (HMR) Not Working
```javascript
// Add to vite.config.js
export default {
  server: {
    hmr: {
      host: 'localhost',
      port: 5173
    }
  }
}
```

---

## Success Criteria

### By End of PHASE 3A (Week 1)
- [ ] Core pages built
- [ ] API calls working
- [ ] Authentication flow
- [ ] Basic styling complete

### By End of PHASE 3B (Week 2)
- [ ] All components created
- [ ] Full CRUD operations
- [ ] Search/filter working
- [ ] File upload functional

### By End of PHASE 3C (Week 3)
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design
- [ ] Unit tests added

### By End of PHASE 3D (Week 4)
- [ ] Polish UI
- [ ] Performance optimized
- [ ] Accessibility checked
- [ ] Ready for deployment

---

## Next Commands to Run

### Terminal 1 (API)
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
npm start
```

### Terminal 2 (Frontend)
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm run dev
```

### Terminal 3 (Tests - Optional)
```bash
npm test                    # Run backend tests
# or
cd frontend && npm test     # Run frontend tests
```

---

## Ready to Begin?

1. ✅ API ready (running)
2. ✅ Database connected
3. ✅ Frontend environment configured
4. ✅ Documentation complete

**Start with**: `npm run dev` in frontend directory

---

**PHASE 3 is ready to begin. Backend is fully operational and tested.**

Good luck with the frontend development! 🎨

---

Last Updated: January 6, 2026  
Backend Status: ✅ Complete and Tested  
Frontend Status: ✅ Ready to Start  
Overall Confidence: **VERY HIGH**
