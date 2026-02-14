# 🎨 PHASE 3: Frontend Development - Startup Guide

**Status**: STARTING NOW ✅  
**Previous Phase**: PHASE 2 Complete ✅  
**Current Date**: January 6, 2026

---

## Before You Start

### ✅ Everything You Need is Ready

**Backend Infrastructure**:
- API running: `http://localhost:3002`
- Database connected and healthy
- All 12 routes tested and working
- AWS staging ready
- 823 tests passing

**Frontend Environment**:
- React 18 with Vite pre-configured
- All dependencies installed
- Build system ready
- Dev server configured

**Documentation**:
- API Quick Reference available
- Component patterns documented
- Routing guidelines prepared
- Integration examples included

---

## 🚀 Start Development in 2 Minutes

### Step 1: Start Backend (Terminal 1)
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
npm start
```

Wait for message: `Server running on http://localhost:3002`

### Step 2: Start Frontend (Terminal 2)
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm run dev
```

Wait for message: `Local: http://localhost:5173/`

### Step 3: Open Browser
```
http://localhost:5173
```

✅ **You're ready to develop!**

---

## 📁 Frontend Project Structure

```
frontend/
├── src/
│   ├── App.jsx                    # Main app component
│   ├── main.jsx                   # Entry point (don't edit)
│   ├── index.css                  # Global styles
│   │
│   ├── components/                # Reusable components (CREATE HERE)
│   │   ├── Header.jsx             # Top navigation
│   │   ├── Navigation.jsx         # Side menu
│   │   ├── EpisodeCard.jsx        # Episode display
│   │   ├── Form.jsx               # Reusable form
│   │   └── LoadingSpinner.jsx     # Loading indicator
│   │
│   ├── pages/                     # Page components (CREATE HERE)
│   │   ├── Home.jsx               # Landing page
│   │   ├── Login.jsx              # Auth page
│   │   ├── Episodes.jsx           # List view
│   │   ├── EpisodeDetail.jsx      # Detail view
│   │   ├── CreateEpisode.jsx      # Create form
│   │   └── EditEpisode.jsx        # Edit form
│   │
│   ├── services/                  # API services (CREATE HERE)
│   │   ├── api.js                 # API wrapper
│   │   ├── episodeService.js      # Episode API calls
│   │   ├── authService.js         # Auth API calls
│   │   └── cognitoService.js      # Cognito integration
│   │
│   ├── hooks/                     # Custom hooks (CREATE HERE)
│   │   ├── useAuth.js             # Auth hook
│   │   ├── useEpisodes.js         # Episodes fetch hook
│   │   └── useFetch.js            # Generic fetch hook
│   │
│   ├── utils/                     # Utilities (CREATE HERE)
│   │   ├── validators.js          # Form validation
│   │   ├── formatters.js          # Data formatting
│   │   └── constants.js           # App constants
│   │
│   └── styles/                    # CSS files (CREATE HERE)
│       ├── components.css
│       ├── pages.css
│       └── variables.css
│
├── public/                        # Static assets
│   └── favicon.svg
│
├── index.html                     # HTML entry point
├── vite.config.js                 # Vite configuration (ready)
├── package.json                   # Dependencies (ready)
├── .env                           # Environment variables (create)
└── .gitignore
```

---

## 🎯 Development Priorities

### Week 1: Core Pages
Priority: **HIGH** ⭐⭐⭐

1. **Create Page Structure** (30 min)
   ```bash
   # Create folders
   mkdir -p src/pages src/components src/services src/hooks src/utils src/styles
   ```

2. **Build Login Page** (2 hours)
   - Email/password form
   - Cognito integration
   - Token storage
   - Error handling

3. **Build Home Page** (1 hour)
   - Welcome message
   - Navigation to episodes
   - User profile display

4. **Build Episodes List Page** (2 hours)
   - Fetch episodes from API
   - Display in cards/table
   - Pagination
   - Search/filter

5. **Build Episode Detail Page** (2 hours)
   - Get episode by ID
   - Display all info
   - Edit/Delete buttons
   - Related thumbnails

