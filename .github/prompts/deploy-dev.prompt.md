---
description: "Deploy to the dev server (dev.primepisodes.com). Builds frontend, SSHs to EC2, pulls code, restarts PM2, and verifies."
agent: "deploy"
---
Deploy the current code to the dev server. Follow this exact procedure:

## Pre-deploy checks
1. Run `node -c src/routes/memories.js` — abort if syntax errors
2. Run `cd frontend && npx vite build` — abort if build fails

## Deploy steps
3. SSH to EC2: `ssh -i "C:\Users\12483\episode-prod-key.pem" ubuntu@54.163.229.144`
4. On EC2:
   ```bash
   cd /home/ubuntu/episode-metadata
   git pull origin dev
   npm install --production
   cd frontend
   NODE_OPTIONS='--max-old-space-size=1536' npm run build
   sudo cp -r dist/. /var/www/html/
   sudo chown -R www-data:www-data /var/www/html
   sudo systemctl reload nginx
   cd ..
   pm2 restart episode-api
   pm2 restart episode-worker
   pm2 logs --lines 20
   ```
5. Verify the app is responding: check for crash loops in PM2 logs

## Critical frontend note
- Building frontend alone is not enough on dev.
- Nginx serves static files from `/var/www/html`, so every deploy must copy `frontend/dist` into that directory.

## Important
- The dev server is `54.163.229.144` — NOT `52.91.217.230`
- Never expose API keys or credentials
- If PM2 shows crash loops, check the error and fix before retrying
