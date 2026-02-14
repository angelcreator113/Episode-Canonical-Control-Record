# 🏠 Homepage Stats Debugging Guide

## Issue Summary
Homepage shows **0 episodes** in all stats, but the API returns 1 episode correctly.

## Current Status ✅
- ✅ Backend API working (`/api/v1/episodes` returns 1 episode)
- ✅ Episode data: `{ id: "7ed50b54...", episode_number: 3, title: "hello", status: "draft" }`
- ✅ Frontend proxy configured correctly
- ✅ Episodes page displays the episode card

## Debug Steps

### 1. Check Browser Console (MOST IMPORTANT)
Open your browser's Developer Tools (F12) and check the Console tab for:
```
Failed to load stats: [error message]
```

### 2. Check Network Tab
1. Open DevTools → Network tab
2. Refresh the home page
3. Look for a request to `/api/v1/episodes?limit=100`
4. Click on it to see:
   - **Status**: Should be `200 OK`
   - **Response**: Should show your episode data
   - **If you see 500 error**: Backend issue
   - **If you see CORS error**: Proxy issue
   - **If you see no request**: Frontend not calling API

### 3. Potential Causes

#### A. CORS or Proxy Issue
**Symptom**: Network tab shows request to `http://localhost:5173/api/v1/episodes` fails

**Solution**: Restart Vite dev server
```powershell
cd frontend
npm run dev
```

#### B. API Error
**Symptom**: Network tab shows 500 error

**Solution**: Check backend logs
```powershell
# Backend logs should show errors
```

#### C. Frontend State Issue
**Symptom**: API returns data but stats stay at 0

**Solution**: Add debug logging to Home.jsx

## Quick Fix: Add Debug Logging

Open `frontend/src/pages/Home.jsx` and modify the `loadStats` function:

```javascript
const loadStats = async () => {
  try {
    console.log('🔄 Fetching episodes from /api/v1/episodes?limit=100...');
    
    const response = await fetch('/api/v1/episodes?limit=100');
    console.log('📡 Response status:', response.status, response.ok);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const text = await response.text();
    console.log('📄 Raw response text:', text);
    
    if (!text) throw new Error('Empty response from server');

    const data = JSON.parse(text);
    console.log('📦 Parsed data:', data);
    console.log('📊 Episodes count:', data.data?.length);

    if (data.data) {
      const episodes = data.data;
      
      const draft = episodes.filter((e) => (e.status || '').toLowerCase() === 'draft').length;
      const published = episodes.filter((e) => (e.status || '').toLowerCase() === 'published').length;
      const inProgress = episodes.filter((e) => {
        const status = (e.status || '').toLowerCase();
        return status === 'in_progress' || status === 'in progress';
      }).length;

      console.log('✅ Calculated stats:', { total: episodes.length, draft, published, inProgress });

      setStats({
        total: episodes.length,
        draft,
        published,
        inProgress
      });

      const sorted = [...episodes].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      );
      setRecentEpisodes(sorted.slice(0, 5));
    }
  } catch (error) {
    console.error('❌ Failed to load stats:', error);
    console.error('Full error details:', error.stack);
  } finally {
    setLoading(false);
  }
};
```

## What You Should See

With your 1 episode (status: "draft"), the homepage should show:
- **Total**: 1 📺
- **Published**: 0 ✅
- **In Progress**: 0 🔨
- **Draft**: 1 📝

## Next Steps

1. **Open homepage** → Check browser console
2. **Share console output** with me
3. Based on the error, I'll provide the fix

## Expected API Response
```json
{
  "data": [{
    "id": "7ed50b54-2eb3-425a-830a-6704648c4635",
    "episode_number": 3,
    "title": "hello",
    "description": "gtffggg",
    "air_date": "2026-01-21T00:00:00.000Z",
    "status": "draft",
    "categories": [],
    "created_at": "2026-01-19T06:41:59.142Z",
    "updated_at": "2026-01-19T06:41:59.142Z"
  }],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

## My Questions for You 🙋‍♂️

1. **What do you see in the browser console when you load the home page?** (F12 → Console tab)
2. **Is the Vite dev server running?** (`npm run dev` in frontend folder)
3. **Can you access** `http://localhost:5173/api/v1/episodes?limit=100` **directly in your browser?**