### Week 2: Forms & CRUD
Priority: **HIGH** ⭐⭐⭐

1. **Create Episode Form** (2 hours)
   - Form validation
   - API submission
   - Success/error messages
   - Redirect after create

2. **Edit Episode Form** (1.5 hours)
   - Pre-fill form with data
   - Update via API
   - Validation
   - Success feedback

3. **Delete Confirmation** (1 hour)
   - Confirmation dialog
   - Delete via API
   - Refresh list
   - Error handling

4. **Thumbnail Generation** (2 hours)
   - Trigger generation endpoint
   - Show progress
   - Display results
   - Error handling

### Week 3: Polish & Features
Priority: **MEDIUM** ⭐⭐

1. **Responsive Design** (3 hours)
   - Mobile layout
   - Tablet layout
   - Desktop layout
   - Touch-friendly UI

2. **Loading States** (2 hours)
   - Loading spinners
   - Skeleton screens
   - Disabled buttons
   - Optimistic updates

3. **Error Handling** (2 hours)
   - Error messages
   - Retry functionality
   - Error boundaries
   - Fallback UI

4. **Search & Filter** (2 hours)
   - Search box
   - Filter options
   - Sort functionality
   - Save filters

---

## 💻 Code Examples

### Example 1: Simple API Call
```javascript
// src/services/episodeService.js
export async function getEpisodes(page = 1, limit = 10) {
  const response = await fetch(
    `http://localhost:3002/api/v1/episodes?page=${page}&limit=${limit}`
  );
  if (!response.ok) throw new Error('Failed to fetch episodes');
  return response.json();
}

// In component:
import { useState, useEffect } from 'react';
import { getEpisodes } from '../services/episodeService';

function Episodes() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getEpisodes()
      .then(data => setEpisodes(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{episodes.map(ep => <div key={ep.id}>{ep.title}</div>)}</div>;
}
```

### Example 2: Form Component
```javascript
// src/components/EpisodeForm.jsx
import { useState } from 'react';

function EpisodeForm({ onSubmit, initialData = {} }) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="title"
        value={formData.title || ''}
        onChange={handleChange}
        placeholder="Episode Title"
        required
      />
      {errors.title && <span className="error">{errors.title}</span>}
      
      <textarea
        name="description"
        value={formData.description || ''}
        onChange={handleChange}
        placeholder="Description"
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </button>
      
      {errors.submit && <div className="error">{errors.submit}</div>}
    </form>
  );
}

export default EpisodeForm;
```

### Example 3: Custom Hook
```javascript
// src/hooks/useFetch.js
import { useState, useEffect } from 'react';

export function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e); setLoading(false); });
  }, [url]);

  return { data, loading, error };
}

// Usage in component:
const { data: episodes, loading, error } = useFetch('http://localhost:3002/api/v1/episodes');
```

---

## 🔌 API Integration

### Available Endpoints

**Authentication**
```javascript
// Login
POST /api/v1/auth/login
{ email, password }

// Logout
POST /api/v1/auth/logout

// Refresh
POST /api/v1/auth/refresh
{ refreshToken }
```

**Episodes** (Main CRUD)
```javascript
// List
GET /api/v1/episodes?page=1&limit=10

// Get one
GET /api/v1/episodes/:id

// Create
POST /api/v1/episodes
{ title, description, episode_number, air_date, status }

// Update
PUT /api/v1/episodes/:id
{ title, description, episode_number, air_date, status }

// Delete
DELETE /api/v1/episodes/:id
```

**Thumbnails**
```javascript
// Generate
POST /api/v1/thumbnails/generate
{ composition_id, episode_id }

// Get
GET /api/v1/thumbnails/:id

// Delete
DELETE /api/v1/thumbnails/:id
```

**Search**
```javascript
// Search
GET /api/v1/search?q=query&type=episodes

