# Phase 4 Quick Reference

## 🚀 Getting Started

### Start Everything
```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
start start.bat        # Windows
# OR
./start.sh            # Mac/Linux
```

### Access Points
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3002  
- **Health**: http://localhost:3002/health

---

## 🔐 Authentication

### Login
```
Email: test@example.com
Password: testpass123
(Any email + 6+ char password works)
```

### How It Works
1. Login → Get JWT token
2. Token stored in browser
3. All API calls include token
4. Expired token auto-refreshes
5. Failed refresh → Logout

### Files
- `src/services/authService.js` - Auth logic
- `src/pages/Login.jsx` - Login form
- `src/App.jsx` - Protected routes

---

## 📊 Status

### Working ✅
- Backend API (port 3002)
- Frontend App (port 5173)
- Login/Logout
- Protected Routes
- JWT Authentication
- Token Refresh
- Error Handling

### Blocked ⏳
- Composition Editing (schema issue)
- Asset Upload (schema issue)
- Version History (schema issue)

### Fix Required
```bash
npm run migrate:up    # Run migrations
# OR
npm run db:reset      # Reset database
```

---

## 🧪 Testing

### Test Login
```bash
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### Test Protected Endpoint
```bash
TOKEN="<token from login>"
curl http://localhost:3002/api/v1/compositions \
  -H "Authorization: Bearer $TOKEN"
```

### Test Frontend Auth
1. Open http://localhost:5173
2. Should redirect to /login
3. Enter credentials
4. Should show main app

---

## 📝 Components Updated

### CompositionEditor
- ✅ Uses authenticated axios
- ✅ Handles 401 errors
- ✅ Shows auth error message
- ⏳ Waiting for database fix

### AssetUpload  
- ✅ Uses authenticated axios
- ✅ Handles 401 errors
- ✅ Shows auth error message
- ⏳ Waiting for database fix

### VersionTimeline
- ✅ Uses regular axios (GET doesn't need auth)
- ✅ Will work once database is fixed

---

## 🔧 Key Methods

### authService
```javascript
// Login
authService.login(email, password)

// Get token
authService.getToken()

// Check auth status
authService.isAuthenticated()

// Logout
authService.logout()

// Refresh token
authService.refreshToken()

// Create authenticated axios instance
createAuthenticatedAxios()
```

---

## ⚠️ Known Issues

### Database Schema Missing Columns
**Error**: `column template.platform does not exist`

**Fix**:
```bash
# Option 1
npm run migrate:up

# Option 2
npm run db:reset

# Option 3
docker exec episode-postgres psql -U postgres -d episode_metadata \
  -c "ALTER TABLE thumbnail_templates ADD COLUMN platform VARCHAR(255);"
```

---

## 📚 Documentation Files

- `PHASE_4_INTEGRATION_TEST_REPORT.md` - Full test results
- `PHASE_4_COMPLETION_SUMMARY.md` - Session summary
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `QUICK_REFERENCE.md` - (this file)

---

## ✅ Checklist for Next Steps

- [ ] Run database migration or reset
- [ ] Verify GET /api/v1/compositions/:id works
- [ ] Login to frontend
- [ ] Try editing a composition
- [ ] Verify version created in database
- [ ] Test asset upload
- [ ] View version history
- [ ] Test version comparison
- [ ] Celebrate success! 🎉

---

## 💡 Tips

1. **Keep both servers running** - Frontend and Backend must both be active
2. **Check browser console** - F12 to see any errors
3. **Check server logs** - Look at terminal output for API errors
4. **Clear localStorage** - If auth seems broken: `localStorage.clear()`
5. **Token expires** - Default expiry is 1 hour, auto-refreshes on use

---

**Need Help?** Check PHASE_4_INTEGRATION_TEST_REPORT.md for full details!
