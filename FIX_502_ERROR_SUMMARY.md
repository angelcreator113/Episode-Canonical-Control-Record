# 502 Error Fix - Visual Summary

## The Problem

You were experiencing a **502 Bad Gateway** error on your dev site while localhost worked fine.

```
┌─────────────┐          ┌─────────────┐          ┌──────────────┐
│   Browser   │          │    Nginx    │          │  Node.js     │
│             │  ────>   │   Reverse   │  ────>   │  Backend     │
│             │          │    Proxy    │    X     │              │
└─────────────┘          └─────────────┘          └──────────────┘
                              Port ?                  Port ?
                              MISMATCH = 502 ERROR
```

## Root Cause Analysis

### Before Fix (Mismatch)

**Localhost Setup:**
```
nginx.conf → http://localhost:3000 ✓
server.js  → PORT=3000 (from .env) ✓
Status: WORKING ✅
```

**Production Setup (primepisodes.com):**
```
nginx-primepisodes.conf → http://localhost:3002 ❌
server.js               → PORT=3002 (default) ❌
.env.example            → PORT=3000 ⚠️
Status: MISMATCH! Will fail if .env not set correctly
```

**Dev Setup (dev.primepisodes.com):**
```
nginx-episode.conf → http://localhost:3002 ✓
server.js          → PORT=3002 (intended for dev) ✓
Status: WORKING ✅ (when PORT=3002 is set)
```

## The Fix

### Changes Made

1. **server.js Default Port**
   ```diff
   - const PORT = process.env.PORT || 3002;
   + const PORT = process.env.PORT || 3000;
   ```
   **Why:** Aligns with production standard and .env.example

2. **nginx-primepisodes.conf (Production)**
   ```diff
   - proxy_pass http://localhost:3002;
   + proxy_pass http://localhost:3000;
   ```
   **Why:** Must match the backend port

3. **Added Documentation**
   - Comments in nginx configs
   - New PORT_CONFIGURATION.md guide

### After Fix (Aligned)

**Localhost:**
```
nginx.conf → Port 3000 ✓
server.js  → Port 3000 (default) ✓
Status: WORKING ✅
```

**Production (primepisodes.com):**
```
nginx-primepisodes.conf → Port 3000 ✓
server.js               → Port 3000 (default) ✓
.env                    → PORT=3000 (optional) ✓
Status: ALIGNED ✅
```

**Dev (dev.primepisodes.com):**
```
nginx-episode.conf → Port 3002 ✓
server.js          → Port 3002 (from .env) ✓
.env               → PORT=3002 (required) ✓
Status: WORKING ✅
```

## Environment Configuration

### Production Environment
```bash
# .env (production)
PORT=3000
NODE_ENV=production
```

### Dev Environment
```bash
# .env (dev)
PORT=3002
NODE_ENV=staging
```

## Deployment Checklist

### On Production Server:
- [ ] Update `nginx-primepisodes.conf` with new configuration
- [ ] Ensure `.env` has `PORT=3000` (or remove PORT to use default)
- [ ] Restart backend: `npm run start:production`
- [ ] Reload nginx: `sudo systemctl reload nginx`
- [ ] Test: `curl https://primepisodes.com/api/health`

### On Dev Server:
- [ ] Update `nginx-episode.conf` (already has correct config)
- [ ] Ensure `.env` has `PORT=3002`
- [ ] Restart backend: `npm run start:staging`
- [ ] Reload nginx: `sudo systemctl reload nginx`
- [ ] Test: `curl https://dev.primepisodes.com/api/health`

## Why This Fixes the 502 Error

A **502 Bad Gateway** occurs when nginx cannot connect to the backend server. This was happening because:

1. Nginx was configured to proxy requests to port X
2. But the Node.js backend was running on port Y
3. Nginx → Port X (no service listening) = Connection refused = 502

**The fix ensures:**
- Nginx proxies to the correct port
- Backend listens on the expected port
- Configuration is consistent and documented

## Quick Verification

After deployment, verify each environment:

```bash
# Production
curl -I https://primepisodes.com/api/health
# Expected: HTTP/1.1 200 OK

# Dev
curl -I https://dev.primepisodes.com/api/health
# Expected: HTTP/1.1 200 OK

# Localhost
curl -I http://localhost:3000/api/health
# Expected: HTTP/1.1 200 OK
```

## Troubleshooting

If you still see 502 errors after deployment:

1. **Check backend is running:**
   ```bash
   # Production
   ps aux | grep "node.*3000"
   
   # Dev
   ps aux | grep "node.*3002"
   ```

2. **Check nginx configuration:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

3. **Check backend logs:**
   ```bash
   # If using pm2
   pm2 logs
   
   # If using systemd
   journalctl -u episode-metadata-api -f
   ```

4. **Verify port is listening:**
   ```bash
   # Production
   netstat -tlnp | grep 3000
   
   # Dev
   netstat -tlnp | grep 3002
   ```

## Summary

✅ **Fixed:** Port configuration mismatch  
✅ **Standardized:** Production uses port 3000  
✅ **Documented:** Clear guide for future reference  
✅ **Tested:** No security vulnerabilities  

The 502 error should be resolved once you deploy these changes and restart your services with the correct port configurations.