// Metadata
GET /api/v1/metadata/:id
POST /api/v1/metadata/:id
```

Full reference: See [API_QUICK_REFERENCE.md](../API_QUICK_REFERENCE.md)

---

## 🧪 Testing During Development

### Option A: Browser DevTools
```javascript
// In browser console:
fetch('http://localhost:3002/api/v1/episodes')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Option B: Test Components Manually
```bash
cd frontend
npm test                    # Run tests (when added)
npm run build              # Build for production
npm run preview            # Preview build
```

### Option C: API Testing Tools
- Use Postman or Insomnia for API testing
- Test all endpoints before building UI

---

## 📝 Development Workflow

### Morning Checklist
```bash
# 1. Start backend
npm start

# 2. Start frontend
cd frontend && npm run dev

# 3. Check API
curl http://localhost:3002/health

# 4. Start coding!
```

### During Development
```bash
# Hot reload enabled by Vite
# Save files and changes appear instantly
# Check browser console for errors
# Use React DevTools extension
```

### Before Committing
```bash
# Test your components
# Check console for warnings
# Test API integration
# Verify styling
```

---

## 🎨 Styling Guide

### CSS Structure
```css
/* src/styles/variables.css - Colors, fonts, spacing */
:root {
  --primary: #3498db;
  --secondary: #2c3e50;
  --success: #27ae60;
  --danger: #e74c3c;
  --spacing: 8px;
  --font-size-base: 14px;
}

/* src/styles/components.css - Component styles */
.button {
  padding: calc(var(--spacing) * 2);
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* src/components/Button.css - Individual component styles */
.button:hover {
  opacity: 0.9;
}
```

### Using Tailwind CSS (Optional)
```bash
# Add Tailwind if you prefer
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 🚨 Common Issues & Solutions

### Port 5173 Already in Use
```bash
# Kill the process
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or use different port
npm run dev -- --port 5174
```

### API CORS Error
✅ **Already configured** - Backend allows localhost requests

### Hot Reload Not Working
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

### State Not Updating
- Check React DevTools
- Verify state setter is called correctly
- Look for missing dependencies in useEffect

### API Returns 401 Unauthorized
- Check authentication status
- Verify token in localStorage
- Check Cognito configuration

---

## 📚 Resources

### React Docs
- https://react.dev - Official React documentation
- https://react.dev/learn - Interactive tutorial

### Vite
- https://vitejs.dev - Official docs
- https://vitejs.dev/guide/ssr.html - Advanced features

### JavaScript
- https://developer.mozilla.org - Web APIs
- https://javascript.info - JS tutorial

### Styling
- https://developer.mozilla.org/en-US/docs/Web/CSS - CSS reference
- https://tailwindcss.com - If using Tailwind

---

## 🎯 Success Criteria

### By End of Day 1
- [ ] All pages created (empty)
- [ ] API calls working
- [ ] State management set up
- [ ] Base styling in place

### By End of Week 1
- [ ] Login page functional
- [ ] Episodes list working
- [ ] Episode detail page working
- [ ] Navigation between pages

### By End of Week 2
- [ ] Create episode form
- [ ] Edit episode form
- [ ] Delete functionality
- [ ] Search working

### By End of Week 3
- [ ] Responsive design
- [ ] Error handling
- [ ] Loading states
- [ ] Polish and refinement

---

## 🚀 Commands Reference

```bash
# Frontend development
npm run dev              # Start dev server
npm test                # Run tests (when added)
npm run build           # Production build
npm run preview         # Preview build

# Backend (from root)
npm start              # Start API
npm test               # Run tests
npm run migrate:up     # Database migrations
```

---

## ✨ Ready to Start?

You have everything you need:

✅ Backend running and tested  
✅ Database connected  
✅ API ready to call  
✅ Frontend environment configured  
✅ Documentation complete  

**Next Step**: Open two terminals and run:

**Terminal 1:**
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
npm start
```

**Terminal 2:**
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm run dev
```

Then open: **http://localhost:5173**

---

**Good luck with PHASE 3! 🎨**

You're building the UI for a fully-tested, production-ready backend.

Last Updated: January 6, 2026  
Status: READY TO BEGIN ✅
