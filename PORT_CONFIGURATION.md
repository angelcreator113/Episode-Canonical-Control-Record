# Port Configuration Guide

## Overview
This document clarifies the port configuration for different environments to prevent 502 Bad Gateway errors.

## Port Assignments

### Production Environment
- **Backend Port:** 3000
- **Nginx Config:** `nginx-primepisodes.conf`
- **Domains:** primepisodes.com, www.primepisodes.com
- **Environment Variable:** Set `PORT=3000` in production `.env`

### Development Environment  
- **Backend Port:** 3002
- **Nginx Config:** `nginx-episode.conf`
- **Domain:** dev.primepisodes.com
- **Environment Variable:** Set `PORT=3002` in development `.env`

### Local Development
- **Backend Port:** 3000 (default) or as specified in `.env`
- **Nginx Config:** `nginx.conf`
- **Access:** http://localhost:3000

## Server Default Behavior

The `src/server.js` file defaults to port 3000 if no `PORT` environment variable is set:

```javascript
const PORT = process.env.PORT || 3000;
```

## Troubleshooting 502 Errors

If you encounter a 502 Bad Gateway error:

1. **Check the backend is running:**
   ```bash
   curl http://localhost:PORT/health
   ```

2. **Verify port matches nginx config:**
   - For production: Backend must run on port 3000
   - For dev: Backend must run on port 3002

3. **Check environment variables:**
   ```bash
   echo $PORT
   ```

4. **Restart the backend service:**
   ```bash
   npm run start  # production
   npm run start:staging  # staging/dev
   ```

## Configuration Files

- **Backend Port:** `src/server.js` (line 13)
- **Environment Example:** `.env.example` (line 10)
- **Production Nginx:** `nginx-primepisodes.conf`
- **Dev Nginx:** `nginx-episode.conf`
- **Local Nginx:** `nginx.conf`
